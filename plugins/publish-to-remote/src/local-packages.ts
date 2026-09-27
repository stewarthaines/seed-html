/**
 * The packages on this device: the EPUBs in the shared output directory the
 * host hands over, joined with the sidecars it writes at packaging time
 * (title, authors, dc:identifier, cover thumbnail).
 */
import { readSidecars, pngDataUri } from './opfs.js';
import type { CatalogEntryMeta } from './types.js';

export interface LocalPackage {
  file: File;
  /** The filename, which is also the object key on every destination. */
  name: string;
  size: number;
  /** OPFS write time, ms since the epoch. */
  lastModified: number;
  title?: string;
  authors?: string[];
  identifier?: string;
  /** Inline data: URI of the cover thumbnail, when the sidecar has one. */
  thumbnailUrl?: string;
  /** The sidecar as read, for building catalog entries. */
  meta?: CatalogEntryMeta;
}

/** Every package in the directory, newest first. */
export async function loadLocalPackages(
  dir: FileSystemDirectoryHandle,
): Promise<LocalPackage[]> {
  const files: File[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.epub')) {
      files.push(await (entry as FileSystemFileHandle).getFile());
    }
  }
  const sidecars = await readSidecars(dir);
  const packages = files.map((file): LocalPackage => {
    const meta = sidecars.get(file.name);
    return {
      file,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      title: meta?.title,
      authors: meta?.authors,
      identifier: meta?.identifier,
      thumbnailUrl: meta?.thumbnailBytes
        ? pngDataUri(meta.thumbnailBytes)
        : undefined,
      meta,
    };
  });
  packages.sort((a, b) => b.lastModified - a.lastModified);
  return packages;
}

/** The newest package of one book, or null when it has none. */
export function latestPackageFor(
  packages: LocalPackage[],
  identifier: string | undefined,
): LocalPackage | null {
  if (!identifier) return null;
  return packages.find((p) => p.identifier === identifier) ?? null;
}

/** One package per book (its newest); packages without an identifier each
 *  count as their own book. Keeps the newest-first order. */
export function latestPerBook(packages: LocalPackage[]): LocalPackage[] {
  const seen = new Set<string>();
  const out: LocalPackage[] = [];
  for (const p of packages) {
    if (p.identifier) {
      if (seen.has(p.identifier)) continue;
      seen.add(p.identifier);
    }
    out.push(p);
  }
  return out;
}

/** The sidecar metadata keyed by filename, as the catalog generators want it. */
export function sidecarMap(
  packages: LocalPackage[],
): Map<string, CatalogEntryMeta> {
  const map = new Map<string, CatalogEntryMeta>();
  for (const p of packages) if (p.meta) map.set(p.name, { ...p.meta });
  return map;
}
