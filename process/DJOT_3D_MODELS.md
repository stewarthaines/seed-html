# 3D models in Djot — design record

Books behaviour found here is collected in `process/APPLE_BOOKS_BEHAVIOUR.md`, the reference for reading-system findings.

Authoring 3D models in SEED.html books through Djot. Started 2026-10-16 from the three.js prototype (`process/THREEJS_EPUB_PROTOTYPE.md`), which established what Apple Books allows.

## The use case

An exhibition catalogue of artefacts, such as pottery shards. In the gallery a visitor can inspect an object; reading the catalogue at home, they can inspect it too. Models are for inspection: the reader turns and zooms the object. Not guided tours through a model, and not generated content.

## Decisions

**Model files are prepared upstream.** SEED.html does no conversion. An upstream workflow produces files in whatever form suits the EPUB best. The working assumption is GLB (glTF 2.0 binary) with embedded textures at modest resolution, kept small; total book size matters. Embedded textures also matter for Apple Books, where separate image files reach scripts only as blank placeholders.

**SEED.html treats a model as an opaque file.** No size checks, previews or validation for now. Everything the author says about a model lives in the Djot source.

**The image is the content; the model is the enhancement.** The author writes the catalogue photograph as an ordinary Djot image, and an attribute adds the model:

`![Rim shard, incised chevrons](shard-12.jpg){model="shard-12.glb"}`

Without scripting or WebGL, the reader sees the photograph, which also serves as the fallback. Captions come from the figures extension, or from a new extension if the figures extension can't do what's needed. A block syntax with the model as primary (`::: model`) was considered and declined: it reads as less structured, and it makes the 3D object the thing rather than the photograph.

**Settings come in three layers, each overriding the one before:** defaults in the book's script, the chapter's YAML frontmatter, and attributes on one image. Most entries carry only `model=`. A chapter can set something for all its models (for example, raking light for the incised pieces) without repeating it on each image. Tentative; to be tested against concrete examples before more is designed.

**The starting view is the author's decision.** The model file gives a default that depends on how it was built, and `view=` on the image lets the author refine how the object is presented, since they are writing its description and choosing what the reader sees first.

**The author finds a view by turning the model, not by writing numbers.** An authoring switch on the image makes the scene show its current view as text, ready to paste into `view=` (for example `view="35 20 1.4"`: turn, tilt, zoom). The switch is per model and explicit. Djot has no bare boolean attributes (a bare word inside `{…}` invalidates the whole attribute block), so the proposed spelling is a class: `{model="shard-31.glb" .readout}`.

**Attributes mean what they say, in the preview and in the published book.** A `.readout` left on a model shows its readout to readers too. Keeping the source clean is the author's responsibility; the app neither hides nor flags it. (Declined: preview-only readouts, which would make the attribute mean less than it says, and a pre-export check, which would make the app know about models.)

## Prototype (2026-10-16)

Built in the WebGL test book, with the build and model preparation in `~/Projects/webgl-book-build`.

- **Object:** Colonoware pot from Cooper River, South Carolina, 18th century; Smithsonian NMAAHC 2017.108.1.1, photographs and 3D model CC0. There are no true sherds in the Smithsonian 3D collection; this vessel is mended from large pieces, which show in both photograph and model.
- **Upstream preparation** (`models/prepare.mjs`, outside SEED.html): the Smithsonian's web GLBs are Draco-compressed, and Draco's decoder starts Workers from blob URLs, which Books blocks. The script removes Draco, simplifies to a third of the triangles (150,000 → 49,500) and turns the model upright: the Smithsonian's GLBs are Z-up, with their viewer applying orientation separately. Result 1.6 MB with three 1024-pixel JPEG textures. The photograph is 1200×960, 180 KB.
- **The filter is a project DOM transform**, not a Djot filter: Djot filters live inside the Djot extension's own transform, so a project cannot add one. The transform renames `model` → `data-src` (valid XHTML, and the attribute the SEED.html preview resolves to the file) and `view` → `data-view`. It only renames, so it works before or after the figures extension, which supplies the caption from `title=`.
- **The scene** (`scenes.js`, `photo-model`): takes the image's place and proportions, with the photograph as the fallback, restored if the model fails. Orbit and zoom, no panning, with zoom limits relative to the model's size. `view="turn tilt zoom"` is degrees around the vertical from the model's front, degrees above the horizon, and distance as a multiple of the distance at which the whole model fits. `.readout` shows the current view as `view="…"`. The lighting is a fixed default for now and renders the pot dark.

## Input in reflowable Apple Books (2026-10-16)

Direct manipulation does not work; taps on buttons do.

- **Canvas drag (iPadOS):** touches arrive cancelable and are cancelled (`preventDefault`, `stopPropagation`), with no touchcancel or pointercancel, yet Books still turns the page. Its page swipe is native and runs alongside the page's touch handling; two- and three-finger touches turn the page too.
- **Range inputs:** on macOS Books they are greyed out and respond to neither mouse nor keyboard; touches on them arrive with `cancelable false` and never reach the input (no pointerdown, no input events).
- **Buttons:** taps work on iPadOS and the page does not turn.
- **Mouse drag on the canvas (macOS Books, SEED.html preview):** works.

A scripting lesson from the way there: OrbitControls follows a drag with pointermove and pointerup listeners on the document, so stopping pointer events at the canvas stops the model turning.

- **Scroll mode (iPadOS, 2026-10-16):** touch drags on the canvas turn the model, and neither turn nor scroll the page. Everything above was observed in paginated mode (two-column landscape). The difference is likely that scroll mode's gestures go through WebKit's scrolling, which honours `preventDefault`, while paginated mode's page turn is Books' own native swipe outside the page. Needs more testing: portrait, single-column paginated, iPhone, macOS scroll mode.

**Decision: inspection is driven by buttons, not direct manipulation.** Step buttons for turn, tilt and zoom, plus an automatic animated rotation with a control to toggle it, are expected to be enough. Mouse drag and touch drag stay where they work (the mouse on macOS and in the preview; touch in scroll mode), as a bonus over the buttons, which are the only input that works in paginated mode. The steps change the same turn/tilt/zoom numbers as `view=`.

**Rotation is opt-in: models start paused, and `.rotate` on the image starts them rotating.** Reduced motion always wins. A Rotate / Stop rotating button toggles it, a step pauses it (the reader has chosen a view), and steps animate over a third of a second unless reduced motion is on. Rotation is timed (about 9° a second), not counted per frame, since Books may draw at 30 frames a second.

## Open questions

- Whether named views (`front`, `underside`, …) are worth offering alongside the numbers.
- Which other settings are worth having at all (lighting, step size, zoom limits), and at which layer.
- Compression (Draco, meshopt, KTX2) needs decoders that may use Workers from blob URLs; each must be tested in Books before an upstream workflow relies on it.
