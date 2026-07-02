# Changelog

All notable, user-facing changes to SEED.html (Simple EPUB Editor).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Maintenance: add a product-language line under **[Unreleased]** whenever you ship
> something a user would notice, and cut a dated version section on each
> `package.json` version bump. Internal/CI-only changes (build, deploy, dependency
> pins) are intentionally omitted — this log describes what changed for someone who
> *uses* the editor, not the commit history.

## [Unreleased]

### Added

- Each EPUB now records the SEED.html version that last wrote it as a machine-readable `generator` in the book's metadata (alongside the human "book producer" credit).
- "Package EPUB without SEED" export in the Projects view — produces a plain, non-self-editing EPUB (no embedded editor) for distribution, downloaded directly.

### Changed

- Moved the "Generate PDF" button from Project Settings to the Projects view's active-project pane, alongside the new plain-EPUB export (the PDF print settings stay in Project Settings).
- Grouped the spine editor's file picker into labelled sections (chapter text, Reading System, Build scripts, Generators, Preview) instead of one flat list, and show real filenames.

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

[Unreleased]: https://codeberg.org/stewarthaines/editme-svelte/compare/v0.6.0...HEAD
[0.6.0]: https://codeberg.org/stewarthaines/editme-svelte/releases/tag/v0.6.0
