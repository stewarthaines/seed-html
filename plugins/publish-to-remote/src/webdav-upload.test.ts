import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  uploadToWebDAV,
  listWebDAVFiles,
  deleteWebDAVFile,
  getWebDAVPublicUrl,
} from './webdav-upload.js';
import type { WebDAVRemoteConfig } from './types.js';

const creds: WebDAVRemoteConfig = {
  id: '1',
  name: 'dav',
  type: 'webdav',
  url: 'https://dav.example.com/books',
  username: 'user',
  password: 'pass',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadToWebDAV', () => {
  it('PUTs the blob with Basic auth and returns the resource URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 201, statusText: 'Created' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await uploadToWebDAV(creds, 'book.epub', new Blob(['data']));

    expect(result.success).toBe(true);
    expect(result.url).toBe('https://dav.example.com/books/book.epub');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://dav.example.com/books/book.epub');
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe(`Basic ${btoa('user:pass')}`);
  });

  it('reports a clear 401 authentication error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }),
    );
    const result = await uploadToWebDAV(creds, 'book.epub', new Blob(['data']));
    expect(result.success).toBe(false);
    expect(result.error).toContain('401');
  });

  it('reports a 409 when the storage path is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 409, statusText: 'Conflict' }),
    );
    const result = await uploadToWebDAV(creds, 'book.epub', new Blob(['data']));
    expect(result.success).toBe(false);
    expect(result.error).toContain('409');
  });
});

describe('listWebDAVFiles', () => {
  it('PROPFINDs and parses a 207 multistatus into file objects (all files)', async () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/books/</d:href>
    <d:propstat><d:prop><d:getlastmodified>Mon, 01 Jan 2024 00:00:00 GMT</d:getlastmodified></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/books/book1.epub</d:href>
    <d:propstat><d:prop>
      <d:getcontentlength>1024</d:getcontentlength>
      <d:getlastmodified>Mon, 01 Jan 2024 00:00:00 GMT</d:getlastmodified>
    </d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/books/notes.txt</d:href>
    <d:propstat><d:prop><d:getcontentlength>5</d:getcontentlength></d:prop></d:propstat>
  </d:response>
</d:multistatus>`;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 207,
      statusText: 'Multi-Status',
      text: async () => xml,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listWebDAVFiles(creds);

    expect(result.error).toBeUndefined();
    // The collection (/books/) is skipped; all files are returned (not just epubs).
    expect(result.objects).toEqual([
      {
        key: 'book1.epub',
        size: 1024,
        lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
      },
      {
        key: 'notes.txt',
        size: 5,
        lastModified: '',
      },
    ]);
    expect(fetchMock.mock.calls[0][1].method).toBe('PROPFIND');
    expect(fetchMock.mock.calls[0][1].headers.Depth).toBe('1');
    // Collection addressed with a trailing slash so servers don't 301-redirect
    // (which would break the CORS preflight).
    expect(fetchMock.mock.calls[0][0]).toBe('https://dav.example.com/books/');
  });

  it('returns an error on a failed PROPFIND', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => '',
      }),
    );
    const result = await listWebDAVFiles(creds);
    expect(result.objects).toHaveLength(0);
    expect(result.error).toContain('401');
  });
});

describe('deleteWebDAVFile', () => {
  it('succeeds on 204', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, status: 204, statusText: 'No Content' }),
    );
    expect((await deleteWebDAVFile(creds, 'book.epub')).success).toBe(true);
  });

  it('treats 404 as success (already gone)', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }),
    );
    expect((await deleteWebDAVFile(creds, 'book.epub')).success).toBe(true);
  });

  it('reports other failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' }),
    );
    const result = await deleteWebDAVFile(creds, 'book.epub');
    expect(result.success).toBe(false);
    expect(result.error).toContain('403');
  });
});

describe('getWebDAVPublicUrl', () => {
  it('builds from the endpoint URL and encodes the filename', () => {
    expect(getWebDAVPublicUrl(creds, 'a b.epub')).toBe(
      'https://dav.example.com/books/a%20b.epub',
    );
  });

  it('prefers publicUrlBase when set', () => {
    expect(
      getWebDAVPublicUrl(
        { ...creds, publicUrlBase: 'https://pub.example.com/share/' },
        'book.epub',
      ),
    ).toBe('https://pub.example.com/share/book.epub');
  });
});
