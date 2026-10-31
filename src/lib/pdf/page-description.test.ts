import { describe, it, expect } from 'vitest';
import {
  cssColorToHex,
  isVisuallyHidden,
  resolveMarginContent,
  placePicture,
  tableCellAttributes,
} from './page-description.js';

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

describe('placePicture', () => {
  const box = new DOMRect(10, 20, 200, 100);
  const wide = { width: 400, height: 100 };
  const rect = (r: DOMRect) => [r.left, r.top, r.width, r.height];

  it('fills the box by default', () => {
    expect(rect(placePicture(box, wide, 'fill', '50% 50%'))).toEqual([10, 20, 200, 100]);
  });

  it('fits inside the box with contain, centred', () => {
    expect(rect(placePicture(box, wide, 'contain', '50% 50%'))).toEqual([10, 45, 200, 50]);
  });

  it('covers the box with cover, overflowing it', () => {
    expect(rect(placePicture(box, wide, 'cover', '50% 50%'))).toEqual([-90, 20, 400, 100]);
    expect(rect(placePicture(box, wide, 'cover', '0% 0%'))).toEqual([10, 20, 400, 100]);
  });

  it('keeps the natural size with none, and only shrinks with scale-down', () => {
    const small = { width: 50, height: 20 };
    expect(rect(placePicture(box, small, 'none', '0px 10px', 2))).toEqual([10, 40, 50, 20]);
    expect(rect(placePicture(box, small, 'scale-down', '50% 50%'))).toEqual([85, 60, 50, 20]);
  });
});

describe('tableCellAttributes', () => {
  const table = (html: string) => {
    const t = document.createElement('table');
    t.innerHTML = html;
    return t;
  };

  it('takes the scope a th states', () => {
    const t = table('<tbody><tr><th scope="col">A</th><th scope="rowgroup">B</th></tr></tbody>');
    const [a, b] = Array.from(t.querySelectorAll('th'));
    expect(tableCellAttributes(a)).toEqual({ scope: 'Column' });
    expect(tableCellAttributes(b)).toEqual({ scope: 'Row' });
  });

  it('makes a th in thead or in a row of headers a column header, and others row headers', () => {
    const t = table(
      '<thead><tr><th>Song</th><td>x</td></tr></thead>' +
        '<tbody><tr><th>Year</th><th>Writer</th></tr><tr><th>Help!</th><td>1965</td></tr></tbody>'
    );
    const [song, year, , help] = Array.from(t.querySelectorAll('th'));
    expect(tableCellAttributes(song).scope).toBe('Column');
    expect(tableCellAttributes(year).scope).toBe('Column');
    expect(tableCellAttributes(help).scope).toBe('Row');
  });

  it('records spans over one cell', () => {
    const t = table('<tbody><tr><td colspan="3" rowspan="1">All</td></tr></tbody>');
    expect(tableCellAttributes(t.querySelector('td')!)).toEqual({ colSpan: 3 });
  });
});
