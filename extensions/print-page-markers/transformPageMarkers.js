/**
 * Print page markers: turn an authored `.pagebreak` run into the empty marker
 * EPUB uses for a print page boundary, so screen readers announce the page and
 * a page-list can take readers to it.
 *
 *   [20]{.pagebreak}        (djot)
 *   *20*{.pagebreak}        (markdown-it + markdown-it-attrs)
 *   [%(pagebreak)20%]       (textile; the brackets let it follow a word)
 *   []{.pagebreak page=20}  (djot, in a heading)
 *     → <span id="page20" epub:type="pagebreak" role="doc-pagebreak" title="20"></span>
 *
 * - The page label is the `page` attribute if present, else the run's text.
 *   The attribute is for headings: djot makes a section's id from its
 *   heading's text before any DOM transform runs, so a text label would become
 *   part of the id. A marker with both uses `page`, and logs if they differ.
 *   The label is never counted: print page numbers
 *   are facts about the print edition, and an explicit label keeps a mistake
 *   local and handles roman and unnumbered pages without rules.
 * - The label goes in `title`, not `aria-label`: axe accepts doc-pagebreak only
 *   on <hr>, treats it as absent on a <span> and then flags aria-label as
 *   prohibited. The marker stays a span because it sits inside running text,
 *   where an <hr> is not allowed (process/PRINT_PAGE_MARKERS.md).
 * - `id` is the author's own if present, else `page` + the label with any
 *   character not allowed in an id replaced by `-`. Other classes are kept.
 * - A marker with no label, or whose id is already used in the chapter, is
 *   left as it is and logged, never repaired: epubcheck reports the duplicate.
 *
 * Runs in the `structure` stage, before derive-stage transforms and the
 * packaging-time page-list scan read the finished markers. Idempotent — no
 * `.pagebreak` element remains unless it was left with a problem.
 *
 * @param {Document} htmlDocument - the chapter's rendered DOM (HTML)
 * @param {string} idref - spine item id for this chapter
 * @param {object} ctx - transform context (unused)
 */
function transformDOM(htmlDocument, idref, ctx) {
  htmlDocument.body.querySelectorAll('.pagebreak').forEach(el => {
    const text = el.textContent.trim();
    const label = el.getAttribute('page')?.trim() || text;
    if (text && text !== label) {
      console.warn(`print-page-markers: ${idref}: page ${label} marker also has the text "${text}"`);
    }
    if (!label) {
      console.warn(`print-page-markers: ${idref}: a page marker has no page label`);
      return;
    }
    const id = el.getAttribute('id') || `page${label.replace(/[^\p{L}\p{N}_.-]/gu, '-')}`;
    const holder = htmlDocument.getElementById(id);
    if (holder && holder !== el) {
      console.warn(`print-page-markers: ${idref}: page ${label} marker id "${id}" is already used`);
      return;
    }

    const marker = htmlDocument.createElement('span');
    marker.setAttribute('id', id);
    marker.setAttribute('epub:type', 'pagebreak');
    marker.setAttribute('role', 'doc-pagebreak');
    marker.setAttribute('title', label);
    el.classList.remove('pagebreak');
    if (el.classList.length) marker.setAttribute('class', el.getAttribute('class'));
    el.replaceWith(marker);
  });
  return htmlDocument;
}
