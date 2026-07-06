/**
 * Convert LaTeX source to XHTML via LaTeX.js. A chapter can be a bare fragment —
 * the \documentclass / document-environment boilerplate is added when missing —
 * or a complete document, which passes through untouched.
 * @param {string} text - plain text (LaTeX)
 * @param {string|undefined} idref - Spine item idref for context-aware transforms
 * @returns {string} Valid XHTML output
 */
function transformText(text, idref) {
  let source = text;
  if (!/\\begin\{document\}/.test(source)) {
    source = '\\documentclass{article}\n\\begin{document}\n' + source + '\n\\end{document}\n';
  }
  const generator = new window.latexjs.HtmlGenerator({ hyphenate: false });
  window.latexjs.parse(source, { generator });
  const container = document.createElement('div');
  container.appendChild(generator.domFragment());
  return container.innerHTML;
}
