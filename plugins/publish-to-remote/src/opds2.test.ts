import { describe, it, expect } from 'vitest';
import { generateOpds2Feed, parseOpds2Feed, OPDS2_TYPE } from './opds2.js';
import {
  DEFAULT_CATALOG_AUTHOR_NAME,
  DEFAULT_CATALOG_AUTHOR_URI,
} from './opds.js';
import type { S3RemoteConfig, S3Object, CatalogEntryMeta } from './types.js';

const FEED_URL = 'https://example.com/catalog.json';

const s3Config: S3RemoteConfig = {
  id: '1',
  name: 'My S3',
  type: 's3-compatible',
  endpoint: 'https://s3.example.com',
  bucket: 'my-bucket',
  accessKeyId: 'KEY',
  secretAccessKey: 'SECRET',
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

function generate(
  metaByKey: Map<string, CatalogEntryMeta> = new Map(),
  selectedKeys?: Set<string>,
  catalog = {},
) {
  return JSON.parse(
    generateOpds2Feed(
      s3Config,
      twoEpubs,
      FEED_URL,
      metaByKey,
      selectedKeys,
      catalog,
    ),
  );
}

describe('generateOpds2Feed', () => {
  it('produces a feed with metadata, self link, and one publication per epub', () => {
    const feed = generate();

    expect(feed.metadata.title).toBe('my-bucket');
    expect(feed.metadata.author).toEqual({
      name: DEFAULT_CATALOG_AUTHOR_NAME,
      identifier: DEFAULT_CATALOG_AUTHOR_URI,
    });
    expect(feed.links).toEqual([
      { rel: 'self', href: FEED_URL, type: OPDS2_TYPE },
    ]);
    expect(feed.publications).toHaveLength(2);

    const [first] = feed.publications;
    expect(first.metadata['@type']).toBe('http://schema.org/Book');
    expect(first.metadata.title).toBe('book1');
    expect(first.metadata.modified).toBe('2024-01-01T00:00:00.000Z');
    expect(first.links).toEqual([
      {
        rel: 'http://opds-spec.org/acquisition',
        href: 'https://s3.example.com/my-bucket/book1.epub',
        type: 'application/epub+zip',
      },
    ]);
  });

  it('uses the catalog identity for the feed metadata', () => {
    const feed = generate(new Map(), undefined, {
      title: 'My Catalog',
      authorName: 'The Publisher',
      authorUri: 'https://publisher.example.com',
    });

    expect(feed.metadata.title).toBe('My Catalog');
    expect(feed.metadata.author).toEqual({
      name: 'The Publisher',
      identifier: 'https://publisher.example.com',
    });
  });

  it('filters publications to the selected keys', () => {
    const feed = generate(new Map(), new Set(['book2.epub']));

    expect(feed.publications).toHaveLength(1);
    expect(feed.publications[0].metadata.title).toBe('book2');
  });

  it('maps sidecar metadata onto the publication', () => {
    const meta = new Map<string, CatalogEntryMeta>([
      [
        'book1.epub',
        {
          title: 'Bulletin 39',
          authors: ['Alice', 'Bob'],
          description: 'A fine bulletin.',
          language: 'en',
          publisher: 'The Press',
          issued: '2026-07-01',
          identifier: 'urn:uuid:1234',
          subjects: ['Music'],
          thumbnailUrl: 'https://s3.example.com/my-bucket/book1.thumb.png',
        },
      ],
    ]);

    const [pub] = generate(meta).publications;
    expect(pub.metadata.title).toBe('Bulletin 39');
    expect(pub.metadata.author).toEqual(['Alice', 'Bob']);
    expect(pub.metadata.description).toBe('A fine bulletin.');
    expect(pub.metadata.language).toBe('en');
    expect(pub.metadata.publisher).toBe('The Press');
    expect(pub.metadata.published).toBe('2026-07-01');
    expect(pub.metadata.identifier).toBe('urn:uuid:1234');
    expect(pub.metadata.subject).toEqual(['Music']);
    expect(pub.images).toEqual([
      {
        href: 'https://s3.example.com/my-bucket/book1.thumb.png',
        type: 'image/png',
      },
    ]);
  });

  describe('accessibility metadata', () => {
    it('builds the RWPM accessibility object from the sidecar block', () => {
      const meta = new Map<string, CatalogEntryMeta>([
        [
          'book1.epub',
          {
            title: 'Bulletin 39',
            accessibility: {
              accessMode: ['textual', 'visual', 'auditory'],
              accessModeSufficient: ['textual,visual,auditory', 'textual'],
              feature: ['alternativeText', 'structuralNavigation'],
              hazard: ['none'],
              summary: 'The music scores are presented as images only.',
              conformsTo: 'EPUB Accessibility 1.1 - WCAG 2.1 Level AA',
              certifiedBy: 'The Publisher',
            },
          },
        ],
      ]);

      const [pub] = generate(meta).publications;
      expect(pub.metadata.accessibility).toEqual({
        conformsTo: 'https://www.w3.org/TR/epub-a11y-11#wcag-2.1-aa',
        accessMode: ['textual', 'visual', 'auditory'],
        accessModeSufficient: [['textual', 'visual', 'auditory'], ['textual']],
        feature: ['alternativeText', 'structuralNavigation'],
        hazard: ['none'],
        summary: 'The music scores are presented as images only.',
        certification: { certifiedBy: 'The Publisher' },
      });
    });

    it('passes an unrecognised conformsTo value through verbatim', () => {
      const meta = new Map<string, CatalogEntryMeta>([
        [
          'book1.epub',
          { accessibility: { conformsTo: 'https://example.com/profile' } },
        ],
      ]);

      const [pub] = generate(meta).publications;
      expect(pub.metadata.accessibility.conformsTo).toBe(
        'https://example.com/profile',
      );
    });

    it('emits no accessibility member without the sidecar block', () => {
      const meta = new Map<string, CatalogEntryMeta>([
        ['book1.epub', { title: 'Bulletin 39' }],
      ]);

      const [pub] = generate(meta).publications;
      expect(pub.metadata).not.toHaveProperty('accessibility');
    });
  });

  describe('parseOpds2Feed (round-trip)', () => {
    it('reads title, author, and epub hrefs back from a generated feed', () => {
      const json = generateOpds2Feed(
        s3Config,
        twoEpubs,
        FEED_URL,
        new Map(),
        undefined,
        {
          title: 'My Catalog',
          authorName: 'The Publisher',
          authorUri: 'https://publisher.example.com',
        },
      );

      const parsed = parseOpds2Feed(json);
      expect(parsed.title).toBe('My Catalog');
      expect(parsed.authorName).toBe('The Publisher');
      expect(parsed.authorUri).toBe('https://publisher.example.com');
      expect(parsed.epubHrefs).toEqual(
        new Set([
          'https://s3.example.com/my-bucket/book1.epub',
          'https://s3.example.com/my-bucket/book2.epub',
        ]),
      );
    });

    it('tolerates a minimal feed', () => {
      const parsed = parseOpds2Feed('{"metadata":{"title":"Bare"}}');
      expect(parsed.title).toBe('Bare');
      expect(parsed.authorName).toBeUndefined();
      expect(parsed.authorUri).toBeUndefined();
      expect(parsed.epubHrefs.size).toBe(0);
    });

    it('throws on invalid JSON', () => {
      expect(() => parseOpds2Feed('<feed/>')).toThrow();
    });
  });
});
