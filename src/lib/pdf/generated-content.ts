/**
 * Generated content: the text `::before` and `::after` add (a "Chapter"
 * label, the quotation marks round a `q`, a section number), which isn't in
 * the DOM for the page description to measure.
 *
 * `materializeGeneratedContent` works the text out over the paginated
 * document in tree order (CSS counters as CSS Lists 3 counts them, the depth
 * of nested quotes, `attr()`), then stands a span with the pseudo-element's
 * computed style and that text in for each pseudo-element, which it hides.
 * The span lays out as the pseudo-element did, so its words are measured like
 * any others; if anything on the page moves, the pseudo-element is put back
 * and listed instead. The function it returns puts the document back. The
 * page walk reads an element's children with `renderedChildNodes`, which
 * includes spans in a shadow root.
 */
import { counterText } from './counter-styles.js';

export type ContentToken =
  | { kind: 'string'; value: string }
  | { kind: 'attr'; name: string }
  | { kind: 'counter'; name: string; style: string }
  | { kind: 'counters'; name: string; separator: string; style: string }
  | { kind: 'quote'; which: 'open-quote' | 'close-quote' | 'no-open-quote' | 'no-close-quote' };

const QUOTE_KEYWORDS = new Set(['open-quote', 'close-quote', 'no-open-quote', 'no-close-quote']);

/**
 * A computed `content` value as tokens; null for what the PDF doesn't draw
 * (an image, a gradient, a function other than `attr()`, `counter()` and
 * `counters()`). Alternative text after a `/` is left out: it's for screen
 * readers, and the text itself is what they get in the PDF.
 */
export function parseContent(value: string): ContentToken[] | null {
  const tokens: ContentToken[] = [];
  let at = 0;
  const readString = (): string => {
    const quote = value[at++];
    let out = '';
    while (at < value.length && value[at] !== quote) {
      if (value[at] !== '\\') {
        out += value[at++];
        continue;
      }
      at++;
      const hex = /^[0-9a-fA-F]{1,6}\s?/.exec(value.slice(at));
      if (hex) {
        out += String.fromCodePoint(parseInt(hex[0], 16));
        at += hex[0].length;
      } else if (value[at] === '\n') {
        at++;
      } else {
        out += value[at++] ?? '';
      }
    }
    at++;
    return out;
  };
  while (at < value.length) {
    const rest = value.slice(at);
    const space = /^\s+/.exec(rest);
    if (space) {
      at += space[0].length;
      continue;
    }
    if (rest[0] === '"' || rest[0] === "'") {
      tokens.push({ kind: 'string', value: readString() });
      continue;
    }
    if (rest[0] === '/') break;
    const ident = /^[a-z-]+/i.exec(rest);
    if (ident && QUOTE_KEYWORDS.has(ident[0]) && rest[ident[0].length] !== '(') {
      tokens.push({ kind: 'quote', which: ident[0] as 'open-quote' });
      at += ident[0].length;
      continue;
    }
    const call = /^(attr|counters?)\(/.exec(rest);
    if (!call) return null;
    at += call[0].length;
    const args: string[] = [];
    let arg = '';
    while (at < value.length && value[at] !== ')') {
      if (value[at] === '"' || value[at] === "'") {
        arg += JSON.stringify(readString());
      } else if (value[at] === ',') {
        args.push(arg.trim());
        arg = '';
        at++;
      } else {
        arg += value[at++];
      }
    }
    args.push(arg.trim());
    at++;
    const name = args[0]?.split(/\s+/)[0] ?? '';
    if (call[1] === 'attr') {
      tokens.push({ kind: 'attr', name });
    } else if (call[1] === 'counter') {
      tokens.push({ kind: 'counter', name, style: args[1] || 'decimal' });
    } else {
      const separator = args[1]?.startsWith('"') ? (JSON.parse(args[1]) as string) : '';
      tokens.push({ kind: 'counters', name, separator, style: args[2] || 'decimal' });
    }
  }
  return tokens;
}

/** A computed `counter-reset`, `counter-increment` or `counter-set` as name and value pairs. */
export function parseCounterList(value: string, fallback: number): [string, number][] {
  if (!value || value === 'none') return [];
  const pairs: [string, number][] = [];
  for (const m of value.matchAll(/(?:reversed\()?([a-zA-Z_][\w-]*)\)?(?:\s+(-?\d+))?/g)) {
    pairs.push([m[1], m[2] === undefined ? fallback : parseInt(m[2], 10)]);
  }
  return pairs;
}

/** The quotation marks `quotes: auto` gives a language, outer pair then inner. */
const AUTO_QUOTES: Record<string, string[]> = {
  en: ['“', '”', '‘', '’'],
  de: ['„', '“', '‚', '‘'],
  fr: ['« ', ' »', '“', '”'],
  es: ['«', '»', '“', '”'],
  it: ['«', '»', '“', '”'],
  ru: ['«', '»', '„', '“'],
  nl: ['“', '”', '‘', '’'],
  ka: ['„', '“', '‚', '‘'],
  he: ['”', '”', '’', '’'],
  ar: ['«', '»', '‹', '›'],
  ja: ['「', '」', '『', '』'],
  zh: ['“', '”', '‘', '’'],
};

/** The quote pairs for a computed `quotes` value and the element's language; null when unknown. */
export function quotePairs(quotes: string, lang: string): string[] | null {
  if (quotes === 'none') return [];
  if (quotes !== 'auto') {
    const tokens = parseContent(quotes);
    return tokens ? tokens.map(t => (t.kind === 'string' ? t.value : '')) : null;
  }
  return AUTO_QUOTES[lang.toLowerCase().split('-')[0]] ?? null;
}

interface Counter {
  name: string;
  /** The element (or pseudo-element) that made it, by its parent for the sibling rule. */
  creator: { parent: Node | null };
  value: number;
}

type Which = 'before' | 'after';

interface Generated {
  el: Element;
  which: Which;
  text: string;
}

const MARK = 'data-seed-generated';
const SPAN_MARK = 'data-seed-generated-text';

/**
 * Stand spans in for the book's `::before` and `::after` content. Returns
 * the function that puts the document back.
 */
export function materializeGeneratedContent(doc: Document, problems: Set<string>): () => void {
  const win = doc.defaultView;
  if (!win) return () => {};
  const generated: Generated[] = [];
  let previous: Counter[] = [];
  let depth = 0;

  const inherit = (parent: Counter[] | null, sibling: Counter[] | null): Counter[] => {
    const set = parent ? parent.map(c => ({ ...c })) : [];
    for (const c of sibling ?? []) {
      if (!set.some(d => d.name === c.name)) set.push({ ...c });
    }
    for (const c of previous) {
      const d = set.find(d => d.name === c.name && d.creator === c.creator);
      if (d) d.value = c.value;
    }
    return set;
  };
  const instantiate = (
    set: Counter[],
    name: string,
    creator: Counter['creator'],
    value: number
  ) => {
    const last = set.findLastIndex(c => c.name === name);
    if (last >= 0 && set[last].creator.parent === creator.parent) set.splice(last, 1);
    set.push({ name, creator, value });
  };
  const innermost = (set: Counter[], name: string, creator: Counter['creator']) => {
    let c = set.findLast(c => c.name === name);
    if (!c) {
      instantiate(set, name, creator, 0);
      c = set[set.length - 1];
    }
    return c;
  };
  const applyCounters = (
    set: Counter[],
    style: CSSStyleDeclaration,
    creator: Counter['creator'],
    listItem: boolean
  ) => {
    for (const [name, v] of parseCounterList(style.counterReset, 0)) {
      instantiate(set, name, creator, v);
    }
    const increments = parseCounterList(style.counterIncrement, 1);
    const sets = parseCounterList(style.counterSet, 0);
    for (const [name, v] of increments) innermost(set, name, creator).value += v;
    if (listItem && ![...increments, ...sets].some(([name]) => name === 'list-item')) {
      innermost(set, 'list-item', creator).value += 1;
    }
    for (const [name, v] of sets) innermost(set, name, creator).value = v;
  };

  const resolve = (el: Element, style: CSSStyleDeclaration, set: Counter[]): string | null => {
    const tokens = parseContent(style.content);
    if (!tokens) {
      problems.add(`content: ${style.content}`);
      return null;
    }
    const lang = el.closest('[lang]')?.getAttribute('lang') ?? '';
    let text = '';
    for (const token of tokens) {
      if (token.kind === 'string') {
        text += token.value;
      } else if (token.kind === 'attr') {
        text += el.getAttribute(token.name) ?? '';
      } else if (token.kind === 'counter' || token.kind === 'counters') {
        const values =
          token.kind === 'counter'
            ? [innermost(set, token.name, { parent: el }).value]
            : set.filter(c => c.name === token.name).map(c => c.value);
        const shown = values.map(n => counterText(token.style, n));
        if (shown.some(s => s === null)) {
          problems.add(`counter style: ${token.style}`);
          return null;
        }
        text += shown.join(token.kind === 'counters' ? token.separator : '');
      } else {
        const pairs = quotePairs(style.quotes, lang);
        if (pairs === null) {
          problems.add(`quotes for language: ${lang || 'none'}`);
          return null;
        }
        const pair = Math.min(depth, pairs.length / 2 - 1) * 2;
        if (token.which === 'open-quote') {
          text += pairs[pair] ?? '';
          depth++;
        } else if (token.which === 'close-quote') {
          if (depth > 0) {
            depth--;
            text += pairs[Math.min(depth, pairs.length / 2 - 1) * 2 + 1] ?? '';
          }
        } else if (token.which === 'no-open-quote') {
          depth++;
        } else {
          depth = Math.max(0, depth - 1);
        }
      }
    }
    return text;
  };

  const pseudo = (
    el: Element,
    which: Which,
    parent: Counter[],
    sibling: Counter[] | null
  ): Counter[] | null => {
    const style = win.getComputedStyle(el, `::${which}`);
    if (style.content === 'none' || style.content === 'normal' || style.display === 'none') {
      return null;
    }
    const set = inherit(parent, sibling);
    applyCounters(set, style, { parent: el }, false);
    previous = set;
    const text = resolve(el, style, set);
    if (text !== null && el.closest('.pagedjs_page_content')) generated.push({ el, which, text });
    return set;
  };

  // Counters and quotes run through the whole paginated document in tree
  // order, page wrappers included (Paged.js carries counters across pages on
  // them); margin boxes are Paged.js's own and are left out.
  const visit = (
    el: Element,
    parent: Counter[] | null,
    sibling: Counter[] | null
  ): Counter[] | null => {
    const style = win.getComputedStyle(el);
    if (style.display === 'none') return null;
    const set = inherit(parent, sibling);
    applyCounters(set, style, { parent: el.parentNode }, style.display.includes('list-item'));
    previous = set;
    if (el.classList.contains('pagedjs_margin')) return set;
    let last = pseudo(el, 'before', set, null);
    for (const child of Array.from(el.children)) {
      last = visit(child, set, last) ?? last;
    }
    pseudo(el, 'after', set, last);
    return set;
  };
  visit(doc.documentElement, null, null);

  if (generated.length === 0) return () => {};

  // Stand the spans in: measure where things are, hide each pseudo-element
  // behind a span with its style and text, and check nothing moved.
  const hide = doc.createElement('style');
  hide.textContent = `[${MARK}~="before"]::before, [${MARK}~="after"]::after { content: none !important; }`;
  const where = (el: Element) => {
    const r = el.getBoundingClientRect();
    // The element's own first text, not a span's standing in for `::before`.
    const text = doc
      .createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: node =>
          node.parentElement?.closest(`[${SPAN_MARK}]`)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      })
      .nextNode();
    const range = doc.createRange();
    let t: DOMRect | null = null;
    if (text && text.textContent) {
      range.setStart(text, 0);
      range.setEnd(text, 1);
      t = range.getBoundingClientRect();
    }
    return [r.left, r.top, r.width, r.height, t?.left ?? 0, t?.top ?? 0];
  };
  // Where each span goes: in a shadow root on the element, where it can
  // host one ([before, <slot>, after]), so the book's own children keep
  // their `:first-child` and `:last-child`; otherwise among its children.
  const roots = new Map<Element, ShadowRoot | null>();
  const containerFor = (el: Element): ShadowRoot | Element => {
    if (!roots.has(el)) {
      let root: ShadowRoot | null = null;
      try {
        root = el.shadowRoot ?? el.attachShadow({ mode: 'open' });
        if (!root.querySelector('slot')) root.append(doc.createElement('slot'));
      } catch {
        root = null; // an element that can't host one (q, a, li, td, …)
      }
      roots.set(el, root);
    }
    return roots.get(el) ?? el;
  };
  const place = (g: Generated, span: Element) => {
    const container = containerFor(g.el);
    if (g.which === 'before') container.prepend(span);
    else container.append(span);
  };
  // Only what the pseudo-element sets apart from a plain span in its place,
  // so the rest inherits exactly (a copied, rounded font-size would shape the
  // span apart from its neighbours and lose their kerning).
  const styles = generated.map(g => {
    const style = win.getComputedStyle(g.el, `::${g.which}`);
    const plain = doc.createElement('span');
    place(g, plain);
    const reference = win.getComputedStyle(plain);
    const copy: [string, string][] = [];
    for (const name of Array.from(style)) {
      if (name === 'content' || name.startsWith('counter-')) continue;
      const value = style.getPropertyValue(name);
      if (value !== reference.getPropertyValue(name)) copy.push([name, value]);
    }
    plain.remove();
    return copy;
  });
  const before = generated.map(g => where(g.el));
  doc.head.appendChild(hide);
  const spans = generated.map((g, i) => {
    const span = doc.createElement('span');
    span.setAttribute(SPAN_MARK, g.which);
    for (const [name, value] of styles[i]) span.style.setProperty(name, value);
    span.textContent = g.text;
    const marks = new Set((g.el.getAttribute(MARK) ?? '').split(' ').filter(Boolean));
    marks.add(g.which);
    g.el.setAttribute(MARK, [...marks].join(' '));
    place(g, span);
    return span;
  });
  const restoreOne = (g: Generated, span: HTMLElement) => {
    span.remove();
    const marks = (g.el.getAttribute(MARK) ?? '').split(' ').filter(m => m && m !== g.which);
    if (marks.length > 0) g.el.setAttribute(MARK, marks.join(' '));
    else g.el.removeAttribute(MARK);
  };
  generated.forEach((g, i) => {
    const after = where(g.el);
    if (after.some((v, k) => Math.abs(v - before[i][k]) > 0.5)) {
      // The span didn't lay out as the pseudo-element did (a `:first-child`
      // rule it now gets in the way of): leave the pseudo-element, list it.
      restoreOne(g, spans[i]);
      problems.add(`::${g.which} on ${g.el.localName}`);
    }
  });
  // A shadow root can't be taken off again; left with only its slot, it
  // renders the element as before.
  return () => {
    generated.forEach((g, i) => {
      if (spans[i].isConnected) restoreOne(g, spans[i]);
    });
    hide.remove();
  };
}

/**
 * The nodes an element renders as its children: its own, or, where it hosts
 * a shadow root of stand-in spans, the spans with its own between them.
 */
export function renderedChildNodes(el: Element): Node[] {
  const root = el.shadowRoot;
  if (!root) return Array.from(el.childNodes);
  return Array.from(root.childNodes).flatMap(node =>
    node instanceof (el.ownerDocument.defaultView?.HTMLSlotElement ?? HTMLSlotElement)
      ? (node as HTMLSlotElement).assignedNodes({ flatten: true })
      : [node]
  );
}
