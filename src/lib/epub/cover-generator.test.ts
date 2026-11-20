import { describe, it, expect } from 'vitest';
import { generateCoverSvg, layoutTitle, titleHue, titleLineEm } from './cover-generator.js';

describe('generateCoverSvg', () => {
  it('produces well-formed SVG with declared inkscape/sodipodi namespaces', () => {
    const svg = generateCoverSvg('A Sample Screenplay Handbook', 'Test Author');
    const doc = new DOMParser().parseFromString(svg, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(svg).toContain('xmlns:sodipodi=');
    expect(svg).toContain('xmlns:inkscape=');
  });

  it('marks every title line as an Inkscape line so font changes re-flow predictably', () => {
    // A long title wraps to multiple lines; each tspan must carry
    // sodipodi:role="line" or Inkscape treats them as inline runs and a font
    // change shatters the title (observed in Inkscape 1.x).
    const svg = generateCoverSvg('A Sample Screenplay Handbook For Working Writers', 'Author');
    const tspans = svg.match(/<tspan[^>]*>/g) ?? [];
    expect(tspans.length).toBeGreaterThan(1);
    for (const tspan of tspans) {
      expect(tspan).toContain('sodipodi:role="line"');
      expect(tspan).toContain('x="300"'); // each line stays centered independently
    }
  });

  it('keeps half an em clear each side of every title line', () => {
    const titles = [
      'hello, world! in Bricks',
      'Coming Out',
      'maps demo',
      'Georgian Recipes Demo',
      'Australian McColl Family',
      'Supercalifragilistic',
      'A Sample Screenplay Handbook For Working Writers',
    ];
    for (const title of titles) {
      const { lines, fontSize } = layoutTitle(title);
      for (const line of lines) {
        expect(titleLineEm(line) * fontSize + fontSize).toBeLessThanOrEqual(600);
      }
    }
  });

  it('breaks a short title when breaking allows bigger type', () => {
    expect(layoutTitle('maps demo').lines).toEqual(['maps', 'demo']);
    expect(layoutTitle('Coming Out').lines).toEqual(['Coming', 'Out']);
  });

  it('keeps a single word on one line', () => {
    expect(layoutTitle('Bulletin').lines).toEqual(['Bulletin']);
  });

  it('derives a stable hue from the title', () => {
    expect(titleHue('A Sample Screenplay')).toBe(titleHue('A Sample Screenplay'));
    expect(titleHue('A Sample Screenplay')).toBeGreaterThanOrEqual(0);
    expect(titleHue('A Sample Screenplay')).toBeLessThan(360);
  });
});
