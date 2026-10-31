/**
 * The font files behind a page description's fonts, from the book itself.
 *
 * Each font the layout used (`FontUse`: the computed family list, weight and
 * style) is matched to an `@font-face` rule in the paginated document's
 * stylesheets, and its file is fetched from the rule's `src`. A font with no
 * face in the book is a problem, not a substitute: a web page can't read the
 * system's font files, and a system font differs between computers
 * (process/ACCESSIBLE_PDF_PDFKIT.md, phase 0 findings).
 */
import type { FontUse } from './page-description.js';

export interface FontFace {
  family: string;
  /** Lowest and highest weight the face covers (`font-weight: 100 900`). */
  weight: [number, number];
  style: 'normal' | 'italic' | 'oblique';
  /** The first `url()` in `src`, resolved against its stylesheet. */
  url: string;
}

/** Split a CSS `font-family` list into names, unquoted. */
export function parseFamilyList(value: string): string[] {
  const names: string[] = [];
  const re = /\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^,]+))\s*(?:,|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) && m[0] !== '') {
    const name = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\\(.)/g, '$1').trim();
    if (name) names.push(name);
  }
  return names;
}

const WEIGHT_KEYWORDS: Record<string, number> = { normal: 400, bold: 700 };

function parseWeight(value: string): [number, number] {
  const parts = value
    .trim()
    .split(/\s+/)
    .map(p => WEIGHT_KEYWORDS[p] ?? Number(p))
    .filter(n => Number.isFinite(n) && n > 0);
  if (parts.length === 0) return [400, 400];
  return [parts[0], parts[1] ?? parts[0]];
}

function parseStyle(value: string): FontFace['style'] {
  if (value.startsWith('italic')) return 'italic';
  if (value.startsWith('oblique')) return 'oblique';
  return 'normal';
}

/** The first `url(...)` in a `src` descriptor, or null. */
export function firstSrcUrl(src: string): string | null {
  const m = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/.exec(src);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

/**
 * The face CSS would choose for a weight and style among one family's faces
 * (CSS Fonts 4, font matching, simplified): style first, italic and oblique
 * standing in for each other before normal; then the nearest weight, looking
 * down first for weights up to 500 and up first above it.
 */
export function pickFace(
  faces: FontFace[],
  use: Pick<FontUse, 'weight' | 'style'>
): FontFace | null {
  const styleOrder: FontFace['style'][] =
    use.style === 'normal'
      ? ['normal', 'oblique', 'italic']
      : use.style === 'italic'
        ? ['italic', 'oblique', 'normal']
        : ['oblique', 'italic', 'normal'];
  for (const style of styleOrder) {
    const candidates = faces.filter(f => f.style === style);
    if (candidates.length === 0) continue;
    const w = use.weight;
    const inRange = candidates.find(f => f.weight[0] <= w && w <= f.weight[1]);
    if (inRange) return inRange;
    const below = candidates.filter(f => f.weight[1] < w).sort((a, b) => b.weight[1] - a.weight[1]);
    const above = candidates.filter(f => f.weight[0] > w).sort((a, b) => a.weight[0] - b.weight[0]);
    const order = w <= 500 ? [...below, ...above] : [...above, ...below];
    return order[0] ?? null;
  }
  return null;
}

/** Every `@font-face` rule in a document's stylesheets, nested ones included. */
export function collectFontFaces(doc: Document): FontFace[] {
  const faces: FontFace[] = [];
  const visit = (rules: CSSRuleList, base: string) => {
    for (const rule of Array.from(rules)) {
      if (rule.constructor.name === 'CSSFontFaceRule' || rule.type === 5) {
        const style = (rule as CSSFontFaceRule).style;
        const url = firstSrcUrl(style.getPropertyValue('src'));
        const family = parseFamilyList(style.getPropertyValue('font-family'))[0];
        if (!url || !family) continue;
        faces.push({
          family,
          weight: parseWeight(style.getPropertyValue('font-weight') || 'normal'),
          style: parseStyle(style.getPropertyValue('font-style') || 'normal'),
          url: new URL(url, base).href,
        });
      } else if ('cssRules' in rule) {
        visit((rule as CSSGroupingRule).cssRules, base);
      }
    }
  };
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet: not the book's
    }
    visit(rules, sheet.href ?? doc.baseURI);
  }
  return faces;
}

/**
 * The file for each font, in the order of `fonts`, or the families that have
 * no face in the book. A family list is tried name by name, as CSS does.
 */
export async function loadFontFiles(
  faces: FontFace[],
  fonts: FontUse[],
  fetchFile: (url: string) => Promise<ArrayBuffer> = async url => (await fetch(url)).arrayBuffer()
): Promise<{ files: ArrayBuffer[]; missing: string[] }> {
  const files: ArrayBuffer[] = [];
  const missing: string[] = [];
  const cache = new Map<string, Promise<ArrayBuffer>>();
  for (const use of fonts) {
    let face: FontFace | null = null;
    for (const name of parseFamilyList(use.family)) {
      const ofFamily = faces.filter(f => f.family.toLowerCase() === name.toLowerCase());
      face = pickFace(ofFamily, use);
      if (face) break;
    }
    if (!face) {
      if (!missing.includes(use.family)) missing.push(use.family);
      files.push(new ArrayBuffer(0));
      continue;
    }
    if (!cache.has(face.url)) cache.set(face.url, fetchFile(face.url));
    files.push(await cache.get(face.url)!);
  }
  return { files, missing };
}
