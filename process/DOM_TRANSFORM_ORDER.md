# DOM transform order and the figures extension

Status: PLAN 2026-09-30. **Phase 1 built and committed 2026-09-30** on `feat/dom-transform-stages`: `src/lib/extensions/stages.js` (+ `.d.ts`, since `tsconfig.node.json` does not allow JS) is the shared list; `insertByStage` in `dom-transforms.ts`; `ExtensionManager.placeDomTransforms` reads installed stages from workspace manifests with the catalog as fallback; both install paths use it; both manifest builders carry `stage` (the build exits on a missing or unknown one, dev warns); all seventeen extensions tagged; advanced reference chapters 2 and 3 and the changelog updated. Validate green apart from the long-standing untracked `process/` files prettier flags. Verified in the dev app with a Playwright script (fresh profile): seven extensions added out of order landed in stage order, and an install whose copied manifest lacks `stage` placed by the catalog fallback. **Phase 2 built 2026-09-30**, uncommitted: `extensions/figures/` (accessibility, stage `structure`); modifier classes are COPIED to the figure and kept on the img (the `img.thumb` scoping in `AGENT_AUTHORING.md` assumes both carry them), the original img is moved so `width` and `data-*` survive, an image sharing its paragraph with text is left alone (a figure cannot sit in a `<p>`), and a link wrapping only the image moves into the figure with it. Seven tests in `src/lib/transform/test/figures.test.ts` render real djot and markdown-it source and run figures → photo-regions → responsive together. In the dev app, adding Figures to the phase-1 test book placed it after fleuron and before photo-regions, and the preview showed both figures wrapped in `sr-figure`, the regions bound with the authored caption kept. Written after the En Haut prompt book rendered `![…](…){.figure .wrap-left title="…"}` as a bare image: the author expected the responsive extension to make the figure. Decided in discussion: the catalog owns DOM transform order, and figure promotion becomes its own accessibility extension rather than part of responsive (it is structure a screen reader announces, not layout).

## The problem

Both install paths append an extension's scripts to the end of `dom_transforms` (`addTransform` in `src/lib/settings/dom-transforms.ts`, called from `SettingsView.svelte` and `App.svelte` `installCatalogExtension`). Nothing knows that some transforms must run before others, so the author reorders by hand in Settings and learns the rules by breaking a book. The Parry migration recorded a working order by hand (transformDom → impressum → photo-regions → family-history → list-of-figures → responsive → fleuron, `process/CHAPTER_FRONTMATTER.md`).

The missing figure step is the sharpest case: `figureSetup` (img.figure → figure/figcaption) lives in each book's own `transformDom.js`, and photo-regions, list-of-figures and responsive all assume something made the `<figure>` first.

## What the existing extensions need

An audit of all seventeen DOM transforms (2026-09-30) found these constraints. "Documented" means a comment or process note says so; the rest follow from the selectors.

| #   | Constraint                                         | Why                                                                                                                                                                                                                                  | Evidence                                                |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| 1   | figure creation before responsive                  | responsive wraps each existing `<figure>` in `div.sr-figure`; a figure made later is never wrapped                                                                                                                                   | documented, `MIGRATE_KENYA_DJOT_RESPONSIVE.md:75`       |
| 2   | figure creation before photo-regions               | photo-regions trusts an existing figcaption and only builds one from `title=` itself; it does not lift `.wrap-left` and friends onto the figure                                                                                      | documented, `transformRegions.js:338-342`               |
| 3   | photo-regions before responsive                    | the region carrier binds to its immediately preceding sibling, which must be a `FIGURE`; after responsive it is `div.sr-figure` and every region set becomes a breadcrumb. `regions.css` also expects `.sr-figure figure.detail-set` | `transformRegions.js:254`, `regions.css:169`            |
| 4   | photo-regions before family-history                | family-history reads the current chapter's regions record, which photo-regions writes in the same render; the other way round, portraits lag one render                                                                              | `transformFamily.js:349`                                |
| 5   | figure creation before list-of-figures             | its caption comes from the enclosing figure's figcaption, else `alt`                                                                                                                                                                 | `storeImageReferences.js:26-31`                         |
| 6   | prettier before highlight and prism                | prettier's new `code` elements keep `language-js` so a highlighter colours them                                                                                                                                                      | documented, `transformPrettier.js:54`                   |
| 7   | language-switching before prism                    | Prism's `setLanguage` strips every `lang-*` class from the code and its `pre`                                                                                                                                                        | `prism.js` (minified)                                   |
| 8   | neumes and prettier before language-switching      | both carry `lang-*` classes onto the elements they create; attributes stamped before the replacement are lost                                                                                                                        | `transformNeumes.js:166-169`, `transformPrettier.js:54` |
| 9   | body-appending transforms before responsive (soft) | audio-clips appends `<audio>` to body, neumes inserts its defs at body start; after responsive they sit outside `sr-page` and break its `body.children.length === 1` re-run guard                                                    | `transformResponsive.js:41`                             |

No constraint was found for fleuron, katex, mermaid, abc2svg, abcjs, impressum (it reads `settings.json`, not other transforms' output) or print-index (its data is captured after render). Responsive stamps `span.narrow` hosts only, so it does not collide with the block variant systems in either order.

Constraint 5 has a wrinkle: after photo-regions, a figcaption also holds the row of names and chip numbers, so list-of-figures records "…Back: Roger King1, Ian2" as the caption. See phase 3.

## Design: stages, not pairwise rules

Each extension declares one `stage` in `extension.json`, from a fixed list the app owns. One stage per extension, not per script (agreed 2026-09-30): every extension today has one DOM transform; a future extension whose scripts belong to different stages splits into two. Stages run in list order; within a stage, order does not matter. A pair that needs ordering inside a stage is the signal to split the stage, not to add a before/after rule.

Pairwise `before`/`after` declarations were considered and rejected: they name extensions that may not be installed, they need a graph sort and cycle handling, and every new extension would have to know every other. A stage says what kind of work a transform does, which its author knows.

| Stage       | Work                                                              | Extensions                                                             |
| ----------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `blocks`    | replace code blocks and markers with rendered content             | prettier, abc2svg, abcjs, mermaid, neumes, katex, fleuron, audio-clips |
| `structure` | turn authored markup into semantic elements                       | figures (new)                                                          |
| `annotate`  | add to the structure that now exists                              | photo-regions                                                          |
| `derive`    | read the chapter and the project, write panels, lists and records | family-history, list-of-figures, impressum, print-index                |
| `language`  | stamp language attributes                                         | language-switching                                                     |
| `highlight` | colour code                                                       | highlight, prism                                                       |
| `layout`    | wrap for the stylesheet                                           | responsive                                                             |

Check against the table above: 1 structure < layout; 2 structure < annotate; 3 annotate < layout; 4 annotate < derive; 5 structure < derive; 6 blocks < highlight; 7 language < highlight; 8 blocks < language; 9 blocks < layout. All nine hold.

Parry's hand-set order differs only in fleuron after responsive, which the audit found harmless, so no existing book is broken by the new rule.

### Insertion rule

Installing an extension inserts its scripts, in their declared order, before the first entry whose stage is later than its own; with no such entry, they go at the end. Entries without a stage — project scripts under `SOURCE/scripts/`, and extensions whose manifest predates the field — are left where they are and do not affect the placement.

Install never re-sorts the existing list. An author's hand order survives; the move buttons in Settings stay for project scripts and for the rare deliberate override. A new project's `transformDom.js` stays first, since everything installed later lands after it or before a later stage.

An already-installed extension's stage is read from its workspace `extension.json`, falling back to the catalog entry with the same id, so books installed before this change still place new extensions correctly.

## Phases

**Phase 1: stages in the catalog.** Add `stage` to `extension.json` for the seventeen extensions per the table; add it to `ExtensionCatalogEntry`; accept and validate it in **both** manifest builders (`scripts/generate-extensions-manifest.js` and the `serve-extensions-dev` middleware in `vite.config.ts`; an unknown stage fails the build). Add `STAGES` and an `insertByStage(list, paths, stage, stageOf)` pure function beside `addTransform` in `dom-transforms.ts`, with unit tests for: empty list, project script first, unstaged entries, a stage with no later entry, a multi-script extension. Switch both install paths to it. Document the field in the advanced reference (`docs/user/seed.html-advanced-reference/Text/chapter03.md`) and replace chapter02's "order matters" with what the catalog now does. No UI copy changes.

**Phase 2: the figures extension.** `extensions/figures/`, category `accessibility`, stage `structure`, one script `transformFigures.js` transcribed from the books' `replaceFigureImages` (the En Haut copy of 2026-09-30 is the reference). Behaviour kept: `img.figure` becomes `<figure>`; a non-empty `title` becomes the `<figcaption>`; classes other than `figure` move to the figure; a paragraph whose only content is the image is replaced whole, so the figure is a true sibling for photo-regions. Behaviour changed: the book copy rebuilds the `img` from `src` and `alt` alone, dropping `width` (the one sizing input reading systems never override, per `AGENT_AUTHORING.md`) and any `data-*`; the extension moves the original `img`, removing only `class="figure"` and `title`. Idempotent by construction (no `img.figure` remains). Tests on djot and markdown-it output. Description: one sentence of benefit, untranslated per the extension rule.

**Phase 3: list-of-figures captions.** Read the caption as the figcaption's text minus photo-regions' `.fc-stack`, so the list shows the authored caption whether or not the figure names faces. This keeps list-of-figures in `derive` rather than splitting a stage for it.

**Phase 4: books.** When each book is next open over the bridge: install figures, delete `replaceFigureImages` from its `transformDom.js` (leaving any other project logic), and check the rendered figures match. Books known to carry `figureSetup`: Haines, Parry Notes, Bulletin 39, Kenya, En Haut prompt book. Bulletin 39's copy also lifts wrap classes and sets inline width caps; that part belongs to the wrapped-figure graduation (memory note), not this phase, and stays in its project script until then.

## Not in this plan

- Merging language-switching into a wider accessibility extension. Possible later, once figures exists beside it; stages make the merge a packaging choice rather than an ordering one.
- The wrapped-figure CSS system (wrap-left/right, portrait, thumb) moving into responsive.
- The figure trigger for formats without attribute syntax (a sole image with a title, no `{.figure}`), recorded as open in `CHAPTER_FRONTMATTER.md`. Djot and markdown-it (with markdown-it-attrs) both write `{.figure}`, which covers the books that exist.

## Defects the audit found along the way

Not ordering problems, and not fixed by this plan; listed so they are not lost.

- katex replaces `code.parentNode`, so an inline `code.katex` inside a paragraph replaces the whole paragraph (`transformKaTeX.js:21`).
- language-switching stamps `lang=""` on any element whose class merely contains `lang-` mid-word (`transformLanguageSwitching.js:13`).
- print-index's Decorate mode appends its page references again on every pass (`buildPageIndex.js:124-125`).
- photo-regions re-run over its own output writes `null` over the chapter's regions record (`transformRegions.js:165`).
- highlight.js reads a `lang-fr` class as a programming language and skips highlighting the block.
