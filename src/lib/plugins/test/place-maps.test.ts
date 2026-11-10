/**
 * The place-maps plugin's pure logic, tested from the app suite (the plugin
 * builds separately and has no test runner of its own): the register
 * contract family-history reads, the geocoder's result parsing, and the
 * two-level map renderer against the bundled outline data.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// The plugin is its own package, outside the app's TypeScript project, so its
// modules load by a path TypeScript does not resolve; vitest transforms them.
const PLUGIN_SRC = '../../../../plugins/place-maps/src/';
const load = (name: string): Promise<any> => import(/* @vite-ignore */ PLUGIN_SRC + name);
const {
  fillTemplate,
  mergePlaceLists,
  parseRegister,
  resolve,
  serializeRegister,
  slugify,
  withEntry,
  withoutMissing,
} = await load('register.js');
const { parseResults, searchUrl } = await load('nominatim.js');
const { renderMap } = await load('render.js');
const { countryAt } = await load('geo.js');


const ballarat = {
  name: 'Ballarat, Victoria, Australia',
  lat: -37.5622,
  lon: 143.8503,
  source: 'nominatim 2026-11-09',
  country: 'AUS',
  region: 'Victoria',
  href: 'Images/maps/ballarat.svg',
};

describe('place-maps register', () => {
  it('round-trips, resolves aliases, and tolerates a missing or broken file', () => {
    let register = withEntry(parseRegister(null), 'Ballarat', ballarat);
    register = withEntry(register, 'Ballarat East', { alias: 'Ballarat' });
    const reread = parseRegister(serializeRegister(register));
    expect(resolve(reread, 'Ballarat East')?.name).toBe('Ballarat, Victoria, Australia');
    expect(resolve(reread, 'Nowhere')).toBeNull();
    expect(parseRegister('not json').places).toEqual({});
  });

  it('drops entries whose map file is gone, and aliases left pointing at them', () => {
    let register = withEntry(parseRegister(null), 'Ballarat', ballarat);
    register = withEntry(register, 'Ballarat East', { alias: 'Ballarat' });
    register = withEntry(register, 'Albany, WA', { ...ballarat, href: 'Images/maps/albany.svg' });
    const pruned = withoutMissing(register, (href: string) => href === 'Images/maps/albany.svg');
    expect(Object.keys(pruned.places)).toEqual(['Albany, WA']);
  });

  it('merges per-chapter places lists into one row per place string', () => {
    const merged = mergePlaceLists({
      les: [
        { text: 'Ballarat', label: 'Les, born' },
        { text: 'Ballarat', label: 'Nance, born' },
      ],
      thomas: [{ text: 'Ballarat', label: 'Les, born' }, { text: ' Burwash, Sussex ' }, { label: 'no text' }],
    });
    expect(merged).toEqual([
      { text: 'Ballarat', labels: ['Les, born', 'Nance, born'], chapters: ['les', 'thomas'] },
      { text: 'Burwash, Sussex', labels: [], chapters: ['thomas'] },
    ]);
  });

  it('makes file names and fills the insert template, keeping the value quoted', () => {
    expect(slugify('Weston, Natal')).toBe('weston-natal');
    expect(slugify('Ühlingen-Birkendorf')).toBe('uhlingen-birkendorf');
    expect(slugify('…')).toBe('place');
    expect(fillTemplate(':map:{place="<place>"}', 'The "Old" Mill')).toBe(":map:{place=\"The 'Old' Mill\"}");
  });
});

describe('place-maps geocoding', () => {
  it('builds a search URL and reads locality, state and country from the address', () => {
    expect(searchUrl('Weston, Natal', 'en')).toContain('q=Weston%2C+Natal');
    const [weston, nameless] = parseResults([
      {
        lat: '-29.2',
        lon: '29.99',
        name: 'Weston',
        display_name: 'Weston, Uthukela, KwaZulu-Natal, South Africa',
        address: { village: 'Weston', state: 'KwaZulu-Natal', country: 'South Africa', country_code: 'za' },
      },
      { lat: '51', lon: '0', display_name: 'Somewhere, England', address: { county: 'Kent', country: 'United Kingdom' } },
      { display_name: 'no coordinates' },
    ]);
    expect(weston).toMatchObject({ name: 'Weston, KwaZulu-Natal, South Africa', countryCode: 'ZA', lat: -29.2 });
    expect(nameless.name).toBe('Kent, United Kingdom');
    expect(parseResults('nope')).toEqual([]);
  });
});

describe('place-maps renderer', () => {
  const aus = JSON.parse(readFileSync('plugins/place-maps/geo/AUS.json', 'utf8'));
  const victoria = aus.regions.find((r: { name: string }) => r.name === 'Victoria');

  it('draws the country, the tinted state and the dot, with classes only', () => {
    const svg = renderMap({ outline: aus.outline, region: victoria.geometry, point: [143.85, -37.56], name: 'Ballarat, Victoria, Australia' });
    expect(svg).toContain('class="pm-land"');
    expect(svg).toContain('class="pm-region"');
    expect(svg).toContain('class="pm-dot"');
    expect(svg).toContain('<title>Map: Ballarat, Victoria, Australia</title>');
    expect(svg).not.toMatch(/fill=|stroke=|#[0-9a-f]{3,6}\b/i);
    expect(svg.length).toBeLessThan(16000);
  });

  it('crops the view box to a wide country instead of a square', () => {
    const svg = renderMap({ outline: aus.outline, region: null, point: null, name: 'Australia' });
    const [, , w, h] = /viewBox="([\d.\s-]+)"/.exec(svg)![1].split(/\s+/).map(Number);
    expect(w).toBeGreaterThan(h);
    expect(svg).not.toContain('pm-dot');
    expect(svg).not.toContain('pm-region');
  });

  it('escapes the place name in the title', () => {
    const svg = renderMap({ outline: aus.outline, region: null, point: null, name: 'A & B <c>' });
    expect(svg).toContain('<title>Map: A &amp; B &lt;c&gt;</title>');
  });
});

describe('place-maps outline data and country lookup', () => {
  const index = JSON.parse(readFileSync('plugins/place-maps/geo/index.json', 'utf8')) as Array<{
    a3: string;
    a2: string | null;
  }>;

  it('gives each alpha-2 code to one country only', () => {
    const codes = index.map(entry => entry.a2).filter(Boolean);
    expect(new Set(codes).size).toBe(codes.length);
    expect(index.find(entry => entry.a2 === 'AU')?.a3).toBe('AUS');
  });

  it('finds the country that contains the point, whatever the code says', async () => {
    // Serve geo/ from disk to the module's fetch.
    vi.stubGlobal('fetch', async (url: URL | string) => {
      const name = String(url).split('/geo/')[1];
      return new Response(readFileSync(`plugins/place-maps/geo/${name}`, 'utf8'));
    });
    try {
      // Scarsdale, Victoria — once drawn on Ashmore and Cartier Islands,
      // which shared Australia's code in an earlier index.
      expect((await countryAt([143.65, -37.67], 'AU')).a3).toBe('AUS');
      expect((await countryAt([143.65, -37.67], null)).a3).toBe('AUS');
      expect((await countryAt([29.99, -29.2], 'ZA')).a3).toBe('ZAF');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
