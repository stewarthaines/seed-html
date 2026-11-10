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

## Screenshots

Each is a story in `src/stories/manual-shots/FirstBook.stories.svelte` with an entry in `scripts/manual-shots.json`; regenerate with `npm run manual-shots -- first-book` (Storybook running). The Download card shows the packaged file name, which carries the date, so it changes on every capture. The New book window, the chapter list, the Phone view and the Download card are shown at their on-screen size through a `width` attribute (half the PNG's pixel width); check it after a recapture.

## Findings from the walk-through (app, not manual)

- The New book button opened a window headed "New Project": now "New book".
- Chapter names: the chapter list shows the ID, which the author works with (family-history books key on it). The packaged contents use the first heading. The Edit chapter box's Title sets the XHTML `<title>`, which Apple Books shows for the chapter and can differ from the heading. All three stay as they are (decided 2026-11-10). The tutorial teaches the heading and leaves the box for the manual.
- The djot starter chapter explained djot syntax: now a heading and one line to replace.
- The cover colour changed the preview at once but was kept only after Update cover: the view now says when the picture is a preview, and Update cover is disabled when there is nothing to update.
- At 1280 px wide the preview's view switch cuts READ.html off to "RE" (seen in the editor screenshot): not fixed.
