# Preview options bar — a grounded header pattern

## Motivation

The spine-item preview header packed four kinds of thing onto one wrapping flex row: the permanent controls (rendered filename, device dropdown, checks dropdown, hide-preview button), transient status (transform state, out-of-date refresh, fixed-layout badge), and the current preview's own inputs (reader flow/columns/pager, device orientation). The last group appears, disappears, and reorders as you change device or turn pages — so the whole row reflows and the permanent controls shift under the cursor. It read as "too dynamic."

The fix is to stop mixing bands. The permanent controls get a row that never changes; the preview's own inputs move to a second toolbar directly below it, where they hold fixed positions and disable in place instead of vanishing. This is the **preview options bar**.

## The three bands

Top to bottom, the preview pane header is now:

1. **Permanent header row** (`.preview-header`) — rendered filename (+ transient status/refresh/FXL badge, which stay here as read-outs, not inputs), the device dropdown, the checks dropdown, and the hide-preview button pinned top-right. Always the same controls in the same places.
2. **Options bar** (`.preview-options`) — the inputs specific to the current preview. Present only when the current preview has any. One shade lighter than the header so the two bands read as distinct.
3. **Checks results pane** — accessibility / Reader / screen-reader / EpubCheck output, toggled independently from the checks dropdown, below the options bar.

The checks _dropdown_ lives in band 1; the checks _results_ live in band 3. The options bar (band 2) sits between them and is not toggled — it is simply present or absent with the preview.

## Placement rules

- **Inputs go to the options bar; status stays in the header.** An input is something the author sets (flow, columns, page, orientation). Status is something the app reports (transforming, error/warnings, out-of-date, declared FXL page size). The out-of-date **Refresh** is a borderline case kept in the header: it is a response to status ("this is stale") and wants to sit by the title, not among the preview's steady-state controls.
- **The bar appears only when the preview has options.** Responsive and Source have none, so no bar. Print has none _yet_ (see below). The reader views and the scaled device frames do.
- **Disabled in place, never removed.** Within a preview, a control that does not currently apply is shown disabled, not hidden — so nothing in the bar moves as you operate it. The control _set_ still differs between previews (that is expected — you deliberately switched preview), but it never shifts _within_ one.

## Foliate adoption (built)

The reader-engine previews were the first adopter, on the "Option B" model: stable within each preview, set differs per preview.

- **READ.html fill entry** → Reading flow · Columns · Page-picker · Prev/Next. Columns disables under Scroll flow; the pager disables under Scroll or a single-page chapter. No orientation (it is a fill preset).
- **Scaled device presets** (foliate, e.g. Standard / Compact / Kindle) → Reading flow · Page-picker · Prev/Next · Orientation. No Columns — the device width decides column count honestly (the realism argument from `FOLIATE_UNIFIED_PREVIEW.md`); the pager disables as above.
- **Non-foliate scaled device frames** (a device preset over `file://`, or a fixed-layout chapter on a device) → Orientation only.
- **Responsive / Source / Print / fill fixed-layout** → no bar.

Enablement is derived, not branched into existence: `readColumnsEnabled = flow === 'paginated'` and `readPagerEnabled = flow === 'paginated' && readPages > 1`. The page picker keeps a `1 / 1` placeholder option while disabled so the select box holds its width. The bar renders when `usesFoliate(device) || !isFillDevice(device)`.

No new strings — the flow/columns/pager/orientation controls moved verbatim from the old header. `isFillDevice` (desktop/print/read) keeps orientation and the whole bar off the fill presets and Print.

## Reusability

The bar is currently an inline `{#if}` block in `PreviewPane.svelte`, not an extracted component — one adopter did not justify the indirection. The contract a second adopter must follow is small and worth stating so the pattern stays consistent:

- Render band 2 between `.preview-header` and the checks panels, using `.preview-options` (the flex/wrap/gap/`--color-bg-secondary` band) so both toolbars align and wrap identically.
- Only render the bar when the preview actually has inputs.
- Give every control a fixed slot; disable rather than remove; keep a placeholder where a select would otherwise collapse.
- Leave status/read-outs in the header.

If and when Print adopts it (below), factoring the band into a small `PreviewOptionsBar` wrapper (a styled container plus a snippet for the controls) becomes worthwhile; until then the shared `.preview-options` class is the seam.

## PDF / print adoption (proposal — not built)

Print is the natural second adopter, but its inputs live elsewhere today, so this needs a design pass before building.

What the print preview currently surfaces:

- The **device dropdown label** is dynamic — it shows the page size and margins (`printDeviceLabel`, from the `printSettings` prop). Those settings are configured on a _separate_ surface and only reflected here.
- A **Chapter PDF** generate button sits in a footer at the bottom of the pane (`.pdf-footer`), not in the header.
- **Fit-to-width** is automatic on resize (no control).
- The out-of-date **Refresh** and the paginating spinner are status.

A print options bar could bring the print-specific _inputs_ inline, the way foliate's flow/columns are inline rather than buried in settings — candidates: **page size**, **margins**, and the **include-head** toggle. That would make the print preview self-contained (change margins and see the pages re-paginate without leaving the pane) and retire the encoded dropdown label. The **Chapter PDF** action is an action, not an input; it could stay a footer or move to the bar — a judgement call.

Open questions to settle before building:

1. Which print settings become inline options (page size / margins / include-head), and which stay on the export-settings surface? Duplicating them in two places invites drift.
2. Does re-paginating on every inline change feel right, or should print keep an explicit Refresh (its pagination is heavier than foliate's live re-flow)?
3. Where does **Chapter PDF** live — footer (as now) or the options bar?

None of this blocks the foliate work; it is captured here so print slots into the same three-band structure rather than reinventing its own header when the time comes.

## Status

- **Built:** the three-band header; the foliate options bar (Option B); disabled-in-place styling for the bar's selects and pager buttons.
- **Deferred:** the print/PDF adoption above (its own design pass); extracting a `PreviewOptionsBar` component (only worth it at two adopters).
