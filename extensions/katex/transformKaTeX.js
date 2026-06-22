/**
 * Transform the DOM replacing code blocks containing KaTeX with MathML
 * @param {Document} htmlDocument - HTML document to transform
 * @param {string|undefined} idref - Spine item idref for context-aware transforms
 * @param {object} [ctx] - File-access context. May be omitted; when present:
 *   ctx.manifest, ctx.basePath, ctx.idref, and async methods
 *   readManifestText(href), readManifestDataURL(href), readSourceText(path),
 *   writeSourceText(path, text). A transform that uses these must be async.
 */
function transformDOM(htmlDocument, idref, ctx) {
  htmlDocument.querySelectorAll('code.katex, code.language-katex').forEach(code => {
    const div = document.createElement('div');
    katex.render(code.textContent, div, {
      output: 'mathml',
      macros: {
        "\\f": "#1f(#2)"
      },
      displayMode: true,
      throwOnError: false
    });
    code.parentNode.replaceWith(div);
  });
}
