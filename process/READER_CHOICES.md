# Reader choices extension

Drafted 2026-11-19. **Phase 1 built 2026-11-19** on branch `reader-choices`: `extensions/reader-choices/` (transform, reading-system script, stylesheet), `ctx.identifier` added to the transform context for the storage key, ten tests in `src/lib/transform/test/reader-choices.test.ts`; checked in the dev app 2026-11-19 (Playwright, fresh Djot project with Reader choices and Responsive layout): controls render and switch, the choice survives a re-render, a second chapter without frontmatter reads the register and opens on the book-wide choice, the stored XHTML keeps the defaults, and the packaged EPUB passes epubcheck-ts with no errors or warnings. Confirmed on devices 2026-11-19 by the user: Books on iPhone and macOS, and Thorium. An extension that packages the "dynamic content" pattern of two sample books: the reader makes a choice (servings, measures, reading level), and the book shows the matching version of the text, remembered between openings. Paired with the responsive extension, it should let an author set up a recipe book in a Djot project with no project scripts. "Reader choices" is the working name: it says what the reader gets; "dynamic content" describes the mechanism.

## The two source books

"Dynamic Content" (Textile, on the Firefox bridge 2026-11-19): a lobio recipe with Serves (4–6, 8–12, 16–24) and Measures (metric, imperial, volume). Controls are spans with ids (`%(serve #serve1x)4-6%`), the ingredient list is a Textile code block in a private shorthand (`350g:700g:1.4kg/12 oz:1½ lb:3 lb/2 cups:4 cups:8 cups/ beans`) expanded by the project's transformDom.js into nested spans, and the reading-system script `Scripts/store.js` toggles body classes against a hand-written CSS grid (`body.serve1x .serve2x { display: none }`), persisted under the global localStorage keys `item-serve` / `item-measure`.

"Language Resource Sample" (markdown-it, Downloads, 2026-06-06 build): a Georgian dialogue at three levels (English, transliteration, Georgian), chosen in a setup chapter and applied in the lesson chapter. Levels are cumulative (transliteration shows at the English and transliteration levels), and unchosen text is covered rather than removed: blanked, and revealed by a tap, as flashcards. Transliteration and audio clips are separate features (audio-clips is already an extension).

## The generic model

A **choice** has a name, a label, and an ordered list of **values** (an id each, optionally a label), one of which is the default. **Variants** are blocks or spans tagged with the values they belong to; a variant shows when the current value of every choice it names is in its set. A choice's **mode** says what happens to an unchosen variant: removed (the default) or covered (blanked, revealed by a tap, reset when the choice changes).

The responsive extension's `.narrow` / `.wide` / `.full` spans are the same pattern with the value chosen by the column width instead of the reader. The two stay separate extensions but share vocabulary.

## Decided: book-wide choices are declared in frontmatter (2026-11-19)

Any chapter's frontmatter may carry the book's choices; by convention the first chapter. When a chapter with the block renders, it writes the declaration to a book-level register (path to be fixed; `SOURCE/data/reader-choices.json` proposed), and every other chapter reads the register: most recent render wins, which is also simply what packaging ships, since packaging does not re-render chapters (`src/lib/transform/TRANSFORM_CONTEXT.md`). The register follows the places-list precedent in family-history; it is derived data, not authored content.

Values are a YAML list, never a map: number-like keys in a map are reordered by JavaScript, and the shorthand depends on order. The first value is the default unless `default:` names another.

```yaml
choices:
  serves:
    label: Serves
    values: [1x, 2x, 4x]
  measure:
    label: Measures
    values: [metric, imperial, volume]
  level:
    label: Level
    mode: cover
    values:
      - english: English translation and transliteration
      - transliteration: Transliteration only
      - georgian: ქართული ენა
```

Cost accepted: a chapter not reopened since the declaration changed ships with stale variants, unless the author ticks the Share view's re-render-before-packaging option (merged to main 2026-11-18), which covers it. A check comparing each page's stamp of the declaration with the register could list chapters that need a fresh render; deferred until it bites.

## Decided: controls are generated (2026-11-19)

The author places a directive where the buttons go, and the extension builds the labelled button group from the declaration in force, so controls always match it. House directive form (Djot symbol with attributes, one per line, its own paragraph; see `symbolFilter` in `extensions/djot/transformDjot.js`):

```
:choose:{of=serves}
:choose:{of=measure}
```

Output is a group of real buttons (`role="group"`, `aria-label` from the choice label, `aria-pressed` on the current value), keyboard operable. Hand-written controls are not part of the first version.

## Decided: a recipe is a div; overrides are per block, not per chapter (2026-11-19)

Several recipes may share a chapter, so the scope of a recipe's own servings is a block. A Djot div with a choice-named attribute overrides that choice inside the div, labelling the book's value ids in order:

```
{serves="4–6 | 8–12 | 16–24"}
::: recipe
## Lobio: beans with walnuts and spices

:choose:{of=serves}
:choose:{of=measure}

### For the beans

- `350g | 700g | 1.4kg / 12 oz | 1½ lb | 3 lb / 2 cups | 4 cups | 8 cups` dried borlotti beans
- `1 tsp | 2 tsp | 4 tsp` ground _marigold_ petals
:::
```

With overrides on blocks, frontmatter is only ever book-level and needs no chapter-level key. A one-recipe chapter is a chapter with one recipe div; the author still sees the serves labels just above the quantities. A `:choose:` directive binds to the nearest enclosing scope.

Prior art: Quarto grouped tabsets, Docusaurus `<Tabs groupId>` and MkDocs Material linked tabs (shared, persisted reader choice); Quarto `content-visible when-…` (conditional blocks); Cooklang and RecipeMD (inline or leading quantities, but linear scaling, which hand-written quantities like "5 or 6 → 10–12" rule out); h-recipe and schema.org Recipe (output semantics: the recipe class can stamp `h-recipe` / `p-ingredient` classes for free).

## Decided: the quantity shorthand lives in code spans (2026-11-19)

Inside a scope, an inline code span is a variant grid: `|` separates the serves values and `/` the measures, each in declared order; a quantity with no `/` is the same in every measure. Only the quantity is in the code span, so the rest of the line stays Djot (emphasis, links). A recipe has no other use for inline code, and without the extension the line still reads, in monospace. The transform replaces the code span with variant spans; no `<code>` reaches the book. Explicit spans (`[350g]{when=serves:1x}`) remain for anything the shorthand cannot express.

A part count that does not match the values in force (two parts in a three-serve recipe, two `/` groups against three measures) is a finding shown in the preview, as family-history shows its findings.

## Decided: each recipe keeps its own setting (2026-11-19)

Tapping 8–12 in one recipe does not change another recipe on the same page; unlike Quarto's tab groups, a block-scoped choice is per block. Book-wide choices (measure, level) apply to every page.

## Decided: a recipe remembers its setting, keyed by its heading id (2026-11-19)

A block-scoped choice is stored per block, under the book identifier, the chapter idref and the id of the block's first heading (Djot gives every heading one, so the author writes nothing). The case that settles it: a cook scaling for 16 leaves the reading app, some reading apps reload the page on return, and a reset would silently show the 4–6 quantities mid-recipe. Renaming the heading forgets the setting, which is harmless. A block with no heading is not remembered.

## Decided: cover mode is visual only; listeners are out of scope (2026-11-19)

Covered text is blanked visually and stays exposed to assistive technology, so a listener hears the whole passage: the full content, no exercise. Nothing is withheld and no reader-facing strings are added. A covered passage still reveals from the keyboard (focusable; Enter or Space) as well as by tap. Vision-impaired learners working from a textbook are a subject of their own, not this extension's first version.

## Decided: print shows the defaults, as without scripts (2026-11-19)

Print and the PDF render like a reading system that runs no scripts: each choice at its default, controls as plain text naming the default, covered text plain. Considered and declined: print as a third context showing every value (yields side by side, all language levels). Not a complete experience on paper; the limitation is accepted.

## Variant markup

`when=` on any block or span names the values it shows for: space-separated choices are all required, comma-separated values within a choice are alternatives. The language book's transliteration line is `{when=level:english,transliteration}`. Djot passes unknown attributes through to the HTML; the transform rewrites every `when` to a data attribute, so none reaches the XHTML.

## Behaviour without scripts

The build marks every non-default variant off, so a reading system that runs no scripts shows one consistent version (serves at the default, metric). Controls do nothing there, so the build renders each `:choose:` as plain text naming the default ("Serves 4–6") and the script swaps in the buttons.

## Reading-system script

One shipped script and one generic stylesheet (`.off`, `.covered`), no per-book CSS. Book-wide choices are stored in localStorage keyed by the book's identifier, stamped into each page at build time from the OPF (`ctx.readManifestText`), so two books in one reading app never share a setting. A stored value the declaration no longer offers falls back to the default without overwriting the store.

## Proposed phases

On a feature branch, merging per phase. Each phase is checked in SEED.html's preview, then on the reading systems the "Dynamic Content" overview lists as running scripts (Books on iOS and macOS, Thorium at least).

1. Book-wide choices: the frontmatter declaration and register, `when=` variants, generated `:choose:` controls, the reading-system script with per-book storage, and no-script / print defaults. Test book: "Dynamic Content" rewritten in Djot with book-wide serves and measures.
2. Recipes: block scopes with choice-named attributes, the code-span shorthand with its count findings, per-recipe storage keyed by heading id, the `recipe` class with h-recipe semantics, and responsive layout alongside. Test book: the same, two recipes in one chapter.
3. Cover mode and cumulative levels. Test book: the Language Resource Sample's lesson rewritten in Djot.

## Open

- Register path, and whether the register stamp check is wanted.
- Other text formats: the DOM side works on any format's classes and inline code; the directive needs a carrier per format (Djot only at first, as for the family-history directives).
- Test books: rewrite "Dynamic Content" in Djot as the recipe demo; the Language Resource Sample as the second case for cover mode and cumulative levels.
