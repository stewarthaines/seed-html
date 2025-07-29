/**
 * WorkspaceManager Class
 *
 * Core workspace operations and OPF management with integrated EPUB content handling.
 */

import { FileStorageAPI } from '../storage/index.js';
import { OPFUtils } from '../epub/index.js';
import { ReactiveWorkspaceCache } from './workspace-cache.js';
import { ManifestDependencyTracker } from './dependency-tracker.js';
import { SourceManager } from '../source/index.js';
import { SampleContentGenerator } from '../content/sample-content-generator.js';
import { TransformExecutor } from '../transform/transform-executor.js';
import { i18nService } from '../i18n/index.js';
import pageCSS from '../../assets/universal/page.css?raw';
import transformTextJS from '../../assets/universal/transformText.js?raw';
import transformDomJS from '../../assets/universal/transformDom.js?raw';
import type {
  WorkspaceInfo,
  ValidationResult,
  WorkspacePreview,
  WorkspaceConfig,
  WorkspacePathInfo,
  ValidationIssue,
  ValidationWarning,
} from './types.js';
import type { SourceItem } from '../manifest/types.js';
import type { EPUBMetadata, OPFDocument, ManifestItem, SpineItem } from '../epub/opf-utils.js';
import { getMimeType } from '../utils/mime-types.js';
import {
  WorkspaceError,
  ValidationError,
  DEFAULT_WORKSPACE_CONFIG,
  RESERVED_WORKSPACE_IDS,
} from './types.js';

export class WorkspaceManager {
  private storage: FileStorageAPI;
  private cache: ReactiveWorkspaceCache;
  private dependencyTracker: ManifestDependencyTracker;
  private sourceManager: SourceManager;
  private transformExecutor: TransformExecutor;
  private config: WorkspaceConfig;

  constructor(
    storage?: FileStorageAPI,
    config?: Partial<WorkspaceConfig>,
    transformExecutor?: TransformExecutor
  ) {
    this.config = { ...DEFAULT_WORKSPACE_CONFIG, ...config };
    this.storage = storage || FileStorageAPI.getInstance();
    this.cache = new ReactiveWorkspaceCache();
    this.dependencyTracker = new ManifestDependencyTracker(this.storage);
    this.sourceManager = new SourceManager(this.storage);
    this.transformExecutor = transformExecutor || new TransformExecutor();
  }

  /**
   * Initialize the workspace manager
   */
  async init(): Promise<void> {
    if (!this.storage.isInitialized()) {
      await this.storage.init();
    }
  }

  /**
   * Reactive store of all workspaces (auto-updates as workspaces are loaded)
   */
  get workspaces() {
    return this.cache.workspaces;
  }

  /**
   * Reactive store indicating if workspaces are currently loading
   */
  get isLoadingWorkspaces() {
    return this.cache.isLoading;
  }

  /**
   * Check if workspace loading has been started
   */
  get hasStartedLoadingWorkspaces() {
    return this.cache.getHasStartedLoading();
  }

  /**
   * Ensure i18n catalogs are loaded before creating SampleContentGenerator
   */
  private async ensureCatalogsLoaded(): Promise<void> {
    if (!i18nService.isInitialized()) {
      await i18nService.init();
    }
  }

  /**
   * Start non-blocking background loading of all workspaces
   * Uses reactive cache for progressive UI updates
   */
  async startLoadingWorkspaces(): Promise<void> {
    return this.cache.startLoading(this.storage, workspaceId =>
      this.parseWorkspaceMetadata(workspaceId)
    );
  }

  /**
   * Refresh a single workspace in cache by re-parsing its metadata
   */
  async refreshWorkspace(workspaceId: string): Promise<void> {
    return this.cache.refreshWorkspace(workspaceId, id => this.parseWorkspaceMetadata(id));
  }

  /**
   * List all workspaces with metadata (blocking - for backward compatibility)
   * @deprecated Use startLoadingWorkspaces() + reactive workspaces store instead
   */
  async listWorkspacesWithMetadata(): Promise<WorkspaceInfo[]> {
    // If cache hasn't started loading, start it and wait
    if (!this.cache.getHasStartedLoading()) {
      await this.startLoadingWorkspaces();
    }

    // Get current workspaces from cache
    let currentWorkspaces: WorkspaceInfo[] = [];
    this.cache.workspaces.subscribe(workspaces => {
      currentWorkspaces = workspaces;
    })(); // Immediately unsubscribe

    return currentWorkspaces;
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

      // Refresh cache to include the new workspace
      if (this.cache.getHasStartedLoading()) {
        // If cache was already loaded, parse metadata for the new workspace
        const workspaceInfo = await this.parseWorkspaceMetadata(workspaceId);
        this.cache.set(workspaceId, workspaceInfo);
      }

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
   * Create a new EPUB workspace with localized sample content
   */
  async createLocalizedEPUBWorkspace(
    metadata: Partial<EPUBMetadata> = {},
    locale = 'en'
  ): Promise<string> {
    try {
      // Step 1: Create base workspace using existing method
      const fullMetadata: EPUBMetadata = {
        title: metadata.title || 'New EPUB',
        language: metadata.language || locale,
        identifier: metadata.identifier || `epub-${Date.now()}`,
        ...metadata,
      };
      const workspaceId = await this.createEPUBWorkspace(fullMetadata);

      // Step 2: Install universal assets
      await this.installUniversalAssets(workspaceId);

      // Step 3: Generate and install sample content
      await this.generateLocalizedSampleContent(workspaceId, locale);

      // Step 4: Update cache with final workspace state after content generation
      if (this.cache.getHasStartedLoading()) {
        const workspaceInfo = await this.parseWorkspaceMetadata(workspaceId);
        this.cache.set(workspaceId, workspaceInfo);
      }

      return workspaceId;
    } catch (error) {
      console.error('❌ WorkspaceManager.createLocalizedEPUBWorkspace: Failed with error:', error);
      // Clean up on failure
      throw error; // Cleanup is already handled by createEPUBWorkspace
    }
  }

  /**
   * Install universal CSS and transform scripts
   */
  private async installUniversalAssets(workspaceId: string): Promise<void> {
    // Install universal CSS
    await this.storage.writeTextFile(workspaceId, 'OEBPS/Styles/page.css', pageCSS);

    // Install transform scripts
    await this.storage.writeTextFile(
      workspaceId,
      'SOURCE/scripts/transformText.js',
      transformTextJS
    );
    await this.storage.writeTextFile(workspaceId, 'SOURCE/scripts/transformDom.js', transformDomJS);

    // Create settings.json with transform configuration
    const settings = {
      version: '1.0.0',
      transforms: {
        text: {
          script: 'transformText.js',
          enabled: true,
        },
        dom: {
          script: 'transformDom.js',
          enabled: true,
        },
      },
    };

    await this.storage.writeTextFile(
      workspaceId,
      'SOURCE/settings.json',
      JSON.stringify(settings, null, 2)
    );
  }

  /**
   * Generate localized sample content and create EPUB files
   */
  private async generateLocalizedSampleContent(workspaceId: string, locale: string): Promise<void> {
    // Ensure catalogs are loaded before creating SampleContentGenerator
    await this.ensureCatalogsLoaded();

    // Create fresh SampleContentGenerator with loaded catalogs
    const catalogs = i18nService.getCatalogs();
    const contentGenerator = new SampleContentGenerator(catalogs);

    // Generate sample content
    const sampleContent = await contentGenerator.generateLocalizedContent(locale);

    // Handle both test mock format (flat object) and real API format (LocalizedSampleContent)
    let chapters: any[];
    let isRTL = false;

    if (sampleContent && sampleContent.chapters) {
      // Real API format
      chapters = sampleContent.chapters;
      isRTL = sampleContent.isRTL || false;
    } else if (sampleContent && typeof sampleContent === 'object') {
      // Test mock format - convert flat object to chapters array
      chapters = Object.entries(sampleContent).map(([filename, content]) => {
        const id = filename.replace('.txt', '');
        return {
          id,
          title: id.charAt(0).toUpperCase() + id.slice(1),
          content: content as string,
          linear: true,
          mediaType: 'application/xhtml+xml',
        };
      });
      isRTL = locale === 'ar' || locale === 'he';
    } else {
      throw new Error('Invalid sample content structure');
    }

    // Create SOURCE text files
    for (const chapter of chapters) {
      await this.storage.writeTextFile(
        workspaceId,
        `SOURCE/text/${chapter.id}.txt`,
        chapter.content
      );
    }

    // Transform text to XHTML and create OEBPS files
    for (const chapter of chapters) {
      try {
        // Execute text transform
        const htmlContent = await this.transformExecutor.executeTextTransform(
          transformTextJS,
          'transformText.js',
          chapter.content,
          {}
        );

        // Create DOM document
        const parser = new DOMParser();
        const docString = `<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>${htmlContent}</body></html>`;
        const doc = parser.parseFromString(docString, 'text/xml');

        // Check for parse errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
          console.error(`  ❌ DOM parsing error for ${chapter.id}:`, parseError.textContent);
          throw new Error(`DOM parsing failed for ${chapter.id}: ${parseError.textContent}`);
        }

        // Execute DOM transform
        const transformedDoc = await this.transformExecutor.executeDOMTransform(
          transformDomJS,
          'transformDom.js',
          doc
        );

        // Extract only the body content from the transformed document
        const bodyElement = transformedDoc.querySelector('body');
        let bodyContent = bodyElement ? bodyElement.outerHTML : '';

        // Generate complete XHTML document
        const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${locale}"${isRTL ? ' dir="rtl"' : ''}>
<head>
  <title>${chapter.title}</title>
  <link rel="stylesheet" type="text/css" href="../Styles/page.css"/>
</head>
${bodyContent}
</html>`;

        await this.storage.writeTextFile(
          workspaceId,
          `OEBPS/Text/${chapter.id}.xhtml`,
          xhtmlContent
        );
      } catch (error) {
        console.error(`  ❌ Failed to process chapter ${chapter.id}:`, error);
        throw error;
      }
    }

    // Create navigation document
    await this.createNavigationDocument(workspaceId, chapters, locale, isRTL);

    // Update manifest and spine
    await this.updateManifestAndSpine(workspaceId, chapters);
  }

  /**
   * Create localized navigation document
   */
  private async createNavigationDocument(
    workspaceId: string,
    chapters: any[],
    locale: string,
    isRTL: boolean
  ): Promise<void> {
    const navTitle = i18nService.translate('navigation.title');
    const tocTitle = i18nService.translate('navigation.tableOfContents');

    const chapterLinks = chapters
      .map(chapter => {
        const chapterTitle = i18nService.translate(`content.${chapter.id}`) || chapter.title;
        return `      <li><a href="${chapter.id}.xhtml">${chapterTitle}</a></li>`;
      })
      .join('\n');

    const navContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${locale}"${isRTL ? ' dir="rtl"' : ''}>
<head>
  <title>${navTitle}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${tocTitle}</h1>
    <ol>
${chapterLinks}
    </ol>
  </nav>
</body>
</html>`;

    await this.storage.writeTextFile(workspaceId, 'OEBPS/Text/nav.xhtml', navContent);
  }

  /**
   * Update manifest and spine with generated content
   */
  private async updateManifestAndSpine(workspaceId: string, chapters: any[]): Promise<void> {
    // Add CSS to manifest
    await this.addManifestItem(workspaceId, {
      id: 'page-css',
      href: 'Styles/page.css',
      mediaType: 'text/css',
    });

    // Add navigation document to manifest
    await this.addManifestItem(workspaceId, {
      id: 'nav',
      href: 'Text/nav.xhtml',
      mediaType: 'application/xhtml+xml',
      properties: ['nav'],
    });

    // Add chapters to manifest and spine
    for (const chapter of chapters) {
      await this.addManifestItem(workspaceId, {
        id: chapter.id,
        href: `Text/${chapter.id}.xhtml`,
        mediaType: 'application/xhtml+xml',
      });
    }

    // Update spine order
    const spineItems = chapters.map(chapter => chapter.id);
    await this.updateSpineOrder(workspaceId, spineItems);
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
      this.cache.set(workspaceId, workspaceInfo);

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
   * Delete a workspace with comprehensive cleanup
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    try {
      // Step 1: Invalidate cache first to prevent issues if storage deletion fails
      this.cache.delete(workspaceId);

      // Step 2: Attempt storage deletion
      await this.storage.deleteWorkspace(workspaceId);

      // Step 3: Verify deletion completed successfully
      const remainingWorkspaces = await this.storage.listWorkspaces();
      if (remainingWorkspaces.includes(workspaceId)) {
        throw new Error(`Workspace still exists after deletion attempt`);
      }
    } catch (error) {
      throw new WorkspaceError(
        `Failed to delete workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WORKSPACE_DELETE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Clean up orphaned and corrupted workspaces
   * This method identifies and removes workspaces that cannot be properly loaded
   * Excludes reserved workspace IDs used internally by the system
   */
  async cleanupOrphanedWorkspaces(): Promise<{ cleaned: string[]; errors: string[] }> {
    const cleaned: string[] = [];
    const errors: string[] = [];

    try {
      const allWorkspaceIds = await this.storage.listWorkspaces();
      // Filter out reserved workspace IDs to avoid cleaning system workspaces
      const workspaceIds = allWorkspaceIds.filter(id => !RESERVED_WORKSPACE_IDS.has(id));

      for (const workspaceId of workspaceIds) {
        try {
          // Attempt to parse workspace metadata
          await this.parseWorkspaceMetadata(workspaceId);
          // If successful, workspace is valid - skip cleanup
        } catch {
          // Workspace is corrupted or orphaned - attempt cleanup
          try {
            await this.deleteWorkspace(workspaceId);
            cleaned.push(workspaceId);
          } catch (cleanupError) {
            errors.push(
              `Failed to clean ${workspaceId}: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`
            );
          }
        }
      }

      return { cleaned, errors };
    } catch (error) {
      throw new WorkspaceError(
        `Failed to cleanup orphaned workspaces: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLEANUP_ERROR'
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
        manifest: opf.manifest.map(item => ({ ...item })),
        spine: opf.spine.map(item => ({ ...item })),
        guide: opf.guide ? opf.guide.map(item => ({ ...item })) : undefined,
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

      // Refresh cache with updated metadata
      if (this.cache.getHasStartedLoading()) {
        await this.refreshWorkspace(workspaceId);
      }
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
   * Add a spine item to the workspace
   */
  async addSpineItem(workspaceId: string, item: SpineItem, insertIndex?: number): Promise<void> {
    try {
      const opf = await this.getWorkspaceOPF(workspaceId);

      // Validate that referenced manifest item exists
      if (!opf.manifest.some(m => m.id === item.idref)) {
        throw new ValidationError(
          `Referenced manifest item not found: ${item.idref}`,
          [`Missing manifest item: ${item.idref}`],
          workspaceId
        );
      }

      // Check for duplicate spine items
      if (opf.spine.some(s => s.idref === item.idref)) {
        throw new ValidationError(
          `Spine item with idref '${item.idref}' already exists`,
          [`Duplicate spine item: ${item.idref}`],
          workspaceId
        );
      }

      const targetIndex = insertIndex ?? opf.spine.length;
      opf.spine.splice(targetIndex, 0, {
        idref: item.idref,
        linear: item.linear ?? true,
        properties: item.properties,
      });

      // Update modification date
      opf.metadata.modifiedDate = new Date().toISOString();

      // Save updated OPF
      await this.updateWorkspaceOPF(workspaceId, opf);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new WorkspaceError(
        `Failed to add spine item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SPINE_UPDATE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Remove a spine item from the workspace
   */
  async removeSpineItem(workspaceId: string, idref: string): Promise<void> {
    try {
      const opf = await this.getWorkspaceOPF(workspaceId);

      const index = opf.spine.findIndex(item => item.idref === idref);
      if (index === -1) {
        throw new ValidationError(
          `Spine item with idref '${idref}' not found`,
          [`Missing spine item: ${idref}`],
          workspaceId
        );
      }

      opf.spine.splice(index, 1);

      // Update modification date
      opf.metadata.modifiedDate = new Date().toISOString();

      // Save updated OPF
      await this.updateWorkspaceOPF(workspaceId, opf);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new WorkspaceError(
        `Failed to remove spine item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SPINE_UPDATE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Check if a file exists in the workspace
   */
  async fileExists(workspaceId: string, path: string): Promise<boolean> {
    try {
      return await this.storage.fileExists(workspaceId, path);
    } catch (error) {
      throw new WorkspaceError(
        `Failed to check file existence: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FILE_ACCESS_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Write a text file to the workspace
   */
  async writeTextFile(workspaceId: string, path: string, content: string): Promise<void> {
    try {
      await this.storage.writeTextFile(workspaceId, path, content);
      // Refresh cache since workspace contents changed
      if (this.cache.getHasStartedLoading()) {
        await this.refreshWorkspace(workspaceId);
      }
    } catch (error) {
      throw new WorkspaceError(
        `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FILE_WRITE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Read a text file from the workspace
   */
  async readTextFile(workspaceId: string, path: string): Promise<string> {
    try {
      return await this.storage.readTextFile(workspaceId, path);
    } catch (error) {
      throw new WorkspaceError(
        `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FILE_READ_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Read a file from the workspace (returns ArrayBuffer for both text and binary content)
   */
  async readFile(workspaceId: string, path: string): Promise<ArrayBuffer> {
    try {
      return await this.storage.readFile(workspaceId, path);
    } catch (error) {
      throw new WorkspaceError(
        `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FILE_READ_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Write a file to the workspace (supports both text and binary content)
   */
  async writeFile(workspaceId: string, path: string, content: string | ArrayBuffer): Promise<void> {
    try {
      // Convert string content to ArrayBuffer if needed
      const bufferContent =
        typeof content === 'string'
          ? (new TextEncoder().encode(content).buffer as ArrayBuffer)
          : content;

      await this.storage.writeFile(workspaceId, path, bufferContent);
      // Refresh cache since workspace contents changed
      if (this.cache.getHasStartedLoading()) {
        await this.refreshWorkspace(workspaceId);
      }
    } catch (error) {
      throw new WorkspaceError(
        `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FILE_WRITE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Delete a file from the workspace
   */
  async deleteFile(workspaceId: string, path: string): Promise<void> {
    try {
      await this.storage.deleteFile(workspaceId, path);
      // Refresh cache since workspace contents changed
      if (this.cache.getHasStartedLoading()) {
        await this.refreshWorkspace(workspaceId);
      }
    } catch (error) {
      throw new WorkspaceError(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FILE_DELETE_ERROR',
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
    const errors: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const files = await this.storage.listFiles(workspaceId);

      // Get workspace path info to handle dynamic OPF locations
      let pathInfo: WorkspacePathInfo;
      try {
        pathInfo = await this.getWorkspacePathInfo(workspaceId);
      } catch {
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
          !file.startsWith('SOURCE/') &&
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

      // Validate SOURCE/ structure if it exists
      try {
        const sourceValidation = await this.sourceManager.validateSourceStructure(workspaceId);
        if (!sourceValidation.isValid) {
          for (const error of sourceValidation.errors) {
            errors.push({
              code: 'INVALID_SOURCE_STRUCTURE',
              message: `SOURCE/ validation error: ${error}`,
              severity: 'error',
            });
          }
        }
        for (const warning of sourceValidation.warnings) {
          warnings.push({
            code: 'SOURCE_STRUCTURE_WARNING',
            message: `SOURCE/ validation warning: ${warning}`,
            severity: 'warning',
          });
        }
      } catch (sourceError) {
        // SOURCE/ validation failed - this is not necessarily an error if no SOURCE/ files exist
        if (files.some(f => f.startsWith('SOURCE/'))) {
          warnings.push({
            code: 'SOURCE_VALIDATION_FAILED',
            message: `Could not validate SOURCE/ structure: ${sourceError instanceof Error ? sourceError.message : 'Unknown error'}`,
            severity: 'warning',
          });
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
          // Check if getFileInfo method exists (for testing)
          if (
            'getFileInfo' in this.storage &&
            typeof (this.storage as any).getFileInfo === 'function'
          ) {
            const stats = await (this.storage as any).getFileInfo(workspaceId, file);
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
          !file.startsWith('SOURCE/') &&
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

    // Directory structure will be created implicitly when files are written to these paths

    // Initialize SOURCE/ directory structure using SourceManager
    await this.sourceManager.initializeSourceStructure(workspaceId);
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
   * Check if advanced mode is enabled for a workspace
   * Advanced mode enables SOURCE file management and enhanced features
   */
  async isAdvancedModeEnabled(workspaceId: string): Promise<boolean> {
    try {
      // Check if SOURCE directory exists and has content
      const sourceFiles = await this.storage.listFiles(workspaceId, 'SOURCE/');
      return sourceFiles.length > 0;
    } catch {
      // If SOURCE directory doesn't exist or can't be accessed, advanced mode is disabled
      return false;
    }
  }

  /**
   * List SOURCE/ files for manifest integration
   */
  async listSourceFiles(workspaceId: string): Promise<SourceItem[]> {
    try {
      const sourceFiles = await this.sourceManager.listSourceFiles(workspaceId);
      // Convert SourceFileInfo to SourceItem format for manifest compatibility
      return sourceFiles.map(fileInfo => ({
        name: fileInfo.path.split('/').pop() || fileInfo.path,
        path: fileInfo.path,
        size: fileInfo.size,
        type: 'file' as const, // Map all to 'file' for SourceItem compatibility
        modified: new Date(), // SourceFileInfo doesn't have modified date, use current date
        mediaType: getMimeType(fileInfo.path), // Add mediaType using existing utility
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get SOURCE/ file content for manifest integration
   */
  async getSourceFile(workspaceId: string, sourcePath: string): Promise<ArrayBuffer | string> {
    // Use the file storage to read SOURCE file content
    return await this.storage.readFile(workspaceId, sourcePath);
  }
}
