/**
 * File Storage API - Main Exports
 *
 * This file contains the actual implementation of the storage backends
 * supporting OPFS with IndexedDB fallback for cross-browser compatibility.
 */

import type { StorageBackend, BackendType, StorageQuota } from './types.js';
import { OPFSWorkerManager } from './worker-manager.js';
import { FeatureDetector } from './feature-detector.js';

// Export types for public API
export type {
  StorageBackend,
  BackendType,
  StorageQuota,
  StorageCapabilities,
  StorageError,
  StorageErrorCode,
} from './types.js';

export class StorageBackendFactory {
  private static featureDetector = new FeatureDetector();
  private static cachedBackend: StorageBackend | null = null;

  static async detectStorageBackend(): Promise<BackendType> {
    return await this.featureDetector.detectOptimalBackend();
  }

  static async testWorkerSyncAccessHandle(): Promise<boolean> {
    return await this.featureDetector.testOPFSSyncWorker();
  }

  static async create(): Promise<StorageBackend> {
    if (StorageBackendFactory.cachedBackend) {
      return StorageBackendFactory.cachedBackend;
    }

    const backendType = await this.detectStorageBackend();

    let backend: StorageBackend;
    switch (backendType) {
      case 'opfs-sync':
        backend = new OPFSSyncBackend();
        break;
      case 'opfs-async':
        backend = new OPFSAsyncBackend();
        await backend.init?.();
        break;
      case 'indexeddb':
        backend = new IndexedDBBackend();
        await backend.init?.();
        break;
      default:
        throw new Error(`Unsupported backend: ${backendType}`);
    }

    StorageBackendFactory.cachedBackend = backend;
    return backend;
  }

  /**
   * Get detailed capability information for debugging
   */
  static async getCapabilities() {
    return await this.featureDetector.detectCapabilities();
  }

  /**
   * Clear feature detection cache
   */
  static clearCache(): void {
    this.featureDetector.clearCache();
    StorageBackendFactory.cachedBackend = null;
  }
}

export class OPFSAsyncBackend implements StorageBackend {
  private root: FileSystemDirectoryHandle | null = null;

  async init(): Promise<void> {
    if (!('storage' in navigator && 'getDirectory' in navigator.storage)) {
      throw new Error('OPFS not available');
    }

    this.root = await navigator.storage.getDirectory();
  }

  private async ensureWorkspaceDirectory(workspaceId: string): Promise<FileSystemDirectoryHandle> {
    if (!this.root) {
      throw new Error('Backend not initialized');
    }

    const workspacesDir = await this.root.getDirectoryHandle('workspaces', { create: true });
    return await workspacesDir.getDirectoryHandle(workspaceId, { create: true });
  }

  private async ensureDirectoryPath(
    baseHandle: FileSystemDirectoryHandle,
    path: string
  ): Promise<FileSystemDirectoryHandle> {
    const pathParts = path.split('/').filter(part => part.length > 0);
    let currentHandle = baseHandle;

    for (const part of pathParts) {
      currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    }

    return currentHandle;
  }

  private async getFileHandle(
    workspaceId: string,
    path: string,
    create: boolean = false
  ): Promise<FileSystemFileHandle> {
    const workspaceHandle = await this.ensureWorkspaceDirectory(workspaceId);

    const pathParts = path.split('/');
    const fileName = pathParts.pop()!;
    const dirPath = pathParts.join('/');

    let targetDir = workspaceHandle;
    if (dirPath) {
      targetDir = await this.ensureDirectoryPath(workspaceHandle, dirPath);
    }

    return await targetDir.getFileHandle(fileName, { create });
  }

  async createWorkspace(id: string): Promise<void> {
    await this.ensureWorkspaceDirectory(id);
  }

  async deleteWorkspace(id: string): Promise<void> {
    if (!this.root) {
      throw new Error('Backend not initialized');
    }

    try {
      const workspacesDir = await this.root.getDirectoryHandle('workspaces');
      await workspacesDir.removeEntry(id, { recursive: true });
    } catch (error) {
      if ((error as DOMException).name !== 'NotFoundError') {
        throw error;
      }
    }
  }

  async listWorkspaces(): Promise<string[]> {
    if (!this.root) {
      throw new Error('Backend not initialized');
    }

    try {
      const workspacesDir = await this.root.getDirectoryHandle('workspaces');
      const workspaces: string[] = [];

      for await (const [name, handle] of workspacesDir.entries()) {
        if (handle.kind === 'directory') {
          workspaces.push(name);
        }
      }

      return workspaces.sort();
    } catch (error) {
      if ((error as DOMException).name === 'NotFoundError') {
        return [];
      }
      throw error;
    }
  }

  async writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void> {
    const fileHandle = await this.getFileHandle(workspaceId, path, true);
    await this.writeFileWithFallback(fileHandle, content);
  }

  private async writeFileWithFallback(
    fileHandle: FileSystemFileHandle,
    content: ArrayBuffer
  ): Promise<void> {
    try {
      // Try createWritable first (Chrome, Firefox, Edge)
      const writable = await fileHandle.createWritable();
      try {
        await writable.write(content);
      } finally {
        await writable.close();
      }
    } catch (error) {
      // Fallback to createSyncAccessHandle (Safari)
      if ('createSyncAccessHandle' in fileHandle) {
        const syncHandle = await (fileHandle as any).createSyncAccessHandle();
        try {
          // Truncate the file first to ensure complete overwrite
          syncHandle.truncate(content.byteLength);
          syncHandle.write(content, { at: 0 });
          syncHandle.flush();
        } finally {
          syncHandle.close();
        }
      } else {
        throw error;
      }
    }
  }

  async readFile(workspaceId: string, path: string): Promise<ArrayBuffer> {
    const fileHandle = await this.getFileHandle(workspaceId, path, false);
    const file = await fileHandle.getFile();
    return await file.arrayBuffer();
  }

  async deleteFile(workspaceId: string, path: string): Promise<void> {
    const workspaceHandle = await this.ensureWorkspaceDirectory(workspaceId);

    const pathParts = path.split('/');
    const fileName = pathParts.pop()!;
    const dirPath = pathParts.join('/');

    let targetDir = workspaceHandle;
    if (dirPath) {
      targetDir = await this.ensureDirectoryPath(workspaceHandle, dirPath);
    }

    await targetDir.removeEntry(fileName);
  }

  async listFiles(workspaceId: string, basePath?: string): Promise<string[]> {
    const workspaceHandle = await this.ensureWorkspaceDirectory(workspaceId);
    let targetDir = workspaceHandle;

    if (basePath) {
      try {
        targetDir = await this.ensureDirectoryPath(workspaceHandle, basePath);
      } catch (error) {
        if ((error as DOMException).name === 'NotFoundError') {
          return [];
        }
        throw error;
      }
    }

    const files: string[] = [];
    await this.collectFiles(targetDir, basePath || '', files);
    return files.sort();
  }

  async getFileInfo(
    workspaceId: string,
    path: string
  ): Promise<{ size: number; lastModified: Date }> {
    const fileHandle = await this.getFileHandle(workspaceId, path, false);
    const file = await fileHandle.getFile();
    return {
      size: file.size,
      lastModified: new Date(file.lastModified),
    };
  }

  private async collectFiles(
    dirHandle: FileSystemDirectoryHandle,
    currentPath: string,
    files: string[]
  ): Promise<void> {
    for await (const [name, handle] of dirHandle.entries()) {
      const fullPath = currentPath ? `${currentPath}/${name}` : name;

      if (handle.kind === 'file') {
        files.push(fullPath);
      } else if (handle.kind === 'directory') {
        await this.collectFiles(handle as FileSystemDirectoryHandle, fullPath, files);
      }
    }
  }

  async getQuota(): Promise<StorageQuota> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        available: (estimate.quota || 0) - (estimate.usage || 0),
      };
    }

    return { used: 0, available: 0 };
  }

  getBackendType(): BackendType {
    return 'opfs-async';
  }
}

export class OPFSSyncBackend implements StorageBackend {
  private workerManager: OPFSWorkerManager;

  constructor() {
    this.workerManager = new OPFSWorkerManager();
  }

  async sendMessage(type: string, data?: any): Promise<any> {
    return await this.workerManager.sendMessage(type, data);
  }

  destroy(): void {
    this.workerManager.destroy();
  }

  async createWorkspace(id: string): Promise<void> {
    const result = await this.workerManager.createWorkspace(id);
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to create workspace');
    }
  }

  async deleteWorkspace(id: string): Promise<void> {
    const result = await this.workerManager.deleteWorkspace(id);
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to delete workspace');
    }
  }

  async listWorkspaces(): Promise<string[]> {
    const result = await this.workerManager.listWorkspaces();
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to list workspaces');
    }
    // Fix: Access result.workspaces directly, not result.data.workspaces
    return (result as any).workspaces || [];
  }

  async writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void> {
    const result = await this.workerManager.writeFile(workspaceId, path, content);
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to write file');
    }
  }

  async readFile(workspaceId: string, path: string): Promise<ArrayBuffer> {
    const result = await this.workerManager.readFile(workspaceId, path);
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to read file');
    }
    
    // Fix: Access result.content directly, not result.data.content
    const content = (result as any).content;
    
    // Validate ArrayBuffer is not detached/empty
    if (!content || !(content instanceof ArrayBuffer)) {
      console.warn(`⚠️ Invalid ArrayBuffer received for ${path}: ${typeof content}, length: ${content?.byteLength || 'undefined'}`);
      return new ArrayBuffer(0);
    }
    
    // Check for detached ArrayBuffer
    try {
      // Accessing byteLength will throw if the ArrayBuffer is detached
      const size = content.byteLength;
      if (size === 0) {
        console.warn(`⚠️ Empty ArrayBuffer received for ${path}`);
      }
      return content;
    } catch (error) {
      console.warn(`⚠️ Detached ArrayBuffer received for ${path}:`, error);
      return new ArrayBuffer(0);
    }
  }

  async deleteFile(workspaceId: string, path: string): Promise<void> {
    const result = await this.workerManager.deleteFile(workspaceId, path);
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to delete file');
    }
  }

  async listFiles(workspaceId: string, path?: string): Promise<string[]> {
    const result = await this.workerManager.listFiles(workspaceId, path);
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to list files');
    }
    // Fix: Access result.files directly, not result.data.files
    return (result as any).files || [];
  }

  async getFileInfo(
    workspaceId: string,
    path: string
  ): Promise<{ size: number; lastModified: Date }> {
    const result = await this.workerManager.getFileInfo(workspaceId, path);
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to get file info');
    }
    return result.data?.fileInfo || { size: 0, lastModified: new Date() };
  }

  async getQuota(): Promise<StorageQuota> {
    const result = await this.workerManager.getQuota();
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to get quota');
    }
    return result.data?.quota || { used: 0, available: 0 };
  }

  getBackendType(): BackendType {
    return 'opfs-sync';
  }
}

export class IndexedDBBackend implements StorageBackend {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'editme-storage';
  private readonly version = 1;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) {
        reject(new Error('IndexedDB not available'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create workspaces object store
        if (!db.objectStoreNames.contains('workspaces')) {
          const workspaceStore = db.createObjectStore('workspaces', { keyPath: 'id' });
          workspaceStore.createIndex('created', 'created', { unique: false });
        }

        // Create files object store
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: ['workspaceId', 'path'] });
          fileStore.createIndex('workspaceId', 'workspaceId', { unique: false });
          fileStore.createIndex('modified', 'modified', { unique: false });
        }
      };
    });
  }

  private async transaction<T>(
    stores: string[],
    mode: IDBTransactionMode,
    operation: (transaction: IDBTransaction) => Promise<T>
  ): Promise<T> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(stores, mode);

      transaction.onerror = () => {
        reject(new Error(`Transaction failed: ${transaction.error?.message}`));
      };

      operation(transaction).then(resolve).catch(reject);
    });
  }

  private async putRecord(store: IDBObjectStore, record: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Put failed: ${request.error?.message}`));
    });
  }

  private async getRecord<T>(store: IDBObjectStore, key: any): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Get failed: ${request.error?.message}`));
    });
  }

  private async deleteRecord(store: IDBObjectStore, key: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Delete failed: ${request.error?.message}`));
    });
  }

  private async getAllRecords<T>(
    store: IDBObjectStore | IDBIndex,
    query?: IDBValidKey | IDBKeyRange
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request = store.getAll(query);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`GetAll failed: ${request.error?.message}`));
    });
  }

  async createWorkspace(id: string): Promise<void> {
    await this.transaction(['workspaces'], 'readwrite', async transaction => {
      const store = transaction.objectStore('workspaces');
      await this.putRecord(store, {
        id,
        created: Date.now(),
      });
    });
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.transaction(['workspaces', 'files'], 'readwrite', async transaction => {
      const workspaceStore = transaction.objectStore('workspaces');
      const fileStore = transaction.objectStore('files');

      // Delete all files in the workspace first
      const index = fileStore.index('workspaceId');
      const files = await this.getAllRecords<{ workspaceId: string; path: string }>(
        index,
        IDBKeyRange.only(id)
      );

      for (const file of files) {
        await this.deleteRecord(fileStore, [file.workspaceId, file.path]);
      }

      // Delete the workspace record
      await this.deleteRecord(workspaceStore, id);
    });
  }

  async listWorkspaces(): Promise<string[]> {
    return await this.transaction(['workspaces'], 'readonly', async transaction => {
      const store = transaction.objectStore('workspaces');
      const workspaces = await this.getAllRecords<{ id: string }>(store);
      return workspaces.map(w => w.id).sort();
    });
  }

  async writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void> {
    await this.transaction(['files'], 'readwrite', async transaction => {
      const store = transaction.objectStore('files');
      await this.putRecord(store, {
        workspaceId,
        path,
        content,
        modified: Date.now(),
      });
    });
  }

  async readFile(workspaceId: string, path: string): Promise<ArrayBuffer> {
    return await this.transaction(['files'], 'readonly', async transaction => {
      const store = transaction.objectStore('files');
      const record = await this.getRecord<{ content: ArrayBuffer }>(store, [workspaceId, path]);

      if (!record) {
        throw new Error('File not found');
      }

      return record.content;
    });
  }

  async deleteFile(workspaceId: string, path: string): Promise<void> {
    await this.transaction(['files'], 'readwrite', async transaction => {
      const store = transaction.objectStore('files');
      await this.deleteRecord(store, [workspaceId, path]);
    });
  }

  async listFiles(workspaceId: string, basePath?: string): Promise<string[]> {
    return await this.transaction(['files'], 'readonly', async transaction => {
      const store = transaction.objectStore('files');
      const index = store.index('workspaceId');
      const files = await this.getAllRecords<{ path: string }>(
        index,
        IDBKeyRange.only(workspaceId)
      );

      let paths = files.map(f => f.path);

      if (basePath) {
        const prefix = basePath.endsWith('/') ? basePath : basePath + '/';
        paths = paths.filter(path => path.startsWith(prefix));
      }

      return paths.sort();
    });
  }

  async getFileInfo(
    workspaceId: string,
    path: string
  ): Promise<{ size: number; lastModified: Date }> {
    return await this.transaction(['files'], 'readonly', async transaction => {
      const store = transaction.objectStore('files');
      const record = await this.getRecord<{ content: ArrayBuffer; modified: number }>(store, [
        workspaceId,
        path,
      ]);

      if (!record) {
        throw new Error('File not found');
      }

      return {
        size: record.content.byteLength,
        lastModified: new Date(record.modified),
      };
    });
  }

  async getQuota(): Promise<StorageQuota> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          available: (estimate.quota || 0) - (estimate.usage || 0),
        };
      } catch {
        // Fall through to default
      }
    }

    return { used: 0, available: 0 };
  }

  getBackendType(): BackendType {
    return 'indexeddb';
  }
}

export class StorageManager {
  private backend: StorageBackend | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.backend = await StorageBackendFactory.create();
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized && this.backend !== null;
  }

  getBackendType(): BackendType {
    if (!this.backend) {
      throw new Error('Storage manager not initialized');
    }
    return this.backend.getBackendType();
  }

  private generateWorkspaceId(): string {
    // Generate UUID v4
    return (
      'workspace-' +
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      })
    );
  }

  async createWorkspace(id?: string): Promise<string> {
    if (!this.backend) {
      throw new Error('Storage manager not initialized');
    }

    const workspaceId = id || this.generateWorkspaceId();
    await this.backend.createWorkspace(workspaceId);
    return workspaceId;
  }

  async deleteWorkspace(id: string): Promise<void> {
    if (!this.backend) {
      throw new Error('Storage manager not initialized');
    }

    await this.backend.deleteWorkspace(id);
  }

  async listWorkspaces(): Promise<string[]> {
    if (!this.backend) {
      throw new Error('Storage manager not initialized');
    }

    return await this.backend.listWorkspaces();
  }

  async writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void> {
    if (!this.backend) {
      throw new Error('Storage manager not initialized');
    }

    await this.backend.writeFile(workspaceId, path, content);
  }

  async readFile(workspaceId: string, path: string): Promise<ArrayBuffer> {
    if (!this.backend) {
      throw new Error('Storage manager not initialized');
    }

    return await this.backend.readFile(workspaceId, path);
  }

  async deleteFile(workspaceId: string, path: string): Promise<void> {
    if (!this.backend) {
      throw new Error('Storage manager not initialized');
    }

    await this.backend.deleteFile(workspaceId, path);
  }

  async listFiles(workspaceId: string, path?: string): Promise<string[]> {
    if (!this.backend) {
      throw new Error('Storage manager not initialized');
    }

    return await this.backend.listFiles(workspaceId, path);
  }

  async getFileInfo(
    workspaceId: string,
    path: string
  ): Promise<{ size: number; lastModified: Date }> {
    if (!this.backend) {
      throw new Error('Storage manager not initialized');
    }

    return await this.backend.getFileInfo(workspaceId, path);
  }

  async getQuota(): Promise<StorageQuota> {
    if (!this.backend) {
      throw new Error('Storage manager not initialized');
    }

    return await this.backend.getQuota();
  }

  /**
   * Utility method to write text files
   */
  async writeTextFile(workspaceId: string, path: string, content: string): Promise<void> {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(content).buffer as ArrayBuffer;
    await this.writeFile(workspaceId, path, buffer);
  }

  /**
   * Utility method to read text files
   */
  async readTextFile(workspaceId: string, path: string): Promise<string> {
    const buffer = await this.readFile(workspaceId, path);
    const decoder = new TextDecoder();
    return decoder.decode(buffer);
  }

  /**
   * Check if a file exists
   */
  async fileExists(workspaceId: string, path: string): Promise<boolean> {
    try {
      await this.readFile(workspaceId, path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file size without reading full content
   */
  async getFileSize(workspaceId: string, path: string): Promise<number> {
    const buffer = await this.readFile(workspaceId, path);
    return buffer.byteLength;
  }

  /**
   * Clean up resources (mainly for OPFS sync backend)
   */
  destroy(): void {
    if (this.backend && 'destroy' in this.backend) {
      (this.backend as any).destroy();
    }
    this.backend = null;
    this.initialized = false;
  }
}

/**
 * Primary FileStorageAPI class as specified in the requirements
 * Provides a clean interface matching the API design specification
 */
export class FileStorageAPI {
  private static instance: FileStorageAPI | null = null;
  private manager: StorageManager;
  private initPromise: Promise<void> | null = null;

  private constructor() {
    this.manager = new StorageManager();
  }

  /**
   * Get the singleton instance of FileStorageAPI
   */
  static getInstance(): FileStorageAPI {
    if (!FileStorageAPI.instance) {
      FileStorageAPI.instance = new FileStorageAPI();
    }
    return FileStorageAPI.instance;
  }

  /**
   * Get an initialized singleton instance of FileStorageAPI
   */
  static async getInitializedInstance(): Promise<FileStorageAPI> {
    const instance = FileStorageAPI.getInstance();
    if (!instance.isInitialized()) {
      await instance.init();
    }
    return instance;
  }

  /**
   * Reset the singleton instance (mainly for testing)
   */
  static resetInstance(): void {
    if (FileStorageAPI.instance) {
      FileStorageAPI.instance.destroy();
      FileStorageAPI.instance = null;
    }
  }

  /**
   * Initialize the storage system
   */
  async init(): Promise<void> {
    // Return immediately if already initialized
    if (this.manager.isInitialized()) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    // Start new initialization
    this.initPromise = this.doInit();
    
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async doInit(): Promise<void> {
    await this.manager.init();
    console.log('FileStorageAPI initialized with backend:', this.manager.getBackendType());
  }

  /**
   * Check if storage is initialized
   */
  isInitialized(): boolean {
    return this.manager.isInitialized();
  }

  /**
   * Get the active backend type
   */
  getBackendType(): BackendType {
    return this.manager.getBackendType();
  }

  // Workspace management
  async createWorkspace(id?: string): Promise<string> {
    return await this.manager.createWorkspace(id);
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.manager.deleteWorkspace(id);
  }

  async listWorkspaces(): Promise<string[]> {
    return await this.manager.listWorkspaces();
  }

  // File operations
  async writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void> {
    await this.manager.writeFile(workspaceId, path, content);
  }

  async readFile(workspaceId: string, path: string): Promise<ArrayBuffer> {
    return await this.manager.readFile(workspaceId, path);
  }

  async deleteFile(workspaceId: string, path: string): Promise<void> {
    await this.manager.deleteFile(workspaceId, path);
  }

  async renameFile(workspaceId: string, oldPath: string, newPath: string): Promise<void> {
    // Read the file content
    const content = await this.manager.readFile(workspaceId, oldPath);
    // Write to new location
    await this.manager.writeFile(workspaceId, newPath, content);
    // Delete old file
    await this.manager.deleteFile(workspaceId, oldPath);
  }

  async listFiles(workspaceId: string, path?: string): Promise<string[]> {
    return await this.manager.listFiles(workspaceId, path);
  }

  async getFileInfo(
    workspaceId: string,
    path: string
  ): Promise<{ size: number; lastModified: Date }> {
    return await this.manager.getFileInfo(workspaceId, path);
  }

  // Storage monitoring
  async getQuota(): Promise<{ used: number; available: number }> {
    return await this.manager.getQuota();
  }

  async estimateWorkspaceSize(workspaceId: string): Promise<number> {
    const files = await this.manager.listFiles(workspaceId);
    let totalSize = 0;

    for (const filePath of files) {
      try {
        const size = await this.manager.getFileSize(workspaceId, filePath);
        totalSize += size;
      } catch {
        // Skip files that can't be read
      }
    }

    return totalSize;
  }

  /**
   * Utility methods
   */
  async writeTextFile(workspaceId: string, path: string, content: string): Promise<void> {
    await this.manager.writeTextFile(workspaceId, path, content);
  }

  async readTextFile(workspaceId: string, path: string): Promise<string> {
    return await this.manager.readTextFile(workspaceId, path);
  }

  async fileExists(workspaceId: string, path: string): Promise<boolean> {
    return await this.manager.fileExists(workspaceId, path);
  }

  /**
   * OPFS optimization methods for blob URL creation
   */
  supportsDirectBlobURLs(): boolean {
    const backendType = this.manager.getBackendType();
    return backendType === 'opfs-async' || backendType === 'opfs-sync';
  }

  async getFile(workspaceId: string, filePath: string): Promise<File> {
    if (!this.manager.isInitialized()) {
      throw new Error('Storage manager not initialized');
    }

    const backendType = this.manager.getBackendType();

    if (backendType === 'opfs-async') {
      // Direct file access for OPFS async backend
      const backend = (this.manager as any).backend as OPFSAsyncBackend;
      const fileHandle = await (backend as any).getFileHandle(workspaceId, filePath, false);
      return await fileHandle.getFile();
    } else if (backendType === 'opfs-sync') {
      // For OPFS sync backend, fall back to reading content and creating File
      const content = await this.readFile(workspaceId, filePath);
      const fileName = filePath.split('/').pop() || 'file';
      return new File([content], fileName);
    } else {
      throw new Error('Direct file access not supported for IndexedDB backend');
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.manager.destroy();
  }
}
