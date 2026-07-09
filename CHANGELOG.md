# Changelog

All notable, user-facing changes to SEED.html (Simple EPUB Editor).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Maintenance: add a product-language line under **[Unreleased]** whenever you ship
> something a user would notice, and cut a dated version section on each
> `package.json` version bump. Internal/CI-only changes (build, deploy, dependency
> pins) are intentionally omitted — this log describes what changed for someone who
> _uses_ the editor, not the commit history.

## [Unreleased]

### Added

- Text formats carry their own media-insertion templates: adopting a format — at project creation, from the App Settings catalog, or by switching the text transform in EPUB Settings — sets the project's image, video and audio-clip templates to format-appropriate defaults (Djot projects, for example, get the quoted clip directive and a raw-HTML video wrapper automatically).
- New **abcjs+jsyaml** extension (Code blocks): ` ```abcjs ` code blocks render as SVG music scores. YAML frontmatter names staff-width variants (narrow/wide/full) and the one that fits the reading column displays — pure CSS via container queries with media-query fallbacks, no reading-system JavaScript.
- Both music extensions (abc2svg, abcjs) ship a reworked ABC Sample generator: choose the block wrapper (Markdown/Textile), voices (1, 2, 3 or SATB), key, tempo, sample lyrics, and whether to include the responsive variants frontmatter.
- New **Neumes** extension (Code blocks): ` ```neumes ` blocks pair direction-mark lines (`/`, `\`) with syllable lines and render as manuscript-style singing notation — one SVG per line pair, so page breaks keep marks and words together, scaling with the reader's font size. Fence classes tint and identify parts for side-by-side layouts.
- New **Responsive layout** extension (Typesetting): chapter content adapts to the reading column — a comfortable em-based reading measure that works in every reading system, wide-page figure breakouts, e-ink adjustments, and caption-beside-image figures where the reading system supports container queries. Because it's em-based, readers who raise the font size get the narrow layout automatically.

### Changed

- The last traces of the app's former internal name are gone (the project is now `seed-html` throughout). One-time effects on upgrade: interface preferences reset once (theme, language, advanced mode, pane sizes and similar — projects are not affected), and on browsers that store projects in IndexedDB (e.g. Safari) the project database is adopted into its new home automatically, with the old copy left in place for one release as a backstop.
- The abc2svg extension's scale variants now switch with the same pure-CSS container-query approach as the new abcjs extension — the reading-system `responsive.js` script is gone, and scores no longer need JavaScript enabled in the reader.
- Shorter, clearer interface text throughout — the About page, settings descriptions, and notices say less, and the instructional detail they carried now lives in the user manual.
- Basic mode now shows only the Basic Info metadata tab; the Advanced and Accessibility tabs appear with Advanced mode (previously individual groups within them were hidden piecemeal).

## [0.7.0] - 2026-07-07

### Added

- Each EPUB now records the SEED.html version that last wrote it as a machine-readable `generator` in the book's metadata (alongside the human "book producer" credit).
- "Package EPUB without SEED" export in the Projects view — produces a plain, non-self-editing EPUB (no embedded editor) for distribution, downloaded directly.
- The spine editor's preview header shows the rendered chapter's filename (e.g. `chapter01.xhtml`) beside the Source toggle.
- Advanced mode: the PDF settings' Page size and Margin gain a "Custom…" option accepting free-form CSS values (e.g. `140mm 216mm`, `20mm 15mm 25mm 15mm`) passed straight through to the PDF layout engine.
- Audio clips now play in the packaged EPUB: the Djot and MarkdownIt transforms turn the `:clip` directive into tappable text, and the new AudioClips extension supplies the reading-system player script and styles (Djot projects: quote the template's attribute values).
- New Audio Clip Editor plugin (enable under Advanced mode): a waveform replaces the built-in audio clip editor in the spine editor — drag to define clips, fine-tune edges with wheel zoom and a minimap, play/loop, label, and insert; each audio file's clips persist with the project.
- The audio clip directive template is now editable in EPUB Settings (it previously required hand-editing `settings.json`).
- Drop a media file straight onto a chapter: it's imported into the manifest and a text reference is inserted at the cursor — images and video via new editable templates in EPUB Settings, audio as a whole-file clip directive ready for the clip editor. Other file types import to the manifest only. Dropping a file that already exists asks before overwriting; an identical file just inserts the reference.
- An Images panel in the editor shows thumbnails of the book's images — click one to insert it at the cursor.
- When more than one insert panel is available (Audio Clip Editor, Images, Generators) the editor header collapses them into a single Insert dropdown, like the preview's Checks dropdown; one panel shows at a time.
- Four new text formats in the extensions catalog: AsciiDoc (Asciidoctor.js), Org (org-js), Fountain screenplays (Fountain.js, with screenplay styling) and LaTeX (LaTeX.js, with base styling). Each ships a sample chapter and a syntax-example generator.
- The Markdown, Djot and Textile extensions gain the same syntax-example generators as the new formats.
- "Add SEED.html to package" now embeds a localized editor: the languages you have loaded travel inside the EPUB, so its built-in editor speaks your language when opened offline from the book.

### Changed

- Moved the "Generate PDF" button from Project Settings to the Projects view's active-project pane, alongside the new plain-EPUB export (the PDF print settings stay in Project Settings).
- Grouped the spine editor's file picker into labelled sections (chapter text, Reading System, Build scripts, Generators, Preview) instead of one flat list, and show real filenames.
- Collapsed the preview's Accessibility / EpubCheck / Reader panel toggles into a single dropdown when more than one is available.
- Folded the Source/Preview view toggle into the device dropdown as a "Source" entry (with "Responsive" alongside it), removing the separate button.
- Translations are no longer baked into the app file (which shrank by ~35KB): the hosted app fetches your language the moment you pick it and keeps a copy for offline use, so adding future languages won't grow the editor everyone downloads. The Language picker now lists exactly the languages the app can actually supply.
- The app file is ~10% smaller (1,085KB → 979KB): icons now ship only in the styles the interface actually uses, and unused styling was removed. A size budget in the build checks keeps the file from quietly growing back.

### Fixed

- Your language choice is restored when the app reloads (it was saved but never read back).
- Languages left behind by earlier app versions no longer linger in the Language picker; the stale entries are cleaned up automatically.

## [0.6.0] - 2026-07-01

### Added

- Four built-in content extensions:
  - **impressum** — an automatic colophon listing the extensions and fonts that went into the book.
  - **Prettier** — reformat JavaScript code blocks at narrow, wide, and full widths.
  - **fleuron** — replace thematic breaks (`---`) with a centred ornamental divider that inherits the text colour.
  - **language switching** — mark foreign-language runs so readers render and pronounce them correctly, with an in-editor flag overlay preview.
- **Track changes** — a review mode that records edits as patchsets you can accept or revert hunk by hunk.
- **Cover customization** — a redesigned generated cover with adjustable hue and light/dark mode, and a live before/after preview.
- Optional running header (the chapter title) in print and PDF output.
- Import collision review — when an imported chapter or file clashes with an existing one, choose to overwrite or keep both.
- Line-number gutter for code files in the editor, image dimensions shown in the manifest, and the current basic/advanced mode surfaced in the sidebar and settings.

### Changed

- Reorganized the extensions catalog in App Settings into **Text formats** and grouped **Content transforms** (Typesetting, Chapter content generation, Code block processing, Accessibility features).
- Published-EPUB lists are ordered most-recent first.

### Fixed

- SVG and MathML content is now correctly flagged in the EPUB manifest, so packaged books pass validation; the `scripted` flag is applied consistently.
- The fleuron ornament no longer renders with a stray box around it.
- The print/PDF cover image now has meaningful alternative text.

### Removed

- Retired the standalone `opds-server` development tool, superseded by the Publish-to-Remote plugin.

[Unreleased]: https://codeberg.org/stewarthaines/seed-html/compare/v0.7.0...HEAD
[0.7.0]: https://codeberg.org/stewarthaines/seed-html/releases/tag/v0.7.0
[0.6.0]: https://codeberg.org/stewarthaines/seed-html/releases/tag/v0.6.0
