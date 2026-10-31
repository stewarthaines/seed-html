import { describe, it, expect } from 'vitest';
import {
  backgroundInset,
  boxSides,
  cornerRadius,
  cssColor,
  cssColorToHex,
  markerText,
  ordinalOf,
  rtlMarker,
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

// A computed style with nothing set, in CSS pixels; `pt` here is 1:1.
const plain = {
  borderTopWidth: '0px',
  borderRightWidth: '0px',
  borderBottomWidth: '0px',
  borderLeftWidth: '0px',
  borderTopStyle: 'none',
  borderRightStyle: 'none',
  borderBottomStyle: 'none',
  borderLeftStyle: 'none',
  borderTopColor: 'rgb(0, 0, 0)',
  borderRightColor: 'rgb(0, 0, 0)',
  borderBottomColor: 'rgb(0, 0, 0)',
  borderLeftColor: 'rgb(0, 0, 0)',
  paddingTop: '0px',
  paddingRight: '0px',
  paddingBottom: '0px',
  paddingLeft: '0px',
  borderTopLeftRadius: '0px',
  borderTopRightRadius: '0px',
  borderBottomRightRadius: '0px',
  borderBottomLeftRadius: '0px',
  backgroundClip: 'border-box',
};
const pt = (v: string) => parseFloat(v) || 0;

describe('cssColor', () => {
  it('gives the colour and any opacity, or null when transparent', () => {
    expect(cssColor('rgb(255, 0, 0)')).toEqual({ color: '#ff0000' });
    expect(cssColor('rgba(0, 0, 255, 0.25)')).toEqual({ color: '#0000ff', opacity: 0.25 });
    expect(cssColor('rgba(0, 0, 0, 0)')).toBeNull();
  });
});

describe('boxSides', () => {
  it('keeps the sides the browser draws', () => {
    const sides = boxSides(
      {
        ...plain,
        borderBottomWidth: '2px',
        borderBottomStyle: 'dashed',
        borderBottomColor: 'rgb(0, 128, 0)',
        borderLeftWidth: '3px',
        borderLeftStyle: 'hidden',
        borderTopWidth: '1px',
        borderTopStyle: 'solid',
        borderTopColor: 'rgba(0, 0, 0, 0)',
      },
      pt
    );
    expect(sides).toEqual([null, null, { width: 2, style: 'dashed', color: '#008000' }, null]);
  });
});

describe('cornerRadius', () => {
  it('is 0 for square corners and the radius when all four share one', () => {
    expect(cornerRadius(plain, pt)).toBe(0);
    const round = {
      ...plain,
      borderTopLeftRadius: '6px',
      borderTopRightRadius: '6px',
      borderBottomRightRadius: '6px',
      borderBottomLeftRadius: '6px',
    };
    expect(cornerRadius(round, pt)).toBe(6);
  });

  it('is null for corners it does not draw', () => {
    expect(cornerRadius({ ...plain, borderTopLeftRadius: '6px' }, pt)).toBeNull();
    const elliptical = {
      ...plain,
      borderTopLeftRadius: '6px 3px',
      borderTopRightRadius: '6px 3px',
      borderBottomRightRadius: '6px 3px',
      borderBottomLeftRadius: '6px 3px',
    };
    expect(cornerRadius(elliptical, pt)).toBeNull();
  });
});

describe('backgroundInset', () => {
  it('follows background-clip', () => {
    const style = { ...plain, borderTopWidth: '2px', borderTopStyle: 'solid', paddingTop: '5px' };
    expect(backgroundInset(style, pt).top).toBe(0);
    expect(backgroundInset({ ...style, backgroundClip: 'padding-box' }, pt).top).toBe(2);
    expect(backgroundInset({ ...style, backgroundClip: 'content-box' }, pt).top).toBe(7);
  });
});

describe('markerText', () => {
  it('writes numbers, letters and numerals with the suffix and space', () => {
    expect(markerText('decimal', 3)).toBe('3. ');
    expect(markerText('decimal-leading-zero', 3)).toBe('03. ');
    expect(markerText('lower-alpha', 28)).toBe('ab. ');
    expect(markerText('upper-roman', 14)).toBe('XIV. ');
    expect(markerText('arabic-indic', 12)).toBe('١٢. ');
  });

  it('writes symbols and strings as they are, and nothing for none', () => {
    expect(markerText('disc', 1)).toBe('\u2022 ');
    expect(markerText('"→ "', 1)).toBe('→ ');
    expect(markerText('none', 1)).toBe('');
  });

  it('is null for a style it does not draw', () => {
    expect(markerText('hebrew', 1)).toBeNull();
    expect(markerText('lower-roman', 4000)).toBeNull();
  });
});

describe('rtlMarker', () => {
  it('puts the suffix on the left', () => {
    expect(rtlMarker('12.')).toBe('.12');
    expect(rtlMarker('\u2022')).toBe('\u2022');
  });
});

describe('ordinalOf', () => {
  const items = (html: string) => {
    document.body.innerHTML = html;
    return Array.from(document.querySelectorAll('li'));
  };

  it('counts from the list start, taking any value an item sets', () => {
    const li = items('<ol start="4"><li>a</li><li>b</li><li value="10">c</li><li>d</li></ol>');
    expect(li.map(ordinalOf)).toEqual([4, 5, 10, 11]);
  });

  it('counts down a reversed list from its length', () => {
    const li = items('<ol reversed><li>a</li><li>b</li><li>c</li></ol>');
    expect(li.map(ordinalOf)).toEqual([3, 2, 1]);
  });
});
