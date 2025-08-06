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
  AutoSaveResult
} from '../types/spine-editor.js';

/**
 * Preview manager for real-time spine item editing
 */
export class SpinePreviewManager {
  private transformPipeline: SpineTransformPipeline;
  private debounceTimer?: any;
  private currentContent: CurrentContent;
  private isTransforming = false;
  private lastTransformTime = 0;

  constructor(
    private workspaceId: string,
    private spineItemId: string,
    private fileStorage: FileStorageAPI,
    private extensionManager: ExtensionManager,
    private blobURLManager: BlobURLManager,
    private workspaceService: WorkspaceService,
    private settingsService: SettingsService,
    private transformEngine: TransformEngine,
    private config: PreviewManagerConfig,
    private onPreviewUpdate: (event: PreviewUpdateEvent) => void,
    private onError: (event: PreviewErrorEvent) => void,
    private spineItem?: any
  ) {
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
      text: ''
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

      // Show manifest XHTML content immediately (even if transform pipeline isn't ready)
      await this.showManifestContent();
      
      // Then trigger transform pipeline when ready
      this.debounceRender();
    } catch (error) {
      this.handleError('initialization', error);
    }
  }

  /**
   * Show manifest XHTML content immediately using spine item href
   */
  private async showManifestContent(): Promise<void> {
    if (!this.spineItem?.href) {
      // No spine item or href available, skip initial content
      return;
    }

    try {
      // Load the XHTML file using the spine item's href
      const xhtmlContent = await this.fileStorage.readTextFile(
        this.workspaceId,
        this.spineItem.href
      );

      // Process through BlobURLManager to fix asset references
      const processedXhtml = await this.blobURLManager.processXHTMLForPreview(xhtmlContent);

      // Trigger immediate preview update with manifest XHTML
      this.onPreviewUpdate({
        xhtml: processedXhtml,
        warnings: ['Showing current manifest content - will update when transform completes'],
        executionTime: 0,
        timestamp: Date.now()
      });
    } catch (error) {
      // XHTML file doesn't exist yet, that's okay - transform pipeline will create it
      console.info('No existing XHTML found for spine item, will create on first transform');
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
      const xhtml = this.generateXHTML(
        transformResult.html || '',
        metadata
      );

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
        timestamp: Date.now()
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
      errors: []
    };

    // Only auto-save text content (per-chapter)
    // CSS/JS are global assets and handled by SpineView auto-save
    const textFile = {
      path: `SOURCE/text/${this.spineItemId}.txt`,
      content: this.currentContent.text,
      type: 'text'
    };

    if (textFile.content.trim()) { // Only save non-empty text
      try {
        await this.fileStorage.writeTextFile(
          this.workspaceId,
          textFile.path,
          textFile.content
        );
        result.savedFiles.push(textFile.path);
      } catch (error) {
        result.success = false;
        result.errors.push({
          file: textFile.path,
          error: error instanceof Error ? error.message : String(error)
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
      // Save XHTML as the spine item's content in the EPUB structure
      const spineItemPath = `OEBPS/Text/${this.spineItemId}.xhtml`;
      await this.workspaceService.writeFile(
        this.workspaceId,
        spineItemPath,
        xhtml
      );
    } catch (error) {
      // Log manifest save errors but don't block preview
      console.warn('Failed to save XHTML to manifest:', error);
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
    
    // Stylesheets: auto-discover all CSS files from manifest
    const stylesheets: string[] = [];
    try {
      const cssFiles = await this.fileStorage.listFiles(this.workspaceId, 'OEBPS/Styles');
      for (const cssFile of cssFiles) {
        if (cssFile.endsWith('.css')) {
          // Use relative path from OEBPS root
          const relativePath = cssFile.startsWith('OEBPS/') ? cssFile.substring(6) : cssFile;
          stylesheets.push(relativePath);
        }
      }
    } catch (error) {
      // No CSS files found, that's okay
    }
    
    // Scripts: auto-discover all JS files from manifest  
    const scripts: string[] = [];
    try {
      const jsFiles = await this.fileStorage.listFiles(this.workspaceId, 'OEBPS/Scripts');
      for (const jsFile of jsFiles) {
        if (jsFile.endsWith('.js')) {
          // Use relative path from OEBPS root
          const relativePath = jsFile.startsWith('OEBPS/') ? jsFile.substring(6) : jsFile;
          scripts.push(relativePath);
        }
      }
    } catch (error) {
      // No JS files found, that's okay
    }
    
    return {
      title,
      language,
      stylesheets,
      scripts
    };
  }

  /**
   * Generate complete XHTML document with external file references only
   */
  private generateXHTML(
    transformedContent: string,
    metadata: ChapterMetadata
  ): string {
    const stylesheetLinks = metadata.stylesheets
      .map(href => `  <link rel="stylesheet" type="text/css" href="${this.escapeHtml(href)}" />`)
      .join('\n');

    const scriptTags = metadata.scripts
      .map(src => `  <script src="${this.escapeHtml(src)}"></script>`)
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
      stack: error?.stack
    };

    this.onError({
      error: transformError,
      stage,
      timestamp: Date.now()
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
        text: this.currentContent.text.length
      }
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
    persistToManifest: true
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
  persistToManifest: true
};