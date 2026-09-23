/**
 * Listing a destination with its reachability named, and the pure derivations
 * the surfaces render: what one book's latest package is doing on a
 * destination (the Send row), and everything on a destination as a shelf
 * (the Published page).
 */
import { listFiles, getThumbnailUrl } from './remote-ops.js';
import {
  DEVICE_RECONNECT_REQUIRED,
  DEVICE_NOT_CONNECTED,
} from './device-upload.js';
import { acquisitionUrl } from './opds.js';
import { latestPackageFor, latestPerBook, type LocalPackage } from './local-packages.js';
import type { CatalogEntry, RemoteConfig, S3Object } from './types.js';

/** Why a destination could not be listed, or `ok`. */
export type Reach = 'ok' | 'sign-in' | 'reconnect' | 'unplugged' | 'error';

export interface RemoteListing {
  reach: Reach;
  objects: S3Object[];
  error?: string;
}

export async function listRemote(remote: RemoteConfig): Promise<RemoteListing> {
  const result = await listFiles(remote);
  if (!result.error) return { reach: 'ok', objects: result.objects };
  if (result.error === 'GOOGLE_AUTH_REQUIRED')
    return { reach: 'sign-in', objects: [] };
  if (result.error === DEVICE_RECONNECT_REQUIRED)
    return { reach: 'reconnect', objects: [] };
  if (result.error === DEVICE_NOT_CONNECTED)
    return { reach: 'unplugged', objects: [] };
  return { reach: 'error', objects: [], error: result.error };
}

/** The short kind label shown in a destination's badge. */
export function typeLabel(remote: RemoteConfig): string {
  switch (remote.type) {
    case 's3-compatible':
      return 'S3';
    case 'google-drive':
      return 'Drive';
    case 'dropbox':
      return 'Dropbox';
    case 'webdav':
      return 'WebDAV';
    case 'device':
      return 'USB';
  }
}

const isEpub = (key: string) => key.toLowerCase().endsWith('.epub');

/**
 * The identifier of each EPUB on a destination, from the local sidecar of the
 * same filename or from the catalog entry with the same acquisition URL.
 */
export function identifiersOnRemote(
  remote: RemoteConfig,
  objects: S3Object[],
  packages: LocalPackage[],
  entries: CatalogEntry[],
): Map<string, string> {
  const byName = new Map(packages.map((p) => [p.name, p]));
  const byHref = new Map(entries.map((e) => [e.href, e]));
  const out = new Map<string, string>();
  for (const o of objects) {
    if (!isEpub(o.key)) continue;
    const identifier =
      byName.get(o.key)?.identifier ??
      byHref.get(acquisitionUrl(remote, o))?.identifier;
    if (identifier) out.set(o.key, identifier);
  }
  return out;
}

/** What the open book's latest package is doing on one destination. */
export type SendState =
  | { kind: 'not-sent' }
  | { kind: 'current'; key: string; sentAt: string }
  | { kind: 'newer-here'; key: string; sentAt: string };

export function sendStateFor(
  remote: RemoteConfig,
  objects: S3Object[],
  packages: LocalPackage[],
  entries: CatalogEntry[],
  identifier: string | undefined,
): SendState {
  if (!identifier) return { kind: 'not-sent' };
  const latest = latestPackageFor(packages, identifier);
  const ids = identifiersOnRemote(remote, objects, packages, entries);
  const mine = objects.filter((o) => ids.get(o.key) === identifier);
  if (mine.length === 0) return { kind: 'not-sent' };
  const sent = latest ? mine.find((o) => o.key === latest.name) : undefined;
  if (
    latest &&
    sent &&
    new Date(sent.lastModified).getTime() + 1000 >= latest.lastModified
  ) {
    return { kind: 'current', key: sent.key, sentAt: sent.lastModified };
  }
  const newest = [...mine].sort(
    (a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
  )[0];
  return { kind: 'newer-here', key: newest.key, sentAt: newest.lastModified };
}

/** One EPUB on a destination, as the Published shelf shows it. */
export interface ShelfBook {
  key: string;
  fileId?: string;
  title: string;
  identifier?: string;
  thumbnailUrl?: string;
  size: number;
  sentAt: string;
  /** A project with this identifier exists on this device. */
  known: boolean;
  /** Known here: whether this file is the newest package of that book. */
  latest: boolean;
  inCatalog: boolean;
}

export interface Shelf {
  onDestination: ShelfBook[];
  /** Packages on this device (newest per book) with nothing on the destination. */
  notSent: LocalPackage[];
}

export function shelfFor(
  remote: RemoteConfig,
  objects: S3Object[],
  packages: LocalPackage[],
  entries: CatalogEntry[],
  catalogKeys: Set<string>,
  knownIdentifiers: Set<string>,
): Shelf {
  const byName = new Map(packages.map((p) => [p.name, p]));
  const byHref = new Map(entries.map((e) => [e.href, e]));
  const byKey = new Map(objects.map((o) => [o.key, o]));
  const ids = identifiersOnRemote(remote, objects, packages, entries);

  const onDestination: ShelfBook[] = objects
    .filter((o) => isEpub(o.key))
    .map((o) => {
      const local = byName.get(o.key);
      const entry = byHref.get(acquisitionUrl(remote, o));
      const identifier = ids.get(o.key);
      const known = !!identifier && knownIdentifiers.has(identifier);
      const latest =
        known && latestPackageFor(packages, identifier)?.name === o.key;
      // The cover: the thumbnail hosted beside the EPUB (cache-busted by its
      // write time so a new cover shows), else the local sidecar's.
      const thumbKey = o.key.replace(/\.epub$/i, '.thumb.png');
      const remoteThumb = byKey.get(thumbKey);
      let thumbnailUrl = local?.thumbnailUrl;
      if (remoteThumb && remote.type !== 'device') {
        const url = getThumbnailUrl(remote, thumbKey, remoteThumb.fileId);
        thumbnailUrl =
          url +
          (url.includes('?') ? '&' : '?') +
          'v=' +
          encodeURIComponent(remoteThumb.lastModified);
      }
      return {
        key: o.key,
        fileId: o.fileId,
        title: local?.title || entry?.title || o.key.replace(/\.epub$/i, ''),
        identifier,
        thumbnailUrl,
        size: o.size,
        sentAt: o.lastModified,
        known,
        latest,
        inCatalog: catalogKeys.has(o.key),
      };
    })
    .sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
    );

  const sentIdentifiers = new Set(ids.values());
  const sentKeys = new Set(onDestination.map((b) => b.key));
  const notSent = latestPerBook(packages).filter(
    (p) =>
      !sentKeys.has(p.name) &&
      !(p.identifier && sentIdentifiers.has(p.identifier)),
  );
  return { onDestination, notSent };
}
