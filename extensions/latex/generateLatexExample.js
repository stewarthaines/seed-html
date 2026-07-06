/**
 * Generator: insert a concise LaTeX syntax example — sectioning, emphasis,
 * lists, a quotation and inline math (verified against LaTeX.js; math needs
 * the browser preview, not the unit-test DOM).
 *
 * @param {object} ctx - generator context (unused; fixed content)
 * @param {object} options - values from the invocation form (none)
 * @returns {string} source text to insert at the caret
 */
function generateText(ctx, options) {
  return (
    '\\section{Section heading}\n' +
    '\n' +
    'A paragraph with \\textbf{bold}, \\emph{emphasised} and \\texttt{monospace}\n' +
    'text, plus inline math: $e^{i\\pi} + 1 = 0$.\n' +
    '\n' +
    '\\subsection{Subsection}\n' +
    '\n' +
    '\\begin{itemize}\n' +
    '  \\item an unordered item\n' +
    '  \\item another item\n' +
    '\\end{itemize}\n' +
    '\n' +
    '\\begin{enumerate}\n' +
    '  \\item first ordered item\n' +
    '  \\item second ordered item\n' +
    '\\end{enumerate}\n' +
    '\n' +
    '\\begin{quote}\n' +
    'A block quotation, indented from both margins.\n' +
    '\\end{quote}\n'
  );
}
