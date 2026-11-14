/**
 * Solid-OIDC sign-in for a pod destination, built to live in the plugin frame
 * (process/SOLID_DESTINATION.md, phase 0 findings).
 *
 * Inrupt's browser Session restores by a silent redirect of its own page, and
 * the provider refuses that inside another site's frame. So the frame runs the
 * flow itself: it registers a public client, opens a popup on the provider's
 * authorization page (the popup returns to the plugin page, which posts the
 * code back and closes, as for Dropbox), and exchanges the code with a
 * non-extractable DPoP key. The refresh token and the key are kept in
 * IndexedDB, so a reload refreshes without any redirect.
 *
 * Credentials belong to an account (issuer + WebID), not to a destination:
 * two folders on one pod share a sign-in. Nothing secret goes in remotes.json.
 */
import {
  createDpopHeader,
  generateDpopKeyPair,
} from '@inrupt/solid-client-authn-core';

/** Error message for "this account must sign in again" (maps to reach 'sign-in'). */
export const SOLID_AUTH_REQUIRED = 'SOLID_AUTH_REQUIRED';

export type DpopKey = Awaited<ReturnType<typeof generateDpopKeyPair>>;

/** Who a pod destination writes as. */
export interface SolidAccount {
  oidcIssuer: string;
  webId: string;
}

interface AccountRecord extends SolidAccount {
  clientId: string;
  refreshToken?: string;
  dpopKey: DpopKey;
  accessToken?: string;
  /** Epoch ms. */
  accessExpiresAt?: number;
}

const SCOPE = 'openid webid offline_access';
/** Refresh this long before the access token runs out. */
const EXPIRY_MARGIN_MS = 60_000;
const POPUP_FEATURES = 'popup,width=520,height=720';

// ---------------------------------------------------------------- storage

/** Where accounts and client registrations are kept; IndexedDB by default. */
export interface SolidStore {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

function indexedDbStore(): SolidStore {
  let opened: Promise<IDBDatabase> | null = null;
  const db = () =>
    (opened ??= new Promise((resolve, reject) => {
      const req = indexedDB.open('seedhtml-solid', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  const run = async <T>(
    mode: IDBTransactionMode,
    op: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T> => {
    const tx = (await db()).transaction('kv', mode);
    const req = op(tx.objectStore('kv'));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error);
    });
  };
  return {
    get: (key) => run('readonly', (s) => s.get(key)),
    put: (key, value) => run('readwrite', (s) => s.put(value, key)),
    delete: (key) => run('readwrite', (s) => s.delete(key)),
  };
}

let store: SolidStore | null = null;
const getStore = () => (store ??= indexedDbStore());

/** Tests swap in an in-memory store. */
export function setSolidStore(next: SolidStore | null): void {
  store = next;
}

const accountKey = (a: SolidAccount) => `account ${a.oidcIssuer} ${a.webId}`;
const clientKey = (issuer: string, redirectUri: string) =>
  `client ${issuer} ${redirectUri}`;

/**
 * Run `fn` holding a named lock across every frame of this origin, so two
 * frames never spend the same (rotating) refresh token.
 */
function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(name, fn) as Promise<T>;
  }
  const run = (localLocks.get(name) ?? Promise.resolve()).then(fn, fn);
  localLocks.set(
    name,
    run.catch(() => undefined),
  );
  return run;
}
const localLocks = new Map<string, Promise<unknown>>();

// ---------------------------------------------------------------- provider

interface IssuerConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
}

const issuerConfigs = new Map<string, Promise<IssuerConfig>>();

function issuerConfig(issuer: string): Promise<IssuerConfig> {
  let config = issuerConfigs.get(issuer);
  if (!config) {
    config = fetch(new URL('.well-known/openid-configuration', withSlash(issuer)))
      .then((res) => {
        if (!res.ok) throw new Error(`Provider not found (${res.status})`);
        return res.json() as Promise<IssuerConfig>;
      })
      .catch((error) => {
        issuerConfigs.delete(issuer);
        throw error;
      });
    issuerConfigs.set(issuer, config);
  }
  return config;
}

const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`);

/** The plugin page: where the popup returns (App.svelte posts the code on). */
export function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

async function clientIdFor(issuer: string, config: IssuerConfig): Promise<string> {
  const key = clientKey(issuer, redirectUri());
  const known = await getStore().get<string>(key);
  if (known) return known;
  if (!config.registration_endpoint) {
    throw new Error('This provider does not accept new apps.');
  }
  const res = await fetch(config.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'SEED.html',
      client_uri: 'https://readitinabook.com/',
      application_type: 'web',
      redirect_uris: [redirectUri()],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: SCOPE,
    }),
  });
  if (!res.ok) throw new Error(`Registration failed (${res.status})`);
  const clientId = (await res.json()).client_id as string;
  await getStore().put(key, clientId);
  return clientId;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
}

/** POST to the token endpoint with a DPoP proof. `invalid` marks a dead grant. */
async function tokenRequest(
  config: IssuerConfig,
  body: Record<string, string>,
  key: DpopKey,
): Promise<TokenResponse> {
  const res = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      DPoP: await createDpopHeader(config.token_endpoint, 'POST', key),
    },
    body: new URLSearchParams(body),
  });
  if (res.ok) return res.json() as Promise<TokenResponse>;
  const detail = await res.json().catch(() => ({}));
  if (res.status === 400 || res.status === 401) {
    // invalid_grant and friends: the sign-in has lapsed or been revoked.
    throw new Error(SOLID_AUTH_REQUIRED, { cause: detail });
  }
  throw new Error(`Token request failed (${res.status})`);
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const randomString = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

/** The WebID an ID token names (the `webid` claim, else `sub`). */
export function webIdFromIdToken(idToken: string): string | undefined {
  try {
    const part = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part));
    return (claims.webid ?? claims.sub) as string | undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- sign-in

/**
 * Sign in to a Solid provider in a popup. Call it straight from a click: the
 * popup is opened before anything is awaited, or Safari blocks it.
 */
export function signInWithSolid(oidcIssuer: string): Promise<SolidAccount> {
  const popup = window.open('about:blank', 'solid_auth', POPUP_FEATURES);
  if (!popup) return Promise.reject(new Error('The sign-in window was blocked.'));
  return completeSignIn(oidcIssuer, popup).catch((error) => {
    if (!popup.closed) popup.close();
    throw error;
  });
}

async function completeSignIn(
  oidcIssuer: string,
  popup: Window,
): Promise<SolidAccount> {
  const config = await issuerConfig(oidcIssuer);
  const clientId = await clientIdFor(oidcIssuer, config);
  const verifier = randomString();
  const challenge = b64url(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
    ),
  );
  const state = randomString();
  const auth = new URL(config.authorization_endpoint);
  auth.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    // oidc-provider only grants offline_access (a refresh token) on consent.
    prompt: 'consent',
  }).toString();
  popup.location.href = auth.href;

  const code = await waitForCode(state, popup);
  const dpopKey = await generateDpopKeyPair(false);
  const tokens = await tokenRequest(
    config,
    {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: clientId,
      code_verifier: verifier,
    },
    dpopKey,
  );
  const webId = tokens.id_token ? webIdFromIdToken(tokens.id_token) : undefined;
  if (!webId) throw new Error('The provider did not say who you are.');
  const record: AccountRecord = {
    oidcIssuer,
    webId,
    clientId,
    dpopKey,
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    accessExpiresAt: expiresAt(tokens),
  };
  await getStore().put(accountKey(record), record);
  return { oidcIssuer, webId };
}

const expiresAt = (tokens: TokenResponse) =>
  Date.now() + (tokens.expires_in ?? 300) * 1000;

/** Resolves with the code App.svelte relays from the popup; rejects if it closes. */
function waitForCode(state: string, popup: Window): Promise<string> {
  return new Promise((resolve, reject) => {
    const done = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(watch);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'oauth-callback' || event.data.state !== state)
        return;
      done();
      if (event.data.error) {
        reject(new Error(event.data.errorDescription || event.data.error));
      } else {
        resolve(event.data.code as string);
      }
    };
    // A closed popup with no answer: the person gave up.
    const watch = setInterval(() => {
      if (popup.closed) {
        done();
        reject(new Error('The sign-in window was closed.'));
      }
    }, 500);
    window.addEventListener('message', onMessage);
  });
}

/** Forget an account's sign-in on this device. */
export async function signOutOfSolid(account: SolidAccount): Promise<void> {
  await getStore().delete(accountKey(account));
}

/** True when this device holds a sign-in for the account. */
export async function isSignedIn(account: SolidAccount): Promise<boolean> {
  const record = await getStore().get<AccountRecord>(accountKey(account));
  return !!record?.refreshToken || !!record?.accessToken;
}

// ---------------------------------------------------------------- requests

/**
 * A current access token for the account, refreshed under a cross-frame lock
 * when it is near expiry (or when `force`d after a 401). Throws
 * SOLID_AUTH_REQUIRED when the account must sign in again.
 */
async function currentToken(
  account: SolidAccount,
  force = false,
): Promise<{ accessToken: string; dpopKey: DpopKey }> {
  const key = accountKey(account);
  return withLock(`seedhtml-solid ${key}`, async () => {
    const record = await getStore().get<AccountRecord>(key);
    if (!record) throw new Error(SOLID_AUTH_REQUIRED);
    const fresh =
      record.accessToken &&
      (record.accessExpiresAt ?? 0) - EXPIRY_MARGIN_MS > Date.now();
    if (fresh && !force) {
      return { accessToken: record.accessToken!, dpopKey: record.dpopKey };
    }
    if (!record.refreshToken) throw new Error(SOLID_AUTH_REQUIRED);
    const config = await issuerConfig(record.oidcIssuer);
    let tokens: TokenResponse;
    try {
      tokens = await tokenRequest(
        config,
        {
          grant_type: 'refresh_token',
          refresh_token: record.refreshToken,
          client_id: record.clientId,
        },
        record.dpopKey,
      );
    } catch (error) {
      if (error instanceof Error && error.message === SOLID_AUTH_REQUIRED) {
        await getStore().put(key, {
          ...record,
          refreshToken: undefined,
          accessToken: undefined,
        });
      }
      throw error;
    }
    const next: AccountRecord = {
      ...record,
      // The provider rotates refresh tokens; keep the old one if it does not.
      refreshToken: tokens.refresh_token ?? record.refreshToken,
      accessToken: tokens.access_token,
      accessExpiresAt: expiresAt(tokens),
    };
    await getStore().put(key, next);
    return { accessToken: next.accessToken!, dpopKey: next.dpopKey };
  });
}

/** Authorization and DPoP headers for one request (XHR uploads use these). */
export async function solidAuthHeaders(
  account: SolidAccount,
  url: string,
  method: string,
  force = false,
): Promise<Record<string, string>> {
  const { accessToken, dpopKey } = await currentToken(account, force);
  return {
    Authorization: `DPoP ${accessToken}`,
    DPoP: await createDpopHeader(url, method.toUpperCase(), dpopKey),
  };
}

/**
 * fetch() as the account. A 401 retries once with a refreshed token. Throws
 * SOLID_AUTH_REQUIRED when the account must sign in again.
 */
export async function solidFetch(
  account: SolidAccount,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const send = async (force: boolean) => {
    const headers = new Headers(init.headers);
    const auth = await solidAuthHeaders(account, url, method, force);
    Object.entries(auth).forEach(([k, v]) => headers.set(k, v));
    return fetch(url, { ...init, method, headers });
  };
  const first = await send(false);
  if (first.status !== 401) return first;
  return send(true);
}
