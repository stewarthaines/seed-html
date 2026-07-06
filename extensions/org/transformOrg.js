/**
 * Convert Org (org-mode) source to XHTML via org-js.
 * @param {string} text - plain text (Org syntax)
 * @param {string|undefined} idref - Spine item idref for context-aware transforms
 * @returns {string} Valid XHTML output
 */
function transformText(text, idref) {
  const parser = new window.Org.Parser();
  const orgDocument = parser.parse(text);
  // contentHTML only: the converter's toString() would prepend a synthetic
  // document title and table of contents, which a chapter doesn't want.
  return orgDocument.convert(window.Org.ConverterHTML, {}).contentHTML;
}
