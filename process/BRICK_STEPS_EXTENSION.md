# Brick-step pages as a SEED.html extension — plan

Drafted 2026-10-25 from the "Picklets 2.0" book, where interactive building-instruction pages now work end to end as project files: a Djot `::: lego` step of `:part:` directives, a project `transformDom.js`, a runtime `lego3d.js` with a three.js bundle, a parts library `parts.mpd` and stylesheet rules. The design record is `process/DJOT_LEGO_SYNTAX.md`; the build tools and render harness are in `~/Projects/webgl-book-build`. This plan turns that into a catalog extension any fixed-layout book can install. Nothing here is decided until discussed.

## What the extension ships

The same shape as `extensions/audio-clips`, which already ships a runtime script as an asset. `extension.json`: one DOM transform (today's project `transformDom.js`), stage `blocks`, since it turns a div into the element the runtime draws; assets installed into OEBPS and the manifest: the runtime script (`lego3d.js`), the three.js bundle with LDrawLoader (565 KB, built by `entry-lego.js`), the stylesheet (`lego.css`) and a default parts library (`parts.mpd`, 388 KB, 59 KB compressed); licence files for three.js (MIT, its notice already at the end of the bundle) and the LDraw parts (CC BY 4.0, attribution to LDraw.org).

Superseded 2026-10-26: a step is a fenced `` ```bricks `` code block, which every text format emits in the same shape, so the extension is a code-blocks extension like abc2svg and mermaid; the notation is proposed in `process/BRICKS_BLOCK_NOTATION.md`. Previously: the `:part:` directive needed nothing of its own, arriving through the attributed-symbol carrier that both the Djot extension (`symbolFilter`) and the Markdown extension (`symbolPlugin`) provide, as photo-regions' `:region:` does; fenced divs and attribute lines are Djot syntax, so the Markdown route was unresolved.

## The name

LEGO is a trademark of the LEGO Group. A catalog extension in the public repository should not carry it in its name, id, class names or directive. Proposal: "Bricks" (id `bricks`), the step written `::: bricks`, runtime and stylesheet classes renamed to match, the records at `SOURCE/data/bricks/`. "Picklets 2.0" then moves from its project files to the extension by renaming `lego` to `bricks` in its chapters, a search-and-replace the author or the book-editor agent can do. Accepting `lego` as an alias would spare that, but is fallback-style code and needs approval.

## The parts library

The biggest open question. Today a book's parts come from one packed `.mpd` built outside the app with three.js's `packLDrawModel.mjs` from an inventory file, and adding a part means repacking and re-importing. The extension can ship a default library; the choice is how big. Options: a small library (the current 30 parts and the spaceman), with a documented command-line recipe for a book that needs others; a broad library of common bricks, plates, slopes and tiles, a few hundred parts, perhaps 2–4 MB uncompressed, so most books never repack; or later, an in-app parts generator that builds the library from the LDraw catalogue, which raises network and licence questions. Recommendation: a broad default plus the recipe. A book with its own library replaces the extension's file at the same href; there is no key for it (`process/BRICKS_BLOCK_NOTATION.md`, 2026-10-26).

Author models (`model=`) already let a book compose its own pieces without touching the library, so the library only needs to hold raw parts.

## What the runtime must stop assuming

`lego3d.js` hard-codes the 320×460 page: the page size, the bottom strip that starts a drag (pageY > 380), the thumb's 210 px of travel and positions, the picture centre and the parts-callout box. The extension version reads the page size from the stage (the fixed-layout viewport) and derives the rest in proportion. Reflowable books are out of scope: the drag and the fixed scale assume a fixed page; the transform should leave a visible note in a reflowable book rather than draw badly.

Reader-facing text is English: the composed `aria-label` ("Step 2: add 2 Yellow Brick 2 x 2…", "A model turning, built from…") and the colour and part names behind it. Options: require a still image with alt text on every step (it is already the intended no-WebGL fallback), or translate the composed label. The notes for malformed parts are author-facing and can stay English for now.

## Records and models

Model records move to `SOURCE/data/bricks/<idref>.json`. Two gaps found in use: a model name defined on two pages is resolved silently by spine order (it bit once, the capital and lowercase `j`), so the transform should report duplicates; and every render reads every chapter's record, which is fine at 50 chapters and worth measuring at 500. The known limit stays and goes in the manual: a page that uses a model sees it as of the defining chapter's last render, and packaging does not render.

## Still to verify before release

Findings and open questions about Books itself are kept in `process/APPLE_BOOKS_BEHAVIOUR.md`. iPhone and iPad in Apple Books: the touch cancelling that stops the page swipe was written from earlier tests but never confirmed on these pages. The no-WebGL fallback (the still image) is designed but not exercised. Shadows have only been seen in Firefox on a Mac. Thumbnails are settled on the iPad: Books photographs each page shortly after it draws and nothing marks that view as a thumbnail, so a step opens finished without its handle, goes back to its start after 250 ms and fades the handle in (tested 2026-10-26; still to check on an iPhone and in Books on a Mac).

## Documentation, copy and tests

A user manual page following `docs/user/CLAUDE.md`, built around the `josh` page as the worked example; a `SYNTAX.md` beside the extension, as the Djot extension has; the catalog description is in-app copy, so one short sentence translated in every catalog.

Tests: the transform's rewrites, model records and colour resolution can be unit-tested with fixtures (keeping the happy-dom XML limits in mind); the runtime's part parsing and colour inheritance can be tested without WebGL by separating them from the drawing. The render harness stays a local tool: headless Chrome with SwiftShader draws no shadows, so it cannot be a CI check. Done means `npm run validate` passes, as for any change.

## Phases

1. Package what works: rename to Bricks, move the transform, runtime, bundle, stylesheet and library into `extensions/bricks/` with licences, and migrate "Picklets 2.0" onto it. No behaviour changes.
2. Remove the 320×460 assumptions and add the duplicate-model report.
3. Manual page, syntax file, unit tests.
4. Settle and build the parts library, and whatever the Apple Books verification turns up.

## Open questions

- The name "Bricks", and whether to accept `lego` as an alias.
- The size of the default parts library.
- Still image required on every step, or a translated composed label.
- Whether the release behaviour of the Lottie pages (page04) matters to this extension at all (it does not ship Lottie).
