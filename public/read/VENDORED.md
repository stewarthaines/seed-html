# Vendored: READ.html (EPUB reader)

- **Upstream**: the `read-html` repo (Codeberg origin, public GitHub mirror) — the standalone in-browser EPUB reader, foliate-js + Svelte 5
- **Source of this snapshot**: `dist-single/READ.html` built from read-html commit `df9f9ed` (2026-07-17), `readhtml-version` 0.1.0 — the first numbered release (versioning restarted below 1.0): payload-slot contract (see the read-html repo's `docs/PAYLOAD_SLOT.md`), srcdoc section delivery (books open from disk in Chrome), TOC/dialog polish
- **License**: MIT

## What it is here for

SEED.html's Publish surfaces open a packaged EPUB in a new tab (or the standalone-PWA overlay) via `read/READ.html?book=<url>` for review of the artefact. Unlike the bene reader this replaces, READ.html runs the book under the same content contract recipients get — scripted features (audio clips) actually play, after the reader's own per-book consent prompt. That prompt is deliberate dogfooding: the author sees exactly what a recipient sees. Do not add a trust-bypass parameter.

HTTP-only: like PDF export and plugins, this directory is not reachable from the `file://` single-file build (`isHttpContext()` gates the Read affordances).

## Upgrading

Copy a newer `dist-single/READ.html` over this file, update the commit/version line above, and re-verify: Read from Publish opens the book in a tab; a scripted book plays clips after consent; the standalone-PWA overlay still renders it; and `npm run test` stays green — the package-as-read unit tests assert the payload slot appears exactly once in this file, so a drifted slot marker fails loudly rather than shipping a broken "Package as READ.html".
