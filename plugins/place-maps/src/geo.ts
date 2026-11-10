/**
 * The bundled outline data (geo/, built by scripts/build-geo.mjs from Natural
 * Earth): an index of countries and one file per country with its outline and
 * its states, provinces or nations. Fetched beside the plugin, cached.
 */
import { geoContains, geoDistance, geoCentroid } from 'd3-geo';
import type { Geometry } from 'geojson';

export interface CountryIndexEntry {
  a3: string;
  a2: string | null;
  name: string;
  bbox: [number, number, number, number];
}

export interface CountryData {
  a3: string;
  name: string;
  outline: Geometry;
  regions: Array<{ name: string; geometry: Geometry }>;
}

const base = () => new URL('geo/', window.location.href);
let indexPromise: Promise<CountryIndexEntry[]> | null = null;
const countryCache = new Map<string, Promise<CountryData>>();

async function fetchJson<T>(name: string): Promise<T> {
  const response = await fetch(new URL(name, base()));
  if (!response.ok) throw new Error(`Outline data missing: ${name}`);
  return response.json() as Promise<T>;
}

export function loadIndex(): Promise<CountryIndexEntry[]> {
  indexPromise ??= fetchJson<CountryIndexEntry[]>('index.json');
  return indexPromise;
}

export function loadCountry(a3: string): Promise<CountryData> {
  let promise = countryCache.get(a3);
  if (!promise) {
    promise = fetchJson<CountryData>(`${a3}.json`);
    countryCache.set(a3, promise);
  }
  return promise;
}

const feature = (geometry: Geometry) => ({ type: 'Feature' as const, geometry, properties: {} });

/** The region containing a point, or the nearest one (simplified coasts miss). */
export function regionAt(country: CountryData, point: [number, number]): CountryData['regions'][number] | null {
  const inside = country.regions.find(region => geoContains(feature(region.geometry), point));
  if (inside) return inside;
  let best: CountryData['regions'][number] | null = null;
  let bestDistance = Infinity;
  for (const region of country.regions) {
    const distance = geoDistance(geoCentroid(feature(region.geometry)), point);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = region;
    }
  }
  return best;
}

const inBox = ([lon, lat]: [number, number], [x0, y0, x1, y1]: CountryIndexEntry['bbox']) =>
  lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1;

/**
 * The country a point lies in. Containment decides: among the countries with
 * the geocoder's alpha-2 code first, then any whose outline holds the point.
 * A code alone never decides, since more than one entry can share one (an
 * outlying territory beside its country); when nothing contains the point (a
 * simplified coast), the code's entry with the largest extent stands in.
 */
export async function countryAt(point: [number, number], alpha2: string | null): Promise<CountryData | null> {
  const index = await loadIndex();
  const coded = alpha2 ? index.filter(entry => entry.a2 === alpha2) : [];
  const others = index.filter(entry => !coded.includes(entry));
  for (const entry of [...coded, ...others]) {
    if (!inBox(point, entry.bbox)) continue;
    const country = await loadCountry(entry.a3);
    if (geoContains(feature(country.outline), point)) return country;
  }
  if (!coded.length) return null;
  const area = ([x0, y0, x1, y1]: CountryIndexEntry['bbox']) => (x1 - x0) * (y1 - y0);
  const largest = coded.reduce((best, entry) => (area(entry.bbox) > area(best.bbox) ? entry : best));
  return loadCountry(largest.a3);
}
