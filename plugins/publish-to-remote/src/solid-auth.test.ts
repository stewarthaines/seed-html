import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@inrupt/solid-client-authn-core', () => ({
  generateDpopKeyPair: vi.fn(async () => ({ privateKey: {}, publicKey: {} })),
  createDpopHeader: vi.fn(
    async (url: string, method: string) => `proof ${method} ${url}`,
  ),
}));

import {
  SOLID_AUTH_REQUIRED,
  isSignedIn,
  setSolidStore,
  solidFetch,
  webIdFromIdToken,
  type SolidStore,
} from './solid-auth.js';

const ISSUER = 'https://idp.example/';
const WEBID = 'https://pod.example/me/profile/card#me';
const account = { oidcIssuer: ISSUER, webId: WEBID };
const KEY = `account ${ISSUER} ${WEBID}`;
const TOKEN_ENDPOINT = 'https://idp.example/.oidc/token';

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  const store: SolidStore & { data: Map<string, unknown> } = {
    data,
    get: async <T>(key: string) => data.get(key) as T | undefined,
    put: async (key, value) => void data.set(key, value),
    delete: async (key) => void data.delete(key),
  };
  return store;
}

const record = (overrides: Record<string, unknown> = {}) => ({
  oidcIssuer: ISSUER,
  webId: WEBID,
  clientId: 'client-1',
  dpopKey: { privateKey: {}, publicKey: {} },
  refreshToken: 'refresh-1',
  accessToken: 'access-1',
  accessExpiresAt: Date.now() + 3_600_000,
  ...overrides,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** A fetch that answers discovery and the token endpoint, and records the rest. */
function providerFetch(
  token: () => Response,
  resource: (url: string, init: RequestInit) => Response = () =>
    new Response('ok'),
) {
  return vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    if (url.endsWith('/.well-known/openid-configuration')) {
      return json({
        authorization_endpoint: 'https://idp.example/.oidc/auth',
        token_endpoint: TOKEN_ENDPOINT,
        registration_endpoint: 'https://idp.example/.oidc/reg',
      });
    }
    if (url === TOKEN_ENDPOINT) return token();
    return resource(url, init);
  });
}

let store: ReturnType<typeof memoryStore>;

beforeEach(() => {
  store = memoryStore();
  setSolidStore(store);
});

afterEach(() => {
  setSolidStore(null);
  vi.unstubAllGlobals();
});

describe('solidFetch', () => {
  it('sends a fresh access token with a DPoP proof for the request', async () => {
    store.data.set(KEY, record());
    const fetchMock = providerFetch(() => json({}, 500));
    vi.stubGlobal('fetch', fetchMock);

    const res = await solidFetch(account, 'https://pod.example/books/a.epub', {
      method: 'put',
    });

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://pod.example/books/a.epub');
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('DPoP access-1');
    expect(headers.get('DPoP')).toBe(
      'proof PUT https://pod.example/books/a.epub',
    );
  });

  it('refreshes a token near expiry and keeps the rotated refresh token', async () => {
    store.data.set(KEY, record({ accessExpiresAt: Date.now() + 1000 }));
    const fetchMock = providerFetch(() =>
      json({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await solidFetch(account, 'https://pod.example/books/');

    const tokenCall = fetchMock.mock.calls.find(([u]) => String(u) === TOKEN_ENDPOINT);
    const body = new URLSearchParams(String(tokenCall?.[1]?.body));
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh-1');
    expect(body.get('client_id')).toBe('client-1');
    const last = fetchMock.mock.calls.at(-1);
    expect(new Headers(last?.[1]?.headers).get('Authorization')).toBe('DPoP access-2');
    expect(store.data.get(KEY)).toMatchObject({
      refreshToken: 'refresh-2',
      accessToken: 'access-2',
    });
  });

  it('refreshes once for requests made together', async () => {
    store.data.set(KEY, record({ accessExpiresAt: 0 }));
    const fetchMock = providerFetch(() =>
      json({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([
      solidFetch(account, 'https://pod.example/a'),
      solidFetch(account, 'https://pod.example/b'),
    ]);

    const tokenCalls = fetchMock.mock.calls.filter(([u]) => String(u) === TOKEN_ENDPOINT);
    expect(tokenCalls).toHaveLength(1);
  });

  it('retries a 401 once with a refreshed token', async () => {
    store.data.set(KEY, record());
    let resourceCalls = 0;
    const fetchMock = providerFetch(
      () => json({ access_token: 'access-2', expires_in: 3600 }),
      () => new Response('', { status: resourceCalls++ === 0 ? 401 : 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await solidFetch(account, 'https://pod.example/books/');

    expect(res.status).toBe(200);
    expect(resourceCalls).toBe(2);
    // No rotation offered: the old refresh token is kept.
    expect(store.data.get(KEY)).toMatchObject({ refreshToken: 'refresh-1' });
  });

  it('asks for a new sign-in when the refresh is refused, and forgets the tokens', async () => {
    store.data.set(KEY, record({ accessExpiresAt: 0 }));
    vi.stubGlobal('fetch', providerFetch(() => json({ error: 'invalid_grant' }, 400)));

    await expect(solidFetch(account, 'https://pod.example/books/')).rejects.toThrow(
      SOLID_AUTH_REQUIRED,
    );
    expect(await isSignedIn(account)).toBe(false);
  });

  it('asks for a sign-in when this device has none for the account', async () => {
    vi.stubGlobal('fetch', providerFetch(() => json({})));
    await expect(solidFetch(account, 'https://pod.example/books/')).rejects.toThrow(
      SOLID_AUTH_REQUIRED,
    );
  });
});

describe('webIdFromIdToken', () => {
  const token = (claims: object) =>
    `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.s`;

  it('reads the webid claim, else sub', () => {
    expect(webIdFromIdToken(token({ webid: WEBID, sub: 'x' }))).toBe(WEBID);
    expect(webIdFromIdToken(token({ sub: WEBID }))).toBe(WEBID);
  });

  it('returns undefined for a malformed token', () => {
    expect(webIdFromIdToken('nonsense')).toBeUndefined();
  });
});
