/**
 * Shared host ↔ plugin contract.
 *
 * The core app loads plugins as self-contained .html files inside an iframe and
 * talks to them through a deliberately tiny postMessage protocol (see
 * plans/api/plugins.md). This module is the single source of truth for that
 * protocol: the message shapes plus runtime guards used by the host and the
 * contract tests. Plugin packages mirror these types in their own source.
 *
 * Messages, kept to what the concrete plugins actually use:
 *   - plugin-ready (plugin → main): handshake; the plugin has mounted and is
 *     listening, so the host may now send `init`.
 *   - init   (main → plugin): hands over a working-directory OPFS handle (the
 *     shared output dir) plus a projectId the plugin echoes/validates.
 *   - insert (plugin → main): inserts a string at the editor cursor (panel
 *     plugins only; the publish `view` plugin does not use it).
 *
 * This mirrors the wire shapes implemented by plugins/publish-to-remote/src
 * (its src/types.ts + src/index.ts). The plans/api/plugins.md spec predates the
 * plugin and omits `plugin-ready`/`projectId`; this module is the source of truth.
 */

/** Presentation surface a plugin binds to. */
export type PluginPresentation = 'panel' | 'view';

/**
 * One entry in the build-generated `plugins/manifest.json`. Mirrors the schema
 * documented in plans/api/plugins.md.
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

export type MainToPlugin = InitMessage;
export type PluginToMain = PluginReadyMessage | InsertMessage | NavigateMessage;

/** Build an `init` message for a given output-dir handle. */
export function createInitMessage(
  projectId: string,
  opfsDirHandle: FileSystemDirectoryHandle
): InitMessage {
  return { type: 'init', projectId, opfsDirHandle };
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
