import { describe, it, expect } from 'vitest';
import { generateCoverSvg, titleHue } from './cover-generator.js';

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

  it('derives a stable hue from the title', () => {
    expect(titleHue('A Sample Screenplay')).toBe(titleHue('A Sample Screenplay'));
    expect(titleHue('A Sample Screenplay')).toBeGreaterThanOrEqual(0);
    expect(titleHue('A Sample Screenplay')).toBeLessThan(360);
  });
});
