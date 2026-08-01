# Bridge hardening — reviewable script writes, and the rest of the injection mitigations

Follow-on to `process/BRIDGE_PROMPT_INJECTION_ASSESSMENT.md`. The trust rule is already in `docs/AGENT_AUTHORING.md`; this plan covers the bridge itself.

**Status:** implemented, except the tripwire scan (built, then removed — see below), the write journal, and the provenance signal. _The rest of the mitigations_ records where each stands.

Headline: **make a write to executable content reviewable with the diff tooling the app already has**, and stop a session grant from covering it.

## Why the diff is nearly free

`writeFile` already reads the target's current bytes — it has to, to check `expected_hash` against them (`module.js:~292`). At the moment the consent prompt is raised, both sides of the diff are already in memory: `currentBytes` decoded, and the incoming `text`. Nothing new needs reading, and no I/O is added to the write path.

What is missing is only the rendering, and the app already has the renderer: `InlineTextDiff.svelte` (`src/lib/components/import/`), whose props are literally `{ current, incoming }` — the two values already in hand. Read-only line diff over jsdiff. It is a drop-in.

**Review is whole-payload: accept or deny.** The track-changes hunk tooling (`src/lib/track-changes/hunks.ts`, `PatchsetReviewDialog.svelte`) could drive per-hunk accept/reject, and is deliberately not used here. Partial acceptance would mean the stored bytes differ from what the agent sent, which breaks the read-back ack and leaves the agent's `expected_hash` silently stale — a protocol problem wearing a UI costume. An agent write is one proposal, taken or refused.

## Tiering writes: code vs content

The current policy treats every writable path identically. It should not: writing prose and writing a script that will execute in the reader's device are different acts.

**Code tier** — `SOURCE/scripts/`, `SOURCE/preview/`, `OEBPS/Scripts/`, plus any `*.js` or `head.xml` under a writable root. These execute: in the app's render pipeline, in the preview realm that holds the `window.seed` channel, and — for `OEBPS/Scripts/` — inside the packaged EPUB on a reader's device.

**Content tier** — everything else currently writable: `SOURCE/text/`, `OEBPS/Styles/`, images and media.

|                      | Content                            | Code                                                        |
| -------------------- | ---------------------------------- | ----------------------------------------------------------- |
| Consent prompt       | inline in the feed, as today       | full diff review                                            |
| Change summary       | `+N / −M lines` on the prompt line | the diff itself                                             |
| `Allow this session` | offered                            | **not offered — every code write is approved individually** |
| Grant lifetime       | bounded (see below)                | n/a                                                         |

The session grant is the specific hole worth closing: today one approval authorises every later write unseen, and the prompt that earned it showed a path and a byte count. A one-line patch to `clip-player.js` and a wholesale replacement are indistinguishable at that prompt.

## Where the review UI lives

The overlay is deliberately imperative DOM inside `module.js` — it is lazy-loaded and kept out of the main bundle (`scripts/smoke-build.js` asserts this). It should not grow a Svelte or jsdiff dependency, and the diff should not be hand-rendered there either; that would be reimplementing `InlineTextDiff`.

So route it the way every other app capability is routed — through the module context. `AgentBridgeModuleContext` (`loader.svelte.ts:12`) already carries `writeTextFile`, `isFileDirty`, `getChecks`, `inspectElements`. Add one more:

```ts
reviewWrite: (req: {
  path: string;
  current: string; // already decoded for the hash check
  incoming: string;
  bytes: number;
}) => Promise<'accept' | 'deny'>;
```

`module.js` keeps the decision logic (which tier, which prompt, re-validate after) and delegates only the rendering.

**This is a deliberate departure from "never a modal."** That rule was aimed at frequent, low-stakes prose writes, and it stays for the content tier. For code, review _is_ the point, and a diff does not fit on a feed line.

## Implementation

1. `isCodePath(path)` beside `isWritablePath` in `module.js`, with unit tests alongside the existing `isWritablePath` ones.
2. `writeFile` computes `current` text (already decoded) and, for the code tier, calls `ctx.reviewWrite(...)` instead of `ui.promptWrite(...)`; the session grant is neither consulted nor offered.
3. App side: a small dialog wrapping `InlineTextDiff` with Accept / Deny, the path and byte count in the header. Same 90s auto-deny as the feed prompt (`CONSENT_TIMEOUT_MS`), same cancel-on-disconnect via `ui.cancelPrompts`.
4. Content tier keeps the inline prompt, plus a `+N / −M` summary. The overlay cannot compute that itself — it is dependency-free imperative DOM and jsdiff lives app-side — so the count comes over the context too: a `diffStat(current, incoming)` alongside `reviewWrite`, with the overlay rendering only the numbers.
5. Re-validate after consent, exactly as now — the existing `validate()` second pass already covers a slow decision.
6. Feed line records the outcome for both tiers, as now.

The agent's contract is untouched throughout: it sent bytes, they landed or they didn't.

## The rest of the mitigations

Ordered by leverage against cost.

1. **Untrusted envelope** — at the single serialization point (`agent-bridge.mjs:326`), wrap project-derived payloads in an explicit delimiter with a header naming them untrusted project data. One change, covers every read tool, pairs with the guide's trust section. Highest leverage available.
2. **De-imperativise the `hint`** (`module.js:236`) — drop "follow syntaxReference where present"; keep "the source syntax is NOT Markdown unless it says so". The bridge should not instruct the agent to obey a file that travels inside the project.
3. **Tripwire scan on read** — **built, then removed. Do not re-propose.** A pattern scan flagging agent-directed text ("ignore previous", role markers, `seed_write_file`, shell fragments) as a `warnings` field plus a feed line. Three things sank it. It is a deny-list on prose, published in an open-source repo, so it doubles as the attacker's checklist. It is English-only in a seven-locale product, so it stays silent for payloads in the other six — and silence in the feed reads as _clean_, making it worst exactly where the product's multilingual ambition is strongest. And it fires on ordinary books: SEED ships `highlight` and `prism` precisely because books contain code, so a fenced `rm -rf` or `curl https://…` trips it, as does any transcript formatted `Assistant:`. False positives would have far outnumbered true ones, teaching the author to skim the activity feed — spending the credibility of the control that works to fund one that does not. The structural mitigations (1 and 2 above, the guide's trust rule, and diff-reviewed code writes) cover this language-independently.
4. **Bound the content-tier grant** — expire it (a few minutes, or a write count) so an idle session cannot be resumed into a standing authorisation.
5. **Write journal** — append-only `(path, hash before, hash after, timestamp)`. **Not done.** The activity feed already records path, size and the resulting hash per write, which covers the in-session case; a durable journal needs a decision on where it lives. The workspace is the wrong home — every writable location is either agent-readable (so a poisoned write could edit its own record) or app-owned. Worth doing once that question is answered, not before.
6. **Provenance in `project_info`** — **not done.** It needs the app to record how a project arrived, and `.workspace-metadata.json` carries no origin field today. That is a data-model change with its own migration, well outside a bridge fix; raised here so the dependency is visible.

## Verification

- Unit: `isCodePath` (including `SOURCE/preview/head.xml` and a `.js` under `OEBPS/Styles/`), the tier routing in `writeFile`, grant-not-offered for code, envelope shaping. The existing bridge module tests (`module.test.ts`) already stub the context, so `reviewWrite` slots into that pattern.
- Manual: an agent write to `OEBPS/Scripts/clip-player.js` must raise the diff dialog every time, even after "allow this session" was granted for a chapter source.
- Regression: content-tier writes still prompt inline and still honour the session grant.

## Note

`docs/AGENT_AUTHORING.md` is read once at bridge startup (`agent-bridge.mjs:33`), so the trust rule added there reaches agents only after a bridge restart.
