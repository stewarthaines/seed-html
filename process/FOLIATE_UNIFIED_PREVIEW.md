# Unified device preview on the foliate renderer (plan for review)

Builds on `process/READ_DEVICE_PREVIEW.md` (shipped 0.14.0). The motivating observation from that release: rendering through foliate is **not measurably slower than the raw XHTML preview** — the wrapper writes, modules come from cache, and the section paints in the same frame budget; the done ping lands well under a second on the bulletin chapters. Given that, the device presets (Commute / Home / Travel) can defer to the foliate renderer entirely: each device frame hosts the reader engine at the device's CSS dimensions, scaled by the existing frame machinery, with pagination or scroll available per device. HTTP-only; on `file://` every preset silently falls back to today's built-in preview.

## Why this is a realism win, not just consolidation

Today's device presets render the chapter as one long scroll inside a device-shaped viewport. Real reading on those devices is paginated — phones, tablets, and above all e-ink readers page; the Travel preset is the least realistic view in the app precisely where realism matters most. Under foliate, each device preset shows genuine page breaks at that device's size and font, `break-inside` behavior, column fitting (a tablet in landscape gets two columns when they fit, a phone never does — `max-column-count` is width-driven), and an honest page count per device ("this chapter is 40 phone pages" is an authoring signal the app currently cannot give). The pager, arrow keys, and position-restore from 0.14.0 come along for free on every preset.

## What the author sees

| Dropdown entry          | http:                                                                                | file://                       |
| ----------------------- | ------------------------------------------------------------------------------------ | ----------------------------- |
| Source (advanced)       | unchanged                                                                            | unchanged                     |
| Responsive (Fill)       | **unchanged — the raw web view**, where the DOM tools live (see below)               | unchanged                     |
| READ.html               | unchanged (fill-size reader view)                                                    | absent (as today)             |
| Commute / Home / Travel | **foliate at device dimensions**, scaled frame, flow toggle + pager + page indicator | today's raw view in the frame |
| Print                   | unchanged (Paged.js)                                                                 | absent (as today)             |

- The Flow (Pages/Scroll) toggle appears for device presets too; **Pages is the default** — it is what the device really does. One global flow setting shared with the READ.html entry (recommendation; see open questions).
- The Columns select disappears for device frames: the device width already decides honestly (that is the realism), and Auto is foliate's native behavior. It stays on the fill-size READ.html entry where pane width is arbitrary.
- Reader controls (theme, text size, force colors) **keep working on device presets** — wired through `renderer.setStyles()` instead of head injection (below). This also unlocks them for the READ.html entry, removing a 0.14.0 exclusion.
- Orientation toggle unchanged — foliate's own ResizeObserver repaginates on the container resize for free (verified in the phase 1 spike).
- No new UI states for the fallback: on `file://` the presets simply behave as they do today, consistent with the app's silent http-gating convention.

## Architecture

**Builder generalization.** `buildReadDocument()` grows two options: `styles` (initial reader-sim CSS applied via `renderer.setStyles?.()` between `open()` and `init()` — READ.html's own flash-free pattern) and nothing else; device dimensions are _not_ the wrapper's business. The existing frame machinery already sizes and scales `previewContainer`, and the wrapper iframe fills it — the engine sees true device CSS pixels, so column and page math are exact. `writeReadDoc` becomes `writeFoliateDoc(content, { deviceId })` used by both the READ.html entry and the device presets.

**Engine routing.** `renderNow()` routes on engine, not just type: `print` → Paged.js; (`read` or `device`) and `canReadPreview` and not fixed-layout → foliate; otherwise plain `updatePreviewContent`. The stale/re-render bookkeeping gains a `renderedEngine` alongside `renderedType`, so an http/file or FXL-driven engine difference always re-renders. The settings model is untouched: presets keep type `device` (their autoUpdate/includeHead semantics are unchanged); `read` remains its own type for the fill-size entry.

**Reader simulation via setStyles.** Today `applyPreviewAppearance()` injects a `<style data-preview-theme>` plus root `font-size`/`color-scheme` into the preview document — a fresh foliate wrapper drops all of that, and reaching into the section document from outside races section loads. `renderer.setStyles(css)` is the engine's own hook for exactly this (READ.html uses it for theme and font): generate the equivalent CSS — root `font-size` from `DEVICE_BASE_FONT[device] × FONT_STEPS[step]`, palette background/color (with the `!important` force-colors variant), `color-scheme` — and hand it to the renderer initially via the builder's `styles` option and on control changes via the live view global. The em-scaling property is preserved: root font-size in px cascades to em/rem text while fixed-px text stays put (the deliberate "not responsive" tell). `readerModeActive` returns to `device.current !== 'print' && !isFixedLayout` — the read exclusion is deleted rather than extended.

**The DOM tools (deixis, axe, Announce) — the real migration cost.** All three operate on the preview document and break silently under foliate, whose chapter lives in a nested sandboxed section iframe. Thanks to read-html's open-shadow-root patch and same-origin sections, the section document is reachable: `view.renderer.getContents()[0].doc`. The migrations are mechanical but each has a re-attachment lifecycle (per section load, not per preview render):

- **Click-to-source deixis**: attach `handlePreviewClick` to the section document instead of the wrapper document (one-line retarget plus a re-attach on the view's `load` event — same event the arrow-key wiring already uses). `snippetAroundClick` and the position estimate are document-relative and engine-agnostic.
- **axe**: inject `axe.min.js` into the section iframe rather than the preview iframe and run against the section document. The Paged.js precedent (skip auto-run on print) shows the wiring tolerates per-engine differences.
- **Announce (SR walk)**: the walk and the vsr bundle load into the preview iframe realm today; under foliate they must load into the section iframe realm. Same realm-gotcha rules apply one level deeper.

**Phasing decision (recommended):** ship the device unification with the tools **redirected to Responsive** (buttons hidden on foliate-rendered presets, exactly as 0.14.0 already does for the READ.html entry), then migrate the tools in a follow-up phase. Announce and axe are checking tools — running them against the raw view is legitimate; deixis hurts most, so it is first in phase B. The alternative — block shipping until all three are migrated — trades a shippable realism win for a big-bang risk.

**Fixed layout.** FXL chapters keep the current built-in simulation (declared viewport + letterbox); the engine router treats FXL as "not foliate" exactly as 0.14.0 does. `fixed-layout.js` is already vendored and `view.open()` selects `foliate-fxl` automatically when `rendition.layout === 'pre-paginated'` — a later phase can evaluate replacing the home-grown FXL simulation with the engine's, but nothing in this plan depends on it.

**Position restore per device.** The 0.14.0 restore (page in paginated, fraction in scrolled) extends with one more key: restore only when the _device_ also matches (`renderedDevice`), since page N on a phone is not page N on a tablet. A device switch starts at page one — same contract as a chapter switch.

## Feature matrix (today → phase A → phase B)

| Feature                          | Devices today | Devices phase A          | Devices phase B        |
| -------------------------------- | ------------- | ------------------------ | ---------------------- |
| Pagination + pager + arrow keys  | —             | ✓                        | ✓                      |
| Scroll flow                      | ✓ (only mode) | ✓ (toggle)               | ✓                      |
| Reader theme / text size / force | ✓             | ✓ (via setStyles)        | ✓                      |
| Position kept across edits       | ✓ (anchors)   | ✓ (page/fraction)        | ✓                      |
| Click-to-source deixis           | ✓             | Responsive only          | ✓ (section doc — done) |
| axe                              | ✓             | Responsive only          | ✓ (section doc — done) |
| Announce (SR preview)            | ✓             | Responsive only          | ✓ (section doc)        |
| FXL simulation                   | ✓             | ✓ (built-in path, as is) | ✓                      |
| file:// behavior                 | ✓             | ✓ (unchanged fallback)   | ✓                      |

## Phases

**Phase A — done 2026-07-24 (same day as the plan; see notes below).** Builder `styles` option + `writeFoliateDoc(content, { deviceId })`; engine routing with `renderedEngine`/`renderedDevice`; reader sim through setStyles (device base font × steps, palettes, force colors, color-scheme) with live control changes via the view global; flow toggle on device presets (Pages default), columns select scoped to the fill entry; pager/keys/restore inherited; tool buttons hidden on foliate presets; FXL and file:// untouched by construction. Unit tests: the styles CSS generator (pure function), routing decisions, restore keying. Live verification against the bulletin on all presets, orientation flips, theme/font changes mid-page. Kill criterion: device-frame scaling and foliate's own sizing fight irreconcilably (not expected — the spike ran inside a scaled container's fill iframe), or Pages-by-default feels wrong on phones in practice (fallback: per-category flow defaults).

**Phase B — migrate the DOM tools to the section document (2–3 days, independent items).** Deixis first (highest value, smallest surface), then axe, then Announce. Each item: retarget to `getContents()[0].doc`, re-attach on the view's `load` event, verify against the realm rules one level deeper. Ships per-item — no big bang.

_Deixis and axe done (see notes below); Announce remains._

**Phase C — options, only if wanted.** foliate-fxl for fixed-layout presets; e-ink flavor for Travel (grayscale filter, no animation); per-device page-count badges in the dropdown ("Travel · 38 pp"); folding the READ.html entry into a redesigned dropdown once devices paginate (it becomes "the fill-size device").

## Risks

- **Reactivity**: the untrack lesson from 0.14.0 is directly load-bearing — the reader-sim effect must apply styles via the live view without making the render effect depend on theme/font state. Same shape, same fix; recorded in READ_DEVICE_PREVIEW.md.
- **setStyles cascade**: injected CSS lands in the section document with engine-controlled placement; the force-colors `!important` variant needs verification against author CSS that also uses `!important` (accept the tie — today's behavior).
- **Tool regression window**: phase A hides deixis/axe/Announce on device presets. Authors keep them one dropdown entry away (Responsive), and the READ.html entry set the precedent, but it is a real temporary loss called out honestly.
- ~~**Safari 16 exposure widens**~~ Resolved 2026-07-24: the READ.html preview is confirmed working on Safari 16 / iOS against production — the engine clears the floor browser before this plan widens its use.
- **Per-device font realism**: `DEVICE_BASE_FONT` was tuned for the raw view; paginated columns may want different bases. Treat as phase A calibration, not architecture.

## Phase A notes (2026-07-24)

Landed as planned, with the architecture surviving contact intact — the frame machinery really does compose with the engine unchanged (the wrapper is device-agnostic; foliate paginates at true device pixels inside the scaled container, and orientation flips repaginate through its own ResizeObserver with no app code). Deltas and verified specifics:

- `usesFoliate(id)` / `engineOfDevice(id)` route rendering; `renderedEngine` + `renderedDevice` join the re-render bookkeeping (an FXL flip re-renders through the right engine because the render effect now reads `isFixedLayout` via the engine computation; the position restore is keyed to chapter + device).
- Reader sim: `readerSimCss()` (pure, tested) generates the equivalent of the head-injected theme; `applyPreviewAppearance()` branches — foliate views get `renderer.setStyles()`, raw views keep DOM injection. Initial styles ride the builder's `styles` option (between `open()` and `init()`, flash-free); control changes re-apply via the live view global. The `readerModeActive` read-exclusion is deleted.
- Device presets force `max-column-count` Auto in both the builder call and the live-apply path; the Columns select renders only on the fill-size READ.html entry.
- `setupIframeInteractivity` (click deixis + hover outlines) skips foliate views — attaching to the wrapper would outline the reader chrome and deliver junk clicks; phase B retargets it at the section document.
- Live-verified (Chromium, bulletin): Kindle paginates at 600×800 ("1 / 11"); iPad Air fits its pages; Responsive stays raw with the tools present; sepia theme lands inside the section (`#f4ecd8` computed); text-size step 17px → 20px honestly repaginates 13 → 16 pages; device round-trip (kindle → ipad → kindle) starts at page one per the restore keying; edit + revert on a device preset both keep page 3; zero console errors throughout. Validate green (1748 tests; readerSimCss + builder-styles tests added).
- No new i18n strings — the flow toggle, pager, and reader panel reuse existing catalog entries.

## Open questions — resolved 2026-07-24

1. **Responsive stays raw** — the debugging/web view, the tool host in phase A, and the whole of the file:// story.
2. **One global flow toggle** shared across devices and the READ.html entry.
3. **Pages is the device default.**
4. **Phase A's tool regression window is accepted** — deixis/axe/Announce redirect to Responsive until phase B.
5. **READ.html entry's long-term fate** — deferred to phase C (no action now).

## Phase B notes — deixis (2026-07-25)

Click-to-source deixis now works on every foliate view (the READ.html entry and the device presets), retargeted at the section document. The migration was smaller than the plan reserved because deixis has no toolbar button — it is ambient click behavior — so nothing in the header needed re-enabling; the whole change is wiring one listener at the right document. Specifics:

- **`wireFoliateDeixis()`** (PreviewPane) attaches `handlePreviewClick` to `liveFoliateView().renderer.getContents()[0].doc` and re-attaches on the view's `load` event (the same event the wrapper's arrow keys use). Called from the `READ_DONE` handler, so init is complete and the first section is loaded; the initial `load` has already fired, hence the explicit `getContents()` attach for it plus the `load` listener for later reloads (flow/column `render()`). Listeners die with the section document when the view is torn down (`document.open` paves the wrapper) — no manual cleanup; re-adding the same handler dedupes.
- **`estimateDocumentPosition` fix (load-bearing):** it walked `previewIframe.contentDocument.body` — the wrapper — which contains no chapter text under foliate, so a section click estimated position 0. Now walks `element.ownerDocument.body` (the section document under foliate, the preview iframe otherwise — identical there). `handlePreviewClick`/`caretFromPoint` were already document-relative via `target.ownerDocument`; this was the one wrapper-bound assumption.
- **Coordinates need no translation:** the click event and `caretRangeFromPoint` both live in the section realm, so the paginator's column translation is already baked into the section document's own hit-testing. `Node.TEXT_NODE` is a numeric constant, cross-realm-safe.
- **No hover-outline affordance on foliate (deliberate):** the raw view's `setupIframeInteractivity` paints `:hover` outlines on every block as a discoverability hint; that undercuts the "reads like a real device" realism the presets exist for, so foliate deixis is click-only. Authors who use deixis know the gesture; the outline stays on Responsive. Revisit only if discoverability complaints surface.
- Interface: `FoliateViewLike` gained `renderer.getContents()` and `addEventListener('load')`; `FoliateContent`/`FoliateLoadEvent` types added in read-preview.ts. Type-only — no new unit surface (deixis lives in the component; `snippetAroundClick` coverage unchanged). Validate green (1748), svelte-check 0/0.
- **Not migrated here:** intra-book `.xhtml` link navigation (`onNavigate`) still binds the wrapper document, so chapter-to-chapter links are inert under foliate — out of scope for deixis, noted for a later pass. axe and Announce are the remaining phase B items.

## Phase B notes — axe (2026-07-25)

The Accessibility check runs against the foliate section document on reader-engine views (the READ.html entry and the device presets). The section iframe carries `sandbox="allow-same-origin allow-scripts"` (verified in the vendored `paginator.js`), so the injected `axe.min.js` executes there just as it does in the raw preview iframe. Specifics:

- **`a11yTarget()`** resolves the audit doc + window per run: under foliate, `renderer.getContents()[0].doc` and its `defaultView`; otherwise the preview iframe. `runA11yCheck`, the leave-panel highlight clear, and `loadAxe` all go through it. Resolved fresh each run because every foliate re-render replaces the section document.
- **Re-check lifecycle.** The raw path schedules the debounced re-check from `updatePreviewContent`; foliate renders don't go through there, so `scheduleAutoA11yCheck()` is now also called from the `READ_DONE` handler (after each re-render) and from `applyReadSettings()` (a flow/column `render()` reloads the section without a READ_DONE ping — without this the highlights would point at a destroyed document). The debounce's `activePanel !== 'a11y'` guard makes all three calls no-ops when the panel is closed.
- **UI.** The Accessibility entry is offered wherever `canCheckA11y` holds (the `!usesFoliate` gate is gone, both in `availablePanels` and the single-button fallback). `handleDeviceChange` no longer closes the a11y panel when switching onto a foliate view — the render effect re-renders through the engine and the READ_DONE re-check refreshes results on the new view. Only the Screen reader panel still closes on that switch (its walk is the remaining item).
- **No new i18n or unit surface** — the check is component-wired; the axe report shape is unchanged. Validate green (1748), svelte-check 0/0.
- **Known minor gap:** highlight outlines live in the section document, so they vanish when the view is torn down (device switch, chapter hop) until the next check runs — the violations list (text) is unaffected, and the auto-recheck restores highlights within the debounce.
