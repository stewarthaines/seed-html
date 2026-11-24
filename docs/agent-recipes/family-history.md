---
id: family-history
title: Family history books
requires: family-history
summary: Person chapters with records, photographs with named faces, document crops, place maps, and research chapters with notes — how family-history, photo-regions, place-maps, figures and djot combine.
---
# Recipe: family history books

For a project whose transforms include `SOURCE/extensions/family-history/`. It describes how the extensions fit together; the project's own transform scripts decide what renders, so where this recipe and a script disagree, believe the script. Each extension's script opens with a comment that documents it in full.

## What each extension contributes

- **family-history** (DOM transform): reads person records and renders the markers `:family:` (kinship panel), `:tree:`, `:lifeline:`, `:portraits:`, `:portrait:`, `:family-index:` and `:map:`. Problems with the records (schema errors, duplicate stubs, unknown ids) are listed at the top of every `:family:` panel.
- **photo-regions** (DOM transform, with a panel in the app): `:region:` names faces in the photograph just before it; `:detail:` crops one region of an image on its own. It records every bound region in `SOURCE/data/regions/<chapter>.json`, which family-history reads for portraits.
- **place-maps** (plugin): keeps the register `SOURCE/plugins/place-maps/places.json`; family-history inlines the map it names for a place.
- **figures** (DOM transform): `![alt](src){.figure title="…"}` becomes a figure with the title as its caption.
- **djot** (text transform): the source syntax, including footnotes; see the project's syntax reference.

## Person chapters and records

- A person with a chapter of their own: the chapter id is their person id (lowercase, `_` between words). Other chapters, regions and links refer to it, so never rename it.
- The record is the chapter's YAML frontmatter. Keys: `display`, `nickname`, `birth`, `death`, `birthplace`, `deathplace`, `parents: [id, id]`, `partner`, `married`, `married_place`, `others`. `partner` is one id, with the record's own `married` and `married_place`, or a list of ids or `{ id, married, married_place }`. With a list, `married` beside it is an error.
- Dates are EDTF or bare years: `1874-06-13`, `1838~` (about), `1839-02-28?` (uncertain). Give a range of possible years as one approximate year (`1840~` for census ages pointing to 1838–1842) and keep the reasoning in a frontmatter comment and the research chapter. A range (`1838/1842`) shows in full only in the person's own panel, with trees and lifelines showing its first year, and `187X` is read aloud as a guessed year.
- Dates format in the book's language: `en` gives "March 12, 1828", `en-GB` gives "12 March 1828". The language is set in Details, which the bridge cannot change, so tell the author when it does not suit the book.
- People with no chapter are records under `others:` in the chapter they belong with, in the same shape. Define each id once: a chapter's own record beats a stub with that id, and a second stub is an error. A stub with no parents, partner or children is reported as an orphan.
- Children and siblings are derived from `parents:`. Never list them.
- Each chapter's record is copied to `SOURCE/data/frontmatter/<chapter>.json` when that chapter renders, and other chapters read that copy. After changing a record, render its chapter, then the chapters that show the person: panels, trees and the index chapter. After adding several person chapters at once, render the whole book twice: the first pass writes every record copy, the second lets each panel and tree read them all.
- Marker attributes: `:tree:{depth=2}` shows two generations down from the person. `:tree:{to=id via=id}` draws the path between two blood relatives through their shared ancestor `via`; the target must descend from that ancestor, so someone with no `parents:`, such as a second wife, cannot be the target. Target a blood relative instead: the ancestor's node shows all of their marriages. `:lifeline:{of=id as=Name}` lines that follow one another share one time scale; bare `:lifeline:` is the chapter's person.
- Comments (`# …`) in the frontmatter are kept in the source and never rendered; they are the place for a record's sources and doubts.

## Photographs

- A figure is its own paragraph: `![alt](../Images/x.jpg){.figure title="Caption"}`. The alt describes the picture; the title is the visible caption.
- Faces: one `:region:{at="x,y,w,h" of=person_id as="Name" row="Back"}` line per face, directly after the figure paragraph, with no blank line between the lines. `at` is the box in percent of the image, x and y from the top left. `of=` must be a person id; leave it out and give only `as=` for someone with no record. Binding is strict: anything between the figure and its regions turns the regions into visible text.
- Check a box before writing it by cropping the image at those percentages: in a small scan a box 5% off misses the face.
- Portraits (`:portraits:`, `:portrait:`) crop a person's regions from every chapter. A crop needs the image's pixel size in the regions record of the chapter that holds the photograph. photo-regions from app 0.30.0 reads the size from the image itself; an older copy in the book records it only for photos whose regions were saved in the Photo Regions panel. The record is rewritten only when that chapter renders. A warning that a photograph's pixel size is unknown means an entry without `size` in one of the `SOURCE/data/regions/*.json` files: check the extension version, then render the chapter that holds the photo.

## Documents

- `:detail:{src="../Images/x.jpg" at="x,y,w,h" size="WxH" alt="…" caption="…"}` shows one region of a scan, such as a register entry or a signature. `size` is the image's pixel size and is required, as is `alt`. Several detail lines together make one figure.
- The full transcription goes in the research chapter, as a code block or quoted text, next to the crop or linked from it.

## Places

- The place strings in records (`birthplace`, `deathplace`, `married_place`) are written to `SOURCE/data/places/<chapter>.json` for the place-maps plugin. A map renders only for a place in its register.
- `:family:{map=birth}` (or `death`, `married`) puts a map in the panel; `:map:{of=… event=…}` or `:map:{place="…"}` places one in the prose.

## Research chapters and notes

- Research and notes chapters go at the back of the book, in the reading order. Not `linear="no"`: Apple Books opens those in a window with its own fixed layout, which ignores the reader's text size and cuts off wide content.
- To link into a research section, put an explicit id on the line above its heading, `{#richard-maxted-1883}`, and link `research.xhtml#richard-maxted-1883`. Ids made from heading text change when the heading does.
- Citations and short glosses go in djot footnotes. Apple Books shows them as pop-ups, unstyled and at a size it chooses, so keep each to a sentence or two and link on to the research section for more.

## Editing over the bridge

- Create a person chapter with `seed_create_chapter`: the person id as the chapter id, the frontmatter at the head of `text`, placed with `after`. Its XHTML is a placeholder until it is rendered.
- Check chapters that are not open by rendering them and reading `OEBPS/Text/<id>.xhtml` with `seed_read_file`: a `:family:` panel with problems in its records opens with their list.
- `seed_write_file` replaces the whole file. After writing a long chapter, check that its size changed by exactly the bytes inserted minus the bytes replaced; anything else means text was lost or altered in the rewrite.
- Add images with `seed_add_media` from a folder the author has allowed, under descriptive names (`allen_hattie_marg_jim.jpg`), and use the `fromChapter` path it returns in the markup.
- Render with `seed_render`, which does not move the author's preview, after editing chapters that are not open.
