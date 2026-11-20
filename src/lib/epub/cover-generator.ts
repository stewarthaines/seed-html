/**
 * Generates a minimal parametric SVG cover image for a new EPUB project.
 * Hue is derived deterministically from the title so each project gets a
 * distinct but stable colour.
 *
 * The title takes whichever line breaks allow the biggest type, with half an
 * em clear each side of the widest line — readable even at thumbnail scale.
 */

/** Deterministic hue (0–359) from a title string — the default cover hue. */
export function titleHue(title: string): number {
  let h = 5381;
  for (let i = 0; i < title.length; i++) {
    h = ((h << 5) + h + title.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

// Light/dark text choice for the generated cover.
export type CoverMode = 'dark' | 'light';

// The cover background is generated in OKLCH (a perceptually-uniform space) at
// fixed lightness and chroma, so every hue comes out at the same perceived
// darkness and saturation — a harmonious ribbon of "book-cover" tones rather
// than HSL's uneven sweep. Two themes: 'dark' = deep, saturated background with
// white text; 'light' = pale, low-chroma "paper" tint with near-black text.
// (Tweak the constants to taste.)
const COVER_THEMES: Record<CoverMode, { L: number; C: number; text: string; author: string }> = {
  dark: { L: 0.5, C: 0.15, text: '#ffffff', author: 'rgba(255,255,255,0.72)' },
  light: { L: 0.9, C: 0.07, text: '#1a1a1a', author: 'rgba(0,0,0,0.6)' },
};

/** OKLCH (L 0–1, chroma, hue°) → sRGB hex, clamped to the sRGB gamut. */
function oklchToHex(L: number, C: number, hueDeg: number): string {
  const h = (hueDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  // OKLab → linear sRGB (Björn Ottosson's coefficients).
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  // Linear → gamma sRGB, clamped to [0,1] (simple gamut clamp).
  const channel = (x: number) => {
    const c = x <= 0 ? 0 : x >= 1 ? 1 : x;
    const g8 = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(g8 * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(r)}${channel(g)}${channel(bl)}`;
}

/** The cover background color for a given hue + mode. Shared with the UI swatch. */
export function coverBackgroundColor(hue: number, mode: CoverMode = 'dark'): string {
  const theme = COVER_THEMES[mode];
  return oklchToHex(theme.L, theme.C, hue);
}

/** The cover text color for a mode (white on dark, near-black on light). */
export function coverTextColor(mode: CoverMode = 'dark'): string {
  return COVER_THEMES[mode].text;
}

// Open-book "face" mark from docs/readitinabook-logo-openbook.svg (icon only, no
// wordmark). Native ~bbox x[37..283] y[39..289], centre ≈ (160, 164), ~250 px tall.
// Stroke colour/width come from the wrapping <g> so the mark adopts the cover's text
// colour. The shapes carry their own per-element stroke-width where the source did.
const COVER_MARK =
  '<path d="M 37,289 L 37,61 Q 37,39 59,39 L 261,39 Q 283,39 283,61 L 283,289 Z"/>' +
  '<line x1="62" y1="46" x2="62" y2="171" stroke-width="13"/>' +
  '<line x1="258" y1="46" x2="258" y2="155" stroke-width="13"/>' +
  '<circle cx="124" cy="103" r="20" stroke-width="13"/>' +
  '<circle cx="196" cy="103" r="20" stroke-width="13"/>' +
  '<g transform="translate(-15 5)"><path d="m 54,170 c 47.50365,-3.59124 95.66667,5.24574 121,11.91241 39.93066,-21.67518 68.91728,-30.41606 123,-34.49635" stroke-width="13"/></g>';

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi);

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Georgia Regular advance widths in thousandths of an em, read from the font's
// hmtx table for printable ASCII. Measuring with a fixed table (not canvas
// measureText) keeps the cover identical on every machine; a reader that falls
// back to Times gets narrower text, so the margin only grows.
const GEORGIA_WIDTHS: Record<string, number> = {
  ' ': 241,
  '!': 331,
  '"': 412,
  '#': 643,
  $: 610,
  '%': 817,
  '&': 710,
  "'": 215,
  '(': 375,
  ')': 375,
  '*': 472,
  '+': 643,
  ',': 270,
  '-': 374,
  '.': 270,
  '/': 469,
  '0': 614,
  '1': 430,
  '2': 559,
  '3': 552,
  '4': 565,
  '5': 528,
  '6': 566,
  '7': 502,
  '8': 596,
  '9': 566,
  ':': 312,
  ';': 312,
  '<': 643,
  '=': 643,
  '>': 643,
  '?': 479,
  '@': 929,
  A: 671,
  B: 654,
  C: 642,
  D: 749,
  E: 653,
  F: 599,
  G: 725,
  H: 815,
  I: 390,
  J: 518,
  K: 694,
  L: 604,
  M: 927,
  N: 767,
  O: 744,
  P: 610,
  Q: 744,
  R: 702,
  S: 561,
  T: 619,
  U: 756,
  V: 667,
  W: 976,
  X: 710,
  Y: 615,
  Z: 602,
  '[': 375,
  '\\': 469,
  ']': 375,
  '^': 643,
  _: 643,
  '`': 500,
  a: 504,
  b: 560,
  c: 454,
  d: 574,
  e: 483,
  f: 325,
  g: 509,
  h: 582,
  i: 293,
  j: 292,
  k: 536,
  l: 286,
  m: 881,
  n: 591,
  o: 539,
  p: 571,
  q: 560,
  r: 410,
  s: 432,
  t: 345,
  u: 575,
  v: 497,
  w: 737,
  x: 505,
  y: 492,
  z: 444,
  '{': 430,
  '|': 375,
  '}': 430,
  '~': 643,
};

/** Estimated width of a line in ems when set in Georgia. */
export function titleLineEm(line: string): number {
  let total = 0;
  for (const ch of line) {
    const known = GEORGIA_WIDTHS[ch];
    if (known !== undefined) total += known;
    // Unknown characters: full width for CJK and beyond, a wide lowercase otherwise.
    else total += (ch.codePointAt(0) ?? 0) >= 0x2e80 ? 1000 : 620;
  }
  return total / 1000;
}

/** Every way to break the words into 1..maxLines contiguous lines. */
function lineSplits(words: string[], maxLines: number): string[][] {
  const results: string[][] = [];
  const walk = (start: number, acc: string[]) => {
    if (start === words.length) {
      results.push(acc);
      return;
    }
    if (acc.length === maxLines) return;
    for (let end = start + 1; end <= words.length; end++) {
      walk(end, [...acc, words.slice(start, end).join(' ')]);
    }
  };
  walk(0, []);
  return results;
}

/** Greedy wraps at every character budget — used when a title has too many words to try every split. */
function greedySplits(words: string[], maxLines: number): string[][] {
  const results: string[][] = [];
  const total = words.join(' ').length;
  for (let max = 1; max <= total; max++) {
    const lines: string[] = [];
    for (const word of words) {
      const last = lines[lines.length - 1];
      if (last !== undefined && (last + ' ' + word).length <= max) {
        lines[lines.length - 1] = last + ' ' + word;
      } else {
        lines.push(word);
      }
    }
    if (lines.length <= maxLines) results.push(lines);
  }
  return results;
}

/** The largest title font (viewBox px) at which these lines fit the title zone. */
function fontForLines(lines: string[]): number {
  const widest = Math.max(...lines.map(titleLineEm));
  // Width: the widest line plus TITLE_SIDE_MARGIN_EM each side spans the cover.
  const widthFont = COVER_WIDTH / (widest + 2 * TITLE_SIDE_MARGIN_EM);
  // Height: the visual block ≈ the baseline spans plus one line's cap-height +
  // descender (~0.9·font); solving that ≤ the zone height gives the largest fit.
  const zoneHeight = TITLE_ZONE_BOTTOM - TITLE_ZONE_TOP;
  const heightFont = zoneHeight / ((lines.length - 1) * LINE_RATIO + 0.9);
  return Math.floor(Math.min(widthFont, heightFont, FONT_CAP));
}

/**
 * Break the title into lines and size it: try every split into at most
 * MAX_TITLE_LINES lines and keep the one that allows the biggest type, so a
 * title breaks when breaking makes it larger and shrinks when it does not.
 * A split with fewer lines wins when its type is within FEWER_LINES_LEAN of the best.
 */
export function layoutTitle(text: string): { lines: string[]; fontSize: number } {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [text], fontSize: FONT_FLOOR };
  const candidates =
    words.length <= EXHAUSTIVE_WORD_LIMIT
      ? lineSplits(words, MAX_TITLE_LINES)
      : greedySplits(words, MAX_TITLE_LINES);

  let best = { lines: [words.join(' ')], fontSize: 0 };
  for (const lines of candidates) {
    const fontSize = fontForLines(lines);
    if (fontSize > best.fontSize) best = { lines, fontSize };
  }
  const threshold = best.fontSize * (1 - FEWER_LINES_LEAN);
  for (const lines of candidates) {
    if (lines.length >= best.lines.length) continue;
    const fontSize = fontForLines(lines);
    if (fontSize >= threshold) best = { lines, fontSize };
  }
  return { lines: best.lines, fontSize: clamp(best.fontSize, FONT_FLOOR, FONT_CAP) };
}

/**
 * Renders an SVG string to a PNG ArrayBuffer.
 * The PNG is scaled to fit within maxDim × maxDim while preserving aspect ratio.
 * Uses a browser canvas — must be called in a window context.
 */
export async function generateCoverPng(svgString: string, maxDim = 512): Promise<ArrayBuffer> {
  // The SVG viewBox is 600×900 (2:3). Fit within maxDim on the longer side.
  const SVG_W = 600,
    SVG_H = 900;
  const scale = maxDim / Math.max(SVG_W, SVG_H);
  const w = Math.round(SVG_W * scale);
  const h = Math.round(SVG_H * scale);

  // The source SVG carries its own width/height (600×900), so the loaded image
  // has a defined intrinsic size; drawImage scales it to the target w×h below.
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG load failed'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.drawImage(img, 0, 0, w, h);

    return new Promise<ArrayBuffer>((resolve, reject) => {
      canvas.toBlob(b => {
        if (!b) return reject(new Error('PNG conversion failed'));
        b.arrayBuffer().then(resolve, reject);
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Vertical layout zones (viewBox 600×900). The title is centred in its zone, the
// brand mark sits in a band below it, and the author sits at the foot — leaving the
// title comfortable room rather than crowding the top edge.
const TITLE_ZONE_TOP = 95;
const TITLE_ZONE_BOTTOM = 540;
const LINE_RATIO = 1.38; // looser than the old 1.3 so multi-line titles breathe
const COVER_WIDTH = 600;
const TITLE_SIDE_MARGIN_EM = 0.5; // clear space each side of the widest line, in title ems
const MAX_TITLE_LINES = 5;
const EXHAUSTIVE_WORD_LIMIT = 24; // above this, greedy wraps instead of every split
const FEWER_LINES_LEAN = 0.03; // fewer lines win when their type is within 3% of the best
const FONT_CAP = 160; // absolute title font ceiling
const FONT_FLOOR = 40; // smallest title font, even if a very long title then overflows
const LOGO_CENTER_Y = 648;
const LOGO_TARGET_H = 140;
const AUTHOR_BASELINE_Y = 838;

const TITLE_FONT = "Georgia,'Times New Roman',serif";

/**
 * Generate a parametric cover SVG for an EPUB project.
 *
 * The output is structured for editing: named Inkscape layers (Background, Title,
 * Logo, Author), a <title>/<desc>, and live <text> (not outlined paths), so an author
 * can open the written cover.svg in Inkscape, tweak it, and re-import it as the cover.
 * The default cover carries the read-it-in-a-book open-book mark between the title and
 * the author, stroked in the cover's text colour. Inkscape-only attributes are ignored
 * by browsers and e-readers, so the rasterised PNG and reader rendering are unaffected.
 */
export function generateCoverSvg(
  title: string,
  author: string,
  hue?: number,
  mode: CoverMode = 'dark'
): string {
  const safeTitle = title.trim() || 'Untitled';
  const safeAuthor = author.trim();
  const theme = COVER_THEMES[mode];
  const bg = coverBackgroundColor(hue ?? titleHue(safeTitle), mode);

  const { lines, fontSize } = layoutTitle(safeTitle);
  const lineHeight = Math.round(fontSize * LINE_RATIO);

  // Centre the visual block in its zone. The +0.25·fontSize shifts the first baseline
  // down to account for cap-height, so the block sits centred instead of riding high.
  const span = (lines.length - 1) * lineHeight;
  const zoneCenter = (TITLE_ZONE_TOP + TITLE_ZONE_BOTTOM) / 2;
  const firstBaselineY = Math.round(zoneCenter - span / 2 + 0.25 * fontSize);

  // sodipodi:role="line" marks each tspan as a real line for Inkscape's text
  // tool — without it a font change re-lays the tspans out as inline runs and
  // the title shatters. Browsers and e-readers ignore the attribute (the
  // namespace is declared on the root, like the layer attributes).
  const tspans = lines
    .map(
      (line, i) =>
        `      <tspan sodipodi:role="line" x="300" dy="${i === 0 ? 0 : lineHeight}">${xmlEscape(line)}</tspan>`
    )
    .join('\n');

  // Scale the ~250 px-tall mark to LOGO_TARGET_H and centre it at (300, LOGO_CENTER_Y).
  const markScale = LOGO_TARGET_H / 250;
  const markX = +(300 - 160 * markScale).toFixed(2);
  const markY = +(LOGO_CENTER_Y - 164 * markScale).toFixed(2);
  const logoLayer = `  <g inkscape:groupmode="layer" inkscape:label="Logo" id="cover-logo">
    <g transform="translate(${markX} ${markY}) scale(${+markScale.toFixed(4)})" fill="none" stroke="${theme.text}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">${COVER_MARK}</g>
  </g>`;

  // Author font size: proportional to the title, clamped so it stays legible even when
  // a multi-line title shrinks the title font (and in the small OPDS thumbnail).
  const authorFontSize = clamp(Math.round(fontSize * 0.42), 54, 62);
  const authorLayer = safeAuthor
    ? `\n  <g inkscape:groupmode="layer" inkscape:label="Author" id="cover-author">
    <text x="300" y="${AUTHOR_BASELINE_Y}" font-family="${TITLE_FONT}" font-size="${authorFontSize}" fill="${theme.author}" text-anchor="middle" font-style="italic">${xmlEscape(safeAuthor)}</text>
  </g>`
    : '';

  const desc = safeAuthor
    ? `Editable cover for "${xmlEscape(safeTitle)}" by ${xmlEscape(safeAuthor)}.`
    : `Editable cover for "${xmlEscape(safeTitle)}".`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd" width="600" height="900" viewBox="0 0 600 900">
  <title>${xmlEscape(safeTitle)} — cover</title>
  <desc>${desc} Generated by SEED.html (Simple EPUB Editor). Layers: Background, Title, Logo, Author — text is live, edit it in Inkscape then re-import this file as the cover image.</desc>
  <g inkscape:groupmode="layer" inkscape:label="Background" id="cover-background">
    <rect width="600" height="900" fill="${bg}"/>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Title" id="cover-title">
    <text y="${firstBaselineY}" font-family="${TITLE_FONT}" font-size="${fontSize}" fill="${theme.text}" text-anchor="middle">
${tspans}
    </text>
  </g>
${logoLayer}${authorLayer}
</svg>`;
}
