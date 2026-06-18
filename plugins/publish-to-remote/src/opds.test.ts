import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateOpdsFeed,
  parseOpdsFeed,
  DEFAULT_CATALOG_AUTHOR_NAME,
  DEFAULT_CATALOG_AUTHOR_URI,
} from './opds.js';
import type {
  S3RemoteConfig,
  GoogleDriveRemoteConfig,
  DropboxRemoteConfig,
  S3Object,
} from './types.js';

const FEED_URL = 'https://example.com/catalog.xml';

const s3Config: S3RemoteConfig = {
  id: '1',
  name: 'My S3',
  type: 's3-compatible',
  endpoint: 'https://s3.example.com',
  bucket: 'my-bucket',
  accessKeyId: 'KEY',
  secretAccessKey: 'SECRET',
};

const googleConfig: GoogleDriveRemoteConfig = {
  id: '2',
  name: 'My Drive',
  type: 'google-drive',
  clientId: 'client-id',
  apiKey: 'api-key',
  folderId: 'folder-123',
  folderName: 'My Books',
};

const dropboxConfig: DropboxRemoteConfig = {
  id: '3',
  name: 'My Dropbox',
  type: 'dropbox',
  appKey: 'app-key',
  folderId: '/books',
  folderPath: '/books',
  accessToken: 'token',
  refreshToken: 'refresh',
  tokenExpiry: Date.now() + 3600000,
};

const twoEpubs: S3Object[] = [
  {
    key: 'book1.epub',
    size: 1024,
    lastModified: '2024-01-01T00:00:00.000Z',
    fileId: 'file-1',
  },
  {
    key: 'book2.epub',
    size: 2048,
    lastModified: '2024-02-01T00:00:00.000Z',
    fileId: 'file-2',
  },
];

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function text(doc: Document, tag: string, index = 0): string {
  return doc.getElementsByTagName(tag)[index]?.textContent ?? '';
}

describe('generateOpdsFeed', () => {
  const FIXED_TIME = '2024-06-01T12:00:00.000Z';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_TIME));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('XML structure', () => {
    it('starts with an XML declaration', () => {
      const xml = generateOpdsFeed(s3Config, [], FEED_URL);
      expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    });

    it('includes the Atom namespace on the feed element', () => {
      const xml = generateOpdsFeed(s3Config, [], FEED_URL);
      expect(xml).toContain('http://www.w3.org/2005/Atom');
    });

    it('sets feed id to the feed URL', () => {
      const doc = parse(generateOpdsFeed(s3Config, [], FEED_URL));
      expect(text(doc, 'id')).toBe(`urn:uri:${FEED_URL}`);
    });

    it('sets self link with correct type', () => {
      const doc = parse(generateOpdsFeed(s3Config, [], FEED_URL));
      const link = doc.querySelector('feed > link');
      expect(link?.getAttribute('rel')).toBe('self');
      expect(link?.getAttribute('href')).toBe(FEED_URL);
      expect(link?.getAttribute('type')).toBe(
        'application/atom+xml;profile=opds-catalog;kind=acquisition',
      );
    });

    it('sets feed updated to the current time', () => {
      const doc = parse(generateOpdsFeed(s3Config, [], FEED_URL));
      expect(text(doc, 'updated')).toBe(FIXED_TIME);
    });
  });

  describe('feed title', () => {
    it('uses bucket name for S3', () => {
      const doc = parse(generateOpdsFeed(s3Config, [], FEED_URL));
      expect(text(doc, 'title')).toBe('my-bucket');
    });

    it('uses folderName for Google Drive', () => {
      const doc = parse(generateOpdsFeed(googleConfig, [], FEED_URL));
      expect(text(doc, 'title')).toBe('My Books');
    });

    it('uses folderPath for Dropbox', () => {
      const doc = parse(generateOpdsFeed(dropboxConfig, [], FEED_URL));
      expect(text(doc, 'title')).toBe('/books');
    });

    it('uses an explicit per-catalog title over the derived default', () => {
      const doc = parse(
        generateOpdsFeed(s3Config, [], FEED_URL, new Map(), undefined, {
          title: 'Sci-Fi Shelf',
        }),
      );
      expect(text(doc, 'title')).toBe('Sci-Fi Shelf');
    });

    it('falls back to the derived title for a blank explicit title', () => {
      const doc = parse(
        generateOpdsFeed(s3Config, [], FEED_URL, new Map(), undefined, {
          title: '   ',
        }),
      );
      expect(text(doc, 'title')).toBe('my-bucket');
    });
  });

  describe('feed author', () => {
    function feedAuthor(xml: string) {
      const feed = parse(xml).documentElement;
      const author = Array.from(feed.children).find(
        (c) => c.localName === 'author',
      );
      const childText = (name: string) =>
        Array.from(author?.children ?? []).find((c) => c.localName === name)
          ?.textContent ?? '';
      return { name: childText('name'), uri: childText('uri') };
    }

    it('defaults to the known publisher when no catalog identity is given', () => {
      const { name, uri } = feedAuthor(
        generateOpdsFeed(s3Config, [], FEED_URL),
      );
      expect(name).toBe(DEFAULT_CATALOG_AUTHOR_NAME);
      expect(uri).toBe(DEFAULT_CATALOG_AUTHOR_URI);
    });

    it('uses the provided per-catalog name and uri', () => {
      const xml = generateOpdsFeed(
        s3Config,
        [],
        FEED_URL,
        new Map(),
        undefined,
        {
          authorName: 'Sci-Fi Shelf',
          authorUri: 'https://example.org/scifi',
        },
      );
      const { name, uri } = feedAuthor(xml);
      expect(name).toBe('Sci-Fi Shelf');
      expect(uri).toBe('https://example.org/scifi');
    });

    it('falls back to defaults for blank/whitespace identity fields', () => {
      const xml = generateOpdsFeed(
        s3Config,
        [],
        FEED_URL,
        new Map(),
        undefined,
        {
          authorName: '   ',
          authorUri: '',
        },
      );
      const { name, uri } = feedAuthor(xml);
      expect(name).toBe(DEFAULT_CATALOG_AUTHOR_NAME);
      expect(uri).toBe(DEFAULT_CATALOG_AUTHOR_URI);
    });
  });

  describe('parseOpdsFeed (round-trip)', () => {
    it('reads the feed title and author back from a generated feed', () => {
      const xml = generateOpdsFeed(
        s3Config,
        [],
        FEED_URL,
        new Map(),
        undefined,
        {
          title: 'Sci-Fi Shelf',
          authorName: 'My Library',
          authorUri: 'https://lib.example',
        },
      );
      const parsed = parseOpdsFeed(xml);
      expect(parsed.title).toBe('Sci-Fi Shelf');
      expect(parsed.authorName).toBe('My Library');
      expect(parsed.authorUri).toBe('https://lib.example');
    });

    it('reads the feed-level author back, not entry authors', () => {
      const meta = new Map([
        ['book1.epub', { title: 'Book One', authors: ['Ada Lovelace'] }],
      ]);
      const xml = generateOpdsFeed(
        s3Config,
        twoEpubs,
        FEED_URL,
        meta,
        undefined,
        {
          authorName: 'My Library',
          authorUri: 'https://lib.example',
        },
      );
      const parsed = parseOpdsFeed(xml);
      expect(parsed.authorName).toBe('My Library');
      expect(parsed.authorUri).toBe('https://lib.example');
    });

    it('extracts the epub acquisition hrefs', () => {
      const xml = generateOpdsFeed(s3Config, twoEpubs, FEED_URL);
      const parsed = parseOpdsFeed(xml);
      expect(parsed.epubHrefs).toEqual(
        new Set([
          'https://s3.example.com/my-bucket/book1.epub',
          'https://s3.example.com/my-bucket/book2.epub',
        ]),
      );
    });

    it('only includes selected epubs, matching the generated selection', () => {
      const selected = new Set(['book2.epub']);
      const xml = generateOpdsFeed(
        s3Config,
        twoEpubs,
        FEED_URL,
        new Map(),
        selected,
      );
      const parsed = parseOpdsFeed(xml);
      expect(parsed.epubHrefs).toEqual(
        new Set(['https://s3.example.com/my-bucket/book2.epub']),
      );
    });

    it('leaves author undefined when the feed has none', () => {
      const parsed = parseOpdsFeed(
        '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>x</title></feed>',
      );
      expect(parsed.authorName).toBeUndefined();
      expect(parsed.authorUri).toBeUndefined();
      expect(parsed.epubHrefs.size).toBe(0);
    });
  });

  describe('entry filtering', () => {
    it('produces one entry per epub', () => {
      const doc = parse(generateOpdsFeed(s3Config, twoEpubs, FEED_URL));
      expect(doc.getElementsByTagName('entry').length).toBe(2);
    });

    it('filters out non-epub files', () => {
      const mixed: S3Object[] = [
        ...twoEpubs,
        {
          key: 'cover.jpg',
          size: 512,
          lastModified: '2024-01-01T00:00:00.000Z',
        },
        {
          key: 'catalog.xml',
          size: 256,
          lastModified: '2024-01-01T00:00:00.000Z',
        },
      ];
      const doc = parse(generateOpdsFeed(s3Config, mixed, FEED_URL));
      expect(doc.getElementsByTagName('entry').length).toBe(2);
    });

    it('produces no entries for an empty object list', () => {
      const doc = parse(generateOpdsFeed(s3Config, [], FEED_URL));
      expect(doc.getElementsByTagName('entry').length).toBe(0);
    });
  });

  describe('entry content', () => {
    it('strips .epub extension from entry title', () => {
      const doc = parse(generateOpdsFeed(s3Config, twoEpubs, FEED_URL));
      const entries = doc.getElementsByTagName('entry');
      expect(entries[0].getElementsByTagName('title')[0].textContent).toBe(
        'book1',
      );
      expect(entries[1].getElementsByTagName('title')[0].textContent).toBe(
        'book2',
      );
    });

    it('sets entry updated to the object lastModified', () => {
      const doc = parse(generateOpdsFeed(s3Config, twoEpubs, FEED_URL));
      const entry = doc.getElementsByTagName('entry')[0];
      expect(entry.getElementsByTagName('updated')[0].textContent).toBe(
        '2024-01-01T00:00:00.000Z',
      );
    });

    it('sets acquisition link type to application/epub+zip', () => {
      const doc = parse(generateOpdsFeed(s3Config, twoEpubs, FEED_URL));
      const entry = doc.getElementsByTagName('entry')[0];
      const link = entry.getElementsByTagName('link')[0];
      expect(link.getAttribute('rel')).toBe('http://opds-spec.org/acquisition');
      expect(link.getAttribute('type')).toBe('application/epub+zip');
    });
  });

  describe('entry URLs', () => {
    it('S3: constructs URL from endpoint and bucket', () => {
      const doc = parse(generateOpdsFeed(s3Config, twoEpubs, FEED_URL));
      const link = doc
        .getElementsByTagName('entry')[0]
        .getElementsByTagName('link')[0];
      expect(link.getAttribute('href')).toBe(
        'https://s3.example.com/my-bucket/book1.epub',
      );
    });

    it('S3: uses publicUrlBase when set', () => {
      const withBase: S3RemoteConfig = {
        ...s3Config,
        publicUrlBase: 'https://cdn.example.com',
      };
      const doc = parse(generateOpdsFeed(withBase, twoEpubs, FEED_URL));
      const link = doc
        .getElementsByTagName('entry')[0]
        .getElementsByTagName('link')[0];
      expect(link.getAttribute('href')).toBe(
        'https://cdn.example.com/book1.epub',
      );
    });

    it('Google Drive: constructs URL from fileId', () => {
      const doc = parse(generateOpdsFeed(googleConfig, twoEpubs, FEED_URL));
      const link = doc
        .getElementsByTagName('entry')[0]
        .getElementsByTagName('link')[0];
      expect(link.getAttribute('href')).toBe(
        'https://drive.google.com/uc?id=file-1&export=download',
      );
    });

    it('Google Drive: uses empty string when fileId is missing', () => {
      const noId: S3Object[] = [
        {
          key: 'book1.epub',
          size: 1024,
          lastModified: '2024-01-01T00:00:00.000Z',
        },
      ];
      const doc = parse(generateOpdsFeed(googleConfig, noId, FEED_URL));
      const link = doc
        .getElementsByTagName('entry')[0]
        .getElementsByTagName('link')[0];
      expect(link.getAttribute('href')).toBe('');
    });

    it('Dropbox: uses fileId (shared link) as URL', () => {
      const withLink: S3Object[] = [
        {
          key: 'book1.epub',
          size: 1024,
          lastModified: '2024-01-01T00:00:00.000Z',
          fileId: 'https://www.dropbox.com/s/abc/book1.epub?dl=1',
        },
      ];
      const doc = parse(generateOpdsFeed(dropboxConfig, withLink, FEED_URL));
      const link = doc
        .getElementsByTagName('entry')[0]
        .getElementsByTagName('link')[0];
      expect(link.getAttribute('href')).toBe(
        'https://www.dropbox.com/s/abc/book1.epub?dl=1',
      );
    });
  });
});
