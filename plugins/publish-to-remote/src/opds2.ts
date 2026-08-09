import {
  acquisitionUrl,
  defaultCatalogTitle,
  DEFAULT_CATALOG_AUTHOR_NAME,
  DEFAULT_CATALOG_AUTHOR_URI,
} from './opds.js';
import type { CatalogIdentity, ParsedOpdsFeed } from './opds.js';
import type { RemoteConfig, S3Object, CatalogEntryMeta } from './types.js';

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
      links?: Array<{ href?: string; type?: string }>;
    }>;
  };

  const epubHrefs = new Set<string>();
  for (const pub of feed.publications ?? []) {
    for (const link of pub.links ?? []) {
      if (link.type === EPUB_TYPE && link.href) epubHrefs.add(link.href);
    }
  }

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
  };
}
