# Agent bridge: core-app design (Option B)

Design of record for the live-session agent bridge — an author working in SEED.html grants a terminal coding agent read (later write) access to the open project. **Canonical**: supersedes the plugin-framed spike, the dock-plugin sketch, and the retired workflow survey (`process/AGENT_AUTHORING_WORKFLOWS.md`, deleted; its durable non-bridge material is in the appendix here, and its full text is in git history). Status: proposed, for review — nothing below is built except where marked.

## Decision summary

- **Core app owns the socket, not a plugin.** The consent gesture ("allow agent assistance") is an app-level act, and tool execution belongs next to the app services that make writes correct (state propagation, track-changes copy-on-write). Dev-only, at zero production cost: the module is a dev-middleware-served asset; core carries only the button (build-time folded) and a loader stub.
- **Chat stays in the terminal; the app contributes pointing and consent.** The agent's conversation loop, context, and approvals live in Claude Code (or any MCP client). The app's unique contributions are deixis — "what is the author pointing at" as a tool over the existing click-to-source pipeline — and the visible record of agent actions.
- **Topology (three parts, two legs):**

```
terminal agent ── MCP over stdio ── scripts/agent-bridge.mjs ── WebSocket (localhost:8747) ── app module
```

The agent registers the bridge once: `claude mcp add seed-bridge -- node scripts/agent-bridge.mjs`. The agent never sees the WebSocket; the app never speaks MCP.

**Bridge lifetime = agent-session lifetime.** Stdio MCP servers are spawned by the session that uses them and killed when it ends — the bridge is not a daemon. Practical consequence: start the interactive agent session first and leave it running, then click "Allow agent assistance"; when the session exits, the pill parking at "disconnected — bridge closed the connection" is expected behavior. (A `claude mcp list` health check spawns the bridge for only a couple of seconds — connecting inside that window drops immediately.) A shared long-lived bridge process would need an HTTP/SSE MCP transport instead; noted as an option if the session-bound lifetime proves annoying in practice.

## UX

### The gesture: "Allow agent assistance"

- Button in the sidebar footer (`src/lib/Sidebar.svelte`, `.sidebar-footer`, line ~503), left of Package EPUB. Icon: `Robot` from the phosphor-svelte set. The button itself renders only when `import.meta.env.DEV` (build-time folded from production; if the bridge ever ships to production, that one-line gate change is the only rebuild the feature needs — the module is already a published asset).
- Click fetches the module (first time) and connects the WebSocket; the button shows a pressed/active state while allowed. Click again disconnects and tears down the overlay.
- Consent is **per-session, never persisted** — each session's first connection is a deliberate human act. This is the foundation the write-approval model builds on.
- Bridge not running → transient failure state on the button naming the command (`node scripts/agent-bridge.mjs`).
- **No auto-reconnect, ever** (decided): the gesture means "this app session may be assisted", but any dropped socket — bridge exited, agent restarted — parks the overlay at disconnected, and reattaching is a fresh click. One click, no ceremony, since session consent stands; write grants (phase 2) are per-connection and reset on every new connection regardless.
- Dev-only strings stay untranslated (no catalog cost): the module's strings live in the served asset outside the lint scan; the button's label/tooltip carry the linter's inline `<!-- i18n-ignore -->` with a brief why-comment.

### The connection surface: agent activity overlay

- **Module-owned** (decided): core provides only a mount element at the app root (beside the toast host); the fetched module paints and updates the pill/feed itself — hand-rolled DOM in the spike's style, themed via the context object's theme field. No overlay component exists in core (a core Svelte component would ship as dead code in every production bundle, since the asset gate is a runtime fact).
- Position: bottom edge, above navigation (toast z-token family). Styling: the sr-caption family — dark translucent, rounded, monospace lines — not toast styling; it is a persistent surface, not a notification.
- **Collapsed (default): a pill** — state dot (connected / agent active / disconnected) + the most recent action line ("read `OEBPS/Styles/page.css`"), brief pulse on activity.
- **Expanded (click): the action feed** — one line per tool call, scrolling, newest last; disconnect button. Every tool invocation appears here; the feed is the trust surface ("literally everything the agent has done"), and later the write-approval prompts render inline in the feed rather than as modals.
- **The bottom edge belongs to the agent overlay.** Companion change (decided): toasts move to the top of the screen and all auto-dismiss on a timer — notifications are transient and glanceable; the bottom is for persistent surfaces. The sr-caption stays inside the preview viewport and doesn't collide.

## Technical detail

### Packaging: lazy-loaded app-realm module (the axe model)

The module ships as a **lazily fetched static asset**, not core-bundle code — the pattern already proven three times (axe-core, Paged.js, the virtual screen reader), applied to app-realm code instead of iframe-injected code:

- Core carries only the sidebar button plus a loader stub (~0.5KB): clicking "Allow agent assistance" runs `import(new URL('agent-bridge/module.js', document.baseURI))` and hands the module a context object with the stores/services its tools need.
- The asset is served by the **dev middleware only** (same mechanism as the plugins/extensions dev catalogs), and `file:` exclusion falls out of the same http-only gating as axe. Shipping it in production someday means publishing the asset to `public/` plus the one-line button-gate change (see UX) — a trivial rebuild, deferred rather than baked in.
- Cost accounting (measured at phase 1): the loader, module, protocol strings, and button markup are all absent from the production bundle (string-absence canary in `scripts/smoke-build.js`); the residue is ~1KB — the button's scoped CSS rules (Svelte styles aren't branch-folded) and the `Robot` glyph riding in the generated icon subset. The module's real weight is fetched only when the author clicks.
- The module runs in the app realm with full service access — everything that motivated Option B over the plugin framing — while matching a plugin's distribution economics.

### App module (asset: served at `agent-bridge/module.js`; source under `src/assets/` or a dev-middleware-mapped location — decide at build time)

- The module: connection state (`$state` via the handed-in context), the socket, the action log, tool dispatch.
- Wire protocol to the bridge (unchanged from the spike): app → `{ hello: 'seed-agent-bridge', projectId }` on connect; bridge → `{ id, tool, params }`; app → `{ id, ok: true, result }` | `{ id, ok: false, error }`. The bridge process needs no changes for phase 1.
- Tool execution goes through app state and services, not raw OPFS where avoidable. Active workspace comes from app state directly — no init-re-send or workspace-switch protocol (a problem the plugin framing had; dissolved here). Every dispatch appends to the action log the overlay renders.

### Tool inventory

Phase 1 (read-only — parity with the spike, plus the two reads only the app can serve):

| Tool                      | Serves from                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `seed_project_info`       | app state: workspace id, title, book language, connection state                                                                                                                                  |
| `seed_list_files`         | workspace directory walk (as spike; path + size)                                                                                                                                                 |
| `seed_read_file`          | file read; text only, binary/oversized → `{ binary, size }`; traversal rejected (as spike)                                                                                                       |
| `seed_get_rendered_xhtml` | the current chapter's generated XHTML from the transform pipeline state — unreachable from the plugin, trivial here                                                                              |
| `seed_get_selection`      | last click-to-source hit: `{ text, documentPosition, elementType, chapterId }` — deixis; needs PreviewPane to record its `onPreviewClick` payload into a store the module reads (small addition) |

Phase 2 (writes — designed, not in scope for the first build): **modify-in-place only — debugging existing resources, not content creation.** `seed_write_file` may overwrite an **existing, non-generated** file; the boundary is pipeline-shaped, not directory-shaped: the agent writes pipeline _inputs_ and standalone assets (`SOURCE/text/`, `SOURCE/scripts/`, `SOURCE/preview/`, `OEBPS/Styles/`, `OEBPS/Scripts/`, `OEBPS/Images/` and other media), never pipeline _outputs_ (generated `OEBPS/Text/*.xhtml`, the nav) — writing an output invites the delayed-silent-revert trap: the write lands and previews fine, then the next transform run regenerates the file and the work evaporates. Creating files is excluded entirely: a new manifest item is an OPF mutation (entry + derived properties), not a file write — deferred as a future `seed_add_manifest_item` tool wrapping `workspaceService.addManifestItem` (which already handles OPF entry, propagation, and properties). Each write carries the content hash from the agent's prior read, rejected on mismatch ("changed since read"). Writes route through app services so state propagation and track-changes copy-on-write hold by construction; open-editor dirty state refuses the write. OPF/settings stay excluded until service-level mutations exist. Binary overwrites (images, media) get a size cap and a feed line of path + size — the trust surface can't show a reviewable diff for them, stated honestly. Consent steps up: first write per session prompts in the overlay feed (allow once / allow this session).

Phase 2 also owes the overlay an accessibility pass (`aria-live` on the action feed so connected screen reader users hear what the agent does — the trust surface should not be sighted-only).

Phase 3 (capture): geometry (element rects from the preview document — the app has same-origin access), then `getDisplayMedia` pixels. Recorded in W6; not designed here.

### Retirement of the plugin spike

`plugins/agent-bridge/` is deleted when phase 1 lands, along with the `devOnly` manifest support in `scripts/generate-plugin-manifest.js` if nothing else consumes it by then (currently nothing does). The bridge process and its wire protocol survive unchanged; the e2e driver pattern (spawn bridge, speak MCP over stdio, exercise tools) is reused for verification.

## Testing

- Unit: the module's protocol handling against a fake WebSocket (request dispatch, error shaping, log append, disconnect teardown); tool handlers with stubbed services. Vitest + happy-dom.
- E2E: the existing driver approach — spawn `scripts/agent-bridge.mjs`, speak MCP over stdio, exercise every tool against the dev server with assistance enabled; verify the no-consent case (socket refused until the button is clicked).
- Build gate: production build contains no agent-bridge code (string-absence check in the build smoke), `npm run validate` green.

## Open questions for review

1. ~~Overlay placement~~ — resolved: toasts move to the top of the screen and all auto-dismiss on a timer; the agent overlay owns the bottom edge.
2. ~~Auto-reconnect~~ — resolved: **no auto-reconnect.** The gesture means "this app session may be assisted", but a dropped socket (agent restarted, bridge exited) parks the overlay in a disconnected state and reattaching is a fresh click — one click, no ceremony, since session consent stands. Write grants (phase 2) are per-connection regardless: every new connection re-prompts on first write.
3. ~~`lint:i18n` treatment~~ — resolved: the module's strings are a served asset, outside the lint scan; the button's label/tooltip in `Sidebar.svelte` carry `<!-- i18n-ignore -->` with a comment (dev-only, absent from production, deliberately untranslated) — the linter's existing inline opt-out, preferred over growing `ALLOW_EXACT` with feature-specific entries.
4. ~~Selection capture~~ — resolved: **clicks only.** Content workflows are out of scope for the bridge (layout and transforms are the mission), so element-level deixis via the existing click-to-source payload is the design, not just the v1 cut. The tool returns `{ kind: 'click', … }` so a range kind could join later without a schema break, but none is planned.
5. ~~Port collision~~ — resolved: **fixed port 8747, no scanning, single active bridge, fail alive.** On EADDRINUSE the bridge does not crash: it stays up as a working MCP server whose every tool call returns "port 8747 is in use — another agent session or an orphaned bridge is already running", so the error surfaces in-band where the agent reads it and relays it in plain language (a crashed process would leave the user a dead MCP server and a mystery). One agent at a time is the model — the consent gesture approves _an_ agent, singular. Likewise one app tab: newest connection wins, the displaced tab's socket closes and (per the no-auto-reconnect decision) its overlay parks at disconnected.
6. ~~Overlay ownership~~ — resolved: **module-owned.** Core provides only the mount element; the fetched module paints and updates the pill/feed itself (hand-rolled DOM in the spike's style). Rationale: the asset-packaging gate is a runtime fact, so a core-owned Svelte component would ship as dead code in every production bundle — module ownership keeps both zero core bytes and runtime gating, and feed evolutions (write-approval prompts) ship by updating the asset, not the app. The module receives the app theme in its context object so the overlay respects light/dark without token machinery.

## Appendix: other agent pathways (from the retired workflow survey)

Durable material from `process/AGENT_AUTHORING_WORKFLOWS.md` (deleted; full analysis in git history):

- **Context pack / "Copy context for AI"**: one-click assembly of the authoring contract (inlined), a sample chapter source + its generated XHTML, active styles/transforms, settings, manifest media listing, and book language — the clipboard workflow for any chat agent on any device, offline app included. Every transport (clipboard, archive, this bridge) consumes the same capability surface and the same contract; build the pack and the contract once.
- **Project archive in Claude Code**: export `SEED.zip` → agent edits and headlessly tests transforms (harness pattern: `src/lib/transform/test/event-dates-sample.test.ts`) → re-import. Where a generated `AGENTS.md` inside SOURCE/ belongs.
- **Distribution follow-ups**: `/llms.txt` + hosted markdown authoring contract on readitinabook.com; `AGENTS.md` generated into SOURCE/; a seed-authoring Agent Skill. Prerequisite for all of them (and for the context pack): resolve the `settings.json` schema discrepancy (`src/lib/source/types.ts` vs `src/lib/settings/API.md`).
- **Embedded-frame variants** (recorded, unbuilt): a same-origin harness page wrapping the app; a cross-origin embed via postMessage bridge (storage partitioning means the project travels through the bridge) — the "embeddable EPUB engine" shape.
