// Message types for main app <-> plugin communication

export type InitMessage = {
  type: 'init';
  projectId: string;
  opfsDirHandle: FileSystemDirectoryHandle;
};

// main → plugin: ambient host environment the plugin inherits and applies to its
// own document root (theme, locale, direction). Sent on handshake and re-sent on
// any change. Mirrors src/lib/plugins/contract.ts (the plugin builds separately).
export type ContextMessage = {
  type: 'context';
  theme: 'light' | 'dark';
  locale: string;
  dir: 'ltr' | 'rtl';
  // The active locale's dictionary (English source → localized). Optional for
  // back-compat; the plugin falls back to the English source string when absent.
  messages?: Record<string, string>;
  // The open project's dc:identifier (urn:uuid); used to outline the matching
  // published rows. Absent → no row highlighted.
  activeIdentifier?: string;
};

// plugin → main: ask the host to open the editor resource at `path` (e.g. a
// content document flagged by epubcheck). The host resolves and navigates.
export type NavigateMessage = {
  type: 'navigate';
  path: string;
};

export type MainToPlugin = InitMessage | ContextMessage;
export type PluginToMain = NavigateMessage;

// Remote Configuration and Objects

export interface S3RemoteConfig {
  id: string;
  name: string;
  type: 's3-compatible';
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  publicUrlBase?: string;
  /** OPDS catalog filename (defaults to catalog.xml when unset). */
  catalogFilename?: string;
}

export interface GoogleDriveRemoteConfig {
  id: string;
  name: string;
  type: 'google-drive';
  clientId: string;
  apiKey: string;
  folderId: string;
  folderName: string;
  accessToken?: string;
}

export interface DropboxRemoteConfig {
  id: string;
  name: string;
  type: 'dropbox';
  appKey: string;
  /** OAuth redirect URI registered in the user's Dropbox app. Falls back to
   * `window.location.origin` when unset. */
  redirectUri?: string;
  folderId: string;
  folderPath: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}

export interface WebDAVRemoteConfig {
  id: string;
  name: string;
  type: 'webdav';
  /** Full WebDAV folder URL (the authenticated endpoint), e.g.
   * https://host/remote.php/dav/files/user/books */
  url: string;
  username: string;
  password: string;
  /** Optional unauthenticated read URL base for public links (mirrors S3's
   * publicUrlBase). Falls back to `url` when unset. */
  publicUrlBase?: string;
  /** OPDS catalog filename (defaults to catalog.xml when unset). */
  catalogFilename?: string;
  /**
   * Route requests through the app's same-origin `/dav` proxy (for WebDAV
   * servers that don't send CORS headers). Defaults to on when the app is
   * served over http(s) and a proxy is present; set false to talk to the
   * server directly (keeps credentials off the app host, needs server CORS).
   */
  routeViaProxy?: boolean;
}

export type RemoteConfig =
  | S3RemoteConfig
  | GoogleDriveRemoteConfig
  | DropboxRemoteConfig
  | WebDAVRemoteConfig;

export interface RemotesStore {
  remotes: RemoteConfig[];
  activeRemoteId: string | null;
}

export interface S3Credentials {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
  publicUrlBase?: string;
}

export interface S3Object {
  key: string;
  size: number;
  lastModified: string;
  fileId?: string;
}

// Rich metadata for an OPDS entry, read from the per-EPUB `<base>.json` sidecar
// written by the host at packaging time. Mirrors the host's PublishSidecar
// (the plugin builds separately, so the type is redeclared here), plus the
// thumbnail resolved to an inline data: URI.
export interface CatalogEntryMeta {
  title?: string;
  authors?: string[];
  description?: string;
  language?: string;
  publisher?: string;
  issued?: string;
  identifier?: string;
  subjects?: string[];
  /** Raw bytes of the sibling `<base>.thumb.png`, uploaded to the remote so the
   *  feed can reference a resolvable URL (most OPDS clients ignore data: URIs). */
  thumbnailBytes?: ArrayBuffer;
  /** Resolvable URL of the hosted thumbnail, set once uploaded. */
  thumbnailUrl?: string;
}
