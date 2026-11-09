// Message types for main app <-> plugin communication.
// Mirrors src/lib/plugins/contract.ts (the plugin builds separately).

/** main → plugin: hands over the project workspace root. */
export interface InitMessage {
  type: 'init';
  projectId: string;
  /** Absent where handles can't be cloned into iframes (WebKit/iPadOS). */
  opfsDirHandle?: FileSystemDirectoryHandle;
  /** OPFS path segments to the same directory, walked when the handle is absent. */
  opfsDirPath?: string[];
}

/** main → plugin: ambient host environment (theme, locale, direction, chapter). */
export interface ContextMessage {
  type: 'context';
  theme: 'light' | 'dark';
  locale: string;
  dir: 'ltr' | 'rtl';
  messages?: Record<string, string>;
  activeChapterId?: string;
}

/** main → plugin: the answer to `add-media`. */
export type MediaAddedMessage =
  | { type: 'media-added'; requestId: string; href: string }
  | { type: 'media-added'; requestId: string; error: string };

export type MainToPlugin = InitMessage | ContextMessage | MediaAddedMessage;
