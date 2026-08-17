/**
 * Convert Carve source to well-formed XHTML
 * @param {string} text - plain text
 * @param {string|undefined} idref - Spine item idref for context-aware transforms
 * @returns {string} Valid XHTML output
 */
function transformText(text, idref) {
  // Heading ids via carve's own opt-ins rather than a post-pass: 'strict'
  // guarantees pure-ASCII ids (transliterated where the fold map can, dropped
  // where it can't), and the resolver itself dedups collisions, prefixes a
  // leading digit (# 2001 → s-2001) and resolves every cross-reference
  // against the FINAL ids — so the output is XML-NCName-legal (epubcheck
  // OPF/id-safe) with no fixup and no old→new link map on our side.
  //
  // Trade-off, accepted for now: a fully non-Latin heading (Georgian,
  // Japanese) has nothing the fold map can keep and collapses to `s`, `s-2`…
  // — unlike the djot extension's fixup, which keeps Unicode letters (NCName
  // allows them). 'fold' would keep them but also keeps emoji, which is the
  // epubcheck failure this exists to prevent. Revisit if a non-Latin book
  // adopts carve (an upstream 'ncname' mode would serve XML embedders
  // exactly).
  const doc = carve.resolve(carve.parse(text), {
    asciiHeadingIds: 'strict',
    lowercaseHeadingIds: true,
  });
  return carve.renderHtml(doc, { extensions: [seedDirectives] });
}

/**
 * SEED's directive renderers, registered through carve's extension contract
 * (renderers are keyed by the `:name` in `:name[…]{…}`; return undefined to
 * fall through to carve's generic `ext-name` rendering).
 *
 * clip — the audio-clip directive, rendered to the audio-clips span contract:
 *
 *   :clip[label]{src="../Audio/a.mp3" begin="0:00:05.00" end="0:00:15.00"}
 *     → <span class="clip" data-src="../Audio/a.mp3" data-begin="…" data-end="…">label</span>
 *
 * Carve parses the directive as a single inline_extension node with a clean
 * attribute map, and this renderer owns the emitted markup completely — no
 * AST surgery, no walking (compare extensions/djot/transformDjot.js, whose
 * clipFilter must coalesce and splice sibling nodes because djot's renderer
 * drops symbol attributes). Only a directive carrying all three of
 * src/begin/end is claimed; anything else falls through to carve's default
 * `ext-clip` rendering. An optional rate="…" carries through as data-rate,
 * and remaining attributes (data-progress, data-affordance) pass through
 * as-is. Playback and styling come from the audio-clips extension
 * (Scripts/clip-player.js targets span.clip).
 */
const seedDirectives = {
  name: 'seed-directives',
  renderers: {
    clip(node, ctx) {
      const kv = (node.attrs && node.attrs.keyValues) || {};
      const { src, begin, end, rate, ...rest } = kv;
      if (typeof src !== 'string' || typeof begin !== 'string' || typeof end !== 'string') {
        return undefined;
      }
      const classes = ['clip', ...((node.attrs && node.attrs.classes) || [])].filter(
        (cls, i, all) => all.indexOf(cls) === i
      );
      let attrs = ` class="${ctx.escapeAttr(classes.join(' '))}"`;
      attrs += ` data-src="${ctx.escapeAttr(src)}"`;
      attrs += ` data-begin="${ctx.escapeAttr(begin)}"`;
      attrs += ` data-end="${ctx.escapeAttr(end)}"`;
      if (typeof rate === 'string') attrs += ` data-rate="${ctx.escapeAttr(rate)}"`;
      for (const [key, value] of Object.entries(rest)) {
        if (/^[a-zA-Z_][\w-]*$/.test(key)) attrs += ` ${key}="${ctx.escapeAttr(String(value))}"`;
      }
      return `<span${attrs}>${ctx.renderInlines(node.content || [])}</span>`;
    },
  },
};
