/**
 * Convert Carve source to well-formed XHTML
 * @param {string} text - plain text
 * @param {string|undefined} idref - Spine item idref for context-aware transforms
 * @returns {string} Valid XHTML output
 */
function transformText(text, idref) {
  const doc = carve.resolve(carve.parse(text));
  rewriteClips(doc);
  fixSectionIds(doc);
  return carve.renderHtml(doc);
}

/**
 * Walk every array of AST nodes reachable from the document, wherever it
 * hangs. Carve stores inlines in `children` (span, link, emphasis) or
 * `content` (inline_extension), table content under `rows` → `cells`, and
 * footnote bodies in the top-level `footnoteDefs` map — so rather than
 * enumerating container keys (and silently missing the next one), the walker
 * recurses generically over every own property, treating any array holding
 * objects with a `type` field as a node array. `pos` and `attrs` subtrees
 * never contain nodes and are skipped.
 */
function walkNodeArrays(doc, visit) {
  const seen = new Set();
  const recurse = value => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.some(el => el && typeof el === 'object' && typeof el.type === 'string')) {
        visit(value);
      }
      value.forEach(recurse);
      return;
    }
    for (const key in value) {
      if (key !== 'pos' && key !== 'attrs') recurse(value[key]);
    }
  };
  recurse(doc);
}

/**
 * Rewrite the SEED audio-clip directive into a playable span.
 *
 *   :clip[label]{src="../Audio/a.mp3" begin="0:00:05.00" end="0:00:15.00"}
 *     → <span class="clip" data-src="../Audio/a.mp3" data-begin="…" data-end="…">label</span>
 *
 * Carve parses the directive as a single `inline_extension` node named `clip`
 * with a clean attribute map — no marker/span pairing to reassemble (compare
 * extensions/djot/transformDjot.js, whose clipFilter must coalesce and splice
 * sibling nodes). The node is replaced in place with a styled `span` node so
 * the stock renderer emits it; without the rewrite the default rendering is
 * `<span class="ext-clip" src="…">`, and a bare `src` attribute on a span is
 * not valid EPUB content (epubcheck rejects it).
 *
 * Only a directive carrying all three of src/begin/end is rewritten; anything
 * else is left for carve's default `ext-clip` rendering. An optional rate="…"
 * carries through as data-rate. Playback and styling come from the
 * audio-clips extension (Scripts/clip-player.js targets span.clip).
 */
function rewriteClips(doc) {
  walkNodeArrays(doc, children => {
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (node.type !== 'inline_extension' || node.name !== 'clip') continue;
      const kv = (node.attrs && node.attrs.keyValues) || {};
      const { src, begin, end, rate, ...rest } = kv;
      if (typeof src !== 'string' || typeof begin !== 'string' || typeof end !== 'string') {
        continue;
      }
      const keyValues = { ...rest, 'data-src': src, 'data-begin': begin, 'data-end': end };
      if (typeof rate === 'string') keyValues['data-rate'] = rate;
      const classes = [...((node.attrs && node.attrs.classes) || [])];
      if (!classes.includes('clip')) classes.push('clip');
      children[i] = {
        type: 'span',
        children: node.content || [],
        attrs: {
          classes,
          keyValues,
          // A single '.class' entry stands for the whole class list (matching
          // what carve's own parser records for [x]{.a .b}); one per class
          // makes the renderer emit the class attribute repeatedly.
          order: [...(classes.length ? ['.class'] : []), ...Object.keys(keyValues)],
        },
        pos: node.pos,
      };
    }
  });
}

/**
 * Give every section an XML-legal id.
 *
 * Carve's own heading ids already survive most epubcheck hazards the djot
 * extension has to correct by hand — apostrophes are replaced
 * (`# Bruce's Notes` → `Bruce-s-Notes`) and a leading digit is prefixed
 * (`# 2001` → `s-2001`) — but characters outside XML's NCName set that are
 * neither punctuation nor whitespace are kept verbatim, so `# 🎉 Party`
 * renders as `<section id="🎉-Party">` and epubcheck rejects the chapter.
 *
 * Unicode letters and digits are KEPT: a Georgian or German heading must not
 * be reduced to a row of hyphens, and NCName permits them. Only characters
 * outside the set are replaced, runs collapse to one hyphen, and an id that
 * would start with a digit gets an underscore (XML forbids a leading digit).
 *
 * By render time carve has already minted every heading id and resolved
 * `</#id>` cross-references and implicit `[Heading][]` links to exact `href`
 * fragments, so the fixup runs on the resolved ids: pass one normalises each
 * heading's id (deduplicating collisions) and records old → new; pass two
 * rewrites `#fragment` hrefs through that map, falling back to the same slug
 * function for a hand-typed fragment that never matched a heading — the
 * heading text and carve's minted id differ only in the characters this
 * function normalises anyway.
 */
function fixSectionIds(doc) {
  const slug = raw => {
    const id = String(raw)
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      // Trim leading/trailing separators. The dot is legal in an NCName but a
      // trailing one reads as sentence punctuation, so keeping it would put a
      // section id and a hand-typed link to it out of step ("…-Co." vs "…-Co").
      .replace(/^[-.]+|[-.]+$/g, '');
    if (!id) return '_';
    return /^[\p{L}_]/u.test(id) ? id : '_' + id;
  };

  const renamed = new Map();
  const taken = new Set();
  walkNodeArrays(doc, children => {
    for (const node of children) {
      if (node.type !== 'heading') continue;
      const original = node.attrs && node.attrs.id;
      if (typeof original !== 'string') continue;
      const base = slug(original);
      let id = base;
      for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
      taken.add(id);
      renamed.set(original, id);
      node.attrs.id = id;
    }
  });

  walkNodeArrays(doc, children => {
    for (const node of children) {
      if (typeof node.href !== 'string' || !node.href.startsWith('#')) continue;
      const fragment = node.href.slice(1);
      node.href = '#' + (renamed.get(fragment) || slug(fragment));
    }
  });
}
