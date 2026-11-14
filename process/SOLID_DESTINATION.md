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

What the reader of a private book needs is the question, more than what the publisher does. The pieces to try:

- Per-book or per-folder readers: a "Who can read this" list of WebIDs on a book or a shelf. Each change rewrites that resource's `.acl` (owner control; named agents read). Show who has access from the `.acl`, not from a local record, since the pod is the truth (the same rule as the catalog).
- A private shelf: a container whose `.acl` names readers, holding its own catalog. One rule covers every book in it, which is likely simpler for people than per-book lists.
- The reader's side: READ.html opening a book that needs a sign-in. Options to compare: READ.html gains "Sign in with Solid" and fetches with the session (the honest Solid model; READ.html then carries the library too); or SEED offers a time-limited link instead (not Solid's model, and CSS has no such thing). Expect this to be the most interesting finding.
- Inviting someone who has no pod: the realistic family-history case. What does the invitation say, and which provider should they join?
- Copy rules for the interface: who can read is the user's gain; never show `.acl`, WAC or WebID jargon in the app's strings (CLAUDE.md, in-app copy).

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
