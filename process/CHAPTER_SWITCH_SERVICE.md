# Chapter-switch service — design draft

Status: DRAFT for review (2026-07-29). Follows `process/CHAPTER_SWITCH_PERFORMANCE.md`; candidates 1 (stat-based `fileExists`) and 4 (single parse in `doRender`) are already shipped as standalone service fixes. This design covers the remaining candidates — the duplicated loading (2), the echo render (3), and the editor unmount (5) — which share one root cause: the switch sequence has no single owner.

## Motivation

The chapter-switch sequence is spread across `SpineView.svelte` — `loadSelectedItem`, `handleSpineItemSwitch`, `initializeSpineEditor`, store-creation side effects, and pane restoration — inside a component too large for the duplication to be visible. That is why `loadAvailableFiles` runs twice per switch, why one switch performs five-plus full workspace enumerations, and why two independent debounce paths both end in a render. Patching these in place fights the component's lifecycle; extracting the orchestration makes the duplication structurally impossible and, following the coverage workstream's component→service extractions, makes the sequence unit-testable with counted I/O.

## Goals

- One entry point owns a switch end-to-end; every read, enumeration, and render during a switch happens a countable number of times.
- The counts are enforced by unit tests (see Acceptance criteria) so they ratchet instead of regressing.
- `SpineView.svelte` shrinks to UI concerns: binding results to state, pane layout, DOM events.
- Each migration phase is independently shippable (per the feature-branch-per-phase workflow).

## Non-goals

- No change to what a switch produces (same editor content, same preview, same persistence semantics, same events to App).
- No cross-switch caching beyond what already exists in services (workspace mtime cache); see the caching decision below.
- The preview render pipeline itself (`spine-preview-manager`) keeps its ownership; this service coordinates _when_ it runs, not _what_ it does.

## Shape

New module `src/lib/spine/chapter-switch.service.ts` (name open — it orchestrates selection, not just switching):

```ts
interface SwitchDeps {
  workspaceService;
  spineService;
  settingsService;
  extensionManager;
  generatorStore;
  fileStorage;
  previewManager;
}

interface SwitchContext {
  // Loaded once per switch, shared by every consumer:
  workspace: WorkspaceState; // one loadWorkspace (mtime-cached)
  files: string[]; // ONE listFiles enumeration
  settings: EPUBSettings; // one settings read
  previewHead: string;
  extensionPreviewHead: string;
  generators: GeneratorInfo[];
}

interface SwitchResult {
  spineItems: SpineItemWithSource[];
  selectedItem: SpineItemWithSource;
  context: SwitchContext;
  editorContent: { text: string /* pane contents as today */ };
}

class ChapterSwitchService {
  switchTo(idref: string): Promise<SwitchResult>; // coalesces concurrent calls, latest wins
}
```

`switchTo` runs the sequence the trace documented, but deduplicated and explicitly ordered: flush pending saves for the outgoing chapter → build `SwitchContext` (the single enumeration + reads, independent reads in parallel via `Promise.all`) → list spine items (existence via the now-stat-based `fileExists`) → load the incoming chapter's text once and hand the same string to both the editor store and the preview manager → trigger exactly one render.

Consumers change signature, not behavior: `extensionManager.listWorkspaceExtensions` and `generatorStore.listGenerators` accept an optional pre-enumerated `files: string[]` (falling back to their own `listFiles` when absent, so other callers are untouched). `getWorkspaceExtensionInfo` filters the shared list instead of re-enumerating per extension.

## The caching decision (recommendation: per-switch sharing, no orchestrator cache)

The `SwitchContext` is built fresh on every switch and discarded after — the orchestrator holds no state between switches. This deliberately trades a little repeat I/O (one enumeration per switch instead of zero) for having **no invalidation problem**: a manifest edit, extension install, or generator change between switches is picked up automatically because nothing is remembered. Cross-switch caching, where it proves worthwhile, belongs _inside_ the owning service with its own validity story — the workspace mtime cache (`6ed6b7e`) is the precedent: the service that owns the data owns its invalidation. The orchestrator never caches; it only shares within one switch.

## Killing the echo render

Two mechanisms currently produce a second full render (trace, Phase 3); both are ownership problems the service resolves:

- **Store-creation echo**: `createFileBackedStore`'s initial `subscribe` fire schedules a pending save of content that was just read from disk, whose `onSaved` re-feeds the preview. Fix: the store seeds silently — pending-save scheduling starts only on the first _change_ after initialization (skip the synchronous initial emission), so an unedited chapter visit writes nothing and re-renders nothing.
- **Debounce overlap**: `switchToSpineItem` schedules a 300 ms debounced render _and_ the tail of the switch calls `forcePreviewUpdate`. Fix: the service owns the single render trigger — `switchToSpineItem` no longer self-schedules during a switch; the service calls one explicit `renderNow()` when setup completes. The debounce remains what it was meant for: coalescing keystrokes during editing.

## Keeping the editor mounted (phase 3, optional)

`isLoading` currently unmounts `EditorPane` for the whole switch, adding remount reads and making every millisecond a blank spinner. With the service returning a coherent `SwitchResult`, SpineView can keep the pane mounted and overlay a busy indicator, swapping content in place. This is UI-only, riskier to get visually right, and deliberately last.

## Acceptance criteria (the tests are the point)

Unit tests drive the service with a mocked `fileStorage`/services layer that counts calls (happy-dom constraint: stub `loadWorkspace`/OPF parsing per the established pattern). Per single `switchTo`:

- `listFiles`: **≤ 1** call.
- `readFile`/`readTextFile` of the incoming chapter's source: **≤ 1**.
- Full-content reads for existence checks: **0** (stat only).
- Renders triggered: **exactly 1**; pending-save writes for an unedited visit: **0**.
- Concurrent `switchTo(a)`, `switchTo(b)`: b wins, a's render never lands (epoch semantics preserved from `spine-preview-manager`).

These assertions are the regression ratchet: any future feature that adds a read to the switch path has to raise a number in a test and justify it in review.

## Migration phases (each shippable)

1. **Share the enumeration** — extract `loadAvailableFiles` into the service, called once per switch with one `listFiles` passed to generators + extensions; delete the duplicate call. No behavior change; biggest remaining win.
2. **Own the whole switch** — move `loadSelectedItem`/`handleSpineItemSwitch`/`initializeSpineEditor` bodies into `switchTo` with the single-render trigger and the store-seed fix; SpineView keeps thin wrappers. Acceptance tests land here.
3. **Keep EditorPane mounted** — swap the unmount-spinner for an overlay.

## Risks / open questions

- **Pending-saves interplay**: the outgoing flush must still complete before the incoming chapter's stores repoint (cross-project clobber history — see `fix/cross-project-save-clobber`); the service makes this ordering explicit and testable, but the flush semantics themselves must not change.
- **Read-only imported EPUBs**: `renderReadOnlyChapter` is a parallel path today; fold it into `switchTo` as a mode, or leave it separate initially (recommendation: leave separate in phase 1–2, fold in when stable).
- **Hidden lifecycle coupling**: pane restoration touches PaneForge state and `$state` runes; those stay in the component, fed by `SwitchResult` — the risk is discovering mid-extraction that some step depends on mount order. Phase 2 should move one caller at a time.
- **Naming**: `chapter-switch.service` vs folding into the existing `spine.service`. Recommendation: separate module — `spine.service` is data access, this is orchestration; merging them would recreate the everything-owner problem one level down.
