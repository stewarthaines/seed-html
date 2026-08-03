/**
 * Mermaid code-block transform.
 *
 * Renders ```mermaid fenced code blocks (markdown: <pre><code
 * class="language-mermaid">; textile: <pre class="mermaid">) as static SVG
 * diagrams using the bundled Mermaid (mermaid global). Each block is replaced
 * by a div.mermaid-container holding one self-contained SVG: the diagram's
 * styling is embedded in the SVG itself, scoped to the diagram id, so it
 * renders in any reading system with no external CSS or scripts.
 *
 * Per-block configuration uses Mermaid's own syntax — YAML frontmatter
 * (title:, config:) or an %%{init: …}%% directive at the top of the block —
 * so no companion YAML library is needed.
 *
 * Rendering settings chosen for EPUB output:
 *   - htmlLabels: false  — real SVG <text> labels; reading systems largely
 *                          do not render <foreignObject> HTML
 *   - securityLevel: strict — labels escaped, no click bindings; nothing
 *                          interactive survives into the book
 *   - theme: neutral     — grayscale default suited to print/e-ink; authors
 *                          override per block via frontmatter or init
 *   - useMaxWidth: true  — SVG carries a viewBox and scales to the column
 *
 * Mermaid measures label text against the live transform-iframe DOM (the
 * iframe is visibility:hidden but laid out, so getBBox works); only the
 * resulting SVG string is inserted into the chapter document. On a parse or
 * render error the block's <pre> is left untouched and the remaining blocks
 * still render.
 *
 * @param {Document} document - the chapter's rendered DOM (HTML)
 * @param {string|undefined} idref - spine item idref for context-aware transforms
 * @returns {Promise<Document>} the transformed document
 */
async function transformDOM(document, idref) {
  const blocks = document.querySelectorAll('pre.mermaid, pre:has(code.language-mermaid)')
  if (!blocks.length) return document

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'neutral',
    fontFamily: 'sans-serif',
    // Must be TOP-LEVEL: v11's unified renderer ignores a per-diagram
    // flowchart.htmlLabels on its own (verified against v11.16.0).
    htmlLabels: false,
    flowchart: { useMaxWidth: true },
  })

  let blockIndex = 0
  // Sequential for..of, not forEach: mermaid.render is async and stateful.
  for (const pre of blocks) {
    blockIndex += 1
    // Unique per chapter; mermaid prefixes every internal SVG id with it, so
    // multiple diagrams in one chapter cannot collide.
    const id = `mermaid-${blockIndex}`
    const code = pre.querySelector('code')
    const source = (code ? code.textContent : pre.textContent) || ''
    try {
      const { svg } = await mermaid.render(id, source)
      const container = document.createElement('div')
      container.setAttribute('class', 'mermaid-container')
      container.innerHTML = svg
      pre.replaceWith(container)
    } catch (err) {
      console.error(err)
      // On failure mermaid leaves an error-diagram element in the LIVE iframe
      // document; `document` here is the chapter DOM, so clean up via the
      // real global, then leave the source <pre> in place.
      const live = globalThis.document
      for (const leftoverId of ['d' + id, id]) {
        const leftover = live.getElementById(leftoverId)
        if (leftover) leftover.remove()
      }
    }
  }
  return document
}
