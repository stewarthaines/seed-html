import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CatalogInfo } from './catalog.js';
import type { LocalPackage } from './local-packages.js';
import type { CatalogEntry, S3Object, S3RemoteConfig } from './types.js';

vi.mock('./remote-ops.js', () => ({ uploadFile: vi.fn() }));
vi.mock('./remote-status.js', () => ({
  listRemote: vi.fn(),
  identifiersOnRemote: vi.fn(() => new Map()),
}));
vi.mock('./remotes.js', () => ({ announceContentChanged: vi.fn() }));
vi.mock('./catalog.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./catalog.js')>()),
  loadCatalogs: vi.fn(),
  writeCatalog: vi.fn(),
}));

const { catalogWritesForSend, sendPackage } = await import('./send.js');
const { uploadFile } = await import('./remote-ops.js');
const { listRemote, identifiersOnRemote } = await import('./remote-status.js');
const { loadCatalogs, writeCatalog } = await import('./catalog.js');

function feed(
  file: string,
  keys: string[],
  entries: CatalogEntry[] = [],
  exists = true,
): CatalogInfo {
  return {
    file,
    format: 'opds2',
    feedUrl: `https://books.example.com/${file}`,
    exists,
    identity: { title: file, authorName: 'A', authorUri: 'https://a.example' },
    entries,
    keys: new Set(keys),
    missingHrefs: [],
  };
}

const written = (writes: { catalog: CatalogInfo; keys: Set<string> }[]) =>
  writes.map((w) => [w.catalog.file, [...w.keys].sort()]);

describe('catalogWritesForSend', () => {
  const sample = () => feed('sample.json', ['other.epub']);
  const testing = (keys: string[]) => feed('testing.json', keys);

  it('updates only the feed that lists the book', () => {
    const writes = catalogWritesForSend(
      [sample(), testing(['book.epub'])],
      new Set(['book.epub']),
      'urn:book',
      'book.epub',
      false,
      ['book.epub', 'other.epub'],
    );
    expect(written(writes)).toEqual([['testing.json', ['book.epub']]]);
  });

  it('replaces an older package of the book only where it was listed', () => {
    const writes = catalogWritesForSend(
      [sample(), testing(['book-1.epub', 'x.epub'])],
      new Set(['book-1.epub', 'book-2.epub']),
      'urn:book',
      'book-2.epub',
      false,
      ['book-1.epub', 'book-2.epub', 'other.epub', 'x.epub'],
    );
    expect(written(writes)).toEqual([
      ['testing.json', ['book-2.epub', 'x.epub']],
    ]);
  });

  it('updates every feed that lists the book', () => {
    const writes = catalogWritesForSend(
      [feed('sample.json', ['book-1.epub']), testing(['book-1.epub'])],
      new Set(['book-1.epub', 'book-2.epub']),
      'urn:book',
      'book-2.epub',
      false,
      ['book-1.epub', 'book-2.epub'],
    );
    expect(written(writes)).toEqual([
      ['sample.json', ['book-2.epub']],
      ['testing.json', ['book-2.epub']],
    ]);
  });

  it('leaves a book switched out of every feed out', () => {
    const writes = catalogWritesForSend(
      [sample(), testing([])],
      new Set(['book.epub']),
      'urn:book',
      'book.epub',
      false,
      ['book.epub', 'other.epub'],
    );
    expect(writes).toEqual([]);
  });

  it('rewrites the holding feed on a same-name re-send', () => {
    const writes = catalogWritesForSend(
      [testing(['book.epub', 'x.epub'])],
      new Set(['book.epub']),
      'urn:book',
      'book.epub',
      false,
      ['book.epub', 'x.epub'],
    );
    expect(written(writes)).toEqual([
      ['testing.json', ['book.epub', 'x.epub']],
    ]);
  });

  it('finds the book by identifier when its old package has gone', () => {
    const gone = feed(
      'testing.json',
      ['x.epub'],
      [
        {
          href: 'https://books.example.com/book-1.epub',
          identifier: 'urn:book',
        },
      ],
    );
    const writes = catalogWritesForSend(
      [sample(), gone],
      new Set(['book-2.epub']),
      'urn:book',
      'book-2.epub',
      false,
      ['book-2.epub', 'other.epub', 'x.epub'],
    );
    expect(written(writes)).toEqual([
      ['testing.json', ['book-2.epub', 'x.epub']],
    ]);
  });

  it('puts a first send into the first feed only', () => {
    const writes = catalogWritesForSend(
      [sample(), testing(['x.epub'])],
      new Set(['book.epub']),
      'urn:book',
      'book.epub',
      true,
      ['book.epub', 'other.epub', 'x.epub'],
    );
    expect(written(writes)).toEqual([
      ['sample.json', ['book.epub', 'other.epub']],
    ]);
  });

  it('creates the own feed with every EPUB on a destination with none', () => {
    const writes = catalogWritesForSend(
      [feed('catalog.json', [], [], false)],
      new Set(['book.epub']),
      'urn:book',
      'book.epub',
      true,
      ['book.epub', 'other.epub'],
    );
    expect(written(writes)).toEqual([
      ['catalog.json', ['book.epub', 'other.epub']],
    ]);
  });

  it('matches by filename alone without an identifier', () => {
    const writes = catalogWritesForSend(
      [sample(), testing(['book.epub'])],
      new Set(['book.epub']),
      undefined,
      'book.epub',
      false,
      ['book.epub', 'other.epub'],
    );
    expect(written(writes)).toEqual([['testing.json', ['book.epub']]]);
  });
});

describe('sendPackage', () => {
  const remote: S3RemoteConfig = {
    id: 's3',
    name: 'Shelf',
    type: 's3-compatible',
    endpoint: 'https://s3.example.com',
    bucket: 'books',
    accessKeyId: 'k',
    secretAccessKey: 's',
  };
  const obj = (key: string): S3Object => ({
    key,
    size: 1,
    lastModified: '2026-10-06',
  });
  const pkg: LocalPackage = {
    file: new File(['x'], 'book-2.epub'),
    name: 'book-2.epub',
    size: 1,
    lastModified: 0,
    identifier: 'urn:book',
  };

  beforeEach(() => {
    vi.mocked(uploadFile).mockResolvedValue({ success: true });
    vi.mocked(writeCatalog).mockReset().mockResolvedValue({ success: true });
    vi.mocked(listRemote).mockResolvedValue({
      reach: 'ok',
      objects: [
        obj('book-1.epub'),
        obj('book-2.epub'),
        obj('sample.json'),
        obj('testing.json'),
      ],
    });
    vi.mocked(identifiersOnRemote).mockReturnValue(
      new Map([
        ['book-1.epub', 'urn:book'],
        ['book-2.epub', 'urn:book'],
      ]),
    );
  });

  it('writes nothing when a feed is unreadable', async () => {
    vi.mocked(loadCatalogs).mockResolvedValue([
      feed('sample.json', []),
      { ...feed('testing.json', []), error: 'Forbidden' },
    ]);
    const result = await sendPackage(remote, pkg, [pkg], undefined, {
      reach: 'ok',
      objects: [obj('book-1.epub')],
    });
    expect(result.success).toBe(true);
    expect(writeCatalog).not.toHaveBeenCalled();
    expect(result.catalogs?.some((c) => c.error)).toBe(true);
  });

  it('writes only the feed that held the older package', async () => {
    vi.mocked(loadCatalogs).mockResolvedValue([
      feed('sample.json', []),
      feed('testing.json', ['book-1.epub']),
    ]);
    await sendPackage(remote, pkg, [pkg], undefined, {
      reach: 'ok',
      objects: [obj('book-1.epub')],
    });
    expect(writeCatalog).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeCatalog).mock.calls[0][5]).toBe('testing.json');
    expect([...vi.mocked(writeCatalog).mock.calls[0][2]]).toEqual([
      'book-2.epub',
    ]);
  });
});
