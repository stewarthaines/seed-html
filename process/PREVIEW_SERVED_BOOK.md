# Preview: a base URL, a served book, and a scripts switch

Plan and design record for three changes agreed on 25 September 2026, after the Kotobee sample (`process/PUBLISH_REWORK.md` has the publish work; this is separate). The sample's chapter is a scripted widget that builds a `<video>` at runtime from a path relative to the chapter; the preview showed a black box and the browser's "no supported format" message because nothing answered the path.

## Why

The preview writes the chapter into its iframe with `document.write`, so the document has no URL and relative references resolve against the app's address. Everything the preview shows today works because a rewriting pass swaps every static `src` and `href` for a blob URL first. A script that builds an element later gets no such help, and no book from elsewhere is going to know about blob URLs. The EPUB rule is that references resolve against the file they are written in; giving the document a base and answering the resulting URLs is what a reading system does.

## The three steps

**1. A base URL.** Over HTTP, the written document gets `<base href="/__book/<workspace>/<chapter path>">` as the first child of `<head>`. Static references are still rewritten to blob URLs (absolute, unaffected by the base); anything a script builds resolves under `/__book/`. Over `file:` no base is added and nothing changes. Only the built-in preview engine gets the base; the paged (print) path is not touched. The reader-engine path (the READ.html device) takes the other road, below.

**2. A served book.** The app's service worker answers `GET /__book/<workspace>/<path>` by asking the app page for the bytes over a message channel: the page reads the file from storage and replies with the bytes and a media type; the worker answers, honouring `Range` requests (WebKit will not play media without them). No file leaves the browser; the worker holds nothing. The worker is a relay rather than a reader of OPFS so that the same worker can serve a book the reader tab holds in memory later. The worker now also runs on the dev server: Vite serves the template at `/sw.js` with a `dev-` version stamp, and in that mode the worker only handles `/__book/` (no app-shell caching, which would fight HMR). The app registers the worker over HTTP in dev as well as in the build.

**3. Scripts off for books made elsewhere.** A book without a `SOURCE/` folder (the read-only case) previews with its `<script>` elements, inline handlers and `javascript:` links removed, unless "Run this book's scripts" is on for that book. The switch sits in the read-only banner above the view and is remembered per book in this browser (localStorage, not in the book). Books made here are unaffected. This mirrors READ.html's per-book consent prompt.

## Decisions

- The base and the served route are HTTP only. The `file:` build serves SEED-made content and keeps the blob path.
- The blob rewriting pass stays as it is on HTTP too. Retiring it in favour of the base would remove the blob-capacity ceiling and the second mechanism, but the pass also stamps `data-source-href` (click-to-source) and `data-seed-missing` (the missing-files report); turning it into an annotator that leaves URLs alone is a later step, not this one.
- No sandbox on the preview frame. The service worker cannot serve an opaque-origin frame (the specification sets such a client's active worker to null; a spike on 25 September 2026 confirmed it in Chromium, WebKit and Firefox 156, including for a document sent with a `Content-Security-Policy: sandbox` header). A real fence needs a second origin with its own worker, which the spike also confirmed works; that is a hosted-site option for later, recorded here, not built.
- The reader tab (READ.html) keeps `srcdoc` delivery for `file:` and, when a worker controls its page, navigates each section frame to its served URL and answers the route for the open book with the markup the engine prepared (read-html `docs/SERVED_BOOK.md` and vendored patch 8, built 25 September 2026). A `<base>` alone was tried first and dropped the same day: the Kotobee runtime builds its paths from `location.href`, which is `about:srcdoc` in a `srcdoc` frame. A page reply now has a third state, "not mine", so an editor tab does not settle a reader tab's request as missing; the worker settles a 404 at once when every client says so.
- A frame that renders before the worker takes control gets no base; the next render does. Not worth a forced re-render.
- The READ.html device preview (25 September 2026, after the reader tab): a `<base>` does nothing for a script that builds paths from `location.href`, and a `srcdoc` section's address is `about:srcdoc`, so the device preview does what the reader tab does. Its one section carries the chapter's served URL, the engine copy in `public/foliate/` (re-copied from read-html 0.6.0, patch 8) navigates the section frame there, and the pane registers the rendered chapter markup under that path with `serveDocument` so the route answers with what the frame would have got, as `text/html` to keep srcdoc's parsing. Without a worker the engine loads srcdoc as before.

## Verification

- Unit tests: the URL builder, the page-side request handler (bytes, media type, not found), range slicing, `stripScripts`.
- In the browser: the Kotobee sample plays its video after the switch is turned on; a SEED book's preview is unchanged; the missing-files report still reports; click-to-source still works.

## Built (25 September 2026)

All three steps are on the makeover branch. Two things the build taught, both recorded above as decisions: Chromium does not treat an `about:blank` frame that the app writes into as a controlled client (WebKit and Firefox do), so the preview frame now starts on a served empty document and the write waits for that load; and the worker settles a missing file on the first "not found" from a page after a short grace, because a book's own frames are window clients too and never answer. The Kotobee sample's video plays in the preview once its scripts are switched on; a SEED book's preview is unchanged; the whole unit suite passes.
