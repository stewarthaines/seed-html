# Pending-Saves Manager — design

Workstream 1 of [ARCHITECTURE_HEALTH.md](./ARCHITECTURE_HEALTH.md). Extracts the debounced-save policy from `SpineView.svelte` into a testable module, encoding the semantics established by the cross-project clobber fix (`fix/cross-project-save-clobber`, commit `ef3fba6`) as an enforced contract instead of inline code and comments.

## Principle

The debounce timer is the hazardous object — it is the thing whose lifetime crosses chapter switches, project switches, and view unmounts. Whatever owns the timer must own the identity capture, the epoch check, and the flush. Therefore the debounce lives **inside** the manager; callers never touch `setTimeout`. The caller's entire vocabulary is "this file is dirty."

## API

```ts
// src/lib/editor/pending-saves.ts — plain TS, no Svelte dependencies.

export interface PendingSavesConfig {
  /** The one write path. Injected so tests can fake it and so the two current
      APIs (workspaceService.writeFile / fileStorage.writeTextFile) unify. */
  write: (workspaceId: string, path: string, content: string) => Promise<void>;
  /** Default debounce delay ms (per-schedule override allowed). */
  delay?: number;
}

export interface ScheduleOptions {
  delay?: number;
  /** Post-save side effects (preview feed, blob revocation). Runs ONLY if the
      manager's epoch is unchanged after the write settles — i.e. never runs
      for a save whose workspace has been switched away from. */
  onSaved?: (content: string) => void;
}

export interface PendingSaves {
  /** Mark (workspaceId, path) dirty. Idempotent: re-scheduling the same key
      resets its timer — this IS the debounce. Identity is captured now;
      nothing reactive is read when the timer fires. */
  schedule(
    workspaceId: string,
    path: string,
    getContent: () => string,
    opts?: ScheduleOptions
  ): void;

  /** Workspace-switch hook. Bumps the epoch (orphaning every scheduled fire
      and every pending onSaved), then synchronously initiates a flush of each
      pending save to the workspace it was scheduled against. Call BEFORE
      tearing down the stores that back getContent. */
  invalidateWorkspace(): void;

  /** Flush one key immediately (chapter switch), or everything (view
      unmount). Flush = cancel timer + write captured identity with current
      getContent(); onSaved does not run (the caller is mid-transition). */
  flush(workspaceId: string, path: string): void;
  flushAll(): void;

  /** Drop a pending save without writing. Only for content known to be
      invalid (e.g. the caller refused to autosave broken JS). */
  cancel(workspaceId: string, path: string): void;

  /** flushAll + reject further schedules. For onDestroy. */
  destroy(): void;

  /** Resolves when no timers or writes are in flight. Test convenience. */
  settled(): Promise<void>;
}

export function createPendingSaves(config: PendingSavesConfig): PendingSaves;
```

## Contracts

**Identity at schedule time.** `workspaceId` and `path` are captured when `schedule` is called. The fire-time closure reads nothing reactive. This is the rule whose violation caused the incident (`debounceAutoSave` read `workspace.id` when the timer fired).

**Content at fire time.** `getContent` is pulled when the save fires or flushes, so coalesced schedules save the latest content. Ordering contract with the caller: `getContent` must remain valid until the key settles — which is why `invalidateWorkspace()` flushes before the caller destroys its editor stores (the order the workspace-change `$effect` already uses).

**Epoch.** `invalidateWorkspace()` increments an internal epoch. A fire whose captured epoch is stale is a no-op (its content was already flushed). After a write's `await`, the epoch is re-checked before `onSaved` — a switch that lands mid-write silently drops the side effects, never feeds the new workspace's preview objects.

**Per-key write serialization.** Writes for the same `(workspaceId, path)` are chained on a per-key promise so a slow older write can never land after a newer one. Writes for different keys proceed concurrently.

**Flush is best-effort and fire-and-forget.** A flush write failure is logged and swallowed — the old workspace keeps its last-saved content. Nothing in a flush touches current-workspace objects, so it is always safe to call during a transition.

**Errors.** A failed debounced write keeps the key dirty? No — matching current behavior, it logs and clears (the next edit re-schedules). Revisit only if users report loss; note it in the module doc.

## What stays in SpineView

Wiring only:

- The store subscription body becomes `pendingSaves.schedule(workspaceId, filePath, () => store.getContent(), { onSaved })`.
- `onSaved` for text files keeps the within-project guard — `if (path === 'SOURCE/text/' + selectedItemId + '.txt') previewManager.updateContent('text', content)` — because chapter selection is view state. The cross-project case no longer reaches `onSaved` at all (epoch).
- `onSaved` for CSS/JS does blob revocation + `forcePreviewUpdate`; for transforms, `invalidateTransformScripts()`; for preview-head, the `previewHeadContent` update.
- The workspace-change `$effect` calls `invalidateWorkspace()` (then proceeds to destroy stores, as now). `onDestroy` calls `destroy()`.
- `validateAutoSaveStillValid`'s JS-syntax refusal moves upstream: EditorPane already refuses to propagate invalid JS, so the manager never sees it; the chapter-mismatch heuristics are superseded by captured identity and are deleted.

## Behavior changes (intentional improvements)

1. **Chapter switch flushes instead of cancelling.** `updateSpineSpecificContent`'s cancel-all becomes `flushAll()`. The original cancel prevented cross-chapter races; captured identity makes flushing safe, and it closes a pre-existing silent loss window (CSS edits within 500ms of a chapter switch are currently dropped).
2. **View unmount flushes.** Today timers fire after `onDestroy` and happen to write correctly; `destroy()` makes that deterministic.
3. **One delay.** _Outcome: kept two._ The manager defaults to 300ms; the CSS/JS pane path passes `delay: 500` because its `onSaved` triggers a blob revoke plus full preview refresh, costlier than a text re-render — the "reason to differ" this item anticipated. The API's per-schedule override carries the distinction.

## Tests (the incident as fixtures)

Vitest with fake timers and a recording fake `write`; no DOM needed.

- Debounce: N schedules of one key within the delay → one write, latest content.
- Cross-project clobber: schedule in workspace A; `invalidateWorkspace()`; simulate workspace B active; timer fires → exactly one write, to A, with A's content; `onSaved` never runs. A same-named path scheduled later in B writes to B.
- Flush-on-switch preserves keystrokes: schedule, edit content, `invalidateWorkspace()` before the timer → write to A with the post-edit content.
- Mid-write switch: `write` resolves after `invalidateWorkspace()` → write completes (it targeted A), `onSaved` suppressed.
- Serialization: slow write for a key + newer schedule → final content on disk is the newer one, write order preserved.
- Chapter switch: `flushAll()` writes everything pending, timers cleared, `onSaved` not called.
- `cancel` drops without writing; `destroy` flushes and further schedules are rejected (dev-time error).
- `settled()` resolves only after all of the above quiesce.

## Migration

1. Land the module + tests (no consumers) — pure addition.
2. Switch SpineView's two paths to it; delete the inline epoch/flush machinery from the fix; `npm run validate` plus the manual two-project repro.
3. Later adopters, guided by the workstream-2 timer audit: `ExtensionItem.svelte`'s saveTimeout, PluginPanel, PreviewPane sites that are saves (sites that are _render_ scheduling stay with the preview manager, which has its own epoch).

Out of scope: the preview manager's internal render debounce (already epoch-guarded, tested via its own suite), and any change to save UX (delays, indicators).
