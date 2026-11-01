# Matching the print edition's pages

Status: evaluation, 2026-11-01. Nothing built in the app; experiments ran in Playwright's Chrome and Firefox on a captured copy of _John, Paul, and George_.

## The question

Joseph Jordania's book has a print edition made in InDesign: 218 pages at 143 × 205 mm, untagged, the edition of record and the origin of the book's 213 print page markers (`process/PRINT_PAGE_MARKERS.md`). The EPUB's page-list comes from those markers. The accessible PDF the app writes (`process/ACCESSIBLE_PDF_PDFKIT.md`) has its own pages: 225 in Chrome, 221 in Firefox, so its page 93 is not print page 93. Could the app make, from the single source, an accessible PDF whose pages are the print edition's pages?

## Why the pages drift now

InDesign's text block is 28 lines at 16.5 pt leading, the same leading and measure as ours. It sets more words to a line (its paragraph composer and spacing ranges, its own hyphenation), so a print page's text takes us about 29 to 31 lines. In the natural flow our pages fall behind the print pages steadily: by print page 200 Chrome is 7 pages behind, Firefox about 4. The two browsers differ from each other too: Firefox ignores `orphans` and `widows`, and each browser hyphenates with its own dictionary.

## The experiment

Before Paged.js lays the book out, every print page marker starts a new page. A marker inside a paragraph splits it: the first part keeps the paragraph, the rest becomes a copy of it with no first-line indent, starting the new page; the first part's last line is justified (`text-align-last: justify`). A marker at the start of a block puts the break before the block. A marker with only its chapter's title and headings before it adds no break, since the chapter already starts a page (without this rule each chapter title was left alone on a page). Paged.js reads `break-before` from stylesheet rules, not inline styles, so the break is a class with a rule.

Results, print pages that don't fit on one page (each one moves every later page on by one):

- Book margins (21 mm top, 17 mm bottom, 16.5 pt): 101 of 213 run over.
- 16.5 mm top (29 lines): 44.
- 14 mm top, 12 mm bottom (30 lines): 10.
- 14 mm top, 12 mm bottom, 16 pt leading (31 lines): 7, and the book is 224 pages; our page n + 1 is print page n everywhere else (the cover is our page 1).

At every setting Chrome and Firefox gave the same pages, breaks and overruns included: each page restarts at the same point in the text, so the browsers' differences can't accumulate.

The 7 that run over at the last setting: the contents runs a page longer than print's (print pages 3 to 6 carry no markers), print page 38 (one line), three photo pages (202, 206, 211, where image sizes differ from print), and two reference pages (214, 215).

## What an app feature would need

- A print setting, off by default: paginate at the print page markers. The print build applies the breaks and splits above; a book without markers keeps today's flow.
- Page numbers from the markers: the footer shows the print page number, and the accessible PDF's page labels carry it, so the PDF cites like the print book and the EPUB's page-list.
- One paragraph in the tags: the two halves of a split paragraph are one `P`, as Paged.js's own splits are (the core joins them by `data-ref`; the split copy needs to say whose half it is).
- The card names the print pages that run over, as it names text off the page now.
- The book's print CSS sets the page geometry to fit; the feature doesn't change type on its own.

## Costs

- The page is the print page's text, not InDesign's page: lines break differently, and the type needs room for one to three more lines than InDesign uses.
- Mid-paragraph splits: the line before the split ends where the print page ended, not where a line would; justified, it may stretch, and left short it reads like a paragraph end. Needs looking at on real pages.
- Ragged page bottoms: each page ends with its print page's text.
- `orphans`, `widows` and the browser's own page-break choices no longer apply where markers decide.

## Towards InDesign's layout (2026-11-01, later)

InDesign set the book in Times New Roman (the same widths as Liberation Serif) at 12 pt on 16.5 pt, 28 lines, no letter spacing or glyph scaling. What packs its lines is word spacing: measured against the font's widths, its justified lines squeeze word spaces to about 83% of normal where that fits another word, and widen others. A browser only widens. A negative `word-spacing` gives the browser the same room, and justification still widens what's left.

Soft hyphens from TeX's patterns (the `hyphen` package, `hyphens: manual`) helped little on their own: at InDesign's 28 lines, overruns went from 104 to 102.

Results with soft hyphens, justified references and captions (as print sets them; the book's print CSS has references ragged), and the page break moved before a figure whose caption opens the print page:

- 28 lines, spaces at 83%: 66 of 213 run over; at 75%: 39; at 67%: 22.
- 29 lines (16.5 mm top, 19.5 mm bottom), spaces at 83%: 11 in Chrome, 13 in Firefox.
- 29 lines, spaces at 75% (`word-spacing: -0.75pt`): 3, in both browsers, and both give 220 pages (print: 218 and the cover). The three: print page 100 (its last word, "sity.", alone on a page), 210 (three lines) and 211 (a photo page).

Rendered beside InDesign's pages (Chrome, the last setting): print page 48 carries the same text, ends on the same words and breaks most lines in the same places; the spacing doesn't look cramped. The split line justified to full width matches InDesign, which justifies the last line of a page that continues; left short it reads as a paragraph end, so justified it is. Page 202: the same text; print crops the photograph's white border and sets it a little larger. Page 214: the same references; one line is badly stretched where InDesign hyphenates "Differenc-es" before a URL.

Still to do for a faithful page: the footer (verso: folio outside and the chapter label; recto: the essay title and folio, in Arial Narrow), which needs running heads with `string()` in the accessible PDF; image sizes and crops from the print PDF for the photo pages; and the three remaining overruns, which may yield to a per-page nudge (a slightly tighter space on one paragraph) rather than a global setting. The experiment's renders lost the page number when its `@page` rule was injected; not investigated.

## Where this leaves the feature

Feasible, and the experiment says how: break at the markers, give the type InDesign's word-space range and one spare line, hyphenate with one dictionary. Chrome and Firefox then make the same pages, and those pages are the print pages. The settings belong to the book's print CSS; the app's part is the marker breaks and splits, the print page numbers in the footer and page labels, joining split paragraphs in the tags, and naming any print page that runs over.
