# WebMCP and declared, page-provided tools for browser AI agents (state as of 17 November 2026)

## WebMCP: proposers, spec status, API shape, browser implementation and vendor positions

### Takeaway

WebMCP is a Google and Microsoft incubation in the W3C Web Machine Learning Community Group. Its draft spec (Draft CG Report, 13 Nov 2026) defines `document.modelContext.registerTool()`; `navigator.modelContext` was the earlier name and Chrome deprecated it in Chromium 150. Chrome (from 149) and Edge (from 150) run it as an origin trial; it has not shipped by default anywhere. Mozilla's position is **neutral** and WebKit's is **oppose**, so it is an emerging Chromium-led standard, not a cross-browser one.

### Cited Findings

**Who and status**

- The repo is under the webmachinelearning GitHub org. Listed authors: Brandon Walderman, Leo Lee and Andrew Nolan (Microsoft); David Bokan, Khushal Sagar and Hannah Van Opstal (Google). The text says it "has evolved significantly, primarily driven by" Dominic Farolino. First published 13 Aug 2025. — [webmachinelearning/webmcp](https://github.com/webmachinelearning/webmcp)
- The spec is a "Draft Community Group Report", dated 13 November 2026, from the Web Machine Learning CG. It is "not a W3C Standard nor on the W3C Standards Track". Editors: Brandon Walderman (Microsoft), Khushal Sagar (Google), Dominic Farolino (Google), Samuel Dallstream (Microsoft). — [WebMCP spec](https://webmachinelearning.github.io/webmcp/)
- A W3C TAG incubation review (design-reviews #1238) was opened 11 Jun 2026 with Google and Microsoft as proponents. The thread was still active on 18 Aug 2026 with no formal TAG position. Reviewers raised serious concerns: new security and privacy risks, underspecified authorization, overlap with accessibility/ARIA, and an imperative-first design where declarative-first is the norm. — [TAG review #1238](https://tag-github-bot.w3.org/gh/w3ctag/design-reviews/1238)
- In that thread the proponents cited Chrome origin-trial data of about 172 million imperative tool registrations against about 20,000 declarative ones. — [TAG review #1238](https://tag-github-bot.w3.org/gh/w3ctag/design-reviews/1238)

**API shape (current spec)**

- IDL: `Document.modelContext` (not `navigator`), declared as `[Exposed=Window, SecureContext] interface ModelContext : EventTarget`. Members:
  - `registerTool(ModelContextTool, {exposedTo, signal})` → `Promise<undefined>`
  - `getTools({fromOrigins})` → `Promise<sequence<RegisteredTool>>`
  - `executeTool(tool, inputObject, {signal})` → `Promise<DOMString>`
  - events `ontoolchange`, `ontoolactivated`, `ontoolcancel`

  — [WebMCP spec](https://webmachinelearning.github.io/webmcp/)

- `ModelContextTool` members:
  - required: `name`, `description`, `execute`
  - optional: `title`, `inputSchema` and `outputSchema` (JSON Schema), `annotations`
  - annotations: `readOnlyHint`, `untrustedContentHint`, `consequentialHint` ("significant or irreversible real-world effects"), `debugging`; all default to false
  - unregistering is done by aborting the `signal`; there is no `unregisterTool`

  — [WebMCP spec](https://webmachinelearning.github.io/webmcp/); [repo README](https://github.com/webmachinelearning/webmcp)

- Chrome's OT guide:
  - says "`navigator.modelContext` (deprecated in Chromium 150)"
  - says `unregisterTool()`, `provideContext()` and `clearContext()` are no longer supported
  - recommends feature detection with `'modelContext' in document`
  - `consequentialHint` arrived in Chrome 154 and `debugging` in Chrome 156
  - "The browser does not validate input or apply defaults", so the page's `execute` must do both

  — [Chrome guide: agentic JavaScript tools](https://developer.chrome.com/docs/modern-web-guidance/guides/webmcp/agentic-javascript-tools.md.txt)

- Earlier API, now superseded: `navigator.modelContext` with `provideContext`, `unregisterTool` and `clearContext`. Third-party write-ups warn that many guides still show it. — [mcpplaygroundonline (secondary)](https://mcpplaygroundonline.com/blog/what-is-webmcp); [Chrome guide](https://developer.chrome.com/docs/modern-web-guidance/guides/webmcp/agentic-javascript-tools.md.txt)

**Declarative variant**

- The declarative variant is a separate explainer. The README says it "is not part of the specification at this time". — [repo README](https://github.com/webmachinelearning/webmcp)
- What the explainer defines:
  - attributes `toolname`, `tooldescription` and `toolautosubmit` on `<form>`, and `toolparamdescription` on controls
  - `SubmitEvent.agentInvoked` and `SubmitEvent.respondWith(promise)`
  - CSS `:tool-form-active` and `:tool-submit-active`
  - without `toolautosubmit`, the browser focuses the submit button and the user submits
  - input-schema synthesis is still "TBD"
  - "Chromium is implementing a loose version"

  — [Declarative API explainer](https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md)

- Chrome's docs describe an imperative API plus a declarative API that annotates HTML forms. — [Chrome WebMCP docs (pub. 18 May 2026, upd. 7 Oct 2026)](https://developer.chrome.com/docs/ai/webmcp)
- Unverified third-party claim: the declarative attributes were removed from the draft spec on 8 Oct 2026, though Chrome still ships them in the OT. — [search-result summary of secondary blogs](https://www.agentready.it.com/blog/webmcp-origin-trial-enroll)

**Chrome**

- The blink-dev "Intent to Experiment: WebMCP" was posted about 15 May 2026. — [blink-dev thread](https://groups.google.com/a/chromium.org/g/blink-dev/c/gmYffo5WOE8/m/OJxuQRP3AAAJ)
- Chrome's blog (9 Jun 2026): "In Chrome 149, you can sign up for the WebMCP origin trial." — [Chrome blog](https://developer.chrome.com/blog/ai-webmcp-origin-trial)
- Local testing uses the flag `chrome://flags/#enable-webmcp-testing`. — [Chrome WebMCP docs](https://developer.chrome.com/docs/ai/webmcp)
- ChromeStatus entry: [chromestatus.com/feature/5117755740913664](https://chromestatus.com/feature/5117755740913664). The page did not render for my fetch.
- The OT end milestone is unconfirmed. Secondary sources say Chrome 156, or Chrome 162 / 29 Mar 2027. — [dev.to (secondary)](https://dev.to/thousand_miles_ai/webmcp-in-chrome-149-web-pages-get-a-tool-api-for-ai-agents-bfi)
- Google's I/O 2026 recap: "Gemini in Chrome will soon support WebMCP APIs." — [Chrome at I/O 26](https://developer.chrome.com/blog/chrome-at-io26)

**Edge**

- The implementation-status page says the Edge origin trial is live in Edge 150. — [implementation-status.md](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)
- Microsoft's Edge blog (21 Sep 2026): the Edge implementation "is ready for testing and feedback", with an origin trial, plus samples and a debugging extension at github.com/MicrosoftEdge/webmcp-labs. — [Edge dev blog](https://blogs.windows.com/msedgedev/2026/09/21/new-in-edge-for-developers-create-better-components-and-make-your-site-agent-ready/)
- Edge needs its own origin-trial token (registration page below). — [Edge OT registration](https://developer.microsoft.com/microsoft-edge/origin-trials/trials/0b76fe60-b266-458e-a285-04e375c0c31a)
- The Edge OT expiry is unclear: a search summary reported 17 Nov 2026 on the Microsoft page, and another guide says 30 Mar 2027. — same registration page; [mcpbundles (secondary)](https://www.mcpbundles.com/guides/webmcp-browser-support)

**Firefox**

- mozilla/standards-positions #1412 was opened 28 May 2026, labelled **position: neutral** on about 3 Aug 2026, and closed 5 Aug 2026. — [mozilla/standards-positions#1412](https://github.com/mozilla/standards-positions/issues/1412)
- Mozilla's concerns:
  - adversarial sites could offer tools that don't match the UI, inject prompts, or tar-pit agents
  - the name is misleading because no MCP protocol is involved
  - invocation is limited to browser vendors' own products and in-page agents, so WebExtension and WebDriver BiDi integrations are recommended
  - Martin Thomson and Jake Archibald favoured the imperative API

  — [mozilla/standards-positions#1412](https://github.com/mozilla/standards-positions/issues/1412)

- Bugzilla 2018306 is listed on the status page. — [implementation-status.md](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)

**Safari/WebKit**

- WebKit/standards-positions #670 was opened 28 May 2026 and labelled **position: oppose** on 11 Jun 2026. — [WebKit/standards-positions#670](https://github.com/WebKit/standards-positions/issues/670)
- WebKit's objections:
  - agent problems should be fixed in HTML and ARIA, not with a parallel tool layer
  - making "an agent is driving" observable creates parity problems
  - cross-origin security is unexamined
  - consent is missing
  - over-parameterized tools enable tracking
  - key parts are TODOs (schema synthesis, consent hook)
  - the WebML CG is the wrong venue

  — [WebKit/standards-positions#670](https://github.com/WebKit/standards-positions/issues/670)

- On 17 Jun 2026 Marcos Cáceres proposed setting WebMCP aside in favour of a new CG and a W3C workshop, possibly around TPAC 2026. — [WebKit/standards-positions#670](https://github.com/WebKit/standards-positions/issues/670)

**Others**

- The implementation-status page also lists:
  - Brave: Leo AI support in 1.102.2, expected 5 Jan 2027
  - "ChatGPT Desktop": supported, no version given
  - Meta Ray-Ban Display: "coming soon", off by default

  — [implementation-status.md](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)

### Inferences

- For a Svelte SPA, the forward-compatible surface is `document.modelContext.registerTool()` behind feature detection. The tools should be unregistered through an `AbortController`, which fits naturally with a consent toggle: revoking consent aborts the signal.
- WebMCP is in origin trial in Chromium only, Mozilla is neutral and WebKit opposes. Treat it as experimental: it may change shape (it already moved from navigator to document) or stall at W3C. Keep the tool implementations in a thin adapter.
- The declarative form variant is the less stable part (not in the spec, schema synthesis TBD) and fits an SPA editor less well than the imperative API.

### Gaps

- I could not confirm the exact Chrome or Edge OT end milestone or date (ChromeStatus did not render; secondary sources conflict).
- I could not confirm whether Gemini in Chrome consumes WebMCP tools in stable Chrome as of November 2026 (Google said "soon" in May 2026).
- I could not confirm whether `navigator.modelContext` still works as an alias in current Chrome or has been removed.
- I could not verify the claim that the declarative API was removed from the spec on 8 Oct 2026.

## How a WebMCP-declared tool reaches an agent (built-in agent, extensions, external MCP clients)

### Takeaway

In the spec, tools are visible to the registering document, same-origin documents in its tree, and "built-in agents". In practice in Chrome, extensions can also enumerate and call tools from content scripts, which is how the testing agents work. WebMCP itself does not bridge to desktop MCP clients; MCP-B's `@mcp-b/webmcp-local-relay` does that.

### Cited Findings

- By default, tools are visible only to the registering document, same-origin documents in the tree, and built-in agents. `exposedTo` shares them with listed secure origins. — [repo README](https://github.com/webmachinelearning/webmcp)
- `getTools()` resolves to tools exposed to the calling document by active documents in the same traversable navigable. The spec describes this as designed for in-page agents. `executeTool()` runs the tool in the registering document and returns the stringified result. — [WebMCP spec](https://webmachinelearning.github.io/webmcp/)
- The spec says only that browsers may expose tools via MCP or other methods. Extensions, WebDriver BiDi and external clients are not specified. — [WebMCP spec, security section](https://webmachinelearning.github.io/webmcp/)
- Chrome docs warn that "Chrome Extensions can query and execute WebMCP tools through content scripts". The docs list two developer agents, both "separate from Gemini in Chrome". — [Chrome WebMCP docs](https://developer.chrome.com/docs/ai/webmcp)
  - Example Agentic Chrome Extension: a local Node server with an AI SDK; Gemini by default, with OpenAI and Anthropic options; or the on-device Prompt API via `chrome://flags/#prompt-api-tool-use`.
  - Model Context Tool Inspector: Gemini with an API key.
- The design is "primarily designed for local browser workflows with a human in the loop", so headless use is limited. — [Chrome WebMCP docs](https://developer.chrome.com/docs/ai/webmcp)
- Mozilla noted that invocation is currently limited to browser makers' products and in-page agents, and asked for WebExtension and WebDriver BiDi integration. — [mozilla/standards-positions#1412](https://github.com/mozilla/standards-positions/issues/1412)
- WebKit flagged a service-worker explainer, under which background service workers could expose tools on sites that are not open, as raising the stakes. — [WebKit#670](https://github.com/WebKit/standards-positions/issues/670); [repo README (docs/service-workers.md)](https://github.com/webmachinelearning/webmcp)
- MCP-B's `@mcp-b/webmcp-local-relay` is added to a desktop client config (Claude Desktop, Cursor and VS Code are named) and forwards website tools to that client over a localhost relay. — [WebMCP-org/npm-packages](https://github.com/WebMCP-org/npm-packages)

### Inferences

- Without a bridge, a WebMCP tool on the editor would reach Chrome/Edge built-in agents (when they ship), Chrome extensions (including Claude in Chrome-style extensions), and in-page agents. Desktop MCP clients such as Claude Code need MCP-B's relay or the app's own bridge. This is relevant because SEED.html already has a seed-bridge MCP server.

### Gaps

- I found no official Chrome extension API (for example a `chrome.*` namespace) for WebMCP, only content-script access.
- I did not verify which shipping third-party agent extensions (Claude in Chrome, Atlas, Comet) consume WebMCP tools.

## Consent and permission model

### Takeaway

The spec has no consent hook or per-call user confirmation. Gating is by Permissions Policy (`tools`, default `self`), SecureContext, same-origin by default, and opt-in cross-origin exposure. Confirmation is left to the agent, guided by the advisory `consequentialHint`, and the page should keep its own confirmation for sensitive actions. A page-level consent gesture before registering tools is therefore the page's own design and does not conflict with the spec.

### Cited Findings

- The interface is `[SecureContext]`. Access is gated by the policy-controlled feature `tools`, whose default allowlist is `'self'`. — [WebMCP spec](https://webmachinelearning.github.io/webmcp/)
- Tools work in top-level and same-origin frames. Cross-origin iframes need `allow="tools"`; otherwise `registerTool` rejects with `NotAllowedError`. — [repo README](https://github.com/webmachinelearning/webmcp); [Chrome docs](https://developer.chrome.com/docs/ai/webmcp)
- Cross-origin use needs three gates: the embedder delegates `tools`, the provider lists caller origins in `exposedTo` (each must be potentially trustworthy, or registration fails with `SecurityError`), and the consumer lists target origins in `fromOrigins`. — [WebMCP spec](https://webmachinelearning.github.io/webmcp/)
- Sites can disable WebMCP entirely with `Permissions-Policy: tools=()`. — [WebMCP spec](https://webmachinelearning.github.io/webmcp/)
- User confirmation for sensitive actions is an open question (issues #165 and #50). — [repo README](https://github.com/webmachinelearning/webmcp)
- Chrome: "Treat `consequentialHint` as a hint, not an enforcement mechanism"; keep in-app confirmation. — [Chrome guide](https://developer.chrome.com/docs/modern-web-guidance/guides/webmcp/agentic-javascript-tools.md.txt)
- Chrome docs say you "can include a command to request user interaction with a confirmation dialog" for sensitive actions, and that tools run visibly on the page. — [Chrome docs](https://developer.chrome.com/docs/ai/webmcp)
- Earlier drafts had a `requestUserInteraction` mechanism; I did not find it in the current spec text.
- WebKit lists consent and reversibility as missing and the consent hook as a TODO. — [WebKit#670](https://github.com/WebKit/standards-positions/issues/670)
- The declarative variant's only built-in human gate is the lack of `toolautosubmit`: the user must press submit. — [Declarative explainer](https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md)
- No user-activation requirement for registering or calling tools is stated in the explainer or the Chrome docs I read.

### Inferences

- The editor's plan to register tools only after a user consent gesture is a stricter policy layered on the spec, and it is compatible with it.
- Writes should be annotated: `readOnlyHint` for reads, `consequentialHint` for deletes and overwrites. Book text returned to the agent should carry `untrustedContentHint`, since an imported EPUB is untrusted input.

### Gaps

- I could not determine the current status of issues #165 and #50 or whether a consent hook is planned.

## MCP-B (mcp-b.ai / MiguelsPizza / WebMCP-org)

### Takeaway

MCP-B is an independent, MIT-licensed community project, "Not an official W3C or MCP project". It started as Alex Nahas's (MiguelsPizza) WebMCP prototype. It now provides a polyfill of `document.modelContext`, a full MCP bridge (resources and prompts), transports (tab postMessage, iframe, Chrome extension), a browser extension, and a localhost relay to desktop MCP clients. Adoption is modest: the main repo has 107 stars.

### Cited Findings

- The project lives in the WebMCP-org GitHub organization, is MIT licensed, and describes itself as "Not an official W3C or MCP project". Packages:
  - `@mcp-b/global` (polyfill plus MCP bridge)
  - `@mcp-b/webmcp-ts-sdk`
  - `@mcp-b/transports`
  - `@mcp-b/webmcp-extension`
  - `@mcp-b/mcp-iframe`
  - `@mcp-b/webmcp-local-relay`
  - `@mcp-b/react-webmcp`
  - `usewebmcp`
  - `@mcp-b/smart-dom-reader`

  The script-tag example pins `@mcp-b/global@6`. The page says the W3C CG publishes its own `@w3c/webmcp-polyfill`. Repo stats: 107 stars, 23 forks, 693 commits. — [WebMCP-org/npm-packages](https://github.com/WebMCP-org/npm-packages)

- Transports: postMessage (tab), iframe and Chrome extension; the architecture diagram also shows a WebSocket link to local agents. The MCP-B Chrome extension is listed on the Chrome Web Store. — [WebMCP-org/npm-packages](https://github.com/WebMCP-org/npm-packages)
- Transport classes include `TabClientTransport` and `ExtensionClientTransport`. — [ecosystem summary (secondary)](https://webmcpexpert.pages.dev/blog/webmcp-polyfill-ecosystem/)
- `@mcp-b/webmcp-polyfill` covers the core API, including the deprecated `provideContext` and `registerTool`. `@mcp-b/global` adds MCP-B transports, prompts, resources and `outputSchema`, and wraps any existing native context rather than replacing it. — [@mcp-b/global README](https://unpkg.com/@mcp-b/global@latest/README.md); [@mcp-b/webmcp-polyfill README](https://cdn.jsdelivr.net/npm/@mcp-b/webmcp-polyfill@2.2.0/README.md)
- pkgstats says 3.x targets `document.modelContext`, with a deprecated `navigator` alias. — [pkgstats](https://www.pkgstats.com/pkg:@mcp-b/webmcp-polyfill)
- The original author's GitHub handle is MiguelsPizza. He commented on MCP SEP-1005 (20 Jul 2025) that WebMCP's idea resembles inverted MCP transports. — [SEP-1005](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1005); [Arcade interview with Alex Nahas](https://www.arcade.dev/blog/web-mcp-alex-nahas-interview)

### Inferences

- MCP-B is the practical way to reach Firefox and Safari, and desktop MCP clients, today with the same `registerTool` code. It is a single-maintainer-scale community dependency with a fast-moving major version (v6 of global), so pin it and isolate it.

### Gaps

- I could not confirm the latest release dates or download counts from primary sources.
- I could not confirm the relay's security model (localhost auth, origin checks).

## MCP specification transports relevant to browsers

### Takeaway

MCP defines only stdio and Streamable HTTP; HTTP+SSE is proposed for deprecation in the 2026-07-28 revision. There is no browser, postMessage or WebSocket server transport. A postMessage transport SEP (SEP-1005) went dormant in November 2025 because maintainers want to "keep the amount of transports small". postMessage appears in MCP only inside the MCP Apps extension (iframe UI ↔ host).

### Cited Findings

- 2026-07-28 revision: RC in May 2026, final expected 28 Jul 2026. Transports are stdio and Streamable HTTP, with HTTP+SSE proposed for deprecation. The core is stateless. MCP Apps (`ui://` resources in sandboxed iframes, JSON-RPC over postMessage) and Tasks are the first extensions. No browser or WebSocket transport is included. — [AAIF blog](https://aaif.io/blog/mcp-2026-07-28-whats-changing-and-how-to-migrate)
- Wikipedia says the revision was finalized on 28 Jul 2026. — [Wikipedia: MCP](https://en.wikipedia.org/wiki/Model_Context_Protocol)
- SEP-1005 "postMessage Transport" (Josh Mandel, 19 Jul 2025) was closed and labelled dormant on 24 Nov 2025: "has not found a sponsor…". The maintainer wants to "keep the amount of transports small" and suggested an external extension or community project instead. — [SEP-1005](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1005)
- Earlier postMessage proposal #457 and WebSocket proposal #493 were not adopted; #493 was closed as not picked up. — [#457](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/457); [#493](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/493)
- MCP Apps spec (2026-01-26): iframe–host communication is JSON-RPC 2.0 over postMessage. — [ext-apps spec](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)
- Mozilla notes WebMCP is not MCP on the wire ("no MCP protocol is involved"), and WebKit notes the spec is "not an MCP binding". — [Mozilla#1412](https://github.com/mozilla/standards-positions/issues/1412); [WebKit#670](https://github.com/WebKit/standards-positions/issues/670)

### Inferences

- MCP has no sanctioned way for a page to be an MCP server. Browser-hosted servers depend on community transports (MCP-B) or on WebMCP plus a browser or extension bridge. The seed-bridge approach (a page talking to a local MCP server) remains bespoke either way.

### Gaps

- I did not check for any newer post-July-2026 SEP for browser transports.

## Security concerns raised

### Takeaway

The spec has a substantial risk section: tool poisoning via descriptions, output injection, misrepresented intent, privacy leakage through over-parameterization, cross-origin misuse and private browsing. Its mitigations are mostly advisory (hints, length limits, guardrails at the agent). Reviewers at WebKit, Mozilla and the TAG consider the risks unresolved.

### Cited Findings

- Spec §6 key risks:
  - prompt injection: tool poisoning via names and descriptions; output injection via tool results such as user-generated content; tool implementations as targets
  - misrepresentation of intent (example: `finalizeCart` that actually purchases)
  - over-parameterization leading to profiling and tracking
  - same-origin policy interaction
  - private browsing

  — [WebMCP spec](https://webmachinelearning.github.io/webmcp/)

- Spec mitigations:
  - `Permissions-Policy: tools=()`
  - a nominal 128-character tool-name limit
  - shared attack-eval datasets
  - `untrustedContentHint` and `consequentialHint`
  - agent-level guardrails, because "a malicious site can omit or misrepresent" the hints

  — [WebMCP spec](https://webmachinelearning.github.io/webmcp/)

- Tool impersonation: callers should check `origin` and `window` to tell apart same-named tools across origins, and treat cross-origin descriptions and outputs as untrusted. — [WebMCP spec](https://webmachinelearning.github.io/webmcp/)
- Mozilla: tools may not match what users see; invisible prompt injection; harvesting of user input. — [Mozilla#1412](https://github.com/mozilla/standards-positions/issues/1412)
- WebKit: ambiguous natural-language tool selection, cross-site tracking, consent missing. — [WebKit#670](https://github.com/WebKit/standards-positions/issues/670)
- TAG: new risks with no known solutions, and underspecified authorization. — [TAG #1238](https://tag-github-bot.w3.org/gh/w3ctag/design-reviews/1238)

### Inferences

- For the editor, the main risk runs in reverse: an imported book's text returned from a read tool could inject instructions into the agent. Mark such results with `untrustedContentHint`, and keep destructive tools behind confirmation in the app.

### Gaps

- None beyond those noted.

## Competing and adjacent proposals

### Takeaway

The main counter-proposal is WebKit's: improve HTML and ARIA semantics instead of a tool layer, and move the work to a new CG or W3C workshop. Microsoft also ships accessibility-framed `aria-actions`. NLWeb (Microsoft) is a server-side conversational/MCP framework and complements WebMCP. Chrome's Prompt API can act as an in-page agent consuming WebMCP tools (`prompt-api-tool-use` flag). I found no primary sources on OpenAI's Apps SDK in Atlas relating to WebMCP.

### Cited Findings

- WebKit proposes fixing HTML and ARIA, and a new CG or W3C workshop around TPAC 2026. — [WebKit#670](https://github.com/WebKit/standards-positions/issues/670)
- Edge's September 2026 post pairs WebMCP with `aria-actions`, which exposes a widget's secondary actions to assistive technology, and `referenceTarget`. Both are framed as accessibility features. — [Edge dev blog](https://blogs.windows.com/msedgedev/2026/09/21/new-in-edge-for-developers-create-better-components-and-make-your-site-agent-ready/)
- A TAG reviewer warned that ARIA is being repurposed for agents ("assistive technology is for people"). — [TAG #1238](https://tag-github-bot.w3.org/gh/w3ctag/design-reviews/1238)
- NLWeb is a full-stack framework for adding a conversational interface to a site, with MCP server capabilities. Microsoft is involved in both NLWeb and WebMCP. — [The New Stack (secondary)](https://thenewstack.io/how-webmcp-lets-developers-control-ai-agents-with-javascript/)
- Chrome's example agent can use the on-device Prompt API as the model that calls WebMCP tools (`chrome://flags/#prompt-api-tool-use`). — [Chrome docs](https://developer.chrome.com/docs/ai/webmcp)
- MCP Apps is the MCP-side UI extension (server-provided UI in a host iframe), the inverse direction from WebMCP. — [ext-apps spec](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)

### Inferences

- No competing standard for page-declared tools has momentum comparable to WebMCP. The live alternative is "no tool layer, just better semantics", which would favour good ARIA and labels in the editor (already house style) as a no-regret baseline.

### Gaps

- OpenAI Atlas / Apps SDK and Perplexity Comet: whether they consume WebMCP. The only lead is "ChatGPT Desktop: supported" on the implementation-status page, with no details.
- Agent-specific ARIA proposals beyond `aria-actions`: none found in primary sources.
