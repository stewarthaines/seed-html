/**
 * Bind photo-region carriers to their figures and build the name-faces
 * treatment: an aria-hidden overlay of face boxes and numbered badges on the
 * photograph, and a row-grouped name list appended to the figcaption.
 *
 * The carrier is a paragraph of span.region elements, produced from the
 * :region: directive by the text format's attributed-symbol carrier (djot
 * symbolFilter / markdown-it symbolPlugin — any alias, every attribute as
 * data-*; which attributes a directive NEEDS is checked here, not there):
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
 * (static pairings: 30 faces, 8 rows per figure).
 *
 * THE RECORD: every region this transform binds is also written to
 * SOURCE/data/regions/<idref>.json, so a transform that combines chapters
 * (a family-history extension gathering every photograph of one person) can
 * read who is pictured where without parsing chapter sources:
 *
 *   [{ "href": "Images/team.jpg", "at": "5.2,17.7,11.4,21.9",
 *      "of": "roger_king", "as": "Roger King", "row": "Back",
 *      "size": { "w": 1600, "h": 1067 } }, …]
 *
 * href is the image's OPF-relative manifest href (the chapter-relative src
 * resolved against the chapter's own href). size is the image's pixel size
 * — what a crop of the region needs to know its aspect — copied from the
 * photo-regions panel's library (SOURCE/plugins/photo-regions/regions.json,
 * which stamps it whenever the image is opened there) and simply absent when
 * the library does not know it. Breadcrumbed sets are not recorded. A chapter
 * with no bound regions writes `null` over a record it used to have and never
 * gains a file otherwise; an unchanged record is not rewritten. Reading it
 * back: ctx.readSourceText('data/regions/<idref>.json') — `null` or missing
 * both mean none. The library itself stays the panel's working store, never
 * the render-time truth: the source's directives are.
 *
 * :detail: carriers are handled here too — a paragraph of span.detail
 * elements from the same carrier mechanism. A detail is a
 * standalone single-region crop with NO figure binding: it carries its own
 * data-src, data-at (same percent geometry), data-size (the image's WxH in
 * pixels, so the crop knows its aspect without any library at hand),
 * REQUIRED data-alt (a detail is content — a register line, a face — not
 * decoration), optional data-to, the href of the page showing the full
 * image (fragments welcome), and optional data-caption.
 *
 * A detail paragraph becomes ONE <figure class="detail-set"> (the authored
 * class on the paragraph rides along) holding one inline SVG per detail:
 *
 *   <figure class="detail-set">
 *     <a href="notes.xhtml#the-page">                 (only with data-to)
 *       <svg class="detail" role="img" aria-labelledby="detail-ch1-1"
 *            viewBox="X Y W H" width="W" height="H" …>
 *         <title id="detail-ch1-1">alt text</title>
 *         <image xlink:href="../Images/page.jpg" width="imgW" height="imgH"/>
 *       </svg>
 *     </a>
 *     <figcaption>caption</figcaption>                (only with data-caption)
 *   </figure>
 *
 * The viewBox is the crop, in the image's own pixels — a viewport onto the
 * image the book already carries, zero new bytes, and geometry that is
 * MARKUP, so the crop is right even where the stylesheet is lost. An SVG
 * image prints without print-color-adjust, is clamped by reading systems
 * like any <img>, and is announced by its <title>; the caption is visible
 * text, which is what read-aloud engines speak. Title ids are deterministic
 * per render and unique per book (the PDF path concatenates chapters).
 * Several details in one paragraph stack in one figure and share one
 * figcaption. Invalid details reconstitute as visible directive text — the
 * breadcrumb rule — followed by a note naming the missing attributes
 * ("— needs alt"), so the author can see what to fix.
 *
 * @param {Document} htmlDocument - the chapter's rendered DOM (HTML)
 * @param {string} idref - spine item id for this chapter
 * @param {object} ctx - transform context (manifest lookup for data-of links)
 */
async function transformDOM(htmlDocument, idref, ctx) {
  const BADGE_CLEARANCE = 6; // percent; mirrors the panel's badgeAt()
  const DEFAULT_ROW = 'Pictured';
  const MAX_FACES = 30; // regions.css pairing ceiling
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
  const detailCarriers = [...htmlDocument.querySelectorAll('p')].filter(p => {
    const children = [...p.children];
    return (
      children.length > 0 &&
      children.every(el => el.tagName === 'SPAN' && el.classList.contains('detail')) &&
      elementOnly(p)
    );
  });
  /** Bound regions, for the chapter's record (see the header). */
  const records = [];

  /** Manifest href of an image src, resolved against this chapter's href. */
  const currentHref = (
    (ctx && Array.isArray(ctx.manifest) && ctx.manifest.find(item => item.id === idref)) || {}
  ).href;
  const imageHref = src => {
    const parts = typeof currentHref === 'string' ? currentHref.split('/').slice(0, -1) : [];
    for (const part of String(src).split('/')) {
      if (part === '..') parts.pop();
      else if (part && part !== '.') parts.push(part);
    }
    return parts.join('/');
  };

  /** Write the chapter's record — skipped when it would not change, and never
   *  created for a chapter that has no regions and no record. */
  const persistRecord = async () => {
    if (
      !ctx ||
      !idref ||
      typeof ctx.readSourceText !== 'function' ||
      typeof ctx.writeSourceText !== 'function'
    ) {
      return;
    }
    const path = `SOURCE/data/regions/${idref}.json`;
    try {
      let existing = null;
      try {
        existing = await ctx.readSourceText(path);
      } catch {
        existing = null;
      }
      if (records.length === 0) {
        if (existing !== null && existing.trim() !== 'null') await ctx.writeSourceText(path, 'null');
        return;
      }
      let library = {};
      try {
        const parsed = JSON.parse(
          await ctx.readSourceText('SOURCE/plugins/photo-regions/regions.json')
        );
        if (parsed && parsed.files && typeof parsed.files === 'object') library = parsed.files;
      } catch {
        library = {};
      }
      for (const record of records) {
        const entry = library[record.href];
        const size = entry && !Array.isArray(entry) ? entry.size : undefined;
        if (size && Number(size.w) > 0 && Number(size.h) > 0) {
          record.size = { w: Number(size.w), h: Number(size.h) };
        }
      }
      const text = JSON.stringify(records);
      if (existing !== text) await ctx.writeSourceText(path, text);
    } catch (error) {
      console.error('photo-regions: failed to record regions', error);
    }
  };

  if (carriers.length === 0 && detailCarriers.length === 0) {
    await persistRecord();
    return htmlDocument;
  }

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
      const attrs = [];
      if (region.at) attrs.push(`at="${region.at}"`);
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

    const href = imageHref(img.getAttribute('src') || '');
    for (const region of regions) {
      records.push({ href, at: region.at, of: region.of, as: region.as, row: region.row });
    }

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
      // A figcaption this transform creates lifts the image's title= in as the
      // caption's first line — otherwise the authored caption text would
      // survive only as a tooltip. The attribute moves (not copies), so the
      // same text isn't presented twice. An existing figcaption is trusted:
      // whoever built it (the book's figureSetup) owns the title idiom.
      const title = img.getAttribute('title');
      if (title) {
        const captionText = htmlDocument.createElement('span');
        captionText.className = 'fc-caption-text';
        captionText.textContent = title;
        figcaption.appendChild(captionText);
        img.removeAttribute('title');
      }
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

  // ---- :detail: — single-region crops, standing alone ----------------------
  const SVGNS = 'http://www.w3.org/2000/svg';
  const XLINKNS = 'http://www.w3.org/1999/xlink';
  // Title ids: deterministic per render, unique per chapter, and — because
  // the PDF path concatenates every chapter into one document — unique per
  // book. The idref is slugged the way the djot idFilter slugs headings.
  const idBase = `detail-${String(idref || 'chapter').replace(/[^\p{L}\p{N}_.-]+/gu, '-')}`;
  let detailCount = 0;
  const round2 = value => Math.round(value * 100) / 100;
  const parseSize = value => {
    const m = /^\s*(\d+)\s*[x\u00d7]\s*(\d+)\s*$/.exec(String(value ?? ''));
    return m && Number(m[1]) > 0 && Number(m[2]) > 0 ? [Number(m[1]), Number(m[2])] : null;
  };

  /** Missing/invalid attribute names for one detail — empty means renderable. */
  const detailNeeds = detail => {
    const box = parseAt(detail.at);
    const needs = [];
    if (!detail.src) needs.push('src');
    if (!box || !(box[2] > 0) || !(box[3] > 0)) needs.push('at');
    if (!parseSize(detail.size)) needs.push('size');
    if (!detail.alt) needs.push('alt');
    return needs;
  };

  /** Reconstitute the directive lines as visible text (the breadcrumb),
   *  each followed by an italic note naming what it still needs. */
  const detailBreadcrumb = (carrier, details, needsList) => {
    carrier.removeAttribute('class');
    carrier.textContent = '';
    details.forEach((detail, i) => {
      if (i > 0) carrier.appendChild(htmlDocument.createElement('br'));
      const attrs = [`src="${detail.src}"`, `at="${detail.at}"`];
      if (detail.size) attrs.push(`size="${detail.size}"`);
      attrs.push(`alt="${detail.alt}"`);
      if (detail.to) attrs.push(`to="${detail.to}"`);
      if (detail.caption) attrs.push(`caption="${detail.caption}"`);
      carrier.appendChild(htmlDocument.createTextNode(`:detail:{${attrs.join(' ')}}`));
      const needs = needsList[i];
      if (needs.length > 0) {
        const note = htmlDocument.createElement('em');
        note.textContent = ` — needs ${needs.join(', ')}`;
        carrier.appendChild(note);
      }
    });
  };

  for (const carrier of detailCarriers) {
    const details = [...carrier.children].map(span => ({
      src: span.getAttribute('data-src') ?? '',
      at: span.getAttribute('data-at') ?? '',
      size: span.getAttribute('data-size') ?? '',
      alt: span.getAttribute('data-alt') ?? '',
      to: span.getAttribute('data-to') ?? '',
      caption: span.getAttribute('data-caption') ?? '',
    }));
    const needsList = details.map(detailNeeds);
    if (needsList.some(needs => needs.length > 0)) {
      console.warn(
        'photo-regions: :detail: not rendered — needs',
        needsList.filter(needs => needs.length > 0).map(needs => needs.join(', ')).join('; ')
      );
      detailBreadcrumb(carrier, details, needsList);
      continue;
    }

    // One figure per paragraph: the authored class ({.two-thirds}) rides on it.
    const figure = htmlDocument.createElement('figure');
    const extra = (carrier.getAttribute('class') || '')
      .split(/\s+/)
      .filter(cls => cls && cls !== 'detail-set');
    figure.setAttribute('class', ['detail-set', ...extra].join(' '));

    const captions = [];
    for (const detail of details) {
      const [x, y, w, h] = parseAt(detail.at);
      const [imgW, imgH] = parseSize(detail.size);
      const cropW = round2((w / 100) * imgW);
      const cropH = round2((h / 100) * imgH);
      const titleId = `${idBase}-${++detailCount}`;

      // SVG namespace, never createElement: an XHTML-namespaced <svg>
      // serialises but renders nothing, and setAttribute on an HTML element
      // would lowercase viewBox and preserveAspectRatio.
      const svg = htmlDocument.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'detail');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-labelledby', titleId);
      svg.setAttribute(
        'viewBox',
        `${round2((x / 100) * imgW)} ${round2((y / 100) * imgH)} ${cropW} ${cropH}`
      );
      svg.setAttribute('width', String(cropW));
      svg.setAttribute('height', String(cropH));
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      // A finite inline cap: reading systems clamp images from a snapshot of
      // the computed max-width and keep a finite value. Fluid below the column.
      svg.setAttribute('style', 'max-width: 100%; height: auto;');

      const title = htmlDocument.createElementNS(SVGNS, 'title');
      title.setAttribute('id', titleId);
      title.textContent = detail.alt;
      svg.appendChild(title);

      const image = htmlDocument.createElementNS(SVGNS, 'image');
      // xlink:href ONLY, never a plain SVG2 href beside it: every reading
      // system resolves xlink:href, and foliate-based readers (READ.html
      // included) rewrite a namespaced href to the packaged resource only
      // when no plain href is present — with both, the plain one wins and
      // resolves against the reader's own page, and the crop is blank.
      image.setAttributeNS(XLINKNS, 'xlink:href', detail.src);
      image.setAttribute('width', String(imgW));
      image.setAttribute('height', String(imgH));
      svg.appendChild(image);

      if (detail.to) {
        const link = htmlDocument.createElement('a');
        link.setAttribute('href', detail.to);
        link.appendChild(svg);
        figure.appendChild(link);
      } else {
        figure.appendChild(svg);
      }
      if (detail.caption) captions.push(detail.caption);
    }
    if (captions.length > 0) {
      const figcaption = htmlDocument.createElement('figcaption');
      figcaption.textContent = captions.join(' ');
      figure.appendChild(figcaption);
    }
    carrier.replaceWith(figure);
  }

  await persistRecord();
  return htmlDocument;
}
