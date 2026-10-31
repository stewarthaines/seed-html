// @vitest-environment node
// PDFKit under jsdom mixes realms (its TextEncoder output isn't jsdom's
// Uint8Array), which drops the XMP metadata stream; the writer needs no DOM.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import zlib from 'node:zlib';
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
  overflowPages: [],
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

/** Every content stream of a PDFKit file, inflated and joined. */
function pageContent(pdf) {
  const bytes = Buffer.from(pdf);
  const out = [];
  let at = 0;
  for (;;) {
    const start = bytes.indexOf('stream\n', at);
    if (start < 0) break;
    const end = bytes.indexOf('\nendstream', start);
    try {
      out.push(zlib.inflateSync(bytes.subarray(start + 7, end)).toString('latin1'));
    } catch {
      // not a deflated stream (font data, metadata)
    }
    at = end + 10;
  }
  return out.join('\n');
}

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
    expect(text).not.toContain('pdfuaid');
  });

  it('draws visually hidden text in render mode 3', async () => {
    const hidden = structuredClone(description);
    hidden.pages[0].items[0].invisible = true;
    const pdf = await writePdf(hidden, [fs.readFileSync(FONT)], {});
    expect(pageContent(pdf)).toMatch(/q\n3 Tr\nq\n[^Q]*?BT[\s\S]*?ET\nQ\nQ/);
  });

  it('writes the PDF/UA identifier only when asked', async () => {
    const pdf = await writePdf(description, [fs.readFileSync(FONT)], { claimPdfUa: true });
    expect(new TextDecoder('latin1').decode(pdf)).toContain('<pdfuaid:part>1</pdfuaid:part>');
  });
});
