/**
 * Neumes code-block transform.
 *
 * Renders ```neumes fenced code blocks (markdown/djot: <pre><code
 * class="language-neumes">; textile: <pre class="neumes">) as manuscript-style
 * single-part singing notation: lines of direction marks (`/` up, `\` down,
 * spaces) sit above lines of syllables, on a shared character grid.
 *
 *   ```neumes {.top .first}
 *    /   /  /   /
 *   nai ni nav da
 *    /  \ \  /  \ \
 *   de li a de li a
 *   ```
 *
 * Each arrows+text line pair becomes ONE inline SVG — arrows and syllables are
 * a single drawing, so reading-system page breaks can't separate them and
 * layout can't drift between the two. The SVG is sized in em (block-size only;
 * width follows the viewBox aspect ratio), so the notation scales with the
 * reader's font-size setting just like page text did in the old table
 * rendering.
 *
 * Registration across blocks: neume blocks are parallel PARTS of one song,
 * shown side by side, so corresponding rows must stay level between blocks.
 * Every source line therefore occupies exactly one line-unit (1.2em): a pair
 * SVG is two units, an unpaired arrows/text line is one, and each blank source
 * line (or legacy `&nbsp;` line) is a one-unit spacer div. Long lines are
 * never shrunk to fit — that would break cross-block registration — the
 * container scrolls instead (Styles/neumes.css).
 *
 * Each word is a <text> anchored at its grid column, glyphs advancing
 * naturally within the word — the look of body text (letter-spacing is
 * tweakable in Styles/neumes.css), with word starts pinned to the grid the
 * arrows target.
 *
 * Fence classes ({.top .first}) are part identity: they are copied onto the
 * output container, and the whole drawing uses currentColor, so project CSS
 * like `.neumes.top { color: goldenrod }` tints a part.
 *
 * @param {Document} document - the chapter's rendered DOM (HTML)
 * @param {string|undefined} idref - spine item idref
 * @returns {Document} the transformed document
 */

const SVGNS = 'http://www.w3.org/2000/svg'

// Grid geometry in viewBox units. ROW ≡ 1.2em and FONT ≡ 1em, so the CSS
// sizes in Styles/neumes.css (2.4em pair, 1.2em single/spacer) map exactly.
const COL = 6 // character cell width (≈ the old monospace rhythm)
const ROW = 12 // one line-unit
const FONT = 10 // syllable font-size
const ARROW = 7 // arrow glyph box (the glyph is drawn in a ~8×8 box)
const PAD = 3 // viewBox bleed on each side so rotated arrow tips never clip

// Baselines within a two-row (pair) viewBox; single-row SVGs offset to fit.
const ARROW_Y = 4.5 // top of the arrow glyph box (sits close above the text)
const TEXT_BASELINE = 21 // text baseline in the second row

/**
 * The shared glyph definitions: the user's manuscript arrow (a stroked shaft
 * with a triangular marker head), rotated ±30° for up/down. Rendered once per
 * chapter in a zero-size, always-rendered SVG — never display:none, and never
 * duplicated (document-wide id lookup would silently bind every <use> to the
 * first copy).
 */
function ensureDefs(document) {
  if (document.getElementById('neumes-defs')) return

  const holder = document.createElementNS(SVGNS, 'svg')
  holder.setAttribute('id', 'neumes-defs')
  holder.setAttribute('class', 'neumes-defs')
  holder.setAttribute('aria-hidden', 'true')
  holder.setAttribute('focusable', 'false')
  holder.setAttribute('width', '0')
  holder.setAttribute('height', '0')

  const defs = document.createElementNS(SVGNS, 'defs')

  // One closed filled path per direction: shaft plus triangular head baked
  // into the outline. The original used a stroked shaft with a marker-end
  // head, but markers referenced through nested <use> shadow trees render
  // unreliably (flattened/missing tips) — a plain filled path is portable
  // everywhere and keeps the tip sharp.
  const SHAFT_AND_HEAD =
    'M 0,3.6 L 4.6,3.6 L 4.6,2.2 L 8.2,4.15 L 4.6,6.1 L 4.6,4.7 L 0,4.7 Z'
  for (const [id, angle] of [
    ['neumes-up', -30],
    ['neumes-down', 30],
  ]) {
    const g = document.createElementNS(SVGNS, 'g')
    g.setAttribute('id', id)
    const path = document.createElementNS(SVGNS, 'path')
    path.setAttribute('d', SHAFT_AND_HEAD)
    path.setAttribute('fill', 'currentColor')
    path.setAttribute('transform', `rotate(${angle}, 4.2, 4.2)`)
    g.appendChild(path)
    defs.appendChild(g)
  }

  holder.appendChild(defs)
  document.body.insertBefore(holder, document.body.firstChild)
}

/** href in both syntaxes: modern plain href plus xlink for older engines. */
function setHref(use, target) {
  use.setAttribute('href', target)
  use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', target)
}

/** Legacy tolerance: literal `&nbsp;` strings and U+00A0 count as spaces. */
function normalize(line) {
  return line.replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ')
}

function classifyLine(line) {
  if (line.trim() === '') return 'spacer'
  if (/^[/\\ ]+$/.test(line)) return 'arrows'
  return 'text'
}

/** <use> arrow glyphs at each mark's column, at rowTop (viewBox units). */
function appendArrows(document, svg, line, rowTop) {
  for (let col = 0; col < line.length; col++) {
    const ch = line[col]
    if (ch !== '/' && ch !== '\\') continue
    const use = document.createElementNS(SVGNS, 'use')
    setHref(use, ch === '/' ? '#neumes-up' : '#neumes-down')
    // Centre the glyph box in the character cell.
    use.setAttribute('x', String(col * COL + (COL - ARROW) / 2))
    use.setAttribute('y', String(rowTop + ARROW_Y))
    svg.appendChild(use)
  }
}

/**
 * One <text> per word, anchored at the word's grid column. Glyphs inside the
 * word advance naturally (matching body text; letter-spacing is tweakable in
 * Styles/neumes.css), while word starts stay on the grid the arrows target —
 * syllables are short, so marks stay over their vowels.
 */
function appendText(document, svg, line, baseline) {
  const re = /\S+/g
  let m
  while ((m = re.exec(line)) !== null) {
    const text = document.createElementNS(SVGNS, 'text')
    text.setAttribute('x', String(m.index * COL))
    text.setAttribute('y', String(baseline))
    text.setAttribute('font-size', String(FONT))
    text.setAttribute('fill', 'currentColor')
    text.textContent = m[0]
    svg.appendChild(text)
  }
}

function transformDOM(document, idref) {
  const codes = document.querySelectorAll('pre.neumes, pre:has(code.language-neumes)')
  codes.forEach((pre) => {
    const code = pre.querySelector('code')
    const rawLines = (code ? code.textContent : pre.textContent).replace(/\n$/, '').split('\n')

    ensureDefs(document)

    const container = document.createElement('div')
    // Part identity travels: every class on the pre/code except the language
    // marker (and the textile selector's own "neumes").
    const carried = [...pre.classList, ...(code ? [...code.classList] : [])].filter(
      (c) => c !== 'language-neumes' && c !== 'neumes'
    )
    container.setAttribute('class', ['neumes', ...carried].join(' '))

    // Uniform width: every SVG in the block spans the block's widest line, so
    // rows left-register within the block.
    const lines = rawLines.map(normalize)
    const maxCols = Math.max(1, ...lines.map((l) => l.length))
    const width = maxCols * COL

    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      const kind = classifyLine(line)

      if (kind === 'spacer') {
        const spacer = document.createElement('div')
        spacer.setAttribute('class', 'neumes-spacer')
        container.appendChild(spacer)
        i += 1
        continue
      }

      const next = i + 1 < lines.length ? lines[i + 1] : null
      const paired = kind === 'arrows' && next !== null && classifyLine(next) === 'text'

      const svg = document.createElementNS(SVGNS, 'svg')
      svg.setAttribute('class', paired ? 'neumes-line' : 'neumes-line single')
      svg.setAttribute('viewBox', `${-PAD} 0 ${width + 2 * PAD} ${paired ? 2 * ROW : ROW}`)
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet')
      svg.setAttribute('aria-hidden', 'true')

      if (paired) {
        appendArrows(document, svg, line, 0)
        appendText(document, svg, next, TEXT_BASELINE)
        i += 2
      } else if (kind === 'arrows') {
        appendArrows(document, svg, line, 0)
        i += 1
      } else {
        appendText(document, svg, line, TEXT_BASELINE - ROW)
        i += 1
      }

      container.appendChild(svg)
    }

    // The drawing is decorative markup around the sung text; give assistive
    // tech the syllables in reading order instead.
    const spoken = lines
      .filter((l) => classifyLine(l) === 'text')
      .map((l) => l.trim())
      .join(' ')
    if (spoken) {
      container.setAttribute('role', 'img')
      container.setAttribute('aria-label', spoken)
    }

    pre.replaceWith(container)
  })
  return document
}
