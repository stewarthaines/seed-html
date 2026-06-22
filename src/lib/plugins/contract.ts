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
 *
 * This mirrors the wire shapes implemented by plugins/publish-to-remote/src
 * (its src/types.ts + src/index.ts). The ./API.md spec predates the
 * plugin and omits `plugin-ready`/`projectId`; this module is the source of truth.
 */

/** Presentation surface a plugin binds to. */
export type PluginPresentation = 'panel' | 'view';

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
   * Live handle to the shared output directory (the packaged-epub area). The
   * plugin operates within this handle and never navigates the core's OPFS by
   * path. Structured-cloneable across same-origin postMessage.
   */
  opfsDirHandle: FileSystemDirectoryHandle;
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

export type MainToPlugin = InitMessage | ContextMessage;
export type PluginToMain = PluginReadyMessage | InsertMessage | NavigateMessage;

/** Build an `init` message for a given output-dir handle. */
export function createInitMessage(
  projectId: string,
  opfsDirHandle: FileSystemDirectoryHandle
): InitMessage {
  return { type: 'init', projectId, opfsDirHandle };
}

/** Build a `context` message carrying the inheritable host environment. */
export function createContextMessage(
  theme: 'light' | 'dark',
  locale: string,
  dir: 'ltr' | 'rtl',
  messages?: Record<string, string>,
  activeIdentifier?: string
): ContextMessage {
  return { type: 'context', theme, locale, dir, messages, activeIdentifier };
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
