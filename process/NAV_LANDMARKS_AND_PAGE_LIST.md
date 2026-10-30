# Landmarks and page-list in the EPUB nav

Status: proposal, 2026-10-28. Un-parks the landmarks idea from 2026-09-27 (memory `nav-landmarks-parked`), whose trigger was "a store submission or an accessibility check needs landmarks". Both have now happened: the _John, Paul, and George_ EPUB for Kindle (KDP) needs a chosen start position, and it carries print page markers that no reader can navigate because the book has no page-list.

## The problem

Every nav SEED writes is a single `<nav epub:type="toc">`. `OutlineGenerator.processUserContent` wraps a hand-written `nav.txt` in one toc nav, and `generateNavigationXHTML` does the same for the generated nav. So no book can carry the two other navs EPUB 3 defines.

**Landmarks** (`<nav epub:type="landmarks">`) name the book's major parts. The one that matters most is `bodymatter`, which says where reading begins. Kindle's converter uses it as the "start reading location": where the book opens the first time, and where "Go to Beginning" jumps. Apple Books uses it to open new books, and to cut the store sample of a fixed-layout book when no custom sample is uploaded. Without landmarks each reading system guesses, and Kindle often opens on the title page or the contents.

**The page-list** (`<nav epub:type="page-list">`) lists the print page markers, so a reader can go to page 87 of the paperback. A book can already contain the markers (`role="doc-pagebreak"` spans), and the Details form already offers the `pageBreakMarkers` and `pageNavigation` accessibility features. Without a page-list, an author can't truthfully claim `pageNavigation`, and the markers only help readers who stumble across them.

There is a related defect on the same code path: a hand-written nav runs through every DOM transform, so a layout transform such as responsive's `div.sr-page` lands inside `<nav>` (RSC-005; memory `nav-pipeline-runs-dom-transforms`, open since 2026-08-07). _John, Paul, and George_ works around it in its own `transformDom.js`.

## Proposal

### 1. A hand-written nav may hold several navs

If the transformed `nav.txt` contains top-level `nav` elements, or blocks marked as navs, they become the document's navs as written. If it contains none, behaviour is as today: everything is wrapped in one toc nav. Existing books keep working unchanged.

A nav block is recognised in either form. In djot, a div whose class names the nav type:

```
::: toc
# Contents

- [Foreword by Pat Pattison](Text/foreword.xhtml)
- [Essay 1: John, Paul, and George…](Text/essay01.xhtml)
:::

::: landmarks
- [Contents](nav.xhtml#toc){epub:type=toc}
- [Start reading](Text/foreword.xhtml){epub:type=bodymatter}
:::

::: page-list
- [1](Text/titlepage.xhtml#page1)
- [2](Text/copyright.xhtml#page2)
:::
```

Or raw HTML `<nav epub:type="…">` blocks, for authors who generate the nav with a script, as _John, Paul, and George_ does.

Each recognised block is normalised to what its nav type allows. The toc and page-list get an optional heading and one `ol`. Landmarks get one `ol` whose links each carry an `epub:type`. `ul` becomes `ol`, `section` is unwrapped, and a list item's paragraph is lifted into the `li`. That last step needs extending: today only a sole child paragraph is lifted, so djot's loose nested lists (`li > p + ol`) still produce an invalid `p` in the toc.

The landmarks and page-list navs get the `hidden` attribute. They are for the reading system's menus; a reader that renders `nav.xhtml` as a page should show only the contents.

A `nav.txt` that holds landmarks or page-list blocks but no toc block gets a toc generated from the spine, exactly as the generated nav would write it (decided 2026-10-28: the convenience is worth mixing authored and generated navs in one document).

Checks before writing, reported in the checks panel rather than silently repaired: at most one toc nav; every landmarks link has an `epub:type`; every page-list and landmarks href resolves to an existing file and id. epubcheck reports the same problems, but only after packaging; these show while the nav is being written.

### 2. The nav runs the text transform only

Layout and structure transforms are meaningless for a navigation document and can make it invalid. The nav build runs the project's text transform, then the normalisation above, and skips `dom_transforms`. This closes the 2026-08-07 bug and lets _John, Paul, and George_ drop its `idref === 'nav'` workaround.

If an author ever needs a DOM transform on the nav, that becomes an explicit opt-in (for example a `nav_dom_transforms` setting). It isn't the default.

### 3. The generated nav gains landmarks and a page-list, from things the author chose

The no-fallback rule means the generated nav adds nothing the author didn't ask for.

**Start reading here.** A book-level choice in Book › Contents, beside the chapter order where the reading sequence is already shown (one chapter at most; decided 2026-10-28). When set, the generated nav carries a landmarks nav with `toc` → `nav.xhtml#toc` and `bodymatter` → that chapter. When unset, no landmarks nav is written, so existing books are unchanged.

**Page list.** Derived from content, not invented. At packaging the generated nav scans the chapters' XHTML for `[epub:type~="pagebreak"], [role="doc-pagebreak"]` elements with an id, in spine order. If there are any, it writes a page-list. The label comes from the marker's `title`, then `aria-label`, then its text. If there are none, no page-list is written. This is phase 3 of `process/PDF_PAGE_INDEX.md`, which planned exactly this nav.

`ensureGeneratedNav` (`src/lib/outline/nav-coherence.ts`) already regenerates the auto nav at packaging, so both additions stay in sync with the spine without the Navigation view being open.

### 4. The OPF guide, for older Kindle pipelines

When a `bodymatter` landmark exists, the package also gets `<guide><reference type="text" title="Start" href="…"/></guide>` pointing at the same place. EPUB 3 still permits the guide. Forum reports say Kindle's converter prefers the landmarks nav when both exist, and some publishers set both because older paths read only the guide. It's cheap, it is derived from the author's choice, and it's dropped if Kindle Previewer shows it's unnecessary.

### Not proposed: metadata checks

The app does not check accessibility metadata against the content (for example `pageNavigation` claimed with no page-list). Keeping the claims truthful stays the author's responsibility. The checks panel stays limited to what axe and epubcheck report; SEED has never added checks of its own on metadata, and this proposal doesn't start.

## Adjacent fix

A new project's initial `nav.xhtml` comes from `ContentService.generateNavigationContent` (`src/lib/services/content/content.service.ts`). It shows untranslated i18n keys (`navigation.title`, `navigation.tableOfContents`, `content.chapter01`) and goes stale as soon as chapters change. It should come from `OutlineGenerator.generateFromSpine` like every other generated nav. This is a small change, independent of the rest.

## Phasing

**Phase 1: hand-written multi-nav and the text-transform-only nav build (sections 1, 2).** This unblocks _John, Paul, and George_: landmarks with `bodymatter` → the Foreword, and the page-list from its 216 markers, both written by its generator script into `nav.txt`. It also removes the book's workaround.

**Phase 2: generated landmarks and page-list (section 3), and the guide (section 4).** Adds "Start reading here" to Book › Contents and the marker scan to `generateFromSpine`.

**The adjacent fix.** Small and independent; it can ship at any time.

A related follow-on, not part of this proposal: generated-nav options for depth (chapters only, or chapters and `h2` sections), label source (chapter title, or `h1` with a separator after a label span; today "Essay 1John, Paul…"), and a "leave out of contents" flag for title and copyright pages. _John, Paul, and George_ needed all three and wrote its nav by hand instead.

## Testing

Unit tests for the normalisation (each nav type, loose djot lists, raw HTML navs, a `nav.txt` with no nav blocks) and for the marker scan.

epubcheck on a sample with all three navs, on one with only a toc (unchanged output), and on one with a deliberately broken page-list href (reported, not written).

On devices: Kindle Previewer for the start reading location, Apple Books for first open and page navigation, and Thorium for the page-list and landmarks menus. _John, Paul, and George_ is the real-world case.

## Open questions

1. ~~Should a hand-written `nav.txt` be allowed to omit the toc block?~~ Decided 2026-10-28: yes, and SEED generates the toc (section 1).
2. ~~Where does "Start reading here" live?~~ Decided 2026-10-28: Book › Contents, beside the chapter order (section 3).
3. The guide reference type: EPUB 2's `text`, or Amazon's `start`? Reports say both work on Kindle. Left open by decision (2026-10-28) until Kindle Previewer has been run on _John, Paul, and George_ with each value; the same run shows whether the guide is needed at all.
