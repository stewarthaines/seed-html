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
- `model`: names everything the block builds outside `built`, so other pages can place it as one part.
- `spin`: makes a turning page. `true` is a quarter turn; a number is degrees. A turning page has no moving parts, and no step number unless a step line on it gives one (`step 5`, the last step of a sheet, where the model is turned).
- `scale`: a fraction of the house scale, for a model too big for the page (`0.5`).
- `style`: the page's look. `classic` is a 1970s instruction sheet: off-white paper and a square, pale yellow parts panel. Without it, the page is pale blue with a rounded panel.
- `alt`: what a reader hears in place of the drawing. Without it the description is composed from the part names, in English.

Spellings are exact: `colour` is not accepted (it gets a note), and nothing else is a key.

## Part lines

`<part> [<colour>] <x> <y> <z> [turn <degrees>] [from <x> <y> <z>]`

- The part is a part number from the installed libraries (`3005`, `3665a`) or a model name (`letter-o`, `spaceman`). Part numbers are often all digits, so the first word is always the part.
- The colour is an LDraw colour name, as LDraw's colour table spells it, with underscores for spaces: `Light_Bluish_Grey`, not `light bluish grey`. Case does not matter. Colour numbers are not accepted, since a number there would be read as a position.
- `turn` and `from` may come in either order, each once.
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

## Where problems show

Malformed lines, unknown parts and colours, and duplicate models are listed in a red box on the page itself, in the preview and in the book, with line numbers counted from the line after the opening fence. A page with notes is still drawn, without its broken lines, but gets no still image. Fix every note before publishing.

## The still image

Each page also carries a picture of itself, drawn while it renders: the step finished, with its number and parts callout, as a reader first sees it. A reading system that cannot draw the live page (an iPad or iPhone before iOS 15) shows the picture instead; one that can replaces it as soon as the model has drawn. Drawing a page takes about two thirds of a second, and all of a chapter's pages must draw within the preview's three seconds, so keep to a few pages per chapter.
