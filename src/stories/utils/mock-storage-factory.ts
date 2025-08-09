/**
 * Mock Storage Factory for Isolated Storybook Stories
 * 
 * Provides isolated, non-persistent storage mocks that prevent demo data
 * pollution between story runs. Follows modern Storybook 2024-2025 best practices.
 */

import type { FileStorageAPI } from '../../lib/storage';

/**
 * Creates an isolated mock storage instance for a single story
 * Data is kept in memory only and doesn't persist between story runs
 */
export function createIsolatedMockStorage(): FileStorageAPI {
  // In-memory storage for this story instance
  const files = new Map<string, Map<string, ArrayBuffer>>();
  const workspaces = new Set<string>();

  const mockStorage: FileStorageAPI = {
    // Initialization
    async init() {
      // No-op for mock storage
    },

    // Workspace management
    async createWorkspace(title: string, language?: string) {
      const workspaceId = `story-workspace-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      workspaces.add(workspaceId);
      files.set(workspaceId, new Map());
      return { id: workspaceId, title, language: language || 'en' };
    },

    async deleteWorkspace(workspaceId: string) {
      workspaces.delete(workspaceId);
      files.delete(workspaceId);
    },

    async listWorkspaces() {
      return Array.from(workspaces).map(id => ({
        id,
        title: `Mock Workspace ${id.split('-').pop()}`,
        language: 'en',
        createdDate: generateEPUBTimestamp(),
        modifiedDate: generateEPUBTimestamp()
      }));
    },

    async workspaceExists(workspaceId: string) {
      return workspaces.has(workspaceId);
    },

    // File operations
    async writeFile(workspaceId: string, path: string, content: ArrayBuffer | string) {
      const workspaceFiles = files.get(workspaceId) || new Map();
      const buffer = typeof content === 'string' 
        ? new TextEncoder().encode(content)
        : content;
      workspaceFiles.set(path, buffer);
      files.set(workspaceId, workspaceFiles);
    },

    async writeTextFile(workspaceId: string, path: string, content: string) {
      await this.writeFile(workspaceId, path, content);
    },

    async readFile(workspaceId: string, path: string) {
      const workspaceFiles = files.get(workspaceId);
      if (!workspaceFiles?.has(path)) {
        throw new Error(`File not found: ${path}`);
      }
      return workspaceFiles.get(path)!;
    },

    async readTextFile(workspaceId: string, path: string) {
      const buffer = await this.readFile(workspaceId, path);
      return new TextDecoder().decode(buffer);
    },

    async fileExists(workspaceId: string, path: string) {
      return files.get(workspaceId)?.has(path) || false;
    },

    async deleteFile(workspaceId: string, path: string) {
      files.get(workspaceId)?.delete(path);
    },

    async listFiles(workspaceId: string, directory?: string) {
      const workspaceFiles = files.get(workspaceId) || new Map();
      let filePaths = Array.from(workspaceFiles.keys());
      
      if (directory) {
        const normalizedDir = directory.endsWith('/') ? directory : directory + '/';
        filePaths = filePaths.filter(path => path.startsWith(normalizedDir));
      }
      
      return filePaths.map(path => ({
        path,
        isDirectory: false,
        size: workspaceFiles.get(path)?.byteLength || 0,
        lastModified: new Date()
      }));
    },

    async createDirectory(workspaceId: string, path: string) {
      // No-op for mock - directories are implicit in file paths
    },

    async directoryExists(workspaceId: string, path: string) {
      const workspaceFiles = files.get(workspaceId) || new Map();
      const normalizedDir = path.endsWith('/') ? path : path + '/';
      return Array.from(workspaceFiles.keys()).some(filePath => 
        filePath.startsWith(normalizedDir)
      );
    },

    // Storage info
    async getStorageInfo() {
      const totalFiles = Array.from(files.values())
        .reduce((acc, workspaceFiles) => acc + workspaceFiles.size, 0);
      
      return {
        backend: 'mock-isolated' as const,
        isSupported: true,
        totalBytes: 0, // Mock storage doesn't track real bytes
        usedBytes: 0,
        availableBytes: Infinity,
        workspaceCount: workspaces.size,
        fileCount: totalFiles
      };
    },

    // Type assertion to match interface
  } as FileStorageAPI;

  return mockStorage;
}

/**
 * Creates demo EPUB metadata with temporary identifiers
 * Prevents persistent demo data by using unique IDs per story run
 */
export function createDemoEPUBMetadata(titlePrefix = 'Demo EPUB') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  
  return {
    title: `${titlePrefix} ${random}`,
    creator: ['Demo Author'],
    language: 'en',
    identifier: `demo-epub-${timestamp}-${random}`,
    modifiedDate: new Date().toISOString(),
    description: 'Temporary demo EPUB for Storybook story'
  };
}

/**
 * Cleanup function to be called when stories unmount
 * Clears any lingering references to prevent memory leaks
 */
export function cleanupStoryStorage(storage: FileStorageAPI) {
  // For mock storage, cleanup is automatic via garbage collection
  // Real storage would need explicit cleanup here
  console.log('Story storage cleaned up');
}