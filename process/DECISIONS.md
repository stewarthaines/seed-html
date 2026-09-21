# Decisions

Settled and declined items, one entry each, newest first within a section. Read this before proposing something that may already have been ruled on. A decision here can be reopened, but by the user, not by a proposal that does not know it exists.

## Product

- **2026-09-16 — Workbooks are the product; the editor is the enabler.** The market research (`process/SCRIPT_LEARNERS_MARKET_RESEARCH.md`) concluded that script-learning workbooks are what ships and sells; SEED.html exists to make them. Launch direct (Gumroad) rather than through Apple Books, which needs GST registration.
- **2026-09-21 — App makeover follows the Library model.** `process/APP_MAKEOVER_LIBRARY.md`. Books-first shelf, then Write / Book / Share tabs, Settings as a sheet. The generated cover is the app's identity.
- **SEED.html is not a general EPUB editor.** It edits the EPUBs it made, which carry their own source as `SEED.zip`. Any other EPUB imports read-only, with a banner saying so. Docs and UI copy head off the Calibre/Sigil assumption explicitly.
- **The app is named SEED.html.** "Simple EPUB Editor" in full; never bare "SEED", which collides with `SEED.zip` and "SEED EPUB". The sidebar shows "ReaditInaBook.com" on the brand domain only; that is deliberate.
- **The brand mark is the open-book face** (`src/lib/icons/readitinabook-mark.svg`, drawn by the user; ASCII form `[:\]`). It is the About nav icon and the `COVER_MARK` on generated covers. Candidate homes still open: favicon, README, console banner.
- **The source syntax is the author's choice per project.** Markdown, Djot, Textile and the rest are extensions; the minimal built-in converter is a demo, not a limitation to apologise for. Djot is the documented default (2026-09-21).

## Declined or parked

- **2026-09-15 — PDF export stays single-pass.** No two-pass export, no Paged.js `target-counter` rewiring, no page-map invalidation as app work. The app is for accessible EPUB; a near-accessible PDF from one browser is a quirk, not a focus. Wrong contents page numbers after a print-settings change are fixed authorially (re-preview each chapter in the PDF preset, export from Chrome). Findings are in `process/PDF_PAGE_INDEX.md` and the manual's Save-as-PDF chapter.
- **2026-09-11 — "Missing alt text" preview flag as a catalog extension: parked.** The mechanism exists (`previewHead` in `extension.json`, `process/PREVIEW_HEAD_EXTENSIONS.md`); the scope (alt only, or a family of invisible-in-render flags) is not decided. The user wants to use the hand-pasted `head.xml` version on real content first. Do not propose it unprompted; when it returns, start from scope.
- **2026-07 — No further text-format extensions.** ChordPro, MediaWiki wikitext, gemtext, reST, BBCode and Typst were researched and declined: "no interest in making epubs using any of these formats at this time." The catalog serves formats the user authors in.
- **2026-08-03 — No negative-margin breakouts in EPUB stylesheets.** Paginated readers clip or scroll unpredictably. To give a block more width, restructure so the constraint does not apply to it. The responsive extension's `.sr-figure` breakout is flagged for review under this rule.
- **2026-08-05 — Prefer the source format's own affordances over pipeline code.** An 84-line SVG kern pass in the abc2svg transform was rejected ("no. too much code") once ABC's own `~` solved the problem at the source. Exhaust the format's syntax before proposing transforms or post-processing; document the technique in the extension's SYNTAX.md instead.
- **Undo is deferred where the inverse is cheap.** The Chapters reorder view dropped a planned undo stack: explicit Apply plus preserved selection makes reversal a second Apply. Confirm-gate genuinely destructive actions instead.
- **Regenerate-before-package: proposed, not built.** Packaging does not re-render chapters (`process/CHAPTER_FRONTMATTER.md`, phase 5 parked).

## Architecture

- **Plugins are trusted, not sandboxed.** Plugins (`plugins/*`) are first-party code and receive the project's OPFS handle to parse the OPF themselves; the four-message contract (`plugin-ready`, `init`, `context`, `insert`) is varied by payload, not extended with brokers. Capability narrowing belongs to the extensions sandbox (the transform `ctx`), not to plugins.
- **Translation editions use the swap model.** The active language lives in `SOURCE/text/`, inactive ones under `SOURCE/locale/<tag>/text/`; switching is a journaled tree swap plus full regeneration. Shipped in 0.16.0; v2 (staleness basis, per-edition identifier) is in `process/TRANSLATION_EDITIONS.md`.
- **Core stays on Vite 6.** Storybook and vitest cap the toolchain (checked June 2026: every `@storybook/svelte-vite` caps at Vite 7 and Storybook 9 caps `vite-plugin-svelte` at 5). Plugins align down to the core toolchain rather than dragging the core up.
- **Track changes is review-mode lock-down**, not structural diff (`process/BRIDGE_TRACK_CHANGES_SIGNAL.md` and the track-changes design).
- **Chapter frontmatter** shipped in phases 1–4 (2026-09-09); both sample books migrated.

## Delivery

- **Deploys are local and separate from pushing.** `npm run build:i18n && npm run build:plugins && npm run deploy` (wrangler to Cloudflare Pages). Codeberg CI deploys were disabled 2026-07-18 because runners were unavailable; the workflow is `workflow_dispatch` only. Releases also publish the npm package from `npm-package/` (`docs/DEPLOYMENT.md`).
- **The Codeberg repository is private; GitHub is the public mirror.** Reader-facing links use `github.com/stewarthaines/seed-html`. `origin` stays Codeberg.
- **The user manual ships as a sample SEED EPUB read inside the app.** Screenshots of the whole app are redundant there; illustrate with cropped affordances (`docs/user/CLAUDE.md`).
- **Extension descriptions are one or two sentences of benefit**, never usage documentation; extensions render untranslated, so brevity counts twice.
