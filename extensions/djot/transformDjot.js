/**
 * Convert simple text to well-formed XHTML
 * @param {string} text - plain text
 * @param {string|undefined} idref - Spine item idref for context-aware transforms
 * @returns {string} Valid XHTML output
 */
function transformText(text, idref) {
  let ast = djot.parse(text);
  djot.applyFilter(ast, clipFilter);
  djot.applyFilter(ast, symbolFilter);
  djot.applyFilter(ast, idFilter);
  return djot.renderHTML(ast, {
    overrides: { footnote_reference: repeatedNoteRef(), doc: popupNotes() },
  });
}

/**
 * Renderer override: footnote references Apple Books opens as pop-ups, and a
 * footnote cited more than once gets a distinct id on each repeat reference.
 *
 * Books shows a note in a pop-up only when the reference carries
 * `epub:type="noteref"`; djot's `role="doc-noteref"` alone is an ordinary link
 * to the end of the chapter. Both are kept.
 *
 * djot renders every reference to the same note as `<a id="fnrefN">`, so a
 * note cited twice puts two identical ids in the chapter and epubcheck rejects
 * it (RSC-005). The first reference keeps `fnrefN`, which the note's backlink
 * targets; repeats become `fnrefN-2`, `fnrefN-3`.
 */
function repeatedNoteRef() {
  const seen = {};
  return (node, renderer) => {
    const html = renderer
      .renderAstNodeDefault(node)
      .replace(' role="doc-noteref"', ' role="doc-noteref" epub:type="noteref"');
    const match = /^<a id="(fnref\d+)"/.exec(html);
    if (!match) return html;
    const id = match[1];
    seen[id] = (seen[id] || 0) + 1;
    if (seen[id] === 1) return html;
    return `<a id="${id}-${seen[id]}"` + html.slice(match[0].length);
  };
}

/**
 * Renderer override: the chapter's notes, shaped for Apple Books' pop-ups.
 *
 * Books shows the whole element a reference points to, so djot's own list
 * item would put the backlink in the pop-up, where it does nothing. Each
 * note's text goes in a `div` that is the reference's target and carries
 * `epub:type="footnote"`; the list number and the backlink stay outside it,
 * in the list item, so reading systems without pop-ups still show the
 * numbered list with its return links:
 *
 *   <li><div id="fn1" epub:type="footnote"><p>The note.</p></div><a href="#fnref1" role="doc-backlink">↩︎</a></li>
 *
 * Otherwise the same as djot's renderNotes: every note is rendered first
 * (rendering one can number another it cites), then listed in the order the
 * chapter first cites them. footnotes.css keeps the backlink on the note's
 * line.
 */
function popupNotes() {
  return (node, renderer) => {
    let html = renderer.renderChildren(node);
    if (renderer.nextFootnoteIndex <= 1) return html;

    const rendered = {};
    for (const label in node.footnotes) {
      rendered[label] = renderer.renderChildren(node.footnotes[label]);
    }
    const ordered = [];
    for (const label in renderer.footnoteIndex) {
      const n = renderer.footnoteIndex[label];
      if (n) ordered[n] = rendered[label];
    }

    html += '<section role="doc-endnotes">\n<hr>\n<ol>\n';
    for (let n = 1; n < ordered.length; n++) {
      html += `<li><div id="fn${n}" epub:type="footnote">\n${ordered[n] || ''}</div>`;
      html += `<a href="#fnref${n}" role="doc-backlink">↩︎</a></li>\n`;
    }
    return html + '</ol>\n</section>\n';
  };
}

/**
 * Djot filter: give every section an XML-legal id.
 *
 * Djot mints section ids from heading text and keeps punctuation that XML
 * forbids — `# Bruce's Notes` renders as `<section id="Bruce's-Notes">`, and an
 * apostrophe is not legal in an XML ID (it is not an NCName character), so
 * epubcheck rejects the chapter. Setting `attributes.id` ourselves takes
 * precedence over the generated one.
 *
 * Unicode letters and digits are KEPT: a Georgian or German heading must not be
 * reduced to a row of hyphens, and NCName permits them. Only characters outside
 * the set are replaced, runs collapse to one hyphen, and an id that would start
 * with a digit gets an underscore (XML forbids a leading digit).
 *
 * `#fragment` link destinations go through the same slug function. An author
 * linking to djot's generated id still resolves, because the heading text and
 * djot's id differ only in the characters this function normalises anyway.
 *
 * An id the author chose — the block attribute above the heading,
 * `{#emma-arrival}` then `## Emma's arrival` — is kept: djot puts it in the
 * section's `attributes.id`, while a generated one sits in `autoAttributes.id`.
 * It is only passed through the same slug, so an illegal character in it is
 * normalised exactly as a link to it is.
 */
function idFilter() {
  const slug = raw => {
    const id = String(raw)
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      // Trim leading/trailing separators. The dot is legal in an NCName but
      // djot drops a trailing one, so keeping it here would put a section id
      // and a link to it out of step ("…-Co." vs "…-Co").
      .replace(/^[-.]+|[-.]+$/g, '');
    if (!id) return '_';
    return /^[\p{L}_]/u.test(id) ? id : '_' + id;
  };

  // Heading text as authored — every node's `text` concatenated, so smart
  // punctuation contributes the character the author typed. A non-breaking
  // space (`\ `) and a line break inside the heading carry no text, so they
  // count as a space: `Varden\ Meparishvili` slugs to "Varden-Meparishvili",
  // the same as a link retyped from the visible title.
  const SPACE_NODES = new Set(['non_breaking_space', 'hard_break', 'soft_break']);
  const textOf = node => {
    let out = '';
    const walk = n => {
      if (SPACE_NODES.has(n.tag)) out += ' ';
      else if (typeof n.text === 'string') out += n.text;
      (n.children || []).forEach(walk);
    };
    (node.children || []).forEach(walk);
    return out;
  };

  const taken = new Set();
  return {
    section: {
      enter: node => {
        const explicit = node.attributes && node.attributes.id;
        if (explicit) {
          const id = slug(explicit);
          taken.add(id);
          node.attributes = { ...node.attributes, id };
          return;
        }
        const heading = (node.children || []).find(child => child.tag === 'heading');
        if (!heading) return;
        const base = slug(textOf(heading));
        let id = base;
        for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
        taken.add(id);
        node.attributes = { ...(node.attributes || {}), id };
      },
    },
    link: {
      enter: node => {
        if (typeof node.destination === 'string' && node.destination.startsWith('#')) {
          node.destination = '#' + slug(node.destination.slice(1));
        }
      },
    },
  };
}

/**
 * Djot filter: rewrite the SEED audio-clip directive into a playable span.
 *
 *   :clip[label]{src="../Audio/a.mp3" begin="0:00:05.00" end="0:00:15.00"}
 *     → <span class="clip" data-src="../Audio/a.mp3" data-begin="…" data-end="…">label</span>
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

/**
 * Djot filter: rewrite a paragraph of attributed symbols into the neutral
 * carrier a DOM transform consumes — any alias, every attribute.
 *
 *   :region:{at="5.2,17.7,11.4,21.9" of=roger_king as="Roger King" row="Back"}
 *   :region:{at="17.3,14.8,9.9,20.4" as="Ian Vitcheff" row="Back"}
 *     → <p class="region-set"><span class="region" data-at="…" data-of="…" …></span>…</p>
 *
 * Djot's HTML renderer drops a symbol's attributes — `:lifeline:{of=x}` would
 * render as bare `:lifeline:` — so a directive whose data lives in its
 * attributes has to become an element before rendering. Consecutive directive
 * lines form one djot paragraph, and that paragraph is the set. Only a
 * paragraph consisting ENTIRELY of same-alias symbols, each carrying at least
 * one attribute (soft breaks between them allowed), is rewritten: a bare
 * `:emoji:` paragraph, a mix of aliases, or a directive amid prose is left
 * alone and renders as visible literal text. Every attribute becomes
 * data-<name> on its span; an authored class on the paragraph ({.half} above
 * the directive) is kept beside <alias>-set. A single symbol still yields a
 * one-span set, so a consumer binds one shape.
 *
 * Which attributes a directive needs is the consuming DOM transform's
 * business, not this filter's — photo-regions
 * (extensions/photo-regions/transformRegions.js) reconstitutes a region
 * without a usable at=, or a detail without src=, as visible text with a note
 * saying what it needs. Values containing ',' or spaces must be QUOTED
 * (djot's bare attribute values reject them):
 *
 *   :region:{at="<at>" of=<of> as="<as>" row="<row>" badge="<badge>"}
 */
function symbolFilter() {
  const isAttributed = node =>
    node.tag === 'symb' && !!node.attributes && Object.keys(node.attributes).length > 0;

  const toCarrier = para => {
    const symbols = para.children.filter(node => node.tag === 'symb');
    if (symbols.length === 0) return false;
    const alias = symbols[0].alias;
    const uniform = para.children.every(
      node => (isAttributed(node) && node.alias === alias) || node.tag === 'soft_break'
    );
    if (!uniform) return false;

    const authored = (para.attributes && para.attributes.class) || '';
    para.attributes = {
      ...(para.attributes || {}),
      class: authored ? `${authored} ${alias}-set` : `${alias}-set`,
    };
    para.children = symbols.map(node => {
      const attributes = { class: alias };
      for (const [name, value] of Object.entries(node.attributes)) {
        attributes[`data-${name}`] = value;
      }
      return { tag: 'span', attributes, children: [] };
    });
    return true;
  };

  // Paragraphs live in blocks (doc, sections, divs, …) — walk block children
  // arrays from the root, like clipFilter, rather than visiting tag-by-tag.
  const walk = node => {
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (child.tag === 'para' && Array.isArray(child.children) && toCarrier(child)) continue;
        walk(child);
      }
    }
  };

  return {
    doc: {
      enter: doc => {
        walk(doc);
      },
    },
  };
}
