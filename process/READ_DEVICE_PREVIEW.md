# READ.html device preview — foliate-js in the chapter preview (evaluation plan)

Evaluate embedding the foliate-js renderer — the engine inside the vendored READ.html — as a new device preview, so the author sees the current chapter the way READ.html will actually render it: real pagination or continuous scroll, with the reader's column logic. Placement: a new dropdown group between **Responsive** and the device screens (Commute/Home/Travel). Conclusion up front on the feasibility question: **yes, the API surface supports this.** foliate-js's `view.open()` accepts any object implementing its book interface, not just an EPUB file — a one-section book whose `load()` returns a blob URL of the transformed chapter is a documented, supported shape. The open questions are about integration fit and feel, not possibility.

## What the author gets

- A **READ.html** entry in the device dropdown, after Responsive, before Commute. One entry, not per-mode entries.
- Two small controls in the preview toolbar, visible only for this device (mirroring READ.html's own settings):
  - **Flow**: Scroll / Pages — maps directly to the paginator's `flow` attribute (`scrolled` / `paginated`).
  - **Columns**: Single / Auto — maps to `max-column-count` (1 / 2, where "auto" lets width decide).
- Both persisted per the navigationStore pattern (`seedhtml_preview_read_flow`, `seedhtml_preview_read_columns`).
- **Gating**: like the Print preview and axe — the renderer is fetched from the app origin, so the option is HTTP-only and silently absent from the dropdown on `file:` (same `isHttpContext()` / protocol check, no explanatory UI).

## Why the API supports it (verified against upstream)

foliate-js (MIT, johnfactotum/foliate-js) is dependency-free native ES modules with no build step. The renderer stack is `view.js` (the `foliate-view` custom element) over `paginator.js` (reflowable renderer). Key facts, confirmed from the upstream README:

- `view.open(book)` takes a book **object**; the renderer requires only a small subset of the interface. Minimum viable for one chapter: `sections: [{ load: () => blobUrl, size, id }]`, `dir`, `metadata`, `toc: []`, and stub `resolveHref` / `isExternal`. No container parsing, no zip, no OPF — those modules never load.
- The paginator element takes `flow` (`paginated`/`scrolled`), `max-column-count`, `gap`, `margin`, `max-inline-size`/`max-block-size` as attributes — exactly the two settings we want to expose, plus sane fixed defaults for the rest.
- Sections are delivered as URLs; our existing blob-URL machinery (chapter XHTML with stylesheet/image hrefs already blob-resolved) produces exactly that. READ.html itself feeds foliate via srcdoc/blob section delivery (see `public/read/VENDORED.md`), so this delivery shape is proven in the sibling repo.
- Reader-injected styling goes through `renderer.setStyles?.(css)` — the hook READ.html uses for theme/font; available to us if we map the existing theme simulation onto this device (deferred question below).

What the README does **not** answer (spike items): whether `view.js` tolerates the stubbed book interface without patches, how the paginator behaves when mounted inside our same-origin preview iframe (it creates its own nested sandboxed iframes), and Safari 16 behavior of the column layout at our floor.

## Sourcing the renderer — the main decision to make

Two ways to get foliate-js into `public/`:

**Option A — vendor upstream modules directly.** Copy the needed subset of foliate-js ES modules (`view.js`, `paginator.js` and their internal imports — no zip.js/fflate/PDF.js, which only back the container parsers we don't use) into `public/foliate/` with a `VENDORED.md` (upstream commit, license, update procedure). Standard vendored-asset pattern (axe, paged.polyfill). Simple, but its version can drift from the one READ.html builds against — the preview could stop matching the reader it claims to predict.

**Option B — a renderer-only bundle built by the read-html repo.** Add a second build target in read-html (e.g. `dist-single/foliate-view.js`): just the renderer stack, minified, same commit and same local patches as READ.html itself. Vendor that one file here next to `public/read/READ.html`, upgraded in the same motion (the `VENDORED.md` upgrade checklist grows one line). This guarantees the "feels like READ.html" property by construction and matches the existing cross-repo contract style (payload slot, `?book=`). Cost: a new build target to maintain in read-html.

**Recommendation: Option B.** The entire point of this device is fidelity to READ.html; version-locking the renderer to the vendored reader is the only arrangement where that fidelity is structural rather than aspirational. Option A is the fallback if the read-html build target proves awkward — in that case pin `public/foliate/VENDORED.md` to the same upstream commit read-html uses and add a checklist line to keep them in step.

## Integration sketch

Follows the Print preview shape (`writePagedDoc`) rather than the plain-render shape:

1. New `DEVICE_PRESETS` entry `{ id: 'read', category: 'read' }` with category label **READ.html** (i18n), ordered after `responsive`. `previewTypeForDevice` gains a `'read'` type; it's a fill device (`isFillDevice`), no scaled bezel.
2. On render, build a wrapper document and write it into the existing preview iframe (`document.open/write/close`, as print does): a module script that imports the renderer from the app origin, constructs the one-section book around a blob URL of the chapter (blob-resolved assets, preview head injected per the existing `includeHead` plumbing), mounts `foliate-view`, sets `flow`/`max-column-count` from the toolbar settings, and posts a done message to the parent (print's `PAGED_DONE` pattern) for the spinner and safety timeout.
3. **Realm gotchas apply in full** (see memory: `document.open()` wipes Window listeners — the parent polls a global or listens for postMessage on itself, never on the iframe window; no `instanceof` across realms).
4. Flow/columns changes set attributes on the live element via the iframe's document — no re-render needed (foliate reflows on attribute change); chapter edits go through the existing stale/refresh/auto-update machinery unchanged.
5. Blob lifetime: the section blob URL lives until the next render of this device or a device switch; revoke on replacement (same discipline as the existing preview blobs).

### Feature interactions — proposed v1 scope

| Existing feature                                   | v1 proposal                                                                                                                                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reader theme + font-size controls                  | **Hide for this device** initially; wiring them through `renderer.setStyles()` is the natural phase 2 and also how READ.html does it, so fidelity survives              |
| Click-to-source deixis, Announce (SR preview), axe | **Hidden for this device** — they walk the preview iframe's DOM directly, and foliate nests its own sandboxed iframes; teaching them to reach inside is its own project |
| Scroll/page position across re-renders             | Not in v1; the print preview's page-index pattern is the template if the feel demands it                                                                                |
| Fixed-layout chapters                              | Excluded — the device falls back to the plain render (foliate has a separate `fixed-layout.js` renderer; out of scope)                                                  |
| Print settings, PDF export                         | Untouched — different target, unchanged                                                                                                                                 |

## Evaluation phases

**Phase 0 — desk check (half a day).** Read read-html's foliate integration: which modules it imports, what local patches exist, how it constructs sections, what its renderer bundle would weigh. Read `view.js` upstream to list the _actual_ minimum book interface (the README's list, verified against code). Decide Option A vs B with real numbers. Kill criterion: if the renderer can't run without the container-parsing modules, the weight/complexity story changes and we reassess. **Done 2026-07-24 — see "Phase 0 findings" below; no kill criterion hit.**

**Phase 1 — harness spike (a day).** A dev-only harness (scratch page served by dev middleware, like the agent-bridge module — zero production bytes) that mounts `foliate-view` with a hand-built one-section book from a real transformed chapter. Checkpoints: scroll and paged flows both render; column toggle works; internal chapter links and images resolve via blob URLs; behavior inside a `document.write`-ed same-origin iframe (base URI, custom element registration); Safari 16 (the app floor) alongside Firefox/Chrome. Kill criterion: paginated flow broken at the Safari floor, or the nested-iframe mount fights the preview iframe irrecoverably. **Done 2026-07-24 in Chromium + Firefox — see "Phase 1 findings" below; Safari 16 eyeball pending (open `http://localhost:5173/foliate-spike/` in Safari).**

**Phase 2 — integrate (1–2 days).** The sketch above: preset, toolbar controls, persistence, gating, done-message/spinner, stale/refresh. Unit tests for the book-object builder and settings persistence; smoke-build canary if any string lands in the bundle (expected: none — `public/` asset). **Done 2026-07-24 — see "Phase 2 notes" below; live-verified in the app on the bulletin book.**

**Phase 3 — feel evaluation (author time).** Side-by-side against READ.html on the bulletin book: pagination breaks, column behavior at pane widths, CSS fidelity (the events-list grid, floats, `break-inside`). Explicit check that what this preview shows matches what Publish → Read shows — that's the promise the dropdown entry makes. Decide: ship in next release, iterate, or park with findings recorded here.

## Open questions for feedback

1. **Sourcing**: agree with Option B′ (phase 0 finding: raw copy of read-html's patched renderer modules — no build target needed after all)?
2. **Dropdown shape**: one **READ.html** entry + toolbar toggles (as planned), or two entries (Scroll / Pages) and only the column toggle in the toolbar?
3. **Theme/font controls**: acceptable to hide them for this device in v1?
4. **Naming**: "READ.html" as the visible group label, or "Reader"? (Memory says product names are load-bearing; READ.html is accurate but reads as a filename in a device list.)
5. Any interest in this device previewing **the whole spine** (foliate is built for multi-section books, so prev/next chapter would come almost free) — or does per-chapter match the pane's contract and stay v1?

## Phase 0 findings (2026-07-24)

Desk check of `read-html@e72da21` (the exact commit the vendored `READ.html` 0.5.0 was built from) and its `vendor/foliate-js/` (pinned upstream commit `78914ae`, 2026-05-01). Everything below is verified against code, not the README.

### The patches make read-html the only sane source

read-html carries **six documented local patches** (`vendor/foliate-js/VENDORED.md`, all marked `READ.html patch:` in-source), and three of them matter directly to us: **srcdoc section delivery** in `paginator.js` (upstream's `iframe.src = blob:` is refused by Chrome under opaque origins — the exact environment of a `document.write`-ed preview iframe can get close to), a **crash fix in `expand()`** (Firefox fires the ResizeObserver while the section iframe is still loading; upstream destructures a null document and sprays TypeErrors on every open/close), and a **Blob passthrough in the CSS loader hook** (real-book CSS with an empty `url()` broke the whole section load). Vendoring upstream directly (Option A) means re-deriving three real debugging sessions. Option A is dead; the source is read-html's vendored copy.

### Option B needs no build target — revise to a straight copy (Option B′)

foliate-js is dependency-free ES modules with no build step, and the renderer subset is fully self-contained: `paginator.js` has **zero imports**; `view.js` statically imports only `epubcfi.js`, `progress.js`, `overlayer.js`, `text-walker.js`. The container parser (`epub.js` → `vendor/zip.js`) is behind a **lazy dynamic import inside `makeBook`**, which never runs when `open()` is handed a book object — so it can simply be left uncopied and the dangling `import('./epub.js')` never executes. Ship the renderer as **raw module files copied from read-html's `vendor/foliate-js/`** into `public/foliate/` (7 files + LICENSE + a `VENDORED.md` pinning the read-html commit, re-copied whenever `READ.html` is re-vendored): `view.js`, `paginator.js`, `epubcfi.js`, `progress.js`, `overlayer.js`, `text-walker.js`, `fixed-layout.js` (dynamically imported by `view.js`; ~12KB insurance against a stray pre-paginated chapter). No new build target in read-html, patch lineage preserved by construction.

Weights (measured): raw module subset ≈ **106KB on disk, ~30KB over gzip HTTP** — vs 200KB for the whole vendored `READ.html`, 496KB for `paged.polyfill.js`, 544KB for `axe.min.js`. An esbuild single-file alternative measures 83–88KB minified / 30–32KB gz — the savings don't justify a build step. Zero production-bundle bytes either way.

### Minimum book interface, verified at code level

- `paginator.open(book)` touches exactly three properties: `book.sections` (each: `load()` → URL, optional `unload()`, `linear`), `book.dir`, and `book.transformTarget` — which is **optional-chained**, so omissible.
- `view.open(book)` skips `makeBook` for plain objects. Progress machinery engages only `if (book.splitTOCHref && book.getTOCFragment)` — omit both and it never constructs. Media overlay only if a section has `mediaOverlay`; fixed-layout renderer only if `rendition?.layout === 'pre-paginated'`; `languageInfo()` guards missing/invalid `metadata.language`. `resolveHref`/`resolveCFI` are only hit on link/CFI navigation, which a one-chapter preview doesn't do.
- `view.init({})` with no `lastLocation` just calls `next()`, which renders the first section — exactly right for one chapter.
- So the whole book object is: `{ sections: [{ load: () => blobUrl, size, id }], dir, metadata: { language }, toc: [] }`. Mounting `foliate-paginator` directly (skipping `view.js`) is possible but buys ~22KB raw for the cost of hand-wiring events and init — keep `view.js`.

### No polyfills needed

read-html polyfills `Object.groupBy`/`Map.groupBy` for the Safari 16 floor — but grep confirms both are used **only by `epub.js` and `opds.js`** (container/catalog parsing). The renderer path needs neither. Nothing to polyfill.

### Settings wiring facts (from Reader.svelte, learned the hard way there)

- `flow` is an observed attribute: set it and the paginator reflows live.
- `max-column-count` only sets a CSS custom property — **changing it resizes nothing, so the paginator's ResizeObserver never fires; call `renderer.render?.()` explicitly after setting it** (read-html hit this; the comment in `Reader.svelte` documents it).
- Apply both between `view.open()` and `view.init()` for a flash-free first paint (read-html's `openBook()` does exactly this; copy the shape).

### New checkpoints for the phase 1 spike

- Custom-element registration and the module cache live on the iframe's **window**, which `document.open()` preserves — so re-renders should reuse the cached modules and already-defined elements rather than re-registering (a second `customElements.define` would throw). Expected fine; verify explicitly across two consecutive re-renders.
- Section iframes are created with `sandbox="allow-same-origin allow-scripts"` — chapter scripts **run**, matching both current preview behavior and consented READ.html. No change, just confirming the behavior is consistent.
- The paginator's `relocate` event carries page position detail — not needed for v1, but it's the hook if a page indicator is ever wanted.

## Phase 1 findings (2026-07-24)

The harness lives at `spikes/foliate/` (README there explains the layout), served dev-only by the `serve-foliate-spike-dev` middleware at `/foliate-spike/`. It reproduces the exact planned integration shape: parent `document.write`s a wrapper into a same-origin iframe; the wrapper imports `view.js` from the app origin, builds a one-section book around a blob URL of a fixture chapter (blob stylesheet, blob SVG image, nested list, footnote link, break-inside CSS), mounts `foliate-view`, posts a done message. `spikes/` is ignored by eslint and prettier (vendored + harness code, not app modules). Verified in Chromium (Playwright MCP) and Firefox (Playwright, read-html's install); Playwright WebKit does not support macOS 13, so the Safari 16 check is a human eyeball of the harness URL — **the one open checkpoint**.

**Every checkpoint passed in both engines; no kill criterion hit.** Specifics:

- Paged flow renders a genuine two-column paginated layout; scrolled flow scrolls; both restyle correctly from the blob stylesheet, the blob image loads, the nested list survives, and the `foliate-paginator` renderer reports `pages`/`page` **directly as properties** — no book-level progress machinery needed (`view.lastLocation.location` stays null without `splitTOCHref`/`getTOCFragment`, and that's fine; read `renderer.pages` instead).
- Column toggle verified functionally: 2 columns → 5 pages, 1 column → 8 pages at the test viewport, live-toggling on the running renderer works. In Chromium the attribute change alone re-rendered (the read-html comment's ResizeObserver reasoning didn't bite there), but keep the explicit `renderer.render?.()` — it's idempotent and it's the documented requirement where the observer doesn't fire.
- Footnote link navigation works with the four-line `resolveHref` stub (`{ index: 0, anchor: doc => doc.getElementById(hash) }`) — page 1 → page 6 of 8. The stub belongs in the phase 2 book builder.
- Re-renders across `document.open()` are clean: module cache and the `foliate-view`/`foliate-paginator` custom-element registrations live on the iframe's persistent window, so repeat imports are no-ops and nothing double-defines. Six consecutive re-renders across flow/column combinations all completed.
- **One integration rule discovered: call `view.close()` on the old view before `document.open()`.** Without it, the dead view's ResizeObserver callbacks fire after the DOM is paved and spray uncaught TypeErrors (`columnize`/`scrolled` on a null document — the same family as read-html's patch 5, which they only fixed for `expand()`). Measured: 4 uncaught errors without teardown, 0 with, across the same re-render sequence, in both engines. This is the foliate analogue of `pausePreviewMedia()` in the existing pre-`document.open()` discipline.
- Renders succeed even when teardown is skipped (the errors are noise, not breakage) — so a missed edge case degrades to console noise, not a broken preview.

Phase 2 can start on this base: the harness's wrapper script is, near-verbatim, the `writeReadDoc()` the integration needs, and its book object is the book builder.

## Phase 2 notes (2026-07-24)

Shipped on the recommended answers to the open questions (1 = B′, 2 = one entry + toolbar toggles, 3 = theme/font hidden, 4 = "READ.html", 5 = per-chapter). The spike (`spikes/foliate/` + its middleware) is retired — superseded by the real device; its harness lives on as `buildReadDocument()`.

- **Vendoring**: `public/foliate/` holds the seven patched renderer modules + LICENSE + `VENDORED.md` (pinned to `read-html@e72da21`, re-copied whenever `READ.html` is re-vendored). Ignored by eslint/prettier alongside the other vendored assets. Zero production-bundle bytes; ~106KB of dist assets, fetched only when the device is used.
- **Builder**: `src/lib/reader/read-preview.ts` — `buildReadDocument()` (wrapper doc: module import from the app origin, one-section book, `resolveHref` stub, flow/columns applied between `open()` and `init()`, done ping in a `finally`), plus the `FOLIATE_CLOSE_HOOK` / `FOLIATE_VIEW_GLOBAL` window-global contract. Six unit tests.
- **Preview pane**: `read` preset after Responsive (ungrouped option — a one-item optgroup would repeat its own label); `read` added to the `PreviewType` union with per-type autoUpdate (default on) / includeHead (default off) settings rows; Flow (Pages/Scroll) + Columns (Auto/Single, hidden while scrolled) selects in the toolbar, persisted (`seedhtml_preview_read_flow` / `_columns`), applied live to the running renderer with the explicit `render()` call; `closeFoliateView()` teardown before every `document.open()` in all three write paths; READ_DONE spinner with 10s safety; blob URL revoked on replacement and unmount.
- **Hidden on this device**: reader theme/font, Announce, axe (both the collapsed dropdown and the standalone buttons — the standalone axe button was missed first pass and caught in live verification), click-to-source (never attached — different write path). EpubCheck stays (report-based). Fixed-layout chapters hide the device and fall back to the plain render.
- **Live verification** (Chromium, bulletin book): chapter renders paginated with `page.css` applied (14 pages at 591px pane → one column, correct "Auto" behavior at that width); flow/column toggles apply live; read → responsive → read → print → read transitions all clean with zero console errors; persisted device restores on cold start straight into a foliate render.
- **i18n**: five new strings ("Reading flow", "Scroll", "Columns", "Auto columns", "Single column"); German seeded (needs native review, as usual). "READ.html" itself is a product name, not translated.
- **Page navigation** (added same day): previous/next buttons (`view.goLeft()`/`goRight()`, page-direction-aware), a page picker ("3 / 11"), and arrow-key / PageUp/PageDown turns wired inside the wrapper realm — one keydown listener on the wrapper window plus one per section document (READ.html's own pattern; foliate has no built-in key handling), so editor keystrokes can never turn pages. The indicator is fed by relocate events forwarded as `preview-read-relocate` messages; content pages run `1..pages-2` (the paginator pads one turn page at each end — `atStart`/`atEnd` and `detail.fraction = (page-1)/(pages-2)` confirm it). Direct jump uses the paginator's public `scrollToAnchor(fraction)` seam, whose `Math.round(fraction * (textPages-1)) + 1` mapping exactly inverts `(target-1)/(textPages-1)`. Nav appears only in paginated flow; the trio wraps as one `.read-pager` unit in the header's flat flex wrap (`.preview-device` became `display: contents` like the other header groups). Three more strings ("Previous page", "Next page", "Page"), German seeded.
- **Position restore across re-renders** (same day): edits no longer reset the view to page one. `writeReadDoc` captures the reading position for same-chapter re-renders — content page in paginated flow, scroll fraction (`start/viewSize`, forwarded in the relocate message) in scrolled — and the READ_DONE handler restores it through the same `scrollToAnchor(fraction)` seam, clamped to the new page count (same-source postMessage ordering guarantees the new totals arrive before the done ping). Chapter switches and device-type arrivals start fresh, matching the print preview's `pendingPrintPage` contract.
- **Reactivity trap worth remembering**: `renderNow()` runs inside the render `$effect`, so any `$state` it reads becomes a tracked dependency of that effect. The restore capture read `readPage` — which every relocate message updates — producing an infinite render loop (each render revoking the previous section blob before foliate could fetch it: hung opens, no done pings, ~28 relocates/s). Fixed with `untrack(() => renderNow())`; the effect's real dependencies are all read explicitly in its body. The same tracking had silently made flow/columns changes re-render the whole document since their `.current` reads sat in `writeReadDoc` — untracked, the live-apply path is now the only path.

**Remaining before calling the feature done (phase 3)**: the Safari 16 eyeball (now just: select READ.html in the device dropdown in Safari) and the side-by-side feel comparison against Publish → Read.
