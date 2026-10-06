# Plugin Architecture Specification

## Governing Principle

The core app is a self-contained, embeddable `.html` file. It is designed to be bundled inside any epub it creates, ensuring future readers can open and edit the epub with no external dependencies. This constraint is non-negotiable.

The plugin layer exists to provide a richer feature set that is only relevant when the app is served over HTTP — either from the author's own hosting or a local `python -m http.server`. Plugins are never loaded from a `file:` URL. They carry heavy dependencies, external service integrations, or workflow automation that would be inappropriate to bundle into the core app.

**Decision rule:** if a feature requires a heavy dependency, an external service, or is irrelevant to a reader making modest text corrections, it belongs in the plugin layer, not the core.

**Plugin build expectations:** Each plugin is a self-contained build artifact with its dependencies bundled into the single `.html` entry point. Plugins must not rely on CDN imports at runtime. This preserves offline capability for the HTTP-served use case — a user running `python -m http.server` locally should be able to use all plugins without internet access. The only plugins exempt from this are those whose entire purpose is network access (remote publish), and even those should fail gracefully with a clear message rather than silently breaking.

**Design principle for this spec:** keep the contract as small as the real plugins actually demand. Message types, presentation modes, and conventions are added only when a concrete plugin needs them — not speculatively.

---

## Architecture Overview

```
core app (self-contained .html)
│
├── loads plugins/manifest.json (HTTP only)
├── resolves each plugin's enabled state from settings
└── for each surface:
    │
    ├── panel  → mounts plugin iframe above the editor textarea
    └── view   → if plugin enabled + available: mounts plugin iframe full-frame
                 else: renders the core's own full-frame feature
        │
        ├── postMessage API (minimal: init ↓, insert ↑)
        └── OPFS: core hands the plugin a directory handle in `init`;
                  plugins manage their own private storage independently
```

The core never brokers OPFS access through postMessage. It hands over a single `FileSystemDirectoryHandle` at launch; from there the plugin reads/writes directly.

---

## Plugin Discovery

Plugins are discovered via a build-generated manifest file at `plugins/manifest.json`, relative to the main app URL. The manifest is produced automatically at build time by scanning `plugins/*.html`. Adding a new plugin requires dropping an `.html` file into the plugins folder and running the build — no manual manifest editing.

The main app fetches the manifest on load when running over HTTP. If the fetch fails or the app is running from a `file:` URL, no plugins are loaded (the core features stand on their own).

**Availability vs. enablement** are distinct:

- **Available** — the plugin is listed in `plugins/manifest.json` (its file is present, served over HTTP).
- **Enabled** — the user has switched it on. Enablement is resolved at runtime from settings (see [Enablement](#enablement)), not baked into the build manifest.

A plugin is used only when it is both available and enabled; otherwise the relevant core feature is shown.

### Manifest Schema

```json
[
  {
    "id": "audio-clip-editor",
    "name": "Audio Clip Editor",
    "entry": "audio-clip-editor/plugin.html",
    "presentation": "panel"
  },
  {
    "id": "publish-to-remote",
    "name": "Publish to Remote",
    "entry": "publish-to-remote/plugin.html",
    "presentation": "view"
  }
]
```

**Fields:**

| Field          | Type   | Description                               |
| -------------- | ------ | ----------------------------------------- |
| `id`           | string | Unique identifier                         |
| `name`         | string | Display name for the settings list        |
| `entry`        | string | Filename of the plugin's HTML entry point |
| `presentation` | enum   | `panel` or `view` — see below             |

The core currently has hardcoded knowledge of which surface each known plugin id binds to (`publish-to-remote` → the Publish view, `audio-clip-editor` → the editor panel). A generalized extension-point registry is deferred until more than one `view` plugin exists.

---

## Presentation Modes

Two modes only: `panel` and `view`.

### `panel`

A content-sized region above the editor textarea, toggled by a button in the editor toolbar. Suited to plugins that augment content editing in context. The host tracks the plugin document's intrinsic height (same-origin ResizeObserver — no resize message), capped at half the viewport; the plugin's body must therefore be auto-height, not `height: 100%`.

**Example:** Audio Clip Editor — sits alongside the active textarea and inserts a formatted clip reference at the cursor position via the `insert` message.

### `view`

A dedicated sidebar surface (alongside the existing sidebar sections). Its content area is filled **entirely by the plugin iframe**, which draws its own internal layout.

Crucially, a `view` surface is backed by a **complete full-frame core feature** that runs when the plugin is unavailable or disabled. This is not a placeholder or an upsell — it is a working feature in its own right. The plugin is purely additive: when enabled it takes over the whole frame and layers richer capability on top.

**Example:** the **Publish** view. The core feature is a full-frame local-epub manager (an elaborated "package-then-download"). The publish plugin replaces the whole frame with a richer UI that adds remote storage (see [The Publish View](#the-publish-view)).

---

## postMessage API

The API is intentionally minimal — only the two messages the current plugins actually use.

### Main → Plugin (on launch)

```json
{
  "type": "init",
  "projectId": "publish",
  "opfsDirHandle": "FileSystemDirectoryHandle",
  "opfsDirPath": ["workspaces", "publish"],
  "surface": "send"
}
```

Sent once the plugin has posted `plugin-ready`. Provides:

- `opfsDirHandle` — a live handle to the shared output directory (the packaged-epub area). The plugin operates within this handle; it does not navigate the core's OPFS layout by path. WebKit cannot clone handles into iframes, so `opfsDirPath` names the same directory for the plugin to resolve itself.
- `surface` — for a plugin with several surfaces, which one this frame is (see below). Absent for single-surface plugins.

`FileSystemDirectoryHandle` is structured-cloneable across same-origin postMessage, so the handle is transferred directly.

### Plugin → Main (content insertion)

```json
{
  "type": "insert",
  "content": "string"
}
```

Inserts a string at the cursor position in the currently active textarea. The content is always a plain string — HTML, markdown, or plain text — assembled by the plugin. The main app performs the insertion without interpreting the format. Used by `panel` plugins.

### Plugin → Main → Plugin (adding a media file)

```json
{ "type": "add-media", "requestId": "string", "filename": "string", "mediaType": "audio/mpeg", "bytes": "ArrayBuffer" }
```

Adds a file the plugin made to the open book's manifest, through the same import path as a file dropped on the editor (EPUB-safe path, unique href, rollback on a failed write). Only the host writes the OPF, which is why this is a request. The host answers with `{ "type": "media-added", "requestId", "href" }`, or `{ "type": "media-added", "requestId", "error" }`. Audio types only for now; the panel host answers only where the editor gives it a handler (the audio panel). Used by the Audio Clip Editor's recorder.

---

## OPFS Conventions

OPFS is the storage substrate, but the core does **not** impose a path layout on plugins. Instead:

### Handed-over handle (the contract)

The core passes a `FileSystemDirectoryHandle` in the `init` message. This handle _is_ the access contract: plugins operate within it rather than resolving core paths like `/workspaces/{id}/` themselves, so the core can reorganise its storage without breaking plugins. **What the handle points at depends on the surface:**

- **`view` (publish)** — the shared output directory holding the packaged epub files the main app produces. The publish plugin lists and uploads these; the core's own Publish feature lists and downloads them.
- **`panel` (audio clip editor)** — the **active project's workspace root**. A plugin is a trusted extension of the core app, not a security boundary: the panel plugin navigates the EPUB-standard container structure itself (`META-INF/container.xml` → OPF → manifest) to find the files it works on, and keeps its project-resident data under `SOURCE/plugins/{id}/` inside that workspace (see process/AUDIO_CLIP_PLUGIN_DESIGN.md). Within the workspace it follows EPUB structure, not core-internal conventions.

### Plugin-private storage

Anything private to a plugin — for example the publish plugin's remote credentials (R2 keys, Google Drive tokens) — is stored in the plugin's **own** OPFS area, which the plugin obtains itself via `navigator.storage.getDirectory()` (it is same-origin with the core). The core neither knows about nor brokers this storage. There is no `/plugins/{id}/` convention.

Credentials stored in OPFS are volatile: not backed up, not synced, and lost if the user clears OPFS storage. Plugins are responsible for communicating this to the user.

---

## Plugin Lifecycle

### `panel` plugins

1. User toggles the panel from the editor toolbar.
2. Main app mounts the iframe with the plugin entry point (host component: `src/lib/components/plugins/PluginPanel.svelte`).
3. Plugin posts `plugin-ready`; main app answers with `init` (workspace-root handle) and `context`. If the handshake never completes (offline, 404, crash) — or there is no OPFS backend to hand over — the panel falls back to the built-in core feature with a retry affordance.
4. Plugin renders its UI, reading the workspace through the handed handle.
5. Plugin sends `insert` to place content at the cursor.
6. User toggles the panel closed (main app unmounts the iframe).

### `view` plugins

1. User opens the view's sidebar action.
2. Main app checks the surface's plugin: if **available and enabled**, it mounts the plugin iframe full-frame and sends `init` (with the output-dir handle); the plugin draws its own layout.
3. Otherwise the main app renders the **core full-frame feature** for that surface.
4. The plugin accesses the handed-over output dir and its own private OPFS storage directly. There is no further message traffic in the current design.

---

## The Publish plugin's three surfaces

The publish plugin is the sole `view` plugin, and it is mounted in three places rather than one. The host names the surface in the `init` message (`surface`), and the plugin renders only that surface (process/PUBLISH_REWORK.md). Each mount is a `src/lib/components/plugins/PluginFrame.svelte`, which owns the handshake, the failure fallback and the message routing.

- **`send`** — the "Publish to the web" band on the Share page. The plugin lists the user's destinations, says what the open book's latest package is doing on each (matched by the `activeIdentifier` from `context`), and offers Send and an "In the catalog" switch. The head of the band validates the latest package (epubcheck) and shows the report. The frame is content-height: the host watches the plugin document's height (same-origin ResizeObserver) like a `panel`.
- **`published`** — the Published page beside Books. A destination picker, the catalog's identity, and the destination's shelf of EPUBs. A remote book not on this device offers Import…, which fetches the bytes and sends `import-epub`. The frame fills the page.
- **`destinations`** — the Destinations section of Settings › You. The list of destinations with Edit / Reconnect / Remove, and the add form. Content-height.

The three frames may be alive at once (the Settings sheet opens over Share). The plugin keeps its destinations in its own OPFS file and tells its other frames about changes over a `BroadcastChannel`, so a destination added in Settings appears in the band without a reload.

**Validation** (epubcheck-ts) stays in this plugin, on the `send` surface. There is no standalone validator plugin and no background auto-run; the report is mirrored into localStorage for the editor's checks panel (`src/lib/plugins/validation-report.ts`).

**Core fallback feature** (plugin unavailable or disabled): the Share page's own cards and packaged-files table. The band, the Published page and the Destinations section are simply absent. When the user clicks **Package EPUB** an epub file is generated, stored in `/publish` and the Share tab is selected.

### Messages the publish surfaces add

- `context.knownIdentifiers` (main → plugin): the dc:identifiers of every book on this device, so the shelf can tell "known here" from "importable".
- `navigate` (plugin → main): open the chapter for a content-document path flagged by epubcheck.
- `read-epub` (plugin → main): open a packaged or remote EPUB in the reader tab.
- `import-epub` (plugin → main): `{ filename, bytes: ArrayBuffer }` — the host imports the bytes as a new book through its normal import path (its "already a project here" prompt included).
- `open` (plugin → main): `{ target: 'published' | 'destinations' }` — the host shows that screen.

---

## Enablement

Plugin enablement is user-controlled in **Settings**, gated behind **Project Settings → Advanced Mode**. When Advanced Mode is on, the settings page shows a list of available plugins, each with an **enable/disable checkbox**. A plugin's surface uses the plugin only when it is available _and_ enabled; otherwise the core feature is shown.

Enabled state is persisted via the settings service.

---

## Plugin Roster

| Plugin            | Presentation | Key Dependency              | Direction     |
| ----------------- | ------------ | --------------------------- | ------------- |
| Audio Clip Editor | panel        | wavesurfer.js, LAME (WASM)  | insert, add-media → main |
| Publish           | view         | epubcheck-ts, R2/GDrive SDK | OPFS / handle |

The Publish plugin combines remote publishing (S3-compatible, Google Drive, Dropbox, WebDAV, USB e-readers), OPDS catalog generation and EPUB validation in one artifact, rendered as three surfaces.

### Possible future plugins

Not committed — recorded only as candidates should the need arise: PDF Export, OPDS Import, Version Control. Each would be scoped (presentation mode, dependencies, storage) at the time it is actually built.

---

## Deferred Decisions

These do not need to be resolved before implementation begins.

- **Enabled-state scope** — per-project vs global. The enablement UI lives under Project Settings, but the persisted scope is undecided.
- **Shared output directory name/path** — referred to here as the "output dir"; exact name (e.g. `/publish`) to be fixed during implementation.
- **Generalized `view` extension points** — the publish plugin's three surfaces are hardcoded for now; a registry is deferred until a second `view` plugin exists.

## Proposed plugin.d.ts

```typescript
type InitMessage = {
  type: 'init';
  opfsDirHandle: FileSystemDirectoryHandle;
};

type InsertMessage = {
  type: 'insert';
  content: string;
};

type MainToPlugin = InitMessage;
type PluginToMain = InsertMessage;
```
