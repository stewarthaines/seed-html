/**
 * Responsive layout hooks. All layout policy lives in Styles/responsive.css; this
 * transform only guarantees the markup the stylesheet needs:
 *
 *   1. The chapter's body content is wrapped in <div class="sr-page"> — the
 *      reading-measure hook. A dedicated wrapper (rather than styling <body>)
 *      keeps the rules clear of reading-system user-setting overrides, which
 *      commonly rewrite body margins.
 *   2. Each <figure> is wrapped in <div class="sr-figure"> — the container-query
 *      container. The figure itself must stay a *descendant* of the container so
 *      @container rules can restyle it; an element cannot query its own size.
 *   3. An element whose direct children carry the conventional width-alternative
 *      classes — [Narrow]{.narrow}[Wide]{.wide}[Full]{.full} in the source —
 *      is stamped sr-switch, making it the query container its child spans
 *      display against. .narrow plus at least one other variant is required
 *      (the guard against unrelated .narrow usage; .narrow is also the ladder's
 *      universal fallback, so it must exist). Absent variants are stamped
 *      no-wide / no-full — the stylesheet's fallback layers cannot depend on
 *      :has(), which is newer than container queries.
 *
 * Deliberately NOT here: `container-type` on .sr-page. Inline-size containment
 * wrapped around an entire chapter has a history of breaking fragmentation in
 * column-paginated reading systems (content clips instead of flowing to the next
 * page), so containment is applied only to the small .sr-figure wrappers, in CSS.
 *
 * Both wraps are idempotent — re-running the pipeline over already-transformed
 * content changes nothing.
 *
 * @param {Document} htmlDocument - the chapter's rendered DOM (HTML)
 * @param {string} idref - spine item id for this chapter
 * @param {object} ctx - transform context (unused)
 */
async function transformDOM(htmlDocument, idref, ctx) {
  const XHTMLNS = 'http://www.w3.org/1999/xhtml';
  const body = htmlDocument.body;
  if (!body) return htmlDocument;

  // 1. Reading-measure wrapper (skip when this chapter is already wrapped).
  if (!(body.children.length === 1 && body.children[0].classList.contains('sr-page'))) {
    const page = htmlDocument.createElementNS(XHTMLNS, 'div');
    page.setAttribute('class', 'sr-page');
    while (body.firstChild) page.appendChild(body.firstChild);
    body.appendChild(page);
  }

  // 2. Figure containers (skip figures already inside one).
  for (const figure of [...htmlDocument.querySelectorAll('figure')]) {
    if (figure.parentElement && figure.parentElement.classList.contains('sr-figure')) continue;
    const wrapper = htmlDocument.createElementNS(XHTMLNS, 'div');
    wrapper.setAttribute('class', 'sr-figure');
    figure.replaceWith(wrapper);
    wrapper.appendChild(figure);
  }

  // 3. Inline width alternatives (classList.add is idempotent). Spans only:
  //    the block variant systems (abc2svg / abcjs / prettier) name their
  //    variant DIVS with the same narrow/wide/full convention and carry their
  //    own complete ladders — stamping their containers would double-drive
  //    the same children from two stylesheets.
  for (const narrow of [...htmlDocument.querySelectorAll('span.narrow')]) {
    const host = narrow.parentElement;
    if (!host || host.classList.contains('sr-switch')) continue;
    const children = [...host.children];
    const hasWide = children.some(c => c.classList.contains('wide'));
    const hasFull = children.some(c => c.classList.contains('full'));
    if (!hasWide && !hasFull) continue;
    host.classList.add('sr-switch');
    if (!hasWide) host.classList.add('no-wide');
    if (!hasFull) host.classList.add('no-full');
  }

  return htmlDocument;
}
