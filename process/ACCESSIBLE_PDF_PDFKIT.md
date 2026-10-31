# Accessible PDF with PDFKit, laid out by the browser

Status: approved 2026-10-31; phase 0 done on branch `accessible-pdf`.

## The goal

SEED.html becomes a single source for an accessible EPUB and an accessible PDF. The PDF is the same file whichever browser makes it: tagged, with bookmarks, page labels, a title and a language, aiming at PDF/UA-1.

Today's PDF comes from the browser's Save as PDF (`src/lib/pdf/pdf-export.ts`). Chrome and Edge write tags and links but no bookmarks; Firefox writes neither; Safari differs again. No browser offers an API that returns the print output as a file, so the app can't finish what the browser started without a second step.

## The approach

The browser does the layout; PDFKit writes the file. Paged.js paginates the book exactly as it does now. The app then walks the paginated document, reads the position, font and size of every line of text and every image from the live layout, and replays them into a PDFKit document page by page. The tag structure comes from the DOM, not from the page geometry.

Line breaks and positions are the browser's, so they can differ slightly between Chrome, Firefox and Safari: each draws text a little differently. That is the accepted compromise. What is uniform is everything else: the fonts (the book's own, embedded), the tags, the reading order, the bookmarks, the page labels and the metadata.

## Why PDFKit

PDFKit is the only mature JavaScript PDF writer that writes tags, and it runs in the browser. It embeds and subsets fonts through fontkit, which also shapes text (ligatures, Arabic and Hebrew joining). Its accessibility docs describe a PDF/UA mode (`tagged: true`, `subset: 'PDF/UA'`), a structure tree built from marked content, artifacts for decoration, and an outline API for bookmarks.

The layout libraries built on PDFKit (pdfmake, @react-pdf/renderer) don't pass tags through, and using the browser's layout makes them unnecessary. Typst in the browser would mean a second rendering path without the book's CSS. krilla, the Rust writer inside Typst 0.14, is stricter about PDF/UA and worth watching, but its browser build is unconfirmed. Background: the survey in the conversation of 2026-10-30, sources at the end.

## Where it lives

A `view` plugin, under the plugin layer's rule (`src/lib/plugins/API.md`): PDFKit and fontkit are a heavy dependency, and the plugin is only offered when the app is served over HTTP. The core's Save as PDF stays as the working fallback when the plugin is off or unavailable, as the plugin contract requires of a `view`.

The work splits in three, and the weight sits in the plugin.

**The core paginates.** `buildPagedDocument` in `pdf-export.ts` builds the book and Paged.js paginates it, exactly as for Save as PDF and the PDF preview. There is one builder, so a change to print settings, `print.css` or an extension's layout reaches the PDF with no second copy to keep in step.

**The core measures.** A walk over the paginated document records what is drawn where: each word's text, rectangle, font and colour; each image's rectangle and source; each box's background and borders; each margin box; and the structure tree, with every drawn item pointing at the structure element it belongs to. The result is a page description in plain data: pages, then items in drawing order, plus the tree. The walk needs no library and is a few hundred lines. It also finds the problems before any PDF exists: a font family with no font file in the book, glyphs the browser borrowed from another font, CSS the PDF can't draw.

**The plugin writes.** The plugin receives the page description and the font and image files it names, and writes the PDF with PDFKit and fontkit: font embedding and subsetting, text shaping, width fitting, images, the structure tree, bookmarks, page labels and metadata. Every heavy dependency, and the PDF-specific knowledge, is in the plugin.

The handover is data, not a live document, so it goes by `postMessage` like the rest of the plugin contract. It can be saved, compared between Chrome and Firefox, and unit-tested without a browser or PDFKit. The contract gains one message pair, asked by the plugin: `describe-book`, answered with the page description and the book's font files (`book-described`). The plugin owns the card on the Share page, writes the PDF and offers it to save.

## From the layout to the page

**Pages.** One PDF page per `.pagedjs_page`, at the page box size the print settings chose. Coordinates are read relative to the page box and converted from CSS pixels to PDF points.

**Text.** Each text node is split into words with `Intl.Segmenter`. A `Range` over each word gives its rectangles through `getClientRects()`, and the computed style of the parent gives the font family, weight, style, size and colour. Words are drawn at their measured positions, so justification and the browser's line breaks come through unchanged. Where PDFKit's width for a word differs from the browser's, the word is fitted to the measured width with character spacing so nothing overlaps.

**Hyphens.** A word whose rectangles fall on two lines was hyphenated by the browser. The visible hyphen is drawn as decoration and the word's text stays whole for search and screen readers (`ActualText`, or the hyphen marked as an artifact; the spike decides which PDFKit can do).

**Fonts.** Each computed font family is matched to an `@font-face` in the book's stylesheets and loaded from the book's manifest. A family with no font file in the book is an error listed in the export, not a silent substitute: there is no system-font fallback. If the browser filled in a glyph from another font, fontkit shows it missing from the book's font, and the export lists the characters.

**Images.** Each `img` is drawn at its measured rectangle. JPEG and PNG go in directly; WebP and other formats go through a canvas to PNG; SVG is drawn as vectors if a PDFKit SVG renderer proves good enough, otherwise rasterised at print resolution.

**Boxes.** Backgrounds, borders and rules (`hr`, table borders, the borders of a sidebar) are drawn as rectangles and lines from the computed style, as artifacts. Gradients, shadows, transforms and filters are out of scope for the first version and listed when present.

**Margin boxes.** Running heads and page numbers are drawn as pagination artifacts, never as content, so a screen reader doesn't read them on every page.

## The tags

The structure tree follows the DOM in reading order, not the visual order of the page, and Paged.js's page and area wrappers are skipped.

| DOM                                | PDF structure                        |
| ---------------------------------- | ------------------------------------ |
| `section` from a chapter           | `Sect`                               |
| `h1`–`h6`                          | `H1`–`H6`                            |
| `p`                                | `P`                                  |
| `ul`, `ol` / `li`                  | `L` / `LI`, with `Lbl` and `LBody`   |
| `blockquote`                       | `BlockQuote`                         |
| `figure`                           | `Div`                                |
| `img`                              | `Figure`, `Alt` from the `alt` text  |
| `img alt=""`                       | an artifact                          |
| `figcaption`, table `caption`      | `Caption`                            |
| `table`, `thead`, `tbody`, `tfoot` | `Table`, `THead`, `TBody`, `TFoot`   |
| `tr`, `th`, `td`                   | `TR`, `TH` (with scope), `TD`, spans |
| `aside`, notes                     | `Note`                               |
| `a`                                | `Link`                               |
| an element with its own `lang`     | its structure element gets `Lang`    |
| `role="doc-pagebreak"` markers     | nothing (see page labels)            |

A paragraph that Paged.js split across two pages is one `P` with content on both pages, joined back together from Paged.js's split markers (`data-split-from`). The same goes for lists and tables, whose repeated header rows on later pages are artifacts.

Links are the known gap. PDFKit's docs limit tagging to marked content, while a link in PDF is an annotation that a `Link` structure element must reference. The spike checks whether PDFKit can make that reference; if not, it's the first patch to offer upstream.

## What the file carries

- Bookmarks from the book's contents (the toc nav), at each target's page.
- Page labels that match the page numbers printed in the margins, including roman numerals for front matter where the book's CSS counts them that way. The print-edition markers (`doc-pagebreak`) belong to another edition's pages and are not this PDF's page labels.
- Title, author and language from the OPF; the viewer shows the title, not the file name.
- The PDF/UA identifier in the metadata only once a book passes veraPDF, never by default.

## Matches what the author saw

The PDF is drawn from the browser's own layout of the same paginated book the PDF preview shows, so it matches what the author saw in their browser: the same line breaks, page breaks, positions, sizes and fonts. A Firefox author gets a PDF that matches Firefox; a Chrome author, one that matches Chrome.

Where it can't match, the export says so rather than drawing something else. A font with no file in the book, a glyph from another font, or CSS the PDF doesn't draw (gradients, shadows, transforms and filters in the first version) is listed before the PDF is written. Glyph edges can look slightly different in a PDF viewer, which draws text its own way, but nothing moves.

Page numbers match the whole-book PDF preview, not the one-chapter preview, which numbers from 1; that is true of Save as PDF today.

## Uniform, and what isn't

The same book gives the same tags, fonts, bookmarks and metadata in every browser. Layout differences come from the browser's text drawing and its support for the book's CSS, and those differences stay. A book that relies on CSS one browser lacks will look different in that browser, as it does in the preview today.

## Phases

- **Phase 0, spike.** One chapter of Joseph's book: text, headings and paragraphs, with fonts embedded, tagged, and one paragraph split across a page. Check it with a PDF/UA validator (veraPDF is not installed; how to validate is still to be worked out). Settle three things: whether one structure element can span pages in PDFKit, whether a `Link` can reference its annotation, and how to keep a hyphenated word whole.
- **Phase 1, text and structure.** The whole book's text, headings, lists, blockquotes and notes, the font matching and its errors, margin boxes as artifacts, metadata.
- **Phase 2, figures and tables.** Images with alt text and captions, tables with header scope and split tables.
- **Phase 3, navigation.** Bookmarks, page labels, links.
- **Phase 4, boxes and scripts.** Backgrounds, borders and rules; right-to-left text and its reading order, checked on a Hebrew or Arabic sample.

## Phase 0 findings

Run 2026-10-30 on Essay 1 of _John, Paul, and George_ (five pages at 143 × 205 mm) in Chrome, from the in-app PDF preview. The core's measuring is `src/lib/pdf/page-description.ts`; the plugin's writer is `plugins/accessible-pdf/src/write-pdf.js`. No validator has been run yet.

**It works.** Measuring the five pages takes about 60 ms and gives a 230 KB description. The PDF matches the preview line for line: the same breaks, hyphenation, justification, indents, bold italic and page numbers. It has an embedded subset of each font with a ToUnicode map, `Lang`, `DisplayDocTitle`, `MarkInfo` marked, tab order by structure, page labels, and bookmarks for the H1 and H2.

**One element across pages: yes.** PDFKit writes content on a later page as a marked-content reference, so the two paragraphs Paged.js split are each one `P` with content on both pages. Paged.js gives a split element's pieces the same `data-ref`, which is how the measuring knows they are one element.

**Hyphenated words: a `Span` with ActualText.** The browser's hyphen is drawn, and the `Span` holding both parts carries the whole word, so search and screen readers get "recognized", not "rec-" and "ognized". Chrome misreports the line of a one-character range at a hyphenation point, so the break is found from growing prefixes of the word instead.

**Links: yes, with two fixes owed.** PDFKit can tie a link annotation to its `Link` element (an object reference), but it records the page current when the element is closed, not the annotation's page, and it writes no `Contents` for the annotation. The writer can close each `Link` on its own page; the page reference is a small patch to offer upstream. Essay 1 has no links, so this was checked on a test file.

**Fonts.** The book named system fonts (Times New Roman for the text, the app's `system-ui` for page numbers), which a web page can't read; the first run took the macOS font files from disk. Only Chrome and Edge can read installed font files (`queryLocalFonts()`, behind a permission prompt); Firefox and Safari can't, and a system font differs between computers anyway. So the rule stands: the book carries its fonts. The book now carries Liberation Serif (SIL OFL, Times New Roman's widths) for print and the page numbers, and all 116 lines of Essay 1 break exactly as they did in Times New Roman (2026-10-31).

**Validation: passes.** axesCheck (check.axes4.com, 2026-10-31) reports PDF/UA and WCAG fulfilled for every machine-verifiable requirement. It also showed the title as "Print preview", the preview document's `<title>`; `describePages` now takes the book title from its caller, which has the OPF.

**Text extraction (2026-10-31).** Apple's PDFKit (Preview) and pypdf read Essay 1 in reading order, a paragraph at a time, but both ignore ActualText: at first they gave "rec- ognized". Tagged PDF marks a hyphen the line break added as a soft hyphen (ISO 32000-1, 14.8.2.2.3), so the writer now draws the font's own U+00AD glyph, which looks like a hyphen and reads back as a soft hyphen; extractors that follow the spec join the word. fontkit's shaping hides U+00AD as a zero-width space, so the writer puts the glyph back. A font whose soft hyphen shares the hyphen's glyph (Times New Roman does; Liberation Serif doesn't) still gets a plain hyphen, and only ActualText keeps the word whole. Apple's extraction adds a space at every line end, which no tagging changes.

**The PDF/UA identifier is off by default (2026-10-31).** PDFKit writes it whenever `subset: 'PDF/UA'` is set; the writer now sets it only when asked (`claimPdfUa`). A validator checking a file without it may report the identifier missing (Matterhorn 06-002) rather than judging conformance, so validation runs on a file written with the claim, and the author decides whether a passing book carries it.

**Still to do in phase 0.** A screen reader on the file.

## Phase 1 progress

**In the app (2026-10-31).** With the plugin on, the Share page's Make a PDF card is the plugin's; Save as PDF is its fallback. Generate PDF lays out the whole book off screen with the same builder as Save as PDF (`buildBookDocument`), measures it, matches each font to the book's `@font-face` rules (`src/lib/pdf/font-files.ts`) and hands the plugin the description and the font files; the plugin writes the PDF and offers Download PDF. A font with no file in the book stops it and names the font. What the PDF doesn't draw yet is listed on the card (`img`, `a[href]`).

**Joseph's book, whole (2026-10-31).** 225 pages laid out, measured and written in about 7 seconds in Chrome. Title, author, language, page labels, 87 bookmarks; 105 `Sect`, 20 `H1`, 67 `H2`, 957 `P`, 16 lists; only Liberation Serif embedded. Two fixes it showed: CSS letter-spacing is now spread over every glyph (the browser adds it after the last letter too), and PDFKit's browser build has no standard fonts, so the writer sets no default font.

**Visually hidden text (2026-10-31).** The copyright page's heading is hidden with the usual clip recipe so axe passes. It was drawn in the PDF; now it is in the structure but drawn in text render mode 3, neither filled nor stroked, so screen readers and copy get it and the page doesn't show it.

**Words Paged.js splits across pages (2026-10-31).** Where a paragraph breaks mid-word at a page end, Paged.js writes a non-breaking hyphen (U+2011) into the text of a `.pagedjs_hyphen` element. Liberation Serif has no U+2011, so Chrome drew it from a fallback font and the PDF lost it ("rem" / "ained"). The measuring now treats it as a hyphenated word across the pages: the writer draws a soft hyphen and one `Span` with the whole word ("remained") spans both pages. Joseph's book has 24 such words, some split at odd points ("writi-ng", "somet-hing"); that is Paged.js's split, the same in the preview.

**Text lost off the page edge (2026-10-31): a Paged.js bug, fixed.** On six pages of Joseph's book (11, 23, 119, 136, 185, 206) a paragraph's last line was missing from the preview, Save as PDF and the accessible PDF. Paged.js broke the page in the right place, but then typed its page-split hyphen into the text; on a tight justified line Chrome had fitted its own hyphen there, and the typed one is 4–5 px too wide, so the line rewrapped and the paragraph's last line fell into the clipped column off the page. The vendored Paged.js now hangs that hyphen in the margin in a zero-width box when it would rewrap the line (patch 2 in `patches/paged.polyfill.md`), and the measuring reads it as part of the word. The measuring still reports any text off the page (`overflowPages`) and the card names those pages; Joseph's book has none now.

**Held back until their phases.** Nothing now: images came in phase 2 and links in phase 3.

## Phase 2 progress

**Images (2026-10-31).** Each `img` is drawn where the browser drew it, by `object-fit` and `object-position`, and cut to its box when it overflows (the cover is `object-fit: cover`). An image is a `Figure` with the `alt` text as `Alt`; `alt=""` makes it a drawn artifact. The core gathers the image files with the fonts (`src/lib/pdf/image-files.ts`): JPEG and PNG go in as they are, anything else the browser shows goes through a canvas to PNG, and SVG is drawn at 300 dpi for the largest box it fills. Each file is embedded once however often it's drawn.

**Figures and captions.** A `figure` is a `Div` holding the image's `Figure` and the `Caption`. The caption stays outside the `Figure` because a screen reader reads a Figure's alt in place of its content. Joseph's book: the cover and 14 photographs, 15 `Figure` with alt and 14 `Caption`; the PDF is 5.3 MB.

**Tables.** `Table` with `Caption`, `THead`, `TBody` and `TFoot`; every `TH` has a scope (its `scope`, or a column header in `thead` or a row of headers, otherwise a row header), and spans are written as `RowSpan` and `ColSpan`. A table Paged.js splits is one `Table`, its body one `TBody` across the pages. Paged.js 0.4.3 doesn't repeat a table's header row on the next page, in the preview or Save as PDF, so there is no repeated row to mark as an artifact. Joseph's book has no tables; this was checked on a test page of 30 rows over two pages.

**Not yet.** Borders and backgrounds (phase 4), so a table's rules aren't drawn; inline `svg`, `video`, `canvas` and the like are listed on the card.

## Phase 3 progress

**Links (2026-10-31).** A link is a `Link` holding its text and an annotation per box (a line of its text, an image in it), each with `Contents` from the link's text. A URL (`http`, `https`, `mailto`, `tel`, `ftp`) is a URI action. A link inside the book is `#id` by the time it reaches the PDF, since the whole-book builder points links between chapters at ids in the one document; it goes to a named destination at the target's top-left, on the page where the target first appears. A link that goes nowhere the PDF can reach (a missing id, a file outside the book) stays plain text.

**PDFKit's page for the annotation.** PDFKit gives the annotation's object reference the page that is current when its `Link` is written, so the writer makes each page's part of a link its own `Link` and ends it on that page; a link Paged.js splits across a page break is two `Link` elements. The upstream fix is still worth offering.

**Joseph's book.** 124 link annotations: 112 from the contents page to 84 destinations, which land on the right pages, and 12 DOI links in the references. Every annotation has `Contents` and a `StructParent`, and every object reference names the annotation's own page. Bookmarks and page labels were already in place from phase 1, so the card lists nothing missing for this book now.

## Decisions this touches

`process/DECISIONS.md`: the 2026-09-15 entry ("PDF export stays single-pass … The app is for accessible EPUB") is replaced by 2026-10-31, "Accessible PDF is a goal of the app". Export stays single-pass: one pagination, read once.

## Decided

- Accessible PDF output is a goal of the app, beside accessible EPUB (2026-10-31).
- The core paginates and measures; the plugin writes the PDF and holds every heavy dependency (2026-10-30).
- Phase 0 runs on _John, Paul, and George_, in the localhost:5173 copy (2026-10-30).
- Save as PDF is the fallback when the plugin isn't available; when the plugin is on, it takes the place of Save as PDF, as a `view` plugin does (2026-10-30).

## Sources

- PDFKit accessibility docs: https://pdfkit.org/docs/accessibility.html
- PDFKit accessibility checklist: https://github.com/foliojs/pdfkit/blob/master/docs/accessibility.md
- krilla: https://github.com/LaurenzV/krilla
- Typst 0.14: https://typst.app/blog/2025/typst-0.14
- pdfmake tagging gap (canada-ca/aia-eia-js #609): https://github.com/canada-ca/aia-eia-js/issues/609
- Chrome tagged PDF: https://blog.chromium.org/2020/07/using-chrome-to-generate-more.html
- WCAG PDF2, bookmarks: https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF2.html
