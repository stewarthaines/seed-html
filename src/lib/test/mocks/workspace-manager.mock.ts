/**
 * Shared Mock Workspace Manager for Testing
 *
 * Comprehensive mock implementation of WorkspaceManager used across all feature modules.
 * Provides controllable simulation of workspace operations with error injection, state tracking,
 * and comprehensive test utilities for OPF document manipulation.
 *
 * Based on the shared mock pattern from file-storage.mock.ts, this provides consistent
 * testing capabilities for workspace and EPUB operations.
 *
 * Usage:
 * ```typescript
 * import { MockWorkspaceManager, createMockWorkspaceManager } from '../../../test/mocks/workspace-manager.mock.js';
 *
 * // For class-based mocking with full control
 * const mockWorkspace = new MockWorkspaceManager();
 * mockWorkspace.setFailureMode('opf-read');
 *
 * // For simple function-based mocking
 * const mockWorkspace = createMockWorkspaceManager();
 * ```
 */

import { vi } from 'vitest';
import type { OPFDocument, ManifestItem, SpineItem, EPUBMetadata } from '../../epub/opf-utils.js';

export interface MockOPFDocument extends Omit<OPFDocument, 'metadata'> {
  manifest: ManifestItem[];
  spine: SpineItem[];
  metadata: EPUBMetadata | undefined;
}

export type WorkspaceFailureMode =
  | 'opf-read'
  | 'opf-write'
  | 'manifest-add'
  | 'manifest-remove'
  | 'spine-add'
  | 'spine-remove'
  | 'spine-update'
  | 'file-write'
  | 'file-read'
  | 'file-delete'
  | 'workspace-not-found';

/**
 * Comprehensive mock implementation of WorkspaceManager
 *
 * Features:
 * - In-memory OPF document simulation
 * - Controllable error injection for testing failure scenarios
 * - Operation counting for test verification
 * - Rich helper methods for test setup and verification
 * - Full compatibility with WorkspaceManager interface
 */
export class MockWorkspaceManager implements Partial<any> {
  private workspaceOPFs = new Map<string, MockOPFDocument>();
  private workspaceFiles = new Map<string, Map<string, string | ArrayBuffer>>();
  private failureMode: WorkspaceFailureMode | null = null;
  private operationCount = 0;
  private rollbackStack: Array<() => void> = [];

  constructor() {
    this.reset();
  }

  /**
   * Reset mock to initial state
   * Clears all workspaces, failure modes, and operation counters
   */
  reset(): void {
    this.workspaceOPFs.clear();
    this.workspaceFiles.clear();
    this.failureMode = null;
    this.operationCount = 0;
    this.rollbackStack = [];
  }

  /**
   * Set failure mode for testing error scenarios
   * @param mode - Type of operation to fail, or null to disable failures
   */
  setFailureMode(mode: WorkspaceFailureMode | null): void {
    this.failureMode = mode;
  }

  /**
   * Get total number of operations performed (for test verification)
   */
  getOperationCount(): number {
    return this.operationCount;
  }

  /**
   * Start transaction for atomic operations
   */
  startTransaction(): void {
    this.rollbackStack = [];
  }

  /**
   * Commit transaction
   */
  commitTransaction(): void {
    this.rollbackStack = [];
  }

  /**
   * Rollback transaction
   */
  rollbackTransaction(): void {
    while (this.rollbackStack.length > 0) {
      const rollbackOp = this.rollbackStack.pop();
      rollbackOp?.();
    }
  }

  // Core WorkspaceManager methods

  async getWorkspaceOPF(workspaceId: string): Promise<MockOPFDocument | any> {
    this.operationCount++;
    if (this.failureMode === 'opf-read') {
      throw new Error('Failed to read OPF document');
    }
    if (this.failureMode === 'workspace-not-found') {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const opf = this.workspaceOPFs.get(workspaceId);
    if (!opf) {
      // Return empty OPF for new workspaces
      const emptyOPF: MockOPFDocument = {
        manifest: [],
        spine: [],
        metadata: {
          title: 'Untitled',
          language: 'en',
          identifier: `urn:uuid:${crypto.randomUUID()}`,
          creator: [],
          date: new Date().toISOString().split('T')[0],
        },
      };
      this.workspaceOPFs.set(workspaceId, emptyOPF);
      return emptyOPF;
    }

    return opf;
  }

  async addManifestItem(workspaceId: string, item: any): Promise<void> {
    this.operationCount++;
    if (this.failureMode === 'manifest-add') {
      throw new Error('Failed to add manifest item');
    }

    const opf = (await this.getWorkspaceOPF(workspaceId)) as MockOPFDocument;

    // Check for duplicate IDs
    if (opf.manifest.some(existing => existing.id === item.id)) {
      throw new Error(`Manifest item with ID '${item.id}' already exists`);
    }

    // Store rollback operation
    this.rollbackStack.push(() => {
      const index = opf.manifest.findIndex(m => m.id === item.id);
      if (index !== -1) {
        opf.manifest.splice(index, 1);
      }
    });

    opf.manifest.push(item);
  }

  async removeManifestItem(workspaceId: string, itemId: string): Promise<void> {
    this.operationCount++;
    if (this.failureMode === 'manifest-remove') {
      throw new Error('Failed to remove manifest item');
    }

    const opf = (await this.getWorkspaceOPF(workspaceId)) as MockOPFDocument;
    const index = opf.manifest.findIndex(item => item.id === itemId);

    if (index === -1) {
      throw new Error(`Manifest item not found: ${itemId}`);
    }

    const removedItem = opf.manifest[index];

    // Store rollback operation
    this.rollbackStack.push(() => {
      opf.manifest.splice(index, 0, removedItem);
    });

    opf.manifest.splice(index, 1);
  }

  async addSpineItem(workspaceId: string, item: SpineItem, insertIndex?: number): Promise<void> {
    this.operationCount++;
    if (this.failureMode === 'spine-add') {
      throw new Error('Failed to add spine item');
    }

    const opf = (await this.getWorkspaceOPF(workspaceId)) as MockOPFDocument;

    // Check that referenced manifest item exists
    if (!opf.manifest.some(m => m.id === item.idref)) {
      throw new Error(`Referenced manifest item not found: ${item.idref}`);
    }

    const targetIndex = insertIndex ?? opf.spine.length;

    // Store rollback operation
    this.rollbackStack.push(() => {
      const index = opf.spine.findIndex(s => s.idref === item.idref);
      if (index !== -1) {
        opf.spine.splice(index, 1);
      }
    });

    opf.spine.splice(targetIndex, 0, item);
  }

  async removeSpineItem(workspaceId: string, itemIdref: string): Promise<void> {
    this.operationCount++;
    if (this.failureMode === 'spine-remove') {
      throw new Error('Failed to remove spine item');
    }

    const opf = (await this.getWorkspaceOPF(workspaceId)) as MockOPFDocument;
    const index = opf.spine.findIndex(item => item.idref === itemIdref);

    if (index === -1) {
      throw new Error(`Spine item not found: ${itemIdref}`);
    }

    const removedItem = opf.spine[index];

    // Store rollback operation
    this.rollbackStack.push(() => {
      opf.spine.splice(index, 0, removedItem);
    });

    opf.spine.splice(index, 1);
  }

  async updateSpineOrder(workspaceId: string, orderedIdrefs: string[]): Promise<void> {
    this.operationCount++;
    if (this.failureMode === 'spine-update') {
      throw new Error('Failed to update spine order');
    }

    const opf = (await this.getWorkspaceOPF(workspaceId)) as MockOPFDocument;
    const originalSpine = [...opf.spine];

    // Store rollback operation
    this.rollbackStack.push(() => {
      opf.spine.length = 0;
      opf.spine.push(...originalSpine);
    });

    // Validate all idrefs exist in current spine
    for (const idref of orderedIdrefs) {
      if (!opf.spine.some(item => item.idref === idref)) {
        throw new Error(`Spine item not found: ${idref}`);
      }
    }

    // Reorder spine items
    const reorderedSpine: SpineItem[] = [];
    for (const idref of orderedIdrefs) {
      const spineItem = opf.spine.find(item => item.idref === idref);
      if (spineItem) {
        reorderedSpine.push(spineItem);
      }
    }

    opf.spine.length = 0;
    opf.spine.push(...reorderedSpine);
  }

  async writeFile(workspaceId: string, path: string, content: string | ArrayBuffer): Promise<void> {
    this.operationCount++;
    if (this.failureMode === 'file-write') {
      throw new Error(`Failed to write file: ${path}`);
    }
    if (this.failureMode === 'opf-write' && path.includes('content.opf')) {
      throw new Error(`Failed to write OPF file: ${path}`);
    }

    const workspace = this.ensureWorkspace(workspaceId);
    const existingContent = workspace.get(path);

    // Store rollback operation
    this.rollbackStack.push(() => {
      if (existingContent === undefined) {
        workspace.delete(path);
      } else {
        workspace.set(path, existingContent);
      }
    });

    workspace.set(path, content);
  }

  async writeTextFile(workspaceId: string, path: string, content: string): Promise<void> {
    return this.writeFile(workspaceId, path, content);
  }

  async readFile(workspaceId: string, path: string): Promise<ArrayBuffer> {
    this.operationCount++;
    if (this.failureMode === 'file-read') {
      throw new Error(`Failed to read file: ${path}`);
    }

    const workspace = this.workspaceFiles.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const content = workspace.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }

    if (typeof content === 'string') {
      // Convert string to ArrayBuffer
      return new TextEncoder().encode(content).buffer as ArrayBuffer;
    } else {
      return content;
    }
  }

  async readTextFile(workspaceId: string, path: string): Promise<string> {
    this.operationCount++;
    if (this.failureMode === 'file-read') {
      throw new Error(`Failed to read file: ${path}`);
    }

    const workspace = this.workspaceFiles.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const content = workspace.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }

    if (typeof content === 'string') {
      return content;
    } else {
      return new TextDecoder().decode(content);
    }
  }

  async deleteFile(workspaceId: string, path: string): Promise<void> {
    this.operationCount++;
    if (this.failureMode === 'file-delete') {
      throw new Error(`Failed to delete file: ${path}`);
    }

    const workspace = this.workspaceFiles.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const existingContent = workspace.get(path);
    if (existingContent === undefined) {
      throw new Error(`File not found: ${path}`);
    }

    // Store rollback operation
    this.rollbackStack.push(() => {
      workspace.set(path, existingContent);
    });

    workspace.delete(path);
  }

  async fileExists(workspaceId: string, path: string): Promise<boolean> {
    this.operationCount++;
    const workspace = this.workspaceFiles.get(workspaceId);
    return workspace ? workspace.has(path) : false;
  }

  async loadOPF(workspaceId: string): Promise<MockOPFDocument | any> {
    this.operationCount++;
    if (this.failureMode === 'opf-read') {
      throw new Error('Failed to read OPF document');
    }
    if (this.failureMode === 'workspace-not-found') {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const opf = this.workspaceOPFs.get(workspaceId);
    if (!opf) {
      // Return empty OPF for new workspaces
      const emptyOPF: MockOPFDocument = {
        manifest: [],
        spine: [],
        metadata: {
          title: 'Untitled',
          language: 'en',
          identifier: `urn:uuid:${crypto.randomUUID()}`,
          creator: [],
          date: new Date().toISOString().split('T')[0],
        },
      };
      this.workspaceOPFs.set(workspaceId, emptyOPF);
      return emptyOPF;
    }

    return opf;
  }

  async saveOPF(workspaceId: string, opf: MockOPFDocument): Promise<void> {
    this.operationCount++;
    if (this.failureMode === 'opf-write') {
      throw new Error('Failed to write OPF document');
    }
    if (this.failureMode === 'workspace-not-found') {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Store rollback operation
    const existingOPF = this.workspaceOPFs.get(workspaceId);
    this.rollbackStack.push(() => {
      if (existingOPF) {
        this.workspaceOPFs.set(workspaceId, existingOPF);
      } else {
        this.workspaceOPFs.delete(workspaceId);
      }
    });

    this.workspaceOPFs.set(workspaceId, opf);
  }

  async listSourceFiles(workspaceId: string): Promise<any[]> {
    this.operationCount++;
    if (this.failureMode === 'workspace-not-found') {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Return mock source files
    return [
      { path: 'SOURCE/text/chapter1.txt', type: 'text', size: 1024, modified: new Date() },
      { path: 'SOURCE/text/chapter2.txt', type: 'text', size: 2048, modified: new Date() },
    ];
  }

  async getSourceFile(workspaceId: string, sourcePath: string): Promise<ArrayBuffer | string> {
    this.operationCount++;
    if (this.failureMode === 'file-read') {
      throw new Error(`Failed to read source file: ${sourcePath}`);
    }
    if (this.failureMode === 'workspace-not-found') {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    return 'Source file content';
  }

  async isAdvancedModeEnabled(workspaceId: string): Promise<boolean> {
    this.operationCount++;
    if (this.failureMode === 'workspace-not-found') {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    return true;
  }

  async exists(workspaceId: string): Promise<boolean> {
    this.operationCount++;
    if (this.failureMode === 'workspace-not-found') {
      return false;
    }

    return this.workspaceOPFs.has(workspaceId) || this.workspaceFiles.has(workspaceId);
  }

  // Test utility methods

  /**
   * Set up a workspace with test OPF data
   * @param workspaceId - Target workspace
   * @param opf - OPF document to set
   */
  setWorkspaceOPF(workspaceId: string, opf: Partial<MockOPFDocument>): void {
    const fullOPF: MockOPFDocument = {
      manifest: opf.manifest || [],
      spine: opf.spine || [],
      metadata:
        'metadata' in opf
          ? opf.metadata
          : {
              title: 'Test EPUB',
              language: 'en',
              identifier: `urn:uuid:${crypto.randomUUID()}`,
              creator: ['Test Author'],
              date: '2024-01-01',
            },
    };
    this.workspaceOPFs.set(workspaceId, fullOPF);
    this.ensureWorkspace(workspaceId);
  }

  /**
   * Add test files to workspace
   * @param workspaceId - Target workspace
   * @param files - Map of file paths to content
   */
  addTestFiles(workspaceId: string, files: Record<string, string | ArrayBuffer>): void {
    const workspace = this.ensureWorkspace(workspaceId);
    for (const [path, content] of Object.entries(files)) {
      workspace.set(path, content);
    }
  }

  /**
   * Get all files in workspace for verification
   * @param workspaceId - Target workspace
   */
  getWorkspaceFiles(workspaceId: string): Map<string, string | ArrayBuffer> {
    return this.workspaceFiles.get(workspaceId) || new Map();
  }

  /**
   * Check if workspace exists
   * @param workspaceId - Target workspace
   */
  hasWorkspace(workspaceId: string): boolean {
    return this.workspaceOPFs.has(workspaceId);
  }

  /**
   * Create sample manifest item for testing
   * @param id - Item ID
   * @param href - File path
   * @param mediaType - MIME type
   */
  createTestManifestItem(
    id: string,
    href: string,
    mediaType = 'application/xhtml+xml'
  ): ManifestItem {
    return { id, href, mediaType };
  }

  /**
   * Create sample spine item for testing
   * @param idref - Reference to manifest item
   * @param linear - Linear reading order flag
   * @param properties - EPUB properties
   */
  createTestSpineItem(idref: string, linear = true, properties?: string[]): SpineItem {
    const item: SpineItem = { idref, linear };
    if (properties) {
      item.properties = properties;
    }
    return item;
  }

  /**
   * Get validation results for current workspace state
   * @param workspaceId - Target workspace
   */
  validateWorkspaceState(workspaceId: string): {
    manifestIds: Set<string>;
    spineIdrefs: string[];
    missingManifestItems: string[];
    duplicateSpineItems: string[];
    orphanedManifestItems: string[];
  } {
    const opf = this.workspaceOPFs.get(workspaceId);
    if (!opf) {
      return {
        manifestIds: new Set(),
        spineIdrefs: [],
        missingManifestItems: [],
        duplicateSpineItems: [],
        orphanedManifestItems: [],
      };
    }

    const manifestIds = new Set(opf.manifest.map(item => item.id));
    const spineIdrefs = opf.spine.map(item => item.idref);

    // Find spine items without manifest entries
    const missingManifestItems = spineIdrefs.filter(idref => !manifestIds.has(idref));

    // Find duplicate spine items
    const duplicateSpineItems = spineIdrefs.filter(
      (idref, index) => spineIdrefs.indexOf(idref) !== index
    );

    // Find manifest items not in spine
    const spineIdrefSet = new Set(spineIdrefs);
    const orphanedManifestItems = opf.manifest
      .filter(item => !spineIdrefSet.has(item.id))
      .map(item => item.id);

    return {
      manifestIds,
      spineIdrefs,
      missingManifestItems,
      duplicateSpineItems,
      orphanedManifestItems,
    };
  }

  // Private helper methods

  private ensureWorkspace(workspaceId: string): Map<string, string | ArrayBuffer> {
    if (!this.workspaceFiles.has(workspaceId)) {
      this.workspaceFiles.set(workspaceId, new Map());
    }
    return this.workspaceFiles.get(workspaceId)!;
  }
}

/**
 * Factory function for creating fresh mock instances in tests
 *
 * Use this when you need a class-based mock with full control over state and error simulation.
 */
export function createMockWorkspaceManager(): MockWorkspaceManager {
  return new MockWorkspaceManager();
}

/**
 * Create mock WorkspaceManager with vi.fn() methods for simple function-based mocking
 * Following the pattern from settings/test/test-utils.ts
 */
export function createMockWorkspaceManagerVi() {
  const mock = new MockWorkspaceManager();

  return {
    getWorkspaceOPF: vi
      .fn()
      .mockImplementation((workspaceId: string) => mock.getWorkspaceOPF(workspaceId)),
    loadOPF: vi.fn().mockImplementation((workspaceId: string) => mock.loadOPF(workspaceId)),
    saveOPF: vi
      .fn()
      .mockImplementation((workspaceId: string, opf: MockOPFDocument) =>
        mock.saveOPF(workspaceId, opf)
      ),
    addManifestItem: vi
      .fn()
      .mockImplementation((workspaceId: string, item: ManifestItem) =>
        mock.addManifestItem(workspaceId, item)
      ),
    removeManifestItem: vi
      .fn()
      .mockImplementation((workspaceId: string, itemId: string) =>
        mock.removeManifestItem(workspaceId, itemId)
      ),
    addSpineItem: vi
      .fn()
      .mockImplementation((workspaceId: string, item: SpineItem, insertIndex?: number) =>
        mock.addSpineItem(workspaceId, item, insertIndex)
      ),
    removeSpineItem: vi
      .fn()
      .mockImplementation((workspaceId: string, itemIdref: string) =>
        mock.removeSpineItem(workspaceId, itemIdref)
      ),
    updateSpineOrder: vi
      .fn()
      .mockImplementation((workspaceId: string, orderedIdrefs: string[]) =>
        mock.updateSpineOrder(workspaceId, orderedIdrefs)
      ),
    writeFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string, content: string | ArrayBuffer) =>
        mock.writeFile(workspaceId, path, content)
      ),
    writeTextFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string, content: string) =>
        mock.writeTextFile(workspaceId, path, content)
      ),
    readFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string) => mock.readFile(workspaceId, path)),
    readTextFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string) =>
        mock.readTextFile(workspaceId, path)
      ),
    deleteFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string) =>
        mock.deleteFile(workspaceId, path)
      ),
    fileExists: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string) =>
        mock.fileExists(workspaceId, path)
      ),
    listSourceFiles: vi
      .fn()
      .mockImplementation((workspaceId: string) => mock.listSourceFiles(workspaceId)),
    getSourceFile: vi
      .fn()
      .mockImplementation((workspaceId: string, sourcePath: string) =>
        mock.getSourceFile(workspaceId, sourcePath)
      ),
    isAdvancedModeEnabled: vi
      .fn()
      .mockImplementation((workspaceId: string) => mock.isAdvancedModeEnabled(workspaceId)),
    exists: vi.fn().mockImplementation((workspaceId: string) => mock.exists(workspaceId)),

    // Expose mock instance for direct manipulation
    _mockInstance: mock,
  };
}
