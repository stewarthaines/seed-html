/**
 * Decorate each audio clip (span.clip, produced from the :clip directive) with
 * an inline SVG progress indicator. Three styles ship as templates below:
 *
 *   ring — Apple-Books-style circle that fills clockwise
 *   bar  — contracting bar: full at the start, empty when the clip ends
 *   wave — waveform sparkline revealed left-to-right
 *
 * Pick a style per clip with a data-progress attribute, routed through the
 * :clip directive's pass-through attributes:
 *
 *   :clip[chorus]{src=Audio/song.mp3 begin=0:01:10 end=0:01:25 data-progress=wave}
 *
 * Clips without the attribute use DEFAULT_STYLE; data-progress=none opts out.
 *
 * The indicator is purely presentational: Scripts/clip-player.js toggles the
 * span's clip-playing class and publishes --clip-duration, and the animations
 * in Styles/clip.css do the rest. Without JavaScript the indicator stays in
 * its resting state (full ring track, full bar, grey wave) — a quiet hint that
 * the text is a clip, consistent with the player's progressive enhancement.
 *
 * @param {Document} htmlDocument - the chapter's rendered DOM (HTML)
 * @param {string} idref - spine item id for this chapter
 * @param {object} ctx - transform context (unused; pure markup decoration)
 */
async function transformDOM(htmlDocument, idref, ctx) {
  void ctx;
  const DEFAULT_STYLE = 'ring';

  // r=8 circle: circumference 2π·8 ≈ 50.27 — the dash values clip.css animates.
  // The -90° rotation starts the sweep at 12 o'clock, like a clock face.
  const TEMPLATES = {
    ring: `<svg xmlns="http://www.w3.org/2000/svg" class="clip-progress clip-progress--ring" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
  <circle class="clip-progress-track" cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.25"/>
  <circle class="clip-progress-value" cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="50.27" stroke-dashoffset="50.27" transform="rotate(-90 10 10)"/>
</svg>`,
    bar: `<svg xmlns="http://www.w3.org/2000/svg" class="clip-progress clip-progress--bar" viewBox="0 0 100 8" aria-hidden="true" focusable="false">
  <line class="clip-progress-track" x1="4" y1="4" x2="96" y2="4" stroke="currentColor" stroke-width="8" stroke-linecap="round" opacity="0.25"/>
  <line class="clip-progress-value" x1="4" y1="4" x2="96" y2="4" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-dasharray="92"/>
</svg>`,
    wave: `<svg xmlns="http://www.w3.org/2000/svg" class="clip-progress clip-progress--wave" viewBox="0 0 100 16" aria-hidden="true" focusable="false">
  <g class="clip-progress-track" fill="currentColor" opacity="0.25">WAVE_BARS</g>
  <g class="clip-progress-value" fill="currentColor">WAVE_BARS</g>
</svg>`,
  };

  // A fixed pseudo-random sparkline (same on every render, so diffs stay quiet).
  const WAVE_HEIGHTS = [5, 9, 13, 7, 11, 15, 8, 4, 10, 14, 6, 12, 9, 5, 11, 7, 13, 6, 9, 4];
  const waveBars = WAVE_HEIGHTS.map((h, i) => {
    const x = i * 5;
    const y = (16 - h) / 2;
    return `<rect x="${x}" y="${y}" width="3.4" height="${h}" rx="1.7"/>`;
  }).join('');

  const clips = htmlDocument.querySelectorAll('span.clip[data-src]');
  for (const clip of clips) {
    if (clip.querySelector('svg.clip-progress')) continue; // idempotent

    const style = clip.getAttribute('data-progress') || DEFAULT_STYLE;
    const template = TEMPLATES[style];
    if (!template) continue; // 'none' or unknown → no indicator

    const svgText = template.replace(/WAVE_BARS/g, waveBars);
    const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svg = parsed.documentElement;
    if (!svg || svg.getElementsByTagName('parsererror').length) continue;

    clip.appendChild(htmlDocument.importNode(svg, true));
  }

  return htmlDocument;
}
