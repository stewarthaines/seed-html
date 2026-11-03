import {
  acquisitionUrl,
  defaultCatalogTitle,
  DEFAULT_CATALOG_AUTHOR_NAME,
  DEFAULT_CATALOG_AUTHOR_URI,
} from './opds.js';
import type { CatalogIdentity, ParsedOpdsFeed } from './opds.js';
import type {
  RemoteConfig,
  S3Object,
  CatalogEntry,
  CatalogEntryMeta,
} from './types.js';

/** OPDS 2.0 feed media type (self link + upload content type). */
export const OPDS2_TYPE = 'application/opds+json';

const EPUB_TYPE = 'application/epub+zip';
const ACQUISITION_REL = 'http://opds-spec.org/acquisition';

/**
 * The OPF stores EPUB Accessibility 1.1 conformance as the spec's display
 * strings (see src/lib/epub/accessibility-vocab.ts CONFORMANCE_OPTIONS);
 * Readium-based clients recognise only the canonical W3C profile URIs, so the
 * feed maps the closed vocabulary and passes unknown values through verbatim.
 * Redeclared here because the plugin builds separately from the host.
 */
const CONFORMANCE_URIS: Record<string, string> = {
  'EPUB Accessibility 1.1 - WCAG 2.0 Level A':
    'https://www.w3.org/TR/epub-a11y-11#wcag-2.0-a',
  'EPUB Accessibility 1.1 - WCAG 2.0 Level AA':
    'https://www.w3.org/TR/epub-a11y-11#wcag-2.0-aa',
  'EPUB Accessibility 1.1 - WCAG 2.0 Level AAA':
    'https://www.w3.org/TR/epub-a11y-11#wcag-2.0-aaa',
  'EPUB Accessibility 1.1 - WCAG 2.1 Level A':
    'https://www.w3.org/TR/epub-a11y-11#wcag-2.1-a',
  'EPUB Accessibility 1.1 - WCAG 2.1 Level AA':
    'https://www.w3.org/TR/epub-a11y-11#wcag-2.1-aa',
  'EPUB Accessibility 1.1 - WCAG 2.1 Level AAA':
    'https://www.w3.org/TR/epub-a11y-11#wcag-2.1-aaa',
  'EPUB Accessibility 1.1 - WCAG 2.2 Level A':
    'https://www.w3.org/TR/epub-a11y-11#wcag-2.2-a',
  'EPUB Accessibility 1.1 - WCAG 2.2 Level AA':
    'https://www.w3.org/TR/epub-a11y-11#wcag-2.2-aa',
  'EPUB Accessibility 1.1 - WCAG 2.2 Level AAA':
    'https://www.w3.org/TR/epub-a11y-11#wcag-2.2-aaa',
};

/** The OPF display string for a conformance URI the feed carries, else the
 *  value as written (unknown values pass through both ways). */
const CONFORMANCE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CONFORMANCE_URIS).map(([label, uri]) => [uri, label]),
);

/** RWPM `metadata.accessibility` object built from the sidecar block. */
function accessibilityObject(a11y: NonNullable<CatalogEntryMeta['accessibility']>) {
  const out: Record<string, unknown> = {};
  if (a11y.conformsTo) {
    out.conformsTo = CONFORMANCE_URIS[a11y.conformsTo] ?? a11y.conformsTo;
  }
  if (a11y.accessMode?.length) out.accessMode = a11y.accessMode;
  if (a11y.accessModeSufficient?.length) {
    // Sidecar keeps one comma-joined string per sufficient combination
    // (verbatim from the OPF); RWPM wants a list of lists.
    out.accessModeSufficient = a11y.accessModeSufficient.map((combo) =>
      combo
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
    );
  }
  if (a11y.feature?.length) out.feature = a11y.feature;
  if (a11y.hazard?.length) out.hazard = a11y.hazard;
  if (a11y.summary) out.summary = a11y.summary;
  if (a11y.certifiedBy) out.certification = { certifiedBy: a11y.certifiedBy };
  return out;
}

/**
 * Generate an OPDS 2.0 acquisition feed (JSON). Same contract as
 * generateOpdsFeed: `objects` filtered to epubs (optionally by `selectedKeys`),
 * enriched from the sidecar-derived `metaByKey`.
 */
export function generateOpds2Feed(
  creds: RemoteConfig,
  objects: S3Object[],
  feedUrl: string,
  metaByKey: Map<string, CatalogEntryMeta> = new Map(),
  selectedKeys?: Set<string>,
  catalog: CatalogIdentity = {},
): string {
  const epubs = objects.filter(
    (o) =>
      o.key.endsWith('.epub') && (!selectedKeys || selectedKeys.has(o.key)),
  );

  const publications = epubs.map((o) => {
    const url = acquisitionUrl(creds, o);
    const meta = metaByKey.get(o.key);

    const metadata: Record<string, unknown> = {
      '@type': 'http://schema.org/Book',
      title: meta?.title || o.key.replace(/\.epub$/i, ''),
      modified: o.lastModified,
    };
    if (meta?.authors?.length) metadata.author = meta.authors;
    if (meta?.identifier) metadata.identifier = meta.identifier;
    if (meta?.language) metadata.language = meta.language;
    if (meta?.publisher) metadata.publisher = meta.publisher;
    if (meta?.issued) metadata.published = meta.issued;
    if (meta?.description) metadata.description = meta.description;
    if (meta?.subjects?.length) metadata.subject = meta.subjects;
    if (meta?.accessibility) {
      metadata.accessibility = accessibilityObject(meta.accessibility);
    }

    const publication: Record<string, unknown> = {
      metadata,
      links: [{ rel: ACQUISITION_REL, href: url, type: EPUB_TYPE }],
    };
    if (meta?.thumbnailUrl) {
      publication.images = [{ href: meta.thumbnailUrl, type: 'image/png' }];
    }
    return publication;
  });

  const feed = {
    metadata: {
      title: catalog.title?.trim() || defaultCatalogTitle(creds),
      // OPDS 2.0 has no catalog-author slot; the editor's Name/URI pair rides
      // as an RWPM contributor object so it round-trips on load.
      author: {
        name: catalog.authorName?.trim() || DEFAULT_CATALOG_AUTHOR_NAME,
        identifier: catalog.authorUri?.trim() || DEFAULT_CATALOG_AUTHOR_URI,
      },
    },
    links: [{ rel: 'self', href: feedUrl, type: OPDS2_TYPE }],
    publications,
  };

  return JSON.stringify(feed, null, 2);
}

const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** A contributor or subject as RWPM allows it: a string, an object with a
 *  name, or a list of either. Returns the names. */
function names(v: unknown): string[] {
  const list = Array.isArray(v) ? v : v === undefined ? [] : [v];
  return list
    .map((x) =>
      typeof x === 'string'
        ? x.trim()
        : x && typeof x === 'object'
          ? (text((x as { name?: unknown }).name) ?? '')
          : '',
    )
    .filter(Boolean);
}

const strings = (v: unknown): string[] | undefined => {
  const list = Array.isArray(v) ? v.map(text).filter((x): x is string => !!x) : [];
  return list.length ? list : undefined;
};

/** The sidecar block back out of an RWPM `metadata.accessibility` object. */
function accessibilityMeta(
  a: Record<string, unknown>,
): CatalogEntryMeta['accessibility'] {
  const out: NonNullable<CatalogEntryMeta['accessibility']> = {};
  const conforms = text(Array.isArray(a.conformsTo) ? a.conformsTo[0] : a.conformsTo);
  if (conforms) out.conformsTo = CONFORMANCE_LABELS[conforms] ?? conforms;
  const accessMode = strings(a.accessMode);
  if (accessMode) out.accessMode = accessMode;
  if (Array.isArray(a.accessModeSufficient)) {
    const combos = a.accessModeSufficient
      .map((c) => (Array.isArray(c) ? c.map(text).filter(Boolean).join(',') : text(c)))
      .filter((c): c is string => !!c);
    if (combos.length) out.accessModeSufficient = combos;
  }
  const feature = strings(a.feature);
  if (feature) out.feature = feature;
  const hazard = strings(a.hazard);
  if (hazard) out.hazard = hazard;
  const summary = text(a.summary);
  if (summary) out.summary = summary;
  const certification = a.certification as { certifiedBy?: unknown } | undefined;
  const certifiedBy = text(certification?.certifiedBy);
  if (certifiedBy) out.certifiedBy = certifiedBy;
  return Object.keys(out).length ? out : undefined;
}

/** What a publication says about its book, in sidecar form: the inverse of
 *  generateOpds2Feed, so an entry carried forward is written back unchanged. */
function publicationMeta(pub: {
  metadata?: Record<string, unknown>;
  images?: Array<{ href?: unknown }>;
}): CatalogEntryMeta {
  const m = pub.metadata ?? {};
  const meta: CatalogEntryMeta = {};
  const title = text(m.title);
  if (title) meta.title = title;
  const authors = names(m.author);
  if (authors.length) meta.authors = authors;
  const identifier = text(m.identifier);
  if (identifier) meta.identifier = identifier;
  const language = text(Array.isArray(m.language) ? m.language[0] : m.language);
  if (language) meta.language = language;
  const publisher = names(m.publisher)[0];
  if (publisher) meta.publisher = publisher;
  const issued = text(m.published);
  if (issued) meta.issued = issued;
  const description = text(m.description);
  if (description) meta.description = description;
  const subjects = names(m.subject);
  if (subjects.length) meta.subjects = subjects;
  if (m.accessibility && typeof m.accessibility === 'object') {
    const a11y = accessibilityMeta(m.accessibility as Record<string, unknown>);
    if (a11y) meta.accessibility = a11y;
  }
  const image = text(pub.images?.[0]?.href);
  if (image) meta.thumbnailUrl = image;
  return meta;
}

/**
 * Parse an existing OPDS 2.0 feed back into its editable identity and the set
 * of epub acquisition hrefs it lists (same shape the Atom parser returns).
 * Throws if the text isn't valid JSON.
 */
export function parseOpds2Feed(json: string): ParsedOpdsFeed {
  const feed = JSON.parse(json) as {
    metadata?: {
      title?: string;
      author?: string | { name?: string; identifier?: string };
    };
    publications?: Array<{
      metadata?: Record<string, unknown>;
      links?: Array<{ href?: string; type?: string }>;
      images?: Array<{ href?: unknown }>;
    }>;
  };

  const entries: CatalogEntry[] = [];
  for (const pub of feed.publications ?? []) {
    const link = (pub.links ?? []).find((l) => l.type === EPUB_TYPE && l.href);
    if (!link?.href) continue;
    const meta = publicationMeta(pub);
    entries.push({
      href: link.href,
      identifier: meta.identifier,
      title: meta.title,
      meta,
    });
  }
  const epubHrefs = new Set(entries.map((e) => e.href));

  const author = feed.metadata?.author;
  const authorName =
    typeof author === 'string' ? author : author?.name?.trim();
  const authorUri =
    typeof author === 'object' ? author?.identifier?.trim() : undefined;

  return {
    title: feed.metadata?.title?.trim() || undefined,
    authorName: authorName || undefined,
    authorUri: authorUri || undefined,
    epubHrefs,
    entries,
  };
}
