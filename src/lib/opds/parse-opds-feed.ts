/**
 * OPDS feed parsing for "Import from Catalog".
 *
 * Parses an OPDS (Atom) acquisition feed into the list of downloadable EPUBs it
 * advertises. Mirrors the schema produced by the publish plugin's
 * generateOpdsFeed (entries carrying a
 * `<link rel="http://opds-spec.org/acquisition" type="application/epub+zip">`).
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
 * Parse an OPDS feed document into its title and EPUB entries.
 *
 * @param xml      Raw feed XML.
 * @param feedUrl  URL the feed was fetched from; used to resolve relative hrefs.
 * @throws if the XML cannot be parsed as a document.
 */
export function parseOpdsFeed(xml: string, feedUrl: string): OpdsFeed {
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
