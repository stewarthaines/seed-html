/**
 * Spine Item Preview Manager
 *
 * Coordinates real-time preview updates with 300ms debounce, auto-save workflow,
 * XHTML manifest persistence, and BlobURLManager integration for single-file deployment.
 *
 * Key Features:
 * - Real-time preview with debounced updates (300ms)
 * - Auto-save workflow for blob URL processing
 * - XHTML persistence as spine item content to manifest
 * - Multi-file content management (text, CSS, JavaScript)
 * - Error handling and user feedback
 */

import type { FileStorageAPI } from '../storage/index.js';
import { convertManifestPathToXHTMLPath } from '../epub/path-utils.js';
import type { ExtensionManager } from '../extensions/extension-manager.js';
import type { SettingsService } from '../services/settings/settings.service.js';
import type { WorkspaceService } from '../services/workspace/workspace.service.js';
import type { BlobURLManager } from '../blob-url/blob-url-manager.js';
import { SpineTransformPipeline } from './spine-transform-pipeline.js';
import type { TransformEngine } from '../infrastructure/transform-engine.js';
import type {
  CurrentContent,
  ContentType,
  ChapterMetadata,
  TransformError,
  PreviewManagerConfig,
  PreviewUpdateEvent,
  PreviewErrorEvent,
  AutoSaveResult,
} from '../types/spine-editor.js';
import type { WorkspaceState } from '../services/workspace/workspace.service.js';
import type { ManifestItem } from '../epub/opf-utils.js';

/**
 * Preview manager for real-time spine item editing
 */
export class SpinePreviewManager {
  private transformPipeline: SpineTransformPipeline;
  private debounceTimer?: any;
  private currentContent: CurrentContent;
  private isTransforming = false;
  private lastTransformTime = 0;

  // Workspace-scoped properties (immutable)
  private readonly workspaceId: string;
  private readonly fileStorage: FileStorageAPI;
  private readonly extensionManager: ExtensionManager;
  private readonly blobURLManager: BlobURLManager;
  private readonly workspaceService: WorkspaceService;
  private readonly settingsService: SettingsService;
  private readonly transformEngine: TransformEngine;
  private readonly config: PreviewManagerConfig;
  private readonly onPreviewUpdate: (event: PreviewUpdateEvent) => void;
  private readonly onError: (event: PreviewErrorEvent) => void;

  // Spine-scoped properties (mutable - updated during spine switching)
  private spineItemId: string;
  private spineItem?: any;

  constructor(
    workspaceId: string,
    spineItemId: string,
    fileStorage: FileStorageAPI,
    extensionManager: ExtensionManager,
    blobURLManager: BlobURLManager,
    workspaceService: WorkspaceService,
    settingsService: SettingsService,
    transformEngine: TransformEngine,
    config: PreviewManagerConfig,
    onPreviewUpdate: (event: PreviewUpdateEvent) => void,
    onError: (event: PreviewErrorEvent) => void,
    spineItem?: any
  ) {
    // Initialize workspace-scoped properties (these never change)
    this.workspaceId = workspaceId;
    this.fileStorage = fileStorage;
    this.extensionManager = extensionManager;
    this.blobURLManager = blobURLManager;
    this.workspaceService = workspaceService;
    this.settingsService = settingsService;
    this.transformEngine = transformEngine;
    this.config = config;
    this.onPreviewUpdate = onPreviewUpdate;
    this.onError = onError;

    // Initialize spine-scoped properties (these change during spine switching)
    this.spineItemId = spineItemId;
    this.spineItem = spineItem;
    // Initialize transform pipeline
    this.transformPipeline = new SpineTransformPipeline(
      workspaceId,
      fileStorage,
      extensionManager,
      blobURLManager,
      transformEngine,
      settingsService
    );

    // Initialize content state
    this.currentContent = {
      text: '',
    };

    // Set active workspace for blob URL manager
    this.blobURLManager.setActiveWorkspace(workspaceId);
  }

  /**
   * Initialize the preview manager and ensure transform pipeline is ready
   */
  async initialize(): Promise<void> {
    // Ensure transform pipeline is initialized and ready
    await this.transformPipeline.loadTransformScripts();
  }

  /**
   * Update content from editor (triggers debounced preview update)
   */
  updateContent(type: ContentType, content: string): void {
    this.currentContent[type] = content;
    this.debounceRender();
  }

  /**
   * Load initial content from workspace files
   */
  async loadInitialContent(): Promise<void> {
    try {
      // Load text content only - CSS/JS are handled by SpineView auto-save
      try {
        this.currentContent.text = await this.fileStorage.readTextFile(
          this.workspaceId,
          `SOURCE/text/${this.spineItemId}.txt`
        );
      } catch (error) {
        // File doesn't exist yet, start with empty content
        this.currentContent.text = '';
      }

      // Remove showManifestContent() fallback - force proper text store content flow
      // Trigger transform pipeline directly to expose text store integration issues
      this.debounceRender();
    } catch (error) {
      this.handleError('initialization', error);
    }
  }

  /**
   * Get current content state
   */
  getCurrentContent(): CurrentContent {
    return { ...this.currentContent };
  }

  /**
   * Debounced rendering (300ms like the spike)
   */
  private debounceRender(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.renderPreview();
    }, this.config.debounceMs);
  }

  /**
   * Execute the complete preview rendering workflow
   */
  private async renderPreview(): Promise<void> {
    if (this.isTransforming) {
      // If already transforming, schedule another render
      this.debounceRender();
      return;
    }

    this.isTransforming = true;
    const startTime = performance.now();

    try {
      // Step 1: Auto-save modified content to storage before preview
      if (this.config.autoSave) {
        await this.autoSaveChangedContent();
      }

      // Step 2: Execute transform pipeline
      const transformResult = await this.transformPipeline.executeTransform(
        this.currentContent.text,
        this.config.transformTimeout
      );

      if (!transformResult.success) {
        this.handleError('transform', transformResult.error);
        return;
      }

      // Step 3: Auto-generate metadata and create final XHTML document
      const metadata = await this.generateChapterMetadata();
      const xhtml = this.generateXHTML(transformResult.html || '', metadata);

      // Step 4: Save XHTML as spine item content to manifest
      if (this.config.persistToManifest) {
        await this.saveXHTMLToManifest(xhtml);
      }

      // Step 5: Process XHTML for blob URL substitution (preview only)
      const processedXHTML = await this.blobURLManager.processXHTMLForPreview(xhtml);

      const executionTime = performance.now() - startTime;
      this.lastTransformTime = executionTime;

      // Notify success
      this.onPreviewUpdate({
        xhtml: processedXHTML,
        warnings: transformResult.warnings || [],
        executionTime: Math.round(executionTime),
        timestamp: Date.now(),
      });
    } catch (error) {
      this.handleError('preview', error);
    } finally {
      this.isTransforming = false;
    }
  }

  /**
   * Auto-save changed content to storage for blob URL processing
   * Only saves text content - CSS/JS are saved by SpineView to correct global paths
   */
  private async autoSaveChangedContent(): Promise<AutoSaveResult> {
    const result: AutoSaveResult = {
      success: true,
      savedFiles: [],
      errors: [],
    };

    // Only auto-save text content (per-chapter)
    // CSS/JS are global assets and handled by SpineView auto-save
    const textFile = {
      path: `SOURCE/text/${this.spineItemId}.txt`,
      content: this.currentContent.text,
      type: 'text',
    };

    if (textFile.content.trim()) {
      // Only save non-empty text
      try {
        await this.fileStorage.writeTextFile(this.workspaceId, textFile.path, textFile.content);
        result.savedFiles.push(textFile.path);
      } catch (error) {
        result.success = false;
        result.errors.push({
          file: textFile.path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Save generated XHTML as spine item content to manifest
   */
  private async saveXHTMLToManifest(xhtml: string): Promise<void> {
    try {
      // Load workspace to get proper path info and manifest
      const workspace = await this.workspaceService.loadWorkspace(this.workspaceId);
      
      // Find the current spine item in manifest
      const manifestItem = workspace.opf.manifest.find(item => item.id === this.spineItemId);
      if (!manifestItem) {
        console.warn(`Manifest item not found for spine item: ${this.spineItemId}`);
        return;
      }
      
      // Use existing path resolution logic
      const spineItemPath = this.resolveManifestPath(manifestItem.href, workspace.pathInfo.basePath);
      
      await this.workspaceService.writeFile(this.workspaceId, spineItemPath, xhtml);
      
      // Analyze XHTML for SVG content and update manifest properties
      await this.updateSVGProperty(xhtml, workspace, manifestItem);
    } catch (error) {
      // Log manifest save errors but don't block preview
      console.warn('Failed to save XHTML to manifest:', error);
    }
  }

  /**
   * Resolve manifest href to actual file path (same logic as workspace service)
   */
  private resolveManifestPath(href: string, basePath: string): string {
    if (!basePath || href.startsWith(basePath + '/')) {
      return href;
    }
    return `${basePath}/${href}`;
  }

  /**
   * Detect inline SVG elements in XHTML content
   */
  private detectInlineSVG(xhtml: string): boolean {
    try {
      // Use DOMParser for robust HTML parsing (following codebase preferences)
      const parser = new DOMParser();
      const doc = parser.parseFromString(xhtml, 'text/html');
      
      // Check for any <svg> elements in the document
      const svgElements = doc.querySelectorAll('svg');
      return svgElements.length > 0;
    } catch (error) {
      console.warn('Failed to parse XHTML for SVG detection:', error);
      return false; // Fail safe - don't add property if parsing fails
    }
  }

  /**
   * Update SVG property on manifest item based on XHTML content
   */
  private async updateSVGProperty(
    xhtml: string, 
    workspace: WorkspaceState, 
    manifestItem: ManifestItem
  ): Promise<void> {
    try {
      // Only process XHTML items
      if (manifestItem.mediaType !== 'application/xhtml+xml') {
        return;
      }
      
      const hasSVG = this.detectInlineSVG(xhtml);
      const currentProperties = manifestItem.properties || [];
      const hasSVGProperty = currentProperties.includes('svg');
      
      // Update property if state changed
      if (hasSVG && !hasSVGProperty) {
        // Add svg property
        await this.workspaceService.updateManifestItem(workspace, this.spineItemId, {
          properties: [...currentProperties, 'svg']
        });
      } else if (!hasSVG && hasSVGProperty) {
        // Remove svg property
        const filteredProperties = currentProperties.filter(p => p !== 'svg');
        await this.workspaceService.updateManifestItem(workspace, this.spineItemId, {
          properties: filteredProperties.length > 0 ? filteredProperties : undefined
        });
      }
    } catch (error) {
      console.warn('Failed to update SVG property:', error);
    }
  }

  /**
   * Auto-generate chapter metadata from workspace configuration
   */
  private async generateChapterMetadata(): Promise<ChapterMetadata> {
    // Title: use spine item ID
    const title = this.spineItemId;

    // Language: get from workspace EPUB metadata (fallback to 'en')
    let language = 'en';
    try {
      const workspace = await this.workspaceService.loadWorkspace(this.workspaceId);
      language = workspace?.opf?.metadata?.language || 'en';
    } catch (error) {
      console.warn('Could not load workspace language, using default:', error);
    }

    // Auto-discover CSS and JS files from manifest
    const stylesheets: string[] = [];
    const scripts: string[] = [];
    try {
      const workspace = await this.workspaceService.loadWorkspace(this.workspaceId);
      
      // Stylesheets: filter CSS files from manifest
      workspace.opf.manifest
        .filter(item => item.mediaType === 'text/css')
        .forEach(item => {
          stylesheets.push(item.href); // Use manifest href directly - already relative to OPF
        });

      // Scripts: filter JS files from manifest
      workspace.opf.manifest
        .filter(item => 
          item.mediaType === 'text/javascript' || 
          item.mediaType === 'application/javascript'
        )
        .forEach(item => {
          scripts.push(item.href); // Use manifest href directly - already relative to OPF
        });
    } catch (error) {
      // No CSS/JS files found, that's okay
    }

    return {
      title,
      language,
      stylesheets,
      scripts,
    };
  }

  /**
   * Generate complete XHTML document with external file references only
   */
  private generateXHTML(transformedContent: string, metadata: ChapterMetadata): string {
    const stylesheetLinks = metadata.stylesheets
      .map(
        href =>
          `  <link rel="stylesheet" type="text/css" href="${this.escapeHtml(convertManifestPathToXHTMLPath(href))}" />`
      )
      .join('\n');

    const scriptTags = metadata.scripts
      .map(
        src => `  <script src="${this.escapeHtml(convertManifestPathToXHTMLPath(src))}"></script>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${this.escapeHtml(metadata.language)}" lang="${this.escapeHtml(metadata.language)}">
<head>
  <title>${this.escapeHtml(metadata.title)}</title>
${stylesheetLinks}
${scriptTags}
</head>
<body>
${transformedContent}
</body>
</html>`;
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Handle errors and notify listeners
   */
  private handleError(stage: string, error: any): void {
    const transformError: TransformError = {
      stage,
      message: error?.message || (typeof error === 'string' ? error : 'Unknown error'),
      stack: error?.stack,
    };

    this.onError({
      error: transformError,
      stage,
      timestamp: Date.now(),
    });
  }

  /**
   * Get transform pipeline statistics
   */
  getStats() {
    return {
      isTransforming: this.isTransforming,
      lastTransformTime: this.lastTransformTime,
      contentLength: {
        text: this.currentContent.text.length,
      },
    };
  }

  /**
   * Force immediate preview update (bypasses debounce)
   */
  async forcePreviewUpdate(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    await this.renderPreview();
  }

  /**
   * Set debug mode for transform pipeline
   */
  async setDebugMode(enabled: boolean): Promise<void> {
    try {
      await this.transformPipeline.setDebugMode(enabled);
    } catch (error) {
      console.warn('Failed to set debug mode:', error);
    }
  }

  /**
   * Test transform pipeline connectivity
   */
  async pingTransformPipeline(): Promise<boolean> {
    try {
      await this.transformPipeline.ping({ timestamp: Date.now() });
      return true;
    } catch (error) {
      console.warn('Transform pipeline ping failed:', error);
      return false;
    }
  }

  /**
   * Switch to a different spine item without recreating the manager
   * This maintains workspace-level resources while updating spine-specific context
   */
  async switchToSpineItem(newSpineItemId: string, newSpineItem?: any): Promise<void> {
    // Clear any pending operations
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    // Reset transform state
    this.isTransforming = false;
    this.lastTransformTime = 0;

    // Update spine-scoped context
    this.spineItemId = newSpineItemId;
    this.spineItem = newSpineItem;

    // Reset content state for new spine item
    this.currentContent = {
      text: '',
    };

    // Load initial content for new spine item
    try {
      await this.loadInitialContent();
    } catch (error) {
      console.warn('Failed to load initial content for spine item switch:', error);
      // Continue - this is not critical, content will load on first edit
    }
  }

  /**
   * Cleanup resources when editor is closed
   */
  cleanup(): void {
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    // Cleanup transform pipeline
    this.transformPipeline.cleanup();

    // Cleanup blob URL manager
    this.blobURLManager.cleanup();

    // Reset state
    this.isTransforming = false;
    this.lastTransformTime = 0;
  }
}

/**
 * Factory function to create spine preview manager
 */
export function createSpinePreviewManager(
  workspaceId: string,
  spineItemId: string,
  fileStorage: FileStorageAPI,
  extensionManager: ExtensionManager,
  blobURLManager: BlobURLManager,
  workspaceService: WorkspaceService,
  settingsService: SettingsService,
  transformEngine: TransformEngine,
  config: Partial<PreviewManagerConfig> = {},
  onPreviewUpdate: (event: PreviewUpdateEvent) => void,
  onError: (event: PreviewErrorEvent) => void,
  spineItem?: any
): SpinePreviewManager {
  const defaultConfig: PreviewManagerConfig = {
    debounceMs: 300,
    transformTimeout: 3000,
    autoSave: true,
    persistToManifest: true,
  };

  const finalConfig = { ...defaultConfig, ...config };

  return new SpinePreviewManager(
    workspaceId,
    spineItemId,
    fileStorage,
    extensionManager,
    blobURLManager,
    workspaceService,
    settingsService,
    transformEngine,
    finalConfig,
    onPreviewUpdate,
    onError,
    spineItem
  );
}

/**
 * Default preview manager configuration
 */
export const DEFAULT_PREVIEW_CONFIG: PreviewManagerConfig = {
  debounceMs: 300,
  transformTimeout: 3000,
  autoSave: true,
  persistToManifest: true,
};
