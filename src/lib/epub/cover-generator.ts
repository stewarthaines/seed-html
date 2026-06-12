/**
 * Generates a minimal parametric SVG cover image for a new EPUB project.
 * Hue is derived deterministically from the title so each project gets a
 * distinct but stable colour.
 *
 * Font size is driven by the longest wrapped line so that text fills most
 * of the cover width — making it readable even at thumbnail scale.
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
const COVER_THEMES: Record<
  CoverMode,
  { L: number; C: number; text: string; author: string }
> = {
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

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wordWrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Wrap greedily, widening maxChars until ≤ 5 lines (or truncate at that point). */
function fitLines(text: string): string[] {
  for (const max of [10, 13, 16, 20]) {
    const ls = wordWrap(text, max);
    if (ls.length <= 5) return ls;
  }
  return wordWrap(text, 20).slice(0, 5);
}

/**
 * Renders an SVG string to a PNG ArrayBuffer.
 * The PNG is scaled to fit within maxDim × maxDim while preserving aspect ratio.
 * Uses a browser canvas — must be called in a window context.
 */
export async function generateCoverPng(svgString: string, maxDim = 512): Promise<ArrayBuffer> {
  // The SVG viewBox is 600×900 (2:3). Fit within maxDim on the longer side.
  const SVG_W = 600, SVG_H = 900;
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

export function generateCoverSvg(
  title: string,
  author: string,
  hue?: number,
  mode: CoverMode = 'dark'
): string {
  const safeTitle = title.trim() || 'Untitled';
  const theme = COVER_THEMES[mode];
  const bg = coverBackgroundColor(hue ?? titleHue(safeTitle), mode);

  const lines = fitLines(safeTitle);
  const longestLine = lines.reduce((a, b) => (a.length >= b.length ? a : b), '');

  // Scale font so the longest line fills ~520 px (87% of 600 px viewBox width).
  // 0.52 is an approximate average character width ratio for Georgia at large sizes.
  const fontSize = Math.min(160, Math.max(48, Math.round(520 / (longestLine.length * 0.52))));
  const lineHeight = Math.round(fontSize * 1.3);

  // Vertically centre the title block in the top 72% of the cover when an
  // author is present; in the full height when there is none.
  const blockHeight = (lines.length - 1) * lineHeight;
  const titleCenterY = author.trim() ? 340 : 430;
  const firstLineY = titleCenterY - Math.round(blockHeight / 2);

  const tspans = lines
    .map((line, i) => `    <tspan x="300" dy="${i === 0 ? 0 : lineHeight}">${xmlEscape(line)}</tspan>`)
    .join('\n');

  const safeAuthor = author.trim();
  // Author font size: proportional to title, clamped to a readable range. The
  // floor matters most — multi-line titles shrink the title font, and the author
  // must stay legible even in the small OPDS thumbnail.
  const authorFontSize = Math.min(62, Math.max(54, Math.round(fontSize * 0.42)));
  const authorLine = safeAuthor
    ? `\n  <text x="300" y="830" font-family="Georgia,'Times New Roman',serif" font-size="${authorFontSize}" fill="${theme.author}" text-anchor="middle" font-style="italic">${xmlEscape(safeAuthor)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <rect width="600" height="900" fill="${bg}"/>
  <text y="${firstLineY}" font-family="Georgia,'Times New Roman',serif" font-size="${fontSize}" fill="${theme.text}" text-anchor="middle">
${tspans}
  </text>${authorLine}
</svg>`;
}
