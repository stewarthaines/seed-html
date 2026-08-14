# Photo regions in chapter markup — `:region:` directives

Status: DRAFT for discussion, 2026-08-14.

## Motivation

The photo-regions plugin currently has two transports, and neither fits the general case:

- The legacy `photos:` YAML frontmatter insert (phase 4b) — authorial and editable, but a YAML island inside a djot chapter, and retired for the Haines book.
- The phase 4h store-reading pipeline — the book's own transform reads `SOURCE/plugins/photo-regions/regions.json` directly. Drawing and naming in the panel is the authoring act; there is no insert step. This is elegant but couples rendering to book-local scripts (`markerFilter`, `facesSetup` in `SOURCE/scripts/`), which a fresh project doesn't have. It also gave up the explicit insert gate and track-changes coverage of identifications.

The audio-clip plugin shows a third shape: the directive **surfaces the actual parameters in the chapter source**. `:clip[Chorus]{src="../Audio/a.mp3" begin="0:00:05.00" end="0:00:15.00"}` remains readable, editable, and tweakable with no plugin present — including when the core app is loaded over a `file:` URL. This document proposes the same for photo regions.

## Proposed markup

```
![The Kenya team, 1972](../Images/team.jpg){.figure .name-faces title="The survey team at Nairobi."}

:region:{at="5.20,17.70,11.40,21.98" as="Roger King" row="Back"}
:region:{at="17.32,14.76,9.87,20.44" as="Ian Vitcheff" row="Back"}
```

Following the `:lifeline:` precedent rather than a `:::` fenced div: **consecutive `:region:` lines form one djot paragraph, and that paragraph is the region set**. The grouping rule is already proven in the Haines book (markers on consecutive lines become one `.lifeline-set`; prose starts a new group). This avoids the `:::` div fence entirely, which matters because the fence is djot syntax with no portable equivalent in the other source formats — a bare run of directive lines is closer to format-neutral, and it is one less piece of wrapper syntax for the template mechanism to reproduce.

### Attribute vocabulary

| Attribute | Meaning | Required | Notes |
|---|---|---|---|
| `at="x,y,w,h"` | region geometry, percent of the image box | yes | same value shape as the YAML `at:` and Media Fragments `xywh=percent:`; percent DECIDED 2026-08-14, see below |
| `as="Roger King"` | display name | yes, unless `of=` given | |
| `of=person_id` | person id → chapter link | no | keeps the `of=` = person convention from `:lifeline:`/`:portraits:` |
| `row="Back"` | row grouping label | no | default `Pictured`, as in the YAML form |
| `badge="x,y"` | badge top-left, percent | no | only when moved off the computed default |

The draft sketch used `of=` for the coordinates. Proposing `at=` instead: `at:` is already the geometry key in the YAML form, and `of=` already means *person* in the sibling directives (`:lifeline:{of=thomas_haynes}`, `:portraits:{of=…}`). Keeping `of=` for the person id preserves that vernacular and gives the directive a natural place for the chapter-link id when a book has person chapters.

Djot authoring trap, inherited from `:lifeline:`: attributes are space-separated `key=value` — no commas, no colons. `{at="…", as: "Tom"}` fails djot's attribute parser and the marker stays visible as literal text. Values with dots or spaces must be quoted (djot rejects bare values containing `.`, which every `at=` value has).

### Coordinate system: percent (DECIDED 2026-08-14)

`at=` values are percentages of the image's own box, matching the store and Media Fragments `xywh=percent:`. Absolute pixels were considered for author legibility (cross-checking in an external image tool) and rejected:

- Percent renders as CSS inline percentages with no knowledge of the image's natural size — the reason the name-faces overlay never needed a `size:` field. Pixels would reintroduce that dependency as a `size="WxH"` attribute on every block, a stale trap the moment it drifts from the actual file.
- Percent survives image re-export at a different resolution (common for family-history scans); pixel regions would all silently break, and with insert-only authoring there is no cheap re-derivation.
- Insert performs no conversion, so delete-and-re-insert reproduces identical values.
- Hand-edits are tweak-scale, and a percent nudge is a visually similar step at any image resolution.

If external-tool measurement ever matters, the escape hatch is an explicit unit prefix accepted by the transform (`at="pixel:74,177,162,220"`, Media Fragments' own convention) — an alternate spelling, not a change of default. Not built speculatively.

### Binding to the photo

The region paragraph binds to the **nearest preceding image** in the same section — in practice, the figure line directly above it. This is data-bearing adjacency, not the rejected marker-modifies-neighbour idiom: the `:faces:` flag was rejected because it was a *switch* pretending to be content, whereas `:region:` lines *are* the content, in the same way consecutive `:lifeline:` lines are the chart.

Open question: whether `.name-faces` on the image stays required. The presence of a region paragraph could imply the treatment (class-free), or the class could remain the opt-in and the regions inert without it. Leaning towards presence-implies: one less thing to forget, and a region paragraph with no styling applied is a confusing authoring dead end.

## Per-project template

Following the `audio_clip_template` pattern exactly:

- `photo_region_template` on `EPUBSettings` in `SOURCE/settings.json`.
- Default (djot, quoted): `:region:{at="<at>" as="<as>" row="<row>"}`.
- Placeholders: `<at>` required; `<as>`, `<of>`, `<row>`, `<badge>` optional. Validation via `validateEPUBSettings` like the clip template's required-placeholder check.
- The template is **per region line**; the plugin's Insert emits one filled line per named region, sorted by row then left-to-right by `x` (the badge-numbering order), joined with newlines. Optional attributes with no value are omitted along with their `attr="…"` wrapper — this needs slightly smarter filling than the clip formatter's simple substitution (a `row="<row>"` with no row must vanish, not emit `row=""`).
- Per-format override via `extension.json` `templates.photoRegion`, next to `templates.audioClip` (markdown-it gets the unquoted variant, etc.).
- Editable in Project Settings → EPUB beside the Audio Clip Directive field.
- Default duplicated in the plugin (`plugins/photo-regions/src/template.ts` equivalent) since plugins build separately and read `SOURCE/settings.json` themselves.

## Source of truth, and what regions.json becomes

The proposal inverts phase 4h for the general case, so the roles need restating:

- **The chapter markup is the source of truth for rendering.** The transform pipeline consumes `:region:` directives only; it never reads the store.
- **`regions.json` is the plugin's working library** — draft space where boxes are drawn, badges nudged, names filled in before anything is inserted. It keeps its v2 schema, book-readable contract, and agent-bridge access unchanged.
- Insert is the explicit authoring gate again — which also restores track-changes coverage of identifications (a 4h concession) and file:-URL editability for free.

The Haines book is unaffected: its 4h store-reading pipeline lives entirely in its own `SOURCE/scripts/` and keeps working. Whether it ever migrates to markup is its own decision, not a blocker here.

## Rendering pipeline

Mirroring the clip architecture (format filter → neutral HTML → DOM transform extension):

1. **Format-side filter**: djot's HTML renderer drops attributes on symbols, so `:region:` needs an AST filter in `extensions/djot/transformDjot.js` beside `clipFilter`. It converts a region paragraph into a neutral carrier, e.g. `<div class="region-set"><span class="region" data-at="…" data-as="…" data-row="…"></span>…</div>`, attached with knowledge of the preceding image. Other formats add their equivalent as/when they support the directive (exactly the clip situation).
2. **DOM transform extension**: a new `extensions/photo-regions/` DOM transform (the app-side graduation of the book's `facesSetup`) finds each carrier, locates its figure, and builds the overlay boxes, the numbered chips, and the row-grouped caption list appended to the `figcaption`.
3. **Stylesheet**: the `.fc-*` family ships in the extension's CSS — box/chip pairing via `figure.name-faces:has(.fc-name-N:hover) .fc-box-N`, overlay `pointer-events: none` and `aria-hidden`, boxes invisible at rest. The static pairing ceiling (20 faces, 8 rows) comes along until something better exists.

Geometry is percent-of-image-box, so the overlay needs no `size:` — one of the YAML form's fields that simply disappears.

## Gaps and open questions

1. **Round-trip.** DECIDED 2026-08-14: insert-only. Authoring is either insert-then-manual-tweak, or delete the block and re-insert. The plugin never reads markup back, and Insert never edits existing paragraphs — nothing more complicated is needed.
2. **`of=` link resolution.** In the Haines book, person ids resolve to chapters and crop links derive from `SOURCE/data/figures/<id>.json` — both book conventions. The generic extension needs a defined, degradable behaviour: link to `#person_id` / chapter if resolvable, plain text otherwise. Crop-link derivation probably stays book-territory.
3. **Binding edge cases.** Two images in one figure; a region paragraph separated from its image by a caption paragraph; a region paragraph with no preceding image at all (render nothing? leave literal text as the breadcrumb, per the lifeline failure mode?).
4. **Non-djot formats.** `:region:{…}` passes through markdown as literal text until markdown-it grows a handler, same as `:clip`. Acceptable staging, but worth stating.
5. **Attribute-name bikeshed.** `at=` vs the sketch's `of=` for geometry — see vocabulary section; needs a decision before templates ossify it.
6. **Conditional placeholders.** The template filler needs omit-when-empty semantics for optional attributes; the clip formatter has nothing like it (its only optional, `rate`, is injected by code, not template). Simplest rule: a placeholder's enclosing `name="…"` token vanishes when the value is empty.
7. **`.name-faces` opt-in vs presence-implies** — see binding section.
