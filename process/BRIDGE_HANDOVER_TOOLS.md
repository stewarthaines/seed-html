# Bridge — tools for a whole-book hand-over

Status: design draft, 2026-11-17, for review before any code. Covers the first three gaps in `process/AGENTIC_AUTHORING.md` proposal 1 (order agreed 2026-11-17): create a chapter, add media from disk, and render / package / validate on request. Builds on `process/AGENT_BRIDGE.md` (design of record), `BRIDGE_WRITE_REVIEW.md` (code vs prose tiers) and `BRIDGE_PREAPPROVED_WRITES.md` (session grant).

## Shape of the change

Each tool follows the existing pattern: a definition in `scripts/agent-bridge.mjs` `TOOLS`, a case in `handleTool` in `src/lib/agent-bridge/module.js`, and one new function on the module context that `App.svelte` builds in `createAgentBridge(() => ({ … }))`. The context function calls the same app service the UI calls, so manifest, spine, preview and activity feed stay right; the module keeps consent, validation of arguments and the feed entry. No tool writes OPFS itself where an app service exists.

## 1. `seed_create_chapter`

Arguments: `id` (the chapter id the author would type; refused if taken), `title`, `after` (an existing chapter id; end of spine when omitted), `linear` (default true), `text` (the chapter source, optional).

Context function `createChapter(params, workspaceId)` runs `spineService.addChapter` with the id as its base name (the service already derives a unique id from a base name, but here a taken id is an error, not a renamed chapter, so the agent's links stay right), then `reorderItems` to place it after `after`, `setChapterLinear` when `linear` is false, and writes `SOURCE/text/<id>.txt`. It hands the updated workspace to `onWorkspaceUpdate`, since a change made to a detached copy of the workspace is overwritten by the next OPF save.

Consent: the prose tier. A session grant covers it; otherwise one prompt naming the id, position and linear flag. The feed shows "Created chapter <id> after <after>". Refused when track changes is on, because review mode blocks spine changes; the error says so, so the agent can ask the author.

The same function is the base for later spine tools (move, rename, delete), which are not in this draft.

## 2. `seed_add_media`

Arguments: `path` (a local file path), `folder` (optional single subfolder inside the media type's folder, as plugins may ask for), `overwrite` (default false).

The file never passes through the agent's context. The bridge process reads it from disk and sends the bytes over the WebSocket. To keep a book-reading agent from turning the bridge into a way to read arbitrary local files into the browser, the bridge only reads under a media root the author names when starting it (`--media-root <dir>`, or an environment variable); without one, the tool is not listed. Paths are resolved and checked to stay inside the root, symlinks included.

Context function `addMedia(filename, mediaType, bytes, { folder, overwrite }, workspaceId)` uses the dropped-file import path in `EditorPane` (`analyzeManifestCollision`, then add or `overwriteManifestFile`), lifted into a shared helper next to `src/lib/plugins/add-media.ts`, which already does the plugin version of this. Identical bytes under an existing name are a no-op that returns the existing href. Different bytes under an existing name are refused unless `overwrite` is true, and an overwrite takes its own prompt even under a session grant (it replaces something the book already shows). The result reports the manifest href actually used, including the app's file-name rules (the `.JPG` → `.jpg` case change seen on 2026-11-17), so the agent references the right name.

Media type comes from the extension, limited to the types the manifest import accepts. The 2 MB write cap does not apply; a separate cap (say 25 MB) keeps a mistaken path from importing a video.

## 3. Render, package and validate

### `seed_show_chapter`

Arguments: `id`. Moves the Write view's preview to that chapter and returns when the render has settled, with the chapter id and whether it rendered cleanly. Context function wraps `SpinePreviewManager.switchToSpineItem` and waits for the render the same way `seed_inspect_elements` reports `render-in-flight`. This is what lets `seed_inspect_elements`, the axe half of `seed_get_checks` and `seed_get_rendered_xhtml` cover every chapter in a hand-over. Read tier: no prompt, but the feed notes it, since the author sees their preview move.

### `seed_render`

Arguments: `ids` (chapter ids; all when omitted). Renders each chapter through the same pipeline and writes its XHTML (`spine-preview-manager.ts` writes it at line ~581 today), without moving the visible preview. Returns per chapter: rendered, failed (with the transform error), or unchanged. Read tier: it only regenerates outputs the app owns. This deliberately does not decide staleness; review question 3 (when packaging should re-render) is for the next session, and an explicit render keeps that question open.

### `seed_package`

Packages the open book through `handlePackageRequest` in `App.svelte` (nav regeneration included), as the Share view's Package button does, and returns the package filename. No prompt; the feed notes it.

### `seed_validate`

Runs epubcheck on the latest package and returns the report (`isValid`, counts, messages). Today epubcheck runs only inside the publish plugin (`plugins/publish-to-remote/src/epub-validation.ts`, `EpubCheck.validate` on the bytes), which writes the report the host reads through `src/lib/plugins/validation-report.ts`. Two ways to reach it:

- Ask the plugin: a host → plugin request "validate this package" over the plugin postMessage API, answered with the report. Keeps one epubcheck, but needs the plugin loaded without its Share-view surface, the same headless need as plugin actions (proposal 1).
- Run it in the bridge process: the bridge reads the package bytes from the module and runs the same epubcheck library in Node. Simpler, and independent of the publish plugin being enabled, but a second copy of epubcheck to keep at the same version.

Recommendation: the bridge-side run for now (fewer moving parts, works when the publish plugin is off), provided the library the plugin bundles (`@likecoin/epubcheck-ts`, a TypeScript port) also runs under Node, which needs checking first; writing its report through the same `saveValidationReport` shape so the Share view and `seed_get_checks` see it as current.

## Not in this draft

Settings and extension changes, plugin actions, patch writes (`BRIDGE_PATCH_WRITE.md`), metadata, rename, delete and moves, preview capture, and the hand-over grant itself. The hand-over grant is the session grant already built, widened to cover creation and media adds; it needs no new tool.

## Questions for review

1. Media root: a flag at bridge start, or a folder the author picks in the app when granting the session (the app would then pass a token the bridge checks)?
2. `seed_validate`: bridge-side epubcheck, or a request to the publish plugin?
3. Should `seed_create_chapter` accept a frontmatter block, or is that just part of `text`?
