/**
 * Page description — what a paginated book draws where, measured from the
 * browser's own layout, for a PDF writer to replay (process/ACCESSIBLE_PDF_PDFKIT.md).
 *
 * `describePages` walks a document Paged.js has paginated and records every
 * word's text, rectangle, font and colour, every margin box, and the structure
 * tree the words belong to. The result is plain data: it can be posted to the
 * PDF plugin, saved, and compared between browsers. Nothing here draws a PDF.
 *
 * Coordinates are PDF points from the page box's top-left corner.
 */

/** Version of the page description format. */
export const PAGE_DESCRIPTION_VERSION = 1;

/** A font as the browser chose it for a run of text. */
export interface FontUse {
  /** The computed `font-family` list, as written in the CSS. */
  family: string;
  weight: number;
  style: 'normal' | 'italic' | 'oblique';
}

/** A word (with any space after it) drawn at its measured place. */
export interface TextItem {
  kind: 'text';
  /** Text to draw, including a trailing space when the word had one. */
  text: string;
  /** Characters of `text` that are visible (without the trailing space). */
  visible: number;
  /** The measured box of the visible characters. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Index into `PageDescription.fonts`. */
  font: number;
  size: number;
  /** `#rrggbb`. */
  color: string;
  /** The structure node this text belongs to, or null for an artifact. */
  struct: number | null;
  /**
   * A word the browser hyphenated at a line end, in two parts. Part 1's box
   * includes the hyphen, which the writer draws after `text`; the whole word
   * is `wholeWord`.
   */
  hyphenated?: { wholeWord: string; part: 1 | 2 };
  /**
   * Text the book hides visually but keeps for screen readers (a
   * `.visually-hidden` heading): in the structure, drawn invisibly.
   */
  invisible?: true;
}

/** Margin-box text (running heads, page numbers): always an artifact. */
export interface MarginItem {
  kind: 'margin';
  text: string;
  /** The margin box. The writer aligns `text` inside it by `align`. */
  x: number;
  y: number;
  width: number;
  height: number;
  align: 'left' | 'center' | 'right';
  font: number;
  size: number;
  color: string;
}

/**
 * An image drawn where the browser drew it. A Figure carrying its alt text,
 * or an artifact when the book marks it decorative (`alt=""`).
 */
export interface ImageItem {
  kind: 'image';
  /** Index into `PageDescription.images`. */
  image: number;
  /** The whole picture, placed by `object-fit` and `object-position`. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The element's content box, when the picture overflows it (`object-fit: cover`). */
  clip?: { x: number; y: number; width: number; height: number };
  /** The `Figure` structure node, or null for a decorative image. */
  struct: number | null;
}

export type DrawItem = TextItem | MarginItem | ImageItem;

export interface PageBox {
  /** Page size in points. */
  width: number;
  height: number;
  /** The page number Paged.js gave the page. */
  number: number;
  items: DrawItem[];
}

/** One node of the structure tree. Content order is the order of its items. */
export interface StructNode {
  id: number;
  /** PDF standard structure type: `Sect`, `P`, `H1`, `Span`, … */
  type: string;
  parent: number | null;
  /** Children in reading order (structure node ids). */
  children: number[];
  lang?: string;
  alt?: string;
  /** A table cell's attributes (the `Table` attribute owner). */
  table?: TableCellAttributes;
}

export interface TableCellAttributes {
  /** Which cells a `TH` heads; PDF/UA requires it of every header cell. */
  scope?: 'Row' | 'Column' | 'Both';
  rowSpan?: number;
  colSpan?: number;
}

export interface PageDescription {
  version: typeof PAGE_DESCRIPTION_VERSION;
  title: string;
  lang: string;
  fonts: FontUse[];
  /** The URL of each image the pages draw, as the paginated document loaded it. */
  images: string[];
  pages: PageBox[];
  /** Node 0 is the `Document` root. */
  structure: StructNode[];
  /**
   * What the PDF can't reproduce yet, each as the CSS or element concerned
   * (`font-variant-caps: small-caps`, `img`), for the export to list.
   */
  problems: string[];
  /**
   * Page numbers with text laid out beyond the page edge, which no reader
   * sees: content Paged.js let overflow lands in a clipped column off the page.
   */
  overflowPages: number[];
}

const PX_TO_PT = 0.75;

/** The hyphen Paged.js writes where it splits a word across pages (U+2011). */
const PAGE_SPLIT_HYPHEN = '\u2011';
/**
 * Where that hyphen would push the line over, the vendored Paged.js hangs it
 * in a zero-width box after the text instead (patches/paged.polyfill.md).
 */
const HANGING_HYPHEN_CLASS = 'pagedjs_hyphen_hang';

/** Elements the PDF doesn't draw yet; each is listed as a problem. */
const REPLACED_ELEMENTS = new Set(['svg', 'video', 'audio', 'canvas', 'iframe', 'object']);

/** HTML element → PDF structure type; elements not listed are transparent. */
const STRUCT_TYPES: Record<string, string> = {
  section: 'Sect',
  article: 'Art',
  div: 'Div',
  main: 'Div',
  header: 'Div',
  footer: 'Div',
  aside: 'Note',
  p: 'P',
  h1: 'H1',
  h2: 'H2',
  h3: 'H3',
  h4: 'H4',
  h5: 'H5',
  h6: 'H6',
  blockquote: 'BlockQuote',
  ul: 'L',
  ol: 'L',
  li: 'LI',
  // The `Figure` is the image, which carries the alt text: a screen reader
  // reads a Figure's alt in place of its content, so the caption stays outside.
  figure: 'Div',
  figcaption: 'Caption',
  table: 'Table',
  caption: 'Caption',
  thead: 'THead',
  tbody: 'TBody',
  tfoot: 'TFoot',
  tr: 'TR',
  th: 'TH',
  td: 'TD',
  // No `Link` until links carry their annotations (phase 3): the text stays,
  // the link is listed as a problem.
};

/**
 * Describe the pages of a document Paged.js has paginated.
 *
 * Book elements carry Paged.js's `data-ref`, which a split element's pieces
 * share, so a paragraph split across pages is one structure node with content
 * on both pages. Paged.js's own wrappers carry no `data-ref` and are skipped.
 *
 * The title comes from the caller, which has the OPF: the paginated document's
 * own `<title>` is the preview's label or a chapter's, not the book's.
 */
export function describePages(doc: Document, book: { title: string }): PageDescription {
  const win = doc.defaultView;
  if (!win) throw new Error('describePages: the document has no window');
  const lang = doc.documentElement.getAttribute('lang') ?? '';
  const fonts: FontUse[] = [];
  const fontKeys = new Map<string, number>();
  const images: string[] = [];
  const problems = new Set<string>();
  const overflowPages: number[] = [];
  const structure: StructNode[] = [{ id: 0, type: 'Document', parent: null, children: [] }];
  const structByRef = new Map<string, number>();
  // A word Paged.js split across a page break: its first part, by structure
  // node, waiting for the rest on the next page.
  const pageSplitWords = new Map<number, TextItem>();
  const segmenter = new Intl.Segmenter(lang || undefined, { granularity: 'word' });

  const fontIndex = (style: CSSStyleDeclaration): number => {
    const use: FontUse = {
      family: style.fontFamily,
      weight: Number(style.fontWeight) || 400,
      style: style.fontStyle.startsWith('italic')
        ? 'italic'
        : style.fontStyle.startsWith('oblique')
          ? 'oblique'
          : 'normal',
    };
    const key = `${use.family}|${use.weight}|${use.style}`;
    let index = fontKeys.get(key);
    if (index === undefined) {
      index = fonts.length;
      fonts.push(use);
      fontKeys.set(key, index);
    }
    return index;
  };

  /** The structure node for a book element, created the first time it's met. */
  const structFor = (el: Element, parent: number, as?: { type: string; alt?: string }): number => {
    const ref = el.getAttribute('data-ref');
    const existing = ref ? structByRef.get(ref) : undefined;
    if (existing !== undefined) return existing;
    const tag = el.localName;
    let type = as?.type ?? STRUCT_TYPES[tag];
    const elLang = el.getAttribute('lang') ?? el.getAttribute('xml:lang');
    if (!type && elLang && elLang !== lang) type = 'Span';
    if (!type) return parent;
    const node: StructNode = { id: structure.length, type, parent, children: [] };
    if (elLang && elLang !== lang) node.lang = elLang;
    if (as?.alt) node.alt = as.alt;
    if (tag === 'th' || tag === 'td') {
      const table = tableCellAttributes(el);
      if (Object.keys(table).length > 0) node.table = table;
    }
    structure.push(node);
    structure[parent].children.push(node.id);
    if (ref) structByRef.set(ref, node.id);
    return node.id;
  };

  const pageEls = Array.from(doc.querySelectorAll<HTMLElement>('.pagedjs_page'));
  const pages = pageEls.map(pageEl => {
    const pageRect = pageEl.getBoundingClientRect();
    // The preview may scale the pages; offsetWidth is the unscaled CSS width.
    const scale = pageRect.width / pageEl.offsetWidth;
    const toPt = (v: number) => (v / scale) * PX_TO_PT;
    const box = (r: DOMRect) => ({
      x: toPt(r.left - pageRect.left),
      y: toPt(r.top - pageRect.top),
      width: toPt(r.width),
      height: toPt(r.height),
    });
    const page: PageBox = {
      width: toPt(pageRect.width),
      height: toPt(pageRect.height),
      number: Number(pageEl.dataset.pageNumber) || 0,
      items: [],
    };

    const walk = (node: Node, struct: number, hidden = false) => {
      if (node.nodeType === Node.TEXT_NODE) {
        measureText(node as Text, struct, hidden);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      if (el.getAttribute('aria-hidden') === 'true') return;
      // Measured with the text before it.
      if (el.classList.contains(HANGING_HYPHEN_CLASS)) return;
      const style = win.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      // Images and drawings come in phase 2 (process/ACCESSIBLE_PDF_PDFKIT.md).
      if (REPLACED_ELEMENTS.has(el.localName)) {
        problems.add(el.localName);
        return;
      }
      if (el.localName === 'img') {
        measureImage(el as HTMLImageElement, struct, style);
        return;
      }
      if (el.localName === 'a' && el.hasAttribute('href')) problems.add('a[href]');
      const here = el.hasAttribute('data-ref') ? structFor(el, struct) : struct;
      const block = !style.display.startsWith('inline') && style.display !== 'contents';
      const hiddenHere = hidden || isVisuallyHidden(style);
      if (block) separate();
      for (const child of Array.from(el.childNodes)) walk(child, here, hiddenHere);
      if (block) separate();
    };

    // Text either side of a block boundary (a label above a heading's title)
    // is separate words: end the previous word with a space if it has none.
    const separate = () => {
      const last = page.items[page.items.length - 1];
      // Not after the first part of a hyphenated word: the word goes on.
      if (last?.kind === 'text' && !/\s$/.test(last.text) && last.hyphenated?.part !== 1) {
        last.text += ' ';
      }
    };

    const measureImage = (img: HTMLImageElement, struct: number, style: CSSStyleDeclaration) => {
      const url = img.currentSrc || img.src;
      // A broken image draws nothing the PDF could copy.
      if (!url || img.naturalWidth === 0) {
        problems.add('img');
        return;
      }
      // The content box, inside any border and padding.
      const px = (v: string) => (parseFloat(v) || 0) * scale;
      const r = img.getBoundingClientRect();
      const left = px(style.borderLeftWidth) + px(style.paddingLeft);
      const top = px(style.borderTopWidth) + px(style.paddingTop);
      const right = px(style.borderRightWidth) + px(style.paddingRight);
      const bottom = px(style.borderBottomWidth) + px(style.paddingBottom);
      const contentBox = new DOMRect(
        r.left + left,
        r.top + top,
        r.width - left - right,
        r.height - top - bottom
      );
      const picture = placePicture(
        contentBox,
        { width: img.naturalWidth * scale, height: img.naturalHeight * scale },
        style.objectFit,
        style.objectPosition,
        scale
      );
      const clipped =
        picture.left < contentBox.left - 0.5 ||
        picture.top < contentBox.top - 0.5 ||
        picture.right > contentBox.right + 0.5 ||
        picture.bottom > contentBox.bottom + 0.5;
      let image = images.indexOf(url);
      if (image < 0) image = images.push(url) - 1;
      const alt = img.getAttribute('alt');
      page.items.push({
        kind: 'image',
        image,
        ...box(picture),
        ...(clipped ? { clip: box(contentBox) } : {}),
        // alt="" marks a decorative image; no alt at all is still a figure,
        // which a checker reports as missing its alt text.
        struct: alt === '' ? null : structFor(img, struct, { type: 'Figure', alt: alt?.trim() }),
      });
    };

    const measureText = (text: Text, struct: number, hidden: boolean) => {
      const value = text.data;
      if (!value.trim()) return;
      const parent = text.parentElement;
      if (!parent) return;
      const style = win.getComputedStyle(parent);
      const font = fontIndex(style);
      const size = toPt(parseFloat(style.fontSize) * scale);
      const color = cssColorToHex(style.color);
      const shown = textTransformer(style.textTransform);
      if (style.fontVariantCaps !== 'normal') {
        problems.add(`font-variant-caps: ${style.fontVariantCaps}`);
      }
      const invisible = hidden ? { invisible: true as const } : {};
      // Paged.js ends a page's part of a paragraph it split mid-word with a
      // non-breaking hyphen in the text itself (on a .pagedjs_hyphen element).
      // It is drawn as the writer draws any line-end hyphen, and the word is
      // joined with its rest on the next page. A hanging hyphen follows the
      // text in its own box.
      const hanging =
        text.nextSibling instanceof win.Element &&
        text.nextSibling.classList.contains(HANGING_HYPHEN_CLASS)
          ? text.nextSibling
          : null;
      const pageHyphen =
        hanging !== null ||
        (value.endsWith(PAGE_SPLIT_HYPHEN) && parent.closest('.pagedjs_hyphen') !== null);
      const words = pageHyphen && !hanging ? value.slice(0, -1) : value;
      const range = doc.createRange();
      const segments = Array.from(segmenter.segment(words));
      const lastWord = segments.findLastIndex(seg => seg.segment.trim() !== '');
      segments.forEach((seg, i) => {
        if (!seg.segment.trim()) return;
        const start = seg.index;
        const splitHere = pageHyphen && i === lastWord;
        // The box of the page's last word includes the hyphen.
        const end = splitHere ? value.length : start + seg.segment.length;
        const next = segments[i + 1];
        const space = next && !next.segment.trim() ? next.segment.replace(/\s+/g, ' ') : '';
        range.setStart(text, start);
        range.setEnd(text, end);
        const rects = Array.from(range.getClientRects()).filter(r => r.width > 0);
        if (rects.length === 0) return;
        if (splitHere && hanging) {
          // The glyph, not its zero-width box.
          const glyph = doc.createRange();
          glyph.selectNodeContents(hanging);
          rects.push(glyph.getBoundingClientRect());
        }
        // A word can come back as several boxes on one line (Chrome splits at
        // glyph runs); only boxes on different lines mean a hyphenated word.
        const onOneLine = rects.every(r => !onAnotherLine(r, rects[0]));
        if (onOneLine) {
          const item: TextItem = {
            kind: 'text',
            text: shown(seg.segment) + (splitHere ? '' : space),
            visible: shown(seg.segment).length,
            ...box(union(rects)),
            font,
            size,
            color,
            struct,
            ...invisible,
          };
          const firstPart = pageSplitWords.get(struct);
          if (splitHere) {
            item.hyphenated = { wholeWord: seg.segment, part: 1 };
            pageSplitWords.set(struct, item);
          } else if (firstPart?.hyphenated) {
            const wholeWord = firstPart.hyphenated.wholeWord + seg.segment;
            firstPart.hyphenated.wholeWord = wholeWord;
            item.hyphenated = { wholeWord, part: 2 };
            pageSplitWords.delete(struct);
          }
          page.items.push(item);
          return;
        }
        // The browser broke the word across lines (auto hyphens): find where.
        // The first part's box includes the hyphen the browser drew at the line
        // end; the second part's is the boxes on the last line.
        const breakAt = lineBreakOffset(text, start, end, range);
        const first = value.slice(start, breakAt);
        const second = value.slice(breakAt, end);
        const lastLine = rects[rects.length - 1];
        const firstRect = union(rects.filter(r => !onAnotherLine(r, rects[0])));
        const lastRect = union(rects.filter(r => !onAnotherLine(r, lastLine)));
        page.items.push({
          kind: 'text',
          text: shown(first),
          visible: shown(first).length,
          ...box(firstRect),
          font,
          size,
          color,
          struct,
          ...invisible,
          hyphenated: { wholeWord: seg.segment, part: 1 },
        });
        page.items.push({
          kind: 'text',
          text: shown(second) + space,
          visible: shown(second).length,
          ...box(lastRect),
          font,
          size,
          color,
          struct,
          ...invisible,
          hyphenated: { wholeWord: seg.segment, part: 2 },
        });
      });
    };

    const content = pageEl.querySelector('.pagedjs_page_content');
    if (content) walk(content, 0);

    for (const marginContent of Array.from(
      pageEl.querySelectorAll<HTMLElement>('.pagedjs_margin-content')
    )) {
      const after = win.getComputedStyle(marginContent, '::after');
      const text = resolveMarginContent(after.content, page.number);
      if (text === null) {
        if (after.content !== 'none' && after.content !== 'normal') {
          problems.add(`content: ${after.content}`);
        }
        continue;
      }
      page.items.push({
        kind: 'margin',
        text,
        ...box(marginContent.getBoundingClientRect()),
        align: textAlign(after.textAlign),
        font: fontIndex(after),
        size: toPt(parseFloat(after.fontSize) * scale),
        color: cssColorToHex(after.color),
      });
    }
    const off = page.items.some(
      it => it.kind === 'text' && !it.invisible && (it.x >= page.width || it.y >= page.height)
    );
    if (off) overflowPages.push(page.number);
    return page;
  });

  return {
    version: PAGE_DESCRIPTION_VERSION,
    title: book.title,
    lang,
    fonts,
    images,
    pages,
    structure,
    problems: Array.from(problems),
    overflowPages,
  };
}

/**
 * Whether an element is hidden from sight but not from screen readers, by the
 * usual visually-hidden recipe: clipped to nothing, or a 1px box that hides
 * its overflow.
 */
export function isVisuallyHidden(
  style: Pick<CSSStyleDeclaration, 'clipPath' | 'clip' | 'overflow' | 'width' | 'height'>
): boolean {
  if (style.clipPath === 'inset(50%)') return true;
  if (/^rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)$/.test(style.clip)) return true;
  return (
    style.overflow === 'hidden' && parseFloat(style.width) <= 1 && parseFloat(style.height) <= 1
  );
}

/**
 * A table cell's PDF attributes from its HTML: the header scope of a `th`
 * (its `scope`, or else a column header in `thead` or in a row of headers, and
 * a row header otherwise) and any row or column span.
 */
export function tableCellAttributes(cell: Element): TableCellAttributes {
  const out: TableCellAttributes = {};
  if (cell.localName === 'th') {
    const scope = cell.getAttribute('scope')?.toLowerCase();
    const row = cell.parentElement;
    const inHead = cell.closest('thead') !== null;
    const allHeaders = row !== null && Array.from(row.children).every(c => c.localName === 'th');
    out.scope =
      scope === 'row' || scope === 'rowgroup'
        ? 'Row'
        : scope === 'col' || scope === 'colgroup'
          ? 'Column'
          : inHead || allHeaders
            ? 'Column'
            : 'Row';
  }
  const rowSpan = Number(cell.getAttribute('rowspan'));
  const colSpan = Number(cell.getAttribute('colspan'));
  if (rowSpan > 1) out.rowSpan = rowSpan;
  if (colSpan > 1) out.colSpan = colSpan;
  return out;
}

/**
 * Where an image's picture goes in its content box under `object-fit` and
 * `object-position` (CSS Images 3, 5.5 and 5.6). `natural` is the picture's
 * own size in the same units as the box; `scale` turns the CSS pixels of a
 * length in `position` into those units.
 */
export function placePicture(
  content: DOMRect,
  natural: { width: number; height: number },
  fit: string,
  position: string,
  scale = 1
): DOMRect {
  if (fit === 'fill' || !natural.width || !natural.height) return content;
  const contain = Math.min(content.width / natural.width, content.height / natural.height);
  const cover = Math.max(content.width / natural.width, content.height / natural.height);
  const ratio =
    fit === 'contain'
      ? contain
      : fit === 'cover'
        ? cover
        : fit === 'scale-down'
          ? Math.min(1, contain)
          : 1; // none
  const width = natural.width * ratio;
  const height = natural.height * ratio;
  const [px = '50%', py = '50%'] = position.split(/\s+/);
  const offset = (value: string, free: number) =>
    value.endsWith('%') ? (parseFloat(value) / 100) * free : (parseFloat(value) || 0) * scale;
  return new DOMRect(
    content.left + offset(px, content.width - width),
    content.top + offset(py, content.height - height),
    width,
    height
  );
}

/** Whether two boxes of one word sit on different lines (at any preview scale). */
function onAnotherLine(a: DOMRect, b: DOMRect): boolean {
  return Math.abs(a.top - b.top) > Math.min(a.height, b.height) / 2;
}

/** The smallest rectangle holding all of `rects`. */
function union(rects: DOMRect[]): DOMRect {
  const left = Math.min(...rects.map(r => r.left));
  const top = Math.min(...rects.map(r => r.top));
  const right = Math.max(...rects.map(r => r.right));
  const bottom = Math.max(...rects.map(r => r.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

/**
 * The offset in [start, end) where the text moves to a new line: the end of
 * the shortest prefix whose boxes reach a second line, less one. (Chrome
 * reports a one-character range at the break on the wrong line, so single
 * characters can't be measured on their own.)
 */
function lineBreakOffset(text: Text, start: number, end: number, range: Range): number {
  range.setStart(text, start);
  for (let k = start + 1; k <= end; k++) {
    range.setEnd(text, k);
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 0);
    if (rects.some(r => onAnotherLine(r, rects[0]))) return k - 1;
  }
  return end;
}

/**
 * The text of a margin box's `content`: quoted strings and `counter(page)`.
 * Returns null for anything else (running strings, other counters).
 */
export function resolveMarginContent(content: string, pageNumber: number): string | null {
  if (!content || content === 'none' || content === 'normal') return null;
  let out = '';
  const token = /"((?:[^"\\]|\\.)*)"|counter\(page\)|\s+/gy;
  let match: RegExpExecArray | null;
  let at = 0;
  while ((match = token.exec(content))) {
    at = token.lastIndex;
    if (match[1] !== undefined) out += match[1].replace(/\\(.)/g, '$1');
    else if (match[0].startsWith('counter')) out += String(pageNumber);
  }
  return at === content.length && out ? out : null;
}

/** The browser's `text-transform`, applied to the text the writer draws. */
function textTransformer(value: string): (s: string) => string {
  if (value === 'uppercase') return s => s.toUpperCase();
  if (value === 'lowercase') return s => s.toLowerCase();
  if (value === 'capitalize') return s => s.charAt(0).toUpperCase() + s.slice(1);
  return s => s;
}

function textAlign(value: string): 'left' | 'center' | 'right' {
  if (value === 'center') return 'center';
  if (value === 'right' || value === 'end') return 'right';
  return 'left';
}

/** `rgb(r, g, b)` or `rgba(…)` → `#rrggbb`. */
export function cssColorToHex(value: string): string {
  const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return '#000000';
  return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
}
