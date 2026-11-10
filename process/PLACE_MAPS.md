# Place maps — locator maps beside birthplaces

Status: ALL THREE PHASES BUILT on branch `place-maps` (all committed, not merged). Default styling set 2026-11-10. A family-history feature made of a panel plugin and a family-history extension change; the core app gains no new view.

## Problem

Family-history records carry `birthplace`, `deathplace` and `married_place` as free text ("Ballarat", "Weston, Natal", "Ludchurch, Pembrokeshire"). A reader who doesn't know where Ludchurch is gets nothing from the name. A small locator map beside the place says it at a glance: which country, which part of it.

Two constraints shape the design. The map must not be fetched on every pipeline run: transforms cannot fetch, and a book must build offline. And the map is a book resource: it travels in the manifest, and the author can see, replace and remove it.

## Shape: the photo-regions pattern

The family-history project type is pure extension, and photo-regions is the model for adding to it without coupling. The photo-regions plugin records data under `SOURCE/plugins/photo-regions/`; family-history reads that data by path and degrades to nothing when it is absent. Place maps follow the same split.

- **A place-maps panel plugin** resolves place names and makes the map files, once, at authoring time. It is the only part that touches the network. It knows nothing of family-history's records.
- **The family-history extension** tells the plugin which places a chapter uses, through a neutral file, and reads the register the plugin wrote to inline the map. It never fetches.
- **The book does not depend on the plugin.** The register and the SVGs travel in the book, so it renders the same from a `file:` URL, without the plugin, or in someone else's copy. The plugin is needed only to make or change a map.

## No coupling: three file contracts

The plugin must not read `birthplace`, `deathplace` or `married_place` itself: that would tie it to family-history's record schema. Nor may it hard-code family-history's `:map:` directive. Each direction goes through a contract that either side can be missing from.

**Places used: written by the extension, read by the plugin.** The photo-regions pattern in reverse: today the photo-regions transform writes `SOURCE/data/regions/<chapter>.json` and family-history reads it. Here the family-history transform, which already walks every record as it renders a chapter, writes the place strings it met to `SOURCE/data/places/<chapter>.json`:

```json
[
  { "text": "Ballarat", "label": "Leslie Russell Pattenden, born" },
  { "text": "Weston, Natal", "label": "Esther Blake, married" }
]
```

`text` is the place string exactly as written; `label` is free text for the panel row, so the plugin can show who and what without knowing about events. Any extension can write this file (a travel book, a local history, letters); the plugin reads only this shape.

**The insert template: in settings.** The plugin inserts `settings.json`'s `place_map_template`, filling `<place>` with the register key, exactly as `photo_region_template` works today. The family-history project type supplies `:map:{place="<place>"}`. No template, no Insert button.

**The register: written by the plugin, read by the extension.** `SOURCE/plugins/place-maps/places.json` (below). family-history finds it by path, the same soft dependency portraits have on the regions files; absent register, no maps, no error.

So the plugin knows three things: the places-list shape, its own register, and a settings template. family-history writes one and reads one. Neither imports the other.

## Map style: a drawn locator map

A locator map is an outline of the country with the state tinted and a dot for the place, drawn from bundled Natural Earth outlines (public domain). The plugin draws the SVG itself.

- Tiny files (a few KB), and the book needs no attribution.
- Drawn with `currentColor` and the book's classes, so it follows the reading system's theme and dark mode.
- The convention printed family histories already use: where in Victoria, where in Wales. Street detail adds nothing at this size.
- The plugin works offline once built, as the plugin spec asks; only geocoding needs the network.

Rejected: OpenStreetMap tiles saved as PNG. They need "© OpenStreetMap contributors" in the book, the tile policy discourages offline copies, and a raster doesn't follow the theme.

## Geocoding

Place names resolve through OSM Nominatim at authoring time: one request per place, at most one per second, with an identifying client name, which is within its usage policy. Only coordinates and the resolved name are kept; no OSM content enters the book.

Names are ambiguous (dozens of Westons), so resolution is always the author's pick from candidates, never automatic. The candidate list shows each match with its country and state or county.

## The register

`SOURCE/plugins/place-maps/places.json`, written by the plugin, read by family-history. Keyed by the place string exactly as the places list (or the author's search) gave it, so frontmatter does not change.

Each entry holds: the resolved name ("Ballarat, Victoria, Australia"), latitude and longitude, the geocoder and date, the country and state it falls in, and the map's manifest href. Variant strings ("Ballarat", "Ballarat East") can alias one entry. An entry made by the country-and-state fallback (below) has no coordinates, and its map has no dot.

```json
{
  "version": 1,
  "places": {
    "Ballarat": {
      "name": "Ballarat, Victoria, Australia",
      "lat": -37.5622,
      "lon": 143.8503,
      "source": "nominatim 2026-11-09",
      "country": "AUS",
      "region": "Victoria",
      "href": "Images/maps/ballarat.svg"
    },
    "Ballarat East": { "alias": "Ballarat" },
    "Pembrokeshire": {
      "name": "Wales, United Kingdom",
      "source": "author 2026-11-09",
      "country": "GBR",
      "region": "Wales",
      "href": "Images/maps/pembrokeshire.svg"
    }
  }
}
```

## In the chapter

**`:family:{map=birth}`** shows a map beside the panel person's birthplace. `map=death` and `map=married` (the first partnership with a place) pick the other events. The value names the event, not the place, so the place is written once (in frontmatter) and a corrected birthplace carries its map with it.

**`:map:`** places a captioned map in prose, such as a migration paragraph. Its attributes follow the other family-history directives, where `of=` is always a person: `of=` the person (default the chapter's), `event=` birth, death or married (default birth), or `place="…"` a register key as written, for a place no record names. Bare `:map:` is the chapter person's birthplace. (A first draft overloaded `of=` with `<id>.<event>`; djot's bare attribute values reject the dot, and `of=` meaning something other than a person broke the family convention.) Event names are resolved by family-history inside its own transform; the plugin never sees them. The plugin inserts the `place=` form through the settings template; it can't edit an existing `:family:` directive's attributes, so `map=` on `:family:` is typed by the author.

Maps appear only where asked for: never automatically for every relative in the panel. A place with no map stays plain text, with no placeholder and no error.

The SVG is inlined (read through `ctx.readManifestText`) so it inherits theme colours; chapters that render one need the manifest `svg` property, as `:tree:` chapters already do. Each map carries `role="img"` and an accessible name giving the full resolved place ("Map: Ballarat, Victoria, Australia").

## The panel

A panel above the editor, like photo-regions, scoped to the open chapter through `activeChapterId`. Keyboard-operable throughout: the place list and the candidate list are listboxes, Enter acts on the focused row.

**Starts from the chapter's places, not an empty search.** The panel reads `SOURCE/data/places/<chapter>.json` and lists each place with its labels and status (not located, has a map). No places file, or a place not in it: an empty search box the author types into.

```
Places in this chapter
  Ballarat            Les, Nance, Jill, Dorothy, Lesley   ● map
  Weston, Natal       Esther Blake, married               ○ not located
  Albany, WA          Esther Blake, died                  ○ not located
```

**Search, prefilled.** Choosing a place opens the search with its string filled in; usually Enter is all it takes. The query stays editable, since historical or vague strings need help ("Weston, Natal" → "Weston, KwaZulu-Natal, South Africa"). The geocoder is called only on Search, never as the author types.

**Candidates as thumbnails.** Each candidate row pairs a small render of the actual map (country, tinted state, dot) with its text. "Weston, Uthukela, KwaZulu-Natal, South Africa" is hard to compare against four other Westons as text; the thumbnail settles it at a glance. Choosing one shows the full-size map and **Add map**, which writes the SVG through `add-media` and the register entry.

```
Weston, Natal                                   [ Search ]

 [map]  Weston, KwaZulu-Natal, South Africa
 [map]  Weston-super-Mare, England, United Kingdom
 [map]  Weston, Ontario, Canada
```

**Fallback when the geocoder can't help.** Historical names (Van Diemen's Land, a Prussian village), vanished places and vague ones ("Pembrokeshire") won't always resolve. Two ways on:

- **Country and state only.** Pick both from the bundled outline data; the map shows the state tinted and no dot. Honest for "somewhere in Pembrokeshire", and still useful.
- **Coordinates.** Paste a latitude and longitude from a trusted source; the plugin works out the country and state from the outlines.

**After a map exists,** the row shows its thumbnail and **Insert map**, which inserts the settings template at the cursor (only when the book defines one).

**Book-wide.** A toggle widens the list from this chapter to all places: the union of every chapter's places file plus the register. It adds where each place is used, flags maps nothing uses any more, and allows re-picking a place, which rewrites the same file. The same list, wider; not a separate view.

**Removal** is done in the Files view, like any image; the plugin drops register entries whose file has gone. No "remove media" message is needed.

The list reads only local files; only Search touches the network.

## Core changes

Small, and no new UI design.

1. **`add-media` accepts images.** `isPluginMediaTypeAllowed` (`src/lib/plugins/add-media.ts`) is audio-only; widen it to `image/svg+xml` and `image/png`, and let the plugin name a subfolder (`Images/maps/`) within the media folder.
2. **Mount the panel.** Panel plugins are wired by id in `EditorPane.svelte` (audio, photo-regions). Either add a third slot, or take this as the moment to generalise panel binding, which `src/lib/plugins/API.md` defers until a second plugin of a kind exists.

Extension changes (family-history): write `SOURCE/data/places/<chapter>.json` on render; read the register; the `map=` attribute and `:map:` directive; ship `place_map_template` with the project type's settings.

## Visual design

Settled 2026-11-09 after three rounds of mockups (Ballarat, Ludchurch, Weston, Natal; light and dark; 5em and 12em).

**Two-level is the map.** The country fills the frame, the state (or, in Britain, the nation: Wales, Scotland, England) is tinted in the accent colour, and a dot marks the place. The national view matters more than the local one here: the difference between Ballarat and Melbourne doesn't matter to the reader; which country, and which part of it, does. This replaces the per-place framing switch: every map is framed the same way, so the panel offers no framing choice.

**No globe or inset.** A globe inset placing the country in the world was tried for countries a reader may not know the shape of (South Africa) and declined: not a good use of the space, even there. The two-level map stands alone at every size.

**Rejected in the mockups:** the state alone (KwaZulu-Natal's outline means nothing to most readers); the state with faded neighbouring land (reads as a smudge); a full globe as the whole map (the state disappears); a globe inset beside the two-level map (see above); neighbouring countries faded around the two-level map (adds weight without placing the country).

Styling, all from the book's CSS, nothing coloured in the file. Being CSS, tuning it never means regenerating a map. The defaults below were set 2026-11-10 in family.css and mirrored in the plugin's preview styles.

- Land: `currentColor`, fill opacity about 0.07, stroke at 0.5 opacity, 0.7 wide (stronger than the first 0.2, so the coast holds at 5em; being currentColor it is dark on a light page and light on a dark one). Highlighted state: the accent colour at about 0.35 fill with a solid accent stroke. Dot: accent, on a halo in the paper colour so it reads over the tint.
- The dot's radius is set in CSS (`r` is a CSS geometry property in SVG 2): larger in the panel (6 units, halo 9), smaller in prose (2.6, halo 4.5), so it stays visible at 5em without swamping the large map. The file carries a sensible default `r` for reading systems that ignore the CSS.
- **Event signs** (added 2026-11-10). A map reached through an event (`:family:{map=…}`, or `:map:` by person and event) marks the place with the genealogical sign for that event instead of the dot: `*` born (six arms), `†` died, `⚭` married. This is the European genealogical convention (_genealogische Zeichen_), readable without translation. family-history swaps the dot for the sign as it inlines the map, so the map file and the register stay event-neutral and one map serves a birth and a death. A `place=` map keeps the dot. The signs are SVG paths on a unit box, not text, because `⚭` is missing from many reading-system fonts; CSS sets their size (`transform: scale(…)`, 4 in prose, 7 in the panel) and the stroke scales with them.
- No labels inside the map; the place name is the adjacent text, and the accessible name gives the full resolved place.
- Dark mode needed no changes in the mockup: everything derives from `currentColor`, the paper colour and the accent.

Geometry: Natural Earth 50m countries for the frame, 10m admin-1 for the state, 10m map units for the UK nations; points thinned to 0.6px after projection and islands under a few square pixels dropped. Maps came out 5–20 KB. Mockup renderer and gallery: session scratchpad `maps/` (temporary).

## Phases

1. **family-history shows maps** — built 2026-11-09. `map=` on `:family:`, the `:map:` directive, reading the register, writing the per-chapter places list, styles in `family.css`, four tests in `src/lib/transform/test/family-history.test.ts`. Tried in the Pattenden Family book (user's Chrome, localhost:5173) with hand-made maps for Ballarat, Albany WA, Weston (Natal), Burwash and Coatdyke and a hand-written register.
2. **Core** — built 2026-11-09. `add-media` accepts `image/svg+xml` and `image/png` beside audio, with an optional `folder` (one plain segment, refused otherwise) placing the file at `Images/<folder>/<name>`; `importFileToManifest` takes the subfolder. A third panel slot: `place-maps` resolved in `App.svelte` like photo-regions, threaded through SpineView to EditorPane, offered as "Place Maps" in the Insert menu whenever a text pane is active (no images needed), with insert, add-media and the active chapter. `place_map_template` beside `photo_region_template`: default `:map:{place="<place>"}`, `<place>` required, a text format may override it as `templates.placeMap`, editable under Settings → Format. Generalising panel binding was left for its own refactor. family-history now strips scripts, foreign content, event handlers and links from a map before inlining it, since plugins can add SVG and books arrive from others.
3. **The place-maps plugin** — built 2026-11-09 in `plugins/place-maps/`. Outline data in `geo/` (2.05 MB, one file per country plus `index.json`), built by `scripts/build-geo.mjs` from Natural Earth with mapshaper (pinned, via npx) and committed; Vite copies it to `dist/geo/` beside the single-file `plugin.html` (89 KB). Modules: `register.ts` (the register contract), `render.ts` (the two-level map, view box cropped to the country), `nominatim.ts` (search on request only, one a second), `geo.ts` (country and region lookup), `workspace.ts` and `host.ts` (OPFS and host messages), `App.svelte` (the panel). Unit tests in `src/lib/plugins/test/place-maps.test.ts`; the plugin joins the no-hardcoded-colours guard. Tried end to end in the Pattenden Family book: Bermondsey located through Nominatim, two candidates shown as map thumbnails, the map added at `Images/maps/bermondsey.svg` (4.4 KB) through add-media, the register written, the directive inserted and rendered; placing Southwark by hand (United Kingdom, England) previews a tinted map with no dot.

### Phase 3 findings

- **Winding.** mapshaper writes polygons in the RFC 7946 winding (counter-clockwise); d3-geo reads polygons on the sphere and takes such a ring as everything except the country (Australia came out at 163 steradians, the whole sphere less Australia). The build rewinds any polygon d3 would read as more than a hemisphere; every one of the 4,587 geometries checks clean.
- **Outlines dissolved from their own states.** Percentage-simplified 50m country outlines lost a small country's coast and did not meet the 10m states at their borders. Each country's outline is now dissolved from its own simplified states (the UK from its four nations, 10m), so coast and tinted state share their lines exactly; the countries layer is the fallback for a country with no states.
- **Specks stretch the frame.** Outlying islands too small to draw (Macquarie Island) widened the fitted frame; the renderer fits twice, the second time to what it draws. Maps came out 2.5–6.6 KB, cropped to each country's shape.
- **Shared country codes put Australian places on a reef.** Natural Earth's fallback code field gave AU to Ashmore and Cartier Islands and to the Indian Ocean Territories as well as Australia; the lookup took the first by name, so Scarsdale and Albany were drawn on Ashmore and Cartier (a four-sided speck filling the frame). The build now uses the fallback code only when no country holds it outright, and the lookup lets containment decide, the geocoder's code only ordering the search. A test asserts no code is shared.
- **Plugin code tested from the app suite** loads by a path TypeScript does not resolve (the plugin is its own package, outside the app's TypeScript project).

### Phase 1 findings

- **djot rejects a dot in a bare attribute value**, so `of=esther_blake.death` never became a carrier. Settled by giving `:map:` its own `event=` and `place=` attributes and keeping `of=` a person, like every other family directive.
- **The responsive extension lays captioned figures side by side** at wide container sizes (`.sr-figure figure:has(figcaption)` → flex), which squeezed the map and its caption into two columns. `family.css` out-ranks it for `.place-map-figure` only.
- **Square files leave empty space** above and below a wide country (Australia) in the prose figure. The renderer should crop the viewBox to the frame's projected bounds plus padding, so each map takes its country's aspect.
- **At panel size the dot covered a small state's tint** (Victoria) at r 9; reduced to 6 on 2026-11-10.
- **The UK maps are 24–29 KB** with 10m map units; the outline build step should use 50m for the nations.
- **The places list is compared with the stored file before writing**, not with a remembered write: one transform iframe renders chapters of whichever book is open, so a remembered write could wrongly skip a chapter id two books share.
- The panel map floats beside the dates (`float: inline-end`), and the inline SVG takes the book's colours; dark mode not yet checked in the book.

## Follow-on

With the register in place, a book-level map of every birthplace (the migration chapter's "who came from where") is a short step: one SVG plotting all located places.
