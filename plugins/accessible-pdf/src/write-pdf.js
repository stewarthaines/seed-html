/**
 * Write a tagged PDF from a page description (src/lib/pdf/page-description.ts).
 *
 * Every word is drawn where the browser drew it, fitted to its measured width;
 * the structure tree comes from the description, in reading order. Margin
 * boxes are pagination artifacts. A word the browser hyphenated is a `Span`
 * whose ActualText is the whole word, so search and screen readers get it whole.
 * An image is a `Figure` with its alt text, or an artifact when decorative.
 * A link is a `Link` holding its text and its annotations, one `Link` per page.
 *
 * Runs in the browser (the plugin) and in Node (tests and the phase 0 spike).
 */
import PDFDocument from 'pdfkit';

/**
 * @param {import('../../../src/lib/pdf/page-description').PageDescription} desc
 * @param {{ fonts: (Uint8Array|ArrayBuffer)[], images?: (Uint8Array|ArrayBuffer)[] }} files
 *   one font file per `desc.fonts` entry and one JPEG or PNG file per `desc.images` entry
 * @param {{ author?: string, claimPdfUa?: boolean, missingGlyphs?: Map<string, Set<string>> }} [info]
 *   `claimPdfUa` writes the PDF/UA identifier into the metadata; off unless the
 *   author asks for it, since it claims conformance only a validator can confirm.
 *   `missingGlyphs` collects, by font family, the characters a book font has no
 *   glyph for (the browser drew them from a font outside the book); they draw
 *   as the font's empty box, and their text is still in the PDF.
 * @returns {Promise<Uint8Array>}
 */
export function writePdf(desc, files, info = {}) {
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
    const file = files.fonts[i];
    // A Uint8Array of this realm whatever arrives (an ArrayBuffer, a Buffer,
    // or a typed array from another frame), which is what PDFKit recognises.
    doc.registerFont(`f${i}`, new Uint8Array(file));
  });

  // Each image file is embedded once, however often it's drawn.
  const opened = new Map();
  const imageFor = index => {
    let image = opened.get(index);
    if (!image) {
      // PDFKit takes an ArrayBuffer of this realm (or a Buffer); copy into one.
      image = doc.openImage(new Uint8Array(files.images[index]).slice().buffer);
      opened.set(index, image);
    }
    return image;
  };
  const drawImage = item => {
    // A picture larger than its box (object-fit: cover) is cut to the box.
    if (item.clip) {
      doc.save();
      doc.rect(item.clip.x, item.clip.y, item.clip.width, item.clip.height).clip();
    }
    doc.image(imageFor(item.image), item.x, item.y, { width: item.width, height: item.height });
    if (item.clip) doc.restore();
  };

  // Structure elements, attached to their parents the first time their content
  // is drawn, so each parent's children are in reading order.
  const nodes = desc.structure;
  const elements = new Map();
  const root = doc.struct(nodes[0].type);
  doc.addStructure(root);
  elements.set(0, root);
  // PDFKit gives a link annotation's object reference the page that is current
  // when its `Link` is written, so each page's part of a link is its own `Link`,
  // ended on that page, and so is anything inside it.
  const inLink = new Map();
  const isInLink = id => {
    if (id === null) return false;
    if (!inLink.has(id)) inLink.set(id, nodes[id].type === 'Link' || isInLink(nodes[id].parent));
    return inLink.get(id);
  };
  let pageIndex = 0;
  let pageLinks = [];
  const keyFor = id => (isInLink(id) ? `${id}@${pageIndex}` : id);
  const elementFor = id => {
    const key = keyFor(id);
    let el = elements.get(key);
    if (el) return el;
    const node = nodes[id];
    const options = {};
    if (node.lang) options.lang = node.lang;
    if (node.alt) options.alt = node.alt;
    el = doc.struct(node.type, options);
    if (node.table) {
      // Strings become PDF names here (Scope /Column); numbers stay numbers.
      const { scope, rowSpan, colSpan } = node.table;
      el.dictionary.data.A = {
        O: 'Table',
        ...(scope ? { Scope: scope } : {}),
        ...(rowSpan ? { RowSpan: rowSpan } : {}),
        ...(colSpan ? { ColSpan: colSpan } : {}),
      };
    }
    elements.set(key, el);
    elementFor(node.parent ?? 0).add(el);
    if (node.type === 'Link') pageLinks.push(el);
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

  for (const [index, page] of desc.pages.entries()) {
    pageIndex = index;
    doc.addPage({ size: [page.width, page.height], margin: 0 });
    for (const item of page.items) {
      if (item.kind === 'anchor') {
        doc.addNamedDestination(item.name, 'XYZ', item.x, item.y, null);
        continue;
      }
      if (item.kind === 'link') {
        closeRun();
        const { link } = nodes[item.struct];
        const options = {
          structParent: elementFor(item.struct),
          // PDF/UA: a link annotation describes itself; its text does.
          Contents: new String(textWithin(desc, item.struct)),
        };
        if ('uri' in link) doc.link(item.x, item.y, item.width, item.height, link.uri, options);
        else doc.goTo(item.x, item.y, item.width, item.height, link.dest, options);
        continue;
      }
      if ((item.kind === 'text' || item.kind === 'margin') && info.missingGlyphs) {
        noteMissingGlyphs(doc, desc, item, info.missingGlyphs);
      }
      if (item.kind === 'box' || item.kind === 'decoration' || item.kind === 'symbol') {
        closeRun();
        doc.markContent('Artifact', {
          type: item.kind === 'box' && item.pagination ? 'Pagination' : 'Layout',
        });
        if (item.kind === 'box') drawBox(doc, item);
        else if (item.kind === 'symbol') drawSymbol(doc, item);
        else drawDecoration(doc, item);
        doc.endMarkedContent();
        continue;
      }
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
        if (item.kind === 'image') drawImage(item);
        else drawWord(doc, item);
        doc.endMarkedContent();
        continue;
      }
      if (item.kind === 'image') {
        closeRun();
        const content = doc.markStructureContent('Figure');
        drawImage(item);
        doc.endMarkedContent();
        const figure = elementFor(item.struct);
        figure.add(content);
        // PDF/UA: a Figure gives the box it occupies on the page, in PDF space
        // (origin bottom left); a cut picture occupies only its clip box, and
        // a full-bleed one only the page.
        const box = item.clip ?? item;
        const left = Math.max(0, box.x);
        const right = Math.min(page.width, box.x + box.width);
        const top = Math.max(0, box.y);
        const bottom = Math.min(page.height, box.y + box.height);
        figure.dictionary.data.A = {
          O: 'Layout',
          // A Figure is inline unless it says otherwise.
          ...(nodes[item.struct].placement ? { Placement: nodes[item.struct].placement } : {}),
          BBox: [left, page.height - bottom, right, page.height - top],
        };
        continue;
      }
      const node = nodes[item.struct];
      const element = elementFor(item.struct);
      if (/^H[1-2]$/.test(node.type) && !outlined.has(item.struct)) {
        outlined.add(item.struct);
        doc.outline.addItem(textWithin(desc, item.struct));
      }
      if (item.hyphenated) {
        const key = `${item.struct}:${item.hyphenated.wholeWord}`;
        let span = hyphenSpans.get(key);
        // A word split across pages inside a link: its Span ended with the
        // first page's Link, so the rest gets a Span of its own.
        if (span?._ended) span = undefined;
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
      runFor(element, node.type, `${keyFor(item.struct)}`);
      const actual = item.actual ?? (RIGHT_TO_LEFT.test(item.text) ? item.text : null);
      if (actual !== null) {
        // fontkit lays a right-to-left word out in visual order (and a
        // right-to-left list marker is drawn suffix first); its text in
        // reading order goes with it, for search, copying and screen readers.
        doc.markContent('Span', { actual });
        drawWord(doc, item);
        doc.endMarkedContent();
      } else {
        drawWord(doc, item);
      }
    }
    closeRun();
    for (const link of pageLinks) link.end();
    pageLinks = [];
  }

  if (desc.direction === 'rtl') doc._root.data.ViewerPreferences.data.Direction = 'R2L';
  const firstNumber = desc.pages[0]?.number || 1;
  doc._root.data.PageLabels = { Nums: [0, { S: 'D', St: firstNumber }] };
  doc.end();
  return done;
}

const SOFT_HYPHEN = '\u00AD';

/** Scripts written right to left. */
const RIGHT_TO_LEFT =
  /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Adlam}\p{Script=Hanifi_Rohingya}]/u;
/**
 * Scripts whose letters join, which letter spacing would pull apart: a word
 * in one is fitted to its measured width by scaling it instead.
 */
const JOINED =
  /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Nko}\p{Script=Mongolian}\p{Script=Mandaic}\p{Script=Adlam}\p{Script=Hanifi_Rohingya}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}]/u;

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

/** Record the characters of a word or margin text its font has no glyph for. */
function noteMissingGlyphs(doc, desc, item, missing) {
  doc.font(`f${item.font}`);
  const font = doc._font.font;
  if (!font?.hasGlyphForCodePoint) return;
  for (const char of item.kind === 'text' ? item.text.slice(0, item.visible) : item.text) {
    const code = char.codePointAt(0);
    if (/\s/.test(char) || code === 0xad || font.hasGlyphForCodePoint(code)) continue;
    const family = desc.fonts[item.font].family
      .split(',')[0]
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!missing.has(family)) missing.set(family, new Set());
    missing.get(family).add(char);
  }
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
  const spacing = glyphs > 0 ? (item.width - natural) / glyphs : 0;
  const fit =
    JOINED.test(visible) && natural > 0
      ? { horizontalScaling: (item.width / natural) * 100 }
      : { characterSpacing: Math.abs(spacing) < 0.01 ? 0 : spacing };
  // fontkit puts a right-to-left word's trailing space on its left, which
  // would push the word off its measured place; the space is in its ActualText.
  const text = RIGHT_TO_LEFT.test(visible) ? visible : visible + item.text.slice(item.visible);
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
    ...fit,
  });
  if (item.invisible) doc.restore();
}

/** An element's background and border, as the browser paints them. */
function drawBox(doc, item) {
  const background = item.background;
  if (background) {
    doc.save();
    if (background.opacity !== undefined) doc.fillOpacity(background.opacity);
    // A background inside the border has the border's corner, less the border.
    const inset = Math.min(background.x - item.x, background.y - item.y);
    const radius = Math.max(0, (item.radius ?? 0) - inset);
    const { x, y, width, height } = background;
    // Colours are set before a path starts: PDFKit's fill(color) writes the
    // colour inside the path, which PDF doesn't allow.
    doc.fillColor(background.color);
    (radius > 0
      ? doc.roundedRect(x, y, width, height, radius)
      : doc.rect(x, y, width, height)
    ).fill();
    doc.restore();
  }
  if (!item.border) return;
  const { top, right, bottom, left } = item.border;
  const w = {
    top: top?.width ?? 0,
    right: right?.width ?? 0,
    bottom: bottom?.width ?? 0,
    left: left?.width ?? 0,
  };
  // A collapsed table border is centred on the edge; any other is inside it.
  const out = item.collapsed ? 0.5 : 0;
  const outer = {
    x0: item.x - w.left * out,
    y0: item.y - w.top * out,
    x1: item.x + item.width + w.right * out,
    y1: item.y + item.height + w.bottom * out,
  };
  const inner = {
    x0: outer.x0 + w.left,
    y0: outer.y0 + w.top,
    x1: outer.x1 - w.right,
    y1: outer.y1 - w.bottom,
  };
  const sides = [top, right, bottom, left].filter(Boolean);
  if (
    item.radius &&
    sides.length === 4 &&
    sides.every(s => sameLook(s, top) && s.style === 'solid')
  ) {
    // A round box with one border all round: a stroke down its middle.
    doc.save();
    if (top.opacity !== undefined) doc.strokeOpacity(top.opacity);
    const half = top.width / 2;
    doc
      .lineWidth(top.width)
      .strokeColor(top.color)
      .roundedRect(
        outer.x0 + half,
        outer.y0 + half,
        outer.x1 - outer.x0 - top.width,
        outer.y1 - outer.y0 - top.width,
        Math.max(0, item.radius - half)
      )
      .stroke();
    doc.restore();
    return;
  }
  for (const [name, side] of Object.entries(item.border)) drawSide(doc, name, side, outer, inner);
}

function sameLook(a, b) {
  return (
    a.width === b.width && a.style === b.style && a.color === b.color && a.opacity === b.opacity
  );
}

/** The part of a border between two of its edge rectangles, mitred at the corners. */
function band(name, a, b) {
  switch (name) {
    case 'top':
      return [
        [a.x0, a.y0],
        [a.x1, a.y0],
        [b.x1, b.y0],
        [b.x0, b.y0],
      ];
    case 'right':
      return [
        [a.x1, a.y0],
        [a.x1, a.y1],
        [b.x1, b.y1],
        [b.x1, b.y0],
      ];
    case 'bottom':
      return [
        [a.x1, a.y1],
        [a.x0, a.y1],
        [b.x0, b.y1],
        [b.x1, b.y1],
      ];
    default:
      return [
        [a.x0, a.y1],
        [a.x0, a.y0],
        [b.x0, b.y0],
        [b.x0, b.y1],
      ];
  }
}

/** The rectangle a fraction `t` of the way from the outer edge to the inner. */
function between(a, b, t) {
  return {
    x0: a.x0 + (b.x0 - a.x0) * t,
    y0: a.y0 + (b.y0 - a.y0) * t,
    x1: a.x1 + (b.x1 - a.x1) * t,
    y1: a.y1 + (b.y1 - a.y1) * t,
  };
}

/**
 * The shade Chromium paints a side of an inset, outset, groove or ridge border:
 * the shadowed sides darker, the lit ones lighter, unless the colour is
 * already near black or white (CalculateBorderStyleColor, Color::Dark/Light).
 */
function shade(hex, darken) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const distance = to => rgb.reduce((sum, c, i) => sum + (c - to[i]) ** 2, 0);
  const [r, g, b] = rgb.map(c => c / 255);
  const v = Math.max(r, g, b);
  let k;
  if (darken) {
    if (distance([0, 0, 0]) <= 3 * 32 ** 2) return hex;
    if (r === 1 && g === 1 && b === 1) return '#ababab';
    k = Math.max(0, (v - 0.33) / v);
  } else {
    if (distance([255, 255, 255]) <= 3 * 20 ** 2) return hex;
    if (v === 0) return '#545454';
    k = Math.min(1, v + 0.33) / v;
  }
  return (
    '#' +
    [r, g, b]
      .map(c =>
        Math.floor(c * k * 255.99)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

/** The colour of a side drawn as inset or outset (a groove or ridge is one of each). */
function bevel(color, name, style) {
  const shadowed = name === 'top' || name === 'left';
  return shade(color, shadowed === (style === 'inset'));
}

function drawSide(doc, name, side, outer, inner) {
  const fill = (a, b, color) =>
    doc
      .fillColor(color)
      .polygon(...band(name, a, b))
      .fill();
  doc.save();
  if (side.opacity !== undefined) doc.fillOpacity(side.opacity).strokeOpacity(side.opacity);
  const mid = between(outer, inner, 0.5);
  switch (side.style) {
    case 'double':
      fill(outer, between(outer, inner, 1 / 3), side.color);
      fill(between(outer, inner, 2 / 3), inner, side.color);
      break;
    case 'inset':
    case 'outset':
      fill(outer, inner, bevel(side.color, name, side.style));
      break;
    case 'groove':
    case 'ridge':
      // A groove is inset outside and outset inside; a ridge the reverse.
      fill(outer, mid, bevel(side.color, name, side.style === 'groove' ? 'inset' : 'outset'));
      fill(mid, inner, bevel(side.color, name, side.style === 'groove' ? 'outset' : 'inset'));
      break;
    case 'dashed':
    case 'dotted': {
      const wd = side.width;
      const [from, to] = {
        top: [
          [outer.x0, mid.y0],
          [outer.x1, mid.y0],
        ],
        right: [
          [mid.x1, outer.y0],
          [mid.x1, outer.y1],
        ],
        bottom: [
          [outer.x0, mid.y1],
          [outer.x1, mid.y1],
        ],
        left: [
          [mid.x0, outer.y0],
          [mid.x0, outer.y1],
        ],
      }[name];
      doc.lineWidth(wd);
      if (side.style === 'dashed') doc.dash(wd * 3, { space: wd * 3 });
      else if (wd < 3) doc.dash(wd, { space: wd });
      else doc.lineCap('round').dash(0.001, { space: wd * 2 });
      doc
        .strokeColor(side.color)
        .moveTo(...from)
        .lineTo(...to)
        .stroke();
      doc.undash();
      break;
    }
    default:
      fill(outer, inner, side.color);
  }
  doc.restore();
}

/** Chromium's gap between a bullet and the text it marks, in CSS pixels (kCMarkerPaddingPx). */
const MARKER_PADDING_PX = 7;
const PX = 0.75;

/**
 * A disc, circle or square bullet, sized and placed as Chromium paints it
 * (ListMarker): two thirds of the font's ascent set the bullet's room, half
 * that its size, and it sits that far above the baseline, in whole pixels.
 */
function drawSymbol(doc, item) {
  doc.font(`f${item.font}`).fontSize(item.size);
  const ascent = Math.round(((doc._font.ascender / 1000) * item.size) / PX);
  const offset = Math.floor((ascent * 2) / 3);
  const side = Math.floor((offset + 1) / 2) * PX;
  const reach = (offset + MARKER_PADDING_PX) * PX;
  const x = item.rtl ? item.x + reach - side : item.x - reach;
  const y = baseline(doc, item) - ascent * PX + Math.floor((3 * (ascent - offset)) / 2) * PX;
  doc.save().fillColor(item.color).strokeColor(item.color);
  if (item.shape === 'square') {
    doc.rect(x, y, side, side).fill();
  } else if (item.shape === 'circle') {
    doc
      .lineWidth(PX)
      .circle(x + side / 2, y + side / 2, (side - PX) / 2)
      .stroke();
  } else {
    doc.circle(x + side / 2, y + side / 2, side / 2).fill();
  }
  doc.restore();
}

/** An underline, overline or line-through on one line of an inline element. */
function drawDecoration(doc, item) {
  doc.font(`f${item.font}`).fontSize(item.size);
  const font = doc._font;
  const metrics = font.font;
  const em = metrics?.unitsPerEm || 1000;
  const units = v => (v / em) * item.size;
  const base = baseline(doc, item);
  const thickness = item.thickness ?? Math.max(units(metrics?.underlineThickness || em / 14), 0.25);
  let top;
  if (item.line === 'underline') {
    top =
      item.offset !== undefined
        ? base + item.offset
        : base - units(metrics?.underlinePosition ?? -em / 10);
  } else if (item.line === 'line-through') {
    const os2 = metrics?.['OS/2'];
    top =
      base -
      (os2?.yStrikeoutPosition
        ? units(os2.yStrikeoutPosition)
        : units(metrics?.xHeight || em / 2) / 2);
  } else {
    top = base - (font.ascender / 1000) * item.size;
  }
  const { x, width } = item;
  doc.save().fillColor(item.color).strokeColor(item.color);
  switch (item.style) {
    case 'double':
      doc
        .rect(x, top, width, thickness)
        .rect(x, top + thickness * 2, width, thickness)
        .fill();
      break;
    case 'dotted':
    case 'dashed': {
      const y = top + thickness / 2;
      doc.lineWidth(thickness);
      if (item.style === 'dashed') doc.dash(thickness * 3, { space: thickness * 3 });
      else doc.dash(thickness, { space: thickness });
      doc
        .moveTo(x, y)
        .lineTo(x + width, y)
        .stroke();
      doc.undash();
      break;
    }
    case 'wavy': {
      const amplitude = Math.max(thickness, 0.75);
      const step = amplitude * 2;
      const y = top + amplitude;
      doc.lineWidth(thickness).moveTo(x, y);
      for (let at = x, up = true; at < x + width; at += step, up = !up) {
        doc.quadraticCurveTo(
          at + step / 2,
          y + (up ? -amplitude : amplitude) * 2,
          Math.min(at + step, x + width),
          y
        );
      }
      doc.stroke();
      break;
    }
    default:
      doc.rect(x, top, width, thickness).fill();
  }
  doc.restore();
}

function drawMargin(doc, item) {
  doc.font(`f${item.font}`).fontSize(item.size).fillColor(item.color);
  const y = baseline(doc, item);
  const place = width =>
    item.align === 'center'
      ? item.x + (item.width - width) / 2
      : item.align === 'right'
        ? item.x + item.width - width
        : item.x;
  if (!RIGHT_TO_LEFT.test(item.text)) {
    doc.text(item.text, place(doc.widthOfString(item.text)), y, {
      lineBreak: false,
      baseline: 'alphabetic',
    });
    return;
  }
  // PDFKit lays a string out a word at a time in reading order, which reverses
  // right-to-left words against each other: draw them one by one, in the order
  // they're seen.
  const words = visualOrder(item.text.trim().split(/\s+/), item.direction === 'rtl');
  const space = doc.widthOfString(' ');
  const widths = words.map(w => doc.widthOfString(w));
  let x = place(widths.reduce((sum, w) => sum + w, 0) + space * (words.length - 1));
  words.forEach((w, i) => {
    doc.text(w, x, y, { lineBreak: false, baseline: 'alphabetic' });
    x += widths[i] + space;
  });
}

/**
 * Words in the order they're seen, left to right: a simple form of the
 * Unicode bidirectional algorithm for a line of words. Runs of right-to-left
 * words read right to left; in a right-to-left line, so do the runs.
 */
export function visualOrder(words, rtlLine) {
  const runs = [];
  for (const word of words) {
    // Digits and punctuation take the direction of the run they're in.
    const rtl = RIGHT_TO_LEFT.test(word) ? true : /\p{L}/u.test(word) ? false : null;
    const last = runs[runs.length - 1];
    if (last && (rtl === null || last.rtl === rtl || last.rtl === null)) {
      last.words.push(word);
      if (last.rtl === null) last.rtl = rtl;
    } else {
      runs.push({ rtl, words: [word] });
    }
  }
  const ordered = rtlLine ? runs.reverse() : runs;
  return ordered.flatMap(run => ((run.rtl ?? rtlLine) ? [...run.words].reverse() : run.words));
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

/** The text of a structure node and everything in it, across pages. */
function textWithin(desc, structId) {
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
