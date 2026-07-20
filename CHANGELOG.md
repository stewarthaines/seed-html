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

- Transform and generator scripts can read the book's language (`ctx.language`) to produce locale-aware output, like dates written out in the book's own language.
- Opening a book link from READ.html's "Edit in SEED.html" now lands in the editor: `SEED.html?book=<url>` downloads the book and imports it — or offers to reopen the project if it's already here.

### Changed

- The reader is updated to READ.html 0.5.0: an "Edit in SEED.html" link in the reader's settings, Download and the book's trust checkbox moved there too, and reading modes reworked as Pages or Scroll with a single-column option.

## [0.11.0] - 2026-07-18

### Added

- Install the reader as its own app: visit readitinabook.com/READ.html and use your browser's Install option. Books read there also work offline once visited.

### Changed

- The reader's home is now readitinabook.com/READ.html — the two products sit side by side at the site root. Old /read/READ.html links redirect.
- Books open in the reader on older browsers too, back to iOS 16 / late-2022 versions.
- The reader is updated to READ.html 0.4.0: a Download button while reading, catalog browsing with covers and format choices, and an Update available marker when a catalog offers a newer version of a book you have.

### Fixed

- Importing from a catalog no longer fails on older browsers or unusual setups where the browser can't mint the project's identifier.
- Remote-publishing and audio-clip plugin panels work on iPad Safari, which refuses to hand browser storage folders across to plugins the way desktop Chrome does; the plugins now find their folders themselves.
- Saving remote credentials, validation reports, and audio-clip libraries works on Safari versions that lack the newer file-writing API (before 18.2).

## [0.10.0] - 2026-07-17

### Added

- Package your book as a single web page (Projects → Package as READ.html): one double-clickable file containing the book and its reader, for people who don't have — or know about — an EPUB app. Interactive features work without any confirmation prompt.
- Publish your project as its own editor (Projects → Package as SEED.html): one double-clickable file that opens as SEED.html with the book ready to import and continue editing — no install, no account. Edits live in the browser; use the package buttons to save work as files.

### Changed

- The Read button opens books in READ.html, a new reader built alongside SEED.html. Interactive features — audio clips, for example — actually play there, after a one-time per-book confirmation — and the book can be downloaded from the reader.
- Book covers in the Projects list are now full-height tiles — every row the same height, covers sharper on high-resolution displays, and covers that aren't book-shaped are cropped instead of stretched. (Thumbnails regenerate once on first load.)
- Packaged EPUB filenames use hyphens instead of spaces (`Title-Author-Date.epub`), so published download links work reliably in reading apps. Set your own pattern per project in EPUB Settings → Packaged Filename.
- The About page's outputs diagram is a small map of the Projects view: every package button and the file it makes, with the two that can return to be edited again.

### Fixed

- Audio clips now play and seek reliably in Apple Books. Encode clip audio at a constant bit rate (CBR) — VBR files seek unreliably in reading systems.
- Books packaged as READ.html open from disk in Chrome, not just over the web.
- The reader's address reads read/READ.html, not read/READ.
- The preview header no longer stacks its controls three rows deep in narrow panes; long chapter filenames shorten with an ellipsis.
- Audio playing in the chapter preview stops when the preview re-renders, instead of playing on with no way to stop it.

## [0.9.0] - 2026-07-14

### Added

- Define your own custom metadata fields from scratch: App Settings → Custom metadata catalog now has an "Add field" form (previously new fields could only be adopted from an imported book).
- Audio clips show an animated progress indicator while playing — choose ring, bar, or wave style per clip.
- Fixed-layout books: the device presets in the preview now show composition feedback — how the fixed page sits within each device's screen.
- The About page has a "Download the app" section (Technical Info): save the editor as a single SEED.html file for offline use, in your interface language.
- The brand mark — an open book, sideways — appears as the About icon and the browser-tab favicon.
- The hosted editor now lives at `/SEED.html` (the bare address redirects there), so saving the page suggests the right filename.

### Changed

- The Projects view opens instantly: the project list is remembered between sessions and shows each book's cover as a thumbnail.
- Editing a manifest entry's id or href updates just that entry instead of redrawing the whole view.
- Live preview does less repeated work per keystroke pause — the editor no longer re-reads its transform scripts and project structure from storage on every preview refresh.

### Fixed

- A chapter whose text file can't be read is no longer overwritten with an empty page — the editor shows the problem and refuses to save until you actually type something.
- Failures while auto-saving or persisting a chapter are now reported instead of silently ignored, so the preview can no longer drift out of sync with the packaged book unnoticed.
- Switching chapters while a preview was still rendering could write one chapter's content into another's file; renders now complete before the switch.
- PDF export names the chapters it had to skip (unreadable source) instead of silently omitting them, and no longer leaks preview resources.
- Storage errors on Safari now report the actual cause instead of a generic message, and renaming a file to its own name no longer deletes it.
- Extension credits (impressum) name the license itself rather than pointing at a file.

## [0.8.0] - 2026-07-11

### Added

- Custom metadata for the book: the Advanced metadata tab's new **Custom metadata** section (replacing the single-purpose Apple Books group) edits vendor-specific fields, and any unrecognised metadata found in an imported book — Calibre series info, for example — can be added to your catalog with one click, even on read-only books. Recognised fields are then offered on every book you edit; manage them under App Settings → Custom metadata catalog.
- A starter pack of real-world publishing fields ships with the catalog, disabled until you need them: Kindle fixed-layout and comics settings (including right-to-left page turn for manga and vertical Japanese text), Apple Books options (scroll axis, spread binding, orientation locks), and the Japanese EBPAJ production-guide marker. Fields with a fixed vocabulary present a dropdown so a typo can't slip into the book.
- The EPUB 2 cover marker (used by Google Play Books) is now visible and editable in Custom metadata; it still fills in automatically from the cover image when you haven't set it yourself.
- Link a folder of text files to your chapters (Chrome and Edge): write in any editor you like, then one click brings the changes in. Every sync shows what changed before anything is written — edited files, new files, and chapters whose file has gone — and nothing is removed unless you say so. New chapters join the end of the list; syncing never reorders the chapters you've arranged. Change or unlink the folder from the same window.
- Publish straight to a USB e-reader: in the Publish plugin, "Add Remote Storage" is now "Add Destination" and (on Chromium-based desktop browsers) offers USB e-readers alongside cloud storage. Pick the mounted device once — a Kobo is recognised automatically — and it stays configured across sessions; published books copy straight onto it, with a reminder to eject so the reader indexes them.
- Text formats carry their own media-insertion templates: adopting a format — at project creation, from the App Settings catalog, or by switching the text transform in EPUB Settings — sets the project's image, video and audio-clip templates to format-appropriate defaults (Djot projects, for example, get the quoted clip directive and a raw-HTML video wrapper automatically).
- New **abcjs+jsyaml** extension (Code blocks): ` ```abcjs ` code blocks render as SVG music scores. YAML frontmatter names staff-width variants (narrow/wide/full) and the one that fits the reading column displays — pure CSS via container queries with media-query fallbacks, no reading-system JavaScript.
- Both music extensions (abc2svg, abcjs) ship a reworked ABC Sample generator: choose the block wrapper (Markdown/Textile), voices (1, 2, 3 or SATB), key, tempo, sample lyrics, and whether to include the responsive variants frontmatter.
- New **Neumes** extension (Code blocks): ` ```neumes ` blocks pair direction-mark lines (`/`, `\`) with syllable lines and render as manuscript-style singing notation — one SVG per line pair, so page breaks keep marks and words together, scaling with the reader's font size. Fence classes tint and identify parts for side-by-side layouts.
- New **Responsive layout** extension (Typesetting): chapter content adapts to the reading column — a comfortable em-based reading measure that works in every reading system, wide-page figure breakouts, e-ink adjustments, and caption-beside-image figures where the reading system supports container queries. Because it's em-based, readers who raise the font size get the narrow layout automatically.

### Changed

- The browser tab now reads "Book Title · SEED.html" instead of the bare book title.
- Chromium-only options no longer vanish on other browsers: the USB e-reader destination (Publish) and the Link folder button (Chapters) stay visible everywhere, disabled with a plain explanation of what they need (Chrome, Edge).
- The user manual covers linking a folder, and the OPF preview highlights custom metadata alongside the standard fields.
- The last traces of the app's former internal name are gone (the project is now `seed-html` throughout). One-time effects on upgrade: interface preferences reset once (theme, language, advanced mode, pane sizes and similar — projects are not affected), and on browsers that store projects in IndexedDB (e.g. Safari) the project database is adopted into its new home automatically, with the old copy left in place for one release as a backstop.
- The abc2svg extension's scale variants now switch with the same pure-CSS container-query approach as the new abcjs extension — the reading-system `responsive.js` script is gone, and scores no longer need JavaScript enabled in the reader.
- Shorter, clearer interface text throughout — the About page, settings descriptions, and notices say less, and the instructional detail they carried now lives in the user manual.
- Basic mode now shows only the Basic Info metadata tab; the Advanced and Accessibility tabs appear with Advanced mode (previously individual groups within them were hidden piecemeal).

### Fixed

- Metadata the app doesn't model — from Calibre, publisher toolchains, or hand editing — is preserved when a book is saved instead of being silently dropped, including the vendor prefix declarations it needs to stay valid.

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

[Unreleased]: https://github.com/stewarthaines/seed-html/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/stewarthaines/seed-html/releases/tag/v0.9.0
[0.8.0]: https://github.com/stewarthaines/seed-html/releases/tag/v0.8.0
[0.7.0]: https://github.com/stewarthaines/seed-html/releases/tag/v0.7.0
[0.6.0]: https://github.com/stewarthaines/seed-html/releases/tag/v0.6.0
