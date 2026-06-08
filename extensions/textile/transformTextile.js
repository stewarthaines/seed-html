/**
 * Convert plain text to well-formed XHTML
 * @param {string} input - Textile formatted text
 * @returns {string} Valid XHTML output
 */
function transformText(input, idref) {
  try {
    return textile(input);
  } catch (error) {
    return error;
  }
}
