# Your First Book — Outline

A tutorial, separate from the User Manual and the Advanced Reference: one path from nothing to a packaged EPUB open in a reading app, with no alternatives and no explanations of why. Alternatives belong in the how-to topics of the reworked manual; explanations in "How SEED.html works". Drafted 2026-11-10 against the app at localhost:5173 (the Books / Write / Book / Share layout).

Each `##` section is one chapter, `Text/<slug>.dj`, its `#` heading matching the section title. Djot, one line per paragraph; controls are `[Label]{.ui}`, form fields `*Field*`. The docs site (`npm run dev:docs`) renders `.dj` with the app's djot transform; the book is registered in `docs/site/lib/books.js`. Each chapter is one step, short enough to read on a phone beside the app.

The reader makes a two-chapter book of their own. The example title (The Lighthouse Keeper) is only a suggestion; nothing later depends on it.

## Your first book

`your-first-book` — what you will make, how long it takes, what you need (a browser, nothing to install).

## Start a new book

`start-a-new-book` — New book, Title, Author, keep the generated cover, Create. The book opens with one chapter of sample text.

## Write the first chapter

`write-the-first-chapter` — replace the sample text; the first heading names the chapter in the contents; blank lines between paragraphs; italic and bold; the preview follows as you type; no Save button.

## Add a second chapter

`add-a-second-chapter` — Append Item, write a heading and a paragraph; the list order is the reading order.

## See it on a phone

`see-it-on-a-phone` — Phone and E-reader views, Previous chapter / Next chapter, Reader for themes and text size.

## Describe your book

`describe-your-book` — the Book tab: Details (a description), Cover (the generated cover). Kept to what a catalog shows beside the book.

## Package and read it

`package-and-read-it` — Package EPUB, the Share tab, Read (in the browser) and Download (for a reading app); package again after changes; where to go next.

## Screenshots owed

Each needs a Storybook story in `src/stories/manual-shots/` and an entry in `scripts/manual-shots.json`, cropped, not full-app:

- the Books screen's Start row (New book)
- the New Project window filled in
- the editor and preview side by side, the first chapter rewritten
- the Chapters list with two chapters and the Append Item button
- the preview in the Phone view
- the Share tab's "Download the EPUB" card after packaging

## Findings from the walk-through (app, not manual)

- The New book button opens a window headed "New Project".
- The Edit chapter box's Title is saved but shown nowhere a new author looks: the Chapters list and the Contents view show the ID (`chapter01`), and the packaged contents use the chapter's first heading, falling back to the ID. The tutorial teaches the heading and skips the box.
- The starter chapter's text explains djot and links to its syntax page; for a reader of this tutorial it is text to delete.
- The cover hue slider changes the preview at once but is kept only after Update cover; the Cover summary in the sidebar keeps the old hue until then.
