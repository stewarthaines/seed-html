# LEGO step in a 3D canvas — proposal for page05

Page05 of the "Lottie Interaction 7" book shows the same LEGO step as page04 (a red 2×4 brick dropping onto a green 4×6 plate, with a step number and a parts callout), drawn by three.js in a WebGL canvas instead of a Lottie animation. Proposed 2026-10-24 as an exploration, not a product feature.

## What carries over from the WebGL test book

The build in `~/Projects/webgl-book-build` makes `three-bundle.js` (three 0.186.1, 885 KB) as one classic script exposing `window.THREE`. See `process/THREEJS_EPUB_PROTOTYPE.md` and `process/DJOT_3D_MODELS.md`.

What the WebGL book established in Apple Books: book files fetch with status 0 (three's FileLoader accepts that); canvases must be sized from CSS and re-measured on pageshow, because Books loads pages before layout; images reach scripts as blank placeholders, so anything textured ships as a non-image file. Pointer Events drawing works in fixed layout (the canvas support test), which is the layout this book uses.

SEED.html adds every manifest script to every chapter. Adding the three.js bundle to this book means the Lottie pages load it too; acceptable for an exploration, a cost to note for a real book.

## Data format: LDraw

LDraw is the community's open format for LEGO models, and three.js ships a loader for it (`LDrawLoader`, already in the installed three package). The model for this step is a few lines of text:

```
0 Step 1
1 2 0 0 0 1 0 0 0 1 0 0 0 1 3032.dat
0 STEP
1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat
0 STEP
```

Each `1` line places a part: colour code (2 green, 4 red), position, a 3×3 rotation, and the part file (3032 is the 4×6 plate, 3001 the 2×4 brick). Units are LDU (20 per stud, 8 per plate height, 24 per brick height), −Y is up, and a part's origin is the centre of its top face, so the brick sits at y = −24 on a plate whose top is y = 0. The plate may need a 90° rotation to match page04's orientation.

`0 STEP` marks building steps. LDrawLoader records them as `userData.buildingStep` on each part's group, so a script can show, hide or animate parts by step; later pages could be one model with many steps.

LDrawLoader draws the part edges as lines, including conditional lines (outlines that appear only where a curved surface turns away, such as the sides of studs). That is the drawn look of LEGO instructions, with no extra work.

Part geometry comes from the LDraw parts library, a free download licensed CC BY 2.0 / 4.0; the book must credit LDraw.org. Loading parts one file at a time is slow, so three.js provides a script, `packLDrawModel.mjs` (in the three.js repository, not the npm package), that bundles a model and every part it uses into one `.mpd` file. Size to be measured; two parts with their stud primitives should be small.

Authoring tools that read and write LDraw, for anything beyond hand-written lines: BrickLink Studio (free), LeoCAD (open source), and LPub3D (open source, lays out printed instructions from an LDraw model).

## Alternatives considered

**glTF (.glb).** The format the WebGL book already handles, and the photo-model scene would load it. It loses the step markers and the edge lines, and a LEGO model would first have to be converted from LDraw anyway. Better for scanned objects than for bricks.

**Procedural geometry.** Boxes and cylinders built in the page script, as `lego_step.py` does for page04. No library download and no licence notice, but it redoes what LDraw provides and stops at bricks simple enough to describe by hand.

## The page

- **Source:** `<div class="stage" data-src="../page05.mpd"></div>`. `data-src` lets the SEED.html preview resolve the file; the class is not `container`, so `animation.js` leaves the page alone.
- **Script:** a small `lego3d.js` finds `.stage[data-src]`, loads the model with LDrawLoader, and draws it with an orthographic camera at the isometric angle page04 uses, so the two pages can be compared side by side.
- **Interaction:** the same bottom-strip drag as the Lottie pages, mapped to the brick's drop (0 = above, 1 = seated). The thumb is an HTML element styled like the Lottie one. Turning the model is left out of the first version.
- **Step number and parts callout:** HTML over the canvas, so the text is real text. The callout's brick is a second small render of the same part.
- **Fallback:** without WebGL, the page shows a still image of the finished step with alt text.

## Work involved

1. Rebuild `three-bundle.js` with `LDrawLoader` and `LDrawConditionalLineMaterial` added to `entry.js` (one import each).
2. Download the LDraw library, write the five-line model, pack it to `page05.mpd`.
3. Write `lego3d.js` and the page CSS; check the render locally with headless Chrome before anything goes to the book.
4. The author imports the bundle, the `.mpd` and the script into the book and adds page05; the script goes over the bridge for review.
5. Test in the SEED.html preview and in Apple Books on the Mac, then iPad.

## Decisions (2026-10-24)

- Go ahead with the LDraw route. The first version replicates page04's behaviour and nothing more.
- No turning the model for now; the scrub only drops the brick.
- Edge-line weight is to be decided once the page can be seen (WebGL lines are always one pixel wide).
- The no-WebGL still image is left for later.

## Built (2026-10-24)

Files in `~/Projects/webgl-book-build`: `entry-lego.js` builds `dist/lego/three-lego.js` (565 KB: three.js core pieces, LDrawLoader, LDrawConditionalLineMaterial; separate from the WebGL book's bundle, which also carries ez-tree); `book-lego/lego3d.js` is the page script and `book-lego/lego.css` its styles (added to the book's `stylesheet.css` over the bridge); `ldraw-src/ldraw/models/page05.ldr` is the model, packed with three.js's `packLDrawModel.mjs` (r186, in `vendor/`) into `dist/lego/page05.mpd` (81 KB, most of it the LDraw colour table).

Checked in headless Chrome at three scrub positions, with the model handed over as a blob URL as the SEED.html preview does. Not yet seen in the preview or in Apple Books.

Before publishing anything built this way: credit LDraw.org (parts library, CC BY 4.0) and keep three.js's MIT notice (the bundle carries it at the end).
