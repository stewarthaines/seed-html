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

## [0.21.0] - 2026-09-09

### Changed

- The editor's transform warnings list scrolls within a few lines' height instead of growing to fill the pane.
- An agent working over the bridge is now told when Track Changes is on: the project info carries the flag, and each write it makes says when the app kept a base copy of the file for a later patchset.
- Allowing an agent's writes "for this session" now holds for the whole bridge connection. It used to lapse after ten minutes or twenty writes, so a long search between edits meant a fresh prompt that expired unanswered while you were away. Script writes are still reviewed one by one.

### Added

- A Family History extension: give each person's chapter a frontmatter record of dates, parents and partners, and `:family:`, `:family-index:`, `:portraits:`, `:lifeline:` and `:tree:` markers render a kinship panel, a surname index, portrait crops from the book's photographs, lifelines and family trees. A record that breaks the rules is listed at the top of the panel while you write, in the book's language (English and German).
- The photo-regions extension now records each chapter's named regions under `SOURCE/data/regions/`, with the image's pixel size when the Photo Regions panel has seen it, for transform scripts that gather every photograph of a person across the book.
- In Djot and Markdown chapters, any directive written as `:name:{key=value …}` on lines of its own now reaches the project's DOM transforms with its attributes intact, so a script can define a `:lifeline:` or `:tree:` marker without a change to the text format. `:region:` and `:detail:` work exactly as before.
- A chapter can open with a YAML block between `---` lines. SEED.html strips it before the text format runs, so it no longer renders as a rule, and hands what it holds to the project's transform scripts as `ctx.frontmatter`, with every chapter's record kept under `SOURCE/data/frontmatter/` for scripts that combine chapters.
- The browser's Back and Forward buttons now walk the editor's own history: every chapter opened — by following a link in the preview, the reading-order arrows, or the spine list — and every view visited between them.
- Chapter links that point at a section (`chapter.xhtml#heading`) land on that section in the preview, and a link to a section of the open chapter scrolls straight to it.
- A `:detail:` directive shows one drawn region of an image as a crop in the chapter — a single register line, a face in a crowd — with no new bytes in the book, optionally linked to the page showing the full image and captioned with `caption=`. The crop is a real image in the chapter: it prints, screen readers announce its alt text, and it needs no stylesheet to show the right region. The Photo Regions panel inserts one from any drawn box, and its image picker now offers every image in the book, not just the open chapter's.

### Fixed

- An accessibility finding about a missing alt text on a `:detail:` crop now points at the chapter source, where the directive's `alt=` lives, instead of being marked as something to explain away.

## [0.20.0] - 2026-08-15

### Added

- Carve joins Djot, Markdown, AsciiDoc, Textile and Org as a chapter text format, with the same media and audio-clip templates.
- Fixed-layout projects can import images as chapters: pick image files in the chapter importer and each becomes a page, in filename order. Generated chapters in a fixed-layout book are numbered page01, page02… rather than chapter01 (the base word is a project setting).
- The Photo Regions panel's Insert now writes readable `:region:` lines into the chapter — editable markup that stays meaningful without the panel. The new PhotoRegions extension renders them: face outlines and numbered badges on the photo, a row-grouped name list in the caption, and names that link to a person's chapter when the book has one. The directive's shape is a project setting, beside the audio clip directive.
- Several manifest items can be selected and deleted in one confirmed action.
- Metadata collections can carry the series' own identifier — a periodical's ISSN, for example — alongside the collection name and position.
- OPDS catalogs published to a remote now carry each book's accessibility metadata, so catalog apps can show what to expect before downloading.
- Published catalogs now default to the OPDS 2.0 format, which library reading apps like Cantook read accessibility details from; existing catalogs keep working in the classic format.
- Import from Catalog reads OPDS 2.0 feeds too, so books published in the new default format can be imported back.
- A js-yaml extension, for projects whose transform scripts read structured data such as YAML frontmatter.
- A Photo Regions panel: drag boxes over the faces in one of the book's images, name who each one is, and insert the result into the chapter you are editing.
- The manifest table shows workspace files the book doesn't reference in their own "Not in manifest" section — preview them, delete them, or add one to the manifest.
- The Photo Regions panel remembers each photo's pixel size and offers a "shown as" name per region, and its saved library can now serve as the book's own record of who is pictured — transforms can read it directly, no pasting into chapters.
- Agent assistance can maintain plugin-saved data files (like the photo regions library), with the usual per-write approval.

### Changed

- The Flow dropdown is disabled while the layout is pre-paginated — reading systems must ignore flow for fixed-layout books.
- The fixed-layout viewport is recorded in the package under the app's own vocabulary instead of the deprecated rendition:viewport, so epubcheck no longer warns about it (OPF-086); older books migrate on their next save.

### Fixed

- Chapters created in the editor are now stored inside the book's content folder; removing a chapter also cleans up the stray copy earlier versions left at the workspace root.
- Contents-page and cross-chapter links in the exported PDF now jump to their target pages instead of pointing at a web address.
- An image referenced from a style attribute — a background image, say — now appears in the preview and the exported PDF, instead of showing a gap there while rendering correctly in reading systems.
- Packaged EPUBs no longer carry the app's internal workspace-state file.

## [0.19.0] - 2026-08-07

### Changed

- Screen readers announce a music score as one labeled image — "Musical score, part 2 of 5" — instead of reading out every lyric syllable of every size variant. The score's sung text still reads normally wherever the book sets it as text.

### Fixed

- Switching straight between the PDF and Proofs previews shows the pages again; the preview had been going blank until you switched away and back.
- Figures, publication rows and other laid-out blocks no longer come out blank in the printed PDF while everything around them prints.
- The editor is published under the single npm name `seed-html`; `npx @stewarthaines/seed-html` still works and now launches the current release.

## [0.18.0] - 2026-08-03

### Added

- Run the editor on your own machine with one command: `npx seed-html` starts a local server with the complete app — extensions catalog, plugins, the READ.html reader, and offline support included — no build step, nothing uploaded anywhere. The app and reader live at the same `/SEED.html` and `/READ.html` addresses as the hosted site.
- Agent assistance now works when the editor runs on your own machine (`npx seed-html`, not just the dev checkout): the robot button in the sidebar pairs the tab with a running `npx seed-html bridge`, and the bridge only accepts connections from your own machine's pages.
- Inline width alternatives: write `[Narrow]{.narrow}[Wide]{.wide}[Full]{.full}` in a heading or paragraph and exactly one shows, chosen by the width of the page it is read on.

### Changed

- The Responsive extension's reading measure now applies to prose only: paragraphs keep a comfortable line length while music scores, formatted code, figures and tables use the full width of the page or paper.
- Music scores and formatted code now choose their full-width rendering on A4 and US Letter pages, and on equally wide screens — previously print always got the middle size.

### Fixed

- In Firefox, the preview kept its scroll position and click-to-select after every edit again — previously both stopped working on every second re-render.
- The Prettier extension shows one formatted width at a time again, chosen to fit the column — the three variants had been rendering stacked.
- The robot and Package buttons stack in the collapsed sidebar instead of sharing a row that overflowed it.

## [0.17.0] - 2026-08-03

### Added

- Mermaid diagrams: with the new Mermaid extension installed, a ` ```mermaid ` code block renders as a crisp diagram that scales to the reading column and travels inside the book — no scripts, fonts or network needed to read it. Flowchart, sequence, class, state, pie and gantt diagrams are supported, a block can pick its own theme, and a generator inserts a ready-made sample of any of the six types with an accessible title and description filled in.

### Fixed

- Rendered diagrams no longer come out clipped when the system's Reduce Motion accessibility setting is turned on.

## [0.16.0] - 2026-07-31

### Added

- A split preview: the toggle beside the Checks menu stacks a second, independent preview under the first — two devices side by side, portrait next to landscape, scrolled next to paginated, or the Source view above its rendered result. Each half has its own view dropdown and options, the divider position is remembered, and checks run against whichever half supports them.
- The preview's Source view now shows the chapter file exactly as saved in the project (real image and stylesheet paths, not preview-only addresses), and a Raw/Tree toggle offers a collapsible tree of the markup with syntax colors — fold a section closed to see the chapter's structure at a glance. The tree is available when the editor runs online.
- Translate your book into another language: add a translation in Project settings and the current text is kept as a stored reference edition. Each chapter's file menu then offers that original beside the editable text (read-only, marked with a padlock) so you can translate side by side in the two-pane editor. Switch the active language back and forth at any time — the title, sort title, and description travel with each language, and every chapter re-renders in the right language for correct hyphenation and screen-reader voices.
- Hovering a preview names the device it is showing — the same wording as the view menu (e.g. "Commute (phone): Plus") — beside the existing size and render-time readout, so the two halves of a split preview are easy to tell apart.

### Changed

- The reading-theme colours in the reader-engine previews now defer to the book's own colours, matching the Responsive preview — an author's explicit background and text colours show as a real reader's night mode would show them. Force reading-system colours overrides in every preview, as before.
- Clicking a page in the Proofs preview no longer switches to the Print view — text can be selected in place, and with the split preview a Print pane alongside shows any page full-size without leaving Proofs.
- Switching chapters is much faster — the editor and preview now appear in a fraction of the previous time, the preview no longer re-renders a second time after settling, and nothing is written to disk until you actually edit.

### Fixed

- Re-packaging an EPUB under the same name no longer leaves the previous package's validation report showing in the editor — the report clears until you validate the new package.
- Renaming or deleting a chapter now carries its stored translation copies and its track-changes base along, instead of stranding them under the old name.
- Packaged books now declare the book's own language on the package element instead of always English.

## [0.15.0] - 2026-07-28

### Added

- A dedicated Chapters view for reorganizing the book: click the "Chapters" heading in the sidebar, select a run of chapters (shift-click, or arrow keys and Space), pick where they go, check the before/after diagram, and Apply. The same view sets chapters aside (kept in the book but out of the reading order) and deletes in bulk; your selection survives each move, so undoing is just moving back.
- The Append (+) button now inserts the new chapter after the selected one instead of always at the end.
- Move files between folders from the Manifest view: shift-click or Cmd-click to select several files, change their Directory in one edit, and review every file move — and every reference that will be rewritten in your text sources and stylesheets — before it happens. Single-file renames get the same safety, with the file path now split into Directory and Filename fields.
- The Manifest details pane lists where the selected file is used: each referencing chapter is a link that opens it for editing, and "No references found" flags assets nothing points at.
- A Proofs option in the preview's device dropdown lays the whole chapter out as a grid of small print pages — rhythm, breaks, and figure placement at a glance. Click any page to open it full-size in the Print view.
- The Print preview shows the book's real page numbers: once earlier chapters have been print-previewed, a chapter's folios continue from where the previous chapter ended instead of restarting at 1.
- Previous/next chapter arrows in the preview header step through the book in reading order — handy for sweeping chapter by chapter in Proofs.

### Changed

- Audio clip directives now reference audio files the same way as images (`../Audio/…`). Existing projects keep working in the editor, but clips won't play in packaged books until their directives are updated and the AudioClips extension is reinstalled.
- Typing-to-preview is much faster in large books — projects with many chapters and images no longer pay a per-keystroke penalty.
- Clicking a passage in the preview now centers the matching text in the editor instead of leaving it at the bottom edge.

### Fixed

- Fleuron ornaments no longer drag the whole preceding poem or paragraph onto the next page in the print preview and PDF, which left half-empty pages.

- The device previews (Commute, Home, Travel) now render with the READ.html reader engine when the editor runs over http: real page turns at each device's size — an e-reader preview that pages like an e-reader — with the pager, arrow keys, and your-place-survives-edits behavior from the READ.html preview, and honest per-device page counts. The reading theme and text size controls apply there too, and changing text size repaginates like a real device. Pages is the default flow; the Scroll option remains. Over file:// the devices show the same scrolling preview as before.
- Click a passage in a reader-engine preview to jump to its place in the source, the same as the other previews.
- The Accessibility check and the Announce (screen-reader) preview run on the reader-engine previews too, working on the paginated chapter itself. All three preview tools — click-to-source, Accessibility, and Announce — now behave the same across the Responsive and reader-engine views.
- The preview toolbar is steadier: the chapter name, view, and checks controls now stay put in the header, while the options for the current preview — reading flow, columns, page navigation, orientation — sit in their own row just below and hold their positions (greyed out when they don't apply) instead of shifting around as you switch views or turn pages.
- A "Paged device previews" switch in the app settings' Interface options turns the reader-engine device previews off, falling the Commute/Home/Travel presets back to the scrolling preview. READ.html is unaffected.

## [0.14.0] - 2026-07-24

### Added

- A new "READ.html" preview in the device dropdown (after Responsive) renders the chapter with the same engine as the READ.html reader — real page spreads or continuous scroll, with Pages/Scroll and column controls in the preview toolbar. Available when the editor runs over http (like the PDF preview).
- Page navigation in the READ.html preview: previous/next buttons, a page picker showing your place (e.g. 3 / 11), and arrow-key page turns when the preview is focused.
- The READ.html preview keeps your place while you edit: the page you're reading (or your scroll position) survives the re-render instead of resetting to the beginning.

## [0.13.0] - 2026-07-21

### Added

- Hear your book the way assistive technology presents it: pick "Screen reader" from the preview's Checks, hover any block, and press Announce — what a screen reader would say appears as captions over the preview, and can be spoken aloud with a choice of voice and speed.
- Two announcement styles, one per audience: Screen reader announces structure (headings with levels, list positions, image descriptions); Read aloud voices only the text, the way reading apps' built-in narration does.
- Announcements follow the app's language for structure and the book's language for the text — the same split real screen readers use. German announcement vocabulary is included.

### Changed

- The announcement voice picker offers voices for the book's language and the app's language instead of the platform's entire voice list.

## [0.12.0] - 2026-07-20

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
