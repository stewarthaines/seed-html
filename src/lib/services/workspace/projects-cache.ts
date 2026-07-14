/**
 * Persistent backing for the Projects-list cache.
 *
 * WorkspaceService keeps an in-memory `summaryCache` validated by the OPF's
 * mtime; this module persists the same derived data (plus a small cover
 * thumbnail) to localStorage so a page reload doesn't pay the per-project
 * directory walks and cover reads again. One key per workspace keeps writes
 * O(entry) during the row fan-out, lets invalidation delete a single key, and
 * isolates corruption. All storage access is best-effort: a corrupt or
 * unwritable entry is simply a cache miss, never an error.
 */

const PROJECTS_CACHE_PREFIX = 'seedhtml_projcache_';

// v2: cover thumbnails rendered at 256px / JPEG for the full-height project card
// (v1 thumbs were 128px PNG — too soft at the new display size).
const ENTRY_VERSION = 2;

/** Thumbnails above this many characters (~48KB of base64) are not persisted. */
export const MAX_THUMB_CHARS = 64_000;

/** Approximate total budget for all entries; thumbs are stripped over this. */
export const TOTAL_BUDGET_CHARS = 3_000_000;

export interface ProjectsCacheEntry {
  v: 2;
  opfMtime: number;
  /** Serializable WorkspaceInfo subset (lastModified as epoch ms). */
  info?: {
    title: string;
    language: string;
    lastModified: number;
    author?: string;
    authors?: string[];
    description?: string;
    date?: string;
  };
  /** Mirrors the service's CachedRowMeta. */
  rowMeta?: {
    fileCount: number;
    extensionIds?: string[];
    readOnly: boolean;
    cover?: { path: string; mediaType: string };
  };
  /** Small PNG data URL for the project card; size-guarded. */
  thumb?: string;
}

export function cacheKey(id: string): string {
  return `${PROJECTS_CACHE_PREFIX}${id}`;
}

/** An entry is usable only while the OPF it was derived from is unchanged. */
export function entryFreshFor(entry: ProjectsCacheEntry, opfMtime: number): boolean {
  return opfMtime !== 0 && entry.opfMtime === opfMtime;
}

/**
 * Read a workspace's entry. Anything unusable (bad JSON, wrong version, wrong
 * shape) removes the key and reads as a miss, so the cache self-heals.
 */
export function readEntry(id: string): ProjectsCacheEntry | null {
  try {
    const raw = localStorage.getItem(cacheKey(id));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as ProjectsCacheEntry).v === ENTRY_VERSION &&
      typeof (parsed as ProjectsCacheEntry).opfMtime === 'number'
    ) {
      return parsed as ProjectsCacheEntry;
    }
    localStorage.removeItem(cacheKey(id));
    return null;
  } catch {
    try {
      localStorage.removeItem(cacheKey(id));
    } catch {
      /* storage unavailable — nothing to heal */
    }
    return null;
  }
}

/**
 * Write a workspace's entry. Oversized thumbnails are dropped rather than
 * stored; a quota error retries once without the thumbnail, then gives up.
 */
export function writeEntry(id: string, entry: ProjectsCacheEntry): void {
  const guarded =
    entry.thumb && entry.thumb.length > MAX_THUMB_CHARS ? { ...entry, thumb: undefined } : entry;
  try {
    localStorage.setItem(cacheKey(id), JSON.stringify(guarded));
  } catch {
    if (guarded.thumb === undefined) return;
    try {
      localStorage.setItem(cacheKey(id), JSON.stringify({ ...guarded, thumb: undefined }));
    } catch {
      /* persistence is best-effort */
    }
  }
}

export function removeEntry(id: string): void {
  try {
    localStorage.removeItem(cacheKey(id));
  } catch {
    /* persistence is best-effort */
  }
}

/**
 * Housekeeping, called from listWorkspaces: drop entries for workspaces that
 * no longer exist, then if the surviving entries exceed the total budget,
 * strip thumbnails (largest first) until under it.
 */
export function pruneEntries(liveIds: string[]): void {
  try {
    const live = new Set(liveIds.map(cacheKey));
    const kept: { key: string; raw: string }[] = [];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PROJECTS_CACHE_PREFIX)) continue;
      if (!live.has(key)) {
        localStorage.removeItem(key);
      } else {
        const raw = localStorage.getItem(key);
        if (raw !== null) kept.push({ key, raw });
      }
    }

    let total = kept.reduce((sum, e) => sum + e.raw.length, 0);
    if (total <= TOTAL_BUDGET_CHARS) return;

    const withThumbs = kept
      .map(e => {
        try {
          return { ...e, entry: JSON.parse(e.raw) as ProjectsCacheEntry };
        } catch {
          return null;
        }
      })
      .filter((e): e is { key: string; raw: string; entry: ProjectsCacheEntry } => !!e?.entry.thumb)
      .sort((a, b) => b.raw.length - a.raw.length);

    for (const e of withThumbs) {
      if (total <= TOTAL_BUDGET_CHARS) break;
      const stripped = JSON.stringify({ ...e.entry, thumb: undefined });
      localStorage.setItem(e.key, stripped);
      total -= e.raw.length - stripped.length;
    }
  } catch {
    /* housekeeping is best-effort */
  }
}
