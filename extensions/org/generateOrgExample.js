/**
 * Generator: insert a concise Org syntax example — the constructs a chapter
 * author reaches for first (verified against org-js).
 *
 * @param {object} ctx - generator context (unused; fixed content)
 * @param {object} options - values from the invocation form (none)
 * @returns {string} source text to insert at the caret
 */
function generateText(ctx, options) {
  return (
    '* Headline\n' +
    '\n' +
    'A paragraph with *bold*, /italic/, _underlined_ and =verbatim= text,\n' +
    'and a link: [[https://orgmode.org/][Org mode]].\n' +
    '\n' +
    '** Sub-headline\n' +
    '\n' +
    '- an unordered item\n' +
    '- another item\n' +
    '\n' +
    '1. first ordered item\n' +
    '2. second ordered item\n' +
    '\n' +
    '| Name  | Value |\n' +
    '|-------+-------|\n' +
    '| alpha |     1 |\n' +
    '| beta  |     2 |\n' +
    '\n' +
    '#+BEGIN_SRC\n' +
    'a source block\n' +
    '#+END_SRC\n'
  );
}
