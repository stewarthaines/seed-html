# READ.html integration — reader swap + "Package as READ.html"

Two related changes now that READ.html (the standalone in-browser EPUB reader, built from `process/READ_HTML_BOOTSTRAP.md` in its own `read-html` repo) has shipped its single-file build:

1. Replace the vendored bene reader with a vendored READ.html as SEED.html's in-app Read experience.
2. Add a third generate option to the project details view: package the book as a self-contained `<slug>.html` — READ.html with the EPUB embedded — that opens by double-click, no reading system needed.

The two repos stay code-independent. SEED.html depends on exactly two documented READ.html interfaces: the `?book=` deep link (already in the reader's v1 spec) and the payload slot defined in §3 below. Both are contract-shaped: versioned, documented in the read-html repo, guarded by its tests.

## 1. Reader swap: bene → READ.html

### Current state

- `public/bene/` (→ `dist/bene/`) vendors the bene web deployment: index.html, worker.js (service worker scoped to `/bene/`), assets/, bene-reader/, one local patch (preload race), `VENDORED.md`.
- `src/lib/reader/open-in-reader.ts` opens `bene/index.html?preload=<url>`; HTTP-only via `isHttpContext()`; standalone-PWA mode renders through `ReaderOverlay.svelte` (`readerOverlayUrl` store) instead of a tab.
- Call sites: PublishView per-book Read buttons (`handleRead` → blob URL) and the publish plugin's `isReadEpubMessage` (remote object URL, CORS applies).

### Change

- Vendor the built single-file reader as `public/read/READ.html` with a new `VENDORED.md`: upstream repo, release/commit + the version string embedded in the file, retrieval date, update procedure (replace the file, update the note, run the verification below). No patches, no service worker, no asset tree — one file.
- `open-in-reader.ts`: build the URL as `read/READ.html?book=<encoded url>`; update the header comment (bene → READ.html). Everything else (blob-URL handoff, never-revoke rationale, `isHttpContext` gate, overlay-vs-tab) is unchanged.
- Delete `public/bene/` and its patch notes.
- Migration sweep: grep the repo for `bene` and update stragglers (stories/demo-content, plugin contract comments, docs). Caution: the grep also matches "benefit" — review by eye.

### Deliberate behaviors (do not "fix")

- **The consent prompt appears when reviewing a scripted book.** READ.html gates book scripts per book; the author taps Enable once and the choice persists. This is dogfooding — the author sees the exact screen recipients see. Do not add a trust-bypass URL parameter; a URL-controlled consent bypass is a security hole for every hostile link on the web.
- **Reader-tab reload after the SEED tab closes loses a blob-URL book.** Same limitation bene had; not a regression.

### What the swap buys

- Book scripts (audio clips) actually run in review — bene never executed them, which is why clip debugging historically required real reading-system hardware.
- Same content contract in review as in the shipped reader; consistent RTL + i18n behavior with the editor.
- Smaller deploy (single ~1 MB file replaces the bene tree), no second service worker, no wasm toolchain in the upgrade notes.

## 2. "Package as READ.html" — third generate option

### Placement and family

WorkspaceView, "Currently Active Project" panel, `book-actions` — alongside "Generate PDF" and "Package EPUB without SEED". It is a **one-way destination format** like its siblings: the embedded EPUB is the plain packaging (no SEED.zip, no embedded editor). The Active EPUB remains the only round-trip artifact.

### Pipeline

1. Package the plain EPUB (the existing without-SEED path) → bytes.
2. Base64-encode. Safe to inline verbatim: the base64 alphabet cannot form `</script>` or any HTML-significant sequence.
3. Fetch the vendored shell (`read/READ.html`), substitute the payload into the slot (§3), download as `<slug>.html` — the same slugged base name as the EPUB.

### Gating and UX

- **HTTP-only**, same gate and messaging as PDF export: generating must fetch the vendored shell, which the `file://` single-file SEED.html cannot reach.
- Show the resulting file size in the success state (base64 costs +33%; audio-heavy books produce large files). Soft advisory above ~25 MB (mail-attachment territory), no hard cap.
- Disabled with the same read-only tooltip pattern as "Package EPUB without SEED".

### Known limits (accepted)

- **Two identities for one book**: the Active EPUB and the plain EPUB inside the generated .html have different bytes → different content hashes → a reader holding both does not share reading position between them. Cosmetic; do not build position-sync assumptions on the hash without remembering this.
- **Deliverability**: a double-clickable HTML file with an inline base64 payload is shaped like HTML smuggling; corporate mail filters may quarantine it. Links, drives, AirDrop, and messaging apps are the reliable channels. Document in the manual when this feature ships; do not attempt filter evasion.

## 3. Payload-slot contract (prerequisite — lands in the read-html repo first)

Copy this section into the read-html repo (e.g. `docs/PAYLOAD_SLOT.md`) and implement it there before any SEED-side work on §2. Wording may be adapted; the guarantees may not.

> ### Embedded-payload slot
>
> The built single-file `READ.html` contains exactly one empty payload element:
>
> `<script type="application/epub+zip;base64" id="readhtml-payload"></script>`
>
> - **Publishing tools** may produce a book-carrying copy of READ.html by inserting the base64-encoded bytes of one EPUB as the element's text content, changing nothing else in the file.
> - **At boot**, if the slot is non-empty, the reader decodes it and opens that book directly — no library, no import. The embedded book is trusted by construction (its scripts run without a consent prompt): payload and reader arrived in the same file, so gating one against the other protects nothing.
> - **Precedence**: a non-empty payload wins over `?book=`/`?catalog=` parameters.
> - **Reading position** for an embedded book is persisted best-effort under the book's content hash, and silently absent where `file://` storage denies it.
> - **Build guarantees**: the slot marker survives minification byte-for-byte and appears exactly once; the file carries a readable version string; both facts are asserted by the repo's build tests. Changes to this contract bump the version string and are release-noted.

SEED's `VENDORED.md` records the reader version it ships, and SEED's generate feature asserts at build/test time that the vendored file contains the marker exactly once.

## 4. Sequencing

1. **read-html repo**: payload slot per §3 (spec → failing tests → implementation, per that repo's process), new release of the single file.
2. **SEED branch A — reader swap** (§1): independently shippable, immediate value. Changelog: product language about reviewing books with working audio clips.
3. **SEED branch B — generate option** (§2), on top of A: button, pipeline, size messaging, i18n round-trip (new strings need `de` via the `.po` workflow before it ships), AboutView diagram gains the fourth output, changelog line ("Package your book as a single web page that opens anywhere — no reader app needed").

Each branch merges on the owner's word; `main` deploys.

## 5. Verification

- Reader swap: PublishView Read opens the vendored READ.html in a tab (blob URL) and in the standalone-PWA overlay; a scripted book prompts for consent and plays clips after Enable; plugin `isReadEpubMessage` still opens remote URLs (CORS unchanged); `dist/` contains `read/READ.html` and no `bene/`; grep finds no live bene references.
- Generate: produced `<slug>.html` opens by double-click from disk and from a static HTTP server; the embedded book renders with scripts running (no consent prompt); the file's slot appears exactly once pre-injection (build assertion); size message matches the artifact; feature absent/disabled under `file://` SEED with the standard messaging.
- `npm run validate` green; new strings present in `de`.
