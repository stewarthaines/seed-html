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
step: 1
model: letter-o
color: Yellow
from: [0, 0, 9]
---
base
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

`step`: the number of the block's first step, default 1; each `step` line after the first counts on from it. `spin`: `true` for the default quarter turn, or a number of degrees; a turning page has no moving parts. `scale`: a number above 0, the fraction of the house scale. `model`: names the parts the block builds (everything outside `base`), where they end up, for other pages to place. `color`: the default colour of every part line without one. `from`: the default starting offset of every part outside `base`, as `[x, y, z]`. `alt`: the reader-facing description; without it the label is composed from the part names as now. `parts`: the parts library, default `parts.mpd`, replacing the `lego-parts:` frontmatter key. Unknown keys get a note; a value of the wrong type gets a note and the default.

**The extension bundles js-yaml (2026-10-26).** It ships `js-yaml.min.js` as a transform-time script, as the abc extensions do, and parses the header with the JSON schema core uses for chapter frontmatter. Core parses only the chapter's frontmatter, on the app side, and passes the result as `ctx.frontmatter`; the transform frame has no parser. Declined: a core `ctx.parseYaml(text)`, which would be the first `ctx` method that is a library function rather than brokered access to the book's files; and putting the step's settings in the chapter's frontmatter, which ties them to the page rather than the block, allows one block per chapter, and splits a step across two places in the source.

## The part list

One line per part, tokens separated by spaces: `<part> [<colour>] <x> <y> <z> [turn <degrees>] [from <x> <y> <z>]`. The part is a library part number or a model name (`3665a`, `spaceman-seated`, `letter-o`), resolved by bare name against the library's `parts/` and `models/` files and the book's model records, as now. The colour is an LDraw colour name as `LDConfig.ldr` spells it, case-insensitive, with underscores for spaces (`Light_Bluish_Grey`); numeric LDraw codes are left to `ldraw` blocks, since a number in the colour position would be read as a coordinate. A line's own colour and `from` override the header's; `from 0 0 0` stops a part that would otherwise move.

Lines that are a single keyword open a section. `base`: parts already in place when the step opens, which never move and are not part of the block's model. `step`: the next step's parts, placed in source order as the thumb is dragged. `model <name>`: the following parts, up to the next section line, make a model of that name, the block form of `{model=letter-b}` on a paragraph in the alphabet pages; on a turning display page this is how new letters are recorded where they first appear. Parts before any section line belong to a first `step`. `#` starts a comment to the end of a line; blank lines are ignored.

## The `ldraw` sibling

The same transform also takes `` ```ldraw `` blocks: LDraw text pasted from a CAD tool (LeoCAD, Bricksmith, LDCad, or BrickLink Studio's `.ldr`/`.mpd` export), with the same optional YAML header. Positions are LDraw's own and are used as they are: no corner rule, no author units. `0 STEP` divides the steps; the parts before the first `0 STEP` are the base, the rest drop by the header's `from` (in author units, default `[0, 0, 9]`), since LDraw has no motion. A multi-part document's first `0 FILE` is the step and the others are its submodels; the library still supplies the parts. Whether pasted LDraw is a lasting route or a one-time import converted to `bricks` lines is open.

## What the catalog pattern gives for free

Category `code-blocks`, a DOM transform at stage `blocks`, the runtime script, three.js bundle, stylesheet and parts library as assets, and licence files, as in `process/BRICK_STEPS_EXTENSION.md`. A sample generator with the "Plain text wrapper" option every block extension has, inserting a worked step in the author's text format, which settles how a new author starts and how each format writes the fence. A `SYNTAX.md` beside the extension. The parser checks part and colour names against the library (`ctx.readManifestText`) when the page renders, so mistakes are reported in the editor rather than to a reader.

## A candidate: drawing the still image while rendering

Mermaid draws its SVG at transform time, so its pages need no script in the reading system. The transform runs in a browser frame, so three.js and LDrawLoader could load there as extension scripts and draw each step's finished state: an inline SVG through three.js's SVGRenderer (edge lines suit the instruction look) or a `data:` PNG, plus the composed alt text. That would give every page the no-WebGL fallback that is designed but never exercised, without the headless harness. `ctx` writes only source text, not manifest images, so the image must be inline; whether Books and epubcheck accept an inline `data:` image needs checking. Worth a test, not part of the first phase.

## Migration

Mechanical, by the book-editor agent or a script, and the generators change the same way: `{step=1 .spin scale="0.37" model=letter-j}` above the div becomes the header; `:part:{is=X color=C at="a b c" turn=t from="p q r"}` becomes `X C a b c turn t from p q r`, dropping whatever matches the header's defaults; a part carrying `step=n` becomes a `step` line before it; a paragraph's `{model=letter-b}` becomes `model letter-b`; the base plate goes under `base`. Rendering each converted page in the harness against its current still should give identical pixels, as the model conversion did.

## Open questions

- The keyword names: `base`, `step`, `model`, and `turn` and `from` within a line.
- Whether the Djot `:part:` route is kept for "Picklets 2.0" or retired once the books are converted.
- Pasted LDraw as a lasting route or a one-time import.
- Whether the header may set defaults per section (a `step` line carrying its own colour or `from`), or only per block.
- The build-time still image, once tested.
