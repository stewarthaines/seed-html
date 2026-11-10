# How-to Guides — Outline

Task guides for readers who have made a book (Your First Book) and now want one particular thing done. Each `##` section is one chapter, `Text/<slug>.dj`, its `#` heading matching the section title; sections with no chapter yet are planned and the docs site skips them. Begun 2026-11-10 against the app at localhost:5173 (Basic Mode).

Each guide is named for the reader's goal, not the feature. It opens with one sentence on when you would want it, then numbered steps, then only what the reader needs to know to finish. One way to do the task, the plainest; no tour of alternatives, no explanation of how it works (that belongs in a later "How SEED.html works" book). Djot, one line per paragraph; controls are `[Label]{.ui}`, form fields `*Field*`.

Groups (the docs site lists chapters flat, in this order): Start, Write, Describe, Check, Share.

## Start from a sample book

`start-from-a-sample-book` — Sample books…, choose a list, click a book; it opens as your own copy.

## Open an EPUB you already have

`open-an-epub` — Open an EPUB…; a SEED EPUB opens for editing, any other EPUB opens to read and check but not edit.

## Make a copy of a book

## Delete a book

## Write in your own editor

Link a folder (Chrome or Edge).

## Add a picture

`add-a-picture` — drag the file onto the editor, on its own line; describe it; the Images panel reuses a picture.

## Reorder, rename or delete chapters

## Change how your book looks

`change-how-your-book-looks` — page.css under Also in this chapter; one example rule; the preview follows.

## Use your own cover image

## Fill in the details a catalog shows

## Describe your book's accessibility

## Find accessibility problems

`find-accessibility-problems` — the check button above the preview opens the panel and runs the check (it runs only while open), the list, click the outlined part to find it in the text.

## Hear your book as a screen reader would

## Save as a PDF

`save-as-a-pdf` — Share, Generate PDF, Save as PDF, the print dialog's PDF destination.

## Share your book as one web page

READ.html.

## Package without the source

## Move a book to another browser or computer

## Screenshots owed

None yet. Candidates, each a story in `src/stories/manual-shots/` with an entry in `scripts/manual-shots.json`: the Sample books window; the Accessibility panel with one finding.

## Findings from the walk-through (app, not manual)

- Sample books… opened a window headed "Import from Catalog": now "Sample books".
- The Accessibility panel said "1 accessibility issues": now singular for one.
- The check runs only while its panel is open. Closed, the button shows the last result, or a tick (labelled "Nothing to fix") when no check has run, so a tick does not mean the chapter passed.
- Escape does not close the Sample books window unless focus is inside it (the handler is on the backdrop, and the window does not take focus when it opens).
- Clicking a finding in the Accessibility panel does not move to it in the text; clicking the outlined element in the preview does.
- An image dropped at the end of a paragraph joins the paragraph (no blank line is added), so it renders inline.
