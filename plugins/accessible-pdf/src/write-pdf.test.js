import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { writePdf } from './write-pdf.js';

const FONT = '/System/Library/Fonts/Supplemental/Times New Roman.ttf';
const hasFont = fs.existsSync(FONT);

const word = (text, x, struct, extra = {}) => ({
  kind: 'text',
  text,
  visible: text.trimEnd().length,
  x,
  y: 40,
  width: 6 * text.trimEnd().length,
  height: 14,
  font: 0,
  size: 12,
  color: '#000000',
  struct,
  ...extra,
});

/** Two pages: a heading, and a paragraph split across the pages with a hyphenated word. */
const description = {
  version: 1,
  title: 'Test book',
  lang: 'en',
  fonts: [{ family: 'Times New Roman', weight: 400, style: 'normal' }],
  structure: [
    { id: 0, type: 'Document', parent: null, children: [1] },
    { id: 1, type: 'Sect', parent: 0, children: [2, 3] },
    { id: 2, type: 'H1', parent: 1, children: [] },
    { id: 3, type: 'P', parent: 1, children: [] },
  ],
  problems: [],
  pages: [
    {
      width: 300,
      height: 400,
      number: 1,
      items: [
        word('Title', 20, 2),
        word('The ', 20, 3),
        word('recog', 50, 3, { hyphenated: { wholeWord: 'recognized', part: 1 } }),
        {
          kind: 'margin',
          text: '1',
          x: 0,
          y: 380,
          width: 300,
          height: 14,
          align: 'center',
          font: 0,
          size: 9,
          color: '#555555',
        },
      ],
    },
    {
      width: 300,
      height: 400,
      number: 2,
      items: [
        word('nized ', 20, 3, { hyphenated: { wholeWord: 'recognized', part: 2 } }),
        word('word', 60, 3),
      ],
    },
  ],
};

describe.skipIf(!hasFont)('writePdf', () => {
  it('writes a tagged PDF with the structure, a page-spanning paragraph and whole hyphenated words', async () => {
    const pdf = await writePdf(description, [fs.readFileSync(FONT)]);
    const text = new TextDecoder('latin1').decode(pdf);

    expect(text.startsWith('%PDF-1.7')).toBe(true);
    expect(text).toContain('/StructTreeRoot');
    expect(text).toMatch(/\/Marked true/);
    expect(text).toContain('/Lang (en)');
    expect(text).toContain('/DisplayDocTitle true');
    // The paragraph's content on page 2 is a marked-content reference.
    expect(text).toContain('/Type /MCR');
    expect(text).toContain('/ActualText (recognized )');
    expect(text).toContain('/PageLabels');
  });
});
