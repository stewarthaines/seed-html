/**
 * WorkspaceManager Class
 *
 * Core workspace operations and OPF management with integrated EPUB content handling.
 */

import { FileStorageAPI } from '../storage/index.js';
import { OPFUtils } from '../epub/index.js';
import { WorkspaceMetadataCache } from './workspace-cache.js';
import { ManifestDependencyTracker } from './dependency-tracker.js';
import type {
  WorkspaceInfo,
  EPUBMetadata,
  OPFDocument,
  ManifestItem,
  ValidationResult,
  WorkspacePreview,
  WorkspaceConfig,
  WorkspacePathInfo,
  ValidationError as ValidationErrorType,
} from './types.js';
import { WorkspaceError, ValidationError, DEFAULT_WORKSPACE_CONFIG } from './types.js';

export class WorkspaceManager {
  private storage: FileStorageAPI;
  private cache: WorkspaceMetadataCache;
  private dependencyTracker: ManifestDependencyTracker;
  private config: WorkspaceConfig;

  constructor(config?: Partial<WorkspaceConfig>) {
    this.config = { ...DEFAULT_WORKSPACE_CONFIG, ...config };
    this.storage = new FileStorageAPI();
    this.cache = new WorkspaceMetadataCache(this.storage, this.config.cache);
    this.dependencyTracker = new ManifestDependencyTracker(this.storage);
  }

  /**
   * Initialize the workspace manager
   */
  async init(): Promise<void> {
    await this.storage.init();
  }

  /**
   * List all workspaces with metadata, sorted by last modified date
   */
  async listWorkspacesWithMetadata(): Promise<WorkspaceInfo[]> {
    try {
      const workspaceIds = await this.storage.listWorkspaces();
      const workspaceInfos: WorkspaceInfo[] = [];

      for (const workspaceId of workspaceIds) {
        try {
          const cachedInfo = await this.loadCachedMetadata(workspaceId);
          if (cachedInfo && (await this.isCacheFresh(workspaceId, cachedInfo))) {
            workspaceInfos.push(cachedInfo);
          } else {
            // Cache miss/stale - parse OPF and update cache
            const freshInfo = await this.parseWorkspaceMetadata(workspaceId);
            await this.cache.updateCache(workspaceId, freshInfo);
            workspaceInfos.push(freshInfo);
          }
        } catch (error) {
          // Workspace has issues - include with error state
          workspaceInfos.push({
            id: workspaceId,
            title: `Workspace ${workspaceId} (Error)`,
            language: 'unknown',
            lastModified: new Date(),
            fileCount: 0,
            totalSize: 0,
            epubVersion: 'unknown',
            hasError: true,
          });
        }
      }

      return workspaceInfos.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    } catch (error) {
      throw new WorkspaceError(
        `Failed to list workspaces: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STORAGE_ERROR'
      );
    }
  }

  /**
   * Create a new EPUB workspace with proper structure
   */
  async createEPUBWorkspace(metadata: EPUBMetadata): Promise<string> {
    const workspaceId = crypto.randomUUID();

    try {
      // Create workspace directory
      await this.storage.createWorkspace(workspaceId);

      // Create EPUB structure
      await this.createEPUBStructure(workspaceId, metadata);

      // Update cache
      await this.invalidateCache(workspaceId);

      return workspaceId;
    } catch (error) {
      // Clean up on failure
      try {
        await this.storage.deleteWorkspace(workspaceId);
      } catch {
        // Ignore cleanup errors
      }

      throw new WorkspaceError(
        `Failed to create workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WORKSPACE_CREATION_ERROR'
      );
    }
  }

  /**
   * Switch to a workspace and validate its structure
   */
  async switchWorkspace(workspaceId: string): Promise<WorkspaceInfo> {
    try {
      const workspaceInfo = await this.parseWorkspaceMetadata(workspaceId);

      // Validate workspace structure
      const validation = await this.validateWorkspaceStructure(workspaceId);
      if (!validation.isValid) {
        workspaceInfo.hasError = true;
      }

      // Update cache
      await this.cache.updateCache(workspaceId, workspaceInfo);

      return workspaceInfo;
    } catch (error) {
      throw new WorkspaceError(
        `Failed to switch to workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WORKSPACE_NOT_FOUND',
        workspaceId
      );
    }
  }

  /**
   * Delete a workspace
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    try {
      await this.storage.deleteWorkspace(workspaceId);
      await this.invalidateCache(workspaceId);
    } catch (error) {
      throw new WorkspaceError(
        `Failed to delete workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WORKSPACE_DELETE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Get workspace path information from container.xml
   */
  async getWorkspacePathInfo(workspaceId: string): Promise<WorkspacePathInfo> {
    try {
      const containerXml = await this.storage.readTextFile(workspaceId, 'META-INF/container.xml');
      const result = OPFUtils.parseContainerXml(containerXml);

      if (result.error) {
        throw new Error(result.error);
      }

      const rootfilePath = result.rootfilePath!;
      const lastSlashIndex = rootfilePath.lastIndexOf('/');

      if (lastSlashIndex === -1) {
        // OPF file is in root directory
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
      throw new WorkspaceError(
        `Failed to parse workspace container.xml: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INVALID_CONTAINER_STRUCTURE',
        workspaceId
      );
    }
  }

  /**
   * Get parsed OPF document for a workspace
   */
  async getWorkspaceOPF(workspaceId: string): Promise<OPFDocument> {
    try {
      const pathInfo = await this.getWorkspacePathInfo(workspaceId);
      const opfContent = await this.storage.readTextFile(workspaceId, pathInfo.rootfilePath);
      const opf = OPFUtils.parseOPFDocument(opfContent);
      // Create a deep copy to prevent test interference
      return {
        version: opf.version,
        metadata: { ...opf.metadata },
        manifest: [...opf.manifest.map(item => ({ ...item }))],
        spine: [...opf.spine.map(item => ({ ...item }))],
        guide: opf.guide ? [...opf.guide.map(item => ({ ...item }))] : undefined,
      };
    } catch (error) {
      throw new WorkspaceError(
        `Failed to read OPF file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INVALID_OPF_STRUCTURE',
        workspaceId
      );
    }
  }

  /**
   * Update OPF document in workspace
   */
  async updateWorkspaceOPF(workspaceId: string, opf: OPFDocument): Promise<void> {
    try {
      // Validate OPF structure
      const opfXML = OPFUtils.generateOPFXML(opf);
      const validation = OPFUtils.validateXML(opfXML);

      if (!validation.isValid) {
        throw new ValidationError(
          `Invalid OPF structure: ${validation.error || 'Unknown validation error'}`,
          [validation.error || 'Unknown validation error'],
          workspaceId
        );
      }

      // Get dynamic OPF path and write updated OPF
      const pathInfo = await this.getWorkspacePathInfo(workspaceId);
      await this.storage.writeTextFile(workspaceId, pathInfo.rootfilePath, opfXML);

      // Invalidate cache
      await this.invalidateCache(workspaceId);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new WorkspaceError(
        `Failed to update OPF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'OPF_UPDATE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Add a manifest item to the workspace
   */
  async addManifestItem(workspaceId: string, item: Partial<ManifestItem>): Promise<ManifestItem> {
    try {
      const opf = await this.getWorkspaceOPF(workspaceId);

      // Generate ID if not provided
      const id =
        item.id || this.generateManifestId(item.href!, new Set(opf.manifest.map(m => m.id)));

      // Check for duplicate ID
      if (opf.manifest.some(m => m.id === id)) {
        throw new ValidationError(
          `Manifest item with ID '${id}' already exists`,
          [`Duplicate manifest ID: ${id}`],
          workspaceId
        );
      }

      // Detect media type if not provided
      const mediaType = item.mediaType || this.detectMediaType(item.href!);

      const manifestItem: ManifestItem = {
        id,
        href: item.href!,
        mediaType,
        properties: item.properties,
        fallback: item.fallback,
      };

      // Add to manifest
      opf.manifest = [...opf.manifest, manifestItem];

      // Update modification date
      opf.metadata.modifiedDate = new Date().toISOString();

      // Save updated OPF
      await this.updateWorkspaceOPF(workspaceId, opf);

      return manifestItem;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new WorkspaceError(
        `Failed to add manifest item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MANIFEST_UPDATE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Remove a manifest item from the workspace
   */
  async removeManifestItem(workspaceId: string, itemId: string): Promise<void> {
    try {
      const opf = await this.getWorkspaceOPF(workspaceId);

      // Find and remove the item
      const itemIndex = opf.manifest.findIndex(item => item.id === itemId);
      if (itemIndex === -1) {
        throw new ValidationError(
          `Manifest item with ID '${itemId}' not found`,
          [`Missing manifest item: ${itemId}`],
          workspaceId
        );
      }

      opf.manifest.splice(itemIndex, 1);

      // Remove from spine if present
      opf.spine = opf.spine.filter(spineItem => spineItem.idref !== itemId);

      // Update modification date
      opf.metadata.modifiedDate = new Date().toISOString();

      // Save updated OPF
      await this.updateWorkspaceOPF(workspaceId, opf);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new WorkspaceError(
        `Failed to remove manifest item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MANIFEST_UPDATE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Update spine order
   */
  async updateSpineOrder(workspaceId: string, spineItems: string[]): Promise<void> {
    try {
      const opf = await this.getWorkspaceOPF(workspaceId);

      // Validate all spine items exist in manifest
      const manifestIds = new Set(opf.manifest.map(item => item.id));
      const invalidItems = spineItems.filter(id => !manifestIds.has(id));

      if (invalidItems.length > 0) {
        throw new ValidationError(
          `Spine items reference missing manifest items: ${invalidItems.join(', ')}`,
          invalidItems.map(id => `Missing manifest item: ${id}`),
          workspaceId
        );
      }

      // Update spine
      opf.spine = spineItems.map(idref => ({
        idref,
        linear: true,
      }));

      // Update modification date
      opf.metadata.modifiedDate = new Date().toISOString();

      // Save updated OPF
      await this.updateWorkspaceOPF(workspaceId, opf);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new WorkspaceError(
        `Failed to update spine order: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SPINE_UPDATE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Get workspace metadata
   */
  async getWorkspaceMetadata(workspaceId: string): Promise<EPUBMetadata> {
    const opf = await this.getWorkspaceOPF(workspaceId);
    return opf.metadata;
  }

  /**
   * Update workspace metadata
   */
  async updateMetadata(workspaceId: string, metadata: EPUBMetadata): Promise<void> {
    const opf = await this.getWorkspaceOPF(workspaceId);
    opf.metadata = { ...opf.metadata, ...metadata };
    opf.metadata.modifiedDate = new Date().toISOString();
    await this.updateWorkspaceOPF(workspaceId, opf);
  }

  /**
   * Validate workspace structure
   */
  async validateWorkspaceStructure(workspaceId: string): Promise<ValidationResult> {
    const errors: ValidationErrorType[] = [];
    const warnings: ValidationErrorType[] = [];

    try {
      const files = await this.storage.listFiles(workspaceId);

      // Get workspace path info to handle dynamic OPF locations
      let pathInfo: WorkspacePathInfo;
      try {
        pathInfo = await this.getWorkspacePathInfo(workspaceId);
      } catch (error) {
        // If we can't parse container.xml, fall back to default
        pathInfo = {
          rootfilePath: 'OEBPS/content.opf',
          basePath: 'OEBPS',
          opfFileName: 'content.opf',
        };
      }

      // Check required files (using dynamic OPF path)
      const requiredFiles = ['mimetype', 'META-INF/container.xml', pathInfo.rootfilePath];
      for (const requiredFile of requiredFiles) {
        if (!files.includes(requiredFile)) {
          errors.push({
            code: 'MISSING_REQUIRED_FILE',
            message: `Missing required file: ${requiredFile}`,
            file: requiredFile,
            severity: 'error',
          });
        }
      }

      let validFiles = files.length;
      let orphanedFiles = 0;
      let manifestItems: ManifestItem[] = [];

      // Validate OPF if it exists
      if (files.includes(pathInfo.rootfilePath)) {
        try {
          const opf = await this.getWorkspaceOPF(workspaceId);
          manifestItems = opf.manifest;

          // Check manifest items exist (resolve paths correctly)
          for (const item of opf.manifest) {
            const resolvedPath = this.resolveManifestPath(item.href, pathInfo.basePath);
            if (!files.includes(resolvedPath)) {
              errors.push({
                code: 'MISSING_MANIFEST_FILE',
                message: `Manifest references missing file: ${item.href} (resolved to ${resolvedPath})`,
                file: item.href,
                severity: 'error',
              });
              validFiles--;
            }
          }

          // Check spine references
          for (const spineItem of opf.spine) {
            if (!opf.manifest.some(item => item.id === spineItem.idref)) {
              errors.push({
                code: 'INVALID_SPINE_REFERENCE',
                message: `Spine references missing manifest item: ${spineItem.idref}`,
                severity: 'error',
              });
            }
          }
        } catch (error) {
          errors.push({
            code: 'INVALID_OPF_STRUCTURE',
            message: `Invalid OPF file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            file: pathInfo.rootfilePath,
            severity: 'error',
          });
        }
      }

      // Check for orphaned files (with proper path resolution and cache file exclusion)
      const manifestFiles = new Set(
        manifestItems.map(item => this.resolveManifestPath(item.href, pathInfo.basePath))
      );
      const systemFiles = new Set([
        'mimetype',
        'META-INF/container.xml',
        pathInfo.rootfilePath,
        '.workspace-metadata.json', // Exclude cache file
      ]);

      for (const file of files) {
        if (
          !manifestFiles.has(file) &&
          !systemFiles.has(file) &&
          !file.startsWith('EDITME/') &&
          !file.endsWith('.workspace-metadata.json')
        ) {
          orphanedFiles++;
          if (!this.config.validation.allowOrphanedFiles) {
            errors.push({
              code: 'ORPHANED_FILE',
              message: `File not referenced in manifest: ${file}`,
              file,
              severity: this.config.validation.strict ? 'error' : 'warning',
            });
          } else {
            warnings.push({
              code: 'ORPHANED_FILE',
              message: `File not referenced in manifest: ${file}`,
              file,
              severity: 'warning',
            });
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        summary: {
          totalFiles: files.length,
          validFiles,
          missingFiles: errors.filter(e => e.code === 'MISSING_MANIFEST_FILE').length,
          orphanedFiles,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            code: 'VALIDATION_FAILED',
            message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error',
          },
        ],
        warnings: [],
        summary: {
          totalFiles: 0,
          validFiles: 0,
          missingFiles: 0,
          orphanedFiles: 0,
        },
      };
    }
  }

  /**
   * Generate comprehensive workspace preview
   */
  async generateWorkspacePreview(workspaceId: string): Promise<WorkspacePreview> {
    try {
      const opf = await this.getWorkspaceOPF(workspaceId);
      const files = await this.storage.listFiles(workspaceId);

      // Calculate file sizes
      let totalSize = 0;
      for (const file of files) {
        try {
          // Check if getFileStats method exists (for testing)
          if (
            'getFileStats' in this.storage &&
            typeof (this.storage as any).getFileStats === 'function'
          ) {
            const stats = await (this.storage as any).getFileStats(workspaceId, file);
            totalSize += stats.size || 0;
          } else {
            const buffer = await this.storage.readFile(workspaceId, file);
            totalSize += buffer.byteLength;
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Categorize manifest items
      const manifestSummary = {
        textItems: 0,
        imageItems: 0,
        audioItems: 0,
        videoItems: 0,
        fontItems: 0,
        otherItems: 0,
      };

      for (const item of opf.manifest) {
        if (
          item.mediaType.startsWith('application/xhtml+xml') ||
          item.mediaType.startsWith('text/html')
        ) {
          manifestSummary.textItems++;
        } else if (item.mediaType.startsWith('image/')) {
          manifestSummary.imageItems++;
        } else if (item.mediaType.startsWith('audio/')) {
          manifestSummary.audioItems++;
        } else if (item.mediaType.startsWith('video/')) {
          manifestSummary.videoItems++;
        } else if (item.mediaType.startsWith('font/') || item.mediaType.includes('font')) {
          manifestSummary.fontItems++;
        } else {
          manifestSummary.otherItems++;
        }
      }

      // Analyze dependencies
      const referencedFiles = new Set<string>();
      const missingDependencies: string[] = [];

      for (const item of opf.manifest) {
        try {
          const dependencies = await this.dependencyTracker.findDependencies(workspaceId, item);
          for (const dep of dependencies) {
            referencedFiles.add(dep);
            if (!files.includes(dep)) {
              missingDependencies.push(dep);
            }
          }
        } catch {
          // Skip dependency analysis for problematic files
        }
      }

      // Find orphaned files (use path resolution and exclude cache files)
      const pathInfo = await this.getWorkspacePathInfo(workspaceId);
      const manifestFiles = new Set(
        opf.manifest.map(item => this.resolveManifestPath(item.href, pathInfo.basePath))
      );
      const orphanedFiles = files.filter(
        file =>
          !manifestFiles.has(file) &&
          !referencedFiles.has(file) &&
          !file.startsWith('META-INF/') &&
          !file.startsWith('EDITME/') &&
          !file.endsWith('.workspace-metadata.json') &&
          file !== 'mimetype' &&
          file !== pathInfo.rootfilePath
      );

      return {
        metadata: opf.metadata,
        manifestSummary,
        spineOrder: opf.spine.map(item => item.idref),
        estimatedEPUBSize: totalSize,
        dependencies: {
          orphanedFiles,
          missingDependencies,
          circularReferences: [], // TODO: Implement circular reference detection
        },
      };
    } catch (error) {
      throw new WorkspaceError(
        `Failed to generate workspace preview: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PREVIEW_GENERATION_ERROR',
        workspaceId
      );
    }
  }

  // Private helper methods

  /**
   * Resolve manifest href to actual file path
   */
  private resolveManifestPath(href: string, basePath: string): string {
    // If href is already absolute or starts with base path, return as-is
    if (!basePath || href.startsWith(basePath + '/')) {
      return href;
    }

    // If href is relative to base path, prepend base path
    return `${basePath}/${href}`;
  }

  /**
   * Resolve file path to manifest href
   */
  private resolveManifestHref(filePath: string, basePath: string): string {
    // If no base path, return file path as-is
    if (!basePath) {
      return filePath;
    }

    // If file path starts with base path, make it relative
    if (filePath.startsWith(basePath + '/')) {
      return filePath.substring(basePath.length + 1);
    }

    // Otherwise return as-is
    return filePath;
  }

  private async createEPUBStructure(workspaceId: string, metadata: EPUBMetadata): Promise<void> {
    // Create mimetype
    await this.storage.writeTextFile(workspaceId, 'mimetype', 'application/epub+zip');

    // Create META-INF/container.xml
    const containerXML = OPFUtils.generateContainerXML();
    await this.storage.writeTextFile(workspaceId, 'META-INF/container.xml', containerXML);

    // Create initial OPF document
    const opfDocument: OPFDocument = {
      version: '3.0',
      metadata,
      manifest: [],
      spine: [],
    };

    const opfXML = OPFUtils.generateOPFXML(opfDocument);
    await this.storage.writeTextFile(workspaceId, 'OEBPS/content.opf', opfXML);

    // Create directory structure
    const directories = [
      'OEBPS/Text',
      'OEBPS/Images',
      'OEBPS/Styles',
      'OEBPS/Audio',
      'EDITME/src',
      'EDITME/scripts',
    ];

    for (const dir of directories) {
      await this.storage.writeTextFile(workspaceId, `${dir}/.gitkeep`, '');
    }
  }

  private async parseWorkspaceMetadata(workspaceId: string): Promise<WorkspaceInfo> {
    const opf = await this.getWorkspaceOPF(workspaceId);
    const files = await this.storage.listFiles(workspaceId);

    let totalSize = 0;
    for (const file of files) {
      try {
        const buffer = await this.storage.readFile(workspaceId, file);
        totalSize += buffer.byteLength;
      } catch {
        // Skip files that can't be read
      }
    }

    return {
      id: workspaceId,
      title: opf.metadata.title,
      author: opf.metadata.creator?.[0],
      language: opf.metadata.language,
      lastModified: opf.metadata.modifiedDate ? new Date(opf.metadata.modifiedDate) : new Date(),
      fileCount: files.length,
      totalSize,
      epubVersion: `EPUB ${opf.version}`,
    };
  }

  cacheEntryToWorkspaceInfo(entry: any): WorkspaceInfo {
    return {
      id: entry.workspaceId,
      title: entry.metadata.title,
      author: entry.metadata.creator?.[0],
      language: entry.metadata.language,
      lastModified: new Date(entry.lastCacheUpdate),
      fileCount: entry.fileCount,
      totalSize: entry.totalSize,
      epubVersion: entry.epubVersion,
    };
  }

  generateManifestId(href: string, existingIds: Set<string>): string {
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

  detectMediaType(href: string): string {
    const extension = href.split('.').pop()?.toLowerCase() || '';

    const mediaTypeMap: Record<string, string> = {
      // Text content
      xhtml: 'application/xhtml+xml',
      html: 'application/xhtml+xml',
      xml: 'application/xml',
      css: 'text/css',
      js: 'application/javascript',
      txt: 'text/plain',

      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',

      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',

      // Video
      mp4: 'video/mp4',
      webm: 'video/webm',
      ogv: 'video/ogg',

      // Fonts
      ttf: 'font/ttf',
      otf: 'font/otf',
      woff: 'font/woff',
      woff2: 'font/woff2',

      // EPUB specific
      opf: 'application/oebps-package+xml',
      ncx: 'application/x-dtbncx+xml',
    };

    return mediaTypeMap[extension] || 'application/octet-stream';
  }

  /**
   * Load cached metadata for a workspace
   */
  private async loadCachedMetadata(workspaceId: string): Promise<WorkspaceInfo | null> {
    return await this.cache.get(workspaceId);
  }

  /**
   * Check if cached metadata is fresh
   */
  private async isCacheFresh(workspaceId: string, workspaceInfo: WorkspaceInfo): Promise<boolean> {
    const cacheEntry = this.workspaceInfoToCacheEntry(workspaceInfo);
    return await this.cache.isCacheFresh(workspaceId, cacheEntry);
  }

  /**
   * Invalidate cache for a workspace
   */
  private async invalidateCache(workspaceId: string): Promise<void> {
    await this.cache.invalidateCache(workspaceId);
  }
}
