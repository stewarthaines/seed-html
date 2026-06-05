import { describe, it, expect, vi } from 'vitest';
import {
  uploadFile,
  listFiles,
  deleteFile,
  getPublicUrl,
  uploadTextFile,
} from './remote-ops.js';
import type {
  S3RemoteConfig,
  GoogleDriveRemoteConfig,
  DropboxRemoteConfig,
  WebDAVRemoteConfig,
} from './types.js';

vi.mock('./s3-upload.js', () => ({
  uploadToS3: vi.fn().mockResolvedValue({ success: true }),
  listObjects: vi.fn().mockResolvedValue({ objects: [] }),
  deleteObject: vi.fn().mockResolvedValue({ success: true }),
  getPublicUrl: vi.fn().mockReturnValue('https://s3.example.com/bucket/key'),
  uploadText: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('./google-drive-upload.js', () => ({
  uploadToGoogleDrive: vi.fn().mockResolvedValue({ success: true }),
  listGoogleDriveFiles: vi.fn().mockResolvedValue({ objects: [] }),
  deleteGoogleDriveFile: vi.fn().mockResolvedValue({ success: true }),
  getGoogleDrivePublicUrl: vi
    .fn()
    .mockReturnValue('https://drive.google.com/uc?id=x&export=download'),
  uploadTextToGoogleDrive: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('./dropbox-upload.js', () => ({
  uploadToDropbox: vi.fn().mockResolvedValue({ success: true }),
  listDropboxFiles: vi.fn().mockResolvedValue({ objects: [] }),
  deleteDropboxFile: vi.fn().mockResolvedValue({ success: true }),
  getDropboxPublicUrl: vi
    .fn()
    .mockReturnValue('https://www.dropbox.com/s/abc/book.epub?dl=1'),
  uploadTextToDropbox: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('./webdav-upload.js', () => ({
  uploadToWebDAV: vi.fn().mockResolvedValue({ success: true }),
  listWebDAVFiles: vi.fn().mockResolvedValue({ objects: [] }),
  deleteWebDAVFile: vi.fn().mockResolvedValue({ success: true }),
  getWebDAVPublicUrl: vi
    .fn()
    .mockReturnValue('https://dav.example.com/books/book.epub'),
  uploadTextToWebDAV: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  uploadToS3,
  listObjects,
  deleteObject,
  getPublicUrl as getS3PublicUrl,
  uploadText,
} from './s3-upload.js';
import {
  uploadToGoogleDrive,
  listGoogleDriveFiles,
  deleteGoogleDriveFile,
  getGoogleDrivePublicUrl,
  uploadTextToGoogleDrive,
} from './google-drive-upload.js';
import {
  uploadToDropbox,
  listDropboxFiles,
  deleteDropboxFile,
  getDropboxPublicUrl,
  uploadTextToDropbox,
} from './dropbox-upload.js';
import {
  uploadToWebDAV,
  listWebDAVFiles,
  deleteWebDAVFile,
  getWebDAVPublicUrl,
  uploadTextToWebDAV,
} from './webdav-upload.js';

const s3Config: S3RemoteConfig = {
  id: '1',
  name: 'S3',
  type: 's3-compatible',
  endpoint: 'https://s3.example.com',
  bucket: 'bucket',
  accessKeyId: 'KEY',
  secretAccessKey: 'SECRET',
};

const googleConfig: GoogleDriveRemoteConfig = {
  id: '2',
  name: 'Drive',
  type: 'google-drive',
  clientId: 'client',
  apiKey: 'key',
  folderId: 'folder',
  folderName: 'Books',
};

const dropboxConfig: DropboxRemoteConfig = {
  id: '3',
  name: 'Dropbox',
  type: 'dropbox',
  appKey: 'app',
  folderId: '/books',
  folderPath: '/books',
  accessToken: 'token',
  refreshToken: 'refresh',
  tokenExpiry: 9_999_999_999_999,
};

const webdavConfig: WebDAVRemoteConfig = {
  id: '4',
  name: 'WebDAV',
  type: 'webdav',
  url: 'https://dav.example.com/books',
  username: 'user',
  password: 'pass',
};

const blob = new Blob(['data']);

describe('uploadFile', () => {
  it('routes to S3 for s3-compatible', async () => {
    await uploadFile(s3Config, 'book.epub', blob, 'application/epub+zip');
    expect(vi.mocked(uploadToS3)).toHaveBeenCalledWith(
      s3Config,
      'book.epub',
      blob,
      'application/epub+zip',
      undefined,
    );
  });

  it('routes to Google Drive for google-drive', async () => {
    await uploadFile(googleConfig, 'book.epub', blob);
    expect(vi.mocked(uploadToGoogleDrive)).toHaveBeenCalledWith(
      googleConfig,
      'book.epub',
      blob,
      undefined,
      undefined,
    );
  });

  it('routes to Dropbox for dropbox', async () => {
    await uploadFile(dropboxConfig, 'book.epub', blob);
    expect(vi.mocked(uploadToDropbox)).toHaveBeenCalledWith(
      dropboxConfig,
      'book.epub',
      blob,
      undefined,
      undefined,
    );
  });

  it('routes to WebDAV for webdav', async () => {
    await uploadFile(webdavConfig, 'book.epub', blob);
    expect(vi.mocked(uploadToWebDAV)).toHaveBeenCalledWith(
      webdavConfig,
      'book.epub',
      blob,
      undefined,
      undefined,
    );
  });

  it('returns error for unknown remote type', async () => {
    const unknown = { type: 'unknown' } as unknown as S3RemoteConfig;
    const result = await uploadFile(unknown, 'book.epub', blob);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown remote type');
  });
});

describe('listFiles', () => {
  it('routes to S3 for s3-compatible', async () => {
    await listFiles(s3Config);
    expect(vi.mocked(listObjects)).toHaveBeenCalledWith(s3Config);
  });

  it('routes to Google Drive for google-drive', async () => {
    await listFiles(googleConfig);
    expect(vi.mocked(listGoogleDriveFiles)).toHaveBeenCalledWith(googleConfig);
  });

  it('routes to Dropbox for dropbox', async () => {
    await listFiles(dropboxConfig);
    expect(vi.mocked(listDropboxFiles)).toHaveBeenCalledWith(dropboxConfig);
  });

  it('routes to WebDAV for webdav', async () => {
    await listFiles(webdavConfig);
    expect(vi.mocked(listWebDAVFiles)).toHaveBeenCalledWith(webdavConfig);
  });

  it('returns error for unknown remote type', async () => {
    const unknown = { type: 'unknown' } as unknown as S3RemoteConfig;
    const result = await listFiles(unknown);
    expect(result.objects).toHaveLength(0);
    expect(result.error).toContain('Unknown remote type');
  });
});

describe('deleteFile', () => {
  it('routes to S3 for s3-compatible', async () => {
    await deleteFile(s3Config, 'book.epub');
    expect(vi.mocked(deleteObject)).toHaveBeenCalledWith(s3Config, 'book.epub');
  });

  it('routes to Google Drive for google-drive', async () => {
    await deleteFile(googleConfig, 'book.epub');
    expect(vi.mocked(deleteGoogleDriveFile)).toHaveBeenCalledWith(
      googleConfig,
      'book.epub',
    );
  });

  it('routes to Dropbox for dropbox', async () => {
    await deleteFile(dropboxConfig, 'book.epub');
    expect(vi.mocked(deleteDropboxFile)).toHaveBeenCalledWith(
      dropboxConfig,
      'book.epub',
    );
  });

  it('routes to WebDAV for webdav', async () => {
    await deleteFile(webdavConfig, 'book.epub');
    expect(vi.mocked(deleteWebDAVFile)).toHaveBeenCalledWith(
      webdavConfig,
      'book.epub',
    );
  });

  it('returns error for unknown remote type', async () => {
    const unknown = { type: 'unknown' } as unknown as S3RemoteConfig;
    const result = await deleteFile(unknown, 'book.epub');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown remote type');
  });
});

describe('getPublicUrl', () => {
  it('routes to S3 for s3-compatible', () => {
    getPublicUrl(s3Config, 'book.epub');
    expect(vi.mocked(getS3PublicUrl)).toHaveBeenCalledWith(
      s3Config,
      'book.epub',
    );
  });

  it('routes to Google Drive for google-drive when fileId provided', () => {
    getPublicUrl(googleConfig, 'book.epub', 'file-1');
    expect(vi.mocked(getGoogleDrivePublicUrl)).toHaveBeenCalledWith(
      googleConfig,
      'file-1',
    );
  });

  it('routes to Dropbox for dropbox when fileId provided', () => {
    getPublicUrl(dropboxConfig, 'book.epub', 'https://www.dropbox.com/s/abc');
    expect(vi.mocked(getDropboxPublicUrl)).toHaveBeenCalledWith(
      dropboxConfig,
      'https://www.dropbox.com/s/abc',
    );
  });

  it('routes to WebDAV for webdav (no fileId needed)', () => {
    getPublicUrl(webdavConfig, 'book.epub');
    expect(vi.mocked(getWebDAVPublicUrl)).toHaveBeenCalledWith(
      webdavConfig,
      'book.epub',
    );
  });

  it('returns empty string for google-drive without fileId', () => {
    const url = getPublicUrl(googleConfig, 'book.epub');
    expect(url).toBe('');
  });

  it('returns empty string for dropbox without fileId', () => {
    const url = getPublicUrl(dropboxConfig, 'book.epub');
    expect(url).toBe('');
  });
});

describe('uploadTextFile', () => {
  it('routes to S3 for s3-compatible', async () => {
    await uploadTextFile(s3Config, 'catalog.xml', '<xml/>');
    expect(vi.mocked(uploadText)).toHaveBeenCalledWith(
      s3Config,
      'catalog.xml',
      '<xml/>',
      undefined,
    );
  });

  it('routes to Google Drive for google-drive', async () => {
    await uploadTextFile(googleConfig, 'catalog.xml', '<xml/>');
    expect(vi.mocked(uploadTextToGoogleDrive)).toHaveBeenCalledWith(
      googleConfig,
      'catalog.xml',
      '<xml/>',
      undefined,
    );
  });

  it('routes to Dropbox for dropbox', async () => {
    await uploadTextFile(dropboxConfig, 'catalog.xml', '<xml/>');
    expect(vi.mocked(uploadTextToDropbox)).toHaveBeenCalledWith(
      dropboxConfig,
      'catalog.xml',
      '<xml/>',
      undefined,
    );
  });

  it('routes to WebDAV for webdav', async () => {
    await uploadTextFile(webdavConfig, 'catalog.xml', '<xml/>');
    expect(vi.mocked(uploadTextToWebDAV)).toHaveBeenCalledWith(
      webdavConfig,
      'catalog.xml',
      '<xml/>',
      undefined,
    );
  });
});
