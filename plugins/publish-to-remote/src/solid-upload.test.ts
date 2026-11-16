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
  parseContainerListing,
  parseProfile,
  serverMessage,
  uploadToSolid,
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
// As Community Solid Server answers a folder: absolute names, posix stats.
const LISTING = `@prefix dc: <http://purl.org/dc/terms/>.
@prefix ldp: <http://www.w3.org/ns/ldp#>.
@prefix posix: <http://www.w3.org/ns/posix/stat#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
<> a ldp:Container, ldp:BasicContainer, ldp:Resource;
    dc:modified "2026-11-14T06:17:05.032Z"^^xsd:dateTime.
<My%20Book.epub> a ldp:Resource;
    dc:modified "2026-11-14T06:25:09.859Z"^^xsd:dateTime.
<shelf/> a ldp:Container, ldp:BasicContainer, ldp:Resource.
<> ldp:contains <My%20Book.epub>, <old.epub>, <shelf/>.
<My%20Book.epub> posix:size 51.
<old.epub> posix:mtime 1794637509.
`;

// As Inrupt's server answers: root-relative names, no sizes or dates.
const INRUPT_FOLDER = 'https://storage.example/pod-1/test/';
const INRUPT_LISTING = `@prefix ldp: <http://www.w3.org/ns/ldp#>.
</pod-1/test/My%20Book.epub> a ldp:NonRDFSource.
</pod-1/test/shelf/> a ldp:BasicContainer.
<https://storage.example/pod-1/test/> a ldp:BasicContainer;
    ldp:contains </pod-1/test/My%20Book.epub>, </pod-1/test/shelf/>.
`;

describe('parseContainerListing', () => {
  it('lists the files in the folder with size and date, leaving out sub-folders', () => {
    expect(parseContainerListing(remote.containerUrl, LISTING)).toEqual([
      { key: 'My Book.epub', size: 51, lastModified: '2026-11-14T06:25:09.859Z' },
      {
        key: 'old.epub',
        size: 0,
        lastModified: new Date(1794637509 * 1000).toISOString(),
      },
    ]);
  });

  it("reads Inrupt's listing, resolving names against the folder", () => {
    expect(parseContainerListing(INRUPT_FOLDER, INRUPT_LISTING)).toEqual([
      { key: 'My Book.epub', size: 0, lastModified: '' },
    ]);
    expect(parseContainerFolders(INRUPT_FOLDER, INRUPT_LISTING)).toEqual([
      `${INRUPT_FOLDER}shelf/`,
    ]);
  });

  it('returns nothing for a folder that lists nothing, and throws on broken Turtle', () => {
    expect(parseContainerListing(FOLDER, '<> a <http://www.w3.org/ns/ldp#Container>.')).toEqual([]);
    expect(() => parseContainerListing(FOLDER, '<> a .')).toThrow();
  });
});

describe('listSolidFiles', () => {
  it('asks the folder for Turtle, bypassing the browser cache', async () => {
    fetchAs.mockResolvedValue(
      new Response(LISTING, { headers: { 'Content-Type': 'text/turtle' } }),
    );
    const result = await listSolidFiles(remote);
    expect(result.objects).toHaveLength(2);
    const [account, url, init] = fetchAs.mock.calls[0];
    expect(account).toEqual({ oidcIssuer: remote.oidcIssuer, webId: remote.webId });
    expect(url).toBe(FOLDER);
    expect(new Headers(init?.headers).get('Accept')).toBe('text/turtle');
    expect(init?.cache).toBe('no-store');
  });

  it("asks each file for the size and date a listing left out", async () => {
    const folder = 'https://storage.example/pod-1/test/';
    const inrupt = { ...remote, containerUrl: folder };
    fetchAs
      .mockResolvedValueOnce(
        new Response(INRUPT_LISTING, { headers: { 'Content-Type': 'text/turtle' } }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            'Content-Length': '15099102',
            'Last-Modified': 'Sun, 15 Nov 2026 08:10:00 GMT',
          },
        }),
      );
    const result = await listSolidFiles(inrupt);
    expect(result.objects).toEqual([
      { key: 'My Book.epub', size: 15099102, lastModified: '2026-11-15T08:10:00.000Z' },
    ]);
    const [, url, init] = fetchAs.mock.calls[1];
    expect(url).toBe(`${folder}My%20Book.epub`);
    expect(init?.method).toBe('HEAD');
  });

  it('names the format when the pod answers with something other than Turtle', async () => {
    fetchAs.mockResolvedValue(
      new Response('{"@graph":[]}', { headers: { 'Content-Type': 'application/ld+json' } }),
    );
    expect((await listSolidFiles(remote)).error).toBe(
      `The pod sent application/ld+json instead of Turtle for ${remote.containerUrl}`,
    );
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
  it('counts the folder public when an anonymous request succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      // A WAC-Allow header that says otherwise does not override the answer.
      .mockResolvedValueOnce(
        new Response(null, { headers: { 'WAC-Allow': 'user="read",public=""' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    expect(await isFolderPublic(remote)).toEqual({ public: false });
    expect(await isFolderPublic(remote)).toEqual({ public: true });
    expect(fetchMock.mock.calls[0][0]).toBe(FOLDER);
    expect(fetchMock.mock.calls[0][1]?.headers).toBeUndefined();
    expect(fetchMock.mock.calls[0][1]?.cache).toBe('no-store');
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
      // The .acl does not exist yet: a WAC pod answers 404, with no ACP type.
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 201 }));

    expect(await makeFolderPublic(remote)).toEqual({ success: true });
    const [, url, init] = fetchAs.mock.calls[2];
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
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 201 }));

    expect(await makeFolderPublic(remote)).toEqual({ success: true });
    expect(fetchAs.mock.calls.map(([, , init]) => init?.method)).toEqual([
      'HEAD',
      'PUT',
      'HEAD',
      'HEAD',
      'PUT',
    ]);
  });

  it('adds a public-read policy on a pod that uses Access Control Policies', async () => {
    const acr = `${FOLDER}?ext=acr`;
    fetchAs
      .mockResolvedValueOnce(
        new Response(null, { headers: { Link: `<${acr}>; rel="acl"` } }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            Link: '<http://www.w3.org/ns/solid/acp#AccessControlResource>; rel="type"',
          },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 205 }));

    expect(await makeFolderPublic(remote)).toEqual({ success: true });
    const [, url, init] = fetchAs.mock.calls[2];
    expect(url).toBe(acr);
    expect(init?.method).toBe('PATCH');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/sparql-update');
    const body = String(init?.body);
    expect(body).toContain('INSERT DATA');
    expect(body).toContain(`<${acr}> acp:accessControl <${acr}#seedhtml-public>`);
    expect(body).toContain(`acp:memberAccessControl <${acr}#seedhtml-public>`);
    expect(body).toContain('acp:agent acp:PublicAgent');
    expect(body).toContain('acp:allow acl:Read');
  });

  it("passes on the pod's reason when it refuses the access change", async () => {
    fetchAs
      .mockResolvedValueOnce(new Response(null, { headers: { Link: '<.acl>; rel="acl"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response('{"message":"Not allowed"}', { status: 409, statusText: 'Conflict' }),
      );
    expect((await makeFolderPublic(remote)).error).toBe('Sharing failed: 409 Conflict: Not allowed');
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
    const profile = `@prefix foaf: <http://xmlns.com/foaf/0.1/>.
@prefix pim: <http://www.w3.org/ns/pim/space#>.
<> a foaf:PersonalProfileDocument; foaf:primaryTopic <#me>.
<#me> pim:storage </me/>; foaf:name "Nell".
`;
    expect(parseProfile(webId, profile, 'https://pod.example/me/profile/card')).toEqual({
      name: 'Nell',
      storages: ['https://pod.example/me/'],
    });
    expect(parseProfile(webId, '')).toEqual({ name: undefined, storages: [] });
  });

  it("reads Inrupt's profile, fetched from a ?lookup address", () => {
    const webId = 'https://id.inrupt.com/nell';
    const profile = `<https://id.inrupt.com/nell>
        a       <http://xmlns.com/foaf/0.1/Agent>;
        <http://www.w3.org/ns/pim/space#storage>
                <https://storage.inrupt.com/0000-1111/>;
        <http://www.w3.org/ns/solid/terms#oidcIssuer>
                <https://login.inrupt.com> .
`;
    expect(parseProfile(webId, profile, 'https://id.inrupt.com/nell?lookup')).toEqual({
      name: undefined,
      storages: ['https://storage.inrupt.com/0000-1111/'],
    });
  });
});
