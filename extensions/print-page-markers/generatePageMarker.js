/**
 * Generator: insert a sample print page marker in the project's text-format
 * syntax. After rendering, transformPageMarkers.js turns the `.pagebreak` run
 * into the full doc-pagebreak marker, with the run's text as the page label.
 *
 * The class syntax differs per format, so pick the one the project authors in
 * via the `format` option:
 *   - markdown (markdown-it + markdown-it-attrs): `*20*{.pagebreak}`
 *   - djot:                                       `[20]{.pagebreak}`
 *   - textile:                                    `[%(pagebreak)20%]` (brackets: works straight after a word)
 *
 * @param {object} ctx - generator context (unused; self-contained fixed content)
 * @param {object} options - values from the invocation form; `format` selects the syntax
 * @returns {string} source text to insert at the caret
 */
function generateText(ctx, options) {
  const format = ['markdown', 'djot', 'textile'].includes(options && options.format)
    ? options.format
    : 'markdown';

  if (format === 'djot') return '[20]{.pagebreak}';
  if (format === 'textile') return '[%(pagebreak)20%]';
  return '*20*{.pagebreak}';
}
