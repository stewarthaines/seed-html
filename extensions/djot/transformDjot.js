/**
 * Convert simple text to well-formed XHTML
 * @param {string} text - plain text
 * @param {string|undefined} idref - Spine item idref for context-aware transforms
 * @returns {string} Valid XHTML output
 */
function transformText(text, idref) {
  let ast = djot.parse(text);
  djot.applyFilter(ast, clipFilter);
  return djot.renderHTML(ast);
}

/**
 * Djot filter: rewrite the SEED audio-clip directive into a playable span.
 *
 *   :clip[label]{src="Audio/a.mp3" begin="0:00:05.00" end="0:00:15.00"}
 *     → <span class="clip" data-src="Audio/a.mp3" data-begin="…" data-end="…">label</span>
 *
 * Djot requires the attribute values QUOTED (its bare values reject ':' '/' '.'),
 * so a djot project sets its audio clip template (Project Settings → EPUB) to:
 *
 *   :clip[<label>]{src="<href>" begin="<begin>" end="<end>"}
 *
 * Djot then parses the directive as a str ending in ":clip" followed by a span
 * carrying the attributes; this filter rewrites that two-node sequence wherever
 * it appears (paragraphs, headings, emphasis, table cells, footnotes) and leaves
 * everything else alone — including verbatim/code samples, which never parse as
 * spans. An optional rate="…" carries through as data-rate. Playback and styling
 * come from the audio-clips extension (Scripts/clip-player.js targets span.clip).
 */
function clipFilter() {
  const isClipSpan = node =>
    node.tag === 'span' &&
    !!node.attributes &&
    typeof node.attributes.src === 'string' &&
    typeof node.attributes.begin === 'string' &&
    typeof node.attributes.end === 'string';

  // Rewrite marker + span pairs inside one children array (in place).
  const rewriteSequence = children => {
    // Coalesce adjacent str runs first — some containers (e.g. table cells)
    // split ":clip" across str nodes, defeating the endsWith check below.
    for (let i = children.length - 1; i >= 1; i--) {
      if (children[i].tag === 'str' && children[i - 1].tag === 'str') {
        children[i - 1].text += children[i].text;
        children.splice(i, 1);
      }
    }
    for (let i = children.length - 1; i >= 1; i--) {
      const marker = children[i - 1];
      const span = children[i];
      if (!isClipSpan(span) || marker.tag !== 'str' || !marker.text.endsWith(':clip')) continue;
      const { src, begin, end, rate, ...rest } = span.attributes;
      const attributes = { ...rest, 'data-src': src, 'data-begin': begin, 'data-end': end };
      if (typeof rate === 'string') attributes['data-rate'] = rate;
      attributes.class = rest.class ? rest.class + ' clip' : 'clip';
      span.attributes = attributes;
      const remaining = marker.text.slice(0, -':clip'.length);
      if (remaining) marker.text = remaining;
      else children.splice(i - 1, 1);
    }
  };

  // The marker str and the span are siblings, so the rewrite needs the parent's
  // children array — walk the tree once from the doc root rather than visiting
  // tag-by-tag. Footnotes hang off doc.footnotes, not doc.children.
  const walk = node => {
    if (Array.isArray(node.children)) {
      rewriteSequence(node.children);
      node.children.forEach(walk);
    }
  };

  return {
    doc: {
      enter: doc => {
        walk(doc);
        for (const key in doc.footnotes) walk(doc.footnotes[key]);
      },
    },
  };
}
