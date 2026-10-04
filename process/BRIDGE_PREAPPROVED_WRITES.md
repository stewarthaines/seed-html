# Bridge — pre-approving prose writes for a session

**Status:** built 2026-10-04 on `feat/bridge-preapproved-writes`, not yet merged. Follow-on to `process/BRIDGE_WRITE_REVIEW.md`, whose code/content tiering this keeps unchanged.

## The problem

A write from an agent raises a consent prompt the first time it happens in a session, and an agent's first write often comes many minutes after it connects: it reads the project setup, the transform scripts and the chapters first, and may run a long research pass before writing anything. The author has to stay at the screen for that first prompt, or it times out after 90 seconds and the agent has to resend. On 2026-10-03 a single script write timed out four times while the author was away.

The author usually knows at connect time that they intend to let the agent write prose for this session. There is no way to say so until the first prompt appears.

## The change

Add a third control to the overlay's actions row, beside `Disconnect` and `Sound on`: a toggle that shows and sets the session write grant for content-tier writes.

- Off (the default): `Writes: ask`. Content writes prompt inline, as today.
- On: `Writes: allowed`. Content writes proceed without a prompt; each still lands in the feed with its size and hash.
- A `title` (or a second line in the label) says that scripts are still reviewed, so a diff dialog for a code write is not a surprise.

It follows the `Sound on` pattern: a button labelled with its current state, `aria-pressed` reflecting it, keyboard-operable as a native button. The overlay is dev-only and its strings are hard-coded English, so no catalog work is involved.

## Rules

**Not persisted.** Unlike the sound setting, the toggle is never written to storage. It starts off on every connection and dies with the socket, as the grant does today. A persisted toggle would be the standing authorisation `BRIDGE_WRITE_REVIEW.md` item 4 warned against.

**Scoped to the open project.** The grant records the workspace id it was given for. When the open project changes, the grant is cleared and the toggle repaints to off. A write is covered only if the grant's workspace id equals the write's pinned `requestWorkspaceId`. This closes a gap the existing `Allow this session` button already has: today a grant made on one book survives a project switch within the same connection.

**One source of truth.** The toggle and the prompt's `Allow this session` button set the same state. Choosing `Allow this session` in a prompt turns the toggle on; turning the toggle off returns the grant to `none`, so the next content write prompts again. Revoking without disconnecting is new; today the only way to drop a grant is to disconnect.

**Never covers code.** `isCodePath` writes keep their per-write diff review whatever the toggle says. This is deliberate and unchanged.

## What is given up

The first prompt is currently the author's one look at what an agent is about to change (path and `+N −M lines`) before any prose write lands. With the toggle on, the first sight is the feed line after the write. The remaining safeguards are unchanged: expected-hash staleness checks, the dirty-editor check, the read-back ack, the activity feed, track changes when review mode is on, and code review.

The grant covers every agent behind the bridge connection, including subagents an agent spawns. That is already true of `Allow this session`; pre-approval makes it a choice the author makes before seeing any agent's first request.

## Implementation notes

`session` in `start()` (`src/lib/agent-bridge/module.js`) becomes `{ grant: 'none' | 'session', workspaceId: string | null }`. `writeFile` treats a content write as granted only when `session.grant === 'session' && session.workspaceId === requestWorkspaceId`; choosing `session` in a prompt sets both fields.

Clearing on project change needs a signal: `start()` can return a `projectChanged()` alongside `stop`, called by the loader (`loader.svelte.ts`) when the open workspace id changes, which resets `session` and repaints the toggle. The write-time workspace comparison is the backstop if a change is ever missed.

`buildOverlay` gains the toggle and a `setGrant(state)` repaint method, called from the toggle, from the prompt's `session` choice, and from `projectChanged()`.

## Tests

- Unit (`module.test.ts`): the toggle on means a content write raises no prompt; a code write still raises the diff review; toggle off means the next content write prompts; `Allow this session` turns the toggle on; a project change clears the grant; a write whose pinned workspace differs from the grant's is not covered.
- Manual: connect, switch the toggle on, let an agent write a chapter without a prompt, switch projects, confirm the next write prompts and the toggle reads `Writes: ask`.
