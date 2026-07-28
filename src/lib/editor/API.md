# Pending-Saves Manager API

Debounced, workspace-safe file persistence for editor surfaces. Design rationale: [process/PENDING_SAVES.md](../../../process/PENDING_SAVES.md) (workstream 1 of the July 2026 architecture-health campaign).

The manager owns every save timer so that no component touches `setTimeout` for persistence. Save identity (`workspaceId`, `path`) is captured when a save is scheduled and is immutable from then on; content is pulled when the save fires; side effects run only if the workspace has not switched. This encodes the contract established by the cross-project clobber fix as testable behavior.

## Overview

One factory, one interface:

- `createPendingSaves(config)` — builds a manager around an injected write function.
- `PendingSaves` — `schedule`, `invalidateWorkspace`, `flush`, `flushAll`, `cancel`, `destroy`, `settled`.

A view owns one manager instance for its lifetime and wires three lifecycle points: workspace switch → `invalidateWorkspace()`, chapter switch → `flushAll()`, unmount → `destroy()`.

## createPendingSaves()

```typescript
createPendingSaves(config: PendingSavesConfig): PendingSaves
```

**Input:**

- `config.write: (workspaceId: string, path: string, content: string) => Promise<void>` — the single write path. All persistence goes through this function; inject a service adapter in production and a recording fake in tests.
- `config.delay?: number` — default debounce delay in ms (default 300).

**Output:** A `PendingSaves` instance.

**Side Effects:** None at creation; the manager is inert until `schedule` is called.

**Usage:**

```typescript
const pendingSaves = createPendingSaves({
  write: (workspaceId, path, content) => workspaceService.writeFile(workspaceId, path, content),
});
```

## schedule()

```typescript
schedule(workspaceId: string, path: string, getContent: () => string, opts?: ScheduleOptions): void
```

**Input:**

- `workspaceId` — the workspace this save belongs to, captured now. The fire-time closure reads nothing reactive.
- `path` — workspace-relative file path, captured now.
- `getContent` — pulled when the save fires or flushes, so coalesced schedules persist the latest content. Must remain valid until the key settles (see `invalidateWorkspace`).
- `opts.delay?` — per-schedule debounce override.
- `opts.onSaved?: (content: string) => void` — post-save side effects (preview feed, blob invalidation). Runs only if the manager's epoch is unchanged after the write settles — never for a save whose workspace has been switched away from, never on flush.

**Output:** `void`. Idempotent per `(workspaceId, path)`: re-scheduling resets the timer — this is the debounce. The latest `getContent`/`opts` win.

**Side Effects:** Starts or resets a timer. When it fires: one call to `config.write` (serialized per key — a slow older write can never land after a newer one), then `onSaved` if the epoch still matches. Write failures are logged (`console.error`) and swallowed; the entry clears and the next edit re-schedules. Calling after `destroy()` logs an error and does nothing.

**Usage:**

```typescript
store.subscribe(() => {
  pendingSaves.schedule(workspaceId, filePath, () => store.getContent(), {
    onSaved: content => previewManager?.updateContent('text', content),
  });
});
```

## invalidateWorkspace()

```typescript
invalidateWorkspace(): void
```

**Input:** None.

**Output:** `void`.

**Side Effects:** Bumps the internal epoch — every scheduled fire and every pending `onSaved` is orphaned — then flushes each pending save to the workspace it was scheduled against: timers are cancelled, `getContent` is read **synchronously during this call**, and the writes are dispatched fire-and-forget. Call **before** tearing down the stores that back `getContent`.

**Usage:**

```typescript
$effect(() => {
  if (workspace?.id !== previousWorkspaceId) {
    pendingSaves.invalidateWorkspace(); // flush to the OLD workspace first
    destroyEditorStores(); // then it is safe to tear down
  }
});
```

## flush() / flushAll()

```typescript
flush(workspaceId: string, path: string): void
flushAll(): void
```

**Input:** `flush` targets one pending key; `flushAll` targets every pending key. Unknown keys are a no-op.

**Output:** `void`.

**Side Effects:** Cancels the timer(s) and writes immediately using the captured identity and current `getContent()`. `onSaved` does not run — the caller is mid-transition (chapter switch, unmount) and side effects would target the wrong context. Flushing (not cancelling) on chapter switch is deliberate: it closes the loss window for edits made just before the switch.

**Usage:**

```typescript
async function updateSpineSpecificContent() {
  pendingSaves.flushAll(); // settle pending edits before repointing panes
  // ...
}
```

## cancel()

```typescript
cancel(workspaceId: string, path: string): void
```

**Input:** The key to drop.

**Output:** `void`.

**Side Effects:** Cancels the timer and discards the pending save without writing. Only for content known to be invalid (e.g. the caller refused to autosave syntactically broken JavaScript).

## destroy()

```typescript
destroy(): void
```

**Input:** None.

**Output:** `void`.

**Side Effects:** `flushAll()` plus rejection of further `schedule` calls (logged error, no-op). For `onDestroy`; call while the stores backing `getContent` are still alive.

## settled()

```typescript
settled(): Promise<void>
```

**Input:** None.

**Output:** A promise that resolves when no timers are pending and no writes are in flight. Resolves immediately if already quiet.

**Side Effects:** None. Test convenience — await it before asserting on the fake writer's calls.

## Type Definitions

```typescript
interface PendingSavesConfig {
  write: (workspaceId: string, path: string, content: string) => Promise<void>;
  delay?: number; // default 300
}

interface ScheduleOptions {
  delay?: number;
  onSaved?: (content: string) => void;
}
```

## Common Integration Patterns

The SpineView wiring — both save paths reduced to `schedule` calls:

```typescript
// Text/CSS/JS file editor store (per open file):
store.subscribe(() => {
  pendingSaves.schedule(workspaceId, filePath, () => store.getContent(), {
    onSaved: content => {
      /* preview feed / blob revocation for the CURRENT workspace only */
    },
  });
});

// Pane content events (CSS/JS), longer settle because a preview refresh is costlier:
pendingSaves.schedule(workspace.id, filePath, () => content, {
  delay: 500,
  onSaved: () => {
    blobURLManager.revokeFileBlob(fileHref);
    previewManager?.forcePreviewUpdate();
  },
});
```

## Error Handling

The manager never throws from timer callbacks. Write and `onSaved` failures are logged with `console.error` and swallowed; a failed debounced write clears its entry (the next edit re-schedules). Flush writes are best-effort: a failure leaves the target workspace with its last successfully saved content.
