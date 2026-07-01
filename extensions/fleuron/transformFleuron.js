/**
 * Replace each <hr> (the thematic break emitted by markdown, djot, textile, … — so this
 * works under any text transform) with a centred fleuron ornament.
 *
 * The placeholder art ships as the EPUB asset Images/icon-package-fleuron.svg and is read
 * back through the transform context (ctx.readManifestText). Its fill/stroke are driven to
 * currentColor so the ornament inherits the surrounding text colour. The glyph is defined
 * once per chapter inside the first ornament's <defs>; every ornament (including the first)
 * renders it through <use href="#…">, so repeating the fleuron costs one <use> rather than
 * a fresh copy of the art.
 *
 * Sizing/centring lives in Styles/fleuron.css (the .fleuron rules); this transform only
 * builds the markup and the currentColor / a11y attributes. The wrapper carries
 * role="separator" (the semantic equivalent of <hr>) and is intentionally left without an
 * aria-label so nothing forces an English string into every locale.
 *
 * @param {Document} htmlDocument - the chapter's rendered DOM (HTML)
 * @param {string} idref - spine item id for this chapter
 * @param {object} ctx - transform context (manifest + readManifestText)
 */
async function transformDOM(htmlDocument, idref, ctx) {
  const hrs = htmlDocument.querySelectorAll('hr');
  if (!hrs.length || !ctx) return htmlDocument;

  const FILENAME = 'fleuron.svg';
  const GLYPH_ID = 'fleuron-glyph';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const XLINKNS = 'http://www.w3.org/1999/xlink';
  const XHTMLNS = 'http://www.w3.org/1999/xhtml';

  // Locate the placeholder art in the OPF manifest (match on filename, whatever its
  // OEBPS-relative path) and read it back through the broker.
  const item = ctx.manifest.find(m => m.href.split('/').pop() === FILENAME);
  if (!item) return htmlDocument;

  let svgText;
  try {
    svgText = await ctx.readManifestText(item.href);
  } catch {
    return htmlDocument; // asset unreadable — leave the chapter untouched
  }

  const src = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  if (!src || src.nodeName === 'parsererror' || src.getElementsByTagName('parsererror').length) {
    return htmlDocument;
  }

  // Use the source art's own coordinate system, or the <use> reference lands off-canvas.
  const viewBox =
    src.getAttribute('viewBox') ||
    `0 0 ${src.getAttribute('width') || 100} ${src.getAttribute('height') || 20}`;

  // currentColor lets the ornament inherit the text colour; aria-hidden + focusable=false
  // keep the decorative art out of the accessibility tree (the wrapper's role conveys it).
  const decorate = svg => {
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  };

  const makeUse = () => {
    const use = htmlDocument.createElementNS(SVGNS, 'use');
    use.setAttribute('href', `#${GLYPH_ID}`);
    use.setAttributeNS(XLINKNS, 'xlink:href', `#${GLYPH_ID}`); // legacy reader fallback
    return use;
  };

  // First ornament carries the reusable glyph definition; the rest only reference it.
  const makeSvg = defining => {
    const svg = htmlDocument.createElementNS(SVGNS, 'svg');
    decorate(svg);
    if (defining) {
      const defs = htmlDocument.createElementNS(SVGNS, 'defs');
      const glyph = htmlDocument.createElementNS(SVGNS, 'g');
      glyph.setAttribute('id', GLYPH_ID);
      for (const child of [...src.childNodes]) {
        glyph.appendChild(htmlDocument.importNode(child, true));
      }
      defs.appendChild(glyph);
      svg.appendChild(defs);
    }
    svg.appendChild(makeUse());
    return svg;
  };

  hrs.forEach((hr, i) => {
    const wrapper = htmlDocument.createElementNS(XHTMLNS, 'div');
    wrapper.setAttribute('class', 'fleuron'); // styling/centring hook
    wrapper.setAttribute('role', 'separator');
    wrapper.appendChild(makeSvg(i === 0));
    hr.replaceWith(wrapper);
  });

  return htmlDocument;
}
