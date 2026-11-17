# Localhost access from public https pages, and storage-change observation (as of 2026-11-17)

## Chrome Local Network Access (LNA): status, milestones, prompt, coverage, mixed content

### Takeaway

By November 2026, Chrome gates every fetch, subresource, iframe, WebSocket and WebTransport connection from a public https page to loopback behind a user permission. It shipped in stages: fetch, subresources and iframes in M142 (Oct 2025), a separate loopback permission labelled "Apps on device" in M145, and WebSockets and WebTransport in M147 (7 Apr 2026). `ws://localhost` and `ws://127.0.0.1` from an https page are exempt from mixed-content blocking, but the user must click Allow once per site. The older Private Network Access (PNA) design, built on CORS preflights, was dropped.

### Cited Findings

- **PNA was superseded.** PNA required CORS preflights in which the target opted in. It "was put on hold and replaced by LNA", which uses a permission instead. The blog post is dated 9 Jun 2025 and was updated 29 Sep 2025 to say the prompt launches in Chrome 142. — [Chrome blog: New permission prompt for LNA](https://developer.chrome.com/blog/local-network-access)
- **Chrome 138 testing:** opt in with `chrome://flags/#local-network-access-check` set to "Enabled (Blocking)". The initial scope was fetch(), subresource loads and subframe navigation. WebSockets, WebTransport and WebRTC were "not yet gated" (crbug 421156866, 421216834, 421223919). — [Chrome blog](https://developer.chrome.com/blog/local-network-access)
- **Address spaces.** Loopback is 127.0.0.0/8 and ::1/128. Local is RFC1918, 169.254/16, fc00::/7, fe80::/10 and `.local`. The first milestone covers public→local and public→loopback. local→local and local→loopback are future scope. — [Chrome blog](https://developer.chrome.com/blog/local-network-access)
- **Default-on.** The prompt shipped in Chrome 142, released 28 Oct 2025 according to secondary sources. — [Chrome blog](https://developer.chrome.com/blog/local-network-access); [Beyond Identity](https://support.beyondidentity.com/hc/en-us/articles/34457691192215-Managing-the-Chrome-v142Local-Network-Access-Prompt)
- **M145 split the permission in two.** `local-network` covers local addresses. `loopback-network` covers 127/8, ::1 and `localhost`. The old `local-network-access` name remains as a legacy alias, and Chrome's guide says querying it can crash older renderers. — [Chrome LNA guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access.md.txt); [blink-dev](https://www.mail-archive.com/blink-dev@chromium.org/msg15688.html)
- **Prompt label.** Chrome 142–144 labels the permission "Local network access". From Chrome 145 the label is "Apps on device". Users who allowed the old permission must allow "Apps on device" again. The initial prompt text read "Look for and connect to any device on your local network", with Block and Allow buttons. — [Figma help: Local network access](https://help.figma.com/hc/en-us/articles/34458998159511-Local-network-access-in-Figma); [Chrome blog](https://developer.chrome.com/blog/local-network-access)
- **WebSockets.** The Intent to Ship was posted 20 Feb 2026, with DevTrial in M142 and shipping in M147. It had been delayed from M144 "due to holidays and enterprise concerns". Loopback is included. — [blink-dev I2S: LNA for WebSockets](https://groups.google.com/a/chromium.org/g/blink-dev/c/O6GMKt44Ups); [blink-dev Intent to Extend Experiment](https://groups.google.com/a/chromium.org/g/blink-dev/c/lRnFRIfzDMU)
- **Chrome 147 stable (7 Apr 2026)** covers both:
  - WebSocket connections to local addresses "now trigger permission prompts".
  - WebTransport local and loopback requests are gated behind a prompt and restricted to secure contexts.
  - LNA also now applies to service-worker `WindowClient.navigate()` when the target is a subframe.
  - Main-frame navigations are not covered.

  — [Chrome 147 release notes](https://developer.chrome.com/release-notes/147)

- **WebRTC** reportedly came under LNA in Chrome 146. This is from secondary sources only. — [Jamf](https://support.jamf.com/en/articles/12894739-chrome-local-network-access-prompts-with-jamf-trust-ztna)
- **Mixed-content exemption for WebSocket.** `ws://` from an `https://` page is exempt when the host is one of:
  - a private or loopback IP literal, including `127.0.0.1` and `[::1]`
  - `localhost` or `*.localhost`
  - a `.local` name

  Other DNS names should use `wss://`. The WebSocket constructor takes protocol strings, and an options object threw a SyntaxError before Chrome 154. — [Chrome LNA guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access.md.txt)

- **localhost is already a secure origin.** Microsoft says that if you only connect to localhost you can already serve over HTTPS, because "localhost is considered a secure origin by the mixed content specification". — [Microsoft Learn: Edge LNA](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)
- **`targetAddressSpace` for fetch** takes `'local'` or `'loopback'`. Declaring it before DNS resolution exempts an `http://` request from mixed-content blocking once permission is granted. If the address it resolves to doesn't match, the request fails with a TypeError. — [Chrome LNA guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access.md.txt); [Microsoft Learn](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)
- **Chrome 154 (stable 22 Sep 2026):**
  - Adds a WebSocket options bag and a `targetAddressSpace` WebSocket option, e.g. `new WebSocket("ws://local-server.example", {targetAddressSpace:"local"})`. The release-notes entry was marked "pending review".
  - Background Fetch now needs the LNA permission.

  — [Chrome 154 release notes (chromestatus)](https://chromestatus.com/release-notes/154)

- **WebTransport** requires `https://` and has no `targetAddressSpace` option. If permission is denied, `transport.ready` rejects. Self-signed certificates can be pinned with `serverCertificateHashes`. — [Chrome LNA guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access.md.txt)
- **Workers.** Service and shared workers cannot trigger the prompt and fail unless the permission is already granted. Request it first from a window. — [Chrome LNA guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access.md.txt); [Chrome blog](https://developer.chrome.com/blog/local-network-access)
- **Iframes.** The default Permissions-Policy allowlist is `'self'`. To delegate, use `allow="local-network; loopback-network"`; Edge docs use `allow="local-network-access"`. — [Chrome LNA guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access.md.txt); [Microsoft Learn](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)
- **Secure context.** The permission is restricted to secure contexts. HTTP pages are denied, and the Permissions API returns "denied" on HTTP. — [Chrome blog](https://developer.chrome.com/blog/local-network-access); [Microsoft Learn](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)
- **Enterprise policies.** The policies listed by Chrome 154 are:
  - `LocalNetworkAccessAllowedForUrls`
  - `LocalNetworkAccessBlockedForUrls`
  - `LoopbackNetworkAllowedForUrls`
  - `LocalNetworkAccessRestrictionsTemporaryOptOut`
  - `LocalNetworkAccessPermissionsPolicyDefaultEnabled`
  - `LocalNetworkAccessIpAddressSpaceOverrides`

  — [Chrome 154 release notes](https://chromestatus.com/release-notes/154); [blink-dev I2S WebSockets](https://groups.google.com/a/chromium.org/g/blink-dev/c/O6GMKt44Ups)

- **Opt-out removal date is disputed.** Microsoft says the temporary opt-out "will be removed after Edge 152". A secondary source says Chrome 156 drops it. — [Microsoft Learn](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access); contradicted by [superchargebrowser (secondary)](https://www.superchargebrowser.com/library/chrome-156-local-network-access/)
- **Extensions are exempt.** Extensions with host permissions are not subject to LNA. — [Microsoft Learn](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)
- **Testing flags.**
  - `--ip-address-space-overrides=127.0.0.1:8747=public` makes loopback look public.
  - `Content-Security-Policy: treat-as-public-address` makes a page look public, so the prompt can be triggered from a localhost dev server.

  — [Microsoft Learn](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access); [Chrome LNA guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access.md.txt)

### Inferences

- In Chrome ≥147, readitinabook.com opening `ws://localhost:8747` will work without mixed-content errors. It does need one user grant of "Apps on device" (loopback-network) per origin, and after that it is silent.
- Calling `fetch("http://localhost:8747/…")` from the page triggers the prompt at a moment the app chooses, before the WebSocket opens. The Permissions API query should use `loopback-network`, with feature detection because the name crashed older renderers.
- A development copy served from `http://localhost:5173` talks local→loopback, which LNA does not yet gate. Development therefore won't show the prompt that production users see.
- If the WebSocket were opened from a cross-origin iframe or a worker, it would need delegation or a prior grant. The main window is the simplest place to open it.

### Gaps

- No chromestatus page loaded (it is JS-rendered), so the M145 split milestone rests on blink-dev and secondary sources. The M146 WebRTC milestone is secondary only.
- Whether the WebSocket `targetAddressSpace` option actually shipped in M154, rather than staying "pending review", was not confirmed.
- I found no primary source for the exact current wording of the "Apps on device" prompt.

## Edge: same as Chrome or different?

### Takeaway

Edge follows Chromium with roughly a one-milestone lag: LNA was default-on from Edge 143. The policies and behaviour are the same.

### Cited Findings

- "Local Network Access restrictions will start shipping by default in Microsoft Edge 143." The initial scope was subresources, fetch() and subframes. WebSockets, WebTransport and WebRTC were planned "soon". The page was last updated 9 Mar 2026, with a metadata update on 6 Oct 2026. — [Microsoft Learn: Edge LNA](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)
- **Triggering the prompt.** `fetch("http://localhost")` triggers the prompt in Edge 144+. Microsoft gives user-agent-gated guidance: Edge <143 connects silently, and Edge ≥143 should query the Permissions API first. — [Microsoft Learn](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)
- **Origin trial.** An HTTP-origin opt-out origin trial ran through Edge 146 (Mar 2026), with the token delivered only by HTTP header. Edge 146 added the `LocalNetworkAccessIpAddressSpaceOverrides` and `LocalNetworkAccessPermissionsPolicyDefaultEnabled` policies. — [Microsoft Learn](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)
- **Android WebView** is not covered; Android's own local-network permission applies instead. — [Microsoft Learn](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)

### Inferences

- Edge's Microsoft Learn page was not updated to say WebSockets are covered, but Edge tracks Chromium. Edge ≥147 very likely gates WebSockets as Chrome does. This is unconfirmed by Microsoft.

### Gaps

- There is no Microsoft statement on the Edge milestone for WebSocket LNA.

## Firefox: mixed content for ws/http localhost, and Firefox LNA

### Takeaway

Firefox has allowed `ws://localhost` from secure origins for years, and has treated `http://localhost` as potentially trustworthy since Firefox 84 (Dec 2020). LNA prompts became default for all desktop users in Firefox 153 (21 Jul 2026) and were extended to WebSockets in Firefox 154 (Aug 2026). The prompt separates "Device apps and services" (localhost) from "Local network devices".

### Cited Findings

- **Firefox 84 and later** treat `http://localhost` and `http://*.localhost` as trustworthy origins (bug 1220810). The mixed-content bug 1488740 was fixed in 84. — [Firefox 84 for developers (MDN)](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/84); [Bug 1488740](https://bugzilla.mozilla.org/show_bug.cgi?id=1488740); [Bug 1220810](https://bugzilla.mozilla.org/show_bug.cgi?id=1220810)
- **WebSocket exemption.** Bug 1376309, "Allow localhost ws:// connections from secure origins", relaxed mixed-content blocking for WebSockets to loopback. — [Bug 1376309](https://bugzilla.mozilla.org/show_bug.cgi?id=1376309)
- **Firefox 153 release notes:** "Local Network Access restrictions are now enabled by default for all users". Firefox requires sites to ask before connecting "to devices on your local network or to apps and services on your device". Before this, only users with Strict ETP were included. — [Firefox 153 release notes](https://www.firefox.com/firefox/153.0/releasenotes/); [LWN](https://lwn.net/Articles/1083981/)
- **Release date and prompt labels.** Firefox 153 was released 21 Jul 2026. Desktop only (Windows, macOS, Linux), with Android to follow. The prompts read "Device apps and services" for localhost and "Local network devices" for the LAN. — [Beyond Identity: Firefox v153 prompt](https://support.beyondidentity.com/hc/en-us/articles/43415867437975-Managing-the-Firefox-v153-device-apps-and-services-prompt)
- **Firefox 154** (article dated 17 Aug 2026): "those protections also cover WebSocket connections". — [Linuxiac](https://linuxiac.com/firefox-154-adds-websocket-local-network-protection-and-new-ai-controls/); [CyberInsider](https://cyberinsider.com/firefox-154-blocks-silent-websocket-access-to-local-network-devices/)
- **Enterprise policy `LocalNetworkAccess`:**
  - Available from Firefox 145, ESR 153 and Enterprise 149.
  - Keys: Enabled, BlockTrackers, EnablePrompting, SkipDomains, Locked.
  - Prefs: `network.lna.enabled`, `network.lna.blocking`, `network.lna.block_trackers`, `network.lna.skip-domains`.
  - SkipDomains matches either the source site or the target.

  — [Firefox admin docs: LocalNetworkAccess](https://firefox-admin-docs.mozilla.org/reference/policies/localnetworkaccess/)

- **Sources conflict on when the feature was released.** A policy-templates thread says it shipped in 151. Mozilla's release notes say default-for-all happened in 153. — [mozilla/policy-templates #1259](https://github.com/mozilla/policy-templates/issues/1259); [Firefox 153 notes](https://www.firefox.com/firefox/153.0/releasenotes/)
- **Known bugs.** One bug: Firefox stopped asking for the local-network permission on some sites in March 2026, fixed for ESR 153. Another: the prompt repeated for every iframe request. — [Bug 2059274](https://bugzilla.mozilla.org/show_bug.cgi?id=2059274)

### Inferences

- In Firefox ≥154, readitinabook.com → `ws://localhost:8747` passes mixed content but shows a "Device apps and services" prompt once per site. Firefox 145–152 shows a prompt only for Strict-ETP users.

### Gaps

- The SUMO article failed to load, so the exact prompt wording and whether the grant persists were not confirmed from Mozilla directly.
- Mozilla's formal standards-position label (issue #1260) was not checked.

## Safari / WebKit

### Takeaway

Safari still blocks `ws://127.0.0.1` and `ws://localhost` from an https page as mixed content. WebKit bug 171934 has been open (NEW) since 2017, with comments as recent as Aug 2026 noting that every other engine ships LNA. WebKit has begun internal LNA plumbing (Sep 2026), but there is no prompt and no shipped change. Apple has argued for alternatives to prompts, such as a single-port "latch mode". iPadOS Safari uses WebKit, so the same block applies there.

### Cited Findings

- **Bug 171934:**
  - Title: "Don't treat loopback addresses (127.0.0.0/8, ::1/128, localhost, .localhost) as mixed content". Status NEW, P2, last modified 2026-08-19, no landed commit.
  - Comment 57 reports `ws://127.0.0.1:[port]` failing in Safari.
  - In 2025 and 2026, Shopify (Jake Archibald, Nov 2024), Zotero, an Ollama PWA and Spiideo all reported needing to send Safari users to another browser.
  - Comment #119 (Gunes Acar, 19 Aug 2026): all vendors except Safari ship LNA in stable.

  — [WebKit bug 171934](https://bugs.webkit.org/show_bug.cgi?id=171934)

- **Apple's position:**
  - John Wilander (Jun 2025): WebKit "has long opposed broad localhost access" on privacy and port-scanning grounds. He proposed a "latch mode" that allows one localhost port, and called prompts a last resort.
  - Earlier (Jul 2021): localhost should be blocked for HTTP pages before it is allowed from HTTPS.
  - Comment 78 notes Apple's system resolver doesn't guarantee that `localhost` resolves to loopback.

  — [WebKit bug 171934](https://bugs.webkit.org/show_bug.cgi?id=171934)

- **Standards position.** WebKit standards-positions #520 (LNA, opened 26 Jun 2025) is open with no position. It carries a "concerns: venue" label, and annevk raised the venue concern in Aug 2025. — [WebKit/standards-positions #520](https://github.com/WebKit/standards-positions/issues/520)
- **WebKit LNA plumbing.**
  - Bug 319907 landed 11 Sep 2026 (320971@main). It adds `performLocalNetworkAccessCheck()` and a test-only permission stub.
  - Because "no native permission prompt exists yet", Prompt is treated as Denied.
  - The meta bug 250607 "Implement Local Network Access" remains NEW.

  — [WebKit bug 319907](https://bugs.webkit.org/show_bug.cgi?id=319907); [WebKit bug 171934](https://bugs.webkit.org/show_bug.cgi?id=171934)

- **Developer reports and workarounds.** The reported error is "[blocked] The page at https:// was not allowed to run insecure content from ws://127.0.0.1:…". Workarounds: a locally trusted cert (mkcert) for `wss://localhost`, or a public DNS name resolving to 127.0.0.1 with a real cert. — [Apple Community](https://discussions.apple.com/thread/254087609); [cross-origin.com](https://www.cross-origin.com/core-cors-mechanics-same-origin-policy-fundamentals/private-network-access-controls/fixing-blocked-requests-from-https-page-to-localhost/)

### Inferences

- On Safari (macOS, iPadOS, iOS), `ws://localhost:8747` from readitinabook.com will not connect.
- `wss://` to localhost with a certificate the user has installed and trusted might work. That is heavy friction for users and unverified here.
- On iPadOS there is no local MCP bridge process anyway, unless it runs on another machine, which would be LAN, not loopback.

### Gaps

- `wss://localhost` with a user-trusted cert was not tested or sourced for current Safari.
- I found no Safari 26.x release note touching this.

## Server-side origin checking, DNS rebinding, incidents

### Takeaway

A browser-reachable local server must validate the `Origin` header on every WebSocket upgrade or HTTP request, check `Host` against DNS rebinding, bind to 127.0.0.1 and ideally require a token. The MCP spec makes Origin validation a MUST. The Zoom 2019 incident (port 19421) is the canonical failure, and MCP SDKs shipped CVEs for missing rebinding protection in 2025–26.

### Cited Findings

- **MCP Streamable HTTP spec:**
  - Servers MUST validate the Origin header on all incoming connections to prevent DNS rebinding.
  - The draft spec adds that an invalid Origin must get HTTP 403.
  - Local servers SHOULD bind to 127.0.0.1, not 0.0.0.0.
  - Servers SHOULD implement authentication.

  — [MCP spec: Streamable HTTP (latest)](https://modelcontextprotocol.io/specification/latest/basic/transports/streamable-http); [2025-06-18 transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports.md)

- **SDK CVEs.** The CSA research note (9 Nov 2026) says the TypeScript, Python and Go MCP SDKs shipped without DNS-rebinding protection on by default for localhost HTTP servers (CVE-2025-66414, CVE-2025-66416, CVE-2026-34742). A Ruby `mcp` gem advisory says it never inspected Host or Origin. — [CSA: MCP's Transport Trust Gap](https://labs.cloudsecurityalliance.org/research/csa-research-note-mcp-transport-trust-gap-20261109-csa-style/); [GHSA-rjr6-rcgv-9m7m](https://docs.devguard.org/vulnerability-database/GHSA-rjr6-rcgv-9m7m/)
- **Zoom (CVE-2019-13450):**
  - The Mac client ran a localhost web server on port 19421. Any website could drive it, joining calls with the camera on, and it survived uninstall to reinstall Zoom.
  - Disclosed 26 Mar 2019 and published 8 Jul 2019. Zoom removed the server in 4.4.53932.0709 (9 Jul 2019).
  - Zoom's bulletin cites "insufficient authorization controls".

  — [Zoom ZSB-19001](https://www.zoom.com/en/trust/security-bulletin/ZSB-19001/); [Rapid7](https://www.rapid7.com/blog/post/2019/07/10/zoom-video-snooping-what-you-need-to-know/)

- **Android localhost tracking.** A report that two large tracking companies used Android localhost listeners for browser-to-app data sharing (June 2025) was cited by WebKit as motivation. — [WebKit bug 171934 #111](https://bugs.webkit.org/show_bug.cgi?id=171934); [WebKit standards-positions #520](https://github.com/WebKit/standards-positions/issues/520), which links localmess.github.io
- **Binding is not enough.** The attacking page runs in the user's own browser on the same machine, so Origin checks or auth are still required. — [eseospace (secondary)](https://eseospace.com/blog/mcp-dns-rebinding/)

### Inferences

- The bridge at 8747 should accept upgrades only where `Origin` is in an allowlist (`https://readitinabook.com` plus dev origins) and `Host` is `localhost:8747` or `127.0.0.1:8747`.
- A pairing token would also protect against other local processes, since non-browser clients can forge Origin.
- The browser permission prompt protects the user from unknown sites. It is not a substitute for server-side checks.

### Gaps

- The full text of the 2026-07-28 MCP spec revision was not read.

## How existing products pair hosted web apps with local processes

### Takeaway

Products split into two patterns:

- **Localhost-server pattern:** Figma (FigmaAgent), Ollama and Jupyter. It now hits Chrome and Firefox LNA prompts and is broken in Safari.
- **Extension pattern:** Playwright MCP Bridge and Claude in Chrome. It sidesteps LNA because extensions are exempt in Chromium and use WebSocket or native messaging. The cost is an install.

### Cited Findings

- **Figma** uses its locally running FigmaAgent for local fonts, spell check and "Open in Desktop". It asks Chrome users to allow "Local network access" (142–144) or "Apps on device" (145+). If blocked, only those features degrade. — [Figma help](https://help.figma.com/hc/en-us/articles/34458998159511-Local-network-access-in-Figma)
- **Ollama** binds 127.0.0.1:11434 and allows cross-origin requests only from localhost-type origins by default. Extra origins, such as `chrome-extension://<id>`, are added with `OLLAMA_ORIGINS`. Guides warn against `*`. — [Ollama FAQ](https://docs.ollama.com/faq); [simplified.guide](https://www.simplified.guide/ollama/origins-set)
- **Playwright MCP Bridge** (Chrome Web Store) lets the MCP server started with `--extension` attach to existing tabs. The user picks a tab on first use, and an optional `PLAYWRIGHT_MCP_EXTENSION_TOKEN` skips repeated approvals. The alternative is CDP via `chrome://inspect/#remote-debugging` and `--cdp-endpoint`. — [playwright.dev: browser extension](https://playwright.dev/mcp/configuration/browser-extension)
- **LNA exempts extensions.** Chromium extensions with host permissions are not subject to LNA restrictions. — [Microsoft Learn](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)
- **Safari workarounds in practice.** The Ollama PWA used a Cloudflare tunnel. Another app downgraded to HTTP hosting for Safari only. — [WebKit bug 171934 #110, #117](https://bugs.webkit.org/show_bug.cgi?id=171934)

### Inferences

- For readitinabook.com, a direct `ws://localhost` connection is viable in Chrome, Edge and Firefox, at the cost of one permission prompt. It is not viable in Safari.
- An extension relay or native-messaging host would work around Safari only if a Safari Web Extension were built, and adds install friction everywhere.

### Gaps

- I did not obtain primary sources for Jupyter's `allow_origin` defaults, the Figma desktop bridge protocol, or how Claude in Chrome's native messaging works. These are left unsourced deliberately.

## FileSystemObserver (observing OPFS changes)

### Takeaway

FileSystemObserver shipped on Chrome desktop in Chrome 133 (4 Feb 2025), after an origin trial from M129 to M134. It covers both user-picked handles and the Bucket File System (OPFS). It is not in a ratified spec (whatwg/fs PR #165). Gecko's signal was positive, WebKit gave none, and neither has shipped it as far as found. Android was future work.

### Cited Findings

- **Origin trial.** Ran from Chrome 129 (11 Sep 2024) to Chrome 134 (26 Feb 2025). Detect with `'FileSystemObserver' in self`; the flag is `#file-system-observer`. — [Chrome blog: File System Observer origin trial](https://developer.chrome.com/blog/file-system-observer)
- **Intent to Ship (17 Dec 2024).**
  - Ships on desktop in M133 and covers files "in the user's local device or in the Bucket File System".
  - Android is future work.
  - Signals: Gecko positive, WebKit no signal.
  - Spec: whatwg/fs PR #165. TAG review: w3ctag/design-reviews #868.

  — [blink-dev I2S FileSystemObserver](https://www.mail-archive.com/blink-dev@chromium.org/msg12265.html)

- **Chrome 133 release notes** (stable 4 Feb 2025) list "The FileSystemObserver interface" under Web APIs: sites observe changes to files and directories the user granted, "or in the Bucket File System (also known as the Origin Private File System)". — [Chrome 133 release notes](https://developer.chrome.com/release-notes/133)
- **Conflicting flag data.** A third-party Chromium flag listing (snapshot about Oct 2026) shows the `FileSystemObserver` flag not enabled by default. This may be an artifact of the flag list. — [niek.github.io/chrome-features](https://niek.github.io/chrome-features/)
- **MDN.** Marks it Experimental, Non-standard and secure-context-only. Its examples observe a directory handle from `showDirectoryPicker()` and an OPFS file via a `FileSystemSyncAccessHandle`. Records carry `type` and `changedHandle`. — [MDN: FileSystemObserver](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemObserver)

### Inferences

- In Chrome and Edge desktop, the app could observe its OPFS project directory and learn when other same-origin code changes files: another tab, a worker, or a bridge-driven writer inside the page.
- Firefox and Safari need a fallback, such as a BroadcastChannel announcement from writers, or polling.
- OPFS is origin-scoped, so "other code" can only be same-origin code. Nothing outside the browser can write it.

### Gaps

- MDN's compat table did not render, so I could not confirm current Firefox and Safari status from MDN.
- I could not confirm whether changes made by the observing context itself are reported, or how changes made through sync access handles in workers are batched.
- chromestatus feature 4622243656630272 did not render.
