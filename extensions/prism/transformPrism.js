/**
 * @param {Document} htmlDocument - HTML document to transform
 */
function transformDOM(htmlDocument, idref) {
  try {
    Prism.manual = true;
    htmlDocument.querySelectorAll('code[class^="language-"]').forEach(el => {
      Prism.highlightElement(el);
    });
  } catch (error) {
    htmlDocument.body.append(error);
    console.error('DOM transform error:', error);
  }
}
