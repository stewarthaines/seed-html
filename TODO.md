# TODO / status

The core editor is implemented and shipping: OPFS/IndexedDB storage, EPUB
unpacking/packaging, the workspace + OPF/manifest/spine model, the text→DOM→XHTML
transform pipeline, manifest/metadata/spine editing, multi-device + PDF preview,
extensions, plugins, and the i18n system. Detailed per-feature design notes used to
live under `plans/`; that historical tree was retired — use git history and the
co-located `src/lib/<module>/API.md` docs for current behaviour.

## Deferred design work

- **A CSS-degradation preview mode.** `process/PREVIEW_NO_SCRIPTS.md` plans a
  no-scripts preview, so an author can see the chapter as a reading system with
  scripting refused. Switching off selective **CSS** support is a separate axis and
  needs its own plan: at minimum a "layer 1 only" view that drops every `@media`,
  `@supports` and `@container` block so the unconditional floor is visible on its
  own, and possibly finer switches for what reading systems most often lack — grid,
  `:has()`, container queries, inline SVG.

  Motivated by a measurement rather than a worry: under the foliate paginated
  preview a phone lands in the `min-width: 34em` bucket, because the chapter is laid
  out as one wide multi-column strip and the media query matches against that rather
  than the visible page. A width bucket that is load-bearing on a phone is precisely
  what the layer-1 rule in `docs/AGENT_AUTHORING.md` exists to prevent, and nothing
  in the app surfaces it today. On current evidence this would catch more than the
  no-scripts mode.

## Deferred test work

Some unit tests are intentionally skipped (search the suite: `grep -rn "\.skip(" src`).
They fall into a few buckets:

- **happy-dom limitations** — APIs the unit env doesn't model (e.g. `matchMedia`,
  CSSOM `@import` extraction, namespaced OPF/XML parsing). These need a real browser
  or a Storybook/Playwright-based test.
- **Integration / full-workflow scenarios** — better expressed as Storybook stories
  than happy-dom unit tests (e.g. extension batch-conflict rollback, i18n first-run
  extraction, view-transition behaviour).
- **Resource-intensive checks** — memory-capacity and large-file paths.

Re-enable these opportunistically as the browser-based test setup grows.
