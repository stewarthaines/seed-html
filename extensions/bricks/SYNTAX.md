# Bricks blocks: the notation, and where your priors are wrong

Notes on the ` ```bricks ` fenced block as this extension draws it (transformBricks.js, parseBricks.js and the bricks3d.js runtime). The design record, with the reasons behind every keyword, is `process/BRICKS_BLOCK_NOTATION.md` in the SEED.html repository. The positions are not LDraw's: if you know LDraw, LeoCAD or Studio, read "Positions" before anything else.

## The block

````
``` bricks
---
model: letter-o
color: Yellow
---
built
3032 Green 0 -8 -1 turn 90

step   # the rounded bottom corners
3665a 0 -5 0
3665a 0 -7 0 turn 180

step   # the sides
3005 0 -4 3
3005 0 -7 3
```
````

One block is one page: a building step the reader drags together part by part, or a finished model the reader turns. It needs a fixed-layout book; in a reflowable book the block becomes a note. Every text format writes the fence the same way (Djot, Markdown, AsciiDoc, Org); in Textile it is `bc(bricks).`.

## The header

An optional YAML block between `---` lines, before any part line. Keys:

- `color`: the main colour. Parts without a colour of their own take it, and stay colourless in the model's record, so a page that places the model can repaint them.
- `from`: where a step's parts start, as `[x, y, z]`, an offset from where each lands. Without it they drop from 9 plates above (`[0, 0, 9]`); `[0, 0, -9]` raises every part from below.
- `count`: what the page adds to the book's parts list (below): `steps`, its moving parts (the default); `all`, every part, for a page whose base or `built` parts appear nowhere else; `none`, nothing.
- `inventory`: `library` or `book` makes a parts page (below) instead of a step.
- `model`: names everything the block builds outside `built`, so other pages can place it as one part.
- `open`: `end`, or a step number, opens the page with that step finished and the handle beside it, instead of at the start: a working aid while you build a page, since it opens there again after each edit. Remove it before publishing; left in, the page opens at that step. A turning page has no steps to open at.
- `spin`: makes a turning page. `true` is a quarter turn; a number is degrees. A turning page has no moving parts, and no step number unless a step line on it gives one (`step 5`, the last step of a sheet, where the model is turned).
- `scale`: a fraction of the house scale, for a model too big for the page (`0.5`).
- `style`: the page's look. Without it, the page is pale blue with a rounded panel, and the parts catch a soft studio light, their edges drawn in a darker shade of their own colour; the parts panel keeps black outlines, which show a small part's shape better. `classic` is a 1970s instruction sheet: off-white paper, a square, pale yellow parts panel, and parts in plain light with black outlines.
- `alt`: what a reader hears in place of the drawing. Without it the description is composed from the part names, in English.
- `pictures`: a sentence for readers whose reading system shows the pages as still pictures, such as `Pictures only here. In a reader that supports it, such as Apple Books, Lisa or Cantook, this page is interactive.` Give it on one page, in the book's language: every Bricks page in the book then carries it, at the foot of the picture, and it shows only where the page cannot be built or turned. The first page in reading order that has it is used; another page's copy gets a note. Pages pick up a change the next time they render. Without it, nothing tells those readers. A page whose chapter frontmatter leaves `bricks3d.js` out of its `scripts:` list is a still picture by design and has no line.

Spellings are exact: `colour` is not accepted (it gets a note), and nothing else is a key.

## Part lines

`<part> [<colour>] <x> <y> <z> [turn <degrees>] [from <x> <y> <z>] [times <n> <x> <y> <z>]…`

- The part is a part number from the installed libraries (`3005`, `3665a`) or a model name (`letter-o`, `spaceman`). Part numbers are often all digits, so the first word is always the part.
- The colour is an LDraw colour name, as LDraw's colour table spells it, with underscores for spaces: `Light_Bluish_Grey`, not `light bluish grey`. Case does not matter. Colour numbers are not accepted, since a number there would be read as a position.
- `turn` and `from` may come in either order, each once.
- `times <n> <x> <y> <z>` makes n copies of the part, each that far on from the one before. A second `times` repeats everything the first made, so a floor of 4 × 6 plates five across and five deep is one line: `3032 Green 0 -1 -1 turn 90 times 5 4 0 0 times 5 0 6 0`. The copies are parts in their own right, row by row: in a step they drop one after another, a model records each, and the parts list counts each. At most 1000 copies a line.
- `#` starts a comment, to the end of the line.

## Positions

- Units are studs across and plates up. A brick is 3 plates high, a plate 1.
- x runs to the lower right of the page, y to the lower left, z up.
- A position is the corner of the part's footprint nearest the origin, at the part's base, after any turn. Turning a 1 × 2 brick by 90 does not move that corner.
- `turn` is a yaw: degrees about the vertical, counter-clockwise seen from above. Only multiples of 90 line up with the studs. Nothing turns about any other axis.
- `from` is relative to where the part lands, not a point in space: `from 0 0 9` means 9 plates above its own position.
- The finished model is centred on the page at a fixed scale, so a part is the same size on every page of a book. Use `scale` when a model does not fit.

## Sections

- `built`: parts already in place when the page opens. They never move and are not part of the block's model.
- `step [<n>] [from <x> <y> <z>]`: the next step's parts, placed in source order as the reader drags. A number sets the step's number; a bare `step` counts on from the one before, from 1. A step's `from` applies to its parts that do not give their own (`step from 0 0 -9`: parts rising from below). A step cannot set a colour.
- `model <name> [<colour>]`: the following parts make a model of that name, with that colour as its main colour (else the header's). This is how a turning page defines several models at once, each in its own colour.
- Parts before any section line belong to a first step.
- `built`, `step` and `model` cannot name a model.

A part in a step that gets no `from` anywhere (its own, its step's or the header's) drops from 9 plates above. Parts under `built` never move, and nothing on a turning page does. `from 0 0 0` keeps a single part in place.

## Models across pages

A model is recorded when its page renders, in `SOURCE/data/bricks/<chapter>.json`, and any page can then place it by name. A page sees a model as it was when its defining page last rendered: after editing a model, open its page once before opening the pages that use it. Packaging does not render, so the same applies before you package. A name defined on two pages gets a note; the first in spine order is used.

## Parts libraries

Every `.mpd` file in the book under `Misc/bricks/` is a parts library. Bricks installs `core.mpd`: the colour table and common bricks, plates, slopes and tiles (Brick 1 × 1, 1 × 2, 1 × 3, 1 × 4, 2 × 2, 2 × 4; Plate 1 × 1, 1 × 2, 1 × 3, 2 × 2, 2 × 4, 2 × 8, 4 × 4, 4 × 6; Tile 1 × 1, 1 × 2, 1 × 3, 2 × 2; Slope 45 2 × 1, 2 × 2, and their inverted forms). Parts extensions add a set each: Bricks - Minifigs adds `minifigs.mpd`, with the standing and seated spacemen (`spaceman`, `spaceman-seated`, which take the colour of the line that places them) and their parts. A book can add its own set, packed with `scripts/pack-bricks-library.mjs` from the SEED.html repository; it is found the same way. A page loads only the sets its parts come from.

## Parts pages

````
``` bricks
---
inventory: book
---
```
````

A parts page draws a list of parts as a grid of cells, each part drawn alone, about 20 to a page (4 × 5, at any page size). It has no part lines; its header takes only `color`, `style` and `alt`.

- `inventory: book` is the book's parts list: every brick a reader needs to build everything in the book once, each part in its colour with how many beneath, sorted by colour. Each page adds what its `count` says: its moving parts by default. A model the book builds is counted on the page that builds it, not where it is placed; a model from a parts set (a minifig) counts as one. A page's count is as of its last render, as models are: open the pages you have changed before the parts list, and before packaging.
- `inventory: library` is every part the book's parts libraries offer, each with its part number beneath, in one colour (`color`, else light bluish grey): a contact sheet to keep beside you while you write. Each library's parts come in manifest order, sorted by name, without LDraw's `~` files (moved and alias parts). Keep it out of the reading order, or delete it before publishing.

When a list runs past one page, put the same block on more pages: the list is dealt out across them in reading order, counted from each chapter's source, so the pages need not have rendered. The last notes how many parts are left over; a spare one notes that nothing is left.

The Bricks Parts generator lists the library's parts as text, for copying exact part numbers: `#` comment lines, set by set, to insert inside a block and delete when the page is done. It can add the colour names too.

## Where problems show

Malformed lines, unknown parts and colours, and duplicate models are listed in a red box on the page itself, in the preview and in the book, with line numbers counted from the line after the opening fence. A page with notes is still drawn, without its broken lines, but gets no still image. Fix every note before publishing.

## The still image

Each page also carries a picture of itself, drawn while it renders: the step finished, with its number and parts callout, as a reader first sees it. A reading system that cannot draw the live page (an iPad or iPhone before iOS 15) shows the picture instead; one that can replaces it as soon as the model has drawn. Drawing a page takes about two thirds of a second, and all of a chapter's pages must draw within the preview's three seconds, so keep to a few pages per chapter.
