import { getPublicUrl } from './s3-upload.js';
import { getWebDAVPublicUrl } from './webdav-upload.js';
import { getGoogleDrivePublicUrl } from './google-drive-upload.js';
import type {
  RemoteConfig,
  S3Object,
  S3RemoteConfig,
  GoogleDriveRemoteConfig,
  DropboxRemoteConfig,
  CatalogEntry,
  CatalogEntryMeta,
} from './types.js';

const ATOM_NS = 'http://www.w3.org/2005/Atom';
const DC_NS = 'http://purl.org/dc/terms/';
const SCHEMA_NS = 'http://schema.org/';

/** Default catalog author (the publisher), used when a catalog leaves it blank. */
export const DEFAULT_CATALOG_AUTHOR_NAME = 'SEED.html';
export const DEFAULT_CATALOG_AUTHOR_URI = 'https://readitinabook.com';

/** Per-catalog identity. Drives the feed <title> and the feed-level <author>
 *  (name + uri). Blank fields fall back to derived/known defaults. */
export interface CatalogIdentity {
  title?: string;
  authorName?: string;
  authorUri?: string;
}

/** The default feed title for a remote (its bucket / folder / display name),
 *  used when a catalog doesn't set its own title. */
export function defaultCatalogTitle(creds: RemoteConfig): string {
  return creds.type === 's3-compatible'
    ? (creds as S3RemoteConfig).bucket
    : creds.type === 'google-drive'
      ? (creds as GoogleDriveRemoteConfig).folderName
      : creds.type === 'dropbox'
        ? (creds as DropboxRemoteConfig).folderPath
        : creds.name; // webdav: use the display name
}

/** The public download URL for a remote object, per remote type. */
export function acquisitionUrl(creds: RemoteConfig, o: S3Object): string {
  if (creds.type === 's3-compatible') {
    return getPublicUrl(creds as S3RemoteConfig, o.key);
  } else if (creds.type === 'google-drive') {
    // Single source of truth for the Drive download URL (see google-drive-upload).
    return o.fileId
      ? getGoogleDrivePublicUrl(creds as GoogleDriveRemoteConfig, o.fileId)
      : '';
  } else if (creds.type === 'dropbox') {
    return o.fileId || '';
  } else if (creds.type === 'webdav') {
    return getWebDAVPublicUrl(creds, o.key);
  }
  return '';
}

export function generateOpdsFeed(
  creds: RemoteConfig,
  objects: S3Object[],
  feedUrl: string,
  metaByKey: Map<string, CatalogEntryMeta> = new Map(),
  selectedKeys?: Set<string>,
  catalog: CatalogIdentity = {},
): string {
  const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
  const doc = document.implementation.createDocument(ATOM_NS, 'feed', null);
  const feed = doc.documentElement;
  // Declare prefixes as proper namespace attributes so the serializer keeps them
  // on the root rather than re-declaring `xmlns:dc` on every dc: element.
  feed.setAttributeNS(XMLNS_NS, 'xmlns:dc', DC_NS);
  feed.setAttributeNS(XMLNS_NS, 'xmlns:schema', SCHEMA_NS);
  feed.setAttributeNS(
    XMLNS_NS,
    'xmlns:opds',
    'http://opds-spec.org/2010/catalog',
  );

  function child(
    parent: Element,
    tag: string,
    text?: string,
    attrs: Record<string, string> = {},
  ) {
    const el = doc.createElementNS(ATOM_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    if (text !== undefined) {
      el.textContent = text;
    }
    parent.appendChild(el);
    return el;
  }

  // Dublin Core (dcterms) element, e.g. <dc:language>.
  function dcChild(parent: Element, tag: string, text: string) {
    const el = doc.createElementNS(DC_NS, `dc:${tag}`);
    el.textContent = text;
    parent.appendChild(el);
    return el;
  }

  // schema.org element, e.g. <schema:accessMode>.
  function schemaChild(parent: Element, tag: string, text: string) {
    const el = doc.createElementNS(SCHEMA_NS, `schema:${tag}`);
    el.textContent = text;
    parent.appendChild(el);
    return el;
  }

  const title = catalog.title?.trim() || defaultCatalogTitle(creds);
  child(feed, 'id', `urn:uri:${feedUrl}`);
  child(feed, 'title', title);
  child(feed, 'updated', new Date().toISOString());
  child(feed, 'link', undefined, {
    rel: 'self',
    href: feedUrl,
    type: 'application/atom+xml;profile=opds-catalog;kind=acquisition',
  });
  const feedAuthor = child(feed, 'author');
  child(
    feedAuthor,
    'name',
    catalog.authorName?.trim() || DEFAULT_CATALOG_AUTHOR_NAME,
  );
  child(
    feedAuthor,
    'uri',
    catalog.authorUri?.trim() || DEFAULT_CATALOG_AUTHOR_URI,
  );

  const epubs = objects.filter(
    (o) =>
      o.key.endsWith('.epub') && (!selectedKeys || selectedKeys.has(o.key)),
  );
  for (const o of epubs) {
    const url = acquisitionUrl(creds, o);
    const meta = metaByKey.get(o.key);
    const entry = child(feed, 'entry');
    child(entry, 'title', meta?.title || o.key.replace(/\.epub$/i, ''));
    child(entry, 'id', `urn:uri:${url}`);
    child(entry, 'updated', o.lastModified);

    // Rich metadata from the host-written sidecar, when available.
    if (meta) {
      for (const name of meta.authors ?? []) {
        const author = child(entry, 'author');
        child(author, 'name', name);
      }
      if (meta.description) child(entry, 'summary', meta.description);
      if (meta.language) dcChild(entry, 'language', meta.language);
      if (meta.publisher) dcChild(entry, 'publisher', meta.publisher);
      if (meta.issued) dcChild(entry, 'issued', meta.issued);
      if (meta.identifier) dcChild(entry, 'identifier', meta.identifier);
      for (const subject of meta.subjects ?? []) {
        child(entry, 'category', undefined, { term: subject });
      }
      // Accessibility metadata: one element per value for the repeatable
      // properties (mirroring the OPF's repeated <meta> elements); each
      // accessModeSufficient entry stays one element per sufficient
      // COMBINATION, comma-separated, preserving the list-of-lists semantics.
      const a11y = meta.accessibility;
      if (a11y) {
        for (const v of a11y.accessMode ?? []) {
          schemaChild(entry, 'accessMode', v);
        }
        for (const v of a11y.accessModeSufficient ?? []) {
          schemaChild(entry, 'accessModeSufficient', v);
        }
        for (const v of a11y.feature ?? []) {
          schemaChild(entry, 'accessibilityFeature', v);
        }
        for (const v of a11y.hazard ?? []) {
          schemaChild(entry, 'accessibilityHazard', v);
        }
        if (a11y.summary) {
          schemaChild(entry, 'accessibilitySummary', a11y.summary);
        }
        if (a11y.conformsTo) dcChild(entry, 'conformsTo', a11y.conformsTo);
        if (a11y.certifiedBy) {
          schemaChild(entry, 'certifiedBy', a11y.certifiedBy);
        }
      }
      if (meta.thumbnailUrl) {
        // Emit both relations (some clients read only the full `image`) pointing
        // at the hosted PNG — resolvable URLs render where data: URIs don't.
        child(entry, 'link', undefined, {
          rel: 'http://opds-spec.org/image',
          href: meta.thumbnailUrl,
          type: 'image/png',
        });
        child(entry, 'link', undefined, {
          rel: 'http://opds-spec.org/image/thumbnail',
          href: meta.thumbnailUrl,
          type: 'image/png',
        });
      }
    }

    child(entry, 'link', undefined, {
      rel: 'http://opds-spec.org/acquisition',
      href: url,
      type: 'application/epub+zip',
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(doc)}`;
}

/** What we read back out of an existing catalog when it's clicked to edit. */
export interface ParsedOpdsFeed {
  title?: string;
  authorName?: string;
  authorUri?: string;
  /** Acquisition hrefs of the epub entries, for matching back to remote objects. */
  epubHrefs: Set<string>;
  /** The epub entries with what identifies them, for books not on this device. */
  entries: CatalogEntry[];
}

/** Direct child element by local name (namespace-agnostic), not a descendant —
 *  so a feed-level <title>/<author> isn't confused with an entry's. */
function directChild(parent: Element, localName: string): Element | null {
  for (const c of Array.from(parent.children)) {
    if (c.localName === localName) return c;
  }
  return null;
}

/** Direct children by local name and namespace, as trimmed non-empty text. */
function childTexts(parent: Element, localName: string, ns: string): string[] {
  return Array.from(parent.children)
    .filter((c) => c.localName === localName && c.namespaceURI === ns)
    .map((c) => c.textContent?.trim() ?? '')
    .filter(Boolean);
}

/** What an Atom entry says about its book, in sidecar form: the inverse of
 *  generateOpdsFeed, so an entry carried forward is written back unchanged. */
function entryMeta(entry: Element): CatalogEntryMeta {
  const meta: CatalogEntryMeta = {};
  const title = childTexts(entry, 'title', ATOM_NS)[0];
  if (title) meta.title = title;
  const authors = Array.from(entry.children)
    .filter((c) => c.localName === 'author' && c.namespaceURI === ATOM_NS)
    .map((a) => childTexts(a, 'name', ATOM_NS)[0])
    .filter((n): n is string => !!n);
  if (authors.length) meta.authors = authors;
  const description = childTexts(entry, 'summary', ATOM_NS)[0];
  if (description) meta.description = description;
  const language = childTexts(entry, 'language', DC_NS)[0];
  if (language) meta.language = language;
  const publisher = childTexts(entry, 'publisher', DC_NS)[0];
  if (publisher) meta.publisher = publisher;
  const issued = childTexts(entry, 'issued', DC_NS)[0];
  if (issued) meta.issued = issued;
  const identifier = childTexts(entry, 'identifier', DC_NS)[0];
  if (identifier) meta.identifier = identifier;
  const subjects = Array.from(entry.children)
    .filter((c) => c.localName === 'category' && c.namespaceURI === ATOM_NS)
    .map((c) => c.getAttribute('term')?.trim() ?? '')
    .filter(Boolean);
  if (subjects.length) meta.subjects = subjects;

  const a11y: NonNullable<CatalogEntryMeta['accessibility']> = {};
  const list = (name: string) => {
    const v = childTexts(entry, name, SCHEMA_NS);
    return v.length ? v : undefined;
  };
  const accessMode = list('accessMode');
  if (accessMode) a11y.accessMode = accessMode;
  const sufficient = list('accessModeSufficient');
  if (sufficient) a11y.accessModeSufficient = sufficient;
  const feature = list('accessibilityFeature');
  if (feature) a11y.feature = feature;
  const hazard = list('accessibilityHazard');
  if (hazard) a11y.hazard = hazard;
  const summary = list('accessibilitySummary')?.[0];
  if (summary) a11y.summary = summary;
  const conformsTo = childTexts(entry, 'conformsTo', DC_NS)[0];
  if (conformsTo) a11y.conformsTo = conformsTo;
  const certifiedBy = list('certifiedBy')?.[0];
  if (certifiedBy) a11y.certifiedBy = certifiedBy;
  if (Object.keys(a11y).length) meta.accessibility = a11y;

  const links = Array.from(entry.children).filter(
    (c) => c.localName === 'link' && c.namespaceURI === ATOM_NS,
  );
  const image =
    links.find((l) => l.getAttribute('rel') === 'http://opds-spec.org/image') ??
    links.find((l) => l.getAttribute('rel') === 'http://opds-spec.org/image/thumbnail');
  const imageHref = image?.getAttribute('href')?.trim();
  if (imageHref) meta.thumbnailUrl = imageHref;
  return meta;
}

/**
 * Parse an existing OPDS feed back into its editable identity (the feed-level
 * author name/uri) and the set of epub acquisition hrefs it lists. Used when a
 * remote catalog is clicked to load it into the editor.
 */
export function parseOpdsFeed(xml: string): ParsedOpdsFeed {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const entries: CatalogEntry[] = [];
  for (const entry of Array.from(doc.querySelectorAll('entry'))) {
    const link = Array.from(entry.children).find(
      (c) =>
        c.localName === 'link' &&
        c.getAttribute('type') === 'application/epub+zip',
    );
    const href = link?.getAttribute('href');
    if (!href) continue;
    const meta = entryMeta(entry);
    entries.push({
      href,
      identifier: meta.identifier,
      title: meta.title ?? (directChild(entry, 'title')?.textContent?.trim() || undefined),
      meta,
    });
  }
  const epubHrefs = new Set(entries.map((e) => e.href));

  const root = doc.documentElement;
  const feed = root?.localName === 'feed' ? root : doc.querySelector('feed');
  if (!feed) return { epubHrefs, entries };

  const title = directChild(feed, 'title')?.textContent?.trim();
  const author = directChild(feed, 'author');
  const authorName = author
    ? directChild(author, 'name')?.textContent?.trim()
    : undefined;
  const authorUri = author
    ? directChild(author, 'uri')?.textContent?.trim()
    : undefined;

  return {
    title: title || undefined,
    authorName: authorName || undefined,
    authorUri: authorUri || undefined,
    epubHrefs,
    entries,
  };
}
