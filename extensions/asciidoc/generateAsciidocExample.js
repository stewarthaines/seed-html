/**
 * Generator: insert a concise AsciiDoc syntax example — the constructs a
 * chapter author reaches for first (verified against Asciidoctor.js).
 *
 * @param {object} ctx - generator context (unused; fixed content)
 * @param {object} options - values from the invocation form (none)
 * @returns {string} source text to insert at the caret
 */
function generateText(ctx, options) {
  return (
    '== Section heading\n' +
    '\n' +
    'Plain paragraph with *bold*, _italic_ and `monospace` text,\n' +
    'and a https://asciidoc.org/[link].\n' +
    '\n' +
    '=== Subsection\n' +
    '\n' +
    '* an unordered item\n' +
    '* another item\n' +
    '\n' +
    '. first ordered item\n' +
    '. second ordered item\n' +
    '\n' +
    '[quote, Somebody Famous]\n' +
    '____\n' +
    'A block quote with attribution.\n' +
    '____\n' +
    '\n' +
    'NOTE: Admonitions like NOTE, TIP and WARNING get callout styling.\n' +
    '\n' +
    '----\n' +
    'a literal code block\n' +
    '----\n'
  );
}
