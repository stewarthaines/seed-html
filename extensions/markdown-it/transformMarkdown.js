/**
 * Convert simple text to well-formed XHTML
 * @param {string} markdown - plain text
 * @param {string|undefined} idref - Spine item idref for context-aware transforms
 * @returns {string} Valid XHTML output
 */
function transformText(markdown, idref) {
  const md = window.markdownit({
    typographer: true,
    html: true,
    // highlight,
  });
  md.use(window.markdownItAttrs);
  md.use(clipPlugin);
  return md.render(markdown);
}

/**
 * markdown-it inline rule: rewrite the SEED audio-clip directive (the default
 * audio clip template) into a playable span.
 *
 *   :clip[label]{src=Audio/a.mp3 begin=0:00:05.00 end=0:00:15.00}
 *     → <span class="clip" data-src="Audio/a.mp3" data-begin="…" data-end="…">label</span>
 *
 * Attribute values may be bare or double-quoted; an optional rate=… carries
 * through as data-rate. Registered before `link` so the [label] is consumed
 * here rather than parsed as a link; a directive missing src/begin/end is left
 * for the normal rules (and code spans never reach inline rules). Playback and
 * styling come from the audio-clips extension (Scripts/clip-player.js targets
 * span.clip).
 */
function clipPlugin(md) {
  const DIRECTIVE = /^:clip\[([^\]]*)\]\{([^}]*)\}/;
  const ATTR = /([a-zA-Z_][\w-]*)=(?:"([^"]*)"|([^\s"]+))/g;

  md.inline.ruler.before('link', 'seed_clip', (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x3a /* : */) return false;
    const match = DIRECTIVE.exec(state.src.slice(state.pos));
    if (!match) return false;
    const attrs = {};
    for (const m of match[2].matchAll(ATTR)) attrs[m[1]] = m[2] !== undefined ? m[2] : m[3];
    if (!attrs.src || !attrs.begin || !attrs.end) return false;
    if (!silent) {
      const open = state.push('seed_clip_open', 'span', 1);
      open.attrs = [
        ['class', 'clip'],
        ['data-src', attrs.src],
        ['data-begin', attrs.begin],
        ['data-end', attrs.end],
      ];
      if (attrs.rate) open.attrs.push(['data-rate', attrs.rate]);
      const text = state.push('text', '', 0);
      text.content = match[1];
      state.push('seed_clip_close', 'span', -1);
    }
    state.pos += match[0].length;
    return true;
  });
}

function highlight(str, lang) {
  // Check if the language is available in highlight.js
  if (lang && hljs.getLanguage(lang)) {
  try {
    // Highlight the code and return the value
      return (
        '<pre class="code-block hljs"><code>' +
        hljs.highlight(str, { language: lang, ignoreIllegals: true })
          .value +
        "</code></pre>"
      );
    } catch (e) {
      console.error("Highlight.js error:", e);
    }
  }
  // If no language or an error occurs, return the string as is
  return str;
}
