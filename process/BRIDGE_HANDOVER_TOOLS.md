# Bridge — tools for a whole-book hand-over

Status: design agreed 2026-11-18 (review questions answered below); building on branch `agent-ergonomics` in section order. Covers the first three gaps in `process/AGENTIC_AUTHORING.md` proposal 1 (order agreed 2026-11-17): create a chapter, add media from disk, and render / package / validate on request. Builds on `process/AGENT_BRIDGE.md` (design of record), `BRIDGE_WRITE_REVIEW.md` (code vs prose tiers) and `BRIDGE_PREAPPROVED_WRITES.md` (session grant).

## Shape of the change

Each tool follows the existing pattern: a definition in `scripts/agent-bridge.mjs` `TOOLS`, a case in `handleTool` in `src/lib/agent-bridge/module.js`, and one new function on the module context that `App.svelte` builds in `createAgentBridge(() => ({ … }))`. The context function calls the same app service the UI calls, so manifest, spine, preview and activity feed stay right; the module keeps consent, validation of arguments and the feed entry. No tool writes OPFS itself where an app service exists.

## 1. `seed_create_chapter`

Arguments: `id` (the chapter id the author would type; refused if taken), `title`, `after` (an existing chapter id; end of spine when omitted), `linear` (default true), `text` (the chapter source, optional).

Context function `createChapter(params, workspaceId)` runs `spineService.addChapter` with the id as its base name (the service already derives a unique id from a base name, but here a taken id is an error, not a renamed chapter, so the agent's links stay right), then `reorderItems` to place it after `after`, `setChapterLinear` when `linear` is false, and writes `SOURCE/text/<id>.txt`. It hands the updated workspace to `onWorkspaceUpdate`, since a change made to a detached copy of the workspace is overwritten by the next OPF save.

Consent: the prose tier. A session grant covers it; otherwise one prompt naming the id, position and linear flag. The feed shows "Created chapter <id> after <after>". Refused when track changes is on, because review mode blocks spine changes; the error says so, so the agent can ask the author.

The same function is the base for later spine tools (move, rename, delete), which are not in this draft.

## 2. `seed_add_media`

Arguments: `path` (a local file path), `folder` (optional single subfolder inside the media type's folder, as plugins may ask for), `overwrite` (default false).

The file never passes through the agent's context. The bridge process reads it from disk and sends the bytes over the WebSocket. To keep a book-reading agent from turning the bridge into a way to read arbitrary local files into the browser, the bridge only reads under media folders the author has allowed. Paths are resolved and checked to stay inside an allowed folder, symlinks included.

Allowing a folder (decided 2026-11-18): the author tells the agent which folder holds the media, and the agent calls `seed_allow_media_folder` with that path. The bridge resolves the real path and asks the app to prompt the author, naming the folder and showing the full path ("Let the agent add pictures and other media from jubilee_history_1903 to this book?"). Only the author's answer in the page grants it; an instruction planted in a book can ask, but the author sees the request. An allowed folder holds until the bridge restarts or the author withdraws it; the activity feed records the grant and the bridge panel lists the allowed folders. A `--media-root <dir>` flag at bridge start is an optional pre-approved folder for authors who always use the same one. `seed_add_media` is listed always and refuses with "no media folder allowed" until one is, so the agent knows to ask.

Restarting: `/mcp` in Claude Code reconnects a server without leaving the CLI; whether a reconnect picks up a changed `--media-root` in the MCP config is untested and is checked before relying on it.

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

Decided 2026-11-18: epubcheck stays in the publish plugin, and the agent runs it the way the author does, by going to the Share view. If the plugin is off for the book, the agent cannot validate, and the tool says so. Running epubcheck in the app was ruled out because the single-file build inlines every import, and epubcheck would more than double `index.html`; running it in the bridge was set aside to keep one epubcheck and one report.

No arguments. Steps:

1. The context function switches the app to the Share view, as clicking it does. If the publish plugin is not enabled, it returns "Validation needs the publish plugin, which is off for this book" without switching.
2. While the Send surface's `PluginFrame` is mounted and the plugin has sent `plugin-ready`, it registers a `validate()` function with a small host-side holder; the context function waits for that registration.
3. `validate()` posts a new host → plugin message `{ type: 'validate', requestId }`. The plugin runs the same `validate()` its button runs in `SendSurface.svelte` (so the report is saved and published to the app exactly as today) and answers `{ type: 'validated', requestId, report }`, or `{ type: 'validated', requestId, error }` when there is no package yet or epubcheck throws.
4. The tool returns the report (filename, timestamp, validity, counts, messages). The feed notes "Validated <filename>: N errors, M warnings". The app stays on the Share view.

One timeout (about two minutes, covering the plugin load and the check) and no retries; a timeout or a plugin load failure is returned as the tool's error, and the agent can ask the author. It validates the latest package, whose filename and timestamp are in the result; packaging first is the agent's job (`seed_package`), and whether packaging should re-render stale chapters is review question 3 of `AGENTIC_AUTHORING.md`.

Changes: the message pair in `src/lib/plugins/contract.ts` and `API.md`, the handler in the plugin, the holder and registration in `PublishView`/`PluginFrame`, and the context function and tool definition. Nothing is added to the bridge's dependencies or the app's bundle.

## Not in this draft

Settings and extension changes, plugin actions, patch writes (`BRIDGE_PATCH_WRITE.md`), metadata, rename, delete and moves, preview capture, and the hand-over grant itself. The hand-over grant is the session grant already built, widened to cover creation and media adds; it needs no new tool.

## Questions for review

1. Media root: decided 2026-11-18. Folders are allowed during the session through an in-app prompt the agent requests (`seed_allow_media_folder`), with `--media-root` as an optional pre-approved folder; see section 2.
2. `seed_validate`: decided 2026-11-18. A request to the publish plugin after switching to the Share view; no validation when the plugin is off; see section 3.
3. Frontmatter: decided 2026-11-18. No separate argument; `text` is the file as it will be stored, frontmatter block included, as with `seed_write_file`. Bad frontmatter is reported by the first render.
