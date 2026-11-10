Extra instructions for writing documentation intended for a general audience of the app's users.

- consistent tone across samples/manuals
- plain language
- concise prose, written with translation in mind
- don't oversell
- using djot format (not markdown) unless otherwise stated
- screenshots are generated with `npm run manual-shots` from @scripts/manual-shots.json
- destination format is EPUB, produced by using the SEED.html app
- the public face of the SEED.html is https://readitinabook.com
- the public project source repository is https://github.com/stewarthaines/seed-html

## Naming and accuracy

- call the app **SEED.html** (or **Simple EPUB Editor** in full); never bare "SEED". The pre-2026 product name must not appear anywhere — `npm run validate` enforces this
- quote UI labels exactly as the app renders them; the canonical English strings are the msgids in `locales/en.po`. A label that's wrong by one word breaks the reader's ability to find the control and breaks alignment when the docs are translated
- for Chromium-only features (folder linking, USB e-reader devices) say "Chrome or Edge" plainly — a stated limit, not an apology
- after writing about a control, check it against the live UI, not memory

## Voice

- no hand-holding: don't narrate confirm dialogs or outcomes the reader will see for themselves
- the source syntax (Markdown, Djot, Textile, …) is the author's choice per project; the minimal built-in converter is a demo — don't frame it as a limitation
- keep sentences complete and idiom-free; translators (and translation) work sentence by sentence

## Format and mechanics

- one line per paragraph — never hard-wrap prose (reviews happen in Obsidian; diffs stay one-change-per-paragraph)
- each book project is itself a SEED project: `outline.md` is its plan of record (each `##` section becomes a `Text/<slug>.dj` or `Text/<slug>.md` file, the slug being the chapter's docs-site URL, its `#` heading matching the section title); update the outline when you add or move a section
- the docs site (`npm run dev:docs`) builds every book registered in `BOOKS` in `docs/site/lib/books.js`, rendering `.dj` with the app's djot transform and `.md` with its markdown-it transform; register a new book there
- new books are djot (`.dj`). The user manual and advanced reference are markdown with inline attributes and are likely to be retired; match their format when editing them. sample-novel is plain `.txt`
- UI references use inline attributes: in djot `[Projects]{.ui .icon-house}`, in markdown `_Projects_{.ui .icon-house}`. Icon SVGs live in the book's `Images/` (fill `#6b7280`, viewBox `0 0 256 256`, `role="img"` + `aria-label`), copied from the app's Phosphor subset in `src/lib/icons/generated/` — add the SVG when you document a new control. Watch the map: Projects is `House`, not a folder
- figures: `![real alt text](../Images/name){.figure}`, plus `.screenshot` for app captures; every image gets meaningful alt text, no exceptions
- shots are captured at 2×. A shot of one control or panel (a dialog, a card, a sidebar) is shown at its on-screen size: give it `width=` its CSS width, which is half the PNG's pixel width (`{.figure .screenshot width=544}`), and update it when a recapture changes the PNG's size. Wide shots of the app fill the column and need no width
- screenshots are reproducible-only: each one is a Storybook story in `src/stories/manual-shots/` plus an entry in `scripts/manual-shots.json` — never a hand capture. Capturing needs Storybook running; ask the user, who usually has it up

## Reading context

- the manuals are read *inside the app* as SEED EPUBs, on anything from a phone to e-ink: keep pages reflowable, assume no viewport, and prefer cropped shots and diagrams over full-app screenshots
- the docs double as an advertisement for the output: the book must pass the app's own accessibility check (heading order, alt text) and read well in every preview device preset