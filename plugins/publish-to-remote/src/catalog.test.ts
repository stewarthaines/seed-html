import { describe, it, expect } from 'vitest';
import {
  catalogFilenamesFor,
  catalogFilesOn,
  unusedCatalogFile,
  feedUrlFor,
  formatForKey,
  formatLabel,
  hasCatalog,
  hrefBasename,
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
    expect(
      catalogFilenamesFor({ ...s3, catalogFilename: 'shelf.xml' }),
    ).toEqual(['shelf.xml']);
  });

  it('reads the format off the extension', () => {
    expect(formatForKey('catalog.json')).toBe('opds2');
    expect(formatForKey('catalog.xml')).toBe('opds1');
    expect(formatLabel('opds2')).toBe('OPDS 2');
  });

  it('builds the feed URL per remote type', () => {
    expect(feedUrlFor(s3, 'catalog.json')).toBe(
      'https://s3.example.com/books/catalog.json',
    );
    expect(feedUrlFor(dropbox, 'catalog.json')).toBe(
      'https://www.dropbox.com/catalog.json',
    );
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

describe('several catalogs on one destination', () => {
  const at = '2026-01-01T00:00:00.000Z';
  const objects: S3Object[] = [
    { key: 'samples.xml', size: 1, lastModified: at },
    { key: 'a.epub', size: 1, lastModified: at },
    { key: 'catalog.json', size: 1, lastModified: at },
    { key: 'family.json', size: 1, lastModified: at },
    { key: 'a.thumb.png', size: 1, lastModified: at },
  ];

  it('lists every .xml and .json, the destination’s own first, the rest by name', () => {
    expect(catalogFilesOn(s3, objects)).toEqual([
      'catalog.json',
      'family.json',
      'samples.xml',
    ]);
  });

  it('puts the configured file first even when the default is also there', () => {
    expect(
      catalogFilesOn({ ...s3, catalogFilename: 'samples.xml' }, objects),
    ).toEqual(['samples.xml', 'catalog.json', 'family.json']);
  });

  it('falls back to the legacy catalog.xml and lists nothing on a bare destination', () => {
    const legacy = [
      ...objects.filter((o) => o.key !== 'catalog.json'),
      { key: 'catalog.xml', size: 1, lastModified: at },
    ];
    expect(catalogFilesOn(s3, legacy)).toEqual(['catalog.xml', 'family.json', 'samples.xml']);
    expect(catalogFilesOn(s3, [])).toEqual([]);
  });

  it('names a new catalog file that is not already there', () => {
    expect(unusedCatalogFile([])).toBe('catalog.json');
    expect(unusedCatalogFile(objects)).toBe('catalog-2.json');
    expect(unusedCatalogFile(objects, 'opds1')).toBe('catalog.xml');
  });
});

describe('matching a Dropbox feed without links', () => {
  const objects: S3Object[] = [
    { key: 'Walking the Coast.epub', size: 1, lastModified: '2026-01-01T00:00:00.000Z' },
    { key: 'other.epub', size: 1, lastModified: '2026-01-01T00:00:00.000Z' },
  ];

  it('reads the filename off a shared link', () => {
    expect(
      hrefBasename('https://www.dropbox.com/scl/fi/abc/Walking%20the%20Coast.epub?rlkey=x&dl=1'),
    ).toBe('Walking the Coast.epub');
    expect(hrefBasename('not a url')).toBe('');
  });

  it('matches entries by the filename the link ends in when the listing has no links', () => {
    const { keys, missingHrefs } = keysForEntries(dropbox, objects, [
      { href: 'https://www.dropbox.com/scl/fi/abc/Walking%20the%20Coast.epub?rlkey=x&dl=1' },
      { href: 'https://www.dropbox.com/scl/fi/def/gone.epub?dl=1' },
    ]);
    expect([...keys]).toEqual(['Walking the Coast.epub']);
    expect(missingHrefs).toEqual(['https://www.dropbox.com/scl/fi/def/gone.epub?dl=1']);
  });
});
