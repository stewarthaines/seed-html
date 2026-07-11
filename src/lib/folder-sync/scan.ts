/**
 * Folder scan → sync plan (see process/FOLDER_SYNC.md).
 *
 * Reads the top level of the linked directory, applies the eligibility filter,
 * and diffs against the workspace's chapters. Matching follows the import
 * flow exactly — `sanitizeChapterId(filename)` → manifest id, source text at
 * SOURCE/text/<id>.txt — so a re-sync updates the same chapter a manual
 * import of the same file would.
 *
 * Ordering contract (design decision, 2026-07-10 review): spine order is
 * authoritative — the folder owns content, the app owns structure. The plan
 * never reorders; new chapters are appended, natural-sorted among themselves.
 *
 * `buildFolderSyncPlan` is pure (pre-read inputs); `scanSyncFolder` is the
 * thin directory-reading wrapper. Both are UI-free so phase 3 can feed the
 * review dialog directly.
 */

import { sanitizeChapterId } from '../import/collision.js';

/** Extensions the chapter import accepts today — the sync default. */
export const DEFAULT_SYNC_EXTENSIONS = ['.txt', '.md', '.markdown'];

export type SkipReason = 'extension' | 'hidden' | 'sidecar' | 'directory';

export type FolderSyncRow =
  /** New chapter from a folder file with no matching chapter id. */
  | {
      kind: 'add';
      name: string;
      targetId: string;
      incoming: string;
      /** Set when the generated id collides with a non-chapter manifest item —
          resolutions are keep-both/skip, never overwrite. */
      collision: string | null;
    }
  /** Folder file matching an existing chapter, with different content. */
  | { kind: 'update'; name: string; targetId: string; incoming: string; current: string }
  /** Chapter with no folder counterpart — reviewable, defaults to skip. */
  | { kind: 'remove'; name: string; targetId: string; current: string | null }
  /** Ineligible directory entry, listed so "why isn't my file a chapter?"
      answers itself. */
  | { kind: 'skipped'; name: string; reason: SkipReason };

export interface FolderSyncPlan {
  /** Updates (folder order), then adds (natural-sorted), then removes (spine
      order), then skipped entries. */
  rows: FolderSyncRow[];
  /** Matched files whose content is identical — no row, just the count for
      the "everything up to date" state. */
  unchangedCount: number;
}

/** Numeric-aware order so `2-title.md` precedes `10-epilogue.md`. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Why a directory entry is ineligible, or null when it should sync.
 * AppleDouble sidecars are matched before the general hidden rule so the skip
 * reason names the real cause (same junk the device file list filters).
 */
export function skipReasonFor(
  name: string,
  extensions: readonly string[] = DEFAULT_SYNC_EXTENSIONS
): SkipReason | null {
  if (name.startsWith('._')) return 'sidecar';
  if (name.startsWith('.')) return 'hidden';
  const lower = name.toLowerCase();
  if (!extensions.some(ext => lower.endsWith(ext))) return 'extension';
  return null;
}

export interface FolderFileInput {
  name: string;
  text: string;
}

export interface BuildPlanInput {
  /** Eligible folder files, already read. */
  files: FolderFileInput[];
  /** Ineligible entries (with reasons), for the skipped list. */
  skipped: { name: string; reason: SkipReason }[];
  /** Chapter ids in spine order. */
  spineIds: string[];
  /** All manifest ids (collision detection against non-chapter items). */
  manifestIds: string[];
  /** Existing SOURCE text for a chapter id; null when it has no source file. */
  sources: Map<string, string | null>;
}

export function buildFolderSyncPlan(input: BuildPlanInput): FolderSyncPlan {
  const spineIdSet = new Set(input.spineIds);
  const manifestIdSet = new Set(input.manifestIds);

  const updates: FolderSyncRow[] = [];
  const adds: FolderSyncRow[] = [];
  let unchangedCount = 0;
  const matchedIds = new Set<string>();

  for (const file of [...input.files].sort((a, b) => naturalCompare(a.name, b.name))) {
    const targetId = sanitizeChapterId(file.name);
    if (spineIdSet.has(targetId)) {
      matchedIds.add(targetId);
      const current = input.sources.get(targetId) ?? null;
      if (current !== null && current === file.text) {
        unchangedCount += 1;
      } else {
        // No readable source (read-only chapter) diffs against empty, like import.
        updates.push({
          kind: 'update',
          name: file.name,
          targetId,
          incoming: file.text,
          current: current ?? '',
        });
      }
    } else {
      adds.push({
        kind: 'add',
        name: file.name,
        targetId,
        incoming: file.text,
        collision: manifestIdSet.has(targetId) ? targetId : null,
      });
    }
  }

  // Chapters with no folder counterpart — spine order, reviewable, default skip.
  const removes: FolderSyncRow[] = input.spineIds
    .filter(id => !matchedIds.has(id))
    .map(id => ({
      kind: 'remove',
      name: id,
      targetId: id,
      current: input.sources.get(id) ?? null,
    }));

  const skipped: FolderSyncRow[] = [...input.skipped]
    .sort((a, b) => naturalCompare(a.name, b.name))
    .map(entry => ({ kind: 'skipped', ...entry }));

  return { rows: [...updates, ...adds, ...removes, ...skipped], unchangedCount };
}

export interface ScanOptions {
  dir: FileSystemDirectoryHandle;
  /** Chapter ids in spine order. */
  spineIds: string[];
  /** All manifest ids. */
  manifestIds: string[];
  /** Existing SOURCE text for a chapter id; null when unreadable/absent. */
  readSource: (chapterId: string) => Promise<string | null>;
  extensions?: readonly string[];
}

/**
 * Read the linked directory (top level only, no recursion) and build the sync
 * plan. File bytes are read only for eligible files; existing sources only
 * for spine chapters (matched diffs and remove-row previews).
 */
export async function scanSyncFolder(options: ScanOptions): Promise<FolderSyncPlan> {
  const extensions = options.extensions ?? DEFAULT_SYNC_EXTENSIONS;
  const files: FolderFileInput[] = [];
  const skipped: { name: string; reason: SkipReason }[] = [];

  for await (const [name, handle] of options.dir.entries()) {
    if (handle.kind === 'directory') {
      skipped.push({ name, reason: 'directory' });
      continue;
    }
    const reason = skipReasonFor(name, extensions);
    if (reason) {
      skipped.push({ name, reason });
      continue;
    }
    const file = await (handle as FileSystemFileHandle).getFile();
    files.push({ name, text: await file.text() });
  }

  const sources = new Map<string, string | null>();
  for (const id of options.spineIds) {
    sources.set(id, await options.readSource(id));
  }

  return buildFolderSyncPlan({
    files,
    skipped,
    spineIds: options.spineIds,
    manifestIds: options.manifestIds,
    sources,
  });
}
