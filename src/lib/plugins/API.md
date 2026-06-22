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
    "id": "audio-clip",
    "name": "Audio Clip Editor",
    "entry": "audio-clip.html",
    "presentation": "panel"
  },
  {
    "id": "publish",
    "name": "Publish",
    "entry": "publish.html",
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

The core currently has hardcoded knowledge of which surface each known plugin id binds to (`publish` → the Publish view, `audio-clip` → the editor panel). A generalized extension-point registry is deferred until more than one `view` plugin exists.

---

## Presentation Modes

Two modes only: `panel` and `view`.

### `panel`

A fixed-height region above the editor textarea, toggled by a button in the editor toolbar. Suited to plugins that augment content editing in context.

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
  "opfsDirHandle": "FileSystemDirectoryHandle"
}
```

Sent immediately after the iframe loads. Provides:

- `opfsDirHandle` — a live handle to the shared output directory (the packaged-epub area). The plugin operates within this handle; it does not navigate the core's OPFS layout by path.

`FileSystemDirectoryHandle` is structured-cloneable across same-origin postMessage, so the handle is transferred directly.

### Plugin → Main (content insertion)

```json
{
  "type": "insert",
  "content": "string"
}
```

Inserts a string at the cursor position in the currently active textarea. The content is always a plain string — HTML, markdown, or plain text — assembled by the plugin. The main app performs the insertion without interpreting the format. Used by `panel` plugins.

---

## OPFS Conventions

OPFS is the storage substrate, but the core does **not** impose a path layout on plugins. Instead:

### Handed-over handle (the contract)

The core passes a `FileSystemDirectoryHandle` to the shared output directory in the `init` message. This handle _is_ the access contract. Plugins read and write within it and never hardcode core paths such as `/projects/{id}/`. This decouples plugins entirely from the main app's internal OPFS layout — the core can reorganise its storage without breaking plugins.

The shared output directory holds the packaged epub files the main app produces. The publish plugin lists and uploads these; the core's own Publish feature lists and downloads them.

### Plugin-private storage

Anything private to a plugin — for example the publish plugin's remote credentials (R2 keys, Google Drive tokens) — is stored in the plugin's **own** OPFS area, which the plugin obtains itself via `navigator.storage.getDirectory()` (it is same-origin with the core). The core neither knows about nor brokers this storage. There is no `/plugins/{id}/` convention.

Credentials stored in OPFS are volatile: not backed up, not synced, and lost if the user clears OPFS storage. Plugins are responsible for communicating this to the user.

---

## Plugin Lifecycle

### `panel` plugins

1. User toggles the panel from the editor toolbar.
2. Main app mounts the iframe with the plugin entry point.
3. On iframe load, main app sends `init`.
4. Plugin renders its UI; accesses its own OPFS storage as needed.
5. Plugin sends `insert` to place content at the cursor.
6. User toggles the panel closed (main app unmounts the iframe).

### `view` plugins

1. User opens the view's sidebar action.
2. Main app checks the surface's plugin: if **available and enabled**, it mounts the plugin iframe full-frame and sends `init` (with the output-dir handle); the plugin draws its own layout.
3. Otherwise the main app renders the **core full-frame feature** for that surface.
4. The plugin accesses the handed-over output dir and its own private OPFS storage directly. There is no further message traffic in the current design.

---

## The Publish View

The Publish view is the sole `view` surface. Its layout maps onto the app's left/right splitpane — but, because the plugin owns the whole frame, the plugin renders that split **inside its own iframe**.

- **Left — Local EPUBs.** The list of epubs in the shared output dir, each with per-file actions: `Upload`, `Validate`, `Report`, and `Overwrite?` + `Replace` when a matching remote file exists.
- **Right — Remote.** An `Active Remote` selector with `Add Remote` / `Edit` / `Remove`, and a `Remote Files` table (Name / Size / Modified / Delete).

**Validation** (epubcheck-ts) is folded into this plugin as the per-file `Validate` / `Report` actions. There is no standalone validator plugin and no background auto-run.

**Core fallback feature** (plugin unavailable or disabled): a complete full-frame local-epub manager — an elaborated "package-then-download". It lists the epubs in the shared output dir with download/package actions, and does not split the pane or reference the plugin. When the user clicks **Package EPUB** in the sidebar an epub file is generated, stored in `/publish` and the **Publish** sidebar action is selected.

---

## Enablement

Plugin enablement is user-controlled in **Settings**, gated behind **Project Settings → Advanced Mode**. When Advanced Mode is on, the settings page shows a list of available plugins, each with an **enable/disable checkbox**. A plugin's surface uses the plugin only when it is available _and_ enabled; otherwise the core feature is shown.

Enabled state is persisted via the settings service.

---

## Plugin Roster

| Plugin            | Presentation | Key Dependency              | Direction     |
| ----------------- | ------------ | --------------------------- | ------------- |
| Audio Clip Editor | panel        | wavesurfer.js               | insert → main |
| Publish           | view         | epubcheck-ts, R2/GDrive SDK | OPFS / handle |

The Publish plugin combines remote publishing (Cloudflare R2, Google Drive, Dropbox) OPDS catalog generation and EPUB validation in one artifact.

### Possible future plugins

Not committed — recorded only as candidates should the need arise: PDF Export, OPDS Import, Version Control. Each would be scoped (presentation mode, dependencies, storage) at the time it is actually built.

---

## Deferred Decisions

These do not need to be resolved before implementation begins.

- **Enabled-state scope** — per-project vs global. The enablement UI lives under Project Settings, but the persisted scope is undecided.
- **Shared output directory name/path** — referred to here as the "output dir"; exact name (e.g. `/publish`) to be fixed during implementation.
- **Generalized `view` extension points** — the single Publish view is hardcoded for now; a registry is deferred until a second `view` plugin exists.

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
