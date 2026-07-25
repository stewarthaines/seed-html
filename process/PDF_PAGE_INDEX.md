# PDF page index — a reference extension (plan for review)

## Goal

Let a project capture the printed page number of chosen navigation elements (headings) per chapter, persist it, and turn the collected data into an index with real page numbers in the PDF output. The page numbers show only in PDF, never in the reflowable EPUB. Later, the same data can feed EPUB 3's own print-page markers (`page-list` nav + `doc-pagebreak`) so a reading system can show/navigate print pages.

**This is built as an author-owned extension, not app logic.** The app contributes one general primitive — the `window.seed` preview bridge (`process/PREVIEW_BRIDGE.md`) — and the whole page-index feature is a coordinated bundle of the existing scripting hooks: a `head.xml` capture script, a `transformDOM` assembler, and a print-only stylesheet. That is the extensibility model SEED already rewards; the app stays out of the "what a page index is" business.

Guiding constraint from the brief: capture is incremental and per-chapter — **visiting a chapter's PDF preview updates that chapter's data** — with no whole-book collection pass in the first cut.

## What the app provides (small, and general)

Two general primitives — neither page-index-specific:

- **The preview bridge** (`process/PREVIEW_BRIDGE.md`): `window.seed.saveData(slot, text)` persists per-chapter data under an **app-owned path** `SOURCE/data/preview/<idref>/<slot>.json` (the author names only the slot; the app owns the idref/path and GCs it on spine rename/delete), plus `window.seed.hooks.paginated({ idref, document })`, fired from the Paged.js `after` hook with the live paginated document.
- **Spine order on `ctx`.** DOM-transform `ctx` gains the spine (ordered `idref` list + `linear` flags) so the assembler can walk chapters in reading order and compute offsets. Today `ctx` carries `manifest`/`idref`/`basePath`/`language` only; this adds `ctx.spine` (shape TBD — a list of `{ idref, linear }`), served through the same broker context the engine already builds.

The only page-index-driven change to app code is threading the `idref` into `buildPagedDocument` so the `paginated` emit can name the chapter. Everything else is the extension.

## The extension — three coordinated parts

### 1. Capture — `head.xml`

The project's `preview/head.xml` (script-only) registers the hook:

```js
seed.hooks.paginated = ({ idref, document }) => {
  const levels = 'h1,h2'; // the project's chosen granularity
  const seen = new Set();
  const entries = [];
  for (const el of document.querySelectorAll(levels)) {
    const page = Number(el.closest('.pagedjs_page')?.dataset.pageNumber);
    if (!page || seen.has(el)) continue; // skip margin-box duplicates
    seen.add(el);
    entries.push({ id: el.id || null, text: el.textContent.trim(), level: +el.tagName[1], page });
  }
  const pageCount = document.querySelectorAll('.pagedjs_page').length;
  seed.saveData('pagemap', JSON.stringify({ pageCount, entries }));
};
```

The **granularity, schema, id policy, and dedupe are all the extension's choices**, not the app's. The author passes only the slot `'pagemap'`; the app files it at `SOURCE/data/preview/<idref>/pagemap.json` for the chapter being previewed. `page` is chapter-relative (the per-chapter preview starts at page 1); `pageCount` is stored so the assembler can compute offsets.

### 2. Assemble — `transformDOM`

The index-chapter transform reads the per-chapter maps and emits the list. Transforms are sandboxed but `ctx.readSourceText` reaches anything under `SOURCE/` (confirmed):

```js
async function transformDOM(doc, idref, ctx) {
  let offset = 0; // pages before the current chapter
  for (const s of ctx.spine.filter(s => s.linear !== false)) {
    const map = JSON.parse(await ctx.readSourceText(`data/preview/${s.idref}/pagemap.json`));
    // map.entries[].page + offset → absolute page; emit <li>…<span class="pdf-page-ref">N</span>
    offset += map.pageCount;
  }
}
```

Each entry's page number is wrapped in `.pdf-page-ref`. With `ctx.spine` giving reading order and each chapter's stored `pageCount`, the assembler sums preceding page counts into an offset and turns chapter-relative pages into absolute book pages directly. A chapter not yet visited has no `pagemap.json` (a partial index) — the assembler skips or flags it.

### 3. Style — print-only CSS

Both rules live in the **extension's own stylesheet** — the app is not involved. `.pdf-page-ref` is hidden by default and revealed under `@media print`:

```css
.pdf-page-ref {
  display: none;
} /* hidden while reading the EPUB */
@media print {
  .pdf-page-ref {
    display: inline;
  }
} /* shown in the PDF */
```

A reading system reads on screen, so the numbers stay hidden; the PDF export prints, so they show. The in-app **Print** preview shows them too because Paged.js unwraps `@media print` blocks (see the `paged-preview-rewrites-media-queries` behaviour). This keeps the app entirely out of the page-index business — no change to the app's `print.css`.

## The relative-vs-absolute crux

Per-chapter preview capture yields **relative** page numbers. Because every chapter starts on a fresh page in the combined export, absolute page = front-matter/cover pages + Σ preceding chapters' `pageCount` + relative page. With spine order now on `ctx.spine`, the assembler reconstructs absolute numbers directly **once every chapter has been visited** — a partially-visited book yields a partial index, the accepted incremental behaviour. The cover/front-matter offset is the one extra term (the cover consumes `page 1` while showing no number) and is a Phase-2 detail.

For the numbers to be trustworthy the capture `head.xml` must be **layout-neutral** (script only): the export never injects `head.xml`, so any style/markup it adds would make the captured pagination drift from the printed pagination. This is the single sharpest constraint and belongs in the extension's docs, loudly.

## Phasing

- **Phase 1 — the bridge + a capture that persists. DONE.** `window.seed` bridge; `idref` threaded into `buildPagedDocument`; `paginated` emitted; the reference `head.xml` writes `SOURCE/data/preview/<idref>/pagemap.json`, verified live (correct per-page heading capture; nothing written when include-head is off).
- **Phase 2 — the index. DONE (bar packaging).** The reference `transformDOM` assembler reads the maps, uses `ctx.spine` + `pageCount` for absolute pages, and emits `.pdf-page-ref` numbers shown only under `@media print`. Verified live end to end. Zero app code — it is pure author content. Remaining: whether to package it as an installable extension (open question below).
- **Phase 3 — EPUB 3 page-list.** From the same data, emit `<span epub:type="pagebreak" role="doc-pagebreak">` markers + a `<nav epub:type="page-list">` (greenfield; mirror `outline-generator.ts`), and wire the `printPageNumbers` / `pageNavigation` accessibility-metadata terms the app already offers.

## Decisions & remaining questions

**Decided:**

- **Extend `ctx` with the spine.** The assembler gets reading order + per-chapter `pageCount` from `ctx.spine`, so absolute page numbers fall out directly (no whole-book pass, no ordered-summary file). Exact `ctx.spine` shape (`{ idref, linear }[]`, and whether it also carries hrefs) is a small design detail for the build.
- **App-owned `saveData` path + lifecycle.** The author never names the file — only a validated slot — and the app files it under `SOURCE/data/preview/<idref>/<slot>.json`, so it GCs per chapter on spine rename/delete. See `process/PREVIEW_BRIDGE.md`.

- **Slot, not a single blob (decided).** `saveData(slot, text)` keeps the author naming only the kind of data, so several per-chapter writers can coexist and the app owns the path.

**Still open:**

1. **Reference extension packaging.** Ship the page-index as a catalog extension (installable, coordinated head.xml + transformDOM + CSS), or a documented snippet first? A real extension is the truer demonstration of the model.
2. **Spine-change GC (app-side, not yet built).** The path scheme is app-owned so cleanup _can_ be app-managed, but the `deleteSourceFile`/rename-on-spine-change wiring isn't implemented yet — stale `SOURCE/data/preview/<idref>/` survives a chapter delete for now. Follow-up.

## Author gotchas

Real traps hit while building the reference — worth stating for anyone (person or agent) who assumes they know the transform ropes:

- **The `ctx` file methods are async.** `ctx.readSourceText`/`writeSourceText` return Promises — the assembler **must be `async` and `await`** them. Most transform scripts are synchronous DOM manipulation, so this is easy to forget; a missing `await` yields a `Promise`, not the text.
- **The page numbers are hidden everywhere except print — by design.** `.pdf-page-ref` is `display: none` outside `@media print`, so in the Responsive / normal preview the index looks numberless (and blank if you were watching the numbers). That is correct: check the **Print** preview or the exported PDF. Switching from Source back to Responsive and seeing no numbers is the classic false alarm.
- **The placeholder must be a real element in the _rendered_ XHTML.** The assembler fills whatever `querySelector('#page-index, [data-page-index]')` finds; if the source syntax doesn't emit that element, nothing happens (silently). In djot this bites twice: inline raw `` `…`{=html} `` is for spans, not a block `<div>` — use a raw HTML _block_ (` ``` =html `) or a native fenced div; and because output is XHTML, attributes need quoted values (`data-page-index=""`, not a bare `data-page-index=`). Verify by opening the index chapter's **Source** view and confirming the element is actually there before blaming the assembler.

## Risks / notes

- **Layout-neutral capture head.xml** — the fidelity constraint above; the biggest footgun.
- **Paged.js rendered DOM** — capture walks the laid-out DOM (page boxes), where content can be split across pages and duplicated into margin boxes (the running-header title already is). The sample walk must dedupe and stay in the page flow, so nobody copies a subtly-wrong version.
- **`data-page-number` dependency** — capture reads Paged.js's `.pagedjs_page[data-page-number]`; a polyfill bump that renames it breaks the walk (there is already a `patches/paged.polyfill.md` note about page-counter quirks).
- **Chattiness** — `paginated` fires on every re-paginate; the bridge should debounce `saveData` per path.
- **Cover/front-matter offset** — absolute numbering must account for the cover consuming `page 1` while showing no number (`print.css` restarts numbering at the first chapter); a Phase-2 detail, noted so it is not forgotten.
