# Apple Books behaviour — field notes

What Apple Books has been seen to do with SEED.html books, gathered from probes, device screenshots and Web Inspector sessions. Apple documents little of this: the Books Asset Guide covers packaging and a few script rules, not page lifecycles, thumbnails or input. Each note says what Books does, what a book should do about it, and how we know: the date, the device and Books version, the method, and the doc that holds the detail. Add to it whenever a reading-system test turns something up; correct a note rather than appending a contradiction.

Devices so far: an iPad mini (768×1024 points, `navigator.epubReadingSystem` reports iBooks 11.6; iPadOS 18.6 in the October three.js tests); an iPhone (375×667, iBooks 9.4; the October three.js tests ran on iOS 16.7.16); a Mac on macOS 13. Unconfirmed on a device or version not listed means unconfirmed.

## Page lifecycle

**Books loads pages it is not showing.** At book open, every chapter of a reflowable book loads in a hidden web view, runs its scripts (three.js parsed, WebGL contexts created) and is then hidden. In fixed layout, the next page loads before it is turned to, and before it is laid out. Every script runs on every page whether or not the reader sees it, so set-up must be cheap and loops must stop while the document is hidden. Seen on iOS 16.7.16, iPadOS 18.6 and macOS 13, 2026-10-15/16, from on-page logs (`process/THREEJS_EPUB_PROTOTYPE.md`); fixed layout on the iPad mini, 2026-09-16.

**Each visit is a fresh load.** Paging back to a page loads it again: a probe's local-storage load counter rose on every visit, and nothing from the previous visit survives except storage. Set up on `load` and `pageshow`, not on `visibilitychange` to visible. While a reader is on a page, hidden and visible do both arrive (the early "visible never fires" was the hidden preloads). iPad, iBooks 11.6, 2026-10-26, probe page (`probe.js`, below); reflowable on all three devices, 2026-10-16.

**Layout settles after load.** Sizes measured at `DOMContentLoaded` or `load` can be 0, or wrong: a reflowable scene measured 285×214 at set-up and 301×226 at `pageshow`; a fixed-layout canvas measured 0 on a preloaded page, so taps hit the wrong element until a page turn. Give canvases a CSS box and measure their backing store again on `pageshow`, `resize` and ResizeObserver, and on the first pointerdown. Backing store = `devicePixelRatio × visualViewport.scale`, since the scale exposes Books' page zoom. iPad mini 2026-09-16; all three devices 2026-10-15.

**Thumbnails are photographs of the running page.** The page grid (and the iPhone's) loads each page in an offscreen web view, runs its scripts, WebGL included, and takes the picture shortly after the page has finished its own work. Books waits for in-flight loading: a three.js page whose model is built only after a fetch and a parse was photographed with the model drawn. The delay from the model being drawn to the picture was 8–16 ms on the iPad (iBooks 11.6) and 19–131 ms on the iPhone (iBooks 9.4), while the time from navigation start varied from 120 to 1300 ms. A page with nothing to load was photographed at 16–19 ms, after `load`, `pageshow`, a `visualViewport` resize and one animation frame. Thumbnails are made afresh when a book is re-imported. 2026-10-26, timing readouts on the step pages and the probe page of the "Josh in Bricks" test book.

**Nothing tells a page it is a thumbnail.** In the thumbnail view the page is 320×460 as when read, `document.visibilityState` is visible, `document.hasFocus()` is false, `epubReadingSystem` is the same, and the same events arrive in the same order. A page being read also starts without focus, and swiping to a page brings no `focus` event at all (one arrived 1.3 s after opening a page from the grid). Only `visualViewport.scale` differed (1.496 vs 2.228 on the iPad), and it depends on the device, orientation and spread, so it cannot be a test. Local storage is shared between the thumbnail view and the reading view. iPad, 2026-10-26, probe page.

**So a page chooses its thumbnail by timing.** Draw the state the thumbnail should show first, then change to the reading state after a hold measured from when the page has drawn. The LEGO step pages open finished with the drag handle hidden, go back to the start of the step after 250 ms and fade the handle in over 250 ms. Two animation frames was too short; 250 ms worked on every page on both devices, including in Picklets 2.0, a book of dozens of three.js pages. A page opened from the grid can show its thumbnail state for the hold, which the fade makes read as deliberate. A page swiped to has usually loaded before it is seen. 2026-10-26 (`lego3d.js`, `process/DJOT_LEGO_SYNTAX.md`).

## Scripts and input

**Every manifest script runs in every chapter.** SEED.html links every JavaScript manifest item from every chapter's head, as classic scripts in manifest order, with no per-chapter choice; a script must check for its own elements and do nothing without them. This is SEED.html's packaging (`src/lib/transform/spine-preview-manager.ts`), not Books', but it compounds the preloading above.

**Pages are XHTML.** Book pages are parsed as XML, so `innerHTML` and `insertAdjacentHTML` throw on markup that is not well-formed (a bare `<br>`), and an uncaught throw stops the rest of the script's set-up. Use `textContent` and DOM methods, or well-formed markup. A test harness that loads pages as HTML will not catch it. 2026-10-26: a blank LEGO page on the iPad, reproduced in headless Chrome with an `.xhtml` copy.

**Book files fetch with status 0.** `fetch` and XMLHttpRequest return the full content with status 0 and `response.ok` false, as for `file:` URLs; code that checks `ok` or `status === 200` treats a success as a failure. three.js's loaders accept status 0. All three devices, 2026-10-15.

**Image files reach scripts only as placeholders.** An image element shows a book image, but WebGL gets blank pixels from it, and `fetch` of a book `.jpg` or `.png` returns an empty SVG of the image's size (85 bytes). Anything built on a Blob fails (blob URLs, `createImageBitmap`), which also blanks glTF embedded textures. Working route: ship the bytes under a `.bin` name, fetch them, and load them as a `data:` URL into an image drawn to a canvas. macOS 13, then iPadOS 18.6 and iOS 16.7, 2026-10-16 (`process/THREEJS_EPUB_PROTOTYPE.md`, "Textures in Books").

**Fixed layout: cancelling touch events stops the page swipe.** On iOS, `preventDefault` on `touchstart` and `touchmove` keeps a drag on the page and stops Books turning it; a cancelled `pointerdown` alone does not. The Lottie pages' `animation.js` relies on this and the LEGO pages do the same, with Pointer Events for the movement. iPhone, 2026-10-24 (`process/LOTTIE_AND_3D_PAGES.md`).

**Paginated reflowable: drags cannot be claimed.** On iPadOS in paginated mode, a drag on a canvas turns the page even with touches cancelled and stopped, and two- and three-finger touches turn it too; range inputs are inert (greyed out on macOS, touches uncancelable). Taps on buttons work and do not turn the page. In scroll mode, touch drags on a canvas stay with the canvas. Interaction in reflowable books is button-first. iPadOS 18.6, 2026-10-16 (`process/DJOT_3D_MODELS.md`).

**Pointer Events work, with pen pressure.** Pointer Events with Apple Pencil pressure and tilt, coalesced events (3–4 per move), `touch-action: none` and local storage all behave on a fixed-layout canvas page. An Apple Pencil tap fires pointer events on a button but no `click`: act on `pointerup` when `pointerType` is `pen`. `epubReadingSystem.hasFeature`: dom-manipulation, touch-events, keyboard-events and spine-scripting true; layout-changes and mouse-events false. iPad mini, iBooks 11.6, 2026-09-16 (Mkhedruli canvas test book).

**Media must play inside the tap.** Reading systems use up a tap's permission to play media synchronously, so `play()` must be called inside the tap handler, not after a later event such as `seeked`. Variable-bit-rate mp3 files seek unreliably; encode audio at a constant bit rate. macOS Books, 2026-07-15 (audio-clips extension, `process/READING_SYSTEM_DEBUGGING.md`).

**Animation may run at 30 frames a second.** One iPhone run drew 421 frames in 14.4 s. Low Power Mode or Books throttling `requestAnimationFrame`; not yet checked. iOS 16.7.16, 2026-10-15.

## Layout, fonts and the store

**Generic font families render in Books' own face.** With `ibooks:specified-fonts` set and "Original" chosen, a bare `font-family: serif` still renders in San Francisco: Books honours named families only. Lead with named faces present on Apple devices, generic last (`"Iowan Old Style", Palatino, Georgia, serif`). macOS Books, 2026-08-08 (Bulletin 39). SEED.html's starter `page.css` still ships a bare `serif`.

**Landscape shows two-page spreads.** In landscape, fixed-layout pages appear in pairs, each at half the width, unless the OPF says `rendition:spread none`. iPad mini, 2026-09-16.

**Samples for fixed layout need landmarks or a custom sample.** Books cuts a fixed-layout book's store sample from the landmarks nav (bodymatter); SEED.html emits no landmarks nav, so such a book needs a custom sample uploaded with it. From the Books Asset Guide; a landmarks proposal is parked (2026-09-27).

## Testing in Books

**Re-imports can be stale.** Re-importing a book with the same title can open the cached copy, especially on the Mac: delete the book and quit Books before importing again. The iPad and iPhone made fresh thumbnails on every re-import on 2026-10-26; on macOS with iCloud sync the clearable render caches are under `~/Library/Containers/com.apple.iBooksX/Data/Library/Caches/`. 2026-07-15 and 2026-08-08.

**Web Inspector reaches Books on the Mac only.** `defaults write com.apple.iBooksX WebKitDeveloperExtras -bool YES`, restart Books, then right-click in a DRM-free book and choose Show Inspector. On the iPhone, Safari's Web Inspector offered only Books' script-only contexts, not the chapter pages, and Books limits copying text out of a book. On devices, have the page report on itself.

**A probe page reports on itself.** A page that prints what it can see, in type large enough to read in a screenshot or a thumbnail, answers most device questions: `~/Projects/webgl-book-build/book-lego/probe.js` shows time since load, the wall clock, animation frames, sizes and zoom, visibility and focus, the reading system, a local-storage load counter, and the last events in order, each marked with whether the page had focus. It acts only on a page holding `<div id="probe">`. Compare its thumbnail with the page itself; a counter that keeps updating shows the moment a picture was taken. The three.js test book's `probe-log.js` keeps a stored log per chapter for the same purpose.

## Still open

- Thumbnail timing in Books on the Mac, and on newer iOS and iPadOS releases.
- Whether animation is throttled to 30 frames a second, and when.
- Touch cancelling on the LEGO pages: written to the same pattern as the Lottie pages, not yet confirmed on a device (including multi-finger touches and swipes from the edge).
- The no-WebGL fallback still image, designed but never exercised in Books.
