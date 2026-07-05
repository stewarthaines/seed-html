# Audio Clip Plugin — Design

Status: reviewed design, not yet implemented.
Scope: an advanced-mode panel plugin that replaces the built-in audio clip editor with a wavesurfer.js waveform UI, managing a persistent per-audio-file library of clip regions.

## Background

The core app ships a built-in audio clip editor (`src/lib/components/audio/AudioClipEditor.svelte`, hosted by `src/lib/components/spine/EditorPane.svelte`) that appears in the spine item editor when the project manifest contains audio. It offers a file select, numeric time entry with jog buttons, playback preview, and inserts a clip directive at the textarea cursor using the `audio_clip_template` EPUB setting (default `:clip[<label>]{src=<href> begin=<begin> end=<end>}`, formatted by `src/lib/audio/audio-clip.service.ts`).

This design adds a richer, waveform-based alternative as a plugin so the wavesurfer.js dependency never enters the core single-file bundle. Plugins are HTTP-only (never loaded in the `file:` build), so the offline build loses nothing.

### Why not cockatiel

[Cockatiel](https://github.com/paradisec-archive/cockatiel) (PARADISEC's audio annotation tool) was investigated first and rejected as an embedded component:

- It is a standalone React app with no embedding or postMessage API.
- Its Silero VAD requires `SharedArrayBuffer`, i.e. cross-origin isolation (COOP/COEP). An isolated iframe requires the top-level SEED.html page to adopt those headers too, and `COOP: same-origin` on a popup severs `window.opener` — the isolation it needs destroys the channels an integration would use.
- VAD failure aborts session creation outright, so it cannot degrade gracefully when isolation is absent.
- Its unit of work is a transcript (many segments, speaker tiers); ours is clip directives.

Cockatiel remains useful *alongside* SEED.html via file-based hand-off (export SRT/CSV, import as clip-tagged text) — a possible later feature, out of scope here.

## Decisions

These were settled in design review:

1. **Panel plugin, supersede model.** The plugin is the second plugin in the existing architecture (`presentation: "panel"`, already defined in `src/lib/plugins/contract.ts` but never wired). When enabled and handshaken, it replaces the built-in editor surface in the spine editor; on load failure, timeout, `file:` protocol, or when disabled, the built-in `AudioClipEditor` renders as the fallback — the same supersede-with-fallback pattern `PublishView.svelte` uses for publish-to-remote.
2. **Plugin-side audio file picker; plugin reads the workspace directly.** `init.opfsDirHandle` carries the *project workspace root* handle. The plugin locates the OPF via the EPUB-standard `META-INF/container.xml`, filters the manifest for `audio/*` items, presents its own file picker, and reads audio bytes through the handle. A plugin is a trusted extension of the core app, not a security boundary — no brokered file access, no host-side picker.
3. **Insertion uses the existing generic `insert` message.** The plugin formats the clip directive itself and sends a plain string; the host's only job is the cursor splice. The template is NOT duplicated: since the plugin holds the workspace root handle (decision 2), it reads `SOURCE/settings.json` → `audio_clip_template` directly — the same setting the built-in editor uses, now exposed in the EPUB Settings UI — falling back to the built-in default, and re-reading at insert time so mid-session settings changes apply. Read-only: settings writes stay host-side. What the plugin mirrors by hand is *code* (the placeholder-substitution/time-format logic of `formatClipDirective`), like it already mirrors the contract types. (Considered and rejected: a plugin-private template — user-visible config drift; pushing the template via `context` — contract surface for something the trusted plugin can read itself.)
4. **Persistent per-file clip library, project-resident.** The plugin manages a set of named clip regions per audio file and persists them itself, publish-plugin-style, as JSON written through its workspace handle at `SOURCE/plugins/audio-clip-editor/clips.json`. Unlike publish's device-local credentials, the library lives inside the project so it rides along in `SEED.zip` — it survives packaging, export/import, and moving between machines. Clip definitions are authoring data, not secrets; they should travel with the project.
5. **Plugin creates its own data directory on demand.** The plugin creates `SOURCE/plugins/audio-clip-editor/` via its workspace handle on first save. This is an approved, deliberate design choice (noted explicitly because auto-creating files is otherwise against project policy).

## Contract

**No changes to the message protocol.** The existing contract (`src/lib/plugins/contract.ts`) covers everything: `plugin-ready` (handshake), `init` (project id + OPFS handle), `context` (theme / locale / i18n catalog), and `insert` (string at cursor).

What differs from publish-to-remote is only what the existing fields carry:

- `init.opfsDirHandle` — the *active project workspace root* handle (via `getWorkspaceDirectoryHandle(activeWorkspaceId)`), not the shared `publish` output directory.
- `init.projectId` — the real workspace id.

Plugin → main insertion uses the existing `insert` message (`{ type: 'insert', text: string }`) with the fully-formatted directive string. The host wires the first `isInsertMessage` handler, routing into the existing `insertClipDirective()`-style splice (cursor read, insert, `setSelectionRange`, synthetic `input` event for persistence).

## Plugin package

- `plugins/audio-clip-editor/` — own Vite + Svelte workspace mirroring `plugins/publish-to-remote/` (single-file build via `vite-plugin-singlefile`, `editmePlugin` block in `package.json` with `presentation: "panel"`, `buildEntry: "dist/plugin.html"`).
- Picked up automatically by `scripts/generate-plugin-manifest.js` and the dev middleware in `vite.config.ts` — no catalog changes needed.
- i18n via the shared-catalog pattern: the `context` message carries the active locale's message dictionary; the extractor already scans `plugins/*/src`.
- Manifest reading: locates the OPF via `META-INF/container.xml`, filters manifest items with `media-type` starting `audio/` (`DOMParser`, per project code style), and presents its own audio file picker.
- Bundles wavesurfer.js + its regions, minimap, and zoom plugins. UI: audio file picker; waveform with all saved regions for the current file rendered; drag/resize to define bounds; minimap for whole-file orientation; wheel/slider zoom for fine boundary placement; play / loop-region; label field; region list (select, rename, delete); Insert button for the selected region.
- Directive format: read from `SOURCE/settings.json` → `audio_clip_template` (the setting the built-in editor uses, exposed in EPUB Settings), falling back to the core default; re-read at insert time. Substitution/time-format logic mirrors `formatClipDirective` by hand. Note the per-format templates: djot needs quoted attribute values (`src="<href>" …`), markdown accepts bare or quoted.
- Persistence: `SOURCE/plugins/audio-clip-editor/clips.json` written via the workspace handle, keyed by audio href. Schema is plugin-private; the host never reads it.

## Host wiring

- `App.svelte`: a second hardcoded plugin-id → surface binding (`audio-clip-editor`), same shape as `PUBLISH_PLUGIN_ID` — `API.md` explicitly defers a generalized surface registry until warranted, and two bindings doesn't warrant it yet.
- `EditorPane.svelte`: when the plugin is enabled and audio files exist, the audio-editor toggle mounts the plugin iframe (with `plugin-ready` handshake + grace timer, cribbed from `PublishView.svelte`) instead of `AudioClipEditor`; fallback renders the built-in editor.
- `API.md` needs updating alongside implementation: it currently states plugins never see core paths — the stance shifts to "a plugin is a trusted extension of the core app, not a security boundary", with the workspace-root handle as the sanctioned access path.
- Enablement: the existing global `enabled_plugins` setting; the enable/disable UI is already advanced-mode-gated in `SettingsView.svelte`.

## Known trade-offs

- **OPFS-only.** `getWorkspaceDirectoryHandle` returns null on the IndexedDB storage fallback, so the plugin cannot mount there; users get the built-in editor. Same constraint publish-to-remote already accepts.
- **Direct handle access bypasses `FileStorageAPI`**, including track-changes copy-on-write at `writeFile`. Reads (OPF, audio) are inherently safe; writes are confined by convention to the plugin's own `SOURCE/plugins/audio-clip-editor/` — a convention, not an enforcement, consistent with the trusted-extension stance. Judged harmless for plugin-private JSON the host never reads.
- **The plugin reads a core-internal file.** Using `SOURCE/settings.json` → `audio_clip_template` makes that path/field a de-facto interface the plugin depends on (a step beyond the EPUB-standard container structure it otherwise navigates). Accepted under the trusted-extension stance — both live in this repo, and the field is validated core schema.
- **Clips key on manifest href.** Renaming an audio file orphans its clip set. Acceptable for v1; the plugin could add a duration sanity check or re-keying UI later.
- **`SOURCE/plugins/...` visibility.** The clips file may appear in advanced-mode SOURCE file listings. Harmless; filter later if it proves noisy.

## Phasing

1. **Host wiring** — panel-plugin mount in `EditorPane` with handshake/fallback, `init` carrying the workspace-root handle, `isInsertMessage` handler. This is the reusable investment for any future editor-adjacent plugin.
2. **Plugin v1** — waveform + regions + library persistence + insert.
3. **Follow-ups (unscheduled)** — energy-based silence detection to auto-suggest regions (RMS thresholding on the decoded `AudioBuffer`; no WASM, no isolation requirements); "load from selection" parsing an existing directive back into a region (parse logic exists in `AudioClipEditor.svelte`); batch-insert all clips; optional single-threaded `onnxruntime-web` Silero VAD inside the plugin if RMS proves insufficient.
