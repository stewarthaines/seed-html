/**
 * Wire shapes for the host ↔ plugin postMessage protocol. Mirrors the host's
 * single source of truth, src/lib/plugins/contract.ts — the plugin builds
 * separately and can't import core modules, so keep these in sync by hand.
 */

/** main → plugin, sent once after the plugin signals `plugin-ready`. */
export interface InitMessage {
  type: 'init';
  /** The active workspace id (informational; echoed for validation). */
  projectId: string;
  /**
   * Live handle to the project workspace root. The plugin navigates the
   * EPUB-standard container structure (META-INF/container.xml → OPF) itself.
   * Absent where handles can't be cloned into iframes (WebKit/iPadOS).
   */
  opfsDirHandle?: FileSystemDirectoryHandle;
  /** OPFS path segments to the same directory; the plugin walks these when
      the handle is absent (same origin, same OPFS root). */
  opfsDirPath?: string[];
}

/** main → plugin, ambient host environment; re-sent on any change. */
export interface ContextMessage {
  type: 'context';
  theme: 'light' | 'dark';
  locale: string;
  dir: 'ltr' | 'rtl';
  /** Active locale's translation dictionary (English source → localized). */
  messages?: Record<string, string>;
  activeIdentifier?: string;
}

export type MainToPlugin = InitMessage | ContextMessage | MediaAddedMessage;

/** plugin → main handshake, sent once mounted and listening. */
export interface PluginReadyMessage {
  type: 'plugin-ready';
  pluginType?: string;
}

/** plugin → main, inserts a plain string at the active textarea's cursor. */
export interface InsertMessage {
  type: 'insert';
  content: string;
}

/** plugin → main, adds a file the plugin made to the book's manifest. */
export interface AddMediaMessage {
  type: 'add-media';
  requestId: string;
  filename: string;
  mediaType: string;
  bytes: ArrayBuffer;
}

/** main → plugin, the answer to `add-media`. */
export type MediaAddedMessage =
  | { type: 'media-added'; requestId: string; href: string }
  | { type: 'media-added'; requestId: string; error: string };

export type PluginToMain = PluginReadyMessage | InsertMessage | AddMediaMessage;

/** One audio entry from the project's OPF manifest. */
export interface AudioManifestItem {
  /** Manifest item id. */
  id: string;
  /** OPF-relative href, as written into clip directives (matches the core editor). */
  href: string;
  /** Workspace-relative path (e.g. `OEBPS/Audio/track.mp3`), for reading bytes. */
  storagePath: string;
  mediaType: string;
}
