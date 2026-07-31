# seed_get_checks — axe + epubcheck over the agent bridge

Expose accessibility (axe-core) and EPUB validation (EPUBCheck) results to terminal agents over the seed-bridge, so an agent can **explain issues and propose solutions** — not necessarily fix them directly. Companion to `process/AGENT_BRIDGE.md` (architecture, "reads are never gated" principle).

Status: design agreed 2026-07-31. Not implemented.

## Current state (facts)

**axe-core** — vendored v4.10.2 at `public/axe.min.js`, injected into the preview document (`PreviewPane.svelte:283-293`, HTTP-only). Runs `axe.run(doc)` with **default configuration** — no `runOnly`, no tags, no `axe.configure()` anywhere. Target is the selected chapter's rendered document via `PreviewSurface.getCheckTarget()` (foliate section doc, or the raw/paged iframe). Only `violations` are kept; `incomplete` is discarded. Results are component-local `$state` in `PreviewPane` — nothing persisted, empty unless the Checks panel is open. Paged.js engine caveat: the audited document includes Paged.js wrapper chrome (`PreviewPane.svelte:870`).

**epubcheck** — `@likecoin/epubcheck-ts` in the publish **plugin** (`plugins/publish-to-remote`), run in the plugin iframe when the author clicks Validate on a packaged EPUB. Report stored canonically at OPFS `validations/<filename>.epub.json` and mirrored to localStorage `seedhtml_validation_report` (schema in `src/lib/plugins/validation-report.ts:17-41`, deliberately duplicated in `plugins/publish-to-remote/src/epub-validation.ts:4-22` — new fields go in both). Carries `filename`, `identifier` (dc:identifier, absent on legacy reports), `timestamp`, folded severities (fatal→error, usage→info). The spine editor's `ChapterValidationPanel` already consumes the mirror, filtering by `.xhtml` basename via `chapterIdOf()` — the **same identifier space** as the bridge's `chapterId`.

**Bridge** — Node MCP process (`scripts/agent-bridge.mjs`) ↔ WebSocket ↔ app-realm module (`src/lib/agent-bridge/module.js`), dev-only, consent-gated per session. The app-realm module is same-origin with the plugin iframe, so reading the localStorage mirror is a one-line read. Tool list is declared in two places that must stay in sync (`agent-bridge.mjs` TOOLS array + `module.js` handleTool switch), with the context object built in `App.svelte:405-466`.

**Known bug found during this survey**: re-packaging under the same filename drops the stale OPFS report (`plugins/publish-to-remote/src/App.svelte:302-308`) but never calls `clearLatestReport()`, so the localStorage mirror — and the spine editor's panel — keeps serving a report about a package that no longer exists. Fixed as part of this feature.

## Triage taxonomy

Every message the tool returns is tagged host-side with a **category** and, where fixable, a **remedy surface**. This is the judgment an agent needs and it is cheap to compute from rule/message ids.

Categories:

- `fixable` — remedy lives in author-editable surfaces the bridge reaches today (SOURCE text, book CSS, metadata fields, nav.txt); agent can propose a concrete edit and optionally apply it via `seed_write_file`.
- `explainable` — real issue, remedy outside the author's source (asset production, design policy, distribution decisions); agent explains impact and proposes a course of action.
- `app-bug` — symptom of SEED's own pipeline (generated OPF/nav/packaging, transform-emitted markup); agent should say "report this to SEED", not coach the author.
- `not-applicable` — web-app-oriented rules with no purchase on book content, or preview-chrome noise.

Remedy surfaces (for `fixable`): `source-text` | `stylesheet` | `metadata` | `nav` | `chapter-title`.

### axe-core rules (default ruleset)

| Rule family                                                              | Category                                                                               | Remedy        |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------- |
| `image-alt`, `image-redundant-alt`, `area-alt`                           | fixable                                                                                | source-text   |
| `link-name`, empty links                                                 | fixable                                                                                | source-text   |
| `heading-order`, `empty-heading`                                         | fixable                                                                                | source-text   |
| `list`, `listitem`, `definition-list`                                    | fixable (transform-emitted nesting → app-bug)                                          | source-text   |
| table rules (`td-headers-attr`, `th-has-data-cells`, `scope-attr-valid`) | fixable                                                                                | source-text   |
| `color-contrast`, `link-in-text-block`                                   | fixable (design judgment; contrast often lands in `incomplete`)                        | stylesheet    |
| `html-has-lang`, `html-lang-valid`, `xml-lang-mismatch`                  | fixable                                                                                | metadata      |
| `document-title`                                                         | fixable                                                                                | chapter-title |
| `duplicate-id`, `duplicate-id-aria`                                      | fixable if author anchor, else app-bug                                                 | source-text   |
| `video-caption` and audio equivalents                                    | explainable                                                                            | —             |
| `landmark-*`, `region`, `page-has-heading-one`, `bypass`                 | explainable (policy: books use epub:type, not ARIA landmarks; often correct to ignore) | —             |
| `aria-*` validity                                                        | app-bug                                                                                | —             |
| form/widget rules, `tabindex`, `scrollable-region-focusable`             | not-applicable                                                                         | —             |

### EPUBCheck message families

| Family                                                                      | Category                                       | Remedy      |
| --------------------------------------------------------------------------- | ---------------------------------------------- | ----------- |
| `RSC-007`, `RSC-012` (broken refs / fragments)                              | fixable                                        | source-text |
| `RSC-005` (content-doc schema)                                              | fixable if author raw-XHTML, else app-bug      | source-text |
| `CSS-*`                                                                     | fixable                                        | stylesheet  |
| `OPF-*` metadata-content (identifier format, language tag, required fields) | fixable                                        | metadata    |
| `ACC-*` / schema.org accessibility metadata (usage/info level)              | fixable, high value                            | metadata    |
| `NAV-*`                                                                     | fixable if hand-authored nav.txt, else app-bug | nav         |
| `OPF-*` structural, `PKG-*`, `HTM-*` (transform output), `NCX-*`            | app-bug                                        | —           |
| `MED-*`, `RSC-006` (remote resources)                                       | explainable                                    | —           |

Skew worth designing around: axe leans heavily fixable (it audits authored content); epubcheck leans app-bug/explainable (it audits the container SEED built), except broken references and accessibility metadata — the two epubcheck families where the agent genuinely earns its keep.

Implementation: one pure module `src/lib/checks/triage.ts` mapping axe rule id → `{category, remedy}` and epubcheck message id (prefix + specific overrides) → same. Unknown ids default to `explainable` with no remedy. Unit-tested.

## Tool surface

One tool, `seed_get_checks`, no arguments. Two independent sections so each side reports its own availability:

```jsonc
{
  "chapterId": "chapter01", // the selected chapter (spinePreviewData.spineItemId)
  "a11y": {
    "status": "ok", // or "unavailable" + reason (no preview rendered, file: context)
    "engine": "foliate", // raw | foliate | paged — paged implies wrapper-chrome caveat
    "caveats": ["paged-chrome"], // present when applicable
    "violations": [
      {
        "id": "image-alt",
        "impact": "critical",
        "help": "…",
        "helpUrl": "…",
        "category": "fixable",
        "remedy": "source-text",
        "nodes": [{ "target": ["…css selector…"], "html": "…" }],
      },
    ],
    "needsReview": [
      /* axe 'incomplete' results, same shape */
    ],
  },
  "epubcheck": {
    "status": "stale", // none | different-project | current | stale
    "validatedAt": 1769836800000, // report.timestamp
    "projectModified": "2026-07-31T…", // live OPF dcterms:modified
    "filename": "My Book.epub",
    "messages": [
      {
        "level": "error",
        "id": "RSC-007",
        "message": "…",
        "location": { "path": "OEBPS/Text/chapter01.xhtml", "line": 12 },
        "chapterId": "chapter01",
        "category": "fixable",
        "remedy": "source-text",
      },
    ],
  },
}
```

Design decisions:

- **axe runs live on demand** — never reads the panel's cache (usually empty). The bridge run is headless: it must not open/close the Checks panel or touch panel state, but reuses the same target resolution and script injection.
- **Default axe ruleset is kept.** Curation happens by _tagging_ (category + caveats), not by filtering rules — explanation over silent curation. `incomplete` results are included as `needsReview` (the panel discards them; the agent should see contrast candidates).
- **epubcheck returns the stored report with an explicit freshness verdict** — never pretends. Verdict computation: no report or unmatchable legacy report → `none`; `report.identifier !== opf.metadata.identifier` → `different-project`; `report.timestamp < Date.parse(opf.metadata.modifiedDate)` → `stale`; else `current`. All messages are returned, info level included (that's where the ACC accessibility-metadata suggestions live).
- **Every message carries its chapterId** (via the existing `chapterIdOf(location.path)`) so the agent can scope to the open chapter or survey the book.
- Reads are never gated (bridge principle) — no confirmation prompt.

## Implementation notes

**axe seam**: `PreviewPane` exposes an imperative `runChecksForAgent(): Promise<A11ySection>` (the `export {}` + `bind:this` pattern used by `EditorPane.findAndSelectText`), and App threads it into the bridge context as `ctx.getChecks()`. Falls back to `status: "unavailable"` when no surface is rendered or axe can't load (file: context).

**Wire changes** (the standard four, per AGENT_BRIDGE.md): TOOLS entry in `scripts/agent-bridge.mjs` + `case 'seed_get_checks': return callTab('get_checks', {})`; `case 'get_checks'` in `module.js` handleTool; `getChecks()` in the App.svelte context object; a `describeAction` line for the overlay feed. Tests: `module.test.ts`, `loader.test.ts`, plus `triage.test.ts`.

**Plugin-side fixes bundled in**: call `clearLatestReport(file.name)` in the re-package stale branch (`plugins/publish-to-remote/src/App.svelte:302-308`); optionally (v2) stamp the OPF `dcterms:modified` into the report at validate time in both schema copies — the timestamp comparison above suffices for v1.

**Agent guidance**: extend `docs/AGENT_AUTHORING.md` (served via `seed_get_authoring_guide`) with a short section: what the categories mean, that `app-bug` items should be reported not "fixed", that a `stale` epubcheck verdict means "package + validate before trusting", and that landmark/heading-one findings are usually policy noise in EPUB.

## Phases

**Phase 1 — epubcheck side.** `triage.ts` + tests, freshness verdict, tool wiring end to end returning the epubcheck section (a11y returns `unavailable`), plugin mirror-clearing bug fix.

**Phase 2 — axe side.** `runChecksForAgent` seam in PreviewPane, live run with engine/caveats/needsReview, context threading.

**Phase 3 — guidance.** AGENT_AUTHORING.md section; revisit whether an EPUB-tuned axe config is worth diverging from the panel (default: don't).
