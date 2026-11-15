import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('./solid-auth.js', () => ({
  SOLID_AUTH_REQUIRED: 'SOLID_AUTH_REQUIRED',
  solidFetch: vi.fn(),
  solidAuthHeaders: vi.fn(async () => ({ Authorization: 'DPoP t', DPoP: 'p' })),
}));

import { solidFetch } from './solid-auth.js';
import {
  deleteSolidFile,
  getSolidPublicUrl,
  getSolidText,
  isFolderPublic,
  listSolidFiles,
  folderName,
  makeFolderPublic,
  parseContainerFolders,
  parseContainerJsonLd,
  parseProfile,
  serverMessage,
  uploadToSolid,
  wacModes,
} from './solid-upload.js';
import type { SolidRemoteConfig } from './types.js';

const remote: SolidRemoteConfig = {
  id: '1',
  name: 'pod',
  type: 'solid',
  oidcIssuer: 'https://idp.example/',
  webId: 'https://pod.example/me/profile/card#me',
  containerUrl: 'https://pod.example/me/books',
};
const FOLDER = 'https://pod.example/me/books/';
const fetchAs = vi.mocked(solidFetch);

afterEach(() => {
  fetchAs.mockReset();
  vi.unstubAllGlobals();
});

// As Community Solid Server answers: one node per resource for types and
// dates, and a second node per resource for the posix stats and containment.
const LISTING = [
  {
    '@id': FOLDER,
    '@type': ['http://www.w3.org/ns/ldp#Container'],
    'http://purl.org/dc/terms/modified': [{ '@value': '2026-11-14T06:17:05.032Z' }],
  },
  {
    '@id': `${FOLDER}My%20Book.epub`,
    'http://purl.org/dc/terms/modified': [{ '@value': '2026-11-14T06:25:09.859Z' }],
  },
  { '@id': `${FOLDER}old.epub` },
  {
    '@id': FOLDER,
    'http://www.w3.org/ns/ldp#contains': [
      { '@id': `${FOLDER}My%20Book.epub` },
      { '@id': `${FOLDER}old.epub` },
      { '@id': `${FOLDER}shelf/` },
    ],
  },
  {
    '@id': `${FOLDER}My%20Book.epub`,
    'http://www.w3.org/ns/posix/stat#size': [{ '@value': '51' }],
  },
  {
    '@id': `${FOLDER}old.epub`,
    'http://www.w3.org/ns/posix/stat#mtime': [{ '@value': '1794637509' }],
  },
];

describe('parseContainerJsonLd', () => {
  it('lists the files in the folder with size and date, leaving out sub-folders', () => {
    expect(parseContainerJsonLd(remote.containerUrl, LISTING)).toEqual([
      { key: 'My Book.epub', size: 51, lastModified: '2026-11-14T06:25:09.859Z' },
      {
        key: 'old.epub',
        size: 0,
        lastModified: new Date(1794637509 * 1000).toISOString(),
      },
    ]);
  });

  it('reads a @graph wrapper and returns nothing for an unknown shape', () => {
    expect(parseContainerJsonLd(FOLDER, { '@graph': LISTING })).toHaveLength(2);
    expect(parseContainerJsonLd(FOLDER, { hello: 'world' })).toEqual([]);
  });
});

describe('listSolidFiles', () => {
  it('asks the folder for JSON-LD', async () => {
    fetchAs.mockResolvedValue(new Response(JSON.stringify(LISTING)));
    const result = await listSolidFiles(remote);
    expect(result.objects).toHaveLength(2);
    const [account, url, init] = fetchAs.mock.calls[0];
    expect(account).toEqual({ oidcIssuer: remote.oidcIssuer, webId: remote.webId });
    expect(url).toBe(FOLDER);
    expect(new Headers(init?.headers).get('Accept')).toBe('application/ld+json');
  });

  it('treats a folder not yet created as empty', async () => {
    fetchAs.mockResolvedValue(new Response('', { status: 404 }));
    expect(await listSolidFiles(remote)).toEqual({ objects: [] });
  });

  it('passes a lapsed sign-in on as SOLID_AUTH_REQUIRED', async () => {
    fetchAs.mockRejectedValue(new Error('SOLID_AUTH_REQUIRED'));
    expect((await listSolidFiles(remote)).error).toBe('SOLID_AUTH_REQUIRED');
  });
});

describe('uploadToSolid', () => {
  it('PUTs the file with its content type and returns its address', async () => {
    fetchAs.mockResolvedValue(new Response('', { status: 201 }));
    const result = await uploadToSolid(remote, 'My Book.epub', new Blob(['x']));
    expect(result).toEqual({ success: true, url: `${FOLDER}My%20Book.epub` });
    const [, url, init] = fetchAs.mock.calls[0];
    expect(url).toBe(`${FOLDER}My%20Book.epub`);
    expect(init?.method).toBe('PUT');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/epub+zip');
  });

  it('names a write the account is not allowed', async () => {
    fetchAs.mockResolvedValue(new Response('', { status: 403, statusText: 'Forbidden' }));
    const result = await uploadToSolid(remote, 'a.epub', new Blob(['x']));
    expect(result.success).toBe(false);
    expect(result.error).toContain('403');
  });

  it('gives the pod\'s reason and removes the part it kept of a failed upload', async () => {
    fetchAs
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ name: 'InternalServerError', message: 'Lock expired after 6000ms on x' }),
          { status: 500, statusText: 'Internal Server Error' },
        ),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { 'Content-Length': '3', 'Last-Modified': new Date().toUTCString() },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 205 }));

    const result = await uploadToSolid(remote, 'a.epub', new Blob(['12345678']));

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Upload failed: 500 Internal Server Error: Lock expired after 6000ms on x. The incomplete copy was removed.',
    );
    expect(fetchAs.mock.calls.map(([, , init]) => init?.method)).toEqual([
      'PUT',
      'HEAD',
      'DELETE',
    ]);
  });

  it('leaves an earlier copy alone when the failed upload wrote nothing', async () => {
    fetchAs
      .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Internal Server Error' }))
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { 'Content-Length': '3', 'Last-Modified': 'Mon, 02 Nov 2026 01:00:00 GMT' },
        }),
      );

    const result = await uploadToSolid(remote, 'a.epub', new Blob(['12345678']));

    expect(result.error).toBe('Upload failed: 500 Internal Server Error');
    expect(fetchAs.mock.calls.map(([, , init]) => init?.method)).toEqual(['PUT', 'HEAD']);
  });

  it('does not look for a partial copy after a refused write', async () => {
    fetchAs.mockResolvedValue(new Response('', { status: 403, statusText: 'Forbidden' }));
    await uploadToSolid(remote, 'a.epub', new Blob(['x']));
    expect(fetchAs).toHaveBeenCalledTimes(1);
  });

  it('reads a plain-text reason and ignores an HTML error page', () => {
    expect(serverMessage('{"message":" Quota exceeded "}')).toBe('Quota exceeded');
    expect(serverMessage('Disk full')).toBe('Disk full');
    expect(serverMessage('<html><body>Bad gateway</body></html>')).toBe('');
    expect(serverMessage('')).toBe('');
  });

  it('reports a 401 that survived the retry as SOLID_AUTH_REQUIRED', async () => {
    fetchAs.mockResolvedValue(new Response('', { status: 401 }));
    const result = await uploadToSolid(remote, 'a.epub', new Blob(['x']));
    expect(result.error).toBe('SOLID_AUTH_REQUIRED');
  });
});

describe('reads, deletes and links', () => {
  it('deletes, counting a file already gone as done', async () => {
    fetchAs.mockResolvedValue(new Response('', { status: 404 }));
    expect(await deleteSolidFile(remote, 'a.epub')).toEqual({ success: true });
    expect(fetchAs.mock.calls[0][2]?.method).toBe('DELETE');
  });

  it('reads a catalog back, or null when there is none', async () => {
    fetchAs.mockResolvedValueOnce(new Response('{"feed":1}'));
    expect(await getSolidText(remote, 'catalog.json')).toBe('{"feed":1}');
    fetchAs.mockResolvedValueOnce(new Response('', { status: 404 }));
    expect(await getSolidText(remote, 'catalog.json')).toBeNull();
  });

  it("uses the resource's own address as its public link", () => {
    expect(getSolidPublicUrl(remote, 'a b.epub')).toBe(`${FOLDER}a%20b.epub`);
  });
});

describe('public access', () => {
  it('reads the modes WAC-Allow grants a group', () => {
    const header = 'user="read write append control",public="read"';
    expect(wacModes(header, 'public')).toEqual(['read']);
    expect(wacModes(header, 'user')).toEqual(['read', 'write', 'append', 'control']);
    expect(wacModes(null, 'public')).toEqual([]);
  });

  it('asks anonymously whether the folder is public', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { headers: { 'WAC-Allow': 'user="read",public=""' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect(await isFolderPublic(remote)).toEqual({ public: false });
    expect(fetchMock.mock.calls[0][0]).toBe(FOLDER);
    expect(fetchMock.mock.calls[0][1]?.headers).toBeUndefined();
  });

  it('writes public-read rules to the access resource the folder names', async () => {
    fetchAs
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            Link: '<http://www.w3.org/ns/ldp#Container>; rel="type", <.acl>; rel="acl"',
          },
        }),
      )
      .mockResolvedValueOnce(new Response('', { status: 201 }));

    expect(await makeFolderPublic(remote)).toEqual({ success: true });
    const [, url, init] = fetchAs.mock.calls[1];
    expect(url).toBe(`${FOLDER}.acl`);
    expect(init?.method).toBe('PUT');
    expect(String(init?.body)).toContain(`acl:agent <${remote.webId}>`);
    expect(String(init?.body)).toContain('acl:agentClass foaf:Agent');
  });

  it('creates the folder first when nothing has been sent yet', async () => {
    fetchAs
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 201 }))
      .mockResolvedValueOnce(
        new Response(null, { headers: { Link: '<.acl>; rel="acl"' } }),
      )
      .mockResolvedValueOnce(new Response('', { status: 201 }));

    expect(await makeFolderPublic(remote)).toEqual({ success: true });
    expect(fetchAs.mock.calls.map(([, , init]) => init?.method)).toEqual([
      'HEAD',
      'PUT',
      'HEAD',
      'PUT',
    ]);
  });
});

describe('choosing a folder', () => {
  it('lists only the sub-folders of a folder', () => {
    expect(parseContainerFolders(FOLDER, LISTING)).toEqual([`${FOLDER}shelf/`]);
  });

  it('names a folder by its last segment', () => {
    expect(folderName('https://pod.example/me/family%20books/')).toBe('family books');
    expect(folderName('https://pod.example/')).toBe('https://pod.example/');
  });

  it('reads the pods and name a profile gives', () => {
    const webId = 'https://pod.example/me/profile/card#me';
    const profile = [
      { '@id': 'https://pod.example/me/profile/card' },
      {
        '@id': webId,
        'http://www.w3.org/ns/pim/space#storage': [{ '@id': 'https://pod.example/me/' }],
        'http://xmlns.com/foaf/0.1/name': [{ '@value': 'Nell' }],
      },
    ];
    expect(parseProfile(webId, profile)).toEqual({
      name: 'Nell',
      storages: ['https://pod.example/me/'],
    });
    expect(parseProfile(webId, [])).toEqual({ name: undefined, storages: [] });
  });
});
