import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getGoogleDrivePublicUrl,
  getGoogleDriveThumbnailUrl,
  listGoogleDriveFiles,
  uploadToGoogleDrive,
  deleteGoogleDriveFile,
} from './google-drive-upload.js';
import type { GoogleDriveRemoteConfig } from './types.js';

const config: GoogleDriveRemoteConfig = {
  id: '1',
  name: 'My Drive',
  type: 'google-drive',
  clientId: 'client-id',
  apiKey: 'api-key',
  folderId: 'folder-123',
  folderName: 'My Books',
  accessToken: 'valid-token',
};

const noTokenConfig: GoogleDriveRemoteConfig = {
  ...config,
  accessToken: undefined,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getGoogleDrivePublicUrl', () => {
  it('constructs download URL from fileId', () => {
    expect(getGoogleDrivePublicUrl(config, 'file-abc')).toBe(
      'https://drive.usercontent.google.com/download?id=file-abc&export=download',
    );
  });
});

describe('getGoogleDriveThumbnailUrl', () => {
  it('constructs a viewable image-thumbnail URL from fileId', () => {
    expect(getGoogleDriveThumbnailUrl('file-abc')).toBe(
      'https://drive.google.com/thumbnail?id=file-abc&sz=w400',
    );
    expect(getGoogleDriveThumbnailUrl('file-abc', 200)).toBe(
      'https://drive.google.com/thumbnail?id=file-abc&sz=w200',
    );
  });
});

describe('listGoogleDriveFiles', () => {
  it('returns parsed file list on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          files: [
            {
              id: 'file-1',
              name: 'book1.epub',
              size: '1024',
              modifiedTime: '2024-01-01T00:00:00.000Z',
            },
            {
              id: 'file-2',
              name: 'book2.epub',
              size: '2048',
              modifiedTime: '2024-02-01T00:00:00.000Z',
            },
          ],
        }),
      }),
    );

    const result = await listGoogleDriveFiles(config);
    expect(result.objects).toHaveLength(2);
    expect(result.objects[0]).toEqual({
      key: 'book1.epub',
      size: 1024,
      lastModified: '2024-01-01T00:00:00.000Z',
      fileId: 'file-1',
    });
  });

  it('handles missing files array gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );

    const result = await listGoogleDriveFiles(config);
    expect(result.objects).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('returns GOOGLE_AUTH_REQUIRED when no token', async () => {
    const result = await listGoogleDriveFiles(noTokenConfig);
    expect(result.objects).toHaveLength(0);
    expect(result.error).toBe('GOOGLE_AUTH_REQUIRED');
  });

  it('returns GOOGLE_AUTH_REQUIRED on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );

    const result = await listGoogleDriveFiles(config);
    expect(result.objects).toHaveLength(0);
    expect(result.error).toBe('GOOGLE_AUTH_REQUIRED');
  });

  it('returns error message on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'quota exceeded',
      }),
    );

    const result = await listGoogleDriveFiles(config);
    expect(result.objects).toHaveLength(0);
    expect(result.error).toContain('500');
  });
});

describe('uploadToGoogleDrive', () => {
  it('creates a new file, shares it, and returns its download URL', async () => {
    // Sequence: list (no existing) → POST create → permissions (anyone/reader).
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ files: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'new-file-id' }) })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await uploadToGoogleDrive(
      config,
      'book.epub',
      new Blob(['data']),
    );
    expect(result.success).toBe(true);
    expect(result.fileId).toBe('new-file-id');
    expect(result.url).toBe(
      'https://drive.usercontent.google.com/download?id=new-file-id&export=download',
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [uploadUrl, uploadInit] = fetchMock.mock.calls[1];
    expect(uploadUrl).toBe(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    );
    expect(uploadInit.method).toBe('POST');
    const [permUrl, permInit] = fetchMock.mock.calls[2];
    expect(permUrl).toBe(
      'https://www.googleapis.com/drive/v3/files/new-file-id/permissions',
    );
    expect(JSON.parse(permInit.body)).toEqual({ role: 'reader', type: 'anyone' });
  });

  it('updates an existing file in place (PATCH, no duplicate, no re-share)', async () => {
    // Sequence: list (finds book.epub) → PATCH update. No permissions call.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ files: [{ id: 'existing-id', name: 'book.epub' }] }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'existing-id' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await uploadToGoogleDrive(
      config,
      'book.epub',
      new Blob(['data']),
    );
    expect(result.success).toBe(true);
    expect(result.fileId).toBe('existing-id');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [updateUrl, updateInit] = fetchMock.mock.calls[1];
    expect(updateUrl).toBe(
      'https://www.googleapis.com/upload/drive/v3/files/existing-id?uploadType=multipart',
    );
    expect(updateInit.method).toBe('PATCH');
  });

  it('fails when a new file cannot be shared publicly', async () => {
    // list (none) → create ok → permissions 403.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ files: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'new-file-id' }) })
      .mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden', text: async () => 'denied' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await uploadToGoogleDrive(
      config,
      'book.epub',
      new Blob(['data']),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('share publicly');
  });

  it('returns GOOGLE_AUTH_REQUIRED when no token', async () => {
    const result = await uploadToGoogleDrive(
      noTokenConfig,
      'book.epub',
      new Blob(['data']),
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('GOOGLE_AUTH_REQUIRED');
  });

  it('returns GOOGLE_AUTH_REQUIRED on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );

    const result = await uploadToGoogleDrive(
      config,
      'book.epub',
      new Blob(['data']),
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('GOOGLE_AUTH_REQUIRED');
  });

  it('returns error on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'storage quota exceeded',
      }),
    );

    const result = await uploadToGoogleDrive(
      config,
      'book.epub',
      new Blob(['data']),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });
});

describe('deleteGoogleDriveFile', () => {
  it('returns success on 204 when fileId provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 204, ok: true }),
    );

    const result = await deleteGoogleDriveFile(config, 'book.epub', 'file-1');
    expect(result.success).toBe(true);
  });

  it('returns success on 404 (already gone)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 404, ok: false }),
    );

    const result = await deleteGoogleDriveFile(config, 'book.epub', 'file-1');
    expect(result.success).toBe(true);
  });

  it('resolves fileId via list when not provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          files: [
            {
              id: 'file-1',
              name: 'book.epub',
              size: '1024',
              modifiedTime: '2024-01-01T00:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ status: 204, ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = await deleteGoogleDriveFile(config, 'book.epub');
    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns error when file not found in list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ files: [] }),
      }),
    );

    const result = await deleteGoogleDriveFile(config, 'missing.epub');
    expect(result.success).toBe(false);
    expect(result.error).toBe('File not found');
  });

  it('returns GOOGLE_AUTH_REQUIRED when no token', async () => {
    const result = await deleteGoogleDriveFile(
      noTokenConfig,
      'book.epub',
      'file-1',
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('GOOGLE_AUTH_REQUIRED');
  });

  it('returns GOOGLE_AUTH_REQUIRED on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 401, ok: false }),
    );

    const result = await deleteGoogleDriveFile(config, 'book.epub', 'file-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('GOOGLE_AUTH_REQUIRED');
  });
});
