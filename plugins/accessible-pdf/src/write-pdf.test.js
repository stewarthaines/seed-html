// @vitest-environment node
// PDFKit under jsdom mixes realms (its TextEncoder output isn't jsdom's
// Uint8Array), which drops the XMP metadata stream; the writer needs no DOM.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { writePdf, visualOrder } from './write-pdf.js';

const FONT = '/System/Library/Fonts/Supplemental/Times New Roman.ttf';
const hasFont = fs.existsSync(FONT);
const ARIAL = '/System/Library/Fonts/Supplemental/Arial.ttf';

/** A 1×1 red PNG. */
const RED_DOT = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64'
);

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
  images: [],
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
    const pdf = await writePdf(description, { fonts: [fs.readFileSync(FONT)] });
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
    const pdf = await writePdf(hidden, { fonts: [fs.readFileSync(FONT)] }, {});
    expect(pageContent(pdf)).toMatch(/q\n3 Tr\nq\n[^Q]*?BT[\s\S]*?ET\nQ\nQ/);
  });

  it('draws an image as a Figure with its alt text, and a decorative one as an artifact', async () => {
    const withImages = structuredClone(description);
    withImages.images = ['photo.png'];
    withImages.structure[1].children.push(4);
    withImages.structure.push({
      id: 4,
      type: 'Figure',
      parent: 1,
      children: [],
      alt: 'A red dot',
      placement: 'Block',
    });
    const image = { kind: 'image', image: 0, x: 20, y: 100, width: 50, height: 50 };
    withImages.pages[0].items.push({ ...image, struct: 4 }, { ...image, y: 200, struct: null });
    const pdf = await writePdf(withImages, { fonts: [fs.readFileSync(FONT)], images: [RED_DOT] });
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text).toContain('/S /Figure');
    expect(text).toContain('/Alt (A red dot)');
    // A block, and its box on the 400pt page, measured from the foot.
    expect(text).toMatch(/\/O \/Layout\s+\/Placement \/Block\s+\/BBox \[20 250 70 300\]/);
    // One image (with its alpha mask), drawn twice.
    expect(text.match(/\/SMask \d+ 0 R/g)).toHaveLength(1);
    const content = pageContent(pdf);
    expect(content).toMatch(/\/Figure <<[^>]*\/MCID \d+[^>]*>> BDC[\s\S]*?\/I\d+ Do[\s\S]*?EMC/);
    expect(content).toMatch(/\/Artifact <<[^>]*\/Layout[^>]*>> BDC[\s\S]*?\/I\d+ Do[\s\S]*?EMC/);
  });

  it('gives table cells their header scope and spans', async () => {
    const table = structuredClone(description);
    table.structure[1].children.push(4);
    table.structure.push(
      { id: 4, type: 'Table', parent: 1, children: [5] },
      { id: 5, type: 'TR', parent: 4, children: [6, 7] },
      { id: 6, type: 'TH', parent: 5, children: [], table: { scope: 'Column' } },
      { id: 7, type: 'TD', parent: 5, children: [], table: { colSpan: 2 } }
    );
    table.pages[1].items.push(word('Song', 20, 6), word('1965', 80, 7));
    const pdf = await writePdf(table, { fonts: [fs.readFileSync(FONT)] });
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text).toMatch(/\/A <<\n\/O \/Table\n\/Scope \/Column\n>>/);
    expect(text).toMatch(/\/A <<\n\/O \/Table\n\/ColSpan 2\n>>/);
  });

  it('ties each link annotation to its Link, on the page it is on', async () => {
    const links = structuredClone(description);
    links.structure[1].children.push(4, 5);
    links.structure.push(
      { id: 4, type: 'Link', parent: 1, children: [], link: { uri: 'https://example.com/' } },
      { id: 5, type: 'Link', parent: 1, children: [], link: { dest: 'end' } }
    );
    const box = { x: 20, y: 200, width: 60, height: 14 };
    links.pages[0].items.push(
      { kind: 'link', struct: 4, ...box },
      word('Example', 20, 4, { y: 200 })
    );
    links.pages[1].items.push(
      { kind: 'link', struct: 5, ...box },
      word('Below', 20, 5, { y: 200 }),
      { kind: 'anchor', name: 'end', x: 20, y: 300 }
    );
    const pdf = await writePdf(links, { fonts: [fs.readFileSync(FONT)] });
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text).toContain('/URI (https://example.com/)');
    expect(text).toMatch(/\/S \/GoTo\n\/D \(end\)/);
    expect(text).toContain('/Contents (Example)');
    expect(text).toContain('/Contents (Below)');
    expect(text).toMatch(/\/Dests/);
    // Each OBJR names the page its annotation is on, not the last page.
    const pages = [...text.matchAll(/\/Type \/OBJR\n\/Obj \d+ 0 R\n\/Pg (\d+) 0 R/g)].map(
      m => m[1]
    );
    expect(pages).toHaveLength(2);
    expect(new Set(pages).size).toBe(2);
  });

  it('draws backgrounds, borders and decorations as artifacts, under the text', async () => {
    const boxes = structuredClone(description);
    const solid = { width: 1, style: 'solid', color: '#000000' };
    boxes.pages[0].items.unshift(
      {
        kind: 'box',
        x: 10,
        y: 10,
        width: 100,
        height: 40,
        background: { color: '#ffff00', opacity: 0.5, x: 10, y: 10, width: 100, height: 40 },
        border: {
          top: solid,
          bottom: { ...solid, style: 'dashed' },
          left: { ...solid, style: 'inset', color: '#808080' },
        },
        collapsed: true,
      },
      {
        kind: 'box',
        x: 0,
        y: 0,
        width: 300,
        height: 20,
        border: { bottom: solid },
        pagination: true,
      },
      {
        kind: 'decoration',
        line: 'underline',
        x: 20,
        y: 20,
        width: 40,
        height: 14,
        font: 0,
        size: 12,
        color: '#0000ff',
        style: 'solid',
      }
    );
    const pdf = await writePdf(boxes, { fonts: [fs.readFileSync(FONT)] });
    const content = pageContent(pdf);
    // The yellow background, half opaque, in a layout artifact before any text.
    expect(content).toMatch(
      /^[\s\S]*?\/Artifact <<[^>]*\/Layout[^>]*>> BDC[\s\S]*?\/Gs\d+ gs[\s\S]*?1 1 0 scn[\s\S]*?EMC[\s\S]*BT/
    );
    // Inset: the shadowed left side in Chromium's darker shade of grey.
    expect(content).toMatch(/0\.172\d* 0\.172\d* 0\.172\d* scn/);
    // The dashed side is stroked with a dash pattern.
    expect(content).toMatch(/\[3 3\] 0 d/);
    expect(content).toMatch(/\/Artifact <<[^>]*\/Pagination[^>]*>> BDC/);
    // The underline is a filled blue rectangle.
    expect(content).toMatch(/re\n\/DeviceRGB cs\n0 0 1 scn\nf/);
  });

  it('keeps right-to-left words in reading order and Arabic letters joined', async () => {
    const rtl = structuredClone(description);
    rtl.direction = 'rtl';
    rtl.pages[0].items.push(word('שלום ', 200, 3), word('مرحبا', 150, 3));
    const pdf = await writePdf(rtl, { fonts: [fs.readFileSync(ARIAL)] });
    const content = pageContent(pdf);
    // Each word's text in reading order, as UTF-16 (the byte-order mark).
    expect(content.match(/\/Span <<\n\/ActualText \(\u00fe\u00ff/g)).toHaveLength(2);
    // Arabic is fitted by scaling, which keeps its letters joined; Hebrew by spacing.
    expect(content.match(/[\d.]+ Tz/g)).toHaveLength(1);
    expect(new TextDecoder('latin1').decode(pdf)).toMatch(/\/Direction \/R2L/);
  });

  it('writes the PDF/UA identifier only when asked', async () => {
    const pdf = await writePdf(
      description,
      { fonts: [fs.readFileSync(FONT)] },
      { claimPdfUa: true }
    );
    expect(new TextDecoder('latin1').decode(pdf)).toContain('<pdfuaid:part>1</pdfuaid:part>');
  });
});

describe('visualOrder', () => {
  it('reverses right-to-left words, keeping a left-to-right run in its order', () => {
    expect(visualOrder(['ספר', 'בדיקה'], true)).toEqual(['בדיקה', 'ספר']);
    expect(visualOrder(['פרק', 'Hey', 'Jude', 'שני'], true)).toEqual(['שני', 'Hey', 'Jude', 'פרק']);
    expect(visualOrder(['עמוד', '12'], true)).toEqual(['12', 'עמוד']);
  });

  it('keeps a left-to-right line in order, reversing only its right-to-left runs', () => {
    expect(visualOrder(['Chapter', 'שלום', 'עולם', 'one'], false)).toEqual([
      'Chapter',
      'עולם',
      'שלום',
      'one',
    ]);
  });
});
