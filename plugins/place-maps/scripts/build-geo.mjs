/**
 * Build the plugin's outline data (geo/) from Natural Earth (public domain).
 *
 * Run by a maintainer, not by the app build: the output is committed, so the
 * plugin needs no network for outlines. Downloads the three Natural Earth
 * layers into a cache folder, simplifies them with mapshaper (pinned, fetched
 * by npx), and writes one small file per country plus an index:
 *
 *   geo/index.json  [{ a3, a2, name, bbox }]  — every country, for lookups
 *   geo/<A3>.json   { a3, name, outline, regions: [{ name, geometry }] }
 *
 * A country's regions are its Natural Earth admin-1 units (states,
 * provinces), except the United Kingdom, whose regions are its four nations
 * (map units) — the design's "the state, or in Britain the nation".
 *
 *   node plugins/place-maps/scripts/build-geo.mjs [cacheDir]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea } from 'd3-geo';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'geo');
const cache = path.resolve(process.argv[2] || path.join(here, '..', '.ne-cache'));
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/';
const MAPSHAPER = ['--yes', 'mapshaper@0.6.102'];

const layers = {
  countries: 'ne_50m_admin_0_countries.geojson',
  units: 'ne_10m_admin_0_map_units.geojson',
  admin1: 'ne_10m_admin_1_states_provinces.geojson',
};

fs.mkdirSync(cache, { recursive: true });
for (const file of Object.values(layers)) {
  const target = path.join(cache, file);
  if (fs.existsSync(target)) continue;
  process.stdout.write(`downloading ${file}\n`);
  execFileSync('curl', ['-sSfL', '-o', target, NE + file]);
}

/**
 * d3-geo reads polygons on the sphere: an exterior ring must run clockwise,
 * or the polygon is everything EXCEPT the country. mapshaper writes the
 * RFC 7946 winding (counter-clockwise), so any polygon d3 would read as more
 * than a hemisphere has its rings reversed.
 */
function rewound(geometry) {
  if (!geometry) return geometry;
  const fix = (rings) =>
    geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map((ring) => [...ring].reverse()) : rings;
  if (geometry.type === 'Polygon') return { type: 'Polygon', coordinates: fix(geometry.coordinates) };
  if (geometry.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: geometry.coordinates.map(fix) };
  return geometry;
}

function simplify(input, output, args) {
  execFileSync('npx', [...MAPSHAPER, input, ...args, '-o', output, 'format=geojson', 'precision=0.001'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const data = JSON.parse(fs.readFileSync(output, 'utf8'));
  // A plain -dissolve (no field) writes a GeometryCollection, not features.
  const features =
    data.type === 'FeatureCollection'
      ? data.features
      : (data.geometries ?? [data]).map((geometry) => ({ type: 'Feature', properties: {}, geometry }));
  return features.map((f) => ({ ...f, geometry: rewound(f.geometry) }));
}

const tmp = (name) => path.join(cache, `simplified-${name}.json`);
const countries = simplify(path.join(cache, layers.countries), tmp('countries'), [
  '-filter-fields', 'ADM0_A3,ISO_A2,ISO_A2_EH,NAME',
  '-simplify', '25%', 'weighted', 'keep-shapes',
]);
const nations = simplify(path.join(cache, layers.units), tmp('gbr'), [
  '-filter', 'ADM0_A3=="GBR"',
  '-filter-fields', 'GEOUNIT',
  '-simplify', '6%', 'weighted', 'keep-shapes',
]);
const ADMIN1_ARGS = ['-filter-fields', 'name,adm0_a3', '-simplify', '4%', 'weighted', 'keep-shapes'];
const admin1 = simplify(path.join(cache, layers.admin1), tmp('admin1'), ADMIN1_ARGS);
// Country outlines dissolved from the same simplified states (and, for the
// UK, nations), so a country's coast and its tinted state share their lines
// exactly. The countries layer is the fallback for a country with no states.
const dissolvedOutlines = new Map(
  simplify(path.join(cache, layers.admin1), tmp('admin1-dissolved'), [...ADMIN1_ARGS, '-dissolve', 'adm0_a3']).map(
    (f) => [f.properties.adm0_a3, f.geometry],
  ),
);
const gbrOutline = simplify(path.join(cache, layers.units), tmp('gbr-dissolved'), [
  '-filter', 'ADM0_A3=="GBR"',
  '-simplify', '6%', 'weighted', 'keep-shapes',
  '-dissolve',
])[0].geometry;

function bbox(geometry) {
  let [x0, y0, x1, y1] = [180, 90, -180, -90];
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      x0 = Math.min(x0, c[0]); y0 = Math.min(y0, c[1]);
      x1 = Math.max(x1, c[0]); y1 = Math.max(y1, c[1]);
    } else c.forEach(walk);
  };
  walk(geometry.coordinates);
  return [x0, y0, x1, y1].map((n) => Math.round(n * 1000) / 1000);
}

// A country's alpha-2 code: its own ISO_A2, or Natural Earth's ISO_A2_EH
// fallback only when no country holds that code outright — otherwise
// territories such as Ashmore and Cartier Islands carry AU beside Australia,
// and a geocoder's "au" finds the wrong one.
const ownCodes = new Set(countries.map((f) => f.properties.ISO_A2).filter((code) => code && code !== '-99'));
function alpha2(p) {
  if (p.ISO_A2 && p.ISO_A2 !== '-99') return p.ISO_A2;
  const fallback = p.ISO_A2_EH;
  return fallback && fallback !== '-99' && !ownCodes.has(fallback) ? fallback : null;
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const index = [];
for (const country of countries) {
  const p = country.properties;
  const a3 = p.ADM0_A3;
  if (!a3 || !country.geometry) continue;
  const a2 = alpha2(p);
  const regions =
    a3 === 'GBR'
      ? nations.map((f) => ({ name: f.properties.GEOUNIT, geometry: f.geometry }))
      : admin1
          .filter((f) => f.properties.adm0_a3 === a3 && f.geometry && f.properties.name)
          .map((f) => ({ name: f.properties.name, geometry: f.geometry }));
  regions.sort((a, b) => a.name.localeCompare(b.name));
  const outline = a3 === 'GBR' ? gbrOutline : (dissolvedOutlines.get(a3) ?? country.geometry);
  fs.writeFileSync(path.join(outDir, `${a3}.json`), JSON.stringify({ a3, name: p.NAME, outline, regions }));
  index.push({ a3, a2, name: p.NAME, bbox: bbox(outline) });
}
index.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index));
const total = fs.readdirSync(outDir).reduce((sum, f) => sum + fs.statSync(path.join(outDir, f)).size, 0);
process.stdout.write(`wrote ${index.length} countries, ${(total / 1024 / 1024).toFixed(2)} MB\n`);
