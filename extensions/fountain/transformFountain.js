/**
 * Convert Fountain screenplay source to XHTML via Fountain.js. The library's
 * parse callback runs synchronously (pure regex tokenizer). Output is wrapped
 * in .screenplay / .title-page containers that Styles/fountain.css lays out
 * (Courier, indented dialogue, right-aligned transitions).
 * @param {string} text - plain text (Fountain)
 * @param {string|undefined} idref - Spine item idref for context-aware transforms
 * @returns {string} Valid XHTML output
 */
function transformText(text, idref) {
  let html = '';
  window.fountain.parse(text, function (output) {
    const titlePage = output.html.title_page
      ? '<section class="title-page">' + output.html.title_page + '</section>'
      : '';
    html = titlePage + '<div class="screenplay">' + output.html.script + '</div>';
  });
  return html;
}
