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
  md.use(symbolPlugin);
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


/**
 * markdown-it plugin: rewrite an attributed SEED directive — `:alias:{…}`,
 * any alias — into the neutral carrier span a DOM transform consumes, and
 * mark a paragraph made only of same-alias directives as the set:
 *
 *   :region:{at="5.2,17.7,11.4,21.9" of=roger_king as="Roger King" row="Back"}
 *   :region:{at="17.3,14.8,9.9,20.4" as="Ian Vitcheff" row="Back"}
 *     → <p class="region-set"><span class="region" data-at="…" data-of="…" …></span>…</p>
 *
 * Every attribute becomes data-<name> on the span; values may be bare or
 * double-quoted. A directive with no attributes is left for the normal rules
 * (visible text). The inline rule is registered before `link` and consumes
 * the whole directive as one token, so markdown-it-attrs never sees a
 * well-formed directive's braces. Consecutive directive lines form one
 * paragraph; the core rule stamps that paragraph `<alias>-set` (joined to any
 * class markdown-it-attrs put there) when its inline content is nothing but
 * same-alias directives and line breaks — the same shape the djot
 * symbolFilter produces, so a consumer binds one shape. A paragraph mixing
 * prose or aliases keeps its spans but gets no set class. markdown-it-attrs
 * rules apply on top: `:detail:{…} {.half}` (a space before the braces) puts
 * .half on the paragraph, `:detail:{…}{.half}` puts it on the span.
 *
 * Which attributes a directive needs is the consuming DOM transform's
 * business — photo-regions (extensions/photo-regions/transformRegions.js)
 * reconstitutes a region without a usable at=, or a detail without src=, as
 * visible text with a note saying what it needs.
 */
function symbolPlugin(md) {
  const DIRECTIVE = /^:([A-Za-z0-9_+-]+):\{([^}]*)\}/;
  const ATTR = /([a-zA-Z_][\w-]*)=(?:"([^"]*)"|([^\s"]+))/g;

  md.inline.ruler.before('link', 'seed_symbol', (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x3a /* : */) return false;
    const match = DIRECTIVE.exec(state.src.slice(state.pos));
    if (!match) return false;
    const attrs = [];
    for (const m of match[2].matchAll(ATTR)) {
      attrs.push([`data-${m[1]}`, m[2] !== undefined ? m[2] : m[3]]);
    }
    if (attrs.length === 0) return false;
    if (!silent) {
      const open = state.push('seed_symbol_open', 'span', 1);
      open.attrs = [['class', match[1]], ...attrs];
      open.meta = { alias: match[1] };
      state.push('seed_symbol_close', 'span', -1);
    }
    state.pos += match[0].length;
    return true;
  });

  md.core.ruler.push('seed_symbol_set', state => {
    const tokens = state.tokens;
    for (let i = 1; i < tokens.length; i++) {
      const inline = tokens[i];
      const open = tokens[i - 1];
      if (inline.type !== 'inline' || open.type !== 'paragraph_open') continue;
      const children = inline.children || [];
      let alias = null;
      let uniform = true;
      for (const child of children) {
        if (child.type === 'seed_symbol_open') {
          const symbolAlias = child.meta.alias;
          if (alias === null) alias = symbolAlias;
          else if (alias !== symbolAlias) uniform = false;
        } else if (
          child.type === 'seed_symbol_close' ||
          child.type === 'softbreak' ||
          child.type === 'hardbreak' ||
          (child.type === 'text' && !child.content.trim())
        ) {
          continue;
        } else {
          uniform = false;
        }
        if (!uniform) break;
      }
      if (uniform && alias !== null) open.attrJoin('class', `${alias}-set`);
    }
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
