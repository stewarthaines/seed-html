/**
 * Transform broker — path scoping for the capability API exposed to transform
 * scripts (see TransformEngine's BROKER_REQUEST handling).
 *
 * Transform scripts run sandboxed in the iframe and cannot touch storage
 * directly; instead they call the `ctx.readManifest…`/`ctx.readSource…`/
 * `ctx.writeSource…` methods, which post a request to the parent. The parent
 * performs the I/O through the path-based FileStorageAPI — but ONLY after these
 * helpers have scoped the request:
 *
 *   - manifest reads are limited to items actually declared in the OPF manifest
 *     (a script can't read an arbitrary workspace path by guessing an href);
 *   - source reads are limited to the project's `SOURCE/` tree;
 *   - source writes are limited to `SOURCE/data/` so a script can persist derived
 *     data without clobbering `settings.json`, transform scripts, or extensions.
 *
 * All of these are pure string functions so they can be unit-tested without a
 * storage backend.
 */

import type { ManifestItem } from '../epub/opf-utils.js';
import { validateSourcePath } from '../source/source-utils.js';

/** Sub-tree of SOURCE/ that transform scripts may write into. */
export const SOURCE_DATA_PREFIX = 'SOURCE/data/';

/**
 * Join an OPF-relative manifest href onto the content base path, mirroring
 * WorkspaceService/BlobURLManager path resolution (idempotent if already joined).
 */
export function joinBasePath(basePath: string, href: string): string {
  if (!basePath || href.startsWith(`${basePath}/`)) return href;
  return `${basePath}/${href}`;
}

/**
 * Resolve a manifest href to its storage path, but only if it's a declared
 * manifest item. Returns null otherwise — this is the read-scoping guarantee.
 */
export function resolveManifestStoragePath(
  manifest: ManifestItem[],
  basePath: string,
  href: string
): string | null {
  const item = manifest.find(m => m.href === href);
  if (!item) return null;
  return joinBasePath(basePath, href);
}

/** Media type of a declared manifest item, for building a data: URL. */
export function manifestMediaType(manifest: ManifestItem[], href: string): string {
  return manifest.find(m => m.href === href)?.mediaType || 'application/octet-stream';
}

/**
 * Resolve a script-supplied path for READING from SOURCE/. Accepts either a
 * `SOURCE/`-prefixed path or one relative to it; rejects anything that escapes
 * SOURCE/ (validateSourcePath blocks traversal/absolute paths). Returns null if
 * invalid.
 */
export function resolveSourceReadPath(path: string): string | null {
  if (!path || typeof path !== 'string') return null;
  const full = path.startsWith('SOURCE/') ? path : `SOURCE/${path}`;
  return validateSourcePath(full) ? full : null;
}

/**
 * Resolve a script-supplied path for WRITING. Scoped to SOURCE/data/: a bare
 * path lands under SOURCE/data/, and an explicit path must already be under it.
 * Returns null for anything outside SOURCE/data/ or for an invalid path.
 */
export function resolveSourceWritePath(path: string): string | null {
  if (!path || typeof path !== 'string') return null;
  const full = path.startsWith('SOURCE/') ? path : `${SOURCE_DATA_PREFIX}${path}`;
  if (!full.startsWith(SOURCE_DATA_PREFIX)) return null;
  return validateSourcePath(full) ? full : null;
}
