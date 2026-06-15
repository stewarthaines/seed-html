/**
 * Generator: build a "list of figures" from the images used across the project's
 * chapters, and return it as source text to insert at the editor caret.
 *
 * Reads the per-chapter data recorded by storeImageReferences.js
 * (SOURCE/data/figures/<idref>.json), iterating the chapters declared in the
 * manifest (so figures appear in manifest order). Because that data is produced by
 * the DOM transform during preview, a chapter only contributes once it has been
 * rendered at least once.
 *
 * Options:
 *   template (string)        — per-figure line, with <chapter>, <caption>, <source>
 *   show_thumbnail (boolean) — also emit a Markdown/djot image under each line
 *
 * @param {object} ctx - generator context (manifest + readSourceText)
 * @param {object} options - values from the invocation form
 * @returns {string} source text (one bullet per figure)
 */
async function generateText(ctx, options) {
  const opts = options || {};
  const template = opts.template || '<caption> (<source>)';
  const manifest = (ctx && Array.isArray(ctx.manifest) && ctx.manifest) || [];

  // Content documents, excluding the navigation document.
  const chapters = manifest.filter(item => {
    if (item.mediaType !== 'application/xhtml+xml') return false;
    const props = item.properties || '';
    const propList = Array.isArray(props) ? props : String(props).split(/\s+/);
    return !propList.includes('nav');
  });

  const lines = [];
  for (const chapter of chapters) {
    let figures;
    try {
      const json = await ctx.readSourceText('SOURCE/data/figures/' + chapter.id + '.json');
      figures = JSON.parse(json);
    } catch (error) {
      continue; // No figures recorded for this chapter yet (not rendered, or none).
    }
    if (!Array.isArray(figures)) continue;

    for (const figure of figures) {
      const line = template
        .split('<chapter>').join(chapter.id)
        .split('<caption>').join(figure.caption || '')
        .split('<source>').join(figure.src || '');
      lines.push('- ' + line);
      if (opts.show_thumbnail && figure.src) {
        lines.push('  ![' + (figure.caption || '') + '](' + figure.src + ')');
      }
    }
  }

  if (lines.length === 0) {
    return '_No figures found. Open each chapter once so its images are recorded, then run this again._';
  }
  return lines.join('\n');
}
