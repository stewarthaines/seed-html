/**
 * Convert simple text to well-formed XHTML
 * @param {string} text - plain text
 * @param {string|undefined} idref - Spine item idref for context-aware transforms
 * @returns {string} Valid XHTML output
 */
function transformText(text, idref) {
  try {
    let ast = djot.parse(text);
    return djot.renderHTML(ast);
  } catch (err) {
    return err;
  }
}
