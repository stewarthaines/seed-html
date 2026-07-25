# `window.seed` — the preview bridge (design note)

A small, general capability that lets a project's `preview/head.xml` script — which already runs inside the preview iframe — do two things it currently cannot: **persist data** to the project's scratch area, and **react to preview lifecycle events**. It is the authoring-time counterpart to the build-time transform sandbox: `head.xml` **writes** `SOURCE/data/` while a preview is open; `transformDOM` **reads** it when the index page is built. Both are author-owned, both scoped identically.

The first consumer is the PDF page-index extension (`process/PDF_PAGE_INDEX.md`), but the bridge is deliberately generic — nothing about it knows what a project stores or why.

## The contract

Injected into every preview iframe's `<head>`, **before** the project's `head.xml` fragment, so the script can register hooks and call `saveData` as soon as it runs:

```js
window.seed = {
  // Persist text for the CURRENT chapter under a named slot. The author does NOT
  // name the file — only the slot (the kind of data). The app builds the path
  // from the idref it is rendering, so it owns naming and can GC on rename/delete.
  saveData(slot, text) {
    parent.postMessage({ type: 'seed-save-data', slot, text }, '*');
  },
  // Lifecycle handlers the head.xml script assigns; the app calls them.
  hooks: {},
};
```

A `head.xml` script uses it like:

```js
seed.hooks.paginated = ({ idref, document }) => {
  const entries = [...document.querySelectorAll('h1,h2')].map(h => ({
    text: h.textContent.trim(),
    page: Number(h.closest('.pagedjs_page')?.dataset.pageNumber),
  }));
  seed.saveData('pagemap', JSON.stringify({ pageCount: /* … */ 0, entries }));
};
```

The author passes `'pagemap'` (a slot), never a path. The app writes it to `SOURCE/data/preview/<idref>/pagemap.json`, where `<idref>` is the chapter the preview is rendering.

## How it works

**Write path (app-owned).** `saveData` posts `{ type: 'seed-save-data', slot, text }`. `PreviewPane` (which already filters preview-iframe messages by `event.source`) validates the `slot` as a single safe path segment (`^[a-z0-9_-]+$` — no slashes, no traversal), then builds the path itself: `SOURCE/data/preview/<idref>/<slot>.json`, where `<idref>` is `PreviewPane`'s own current chapter, **not** anything the iframe supplied. It writes via `workspaceService.writeFile`, still passing through the transform broker's `resolveSourceWritePath` as a second belt (the app-built path is already inside `SOURCE/data/`). So the trust boundary is unchanged — the same `SOURCE/data/` write scope transforms have — and because the app authored every path segment, it can enumerate and rewrite them by idref.

**Lifecycle (app-managed).** Grouping by idref (`.../preview/<idref>/…`) makes per-chapter GC a single directory operation. The app already owns spine mutations (`SpineSidebar`/`SpineView`), so on a chapter **delete** it removes `SOURCE/data/preview/<idref>/` and on **rename** (idref change) it moves the directory to the new idref. The author never has to think about stale files, and never could clean them up anyway (they don't know the paths). The naming scheme is a documented contract so the build-time reader can reconstruct a path from `(idref, slot)`.

**Hooks.** `hooks` is a plain bag, not a fixed function set, so a new lifecycle event is only ever "the app calls one more named hook" — never a new global. Each hook fires from wherever that event actually happens:

- **`paginated`** — from the Paged.js `after` hook, which runs _inside_ the print-preview iframe, so it hands the handler the live paginated `document` (with `.pagedjs_page[data-page-number]` in place) plus the `idref`. This is what the page-index extension uses.
- **`rendered`** (future, "runs on any preview") — the built-in and foliate previews are just written documents with no in-iframe script to fire an event, so the app emits this one from the **host side** after render completes: `previewIframe.contentWindow.seed?.hooks?.rendered?.({ idref, previewType })` in `handleIframeLoad`. Same uniform contract for the author; different plumbing underneath.

## Scope of the first cut

Ship `saveData` + the `paginated` hook (all the page-index needs), wired into the **paged** preview. The namespace, the message handler, and the host-side emission pattern are laid down so the rest is additive:

- **`rendered` on all previews** — emit from `handleIframeLoad` for the built-in preview; for the foliate reader the `head.xml` rides inside the nested _section_ document, so its `seed` lives one realm deeper (the section iframe), and the emit has to target that document — the notable wrinkle when generalising there.
- **`readData(path)`** — the symmetric async reader, scoped to `SOURCE/` like the broker's `readSourceText`. Trivial to add; deferred until a use case wants it.

## Problems / notes

- **Verify `head.xml` scripts execute in the preview iframe.** The whole bridge rests on this. The preview document is delivered via `document.write`, which does run inline `<script>` — but confirm nothing strips scripts from the injected fragment first.
- **Chattiness + size.** A hook that fires on every re-render (e.g. `paginated` on each edit) means `saveData` fires often. Debounce per-path in the handler and cap payload size — a scoped write endpoint invites a runaway loop otherwise.
- **Coupled to the include-head setting.** The bridge only reaches a project script when that preview type's head injection is on _and_ the project ships a `head.xml`. That is the intended opt-in, but "enable X capture" really means "enable head injection + install the extension," which should read clearly wherever it is surfaced.
- **Deliberate widening of preview-content power.** `head.xml` already runs same-origin in the preview; this hands it a `SOURCE/data/`-scoped writer. Given projects are author-trusted and the scope matches transforms, that is acceptable — but it is a conscious line, not a silent one.
- **The slot is the author's only name.** Author code names the _kind_ of data (a validated slot key), never the file, directory, or idref — those are the app's, which is what makes lifecycle management possible. One writer per `(idref, slot)`; a second head.xml script wanting per-chapter data of its own picks a different slot rather than colliding. If a "single unnamed blob per chapter" is preferred over slots, that is the one dial to turn here.
