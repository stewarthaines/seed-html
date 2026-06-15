/**
 * Record the figures used in this chapter so the "List of Figures" generator can
 * collect them across the whole project.
 *
 * Runs in the DOM-transform pipeline: it scans the rendered chapter for images and
 * writes each one's source + caption to SOURCE/data/figures/<idref>.json (the only
 * writable area). The document is returned unchanged — this transform records data,
 * it doesn't alter the output. Pairs with listFigures.js (the generator), which
 * reads these files back.
 *
 * @param {Document} htmlDocument - the chapter's rendered DOM
 * @param {string} idref - the spine item id for this chapter
 * @param {object} ctx - transform context (provides writeSourceText)
 */
async function transformDOM(htmlDocument, idref, ctx) {
  if (!ctx || typeof ctx.writeSourceText !== 'function' || !idref) {
    return htmlDocument;
  }

  const figures = [];
  htmlDocument.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (!src) return;
    // Prefer a <figcaption> within an enclosing <figure>; fall back to alt text.
    let caption = '';
    const figure = img.closest('figure');
    if (figure) {
      const figcaption = figure.querySelector('figcaption');
      if (figcaption) caption = (figcaption.textContent || '').trim();
    }
    if (!caption) caption = (img.getAttribute('alt') || '').trim();
    figures.push({ src: src, caption: caption });
  });

  try {
    await ctx.writeSourceText(
      'SOURCE/data/figures/' + idref + '.json',
      JSON.stringify(figures)
    );
  } catch (error) {
    console.error('storeImageReferences: failed to record figures', error);
  }

  return htmlDocument;
}
