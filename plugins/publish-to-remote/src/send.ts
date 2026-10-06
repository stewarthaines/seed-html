/**
 * Sending a package to a destination: upload it under its own filename
 * (overwriting a same-named file), then keep the destination's catalogs
 * right. An update rewrites every feed that already lists the book, the new
 * package replacing the old, and touches no other; a first send goes into
 * the destination's first feed, or creates its own feed with every EPUB
 * present when it has none. Both the Send band and the Published shelf go
 * through here.
 */
import { uploadFile } from './remote-ops.js';
import { hasCatalog, loadCatalog, loadCatalogs, writeCatalog, type CatalogInfo } from './catalog.js';
import { listRemote, identifiersOnRemote, type RemoteListing } from './remote-status.js';
import { announceContentChanged } from './remotes.js';
import { sidecarMap, type LocalPackage } from './local-packages.js';
import type { RemoteConfig } from './types.js';

export interface SendResult {
  success: boolean;
  error?: string;
  /** The destination listed again after the send. */
  listing?: RemoteListing;
  /** Every feed on the destination after the send; when one could not be
   *  read, the feeds as read, with nothing written. */
  catalogs?: CatalogInfo[];
}

/** One feed to rewrite, and the keys it is to list. */
export interface CatalogWrite {
  catalog: CatalogInfo;
  keys: Set<string>;
}

/**
 * Which feeds a send rewrites, and with what. Pure: `catalogs` are every feed
 * on the destination as read after the upload (own first), `bookKeys` the
 * keys of every package of this book on the destination (the one just sent
 * included), `firstSend` whether none of them was there before the upload,
 * and `epubKeys` every EPUB on the destination.
 */
export function catalogWritesForSend(
  catalogs: CatalogInfo[],
  bookKeys: Set<string>,
  identifier: string | undefined,
  pkgName: string,
  firstSend: boolean,
  epubKeys: string[],
): CatalogWrite[] {
  const existing = catalogs.filter((c) => c.exists);
  if (firstSend) {
    if (existing.length > 0) {
      const first = existing[0];
      return [{ catalog: first, keys: new Set([...first.keys, pkgName]) }];
    }
    // No feed on the destination yet: create its own with every EPUB.
    if (catalogs.length === 0) return [];
    return [{ catalog: catalogs[0], keys: new Set([...epubKeys, pkgName]) }];
  }
  // An update: the feeds that list the book (by key, or by identifier for an
  // entry whose package has gone) carry the new package in place of the old;
  // a book switched out of every feed stays out.
  return existing
    .filter(
      (c) =>
        [...c.keys].some((k) => bookKeys.has(k)) ||
        (!!identifier && c.entries.some((e) => e.identifier === identifier)),
    )
    .map((c) => {
      const keys = new Set([...c.keys].filter((k) => !bookKeys.has(k)));
      keys.add(pkgName);
      return { catalog: c, keys };
    });
}

const isEpub = (key: string) => key.toLowerCase().endsWith('.epub');

export async function sendPackage(
  remote: RemoteConfig,
  pkg: LocalPackage,
  packages: LocalPackage[],
  onProgress?: (percent: number) => void,
  /** The destination as last listed, if the caller has it: whether the book
   *  was already there decides between an update and a first send. */
  previous?: RemoteListing | null,
): Promise<SendResult> {
  const catalogCapable = hasCatalog(remote);
  const before =
    catalogCapable && previous?.reach !== 'ok' ? await listRemote(remote) : previous;

  const upload = await uploadFile(
    remote,
    pkg.name,
    pkg.file,
    'application/epub+zip',
    onProgress,
  );
  if (!upload.success) return { success: false, error: upload.error };

  const listing = await listRemote(remote);
  if (!catalogCapable || listing.reach !== 'ok') {
    announceContentChanged(remote.id);
    return { success: true, listing };
  }

  const catalogs = await loadCatalogs(remote, listing.objects);
  if (catalogs.some((c) => c.error)) {
    // A feed is there but unreadable: the book is sent, and no feed is
    // written, since which of them hold the book cannot be known.
    announceContentChanged(remote.id);
    return { success: true, listing, catalogs };
  }

  const bookKeys = new Set([pkg.name]);
  if (pkg.identifier) {
    const entries = catalogs.flatMap((c) => c.entries);
    const ids = identifiersOnRemote(remote, listing.objects, packages, entries);
    for (const [key, id] of ids) if (id === pkg.identifier) bookKeys.add(key);
  }
  // Without a listing from before the upload, the book counts as already
  // there: an update writes only feeds that hold it, the safer mistake.
  const firstSend =
    before?.reach === 'ok' && !before.objects.some((o) => bookKeys.has(o.key));
  const epubKeys = listing.objects.map((o) => o.key).filter(isEpub);
  const writes = catalogWritesForSend(
    catalogs,
    bookKeys,
    pkg.identifier,
    pkg.name,
    firstSend,
    epubKeys,
  );

  const sidecars = sidecarMap(packages);
  for (const { catalog, keys } of writes) {
    const written = await writeCatalog(
      remote,
      listing.objects,
      keys,
      sidecars,
      catalog.identity,
      catalog.file,
    );
    if (!written.success) {
      announceContentChanged(remote.id);
      return { success: false, error: written.error, listing, catalogs };
    }
  }
  if (writes.length === 0) {
    announceContentChanged(remote.id);
    return { success: true, listing, catalogs };
  }
  const after = await listRemote(remote);
  announceContentChanged(remote.id);
  return {
    success: true,
    listing: after,
    catalogs: after.reach === 'ok' ? await loadCatalogs(remote, after.objects) : catalogs,
  };
}

/** Put a book on a destination into, or take it out of, the catalog. */
export async function setInCatalog(
  remote: RemoteConfig,
  listing: RemoteListing,
  catalog: CatalogInfo,
  keysOfBook: string[],
  include: boolean,
  packages: LocalPackage[],
): Promise<{ success: boolean; error?: string; catalog?: CatalogInfo }> {
  if (!hasCatalog(remote)) return { success: false, error: 'No catalog' };
  const keys = new Set(catalog.keys);
  for (const key of keysOfBook) {
    if (include) keys.add(key);
    else keys.delete(key);
  }
  const written = await writeCatalog(
    remote,
    listing.objects,
    keys,
    sidecarMap(packages),
    catalog.identity,
    catalog.file,
  );
  announceContentChanged(remote.id);
  if (!written.success) return { success: false, error: written.error };
  const after = await listRemote(remote);
  return {
    success: true,
    catalog: await loadCatalog(remote, after.reach === 'ok' ? after.objects : listing.objects, catalog.file),
  };
}
