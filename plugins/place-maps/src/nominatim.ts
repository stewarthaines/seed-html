/**
 * Geocoding through OSM Nominatim, called only when the author presses
 * Search (process/PLACE_MAPS.md, Geocoding). At most one request a second, as
 * its usage policy asks; the browser identifies the app by its Referer. Only
 * coordinates and the resolved name are kept.
 */

export interface Candidate {
  /** "Weston, KwaZulu-Natal, South Africa" — locality, state, country. */
  name: string;
  /** Nominatim's full display name, shown as detail. */
  detail: string;
  lat: number;
  lon: number;
  /** ISO 3166 alpha-2, upper case, when Nominatim gave one. */
  countryCode: string | null;
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const MIN_INTERVAL_MS = 1100;
let lastRequest = 0;

export function searchUrl(query: string, language: string): string {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    'accept-language': language || 'en',
  });
  return `${ENDPOINT}?${params}`;
}

interface NominatimResult {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  address?: Record<string, string>;
}

const LOCALITY_KEYS = ['city', 'town', 'village', 'hamlet', 'suburb', 'municipality', 'locality', 'county'];

/** Turn Nominatim's JSON into candidates, dropping any without coordinates. */
export function parseResults(results: unknown): Candidate[] {
  if (!Array.isArray(results)) return [];
  const out: Candidate[] = [];
  for (const result of results as NominatimResult[]) {
    const lat = Number(result.lat);
    const lon = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const address = result.address ?? {};
    const locality = result.name || LOCALITY_KEYS.map(key => address[key]).find(Boolean) || '';
    const state = address.state || address.province || address.region || address.county || '';
    const parts = [locality, state !== locality ? state : '', address.country || ''].filter(Boolean);
    out.push({
      name: parts.join(', ') || result.display_name || '',
      detail: result.display_name || '',
      lat,
      lon,
      countryCode: address.country_code ? address.country_code.toUpperCase() : null,
    });
  }
  return out;
}

export async function search(query: string, language: string): Promise<Candidate[]> {
  const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  lastRequest = Date.now();
  const response = await fetch(searchUrl(query, language), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Nominatim answered ${response.status}`);
  return parseResults(await response.json());
}
