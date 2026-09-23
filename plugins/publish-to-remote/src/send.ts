/**
 * Sending a package to a destination: upload it under its own filename
 * (overwriting a same-named file), then, where the destination has a catalog,
 * put the book in it — replacing any older package of the same book in the
 * feed, and creating the feed with every EPUB present if there was none.
 * Both the Send band and the Published shelf go through here.
 */
import { uploadFile } from './remote-ops.js';
import { hasCatalog, loadCatalog, writeCatalog, type CatalogInfo } from './catalog.js';
import { listRemote, identifiersOnRemote, type RemoteListing } from './remote-status.js';
import { announceContentChanged } from './remotes.js';
import { sidecarMap, type LocalPackage } from './local-packages.js';
import type { RemoteConfig } from './types.js';

export interface SendResult {
  success: boolean;
  error?: string;
  /** The destination listed again after the send. */
  listing?: RemoteListing;
  catalog?: CatalogInfo | null;
}

export async function sendPackage(
  remote: RemoteConfig,
  pkg: LocalPackage,
  packages: LocalPackage[],
  onProgress?: (percent: number) => void,
): Promise<SendResult> {
  const upload = await uploadFile(
    remote,
    pkg.name,
    pkg.file,
    'application/epub+zip',
    onProgress,
  );
  if (!upload.success) return { success: false, error: upload.error };

  const listing = await listRemote(remote);
  let catalog: CatalogInfo | null = null;
  if (hasCatalog(remote) && listing.reach === 'ok') {
    catalog = await loadCatalog(remote, listing.objects);
    const epubs = listing.objects.filter((o) => o.key.toLowerCase().endsWith('.epub'));
    const keys = catalog.exists
      ? new Set(catalog.keys)
      : new Set(epubs.map((o) => o.key));
    // The feed lists one package per book: an older package of this book
    // gives way to the one just sent.
    if (pkg.identifier) {
      const ids = identifiersOnRemote(remote, listing.objects, packages, catalog.entries);
      for (const [key, id] of ids) {
        if (id === pkg.identifier && key !== pkg.name) keys.delete(key);
      }
    }
    keys.add(pkg.name);
    const written = await writeCatalog(
      remote,
      listing.objects,
      keys,
      sidecarMap(packages),
      catalog.identity,
      catalog.file,
    );
    if (!written.success) {
      announceContentChanged(remote.id);
      return { success: false, error: written.error, listing, catalog };
    }
    const after = await listRemote(remote);
    announceContentChanged(remote.id);
    return {
      success: true,
      listing: after,
      catalog: after.reach === 'ok' ? await loadCatalog(remote, after.objects) : catalog,
    };
  }
  announceContentChanged(remote.id);
  return { success: true, listing, catalog };
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
    catalog: await loadCatalog(remote, after.reach === 'ok' ? after.objects : listing.objects),
  };
}
