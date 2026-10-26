# A word block for Bricks — proposal

Drafted 2026-10-26, at the user's request ("a new block type which can be a shorthand for converting a string like 'Josh' to a page"). Nothing here is decided. The open questions are listed in the order they constrain each other, to be taken one at a time.

## What it replaces

The name page of "Josh in Bricks" is 45 part lines: three 4 × 6 base plates, two 2 × 8 plates joining them underneath, and the bricks of each letter, placed by hand along the plates. "Picklets 2.0" has the same page for Josh and Margie, and the alphabet display pages repeat the pattern five times. Every name page is the same layout worked out again: a letter shape for each character, spaced along a run of base plates, the whole scaled to fit the page, turning. The shorthand writes the word and lets the transform do the layout:

````
``` bricks-word
Josh
```
````

## The sketch

The transform expands a word block into a `bricks` block's text (header and part lines) and then treats it exactly as a `bricks` block: the same parser, notes, libraries, still and runtime. The expansion is the whole feature; nothing downstream knows a word block existed. That keeps the new code to one function from a word to text, testable without a DOM, and it gives authors an escape hatch: a generator ("Expand to a bricks block") can insert the expanded text for hand editing when a page needs something the shorthand cannot say.

The expansion, for each character in turn: its letter shape as part lines, offset along the run by the widths of the letters before it plus a gap; then base plates under the run (one 4 × 6 plate per letter's width of run, turned as on the name pages, with 2 × 8 plates bridging the joins underneath); then a header with `spin: true`, a `scale` that fits the run on the page (the name pages use 0.5 for four letters, the alphabet pages 0.37 for five), and an `alt` of the word as written ("The name Josh, in bricks." or the author's own).

## Decided elsewhere, which this keeps

Pages are fenced code blocks found by one selector in every text format (`process/BRICKS_BLOCK_NOTATION.md`, 2026-10-26). Keywords are plain English instructions, chosen by the tests in that record. A step's colour is its model's, and a `model` line may carry its own colour. One library per family of parts, layered (`process/BRICK_STEPS_EXTENSION.md`, "Layered libraries").

## Open questions, in order

**1. A block of its own, or a header key on `bricks`.** A separate language (`bricks-word`, or a shorter word) keeps the source to the word itself, which is what an author scanning the chapter wants to read, and its selector sits beside `bricks` in the same transform. A key on the existing block (`word: Josh` in the header, no part lines) needs no new selector and can mix with part lines (a spaceman standing beside the name), but a header key that replaces the body is a second meaning for the same block. Recommendation: a block of its own, since the body is the content; mixing goes through the expand-to-`bricks` escape hatch.

**2. Where the letter shapes come from.** (a) The book's own models, `letter-a` … `letter-z` and the capitals, from the alphabet pages' records: no new data, and an author's redesigned letter is used everywhere, but a word block then depends on other chapters having rendered, and works only in a book that has built an alphabet. (b) A font shipped with the extension: the letter records from "Picklets 2.0" (complete for lowercase, capitals in progress) as a table in a transform-time script, so expansion needs nothing from the book and writes plain part lines. (c) The same font as a parts extension, "Bricks - Letters", with each letter an LDraw submodel in `Misc/bricks/letters.mpd`: consistent with the layered libraries, but the letters are then LDraw models in LDraw units, converted from the author-unit records, and the expansion writes one line per letter. Recommendation: (b) as the default, with (a) layered over it, so a book's own `letter-j` replaces the shipped one; (c) only if letters should also be placeable by hand as single parts in ordinary `bricks` blocks.

**3. Capitals and lower case.** The word is drawn as written: `Josh` takes a capital J. Until the capitals exist, a missing letter is a note ("No shape for the capital J yet") and the page draws the rest, or the lower case stands in. Recommendation: the note; a silent stand-in is fallback behaviour.

**4. Characters that are not letters.** A space leaves a gap of one plate's width (a two-word name sits on one run with a gap). Digits and punctuation get a note until shapes exist for them. Accents: a note, or the base letter with a note. Recommendation: space as a gap, everything else a note.

**5. Colour.** Every letter in one colour from the header (`color: Yellow`, the name pages' look), or each letter in its own classic colour from the font (the alphabet pages' look), or a list. Recommendation: the font's colour per letter by default, since that is the alphabet pages' identity, and `color:` to make them all one; base plates Green with Light_Bluish_Grey joiners, as on every page so far, until someone needs otherwise.

**6. Turning or building.** A word block is a turning page by default. A building version, one letter per step dropping onto the plates, is one header key away (`build: true`, or `steps`), and is the obvious next page in a name book. Recommendation: turning only at first; the escape hatch covers a built-up name.

**7. Fitting and wrapping.** Scale to fit the page's width (ctx.viewport, with the runtime's 320 × 460 proportions), with a floor below which letters are too small to read, at which point a note suggests a shorter word or a second block. Wrapping onto a second run of plates is possible but changes the model's shape and the turning; recommendation: no wrapping.

**8. The name.** `bricks-word` says what it is and sorts beside `bricks`. Alternatives: `bricks-name` (the use so far, but not every word is a name), `bricks-text` (a long text is not the intent), `word` alone (too generic for a fenced-block language shared across extensions). Recommendation: `bricks-word`, decided last, once the behaviour is settled.

## Costs

A font table to maintain beside the alphabet pages: until (2) is decided, the records in "Picklets 2.0" are the only source, and a letter redesigned there must be copied into the table. Expansion adds part lines, not drawing time beyond what the same page written by hand would take: the name page drew in about 0.7 s. A sample for the Bricks Sample generator (or a second generator) and a section in `SYNTAX.md` and the manual page.
