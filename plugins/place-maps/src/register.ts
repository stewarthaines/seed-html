/**
 * The place register at SOURCE/plugins/place-maps/places.json — the contract
 * family-history reads (process/PLACE_MAPS.md). Keyed by the place string as
 * written; an entry is a located place with its map, or an alias of one.
 * Pure functions only, so they are unit-tested from the app's test suite.
 */

export const REGISTER_PATH = 'SOURCE/plugins/place-maps/places.json';
export const PLACES_DIR = 'SOURCE/data/places';
export const DEFAULT_TEMPLATE = ':map:{place="<place>"}';

export interface PlaceEntry {
  /** The full resolved place, e.g. "Ballarat, Victoria, Australia". */
  name: string;
  /** Absent for a country-and-state entry (its map has no dot). */
  lat?: number;
  lon?: number;
  /** Who resolved it and when, e.g. "nominatim 2026-11-09" or "author 2026-11-09". */
  source: string;
  /** ISO 3166 alpha-3 code, as in the outline data. */
  country: string;
  /** The state, province or (in the UK) nation tinted on the map. */
  region?: string;
  /** Manifest href of the map file, e.g. "Images/maps/ballarat.svg". */
  href: string;
}

export interface AliasEntry {
  alias: string;
}

export interface Register {
  version: 1;
  places: Record<string, PlaceEntry | AliasEntry>;
}

/** A place string the book uses, with who/what uses it. */
export interface PlaceUse {
  text: string;
  labels: string[];
  chapters: string[];
}

export function emptyRegister(): Register {
  return { version: 1, places: {} };
}

/** Parse the stored register, tolerating a missing or malformed file. */
export function parseRegister(text: string | null): Register {
  if (!text) return emptyRegister();
  try {
    const data = JSON.parse(text);
    if (data && typeof data === 'object' && data.places && typeof data.places === 'object') {
      return { version: 1, places: data.places };
    }
  } catch {
    // fall through
  }
  return emptyRegister();
}

export function serializeRegister(register: Register): string {
  const sorted = Object.fromEntries(
    Object.entries(register.places).sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify({ version: 1, places: sorted }, null, 2) + '\n';
}

const isAlias = (entry: PlaceEntry | AliasEntry | undefined): entry is AliasEntry =>
  !!entry && typeof (entry as AliasEntry).alias === 'string';

/** The located entry for a place string, following aliases; null if none. */
export function resolve(register: Register, key: string): PlaceEntry | null {
  let entry = register.places[key];
  for (let hops = 0; isAlias(entry) && hops < 5; hops++) entry = register.places[entry.alias];
  return entry && !isAlias(entry) && typeof entry.href === 'string' ? entry : null;
}

/** A copy with `key` set to `entry`. */
export function withEntry(register: Register, key: string, entry: PlaceEntry | AliasEntry): Register {
  return { version: 1, places: { ...register.places, [key]: entry } };
}

/** A copy without the entries whose map file is gone, and aliases left pointing nowhere. */
export function withoutMissing(register: Register, hrefExists: (href: string) => boolean): Register {
  const places: Register['places'] = {};
  for (const [key, entry] of Object.entries(register.places)) {
    if (!isAlias(entry) && hrefExists(entry.href)) places[key] = entry;
  }
  for (const [key, entry] of Object.entries(register.places)) {
    if (isAlias(entry) && resolve({ version: 1, places }, entry.alias)) places[key] = entry;
  }
  return { version: 1, places };
}

/** Every href the register points at. */
export function registerHrefs(register: Register): Set<string> {
  return new Set(
    Object.values(register.places)
      .filter((entry): entry is PlaceEntry => !isAlias(entry))
      .map(entry => entry.href),
  );
}

/** A file-name stem for a place string: "Weston, Natal" → "weston-natal". */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'place';
}

/** Fill the insert template; a place's quotes become single quotes so the value stays quoted. */
export function fillTemplate(template: string, place: string): string {
  return template.split('<place>').join(place.replace(/"/g, "'"));
}

/**
 * Merge the per-chapter places lists ({ chapterId: [{ text, label }] }) into
 * one entry per place string, in first-use order.
 */
export function mergePlaceLists(
  lists: Record<string, Array<{ text?: unknown; label?: unknown }>>,
): PlaceUse[] {
  const byText = new Map<string, PlaceUse>();
  for (const [chapter, entries] of Object.entries(lists)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || typeof entry.text !== 'string' || !entry.text.trim()) continue;
      const text = entry.text.trim();
      const use = byText.get(text) ?? { text, labels: [], chapters: [] };
      if (typeof entry.label === 'string' && !use.labels.includes(entry.label)) use.labels.push(entry.label);
      if (!use.chapters.includes(chapter)) use.chapters.push(chapter);
      byText.set(text, use);
    }
  }
  return [...byText.values()];
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
