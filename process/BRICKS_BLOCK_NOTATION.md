# Bricks block notation — proposal

Drafted 2026-10-26. A building step is written as a fenced code block, `` ```bricks ``, in the style of the catalog's abc2svg, abcjs and mermaid extensions, instead of the Djot `::: lego` div of `:part:` spans prototyped in "Picklets 2.0" (`process/DJOT_LEGO_SYNTAX.md`). This supersedes the step container in `process/BRICK_STEPS_EXTENSION.md`; the rest of that plan (packaging, the runtime's page-size assumptions, the parts library, verification in Books) stands. Only the container is decided; the notation below is a proposal to discuss.

## Decided: a fenced block (2026-10-26)

Every text format the app supports emits a fenced block as `<pre><code class="language-bricks">` (Djot, markdown-it, AsciiDoc, Org) or `<pre class="bricks">` (Textile), so one selector, `pre.bricks, pre:has(code.language-bricks)`, finds the steps in any book, as `transformABC.js` finds its scores. The Djot route needed a symbol carrier in each format's extension and fenced divs, which Markdown lacks. The block's text never passes through the text converter, so positions and decimals need no quoting and the Djot comment-brace pitfall goes away. The transform receives one string per step, so the parser is a plain function of text: unit-testable without a DOM, able to report errors by line, and reusable in the runtime or a command-line tool. Without the extension a reader sees the source as a code block, which still says what the step is. Costs accepted: the pages in "Picklets 2.0" and "Josh in Bricks" and the generators that write them (`make_letters.py`, `make_alphabet.py`) must be converted, and a step's settings move inside the block, since a Djot code block takes a language but no attributes.

Carried over unchanged from `process/DJOT_LEGO_SYNTAX.md`: positions in author units (studs across, plates up) measured from the part's corner after any turn; `from` as an offset from the final position; source order as build order; the fixed house scale centred on the finished assembly; the house view; steps staying where the thumb leaves them; models defined by a build page and placed as one part; colour 16 inheritance from the line that places a model.

## The shape: a header and a list of parts

Following ABC, which is itself a line notation under `key: value` header fields: an optional YAML header between `---` lines for the step's settings, where YAML's numbers, lists and keys help; then one part per line, which keeps YAML's indentation out of the part list, where a misplaced space would silently move a part into another step. The `josh_o` build page:

````
``` bricks
---
model: letter-o
color: Yellow
from: [0, 0, 9]
---
built
3032 Green 0 -8 -1 turn 90

step   # the rounded bottom corners
3665a 0 -5 0
3665a 0 -7 0 turn 180

step   # the sides
3005 0 -4 3
3005 0 -7 3

step   # the rounded top corners
3040b 0 -5 6
3040b 0 -7 6 turn 180
```
````

Against the Djot page it replaces, each part line loses `is=`, `color=Yellow`, `at="…"` and `from="0 0 9"`, and the step boundaries are lines of their own rather than a `step=2` on whichever part starts the step.

## Header keys

`spin`: `true` for the default quarter turn, or a number of degrees; a turning page has no moving parts. `scale`: a number above 0, the fraction of the house scale. `model`: names the parts the block builds (everything outside `built`), where they end up, for other pages to place. `color`: the default colour of every part line without one. `from`: the default starting offset of every part outside `built`, as `[x, y, z]`. `alt`: the reader-facing description; without it the label is composed from the part names as now. Unknown keys get a note; a value of the wrong type gets a note and the default.

**The extension bundles js-yaml (2026-10-26).** It ships `js-yaml.min.js` as a transform-time script, as the abc extensions do, and parses the header with the JSON schema core uses for chapter frontmatter. Core parses only the chapter's frontmatter, on the app side, and passes the result as `ctx.frontmatter`; the transform frame has no parser. Declined: a core `ctx.parseYaml(text)`, which would be the first `ctx` method that is a library function rather than brokered access to the book's files; and putting the step's settings in the chapter's frontmatter, which ties them to the page rather than the block, allows one block per chapter, and splits a step across two places in the source.

## The part list

One line per part, tokens separated by spaces: `<part> [<colour>] <x> <y> <z> [turn <degrees>] [from <x> <y> <z>]`. The part is a library part number or a model name (`3665a`, `spaceman-seated`, `letter-o`), resolved by bare name against the library's `parts/` and `models/` files and the book's model records, as now. The colour is an LDraw colour name as `LDConfig.ldr` spells it, case-insensitive, with underscores for spaces (`Light_Bluish_Grey`); numeric LDraw codes are left to `ldraw` blocks, since a number in the colour position would be read as a coordinate. A line's own colour and `from` override the header's; `from 0 0 0` stops a part that would otherwise move.

Lines that begin with a section keyword open a section. `built`: parts already in place when the step opens, which never move and are not part of the block's model. `step` or `step <n>`: the next step's parts, placed in source order as the thumb is dragged; a number sets the step's number, and a bare `step` counts on from the one before (the first counts from 1). `model <name>`: the following parts, up to the next section line, make a model of that name, the block form of `{model=letter-b}` on a paragraph in the alphabet pages; on a turning display page this is how new letters are recorded where they first appear. Parts before any section line belong to a first `step`. `#` starts a comment to the end of a line; blank lines are ignored.

**Keywords are chosen by these tests (2026-10-26):** the word building instructions and their tools already use, where there is one; continuity with the words authors and the generators already write; one word per idea and one idea per word; reading aloud as an instruction, with section lines as nouns or states and modifiers on a line as verbs or prepositions; room for later words (`view`, `callout`, `remove`). Parsing does not constrain the choice: a section line is a keyword with at most one argument and a part line always has three numbers, so a model may even be named `step`. Keywords are syntax, not reader-facing copy, and stay English in every book.

**`built`, not `base` (2026-10-26).** Classic instructions never name what is already there: the picture shows the model so far with the step's new parts, and the parts panel lists only the new ones. The instruction tools name it by its relation to the steps (LPub3D's "Fade Previous Steps"), and that is what it is: the green plate on a letter page, the whole of the previous page's result later in a sequence. `built` says the parts are finished and will not move, and as a state it sits apart from the nouns `step` and `model`. Declined: `base` and `ground`, which read as a base plate, one common case rather than the idea; `start` and `initial`, which clash with the motion words, since `from` is where a moving part starts and the thumb has a start position; `before`, which describes the position in the file more than the state of the parts.

**The step number goes on the `step` line (2026-10-26).** A page continuing a sequence (steps 3–4 of the armchair) writes `step 3` on its first step line, and later bare `step` lines count on; there is no header key. The header's `step:` meant a number while the body's `step` meant a section, two ideas for one word; the alternatives, `number:` (of what?), `first:` and `start:` (a motion word again), were all weaker. The number sits where the step begins, so moving or deleting steps leaves no stale number in the header, and it reads as a booklet does. Declined for now: numbering steps automatically along the spine, as a printed booklet runs on, since the letter pages each restart at 1, so it would need a notion of where one build ends, and it would depend on other chapters' records with their render gap.

**`model`, not `submodel` (2026-10-26).** Both forms name parts so another page can place them as one piece, by using the name on a part line like a part number (`letter-o 0 -3 0`). The header's `model:` names everything the block builds outside `built`, a build that spans its steps (the letter build pages); the section line `model <name>` names the parts that follow, a group inside a page without steps (new letters on the alphabet display pages). The tools' word is "submodel" (LDraw multi-part documents, LDCad, LPub3D, Studio), and booklets draw the idea as a sub-assembly in a callout box; declined because it is relative: on a letter's build page the letter is the whole model, and becomes a submodel only where a name page places it. `model` is true wherever it is written, is what authors, generators and the model records already use, and leaves the booklet's framed sub-assembly, built inline mid-sequence, to a later `callout`, which is a different thing from naming parts for reuse.

**`turn` (2026-10-26).** Rotation of a part about the vertical, in degrees, counter-clockwise seen from above (as `lego3d.js` does it: three.js `rotation.y`, with author x as three's x and author y as its z), any value, though studs align only at multiples of 90. Bricks go on studs up, so this is nearly the only rotation a builder makes, and rotation about other axes was declined with the seated minifig. `turn` reads as an instruction and is what authors already write. Declined: `rotate`, the tools' word, which in LeoCAD, Studio and LDraw covers any axis and promises axes the notation does not have; `yaw`, which is exact but jargon here, reads as a description rather than an instruction, assumes a front, and brings aviation's clockwise sign convention. `SYNTAX.md` should still say "`turn` is a yaw" for readers who know the term. Should tilting ever be needed it gets its own plain verb, and `turn` keeps its meaning. `turn` and `spin` are both rotation words but separate cleanly: a part's orientation in the build against the reader turning the finished model; whether `spin` is the right header key is for the header keys.

**`from` (2026-10-26).** Where a part starts its move, as an offset from where it lands (the offset itself was decided in `process/DJOT_LEGO_SYNTAX.md`). Booklets show motion with arrows and have no word for it; LDraw has none. The one misreading is absolute, "from the point (0, 0, 9)"; spoken, "it comes from 9 plates above" is naturally relative, and `SYNTAX.md` and the generator's sample show it at first sight (`from 0 0 9   # 9 plates above where it lands`). Mostly the header supplies it, where `from: [0, 0, 9]` beside `color: Yellow` reads as "parts come from 9 above". Declined: `drop`, clearest for the common case but only straight down, while parts already rise from below and slide in from the side (and as a second word for drops it would be an alias); `offset`, exact but technical and a noun among line modifiers that are verbs or prepositions; `by`, relative but vague alone; `move`, which reads as an order and leaves from or to unclear.

**`spin` (2026-10-26).** A turning display page: no moving parts, and dragging turns the finished model about the vertical; `spin: true` is the house 90°, or a number of degrees. "Spin" is the web's name for drag-to-turn product views ("360 spin"), it sits in the header about the whole model where `turn` sits on a part line, and the Djot pages and runtime already use it; the header form (`spin: 90`) reads as a range rather than a motor. Declined: `turntable`, which names an object and in 3D viewers means automatic rotation; `rotate`, which suggests other axes; `view`, kept free for a later key that sets a step's camera angle, as LDraw's `ROTSTEP` does.

**`scale` (2026-10-26).** A fraction of the house scale, for a model too big for the page. A ratio, as booklets' "1:1" part markers are, familiar from CSS and 3D tools, and already used by the Djot pages. Declined: `zoom`, which suggests the camera or something the reader changes; `size`, which does not say of what.

**`color` (2026-10-26).** The model's main colour, with the meaning decided for the Djot step's `color=` on 2026-10-25 (`process/DJOT_LEGO_SYNTAX.md`): parts without their own colour take it and stay colourless in the record, so a line placing the model with a colour repaints them (LDraw's colour 16). The spelling of HTML, CSS and the existing pages; `colour` is not accepted as an alias but gets a note ("unknown key `colour`; did you mean `color`?"). Colour values keep LDraw's spelling from `LDConfig.ldr` (`Light_Bluish_Grey`).

**`alt` (2026-10-26).** The description a reader hears in place of the drawing; without it the label is composed from the part names. One per block, not per step, until a page needs more. Every author knows the word from images, and it is what the still image's alt text already is. Declined: mermaid's `accDescr` (catalog precedent, but camelCase jargon); `label`, accurate for `aria-label` but not an author's word; `description`, long and suggesting a caption for sighted readers. Whether a description is required or the composed label translated stays open in `process/BRICK_STEPS_EXTENSION.md`.

**No key for the parts library (2026-10-26).** A book has one parts library (decided 2026-10-24), so a per-block key could only repeat it or break that rule. The library is the extension's asset at a fixed href; a book that needs other parts replaces that file with its own build at the same href. This also retires the `lego-parts:` frontmatter key. Declined: `parts:`, which reads as the list of parts (as the first sketch of this block used it), and `library:`, a per-block setting for a per-book fact.

## The `ldraw` sibling

The same transform also takes `` ```ldraw `` blocks: LDraw text pasted from a CAD tool (LeoCAD, Bricksmith, LDCad, or BrickLink Studio's `.ldr`/`.mpd` export), with the same optional YAML header. Positions are LDraw's own and are used as they are: no corner rule, no author units. `0 STEP` divides the steps; the parts before the first `0 STEP` are built, the rest drop by the header's `from` (in author units, default `[0, 0, 9]`), since LDraw has no motion. A multi-part document's first `0 FILE` is the step and the others are its submodels; the library still supplies the parts. Whether pasted LDraw is a lasting route or a one-time import converted to `bricks` lines is open.

## What the catalog pattern gives for free

Category `code-blocks`, a DOM transform at stage `blocks`, the runtime script, three.js bundle, stylesheet and parts library as assets, and licence files, as in `process/BRICK_STEPS_EXTENSION.md`. A sample generator with the "Plain text wrapper" option every block extension has, inserting a worked step in the author's text format, which settles how a new author starts and how each format writes the fence. A `SYNTAX.md` beside the extension. The parser checks part and colour names against the library (`ctx.readManifestText`) when the page renders, so mistakes are reported in the editor rather than to a reader.

## A candidate: drawing the still image while rendering

Mermaid draws its SVG at transform time, so its pages need no script in the reading system. The transform runs in a browser frame, so three.js and LDrawLoader could load there as extension scripts and draw each step's finished state: an inline SVG through three.js's SVGRenderer (edge lines suit the instruction look) or a `data:` PNG, plus the composed alt text. That would give every page the no-WebGL fallback that is designed but never exercised, without the headless harness. `ctx` writes only source text, not manifest images, so the image must be inline; whether Books and epubcheck accept an inline `data:` image needs checking. Worth a test, not part of the first phase.

## Migration

Mechanical, by the book-editor agent or a script, and the generators change the same way: `{step=3 scale="0.5" model=letter-j}` above the div becomes the header, except the page's step number, which goes on its first `step` line (`step 3`, or nothing for 1); `:part:{is=X color=C at="a b c" turn=t from="p q r"}` becomes `X C a b c turn t from p q r`, dropping whatever matches the header's defaults; a part carrying `step=n` becomes a `step` line before it; a paragraph's `{model=letter-b}` becomes `model letter-b`; the base plate goes under `built`. Rendering each converted page in the harness against its current still should give identical pixels, as the model conversion did.

## Open questions

- Whether the Djot `:part:` route is kept for "Picklets 2.0" or retired once the books are converted.
- Pasted LDraw as a lasting route or a one-time import.
- Whether the header may set defaults per section (a `step` line carrying its own colour or `from`), or only per block.
- The build-time still image, once tested.
