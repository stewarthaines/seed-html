import { describe, it, expect } from 'vitest';
import { cssColorToHex, isVisuallyHidden, resolveMarginContent } from './page-description.js';

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

describe('isVisuallyHidden', () => {
  const style = (over: Partial<Record<string, string>>) => ({
    clipPath: 'none',
    clip: 'auto',
    overflow: 'visible',
    width: '200px',
    height: '20px',
    ...over,
  });

  it('recognises the visually-hidden recipe', () => {
    expect(isVisuallyHidden(style({ clipPath: 'inset(50%)' }))).toBe(true);
    expect(isVisuallyHidden(style({ clip: 'rect(0px, 0px, 0px, 0px)' }))).toBe(true);
    expect(isVisuallyHidden(style({ overflow: 'hidden', width: '1px', height: '1px' }))).toBe(true);
  });

  it('leaves ordinary text visible', () => {
    expect(isVisuallyHidden(style({}))).toBe(false);
    expect(isVisuallyHidden(style({ overflow: 'hidden' }))).toBe(false);
  });
});
