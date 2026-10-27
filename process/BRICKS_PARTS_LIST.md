# Bricks parts lists (design, for review)

Drafted 2026-10-27; the parts library page and the generator are built (below), the book's list is not. Two lists of parts drawn as pages of a fixed-layout book, from one drawing machine with two sources: the book's parts list, every brick a reader would need, for the end of the book; and the parts library, every part the book's loaded `.mpd` sets offer, as an aid while writing. A comment-listing generator complements the second. Builds on `process/BRICKS_BLOCK_NOTATION.md` and the Bricks extension (`extensions/bricks/`).

## Decided: the book's list is every brick you'd need (2026-10-27)

The list is the bill of materials for building everything in the book once, not every part that appears on some page. A page that shows the same bricks again (a turning page placing models built elsewhere, `built` parts repeating earlier steps) would otherwise count them twice. Declined: every part on any page, which double-counts in every book written so far.

## Decided: the key names (2026-10-27)

`inventory: book` and `inventory: library` name a list page; `count: steps | all | none` says what a page adds to the book's list. Both read as the author's words for what the page is and does.

## Decided: no part numbers on the book's list, for now (2026-10-27)

The book's list shows each part and its count only. A number under each count would let a reader buy the bricks (LDraw numbers mostly match BrickLink's), but crowds a cell that is already small at 320 × 460; it can come back with the export below. The library page keeps the numbers, since finding them is its job.

## The page

A ` ```bricks ` block whose header names a list, on a page of its own: `inventory: book` for the book's list, `inventory: library` for the parts library. It has no part lines; anything else in the block gets a note.

The page is a grid of cells in the style of the inventory page at the back of a LEGO booklet: on the book's list each cell is the part drawn in its colour, isometric, with its count (`12x`); on the library page, the part with its number in small type beneath and no count. Sorted by colour, then part. The runtime already draws one part in a small scene for each step's parts callout; an inventory page is that callout many times over, with the still image and a composed description for a reader who cannot see it ("12 White Tile 1 × 1 Corner Round, …").

Splitting: the author places the same block on as many pages as the list needs, and the transform deals the list out across them in reading order. It knows the page size, so it knows how many cells fit at a readable size (about 4 × 5 at 320 × 460). Too few pages: the last gets a note ("12 more parts: add another parts page"). Too many: a spare page gets a note that nothing is left. The author never works out slices. About 20 small scenes a page is well inside the three seconds a page has to draw.

## What the book's list counts

Each chapter's render already writes `SOURCE/data/bricks/<chapter>.json` with the models it defines; it would also record the parts the chapter counts, by part and colour. The list page adds the records up in reading order. Like models, a chapter's counts are as of its last render: open the edited pages before the list page, and before packaging.

By default a page counts the parts that move in its steps. A model placed in a step counts as one item when it comes from a parts set (the spaceman, drawn whole like a minifigure in a LEGO inventory) and not at all when another page of the book builds it (it is counted where it is built).

A header key changes what a page counts, `count:`

- `steps` (the default): the parts that move.
- `all`: the parts that move and the `built` ones, still leaving out models built elsewhere in the book. For a page whose base is real, such as a turning title page whose floor appears nowhere else.
- `none`: nothing. For a page that only shows bricks counted elsewhere.

"hello, world! in Bricks" under this: the letter pages count their tiles and bricks and not their display floors; the title page takes `count: all`, which adds its floor plates and comma and not the letters it places.

## The parts library while writing

`inventory: library` draws every part in the book's loaded sets (the core set, parts extensions, the book's own) with its number beneath and no count, split the same way. An authoring aid like the `open` key: a chapter at the end of the book, out of the reading order or deleted before publishing.

A generator lists the same parts as text, for copying exact numbers: `#` comments inserted at the caret inside a bricks block, which mean the same in every source format and are ignored by the renderer. Generators can read the book's files through their context, so it reads every `.mpd` under `Misc/bricks/`. Its one option adds the colour names (a long list, so off by default); each set is a heading line, so there is no option for which set.

````
``` bricks
# core.mpd
# 3005   Brick 1 x 1
# 3665a  Slope Brick 45 2 x 1 Inverted without Inner Stopper Ring
# hello-tiles.mpd
# 25269  Tile 1 x 1 Corner Round
````

## Built: the library page and the generator (2026-10-27)

On the `bricks-parts-list` branch. The parser takes `inventory: library` (only; `book` gets a note until it is built) and notes what a parts page cannot have: part lines, `spin`, `model`, `from`, `open`, `scale`. The transform lists each library's parts in manifest order, sorted by name then number, without `~` files, and deals them out in pages of `columns × rows` (`bricksInventoryGrid`: 4 × 5 at 320 × 460, cells at least 72 × 84 px scaled with the page). It counts the other chapters' parts pages from their sources (`SOURCE/text/<idref>.txt`, an `inventory: library` header line each), so they need not have rendered. The runtime lays the cells out from `data-columns` and `data-rows`, draws each part alone in the page's colour (`color:`, else Light_Bluish_Grey), no larger than a step's parts callout draws it, with its number beneath, and composes the still the same way. The library page sorts by set and name, not by colour as planned for the book's list: on the library page every part is the same colour. The generator is `bricks-parts.js` (Bricks Parts).

## Open questions

- Later: the book's list exported as a BrickLink or Rebrickable parts list, so a reader can order the bricks; LDraw part numbers mostly match BrickLink's (`process/REBRICKABLE_AUDIENCE.md`).
