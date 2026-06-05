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
