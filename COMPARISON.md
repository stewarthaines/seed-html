# SEED.html in the EPUB tooling landscape

This document positions **SEED.html** (Simple EPUB Editor) against the other tools a technically competent user is likely to weigh when choosing an EPUB workflow. It is written to be factual rather than promotional: the aim is to show where SEED is genuinely different, and — just as importantly — where it deliberately does less than the alternatives.

Two things frame everything below. First, SEED is **not a general-purpose EPUB editor**: it authors and round-trips _its own_ SEED EPUBs (the ones that carry an embedded `SEED.zip` source archive), and it is not a Sigil- or Calibre-style tool for opening and repairing arbitrary third-party EPUBs. Second, SEED is **EPUB-3-first**: it targets EPUB 3 as its native output and treats PDF as a deliberate but secondary export. Tools like InDesign, Pandoc, and Quarto target many output formats for good reason; SEED intentionally does not compete on that axis.

## What SEED optimises for

The distinctive thing about SEED is the _combination_ of these properties, not any single one of them:

- **Runs in the browser as a single offline file.** The production build inlines all JS, CSS, and assets into one ~1 MB `index.html` with no install step and no account. It can run hosted, downloaded for `file://` offline use, or embedded inside an EPUB. (See `vite.config.ts`, `DEPLOYMENT.md`.)
- **Local-first, no server for authoring.** Storage uses OPFS with an IndexedDB fallback, chosen by feature detection; nothing leaves the machine unless you opt into the WebDAV publish plugin. (See `ARCHITECTURE.md`.)
- **Plain-text sources that are diffable and version-control-friendly** — a property it shares with Pandoc and Quarto, but not with the GUI editors.
- **The source syntax is the author's choice, per project.** You pick Markdown, Djot, or Textile as your starting point (shipped extensions `extensions/markdown-it`, `extensions/djot`, `extensions/textile`) rather than being locked to one tool's dialect. The tiny built-in converter in `src/assets/universal/transformText.js` is a stripped-back demonstration of the transform pipeline, not the intended everyday format.
- **Self-editing EPUBs.** The editor and its sources can be embedded in the book itself, so the finished EPUB can edit itself with only a modern web browser. No other tool in this comparison does this. (See `EPUB_EMBEDDING.md`.)
- **A sandboxed, capability-brokered extension model.** Transform scripts run in an isolated iframe and reach storage only through a brokered `ctx` API, so an extension cannot read or write outside its granted scope. (See `src/lib/transform/transform-broker.ts`, `src/lib/transform/TRANSFORM_CONTEXT.md`.)

## Where SEED deliberately does less

- **It is not a general or arbitrary-EPUB editor or converter.** Sigil and Calibre open and repair any EPUB; Pandoc converts between dozens of formats. SEED edits the EPUBs it created.
- **PDF is a secondary, browser-print-based export.** SEED paginates with a vendored Paged.js polyfill and drives the browser's native "Save as PDF" (`src/lib/pdf/pdf-export.ts`). It handles page size, running headers, tagged-PDF accessibility, cover bleed, and RTL — but it is not a typesetting engine, and because it fetches Paged.js from the origin it is unavailable in the `file://` standalone and Active-EPUB modes.
- **Fewer output formats by design.** InDesign, Pandoc, and Quarto each target many formats deliberately; SEED concentrates on EPUB 3.
- **It is pre-1.0** (currently v0.6.0). The core pipeline is shipping and stable, but the surface is still moving.

## Comparison

Cells are kept short; read them alongside the per-tool notes and the honesty caveats above. "✓" means first-class support, "~" partial or caveated, "✗" not a goal of the tool.

| Feature                                           | SEED.html                                       | Adobe InDesign               | Sigil                      | Calibre                  | Pandoc                        | Quarto                        | Vellum                   |
| ------------------------------------------------- | ----------------------------------------------- | ---------------------------- | -------------------------- | ------------------------ | ----------------------------- | ----------------------------- | ------------------------ |
| **Positioning**                                   |                                                 |                              |                            |                          |                               |                               |                          |
| Primary purpose                                   | EPUB 3 authoring                                | Print/DTP + export           | EPUB editing               | Library + convert + edit | Universal doc converter       | Technical/academic publishing | Indie-author formatting  |
| Native output focus                               | EPUB 3 only                                     | Print + PDF + EPUB + more    | EPUB                       | Many e-book formats      | Dozens of formats             | HTML/PDF/Word/EPUB/more       | EPUB + print PDF         |
| Print / fixed-layout strength                     | ~ browser-print PDF                             | ✓ strong FXL + print         | ✗                          | ~ conversion only        | ~ via LaTeX/Typst             | ✓ via LaTeX/Typst             | ✓ print-ready PDF        |
| **Source & editing model**                        |                                                 |                              |                            |                          |                               |                               |                          |
| Source model                                      | author-selected: Markdown / Djot / Textile      | visual DTP layout            | XHTML/CSS code + preview   | XHTML/CSS code + preview | Markdown (+ many)             | Markdown + code cells         | imported Word, styled UI |
| Plain-text, diffable, VCS-friendly                | ✓                                               | ✗                            | ~ (XHTML in a package)     | ~ (XHTML in a package)   | ✓                             | ✓                             | ✗                        |
| Edits arbitrary existing EPUBs                    | ✗ its own SEED EPUBs only                       | ✗ authoring only             | ✓                          | ✓                        | ✗ authoring only              | ✗ authoring only              | ✗ authoring only         |
| **Platform & access**                             |                                                 |                              |                            |                          |                               |                               |                          |
| Runs as                                           | browser app                                     | desktop app                  | desktop app                | desktop app              | CLI                           | CLI                           | desktop app              |
| Install / OS lock-in                              | none, any modern browser incl. Android, iOS     | install; Win/macOS           | install; cross-platform    | install; cross-platform  | install; cross-platform       | install; cross-platform       | install; **macOS only**  |
| Offline & local-first, no account                 | ✓                                               | ✓ (subscription auth)        | ✓                          | ✓                        | ✓                             | ✓                             | ✓                        |
| License & cost                                    | MIT, free                                       | subscription                 | GPL, free                  | GPL, free                | GPL, free                     | GPL, free                     | paid, one-time           |
| **EPUB 3 depth**                                  |                                                 |                              |                            |                          |                               |                               |                          |
| EPUB 3 features (MathML/SVG/media/semantics)      | ✓                                               | ✓ (reflow + FXL)             | ~ improving; strong EPUB 2 | ~ via editor             | ~ MathML (few readers render) | ✓                             | ~ author-oriented subset |
| Live device / reflow preview                      | ✓ multi-device + reader sim                     | ~ export preview             | ✓ preview view             | ✓ live preview           | ✗                             | ✗                             | ✓ live preview           |
| Accessibility metadata + in-tool checks           | ✓ EPUB Accessibility 1.1 + axe-core + EPUBCheck | ~ export options             | ~ manual                   | ~ reports                | ~ semantic HTML               | ✓                             | ~ built-in defaults      |
| **Extensibility / automation**                    |                                                 |                              |                            |                          |                               |                               |                          |
| Custom transforms / scripting                     | ✓ sandboxed ctx transforms + generators         | ~ scripting (JS/AppleScript) | ✓ plugins                  | ✓ plugins                | ✓ Lua filters                 | ✓ Lua filters + extensions    | ✗                        |
| Batch / CLI pipeline                              | ✗ interactive browser app                       | ~ scriptable                 | ~ plugin-driven            | ✓ CLI                    | ✓ CLI                         | ✓ CLI                         | ✗                        |
| **Distinctive**                                   |                                                 |                              |                            |                          |                               |                               |                          |
| Self-editing EPUB (editor embeddable in the book) | ✓                                               | ✗                            | ✗                          | ✗                        | ✗                             | ✗                             | ✗                        |

## The tools at a glance

- **SEED.html** — a browser-based, offline, EPUB-3-first authoring environment for books it originates; distinctive for embedding its own editor into the finished EPUB and for a sandboxed, author-chosen text pipeline.
- **Adobe InDesign** — professional desktop-publishing software whose EPUB export produces reflowable or fixed-layout books; the strongest print and fixed-layout story here, with EPUB as one of many outputs.[^indesign]
- **Sigil** — a dedicated open-source EPUB editor with code and preview views; WYSIWYG editing moved to the companion PageEdit app in 2019. Strong EPUB 2, with EPUB 3 support that has been improving since 2016.[^sigil]
- **Calibre (Edit Book)** — primarily an e-book library manager and format converter; its "Edit Book" tool is a capable XHTML/CSS EPUB editor with reports, checkpoints, and live preview. Calibre's own docs note conversion is not a substitute for editing.[^calibre]
- **Pandoc** — a universal command-line document converter; from Markdown (and many other inputs) it produces valid EPUB 3, rendering math as MathML — which the docs note few reading systems actually render.[^pandoc]
- **Quarto** — an open-source scientific and technical publishing system built on Pandoc; one Markdown source compiles to HTML, PDF, Word, and EPUB, with executable code cells.[^quarto]
- **Vellum** — a macOS-only, paid formatting tool for indie authors that turns an imported Word manuscript into a print-ready PDF and an EPUB with minimal configuration.[^vellum]

## Sources

[^indesign]: Adobe, "Export to EPUB in InDesign." https://helpx.adobe.com/indesign/using/export-content-epub-cc.html

[^sigil]: "Sigil (application)," Wikipedia. https://en.wikipedia.org/wiki/Sigil_(application)

[^calibre]: "Editing e-books," calibre manual. https://manual.calibre-ebook.com/edit.html

[^pandoc]: "Creating an ebook with pandoc." https://pandoc.org/epub.html

[^quarto]: "ePub Options," Quarto documentation. https://quarto.org/docs/reference/formats/epub.html

[^vellum]: "Generation Settings," Vellum Help. https://help.vellum.pub/generating/settings/
