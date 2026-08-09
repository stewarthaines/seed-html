# Australian Haines Family — Djot migration, responsive pass, data layer v2

The project ("Australian Haines Family", `workspace-44544dc4`) is a family history built in an earlier SEED.html: Markdown sources rendered by `transformText.js` (markdown-it + markdown-it-attrs, plus clip/neumes/select plugins), a hardcoded data layer (`people` / `partnerships` / `families` JS objects at the top of `transformDom.js`), and per-person chapters whose vital facts, relatives and index are injected into `.family` / `.family-index` anchor elements at render time.

**Current state**: the Markdown pipeline is re-enabled and the book renders correctly — this is the working baseline to plan from. The djot extension is installed but switched off. The brief accidental flip to djot was actually useful: it demonstrated, in real rendered output, exactly which constructs break — that evidence is folded into phase 1 below.

The project was seeded from an earlier SEED template (the Kenya letters/bulletin project) and carries a lot of inherited machinery this book never uses — audio clips, neumes, ABC scores, an older script-based responsive system. Retiring that is part of the modernization.

## Phase 1 — migrate the sources to Djot, then flip

**Status 2026-08-09: DONE except retirement.** All 19 sources converted and written (pre-verified in node against the catalog djot.js + the full transform chain before any bridge write); anchor conversion landed as `anchorSetup` in `SOURCE/scripts/transformDom.js` — NOT in the djot extension, because `SOURCE/extensions/` is app-owned and agent-unwritable; the paragraph-text match works under both pipelines, so the book stayed functional between conversion and flip. Settings flipped by the author; spot chapters verified in-app and over the bridge (carlton_cemetery live render matches the harness; axe clean). Outstanding: whole-book epubcheck (package + validate), and the retirement step below (author-side: uninstall the two markdown extensions, delete `transformText.js` — the bridge cannot delete files or touch `SOURCE/extensions/`).

The flip is atomic: one `text_transform` covers the whole book, so sources convert in one pass and the switch happens once, with per-chapter verification (`seed_get_rendered_xhtml` + `seed_get_checks`) against the Markdown baseline immediately after. 19 sources, most tiny. Capture baseline renders of the content-rich chapters first for comparison.

**The flip itself is three settings fields, not one**: `text_transform` → `transformDjot.js`, `audio_clip_template` → the quoted-attribute djot form, `video_template` → the `` `…`{=html} `` raw-escape form (the markdown flavors are currently configured; the accidental flip showed the djot extension's variants).

### Anchor idiom: `:family:` symbols (decided 2026-08-09, spike-verified)

The `.family` / `.family-index` injection anchors are standalone `{.family}` attribute lines today (markdown-it-attrs renders an empty classed `<p>`). In djot a block attribute attaches to the **next** block — during the flip this attached `.family` to the portrait image in `james_henry_haines`, and `renderPersonChapter`'s `innerHTML = ""` then deleted the portrait; `{.family-index}` at the end of `introduction.txt` attached to nothing and the index vanished.

Replacement: djot **symbols** — `:family:` / `:family-index:` on a line of their own, converted by a small filter (added to the `applyFilter` chain in the project's `transformDjot.js`, beside `clipFilter`) into `<div class="family"></div>` / `<div class="family-index"></div>`. The DOM contract is unchanged, so `transformDom.js` needs no edits. Chosen over a `::: family` fenced div (overloads the div/class mechanism for what is really a data-injection directive) and over the `:clip[…]{…}`-shaped span convention (djot only parses `[…]` as a span when an attribute block follows, so the common bare-marker case degenerates).

Spike results (run against the catalog's `djot.js`, byte-identical to the project's copy):

- `:family:` alone in a paragraph parses as `{tag: "symb", alias: "family"}` — note the AST tag is `symb`, not `symbol`.
- Hyphenated aliases are legal: `:family-index:` parses as one symbol.
- Unfiltered, a symbol renders as literal text (`<p>:family:</p>`) — a visible breadcrumb, not a silent vanish, if the filter is ever missing.
- Attributes attach to the symbol: `:family:{of=harold_gross}` → `attributes: {of: "harold_gross"}`, available for phase 3 (render a panel for someone other than the chapter's idref). The real filter must map extras to `data-*` (`data-of`) — a bare `of` attribute is not valid XHTML.
- The filter's guard — only rewrite a paragraph whose **sole child** is a family symbol — is load-bearing: djot mints incidental `symb` nodes from prose like `12:30:45` (the `30` parses as a symbol mid-paragraph, though it round-trips to literal text). Mid-prose symbols stay untouched.
- Verified end-to-end in the filter prototype: para → `div.family` block conversion renders correctly, including inside a section under a heading (the Family Index case).

Anchor placement varies by file (mid-document in `thomas_haynes`, after the nickname paragraph in several others) — convert positionally, don't assume it follows the H1.

### Per-source conversions (all instances confirmed in the sources)

- **Attribute lines that attach backward must move above their block** — this pattern is pervasive, not incidental: `{.stewart}` (introduction, stewart_leslie, house_of_haddow, carlton_cemetery ×3), `{.harold}` (thomas_haynes), `{.wikipedia}` (emma_hallworth), `{.center}` after each interment list (carlton_cemetery ×3). `page.css` styles `blockquote.stewart` etc., so the class must land on the same element after conversion — verify per chapter.
- **Emphasis converts in both directions**: Markdown italics `*Haines*` (in `thomas_haynes.txt`) become djot `_Haines_`; Markdown strong `**Baptist section C 732**` / `**Beryl**` (in `carlton_cemetery.txt`, `maria_margaret_haines.txt`) becomes djot `*…*`.
- **Genealogy abbreviation lines become lists in djot**: `m. Florence …` → roman-numeral `<ol start="1000" type="i">`, `b.` / `d.` lines → alpha lists. Escape the dot (`m\.`) mechanically — no more than that, because phase 3 renders many of these lines from structured data and deletes the prose.
- **HTML comments → `{% … %}`** (introduction, house_of_haddow); **entities → literal characters** (`&mdash;` in introduction).
- **Trailing-double-space hard breaks → `\`**: the photo-caption name lists (james_henry_haines wedding party, thomas_haynes family group, emma_hallworth quote).
- **notes.txt needs special care**: the deeply nested genealogy outline collapses silently under djot's nesting rule (a nested list needs a blank line after its parent item's text) — every level needs blank-line separation, which also flips it from tight to loose rendering (check `page.css` list spacing after). It also contains invisible zero-width characters from a paste (`​born`, `died​`) — strip them while in there.
- **harold_gross.txt has the book's one real `.figure` image**, with a caption in a `title` attribute containing a literal newline — verify djot parses the multi-line quoted attribute, or restructure; its alt text is junk (`Images/Gross-3512.png`) either way and phase 2 rewrites it.

### Retire the Markdown machinery (after all chapters verify)

`SOURCE/scripts/transformText.js` and the `markdown-it` / `markdown-it-attrs-browser` extensions. The djot extension's clip filter already covers the clip directive (unused in this book anyway — see phase 2); the neumes/select plugins are Kenya-project leftovers with no usage here.

**Definition of done**: every chapter renders with no literal `{…}` text, no stray ordered lists from `m.`/`b.`/`d.` lines, anchors inject correctly, quote/list classes land where `page.css` expects them, epubcheck clean.

## Phase 2 — responsive-friendly (and the cleanup it forces)

**Status 2026-08-09: agent-side work DONE.** Phase 1 closed (epubcheck valid; author emptied `transformText.js` — no delete UI exists; unmanifested orphans left to fall out on an export/import round trip). Audio ruled out for this book, so: `transformDom.js` cut 25KB → 15KB (clip/abc/neumes/select machinery removed; `figureSetup` now emits deterministic figure+figcaption, no generated aside), `page.css` cut 4.6KB → 1.3KB (clip/audio/Kenya/body-class rules gone; `.breakbefore` gained its legacy alias), and the three photo chapters carry `.figure` images with written alts and concise captions (detailed L-R name lists kept as prose — links and line breaks survive). Remaining, author-side: remove `audio-player.js` / `responsive.js` / `play.svg` / `stop.svg` from the manifest (drops `scripted` from every chapter), re-package + validate, and update the OPF accessibility metadata in the app (add `visual` to accessMode; the `alternativeText` claim is now true).

The discovery from this pass: **two responsive systems coexist**. Every chapter loads both `responsive.js` (the old system: measures body width on load/resize, stamps `.narrow`/`.wide`/`.full` on `<body>`; `page.css` keys many rules to those body classes) _and_ the new CSS-only extension (`sr-page` wrap, container queries in `responsive.css`). The old one is why **every chapter carries `properties="scripted"`** in the OPF.

1. **Retire `responsive.js`** and port the `page.css` body-class rules into the modern system: the prose-measure/figure rules are already superseded by `responsive.css`; the remaining `.narrow`/`.wide`/`.full` rules (`.container` grid collapse, blockquote indents, `.full figure img`) either move to container-query form or die with the features they styled. This also unblocks dropping `scripted` from all 19 chapters — reading systems treat scripted EPUBs conservatively, so this is a real compatibility win, and it makes the OPF honest.
2. **Retire the unused audio apparatus** (decision point: no source uses `:clip` — is audio planned for this book? If not): `audio-player.js`, `play.svg`/`stop.svg`, the clip/progress-bar half of `page.css`, and `clipSetup`/`structureSetup`/`clipProgress` in `transformDom.js`.
3. **Promote images to figures** via the existing affordance: `figureSetup` already converts `img.figure` + `title` → `<figure>`/`<figcaption>` (one live usage in harold_gross). Adopt `![alt](…){.figure title="caption"}` across the photo chapters, folding the loose caption paragraphs (the "L-R: …" lists) into captions. Clean `figureSetup` while touching it: drop the generated `aria-describedby` aside (duplicates alt, mints `Date.now()` ids — nondeterministic output). Figures then engage `responsive.css`'s container queries (caption-beside-image on roomy layouts) — the actual "responsive friendly" payoff.
4. **Alt-text pass**: every photo has empty alt. The OPF already **claims** `alternativeText` and "validated to meet EPUB Accessibility 1.1" — currently unbacked; the alt pass makes it true. Also add `visual` to `accessMode` (this is a photo-rich book).
5. **Verify** in the responsive preview at narrow/wide widths, and resolve `settings.json` `preview.head: "preview/head.xml"` — the file doesn't exist in the workspace; restore or clear.

## Phase 3 — data layer v2: YAML frontmatter in person chapters

**Status 2026-08-09: DONE.** Confirmed: text transforms receive `ctx`, and every installed extension's `scripts[]` libs load as iframe globals for any configured transform — so the frontmatter stage lives in the project's own `SOURCE/scripts/transformText.js` (frontmatter parsed with the `jsyaml` global under JSON_SCHEMA so dates stay strings, persisted to `SOURCE/data/people/<idref>.json`, `null` when absent; body rendered via the `djot` global with idFilter carried over, clipFilter deliberately not). jsyaml came from a project-side extension the author added; a standalone `js-yaml` extension was also added to the app catalog (uncommitted). `transformDom.js` v3 deletes the hardcoded `people`/`partnerships`/`families` globals: records loaded from the store, children/siblings derived by inverting `parents:`, partnerships resolved from either side's `partner:`+`married:`, chapter links derived from the manifest (skip flags dead). Chapterless people live as `others:` records in the most-related chapter (Colin/Jessie under james_henry; Dorothy Pattenden/David/Robyn under james_dougal). Parity-verified against the old globals output; intended diffs: ISO dates render as clean years, children birth-sorted, no empty Siblings stub, james_dougal's marriage now renders (year omitted when undated). Bootstrap: package once to seed every record. Parked: the `:family:{of=…}` parameterized anchor (needs the in-extension filter — djot drops symbol attributes when rendering them as text).

### Phase 3b — panel detail (2026-08-09)

Panels now carry full dates and places: `b.`/`d.` lines with `birthplace`/`deathplace`, marriages with full date + `married_place`, and relatives listed with lifespans (`Mary Jane Haines (1859–1939)`; chapterless Jessie reads `(1914–1914)`). Dates format through **`Intl.DateTimeFormat`** keyed to `ctx.language`, built with `Date.UTC` and formatted with `timeZone: "UTC"` — without that, a machine west of UTC renders the day before (verified: 4 April → 3 April under TZ=US/Hawaii). Non-ISO values pass through as authored, so rough dates survive. **Date ORDER is metadata, not code**: `dc:language` of `en` resolves to US order ("April 4, 1867"); `en-AU`/`en-GB` give "4 April 1867". Dead code removed while in there: `birthYearOf` and `createPersonLink`'s unused `name_year` branch. Portraits deliberately NOT moved into the panel — source placement already puts them under the anchor.

Prose lines the panel now duplicates were deleted from their chapters (bare `b.`/`d.`/`m.` lines in emma_hallworth, harry_john, james_thomas, nellie_may, james_henry). Places sourced only where the prose states them.

Placeholders: `birth: ??` parses fine as a string and renders as authored — the author's call (2026-08-09): a placeholder should be visible in the book, not swallowed. No guard added.

Also in this pass: the partnership list gained the **Partner/Partners heading** it was missing (Parents/Siblings/Children all had one), and its line shape now matches the other relative lists — name first, `, m. <date>` after, so a partnership recorded without a date no longer asserts a marriage. And `partnershipsOf` now **dedupes**: declaring the partnership on BOTH sides (which happens the moment a chapterless partner gets their own chapter) previously rendered the partner twice — reproduced, fixed, verified.

Goal: vital facts move out of `transformDom.js`'s globals into the chapter that owns them, as explicit frontmatter parsed with jsyaml; the DOM transform renders the family panel from stored data instead of hardcoded objects.

The project already contains the architectural template: `storeImageReferences.js` (DOM transform writes per-chapter JSON to `SOURCE/data/figures/<idref>.json` via `ctx.writeSourceText`) + `listFigures.js` (reads the aggregate back via manifest + `ctx.readSourceText`). The people data layer is the same shape:

1. **Frontmatter extraction** in the text transform: extend/wrap `transformDjot.js` — detect a leading `---\n…\n---` block, parse with jsyaml, strip it before `djot.parse`. jsyaml ships as an extension asset (same pattern as `djot.js`). _Verify early whether the text transform receives `ctx`_ — if it does, persist parsed data to `SOURCE/data/people/<idref>.json` right there; if not, the fallback is the text transform embedding the data as a JSON `<script type="application/json">` block that a small DOM transform persists and removes. Settle this with a spike before building on it.
2. **Cross-chapter reads**: `familySetup` v2 loads all `SOURCE/data/people/*.json` (manifest-iterated, like `listFigures`) and renders the panel — same output as today. Same bootstrapping caveat as figures: a chapter contributes once rendered. Mitigate with a **one-time seeding step**: generate every person JSON from the current hardcoded objects before flipping the renderer, so the data files exist from day one and frontmatter becomes the editing surface thereafter.
3. **Normalize dates during the migration**: the current data mixes `1857-04-27`, `4/4/1867`, `9/4/61`. Store ISO (partial dates allowed: `1867`, `1867-04`); format for display in the renderer (`b. 1867` already only uses the year).
4. **Data model questions to settle before building** (the real design work — worth a conversation, not a checklist):
   - Where do _relationships_ live? Facts (birth, death, nickname, display) clearly belong to the person chapter. Parents/partnerships span two chapters. Leading idea: each person declares `parents: [id, id]` and partnerships declare `partner: id, married: date` on one side (or both, merged), with children **derived** by inverting parents — no `families` table to maintain.
   - Where do _chapterless people_ live (the `skip: true` entries — Colin, Jessie, Dorothy Pattenden, David, Robyn…)? They have no chapter to carry frontmatter. Options: a supplementary `SOURCE/data/people.yaml` for stubs, or minimal stub chapters excluded from the spine, or the skip entries stay in a small seed file.
   - Does `renderPersonChapter`'s output stay as-is, or is this the moment to enrich it (death dates, marriage dates in full, portraits inside the panel)?

## Phase 4 — pictured people (first slice, 2026-08-09)

Groundwork for face-region tagging, done as the slice that needs no core change and no libraries: **regions in frontmatter, generated caption**.

A chapter declares who is in its figures:

```yaml
photos:
  Images/014-Family-of-Thomas-and-Emma.JPG:
    Back:
      [james_haddow, { person: thomas_edwin_haines, as: 'Ted Haines' }, 'Mrs Ted [Edith] Haines', …]
    Middle: [mary_jane_haines, thomas_haynes, maria_margaret_haines]
    Front: [florence_mccoll, james_henry_haines]
```

Keyed by the image's **manifest href** — the path as the OPF lists it. The figure's src is chapter-relative (`../Images/…`), so `resolveHref` resolves it against the chapter's own manifest href before lookup; keying on the bare filename (the first cut) would collide the moment images live in nested directories (author's catch). Segment arithmetic, not the URL API, so names needing percent-encoding compare as authored. The value is a map of row label → people (rows in authored order, people left-to-right) or a bare list for a single-row photo. Rows are author-labelled deliberately — clustering by y was rejected as guesswork. An entry is a person id (linked when they have a chapter, named otherwise) or any other string, rendered verbatim so an unidentified sitter keeps the author's wording. `facesSetup` appends the result to the figure's `<figcaption>`, after `figureSetup` has built it; a chapter never links to itself. `loadPeople` now runs once per render, hoisted into `transformDOM` and gated on `.family`/`.family-index`/`img.figure`, so `familySetup` became sync.

Extension point for the future drawing tool: an entry may also be `{ person: id, as: "Ted" }` — `as` prints the name as authored while still linking, and the object form is where a face box (`xywh` percent, per W3C Media Fragments) would hang.

Deliberately NOT in this slice: crops (need canvas + a manifest item, so plugin-side), and the click-to-spotlight overlay. Note for that one: an **inline SVG overlay with `<a>` regions and CSS `:hover`/`:focus` needs no scripting** — it keeps `scripted` off the chapters, which phase 2 worked to remove.

Architecture note for the authoring UI, verified against `src/lib/plugins/contract.ts`: it must be a **plugin** (extensions have no UI surface), and today `init` hands a plugin the shared **output** directory, not the project workspace — so reading `OEBPS/Images/` and writing region data needs the workspace handle the design note already anticipates. The `insert` message (panel plugins) is a partial workaround: the plugin could emit the `photos:` block at the editor cursor.

Worth checking before building a drawing tool: if the scans ever passed through Picasa/digiKam/Lightroom, face regions may already be embedded as `mwg-rs:Regions` XMP (normalized x/y/w/h + name) — `exiftool -Regions:all` on the originals.

## Housekeeping (any phase)

- **~5MB of unmanifested Kenya-project images**: `Bert_tying_Fita.jpg`, `Camp_at_Hola2.jpg`, `Main_street_Hola.jpg`, `Main_street_Laza.jpg`, `PICT0102.JPG`, `Sammy_2.jpg`, `Jim_HAYNES.jpg`, plus unused `james_henry_haines2.jpg` — none referenced by manifest or sources; delete.
- Kenya-project CSS leftovers in `page.css`: `blockquote.hugh` / `.bruce`, `img.philips` / `.flag`, the clip/progress styles (folds into phase 2's page.css work).
- **No cover is declared** (no `cover-image` property in the manifest); `OEBPS/OEBPS/cover.jpg` is a nested-directory orphan — decide whether it's the intended cover, then wire it properly and remove the orphan path.
- Orphans from earlier app versions: `Text/chapter01.xhtml` (workspace root, outside OEBPS), `META-INF/calibre_bookmarks.txt`.
- `SOURCE/text/nav.txt` is empty (nav is generated) — fine, just noting it's not an authored nav.

## Order and why

Djot first because every later phase edits the same sources and the conversion list is now fully enumerated — no point writing figures or frontmatter into files that will be re-punctuated. Responsive second because it's where the legacy machinery (old responsive system, unused audio, `scripted` flags) comes out, and figures/alts want the sources already in their final syntax. Data layer last because it's the largest design surface and it deletes prose the earlier phases would otherwise have polished.
