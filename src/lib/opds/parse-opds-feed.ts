/**
 * OPDS feed parsing for "Import from Catalog".
 *
 * Parses an OPDS acquisition feed — 2.0 (JSON) or 1.2 (Atom XML), sniffed from
 * the document itself — into the list of downloadable EPUBs it advertises.
 * Mirrors the schemas produced by the publish plugin's generateOpds2Feed
 * (publications linking `application/epub+zip`) and generateOpdsFeed (entries
 * carrying a `<link rel="http://opds-spec.org/acquisition"
 * type="application/epub+zip">`).
 */

/** A downloadable EPUB advertised by an OPDS feed entry. */
export interface OpdsBook {
  title: string;
  author?: string;
  /** dc:issued / atom:updated timestamp, if present. */
  updated?: string;
  /** Absolute acquisition URL (relative hrefs resolved against the feed URL). */
  href: string;
  /** Cover thumbnail URL (http(s) or data:), if the entry advertises one. */
  thumbnailHref?: string;
}

/** A parsed OPDS feed: its display title and the EPUBs it advertises. */
export interface OpdsFeed {
  /** The feed's atom:title, when present. */
  title?: string;
  books: OpdsBook[];
}

const EPUB_TYPE = 'application/epub+zip';

/**
 * Parse an OPDS feed document into its title and EPUB entries. A document
 * opening with `{` is treated as OPDS 2.0 JSON, anything else as Atom XML
 * (the dialog takes a pasted URL, so the content is the only format signal).
 *
 * @param text     Raw feed document (JSON or XML).
 * @param feedUrl  URL the feed was fetched from; used to resolve relative hrefs.
 * @throws if the document cannot be parsed as a feed.
 */
export function parseOpdsFeed(text: string, feedUrl: string): OpdsFeed {
  if (text.trimStart().startsWith('{')) {
    return parseOpds2Feed(text, feedUrl);
  }
  return parseOpds1Feed(text, feedUrl);
}

/** OPDS 2.0: a feed of `publications`, each with RWPM `metadata` + `links`. */
function parseOpds2Feed(json: string, feedUrl: string): OpdsFeed {
  let feed: Opds2Feed;
  try {
    feed = JSON.parse(json) as Opds2Feed;
  } catch {
    throw new Error('Could not parse the catalog feed (invalid JSON).');
  }

  const books: OpdsBook[] = [];
  for (const pub of feed.publications ?? []) {
    const href = opds2AcquisitionHref(pub, feedUrl);
    if (!href) continue; // navigation-only publications are skipped

    books.push({
      title: localizedString(pub.metadata?.title) || 'Untitled',
      author: contributorName(pub.metadata?.author),
      updated: pub.metadata?.modified || pub.metadata?.published || undefined,
      href,
      thumbnailHref: resolveUrl(pub.images?.[0]?.href, feedUrl),
    });
  }

  return { title: localizedString(feed.metadata?.title) || undefined, books };
}

/** The subset of an OPDS 2.0 feed the importer reads. */
interface Opds2Feed {
  metadata?: { title?: unknown };
  publications?: Array<{
    metadata?: {
      title?: unknown;
      author?: unknown;
      modified?: string;
      published?: string;
    };
    links?: Array<{ rel?: string | string[]; href?: string; type?: string }>;
    images?: Array<{ href?: string }>;
  }>;
}

/** RWPM localizable string: plain, or a language-map — take its first value. */
function localizedString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (value && typeof value === 'object') {
    const first = Object.values(value)[0];
    if (typeof first === 'string') return first.trim() || undefined;
  }
  return undefined;
}

/** RWPM contributor(s): string, {name}, or an array of either — take the first. */
function contributorName(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === 'string') return first.trim() || undefined;
  if (first && typeof first === 'object' && 'name' in first) {
    return localizedString((first as { name?: unknown }).name);
  }
  return undefined;
}

/** A publication's EPUB acquisition link, preferring an acquisition rel. */
function opds2AcquisitionHref(
  pub: NonNullable<Opds2Feed['publications']>[number],
  feedUrl: string
): string | undefined {
  const epubLinks = (pub.links ?? []).filter(l => l.type === EPUB_TYPE);
  const rels = (l: { rel?: string | string[] }) =>
    Array.isArray(l.rel) ? l.rel : l.rel ? [l.rel] : [];
  const link = epubLinks.find(l => rels(l).some(r => r.includes('acquisition'))) ?? epubLinks[0];
  return resolveUrl(link?.href, feedUrl);
}

function resolveUrl(href: string | undefined, feedUrl: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, feedUrl).href;
  } catch {
    return undefined;
  }
}

/** OPDS 1.2: an Atom feed of `<entry>` elements. */
function parseOpds1Feed(xml: string, feedUrl: string): OpdsFeed {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  // A parse failure yields a document containing a <parsererror> element.
  if (doc.querySelector('parsererror')) {
    throw new Error('Could not parse the catalog feed (invalid XML).');
  }

  const books: OpdsBook[] = [];

  for (const entry of Array.from(doc.querySelectorAll('entry'))) {
    const href = acquisitionHref(entry, feedUrl);
    if (!href) continue; // navigation entries / non-EPUB acquisitions are skipped

    const title = text(entry.querySelector('title')) || 'Untitled';
    const author = text(entry.querySelector('author > name')) || undefined;
    const updated = text(entry.querySelector('updated')) || undefined;
    const thumbnailHref = thumbnailUrl(entry, feedUrl);

    books.push({ title, author, updated, href, thumbnailHref });
  }

  return { title: feedTitle(doc), books };
}

/** The feed's own title: the first direct-child <title> of the root element. */
function feedTitle(doc: Document): string | undefined {
  for (const child of Array.from(doc.documentElement.children)) {
    if (child.localName === 'title') {
      return child.textContent?.trim() || undefined;
    }
  }
  return undefined;
}

/**
 * Find an entry's EPUB acquisition link and resolve it to an absolute URL.
 * Prefers a link whose rel mentions "acquisition"; falls back to any EPUB link.
 */
function acquisitionHref(entry: Element, feedUrl: string): string | null {
  const epubLinks = Array.from(entry.querySelectorAll(`link[type="${EPUB_TYPE}"]`));
  const link =
    epubLinks.find(l => (l.getAttribute('rel') ?? '').includes('acquisition')) ?? epubLinks[0];

  const href = link?.getAttribute('href');
  if (!href) return null;

  try {
    return new URL(href, feedUrl).href;
  } catch {
    return null;
  }
}

const THUMBNAIL_REL = 'http://opds-spec.org/image/thumbnail';
const IMAGE_REL = 'http://opds-spec.org/image';

/**
 * Find an entry's cover thumbnail and resolve it to an absolute URL. Prefers the
 * dedicated thumbnail relation, falling back to the full cover image. Passes
 * through http(s) and data: URIs; resolves relative hrefs against the feed URL.
 */
function thumbnailUrl(entry: Element, feedUrl: string): string | undefined {
  const links = Array.from(entry.querySelectorAll('link[rel][href]'));
  const link =
    links.find(l => l.getAttribute('rel') === THUMBNAIL_REL) ??
    links.find(l => l.getAttribute('rel') === IMAGE_REL);

  const href = link?.getAttribute('href');
  if (!href) return undefined;

  try {
    return new URL(href, feedUrl).href;
  } catch {
    return undefined;
  }
}

function text(el: Element | null): string {
  return el?.textContent?.trim() ?? '';
}
