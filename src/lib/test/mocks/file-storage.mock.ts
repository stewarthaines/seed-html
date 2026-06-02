/**
 * Shared Mock File Storage API for Testing
 *
 * Comprehensive mock implementation of FileStorageAPI used across all feature modules.
 * Provides controllable simulation of file operations with error injection, state tracking,
 * and comprehensive test utilities.
 *
 * Based on the most feature-rich implementation from extensions module, this shared mock
 * eliminates code duplication while providing consistent testing capabilities.
 *
 * Usage:
 * ```typescript
 * import { MockFileStorage, createMockFileStorage } from '../../../test/mocks/file-storage.mock.js';
 *
 * // For class-based mocking with full control
 * const mockStorage = new MockFileStorage();
 * mockStorage.setFailureMode('read');
 *
 * // For simple function-based mocking
 * const mockStorage = createMockFileStorage();
 * ```
 */

import type { FileStorageAPI, BackendType } from '../../storage/index.js';

export interface MockFileEntry {
  path: string;
  content: string | ArrayBuffer;
  size: number;
  lastModified: Date;
}

export type FailureMode = 'read' | 'write' | 'list' | 'delete' | 'exists' | 'fileinfo';

/**
 * Comprehensive mock implementation of FileStorageAPI
 *
 * Features:
 * - In-memory file storage simulation
 * - Controllable error injection for testing failure scenarios
 * - Operation counting for test verification
 * - Rich helper methods for test setup and verification
 * - Full compatibility with FileStorageAPI interface
 */
export class MockFileStorage implements Partial<FileStorageAPI> {
  private workspaces = new Map<string, Map<string, MockFileEntry>>();
  private failureMode: FailureMode | null = null;
  private operationCount = 0;

  constructor() {
    this.reset();
  }

  /**
   * Reset mock to initial state
   * Clears all workspaces, failure modes, and operation counters
   */
  reset(): void {
    this.workspaces.clear();
    this.failureMode = null;
    this.operationCount = 0;
  }

  /**
   * Set failure mode for testing error scenarios
   * @param mode - Type of operation to fail, or null to disable failures
   */
  setFailureMode(mode: FailureMode | null): void {
    this.failureMode = mode;
  }

  /**
   * Get total number of operations performed (for test verification)
   */
  getOperationCount(): number {
    return this.operationCount;
  }

  // Core workspace operations
  async createWorkspace(id?: string): Promise<string> {
    this.operationCount++;
    const workspaceId = id || `workspace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.workspaces.set(workspaceId, new Map());
    return workspaceId;
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    this.operationCount++;
    if (this.failureMode === 'delete') {
      throw new Error('Failed to delete workspace');
    }
    this.workspaces.delete(workspaceId);
  }

  async listWorkspaces(): Promise<string[]> {
    this.operationCount++;
    if (this.failureMode === 'list') {
      throw new Error('Failed to list workspaces');
    }
    return Array.from(this.workspaces.keys());
  }

  // File operations
  async writeFile(workspaceId: string, path: string, content: string | ArrayBuffer): Promise<void> {
    this.operationCount++;
    if (this.failureMode === 'write') {
      throw new Error('Failed to write file');
    }

    const workspace = this.getWorkspace(workspaceId);
    const size =
      typeof content === 'string' ? new TextEncoder().encode(content).length : content.byteLength;

    workspace.set(path, {
      path,
      content,
      size,
      lastModified: new Date(),
    });
  }

  async writeTextFile(workspaceId: string, path: string, content: string): Promise<void> {
    return this.writeFile(workspaceId, path, content);
  }

  async readFile(workspaceId: string, path: string): Promise<ArrayBuffer> {
    this.operationCount++;
    if (this.failureMode === 'read') {
      throw new Error(`Failed to read file: ${path}`);
    }

    const workspace = this.getWorkspace(workspaceId);
    const entry = workspace.get(path);
    if (!entry) {
      throw new Error(`File not found: ${path}`);
    }

    if (typeof entry.content === 'string') {
      return new TextEncoder().encode(entry.content).buffer as ArrayBuffer;
    }
    return entry.content;
  }

  async readTextFile(workspaceId: string, path: string): Promise<string> {
    this.operationCount++;
    const buffer = await this.readFile(workspaceId, path);
    return new TextDecoder().decode(buffer);
  }

  async fileExists(workspaceId: string, path: string): Promise<boolean> {
    this.operationCount++;
    if (this.failureMode === 'exists') {
      throw new Error('Failed to check file existence');
    }

    const workspace = this.workspaces.get(workspaceId);
    return workspace ? workspace.has(path) : false;
  }

  async workspaceExists(workspaceId: string): Promise<boolean> {
    return this.workspaces.has(workspaceId);
  }

  async listFiles(workspaceId: string, directory?: string): Promise<string[]> {
    this.operationCount++;
    if (this.failureMode === 'list') {
      throw new Error('Failed to list files');
    }

    const workspace = this.getWorkspace(workspaceId);
    const files = Array.from(workspace.keys());

    if (directory) {
      const normalizedDir = directory.endsWith('/') ? directory : `${directory}/`;
      return files.filter(path => path.startsWith(normalizedDir));
    }

    return files;
  }

  async getFileInfo(
    workspaceId: string,
    path: string
  ): Promise<{ size: number; lastModified: Date }> {
    this.operationCount++;
    if (this.failureMode === 'fileinfo') {
      throw new Error('Failed to get file info');
    }

    const workspace = this.getWorkspace(workspaceId);
    const entry = workspace.get(path);
    if (!entry) {
      throw new Error(`File not found: ${path}`);
    }

    return {
      size: entry.size,
      lastModified: entry.lastModified,
    };
  }

  async deleteFile(workspaceId: string, path: string): Promise<void> {
    this.operationCount++;
    if (this.failureMode === 'delete') {
      throw new Error('Failed to delete file');
    }

    const workspace = this.getWorkspace(workspaceId);
    if (!workspace.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    workspace.delete(path);
  }

  async renameFile(workspaceId: string, oldPath: string, newPath: string): Promise<void> {
    this.operationCount++;
    const workspace = this.getWorkspace(workspaceId);
    const entry = workspace.get(oldPath);
    if (!entry) {
      throw new Error(`File not found: ${oldPath}`);
    }
    workspace.set(newPath, { ...entry, path: newPath });
    workspace.delete(oldPath);
  }

  // System methods for compatibility
  async init(): Promise<void> {
    // No-op for mock
  }

  isInitialized(): boolean {
    return true;
  }

  destroy(): void {
    this.reset();
  }

  async getQuota(): Promise<{ used: number; available: number }> {
    return { used: 0, available: 1000000 };
  }

  getBackendType(): BackendType {
    return 'indexeddb';
  }

  async estimateWorkspaceSize(workspaceId: string): Promise<number> {
    return this.getWorkspaceSize(workspaceId);
  }

  supportsDirectBlobURLs(): boolean {
    return false;
  }

  async getFile(workspaceId: string, filePath: string): Promise<File> {
    const entry = await this.readFile(workspaceId, filePath);
    const fileName = filePath.split('/').pop() || 'file';
    return new File([entry], fileName);
  }

  get manager(): undefined {
    // Mock doesn't have a real manager
    return undefined;
  }

  // Test utility methods

  /**
   * Add multiple files at once for test setup
   * @param workspaceId - Target workspace
   * @param files - Map of file paths to content
   */
  async addTestFiles(
    workspaceId: string,
    files: Record<string, string | ArrayBuffer>
  ): Promise<void> {
    const workspace = this.ensureWorkspace(workspaceId);

    for (const [path, content] of Object.entries(files)) {
      const size =
        typeof content === 'string' ? new TextEncoder().encode(content).length : content.byteLength;

      workspace.set(path, {
        path,
        content,
        size,
        lastModified: new Date(),
      });
    }
  }

  /**
   * Get all files in a workspace for test verification
   * @param workspaceId - Target workspace
   * @returns Map of file paths to mock file entries
   */
  getWorkspaceFiles(workspaceId: string): Map<string, MockFileEntry> {
    return this.workspaces.get(workspaceId) || new Map();
  }

  /**
   * Get all files for verification (from original source/transform mocks)
   * @param workspaceId - Target workspace
   * @returns Map of file paths to ArrayBuffer content
   */
  getAllFiles(workspaceId: string): Map<string, ArrayBuffer> | undefined {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return undefined;

    const result = new Map<string, ArrayBuffer>();
    for (const [path, entry] of workspace) {
      if (typeof entry.content === 'string') {
        result.set(path, new TextEncoder().encode(entry.content).buffer as ArrayBuffer);
      } else {
        result.set(path, entry.content);
      }
    }
    return result;
  }

  /**
   * Check if workspace exists
   * @param workspaceId - Target workspace
   */
  hasWorkspace(workspaceId: string): boolean {
    return this.workspaces.has(workspaceId);
  }

  /**
   * Get total size of all files in workspace
   * @param workspaceId - Target workspace
   */
  getWorkspaceSize(workspaceId: string): number {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return 0;

    let totalSize = 0;
    for (const entry of workspace.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  /**
   * Check if workspace has any SOURCE/ files (from source module)
   * @param workspaceId - Target workspace
   */
  async hasSourceFiles(workspaceId: string): Promise<boolean> {
    const files = await this.listFiles(workspaceId);
    return files.some(path => path.startsWith('SOURCE/'));
  }

  // Private helper methods

  private getWorkspace(workspaceId: string): Map<string, MockFileEntry> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      // Auto-create workspace like real storage backends do
      this.workspaces.set(workspaceId, new Map());
      return this.workspaces.get(workspaceId)!;
    }
    return workspace;
  }

  private ensureWorkspace(workspaceId: string): Map<string, MockFileEntry> {
    if (!this.workspaces.has(workspaceId)) {
      this.workspaces.set(workspaceId, new Map());
    }
    return this.workspaces.get(workspaceId)!;
  }
}

/**
 * Factory function for creating fresh mock instances in tests
 *
 * Use this when you need a class-based mock with full control over state and error simulation.
 * For simple function-based mocks, consider using the pattern in settings/test/test-utils.ts
 * following TESTING.md modern mock strategy.
 */
export function createMockFileStorage(): MockFileStorage {
  return new MockFileStorage();
}
