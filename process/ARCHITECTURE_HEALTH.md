# Architecture Health — July 2026

A point-in-time assessment (2026-07-28) and the quality campaign that falls out of it. Evidence: the on-demand diagnostics (`npm run test:coverage`, `npm run knip`), a structural survey (file sizes, timer sites), and the cross-project save-clobber incident fixed the same day on `fix/cross-project-save-clobber` (memory: the debounced-save paths in `SpineView.svelte` carried no workspace identity; a pending save crossed a project switch and overwrote same-named files in the newly opened project).

This is a campaign document, not a design document. Each workstream below is scoped to be picked up in its own session; workstream 1 should get its own design doc (`process/PENDING_SAVES.md`) when implementation starts rather than growing here.

## Diagnosis: strong core, untested shell

Coverage is bimodal, and the split follows the architecture exactly.

| Layer                                                               | Statements coverage | Size                 |
| ------------------------------------------------------------------- | ------------------- | -------------------- |
| zip, metadata, content, agent-bridge, transform, source, extensions | 91–99.5%            | the functional core  |
| epub, storage                                                       | 75–77%              | core with known gaps |
| services: workspace 66%, settings 72%, spine 33%, metadata 33%      | mixed               | the seam             |
| navigation/views (SpineView, SettingsView, ChaptersView…)           | 0% of 3,167 stmts   | the shell            |
| components/spine (PreviewPane, EditorPane)                          | 6.6% of 2,994 stmts | the shell            |
| App.svelte                                                          | 0% of 1,266 stmts   | the shell            |

The five largest files in the codebase are all shell: `PreviewPane.svelte` (3,969 lines), `App.svelte` (2,073), `SettingsView.svelte` (1,928), `EditorPane.svelte` (1,869), `SpineView.svelte` (1,818). Knip reports zero unused files — growth is not leaving orphans behind; it is thickening the same components.

The failure mode this produces: **policy that belongs in the core keeps being born in the shell**, because the shell is where features get wired up. The clobber incident is the proof case — persistence policy (debounce scheduling, save-identity guards, flush semantics, workspace lifecycle) lived inline in an untested 1,800-line component, was wrong in a way no test could catch, and its fix is again inline policy in the same file, regression-tested only by hand.

The July 2026 decision to keep component coverage out of any ratchet stands: workflow-first Storybook covers presentational behavior. The correction is narrower — **components must not own policy**. When a view accumulates scheduling, persistence, or identity logic, that logic gets extracted into a testable module and the view keeps only the wiring.

## Workstream 1 — extract the pending-saves manager (first; highest value)

**Problem.** `SpineView.svelte` owns two debounced save paths (the file-backed store subscription and `debounceAutoSave`), plus the epoch/flush machinery added by the clobber fix. The semantics are now correct but exist only as inline code and comments; they cannot be regression-tested.

**Shape.** A module (e.g. `src/lib/editor/pending-saves.ts`) owning scheduled writes keyed by `(workspaceId, path)`:

- `schedule(workspaceId, path, getContent, {delay, onSaved})` — capture identity at schedule time, never read reactive state at fire time.
- `invalidateWorkspace(oldId)` — bump epoch, flush every pending save to the workspace it was scheduled against, cancel timers. This is the workspace-switch hook.
- `cancelAll()` / per-path cancel for chapter switches, preserving current SpineView semantics.
- Fire-time contract: epoch checked on entry and re-checked after every await before any side effect that touches current-workspace objects (preview manager, blob cache).

SpineView (and later PreviewPane/EditorPane) consume it; the preview-feed guard keeps its path check for within-project chapter switches, but the cross-project case is the manager's job.

**Tests to encode (the incident, as fixtures):** pending save fires after project switch → writes to the captured workspace, not the current one; same-named chapter in the new project is untouched; flush-on-switch preserves the last keystrokes; fire-after-destroy is a no-op beyond the captured-workspace write; epoch re-check after await blocks preview side effects when the switch lands mid-save.

**Acceptance.** The clobber scenario exists as a failing-then-passing unit test; SpineView's own timer count drops to zero for save scheduling.

## Workstream 2 — PreviewPane timer audit, then decomposition

**Problem.** `PreviewPane.svelte` has 11 `setTimeout`/`setInterval` sites — the densest concentration of scheduled work in the app, in its largest file, at 0% coverage. Every one is a candidate for the incident's bug class: a closure that outlives its lifetime or captures reactive state at fire time. (`PublishView.svelte` and `PluginPanel.svelte` have 4 each; audit them with the same checklist afterwards.)

**Method.** One pass over each site answering: what does the closure capture; can its lifetime cross a chapter switch, project switch, or view unmount; what does it touch when it fires. Verdict per site: safe as-is (say why), needs an epoch/identity guard, or belongs in the workstream-1 manager.

**Acceptance.** A short table in this repo (site → verdict → action) and the guards applied. Decomposing PreviewPane itself is a follow-on, not part of the audit — but the audit output is the map for where to cut.

## Workstream 3 — service-layer coverage: spine, transform-engine, metadata

**Problem.** The weakest tested code that is _already extracted and testable_: `spine.service.ts` (33% of 453 stmts — the domain the whole editor orbits), `transform-engine.ts` (17% of 361), `metadata.service.ts` (33%).

**Approach.** Straight unit-test writing, no refactoring required. Constraint to respect: happy-dom cannot parse namespaced OPF — stub `loadWorkspace`/`parseOPFMetadata` as established in existing service tests. When an area reaches a stable plateau, consider a per-directory coverage lock (the agreed eventual shape, matching the lint-ratchet philosophy) — services are the natural first candidates, not components.

**Acceptance.** spine.service and metadata.service above ~70%, transform-engine above ~60%, and a decision recorded on whether to lock them.

## Workstream 4 — type-contract consolidation

**Problem.** Knip reports 178 unused exported types (stable vs. the 175 baseline); the interesting subset is _duplicated contracts_, i.e. stale design docs living in the type system:

- `TransformContext` and `TransformScript` each defined in both `src/lib/transform/types.ts` and `src/lib/types/spine-editor.ts`.
- `types/spine-editor.ts` is a ~380-line designed-up-front contract the implementation largely never adopted (`EditorMessage`, `EditorResponse`, `SpineItemEditorEvents`, `Result`, `DeepPartial`, …).
- `OPFDocument`/`SpineItem` re-exported through three barrels (`epub/index.ts`, `services/epub/epub-processor.service.ts`, `workspace/types.ts`); the `epub` and `source` barrels re-export type surface nothing imports.

**Approach.** Keep one definition per contract where the implementation actually lives; delete the aspirational remainder of `spine-editor.ts` (whatever is genuinely used moves next to its consumer); prune barrel re-exports. The deliberately deferred knip categories are untouched: service `*Error` classes (intentional API surface), i18n (ka in flight), generated icons index (owned by `scripts/generate-icons.js`).

**Acceptance.** Unused-type count drops substantially and — more important — no contract has two definitions. Cheap, mechanical, good candidate for a tightly-specified delegated session.

## Workstream 5 — housekeeping (fold into other sessions)

- `ws` is an unlisted dependency of `scripts/agent-bridge.mjs` — add to devDependencies or knip ignore.
- Track-changes surface (`isReviewMode`, `CHANGES_WORKSPACE_ID`) is unused pending the feature — confirm it is still on the roadmap; otherwise it joins workstream 4.
- Quota-exceeded handling remains the known open storage item (silent persistence divergence when storage fills, worst on Safari). It is a feature, not a cleanup — schedule it on its own merits.

## Sequencing

1 → 2 are one arc (extract policy, then audit the next component with the tooling and pattern in hand). 3 and 4 are independent and parallelizable; 4 is delegable. 5 rides along. Each numbered workstream is roughly a session; if workstream 1's design discussion grows past a screen, move it to `process/PENDING_SAVES.md` and keep this document as the index.
