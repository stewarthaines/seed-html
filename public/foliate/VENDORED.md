# Vendored: foliate-js renderer (READ.html device preview)

- **Upstream**: https://github.com/johnfactotum/foliate-js (MIT, see `LICENSE`)
- **Source of this copy**: `read-html@acc3aa8` `vendor/foliate-js/` (the same commit the vendored `public/read/READ.html` 0.6.0 was built from), which pins upstream commit `78914ae` (2026-05-01) and carries **eight local patches** documented in that repo's `vendor/foliate-js/VENDORED.md` — including the srcdoc section delivery, the `setStyles`/`expand()` teardown guards, the Loader Blob passthrough, and patch 8, under which a section carrying a `servedURL` is loaded by navigating its frame there. This copy exists so the in-app READ.html device preview renders with exactly the engine the vendored reader uses (`process/READ_DEVICE_PREVIEW.md`); the device preview relies on patch 8 to give a served chapter a real address (`process/PREVIEW_SERVED_BOOK.md`).
- **Renderer subset only**: `view.js`, `paginator.js`, `epubcfi.js`, `progress.js`, `overlayer.js`, `text-walker.js`, `fixed-layout.js`. The container parser (`epub.js` → `vendor/zip.js`) is deliberately not copied: it sits behind a lazy `import()` inside `makeBook`, which never runs when `view.open()` is handed a book object — the preview builds its own one-section book around a blob URL.
- **No local patch on top of the read-html copy.** The `setStyles` teardown guards this copy once carried as a `[SEED patch]` are read-html's patch 7 since 2026-07-30 and arrived with this re-copy.

## What it is here for

The preview pane's **READ.html** device mounts `foliate-view` (imported from this directory over http) inside the preview iframe and renders the current chapter with the reader's own pagination/scroll engine. HTTP-only, like the Paged.js print preview and axe: `file://` can't fetch these modules, so the device is silently absent from the dropdown there.

## Upgrading

Re-copy whenever `public/read/READ.html` is re-vendored, in the same motion:

1. From the read-html checkout at the newly vendored commit: copy `vendor/foliate-js/{view,paginator,epubcfi,progress,overlayer,text-walker,fixed-layout}.js` and `LICENSE` over this directory.
2. Update the commit line above (both the read-html commit and the upstream pin it carries).
3. Verify: the READ.html device renders a chapter in both flows, and switching devices back and forth leaves no console errors (the teardown contract — `window.__seedFoliateClose` — is a local convention layered on top; re-check it against `view.close()` still existing upstream).
