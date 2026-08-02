# A no-scripts preview mode

Let the author see the chapter as a reading system with scripting off would render it — the second of EPUB's two opt-ins, and the one no preview currently shows.

## Why it earns its place

A concrete case from this repo, not a hypothetical. The audio-clips icon affordance shipped with its glyphs ungated: the SVG is in the markup, so it painted whether or not `clip-player.js` ran, and a reader with scripting refused got a play button that did nothing. It was caught by reasoning about the CSS, not by looking — because **the preview always runs the scripts**, so the broken state was unreachable.

The same class of bug has bitten this project before from the other direction: "Letter from Kenya" used to depend on `responsive.js` stamping `narrow` / `wide` / `full` on `<body>`. Without scripting the book had no responsive layout at all, and there was no way to see that.

Both are the same shape: **an enhancement that silently becomes load-bearing**. That is what this mode is for, and it is the only thing it should claim to test.

## Confine it to the built-in engine

The instinct that "the responsive preview might be enough" is right, and there is a principled reason rather than a scoping convenience.

| Engine                              | Whose scripts run in the frame                    |
| ----------------------------------- | ------------------------------------------------- |
| built-in (`raw`)                    | the book's, and the preview head's — nothing else |
| foliate (READ.html, device presets) | **the paginator's** — the renderer is JavaScript  |
| Paged.js (Print, Proofs)            | **the polyfill's** — pagination is JavaScript     |

Under foliate or Paged.js, "disable JavaScript" would disable the thing drawing the page, not simulate a reader. The result would be a blank or unpaginated frame that tells the author nothing. So the toggle belongs on the built-in engine only, and should be visibly unavailable elsewhere with that as the stated reason.

That lands it on Responsive and desktop — which is where an author checks layout degradation anyway.

## Strip the scripts; do not sandbox the frame

The obvious implementation is `sandbox="allow-same-origin"` on the iframe: scripts refused, parent access retained, and faithful in that the scripts are present and declined exactly as a reader declines them.

**It does not work here.** The app injects `axe.min.js` as a `<script>` into the preview document to run the accessibility checks (`PreviewPane.svelte:297`). A frame without `allow-scripts` refuses the app's script along with the book's, so the a11y panel dies whenever the mode is on — precisely when its results are most interesting, because the degraded DOM is a different document to audit.

So: remove the book's `<script>` elements from the content before writing it, leaving the app's own instrumentation free to run.

- Do it in `PreviewSurface`, on the raw path only, beside `withPreviewHead` — parse with `DOMParser`, drop `script` elements, re-serialize. A second parse per render is real cost, but it is paid only while the mode is on, and confining it to an opt-in diagnostic keeps the re-serialization away from every normal render.
- The DOM transforms still run: they are build-time, and a reading system receives their output regardless. That is the correct semantics — this mode simulates a reader that won't run _reading-system_ scripts, not an author whose pipeline failed.
- The preview head's inline scripts go too. Worth stating in the UI copy: a `head.xml` affordance disappearing in this mode is correct, not a bug.

## Make it conspicuous, and do not persist it

A preview that silently isn't running the book's scripts is a debugging trap — an author will lose an afternoon to "why won't my clip play". Two rules follow:

- **A visible badge while active**, in the same band as the render-failure notice, not just a toggle state buried in an options bar.
- **Not persisted across sessions.** This is a check you perform deliberately, not a mode you live in. If it is persisted at all, the badge is doing the work of preventing confusion, so it must be unmissable.

## Name it for what it tests

Call it **"No scripts"**. Not "Reader compatibility", not "Degraded mode".

Scripting is one axis of degradation among several, and the others are not simulated: SVG support, CSS grid, `:has()`, container queries, and the paginated-viewport problem where a reading system reports a spread-width viewport and a phone lands in a desktop media-query bucket. An author who ticks a box labelled "reader compatibility" will reasonably believe they have checked the degraded case. They will have checked one fifth of it.

## Tell the checks, and tell the agent

Results gathered while the mode is on describe a _different document_: no `role="button"`, no script-injected controls, no script-set classes.

- The a11y panel should label its results with the mode, or a finding gets attributed to the wrong document.
- `seed_get_checks` and `seed_inspect_elements` should report `scripts: enabled | disabled` in their replies. An agent measuring `.clip-icon` as `display: none` needs to know whether that is the gate working or a bug, and it cannot see the toggle.

## Verification

This book is the test case, because it now exercises both halves:

- scripts on → `[role='button']` present, `.clip-icon--play` shown, `.clip-icon--stop` hidden
- scripts off → no `role` attribute, both `.clip-icon` glyphs `display: none`, transcripts and figures unchanged, chapter still reads in order

The second row is exactly the state that was unreachable when the icon bug shipped.

## Not in scope: switching off CSS

The same failure — an enhancement quietly becoming load-bearing — happens on the CSS side, and on this session's measurements it happens more. But it is a different axis with a different implementation, and folding it in would blur what this mode claims to test.

Deferred deliberately, and noted in `TODO.md` under _Deferred design work_ so it gets planned on its own terms rather than smuggled in here.
