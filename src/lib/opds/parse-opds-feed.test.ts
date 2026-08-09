import { describe, it, expect } from 'vitest';
import { parseOpdsFeed } from './parse-opds-feed.js';

const FEED_URL = 'https://books.example.com/catalog.xml';

function feed(entries: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:dc="http://purl.org/dc/terms/"
      xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:uri:${FEED_URL}</id>
  <title>Example Catalog</title>
  <updated>2026-01-01T00:00:00Z</updated>
  <link rel="self" href="${FEED_URL}"
        type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  ${entries}
</feed>`;
}

describe('parseOpdsFeed', () => {
  it('extracts EPUB entries with title, author, updated and an absolute href', () => {
    const xml = feed(`
      <entry>
        <title>The Time Machine</title>
        <author><name>H. G. Wells</name></author>
        <id>urn:uri:https://books.example.com/time-machine.epub</id>
        <updated>2025-12-31T12:00:00Z</updated>
        <link rel="http://opds-spec.org/acquisition"
              href="https://books.example.com/time-machine.epub"
              type="application/epub+zip"/>
      </entry>`);

    const { title, books } = parseOpdsFeed(xml, FEED_URL);

    expect(title).toBe('Example Catalog');
    expect(books).toEqual([
      {
        title: 'The Time Machine',
        author: 'H. G. Wells',
        updated: '2025-12-31T12:00:00Z',
        href: 'https://books.example.com/time-machine.epub',
      },
    ]);
  });

  it('resolves a relative acquisition href against the feed URL', () => {
    const xml = feed(`
      <entry>
        <title>Relative Book</title>
        <link rel="http://opds-spec.org/acquisition"
              href="books/relative.epub" type="application/epub+zip"/>
      </entry>`);

    const [book] = parseOpdsFeed(xml, FEED_URL).books;
    expect(book.href).toBe('https://books.example.com/books/relative.epub');
    expect(book.author).toBeUndefined();
  });

  it('skips navigation entries that have no EPUB acquisition link', () => {
    const xml = feed(`
      <entry>
        <title>Browse subsection</title>
        <link rel="subsection" href="fiction.xml"
              type="application/atom+xml;profile=opds-catalog"/>
      </entry>
      <entry>
        <title>A Real Book</title>
        <link rel="http://opds-spec.org/acquisition"
              href="real.epub" type="application/epub+zip"/>
      </entry>`);

    const { books } = parseOpdsFeed(xml, FEED_URL);
    expect(books.map(b => b.title)).toEqual(['A Real Book']);
  });

  it('prefers an acquisition link over a non-acquisition EPUB link', () => {
    const xml = feed(`
      <entry>
        <title>Two Links</title>
        <link rel="alternate" href="preview.epub" type="application/epub+zip"/>
        <link rel="http://opds-spec.org/acquisition/open-access"
              href="full.epub" type="application/epub+zip"/>
      </entry>`);

    const [book] = parseOpdsFeed(xml, FEED_URL).books;
    expect(book.href).toBe('https://books.example.com/full.epub');
  });

  it('returns an empty array for a feed with no entries', () => {
    expect(parseOpdsFeed(feed(''), FEED_URL).books).toEqual([]);
  });

  it('throws on malformed XML', () => {
    expect(() => parseOpdsFeed('<feed><entry>', FEED_URL)).toThrow();
  });
});

describe('parseOpdsFeed (OPDS 2.0 JSON)', () => {
  const JSON_FEED_URL = 'https://books.example.com/catalog.json';

  function jsonFeed(publications: unknown[]): string {
    return JSON.stringify({
      metadata: {
        title: 'Example Catalog',
        author: { name: 'SEED.html', identifier: 'https://readitinabook.com' },
      },
      links: [{ rel: 'self', href: JSON_FEED_URL, type: 'application/opds+json' }],
      publications,
    });
  }

  it('extracts publications with title, author, modified and an absolute href', () => {
    const json = jsonFeed([
      {
        metadata: {
          '@type': 'http://schema.org/Book',
          title: 'The Time Machine',
          author: ['H. G. Wells'],
          modified: '2025-12-31T12:00:00Z',
        },
        links: [
          {
            rel: 'http://opds-spec.org/acquisition',
            href: 'https://books.example.com/time-machine.epub',
            type: 'application/epub+zip',
          },
        ],
        images: [{ href: 'https://books.example.com/time-machine.thumb.png' }],
      },
    ]);

    const { title, books } = parseOpdsFeed(json, JSON_FEED_URL);

    expect(title).toBe('Example Catalog');
    expect(books).toEqual([
      {
        title: 'The Time Machine',
        author: 'H. G. Wells',
        updated: '2025-12-31T12:00:00Z',
        href: 'https://books.example.com/time-machine.epub',
        thumbnailHref: 'https://books.example.com/time-machine.thumb.png',
      },
    ]);
  });

  it('resolves relative hrefs against the feed URL', () => {
    const json = jsonFeed([
      {
        metadata: { title: 'Relative Book' },
        links: [
          {
            rel: 'http://opds-spec.org/acquisition',
            href: 'books/relative.epub',
            type: 'application/epub+zip',
          },
        ],
        images: [{ href: 'books/relative.thumb.png' }],
      },
    ]);

    const [book] = parseOpdsFeed(json, JSON_FEED_URL).books;
    expect(book.href).toBe('https://books.example.com/books/relative.epub');
    expect(book.thumbnailHref).toBe('https://books.example.com/books/relative.thumb.png');
    expect(book.author).toBeUndefined();
  });

  it('reads contributor-object authors and language-map titles', () => {
    const json = jsonFeed([
      {
        metadata: {
          title: { en: 'Localized Title' },
          author: { name: 'Jane Author' },
        },
        links: [
          { rel: 'http://opds-spec.org/acquisition', href: 'a.epub', type: 'application/epub+zip' },
        ],
      },
    ]);

    const [book] = parseOpdsFeed(json, JSON_FEED_URL).books;
    expect(book.title).toBe('Localized Title');
    expect(book.author).toBe('Jane Author');
  });

  it('skips publications without an EPUB link and prefers acquisition rels', () => {
    const json = jsonFeed([
      {
        metadata: { title: 'Navigation Only' },
        links: [{ rel: 'subsection', href: 'more.json', type: 'application/opds+json' }],
      },
      {
        metadata: { title: 'Two Links' },
        links: [
          { rel: 'alternate', href: 'preview.epub', type: 'application/epub+zip' },
          {
            rel: ['http://opds-spec.org/acquisition/open-access'],
            href: 'full.epub',
            type: 'application/epub+zip',
          },
        ],
      },
    ]);

    const { books } = parseOpdsFeed(json, JSON_FEED_URL);
    expect(books.map(b => b.title)).toEqual(['Two Links']);
    expect(books[0].href).toBe('https://books.example.com/full.epub');
  });

  it('returns an empty list for a feed with no publications', () => {
    const parsed = parseOpdsFeed('{"metadata":{"title":"Bare"}}', JSON_FEED_URL);
    expect(parsed.title).toBe('Bare');
    expect(parsed.books).toEqual([]);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseOpdsFeed('{"metadata":', JSON_FEED_URL)).toThrow(/invalid JSON/);
  });
});
