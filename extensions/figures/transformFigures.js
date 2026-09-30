/**
 * Figures: turn an authored `{.figure}` image into a <figure>, with its title
 * as the <figcaption>, so a screen reader announces the image and its caption
 * as one captioned unit instead of a bare image beside a line of text.
 *
 *   ![Two men applying stage makeup](../Images/eggs.jpg){.figure .wrap-left title="Adelaide, 2025"}
 *     → <figure class="wrap-left"><img class="wrap-left" src="…" alt="…"/><figcaption>Adelaide, 2025</figcaption></figure>
 *
 * - A non-empty `title` becomes the caption and leaves the img (it would
 *   otherwise be announced twice); no title, no figcaption.
 * - Classes other than `figure` are copied to the figure, so a modifier such
 *   as `.wrap-left` can style the whole unit while image-sizing rules stay
 *   scoped to the element (`img.thumb`, per docs/AGENT_AUTHORING.md). The img
 *   keeps every other attribute — notably `width`, the one sizing input
 *   reading systems never override.
 * - An image that is its paragraph's only content replaces the paragraph:
 *   <p><figure> is invalid nesting, and the figure must be a true sibling of
 *   what follows for photo-regions' carrier binding. An image sharing its
 *   paragraph with text is left as it is, since a figure cannot sit inside a
 *   paragraph. An image wrapped in a link moves into the figure with its link.
 *
 * Runs in the `structure` stage: after code-block renderers, before
 * photo-regions (which trusts an existing figcaption), list-of-figures (which
 * reads it) and responsive (which wraps each figure). Idempotent — no
 * `img.figure` remains afterwards.
 *
 * @param {Document} htmlDocument - the chapter's rendered DOM (HTML)
 * @param {string} idref - spine item id for this chapter
 * @param {object} ctx - transform context (unused)
 */
function transformDOM(htmlDocument, idref, ctx) {
  const XHTMLNS = 'http://www.w3.org/1999/xhtml';
  const isBlank = node => node.nodeType === 3 && !node.textContent.trim();
  const onlyChild = (parent, child) =>
    [...parent.childNodes].every(node => node === child || isBlank(node));

  for (const img of [...htmlDocument.querySelectorAll('img.figure')]) {
    // The unit that becomes the figure's content: the img, or a link holding only it.
    const link = img.parentElement;
    const unit = link && link.tagName === 'A' && onlyChild(link, img) ? link : img;
    const paragraph = unit.parentElement;
    const replaced =
      paragraph && paragraph.tagName === 'P'
        ? onlyChild(paragraph, unit)
          ? paragraph
          : null
        : unit;
    if (!replaced) continue;

    const figure = htmlDocument.createElementNS(XHTMLNS, 'figure');
    const modifiers = [...img.classList].filter(cls => cls !== 'figure');
    if (modifiers.length) figure.setAttribute('class', modifiers.join(' '));

    const caption = (img.getAttribute('title') || '').trim();
    img.classList.remove('figure');
    if (img.classList.length === 0) img.removeAttribute('class');
    img.removeAttribute('title');

    replaced.replaceWith(figure);
    figure.appendChild(unit);
    if (caption) {
      const figcaption = htmlDocument.createElementNS(XHTMLNS, 'figcaption');
      figcaption.textContent = caption;
      figure.appendChild(figcaption);
    }
  }
  return htmlDocument;
}
