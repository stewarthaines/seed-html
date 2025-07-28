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

import type { OPFDocument, ManifestItem, SpineItem, EPUBMetadata } from '../../epub/opf-utils.js';
import type { IWorkspaceManager } from '../../workspace/types.js';

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
export class MockWorkspaceManager implements IWorkspaceManager {
  private workspaceOPFs = new Map<string, MockOPFDocument>();
  private workspaceFiles = new Map<string, Map<string, string | ArrayBuffer>>();
  private failureMode: WorkspaceFailureMode | null = null;
  private operationCount = 0;
  private rollbackStack: Array<() => void> = [];

  constructor() {
    this.reset();
  }

  // IWorkspaceManager interface implementation

  async init(): Promise<void> {
    this.operationCount++;
    // Mock initialization - no actual work needed
  }

  async listWorkspacesWithMetadata(): Promise<any[]> {
    this.operationCount++;
    const workspaces = Array.from(this.workspaceOPFs.keys()).map(id => ({
      id,
      title: this.workspaceOPFs.get(id)?.metadata?.title || 'Mock Workspace',
      author: this.workspaceOPFs.get(id)?.metadata?.creator?.[0] || 'Test Author',
      language: this.workspaceOPFs.get(id)?.metadata?.language || 'en',
      lastModified: new Date(),
      fileCount: 5,
      totalSize: 1024,
      epubVersion: 'EPUB 3.0',
    }));
    return workspaces;
  }

  async startLoadingWorkspaces(): Promise<void> {
    this.operationCount++;
    // Mock non-blocking loading - nothing to do since this is a mock
  }

  // Reactive store getters for mock compatibility
  get workspaces(): any {
    // Return a mock store-like object
    return {
      subscribe: (callback: (workspaces: any[]) => void) => {
        // Immediately call with current workspaces
        const workspaces = Array.from(this.workspaceOPFs.keys()).map(id => ({
          id,
          title: this.workspaceOPFs.get(id)?.metadata?.title || 'Mock Workspace',
          author: this.workspaceOPFs.get(id)?.metadata?.creator?.[0] || 'Test Author',
          language: this.workspaceOPFs.get(id)?.metadata?.language || 'en',
          lastModified: new Date(),
          fileCount: 5,
          totalSize: 1024,
          epubVersion: 'EPUB 3.0',
        }));
        callback(workspaces);
        return () => {}; // Unsubscribe function
      }
    };
  }

  get isLoadingWorkspaces(): any {
    // Return a mock store-like object
    return {
      subscribe: (callback: (loading: boolean) => void) => {
        callback(false); // Mock always not loading
        return () => {}; // Unsubscribe function
      }
    };
  }

  get hasStartedLoadingWorkspaces(): boolean {
    return true; // Mock always started loading
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

  async createEPUBWorkspace(metadata: EPUBMetadata): Promise<string> {
    this.operationCount++;
    const workspaceId = `workspace-${crypto.randomUUID()}`;
    
    // Create OPF document with metadata
    const opf: MockOPFDocument = {
      manifest: [],
      spine: [],
      metadata
    };
    
    this.workspaceOPFs.set(workspaceId, opf);
    this.ensureWorkspace(workspaceId);
    
    return workspaceId;
  }

  async createLocalizedEPUBWorkspace(metadata: Partial<EPUBMetadata>, locale: string): Promise<string> {
    this.operationCount++;
    const workspaceId = `workspace-localized-${crypto.randomUUID()}`;
    
    // Build complete metadata with defaults and locale
    const fullMetadata: EPUBMetadata = {
      title: metadata.title || 'Untitled',
      language: metadata.language || locale,
      identifier: metadata.identifier || `urn:uuid:${crypto.randomUUID()}`,
      creator: metadata.creator || [],
      ...metadata
    };
    
    // Create OPF document with metadata
    const opf: MockOPFDocument = {
      manifest: [],
      spine: [],
      metadata: fullMetadata
    };
    
    this.workspaceOPFs.set(workspaceId, opf);
    this.ensureWorkspace(workspaceId);
    
    return workspaceId;
  }

  async switchWorkspace(workspaceId: string): Promise<any> {
    this.operationCount++;
    if (this.failureMode === 'workspace-not-found') {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    
    // Return mock workspace info
    return {
      id: workspaceId,
      title: 'Mock Workspace',
      author: 'Test Author',
      language: 'en',
      lastModified: new Date(),
      fileCount: 5,
      totalSize: 1024,
      epubVersion: '3.0'
    };
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    this.operationCount++;
    if (this.failureMode === 'workspace-not-found') {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    
    this.workspaceOPFs.delete(workspaceId);
    this.workspaceFiles.delete(workspaceId);
  }

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

  async addManifestItem(workspaceId: string, item: Partial<ManifestItem>): Promise<ManifestItem> {
    this.operationCount++;
    if (this.failureMode === 'manifest-add') {
      throw new Error('Failed to add manifest item');
    }

    const opf = (await this.getWorkspaceOPF(workspaceId)) as MockOPFDocument;

    // Build complete ManifestItem from partial
    const fullItem: ManifestItem = {
      id: item.id || `item-${crypto.randomUUID()}`,
      href: item.href || 'untitled.xhtml',
      mediaType: item.mediaType || 'application/xhtml+xml',
      ...item
    };

    // Check for duplicate IDs
    if (opf.manifest.some(existing => existing.id === fullItem.id)) {
      throw new Error(`Manifest item with ID '${fullItem.id}' already exists`);
    }

    // Store rollback operation
    this.rollbackStack.push(() => {
      const index = opf.manifest.findIndex(m => m.id === fullItem.id);
      if (index !== -1) {
        opf.manifest.splice(index, 1);
      }
    });

    opf.manifest.push(fullItem);
    return fullItem;
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

  async updateWorkspaceOPF(workspaceId: string, opf: OPFDocument): Promise<void> {
    // This is the new method name that replaces saveOPF
    return this.saveOPF(workspaceId, opf as MockOPFDocument);
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

  // Metadata operations
  async getWorkspaceMetadata(workspaceId: string): Promise<EPUBMetadata> {
    this.operationCount++;
    const opf = await this.getWorkspaceOPF(workspaceId);
    return opf.metadata || {
      title: 'Untitled',
      language: 'en',
      identifier: `urn:uuid:${crypto.randomUUID()}`,
      creator: []
    };
  }

  async updateMetadata(workspaceId: string, metadata: EPUBMetadata): Promise<void> {
    this.operationCount++;
    const opf = await this.getWorkspaceOPF(workspaceId);
    opf.metadata = metadata;
    await this.updateWorkspaceOPF(workspaceId, opf);
  }

  // Validation and utilities
  async validateWorkspaceStructure(workspaceId: string): Promise<any> {
    this.operationCount++;
    if (this.failureMode === 'workspace-not-found') {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    
    return {
      isValid: true,
      errors: [],
      warnings: [],
      summary: {
        totalFiles: 5,
        validFiles: 5,
        missingFiles: 0,
        orphanedFiles: 0
      }
    };
  }

  async getWorkspacePathInfo(workspaceId: string): Promise<any> {
    this.operationCount++;
    if (this.failureMode === 'workspace-not-found') {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    
    return {
      rootfilePath: 'OEBPS/content.opf',
      basePath: 'OEBPS',
      opfFileName: 'content.opf'
    };
  }

  async cleanupOrphanedWorkspaces(): Promise<{ cleaned: string[]; errors: string[] }> {
    this.operationCount++;
    return {
      cleaned: [],
      errors: []
    };
  }

  async generateWorkspacePreview(workspaceId: string): Promise<any> {
    this.operationCount++;
    if (this.failureMode === 'workspace-not-found') {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    
    const metadata = await this.getWorkspaceMetadata(workspaceId);
    return {
      metadata,
      manifestSummary: {
        textItems: 3,
        imageItems: 1,
        audioItems: 0,
        videoItems: 0,
        fontItems: 0,
        otherItems: 1
      },
      spineOrder: ['chapter1', 'chapter2'],
      estimatedEPUBSize: 1024,
      dependencies: {
        orphanedFiles: [],
        missingDependencies: [],
        circularReferences: []
      }
    };
  }

  // Test utility methods

  /**
   * Set up a workspace with test OPF data
   * @param workspaceId - Target workspace
   * @param opf - OPF document to set
   */
  setWorkspaceOPF(workspaceId: string, opf: Partial<MockOPFDocument>): void {
    const fullOPF: MockOPFDocument = {
      manifest: opf.manifest !== undefined ? opf.manifest : [],
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

