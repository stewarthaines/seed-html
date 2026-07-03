# SEED.html User Manual — Outline

This is the master plan-of-record for the whole manual. Each `##` section becomes its own chapter file as we draft it (e.g. "Get started" → `chapter01.md`).

Conventions: no hard-wrapping — one line per paragraph (list items stay one line each). Chapters are reviewed in Obsidian and diffed in git.

## Get started

- Welcome — what SEED.html is, and who it's for
- How SEED.html works (this book is software) — the SEED EPUB idea; the three ways to run it (hosted web app, standalone HTML file, SEED EPUB); browser support; how your work saves automatically

## Make a book

- Start a project (Basic Mode)
  - Create a new project
  - Import from a file
  - Import from a catalog
  - Duplicate a project
  - Find and manage projects (search, switch, delete)
- Write and edit chapters
  - The chapter editor
    - Text content
    - CSS (styles)
    - Source view
    - (JavaScript / per-chapter scripts is Advanced Mode only — see "Go further")
  - Reading order (the spine)
  - Add, import, reorder, rename and delete chapters
- Preview your book
  - Live preview
  - Preview on different devices
  - Print preview

TODO (images): replace `screen-device-comparison.png` with a shot of the same content on an actual phone and tablet side by side — makes the point that having device previews in the app is valuable.

## Describe your book

- Metadata (EPUB 3)
  - Basic information
  - Advanced fields
  - Accessibility
- Cover image
- Table of contents (the navigation document)
- The file list (the manifest)

## Check your book

Catch accessibility problems while you write — the check runs inline against the chapter you're editing, so your book stays accessible from the start instead of being fixed at the end.

- Accessibility check (axe-core)

(EPUB validation moved to the publishing material — it's provided by the publish-to-remote plugin and isn't available in Basic Mode. See "Coming later".)

## Produce your book

- Package and export an EPUB
- Save as PDF

## Go further (Advanced Mode)

- App Settings
- Project Settings
- What Advanced Mode unlocks
- Metadata, revisited — the metadata view adds the content.opf source (hidden in Basic Mode)
- Extensions
- The text transform pipeline (JavaScript)
  - Text transforms
  - DOM transforms
- Reading System JavaScript
- Preview: head.xml

## Beyond writing: for designers and developers

Reframes the manual around three audiences from the project's own framing — authors, designers, developers. The earlier chapters serve the author; this chapter opens the door to the other two, with more technical detail. Carries the reflowable-first stance: accessibility and fitting every screen, and the genuinely novel output it affords — a designed book that still reflows.

- Who this chapter is for — authors / designers / developers
- For designers — CSS and the device preview (their domain, already met); responsive, reflowable design as the frontier (a magazine that's designed yet reflows — a segment that hasn't existed); fixed-layout (pre-paginated) reserved for picture books, where image and text are one composition
- For developers — the pipeline and the data; configuring text-transform libraries (new authoring formats); custom content types (a code block → SVG diagram via a DOM transform); data-backed workflows (List of Figures generator [shipped]; index and glossary via DOM transforms and generator scripts); library examples — KaTeX (maths), abc2svg (music), highlight.js / Prism (code)

## Workflows

Describes actual workflows for various types of content, including ABC notation, audio clip resources, author/editor/proof-reader round trips, themeable (light/dark mode) SVG elements, language switching for accessibility, reading system diagnostics, neumes renderer, inline fleuron themeable. Cover text and DOM transforms, Generators and app features that might not be obvious.

## Coming later

These topics aren't covered yet:

- Generators
- Add your own catalogs — the Catalog URL / Fetch field in Import from Catalog (an OPDS feed address), and managing saved feeds (hidden in Basic Mode)
- Publishing to a remote server and OPDS catalogs — includes EPUB validation (EPUBCheck): the publish-to-remote plugin bundles it, and a Validation button appears in the Publish row once that plugin is enabled (Advanced)
- Audio clips
- Glossary
- Troubleshooting
