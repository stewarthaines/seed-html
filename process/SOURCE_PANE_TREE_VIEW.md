# Source Pane Tree View — vendored Chromium XML tree viewer

Status: IMPLEMENTED (2026-07-29). Verified in the dev server (Chrome): raw view shows on-disk XHTML (no blob URLs), tree renders/folds, both themes correct. Outstanding: Firefox/Safari spot check, file: build check, Storybook story decision.

## Context

The spine item preview's source view (`PreviewPane.svelte`, `.source-code` block around line 3001) is a raw `<pre>` dump of `xhtmlContent` — the post-transform, blob-URL-rewritten preview string. Two problems: it has no structure (no highlighting, no folding), and it shows `blob:` URLs and an `XMLSerializer` round-trip rather than what is actually in the EPUB, which is misleading as a reference.

This plan makes two changes: (1) the source view renders the actual on-disk XHTML (the file written to the workspace during render), and (2) it grows a small options bar with a raw/tree toggle, where the tree is a devtools-style collapsible view powered by a vendored copy of Chromium's XML tree viewer.

The browser's built-in XML viewer was investigated first (2026-07-29, verified empirically in Chromium — see memory note `chrome-xml-viewer-constraints`). It is ruled out for in-pane use: it only activates on top-level navigations and never for XHTML-namespace documents. But the viewer itself is just a small BSD-licensed script pair that Blink injects, so we vendor it and invoke it against our own container.

Delivery model decision: the tree is not a core feature and must not grow the single-file build. It follows the axe-core pattern — vendored under `public/`, fetched on demand at runtime, gated on `isHttpContext()`. Under `file:` the toggle is absent and the raw view (which remains in all cases) is the source view.

## Part A — plumbing: source view shows the on-disk XHTML

Verified facts (traced 2026-07-29):

- `spine-preview-manager.ts` `doRender()` (lines 293–400): line 363 builds the on-disk string (`generateXHTMLDocument(...)`); lines 371–377 write it via `saveXHTMLToManifest` → `workspaceService.writeFile(workspaceId, spineItemPath, xhtml)`; line 380 derives the blob-rewritten preview copy; lines 387–392 emit `onPreviewUpdate` with only the rewritten string. So the write happens before the event, and the on-disk string is in scope at the emit site — no re-read, no race.
- The imported-EPUB read-only path (`SpineView.svelte` `renderReadOnlyChapter()`, lines 1240–1284) reads `stored = await fileStorage.readTextFile(workspace.id, path)` at 1263 and blob-rewrites it at 1269 — `stored` is likewise the on-disk content.
- Caveat: the write is skipped when `persistToManifest` is false or `suppressPersist` is true (lines 106, 371) — in that case the disk file is stale relative to the preview and the event must not pretend otherwise.

Changes (thread one new optional field along the path every other preview value already travels; PreviewPane deliberately has no workspace/storage access and this keeps it that way):

1. `src/lib/types/spine-editor.ts:99` — add `persistedXhtml?: string` to `PreviewUpdateEvent`. Named to mean "what was written to disk this render"; set only when `saveXHTMLToManifest` actually ran, absent when the write was skipped. (Avoid "source" in the name — in this project source means the plain-text `SOURCE/` inputs.)
2. `spine-preview-manager.ts:387` — include `persistedXhtml: xhtml` in the emitted event when Step 4 persisted, omit otherwise.
3. `SpineView.svelte:84–96` — add the field to the `onPreviewUpdate` detail type; forward it at 1145 (live path), as absent at 1163 (error path), and as `persistedXhtml: stored` at ~1271 (read-only imported path, where it is genuinely the disk content).
4. `App.svelte` — widen `spinePreviewData` (state at 234–252, handler `handleSpinePreviewUpdate` at 337–359) and pass the new prop to PreviewPane alongside `xhtmlContent` (~line 1803).
5. `PreviewPane.svelte` — new `persistedXhtml` prop; the source view (both raw and tree renderings) consumes it instead of `xhtmlContent`. Everything else (`live preview effect ~1182, paged path ~1529, size readout ~3016, a11y gating`) keeps using `xhtmlContent` — do not repoint it.
6. When `persistedXhtml` is absent, the source view shows a short static placeholder in the same style as the existing hardcoded `<!-- No content generated yet -->` (e.g. `<!-- not written to disk -->`) rather than silently showing stale or preview content. No invented fallback reads.

Side benefit: the raw view becomes byte-faithful to the file (today it shows a serializer round-trip), so it now legitimately answers "what is in my EPUB".

## Part B — vendored tree viewer

### Vendored source

- Upstream: `third_party/blink/renderer/core/xml/DocumentXMLTreeViewer.js` (365 lines, ~10 KB) and `DocumentXMLTreeViewer.css` (69 lines, ~1.3 KB) from `chromium.googlesource.com/chromium/src`, fetched 2026-07-29 from `main`. Copies are in the session scratchpad; re-fetch at implementation time and record the revision in the provenance header.
- License: BSD-style (Chromium). Compatible with our MIT distribution; requires attribution (see ThirdPartyView step).

### 1. `public/xml-tree-viewer/xml-tree-viewer.js` — adapted vendor copy

Keep a provenance header: upstream URL, revision/date fetched, Chromium BSD notice, summary of local modifications.

Adaptations (keep the diff against upstream as small as practical):

- Delete the document-takeover glue: `prepareWebKitXMLViewer`, `sourceXMLLoaded`, the `window.onload` hookup, the `webkit-xml-viewer-source-xml` stash div, and the header banner ("This XML file does not appear to have any style information…").
- Convert to an ES module exporting `render(xmlDoc, container)`: clears the container, builds the `.pretty-print` tree from `xmlDoc.documentElement` using the existing `processNode`/`processElement`/`processComment`/`processCDATA`/`processText` walker, then wires folding by scoping `initButtons` to the container instead of the document.
- Module-scope the file-level `var tree` / `var headerSpan` globals; drop `headerSpan` with the banner.
- The walker's `createHTMLElement` already uses `createElementNS` with the XHTML namespace, so nodes are created correctly in the app document. No other DOM API changes expected.
- No xmlns stripping is needed (that constraint only applied to the browser's own activation check) — the tree shows the chapter with full fidelity including namespace declarations.

### 2. `public/xml-tree-viewer/xml-tree-viewer.css` — adapted stylesheet

- Scope every rule under a `.xml-tree-view` root class so it cannot leak into the rest of the app.
- Drop the banner/header rules and the `prefers-color-scheme` blocks.
- Replace hardcoded colors and fonts with design tokens (`var(--font-mono)`, `var(--text-xs)`, text/background tokens). For the syntax colors (tag / attribute name / attribute value / comment), match the palette the OPF highlighter styles use in `OPFPreview.svelte` so the two source views read as one system. Note the memory rule: `--color-primary*` tokens are undefined — use real tokens.

### 3. `src/lib/xml-tree/tree-viewer-loader.ts` — on-demand loader

- Availability: reuse `isHttpContext()` from `src/lib/reader/open-in-reader.ts` (do not hand-roll another protocol check).
- Load: `import(/* @vite-ignore */ new URL('xml-tree-viewer/xml-tree-viewer.js', document.baseURI).href)`, cached in a module-level promise. The `@vite-ignore` is required so Vite leaves the runtime-resolved URL alone (same reason the VSR loader constructs URLs at runtime).
- CSS: append a `<link rel="stylesheet">` to the app document head once, pointing at `xml-tree-viewer/xml-tree-viewer.css` resolved the same way.
- On load or render failure, surface the error to the caller for display. Do not invent fallback content (project rule); the raw view is always available as the user's alternative.

### 4. `PreviewPane.svelte` — source view options bar with raw/tree toggle

- The view dropdown is unchanged — `source` stays a single entry. The raw/tree control is a two-option select ("Raw" / "Tree") in the shared preview options bar (`.preview-options`, `process/PREVIEW_OPTIONS_BAR.md`) — Source is that pattern's second adopter, so the control sits above the checks panels like the reader and orientation inputs do. (Originally built as an in-pane bar; moved same day for consistency.)
- The tree half of the toggle exists only when `isHttpContext()`; under `file:` the options bar collapses to nothing and the view is the raw `<pre>` as today.
- Toggle state is plain `$state` (session-local; not persisted — add the `seedhtml_`-key pattern later only if it proves annoying).
- Tree rendering: an `$effect` runs while the tree is the active rendering and `persistedXhtml` changes — parse with `new DOMParser().parseFromString(persistedXhtml, 'text/xml')`; on a `parsererror` document, show the parser's error text in the pane (accurate information, not a fallback); otherwise call the loader's `render(doc, container)` into a `.xml-tree-view` container div. Don't rebuild while the source view is hidden.
- While in the file, the three hand-rolled protocol checks (`canCheckA11y` ~157, `canPaginate` ~164, `canReadPreview` ~177) duplicate the already-imported `isHttpContext()` — switch them to the helper as a small tidy-up.

### 5. `ThirdPartyView.svelte` — attribution

Add a `HTTP_LIBRARIES` entry: Chromium `DocumentXMLTreeViewer` (BSD), "Loaded only when the editor runs online", linking upstream.

### 6. i18n

Two new user-visible strings for the toggle ("Raw" / "Tree") via the extract → `.po` workflow (never edit the `.json` artifacts); provide the German translations. The absent-file placeholder stays a comment-style literal like the existing `<!-- No content generated yet -->` (matching current untranslated precedent in that block).

## Verification

- `npm run validate` clean; no new lint warnings (ratchet).
- Dev server (user runs it): spine item → source view → toggle raw/tree. Check: raw view now shows real relative asset paths (no `blob:` URLs); tree renders, folds/unfolds; attributes and comments colored; light + dark themes; German locale labels; editing the plain-text source re-renders both views with the freshly written file.
- Imported-EPUB read-only chapters: source view shows the stored file (both renderings).
- Stale-disk case: a spine item whose render skips persistence (missing `SOURCE/text/{id}.txt`) shows the placeholder, not the preview string.
- Cross-browser: Chrome and Firefox at minimum; Safari spot check (the render path is our code now — nothing depends on the built-in viewer).
- Single-file build: build and open the standalone `index.html` under `file:` — no toggle, raw source view intact and showing on-disk content.
- Storybook (per STORYBOOK.md patterns): a story for the tree view against a fixture chapter is possible since Storybook serves `public/`; decide during implementation whether to add it or rely on the manual protocol. Unit tests are intentionally out of scope for the vendored file (runtime asset like `axe.min.js`; happy-dom can't parse namespaced XHTML anyway). The `PreviewUpdateEvent` threading is plain data flow covered by existing spine tests if any touch the event shape.
