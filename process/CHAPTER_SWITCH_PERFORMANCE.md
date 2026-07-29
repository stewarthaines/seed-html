# Chapter-switch performance — trace and findings

Status: ANALYSIS (2026-07-29). Nothing implemented; candidate fixes are ranked at the end for discussion.

## Symptom and measurements

Switching spine items feels slow — around 2 seconds in the project where it was noticed (The Adventures of Sugar Power, which is larger than the project measured below). Measurements were taken in Polyphony Bulletin 39 (14 chapters, 82 files, audio-clips + djot extensions installed); the dominant costs scale with chapter count, file count, and installed extensions, so a larger project sits proportionally higher on the same baseline.

Measured live in the dev server (Chromium, same project data, instrumented via the page's own DOM signals):

| Scenario                                           | Click → editor + preview state | Notes                                                         |
| -------------------------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| Default (desktop) preview, chapter already visited | ~650–750 ms                    | editor text and preview state land in the same tick           |
| Default preview, first visit this session          | ~640–750 ms                    | no cold penalty measurable                                    |
| READ.html device                                   | ~1.0 s                         | state at ~580 ms, foliate repaginates until ~960 ms (spinner) |

The transform itself is 25–54 ms (the app's own stat). Essentially all of the felt latency is orchestration and storage I/O around it. The gap between the measured ~0.7 s and the felt ~2 s is explained by the double-render described below (the preview settles twice, and the second settle is what the eye waits for), plus whatever device/panel is active (foliate/Paged.js re-render, open checks panels re-running).

## What one switch actually does

Everything below is serial, and `isLoading` unmounts the whole editor pane behind a spinner for the entire duration (`SpineView.svelte:1328` + template), so the full chain is perceived latency.

### Phase 1 — selection and editor setup (SpineView)

1. **Re-list all spine items** — `spineService.loadSpineItems` (`spine.service.ts:53-89`) loops over all 14 chapters sequentially, and `fileExists` is implemented as a full `readFile` (`workspace.service.ts:1276-1283` → `storage/index.ts:786-793`). Every switch reads every chapter's source text end-to-end, one file at a time, each read costing ~7 sequential un-cached OPFS handle awaits. Largest project-proportional block, and it runs before anything else can start.
2. **`loadAvailableFiles` runs twice** — once from `handleSpineItemSwitch` (`SpineView.svelte:1365`) and again, verbatim, from `initializeSpineEditor` (`:721`). Each pass: settings read + `preview/head.xml` read + a full workspace `listFiles` enumeration for generators (`generator-store.ts:53-81`) + another full enumeration for extension preview-heads — and `getWorkspaceExtensionInfo` (`extension-manager.ts:674-700`) does one more full enumeration **per installed extension**, reading every file in each. Together with `refreshGenerators` (`SpineView.svelte:764`), one switch performs at least five full workspace enumerations, all serial.
3. **The chapter's text is read three times** — by the spine listing (1), by the preview manager's `loadInitialContent` (`spine-preview-manager.ts:201-226`, which also repeats the exists-check-as-full-read), and by editor store creation on first visit (`SpineView.svelte:598-668`).
4. A sidecar `readChapterMeta` for the title effect duplicates the read the render also does (`SpineView.svelte:110-124` vs `spine-preview-manager.ts:522-571`).

### Phase 2 — the render (`doRender`, `spine-preview-manager.ts:293-403`)

Serial chain: auto-save write of the (unedited) source text → `loadWorkspace` (now cheap on a hit thanks to the mtime cache from `6ed6b7e`; the comment claiming a full re-parse per render is stale) → settings read → transform in the sandbox iframe (postMessage round-trip + transform CPU) → sidecar read → **DOMParser parse #1** (extract body) → XHTML write to disk → **parse #2** (`deriveContentProperties`) → blob-URL rewrite with **parse #3** plus a serial per-asset await loop (`blob-url-manager.ts:149-187`) → serialize. Two disk writes per switch with zero edits. The blob registry is cached across switches, so only assets new to the chapter cost reads — but note `maxBlobURLs: 100` (`SpineView.svelte:408`) versus 82 project files; an asset-heavy project will eventually hit `BlobURLCapacityError`.

### Phase 3 — the echo render

Two separate mechanisms make the whole of Phase 2 run twice:

- On a chapter's first visit, the newly created file store's `subscribe` fires immediately, scheduling a 300 ms pending save whose `onSaved` calls `previewManager.updateContent` → another debounced render (`SpineView.svelte:627-666`, `pending-saves.ts:143-161`).
- Independently: `switchToSpineItem` schedules a 300 ms `debounceRender`; if Phase-1 steps overrun those 300 ms, that render starts, and the awaited `forcePreviewUpdate` (`SpineView.svelte:820-822`) then queues a second one behind it.

Either way the preview paints, then re-runs the full transform/write/parse/blob chain and paints again ~0.5–1 s later. The second settle is very plausibly the "2 seconds" being felt.

### Phase 4 — repaint

`isLoading = false` remounts EditorPane (its panes re-read base content, `EditorPane.svelte:642-674`); the preview iframe is rewritten via `document.open()/write()`. If the active device is Print/Proofs (Paged.js repagination) or READ.html/device presets (foliate boot), that engine's full re-render stacks on top. An open Accessibility panel re-runs axe 500 ms after every rewrite.

## Delay constants in the path

300 ms render debounce (`spine-preview-manager.ts:707-741`) · 300 ms pending-save debounce (`pending-saves.ts:55`) · 500 ms a11y auto-recheck when the panel is open (`PreviewPane.svelte:482`) · 400 ms preview resize debounce · 3 s transform budget / 5 s engine timeout · 10 s Paged.js/foliate spinner safety timers.

## Did the recent changes cause the regression?

- **`persistedXhtml` (this week): innocent.** It forwards a string `doRender` already had — zero extra reads or parses. The Source-tree DOMParser effect is gated on the tree container being mounted, so it is inert in normal previewing.
- **Extension preview-heads (`68f7034`, ~2 weeks ago): real per-switch cost.** It added the two extension enumerations (plus per-extension full listing + read-every-file) inside `loadAvailableFiles` — which runs twice per switch. Cost scales with installed extensions; this project has two.
- **Pending-saves rework (`4fae288`/`ef3fba6`): real cost.** Added the `flushAll` on switch and the schedule-on-subscribe that produces the first-visit echo render.
- Workspace mtime cache (`6ed6b7e`) and script caching (`1039327`/`e7329be`) were reductions; pagemaps and spineNeighbors are off the default path / in-memory.

So "slower than it was" is credible: the fixed overhead was always there, but the extension scans and the echo render are recent additions layered onto it.

## Ranked recovery candidates (not yet designed)

1. **Make `fileExists` a stat, not a read** (`storage/index.ts:786-793`) — removes 14 full-file reads per switch from the critical path; also benefits every other `fileExists` caller.
2. **Run `loadAvailableFiles` once per switch and share one workspace enumeration** across generators, extensions, and `refreshGenerators` — collapses ≥5 full enumerations (plus per-extension listings) to one.
3. **Suppress the echo render** — don't schedule a pending save from the store's initial subscribe fire, and make `forcePreviewUpdate`/`switchToSpineItem` coalesce into a single render.
4. **Collapse the three DOMParser passes in `doRender`** — parse once, thread the Document through extract-body, content-properties, and blob rewrite.
5. Smaller: reuse the sidecar read between title effect and metadata generation; parallelise the independent Phase-1 reads; keep EditorPane mounted (spinner overlay instead of unmount) so remount reads disappear.

Items 1–3 address the fixed per-switch overhead and the double-settle; item 4 trims CPU proportional to chapter size.

## How this was measured (repeatable)

In the running app, instrument a switch from the console: record `performance.now()` before clicking a sidebar item, then poll for (a) the editor textarea's content changing and (b) `.preview-stats .content-size` changing (the `xhtmlContent` state update). Long tasks via `PerformanceObserver({entryTypes:['longtask']})`. For foliate, time the `.print-paginating` spinner's appearance → removal. Direct iframe-content polling is unreliable here because the preview iframe is rewritten in place via `document.open()`.
