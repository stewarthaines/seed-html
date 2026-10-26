# Brick-step pages as a SEED.html extension — plan

Drafted 2026-10-25 from the "Picklets 2.0" book, where interactive building-instruction pages now work end to end as project files: a Djot `::: lego` step of `:part:` directives, a project `transformDom.js`, a runtime `lego3d.js` with a three.js bundle, a parts library `parts.mpd` and stylesheet rules. The design record is `process/DJOT_LEGO_SYNTAX.md`; the build tools and render harness are in `~/Projects/webgl-book-build`. This plan turns that into a catalog extension any fixed-layout book can install. Nothing here is decided until discussed.

## What the extension ships

The same shape as `extensions/audio-clips`, which already ships a runtime script as an asset. `extension.json`: one DOM transform (today's project `transformDom.js`), stage `blocks`, since it turns a div into the element the runtime draws; assets installed into OEBPS and the manifest: the runtime script (`lego3d.js`), the three.js bundle with LDrawLoader (565 KB, built by `entry-lego.js`), the stylesheet (`lego.css`) and a default parts library (`parts.mpd`, 388 KB, 59 KB compressed); licence files for three.js (MIT, its notice already at the end of the bundle) and the LDraw parts (CC BY 4.0, attribution to LDraw.org).

Superseded 2026-10-26: a step is a fenced ` ```bricks ` code block, which every text format emits in the same shape, so the extension is a code-blocks extension like abc2svg and mermaid; the notation is proposed in `process/BRICKS_BLOCK_NOTATION.md`. Previously: the `:part:` directive needed nothing of its own, arriving through the attributed-symbol carrier that both the Djot extension (`symbolFilter`) and the Markdown extension (`symbolPlugin`) provide, as photo-regions' `:region:` does; fenced divs and attribute lines are Djot syntax, so the Markdown route was unresolved.

## The name

LEGO is a trademark of the LEGO Group. A catalog extension in the public repository should not carry it in its name, id, class names or directive. Proposal: "Bricks" (id `bricks`), the step written `::: bricks`, runtime and stylesheet classes renamed to match, the records at `SOURCE/data/bricks/`. "Picklets 2.0" then moves from its project files to the extension by renaming `lego` to `bricks` in its chapters, a search-and-replace the author or the book-editor agent can do. Accepting `lego` as an alias would spare that, but is fallback-style code and needs approval.

## The parts library

Before 2026-10-26 a book's parts came from one packed `.mpd` built outside the app with three.js's `packLDrawModel.mjs` from an inventory file, and adding a part meant repacking and re-importing; the options weighed were a small default library with a command-line recipe, a broad default of a few hundred parts (2–4 MB), or an in-app generator.

**Layered libraries, in sets by family (2026-10-26).** A book's parts come from every `.mpd` in one folder of the book (`Misc/bricks/`), in manifest order: the core extension installs a small library there (`core.mpd`: the colour table and the common bricks, plates and tiles), parts extensions each install one more set beside it ("Bricks: Slopes" installs `slopes.mpd`; minifigures, Technic, wheels later), and a book's own parts, packed with the command-line recipe, go in the same folder. The file being there is the whole declaration: no setting, no key, no list. A parts extension is a single asset, with no transform or script, and carries the LDraw CC BY 4.0 attribution. Sets are families that do not overlap, so they add up, each stays small and a book installs only what it uses. The transform reads the libraries through `ctx.manifest` and `ctx.readManifestText`, and writes on each step only the files its parts come from, so the runtime fetches no set a page does not use. A part defined in two libraries gets a note, as duplicate models do; each set carries its own copies of the primitives its parts share (studs and the like), and identical copies are taken silently. Declined: tiers of increasing completeness ("basic", "complete"), which overlap, so a book would swap one for another and every pair would clash; and replacing the extension's library at the same href, decided earlier the same day. To check while building: whether the catalog lists an asset-only extension cleanly (perhaps a category of its own), what uninstalling does to the files installed in the book, and where the script that packs one set per inventory file lives (proposed: in the repo, reading a local LDraw download).

Author models (`model=`) already let a book compose its own pieces without touching the library, so the library only needs to hold raw parts.

## What the runtime must stop assuming

`lego3d.js` hard-codes the 320×460 page: the page size, the bottom strip that starts a drag (pageY > 380), the thumb's 210 px of travel and positions, the picture centre and the parts-callout box. The extension version reads the page size from the stage (the fixed-layout viewport) and derives the rest in proportion. Reflowable books are out of scope: the drag and the fixed scale assume a fixed page; the transform should leave a visible note in a reflowable book rather than draw badly.

Reader-facing text is English: the composed `aria-label` ("Step 2: add 2 Yellow Brick 2 x 2…", "A model turning, built from…") and the colour and part names behind it. Options: require a still image with alt text on every step (it is already the intended no-WebGL fallback), or translate the composed label. The notes for malformed parts are author-facing and can stay English for now.

## Records and models

Model records move to `SOURCE/data/bricks/<idref>.json`. Two gaps found in use: a model name defined on two pages is resolved silently by spine order (it bit once, the capital and lowercase `j`), so the transform should report duplicates; and every render reads every chapter's record, which is fine at 50 chapters and worth measuring at 500. The known limit stays and goes in the manual: a page that uses a model sees it as of the defining chapter's last render, and packaging does not render.

## Still to verify before release

Findings and open questions about Books itself are kept in `process/APPLE_BOOKS_BEHAVIOUR.md`. iPhone and iPad in Apple Books: the touch cancelling that stops the page swipe was written from earlier tests but never confirmed on these pages. The still image is settled: a PNG `data:` image drawn while rendering shows in Books on iOS 12, in the page and its thumbnail, and passes epubcheck (`process/BRICKS_BLOCK_NOTATION.md`, 2026-10-26). Shadows have only been seen in Firefox on a Mac. Thumbnails are settled on the iPad: Books photographs each page shortly after it draws and nothing marks that view as a thumbnail, so a step opens finished without its handle, goes back to its start after 250 ms and fades the handle in (tested 2026-10-26; still to check on an iPhone and in Books on a Mac).

## Documentation, copy and tests

A user manual page following `docs/user/CLAUDE.md`, built around the `josh` page as the worked example; a `SYNTAX.md` beside the extension, as the Djot extension has; the catalog description is in-app copy, so one short sentence translated in every catalog.

Tests: the transform's rewrites, model records and colour resolution can be unit-tested with fixtures (keeping the happy-dom XML limits in mind); the runtime's part parsing and colour inheritance can be tested without WebGL by separating them from the drawing. The render harness stays a local tool: headless Chrome with SwiftShader draws no shadows, so it cannot be a CI check. Done means `npm run validate` passes, as for any change.

## Phases

Revised 2026-10-26 for the fenced block and the drawn still, replacing the four phases drafted on 2026-10-25 (package the Djot version as it stood, then generalise). Work is on the `bricks-extension` branch, merged per shippable phase.

Progress (2026-10-26): phases 1–3 are on the branch. "Josh in Bricks" is converted (all five pages, from the core set and the Bricks - Minifigs set) and draws in the preview; stills render at about 0.6–0.7 s a step (57–68 kB), inside the 3 s budget the DOM transforms of a chapter share. Owed from phase 3: a cache of stills under `SOURCE/data/bricks/`, keyed by a step's content, before a chapter with several steps nears that budget; and the check that matters, a packaged book on the iOS 12 iPad Air, which should show each still with its number and callout and nothing over it.

Progress (later 2026-10-26): all six phases are done and the branch is merged to `main`. "Picklets 2.0" is converted (23 pages, from the Djot `::: lego` form, the originals checked part for part); its sheet pages use the new `style: classic` key, and its chair page keeps its "5" (a turning page now numbers itself when its step line gives a number). The letter generators `make_letters.py` and `make_alphabet.py` were retired rather than converted, since the pages are short enough to write by hand; they sit in `~/Projects/webgl-book-build/lottie/render-3d/retired/`. The packaged book shows its stills on the iOS 12 iPad Air, and Apple Books' thumbnails are right on every device tried. Found on the way: re-adding a parts extension left the preview with a dead address for the rewritten `.mpd` until a reload (zero-copy OPFS blobs go stale when their file is rewritten), fixed in the app's blob URL manager; and the runtime now starts on DOMContentLoaded, since Firefox does not always fire load for a document the preview writes. The still cache stays parked.

1. The parser. A plain function from a block's text to a step: the YAML header (bundled js-yaml, the JSON schema), part lines, `built`, `step` and `model` sections, comments, and notes by line number for anything malformed. Unit tests from the notation doc's examples, loaded from the extension source as `src/lib/transform/test/list-of-figures.test.ts` loads its scripts. No drawing.
2. The extension, drawing live. `extensions/bricks/` with `extension.json` (stage `blocks`, category `code-blocks`), `transformBricks.js` finding `pre.bricks, pre:has(code.language-bricks)` and replacing each with the element the runtime draws, the runtime and the three.js bundle as assets, the stylesheet, the core parts library (`Misc/bricks/core.mpd`) and the reading of every library in that folder, js-yaml as a transform script, and licences (three.js MIT, LDraw CC BY 4.0, js-yaml MIT). Model records at `SOURCE/data/bricks/<idref>.json`, with the duplicate-model report. Done when one converted "Josh in Bricks" page draws as it does now.
3. The drawn still. The transform draws each step's finished state as a PNG `data:` image while rendering, from the test transform kept at `~/Projects/webgl-book-build/still/transformStill.js`, which needs THREE in the transform frame (a second bundle as a transform script). The runtime adds its canvas, step number, callout and handle only once it has drawn a frame; the still carries its own step number and parts list.
4. Migration. Convert "Josh in Bricks" and then "Picklets 2.0", with the generators (`make_letters.py`, `make_alphabet.py`), checking each page's still against the harness's.
5. The runtime's page size: remove the 320×460 assumptions.
6. Manual page, `SYNTAX.md`, a sample generator, the catalog description in every locale; then the first parts extensions (which families, in what order) and the Apple Books checks still open.

## Open questions

- The name "Bricks" (the block is already `bricks`); the `lego` alias is moot, since pages are converted to the block.
- Which families of parts to build as extensions first, and the exact contents of `core.mpd`.
- Decided 2026-10-26: the composed label is not translated, and `alt` stays optional. An author writing in another language writes `alt`.
- Whether the release behaviour of the Lottie pages (page04) matters to this extension at all (it does not ship Lottie).
