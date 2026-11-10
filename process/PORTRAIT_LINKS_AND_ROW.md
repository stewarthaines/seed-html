# Portraits: links to the photograph, and a single `:portrait:`

Status: Parts 1 and 2 BUILT 2026-11-10 on branch `portrait-links`. Two changes to the family-history extension, the first also touching photo-regions. No core app change.

## Problem

A crop in a `:portraits:` strip links to the chapter showing the photograph, not to the photograph. In a long chapter the reader lands at the top and has to find it. A crop in the chapter being rendered isn't linked at all, though the photograph may be further down the page.

There is also no way to put chosen portraits of several people side by side: four generations, say — great-grandfather, grandfather, mother and author — one face each, at the same height, captioned. A strip is every photograph of one person, uncaptioned.

## Part 1: link to the photograph

**photo-regions gives every figure it binds an id, and records it.** An id the author gave the image paragraph (`{#…}` in djot) is kept. An id on the image itself is kept too. Otherwise one is derived from the chapter id and the image's file name, each reduced to letters, digits, `-` and `_`: `Images/john_parry_tenby.jpg` in `david_wilson_parry` → `photo-david_wilson_parry-john_parry_tenby`. The chapter id is there because the PDF joins every chapter into one document, so ids must be unique across the book (the same reason `:detail:` ids carry it). A second figure of the same image in one chapter, or a clash with any other id already in the chapter, takes `-2`, `-3`.

**The id goes into the regions record.** Each entry in `SOURCE/data/regions/<idref>.json` gains `"id": "photo-david_wilson_parry-john_parry_tenby"` beside `href`, `at`, `of`, `as`, `row` and `size`. family-history reads the id from the record and never derives one itself, so the two extensions stay joined only by the data file they already share, as they are now.

**family-history links to `<chapter>.xhtml#<id>`.** A crop in the chapter being rendered becomes a link too, to `#<id>`: a jump down the page to the photograph. The accessible names stay as they are ("John Parry in a photograph in David Wilson Parry"; "… in a photograph here" for the current chapter).

**Old records still work.** A record without an id (written before this change, until the chapter renders again) links to the chapter as now, and a current-chapter crop without one stays unlinked.

Fragment links to an element id are plain EPUB navigation; every reading system in use handles them.

## Part 2: `:portrait:`

```
:portrait:{of=john_parry src="john_parry_tenby.jpg"}
:portrait:{of=david_wilson_parry src="parry_wedding.jpg"}
:portrait:{of=nancy_elizabeth_parry}
:portrait:{of=stewart_haines as="Me, 1972"}
```

**One crop per line, consecutive lines one row.** The attributed-symbol carrier already groups consecutive lines into one set, as for `:lifeline:`; a set becomes one row. A bare `:portrait:` is the chapter person's first portrait, a row of one.

**Drawn regions only (decided 2026-11-10).** A crop comes from a region drawn in the Photo Regions panel and recorded by photo-regions, never from a box given inline. A photograph not yet in any chapter gets a face box in the panel first. This keeps one path to a crop's pixel size and to its link, and the faces in a row are framed the same way.

**Attributes.**

- `of=` the person id (default: the chapter's person).
- `src=` which photograph: matched against the end of the recorded image href, so the file name is enough. Quoted, since djot won't take a bare value containing a dot. Without it, the person's first portrait in spine order, the one a strip shows first.
- `as=` the caption, replacing the default.

**Rendered form.**

```html
<div class="portrait-row">
  <figure class="portrait-figure">
    <a
      class="portrait"
      href="david_wilson_parry.xhtml#photo-david_wilson_parry-john_parry_tenby"
      aria-label="John Parry in a photograph in David Wilson Parry"
      style="…crop…"
    ></a>
    <figcaption><a href="john_parry.xhtml">John Parry</a> 1796–1883</figcaption>
  </figure>
  …
</div>
```

The crop is the same element a strip uses (same code, same link from Part 1), at the same fixed height, so faces line up whatever each region's aspect. The caption is the person's name, linked to their chapter when they have one (not the current chapter), with their years in the form the panel's relative lists use (`1859–1939`, `b. 1908`), on a line of their own. `as=` replaces the name and years. Classes carried on the marker reach the row, as for the other markers.

**CSS** (family.css): the row is a flex row with a gap, wrapping on a narrow column and centred; each figure is as wide as its crop, the caption small and centred beneath; `break-inside: avoid` on the row for print, and the same `print-color-adjust` as the strip. Four portrait-shaped crops at 7em fit a phone column.

**Nothing found, nothing rendered.** An unknown person, no regions for them, a `src=` matching none of their photographs, or a photograph whose pixel size is unknown drops that figure with a console warning naming what to fix (for the size, the existing hint to open the photograph once in the Photo Regions panel). A `src=` matching more than one of the person's photographs takes the first in spine order and warns, asking for more of the path. A row with no figures left disappears. These are console warnings, as for strips and maps, not panel findings: findings are gathered when the records load, before any marker renders.

**A marker of its own, not an option on `:portraits:`.** A strip is "every photograph of one person", uncaptioned; a row is "one photograph each of several people", captioned. They share the crop code, not the grammar.

## Changes

- `extensions/photo-regions/transformRegions.js`: figure id (keep, else derive, de-duplicate), `id` in each record, header comment's record shape.
- `extensions/family-history/transformFamily.js`: `id` carried into the portraits list; `portraitElement` links to the fragment, including in the current chapter; `portraitSetup` for `:portrait:` sets; `'portrait'` in `BARE_CARRIERS` and in the wanted-check; header comment; labels for any new strings (en, de).
- `extensions/family-history/family.css`: `.portrait-row`, `.portrait-figure`.
- Tests: photo-regions (ids kept, derived, de-duplicated, recorded) and family-history (fragment links, current-chapter link, a row from consecutive lines, `src=` choice and ambiguity, captions with years and `as=`, findings for each missing case).
- The books: both family books carry their own copies of these extension files and get them written in after the change, as for place maps.

## Decided

- No highlight of the face on arrival (2026-11-10): the rendering stays static; the badges and caption list already pair names with faces.
