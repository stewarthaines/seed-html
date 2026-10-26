# three.js in an EPUB — prototype plan

Books behaviour found here is collected in `process/APPLE_BOOKS_BEHAVIOUR.md`, the reference for reading-system findings.

A test EPUB that answers one question: what can a three.js scene do inside Apple Books? It is a probe, not a showcase. Each chapter tests one thing and reports what it found on the page itself.

Scope is reflowable only, built on the existing SEED project "WebGL". A fixed-layout version is a later, separate book: Books handles mixed layouts badly, so the two are never combined.

## What is already known

The "WebGL" project's raw WebGL 1 cube renders in Apple Books on this Mac (macOS 13), on iPadOS 18.6 and on iOS 16.7.16 (confirmed by the user, 2026-10-15). WebGL itself is therefore not in question; three.js on top of it is.

iOS 16.7 is the oldest engine in the set (Safari 16 WebKit), so scripts are built for `safari16`. Current three.js needs WebGL 2, which Safari has had since 15. None of the three devices has WebGPU on by default (it needs the 26 releases), so WebGPU is reported, not tested.

Apple Books runs JavaScript in reflowable and fixed-layout books. Its asset guide requires scripts in their own files, listed in the manifest, and forbids reaching resources outside the book. It warns that large libraries perform poorly, asks for CSS animation where possible, asks that page edges stay free for page turns, and asks for button alternatives to gestures.

Our iPad canvas test (memory: apple-books-canvas-fxl-works) found that Books lays a page out only after loading it, so `clientWidth` can be 0 at load. That was fixed layout; whether reflowable chapters behave the same is part of this test. Canvases are sized from CSS and re-measured later either way.

three.js removed its plain-script build in r161; current releases are ES modules only.

## How SEED.html attaches scripts

Every JavaScript file in the manifest is added to every chapter's `<head>`, in manifest order, as a classic `text/javascript` script (`spine-preview-manager.ts`, `xhtml-template.ts`). A chapter cannot choose its scripts, and none can be a module.

So each script finds its work in the markup, as the existing script does with `[data-shape]`, and does nothing on a chapter without it. It also means the three.js bundle is parsed in every chapter, the baseline included. Load cost per chapter is one of the measurements.

A module-script probe would need a DOM transform to insert a `<script type="module">` element. It is optional and not in the first round.

## The existing project

`webgl-3d-annotations.js` (6.6 KB, raw WebGL 1) finds `.webgl-annotation, [data-shape]` and inserts a rotating 300×300 cube canvas. It stays unchanged as the baseline in chapter 1. New chapters must not use `data-shape` or that class.

Its authoring pattern is kept: the source marks where a scene goes, and the script enhances it, so without scripting the reader still gets the text.

What it shows to avoid: a fixed backing store that ignores `devicePixelRatio`; an animation loop that never pauses; a canvas with no role or label; a fallback that replaces the marked text with "WebGL not supported"; inline styles with literal colours.

`page.css` floats every canvas left. That rule is scoped to the baseline so it doesn't affect the new scenes.

`transformText.js` wraps every block in `<p>`, so a `<figure>` block would come out invalid. It gets a passthrough for blocks that start with an HTML tag.

## Build

three.js 0.186.1, bundled with esbuild into one classic IIFE: the core plus OrbitControls and GLTFLoader, exposed as `window.THREE`. Target `safari16`. Size is 808 KB minified, 207 KB gzipped. The entry file and build command are kept with the bundle.

## Files

Scripts, in manifest order:

1. `probe-log.js`: the on-page log (`[data-probe-log]`), which also writes to localStorage, and the capability report (`[data-capabilities]`).
2. `three.bundle.js`: the library.
3. `scenes.js`: finds `[data-scene="…"]` and builds that scene. One function per scene; shared sizing, pausing and fallback code.
4. `webgl-3d-annotations.js`: unchanged.

Media: one small textured `.glb` model and one texture image.

## Chapters

1. **Baseline** (existing `chapter1`). The raw WebGL cube, unchanged.
2. **Capabilities.** No scene. Records `navigator.epubReadingSystem` name, version and `hasFeature` results; user agent; WebGL 1 and 2 context creation; renderer and vendor strings; max texture size; `navigator.gpu`; `devicePixelRatio`; `prefers-reduced-motion`; whether `fetch` of a book file, a Worker and WebAssembly work; the time from navigation start to `DOMContentLoaded`, which shows the bundle's parse cost.
3. **Minimal scene.** A lit, rotating cube with `WebGLRenderer`. The canvas takes its size from CSS, and the backing store is re-measured on `pageshow`, `visibilitychange`, `resize` and first pointer. Tests that the loop pauses when the chapter is hidden, and what happens when the reader changes font size or switches between scrolled and paginated views.
4. **Interaction and persistence.** OrbitControls driven by Pointer Events, with `touch-action: none` on the canvas only, so swipes beside it still turn pages. Buttons and arrow keys do the same as the gestures. The camera position is saved to localStorage and checked after a page turn, after closing and reopening the book, and after restarting the app.
5. **Assets.** Loads the `.glb` with GLTFLoader and the texture from inside the book. Records whether `fetch` of a book file works and what epubcheck says about the model's media type.
6. **Several scenes.** Three scenes in one chapter, separated by enough text that they fall on different pages. Counts WebGL contexts and `webglcontextlost` / `webglcontextrestored` events, and checks whether off-page scenes stop drawing. This is the reflowable form of the context-limit test.
7. **Accessible scene.** The canvas has `role="img"` and a label, and the surrounding text describes what the scene shows. A pause control stops the animation, which also stays still under `prefers-reduced-motion`. Without WebGL, a still image and caption remain in place of the canvas. The package declares the `motionSimulation` hazard and its accessibility features honestly.

## Reading systems

Apple Books on macOS 13, iPadOS 18.6 and iOS 16.7.16. Thorium desktop is the Chromium control. The SEED.html preview and READ.html are the development loop only. Debug with Safari's Web Inspector attached to Books, using a sideloaded, DRM-free copy.

## What counts as done

A results table in this file: one row per chapter, one column per device, each cell works / partly / fails with a one-line note. Below it, a short verdict on whether three.js is usable in a reflowable Books EPUB, and the constraints a real book would have to follow.

## Results

Round 1, 2026-10-15. epubcheck: valid. The author reports the book reads as designed on all three devices. The iPhone column comes from screenshots of the stored logs (the last 20 entries per chapter). The Mac and iPad logs are not yet transcribed. Safari's Web Inspector offered only Books' script-only contexts on the iPhone, not the chapter pages, so it could not be used to read the logs there.

| Chapter        | iOS 16.7.16 (iPhone)                                                                                                     | iPadOS 18.6 | macOS 13 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------- | -------- |
| Baseline       | Works (author)                                                                                                           | Works       | Works    |
| Capabilities   | Works. No WebGPU; Worker and WebAssembly work; fetch returns content with status 0; no resource timing                   | Works       | Works    |
| Minimal scene  | Works. 285×214 at setup, 301×226 at `pageshow`; loop stops when hidden; reduced motion starts it paused                  | Works       | Works    |
| Interaction    | Works. Camera restored from localStorage across separate loads                                                           | Works       | Works    |
| Assets         | Partly. fetch and XHR return the 5956 bytes with status 0; the model loads but its texture does not (see textures below) | Partly      | Partly   |
| Several scenes | Works. Three contexts in one chapter, no context loss logged                                                             | Works       | Works    |
| Accessible     | Works. Starts paused under Reduce Motion                                                                                 | Works       | Works    |

### Findings from the iPhone logs

**Books loads chapters it is not showing.** At 05:46:03–06 every scene chapter logged a fresh load within about three seconds, each followed within 0.1–1.4 s by "document hidden". Books appears to lay out chapters in hidden web views (likely for pagination), so every chapter's scripts run, the three.js bundle is parsed, and WebGL contexts are created, whether or not the reader ever turns to that chapter. The hidden-document check stopped those loops after one frame or none.

**No "document visible" was ever logged on the iPhone.** Each viewing appears as a new load, not a hidden page becoming visible again. Correction (2026-10-16): that was the hidden background loads. While the reader is in a chapter, hidden and visible both arrive, on macOS, iPadOS 18.6 and iOS 16.7. Scripts should not rely on `visibilitychange` to visible to resume; set up again on load and on `pageshow`.

**Layout settles after load, in reflowable too.** Every scene measured 285×214 at setup and 301×226 at `pageshow`. The fixed-layout canvas test found the same pattern. Sizing from CSS and measuring the backing store again on `pageshow` and through ResizeObserver was necessary. One load (05:38:44) measured 507×225 at setup, then 235×176 and 301×226 through ResizeObserver within a second.

**Book files load with status 0.** fetch and XMLHttpRequest return the full content with status 0, as for `file:` URLs. Code that checks `response.ok` or `status === 200` would treat a successful load as a failure. three.js's loaders accept status 0.

**Load cost is small.** DOMContentLoaded at 133 ms after navigation start on the capabilities chapter, with the 808 KB bundle parsed. Resource timing has no entry for book files, so the bundle cannot be timed on its own.

**The animation runs at about 30 frames per second.** One early run (05:37:09) played for 14.4 s and drew 421 frames, about 29 fps. This could be Low Power Mode, or Books throttling `requestAnimationFrame`. Not yet checked.

### Textures in Books (2026-10-15/16, macOS Books)

Books will not hand image pixels to a book's scripts. Every route tried, in order:

| Route to the pixels                                                 | Result                                                                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Image element loading a book `.jpg`/`.png` (three.js TextureLoader) | Loads, but WebGL gets blank pixels: black bark, invisible leaves, plain `.glb` box                       |
| `fetch` of a book image file                                        | An empty SVG of the image's size, e.g. `<svg width='341.000000' height='512.000000' …></svg>` (85 bytes) |
| `fetch` of the same bytes named `.bin`                              | The full bytes, status 0                                                                                 |
| Those bytes as a blob URL in an image element                       | Fails                                                                                                    |
| Those bytes as a Blob to `createImageBitmap`                        | Fails: "An error occured reading the Blob argument to createImageBitmap"                                 |
| Those bytes as a `data:` URL in an image element, drawn to a canvas | Works: real pixels, untainted. The tree renders fully                                                    |

So in Books: image files reach scripts only as placeholders, anything built on a Blob fails (which is also why GLTFLoader's embedded textures fail), and `data:` URLs work. A JavaScript decoder (jpeg-js, fast-png into a canvas) is kept as a fallback; it was not needed on any device: macOS, iPadOS 18.6 and iOS 16.7 all decoded via `data:` URL (2026-10-16). Timings: iPad trees 21–33 ms, textures ready 243 ms after first request; iPhone trees 49–62 ms, but the first tree appeared about 1.9 s after the context was created and textures took 2.5 s (likely shader compilation and the unmeasured generation inside `loadPreset`).

SEED.html import notes from this round: a file named with two dots (`a.jpg.bin`) is stored as `a-jpg.bin`, and `.bin` is recorded as `application/macbinary`.

**Touch input in reflowable Books cannot be claimed (2026-10-16).** On iPadOS a drag on a canvas turns the page even when the touch events are cancelled and stopped; range inputs are inert (greyed out on macOS, touches uncancelable); taps on buttons work and do not turn the page. Details in `process/DJOT_3D_MODELS.md`. Fixed layout, where the Mkhedruli workbook's canvas does claim touches, remains untested for 3D.

**IntersectionObserver reports page turns within a chapter.** In the tree chapter on iPadOS and iOS, paging away and back logged "off screen" and "on screen" (2026-10-16), so off-page scenes stop drawing in paginated mode.

## Later

- The fixed-layout book, as its own project, reusing `probe-log.js`, `three.bundle.js` and `scenes.js`.
- WebGPU, once a device on a 26 release is available.
- A module-script probe via a DOM transform.
- Draco-compressed models (WebAssembly decoder plus Worker).
- A procedural tree with ez-tree (see below).

## ez-tree investigation (2026-10-15)

`@dgreenheck/ez-tree` 1.1.0, MIT, peer dependency three >=0.167. API: `new Tree()`, set `tree.options` or `loadPreset(name)` (ash, aspen, oak, pine in three sizes, three bushes, a trellis), `generate()`, add to the scene. `update(elapsedTime)` animates wind, so the scene animates and the pause and reduced-motion rules apply.

Its prebuilt files are 4 MB because all 20 textures are inlined as data URIs. Built from its source into the existing bundle instead, with textures kept as separate files, the code adds 29 KB (807,850 → 837,201 bytes minified; 207 → 215 KB gzipped). The textures total 3.0 MB: four barks with four maps each (12 to 378 KB) and four leaf PNGs (142 to 304 KB).

`textures.js` starts loading all 20 textures when the module runs. Since every script runs in every chapter and Books loads chapters it isn't showing, that would fetch and decode 3 MB of images in every chapter at book open. It needs a small vendored patch so each texture loads on first use, and the book should carry only the bark and leaf types its trees use (one bark set plus one leaf is about 0.6–0.9 MB).

Built with esbuild's file loader and `--public-path=../Images/ez-tree/`, the texture URLs resolve from the chapter documents in `Text/`. TextureLoader uses image elements, so the status-0 behaviour of fetch does not affect it.

Licences: the bark README credits Poly Haven (oak, willow; CC0) and TextureCan (birch, pine; CC0, to be confirmed). The leaf textures have no stated source beyond the repository's MIT licence; confirm before using them in a published book.
