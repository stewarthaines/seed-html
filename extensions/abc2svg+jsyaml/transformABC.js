/**
 * abc2svg code-block transform.
 *
 * Renders ```abc2svg fenced code blocks (markdown: <pre><code
 * class="language-abc2svg">; textile: <pre class="abc2svg">) as SVG scores
 * using the bundled abc2svg (abc2svg global, engraving with the Bravura music
 * font) with js-yaml (jsyaml global) parsing an optional YAML frontmatter
 * section at the top of the block.
 *
 * Frontmatter:
 *   ---
 *   scales:
 *     narrow: 1.9
 *     wide: 1.15
 *     full: 0.69
 *   ---
 *   <ABC notation…>
 *
 * Each named scale is pre-rendered as its own variant
 * (div.abc2svg-variant.<name>) inside one div.abc2svg-container. Which variant
 * displays is pure CSS (Styles/abc2svg.css): a container query against the
 * reading column, with media-query and first-variant fallbacks — no
 * reading-system JavaScript (this replaces the old body-class approach driven
 * by a Scripts/responsive.js). The conventional names are narrow / wide /
 * full; the CSS only knows those three, so other names render but never
 * display.
 *
 * Scale semantics: the staff width is fixed (%%staffwidth 790) and the scale
 * factor sizes the engraving within it — a LARGER scale means bigger glyphs
 * and fewer measures per line, i.e. the variant suited to the NARROWEST
 * column. Variants are therefore sorted by scale DESCENDING so the first one
 * (the universal display fallback, .is-default) is the narrow-column variant.
 *
 * @param {Document} document - the chapter's rendered DOM (HTML)
 * @param {string|undefined} idref - spine item idref for context-aware transforms
 * @returns {Document} the transformed document
 */
/**
 * Namespace all ids (and their references) in an abc2svg SVG string. Every
 * variant emits the same internal ids (e.g. the staff-lines def
 * "stdeffalse"), and id lookups resolve document-wide — even into
 * display:none variants — so without this the visible variant renders with
 * the FIRST variant's defs, drawn for a different scale.
 */
function namespaceSvgIds(svg, prefix) {
  return svg
    .replace(/id="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
}

function transformDOM(document, idref) {
  var blockIndex = 0
  var codes = document.querySelectorAll('pre.abc2svg, pre:has(code.language-abc2svg)')
  codes.forEach((c) => {
    blockIndex += 1
    const container = document.createElement('div')
    container.setAttribute('class', 'abc2svg-container')

    let abcContent = c.querySelector('code').textContent
    const frontmatterMatch = abcContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

    let scaleConfigs = null

    if (frontmatterMatch) {
      const [, frontmatterText, content] = frontmatterMatch
      abcContent = content.trim()

      try {
        // Parse the frontmatter as YAML using js-yaml
        const frontmatterOptions = jsyaml.load(frontmatterText)

        if (
          frontmatterOptions.scales &&
          typeof frontmatterOptions.scales === 'object' &&
          !Array.isArray(frontmatterOptions.scales)
        ) {
          scaleConfigs = []
          Object.entries(frontmatterOptions.scales).forEach(([name, scale]) => {
            const numScale = Number(scale)
            if (!isNaN(numScale) && numScale > 0) {
              scaleConfigs.push({ name, scale: numScale })
            }
          })
          // Largest scale first: it fits the narrowest column, and doubles as
          // the universal display fallback (see header).
          scaleConfigs.sort((a, b) => b.scale - a.scale)
        }
      } catch (err) {
        console.error(err)
      }
    }
    if (!scaleConfigs || scaleConfigs.length === 0) {
      scaleConfigs = [{ name: 'default', scale: 1.0 }]
    }

    // Stamp the facts the stylesheet needs as classes, so abc2svg.css needs no
    // :has() (newer than container queries — no good as a fallback dependency):
    // which conventional variants exist, which is the narrow-column fallback
    // and which suits the widest column.
    const names = scaleConfigs.map((cfg) => cfg.name)
    if (!names.includes('wide')) container.classList.add('no-wide')
    if (!names.includes('full')) container.classList.add('no-full')

    scaleConfigs.forEach((config, i) => {
      const variant = document.createElement('div')
      const roles = [
        i === 0 ? 'is-default' : '',
        i === scaleConfigs.length - 1 ? 'is-widest' : '',
      ]
      variant.setAttribute(
        'class',
        ['abc2svg-variant', config.name, ...roles].filter(Boolean).join(' ')
      )
      container.appendChild(variant)

      const idPrefix = `abc${blockIndex}v${i}-`
      const renderOptions = {
        img_out: (svg) => {
          variant.innerHTML += namespaceSvgIds(svg, idPrefix)
        },
        errmsg: (err) => {
          console.error(err)
        },
      }
      abc2svg.loadFont = function (font_name) {
        // Return external font reference instead of embedding
        return `url('../Fonts/${font_name}.woff2')`
      }
      const abc = new abc2svg.Abc(renderOptions)

      // Configure options
      const preamble = `%%leftmargin 0
%%rightmargin 0
%%topspace 0
%%musicspace 0
%%staffwidth 790
%%fullsvg false
%%scale ${config.scale}
%%vocalfont serif 16
%%measurenb 4
%%unsizedsvg 1
:%%musicfont ft1
%%stretchlast 0.7
%%musicfont Bravura
X:1
`
      abc.tosvg(idref, preamble + abcContent + '\n\n')
    })

    c.replaceWith(container)
  })
  return document
}
