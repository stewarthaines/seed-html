/**
 * Self-describing "impressum": replace a `[]{.autology}` marker with a summary of what
 * went into this EPUB — the extensions that processed it (name, description, link, license)
 * and the embedded fonts — assembled automatically at render time, so it never needs to be
 * compiled by hand.
 *
 * Sources, all reachable from the transform context:
 *   - Extensions: `SOURCE/settings.json` names the wired-in transforms; each owning
 *     extension's `SOURCE/extensions/<id>/extension.json` (copied in at install) carries
 *     name/description/url/license. (An asset-only extension with no transform isn't listed.)
 *   - Fonts: OPF manifest items with a font media type or font file extension (ctx.manifest).
 *
 * The marker only becomes a real `<span class="autology">` under the djot text transform;
 * the universal text transform leaves it literal. The chapter DOM is parsed as HTML, so this
 * uses the global `document.createElement` (no namespaces), like the other DOM transforms.
 *
 * @param {Document} htmlDocument - the chapter's rendered DOM
 * @param {string} idref - the spine item id for this chapter
 * @param {object} ctx - transform context (manifest, readSourceText, …)
 */
async function transformDOM(htmlDocument, idref, ctx) {
  const marker = htmlDocument.querySelector('.autology');
  if (!marker || !ctx) return htmlDocument;

  // Extensions: discover from the active pipeline, then read each extension's own manifest.
  const ids = new Set();
  try {
    const settings = JSON.parse(await ctx.readSourceText('SOURCE/settings.json'));
    for (const p of [settings.text_transform, ...(settings.dom_transforms || [])]) {
      const m = typeof p === 'string' && p.match(/SOURCE\/extensions\/([^/]+)\//);
      if (m && m[1] !== 'impressum') ids.add(m[1]); // don't list ourselves
    }
  } catch (e) {
    // No settings.json → no extensions section.
  }

  const extensions = [];
  for (const id of ids) {
    try {
      const meta = JSON.parse(await ctx.readSourceText('SOURCE/extensions/' + id + '/extension.json'));
      extensions.push({
        name: meta.name || id,
        description: meta.description || '',
        url: meta.url || '',
        license: meta.license || '', // a filename within the extension dir
      });
    } catch (e) {
      // Skip an unreadable extension.
    }
  }
  extensions.sort((a, b) => a.name.localeCompare(b.name));

  // Fonts: manifest items by font media type or file extension.
  const isFont = m =>
    /^font\//i.test(m.mediaType || '') ||
    /^application\/(x-font|font|vnd\.ms-opentype)/i.test(m.mediaType || '') ||
    /\.(woff2?|ttf|otf)$/i.test(m.href || '');
  const fonts = [
    ...new Set(
      (ctx.manifest || [])
        .filter(isFont)
        .map(m => (m.href || '').split('/').pop())
        .filter(Boolean)
    ),
  ].sort();

  // Build the block (global document.createElement — HTML document).
  const node = (tag, text) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    return n;
  };
  const section = document.createElement('section');
  section.className = 'impressum';

  if (extensions.length) {
    section.appendChild(node('h2', 'Extensions'));
    const ul = document.createElement('ul');
    for (const x of extensions) {
      const li = document.createElement('li');
      if (x.url) {
        const a = document.createElement('a');
        a.setAttribute('href', x.url);
        a.textContent = x.name;
        li.appendChild(a);
      } else {
        li.appendChild(document.createTextNode(x.name));
      }
      const tail = [x.description, x.license && 'license: ' + x.license].filter(Boolean).join(' — ');
      if (tail) li.appendChild(document.createTextNode(' — ' + tail));
      ul.appendChild(li);
    }
    section.appendChild(ul);
  }

  if (fonts.length) {
    section.appendChild(node('h2', 'Fonts'));
    const ul = document.createElement('ul');
    for (const f of fonts) ul.appendChild(node('li', f));
    section.appendChild(ul);
  }

  // Replace the marker's enclosing <p> (djot wraps a lone span in a paragraph) so we don't
  // nest block content inside a <p>.
  (marker.closest('p') || marker).replaceWith(section);
  return htmlDocument;
}
