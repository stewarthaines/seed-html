import { describe, it, expect } from 'vitest';
import {
  parseFamilyList,
  firstSrcUrl,
  pickFace,
  loadFontFiles,
  type FontFace,
} from './font-files.js';

const face = (style: FontFace['style'], weight: number | [number, number], url = ''): FontFace => ({
  family: 'Liberation Serif',
  weight: typeof weight === 'number' ? [weight, weight] : weight,
  style,
  url: url || `${style}-${String(weight)}.ttf`,
});

describe('parseFamilyList', () => {
  it('splits and unquotes a computed family list', () => {
    expect(parseFamilyList('"Liberation Serif", Georgia, serif')).toEqual([
      'Liberation Serif',
      'Georgia',
      'serif',
    ]);
    expect(parseFamilyList("'Noto Sans Georgian',sans-serif")).toEqual([
      'Noto Sans Georgian',
      'sans-serif',
    ]);
  });

  it('keeps a comma inside quotes', () => {
    expect(parseFamilyList('"A, B", C')).toEqual(['A, B', 'C']);
  });
});

describe('firstSrcUrl', () => {
  it('takes the first url, quoted or not', () => {
    expect(firstSrcUrl('url("../Fonts/a.ttf") format("truetype")')).toBe('../Fonts/a.ttf');
    expect(firstSrcUrl("url('a.woff2') format('woff2'), url(b.ttf)")).toBe('a.woff2');
    expect(firstSrcUrl('url(blob:http://localhost/123)')).toBe('blob:http://localhost/123');
  });

  it('returns null for local() only', () => {
    expect(firstSrcUrl('local("Times New Roman")')).toBeNull();
  });
});

describe('pickFace', () => {
  const faces = [face('normal', 400), face('normal', 700), face('italic', 400)];

  it('takes the exact style and weight', () => {
    expect(pickFace(faces, { weight: 700, style: 'normal' })).toBe(faces[1]);
    expect(pickFace(faces, { weight: 400, style: 'italic' })).toBe(faces[2]);
  });

  it('falls to the nearest weight in the same style', () => {
    expect(pickFace(faces, { weight: 300, style: 'normal' })).toBe(faces[0]);
    expect(pickFace(faces, { weight: 900, style: 'normal' })).toBe(faces[1]);
    expect(pickFace(faces, { weight: 700, style: 'italic' })).toBe(faces[2]);
  });

  it('uses a variable face whose range covers the weight', () => {
    const variable = face('normal', [100, 900]);
    expect(pickFace([variable], { weight: 650, style: 'normal' })).toBe(variable);
  });

  it('uses normal when there is no italic', () => {
    expect(pickFace([faces[0]], { weight: 400, style: 'italic' })).toBe(faces[0]);
  });

  it('finds nothing among no faces', () => {
    expect(pickFace([], { weight: 400, style: 'normal' })).toBeNull();
  });
});

describe('loadFontFiles', () => {
  const faces = [face('normal', 400, 'regular.ttf'), face('normal', 700, 'bold.ttf')];
  const fetchFile = async (url: string) => new TextEncoder().encode(url).buffer as ArrayBuffer;
  const text = (b: ArrayBuffer) => new TextDecoder().decode(b);

  it('returns a file per font, in order, trying the family list name by name', async () => {
    const { files, missing } = await loadFontFiles(
      faces,
      [
        { family: 'Georgia, "Liberation Serif", serif', weight: 700, style: 'normal' },
        { family: '"Liberation Serif", serif', weight: 400, style: 'normal' },
      ],
      fetchFile
    );
    expect(files.map(text)).toEqual(['bold.ttf', 'regular.ttf']);
    expect(missing).toEqual([]);
  });

  it('lists a family with no face in the book', async () => {
    const { missing } = await loadFontFiles(
      faces,
      [{ family: '"Times New Roman", serif', weight: 400, style: 'normal' }],
      fetchFile
    );
    expect(missing).toEqual(['"Times New Roman", serif']);
  });
});
