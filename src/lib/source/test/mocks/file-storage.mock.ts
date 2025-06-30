import type { FileStorageAPI } from '$lib/storage';

/**
 * Mock implementation of FileStorageAPI for testing
 * Provides in-memory storage for SOURCE.zip unit tests
 */
export class MockFileStorage implements FileStorageAPI {
  private workspaces = new Map<string, Map<string, ArrayBuffer>>();
  private failureMode: string | null = null;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.workspaces.clear();
    this.failureMode = null;
  }

  /**
   * Set failure mode for testing error scenarios
   */
  setFailureMode(mode: 'read' | 'write' | 'list' | 'permission' | null): void {
    this.failureMode = mode;
  }

  async createWorkspace(workspaceId: string): Promise<void> {
    if (this.failureMode === 'permission') {
      throw new Error('Permission denied');
    }
    this.workspaces.set(workspaceId, new Map());
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    this.workspaces.delete(workspaceId);
  }

  async workspaceExists(workspaceId: string): Promise<boolean> {
    return this.workspaces.has(workspaceId);
  }

  async listWorkspaces(): Promise<string[]> {
    return Array.from(this.workspaces.keys());
  }

  async listFiles(workspaceId: string): Promise<string[]> {
    if (this.failureMode === 'list') {
      throw new Error('Failed to list files');
    }

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    return Array.from(workspace.keys());
  }

  async readFile(workspaceId: string, filePath: string): Promise<ArrayBuffer> {
    if (this.failureMode === 'read') {
      throw new Error(`Failed to read file: ${filePath}`);
    }

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const content = workspace.get(filePath);
    if (!content) {
      throw new Error(`File not found: ${filePath}`);
    }

    return content;
  }

  async readFileAsText(workspaceId: string, filePath: string): Promise<string> {
    const buffer = await this.readFile(workspaceId, filePath);
    return new TextDecoder().decode(buffer);
  }

  async writeFile(workspaceId: string, filePath: string, content: ArrayBuffer): Promise<void> {
    if (this.failureMode === 'write') {
      throw new Error(`Failed to write file: ${filePath}`);
    }

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    workspace.set(filePath, content);
  }

  async writeTextFile(workspaceId: string, filePath: string, content: string): Promise<void> {
    const buffer = new TextEncoder().encode(content);
    await this.writeFile(workspaceId, filePath, buffer);
  }

  async deleteFile(workspaceId: string, filePath: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    if (!workspace.delete(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
  }

  async fileExists(workspaceId: string, filePath: string): Promise<boolean> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return false;
    }
    return workspace.has(filePath);
  }

  async getFileStats(
    workspaceId: string,
    filePath: string
  ): Promise<{
    size: number;
    lastModified: Date;
  }> {
    const content = await this.readFile(workspaceId, filePath);
    return {
      size: content.byteLength,
      lastModified: new Date(),
    };
  }

  /**
   * Test helper: Add multiple files at once
   */
  async addTestFiles(
    workspaceId: string,
    files: Record<string, string | ArrayBuffer>
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      await this.createWorkspace(workspaceId);
    }

    for (const [path, content] of Object.entries(files)) {
      if (typeof content === 'string') {
        await this.writeTextFile(workspaceId, path, content);
      } else {
        await this.writeFile(workspaceId, path, content);
      }
    }
  }

  /**
   * Test helper: Get all files for verification
   */
  getAllFiles(workspaceId: string): Map<string, ArrayBuffer> | undefined {
    return this.workspaces.get(workspaceId);
  }

  /**
   * Test helper: Check if workspace has any SOURCE/ files
   */
  async hasSourceFiles(workspaceId: string): Promise<boolean> {
    const files = await this.listFiles(workspaceId);
    return files.some(path => path.startsWith('SOURCE/'));
  }
}

/**
 * Factory function for creating fresh mock instances in tests
 */
export function createMockFileStorage(): MockFileStorage {
  return new MockFileStorage();
}
