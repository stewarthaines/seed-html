/**
 * Transform DOM with abc2svg
 * @param {Document} document - HTML document to transform
 * @param {string|undefined} idref - Spine item idref for context-aware transforms
 * @param {object} [ctx] - File-access context. May be omitted; when present:
 *   ctx.manifest, ctx.basePath, ctx.idref, and async methods
 *   readManifestText(href), readManifestDataURL(href), readSourceText(path),
 *   writeSourceText(path, text). A transform that uses these must be async.
 */
function transformDOM(document, idref) {
var codes = document.querySelectorAll('pre.abc2svg, pre:has(code.language-abc2svg)')
  codes.forEach((c) => {
    const abcContainer = document.createElement('div')
    // NOTE: container target must be in the dom to be rendered into
    document.body.appendChild(abcContainer)

    let abcContent = c.querySelector('code').textContent
    const frontmatterMatch = abcContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

    let scaleConfigs = null

    if (frontmatterMatch) {
      const [, frontmatterText, content] = frontmatterMatch
      abcContent = content.trim()

      try {
        // Parse the frontmatter as YAML using js-yaml
        const frontmatterOptions = jsyaml.load(frontmatterText)

        if (frontmatterOptions.scales) {
          const scaleOptions = frontmatterOptions.scales

          // Check if it's an object with named scales
          if (
            typeof scaleOptions === 'object' &&
            scaleOptions !== null &&
            !Array.isArray(scaleOptions)
          ) {
            scaleConfigs = []

            // Process each named width
            Object.entries(scaleOptions).forEach(([name, scale]) => {
              const numScale = Number(scale)
              if (!isNaN(numScale) && numScale > 0) {
                scaleConfigs.push({
                  name,
                  scale: numScale,
                })
              }
            })

            // Sort by width value (ascending)
            scaleConfigs.sort((a, b) => a.scale - b.scale)
          }
        }
      } catch (err) {
        console.log(err)
      }
    }
    if (!scaleConfigs) {
      scaleConfigs = [{ name: 'default', scale: 1.0 }]
    }
    // Check if we need to render multiple versions at different staffwidths
    if (scaleConfigs && scaleConfigs.length > 0) {
      // For each staffwidth configuration, render a separate version
      for (const config of scaleConfigs) {
        const renderOptions = {
          img_out: (svg) => {
            abcContainer.innerHTML += `<div class="${config.name}">` + svg + '</div>'
          },
          errmsg: (err) => {
            console.log(err)
          },
        }
        abc2svg.loadFont = function(font_name) {
          // Return external font reference instead of embedding
          return `url('../Fonts/${font_name}.woff2')`;
        };
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
      }
    }
    c.replaceWith(abcContainer)
  })
  return document
}
