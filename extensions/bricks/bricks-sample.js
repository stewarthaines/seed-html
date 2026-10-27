/**
 * Generator: insert a sample Bricks page, wrapped in the plain-text block
 * syntax the project authors in, ready for transformBricks.js to draw.
 *
 * The wrapper is chosen with the `format` option:
 *   - markdown -> a fenced ```bricks block (Djot, Markdown, AsciiDoc and Org
 *                 all write the fence this way)
 *   - textile  -> a `bc(bricks).` block, without blank lines, since a blank
 *                 line ends it
 *
 * The `page` option picks the sample: a building step (a red brick and two
 * yellow ones dropping onto a green plate, in two steps) or a turning model
 * (the same bricks, finished, which the reader turns). With `spaceman` on, a
 * blue spaceman stands on the plate; it needs the Bricks - Minifigs parts set,
 * so the option does nothing unless Misc/bricks/minifigs.mpd is in the
 * manifest. With `pictures` on, the page's header carries the line readers
 * see where the pages are pictures; a book needs it on one page only.
 *
 * Options:
 *   format (select)    — "markdown" | "textile" block wrapper
 *   page (select)      — "step" | "turning"
 *   spaceman (boolean) — add a spaceman when the minifigs set is installed
 *   pictures (boolean) — add the pictures line to the header
 *
 * @param {object} ctx - generator context; its manifest shows which parts sets are installed
 * @param {object} options - values from the invocation form, keyed by option name
 * @returns {string} source text to insert at the caret
 */
function generateText(ctx, options) {
  const opts = options || {};
  const format = opts.format === 'textile' ? 'textile' : 'markdown';
  const turning = opts.page === 'turning';
  const minifigs = ((ctx && ctx.manifest) || []).some((item) => item.href === 'Misc/bricks/minifigs.mpd');
  const spaceman = opts.spaceman !== false && minifigs;
  const pictures = opts.pictures === true
    ? ['pictures: Pictures only here. In a reader that supports it, such as Apple Books, Lisa or Cantook, this page is interactive.']
    : [];

  const lines = turning
    ? [
        '---',
        'spin: true',
        'alt: A red brick and two yellow bricks on a green plate' + (spaceman ? ', with a spaceman' : '') + ', turning.',
        ...pictures,
        '---',
        '3032 Green 0 0 0',
        '3001 Red 0 0 1',
        '3003 Yellow 0 2 1',
        '3003 Yellow 2 2 1',
      ]
    : [
        ...(pictures.length ? ['---', ...pictures, '---'] : []),
        'built',
        '3032 Green 0 0 0',
        '',
        'step   # the red brick',
        '3001 Red 0 0 1',
        '',
        'step   # two yellow bricks beside it',
        '3003 Yellow 0 2 1',
        '3003 Yellow 2 2 1',
      ];
  if (spaceman) {
    if (!turning) lines.push('', 'step   # someone to look after them');
    lines.push('spaceman Blue 4 1 1');
  }

  if (format === 'textile') {
    // The trailing blank line closes the `bc.` block so following text isn't
    // pulled into the code listing.
    return 'bc(bricks).\n' + lines.filter((line) => line !== '').join('\n') + '\n\n';
  }

  // A fenced block. (Backticks kept out of a template literal on purpose.)
  const fence = '```';
  return fence + ' bricks\n' + lines.join('\n') + '\n' + fence + '\n';
}
