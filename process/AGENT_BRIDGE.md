# Agent bridge: core-app design (Option B)

Design of record for the live-session agent bridge — an author working in SEED.html grants a terminal coding agent read (later write) access to the open project. Supersedes the plugin-framed spike and the dock-plugin sketch; the workflow analysis that led here is `process/AGENT_AUTHORING_WORKFLOWS.md` (W6). Status: proposed, for review — nothing below is built except where marked.

## Decision summary

- **Core app owns the socket, not a plugin.** The consent gesture ("allow agent assistance") is an app-level act, and tool execution belongs next to the app services that make writes correct (state propagation, track-changes copy-on-write). Dev-gated behind `import.meta.env.DEV`: zero production bytes.
- **Chat stays in the terminal; the app contributes pointing and consent.** The agent's conversation loop, context, and approvals live in Claude Code (or any MCP client). The app's unique contributions are deixis — "what is the author pointing at" as a tool over the existing click-to-source pipeline — and the visible record of agent actions.
- **Topology (three parts, two legs):**

```
terminal agent ── MCP over stdio ── scripts/agent-bridge.mjs ── WebSocket (localhost:8747) ── app module
```

The agent registers the bridge once: `claude mcp add seed-bridge -- node scripts/agent-bridge.mjs`. The agent never sees the WebSocket; the app never speaks MCP.

## UX

### The gesture: "Allow agent assistance"

- Button in the sidebar footer (`src/lib/Sidebar.svelte`, `.sidebar-footer`, line ~503), left of Package EPUB. Icon: `Robot` from the phosphor-svelte set. Rendered only when `import.meta.env.DEV`.
- Click connects the WebSocket; the button shows a pressed/active state while allowed. Click again disconnects and tears down the overlay.
- Consent is **per-session, never persisted** — each session's first connection is a deliberate human act. This is the foundation the write-approval model builds on.
- Bridge not running → transient failure state on the button naming the command (`node scripts/agent-bridge.mjs`). No auto-retry loop while unconnected; retry is another click. (Once connected, a dropped socket may auto-reconnect for the rest of the session — the consent was given.)
- Dev-only strings stay untranslated (tree-shaken from production; no catalog cost). Open question for review: whether `npm run lint:i18n` needs a suppression pattern for `import.meta.env.DEV`-guarded markup, or tolerates it as-is.

### The connection surface: agent activity overlay

- New component (proposed `src/lib/components/agent/AgentActivityOverlay.svelte`), mounted at app root beside the Toast host, rendered only while assistance is allowed.
- Position: bottom edge, above navigation (toast z-token family). Styling: the sr-caption family — dark translucent, rounded, monospace lines — not toast styling; it is a persistent surface, not a notification.
- **Collapsed (default): a pill** — state dot (connected / agent active / disconnected) + the most recent action line ("read `OEBPS/Styles/page.css`"), brief pulse on activity.
- **Expanded (click): the action feed** — one line per tool call, scrolling, newest last; disconnect button. Every tool invocation appears here; the feed is the trust surface ("literally everything the agent has done"), and later the write-approval prompts render inline in the feed rather than as modals.
- Coexistence at the bottom edge: proposal — agent overlay owns bottom-left; toasts keep bottom-center; the sr-caption lives inside the preview viewport and doesn't collide. Review point.

## Technical detail

### App module (new: `src/lib/agent-bridge/`)

- `agent-bridge.svelte.ts` — the module: connection state (`$state`), the socket, the action log, tool dispatch. Instantiated once from `App.svelte` behind `if (import.meta.env.DEV)`; Vite eliminates the import in production builds (verify in the build smoke: no `agent-bridge` bytes in `dist/index.html`).
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

Phase 2 (writes — designed, not in scope for the first build): `seed_write_file` restricted to `SOURCE/text/`, `OEBPS/Styles/`, `SOURCE/scripts/`, `SOURCE/preview/`; carries the content hash from the agent's prior read, rejected on mismatch ("changed since read"). Writes route through app services so state propagation and track-changes copy-on-write hold by construction; open-editor dirty state refuses the write. OPF/settings stay excluded until service-level mutations exist. Consent steps up: first write per session prompts in the overlay feed (allow once / allow this session).

Phase 3 (capture): geometry (element rects from the preview document — the app has same-origin access), then `getDisplayMedia` pixels. Recorded in W6; not designed here.

### Retirement of the plugin spike

`plugins/agent-bridge/` is deleted when phase 1 lands, along with the `devOnly` manifest support in `scripts/generate-plugin-manifest.js` if nothing else consumes it by then (currently nothing does). The bridge process and its wire protocol survive unchanged; the e2e driver pattern (spawn bridge, speak MCP over stdio, exercise tools) is reused for verification.

## Testing

- Unit: the module's protocol handling against a fake WebSocket (request dispatch, error shaping, log append, disconnect teardown); tool handlers with stubbed services. Vitest + happy-dom.
- E2E: the existing driver approach — spawn `scripts/agent-bridge.mjs`, speak MCP over stdio, exercise every tool against the dev server with assistance enabled; verify the no-consent case (socket refused until the button is clicked).
- Build gate: production build contains no agent-bridge code (string-absence check in the build smoke), `npm run validate` green.

## Open questions for review

1. Overlay placement: bottom-left vs sharing bottom-center with toasts.
2. Auto-reconnect semantics after a dropped socket mid-session (proposed: yes, consent already given; visible in the pill either way).
3. `lint:i18n` treatment of untranslated dev-only strings.
4. Whether `seed_get_selection` should also capture preview _text selections_ (ranges), or clicks only for v1.
5. Bridge port collision handling (8747 taken → error naming the holder, or scan a small range).
