/**
 * File Storage API Types
 * 
 * TypeScript interfaces and types for the EPUB editor's file storage system
 * supporting OPFS with IndexedDB fallback for cross-browser compatibility.
 */

export type BackendType = 'opfs-async' | 'opfs-sync' | 'indexeddb';

export interface FileMetadata {
	name: string;
	size: number;
	lastModified: number;
	type: string;
}

export interface StorageQuota {
	used: number;
	available: number;
}

export interface WorkspaceMetadata {
	id: string;
	created: number;
	title?: string;
	author?: string;
}

/**
 * Unified storage backend interface that abstracts away the specific
 * implementation details of OPFS vs IndexedDB storage.
 */
export interface StorageBackend {
	// Workspace management
	createWorkspace(id: string): Promise<void>;
	deleteWorkspace(id: string): Promise<void>;
	listWorkspaces(): Promise<string[]>;
	
	// File operations
	writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void>;
	readFile(workspaceId: string, path: string): Promise<ArrayBuffer>;
	deleteFile(workspaceId: string, path: string): Promise<void>;
	listFiles(workspaceId: string, path?: string): Promise<string[]>;
	
	// Storage info
	getQuota(): Promise<StorageQuota>;
	getBackendType(): BackendType;
}

/**
 * Configuration options for storage backend initialization
 */
export interface StorageConfig {
	/** Database name for IndexedDB backend */
	dbName?: string;
	/** Database version for IndexedDB backend */
	dbVersion?: number;
	/** Worker timeout in milliseconds for OPFS sync backend */
	workerTimeout?: number;
	/** Enable debug logging */
	debug?: boolean;
}

/**
 * Error types that can be thrown by storage operations
 */
export class StorageError extends Error {
	constructor(
		message: string,
		public code: StorageErrorCode,
		public cause?: Error
	) {
		super(message);
		this.name = 'StorageError';
	}
}

export enum StorageErrorCode {
	NOT_INITIALIZED = 'NOT_INITIALIZED',
	BACKEND_UNAVAILABLE = 'BACKEND_UNAVAILABLE',
	QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
	PERMISSION_DENIED = 'PERMISSION_DENIED',
	FILE_NOT_FOUND = 'FILE_NOT_FOUND',
	WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
	INVALID_PATH = 'INVALID_PATH',
	OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
	NETWORK_ERROR = 'NETWORK_ERROR',
	UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Result type for operations that may fail
 */
export interface OperationResult<T = void> {
	success: boolean;
	data?: T;
	error?: StorageError;
}

/**
 * Events emitted by the storage system
 */
export interface StorageEvents {
	'quota-warning': { used: number; available: number; threshold: number };
	'quota-exceeded': { used: number; available: number };
	'backend-changed': { from: BackendType; to: BackendType };
	'workspace-created': { workspaceId: string };
	'workspace-deleted': { workspaceId: string };
	'file-written': { workspaceId: string; path: string; size: number };
	'file-deleted': { workspaceId: string; path: string };
}

/**
 * Message types for worker communication in OPFS sync backend
 */
export interface WorkerMessage {
	type: WorkerMessageType;
	id: number;
	data?: any;
}

export interface WorkerResponse {
	type: WorkerMessageType;
	id: number;
	result: OperationResult<any>;
}

export enum WorkerMessageType {
	CREATE_WORKSPACE = 'createWorkspace',
	DELETE_WORKSPACE = 'deleteWorkspace',
	LIST_WORKSPACES = 'listWorkspaces',
	WRITE_FILE = 'writeFile',
	READ_FILE = 'readFile',
	DELETE_FILE = 'deleteFile',
	LIST_FILES = 'listFiles',
	GET_QUOTA = 'getQuota'
}

/**
 * IndexedDB database schema
 */
export interface WorkspaceRecord {
	id: string;
	created: number;
	title?: string;
	author?: string;
}

export interface FileRecord {
	workspaceId: string;
	path: string;
	content: ArrayBuffer;
	modified: number;
	size: number;
	type?: string;
}

/**
 * OPFS file handle types (for browser compatibility)
 */
export interface OPFSFileHandle {
	kind: 'file';
	name: string;
	createWritable(): Promise<FileSystemWritableFileStream>;
	createSyncAccessHandle?(): Promise<FileSystemSyncAccessHandle>;
	getFile(): Promise<File>;
}

export interface OPFSDirectoryHandle {
	kind: 'directory';
	name: string;
	getFileHandle(name: string, options?: { create?: boolean }): Promise<OPFSFileHandle>;
	getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<OPFSDirectoryHandle>;
	removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
	entries(): AsyncIterableIterator<[string, OPFSFileHandle | OPFSDirectoryHandle]>;
}

export interface FileSystemWritableFileStream extends WritableStream {
	write(data: ArrayBuffer | string): Promise<void>;
	close(): Promise<void>;
}

export interface FileSystemSyncAccessHandle {
	read(buffer: ArrayBuffer, options?: { at?: number }): number;
	write(data: ArrayBuffer, options?: { at?: number }): number;
	flush(): void;
	close(): void;
	getSize(): number;
	truncate(size: number): void;
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

/**
 * Browser feature detection utilities
 */
export interface FeatureDetector {
	detectCapabilities(): Promise<StorageCapabilities>;
	detectOptimalBackend(): Promise<BackendType>;
	testOPFSAsync(): Promise<boolean>;
	testOPFSSync(): Promise<boolean>;
	testOPFSSyncWorker(): Promise<boolean>;
	testIndexedDB(): Promise<boolean>;
}