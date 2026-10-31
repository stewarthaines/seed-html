/**
 * Write a tagged PDF from a page description (src/lib/pdf/page-description.ts).
 *
 * Every word is drawn where the browser drew it, fitted to its measured width;
 * the structure tree comes from the description, in reading order. Margin
 * boxes are pagination artifacts. A word the browser hyphenated is a `Span`
 * whose ActualText is the whole word, so search and screen readers get it whole.
 *
 * Runs in the browser (the plugin) and in Node (tests and the phase 0 spike).
 */
import PDFDocument from 'pdfkit';

/**
 * @param {import('../../../src/lib/pdf/page-description').PageDescription} desc
 * @param {(Uint8Array|ArrayBuffer)[]} fontFiles one font file per `desc.fonts` entry
 * @param {{ author?: string, claimPdfUa?: boolean }} [info] `claimPdfUa` writes the
 *   PDF/UA identifier into the metadata; off unless the author asks for it, since
 *   it claims conformance only a validator can confirm.
 * @returns {Promise<Uint8Array>}
 */
export function writePdf(desc, fontFiles, info = {}) {
  const doc = new PDFDocument({
    autoFirstPage: false,
    // No default Helvetica: the browser build doesn't bundle the standard
    // fonts, and every word is drawn in one of the book's own.
    font: null,
    pdfVersion: '1.7',
    tagged: true,
    ...(info.claimPdfUa ? { subset: 'PDF/UA' } : {}),
    lang: desc.lang || undefined,
    displayTitle: true,
    info: { Title: desc.title, ...(info.author ? { Author: info.author } : {}) },
  });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(concat(chunks)));
    doc.on('error', reject);
  });

  desc.fonts.forEach((_, i) => {
    const file = fontFiles[i];
    // A Uint8Array of this realm whatever arrives (an ArrayBuffer, a Buffer,
    // or a typed array from another frame), which is what PDFKit recognises.
    doc.registerFont(`f${i}`, new Uint8Array(file));
  });

  // Structure elements, attached to their parents the first time their content
  // is drawn, so each parent's children are in reading order.
  const nodes = desc.structure;
  const elements = new Map();
  const root = doc.struct(nodes[0].type);
  doc.addStructure(root);
  elements.set(0, root);
  const elementFor = id => {
    let el = elements.get(id);
    if (el) return el;
    const node = nodes[id];
    const options = {};
    if (node.lang) options.lang = node.lang;
    if (node.alt) options.alt = node.alt;
    el = doc.struct(node.type, options);
    elements.set(id, el);
    elementFor(node.parent ?? 0).add(el);
    return el;
  };

  /** The open marked-content run: one per structure element per page. */
  let open = null;
  const closeRun = () => {
    if (!open) return;
    doc.endMarkedContent();
    open.element.add(open.content);
    open = null;
  };
  const runFor = (element, type, key) => {
    if (open && open.key === key) return;
    closeRun();
    open = { key, element, content: doc.markStructureContent(type) };
  };
  const hyphenSpans = new Map();
  const outlined = new Set();

  for (const page of desc.pages) {
    doc.addPage({ size: [page.width, page.height], margin: 0 });
    for (const item of page.items) {
      if (item.kind === 'margin') {
        closeRun();
        doc.markContent('Artifact', { type: 'Pagination' });
        drawMargin(doc, item);
        doc.endMarkedContent();
        continue;
      }
      if (item.struct === null) {
        closeRun();
        doc.markContent('Artifact', { type: 'Layout' });
        drawWord(doc, item);
        doc.endMarkedContent();
        continue;
      }
      const node = nodes[item.struct];
      const element = elementFor(item.struct);
      if (/^H[1-2]$/.test(node.type) && !outlined.has(item.struct)) {
        outlined.add(item.struct);
        doc.outline.addItem(headingText(desc, item.struct));
      }
      if (item.hyphenated) {
        const key = `${item.struct}:${item.hyphenated.wholeWord}`;
        let span = hyphenSpans.get(key);
        if (!span) {
          const trailing = item.text.endsWith(' ') ? ' ' : '';
          span = doc.struct('Span', { actual: item.hyphenated.wholeWord + trailing });
          element.add(span);
          hyphenSpans.set(key, span);
        }
        if (item.hyphenated.part === 2 && item.text.endsWith(' ')) {
          // The space is known only on the second part.
          span.dictionary.data.ActualText = new String(item.hyphenated.wholeWord + ' ');
        }
        closeRun();
        const content = doc.markStructureContent('Span');
        drawWord(doc, item, item.hyphenated.part === 1);
        doc.endMarkedContent();
        span.add(content);
        if (item.hyphenated.part === 2) {
          span.end();
          hyphenSpans.delete(key);
        }
        continue;
      }
      runFor(element, node.type, `${item.struct}`);
      drawWord(doc, item);
    }
    closeRun();
  }

  const firstNumber = desc.pages[0]?.number || 1;
  doc._root.data.PageLabels = { Nums: [0, { S: 'D', St: firstNumber }] };
  doc.end();
  return done;
}

const SOFT_HYPHEN = '\u00AD';

/**
 * Make a PDFKit font draw a word-final soft hyphen with the font's own U+00AD
 * glyph, when it has one apart from the hyphen's. Tagged PDF marks a hyphen
 * the line break added as a soft hyphen (ISO 32000-1, 14.8.2.2.3), and its
 * ToUnicode entry is what lets search and copy join the word. fontkit's
 * shaping hides U+00AD as a zero-width space, so the glyph is put back here.
 * Returns whether the font draws it; otherwise the caller draws '-'.
 */
function drawsSoftHyphen(font) {
  if (font._softHyphen !== undefined) return font._softHyphen;
  const soft = font.font?.glyphForCodePoint?.(0xad);
  const hard = font.font?.glyphForCodePoint?.(0x2d);
  font._softHyphen = Boolean(soft && soft.id !== 0 && soft.id !== hard?.id);
  if (font._softHyphen) {
    const layoutRun = font.layoutRun.bind(font);
    font.layoutRun = (text, features) => {
      const run = layoutRun(text, features);
      // The soft hyphen ends the word; spaces may follow it in the run.
      const trailing = /\u00AD(\s*)$/.exec(text);
      const at = trailing ? run.glyphs.length - 1 - trailing[1].length : -1;
      if (at >= 0) {
        run.glyphs[at] = soft;
        run.positions[at].xAdvance = soft.advanceWidth * font.scale;
        run.positions[at].advanceWidth = soft.advanceWidth * font.scale;
      }
      return run;
    };
  }
  return font._softHyphen;
}

/** Draw one word at its measured box, fitted to the measured width. */
function drawWord(doc, item, withHyphen = false) {
  doc.font(`f${item.font}`).fontSize(item.size).fillColor(item.color);
  // The measured box of a hyphenated word's first part includes the hyphen.
  const hyphen = withHyphen ? (drawsSoftHyphen(doc._font) ? SOFT_HYPHEN : '-') : '';
  const visible = item.text.slice(0, item.visible) + hyphen;
  const natural = doc.widthOfString(visible);
  const glyphs = [...visible].length;
  // Spread over every glyph, not the gaps between them: the measured box
  // includes CSS letter-spacing, which the browser adds after the last letter too.
  const characterSpacing = glyphs > 0 ? (item.width - natural) / glyphs : 0;
  const text = visible + item.text.slice(item.visible);
  // Visually hidden text is drawn in text render mode 3 (neither filled nor
  // stroked): in the structure and readable, but not seen. PDFKit only writes
  // a mode when it strokes, so the one set here holds for the word.
  if (item.invisible) {
    doc.save();
    doc.addContent('3 Tr');
  }
  doc.text(text, item.x, baseline(doc, item), {
    lineBreak: false,
    baseline: 'alphabetic',
    characterSpacing: Math.abs(characterSpacing) < 0.01 ? 0 : characterSpacing,
  });
  if (item.invisible) doc.restore();
}

function drawMargin(doc, item) {
  doc.font(`f${item.font}`).fontSize(item.size).fillColor(item.color);
  const width = doc.widthOfString(item.text);
  const x =
    item.align === 'center'
      ? item.x + (item.width - width) / 2
      : item.align === 'right'
        ? item.x + item.width - width
        : item.x;
  doc.text(item.text, x, baseline(doc, item), { lineBreak: false, baseline: 'alphabetic' });
}

/**
 * The baseline of a box the browser laid out: the font's content area
 * (ascent to descent) is centred in the box, as CSS centres it in a line.
 */
function baseline(doc, item) {
  const font = doc._font;
  const ascent = (font.ascender / 1000) * item.size;
  const descent = (-font.descender / 1000) * item.size;
  return item.y + (item.height - (ascent + descent)) / 2 + ascent;
}

function headingText(desc, structId) {
  // Text from different elements (a label span and the title) gets a space.
  let text = '';
  let last = null;
  for (const page of desc.pages) {
    for (const item of page.items) {
      if (item.kind === 'text' && isWithin(desc, item.struct, structId)) {
        if (last !== null && last !== item.struct && !/\s$/.test(text)) text += ' ';
        text += item.text;
        last = item.struct;
      }
    }
  }
  return text.trim();
}

function isWithin(desc, id, ancestor) {
  for (let at = id; at !== null; at = desc.structure[at].parent) {
    if (at === ancestor) return true;
  }
  return false;
}

function concat(chunks) {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
