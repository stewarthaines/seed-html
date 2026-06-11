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

/** The cover background color for a given hue. Shared with the UI swatch. */
export function coverBackgroundColor(hue: number): string {
  return `hsl(${hue}, 50%, 28%)`;
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

export function generateCoverSvg(title: string, author: string, hue?: number): string {
  const safeTitle = title.trim() || 'Untitled';
  const bg = coverBackgroundColor(hue ?? titleHue(safeTitle));

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
    ? `\n  <text x="300" y="830" font-family="Georgia,'Times New Roman',serif" font-size="${authorFontSize}" fill="rgba(255,255,255,0.7)" text-anchor="middle" font-style="italic">${xmlEscape(safeAuthor)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <rect width="600" height="900" fill="${bg}"/>
  <text y="${firstLineY}" font-family="Georgia,'Times New Roman',serif" font-size="${fontSize}" fill="white" text-anchor="middle">
${tspans}
  </text>${authorLine}
</svg>`;
}
