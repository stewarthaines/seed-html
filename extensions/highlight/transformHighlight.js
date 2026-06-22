/**
 * Highlight fenced code blocks with highlight.js. The `hljs` global is provided
 * by the extension's lib (highlight.min.js), loaded into the transform iframe.
 * Pairs with the Styles/highlight.css theme this extension installs.
 *
 * @param {Document} htmlDocument - HTML document to transform
 */
function transformDOM(htmlDocument, idref) {
  htmlDocument.querySelectorAll('pre code').forEach(el => {
    hljs.highlightElement(el);
  });
}
