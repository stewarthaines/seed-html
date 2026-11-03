/**
 * A destination's OPDS catalog: which file it is, what it says, and how to
 * write it from a set of EPUB keys. The feed on the destination is the truth;
 * the plugin reads it back (every catalog-capable remote can be read) and
 * regenerates the whole file on every change.
 */
import {
  generateOpdsFeed,
  parseOpdsFeed,
  acquisitionUrl,
  defaultCatalogTitle,
  DEFAULT_CATALOG_AUTHOR_NAME,
  DEFAULT_CATALOG_AUTHOR_URI,
  type CatalogIdentity,
  type ParsedOpdsFeed,
} from './opds.js';
import { generateOpds2Feed, parseOpds2Feed, OPDS2_TYPE } from './opds2.js';
import {
  downloadTextFile,
  uploadFile,
  uploadTextFile,
  getPublicUrl,
} from './remote-ops.js';
import { resolveDropboxLinks } from './dropbox-upload.js';
import { feedCache } from './feed-cache.js';
import type {
  CatalogEntry,
  CatalogEntryMeta,
  CatalogRemoteConfig,
  RemoteConfig,
  S3Object,
} from './types.js';

export type CatalogFormat = 'opds1' | 'opds2';

export const DEFAULT_FILE_FOR_FORMAT: Record<CatalogFormat, string> = {
  opds2: 'catalog.json',
  opds1: 'catalog.xml',
};

export const formatForKey = (key: string): CatalogFormat =>
  key.toLowerCase().endsWith('.json') ? 'opds2' : 'opds1';

export function formatLabel(format: CatalogFormat): string {
  return format === 'opds2' ? 'OPDS 2' : 'OPDS 1.2';
}

/** Whether a destination can host a feed at all. */
export function hasCatalog(
  remote: RemoteConfig,
): remote is CatalogRemoteConfig {
  return (
    remote.type === 's3-compatible' ||
    remote.type === 'dropbox' ||
    remote.type === 'webdav'
  );
}

/** What the plugin knows about a destination's catalog after reading it. */
export interface CatalogInfo {
  /** The object key of the feed. */
  file: string;
  format: CatalogFormat;
  feedUrl: string;
  /** False when no feed has been written yet (identity holds the defaults). */
  exists: boolean;
  identity: Required<CatalogIdentity>;
  entries: CatalogEntry[];
  /** Object keys of the EPUBs the feed lists that are on the destination. */
  keys: Set<string>;
  /** Feed hrefs that match no object on the destination any more. */
  missingHrefs: string[];
  lastModified?: string;
  /** The feed is there but could not be read (auth, network): nothing may
   *  be written over it until it can. */
  error?: string;
}

/** Candidate feed filenames: the configured one, else the OPDS 2 default with
 *  the legacy Atom name as a fallback so an older catalog.xml still loads. */
export function catalogFilenamesFor(remote: CatalogRemoteConfig): string[] {
  const configured = remote.catalogFilename?.trim();
  return configured
    ? [configured]
    : [DEFAULT_FILE_FOR_FORMAT.opds2, DEFAULT_FILE_FOR_FORMAT.opds1];
}

/** A catalog is any .xml or .json on the destination: sidecars stay local
 *  (only thumbnails upload), so a remote .json can only be a feed. */
export function isCatalogKey(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.endsWith('.xml') || lower.endsWith('.json');
}

/**
 * Every catalog file on the destination, the destination's own (the
 * configured name, else catalog.json, else catalog.xml) first and the rest
 * by name. A destination can carry several feeds — one per shelf of books —
 * and each is read and written on its own.
 */
export function catalogFilesOn(
  remote: CatalogRemoteConfig,
  objects: S3Object[],
): string[] {
  const present = objects.map((o) => o.key).filter(isCatalogKey);
  const candidates = catalogFilenamesFor(remote);
  const first = candidates.find((c) => present.includes(c));
  const rest = present
    .filter((k) => k !== first)
    .sort((a, b) => a.localeCompare(b));
  return first ? [first, ...rest] : rest;
}

/** A name for a new catalog that is not already on the destination. */
export function unusedCatalogFile(
  objects: S3Object[],
  format: CatalogFormat = 'opds2',
): string {
  const present = new Set(objects.map((o) => o.key));
  const base = DEFAULT_FILE_FOR_FORMAT[format];
  if (!present.has(base)) return base;
  const ext = format === 'opds2' ? '.json' : '.xml';
  for (let n = 2; ; n += 1) {
    const name = `catalog-${n}${ext}`;
    if (!present.has(name)) return name;
  }
}

export function feedUrlFor(remote: CatalogRemoteConfig, file: string): string {
  if (remote.type === 'dropbox') return `https://www.dropbox.com/${file}`;
  return getPublicUrl(remote, file);
}

function parseCatalog(key: string, text: string): ParsedOpdsFeed {
  return formatForKey(key) === 'opds2'
    ? parseOpds2Feed(text)
    : parseOpdsFeed(text);
}

/** The last path segment of a URL, decoded: the filename a link points at. */
export function hrefBasename(href: string): string {
  try {
    const path = new URL(href).pathname;
    return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
  } catch {
    return '';
  }
}

/**
 * Match feed entries back to the objects on the destination: by acquisition
 * URL where the listing knows one, else by the filename the link ends in
 * (a Dropbox listing carries no links until a write resolves them, and a
 * Dropbox link ends in the file's name).
 */
export function keysForEntries(
  remote: RemoteConfig,
  objects: S3Object[],
  entries: CatalogEntry[],
): { keys: Set<string>; missingHrefs: string[] } {
  const { byKey, missingHrefs } = matchEntries(remote, objects, entries);
  return { keys: new Set(byKey.keys()), missingHrefs };
}

/** Each feed entry against the object key it describes (see keysForEntries). */
export function entriesByKey(
  remote: RemoteConfig,
  objects: S3Object[],
  entries: CatalogEntry[],
): Map<string, CatalogEntry> {
  return matchEntries(remote, objects, entries).byKey;
}

function matchEntries(
  remote: RemoteConfig,
  objects: S3Object[],
  entries: CatalogEntry[],
): { byKey: Map<string, CatalogEntry>; missingHrefs: string[] } {
  const byHref = new Map<string, string>();
  const byName = new Set<string>();
  for (const o of objects) {
    if (!o.key.toLowerCase().endsWith('.epub')) continue;
    const url = acquisitionUrl(remote, o);
    if (url) byHref.set(url, o.key);
    byName.add(o.key);
  }
  const byKey = new Map<string, CatalogEntry>();
  const missingHrefs: string[] = [];
  for (const entry of entries) {
    const key = byHref.get(entry.href);
    if (key) {
      byKey.set(key, entry);
      continue;
    }
    const name = hrefBasename(entry.href);
    if (name && byName.has(name)) byKey.set(name, entry);
    else missingHrefs.push(entry.href);
  }
  return { byKey, missingHrefs };
}

/** Read a feed's text, through the cache when the listing gives it a stamp. */
async function feedText(
  remote: CatalogRemoteConfig,
  objects: S3Object[],
  file: string,
): Promise<string | null> {
  const stamp = objects.find((o) => o.key === file)?.lastModified;
  if (!stamp) return downloadTextFile(remote, file);
  return feedCache.text(remote.id, file, stamp, () =>
    downloadTextFile(remote, file),
  );
}

/** The defaults for a feed that does not exist yet. */
export function emptyCatalog(
  remote: CatalogRemoteConfig,
  file: string,
): CatalogInfo {
  return {
    file,
    format: formatForKey(file),
    feedUrl: feedUrlFor(remote, file),
    exists: false,
    identity: {
      title: defaultCatalogTitle(remote),
      authorName: DEFAULT_CATALOG_AUTHOR_NAME,
      authorUri: DEFAULT_CATALOG_AUTHOR_URI,
    },
    entries: [],
    keys: new Set(),
    missingHrefs: [],
  };
}

/**
 * Read one feed on the destination — the named file, else the destination's
 * own. A missing or unreadable feed yields an `exists: false` info with the
 * defaults, never a throw: the shelf still shows and the first write creates
 * the file.
 */
export async function loadCatalog(
  remote: CatalogRemoteConfig,
  objects: S3Object[],
  file?: string,
): Promise<CatalogInfo> {
  const candidates = file ? [file] : catalogFilenamesFor(remote);
  let failure: string | undefined;
  for (const file of candidates) {
    try {
      const text = await feedText(remote, objects, file);
      if (!text) continue;
      const parsed = parseCatalog(file, text);
      const { keys, missingHrefs } = keysForEntries(
        remote,
        objects,
        parsed.entries,
      );
      return {
        file,
        format: formatForKey(file),
        feedUrl: feedUrlFor(remote, file),
        exists: true,
        identity: {
          title: parsed.title || defaultCatalogTitle(remote),
          authorName: parsed.authorName || DEFAULT_CATALOG_AUTHOR_NAME,
          authorUri: parsed.authorUri || DEFAULT_CATALOG_AUTHOR_URI,
        },
        entries: parsed.entries,
        keys,
        missingHrefs,
        lastModified: objects.find((o) => o.key === file)?.lastModified,
      };
    } catch (error) {
      // A read that fails (auth, network) will fail for every candidate;
      // stop here and say so rather than report "no catalog" (a Create
      // would then overwrite it). Only a missing file moves to the next.
      failure = error instanceof Error ? error.message : String(error);
      break;
    }
  }
  const empty = emptyCatalog(remote, candidates[0]);
  return failure ? { ...empty, error: failure } : empty;
}

/**
 * Every feed on the destination, its own first. A destination with no feed
 * yet yields one `exists: false` catalog so there is something to create.
 */
export async function loadCatalogs(
  remote: CatalogRemoteConfig,
  objects: S3Object[],
): Promise<CatalogInfo[]> {
  const files = catalogFilesOn(remote, objects);
  if (files.length === 0) return [await loadCatalog(remote, objects)];
  return Promise.all(files.map((file) => loadCatalog(remote, objects, file)));
}

/**
 * Write the feed listing `keys`. The destination is a shelf several browsers
 * send to, and each owns only the books it packaged (process/DECISIONS.md,
 * 2026-11-03):
 *
 * - a book with a sidecar here is described from the sidecar, its cover
 *   uploaded beside the EPUB (always: a regenerated cover must replace the old);
 * - any other book keeps what the feed already says (`feedEntries`, the feed as
 *   read), so a browser that never packaged it does not flatten it to a
 *   filename;
 * - a book still without a cover links the `<base>.thumb.png` beside its EPUB
 *   when the destination has one.
 */
export async function writeCatalog(
  remote: CatalogRemoteConfig,
  objects: S3Object[],
  keys: Set<string>,
  sidecars: Map<string, CatalogEntryMeta>,
  identity: CatalogIdentity,
  file: string,
  feedEntries: CatalogEntry[],
): Promise<{ success: boolean; url?: string; error?: string }> {
  const format = formatForKey(file);
  const feedUrl = feedUrlFor(remote, file);
  const present = new Set(objects.map((o) => o.key));
  const fromFeed = entriesByKey(remote, objects, feedEntries);
  // A Dropbox feed links to shared URLs: look them up now, only for the
  // books and thumbnails the feed will carry.
  if (remote.type === 'dropbox') {
    const linked = [...keys].flatMap((k) => [
      k,
      `${k.replace(/\.epub$/i, '')}.thumb.png`,
    ]);
    objects = await resolveDropboxLinks(remote, objects, linked);
  }
  const metaByKey = new Map<string, CatalogEntryMeta>();
  for (const key of keys) {
    if (!present.has(key)) continue;
    const thumbKey = `${key.replace(/\.epub$/i, '')}.thumb.png`;
    const sidecar = sidecars.get(key);
    let entry: CatalogEntryMeta;
    if (sidecar) {
      entry = { ...sidecar };
      if (entry.thumbnailBytes) {
        // Host the thumbnail so readers can show it (most ignore data: URIs).
        const blob = new Blob([entry.thumbnailBytes], { type: 'image/png' });
        const res = await uploadFile(remote, thumbKey, blob, 'image/png');
        if (res.success)
          entry.thumbnailUrl = res.url || getPublicUrl(remote, thumbKey);
      }
      delete entry.thumbnailBytes;
    } else {
      entry = { ...(fromFeed.get(key)?.meta ?? {}) };
    }
    if (!entry.thumbnailUrl) {
      const thumb = objects.find((o) => o.key === thumbKey);
      const url = thumb ? getPublicUrl(remote, thumbKey, thumb.fileId) : '';
      if (url) entry.thumbnailUrl = url;
    }
    if (Object.keys(entry).length) metaByKey.set(key, entry);
  }
  const generate = format === 'opds2' ? generateOpds2Feed : generateOpdsFeed;
  const body = generate(remote, objects, feedUrl, metaByKey, keys, identity);
  const contentType =
    format === 'opds2'
      ? OPDS2_TYPE
      : 'application/atom+xml;profile=opds-catalog;kind=acquisition';
  return uploadTextFile(remote, file, body, contentType);
}
