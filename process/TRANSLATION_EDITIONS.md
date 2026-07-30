# Translation Editions

Support for translating a finished SEED EPUB into a second language, with the original text visible read-only beside the translation-in-progress, and language choice at export time.

Status: design agreed 2026-07-30; Phase 1 (swap core) implemented on `feat/translation-editions`. Phases 2+ not started.

## Goal and constraints

A finished single-language SEED EPUB (e.g. a Polyphony bulletin in EN) can be turned into a work-in-progress translation (e.g. KA) without disturbing the core machinery:

- The manifest is untouched except for the `dc:language` metadata field.
- The one-to-one link between `SOURCE/text/<id>.txt` and its rendered XHTML is preserved exactly.
- The SEED.zip grows a reference copy of the original text, identified by the language it is being translated from.
- The author sees the frozen original and the editable translation side by side in the existing dual-pane editor and translates progressively.
- The project can later switch back to the original language for further editing, and can export (PDF, plain EPUB) in either language.

## Core decision: the swap model

The **active** language always lives in `SOURCE/text/`. Every **inactive** language lives under `SOURCE/locale/<tag>/`.

Switching the book's language is a transactional swap of the text trees followed by a full re-render. The manifest, the spine, and every `SOURCE/text/${id}.txt` path-template call site (~15 across `chapter-switch.service.ts`, `spine.service.ts`, `SpineView.svelte`, `folder-sync/scan.ts`, and others) stay literally untouched.

The rejected alternative — a reference model where the render pipeline reads from a parameterizable source root — would require threading a source-root parameter through all of those call sites and through `SpinePreviewManager`, for no user-visible benefit.

Under the swap model, "export in language X" is compositional: swap to X (if not already active), regenerate all chapters, package, optionally swap back. No second XHTML set is ever stored, so the manifest's one-href-per-chapter model is never challenged.

## Data layout

```
SOURCE/
  text/                     ← active language, unchanged semantics
    chapter01.txt
    chapter01.json          ← sidecar chapter metadata
  locale/
    en/
      text/
        chapter01.txt       ← inactive language, read-only in the editor
        chapter01.json
      meta.json             ← per-language metadata overrides (see below)
  main/                     ← track-changes bases, unrelated, untouched
```

Notes on the layout:

- Paths under `locale/<tag>/` mirror the workspace-relative layout under `text/`, so the swap is a mechanical prefix exchange. The extra `text/` level leaves room for future per-language assets (e.g. a translated cover) without redesign.
- `<tag>` is the BCP 47 tag as validated by the existing `isWellFormedLanguageTag` (`src/lib/epub/bcp47.ts:34`).
- The SEED.zip archive already round-trips arbitrarily nested paths (track-changes bases are four levels deep); `validateSourcePath` accepts this layout with no changes.
- `SOURCE/locale/**` is **fully separate** from the `SOURCE/main/**` track-changes base machinery. Bases are deletable diff-optimized artifacts (shipped as diffs when smaller, `source-manager.ts:57-77`); locale trees are permanent human-readable files. No shared code paths beyond ordinary file storage.

### Per-language metadata: `locale/<tag>/meta.json`

`dc:language` is not the only language-bearing metadata. A Georgian edition wants a Georgian `dc:title`, and likely description/subtitle. The OPF metadata model is single-valued, so the swap must carry these overrides.

`meta.json` holds the fields that travel with the swap. v1 scope is fixed at exactly three: **title, title sort-as (file-as), description**. Anything further (creator roles, subjects, …) is a slippery slope to everything — deferred to v2.

```json
{
  "title": "…",
  "titleFileAs": "…",
  "description": "…"
}
```

On swap, the outgoing language's current values are written to its `meta.json`, and the incoming language's values are applied to the OPF (falling back to leaving the field untouched if absent). Any OPF field can be added to the override set later without a format change.

## Operations

### Add a translation

Project settings gains a Translations section (near the existing track-changes panel in `SettingsView`).

"Add translation" for target language KA, after a confirmation dialog:

1. Copy `SOURCE/text/**` → `SOURCE/locale/en/text/**` (the frozen original, where `en` is the current `primaryLanguage`).
2. Write `SOURCE/locale/en/meta.json` from the current OPF metadata.
3. Set `metadata.language[0] = 'ka'` (the array already exists; `primaryLanguage()` at `src/lib/epub/opf-utils.ts:130` returns `language[0]` and is the single funnel used downstream). Keep `en` as a secondary entry so the EPUB self-describes as multi-language.
4. Run `regenerateAllChapters()` so every chapter's `xml:lang`/`dir` matches the new primary language.

The starting point is intentionally "no visible change": the active text is still the English text, now understood to be the Georgian edition awaiting translation.

### Switch active language

Same Translations section lists all languages present (active + every `SOURCE/locale/<tag>/`), with a switch action per inactive language.

Switching from KA (active) to EN:

1. Move `SOURCE/text/**` → `SOURCE/locale/ka/text/**`, write `SOURCE/locale/ka/meta.json`.
2. Move `SOURCE/locale/en/text/**` → `SOURCE/text/**`, apply `SOURCE/locale/en/meta.json` to the OPF.
3. Reorder `metadata.language` so the new active tag is first.
4. `regenerateAllChapters()` — **mandatory, not an optimization** (see Correctness below).

### Swap transactionality

A crash mid-swap must not corrupt the project. Before step 1, write a journal file `SOURCE/locale/.swap.json` recording `{ from, to, phase }`; delete it after the final regenerate completes. On workspace load, the presence of this file triggers a resume-or-roll-back of the interrupted swap before anything else runs. Since the swap is move-based (each file exists in exactly one of the two locations at any moment), the journal plus a directory listing is enough to determine and complete the remaining moves deterministically.

### Correctness: language switch must re-render

`xml:lang`/`lang`/`dir` are baked into each chapter's stored XHTML at render time (`src/lib/transform/xhtml-template.ts:57`, fed by `primaryLanguage` at `spine-preview-manager.ts:577`). Changing `dc:language` currently triggers only a workspace-list refresh (`App.svelte:275-285`). PDF export lifts per-chapter `lang` off the **stored** XHTML (`src/lib/pdf/pdf-export.ts:186-189`), so a skipped re-render silently exports text with the wrong language tag — wrong hyphenation, wrong screen-reader voice, wrong font selection.

`regenerateAllChapters()` (`src/App.svelte:668-729`) already does exactly what is needed and is currently called only when an extension adds a stylesheet. Both "add translation" and "switch language" call it.

Related latent bug to fix alongside: the `<package>` element hardcodes `xml:lang="en"` (`opf-utils.ts:970`); it should emit the primary language.

## Editor UI

### Chapter dropdown

`loadAvailableFiles()` in `SpineView.svelte` (433-566) is chapter-scoped and currently offers exactly one text entry, `SOURCE/text/${selectedItemId}.txt`. For each inactive language whose file exists, add an entry `SOURCE/locale/<tag>/text/${selectedItemId}.txt`, labelled by language (e.g. "EN · chapter01.txt"). New `type` (or a `readOnly` flag on the existing shape) in the union at `SpineView.svelte:447`.

### Dual-pane exclusion rule

`updatePaneSpecificFiles()` (`SpineView.svelte:403-428`) hides any `type === 'text'` entry from the other pane to prevent two editors on the same file. Re-key this exclusion on **path** rather than type, so `chapter01.txt` and `locale/en/text/chapter01.txt` can be shown together while two panes on the same path remain blocked.

### Read-only pane

`EditorPane` has no `readOnly` prop today; its textareas are never disabled. Add a per-pane read-only mode (disabled textarea + visual padlock treatment consistent with the existing whole-view padlock notice at `SpineView.svelte:1623-1631`).

Enforcement is defense-in-depth: the UI disables editing, **and** `workspace.service.ts` `writeFile` rejects writes under `SOURCE/locale/**` (except via the swap/add/remove operations, which use a privileged path or a bypass flag). UI-only enforcement is not sufficient.

## Export

### PDF

`exportPdf()` (`src/lib/pdf/pdf-export.ts:458-529`) packages stored XHTML. With the swap model and mandatory regenerate, the stored XHTML always matches the active language, so exporting the active language needs no changes.

Exporting an **inactive** language is swap → regenerate → export → swap back, and could be orchestrated as one user action ("Export PDF… → language picker" when translations exist). **Deferred to v2 at the earliest, possibly never**: the manual route (switch language, export, switch back) uses the same operations and may be all this workflow ever needs. v1 exports the active language only.

### Plain / non-SEED EPUB

Same story: `EPUBPackager.packageEPUB()` is byte-faithful repackaging, so active-language export is already correct. Inactive-language export composes the same way as PDF. The exported plain EPUB naturally excludes `SOURCE/`, so no locale leakage.

The SEED EPUB export includes SEED.zip and therefore carries all languages — the multi-language project travels whole, self-describing, matching the track-changes precedent of state that travels with the EPUB.

## Interactions with existing systems

### Track changes

Review mode locks metadata (`structureLocked`, `App.svelte:205-206`), so language switching is unavailable while track changes is on. This is correct behaviour, not a conflict — surface it as a disabled state with an explanatory tooltip in the Translations section.

`isTrackable()` (`base-snapshot.ts:36-43`) matches only single-level `SOURCE/text/*.txt`, so locale files can never acquire track-changes bases (desired), while the live translation in `SOURCE/text/` **remains trackable** — a reviewer can track-change the Georgian translation itself. Preserve this property; add a test pinning it.

### Chapter rename and delete

Neither spine delete (`spine.service.ts:515-524`) nor rename (`:598-611`) touches `SOURCE/main/**` today — a pre-existing orphaning gap that `SOURCE/locale/**` would inherit. Renaming `chapter01` → `intro` after adding a translation would strand `locale/en/text/chapter01.txt` under the old name, silently dropping it from the dropdown.

Fix both operations to sweep `SOURCE/locale/*/text/` **and** `SOURCE/main/SOURCE/text/` for the matching `<id>.txt` / `<id>.json`, renaming/deleting in step. This closes the old gap and the new one together.

### Source classification

`classifySourceFile()` (`source-utils.ts:27-53`) types unknown directories as `'other'`; add a `locale` classification so the Manifest view's SOURCE listing shows these files meaningfully. `calculateDirectoryStats()` gains a counter. Cosmetic, low priority.

### App UI locale is unrelated

The app's UI language (`SettingsView` language-select, `ENABLED_LOCALES`) is independent of the book's language. The Translations section copy must not conflate them — e.g. adding a KA translation of a book does not require, imply, or enable a KA app UI.

## Translation staleness (v2, design now so v1 doesn't preclude it)

Once the author can switch back to EN and keep editing, the KA translation silently drifts out of date. The frozen `locale/en` copy is effectively the **translation basis**: what the English said when translation began.

The naive swap clobbers this — swapping back to EN moves `locale/en` into `text/`, and the next swap to KA freezes the _edited_ English, losing the basis.

v2 answer: on the first "add translation", additionally snapshot the original under `SOURCE/locale/<tag>/basis/` (or record a content hash per file). The basis is **per-translation** — each translation carries its own snapshot of the language it was translated from, so a KA and a DE translation started at different times each know their own reference point. When the live original diverges from a basis, the existing `diffSegments` machinery (`src/lib/track-changes/hunks.ts`) can show that translator exactly which passages changed since they translated — turning the workflow hole into a feature.

v1 ships without this but must not preclude it: the `locale/<tag>/text/` vs future `basis/` separation in the layout above is the reservation. v1 mitigation: when switching languages while any translation exists, note in the confirmation dialog that edits to this language may leave other editions out of date.

## Resolved questions (2026-07-30)

1. **Basis refresh policy:** per-translation — each translation carries its own basis snapshot. v2.
2. **Sidecar preview caches:** no special clearing on swap. `regenerateAllChapters()` covers the stored XHTML; if anything per-chapter is missed, the working assumption is the translator visits every chapter before a PDF export anyway, and per-chapter renders self-heal.
3. **meta.json field set:** title, title sort-as (file-as), description — fixed for v1. Anything more is a slippery slope to everything; v2.
4. **Remove translation:** confirm-gated delete of `SOURCE/locale/<tag>/` (only when inactive). No undo infrastructure.
5. **Export picker:** v2 at the earliest, possibly never — the manual switch-export-switch route may suffice.

## Implementation phases

Each phase is independently shippable.

**Phase 1 — swap core.** `locale/` layout, add/switch/remove operations with journal transactionality, `regenerateAllChapters` wiring, `language[0]` reorder, `meta.json` overrides, `<package>` xml:lang fix, writeFile guard for `SOURCE/locale/**`. Settings UI: Translations section with add/switch/remove, disabled under review mode.

**Phase 2 — editor experience.** Dropdown entries for inactive-language chapter files, path-keyed dual-pane exclusion, `EditorPane` read-only pane, `classifySourceFile` locale type. Rename/delete sweep of `locale/**` and `main/**`.

**Phase 3 (v2) — staleness.** Per-translation basis snapshot + `diffSegments` "what changed since translation began" view. Extended `meta.json` field set lands here too if wanted.

**Deferred, possibly never — export picker.** Language choice on PDF and plain-EPUB export via swap → regenerate → export → swap back. The manual route (switch language, export, switch back) uses the same operations.
