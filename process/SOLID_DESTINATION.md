# Solid pod destination (investigation)

Status: plan, 2026-11-14. An exploration of the UX and affordances of a Solid pod as a publish-to-remote destination. It may never merge to main; it lives on a feature branch (`solid-destination`) and is judged by what it teaches about the experience.

## Decisions taken

Public first, then private sharing. Phase 1 makes a pod behave like the other catalog destinations (S3, Dropbox, WebDAV): send, public links, OPDS catalog, READ.html links. Phase 2 explores what only Solid offers: a book readable by named people (WebIDs) and nobody else.

A real Solid sign-in from phase 1, not a pasted token, because phase 2 needs a signed-in identity and the sign-in is itself part of the UX being explored.

Inrupt's libraries, as far as they fit: the spike showed the browser `Session` cannot live in the plugin frame, so the sign-in is a small relay flow of our own built on `@inrupt/solid-client-authn-core`'s DPoP helpers (see the spike findings). `@inrupt/solid-client` only if phase 2's access control needs it. Size and code ownership are deferred to any decision to merge.

## The test pod

https://pods.solidcommunity.au/family-history/ (the author's account). Checked 2026-11-14 with plain HTTP:

- Community Solid Server behind Caddy; Web Access Control (`Link: <….acl>; rel="acl"` on every resource), not ACP.
- CORS open to every origin, credentials allowed, `Link`, `WAC-Allow`, `ETag` and `Location` exposed. No proxy is needed (unlike WebDAV's `/dav`).
- The pod root is public-read (`WAC-Allow: user="read",public="read"` for an anonymous request), but the rule is not inherited: a new folder beneath it is private (see the spike findings).
- OIDC issuer https://pods.solidcommunity.au/ with PKCE (S256), dynamic client registration, `client_credentials`, `refresh_token`, `offline_access`, DPoP.

## Phase 0: sign-in spike (decides whether the rest is feasible)

The risk is the sign-in, not the file operations. Inrupt's browser library is built around redirecting the whole page, and the plugin runs in an iframe inside the host. The spike answers three questions before any UI work:

1. Can the login run in a popup? The Dropbox pattern already does this: the popup loads the plugin page itself, which handles the callback. For Solid the popup would call `session.login({ oidcIssuer, redirectUrl: <plugin page> })`, come back to the plugin page, run `handleIncomingRedirect`, and tell the opener it is done.
2. Does the iframe end up with an authenticated session? The popup's session lives in the popup. Either the iframe completes its own silent login against the provider's now-existing cookie session, or the tokens have to be handed over. Third-party cookie partitioning in Safari and Firefox may block silent login inside an iframe; find out.
3. Does the session survive a reload? `restorePreviousSession` does a silent redirect of the page it runs in, which here is the plugin iframe.

If any of the three fails, the fallbacks in order are: keep the authenticated `Session` in a popup that stays open and proxies writes (clumsy, but an honest finding about the UX); a client-credentials token generated on the pod's account page (CSS supports it) for the rest of the exploration; or a small hand-rolled Solid-OIDC client that keeps its refresh token in the plugin's own storage.

Also decide in the spike: dynamic registration versus a Client ID Document (a static JSON-LD file served by the app naming it, its logo and its redirect URLs). The document gives the provider's consent screen the app's real name, which matters for the UX; dynamic registration needs nothing hosted.

### Spike findings (2026-11-14, Chrome, Firefox, Safari)

Harness: `plugins/publish-to-remote/spike/host.html` frames `spike/solid.html` (same origin, unsandboxed, like SEED.html's plugin frame), served by `npx vite --port 8000` in the plugin folder. Dev only; not in the build.

Answer: the Inrupt browser session does not work in the plugin frame, but a small relay flow does, end to end, in Chrome, Firefox and Safari: sign-in, write, frame reload, refresh, write again.

Inrupt's `Session` keeps tokens and the DPoP key only in memory and never stores a refresh token, so every reload restores by a silent `prompt=none` redirect of the page itself, here the plugin frame. In Chrome the popup sign-in succeeded (and wrote, 201), but the frame's silent restore failed with `interaction_required: An account cookie is required`: the provider's account cookie is not sent to its pages inside another site's frame. Firefox failed the same way.

The relay flow (the Dropbox pattern) works. The frame registers a public client dynamically (`token_endpoint_auth_method: none`, `offline_access`), makes the PKCE verifier and state, and opens a popup on the authorization URL. The popup returns to the plugin page, which posts the code and state to its opener and closes. The frame generates a non-extractable DPoP key, exchanges the code itself, and gets an access token (3600 s), a refresh token and the WebID from the ID token. It writes with its own DPoP-signed requests (PUT 205).

Reload with no redirect: the frame keeps the refresh token in `localStorage` and the DPoP key pair in IndexedDB (a `CryptoKey` stores as itself and stays non-extractable). After a frame reload it refreshed with that key and wrote again. A stolen refresh token is useless without the key, and the key cannot be exported, only used by code running on the origin.

Safari blocks a popup opened after an `await` (the spike first fetched the provider configuration and registered the client, then called `window.open`). Open the popup on the click itself, on `about:blank`, and point it at the authorization URL once the preparation is done. The Dropbox flow awaits one digest before opening and should be checked in Safari for the same reason.

The consent screen names the app from dynamic registration's `client_name` ("SEED.html (spike)" in Firefox), so a Client ID Document is not needed for a readable name; it would add a logo, a link and a stable client id, and can wait.

The popup went straight to the consent screen because the provider's cookie is first-party in a top-level window; the password page only appears when that session has lapsed.

Public access: the pod root's public read is not inherited (it is `acl:accessTo` only), so a new folder is private: anonymous GET 401. "Make this folder public" is needed on every pod, this one included. Writing the folder's `.acl` (owner Read/Write/Control, public Read, both `accessTo` and `default`) made the file publicly readable at once (anonymous GET 200, `public="read"`).

The provider can be framed (no `X-Frame-Options` or `frame-ancestors` on its login page), but a password form inside another site's frame is the wrong UX and other providers forbid it. The popup stays the design.

Size: `@inrupt/solid-client-authn-browser` is 104 KB minified (30 KB gzip) and `@inrupt/solid-client` brings it to 441 KB (125 KB gzip), against a 2.26 MB plugin. The relay flow needs neither: only `createDpopHeader` and `generateDpopKeyPair` from `@inrupt/solid-client-authn-core`, 17 KB minified (6 KB gzip). Container listing can be a small Turtle read, leaving `solid-client` to phase 2's access control, if at all.

Still open: whether to adopt a Client ID Document later (it must be at a public URL the provider can fetch); refresh-token lifetime on CSS (how long a destination stays signed in without use); and a refresh failure's path to the `sign-in` reach state.

## Phase 1: a public pod destination

Progress (2026-11-14): the remote type, the relay sign-in (`solid-auth.ts`), the pod operations (`solid-upload.ts`, folder listings and profiles read as Turtle with N3.js), dispatch, catalog, status and reconnect, and the add form (provider, sign in, folder chooser with a new-folder field, "Make this folder public") are built and tested; the form works against the test pod in Chrome, Firefox and Safari. Next: send a book, its catalog, and READ.html opening it.

Send finding (2026-11-15): a 15 MB EPUB cannot be sent to pods.solidcommunity.au (Community Solid Server 7.0.2 behind Caddy). The PUT fails after about 10 s with 500 "Lock expired after 6000ms on <resource>", and the pod keeps the bytes that had arrived (6.07 MB and 5.38 MB on two tries), which it then serves as a broken book at the public link. CSS holds a write lock for 6 s by default and the incoming body does not extend it, so any upload longer than about 6 s of transfer fails; on a home connection that is a few megabytes. It is a deployment default, not the protocol: raising the locker's expiration, or having the proxy buffer the request body before passing it on, fixes it server-side. Nothing client-side can: CSS has no ranged or chunked PUT and no binary append. The plugin now shows the pod's error message and removes a partial copy written during a failed send (only a resource written during the upload and not the size sent). Next: a note to the solidcommunity.au operators, and the same send against Inrupt PodSpaces. Not pursued: a self-hosted CSS, since the investigation is about hosts people can actually use. Possible later finding: a book stored unpacked (one resource per EPUB file) sidesteps upload time entirely but needs READ.html to open an unpacked book from a URL.

Inrupt PodSpaces (2026-11-15): a 15 MB send completes (no 6 s lock) and the book appears in the folder listing, its stored size not yet checked; the catalog writes and reads back. Two reading problems surfaced and were fixed. First, the profile and folder listings: Community Solid Server sends expanded JSON-LD, Inrupt sends compacted JSON-LD (prefixed names under an @context, root-relative @ids, single values bare). Both are valid JSON-LD, so hand-reading one form was the mistake; listings and profiles are now requested as Turtle, which the Solid Protocol requires every server to serve, and parsed with N3.js (its parser module alone, `n3/src/N3Parser.js`: importing the package index pulls in its stream classes and the readable-stream polyfill, about 120 KB; the parser adds about 50 KB to the plugin). Inrupt's listings carry no size or date for files. Second, the first sign-in in Firefox reported the popup closed although it had answered: the close was seen before the message crossed processes. The popup now also answers on a same-origin BroadcastChannel (which survives a provider severing window.opener), waits 300 ms before closing, and the plugin allows 3 s of grace after seeing it close. Still to check on Inrupt: whether the book is public (ESS uses Access Control Policies, not WAC `.acl`, so "Make this folder public" will not work there).

Inrupt end to end (2026-11-15): "Make this folder public" (ACP patch) works and READ.html opens the 15 MB book from storage.ap.inrupt.com. The policy takes a few seconds to apply, so the form now re-checks quietly for up to 8 s, and "public" now means an anonymous request succeeds (the reader's own experience) rather than what a WAC-Allow header says. Speed, measured anonymously from the user's connection: the storage server is in Singapore (AWS ap-southeast-1); a fresh small request takes 0.37–1.36 s to first byte (connect 0.1–0.5 s), 0.13–0.36 s on a reused connection, against 0.15–0.34 s for pods.solidcommunity.au and 0.05 s for a CDN. The book downloaded at about 67 KB/s, so 15 MB takes nearly four minutes; one curl download was cut off at exactly 10 MiB after 156 s. Book responses carry no Content-Length or Accept-Ranges, so a reader gets no progress total and cannot resume. Upload (2026-11-16, the author's browser): the 22 MB Haines book took about a minute, roughly 370 KB/s (3 Mbit/s), which is likely the home connection's upload limit rather than the pod's; uploads are about five times faster than the downloads measured here.

Anonymous checks on the Inrupt folder (2026-11-16): the book is served as `application/epub+zip` with an ETag and Last-Modified, and the catalog as `application/opds+json`; both are readable from any origin. The catalog lists no books. It was written at 07:24 on 2026-11-15, during the first send, while Inrupt's JSON-LD listing still failed to parse: that first send saw no EPUBs and created an empty feed. Every later send counted as an update, and an update leaves a book that is out of every feed out of it. That is the designed rule, applied to a feed the bug had emptied, so the code needs no change. Switching the book in on the Published page repairs the feed, and also tests the catalog write on Inrupt. Then open the feed in READ.html's catalog view.

Decision (2026-11-16): one catalog per Solid folder. On a pod a folder is also where access is set, so a catalog cannot give a different audience its own books: a family-only feed in a public folder still links books anyone can open. A Solid destination is therefore one shelf with one feed, and a different audience means a different folder (another destination). The Published page offers no "New catalog…" for Solid and reads only the folder's own feed; renaming that feed and choosing its format stay. The destination form has no catalog filename field, as for Dropbox and Google Drive. New destinations of every type now start with the READ.html reader link filled in.

The remote type and its operations:

- `SolidRemoteConfig` in `types.ts`: `type: 'solid'`, `name`, `oidcIssuer`, `webId` (from the session), `containerUrl` (the folder to publish into, e.g. `…/family-history/books/`), `catalogFilename?`, `readerLink?`. No secrets in `remotes.json`: the session lives in the library's storage.
- `solid-upload.ts`, one module like its siblings, all returning `{ success, error? }` and never throwing: `uploadToSolid` (authenticated `PUT` with content type; create the container on first use), `listSolidFiles` (GET the container, read `ldp:contains` with size and modified date where the server gives them; `@inrupt/solid-client`'s `getContainedResourceUrlAll` or a small Turtle read), `deleteSolidFile`, `getSolidPublicUrl` (the resource URL itself), `uploadTextToSolid` and the text and blob reads for catalogs and imports.
- `remote-ops.ts`: a `solid` branch in each dispatcher. `catalog.ts`: add `solid` to `hasCatalog` and `CatalogRemoteConfig`; `feedUrlFor` falls through to the public URL. `share-links.ts`: the public link is the resource URL. `remote-status.ts`: a `SOLID_AUTH_REQUIRED` error maps to `reach: 'sign-in'`, and `typeLabel` gains `Solid`. `reconnect.ts`: signing in again.
- Public access: check `WAC-Allow` on the container after the first write. If `public` lacks `read`, the destination shows the books as private and phase 1 offers one action, "Make this folder public", which writes the container's `.acl` (owner full control, public read, both as defaults). That is the first taste of phase 2.

The surfaces:

- Destinations: a "Solid pod" type in the add form. The fields are the provider (a short list with solidcommunity.au, solidcommunity.net and Inrupt PodSpaces, or any issuer URL) and a "Sign in with Solid" button. After sign-in, show the WebID and the pods it names (`pim:storage` in the profile), then a folder chooser over the pod's containers, like the Dropbox folder browser.
- Send and Published: no new UI if the dispatch layer is complete; the badge says Solid.
- READ.html: the public resource URL works in `?book=` because the pod sends CORS headers. Confirm the EPUB is served as `application/epub+zip` (the `PUT` sets it), and that a catalog's OPDS links open in READ.html's catalog view.

Tests mirror `webdav-upload.test.ts`: a stubbed `fetch` that answers container Turtle, `PUT`, `DELETE` and `WAC-Allow`. The library's `Session` is stubbed at the module boundary.

## Phase 2: private sharing (exploration)

Decision (2026-11-16): unlisted is enough for a family book, and R2 and S3 links already give it, so private sharing is not needed for that case. The reader-side cost is why: a relative with no pod must choose a provider, create an account, find and send back a WebID, wait to be added, then sign in and approve a consent screen, before seeing a page. The open question for Solid moves to whether it is a simpler bring-your-own storage for other writers and publishers (see below). The notes that follow stay as the record of what private sharing would involve.

What the reader of a private book needs is the question, more than what the publisher does. The pieces to try:

- Per-book or per-folder readers: a "Who can read this" list of WebIDs on a book or a shelf. Each change rewrites that resource's `.acl` (owner control; named agents read). Show who has access from the `.acl`, not from a local record, since the pod is the truth (the same rule as the catalog).
- A private shelf: a container whose `.acl` names readers, holding its own catalog. One rule covers every book in it, which is likely simpler for people than per-book lists.
- The reader's side: READ.html opening a book that needs a sign-in. Options to compare: READ.html gains "Sign in with Solid" and fetches with the session (the honest Solid model; READ.html then carries the library too); or SEED offers a time-limited link instead (not Solid's model, and CSS has no such thing). Expect this to be the most interesting finding.
- Inviting someone who has no pod: the realistic family-history case. What does the invitation say, and which provider should they join?
- Copy rules for the interface: who can read is the user's gain; never show `.acl`, WAC or WebID jargon in the app's strings (CLAUDE.md, in-app copy).

## Solid as bring-your-own storage for writers (survey, 2026-11-16)

The question: is a Solid pod a simpler bring-your-own storage for other writers and publishers than R2/S3, Dropbox, Google Drive or WebDAV? On setup it is: provider, sign in, folder, make public, with no developer console, keys or secrets, because Solid apps register themselves (Dropbox and Google Drive both need the writer to register a developer app first). The survey asks whether any public host is fit to publish from.

Sources: the official list (https://solidproject.org/users/get-a-pod, 15 providers; the old /for-users/get-a-pod is gone), each provider's own pages and terms, and anonymous requests from Melbourne (connect and first-byte times are three-request averages to the root). Inrupt's terms and Private Data Pod's plans were re-checked on their own pages; the rest is from the research pass and marked where not found.

| Provider                                                 | Software              | Quota / limit                                      | Where                             | Terms                                           | First byte |
| -------------------------------------------------------- | --------------------- | -------------------------------------------------- | --------------------------------- | ----------------------------------------------- | ---------- |
| privatedatapod.com (Pod42 LLC, since Mar 2026)           | CSS                   | 1 GB free, 10 GB at $9.99/mo; file limit not found | AWS, US                           | Commercial, real use                            | not timed  |
| TrinPod (Graphmetrix)                                    | TwinPod 3.6           | not found                                          | US, EU                            | not found                                       | 0.98 s     |
| Inrupt PodSpaces                                         | ESS                   | 100 MB per file                                    | US/EU (Frankfurt), AP (Singapore) | Developer Preview, not for production           | 0.6–1.0 s  |
| solidcommunity.net (ODI)                                 | CSS behind Cloudflare | not found                                          | UK (Cloudflare edge)              | Developers only, no personal or commercial data | 0.48 s     |
| solidcommunity.au (Togaware/ANU)                         | CSS 7.0.2             | 6 s write lock                                     | Sydney                            | Experimental                                    | 0.14 s     |
| solidweb.org                                             | NSS 6.0.0             | 50 MB per pod                                      | Strasbourg                        | Experimental, volunteers                        | 1.49 s     |
| solidweb.me / teamid.live / solidweb.app (same operator) | CSS 7.2 / Pivot / JSS | 50 / 70 / 100 MB per pod                           | Strasbourg                        | Prototype                                       | 1.5–2.0 s  |
| solid.redpencil.io                                       | CSS                   | 7 MB per pod                                       | Nuremberg                         | not stated                                      | 1.67 s     |
| Data Pod (iGrant.io)                                     | NSS 5.7.4             | not found                                          | EU                                | Public alpha                                    | 1.03 s     |
| inrupt.net                                               | —                     | —                                                  | —                                 | Shut down 31 Mar 2025                           | —          |
| use.id                                                   | —                     | —                                                  | —                                 | Unreachable, still listed                       | —          |

Findings. Every free host but one calls itself experimental, a prototype, a preview or developers-only, and the volunteer hosts cap a whole pod at 7–100 MB, which is one to a handful of books. The one host offering real use with room for a shelf is Private Data Pod, eight months old and run by one small company. No host has been shown to serve a book fast: Inrupt managed about 67 KB/s, and download speed on the others can only be measured with an account. solidcommunity.net now fronts CSS with Cloudflare, which may buffer uploads and so avoid the 6 s lock that stops solidcommunity.au, but that needs an account to test, and its terms rule out a writer's real use anyway.

Conclusion so far: Solid has the setup a writer would want and, in 2026, no free host fit to publish from. The one candidate worth a real test is Private Data Pod's free tier (an account from the author): send a 20 MB book, time the upload and an anonymous download, and check the size header, the public-access path (CSS uses WAC, which the plugin already handles) and CORS.

Private Data Pod, first contact (2026-11-16): sign-in works (CSS, dynamic registration), but the pod's top address (`https://<name>.privatedatapod.com/`) is answered by the host's own Express web page, as HTML, whatever the request asks for, signed in or not; every path below it reaches CSS. The storage root a profile names cannot be listed, so no Solid app can browse the pod from the top, and the folder chooser stopped there with "The pod sent text/html instead of Turtle." The host should route a request asking for Turtle (or any authenticated request) to CSS. The plugin now names the address in that error, and a failed listing keeps the new-folder field and offers "Enter a folder address", so a folder below the top can still be made or chosen. Also seen: the host's sign-up puts the account email in the public profile (`foaf:mbox`).

Private Data Pod, the publishing test (2026-11-16): the 23.8 MB Haines book sent into `books/`, made public, and served anonymously from AWS in Ashburn, Virginia: `application/epub+zip`, Content-Length, `Accept-Ranges: bytes` (a range request returns 206), an ETag, and CORS for readitinabook.com. Two downloads from Melbourne took 30 s and 38 s (630–800 KB/s, first byte 0.8–1.0 s), about ten times Inrupt's speed, and the file unzips cleanly. It is the first Solid host that does everything the publishing path needs: large uploads, public folders, size and resume for readers, and a reasonable speed. Its weak points are its age (launched March 2026, one small company) and the HTML at the pod's top address.

Unlisted, not listed (2026-11-16): "Make this folder public" gave the public Read on the folder itself as well as its contents, and on a Solid server reading a folder is reading its list of books, so both pods listed every book to anyone at the folder's address. That defeats "unlisted is enough". Public read now covers the folder's contents only (WAC: `acl:default` without `acl:accessTo` for the public; ACP: `acp:memberAccessControl` only, with a `DELETE DATA` taking back the old hold on the folder), so a book opens from its link and the folder's address answers 401. The check asks two things anonymously: a missing file inside the folder answers 404 where the contents are public and 401 where not (both servers, checked), and the folder itself answers 200 only when its list is public. A folder made public before this shows "Anyone can also see the list of books." with "Hide the list". To verify on both pods with the author's browser. A wider note for every destination: a catalog is itself a list of the books, and `catalog.json` is a guessable name beside them, on R2 and S3 as much as on a pod, so an unlisted shelf should have no catalog, or one under an unguessable name.

Lapsed sign-in (2026-11-16, Firefox): tested by spoiling the stored refresh token (the provider refuses it, as for an expired or revoked sign-in) and by deleting the account record (a browser that never signed in). Both end in the shared `sign-in` state: Destinations shows "Sign in needed" with Reconnect, the Send band "Sign in needed" with Connect, and signing in again brings everything back. No raw errors. The same action was "Reconnect" on Destinations and "Connect" on Send and Published (Google Drive too); it is now "Connect" everywhere for a lapsed sign-in, "Reconnect" staying for a destination that needs permission again. Refresh-token lifetime per host is still unknown; leaving a destination unused for some days will show it.

## UX questions to answer along the way

- Is "pick a provider, sign in, pick a folder" understandable to someone who has never heard of Solid, compared with Dropbox's one button?
- How should a WebID be shown: profile name and photo from the profile document rather than the URL?
- What does a lapsed session look like on the Send band and the Published page, next to Google Drive's existing sign-in state?
- Does a reader's sign-in in READ.html feel acceptable for a family book, or does it stop the casual reader?

## Out of scope for now

ACP servers (Inrupt ESS / PodSpaces) beyond checking that the library's universal access API copes; notifications (`updatesViaStreamingHttp2023`) for live updates of a shelf; a host-side change of any kind (the plugin is same-origin and self-contained, and Solid needs no proxy).

## First steps

1. Branch `solid-destination` from main.
2. Add the two Inrupt packages to the plugin and check the single-file build size before and after.
3. Phase 0 spike in `plugin-test.html` (the dev harness), against the test pod; write the findings into this file.
4. Then phase 1 in the order types → module and tests → dispatch → form.
