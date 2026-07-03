# SEED.html Advanced Reference — Outline

For readers who want to extend a SEED.html book with code. It assumes familiarity with JavaScript and with EPUB, and introduces the ways a project can be extended with scripts at different points in the publishing workflow.

The throughline: every feature in this book is revealed by enabling **Advanced Mode** in App Settings. Each `##` section becomes its own chapter file as we draft it (e.g. "Before you begin" → `chapter01.md`).

Production notes:

- **SVG diagrams** are expected to carry weight here (as in the user manual's `diagram-*.svg`) — flag candidates per chapter.
- **Code samples assume the markdown-it + Prism project setup**, so examples can use `window.markdownit` / `Prism` without re-introducing the libraries.
- **Cadence**: beats → review → draft a section → redline. One section at a time.
- **Voice**: this is a **reference / guide to how things work**, not a tutorial. Avoid "work through", "next, do X", step-by-step journey framing. State how things behave; let the reader dip in where they need.
- **No hard-wrapping**: one line per paragraph (no fixed-width wrap). The user reviews in Obsidian, where hard wraps show as ragged edges. List items stay one line each; leave code blocks as-is.

## Before you begin

- Who this manual is for (assumes JavaScript + EPUB)
- The extension points across a book's life, in one map
- Turning on Advanced Mode (the one switch that reveals everything)
- The shape of a project (SEED.zip → SOURCE/: settings, sources, scripts, extensions, a writable data area)
- Where the code runs (build-time sandbox vs the reading app)

## The text pipeline

- Two passes: text transform → DOM transform
- `transformText(text, idref, ctx)` — source → HTML string
- `transformDOM(htmlDocument, idref, ctx)` — Document → Document
- How a chapter flows through; ordering (the EPUB Settings form)
- The sandbox (restricted globals; libraries injected as globals)
- (`ctx` / reaching the rest of the book moved out — too advanced for the intro; it now opens the Generators chapter)

## Extensions  (drafted)

- Open by hand: an extension is a library + the wiring to use it (the user can't author `extension.json` — that's app-internal)
- The mechanism: upload a library JS on Project Settings → Extensions (→ global); assets via Manifest → Load File (all manifest JS/CSS auto-included in every chapter's head); wire it into the default `transformText.js` / `transformDom.js` from the chapter editor dropdown
- Worked: Textile (a text transform); highlight.js (a DOM transform + theme CSS)
- The one-click version: packaged Extensions via App Settings → Available Extensions
- Under the hood: a real `extension.json` (highlight) maps to the by-hand recipe; extensions can also carry generators (→ next chapter)

TODO (images): screenshot of App Settings listing the current extensions.

## Generators  (drafted)

- `ctx` — reaching the rest of the book (opening section; the on-ramp)
- The generator contract (`generateText(ctx, options)`, read-only ctx, inserts source at the caret); authored by hand in Project Settings → Generators
- Three escalating examples: static text → a Dropdown option (markdown/textile code block) → reading stored data (the List of Figures round-trip, both halves)
- A live alternative: a `[Figures]{.figures}` marker replaced by a DOM transform on every render (always-current vs editable-once)
- The same shape: index and glossary (mark, then collect)

## The publish-to-remote plugin  (drafted)

The plugin layer isn't user-extensible, so this is not a general "plugins" chapter — it's about the one shipped plugin. Brief framing, then straight into its features. Tone: measured, don't oversell — remotes are niche (S3/R2 the only real one), the real value is EPUBCheck validation.

- Framing (brief): App Settings → **Plugins** is an app-level group; a plugin is app-scoped (doesn't travel in the book like an extension), loads over HTTP, so it's absent from a `file:`-served core (offline single-file / embedded), and can carry heavyweight deps (EPUBCheck) without bloating the ~1MB core. Enable it there.
- Remotes: WebDAV, S3/R2, Google Drive, Dropbox; credentials entered at runtime, stored per-remote in OPFS (`remotes.json`), bring-your-own OAuth for Drive/Dropbox, volatile (not synced)
- Publishing: upload a packaged EPUB to a remote; list / delete local and remote files
- OPDS catalog generation (a browsable/subscribable feed)
- EPUBCheck validation (modal report) — where the validation deferred earlier lands

## Reading System JavaScript  (drafted)

- Code that ships in the EPUB and runs in the reading app (manifest JS; no special slot); SEED auto-marks chapters `scripted`
- The angle: support hugely varied / speculative / browser-preview ≠ reading system; decide target readers and test in them — but the 2026 platform-WebKit trend is narrowing the gap. Enhancement only; degrade gracefully
- Worked example: responsive width — `@container` em breakpoints, with a JS fallback (measure a paragraph's em-width → body class) guarded by `CSS.supports`

## Hardware-in-the-loop testing

- Why test on real devices, not just the preview
- The workflow for getting a build onto a device / reader and back (download for desktop readers, LocalSend for transfer on a local network, S3/R2 remote and OPDS catalog for Reading Systems that support it)

## Preview: head.xml

- CSS/JS injected into the preview `<head>`, authoring-time only
- Surfacing invisible XHTML (the `xml:lang` review-aid example)
- Per-preview-type toggle under Project Settings → Preview

## Coming later

- (parked topics as they surface)
