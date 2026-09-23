import { describe, it, expect } from 'vitest';
import {
  catalogFilenamesFor,
  feedUrlFor,
  formatForKey,
  formatLabel,
  hasCatalog,
  keysForEntries,
} from './catalog.js';
import type {
  DropboxRemoteConfig,
  GoogleDriveRemoteConfig,
  S3Object,
  S3RemoteConfig,
} from './types.js';

const s3: S3RemoteConfig = {
  id: 's3',
  name: 'Shelf',
  type: 's3-compatible',
  endpoint: 'https://s3.example.com',
  bucket: 'books',
  accessKeyId: 'k',
  secretAccessKey: 's',
};

const drive: GoogleDriveRemoteConfig = {
  id: 'gd',
  name: 'Drive',
  type: 'google-drive',
  clientId: 'c',
  apiKey: 'a',
  folderId: 'f',
  folderName: 'Books',
};

const dropbox: DropboxRemoteConfig = {
  id: 'db',
  name: 'Dropbox',
  type: 'dropbox',
  appKey: 'app',
  folderId: '/books',
  folderPath: '/books',
  accessToken: 't',
  refreshToken: 'r',
  tokenExpiry: 9_999_999_999_999,
};

describe('hasCatalog', () => {
  it('is true for S3, Dropbox and WebDAV only', () => {
    expect(hasCatalog(s3)).toBe(true);
    expect(hasCatalog(dropbox)).toBe(true);
    expect(hasCatalog(drive)).toBe(false);
  });
});

describe('catalog filenames', () => {
  it('defaults to catalog.json with catalog.xml as the legacy fallback', () => {
    expect(catalogFilenamesFor(s3)).toEqual(['catalog.json', 'catalog.xml']);
  });

  it('uses the configured name alone', () => {
    expect(catalogFilenamesFor({ ...s3, catalogFilename: 'shelf.xml' })).toEqual(['shelf.xml']);
  });

  it('reads the format off the extension', () => {
    expect(formatForKey('catalog.json')).toBe('opds2');
    expect(formatForKey('catalog.xml')).toBe('opds1');
    expect(formatLabel('opds2')).toBe('OPDS 2');
  });

  it('builds the feed URL per remote type', () => {
    expect(feedUrlFor(s3, 'catalog.json')).toBe('https://s3.example.com/books/catalog.json');
    expect(feedUrlFor(dropbox, 'catalog.json')).toBe('https://www.dropbox.com/catalog.json');
  });
});

describe('keysForEntries', () => {
  const objects: S3Object[] = [
    { key: 'a.epub', size: 1, lastModified: '2026-01-01T00:00:00.000Z' },
    { key: 'b.epub', size: 1, lastModified: '2026-01-01T00:00:00.000Z' },
  ];

  it('maps entries back to object keys and names the hrefs that match nothing', () => {
    const { keys, missingHrefs } = keysForEntries(s3, objects, [
      { href: 'https://s3.example.com/books/a.epub' },
      { href: 'https://s3.example.com/books/removed.epub' },
    ]);
    expect([...keys]).toEqual(['a.epub']);
    expect(missingHrefs).toEqual(['https://s3.example.com/books/removed.epub']);
  });
});
