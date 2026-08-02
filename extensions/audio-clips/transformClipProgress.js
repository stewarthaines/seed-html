/**
 * Prepare a chapter's audio clips (span.clip, produced from the :clip
 * directive) for playback, and decorate them with progress indicators.
 *
 * 1. Ensure the chapter carries a STATIC <audio> element.
 *    Scripts/clip-player.js plays every clip through the one element already
 *    present in the parsed XHTML — dynamically created media elements don't
 *    reliably get a media pipeline in reading systems (iOS Books refuses to
 *    play them). The element is added only when the chapter has clips and no
 *    <audio> of its own, so an author who inlines an <audio controls> element
 *    keeps it: the player adopts the first audio element it finds, visible
 *    controls and all. The inserted element carries the first clip's source
 *    with preload="auto", so the reader buffers the right file at page load.
 *
 * 2. Decorate each clip with an inline SVG progress indicator. Three styles
 *    ship as templates below:
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
 * 3. Optionally swap the play affordance for an icon. By default clip.css
 *    draws a text glyph (▶ / ■) with ::before, which needs no markup at all.
 *    data-affordance=icon injects a circled play/stop pair instead;
 *    data-affordance=none leaves the clip bare for a design that marks it some
 *    other way.
 *
 *      :clip[…]{… data-affordance=icon data-progress=none}
 *
 * The two axes are independent on purpose: the affordance is state (playing or
 * not), the indicator is progress (how far through). An icon can carry any
 * progress style or none, and the text glyph can too.
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

  // The icon affordance: a circled play and a circled stop, one SVG each.
  //
  // Traced verbatim from the artwork this generalises — the play/stop pair in
  // the "Letter from Kenya" project — including their original viewBoxes, which
  // differ (142.448 vs 30.05). Keeping each glyph in its own SVG with its own
  // coordinate system means the paths are copied, not rescaled: no arithmetic,
  // nothing to distort. CSS sizes both to the same em box.
  //
  // fill="currentColor" is what the original could never use: it was set on the
  // file, but the project loaded it as a CSS background-image, which cannot
  // inherit colour — hence the filter: invert() … hue-rotate() tint it carried
  // to go blue. Inlined, the declaration finally works and the control takes
  // the surrounding text colour.
  const ICONS = {
    play: `<svg xmlns="http://www.w3.org/2000/svg" class="clip-icon clip-icon--play" viewBox="0 0 142.448 142.448" fill="currentColor" aria-hidden="true" focusable="false">
  <path d="M142.411,68.9C141.216,31.48,110.968,1.233,73.549,0.038c-20.361-0.646-39.41,7.104-53.488,21.639C6.527,35.65-0.584,54.071,0.038,73.549c1.194,37.419,31.442,67.667,68.861,68.861c0.779,0.025,1.551,0.037,2.325,0.037c19.454,0,37.624-7.698,51.163-21.676C135.921,106.799,143.033,88.377,142.411,68.9z M111.613,110.336c-10.688,11.035-25.032,17.112-40.389,17.112c-0.614,0-1.228-0.01-1.847-0.029c-29.532-0.943-53.404-24.815-54.348-54.348c-0.491-15.382,5.122-29.928,15.806-40.958c10.688-11.035,25.032-17.112,40.389-17.112c0.614,0,1.228,0.01,1.847,0.029c29.532,0.943,53.404,24.815,54.348,54.348C127.91,84.76,122.296,99.306,111.613,110.336z"/>
  <path d="M94.585,67.086L63.001,44.44c-3.369-2.416-8.059-0.008-8.059,4.138v45.293c0,4.146,4.69,6.554,8.059,4.138l31.583-22.647C97.418,73.331,97.418,69.118,94.585,67.086z"/>
</svg>`,
    stop: `<svg xmlns="http://www.w3.org/2000/svg" class="clip-icon clip-icon--stop" viewBox="0 0 30.05 30.05" fill="currentColor" aria-hidden="true" focusable="false">
  <path d="M18.993,10.688h-7.936c-0.19,0-0.346,0.149-0.346,0.342v8.022c0,0.189,0.155,0.344,0.346,0.344h7.936c0.19,0,0.344-0.154,0.344-0.344V11.03C19.336,10.838,19.183,10.688,18.993,10.688z"/>
  <path d="M15.026,0C6.729,0,0.001,6.726,0.001,15.025S6.729,30.05,15.026,30.05c8.298,0,15.023-6.726,15.023-15.025S23.324,0,15.026,0z M15.026,27.54c-6.912,0-12.516-5.604-12.516-12.515c0-6.914,5.604-12.517,12.516-12.517c6.913,0,12.514,5.603,12.514,12.517C27.54,21.936,21.939,27.54,15.026,27.54z"/>
</svg>`,
  };

  /** Parse an SVG string to an importable element, or null if it won't parse. */
  const parseSvg = markup => {
    const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const svg = parsed.documentElement;
    if (!svg || svg.getElementsByTagName('parsererror').length) return null;
    return htmlDocument.importNode(svg, true);
  };

  // A fixed pseudo-random sparkline (same on every render, so diffs stay quiet).
  const WAVE_HEIGHTS = [5, 9, 13, 7, 11, 15, 8, 4, 10, 14, 6, 12, 9, 5, 11, 7, 13, 6, 9, 4];
  const waveBars = WAVE_HEIGHTS.map((h, i) => {
    const x = i * 5;
    const y = (16 - h) / 2;
    return `<rect x="${x}" y="${y}" width="3.4" height="${h}" rx="1.7"/>`;
  }).join('');

  const clips = htmlDocument.querySelectorAll('span.clip[data-src]');

  // The static playback element (see header). data-src is chapter-relative
  // ('../Audio/…') — the same convention as every other source reference —
  // so it resolves directly against the chapter document, as do the blob:
  // URLs the authoring preview rewrites it to.
  if (clips.length > 0 && !htmlDocument.querySelector('audio')) {
    const resolved = clips[0].getAttribute('data-src');
    const audio = htmlDocument.createElement('audio');
    audio.setAttribute('class', 'clip-audio');
    audio.setAttribute('preload', 'auto');
    audio.setAttribute('src', resolved);
    // No controls and no hidden: a controls-less audio element renders
    // nothing, and some reading systems are wary of display:none media.
    htmlDocument.body.appendChild(audio);
  }

  for (const clip of clips) {
    // Affordance first: it leads the clip, the way the ::before glyph it
    // replaces does. Both glyphs are injected; clip.css shows one at a time.
    if (clip.getAttribute('data-affordance') === 'icon' && !clip.querySelector('svg.clip-icon')) {
      const before = clip.firstChild;
      for (const markup of [ICONS.play, ICONS.stop]) {
        const icon = parseSvg(markup);
        if (icon) clip.insertBefore(icon, before);
      }
    }

    if (clip.querySelector('svg.clip-progress')) continue; // idempotent

    const style = clip.getAttribute('data-progress') || DEFAULT_STYLE;
    const template = TEMPLATES[style];
    if (!template) continue; // 'none' or unknown → no indicator

    const svg = parseSvg(template.replace(/WAVE_BARS/g, waveBars));
    if (svg) clip.appendChild(svg);
  }

  return htmlDocument;
}
