/**
 * Generator: list the parts the book's parts sets offer, for copying exact
 * part numbers while writing. The list is `#` comment lines, which a bricks
 * block ignores in every source format: insert it inside a block, and delete
 * it when the page is done.
 *
 *   # core.mpd
 *   # 3005    Brick 1 x 1
 *   # 3665a   Slope Brick 45 2 x 1 Inverted without Inner Stopper Ring
 *
 * Every .mpd under Misc/bricks/ in the manifest is a set, listed in manifest
 * order, each sorted by name (then number) as a parts page sorts it, without
 * LDraw's ~ files (moved and alias parts). A part in two sets is listed once,
 * under the first.
 *
 * Options:
 *   colours (boolean) — also list the colour names the parts can take
 *
 * @param {object} ctx - generator context: its manifest and readManifestText
 * @param {object} options - values from the invocation form, keyed by option name
 * @returns {Promise<string>} source text to insert at the caret
 */
async function generateText(ctx, options) {
  const opts = options || {};
  const manifest = (ctx && ctx.manifest) || [];
  const sets = manifest.filter((item) => /^Misc\/bricks\/[^/]+\.mpd$/i.test(item.href || ''));
  if (!sets.length) return '# No parts sets: nothing under Misc/bricks/ in the manifest.\n';

  const listed = [];
  const seen = new Set();
  let colours = [];
  for (const item of sets) {
    const file = item.href.split('/').pop();
    let text;
    try {
      text = await ctx.readManifestText(item.href);
    } catch (error) {
      listed.push({ file, parts: [], error: true });
      continue;
    }
    const parts = [];
    text.replace(/^0 FILE (?:parts|models)\/([^/\s]+)\.(?:dat|ldr)\s*\n(?:0 (.*))?/gim, (m, is, title) => {
      const name = (title || is).replace(/\s+/g, ' ').trim();
      if (!name.startsWith('~') && !seen.has(is.toLowerCase())) {
        seen.add(is.toLowerCase());
        parts.push({ is, name });
      }
      return m;
    });
    parts.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }) ||
      a.is.localeCompare(b.is, 'en', { numeric: true }));
    listed.push({ file, parts });
    if (!colours.length) {
      text.replace(/^0 !COLOUR\s+(\S+)\s+CODE\s+\d+/gm, (m, name) => {
        colours.push(name);
        return m;
      });
    }
  }

  const width = Math.max(0, ...listed.flatMap((set) => set.parts.map((part) => part.is.length)));
  const lines = [];
  for (const set of listed) {
    lines.push(`# ${set.file}${set.error ? ': could not be read' : ''}`);
    for (const part of set.parts) lines.push(`# ${part.is.padEnd(width)}  ${part.name}`);
  }
  if (opts.colours && colours.length) {
    lines.push('# colours');
    let line = '#';
    for (const name of colours) {
      if (line.length > 2 && line.length + name.length + 2 > 78) {
        lines.push(line);
        line = '#';
      }
      line += (line.length > 1 ? ', ' : ' ') + name;
    }
    lines.push(line);
  }
  return lines.join('\n') + '\n';
}
