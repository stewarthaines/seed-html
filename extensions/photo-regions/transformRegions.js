/**
 * Bind photo-region carriers to their figures and build the name-faces
 * treatment: an aria-hidden overlay of face boxes and numbered badges on the
 * photograph, and a row-grouped name list appended to the figcaption.
 *
 * The carrier is a paragraph of span.region elements, produced from the
 * :region: directive by the text format's adapter (djot regionFilter /
 * markdown-it regionPlugin):
 *
 *   <p class="region-set">
 *     <span class="region" data-at="5.2,17.7,11.4,21.9" data-of="roger_king"
 *           data-as="Roger King" data-row="Back"></span>
 *     …
 *   </p>
 *
 * BINDING IS STRICT: the carrier's immediately preceding element sibling must
 * be the photo's figure — either a <figure> already, or a <p> whose only
 * element child is an <img> (the bare rendering of an image paragraph), which
 * this transform converts to a <figure>. Anything else, or an unparseable
 * data-at, reconstitutes the directive as visible literal text — a
 * breadcrumb, not a vanish. Multi-image figures bind to the first <img>.
 *
 * data-at is x,y,w,h in PERCENT of the image's own box (W3C Media Fragments
 * xywh=percent:), so the overlay needs no knowledge of the image's pixel
 * size. data-badge (percent x,y) overrides the badge's computed default:
 * above the box's top-left, flipped below when it would fall off the top —
 * the same rule the photo-regions panel uses, so the badge in the tool is the
 * badge in the book.
 *
 * The figure is stamped class="name-faces" (presence of regions implies the
 * treatment; an authored .name-faces stays harmless). Numbering is DOM order
 * — the plugin's Insert already writes rows in first-drawn order and entries
 * left-to-right, so the numbers match the panel. data-of naming a manifested
 * chapter turns the caption name into a link (never to the current chapter
 * itself); an unresolvable id degrades to plain text.
 *
 * Hover/focus pairing between names and boxes is Styles/regions.css
 * (static pairings: 20 faces, 8 rows per figure).
 *
 * @param {Document} htmlDocument - the chapter's rendered DOM (HTML)
 * @param {string} idref - spine item id for this chapter
 * @param {object} ctx - transform context (manifest lookup for data-of links)
 */
async function transformDOM(htmlDocument, idref, ctx) {
  const BADGE_CLEARANCE = 6; // percent; mirrors the panel's badgeAt()
  const DEFAULT_ROW = 'Pictured';
  const MAX_FACES = 20; // regions.css pairing ceiling
  const MAX_ROWS = 8;

  /** Whitespace-only text nodes are layout, not content. */
  const elementOnly = node =>
    [...node.childNodes].every(
      child => child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()
    );

  const carriers = [...htmlDocument.querySelectorAll('p')].filter(p => {
    const children = [...p.children];
    return (
      children.length > 0 &&
      children.every(el => el.tagName === 'SPAN' && el.classList.contains('region')) &&
      elementOnly(p)
    );
  });
  if (carriers.length === 0) return htmlDocument;

  const parseAt = value => {
    const parts = String(value ?? '')
      .split(',')
      .map(s => Number(s.trim()));
    return parts.length === 4 && parts.every(Number.isFinite) ? parts : null;
  };
  const parsePoint = value => {
    const parts = String(value ?? '')
      .split(',')
      .map(s => Number(s.trim()));
    return parts.length === 2 && parts.every(Number.isFinite) ? parts : null;
  };

  /** Reconstitute the directive lines as visible text (the breadcrumb). */
  const breadcrumb = (carrier, regions) => {
    carrier.removeAttribute('class');
    carrier.textContent = '';
    regions.forEach((region, i) => {
      if (i > 0) carrier.appendChild(htmlDocument.createElement('br'));
      const attrs = [`at="${region.at}"`];
      if (region.of) attrs.push(`of=${region.of}`);
      if (region.as) attrs.push(`as="${region.as}"`);
      if (region.row) attrs.push(`row="${region.row}"`);
      if (region.badge) attrs.push(`badge="${region.badge}"`);
      carrier.appendChild(htmlDocument.createTextNode(`:region:{${attrs.join(' ')}}`));
    });
  };

  /** Chapter href for a person id, relative to this chapter — or null. */
  const chapterHref = of => {
    if (!of || of === idref || !ctx || !Array.isArray(ctx.manifest)) return null;
    const target = ctx.manifest.find(
      item => item.id === of && item.mediaType === 'application/xhtml+xml'
    );
    const current = ctx.manifest.find(item => item.id === idref);
    if (!target || !current) return null;
    const from = current.href.split('/').slice(0, -1);
    const to = target.href.split('/');
    while (from.length > 0 && to.length > 1 && from[0] === to[0]) {
      from.shift();
      to.shift();
    }
    return '../'.repeat(from.length) + to.join('/');
  };

  const pct = value => `${value}%`;

  for (const carrier of carriers) {
    const regions = [...carrier.children].map(span => ({
      at: span.getAttribute('data-at') ?? '',
      of: span.getAttribute('data-of') ?? '',
      as: span.getAttribute('data-as') ?? '',
      row: span.getAttribute('data-row') ?? '',
      badge: span.getAttribute('data-badge') ?? '',
    }));

    // Strict binding: the figure is the immediately preceding element sibling.
    let figure = carrier.previousElementSibling;
    if (figure && figure.tagName === 'P') {
      const children = [...figure.children];
      if (children.length === 1 && children[0].tagName === 'IMG' && elementOnly(figure)) {
        const replacement = htmlDocument.createElement('figure');
        for (const { name, value } of [...figure.attributes]) {
          replacement.setAttribute(name, value);
        }
        replacement.appendChild(children[0]);
        figure.replaceWith(replacement);
        figure = replacement;
      }
    }
    const img = figure && figure.tagName === 'FIGURE' ? figure.querySelector('img') : null;
    const boxes = regions.map(region => parseAt(region.at));
    if (!img || boxes.some(box => box === null)) {
      breadcrumb(carrier, regions);
      continue;
    }

    figure.classList.add('name-faces');

    // Positioning context exactly matching the image's box.
    const frame = htmlDocument.createElement('span');
    frame.className = 'fc-frame';
    img.replaceWith(frame);
    frame.appendChild(img);

    // Rows in order of first appearance; region numbering is DOM order.
    const rowNames = [];
    const rowOf = region => {
      const name = region.row.trim() || DEFAULT_ROW;
      if (!rowNames.includes(name)) rowNames.push(name);
      return rowNames.indexOf(name) + 1;
    };
    const numbered = regions.map((region, i) => ({
      region,
      box: boxes[i],
      n: i + 1,
      r: rowOf(region),
    }));
    if (numbered.length > MAX_FACES || rowNames.length > MAX_ROWS) {
      console.warn(
        `photo-regions: ${numbered.length} faces / ${rowNames.length} rows exceeds the ` +
          `stylesheet pairing ceiling (${MAX_FACES}/${MAX_ROWS}); extras render without hover pairing`
      );
    }

    const overlay = htmlDocument.createElement('span');
    overlay.className = 'fc-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    for (const { region, box, n, r } of numbered) {
      const [x, y, w, h] = box;
      const boxEl = htmlDocument.createElement('span');
      boxEl.className = `fc-box fc-box-${n} fc-inrow-${r}`;
      boxEl.style.left = pct(x);
      boxEl.style.top = pct(y);
      boxEl.style.width = pct(w);
      boxEl.style.height = pct(h);
      overlay.appendChild(boxEl);

      const badgeEl = htmlDocument.createElement('span');
      badgeEl.className = `fc-badge fc-badge-${n} fc-inrow-${r}`;
      const moved = parsePoint(region.badge);
      const above = y - BADGE_CLEARANCE;
      const [bx, by] = moved ?? [x, above >= 0 ? above : y + h + 1];
      badgeEl.style.left = pct(bx);
      badgeEl.style.top = pct(by);
      badgeEl.textContent = String(n);
      overlay.appendChild(badgeEl);
    }
    frame.appendChild(overlay);

    // Caption: rows of names appended to the figcaption (created when absent).
    // The caption text is the accessible representation of the overlay.
    let figcaption = figure.querySelector('figcaption');
    if (!figcaption) {
      figcaption = htmlDocument.createElement('figcaption');
      figure.appendChild(figcaption);
    }
    const stack = htmlDocument.createElement('span');
    stack.className = 'fc-stack';
    rowNames.forEach((rowName, rowIndex) => {
      const r = rowIndex + 1;
      const rowEl = htmlDocument.createElement('span');
      rowEl.className = 'fc-row';
      // A lone default row needs no label; real row labels are hover handles.
      if (!(rowNames.length === 1 && rowName === DEFAULT_ROW)) {
        const label = htmlDocument.createElement('span');
        label.className = `fc-rowlabel fc-rowlabel-${r}`;
        label.textContent = rowName;
        rowEl.appendChild(label);
        rowEl.appendChild(htmlDocument.createTextNode(': '));
      }
      const inRow = numbered.filter(entry => entry.r === r);
      inRow.forEach((entry, i) => {
        if (i > 0) rowEl.appendChild(htmlDocument.createTextNode(', '));
        const display = entry.region.as || entry.region.of;
        if (!display) return;
        const nameEl = htmlDocument.createElement('span');
        nameEl.className = `fc-name fc-name-${entry.n}`;
        const href = chapterHref(entry.region.of);
        if (href) {
          const link = htmlDocument.createElement('a');
          link.setAttribute('href', href);
          link.textContent = display;
          nameEl.appendChild(link);
        } else {
          nameEl.appendChild(htmlDocument.createTextNode(display));
        }
        const chip = htmlDocument.createElement('span');
        chip.className = 'fc-chip';
        chip.setAttribute('aria-hidden', 'true');
        chip.textContent = String(entry.n);
        nameEl.appendChild(chip);
        rowEl.appendChild(nameEl);
      });
      if (rowIndex > 0) stack.appendChild(htmlDocument.createTextNode(' '));
      stack.appendChild(rowEl);
    });
    if (figcaption.childNodes.length > 0) {
      figcaption.appendChild(htmlDocument.createTextNode(' '));
    }
    figcaption.appendChild(stack);

    carrier.remove();
  }

  return htmlDocument;
}
