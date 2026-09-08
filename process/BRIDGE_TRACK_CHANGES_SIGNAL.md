# Telling the agent that track changes is on

_Proposed and built 2026-09-08: `reviewMode` on project info (and so on project setup), the review-mode sentence in the setup hint, `reviewMode`/`baseCaptured` on write results with a "base kept" feed line, and the guide paragraph. Items 1–4 below are as shipped._

## The gap

With the project's **track changes** toggle on (`track_changes: true` in `SOURCE/settings.json`, "review mode" in the code), the app snapshots each trackable file's pre-edit bytes to `SOURCE/main/<path>` the first time a write changes it (`src/lib/track-changes/base-snapshot.ts`, called from `workspaceService.writeFile`). Bridge writes go through the same service, so an agent's first real edit to a chapter makes a `SOURCE/main/SOURCE/text/<chapter>.txt` appear.

Today the agent learns none of this. In the Parry session the copy agent's writes created five such files, `seed_list_files` showed them, and the coordinating agent reported them to the author as an unexplained side effect. Nothing had gone wrong, but the agent could not know that, and a less careful agent might have tried to "tidy" them (the write policy refuses `SOURCE/main/`, so the attempt fails, but with a puzzling error) or counted them as chapters.

What the bridge exposes now:

| call                               | carries the flag?                                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seed_project_info`                | no — `workspaceId`, `title`, `language`, `userAgent` only                                                                                                        |
| `seed_get_project_setup`           | incidentally — it returns `SOURCE/settings.json` whole, so `track_changes: true` is in the payload, unnamed and unexplained; only required before chapter writes |
| `seed_write_file` result           | no — `{ written, size, hash, verified }`                                                                                                                         |
| the author toggling it mid-session | nothing; the bridge has no push channel to the agent                                                                                                             |

`docs/AGENT_AUTHORING.md` says `SOURCE/main/` is app-owned, which stops writes there, but does not say when it fills up or why.

## Proposal

Three small, descriptive additions. No new tool, no push channel.

### 1. `project_info` reports review mode

Add `reviewMode: boolean` to `getProjectInfo()` in `src/lib/agent-bridge/loader.svelte.ts` (from `appState.reviewMode`, which already mirrors the setting on load and on toggle). It flows into `seed_project_info` and, because `project_setup` spreads `getProjectInfo()`, into `seed_get_project_setup` as well. This is the cheapest call and the one every agent makes first, and it is read live, so an agent that checks it after a long gap sees the current value.

Update the `seed_project_info` description in `scripts/agent-bridge.mjs` to name the field: "… and whether the project is in review mode (track changes), which snapshots each file's pre-edit content under `SOURCE/main/` on first change."

### 2. `project_setup` explains the flag in its hint

The `hint` field on `project_setup` already describes the pipeline. Add one sentence, still descriptive rather than imperative (the prompt-injection assessment's rule for that field): "`settings.track_changes` true means review mode: the app keeps a base copy of each edited chapter source, stylesheet and script under `SOURCE/main/<path>` from its first change, for a later patchset; `SOURCE/main/` is app-owned."

### 3. Write results say when a base was captured

Return `reviewMode: true` on every `write_file` result while the mode is on, and `baseCaptured: 'SOURCE/main/<path>'` on the write that created the base. The snapshot code already dispatches `seed:base-captured` on `window` with the path; `writeFile` in `module.js` can subscribe before it calls the service and read the flag after. This covers the mid-session toggle without a push channel: the agent's next write tells it, at the moment it matters, and the activity feed line can say "base kept" for the author too.

Where the write result cannot see the event (a race with an identical-content write, which the snapshot code skips on purpose), `reviewMode` alone is still correct.

### 4. One paragraph in the authoring guide

`docs/AGENT_AUTHORING.md`, beside the existing "app-owned" line: what review mode is, that `SOURCE/main/` files are expected once it is on, and that they are the author's base for a patchset and never to be edited, listed as chapters, or "cleaned up". (Structural changes — a new chapter, a manifest item — are not bridge functions in any mode, so the guide need not tie them to review mode.)

## Sketch

```js
// loader.svelte.ts
getProjectInfo: () => ({
  workspaceId, title, language, userAgent,
  reviewMode: appState.reviewMode,
}),

// module.js, writeFile — around the service call
let baseCaptured = null;
const onBase = e => { if (e.detail?.path === path) baseCaptured = BASE_PREFIX + path; };
window.addEventListener('seed:base-captured', onBase);
try { await ctx.writeFile(...); } finally { window.removeEventListener('seed:base-captured', onBase); }
const info = ctx.getProjectInfo();
return {
  written: true, size, hash, verified: true,
  ...(info.reviewMode ? { reviewMode: true } : {}),
  ...(baseCaptured ? { baseCaptured } : {}),
};
```

`BASE_PREFIX` is exported by `base-snapshot.ts`; `module.js` is plain JS loaded as an asset, so either pass the prefix through the loader context or repeat the literal with a comment pointing at the source.

## Tests

- `loader`: `getProjectInfo().reviewMode` follows `appState.reviewMode`.
- `module.test.ts`: a write in review mode returns `reviewMode: true`; a write that fires `seed:base-captured` for its path returns `baseCaptured`; a write that fires it for another path does not; outside review mode neither field appears.
- `project_setup` hint text contains the review-mode sentence (string assertion, as for the existing hint).

## Out of scope

- A push notification when the author toggles the setting. The agent only hears tool responses; adding a server-initiated message type is a larger change than the problem warrants, and item 3 covers the case that matters.
- Exposing the patchset or diff to the agent. The base is the author's; `seed_get_checks` and the rendered chapter remain the agent's view of the project.
- Letting the agent turn the mode on or off. Settings writes are excluded from the bridge by design.
