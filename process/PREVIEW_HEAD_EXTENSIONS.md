# Extension-contributed preview head (plan for review)

## Goal

Let an `extension.json` contribute a **preview-head fragment** — authoring-time markup (a `<script>`) injected into the preview, never into the packaged EPUB — so a project's installed extensions can ship preview-time behaviour. This is the missing primitive that lets the PDF page-index (`process/PDF_PAGE_INDEX.md`) package as a **one-click "Print Index" catalog extension**: the capture that today lives in a hand-pasted `SOURCE/preview/head.xml` becomes part of the extension bundle. It generalises the `window.seed` bridge (`process/PREVIEW_BRIDGE.md`) from "author pastes a head.xml" to "any preview-script capability ships as an extension."

Two deliverables: **(1)** the general `previewHead` extension contribution, **(2)** the Print Index reference extension that consumes it.

## Deliverable 1 — the `previewHead` contribution

### Where it plugs in (mapped)

- **Schema — four places, or the field is silently stripped:**
  - `ExtensionCatalogEntry` interface — `src/lib/extensions/extension-catalog.ts:73-105` — add `previewHead?: string` (a filename in the extension dir).
  - `normalizeCatalogEntry` — `extension-catalog.ts:287-310` — preserve it.
  - Build-script catalog emit — `scripts/generate-extensions-manifest.js:165-181` (extract ~:56-98).
  - Dev vite middleware emit — `vite.config.ts:252-269` (extract ~:186-250). (The two builders already carry a "keep in sync" note.)
- **Installer** — `ExtensionManager.importCatalogExtension` (`extension-manager.ts:134-224`): add the `previewHead` file to the fetched-files set (~:142-150) so it lands at `SOURCE/extensions/<id>/<file>`. It is **not** an OEBPS asset — authoring-only, never packaged.
- **Gather** — `SpineView.loadPreviewHead()` (`SpineView.svelte:158-166`): enumerate installed extensions (`ExtensionManager.listWorkspaceExtensions` / the `SOURCE/extensions/<id>/` dirs — active == present), read each copied `extension.json` for `previewHead`, read the fragment from `SOURCE/extensions/<id>/<file>`, and produce a combined extension-head string.
- **Inject** — the fragment string rides the existing prop path (`previewHead` → `App.spinePreviewData.previewHead` → `PreviewPane`), spliced at the one seam `withPreviewHead()` (`PreviewPane.svelte:1400-1404`) and the PDF `headExtra` (:1520). See the gating decision below for whether extension fragments join the author's gated `previewHead` or a separate always-injected string.

### The load-bearing constraint

`window.seed` is injected **only into the paged preview today** (Phase 1 wired the bridge into `buildPagedDocument`; the "rendered on all previews" step is still future). A capture fragment that does `seed.hooks.paginated = …` at load would throw in the responsive/read previews where `seed` is undefined. That's exactly why the current per-type `includeHead` (author sets `pdf: true`, others off) is load-bearing. So an extension fragment injected across previews **must guard** (`if (window.seed) { … }`), and the reference fragment will. (A cleaner long-term fix is generalising `window.seed` to all previews — noted, not required here.)

## Design decisions (resolved)

1. **Gating / one-click → A1 (always-on when installed).** Extension fragments inject into every preview independent of the author's `includeHead` toggle; the reference fragment guards on `window.seed`, so it only _acts_ on the paged preview. Install Print Index and capture is live — no settings toggle. Implementation: a second head string, gathered from installed extensions, threaded alongside the author's gated `previewHead` and always spliced in. (Rejected A2 = fold into the gated head + flip `includeHead.pdf` on install — couples install to settings.)
2. **Field shape → `previewHead: "<file>"` (a plain filename string).** Per-preview-type targeting (`{ file, previews }`) is deferred; all-previews + a self-guarding fragment covers the need now.
3. **Trust.** Extension _transforms_ run sandboxed (broker). A `previewHead` fragment runs **unsandboxed** in the preview realm with the bridge's `SOURCE/data/`-scoped write — wider than transform trust. Shipping it for the **app-curated catalog** (Print Index is ours); a third-party-extension story would want a consent/review gate, noted for later.

## Deliverable 2 — the Print Index reference extension

A new `extensions/print-index/` bundling all three coordinated pieces:

```jsonc
// extension.json
{
  "id": "print-index",
  "name": "Print Index",
  "category": "typesetting",
  "description": "Page numbers in a PDF contents/index, captured from the print preview.",
  "licenseName": "MIT",
  "previewHead": "capture.head.xml", // NEW — the guarded seed.hooks.paginated capture
  "domTransforms": ["buildPageIndex.js"], // the dual-mode generate + decorate assembler
  "assets": [{ "file": "page-index.css", "target": "Styles/page-index.css", "media": "text/css" }],
}
```

- `capture.head.xml` — the guarded capture (`if (window.seed) seed.hooks.paginated = …`) writing `seed.saveData('pagemap', …)`.
- `buildPageIndex.js` — the reference transform already proven on the bulletin (generate into `#page-index`, decorate links in `#data-page-refs`), using `ctx.spine` for absolute pages.
- `page-index.css` — `.pdf-page-ref` hidden by default, shown under `@media print`.

Installing it (one click) drops the transform + CSS + capture fragment; the author enables the transform (already the install flow appends to `dom_transforms`) and adds an index chapter with a placeholder. No pasting.

## Build order

1. Schema field (×4) + installer fetch — the fragment travels and installs.
2. Gather + inject in `SpineView`/`PreviewPane` per the chosen gating model.
3. The `print-index` extension bundle + wire into the catalog (drop in `extensions/`, the builders pick it up).
4. Verify end-to-end via the bridge on a real project: install, capture, index renders, print-only numbers.
