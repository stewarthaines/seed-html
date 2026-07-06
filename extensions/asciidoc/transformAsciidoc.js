/**
 * Convert AsciiDoc source to XHTML via Asciidoctor.js.
 * @param {string} text - plain text (AsciiDoc)
 * @param {string|undefined} idref - Spine item idref for context-aware transforms
 * @returns {string} Valid XHTML output
 */
function transformText(text, idref) {
  // The Asciidoctor() factory boots an Opal runtime — build it once and reuse.
  window.__asciidoctor = window.__asciidoctor || window.Asciidoctor();
  return window.__asciidoctor.convert(text);
}
