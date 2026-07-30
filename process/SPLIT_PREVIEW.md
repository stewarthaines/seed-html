# Split preview — two preview surfaces in the spine item preview pane

Status: phase 1 BUILT (2026-07-30) — `PreviewSurface` extracted, no behavior change, full preview matrix verified live. Phase 2 (the split itself) not started. Companion to the editor's existing single/dual pane toggle, and structurally a sibling of the chapter-switch extraction (`process/CHAPTER_SWITCH_SERVICE.md`): the feature is small once a per-preview component exists, and the extraction is the bulk of the work.

## Motivation and use cases

The preview pane shows one rendering at a time; comparing renderings means flipping the device dropdown back and forth. A split gives two independent previews of the same chapter, stacked vertically:

- Two of the same device in independent orientations (portrait next to landscape phone).
- Scrolled next to paginated READ.html flow.
- Two different devices (phone next to e-reader).
- Source (raw or tree) above the rendered preview — markup next to its result.

## UI specification

- **Toggle button** in the preview header's top right, in between the checks dropdown and hide-preview button — mirroring the editor pane's toggle position. Same icons as the editor: `RowsIcon` when single (action: add second preview), `SquareIcon` when split (action: back to single). Title strings mirror the editor's pattern ("Add second preview pane" / "Switch to single preview").
- **Device dropdowns**: when split is on, a second device dropdown appears beside the first in the header. First dropdown drives the **top** surface, second drives the **bottom**. Both dropdowns offer the full view list **including Source** — source-above-render is a first-class use case; this means source-view state (raw/tree toggle, tree container) becomes per-surface.
- **Options bars**: each surface gets its own preview-options bar for its chosen view (flow/columns/pager for reader views, orientation for scaled frames, raw/tree for Source — per `process/PREVIEW_OPTIONS_BAR.md`). The top surface's bar stays where the bar lives today (band 2, under the header). The bottom surface's bar renders attached to the top edge of the lower pane. A surface whose view has no options shows no bar (existing rule).
- **Splitter**: a PaneForge vertical `PaneGroup` between the two surfaces, `autoSaveId="seedhtml-preview-panes"` (sibling of `seedhtml-content-panes`) so the handle position persists through PaneForge's existing localStorage mechanism.
- **Checks dropdown** (band 1, unchanged position): offers the **superset** of the checks available to the two surfaces' views. The results panel renders once, in its current band-3 position above the top surface — never duplicated per pane.

## Checks and screen-reader binding

Every check runs against one document, so with two surfaces each check needs a deterministic target:

**Binding rule: a check targets the top surface when the top surface's view supports it; otherwise the bottom surface.**

- The superset rule and the binding rule compose: a 'reader' check that appears only because the bottom surface is a READ view targets the bottom surface.
- **Screen reader**: the virtual screen reader is injected into one document and walks one reading order, and `SpeechService` is a single queue — one SR pane cannot meaningfully take input from two previews. It binds by the same rule. Note the SR walk genuinely differs between a plain iframe and a foliate-paginated view, so the deterministic rule matters; with top-pane-preferred it is predictable enough to need no UI labeling.
- axe violation highlighting outlines elements in whichever document the check targeted (follows the rule automatically).
- The a11y auto-recheck (500 ms after a rewrite, when the panel is open) runs once, against the bound surface only.

## Rendering cost ledger

The shared pipeline runs once per edit regardless of split: transform ×1, XHTML build ×1, disk write ×1, blob-URL rewrite ×1 — one `xhtmlContent` string reaches PreviewPane and both surfaces consume it. What doubles is per-surface consumption inside each iframe: document parse/layout ×2, and engine work (Paged.js repagination, foliate column layout) ×0–2 depending on the chosen views. Two plain device frames are cheap; paged-next-to-paged is the expensive corner and is opt-in by construction.

## Architecture: extract `PreviewSurface`

`PreviewPane.svelte` (~4,000 lines) holds exactly one preview's worth of state. The split requires extracting a `PreviewSurface` component that PreviewPane instantiates once (single) or twice (split).

**Moves into `PreviewSurface`** (per-surface state and behavior):

- View selection value (device id or `source`), device frame, iframe, scale/resize handling, FXL page-box geometry.
- Engine glue: raw `document.write` path, Paged.js wrapper, foliate/READ wrapper, their spinners and safety timers, page-turn state (`readPage`/`readPages`), scroll-position restore.
- Per-surface options bar (rendered into a location the parent chooses — top surface's bar into band 2, bottom surface's at its pane's top edge; a snippet/prop seam).
- Source view: raw `<pre>`, tree container and its `$effect`, raw/tree toggle state.
- Orientation, per-surface preview stats (KB/timing readout).

**Stays in `PreviewPane`** (shared, once):

- Header: filename/status/refresh, the two device dropdowns, split toggle, checks dropdown, prev/next chapter arrows, hide-preview button.
- Checks panels (a11y / reader / SR / epubcheck) plus the binding-rule resolution handing each check its target surface's document.
- Shared inputs: `xhtmlContent`, `persistedXhtml`, preview heads, print settings, `spineNeighbors`, callbacks — passed down to both surfaces unchanged.
- Reader appearance settings that are preferences, not per-surface state: font step, forced colors, SR voice/rate.

**Engine message correlation**: foliate and Paged.js signal readiness/relocation via `postMessage` tokens; with two instances the tokens are ambiguous. Each surface matches `event.source` against its own iframe's `contentWindow` and ignores foreign messages. This must be designed into the surface extraction, not patched after.

## Persistence keys

Existing keys become the top surface's keys (no migration); the bottom surface gets `_2`-suffixed siblings via the same `persisted()` helper:

| Setting           | Top surface (existing key)         | Bottom surface                    |
| ----------------- | ---------------------------------- | --------------------------------- |
| View/device       | `seedhtml_preview_device`          | `seedhtml_preview_device_2`       |
| READ flow         | `seedhtml_preview_read_flow`       | `seedhtml_preview_read_flow_2`    |
| READ columns      | `seedhtml_preview_read_columns`    | `seedhtml_preview_read_columns_2` |
| Split on/off      | `seedhtml_preview_split` (new)     | —                                 |
| Splitter position | PaneForge `seedhtml-preview-panes` | —                                 |

Orientation and source raw/tree stay session-local per surface (as today). Font step, forced colors, and SR settings stay single/global.

## i18n

New strings: the toggle titles ("Add second preview pane" / "Switch to single preview"), and distinct accessible labels for the two dropdowns — two comboboxes must not share the label "Select view"; working names "Select view" (top keeps the existing string) and "Select second view". German translations via the `.po` workflow.

## Phases (each shippable)

1. **Extract `PreviewSurface`** — no behavior change, single surface only. PreviewPane becomes header + checks + one surface. This is the bulk of the work and carries the regression risk; verify against the full existing preview matrix (devices, print, READ, source raw/tree, FXL, a11y/SR/reader checks, PDF footer).
2. **The split** — toggle button, second surface, second dropdown, per-surface keys, PaneForge splitter, options-bar placement, checks superset + binding rule, message correlation. Changelog line lands here.

## Verification

- Phase 1: the existing preview behaves identically across the device matrix; validate green; Storybook story for `PreviewSurface` if the harness allows (public/ assets are served in Storybook).
- Phase 2 manual matrix: phone×2 with independent orientations; READ scrolled above READ paginated (independent persisted flows); source tree above rendered device; checks superset for mixed views (Responsive + READ → reader check present, bound to bottom); SR walk targets the top surface when it supports it; splitter position and both device choices survive reload; toggling back to single keeps the top surface's state.
- Cost sanity: with split off, no second surface exists (no hidden double rendering).
