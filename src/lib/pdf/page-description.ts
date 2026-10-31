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
  /** The text in reading order, where `text` is drawn in another order (a right-to-left list marker). */
  actual?: string;
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
  /** The margin box's direction, which orders a mix of right-to-left and other words. */
  direction?: 'rtl';
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

/** One box of a link (a line of its text, an image in it): a link annotation. */
export interface LinkItem {
  kind: 'link';
  /** The `Link` structure node, which says where the link goes. */
  struct: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a link inside the book lands: a named destination. */
export interface AnchorItem {
  kind: 'anchor';
  /** The target's id, which the `Link` nodes going there name as `dest`. */
  name: string;
  x: number;
  y: number;
}

/** One side of a border, as the browser drew it. */
export interface BorderSide {
  width: number;
  style: 'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'inset' | 'outset';
  color: string;
  /** Below 1 for a translucent colour. */
  opacity?: number;
}

/**
 * An element's background and border, drawn under its content: always an
 * artifact. The box is the border box (one per line for an inline element).
 */
export interface BoxItem {
  kind: 'box';
  x: number;
  y: number;
  width: number;
  height: number;
  /** The painted area, which `background-clip` may set inside the border box. */
  background?: {
    color: string;
    opacity?: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  border?: { top?: BorderSide; right?: BorderSide; bottom?: BorderSide; left?: BorderSide };
  /** Corner radius, when all four corners share one. */
  radius?: number;
  /** A collapsed table border, centred on the box's edge rather than inside it. */
  collapsed?: true;
  /** A margin box's own background or border: a pagination artifact. */
  pagination?: true;
}

/** A text decoration line under, over or through one line of an inline element. */
export interface DecorationItem {
  kind: 'decoration';
  line: 'underline' | 'overline' | 'line-through';
  /** The element's box on that line; the writer finds the baseline in it. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The decorating element's font, whose metrics place the line. */
  font: number;
  size: number;
  color: string;
  style: 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy';
  /** Points; absent for the font's own thickness. */
  thickness?: number;
  /** `text-underline-offset` in points, when set. */
  offset?: number;
}

/**
 * A bullet (disc, circle or square), which Chromium paints as a shape sized
 * from the font, not as text: a layout artifact, since the list structure
 * already says it's a list item. The writer places it from `x`, the edge it
 * hangs from (the item's start, or its first text's for an inside marker).
 */
export interface SymbolItem {
  kind: 'symbol';
  shape: 'disc' | 'circle' | 'square';
  x: number;
  /** The first line's box, which sets the baseline. */
  y: number;
  height: number;
  font: number;
  size: number;
  color: string;
  /** Hangs to the right of `x`, in a right-to-left item. */
  rtl?: true;
}

export type DrawItem =
  | TextItem
  | SymbolItem
  | MarginItem
  | ImageItem
  | LinkItem
  | AnchorItem
  | BoxItem
  | DecorationItem;

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
  /** Where a `Link` goes: a URL, or an anchor in the book. */
  link?: { uri: string } | { dest: string };
  /** A `Figure` standing as a block of its own, not in a line of text. */
  placement?: 'Block';
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
  /** The book's direction; `rtl` turns its pages right to left. */
  direction: 'ltr' | 'rtl';
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
  // `a` becomes a `Link` only when it goes somewhere the PDF can reach.
};

/**
 * Structure types that group blocks (ISO 32000-1, 14.8.4.2). Text and inline
 * elements directly inside one (a `figcaption`'s words) go in a `P` of their
 * own, which checkers expect.
 */
export const GROUPING_TYPES = new Set([
  'Document',
  'Part',
  'Art',
  'Sect',
  'Div',
  'BlockQuote',
  'Caption',
]);
const INLINE_TYPES = new Set(['Span', 'Link']);

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
  // Measures list markers, which aren't in the DOM to take a range over; the
  // document's canvas has the book's fonts.
  const measure = doc.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;

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

  // The `P` holding inline content directly inside a grouping element, while
  // it's the group's last child: a block in between starts another.
  const wrappers = new Set<number>();
  const inlineParent = (struct: number): number => {
    const group = structure[struct];
    if (!GROUPING_TYPES.has(group.type)) return struct;
    const last = group.children[group.children.length - 1];
    if (last !== undefined && wrappers.has(last)) return last;
    const p: StructNode = { id: structure.length, type: 'P', parent: struct, children: [] };
    structure.push(p);
    group.children.push(p.id);
    wrappers.add(p.id);
    return p.id;
  };

  // A list item's label and body, by its `LI` node: the label (`Lbl`) first.
  const listParts = new Map<number, { label?: number; body?: number }>();
  const listPart = (li: number, type: 'Lbl' | 'LBody'): number => {
    const parts = listParts.get(li) ?? {};
    listParts.set(li, parts);
    const key = type === 'Lbl' ? 'label' : 'body';
    let id = parts[key];
    if (id === undefined) {
      id = structure.length;
      structure.push({ id, type, parent: li, children: [] });
      structure[li].children.push(id);
      parts[key] = id;
    }
    return id;
  };
  const listLabelFor = (li: number) => listPart(li, 'Lbl');
  const listBodyFor = (li: number) => listPart(li, 'LBody');

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
    if (INLINE_TYPES.has(type)) parent = inlineParent(parent);
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

  // The whole-book builder points links between chapters at ids in the one
  // document (`#…`). Each linked id gets an anchor where it first appears;
  // Paged.js keeps an id it moves as `data-id`.
  const linkTargetOf = (href: string): StructNode['link'] | null => {
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      if (!id) return null;
      const sel = `[id="${CSS.escape(id)}"], [data-id="${CSS.escape(id)}"]`;
      return pageEls.some(p => p.querySelector(sel)) ? { dest: id } : null;
    }
    return /^(https?|mailto|tel|ftp):/i.test(href) ? { uri: href } : null;
  };
  const linkedIds = new Set<string>();
  for (const a of Array.from(doc.querySelectorAll('.pagedjs_page a[href^="#"]'))) {
    const target = linkTargetOf(a.getAttribute('href') ?? '');
    if (target && 'dest' in target) linkedIds.add(target.dest);
  }
  const anchored = new Set<string>();
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
      // Drawings, video and other embedded content aren't drawn yet.
      if (REPLACED_ELEMENTS.has(el.localName)) {
        problems.add(el.localName);
        return;
      }
      decorate(el, style);
      if (el.localName === 'img') {
        measureImage(el as HTMLImageElement, struct, style);
        return;
      }
      const anchorId = el.id || el.getAttribute('data-id');
      if (anchorId && linkedIds.has(anchorId) && !anchored.has(anchorId)) {
        anchored.add(anchorId);
        const { x, y } = box(el.getBoundingClientRect());
        page.items.push({ kind: 'anchor', name: anchorId, x, y });
      }
      const link = el.localName === 'a' ? linkTargetOf(el.getAttribute('href') ?? '') : null;
      const here = link
        ? structFor(el, struct, { type: 'Link' })
        : el.hasAttribute('data-ref')
          ? structFor(el, struct)
          : struct;
      if (link) {
        structure[here].link = link;
        // A box per line of the link on this page, and any image in it.
        const rects = [
          ...Array.from(el.getClientRects()),
          ...Array.from(el.querySelectorAll('img'), img => img.getBoundingClientRect()),
        ].filter(r => r.width > 0 && r.height > 0);
        for (const r of rects) page.items.push({ kind: 'link', struct: here, ...box(r) });
      }
      const block = !style.display.startsWith('inline') && style.display !== 'contents';
      const hiddenHere = hidden || isVisuallyHidden(style);
      if (block) separate();
      // A list item's marker is its label (`Lbl`); what follows is its body.
      const listItem = style.display.includes('list-item');
      const marker = listItem && !hiddenHere ? measureMarker(el, here) : null;
      const inner = listItem && structure[here].type === 'LI' ? listBodyFor(here) : here;
      const firstChildItem = page.items.length;
      for (const child of Array.from(el.childNodes)) walk(child, inner, hiddenHere);
      if (marker) placeMarker(marker, firstChildItem);
      if (block) separate();
    };

    /** A list item's marker, measured but not yet set on the line it labels. */
    interface Marker {
      item: TextItem | SymbolItem;
      /** The marker's width with its trailing space, in points. */
      full: number;
      inside: boolean;
      rtl: boolean;
      /** The list item's border box. */
      box: { x: number; y: number; width: number; height: number };
      /** Fallback line height, in points, for a list item with no text on its first line. */
      lineHeight: number;
    }

    const measureMarker = (el: Element, li: number): Marker | null => {
      const style = win.getComputedStyle(el);
      if (style.listStyleImage !== 'none') problems.add('list-style-image');
      const ms = win.getComputedStyle(el, '::marker');
      let text: string | null;
      const normal = ms.content === 'normal' || ms.content === '';
      const rtl = style.direction === 'rtl';
      const shape = style.listStyleType;
      if (normal && (shape === 'disc' || shape === 'circle' || shape === 'square')) {
        return {
          item: {
            kind: 'symbol',
            shape,
            x: 0,
            y: 0,
            height: 0,
            font: fontIndex(ms),
            size: toPt(parseFloat(ms.fontSize) * scale),
            color: cssColorToHex(ms.color),
            ...(rtl ? { rtl: true as const } : {}),
          },
          full: 0,
          inside: style.listStylePosition === 'inside',
          rtl,
          box: box(el.getBoundingClientRect()),
          lineHeight: toPt((parseFloat(style.lineHeight) || parseFloat(ms.fontSize) * 1.2) * scale),
        };
      }
      if (normal) {
        text = markerText(style.listStyleType, ordinalOf(el));
        if (text === null) problems.add(`list-style-type: ${style.listStyleType}`);
      } else {
        // A `::marker` with its own content: only a plain string is drawn.
        const quoted = /^"((?:[^"\\]|\\.)*)"$/.exec(ms.content);
        text = quoted ? quoted[1].replace(/\\(.)/g, '$1') : null;
        if (text === null && ms.content !== 'none') problems.add(`::marker content: ${ms.content}`);
      }
      if (!text || !text.trim()) return null;
      const visibleText = text.trimEnd();
      measure.font = `${ms.fontStyle} ${ms.fontWeight} ${ms.fontSize} ${ms.fontFamily}`;
      const pt = (px: number) => toPt(px * scale);
      // In a right-to-left item the suffix reads first: "1." is seen as ".1".
      const drawn = rtl ? rtlMarker(visibleText) : visibleText;
      const size = toPt(parseFloat(ms.fontSize) * scale);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(ms.fontSize) * 1.2;
      return {
        item: {
          kind: 'text',
          text: drawn,
          visible: drawn.length,
          x: 0,
          y: 0,
          width: pt(measure.measureText(visibleText).width),
          height: 0,
          font: fontIndex(ms),
          size,
          color: cssColorToHex(ms.color),
          struct: structure[li].type === 'LI' ? listLabelFor(li) : null,
          ...(drawn !== visibleText ? { actual: visibleText } : {}),
        },
        full: pt(measure.measureText(text).width),
        inside: style.listStylePosition === 'inside',
        rtl,
        box: box(el.getBoundingClientRect()),
        lineHeight: pt(lineHeight),
      };
    };

    /**
     * Set a marker on its list item's first line: beside the item outside it
     * (list-style-position: outside), or before the first text inside it.
     * The marker is drawn before the item's content, so it is its first child.
     */
    const placeMarker = (marker: Marker, from: number) => {
      const first = page.items
        .slice(from)
        .find((it): it is TextItem => it.kind === 'text' && !it.invisible);
      const { item, full, box: li } = marker;
      item.y = first ? first.y : li.y;
      item.height = first ? first.height : marker.lineHeight;
      if (item.kind === 'symbol') {
        const inside = marker.inside && first;
        item.x = marker.rtl
          ? inside
            ? first.x + first.width
            : li.x + li.width
          : inside
            ? first.x
            : li.x;
        page.items.splice(from, 0, item);
        return;
      }
      const gap = full - item.width;
      if (marker.inside && first) {
        item.x = marker.rtl ? first.x + first.width + gap : first.x - full;
      } else {
        item.x = marker.rtl ? li.x + li.width + gap : li.x - full;
      }
      page.items.splice(from, 0, item);
    };

    /**
     * An element's background, border and text decoration, before its content
     * so they're drawn under it, and what of its painting the PDF doesn't draw.
     */
    const decorate = (
      el: Element,
      style: CSSStyleDeclaration,
      from: 'book' | 'page' | 'margin' = 'book'
    ) => {
      // Paged.js's page wrappers carry the preview's own look (a shadow round
      // each page), which isn't the book's.
      if (from !== 'page') {
        for (const [property, none, name] of UNDRAWN) {
          if (style.getPropertyValue(property) !== none) problems.add(name);
        }
        if (parseFloat(style.opacity) < 1) problems.add('opacity');
        if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) {
          problems.add('outline');
        }
      }
      if (style.display === 'contents') return;
      const inline = style.display === 'inline';
      const rects = inline ? Array.from(el.getClientRects()) : [el.getBoundingClientRect()];
      const pt = (v: string) => toPt((parseFloat(v) || 0) * scale);
      const sides = boxSides(style, pt);
      const fill = cssColor(style.backgroundColor);
      const radius = cornerRadius(style, pt);
      const collapsed = style.borderCollapse === 'collapse' && style.display.startsWith('table');
      if (fill || sides.some(Boolean)) {
        if (radius === null) problems.add('border-radius');
        // A line of an inline element has its start border on the first line
        // and its end border on the last (box-decoration-break: slice).
        const rtl = style.direction === 'rtl';
        rects.forEach((r, i) => {
          if (r.width === 0 && r.height === 0) return;
          const [top, right, bottom, left] = sides;
          const firstLine = i === 0;
          const lastLine = i === rects.length - 1;
          const border = {
            ...(top ? { top } : {}),
            ...(bottom ? { bottom } : {}),
            ...(right && (!inline || (rtl ? firstLine : lastLine)) ? { right } : {}),
            ...(left && (!inline || (rtl ? lastLine : firstLine)) ? { left } : {}),
          };
          const b = box(r);
          const item: BoxItem = { kind: 'box', ...b };
          if (fill) {
            const inset = backgroundInset(style, pt);
            item.background = {
              ...fill,
              x: b.x + inset.left,
              y: b.y + inset.top,
              width: b.width - inset.left - inset.right,
              height: b.height - inset.top - inset.bottom,
            };
          }
          if (Object.keys(border).length > 0) item.border = border;
          if (radius) item.radius = radius;
          if (collapsed) item.collapsed = true;
          if (from === 'margin') item.pagination = true;
          page.items.push(item);
        });
      }
      const lines = style.textDecorationLine;
      if (lines === 'none') return;
      if (!inline) {
        problems.add('text-decoration on a block');
        return;
      }
      const decorationStyle = DECORATION_STYLES.has(style.textDecorationStyle)
        ? (style.textDecorationStyle as DecorationItem['style'])
        : 'solid';
      const thickness = /px$/.test(style.textDecorationThickness)
        ? { thickness: pt(style.textDecorationThickness) }
        : {};
      const offset = /px$/.test(style.textUnderlineOffset)
        ? { offset: pt(style.textUnderlineOffset) }
        : {};
      for (const line of lines.split(/\s+/)) {
        if (line !== 'underline' && line !== 'overline' && line !== 'line-through') continue;
        for (const r of rects) {
          if (r.width === 0) continue;
          page.items.push({
            kind: 'decoration',
            line,
            ...box(r),
            font: fontIndex(style),
            size: toPt(parseFloat(style.fontSize) * scale),
            color: cssColorToHex(style.textDecorationColor),
            style: decorationStyle,
            ...thickness,
            ...(line === 'underline' ? offset : {}),
          });
        }
      }
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
        struct: alt === '' ? null : figureFor(img, struct, alt),
      });
    };

    const figureFor = (img: HTMLImageElement, struct: number, alt: string | null): number => {
      const figure = structFor(img, struct, { type: 'Figure', alt: alt?.trim() });
      // In a group of blocks (a `figure`, a section) the image is a block.
      if (GROUPING_TYPES.has(structure[struct].type)) structure[figure].placement = 'Block';
      return figure;
    };

    const measureText = (text: Text, group: number, hidden: boolean) => {
      const value = text.data;
      if (!value.trim()) return;
      const parent = text.parentElement;
      if (!parent) return;
      const struct = inlineParent(group);
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

    // The page's own background (`@page { background }`), then the margin
    // boxes' (a rule under a running head), under everything else.
    const pagebox = pageEl.querySelector('.pagedjs_pagebox');
    for (const el of [pageEl, ...(pagebox ? [pagebox] : [])]) {
      decorate(el, win.getComputedStyle(el), 'page');
    }
    for (const margin of Array.from(pageEl.querySelectorAll('.pagedjs_margin'))) {
      decorate(margin, win.getComputedStyle(margin), 'margin');
    }

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
        align: textAlign(after.textAlign, after.direction),
        ...(after.direction === 'rtl' ? { direction: 'rtl' as const } : {}),
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
    direction:
      win.getComputedStyle(doc.body ?? doc.documentElement).direction === 'rtl' ? 'rtl' : 'ltr',
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

/** A computed `text-align` as a side, `start` and `end` by the text's direction. */
export function textAlign(value: string, direction = 'ltr'): 'left' | 'center' | 'right' {
  if (value === 'center') return 'center';
  if (value === 'right') return 'right';
  if (value === 'left') return 'left';
  const rtl = direction === 'rtl';
  return (value === 'end') !== rtl ? 'right' : 'left';
}

/**
 * A list item's number as the browser counts it: from its list's `start`
 * (which Paged.js sets on each page's part of a split list), stepping by one,
 * or down in a `reversed` list, and taking any `value` an item sets.
 */
export function ordinalOf(li: Element): number {
  const list = li.parentElement;
  const ol = list?.localName === 'ol' ? (list as HTMLOListElement) : null;
  const items = list ? Array.from(list.children).filter(c => c.localName === 'li') : [li];
  const reversed = ol?.reversed ?? false;
  let n = ol?.hasAttribute('start') ? ol.start : reversed ? items.length : 1;
  for (const item of items) {
    const value = item.getAttribute('value');
    if (value !== null && !Number.isNaN(parseInt(value, 10))) n = parseInt(value, 10);
    if (item === li) return n;
    n += reversed ? -1 : 1;
  }
  return n;
}

const ROMAN: [number, string][] = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];

function roman(n: number): string | null {
  if (n < 1 || n > 3999) return null;
  let out = '';
  for (const [value, letters] of ROMAN) {
    while (n >= value) {
      out += letters;
      n -= value;
    }
  }
  return out;
}

function alphabetic(n: number, letters: string): string | null {
  if (n < 1) return null;
  const symbols = Array.from(letters);
  let out = '';
  for (; n > 0; n = Math.floor((n - 1) / symbols.length)) {
    out = symbols[(n - 1) % symbols.length] + out;
  }
  return out;
}

/**
 * The marker text for a `list-style-type` and an item's number, with the
 * suffix and space the browser adds (CSS Counter Styles); null for a style
 * the PDF doesn't draw yet, '' for `none`.
 */
export function markerText(type: string, n: number): string | null {
  const quoted = /^"(.*)"$/.exec(type);
  if (quoted) return quoted[1];
  const numbered = (s: string | null) => (s === null ? null : `${s}. `);
  switch (type) {
    case 'none':
      return '';
    case 'disc':
      return '\u2022 ';
    case 'circle':
      return '\u25E6 ';
    case 'square':
      return '\u25AA ';
    case 'decimal':
      return numbered(String(n));
    case 'decimal-leading-zero':
      return numbered(n >= 0 && n < 10 ? `0${n}` : String(n));
    case 'lower-alpha':
    case 'lower-latin':
      return numbered(alphabetic(n, 'abcdefghijklmnopqrstuvwxyz'));
    case 'upper-alpha':
    case 'upper-latin':
      return numbered(alphabetic(n, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'));
    case 'lower-greek':
      return numbered(alphabetic(n, 'αβγδεζηθικλμνξοπρστυφχψω'));
    case 'lower-roman':
      return numbered(roman(n));
    case 'upper-roman':
      return numbered(roman(n)?.toUpperCase() ?? null);
    case 'arabic-indic':
      return numbered(String(n).replace(/\d/g, d => String.fromCharCode(0x0660 + Number(d))));
    default:
      return null;
  }
}

/** A marker as it is seen in a right-to-left item: its suffix ("1." → ".1") on the left. */
export function rtlMarker(text: string): string {
  const m = /^(.*?)([.)]+)$/.exec(text);
  return m && m[1] ? m[2] + m[1] : text;
}

/** Painting the PDF doesn't draw: the property, its value when unused, and the card's name. */
const UNDRAWN: [string, string, string][] = [
  ['background-image', 'none', 'background-image'],
  ['box-shadow', 'none', 'box-shadow'],
  ['text-shadow', 'none', 'text-shadow'],
  ['transform', 'none', 'transform'],
  ['filter', 'none', 'filter'],
  ['backdrop-filter', 'none', 'backdrop-filter'],
  ['mix-blend-mode', 'normal', 'mix-blend-mode'],
  ['border-image-source', 'none', 'border-image'],
];

const BORDER_STYLES = new Set([
  'solid',
  'dashed',
  'dotted',
  'double',
  'groove',
  'ridge',
  'inset',
  'outset',
]);
const DECORATION_STYLES = new Set(['solid', 'double', 'dotted', 'dashed', 'wavy']);

/** A computed colour as `#rrggbb` and its opacity, or null when it's fully transparent. */
export function cssColor(value: string): { color: string; opacity?: number } | null {
  const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?/);
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : parseFloat(m[4]) / (m[4].endsWith('%') ? 100 : 1);
  if (alpha <= 0) return null;
  return { color: cssColorToHex(value), ...(alpha < 1 ? { opacity: alpha } : {}) };
}

type BoxStyle = Pick<
  CSSStyleDeclaration,
  | `border${'Top' | 'Right' | 'Bottom' | 'Left'}${'Width' | 'Style' | 'Color'}`
  | `padding${'Top' | 'Right' | 'Bottom' | 'Left'}`
  | `border${'TopLeft' | 'TopRight' | 'BottomRight' | 'BottomLeft'}Radius`
  | 'backgroundClip'
>;

/** The four border sides (top, right, bottom, left) the browser draws; null where none. */
export function boxSides(
  style: BoxStyle,
  pt: (v: string) => number
): [BorderSide | null, BorderSide | null, BorderSide | null, BorderSide | null] {
  const side = (name: 'Top' | 'Right' | 'Bottom' | 'Left'): BorderSide | null => {
    const kind = style[`border${name}Style`];
    const width = pt(style[`border${name}Width`]);
    const color = cssColor(style[`border${name}Color`]);
    if (!BORDER_STYLES.has(kind) || width <= 0 || !color) return null;
    return { width, style: kind as BorderSide['style'], ...color };
  };
  return [side('Top'), side('Right'), side('Bottom'), side('Left')];
}

/**
 * The corner radius when all four corners share one round radius (0 when
 * square); null when they differ or are elliptical, which the PDF doesn't draw.
 */
export function cornerRadius(style: BoxStyle, pt: (v: string) => number): number | null {
  const corners = [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomRightRadius,
    style.borderBottomLeftRadius,
  ];
  if (corners.every(c => parseFloat(c) === 0 || c === '')) return 0;
  if (corners.some(c => !/^[\d.]+px$/.test(c)) || new Set(corners).size > 1) return null;
  return pt(corners[0]);
}

/** How far inside the border box the background is painted (`background-clip`). */
export function backgroundInset(
  style: BoxStyle,
  pt: (v: string) => number
): { top: number; right: number; bottom: number; left: number } {
  const clip = style.backgroundClip;
  const inset = (name: 'Top' | 'Right' | 'Bottom' | 'Left') => {
    if (clip !== 'padding-box' && clip !== 'content-box') return 0;
    const border = BORDER_STYLES.has(style[`border${name}Style`])
      ? pt(style[`border${name}Width`])
      : 0;
    return border + (clip === 'content-box' ? pt(style[`padding${name}`]) : 0);
  };
  return { top: inset('Top'), right: inset('Right'), bottom: inset('Bottom'), left: inset('Left') };
}

/** `rgb(r, g, b)` or `rgba(…)` → `#rrggbb`. */
export function cssColorToHex(value: string): string {
  const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return '#000000';
  return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
}
