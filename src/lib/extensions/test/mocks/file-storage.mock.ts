/**
 * Mock File Storage API for Extension Manager testing
 * 
 * Provides controllable simulation of file operations with error injection
 * and state tracking for comprehensive test coverage.
 */

import type { FileStorageAPI } from '$lib/storage';

export interface MockFileEntry {
  path: string;
  content: string | ArrayBuffer;
  size: number;
  lastModified: Date;
}

export type FailureMode = 'read' | 'write' | 'list' | 'delete' | 'exists' | 'stats';

export class MockFileStorage implements Partial<FileStorageAPI> {
  private workspaces = new Map<string, Map<string, MockFileEntry>>();
  private failureMode: FailureMode | null = null;
  private operationCount = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.workspaces.clear();
    this.failureMode = null;
    this.operationCount = 0;
  }

  setFailureMode(mode: FailureMode | null): void {
    this.failureMode = mode;
  }

  getOperationCount(): number {
    return this.operationCount;
  }

  // Core workspace operations
  async createWorkspace(): Promise<string> {
    this.operationCount++;
    const workspaceId = `workspace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    const size = typeof content === 'string' ? 
      new TextEncoder().encode(content).length : 
      content.byteLength;

    workspace.set(path, {
      path,
      content,
      size,
      lastModified: new Date()
    });
  }

  async writeTextFile(workspaceId: string, path: string, content: string): Promise<void> {
    return this.writeFile(workspaceId, path, content);
  }

  async readFile(workspaceId: string, path: string): Promise<ArrayBuffer> {
    this.operationCount++;
    if (this.failureMode === 'read') {
      throw new Error('Failed to read file');
    }

    const workspace = this.getWorkspace(workspaceId);
    const entry = workspace.get(path);
    if (!entry) {
      throw new Error(`File not found: ${path}`);
    }

    if (typeof entry.content === 'string') {
      return new TextEncoder().encode(entry.content).buffer;
    }
    return entry.content;
  }

  async readFileAsText(workspaceId: string, path: string): Promise<string> {
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

  async getFileStats(workspaceId: string, path: string): Promise<{ size: number; lastModified: Date }> {
    this.operationCount++;
    if (this.failureMode === 'stats') {
      throw new Error('Failed to get file stats');
    }

    const workspace = this.getWorkspace(workspaceId);
    const entry = workspace.get(path);
    if (!entry) {
      throw new Error(`File not found: ${path}`);
    }

    return {
      size: entry.size,
      lastModified: entry.lastModified
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

  // Utility methods for testing
  addTestFiles(workspaceId: string, files: Record<string, string | ArrayBuffer>): Promise<void> {
    const workspace = this.ensureWorkspace(workspaceId);
    
    for (const [path, content] of Object.entries(files)) {
      const size = typeof content === 'string' ? 
        new TextEncoder().encode(content).length : 
        content.byteLength;

      workspace.set(path, {
        path,
        content,
        size,
        lastModified: new Date()
      });
    }

    return Promise.resolve();
  }

  getWorkspaceFiles(workspaceId: string): Map<string, MockFileEntry> {
    return this.workspaces.get(workspaceId) || new Map();
  }

  hasWorkspace(workspaceId: string): boolean {
    return this.workspaces.has(workspaceId);
  }

  getWorkspaceSize(workspaceId: string): number {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return 0;

    let totalSize = 0;
    for (const entry of workspace.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private getWorkspace(workspaceId: string): Map<string, MockFileEntry> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
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