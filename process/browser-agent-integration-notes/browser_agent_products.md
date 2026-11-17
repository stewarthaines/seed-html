# Browser-resident AI agent products (as of 17 November 2026)

Source-quality note: the 2026 web is full of SEO/aggregator pages with inconsistent dates. Primary sources fetched directly: Chrome for Developers WebMCP doc, Google Chrome Help (auto browse), code.claude.com Chrome docs, Playwright MCP README, Chrome DevTools MCP README. openai.com returned HTTP 403 to fetch, so OpenAI facts come via search snippets and press. Claims supported only by aggregators are marked "(secondary)" or "(single source)".

## Availability and launch/update dates

### Takeaway

The landscape consolidated in 2026: Claude in Chrome went GA (Aug 2026), Gemini in Chrome auto browse is a paid US feature on desktop and US Android, OpenAI killed the Atlas browser (shut down 9 Aug 2026) and moved agent browsing into a ChatGPT Chrome extension (Oct 2026), Edge renamed Copilot Mode/Actions to "Browse with Copilot" (secondary), Opera Neon turned itself into an MCP-controllable browser, and Brave's AI browsing is an opt-in early test in all channels. Dia's agent status is unconfirmed.

### Cited Findings

**Claude in Chrome (Anthropic)**

- Reported GA on 26 Aug 2026 for paid plans (Pro, Max, Team, Enterprise); side panel still labelled beta; Chrome-only for the extension itself (secondary, multiple aggregators citing GIGAZINE 27 Aug 2026) — [ccleaks](https://ccleaks.com/news/claude-in-chrome-generally-available-aug-2026); [justinmckelvey.com](https://justinmckelvey.com/blog/claude-in-chrome)
- Claude Code's Chrome integration works with Chrome and Edge, and Claude Code also sets up the connection in Brave, Arc, Vivaldi and Opera; not supported in WSL; needs extension v1.0.36+ and a direct Anthropic plan (Pro, Max, Ultra, Team, Enterprise); not available via Bedrock/Vertex/Foundry; off in ZDR orgs, off-by-default under HIPAA — [code.claude.com/docs/en/chrome](https://code.claude.com/docs/en/chrome)

**Gemini in Chrome / auto browse (Google)**

- Auto browse rolled out 28 Jan 2026 to Google AI Pro and Ultra subscribers in the US (desktop), powered by Gemini 3 — [9to5Google](https://9to5google.com/2026/01/28/chrome-gemini-auto-browse/); [Google blog](https://blog.google/products-and-platforms/products/chrome/gemini-3-auto-browse/)
- Help center eligibility: 18+, US, Google AI Ultra/Pro/Plus personal account, English, signed-in Chrome (not Incognito, not school; work accounts need admin enablement), Safe Browsing Standard or Enhanced; "Currently, Chrome auto browse is only available on desktop"; not on iPhone/iPad; gradual rollout — [Chrome Help 16821166](https://support.google.com/chrome/answer/16821166?hl=en)
- Android: announced 12 May 2026; Gemini in Chrome available to all US Android users 18 Aug 2026, auto browse capped at 20 multi-step requests/day (Pro) and 200 (Ultra) — [9to5Google](https://9to5google.com/2026/05/12/gemini-chrome-android/); [Google blog](https://blog.google/products-and-platforms/products/chrome/bringing-chrome-ai-to-android/); [Neowin](https://www.neowin.net/news/gemini-is-now-available-in-chrome-with-agentic-auto-browse-for-all-android-users-in-the-us/). Note: the Help page (desktop-only line) conflicts with the Android reports; it may simply be the desktop article.
- Gemini Spark can use Chrome to auto browse (US first, 30 Jul 2026) — [9to5Google](https://9to5google.com/2026/07/30/gemini-spark-chrome-auto-browse/)
- India expansion in October 2026 (single source, unverified) — [TechRepublic](https://www.techrepublic.com/article/news-how-to-use-gemini-auto-browse-chrome/)

**OpenAI: Atlas (discontinued) and ChatGPT Chrome extension**

- Atlas launched Oct 2025 (macOS only); OpenAI announced sunset 9 Jul 2026; discontinued 9 Aug 2026; never shipped on Windows/iOS/Android; OpenAI's launch post now carries a deprecation note — [9to5Mac](https://9to5mac.com/2026/07/09/openai-is-discontinuing-chatgpt-atlas-its-standalone-desktop-browser/); [TechCrunch](https://techcrunch.com/2026/07/09/openai-is-shutting-down-atlas-but-its-ai-browser-ambitions-are-still-growing/); [BGR](https://www.bgr.com/2212396/openai-chatgpt-browser-atlas-discontinued/); [OpenAI launch post](https://openai.com/index/introducing-chatgpt-atlas/) (403 to fetch; deprecation note reported via search)
- ChatGPT Chrome extension upgraded ~15 Oct 2026 to control tabs: a read-only "Chat" mode and a "Work" mode that acts (send messages, fill forms, download files); reported available on all plans including free (secondary) — [PiunikaWeb](https://piunikaweb.com/2026/10/16/chatgpt-chrome-extension-tab-control-automation/); [Unite.AI](https://www.unite.ai/openai-brings-computer-use-to-chrome-with-chatgpt-tab-controls/)
- ChatGPT desktop app reportedly supports Chrome extensions and the Chrome DevTools Protocol (Sept 2026, secondary) — [cryptobriefing](https://cryptobriefing.com/openai-chatgpt-chrome-extension-support/); [runtimewire](https://runtimewire.com/article/openai-chatgpt-desktop-browser-chrome-extensions)

**Microsoft Edge**

- Copilot Mode launched experimentally, opt-in, July 2025; Copilot Actions and Journeys added Oct 2025 — [TechCrunch](https://techcrunch.com/2025/07/28/microsoft-edge-is-now-an-ai-browser-with-launch-of-copilot-mode); [WindowsForum](https://windowsforum.com/news/copilot-mode-in-edge-ai-powered-agentic-browsing-with-journeys-and-actions.386569/)
- Copilot Mode reportedly retired 13 May 2026, succeeded by "Browse with Copilot"; Edge for Business agentic browsing limited preview from 20 May 2026 in an isolated tab with a curated action list, GA "second half of 2026" (single aggregator sources each; no primary Microsoft page found) — [WindowsForum](https://windowsforum.com/news/edge-browse-with-copilot-session-access-screenshot-privacy-and-prompt-injection-risks.452289/); [windowsnews.ai](https://windowsnews.ai/article/edge-for-business-agentic-browsing-copilot-can-actunder-it-rules.419324)

**Perplexity Comet**

- Free to all since 2 Oct 2025 (previously $200/mo Max); Android 20 Nov 2025, iOS 18 Mar 2026 per Wikipedia; other sources give later mobile dates (conflict) — [Wikipedia](<https://en.wikipedia.org/wiki/Comet_(browser)>); [hokai.io](https://hokai.io/hub/tools/perplexity-comet)
- Paid tiers reportedly still gate autonomous background agents (secondary) — [wetheflywheel](https://wetheflywheel.com/en/radar/perplexity-comet-review/)

**The Browser Company Dia**

- Beta June 2025, public Mac launch Oct 2025; company acquired by Atlassian (~$610M, 2025) — [TechCrunch](https://techcrunch.com/2025/06/11/the-browser-company-launches-its-ai-first-browser-dia-in-beta); [MacRumors](https://www.macrumors.com/2025/10/09/ai-browser-dia-launches-publicly-on-mac/)
- Paid monthly AI plans (Aug 2026) and Windows launch (Oct 2026) reported second-hand; reviewers say Dia still does not act on sites as an autonomous agent as of Oct 2026 (secondary, conflicting) — [wetheflywheel Dia review](https://wetheflywheel.com/en/radar/dia-browser-review/); [hackceleration](https://hackceleration.com/labs/to-watch/ai-browsers)

**Opera Neon**

- MCP Connector launched 31 Mar 2026: external AI clients (Claude, ChatGPT, Lovable, n8n, OpenClaw, any MCP client) control a live Neon session (browse, fill forms, screenshots) through a secured MCP server URL; paid Neon subscribers; simplified version planned for Opera One/GX — [Opera press](https://press.opera.com/?p=3885); [operaneon.com](https://operaneon.com/news/opera-neon-adds-mcp-connector-to-the-browser); [Neowin](https://www.neowin.net/news/opera-neon-now-lets-external-ai-agents-like-chatgpt-and-claude-control-your-browser/)
- Neon reportedly made free as an agent target (MCP server) on 14 Aug 2026 while its own AI stays paid (single aggregator source) — [nohacks](https://nohacks.co/blog/agentic-browser-landscape-2026)
- "Do" (Neon's built-in agent) actions and MCP Connector run on-device; "Make" uses cloud (single German source) — [borncity](https://borncity.com/news/opera-neon-browser-wird-zur-ki-kommandozentrale/)

**Brave Leo AI browsing**

- Launched in Nightly Dec 2025; blog updated 5 May 2026 says AI browsing is now in early testing in all release channels behind an opt-in flag; Brave calls it "inherently risky" — [Brave blog](https://brave.com/blog/ai-browsing/); [Privacy Guides](https://www.privacyguides.org/news/2025/12/12/brave-adds-experimental-agentic-ai-browsing-feature/)

**Developer-side tools**

- Playwright MCP (Microsoft): `npx @playwright/mcp@latest`, Node 18+ — [GitHub](https://github.com/microsoft/playwright-mcp)
- Chrome DevTools MCP (Google): `chrome-devtools-mcp@latest`; supports Chrome and Chrome for Testing — [GitHub](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- Stagehand (Browserbase): v3 launched (v4 docs also exist; npm 4.3.0 README seen) — [Browserbase blog](https://browserbase.com/blog/stagehand-v3); [unpkg README 4.3.0](https://unpkg.com/@browserbasehq/stagehand@4.3.0/README.md)

### Inferences

- For a Chromium SPA, the agents most likely to hit it in late 2026 are Claude in Chrome, Gemini in Chrome, the ChatGPT Chrome extension, Comet, and MCP-driven tools (Playwright MCP, DevTools MCP, Opera Neon's connector). Safari/Firefox have no native agent equivalents in this survey.
- Atlas-specific guidance is now historical, but OpenAI's ARIA advice carries over to its extension in spirit.

### Gaps

- No primary Microsoft announcement for "Browse with Copilot" found; no primary Browser Company post on a Dia agent mode; no primary Perplexity docs on Comet internals.
- Exact plan gating for the ChatGPT extension's Work mode not confirmed from OpenAI help pages.

## How each perceives pages (screenshots, DOM, accessibility tree, JS, iframes, shadow DOM)

### Takeaway

Developer tools and Claude in Chrome lean on the accessibility tree plus screenshots, with optional JS evaluation; Stagehand and browser-use merge per-frame accessibility trees across iframes; Gemini, Comet, Edge and the ChatGPT extension do not publish their perception mechanism (Edge says it takes screenshots). The accessibility tree is the common denominator.

### Cited Findings

- **Claude in Chrome**: `read_page` returns an accessibility-tree representation with an "interactive" filter and depth limit, output capped at 50,000 characters (reverse-engineered from v1.0.56, unofficial, ~early 2026) — [sshh12 gist](https://gist.github.com/sshh12/e352c053627ccbe1636781f73d6d715b)
- Claude Code docs: Claude can "read console errors and DOM state directly", take screenshots, record GIFs, read console messages, upload files — [code.claude.com](https://code.claude.com/docs/en/chrome)
- Firsthand observation (this research session's tool list, not a web source): the Claude in Chrome MCP exposes `read_page`, `find`, `get_page_text`, `form_input`, `computer` (screenshot/click/type), `javascript_tool` (runs JS in the page), `file_upload`, `upload_image`, `read_console_messages`, `read_network_requests`, `gif_creator`, tab tools and `browser_batch`.
- **Playwright MCP**: perceives through Playwright's accessibility snapshot ("Fast and lightweight", no vision model needed); `browser_snapshot` preferred over screenshots; `--caps=vision` adds coordinate mouse tools for elements missing from the snapshot; actions target element refs from the snapshot or a selector; `browser_find` searches the snapshot; `browser_evaluate` runs JS on the page/element; README does not address iframes — [GitHub](https://github.com/microsoft/playwright-mcp)
- **Chrome DevTools MCP**: screenshots, console messages, network analysis, performance traces with CrUX field data — [GitHub](https://github.com/ChromeDevTools/chrome-devtools-mcp) (README fetch did not confirm snapshot/uid or evaluate_script details; see Tool Reference linked there)
- **Stagehand v3**: iframe traversal and shadow DOM handled automatically (v2 `iframes` flag removed); pulls the accessibility tree via CDP, walks each frame depth-first including out-of-process iframes, stitches one tree; a "piercer" script patches `Element.prototype.attachShadow` to keep shadow roots open; recommends `observe()` then `act()`, and caching observe results — [Stagehand act docs](https://docs.stagehand.dev/v3/basics/act); [Taming iframes](https://browserbase.com/blog/taming-iframes-a-stagehand-update); [v3 migration](https://docs.stagehand.dev/v3/migrations/v2)
- **browser-use**: converts the DOM into an indexed representation; numbered interactive elements; reportedly merges per-frame accessibility trees including eligible cross-origin iframes (secondary); indices valid only for one extraction — [tessl browser-use DOM docs](https://tessl.io/registry/tessl/pypi-browser-use/files/docs/dom-processing.md); [alphasignal](https://alphasignal.ai/news/browser-use-s-jev-ultrafast-cuts-browser-agent-costs-90-with-indexed-dom-actions)
- **OpenAI Atlas/ChatGPT agent**: "ChatGPT Atlas uses ARIA tags—the same labels and roles that support screen readers—to interpret page structure and interactive elements" (OpenAI, quoted) — [Simon Willison](https://simonwillison.net/tags/browser-agents/); [OpenAI launch post](https://openai.com/index/introducing-chatgpt-atlas/)
- **Gemini auto browse**: help page says it reads website content and warns of prompt injection; does not say whether screenshots are used — [Chrome Help](https://support.google.com/chrome/answer/16821166?hl=en)
- **Edge Browse with Copilot**: takes screenshots and keeps conversation records (secondary) — [WindowsForum](https://windowsforum.com/news/edge-browse-with-copilot-session-access-screenshot-privacy-and-prompt-injection-risks.452289/)
- **Comet**: no source found describing DOM vs screenshot perception — [Prosopo](https://prosopo.io/blog/perplexity-comet-browser/) discusses site impact only

### Inferences

- For the EPUB editor: panels hidden behind `<select>` controls are only discoverable to an a11y-tree agent if the select has an accessible name and its options are meaningful; content not rendered until a select changes is invisible until the agent acts. Native `<select>` is handled well by Playwright `select_option` and Claude `form_input`; custom listboxes need proper ARIA roles.
- Same-origin iframes (e.g. the preview) are reachable by tree-merging tools (Stagehand, browser-use, Playwright via frame refs); srcdoc/about:blank or cross-origin iframes may be skipped or only visible in screenshots. Agents with JS evaluation (Claude `javascript_tool`, Playwright `browser_evaluate`) can reach OPFS or app state directly; consumer agents (Gemini, ChatGPT extension) apparently cannot.
- Closed shadow roots defeat everything except Stagehand's piercer.

### Gaps

- No official current docs for Claude in Chrome's `read_page` parameters or iframe behaviour; no official statement on whether Gemini/ChatGPT extension/Comet run page JavaScript or read iframes/shadow DOM.

## How each acts (input mechanism, file upload, limits)

### Takeaway

Extensions (Claude, ChatGPT) act through Chrome extension/debugger APIs in the user's real profile; dev tools drive CDP/Playwright; browsers (Gemini, Comet, Neon, Brave) act natively. File upload is explicit in Claude in Chrome (10 MB cap) and Playwright MCP; consumer agents generally do not document it.

### Cited Findings

- Claude in Chrome (via Claude Code): opens new tabs in a session tab group, shares login state, pauses for login pages and CAPTCHAs; connects to Claude Code through a native messaging host (`com.anthropic.claude_code_browser_extension.json`) and `bridge.claudeusercontent.com`; JS `alert/confirm/prompt` dialogs block browser events and stall the agent; extension service worker can go idle and drop the connection; uploads capped at 10 MB total per upload, refuses hard-linked files and credential-named files (`.env`, `.pem`, `.ssh`) — [code.claude.com](https://code.claude.com/docs/en/chrome)
- Playwright MCP: `browser_file_upload` takes absolute paths (omit to cancel the chooser); `browser_drop` drops files or MIME data on an element; `browser_run_code_unsafe` runs Playwright code in-process ("RCE-equivalent") — [GitHub](https://github.com/microsoft/playwright-mcp)
- Gemini auto browse: limits activity to sites/actions relevant to the task; declines prohibited requests; with permission uses Password Manager; can fall back to a remote browser or a different tool after a stop — [Chrome Help](https://support.google.com/chrome/answer/16821166?hl=en)
- ChatGPT extension Work mode controls Chrome tabs (messages, forms, downloads); ChatGPT's agent cannot interact with other extensions or their data (secondary) — [Unite.AI](https://www.unite.ai/openai-brings-computer-use-to-chrome-with-chatgpt-tab-controls/); [runtimewire](https://runtimewire.com/article/openai-chatgpt-desktop-browser-chrome-extensions)
- Brave: agent cannot reach the main profile, brave://settings, non-HTTPS pages or Safe Browsing-flagged sites — [Brave support](https://support.brave.app/hc/en-us/articles/41240379376909); [Brave blog](https://brave.com/blog/ai-browsing/)
- Edge for Business preview: curated list of approved actions in an isolated tab (secondary) — [windowsnews.ai](https://windowsnews.ai/article/edge-for-business-agentic-browsing-copilot-can-actunder-it-rules.419324)

### Inferences

- An app that uses `window.confirm()` for destructive actions will stall Claude in Chrome; in-page dialogs (`<dialog>`) are safer for agents.
- Brave's non-HTTPS block means `http://localhost` dev servers may be unreachable by Brave's agent (inferred from "non-HTTPS pages"; localhost is not mentioned explicitly).

### Gaps

- No published timeouts or step limits for Claude in Chrome, Comet, or ChatGPT extension; Gemini's daily caps only reported for Android.

## Page-declared tools (WebMCP / navigator.modelContext), llms.txt and other hints

### Takeaway

WebMCP is the only page-to-agent tool channel with a shipping browser implementation: a Chrome origin trial from Chrome 149, with imperative (JS `registerTool`) and declarative (annotated `<form>`) APIs, gated by a `tools` Permissions Policy. Google's own doc does not confirm Gemini in Chrome consumes it; secondary sources claim it does. No product surveyed documents reading llms.txt during browsing; OpenAI's only stated hint is ARIA.

### Cited Findings

- Chrome doc (published 18 May 2026, updated 7 Oct 2026): WebMCP is a proposed web standard; origin trial starting Chrome 149; local testing via `chrome://flags/#enable-webmcp-testing`; imperative API (JS tools for form input, navigation, state) and declarative API (annotations on HTML forms); JSON Schemas for inputs/outputs; "primarily designed for local browser workflows with a human in the loop"; tools gated by the `tools` Permissions Policy, default `self`, cross-origin iframes need `allow="tools"`; sensitive tools can request a user-confirmation dialog; best practice: progressive enhancement, explicit purpose per tool, confirmation for sensitive actions; clients must visit the site to learn its tools — [Chrome for Developers: WebMCP](https://developer.chrome.com/docs/ai/webmcp); [Declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api)
- Consumers named in the Chrome doc are two sample extensions (an agentic extension with a local Node server, default model `gemini-3.6-flash`, OpenAI/Anthropic options, or the on-device Prompt API via `chrome://flags/#prompt-api-tool-use`; and the Model Context Tool Inspector); the doc says these are separate from Gemini in Chrome; extensions can query/execute tools via content scripts — [Chrome for Developers: WebMCP](https://developer.chrome.com/docs/ai/webmcp)
- First shipped behind a flag in Chrome 146 Canary, Feb 2026; origin trial announced at I/O 19 May 2026 (or opened 9 Jun 2026; sources differ); trial runs Chrome 149–156, reportedly extended to 162 in late Oct 2026 (unverified) (secondary) — [mcpplaygroundonline](https://mcpplaygroundonline.com/blog/what-is-webmcp); [OpenHermit](https://www.openhermit.com/blog/webmcp-chrome-149-origin-trial-production-2026); [Spronta July 2026](https://www.spronta.com/blog/state-of-webmcp-july-2026/)
- API location reportedly moved from `navigator.modelContext` to `document.modelContext` in a 21 Jul 2026 spec draft, with Chrome 150 deprecating the old name; advice is to feature-detect both (secondary, unconfirmed against primary) — [mcpplaygroundonline](https://mcpplaygroundonline.com/blog/what-is-webmcp); [DEV Community](https://dev.to/thousand_miles_ai/webmcp-in-chrome-149-web-pages-get-a-tool-api-for-ai-agents-bfi)
- "Only Gemini in Chrome consumes the tools"; Edge experimental behind a flag (June 2026); no Firefox/Safari roadmap (secondary, conflicts with the Chrome doc's silence on Gemini) — [mcpplaygroundonline](https://mcpplaygroundonline.com/blog/what-is-webmcp)
- DevTools can debug WebMCP tools and validate JSON Schema parsing (secondary) — [The DropTimes](https://www.thedroptimes.com/node/70389)
- OpenAI: "Website owners can also add ARIA tags to improve how ChatGPT agent works for their websites in Atlas"; FAQ: "Making your website more accessible helps ChatGPT Agent in Atlas understand it better" — [OpenAI](https://openai.com/index/introducing-chatgpt-atlas/); [Adrian Roselli](http://adrianroselli.com/2025/10/openai-aria-and-seo-making-the-web-worse.html)
- Anthropic's own docs site serves an llms.txt index (illustrates the convention for documentation, not a claim that Claude in Chrome reads site llms.txt) — [code.claude.com/docs/llms.txt](https://code.claude.com/docs/llms.txt)

### Inferences

- For the EPUB editor, WebMCP imperative tools (e.g. "open chapter", "list files", "set panel") would reach Chrome-based agents that consume it and any extension using content scripts; it must be feature-detected and treated as progressive enhancement. The preview iframe would need `allow="tools"` only if it is cross-origin and registers tools itself.
- Agents with JS evaluation can already call an app-exposed global API without WebMCP, but that is unsanctioned and undiscoverable.

### Gaps

- No primary confirmation that Gemini in Chrome, Claude in Chrome, ChatGPT extension or Comet consume WebMCP tools today; no product documents consuming llms.txt while acting on a page.

## User-consent model (permissions, confirmations, profiles, takeover)

### Takeaway

All consumer agents use a human-in-the-loop model: per-site permission (Claude), mandatory confirmation/take-over for purchases, sign-ins, ToS and account creation (Gemini), isolated profiles (Brave, Edge for Business), and visible task tabs with take-over/stop controls.

### Cited Findings

- Claude in Chrome: two modes, "Manually approve" (formerly "Ask before acting") and "Automatically approve" (screens each action, pauses when needed); per-site choices Allow all for this website / Allow this time only / Deny; even with site-wide allow it asks before downloading files, entering sensitive info, granting authorizations; Team/Enterprise admins set allow/blocklists — [Claude permissions guide](https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide)
- Claude Code: site permissions inherited from the extension; in auto mode a classifier-approved call skips the extension's per-site check; a project's settings cannot turn on Chrome integration (`CLAUDE_CODE_ENABLE_CFC` ignored) — [code.claude.com](https://code.claude.com/docs/en/chrome)
- Gemini auto browse: confirmation before starting a task, sending communications, modifying data, submitting web forms, scheduling, and accessing highly sensitive financial/health sites; take-over required for finalizing financial transactions, accepting ToS, creating accounts; "Take over task" / "Give back task" / Stop — [Chrome Help](https://support.google.com/chrome/answer/16821166?hl=en)
- Brave: AI browsing creates a separate persistent profile; cookies and logged-in state do not cross from the main profile; alignment checking verifies intended actions — [Brave blog](https://brave.com/blog/ai-browsing/); [Brave support](https://support.brave.app/hc/en-us/articles/41240379376909)
- Edge: saved passwords not accessible while Copilot browses (secondary) — [WindowsForum](https://windowsforum.com/news/edge-browse-with-copilot-session-access-screenshot-privacy-and-prompt-injection-risks.452289/)
- Atlas (historical): logged-out mode option; agent could not run code or install extensions (from launch coverage) — [Simon Willison](https://simonwillison.net/2025/Oct/21/introducing-chatgpt-atlas/)

### Inferences

- Brave's isolated profile means an OPFS-stored project in the user's normal profile is invisible to Brave's agent; same likely for any isolated-profile agent (Edge for Business tab is "isolated", meaning unclear). Agents running in the user's profile (Claude in Chrome, Gemini local, ChatGPT extension) see the same OPFS origin storage.
- Gemini's "confirm before submitting web forms / modifying your data" may prompt the user on every save in an editor.

### Gaps

- Comet's and the ChatGPT extension's confirmation rules not found in primary sources.

## Connections to local MCP servers or desktop clients

### Takeaway

Claude in Chrome bridges to Claude Code (CLI/VS Code) via native messaging plus a cloud bridge; Opera Neon exposes the browser itself as an MCP server; Playwright MCP's extension mode and DevTools MCP attach to a running Chrome. Gemini, Comet, Dia and the ChatGPT extension have no documented local-MCP link.

### Cited Findings

- Claude Code installs a native messaging host config per browser (Chrome/Edge/Brave paths listed) and connects through `bridge.claudeusercontent.com`; `/chrome` chooses among multiple connected browsers — [code.claude.com](https://code.claude.com/docs/en/chrome)
- Playwright MCP `--extension` connects to a running Chrome/Edge via the "Playwright Extension" to use logged-in tabs; profiles: persistent default (`--user-data-dir`), `--isolated` in-memory, `--storage-state` — [GitHub](https://github.com/microsoft/playwright-mcp)
- Chrome DevTools MCP can connect to a running Chrome instead of launching one; has `--isolated` and persistent user-data options — [GitHub](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- Opera Neon MCP Connector: MCP server URL for Claude, ChatGPT, n8n, etc. — [Opera press](https://press.opera.com/?p=3885)
- WebMCP sample extension talks to a local Node server — [Chrome for Developers](https://developer.chrome.com/docs/ai/webmcp)

### Inferences

- An app-specific MCP server (like a seed-bridge) is complementary: browser agents operate the UI; a local MCP bridge gives structured access. Opera Neon and Playwright extension mode let desktop MCP clients drive the user's real profile, so OPFS data is reachable.

### Gaps

- Whether Claude Desktop (not Code) uses the same bridge was not confirmed in fetched docs.

## Published guidance for site developers

### Takeaway

The guidance converges on accessibility: OpenAI says ARIA and accessibility help its agent; Google's WebMCP doc says declare tool purposes explicitly, use JSON Schema, keep tools visible, add confirmation, treat as progressive enhancement. No Anthropic, Microsoft, Perplexity, Opera or Brave site-developer guide was found.

### Cited Findings

- OpenAI: add ARIA tags; making the site accessible helps the agent; follow WAI-ARIA roles, labels and states on buttons, menus, forms (latter paraphrase secondary) — [OpenAI](https://openai.com/index/introducing-chatgpt-atlas/); [Roselli](http://adrianroselli.com/2025/10/openai-aria-and-seo-making-the-web-worse.html); [aeotable](https://www.aeotable.com/en/blog/chatgpt-atlas-website-checklist)
- Critique: Roselli argues ARIA-for-agents advice risks worsening the web (misusing ARIA instead of semantic HTML) — [Adrian Roselli](http://adrianroselli.com/2025/10/openai-aria-and-seo-making-the-web-worse.html)
- Google WebMCP best practices (see Section 4) and linked best-practices / tool-security pages — [Chrome for Developers](https://developer.chrome.com/docs/ai/webmcp)
- Playwright MCP's own design (a11y snapshot first) implies labelled controls are what it can target — [GitHub](https://github.com/microsoft/playwright-mcp)

### Inferences

- For the EPUB editor: native semantic controls with accessible names (already house style), stable visible labels, `<dialog>` instead of `window.confirm`, avoiding closed shadow roots, keeping key state reachable without hover, and a feature-detected WebMCP layer cover the surveyed agents.

### Gaps

- No Microsoft Edge, Anthropic, Perplexity or Brave developer guidance page located; WebMCP best-practices and tool-security subpages not fetched.
