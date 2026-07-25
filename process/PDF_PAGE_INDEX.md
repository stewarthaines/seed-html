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

`.pdf-page-ref` is `display: none` in the book's own stylesheet (so the reflowable EPUB never shows a meaningless number) and is revealed by the PDF pipeline's `print.css`, which the reading system never loads:

```css
/* book stylesheet */
.pdf-page-ref {
  display: none;
}
/* print.css (PDF pipeline only) */
.pdf-page-ref {
  display: inline;
}
```

No `@media` needed — presence of `print.css` is the switch. (The app's `print.css` would carry the reveal rule so any project inherits it; the hide rule lives in the extension's stylesheet.)

## The relative-vs-absolute crux

Per-chapter preview capture yields **relative** page numbers. Because every chapter starts on a fresh page in the combined export, absolute page = front-matter/cover pages + Σ preceding chapters' `pageCount` + relative page. With spine order now on `ctx.spine`, the assembler reconstructs absolute numbers directly **once every chapter has been visited** — a partially-visited book yields a partial index, the accepted incremental behaviour. The cover/front-matter offset is the one extra term (the cover consumes `page 1` while showing no number) and is a Phase-2 detail.

For the numbers to be trustworthy the capture `head.xml` must be **layout-neutral** (script only): the export never injects `head.xml`, so any style/markup it adds would make the captured pagination drift from the printed pagination. This is the single sharpest constraint and belongs in the extension's docs, loudly.

## Phasing

- **Phase 1 — the bridge + a capture that persists.** Ship `window.seed` (bridge doc); thread `idref` into `buildPagedDocument`; emit `paginated`. Deliver the reference extension's `head.xml` capture and confirm correct, stable `SOURCE/data/pagemap/<idref>.json` on visiting the print preview. No index rendered yet — prove the data.
- **Phase 2 — the index.** The reference `transformDOM` assembler + `.pdf-page-ref` rendering, relative first, then absolute once the spine-order question is settled. Ship it as an installable "Print Index" extension (head.xml + transformDOM + CSS bundled).
- **Phase 3 — EPUB 3 page-list.** From the same data, emit `<span epub:type="pagebreak" role="doc-pagebreak">` markers + a `<nav epub:type="page-list">` (greenfield; mirror `outline-generator.ts`), and wire the `printPageNumbers` / `pageNavigation` accessibility-metadata terms the app already offers.

## Decisions & remaining questions

**Decided:**

- **Extend `ctx` with the spine.** The assembler gets reading order + per-chapter `pageCount` from `ctx.spine`, so absolute page numbers fall out directly (no whole-book pass, no ordered-summary file). Exact `ctx.spine` shape (`{ idref, linear }[]`, and whether it also carries hrefs) is a small design detail for the build.
- **App-owned `saveData` path + lifecycle.** The author never names the file — only a validated slot — and the app files it under `SOURCE/data/preview/<idref>/<slot>.json`, so it GCs per chapter on spine rename/delete. See `process/PREVIEW_BRIDGE.md`.

**Still open:**

1. **Slot vs single blob.** Do you want the author to pass a slot at all (allowing several per-chapter writers to coexist), or a single unnamed blob per chapter (`SOURCE/data/preview/<idref>.json`)? I've assumed a slot; it's cheap insurance for the "runs on any/all previews" future, but it is the one thing author code still names.
2. **Reference extension packaging.** Ship the page-index as a catalog extension (installable, coordinated head.xml + transformDOM + CSS), or a documented snippet first? A real extension is the truer demonstration of the model.

## Risks / notes

- **Layout-neutral capture head.xml** — the fidelity constraint above; the biggest footgun.
- **Paged.js rendered DOM** — capture walks the laid-out DOM (page boxes), where content can be split across pages and duplicated into margin boxes (the running-header title already is). The sample walk must dedupe and stay in the page flow, so nobody copies a subtly-wrong version.
- **`data-page-number` dependency** — capture reads Paged.js's `.pagedjs_page[data-page-number]`; a polyfill bump that renames it breaks the walk (there is already a `patches/paged.polyfill.md` note about page-counter quirks).
- **Chattiness** — `paginated` fires on every re-paginate; the bridge should debounce `saveData` per path.
- **Cover/front-matter offset** — absolute numbering must account for the cover consuming `page 1` while showing no number (`print.css` restarts numbering at the first chapter); a Phase-2 detail, noted so it is not forgotten.
