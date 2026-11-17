# Security guidance for agentic browsing and agent-instruction conventions (as of 2026-11-17)

Scope note: items are dated. Anything from before 2026 is marked [2025] or older. Figures marked "secondary" come from press or blog coverage, not from the vendor's own document, and should be checked before they are quoted as fact.

## 1. Prompt injection in agentic browsers: attacks, disclosures, mitigations, residual rates

### Takeaway

Every major agentic browser (Comet, Atlas, Claude in Chrome, Gemini in Chrome) has had published indirect prompt-injection findings or vendor red-team numbers. Vendors now say outright that the problem is not solved. The best published per-attempt success rates with safeguards are about 0–2%, but they climb under repeated or adaptive attack. Defences are layered: model training, injection classifiers, separate critic models, origin/site scoping, and confirmation of high-risk actions.

### Cited Findings

**Anthropic (Claude in Chrome / browser use)**

- [2025-08-25] Claude for Chrome launch: 123 test cases across 29 attack scenarios. Attack success rate (ASR) was 23.6% without mitigations and 11.2% with mitigations in autonomous mode. On a browser-specific "challenge" set (hidden DOM form fields, injections in URL text and tab titles), ASR fell from 35.7% to 0%. — [Claude blog: Claude for Chrome](https://claude.com/blog/claude-for-chrome)
- [2025-08-25] Mitigations: site-level permissions the user can grant or revoke; action confirmations before high-risk actions (publishing, purchasing, sharing personal data), some of which stay on even in autonomous mode; blocked site categories (financial services, adult, pirated content); improved system prompts; classifiers for suspicious instructions. Expanded to Max beta on 2025-11-24 and to Pro/Team/Enterprise on 2025-12-18. — [Claude blog](https://claude.com/blog/claude-for-chrome)
- [2025-11-24] Anthropic's browser prompt-injection research used an internal adaptive Best-of-N attacker with 100 attempts per environment, roughly 2,200–3,200 attempts per bar. ASR by condition (model only / old safeguards / improved safeguards): Sonnet 4: 13.8% / 10.7% / 2.0%. Sonnet 4.5: 13.8% / 10.8% / 1.9%. Haiku 4.5: 12.0% / 11.1% / 2.4%. Opus 4.5: 8.0% / 7.6% / 1.4%. — [Anthropic: prompt injection defenses](https://www.anthropic.com/research/prompt-injection-defenses)
- [2025-11-24] Defences named in that research: RL training against simulated injections, classifiers that scan all untrusted content entering the context, and internal plus external red teaming. Quotes: "No browser agent is immune to prompt injection" and "A 1% attack success rate—while a significant improvement—still represents meaningful risk." — [Anthropic](https://www.anthropic.com/research/prompt-injection-defenses)
- [2026, secondary] The Opus 4.8 system card (May 2026) reportedly gives 31.5% raw browser ASR without safeguards and 0.5% with them, across 129 browser environments, plus 2.09% for coding surfaces under adaptive attack. — [VentureBeat](https://venturebeat.com/security/anthropic-browser-agent-hijacked-31-percent-before-safeguards-engaged). Not checked against the system card itself.
- [2026, secondary] Claude in Chrome GA (August 2026) coverage reports 0% ASR for several newer models and 0.3% for one with safeguards combined, and 17.6% for Opus 4.5 without extra defences in a newer evaluation. That 17.6% does not match the 8.0% published in November 2025, probably because the method differs. — [AI Understanding summary](https://aiunderstanding.org/news/anthropic-makes-claude-in-chrome-generally-available-with-autonomous-browser-actio)
- [2026, secondary] Repeated attempts raise ASR: one write-up cites 33.6% at 10 attempts and 63% at 100 attempts for an earlier Opus model. — [Crux Digits](https://cruxdigits.nl/blog/ai-browser-agents-2026-security/). Unverified secondary figure.

**Perplexity Comet (Brave research)**

- [2025-08-20] Brave disclosed indirect prompt injection in Comet (page content treated as instructions) and a similar issue in Fellou. — [Brave blog (follow-up post references it)](https://brave.com/blog/unseeable-prompt-injections/)
- [2025-10-21] Brave's "unseeable prompt injections": nearly invisible text in screenshots (faint light-blue on yellow) was processed as commands when users asked Comet about a screenshot. Found 2025-10-01, Perplexity notified 2025-10-02. Brave notes Comet is closed source, so its explanation is inferred. — [Brave](https://brave.com/blog/unseeable-prompt-injections/); [Search Engine Journal](https://www.searchenginejournal.com/brave-reveals-systemic-security-issues-in-ai-browsers/)
- [2025-10-22] Perplexity published "Mitigating Prompt Injection in Comet", acknowledging ongoing challenges. — [PPC Land](https://ppc.land/comet-browser-faces-multiple-security-vulnerabilities-from-prompt-injection/)

**OpenAI ChatGPT Atlas**

- [2025-10] NeuralTrust: text crafted to look like a URL fails URL validation in the omnibox, and Atlas then treats the whole string as a trusted user prompt (prompt injection via the omnibox). — [IT Pro](https://www.itpro.com/security/cyber-researchers-have-already-identified-several-big-security-vulnerabilities-on-openais-atlas-browser); [The Hacker News](https://thehackernews.com/2025/10/new-chatgpt-atlas-browser-exploit-lets.html)
- [2025-10] LayerX: a CSRF request rides on the logged-in session and writes hidden instructions into ChatGPT's persistent memory, which reportedly survive restarts and switching browsers. — [The Hacker News](https://thehackernews.com/2025/10/new-chatgpt-atlas-browser-exploit-lets.html); [Datamation](https://www.datamation.com/security/openai-atlas-browser-security-flaw/). Patch status not publicly detailed; some CVE/CVSS attributions on secondary sites are unverified.
- [2025-12-22] OpenAI "Hardening Atlas against prompt injection": an RL-trained LLM attacker discovers new injection classes, which become targets for adversarial training and stronger surrounding safeguards. OpenAI shipped an update with a newly adversarially trained model. — [OpenAI](https://openai.com/index/hardening-atlas-against-prompt-injection). Coverage says OpenAI conceded prompt injection is unlikely ever to be fully "solved". — [Selina (secondary)](https://selina.ai/blog/openai-admits-prompt-injection-in-browser-agents-may-never-be-fully-solved-what-that-means-for-anyone-building-agentic-a); [Zenity Labs analysis](https://labs.zenity.io/p/hardening-atlas-the-relentless-challenge-of-securing-an-untrusted-browser-agent)

**Google Gemini in Chrome**

- [2025-12-08] The **User Alignment Critic** is a separate Gemini model that vets each action the planner proposes against the user's stated goal, after planning. It sees only metadata about the proposed action, not raw untrusted web content, so web content cannot poison it directly. — [Google Chrome Security blog](https://blog.google/security/architecting-security-for-agentic/); [The Register](https://www.theregister.com/2025/12/09/google_fortifies_chrome_ai_with/)
- [2025-12-08] **Agent Origin Sets** extend site isolation and the same-origin policy to agents. A gating function, which is also not exposed to untrusted content, decides which origins are relevant to a task and splits them into read-only and read-write sets for that session, which bounds cross-origin leaks. Origin isolation was reported as already in current builds. — [Google](https://blog.google/security/architecting-security-for-agentic/); [SecurityWeek](https://www.securityweek.com/google-fortifies-chrome-agentic-ai-against-indirect-prompt-injection-attacks/); [The Hacker News](https://thehackernews.com/2025/12/google-adds-layered-defenses-to-chrome.html)

**Exfiltration via rendered content (related, non-browser agents)**

- [2025-06] EchoLeak (CVE-2025-32711, M365 Copilot): a crafted email got past the XPIA injection classifier, used reference-style Markdown to dodge link redaction, and exfiltrated data through an image fetch routed via a trusted Microsoft Teams proxy that the CSP allowed. Zero-click. — [Simon Willison](https://simonwillison.net/2025/Jun/11/echoleak/); [promptfoo LMVD](https://promptfoo.dev/lm-security-db/vuln/echoleak-zero-click-data-exfiltration-a87757e2/)
- [2025-10] CamoLeak (GitHub Copilot Chat, CVSS 9.6): hidden instructions in invisible Markdown comments in a PR description exfiltrated private-repo data through GitHub's own Camo image proxy. GitHub fixed it by disabling image rendering in Copilot Chat (around 2025-08-14). — [The Register](https://www.theregister.com/2025/10/09/github_copilot_chat_vulnerability/); [BlackFog](https://www.blackfog.com/camoleak-how-github-copilot-became-an-exfiltration-channel/)
- Lesson drawn by commentators: URL allowlists alone fail, because recorded bypasses routed data through trusted domains that log requests. Gemini blocks external Markdown images with a sanitizer. — [Particula](https://particula.tech/blog/ai-agent-data-exfiltration-channels-audit); [Checkmarx](https://checkmarx.com/zero-post/exploiting-markdown-injection-in-ai-agents-microsoft-copilot-chat-and-google-gemini/)

### Inferences

- Vendor numbers are not comparable across reports (different attackers, attempt budgets and environments). The consistent pattern is roughly 10–30% raw ASR, falling to 0–2% with layered safeguards, and rising under repeated attempts.
- For an EPUB editor whose book files may be hostile, the relevant attack shapes are hidden text in content (Brave screenshots, CamoLeak's invisible comments), content that looks like a command or URL (the Atlas omnibox), persistence into memory or instructions (LayerX), and exfiltration through rendered images or links (EchoLeak, CamoLeak). Book XHTML and CSS can carry all of these. Exfiltration through preview rendering of remote images is directly analogous.
- Google's design applies cleanly to an app: the component that approves an action should not read untrusted content, and write scope should be fixed per session before untrusted content is read.

### Gaps

- No primary attack-success figures found for Atlas or Comet.
- The Opus 4.8 system card and the August 2026 Claude in Chrome GA numbers were not verified against primary documents.
- The WASP benchmark was not reached in this pass.

## 2. Standards and frameworks

### Takeaway

The consensus framing is architectural rather than filter-based: assume injection will sometimes succeed and limit what a compromised agent can do. The main formulations are Willison's lethal trifecta, Meta's Agents Rule of Two, OWASP's agentic Top 10 (with "least agency" as its core idea), and capability or dual-LLM designs such as CaMeL. Research shows adaptive attacks break most published detection defences.

### Cited Findings

- [2025-06-16] Simon Willison's **lethal trifecta**: private data access + exposure to untrusted content + an external communication channel lets prompt injection become data theft. — [Willison (via Nov 2025 post and tag pages)](https://simonwillison.net/2025/Nov/2/new-prompt-injection-papers/)
- [2025-10-31] Meta's **Agents Rule of Two**: "until robustness research allows us to reliably detect and refuse prompt injection," an agent should satisfy no more than two of: [A] "can process untrustworthy inputs"; [B] "can have access to sensitive systems or private data"; [C] "can change state or communicate externally". If all three are needed, the agent "requires supervision" (human approval or another reliable check). Splitting work across sessions with fresh contexts is suggested. — [Meta AI blog](https://ai.meta.com/blog/practical-ai-agent-security/), summarised in [Willison 2025-11-02](https://simonwillison.net/2025/Nov/2/new-prompt-injection-papers/)
- [2025-11-02] Willison argued that A+C (untrusted input + state change) is not "safe" even without private data. Meta relabelled that region from "safe" to "lower risk". Rule of Two was inspired by both the trifecta and Chrome's own "Rule of 2". — [Willison](https://simonwillison.net/2025/Nov/2/new-prompt-injection-papers/)
- [2025-10-10] "The Attacker Moves Second" (Nasr, Carlini, Tramèr et al.; 14 authors from OpenAI, Anthropic and Google DeepMind) tested 12 published jailbreak/prompt-injection defences against adaptive attacks and bypassed all 12, mostly at above 90% ASR, though most had reported near-zero ASR. A human red-team competition (500 participants, $20,000 prize pool) defeated every defence. — [arXiv 2510.09023](https://arxiv.org/abs/2510.09023), via [Willison](https://simonwillison.net/2025/Nov/2/new-prompt-injection-papers/)
- [2025-12-09] **OWASP Top 10 for Agentic Applications 2026** (ASI01–ASI10), from the OWASP GenAI Security Project with more than 100 contributors. It covers agent goal hijack, tool misuse, identity and privilege abuse, supply chain, unexpected code execution, memory and context poisoning, insecure inter-agent communication, cascading failures, human-agent trust exploitation and rogue agents. It complements the LLM Top 10, which carries LLM01 Prompt Injection. Its central principle is "least agency". — [OWASP GenAI resource page](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026); [Palo Alto Networks summary](https://paloaltonetworks.com/blog/cloud-security/owasp-agentic-ai-security/); [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [2025-03, older] **CaMeL** ("Defeating Prompt Injections by Design", Debenedetti et al., Google/ETH). A privileged LLM writes a plan as code from the trusted user query only. A quarantined LLM parses untrusted data and has no tool access. A custom interpreter tracks data provenance (capabilities) and enforces policies at tool calls. Reported result: 77% of AgentDojo tasks solved with provable security vs 84% undefended (an earlier version reported 67%). Secondary summaries say it produced 0 successful attacks vs 44 undefended. — [arXiv 2503.18813](https://arxiv.org/abs/2503.18813); [code](https://github.com/google-research/camel-prompt-injection); [summary](https://www.themoonlight.io/review/defeating-prompt-injections-by-design). Exact attack counts are from secondary summaries.
- [2025-01, older] NIST CAISI ran agent-hijacking experiments on AgentDojo (Claude 3.5 Sonnet upgraded), fixed scenario bugs, and released agentdojo-inspect. A later CAISI red-teaming competition logged more than 250,000 attacks from over 400 participants, and at least one attack succeeded against every target frontier model. — [NIST CAISI blog](https://www.nist.gov/blogs/caisi-research-blog/insights-ai-agent-security-large-scale-red-teaming-competition); [NIST](https://www.nist.gov/node/1872381)
- [2025-03, older] NIST AI 100-2 E2025 (adversarial ML taxonomy) reportedly frames indirect prompt injection as a consequence of merged data/instruction channels, with agent hijacking leading to code execution and exfiltration. — secondary only ([wikidocs](https://wikidocs.net/470689)). Not verified against the PDF.

### Inferences

- For "reads untrusted book text + writes the user's book": the editor sits at Rule-of-Two A+C (and B if other private projects or credentials are reachable). The recommended responses are to remove C's external half (no network egress or remote fetches from agent-driven rendering), keep writes scoped and reversible, and require human supervision for anything leaving the project (publish/send).
- Detection classifiers help but are not a boundary (Attacker Moves Second). Hard limits on capability should carry the security weight.

### Gaps

- OWASP agentic Top 10 per-item mitigation text was not fetched in full; the category list comes from summaries.
- No NIST normative guidance (for example an SP or profile) specific to agent tool permissions was found.

## 3. Guidance for app developers exposing tools to agents (MCP and similar)

### Takeaway

The MCP spec sets the baseline: a human in the loop who can deny calls, visible indicators when tools are invoked, confirmation for sensitive operations, showing inputs before a call to prevent exfiltration, and logging. Tool annotations (readOnlyHint, destructiveHint and so on) are hints that clients **MUST** treat as untrusted unless the server is trusted. The security best-practices document covers authorization, SSRF, local server consent, URL-scheme validation and scope minimisation.

### Cited Findings

- [Spec 2025-11-25] "For trust & safety and security, there **SHOULD** always be a human in the loop with the ability to deny tool invocations." Applications SHOULD make clear which tools are exposed, insert clear visual indicators when tools are invoked, and present confirmation prompts. — [MCP spec: Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [Spec 2025-11-25] "clients **MUST** consider tool annotations to be untrusted unless they come from trusted servers." — [MCP spec: Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [Spec 2025-11-25] Servers MUST validate inputs, implement access controls, rate-limit and sanitise outputs. Clients SHOULD prompt for confirmation on sensitive operations, "Show tool inputs to the user before calling the server, to avoid malicious or accidental data exfiltration", validate results before passing them to the LLM, set timeouts and log tool usage for audit. — [MCP spec: Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [Draft, current 2026] The MCP Security Best Practices cover confused deputy (per-client consent is a MUST for proxies), the token passthrough ban, SSRF (HTTPS only, block private and link-local ranges, validate redirects, egress proxies), state-handle hijacking (MCP is stateless as of protocol `2026-07-28`; handles must not count as authentication), local server compromise (show the exact command, require explicit approval, sandbox), OAuth URL validation (allow only http/https, reject `javascript:`/`data:`/`file:`, no shell URL opening, CSP `script-src 'self'` for web clients) and progressive least-privilege scopes. Dynamic Client Registration is deprecated as of `2026-07-28`. — [MCP Security Best Practices (draft)](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)
- [2025-08 to 2026] Tool/skill poisoning in practice: instructions hidden in SKILL.md can steer agents without being visible in script review. A January 2026 Snyk audit of the ClawHub registry found 341 malicious skills among 2,857 (about 12%). SafeDep lists persistence by editing AGENTS.md and other agent config files as an attack. — [Snyk](https://snyk.io/articles/skill-md-shell-access/); [SafeDep](https://safedep.io/agent-skills-threat-model/); [Mondoo](https://mondoo.com/blog/agent-skills-real-power-real-risk)
- Data exfiltration via images/URLs: see EchoLeak and CamoLeak above. GitHub's remedy was to disable image rendering; Google sanitises external Markdown images. — [The Register](https://www.theregister.com/2025/10/09/github_copilot_chat_vulnerability/); [Checkmarx](https://checkmarx.com/zero-post/exploiting-markdown-injection-in-ai-agents-microsoft-copilot-chat-and-google-gemini/)

### Inferences

- An app exposing book-editing tools should declare honest annotations but should not rely on clients honouring them. The app itself should enforce read-only vs write and gate destructive or outbound actions.
- Tool results that carry book text are untrusted data going back to the model. Delimiting and labelling them as untrusted, and keeping instructions out of tool descriptions that could be influenced by book content, follows directly from the spec's "validate tool results before passing to LLM".
- Agent-triggered previews should not fetch remote resources (an image, font or CSS URL in a hostile book is an exfiltration channel once the agent can write data into a URL).

### Gaps

- The exact text of the tool annotation fields (readOnlyHint, destructiveHint, idempotentHint, openWorldHint definitions and defaults) was not captured in this fetch beyond the "untrusted" warning. They live in the MCP schema reference.
- No authoritative guidance was found on a browser-page (non-MCP) tool-exposure API for agents.

## 4. Consent and permission models: per-call confirmation, scoped grants, logs, undo

### Takeaway

Products converge on graded permission modes (ask every time, allow-list or "accept edits", classifier-reviewed auto mode), per-site or per-directory scoping, mandatory confirmation for irreversible or outbound actions, audit logging, and cheap undo (checkpoints). Checkpoints have known blind spots: shell-made changes, subagents and external edits.

### Cited Findings

- [2026] Claude Code permission modes: Auto mode, where a separate classifier model reviews actions and blocks unsafe ones (the default starting mode for interactive terminal/VS Code sessions), and Manual mode, which is read-only by default and asks before edits and commands with "approve once or allow from then on". Accept Edits auto-approves file edits in the working directory. A working-directory boundary prompts before file tools leave the project. Fail-closed matching means unmatched commands require approval. Network commands (curl, wget) are not auto-approved. — [Claude Code: Security](https://code.claude.com/docs/en/security)
- [2026] Claude Code prompt-injection safeguards: WebFetch passes pages through a separate model call and Claude receives the summary, not the raw page (an isolation layer). A workspace trust dialog appears for untrusted folders. Project `.mcp.json` servers get their own approval prompt. Headless `-p` sessions show neither prompt. "No system is completely immune." Advice: avoid piping untrusted content directly and use VMs for untrusted work. — [Claude Code: Security](https://code.claude.com/docs/en/security)
- [2026] Claude Code checkpoints: a checkpoint is captured before each user prompt, the last 100 are kept per session, `/rewind` (alias `/undo`) restores code, conversation or both, and checkpoints persist across resume with about 30-day retention. Limitations: files changed only by Bash are not tracked; most subagent edits are not restored; external and concurrent-session edits are not captured; symlinks and hard links are skipped. "Not a replacement for version control." — [Claude Code: Checkpointing](https://code.claude.com/docs/en/checkpointing)
- [2025-08 / 2025-12] Claude in Chrome: per-site grants that the user can revoke, confirmation before publishing, purchasing or sharing personal data, and blocked categories. — [Claude blog](https://claude.com/blog/claude-for-chrome)
- [2025-12] Gemini in Chrome: per-task read-only vs read-write origin sets chosen by a gating function before acting. — [Google](https://blog.google/security/architecting-security-for-agentic/)
- [Spec] MCP: per-call deny ability, visible invocation indicators, input display before call, and audit logging. — [MCP Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [Draft] MCP scope minimisation: a minimal initial scope, incremental elevation via step-up challenges, and logging of elevation events. — [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)

### Inferences

- A natural model for a browser EPUB editor: a session grant scoped to one project, read vs write split up front (Origin Sets analogue), per-call or batched confirmation for writes to stylesheets and transform scripts (executable surface), always-confirm for publish/send/network, a visible activity log of agent writes, and an automatic per-turn snapshot so the user can revert. The editor can track every write itself, so it avoids Claude Code's "Bash not tracked" blind spot.

### Gaps

- Primary documentation for Cursor's and GitHub Copilot agent's checkpoint/undo and approval models was not fetched in this pass.

## 5. Agent instruction file conventions and trust of repository-provided instructions

### Takeaway

AGENTS.md is the de facto cross-vendor convention and is now stewarded by the Linux Foundation's Agentic AI Foundation. It has a self-reported 60k+ projects and many supporting tools, a nearest-file-wins rule, and user chat prompts overriding it, but almost no security guidance. CLAUDE.md is Anthropic's equivalent. llms.txt is widely published but barely consumed. Agent Skills (SKILL.md) is an open format with a demonstrated malicious-content problem. Tool vendors handle untrusted repositories with workspace-trust gates, which have been bypassed or disabled by default in practice.

### Cited Findings

- [2025-12-09] The Linux Foundation formed the **Agentic AI Foundation (AAIF)** with founding projects MCP (Anthropic), goose (Block) and AGENTS.md (OpenAI). Co-founded by OpenAI, Anthropic and Block, with support from Google, Microsoft, AWS, Bloomberg and Cloudflare. — [Linux Foundation press release](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation); [OpenAI](https://openai.com/index/agentic-ai-foundation/)
- [current] agents.md: "README for agents", plain Markdown with no required fields, placed at the repo root, with nested files in monorepos and "the closest AGENTS.md to the edited file wins". "Explicit user chat prompts override everything." Agents will run listed test commands. It emerged from work by OpenAI Codex, Amp, Google Jules, Cursor and Factory. It claims "over 60k open-source projects" (self-reported, no independent count found). Listed supporters include Codex, Jules, Factory, Aider, goose, opencode, Zed, Warp, VS Code, Devin, Junie, Amp, Cursor, RooCode, Gemini CLI, Kilo Code, Semgrep, GitHub Copilot coding agent, Windsurf and Augment Code. Security content is limited to suggesting a "security considerations" section. — [agents.md](https://agents.md/)
- [2026] Claude Code loads CLAUDE.md and project settings. Its stated untrusted-repo control is the workspace trust dialog for folders not yet trusted, plus separate approval for project `.mcp.json` servers. Non-interactive `-p` runs skip both, and the docs have a page on "what runs before you trust a folder". — [Claude Code: Security](https://code.claude.com/docs/en/security)
- [2025-09] Cursor shipped with VS Code-style Workspace Trust disabled by default, so a `.vscode/tasks.json` with `runOn: "folderOpen"` ran on opening a malicious repo with no prompt. VS Code with Workspace Trust blocks this until trust is granted. Cursor's response was that users can enable trust, and reports disagree on whether the default later changed. Enabling trust in Cursor disables AI features. — [Oasis Security](https://www.oasis.security/blog/cursor-security-flaw); [The Hacker News](https://thehackernews.com/2025/09/cursor-ai-code-editor-flaw-enables.html); [CSO Online](https://www.csoonline.com/article/4054796/cursors-autorun-lets-hackers-execute-arbitrary-code.html)
- [late 2025 to 2026] **Agent Skills** (SKILL.md folders with optional scripts and assets) were released by Anthropic as an open standard and are supported by multiple tools. Threats: hidden instructions in SKILL.md, auto-updates pulling in malicious versions, and no widely adopted signing. Red Hat advises restricting skill-folder permissions and treating skills like dependencies. An arXiv study reports adversarial skills evading registry scans in a large share of cases. — [Red Hat Developer, 2026-03-10](https://developers.redhat.com/articles/2026/03/10/agent-skills-explore-security-threats-and-controls); [arXiv 2605.11418](https://arxiv.org/pdf/2605.11418); [Snyk](https://snyk.io/articles/skill-md-shell-access/)
- [2026] Persistence by an injected agent editing AGENTS.md or other config files is listed as an attack. — [SafeDep](https://safedep.io/agent-skills-threat-model/)
- [2026] **llms.txt** status: Google's May 2026 AI search guide lists it as not needed for AI Overviews/AI Mode, and John Mueller called it "purely speculative". Yet Chrome for Developers docs (updated 2026-05-05) call it "an emerging convention" and Lighthouse added an llms.txt discoverability check in May 2026. Ahrefs (May 2026, 137k sites) found 97% of llms.txt files received zero AI requests. SE Ranking found about 10.13% adoption across about 300k domains. OpenAI's GPTBot does not officially use it. Anthropic publishes one but does not say its crawlers use it. — [Ahrefs study](https://ahrefs.com/fr/blog/llmstxt-study/); [PPC Land](https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/); [Optimizely](https://www.optimizely.com/field-notes/articles/does-llms-txt-work/); [pasqualepillitteri.it on the Lighthouse audit](https://pasqualepillitteri.it/en/news/3734/llms-txt-google-seo-chrome-lighthouse-en); [letsdatascience on Mueller](https://letsdatascience.com/news/googles-mueller-says-llmstxt-wont-guide-llm-recommendations-8afc3fa3). Its main real use is agent-facing docs indexes: MCP and Claude Code docs pages point fetchers to their llms.txt ([MCP docs](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)).

### Inferences

- A project brief such as AGENTS.md inside a book's source folder is exactly the "repository-provided instructions" problem: if the book came from someone else, the brief is untrusted input with elevated influence, because agents are built to follow it. The industry control is a trust gate (do not load or act on it until the user trusts this project), with the user's own prompt taking precedence (AGENTS.md's stated rule).
- Because injected agents are known to persist by writing to instruction files (SafeDep, LayerX memory), writes to the brief file itself warrant a confirmation and a visible diff.
- Supporting AGENTS.md (nearest-file precedence, plain Markdown) maximises cross-agent compatibility. CLAUDE.md can be a symlink or alias, as agents.md suggests for migrations.

### Gaps

- No formal AGENTS.md specification with security semantics (trust levels, signing) exists. The site is informal.
- The agentskills.io specification's own security section was not read.
- No vendor guidance was found that specifically addresses instruction files embedded in user documents (as opposed to code repositories).
