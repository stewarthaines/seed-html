/**
 * The seed_inspect_elements bridge payload: measurements taken from the live
 * rendered preview document, so an agent can answer "where did this actually
 * land, and why" without a screenshot round trip through the author.
 *
 * This exists because the four preview engines (built-in, foliate paginated,
 * foliate scrolled, Paged.js) lay the same chapter out differently, and
 * preview-head scripts / transforms / book CSS routinely behave in one and not
 * another. `seed_get_rendered_xhtml` returns the pipeline's OUTPUT — the markup
 * before any engine touched it — which cannot answer a placement question.
 *
 * Geometry is the diagnostic that matters most here (does this box sit where
 * the author sees it?), so every match carries a rect and its offsetParent
 * alongside the requested computed properties. All selectors are measured in
 * ONE pass: comparing two rects taken from separate calls is unsound when the
 * engine can re-render between them.
 */

/** Layout-shaped default: enough to explain a mispositioned box, nothing more.
 *  A full CSSStyleDeclaration is ~340 properties of mostly noise. */
export const DEFAULT_INSPECT_PROPERTIES = [
  'display',
  'position',
  'float',
  'visibility',
  'box-sizing',
  'overflow',
  'z-index',
  'width',
  'height',
  'margin',
  'padding',
] as const;

/** Payload guards — an agent asking for `div` on a long chapter must not get
 *  a thousand elements back. The total is always reported, so truncation is
 *  visible rather than silently misleading. */
export const MAX_MATCHES_PER_SELECTOR = 10;
export const MAX_SELECTORS = 8;
const HTML_SNIPPET_LIMIT = 200;
/** Sub-percent scale differences are subpixel rounding, not a transform. */
const SCALE_EPSILON = 0.01;
/** Ancestor chain depth in `path` — enough to locate a node, short enough to read. */
const PATH_DEPTH = 6;

export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InspectedElement {
  /** 0-based index among this selector's matches. */
  index: number;
  tag: string;
  id?: string;
  className?: string;
  /** Ancestor chain, outermost first (e.g. "body > main > section > p:nth-of-type(2)"). */
  path: string;
  /** Viewport-relative box IN THE PREVIEW DOCUMENT, rounded to whole pixels.
   *  Under a paginated engine the viewport is the current page, so a box on a
   *  later page reports coordinates outside it — that is meaningful, not a bug. */
  rect: ElementRect;
  /** The element the rect is positioned against, when it is not the initial
   *  containing block — the usual culprit for a box landing somewhere odd. */
  offsetParent?: string;
  /** Cumulative scale applied by ancestor transforms, present only when it is
   *  not 1. `rect` is post-transform (what the author sees on screen) while the
   *  computed `width`/`height` are pre-transform CSS pixels, so the two
   *  legitimately disagree by this factor — divide a rect by it to compare.
   *  The Proofs device scales every page this way. */
  scale?: number;
  /** Only the properties that were asked for. */
  styles: Record<string, string>;
  /** Opening tag, truncated — identifies the node without dumping subtrees. */
  html: string;
}

export interface SelectorResult {
  selector: string;
  /** Matches in the document, before MAX_MATCHES_PER_SELECTOR truncation. */
  total: number;
  elements: InspectedElement[];
  /** Set when the selector itself was rejected by the document. */
  error?: string;
}

export interface InspectContext {
  chapterId: string | null;
  /** Which rendering engine produced the document that was measured. */
  engine: 'raw' | 'foliate' | 'paged';
  /** Device preset the measured surface is showing. */
  device: string;
  /** Reader flow, when the engine is foliate — 'paginated' columnizes the root
   *  and 'scrolled' does not, which changes layout enough to matter. */
  flow?: 'paginated' | 'scrolled';
  /** Which surface was measured (2 only when the split preview is open). */
  surface: 1 | 2;
  /** A render was still in flight — measurements may be of the previous layout.
   *  Re-run rather than trusting a true here. */
  rendering: boolean;
}

export type InspectSection =
  | { status: 'unavailable'; reason: string }
  | ({ status: 'ok'; caveats: string[]; results: SelectorResult[] } & InspectContext);

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/** The opening tag alone: `outerHTML` up to the first '>', so a wrapper with a
 *  large subtree costs the same as a leaf. */
function openingTag(el: Element): string {
  const html = el.outerHTML ?? `<${el.tagName.toLowerCase()}>`;
  const end = html.indexOf('>');
  return truncate(end === -1 ? html : html.slice(0, end + 1), HTML_SNIPPET_LIMIT);
}

/** Position among same-tag siblings, 1-based; omitted when the tag is unique
 *  at that level (keeps the common case readable). */
function nthOfType(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;
  const sameTag = Array.from(parent.children).filter(child => child.tagName === el.tagName);
  if (sameTag.length < 2) return tag;
  return `${tag}:nth-of-type(${sameTag.indexOf(el) + 1})`;
}

export function elementPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && parts.length < PATH_DEPTH) {
    parts.unshift(nthOfType(node));
    if (node.tagName === 'BODY' || node.tagName === 'HTML') break;
    node = node.parentElement;
  }
  return parts.join(' > ');
}

/** Describe one element: identity, geometry, positioning context, and the
 *  requested computed properties. `win` is the preview document's own window —
 *  computed style must come from the realm the element lives in. */
export function describeElement(
  el: Element,
  win: Window,
  properties: readonly string[],
  index: number
): InspectedElement {
  const box = el.getBoundingClientRect();
  const computed = win.getComputedStyle(el);
  const styles: Record<string, string> = {};
  for (const property of properties) {
    styles[property] = computed.getPropertyValue(property);
  }
  // Duck-typed, not `instanceof win.HTMLElement`: these elements live in the
  // preview iframe's realm, where a host-side instanceof never matches — and
  // reaching for the iframe's own constructors buys nothing over a property
  // check. `offsetParent` is null for the initial containing block (and for
  // display:none), which is exactly when we omit it.
  const offsetHost = el as Element & {
    offsetParent?: Element | null;
    offsetWidth?: number;
  };
  const offsetParent = offsetHost.offsetParent ? elementPath(offsetHost.offsetParent) : undefined;
  const className = typeof el.className === 'string' ? el.className.trim() : '';
  // offsetWidth is the untransformed border box; getBoundingClientRect is the
  // transformed one. Their ratio is the cumulative ancestor scale — derived
  // rather than looked up, so it catches any transformed ancestor, not just the
  // Proofs grid that prompted it. Skipped for zero-width and non-HTML elements,
  // where offsetWidth is absent or meaningless.
  const layoutWidth = offsetHost.offsetWidth;
  const scale =
    typeof layoutWidth === 'number' && layoutWidth > 0 && box.width > 0
      ? box.width / layoutWidth
      : 1;
  const scaled = Math.abs(scale - 1) > SCALE_EPSILON;
  return {
    index,
    tag: el.tagName.toLowerCase(),
    ...(el.id ? { id: el.id } : {}),
    ...(className ? { className } : {}),
    path: elementPath(el),
    rect: {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    },
    ...(offsetParent ? { offsetParent } : {}),
    ...(scaled ? { scale: Math.round(scale * 1e4) / 1e4 } : {}),
    styles,
    html: openingTag(el),
  };
}

/** Run every selector against one document in a single pass. A selector the
 *  document rejects is reported as an error on that entry, not thrown — one bad
 *  selector must not discard the other measurements. */
export function measureSelectors(
  doc: Document,
  win: Window,
  selectors: string[],
  properties: readonly string[]
): SelectorResult[] {
  return selectors.slice(0, MAX_SELECTORS).map(selector => {
    let matches: Element[];
    try {
      matches = Array.from(doc.querySelectorAll(selector));
    } catch (error) {
      return {
        selector,
        total: 0,
        elements: [],
        error: `invalid selector: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    return {
      selector,
      total: matches.length,
      elements: matches
        .slice(0, MAX_MATCHES_PER_SELECTOR)
        .map((el, index) => describeElement(el, win, properties, index)),
    };
  });
}

export function buildInspectSection(
  context: InspectContext,
  results: SelectorResult[],
  requestedSelectors: number
): InspectSection {
  const caveats: string[] = [];
  if (context.rendering) caveats.push('render-in-flight');
  if (context.engine === 'paged') caveats.push('paged-chrome');
  if (requestedSelectors > MAX_SELECTORS) {
    caveats.push(`selectors truncated to the first ${MAX_SELECTORS}`);
  }
  if (results.some(result => result.total > result.elements.length)) {
    caveats.push(`matches truncated to the first ${MAX_MATCHES_PER_SELECTOR} per selector`);
  }
  // Announced, not merely discoverable: an agent that compares a scaled rect
  // against an unscaled computed width without noticing draws a wrong
  // conclusion, which is exactly the trap this field exists to close.
  if (results.some(result => result.elements.some(el => el?.scale !== undefined))) {
    caveats.push(
      'scaled-rects: rects are post-transform; divide by each element’s scale for CSS px'
    );
  }
  return { status: 'ok', ...context, caveats, results };
}
