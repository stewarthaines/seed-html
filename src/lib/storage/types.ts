/**
 * File Storage API Types
 *
 * TypeScript interfaces and types for the EPUB editor's file storage system
 * supporting OPFS with IndexedDB fallback for cross-browser compatibility.
 */

export type BackendType = 'opfs-async' | 'opfs-sync' | 'indexeddb';

export interface StorageQuota {
  used: number;
  available: number;
}

/**
 * Unified storage backend interface that abstracts away the specific
 * implementation details of OPFS vs IndexedDB storage.
 */
export interface StorageBackend {
  // Initialization
  init?(): Promise<void>;

  // Workspace management
  createWorkspace(id: string): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;
  listWorkspaces(): Promise<string[]>;

  // File operations
  writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void>;
  readFile(workspaceId: string, path: string): Promise<ArrayBuffer>;
  deleteFile(workspaceId: string, path: string): Promise<void>;
  listFiles(workspaceId: string, path?: string): Promise<string[]>;
  getFileInfo(workspaceId: string, path: string): Promise<{ size: number; lastModified: Date }>;

  // Storage info
  getQuota(): Promise<StorageQuota>;
  getBackendType(): BackendType;
}

/**
 * Result of a worker operation. `error` is a plain message string — that is
 * what opfs-worker.js actually sends (`error.message`), pinned by
 * opfs-worker.protocol.test.ts.
 */
export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Message types for worker communication in OPFS sync backend
 */
export interface WorkerMessage {
  type: WorkerMessageType;
  id: number;
  data?: unknown;
}

export interface WorkerResponse {
  type: WorkerMessageType;
  id: number;
  result: OperationResult<unknown>;
}

export enum WorkerMessageType {
  CREATE_WORKSPACE = 'createWorkspace',
  DELETE_WORKSPACE = 'deleteWorkspace',
  LIST_WORKSPACES = 'listWorkspaces',
  WRITE_FILE = 'writeFile',
  READ_FILE = 'readFile',
  DELETE_FILE = 'deleteFile',
  LIST_FILES = 'listFiles',
  GET_FILE_INFO = 'getFileInfo',
  GET_QUOTA = 'getQuota',
}

/**
 * Storage capability detection results
 */
export interface StorageCapabilities {
  opfs: boolean;
  opfsAsync: boolean;
  opfsSync: boolean;
  opfsSyncWorker: boolean;
  indexedDB: boolean;
  storageEstimate: boolean;
}
