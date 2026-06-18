/**
 * Saved OPDS feeds — an auto-maintained history of catalog URLs the user has
 * fetched, persisted in localStorage. Each entry is keyed by URL and labelled
 * with the feed's <title> (captured on fetch), most-recently-used first.
 */

export interface SavedFeed {
  url: string;
  /** The feed's atom:title, when known; used as the display label. */
  title?: string;
}

const STORAGE_KEY = 'editme_opds_feeds';
const SELECTED_KEY = 'editme_opds_selected_feed';

/**
 * The built-in catalogs pinned to the top of the feed list. They are not
 * persisted to localStorage and cannot be removed, so the import dialog always
 * offers a starting point even before the user has saved any of their own feeds.
 * The first entry is the default selection. Their titles are fixed labels and
 * deliberately override whatever <title> the feed XML carries.
 */
export const DEFAULT_CATALOG_FEEDS: SavedFeed[] = [
  {
    url: 'https://sample.readitinabook.com/catalog.xml',
    title: 'Essential Samples',
  },
  {
    url: 'https://sample.readitinabook.com/extras.xml',
    title: 'Extra Samples',
  },
];

const BUILTIN_FEED_URLS = new Set(DEFAULT_CATALOG_FEEDS.map(f => f.url));

/** Whether a URL is one of the pinned built-in catalogs (never persisted/removable). */
export function isBuiltinFeed(url: string): boolean {
  return BUILTIN_FEED_URLS.has(url.trim());
}

/** Load the saved feeds (most-recent first). Returns [] on any error. */
export function loadSavedFeeds(): SavedFeed[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f): f is SavedFeed => !!f && typeof f.url === 'string')
      .map(f => ({ url: f.url, title: typeof f.title === 'string' ? f.title : undefined }));
  } catch {
    return [];
  }
}

/**
 * Insert or update a feed, moving it to the front (most-recent). A provided
 * title replaces the stored one; otherwise the existing title is kept.
 */
export function upsertSavedFeed(url: string, title?: string): SavedFeed[] {
  const trimmed = url.trim();
  if (!trimmed) return loadSavedFeeds();

  const current = loadSavedFeeds();
  const existing = current.find(f => f.url === trimmed);
  const rest = current.filter(f => f.url !== trimmed);
  const entry: SavedFeed = { url: trimmed, title: title ?? existing?.title };
  return persist([entry, ...rest]);
}

/** Remove the feed with the given URL. */
export function removeSavedFeed(url: string): SavedFeed[] {
  return persist(loadSavedFeeds().filter(f => f.url !== url));
}

/**
 * The URL of the feed the user last loaded, so the import dialog re-opens on the
 * same selection instead of resetting. Returns null when nothing is remembered.
 */
export function loadSelectedFeedUrl(): string | null {
  try {
    const v = localStorage.getItem(SELECTED_KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

/** Remember the currently-selected feed URL (best-effort). */
export function saveSelectedFeedUrl(url: string): void {
  try {
    const trimmed = url.trim();
    if (trimmed) localStorage.setItem(SELECTED_KEY, trimmed);
  } catch {
    // Persistence is best-effort.
  }
}

function persist(feeds: SavedFeed[]): SavedFeed[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(feeds));
  } catch {
    // Persistence is best-effort.
  }
  return feeds;
}
