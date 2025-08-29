/**
 * WorkspaceService - Clean Service Architecture Implementation
 *
 * Consolidates workspace lifecycle and EPUB structure management from existing managers
 * following the clean service architecture with single responsibility principle.
 */

import type { FileStorageAPI } from '../../storage/index.js';
import type { EPUBMetadata, OPFDocument, ManifestItem, SpineItem } from '../../epub/opf-utils.js';
import { generateEPUBTimestamp } from '../../epub/opf-utils.js';
import { isSourceFile, classifySourceFile } from '../../source/source-utils.js';
import type { SourceItem } from '../../manifest/types.js';
import { getBrowserLocale } from '../../i18n/locale-config.js';

// Service-specific types
export interface WorkspaceState {
  id: string;
  opf: OPFDocument;
  pathInfo: WorkspacePathInfo;
}

export interface WorkspacePathInfo {
  rootfilePath: string;
  basePath: string;
  opfFileName: string;
}

export interface WorkspaceInfo {
  id: string;
  title: string;
  language: string;
  lastModified: Date;
  fileCount: number;
  totalSize: number;
  author?: string;
  hasError?: boolean;
  epubVersion: string;
  extensionIds?: string[];
}

export interface ChapterContent {
  id: string;
  href: string;
  xhtmlContent: string;
  linear: boolean;
  mediaType: string;
}

// Pure data structure for sample content (no file I/O)
export interface SampleContentData {
  chapters: Array<{
    id: string;
    title: string;
    fileName: string;
    content: string; // Plain text content
    xhtmlContent: string; // Transformed XHTML
  }>;
  assets: Array<{
    path: string;
    content: string;
  }>;
  manifestUpdates: ManifestItem[];
  spineUpdates: SpineItem[];
}

// Service error types
export class WorkspaceServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public workspaceId?: string
  ) {
    super(message);
    this.name = 'WorkspaceServiceError';
  }
}

export class WorkspaceNotFoundError extends WorkspaceServiceError {
  constructor(workspaceId: string) {
    super(
      `Workspace not found: ${workspaceId}. Please check workspace ID.`,
      'WORKSPACE_NOT_FOUND',
      workspaceId
    );
    this.name = 'WorkspaceNotFoundError';
  }
}

export class OPFCorruptedError extends WorkspaceServiceError {
  constructor(workspaceId: string, details: string) {
    super(
      `OPF file corrupted in workspace ${workspaceId}: ${details}. Try reimporting the EPUB.`,
      'OPF_CORRUPTED',
      workspaceId
    );
    this.name = 'OPFCorruptedError';
  }
}

export class ValidationError extends WorkspaceServiceError {
  constructor(
    message: string,
    public context?: any
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    // Context is already assigned via parameter property
  }
}

// Import OPF utilities for internal use
import { OPFUtils } from '../../epub/opf-utils.js';
import { ExtensionManager } from '../../extensions/extension-manager.js';

/**
 * WorkspaceService - Single responsibility for workspace lifecycle and EPUB structure
 */
export class WorkspaceService {
  private extensionManager: ExtensionManager;

  constructor(private fileStorage: FileStorageAPI) {
    this.extensionManager = new ExtensionManager(fileStorage);
  }

  /**
   * Create a new workspace with initial EPUB structure
   */
  async createWorkspace(metadata: EPUBMetadata): Promise<WorkspaceState> {
    // Generate unique workspace ID
    const id = this.generateWorkspaceId();

    // Add automatic timestamps and browser language detection
    const timestampedMetadata: EPUBMetadata = {
      ...metadata,
      // Auto-detect browser language if not provided
      language: metadata.language || getBrowserLocale(),
      modifiedDate: generateEPUBTimestamp(),
    };

    // Create workspace in storage
    await this.fileStorage.createWorkspace(id);

    // Create initial OPF document
    const opf: OPFDocument = {
      version: '3.0',
      metadata: {
        ...timestampedMetadata,
        epubVersion: '3.0',
      },
      manifest: [],
      spine: [],
      guide: [],
    };

    // Generate EPUB structure files
    await this.createEPUBStructure(id, opf);

    // Create workspace state
    const workspaceState: WorkspaceState = {
      id,
      opf,
      pathInfo: {
        rootfilePath: 'OEBPS/content.opf',
        basePath: 'OEBPS',
        opfFileName: 'content.opf',
      },
    };

    return workspaceState;
  }

  /**
   * Populate workspace with sample content data
   * Pure file I/O operation - takes structured data and writes files
   */
  async populateWithContent(
    workspaceId: string,
    sampleData: SampleContentData
  ): Promise<WorkspaceState> {
    // Write all asset files
    for (const asset of sampleData.assets) {
      await this.fileStorage.writeTextFile(workspaceId, asset.path, asset.content);
    }

    // Write all chapter files
    for (const chapter of sampleData.chapters) {
      // Write source text file
      await this.fileStorage.writeTextFile(
        workspaceId,
        `SOURCE/text/${chapter.fileName}`,
        chapter.content
      );

      // Write XHTML file
      await this.fileStorage.writeTextFile(
        workspaceId,
        `OEBPS/Text/${chapter.id}.xhtml`,
        chapter.xhtmlContent
      );
    }

    // Load current workspace to update OPF
    const workspace = await this.loadWorkspace(workspaceId);

    // Update OPF with new manifest and spine items
    const updatedOPF: OPFDocument = {
      ...workspace.opf,
      manifest: [...workspace.opf.manifest, ...sampleData.manifestUpdates],
      spine: [...workspace.opf.spine, ...sampleData.spineUpdates],
    };

    // Write updated OPF
    const opfXML = OPFUtils.generateOPFXML(updatedOPF);
    await this.fileStorage.writeTextFile(workspaceId, workspace.pathInfo.rootfilePath, opfXML);

    // Return updated workspace state
    return {
      ...workspace,
      opf: updatedOPF,
    };
  }

  /**
   * Load complete workspace state from storage
   */
  async loadWorkspace(id: string): Promise<WorkspaceState> {
    try {
      // Check if workspace exists
      const workspaces = await this.fileStorage.listWorkspaces();
      if (!workspaces.includes(id)) {
        throw new WorkspaceNotFoundError(id);
      }

      // Get workspace path info
      const pathInfo = await this.getWorkspacePathInfo(id);

      // Load and parse OPF
      const opfContent = await this.fileStorage.readTextFile(id, pathInfo.rootfilePath);

      let opf: OPFDocument;
      try {
        opf = OPFUtils.parseOPFDocument(opfContent);
      } catch (error) {
        throw new OPFCorruptedError(
          id,
          error instanceof Error ? error.message : 'Unknown parsing error'
        );
      }

      return {
        id,
        opf,
        pathInfo,
      };
    } catch (error) {
      if (error instanceof WorkspaceServiceError) {
        throw error;
      }
      throw new WorkspaceServiceError(
        `Failed to load workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOAD_ERROR',
        id
      );
    }
  }

  /**
   * Save workspace state to storage
   */
  async saveWorkspace(workspace: WorkspaceState): Promise<WorkspaceState> {
    // Save workspace without updating modification timestamp (only updated during EPUB packaging)
    const updatedWorkspace = { ...workspace };

    // Generate and save OPF
    const opfXML = OPFUtils.generateOPFXML(updatedWorkspace.opf);
    await this.fileStorage.writeTextFile(workspace.id, workspace.pathInfo.rootfilePath, opfXML);

    return updatedWorkspace;
  }

  /**
   * Delete workspace and all associated files
   */
  async deleteWorkspace(id: string): Promise<void> {
    try {
      await this.fileStorage.deleteWorkspace(id);
    } catch (error) {
      // Don't throw for non-existent workspaces (idempotent operation)
      if (error instanceof Error && !error.message.includes('not found')) {
        throw new WorkspaceServiceError(
          `Failed to delete workspace: ${error.message}`,
          'DELETE_ERROR',
          id
        );
      }
    }
  }

  /**
   * Update workspace metadata
   */
  async updateMetadata(
    workspace: WorkspaceState,
    updates: Partial<EPUBMetadata>
  ): Promise<WorkspaceState> {
    // Validate updates
    this.validateMetadataUpdates(updates);

    // Create new metadata object to trigger reactivity while preserving workspace reference
    // This allows XML preview to update while preventing loading states in sidebar components
    workspace.opf.metadata = { ...workspace.opf.metadata, ...updates };

    // Save to storage immediately (preserves user requirement for no data loss)
    await this.saveWorkspace(workspace);
    
    // Return same workspace object (not new one) to prevent reactive cascade
    return workspace;
  }

  /**
   * Add manifest item to workspace
   */
  async addManifestItem(
    workspace: WorkspaceState,
    item: Partial<ManifestItem>
  ): Promise<WorkspaceState> {
    // Validate required fields
    if (!item.href) {
      throw new ValidationError('Manifest item must have href');
    }

    // Generate ID if not provided
    const id =
      item.id || this.generateManifestId(item.href, new Set(workspace.opf.manifest.map(m => m.id)));

    // Check for duplicate ID
    if (workspace.opf.manifest.some(m => m.id === id)) {
      throw new ValidationError(`Manifest item with ID '${id}' already exists`);
    }

    // Create manifest item
    const manifestItem: ManifestItem = {
      id,
      href: item.href,
      mediaType: item.mediaType || this.detectMediaType(item.href),
      properties: item.properties,
      fallback: item.fallback,
    };

    // Create updated workspace
    let updatedWorkspace: WorkspaceState = {
      ...workspace,
      opf: {
        ...workspace.opf,
        manifest: [...workspace.opf.manifest, manifestItem],
        metadata: {
          ...workspace.opf.metadata,
          modifiedDate: generateEPUBTimestamp(),
        },
      },
    };

    // Update scripted properties if JavaScript file was added
    if (manifestItem.mediaType === 'text/javascript' || manifestItem.mediaType === 'application/javascript') {
      updatedWorkspace = this.addScriptedPropertiesToChapters(updatedWorkspace);
    }

    // Save to storage
    return await this.saveWorkspace(updatedWorkspace);
  }

  /**
   * Remove manifest item from workspace
   */
  async removeManifestItem(workspace: WorkspaceState, itemId: string): Promise<WorkspaceState> {
    const itemIndex = workspace.opf.manifest.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new ValidationError(`Manifest item with ID '${itemId}' not found`);
    }

    // Get the manifest item before removing it
    const removedItem = workspace.opf.manifest[itemIndex];
    const removingJavaScript = removedItem.mediaType === 'text/javascript' || removedItem.mediaType === 'application/javascript';

    // Delete the actual file using existing path resolution infrastructure
    try {
      const filePath = this.resolveManifestPath(removedItem.href, workspace.pathInfo.basePath);
      await this.fileStorage.deleteFile(workspace.id, filePath);
    } catch (error) {
      // Log warning but don't fail if file doesn't exist
      console.warn(`Failed to delete file for manifest item ${itemId}:`, error);
    }

    // Create updated workspace without the item
    let updatedWorkspace: WorkspaceState = {
      ...workspace,
      opf: {
        ...workspace.opf,
        manifest: workspace.opf.manifest.filter(item => item.id !== itemId),
        spine: workspace.opf.spine.filter(spineItem => spineItem.idref !== itemId), // Remove from spine too
        metadata: {
          ...workspace.opf.metadata,
          modifiedDate: generateEPUBTimestamp(),
        },
      },
    };

    // Update scripted properties if JavaScript file was removed
    if (removingJavaScript) {
      updatedWorkspace = this.addScriptedPropertiesToChapters(updatedWorkspace);
    }

    return await this.saveWorkspace(updatedWorkspace);
  }

  /**
   * Update manifest item properties
   */
  async updateManifestItem(
    workspace: WorkspaceState,
    itemId: string,
    updates: Partial<ManifestItem>
  ): Promise<WorkspaceState> {
    const itemIndex = workspace.opf.manifest.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new ValidationError(`Manifest item with ID '${itemId}' not found`);
    }

    // Get the old item for comparison
    const oldItem = workspace.opf.manifest[itemIndex];

    // Handle file path changes by moving the actual file
    if (updates.href && updates.href !== oldItem.href) {
      const oldFullPath = this.resolveManifestPath(oldItem.href, workspace.pathInfo.basePath);
      const newFullPath = this.resolveManifestPath(updates.href, workspace.pathInfo.basePath);
      
      // Only move if source file exists
      if (await this.fileStorage.fileExists(workspace.id, oldFullPath)) {
        try {
          await this.fileStorage.renameFile(workspace.id, oldFullPath, newFullPath);
        } catch (_error) {
          throw new WorkspaceServiceError(
            `Failed to move file from ${oldItem.href} to ${updates.href}: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
            'FILE_MOVE_ERROR',
            workspace.id
          );
        }
      }
    }

    // Check if media type changed to/from JavaScript
    const oldIsJS = oldItem.mediaType === 'text/javascript' || oldItem.mediaType === 'application/javascript';
    const newIsJS = updates.mediaType === 'text/javascript' || updates.mediaType === 'application/javascript';

    // Update manifest item
    const updatedManifest = [...workspace.opf.manifest];
    updatedManifest[itemIndex] = {
      ...updatedManifest[itemIndex],
      ...updates,
    };

    // Check if ID is being changed and update spine references
    let updatedSpine = workspace.opf.spine;
    if (updates.id && updates.id !== itemId) {
      // Validate new ID doesn't already exist
      if (workspace.opf.manifest.some((item, idx) => idx !== itemIndex && item.id === updates.id)) {
        throw new ValidationError(`Manifest item with ID '${updates.id}' already exists`);
      }

      // Update all spine items that reference the old ID
      updatedSpine = workspace.opf.spine.map(spineItem => 
        spineItem.idref === itemId 
          ? { ...spineItem, idref: updates.id! }
          : spineItem
      );
    }

    // Create updated workspace
    let updatedWorkspace: WorkspaceState = {
      ...workspace,
      opf: {
        ...workspace.opf,
        manifest: updatedManifest,
        spine: updatedSpine,
        metadata: {
          ...workspace.opf.metadata,
          modifiedDate: generateEPUBTimestamp(),
        },
      },
    };

    // Update scripted properties if JavaScript status changed
    if (oldIsJS !== newIsJS) {
      updatedWorkspace = this.addScriptedPropertiesToChapters(updatedWorkspace);
    }

    return await this.saveWorkspace(updatedWorkspace);
  }

  /**
   * Update spine order
   */
  async updateSpineOrder(workspace: WorkspaceState, itemIds: string[]): Promise<WorkspaceState> {
    // Validate all items exist in manifest
    const manifestIds = new Set(workspace.opf.manifest.map(item => item.id));
    const invalidItems = itemIds.filter(id => !manifestIds.has(id));

    if (invalidItems.length > 0) {
      throw new ValidationError(
        `Spine items reference missing manifest items: ${invalidItems.join(', ')}`
      );
    }

    // Create spine items
    const spine: SpineItem[] = itemIds.map(idref => ({ idref }));

    // Create updated workspace
    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      opf: {
        ...workspace.opf,
        spine,
        metadata: {
          ...workspace.opf.metadata,
          modifiedDate: generateEPUBTimestamp(),
        },
      },
    };

    return await this.saveWorkspace(updatedWorkspace);
  }

  /**
   * Add spine item at specific position
   */
  async addSpineItem(
    workspace: WorkspaceState,
    item: SpineItem,
    insertIndex?: number
  ): Promise<WorkspaceState> {
    // Validate that referenced manifest item exists
    if (!workspace.opf.manifest.some(m => m.id === item.idref)) {
      throw new ValidationError(`Referenced manifest item not found: ${item.idref}`);
    }

    // Check for duplicate spine items
    if (workspace.opf.spine.some(s => s.idref === item.idref)) {
      throw new ValidationError(`Spine item with idref '${item.idref}' already exists`);
    }

    // Create updated spine
    const updatedSpine = [...workspace.opf.spine];
    const targetIndex = insertIndex ?? updatedSpine.length;
    updatedSpine.splice(targetIndex, 0, item);

    // Create updated workspace
    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      opf: {
        ...workspace.opf,
        spine: updatedSpine,
        metadata: {
          ...workspace.opf.metadata,
          modifiedDate: generateEPUBTimestamp(),
        },
      },
    };

    return await this.saveWorkspace(updatedWorkspace);
  }

  /**
   * Remove spine item
   */
  async removeSpineItem(workspace: WorkspaceState, idref: string): Promise<WorkspaceState> {
    const index = workspace.opf.spine.findIndex(item => item.idref === idref);
    if (index === -1) {
      throw new ValidationError(`Spine item with idref '${idref}' not found`);
    }

    // Create updated workspace
    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      opf: {
        ...workspace.opf,
        spine: workspace.opf.spine.filter(item => item.idref !== idref),
        metadata: {
          ...workspace.opf.metadata,
          modifiedDate: generateEPUBTimestamp(),
        },
      },
    };

    return await this.saveWorkspace(updatedWorkspace);
  }

  /**
   * List all workspaces with summary information
   */
  async listWorkspaces(): Promise<WorkspaceInfo[]> {
    const workspaceIds = await this.fileStorage.listWorkspaces();
    const workspaces: WorkspaceInfo[] = [];

    for (const id of workspaceIds) {
      try {
        const workspace = await this.loadWorkspace(id);
        const files = await this.fileStorage.listFiles(id);
        // Note: totalSize calculation removed for performance - was too expensive
        const totalSize = 0;

        // Get OPF file modification time for workspace last modified timestamp
        let lastModified: Date;
        try {
          const opfFileInfo = await this.fileStorage.getFileInfo(id, workspace.pathInfo.rootfilePath);
          lastModified = opfFileInfo.lastModified;
        } catch (_error) {
          // Fallback to metadata timestamp or current date if file info unavailable
          lastModified = workspace.opf.metadata.modifiedDate
            ? new Date(workspace.opf.metadata.modifiedDate)
            : new Date();
        }

        // Get extension IDs for workspace
        let extensionIds: string[] | undefined;
        try {
          const extensions = await this.extensionManager.listWorkspaceExtensions(id);
          if (extensions.length > 0) {
            extensionIds = extensions.map(ext => ext.name);
          }
        } catch {
          // Extensions are optional, don't fail if they can't be loaded
        }

        workspaces.push({
          id,
          title: workspace.opf.metadata.title,
          language: workspace.opf.metadata.language,
          lastModified,
          fileCount: files.length,
          totalSize,
          author: workspace.opf.metadata.creator?.[0] || undefined,
          hasError: false,
          epubVersion: '3.0',
          extensionIds,
        });
      } catch (_error) {
        // Skip corrupted workspaces
        continue;
      }
    }

    return workspaces;
  }

  /**
   * Check if workspace exists
   */
  async workspaceExists(id: string): Promise<boolean> {
    try {
      const workspaces = await this.fileStorage.listWorkspaces();
      return workspaces.includes(id);
    } catch {
      return false;
    }
  }

  /**
   * Load chapter contents for navigation generation
   */
  async loadChapterContents(
    workspace: WorkspaceState,
    chapterIds: string[]
  ): Promise<ChapterContent[]> {
    const chapters: ChapterContent[] = [];

    for (const id of chapterIds) {
      const manifestItem = workspace.opf.manifest.find(item => item.id === id);
      const spineItem = workspace.opf.spine.find(item => item.idref === id);

      if (!manifestItem || !spineItem) continue;

      try {
        const filePath = this.resolveManifestPath(manifestItem.href, workspace.pathInfo.basePath);
        const xhtmlContent = await this.fileStorage.readTextFile(workspace.id, filePath);

        chapters.push({
          id,
          href: manifestItem.href,
          xhtmlContent,
          linear: spineItem.linear ?? true,
          mediaType: manifestItem.mediaType || 'application/xhtml+xml',
        });
      } catch (_error) {
        // Skip missing files
        continue;
      }
    }

    return chapters;
  }

  /**
   * Load all linear chapter contents
   */
  async loadAllLinearChapterContents(workspace: WorkspaceState): Promise<ChapterContent[]> {
    const linearChapterIds = workspace.opf.spine
      .filter(item => item.linear !== false)
      .map(item => item.idref);

    return this.loadChapterContents(workspace, linearChapterIds);
  }

  // Private helper methods

  private generateWorkspaceId(): string {
    return 'workspace-' + crypto.randomUUID();
  }

  private async createEPUBStructure(id: string, opf: OPFDocument): Promise<void> {
    // Create mimetype
    await this.fileStorage.writeTextFile(id, 'mimetype', 'application/epub+zip');

    // Create container.xml
    const containerXML = OPFUtils.generateContainerXML();
    await this.fileStorage.writeTextFile(id, 'META-INF/container.xml', containerXML);

    // Create OPF file
    const opfXML = OPFUtils.generateOPFXML(opf);
    await this.fileStorage.writeTextFile(id, 'OEBPS/content.opf', opfXML);
  }

  private async getWorkspacePathInfo(workspaceId: string): Promise<WorkspacePathInfo> {
    try {
      const containerXml = await this.fileStorage.readTextFile(
        workspaceId,
        'META-INF/container.xml'
      );
      const result = OPFUtils.parseContainerXml(containerXml);

      if (result.error) {
        throw new Error(result.error);
      }

      const rootfilePath = result.rootfilePath!;
      const lastSlashIndex = rootfilePath.lastIndexOf('/');

      if (lastSlashIndex === -1) {
        return {
          rootfilePath,
          basePath: '',
          opfFileName: rootfilePath,
        };
      }

      const basePath = rootfilePath.substring(0, lastSlashIndex);
      const opfFileName = rootfilePath.substring(lastSlashIndex + 1);

      return { rootfilePath, basePath, opfFileName };
    } catch (error) {
      throw new WorkspaceServiceError(
        `Failed to parse workspace container.xml: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INVALID_CONTAINER_STRUCTURE',
        workspaceId
      );
    }
  }

  private validateMetadataUpdates(updates: Partial<EPUBMetadata>): void {
    // Validate required fields
    if (updates.title !== undefined && updates.title.trim() === '') {
      throw new ValidationError('Title cannot be empty');
    }

    // Validate language code (basic validation)
    if (updates.language !== undefined && !/^[a-z]{2}(-[A-Z]{2})?$/.test(updates.language)) {
      throw new ValidationError('Invalid language code format');
    }
  }

  private addScriptedPropertiesToChapters(workspace: WorkspaceState): WorkspaceState {
    const hasJavaScript = workspace.opf.manifest.some(item => 
      item.mediaType === 'text/javascript' || 
      item.mediaType === 'application/javascript'
    );

    const updatedManifest = workspace.opf.manifest.map(item => {
      // Only update chapter items (XHTML but NOT nav)
      if (item.mediaType === 'application/xhtml+xml' && 
          item.id !== 'nav' && 
          !item.properties?.includes('nav')) {
        
        const properties = item.properties || [];
        const hasScripted = properties.includes('scripted');

        if (hasJavaScript && !hasScripted) {
          // Add scripted property
          return { ...item, properties: [...properties, 'scripted'] };
        } else if (!hasJavaScript && hasScripted) {
          // Remove scripted property
          const filteredProperties = properties.filter(p => p !== 'scripted');
          return { 
            ...item, 
            properties: filteredProperties.length > 0 ? filteredProperties : undefined 
          };
        }
      }
      return item;
    });

    return {
      ...workspace,
      opf: {
        ...workspace.opf,
        manifest: updatedManifest
      }
    };
  }

  private generateManifestId(href: string, existingIds: Set<string>): string {
    // Extract base name from href
    const fileName = href.split('/').pop() || 'item';
    const baseName = fileName.replace(/\.[^.]+$/, ''); // Remove extension

    // Sanitize for XML ID requirements
    const sanitized = baseName
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/^[^a-zA-Z]/, 'item-') // Ensure starts with letter
      .toLowerCase();

    // Ensure uniqueness
    let id = sanitized;
    let counter = 1;
    while (existingIds.has(id)) {
      id = `${sanitized}-${counter++}`;
    }

    return id;
  }

  private detectMediaType(href: string): string {
    const extension = href.split('.').pop()?.toLowerCase() || '';

    const mediaTypeMap: Record<string, string> = {
      xhtml: 'application/xhtml+xml',
      html: 'application/xhtml+xml',
      css: 'text/css',
      js: 'application/javascript',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      mp3: 'audio/mpeg',
      mp4: 'video/mp4',
      ttf: 'font/ttf',
      otf: 'font/otf',
      woff: 'font/woff',
      woff2: 'font/woff2',
    };

    return mediaTypeMap[extension] || 'application/octet-stream';
  }

  private resolveManifestPath(href: string, basePath: string): string {
    if (!basePath || href.startsWith(basePath + '/')) {
      return href;
    }
    return `${basePath}/${href}`;
  }

  /**
   * Check if a file exists in the workspace
   */
  async fileExists(workspaceId: string, filePath: string): Promise<boolean> {
    try {
      await this.fileStorage.readFile(workspaceId, filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rename a file in the workspace
   */
  async renameFile(workspaceId: string, oldPath: string, newPath: string): Promise<void> {
    await this.fileStorage.renameFile(workspaceId, oldPath, newPath);
  }

  /**
   * Read a file from the workspace
   */
  async readFile(workspaceId: string, filePath: string): Promise<ArrayBuffer> {
    try {
      return await this.fileStorage.readFile(workspaceId, filePath);
    } catch (error) {
      throw new WorkspaceServiceError(
        `Failed to read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'READ_FILE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Write a file to the workspace
   */
  async writeFile(workspaceId: string, filePath: string, content: string): Promise<void> {
    try {
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(content);
      // Create a proper ArrayBuffer from the Uint8Array
      const contentBuffer = new ArrayBuffer(uint8Array.length);
      new Uint8Array(contentBuffer).set(uint8Array);
      await this.fileStorage.writeFile(workspaceId, filePath, contentBuffer);
    } catch (error) {
      throw new WorkspaceServiceError(
        `Failed to write file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WRITE_FILE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Write a binary file to the workspace
   */
  async writeBinaryFile(workspaceId: string, filePath: string, content: ArrayBuffer): Promise<void> {
    try {
      await this.fileStorage.writeFile(workspaceId, filePath, content);
    } catch (error) {
      throw new WorkspaceServiceError(
        `Failed to write binary file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WRITE_BINARY_FILE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * List SOURCE files in the workspace for manifest display
   */
  async listSourceFiles(workspace: WorkspaceState): Promise<SourceItem[]> {
    try {
      // Get all files in workspace
      const allFiles = await this.fileStorage.listFiles(workspace.id);

      // Filter for SOURCE files and exclude .gitkeep files
      const sourceFiles = allFiles
        .filter(path => isSourceFile(path))
        .filter(path => !path.endsWith('.gitkeep'));

      const sourceItems: SourceItem[] = [];

      // Create SourceItem objects with metadata
      for (const filePath of sourceFiles) {
        try {
          // Get file size
          const fileInfo = await this.fileStorage.getFileInfo(workspace.id, filePath);

          const sourceItem: SourceItem = {
            path: filePath,
            name: filePath.split('/').pop() || filePath,
            type: 'file',
            size: fileInfo.size,
            modified: fileInfo.lastModified,
            mediaType: this.detectMediaTypeForSource(filePath),
          };

          sourceItems.push(sourceItem);
        } catch {
          // Skip files that can't be accessed (but continue processing others)
          continue;
        }
      }

      return sourceItems;
    } catch (error) {
      throw new WorkspaceServiceError(
        `Failed to list SOURCE files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_SOURCE_FILES_ERROR',
        workspace.id
      );
    }
  }

  /**
   * Detect media type for SOURCE files
   */
  private detectMediaTypeForSource(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    const sourceFileType = classifySourceFile(filePath);

    // Use SOURCE-specific media type detection
    const mediaTypeMap: Record<string, string> = {
      txt: 'text/plain',
      md: 'text/markdown',
      json: 'application/json',
      js: 'application/javascript',
      ts: 'application/typescript',
      css: 'text/css',
      html: 'text/html',
      xhtml: 'application/xhtml+xml',
      xml: 'application/xml',
      py: 'text/x-python',
      sh: 'application/x-sh',
    };

    // For script files, use more specific types
    if (sourceFileType === 'script') {
      return mediaTypeMap[extension] || 'text/plain';
    }

    return mediaTypeMap[extension] || 'text/plain';
  }

  /**
   * Get file information (size and modification date)
   */
  async getFileInfo(workspaceId: string, path: string): Promise<{ size: number; lastModified: Date }> {
    return await this.fileStorage.getFileInfo(workspaceId, path);
  }
}
