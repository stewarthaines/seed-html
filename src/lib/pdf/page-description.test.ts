import { describe, it, expect } from 'vitest';
import { cssColorToHex, resolveMarginContent } from './page-description.js';

// describePages measures a live layout, which happy-dom doesn't compute; it is
// exercised in the browser (process/ACCESSIBLE_PDF_PDFKIT.md, phase 0).

describe('resolveMarginContent', () => {
  it('resolves the page counter', () => {
    expect(resolveMarginContent('counter(page)', 7)).toBe('7');
  });

  it('joins quoted strings and the page counter', () => {
    expect(resolveMarginContent('"Page " counter(page)', 12)).toBe('Page 12');
  });

  it('unescapes quoted strings', () => {
    expect(resolveMarginContent('"say \\"hi\\""', 1)).toBe('say "hi"');
  });

  it('returns null for content it cannot draw', () => {
    expect(resolveMarginContent('string(title)', 3)).toBeNull();
    expect(resolveMarginContent('counter(page, lower-roman)', 3)).toBeNull();
    expect(resolveMarginContent('none', 3)).toBeNull();
    expect(resolveMarginContent('normal', 3)).toBeNull();
  });
});

describe('cssColorToHex', () => {
  it('converts rgb and rgba', () => {
    expect(cssColorToHex('rgb(85, 85, 85)')).toBe('#555555');
    expect(cssColorToHex('rgba(0, 128, 255, 0.5)')).toBe('#0080ff');
  });

  it('falls back to black for a value it cannot read', () => {
    expect(cssColorToHex('color(display-p3 1 0 0)')).toBe('#000000');
  });
});
