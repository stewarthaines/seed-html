/**
 * Shared host ↔ plugin contract.
 *
 * The core app loads plugins as self-contained .html files inside an iframe and
 * talks to them through a deliberately tiny postMessage protocol (see
 * ./API.md). This module is the single source of truth for that
 * protocol: the message shapes plus runtime guards used by the host and the
 * contract tests. Plugin packages mirror these types in their own source.
 *
 * Messages, kept to what the concrete plugins actually use:
 *   - plugin-ready (plugin → main): handshake; the plugin has mounted and is
 *     listening, so the host may now send `init`.
 *   - init   (main → plugin): hands over a working-directory OPFS handle (the
 *     shared output dir) plus a projectId the plugin echoes/validates.
 *   - context (main → plugin): ambient host environment the plugin inherits and
 *     applies to its own document (theme, locale, text direction). Sent on
 *     handshake and re-sent whenever any field changes, so the iframe tracks the
 *     app live without reloading. Deliberately extensible: plugins ignore unknown
 *     fields, so new keys can be added without breaking older plugins.
 *   - insert (plugin → main): inserts a string at the editor cursor (panel
 *     plugins only; the publish `view` plugin does not use it).
 *   - navigate / read-epub (plugin → main): open a chapter, or an EPUB in the
 *     reader tab.
 *   - import-epub / open (plugin → main): import a fetched EPUB as a new book;
 *     show the Published page or the Destinations settings.
 *
 * This mirrors the wire shapes implemented by plugins/publish-to-remote/src
 * (its src/types.ts + src/index.ts). The ./API.md spec predates the
 * plugin and omits `plugin-ready`/`projectId`; this module is the source of truth.
 */

/** Presentation surface a plugin binds to. */
export type PluginPresentation = 'panel' | 'view';

/**
 * Which of its surfaces a multi-surface plugin should render. The publish
 * plugin has three: the Send band on Share, the Published page, and the
 * Destinations section of Settings (process/PUBLISH_REWORK.md). Absent →
 * the plugin's default surface (`send`).
 */
export type PluginSurface = 'send' | 'published' | 'destinations';

/**
 * One entry in the build-generated `plugins/manifest.json`. Mirrors the schema
 * documented in ./API.md.
 */
export interface PluginManifestEntry {
  /** Unique identifier (e.g. 'publish'). */
  id: string;
  /** Display name shown in the Settings enablement list. */
  name: string;
  /** Filename of the plugin's built HTML entry point, relative to `plugins/`. */
  entry: string;
  /** Which surface the plugin binds to. */
  presentation: PluginPresentation;
}

/** plugin → main, sent once the plugin has mounted and is listening. */
export interface PluginReadyMessage {
  type: 'plugin-ready';
  /** Optional plugin identifier, e.g. 'publish-to-remote'. */
  pluginType?: string;
}

/** main → plugin, sent once after the plugin signals `plugin-ready`. */
export interface InitMessage {
  type: 'init';
  /**
   * Identifier the plugin validates/echoes. The publish plugin treats the handed
   * directory as its working dir, so this is informational (the active workspace
   * id, or the reserved output-dir id).
   */
  projectId: string;
  /**
   * Live handle to the shared output directory (the packaged-epub area).
   * Structured-cloneable across same-origin postMessage in Chromium — but
   * WebKit (iPadOS Safari) refuses to clone handles into iframes, so this
   * field is absent there and the plugin resolves its own handle from
   * `opfsDirPath` instead.
   */
  opfsDirHandle?: FileSystemDirectoryHandle;
  /**
   * OPFS path segments of the same directory, from
   * `navigator.storage.getDirectory()` — plain strings, cloneable everywhere.
   * Plugins are same-origin, so their iframe sees the same OPFS root and can
   * walk these segments to an equivalent handle when `opfsDirHandle` is
   * absent.
   */
  opfsDirPath?: string[];
  /**
   * The surface the host is mounting this frame for. Older plugins ignore it
   * and render their single UI.
   */
  surface?: PluginSurface;
}

/**
 * main → plugin, the ambient host environment the plugin inherits and mirrors on
 * its own document root. Sent after `plugin-ready` and re-sent on any change.
 * Extensible: add fields (e.g. a runtime mode) without breaking existing plugins,
 * which simply ignore keys they don't read.
 */
export interface ContextMessage {
  type: 'context';
  /** Active app theme; the plugin reflects it as `data-theme`. */
  theme: 'light' | 'dark';
  /** Active UI locale as a BCP 47 code (e.g. 'en', 'ar'); set as `lang`. */
  locale: string;
  /** Text direction derived from the locale; set as `dir`. */
  dir: 'ltr' | 'rtl';
  /**
   * The active locale's translation dictionary (English source string → localized
   * string), so the plugin can translate its own UI without its own catalog or
   * bundle. Optional for back-compat; absent → the plugin shows English source.
   */
  messages?: Record<string, string>;
  /**
   * The currently-open project's dc:identifier (urn:uuid), so the plugin can
   * outline the matching published rows. Optional / back-compat; absent → no
   * row is highlighted.
   */
  activeIdentifier?: string;
  /**
   * dc:identifiers of every book on this device, so the publish plugin can
   * tell a remote EPUB that is "known here" from one that can be imported.
   * Optional / back-compat; absent → nothing is known here.
   */
  knownIdentifiers?: string[];
  /**
   * Spine item id of the chapter the editor currently has open, so a panel
   * plugin can scope itself to that chapter's own content rather than the whole
   * book (the photo-regions panel lists the images this chapter renders).
   * Optional / back-compat; absent → the plugin falls back to book-wide.
   */
  activeChapterId?: string;
}

/** plugin → main, inserts a plain string at the active textarea's cursor. */
export interface InsertMessage {
  type: 'insert';
  content: string;
}

/**
 * plugin → main, asks the host to open the editor resource at `path` (a
 * container-relative path such as `OEBPS/Text/chapter.xhtml`). The host resolves
 * it to the relevant view; non-resolvable paths are ignored.
 */
export interface NavigateMessage {
  type: 'navigate';
  path: string;
}

/**
 * plugin → main, asks the host to open a packaged EPUB in the vendored reader
 * tab. The host owns the reader URL construction (the plugin iframe's own base
 * would resolve `read/` wrongly). Exactly one source field is set: `filename`
 * for a file in the shared output dir (the host reads the bytes itself), or
 * `url` for a remote object's public URL (handed to the reader to fetch —
 * subject to the remote allowing cross-origin reads).
 */
export interface ReadEpubMessage {
  type: 'read-epub';
  /** A file in the shared output dir. */
  filename?: string;
  /** A publicly fetchable EPUB URL (e.g. an R2 object). */
  url?: string;
}

/**
 * plugin → main, hands the host the bytes of an EPUB fetched from a
 * destination so the host imports it as a new book through its normal import
 * path (the plugin has the credentials; the host has the importer).
 */
export interface ImportEpubMessage {
  type: 'import-epub';
  filename: string;
  bytes: ArrayBuffer;
}

/**
 * plugin → main, asks the host to show one of its own screens: the Published
 * page, or Settings opened on the Destinations section.
 */
export interface OpenMessage {
  type: 'open';
  target: 'published' | 'destinations';
}

/**
 * The OPFS path of a workspace's directory, as segments from the storage
 * root. This layout (`workspaces/<id>`) is the storage backend's stable
 * on-disk shape (see src/lib/storage/index.ts getWorkspaceDirectoryHandle);
 * it is part of this contract so plugins can resolve handles themselves
 * where handles can't ride postMessage.
 */
export function workspaceOpfsPath(workspaceId: string): string[] {
  return ['workspaces', workspaceId];
}

/**
 * Build an `init` message. Pass the handle where it can be cloned; hosts
 * catching a DataCloneError re-send with `opfsDirHandle` omitted and the
 * plugin walks `opfsDirPath` instead.
 */
export function createInitMessage(
  projectId: string,
  opfsDirHandle: FileSystemDirectoryHandle | undefined,
  opfsDirPath: string[],
  surface?: PluginSurface
): InitMessage {
  const message: InitMessage = { type: 'init', projectId, opfsDirHandle, opfsDirPath };
  if (surface) message.surface = surface;
  return message;
}

/** Build a `context` message carrying the inheritable host environment. */
export function createContextMessage(
  theme: 'light' | 'dark',
  locale: string,
  dir: 'ltr' | 'rtl',
  messages?: Record<string, string>,
  activeIdentifier?: string,
  activeChapterId?: string,
  knownIdentifiers?: string[]
): ContextMessage {
  const message: ContextMessage = {
    type: 'context',
    theme,
    locale,
    dir,
    messages,
    activeIdentifier,
    activeChapterId,
  };
  if (knownIdentifiers) message.knownIdentifiers = knownIdentifiers;
  return message;
}

/** Runtime guard: is this an `init` message carrying a usable directory handle? */
export function isInitMessage(value: unknown): value is InitMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'init' &&
    typeof (value as { projectId?: unknown }).projectId === 'string' &&
    'opfsDirHandle' in value &&
    (value as InitMessage).opfsDirHandle?.kind === 'directory'
  );
}

/** Runtime guard: is this a `context` message carrying a valid environment? */
export function isContextMessage(value: unknown): value is ContextMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'context' &&
    ((value as ContextMessage).theme === 'light' || (value as ContextMessage).theme === 'dark') &&
    typeof (value as { locale?: unknown }).locale === 'string' &&
    ((value as ContextMessage).dir === 'ltr' || (value as ContextMessage).dir === 'rtl')
  );
}

/** Runtime guard: is this the plugin's `plugin-ready` handshake? */
export function isPluginReadyMessage(value: unknown): value is PluginReadyMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'plugin-ready'
  );
}

/** Runtime guard: is this an `insert` message carrying a string payload? */
export function isInsertMessage(value: unknown): value is InsertMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'insert' &&
    typeof (value as { content?: unknown }).content === 'string'
  );
}

/** Runtime guard: is this a `navigate` message carrying a string path? */
export function isNavigateMessage(value: unknown): value is NavigateMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'navigate' &&
    typeof (value as { path?: unknown }).path === 'string'
  );
}

/** Runtime guard: is this a `read-epub` message carrying a filename or a URL? */
export function isReadEpubMessage(value: unknown): value is ReadEpubMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'read-epub' &&
    (typeof (value as { filename?: unknown }).filename === 'string' ||
      typeof (value as { url?: unknown }).url === 'string')
  );
}

/** Runtime guard: is this an `import-epub` message carrying a filename and bytes? */
export function isImportEpubMessage(value: unknown): value is ImportEpubMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'import-epub' &&
    typeof (value as { filename?: unknown }).filename === 'string' &&
    (value as { bytes?: unknown }).bytes instanceof ArrayBuffer
  );
}

const OPEN_TARGETS: ReadonlySet<string> = new Set(['published', 'destinations']);

/** Runtime guard: is this an `open` message naming a host screen? */
export function isOpenMessage(value: unknown): value is OpenMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'open' &&
    typeof (value as { target?: unknown }).target === 'string' &&
    OPEN_TARGETS.has((value as { target: string }).target)
  );
}
