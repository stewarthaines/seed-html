import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDropboxPublicUrl,
  uploadToDropbox,
  listDropboxFiles,
  deleteDropboxFile,
} from './dropbox-upload.js';
import type { DropboxRemoteConfig } from './types.js';

vi.mock('./dropbox.js', () => ({
  refreshDropboxToken: vi.fn(),
}));

import { refreshDropboxToken } from './dropbox.js';

// getValidToken mutates config.tokenExpiry on refresh, so each test gets a fresh object.
// Base shape used to build per-test configs.
const BASE: Omit<DropboxRemoteConfig, 'tokenExpiry'> = {
  id: '1',
  name: 'My Dropbox',
  type: 'dropbox',
  appKey: 'app-key',
  folderId: '/books',
  folderPath: '/books',
  accessToken: 'valid-token',
  refreshToken: 'refresh-token',
};

let config: DropboxRemoteConfig;
let expiredConfig: DropboxRemoteConfig;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));
  // Fresh objects each test to prevent tokenExpiry mutation from bleeding across tests
  config = { ...BASE, tokenExpiry: 9_999_999_999_999 };
  expiredConfig = { ...BASE, tokenExpiry: 0 };
  vi.mocked(refreshDropboxToken).mockResolvedValue({
    accessToken: 'refreshed-token',
    tokenExpiry: 9_999_999_999_999,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('getDropboxPublicUrl', () => {
  it('returns empty string for empty fileId', () => {
    expect(getDropboxPublicUrl(config, '')).toBe('');
  });

  it('returns URL unchanged when dl=1 already present', () => {
    const url = 'https://www.dropbox.com/s/abc/book.epub?dl=1';
    expect(getDropboxPublicUrl(config, url)).toBe(url);
  });

  it('replaces dl=0 with dl=1', () => {
    expect(
      getDropboxPublicUrl(
        config,
        'https://www.dropbox.com/s/abc/book.epub?dl=0',
      ),
    ).toBe('https://www.dropbox.com/s/abc/book.epub?dl=1');
  });

  it('appends ?dl=1 when no query string', () => {
    expect(
      getDropboxPublicUrl(config, 'https://www.dropbox.com/s/abc/book.epub'),
    ).toBe('https://www.dropbox.com/s/abc/book.epub?dl=1');
  });

  it('appends &dl=1 when other query params are present', () => {
    expect(
      getDropboxPublicUrl(
        config,
        'https://www.dropbox.com/s/abc/book.epub?other=1',
      ),
    ).toBe('https://www.dropbox.com/s/abc/book.epub?other=1&dl=1');
  });
});

describe('uploadToDropbox', () => {
  it('uploads successfully and returns shared link URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            links: [{ url: 'https://www.dropbox.com/s/abc/book.epub?dl=0' }],
          }),
        }),
    );

    const result = await uploadToDropbox(
      config,
      'book.epub',
      new Blob(['data']),
    );
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://www.dropbox.com/s/abc/book.epub');
  });

  it('refreshes expired token before uploading', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ links: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            url: 'https://www.dropbox.com/s/abc/book.epub',
          }),
        }),
    );

    await uploadToDropbox(expiredConfig, 'book.epub', new Blob(['data']));
    expect(vi.mocked(refreshDropboxToken)).toHaveBeenCalledWith(
      'app-key',
      'refresh-token',
    );
  });

  it('retries after 401 by refreshing token', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            links: [{ url: 'https://www.dropbox.com/s/abc/book.epub' }],
          }),
        }),
    );

    const result = await uploadToDropbox(
      config,
      'book.epub',
      new Blob(['data']),
    );
    expect(vi.mocked(refreshDropboxToken)).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('returns error on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: async () => '',
      }),
    );

    const result = await uploadToDropbox(
      config,
      'book.epub',
      new Blob(['data']),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });
});

describe('listDropboxFiles', () => {
  it('returns all files with shared link fileIds', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            entries: [
              {
                '.tag': 'file',
                name: 'book1.epub',
                size: 1024,
                server_modified: '2024-01-01T00:00:00.000Z',
                path_display: '/books/book1.epub',
              },
              {
                '.tag': 'file',
                name: 'cover.jpg',
                size: 512,
                server_modified: '2024-01-01T00:00:00.000Z',
                path_display: '/books/cover.jpg',
              },
            ],
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            links: [{ url: 'https://www.dropbox.com/s/abc/book1.epub?dl=0' }],
          }),
        }),
    );

    const result = await listDropboxFiles(config);
    expect(result.objects).toHaveLength(2);
    expect(result.objects.map((o) => o.key)).toEqual([
      'book1.epub',
      'cover.jpg',
    ]);
    expect(result.objects[0].fileId).toBe(
      'https://www.dropbox.com/s/abc/book1.epub',
    );
  });

  it('includes non-epub files (e.g. the OPDS catalog)', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            entries: [
              {
                '.tag': 'file',
                name: 'catalog.xml',
                size: 512,
                server_modified: '2024-01-01T00:00:00.000Z',
                path_display: '/books/catalog.xml',
              },
            ],
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            links: [{ url: 'https://www.dropbox.com/s/abc/catalog.xml?dl=0' }],
          }),
        }),
    );

    const result = await listDropboxFiles(config);
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].key).toBe('catalog.xml');
  });

  it('handles empty entries array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ entries: [] }),
      }),
    );

    const result = await listDropboxFiles(config);
    expect(result.objects).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('returns error on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => '',
      }),
    );

    const result = await listDropboxFiles(config);
    expect(result.objects).toHaveLength(0);
    expect(result.error).toContain('400');
  });

  it('retries after 401 by refreshing token', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ entries: [] }),
        }),
    );

    const result = await listDropboxFiles(config);
    expect(vi.mocked(refreshDropboxToken)).toHaveBeenCalled();
    expect(result.objects).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });
});

describe('deleteDropboxFile', () => {
  it('returns success on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, ok: true }),
    );

    const result = await deleteDropboxFile(config, 'book.epub');
    expect(result.success).toBe(true);
  });

  it('returns success on 404 (already gone)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 404, ok: false }),
    );

    const result = await deleteDropboxFile(config, 'book.epub');
    expect(result.success).toBe(true);
  });

  it('returns error on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 403,
        ok: false,
        statusText: 'Forbidden',
        text: async () => '',
      }),
    );

    const result = await deleteDropboxFile(config, 'book.epub');
    expect(result.success).toBe(false);
    expect(result.error).toContain('403');
  });

  it('retries after 401 by refreshing token', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({ status: 200, ok: true }),
    );

    const result = await deleteDropboxFile(config, 'book.epub');
    expect(vi.mocked(refreshDropboxToken)).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('refreshes expired token before deleting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, ok: true }),
    );

    await deleteDropboxFile(expiredConfig, 'book.epub');
    expect(vi.mocked(refreshDropboxToken)).toHaveBeenCalledWith(
      'app-key',
      'refresh-token',
    );
  });
});
