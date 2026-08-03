# Mermaid Extension Plan

Render ```` ```mermaid ```` fenced code blocks as SVG diagrams at transform time, modeled on the abc2svg+jsyaml extension. Diagrams become static, self-contained SVG in the chapter XHTML — nothing executes in the reading system.

## Why the abc2svg model fits

abc2svg proves the exact shape this needs: a vendored renderer loaded as an iframe global via `scripts[]`, a `transformDOM` that finds `pre.<lang> / pre:has(code.language-<lang>)` blocks and replaces each with rendered SVG, a CSS asset shipped into `OEBPS/Styles/` via `assets[]`, and a sample generator. Two properties of the transform sandbox (`src/lib/infrastructure/transform-engine.ts`, `src/assets/iframe/editor.js`) make mermaid viable at all:

- The persistent iframe is `visibility: hidden` at 800×600 — **not** `display: none` — so layout runs and `getBBox()` text measurement works. Mermaid depends on this; abc2svg doesn't (it has its own glyph metrics), so this is the one environmental assumption to verify first.
- Transforms may be sync **or async** (per `src/lib/transform/TRANSFORM_CONTEXT.md`). `mermaid.render()` is promise-based, so `transformDOM` will be `async` — a first among the shipped code-block extensions, but explicitly supported by the contract.

## What's simpler than abc2svg

- **No js-yaml.** Mermaid (v10.5+) parses its own YAML frontmatter (`title:`, `config:`) and `%%{init: …}%%` directives inside the block. Per-block configuration comes free; the extension directory is plain `mermaid`, no `+jsyaml`.
- **No responsive variant machinery.** Mermaid SVG carries a `viewBox` and (with `useMaxWidth: true`) scales fluidly to the column. One rendering per block; no narrow/wide/full pre-renders, no container-query ladder.
- **No custom font loading hook.** Base extension uses a generic font stack (see Assets below).

## File layout

```
extensions/mermaid/
  extension.json
  mermaid.min.js        — vendored Mermaid v11.x standalone IIFE build (global `mermaid`), exact version noted in LICENSE.txt
  LICENSE.txt           — MIT (Mermaid) header with version + source URL
  transformMermaid.js   — the DOM transform
  mermaid-sample.js     — generator
  mermaid.css           — shipped to OEBPS/Styles/mermaid.css
```

The catalog build (`scripts/generate-extensions-manifest.js`) and the dev vite middleware both auto-discover by scanning `extensions/*/extension.json` — no manual registration.

## extension.json draft

```json
{
  "id": "mermaid",
  "name": "Mermaid",
  "description": "Render Mermaid diagram code blocks (flowcharts, sequence, class, state, ER, pie, gantt…) as static SVG. Per-block titles and config via Mermaid's own frontmatter and %%{init}%% directives.",
  "category": "code-blocks",
  "url": "https://mermaid.js.org/",
  "licenseName": "MIT",
  "license": "LICENSE.txt",
  "scripts": ["mermaid.min.js"],
  "assets": [
    { "file": "mermaid.css", "target": "Styles/mermaid.css", "media": "text/css" }
  ],
  "domTransforms": ["transformMermaid.js"],
  "textTransforms": [],
  "generators": [ { "id": "mermaid-sample", "…": "see Generator below" } ]
}
```

## Transform design (`transformMermaid.js`)

Selector, matching the abc2svg convention for both wrappers: `pre.mermaid, pre:has(code.language-mermaid)`.

```js
async function transformDOM(document, idref) {
  const blocks = document.querySelectorAll('pre.mermaid, pre:has(code.language-mermaid)')
  if (!blocks.length) return document

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',        // escaped labels, no click bindings — nothing interactive survives into the EPUB
    theme: 'neutral',               // grayscale default; suits print/e-ink; per-block override via frontmatter/init
    fontFamily: 'sans-serif',
    htmlLabels: false,              // TOP-LEVEL, not flowchart.htmlLabels — v11's unified
                                    // renderer ignores the per-diagram key alone (spike-verified)
    flowchart: { useMaxWidth: true },
    // htmlLabels:false is load-bearing: it forces real SVG <text> labels instead of
    // <foreignObject> HTML, which EPUB reading systems largely do not render.
  })

  let i = 0
  for (const pre of blocks) {       // sequential for..of — mermaid.render is async and stateful
    i += 1
    const id = `mermaid-${i}`       // unique per chapter; mermaid prefixes all internal SVG ids with it
    const source = pre.querySelector('code').textContent
    try {
      const { svg } = await mermaid.render(id, source)
      const container = document.createElement('div')
      container.setAttribute('class', 'mermaid-container')
      container.innerHTML = svg
      pre.replaceWith(container)
    } catch (err) {
      console.error(err)
      // mermaid leaves an error-diagram element in the LIVE iframe document on failure;
      // `document` here is the chapter DOM, so clean up via the real global.
      globalThis.document.getElementById('d' + id)?.remove()
      globalThis.document.getElementById(id)?.remove()
      // degrade gracefully: leave the source pre in place
    }
  }
  return document
}
```

Notes:

- **Rendering happens against the iframe's live document** (mermaid appends its own scratch element for measurement); only the resulting SVG string is inserted into the chapter DOM. The chapter's own stylesheets aren't loaded in the iframe, which is fine — mermaid's output is self-styled.
- **Self-contained output**: each SVG embeds a `<style>` block whose rules are scoped to `#<id>`, so multiple diagrams per chapter don't collide, and the diagram renders identically in any reading system with no external CSS dependency. `Styles/mermaid.css` only handles placement (below).
- **ID uniqueness across the book**: ids are per-chapter (`mermaid-1`…); chapters are separate XHTML documents so cross-chapter collisions don't matter. If `idref` ever needs to be folded in, sanitize it — SVG ids must be valid NCNames.
- **XHTML serialization**: with `htmlLabels: false` the output is pure SVG (`<text>`/`<tspan>`), no `<foreignObject>`, no stray HTML voids. The HTML parser puts `innerHTML`-inserted `<svg>` content in the SVG namespace, and the packager serializes to XHTML downstream — same path abc2svg already exercises.
- **Accessibility**: Mermaid's `accTitle`/`accDescr` block keywords emit `<title>`/`<desc>` wired up with `aria-labelledby`/`aria-describedby` and `role`. The sample generator includes them so authors copy the good pattern; nothing extra needed in the transform.

## Assets

**`mermaid.css` → `Styles/mermaid.css`** (small, placement only — the diagram's look lives in its embedded style):

- `.mermaid-container`: block margin rhythm, centered, `max-inline-size: 100%`.
- `.mermaid-container svg`: `inline-size: 100%; block-size: auto;` guard (belt-and-braces alongside `useMaxWidth`).
- `break-inside: avoid` for paged output. Keep the sheet free of `@media` blocks mentioning `print` — the paged preview unwraps those ungated and appends them last (see paged-preview media-query rewrite behavior).

**Fonts — decision: none in the base extension.** abc2svg bundles Bravura because music glyphs don't exist otherwise, and its `loadFont` hook makes external referencing trivial. Mermaid is different in a way that makes bundling actively hard: it *measures* label text with the iframe's DOM/fonts at render time, so a bundled woff2 that only ships in the EPUB would give mismatched metrics (measured with one font, displayed with another → clipped labels). Doing it properly means injecting the same `@font-face` into the transform iframe *and* shipping it — the iframe harness has no hook for that today. The base extension instead sets `fontFamily: 'sans-serif'`: metrics differ only marginally across devices' default sans fonts, and mermaid pads labels. Revisit (as its own phase) only if real books show label clipping on target readers.

**Themes**: no theme CSS files needed — mermaid themes are render-time (`theme` config), baked into each SVG's embedded style. `neutral` default; authors switch per block via frontmatter `config: { theme: forest }` or `%%{init: {"theme":"dark"}}%%`. A book-wide theme choice could later become an extension setting, but base level keeps it per-block.

## Generator (`mermaid-sample.js`)

Modeled on `abc-sample.js`: pure string producer, self-contained, unit-testable in happy-dom.

Options:

- `format` (select): `markdown` (fenced ```` ```mermaid ````) | `textile` (`bc(mermaid).`) — both selectors recognized by the transform.
- `diagram` (select): `flowchart` | `sequence` | `class` | `state` | `pie` | `gantt` — one compact hand-written sample each.
- `theme` (select): `neutral` (default) | `default` | `dark` | `forest` — emitted as YAML frontmatter `config:` when not `neutral`.
- `titled` (boolean, default true): include `accTitle`/`accDescr` lines demonstrating the accessibility keywords.

## Size and packaging note

`mermaid.min.js` is ~2.5–3 MB — by far the largest vendored lib in `extensions/` (abc2svg is 322 KB). It ships in `SEED.zip` (editor side), so the *reading* payload of the EPUB grows only by the rendered SVGs + 1 KB of CSS; but any Active EPUB carrying this extension grows by mermaid's deflated size (~800 KB). Acceptable per-project opt-in cost; worth one line in the extension description or docs so authors aren't surprised.

## Verification checklist

1. ✅ **Offline self-containment (spike-verified 2026-08-03, v11.16.0)**: `dist/mermaid.min.js` contains zero dynamic `import(`s and rendering all eight probed types produced no network requests. Mindmap and architecture-beta render offline too — the cytoscape lazy-loading concern does not apply to the standalone bundle.
2. ✅ Hidden-iframe rendering (spike-verified): in an iframe mirroring the transform engine's exact styling (`visibility:hidden`, `-9999px`, 800×600), all six base types + mindmap + architecture rendered with real text extents (`getBBox` widths 26–174px, not zero) and sensible viewBoxes.
3. Two+ diagrams in one chapter: no id/style bleed between SVGs.
   - **Clipped-viewBox bug found and fixed in-app (2026-08-03)**: with OS Reduce Motion on, editor.css's `prefers-reduced-motion` block (`transition-duration: 0.01ms` on `*`) *created* transitions — `transition-property` defaults to `all`, and SVG `transform` is a transitionable presentation attribute — so mermaid's synchronous `getBBox` measured node groups at identity while edge paths were final, emitting a viewBox that clipped the diagram (reproduced and verified in the harness). Fixed in `src/assets/iframe/editor.css` by disabling animation/transition outright, unconditionally: the transform iframe is invisible scratch space and any geometry-measuring transform needs stable synchronous reads.
4. ✅ Error path (spike-verified): a broken diagram throws, leaves a `#d<id>` orphan in the live document (the transform's cleanup ids are correct), and the next render succeeds. In-app confirmation that the `pre` survives still pending.
5. ✅ XHTML validity (author-verified 2026-08-03): epubcheck reports no problems with the mermaid output in the sample chapter; axe-core likewise clean (only SVG color-contrast "needs review" candidates, dismissed — neutral theme is ~15:1).
6. Previews: device previews and paged preview (no `foreignObject`, `break-inside` honored).
7. `npm run validate` and the catalog build pick the extension up in both dev middleware and `build:extensions`.

## Phasing

1. ✅ **Vendor + spike** (2026-08-03): mermaid v11.16.0 vendored, minimal `extension.json` + transform, checklist items 1–2 verified in a harness mirroring the transform iframe.
2. ✅ **Base extension** (2026-08-03): transform with error handling/cleanup, `mermaid.css` shipped via `assets[]`, verified installed + linked in a live project over the bridge. Surfaced and fixed the app-level reduce-motion/getBBox bug (see checklist item 3).
3. ✅ **Generator + test** (2026-08-03): `mermaid-sample.js` (format/diagram/theme/titled options), 12 unit tests in `src/lib/generators/mermaid-sample.test.ts`, and all 24 option combinations render-verified in the harness — titled variants confirmed to emit SVG `<title>`/`<desc>`.
4. **Deferred, separate decisions**: bundled font (only if clipping shows up), book-wide theme setting, support matrix for exotic diagram types.

## Open decisions

- Mermaid version: plan assumes latest stable v11.x; pin the exact version when vendoring and record it in LICENSE.txt.
- Which diagram types the sample generator offers (proposed six above) — trim or extend to taste.
