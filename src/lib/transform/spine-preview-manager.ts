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
import {
  generateXHTMLDocument,
  serializeInnerXHTML,
  serializeElementAttributes,
} from './xhtml-template.js';
import { primaryLanguage } from '../epub/opf-utils.js';
import { DEFAULT_FXL_VIEWPORT } from '../epub/fixed-layout.js';
import { readChapterMeta } from '../spine/chapter-metadata.js';
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
 * Content-derived OPF manifest properties this app reconciles from a rendered
 * chapter, mapped to the CSS selector that detects them. `scripted` is NOT here:
 * it's owned by a separate blanket JS-file toggle (WorkspaceService), not content.
 */
const CONTENT_DERIVED_PROPERTIES: ReadonlyArray<{ token: string; selector: string }> = [
  { token: 'svg', selector: 'svg' },
  { token: 'mathml', selector: 'math' },
];

/**
 * Given a chapter's rendered XHTML and its current manifest `properties`, return
 * the desired `properties` array with the content-derived tokens (`svg`, `mathml`)
 * reconciled — added when the element is present, removed when absent — while
 * every other token is preserved in place. Returns `null` when nothing would
 * change (so callers can skip the write) or when parsing fails (fail-safe: never
 * mutate properties on a parse error).
 *
 * Parsing uses `text/html`, which resolves `<svg>`/`<math>` foreign content by
 * local name and is safe under the unit test's happy-dom environment (unlike
 * namespaced application/xml).
 */
export function deriveContentProperties(xhtml: string, current: string[]): string[] | null {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xhtml, 'text/html');
  } catch (error) {
    console.warn('Failed to parse XHTML for manifest-property detection:', error);
    return null;
  }

  const ownedTokens = CONTENT_DERIVED_PROPERTIES.map(p => p.token);
  // Preserve existing order and all non-owned tokens; flip only the owned ones.
  const next = current.filter(p => !ownedTokens.includes(p));
  for (const { token, selector } of CONTENT_DERIVED_PROPERTIES) {
    if (doc.querySelectorAll(selector).length > 0) next.push(token);
  }

  const unchanged = next.length === current.length && next.every(p => current.includes(p));
  return unchanged ? null : next;
}

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
  // Reports a manifest change back to the app so the single source of truth
  // (appState.workspace) stays current — otherwise the derived property is
  // written only to a detached workspace copy and gets clobbered by the next
  // full-OPF save. Optional: batch/throwaway callers refresh live state themselves.
  private readonly onWorkspaceUpdate?: (workspace: WorkspaceState) => void;

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
    spineItem?: any,
    onWorkspaceUpdate?: (workspace: WorkspaceState) => void
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
    this.onWorkspaceUpdate = onWorkspaceUpdate;

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
      } catch {
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
   * Run a generator on demand and return the produced source text (to insert at the
   * editor caret). Supplies the same brokered file-access context as a transform run
   * (workspace manifest + base path), scoped to the active chapter via spineItemId.
   */
  async runGenerator(script: string, options: Record<string, unknown>): Promise<string> {
    let brokerContext: { basePath: string; manifest: ManifestItem[] } | undefined;
    try {
      const workspace = await this.workspaceService.loadWorkspace(this.workspaceId);
      brokerContext = {
        basePath: workspace.pathInfo.basePath,
        manifest: workspace.opf.manifest,
      };
    } catch {
      brokerContext = undefined;
    }
    return this.transformPipeline.executeGenerator(
      script,
      options,
      this.spineItemId,
      brokerContext
    );
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

      // Step 2: Execute transform pipeline. Supply the workspace's manifest +
      // base path so transform scripts get the brokered file-access ctx (read
      // manifest items, read/write SOURCE/data/). loadWorkspace is cached, so this
      // doesn't add a real fetch to the per-keystroke render path.
      let brokerContext: { basePath: string; manifest: ManifestItem[] } | undefined;
      try {
        const workspace = await this.workspaceService.loadWorkspace(this.workspaceId);
        brokerContext = {
          basePath: workspace.pathInfo.basePath,
          manifest: workspace.opf.manifest,
        };
      } catch {
        // Without workspace context, transforms still run — just without ctx file access.
        brokerContext = undefined;
      }

      const transformResult = await this.transformPipeline.executeTransform(
        this.currentContent.text,
        this.config.transformTimeout,
        this.spineItemId,
        brokerContext
      );

      if (!transformResult.success) {
        this.handleError('transform', transformResult.error);
        return;
      }

      // Step 3: Auto-generate metadata and create final XHTML document.
      // The transform engine returns a full <body> element; extract its inner
      // HTML (so the shared template wraps it consistently) AND its attributes
      // (so a class/data-* a DOM transform set on <body> survives).
      const metadata = await this.generateChapterMetadata();
      const { content, bodyAttributes } = this.extractBody(transformResult.html || '');
      const xhtml = generateXHTMLDocument(content, metadata, bodyAttributes);

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
      const spineItemPath = this.resolveManifestPath(
        manifestItem.href,
        workspace.pathInfo.basePath
      );

      await this.workspaceService.writeFile(this.workspaceId, spineItemPath, xhtml);

      // Analyze XHTML for content-derived manifest properties (svg, mathml)
      await this.updateContentProperties(xhtml, workspace, manifestItem);
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
   * Reconcile the content-derived manifest properties (`svg`, `mathml`) on the
   * chapter's manifest item against the rendered XHTML, and propagate the change
   * back to the app's live workspace state via `onWorkspaceUpdate`.
   *
   * Only these two tokens are owned here — any other properties (notably the
   * blanket `scripted` toggle, plus `nav`/`cover-image`) are preserved untouched.
   * The write goes through `updateManifestItem` so it persists to the OPF; its
   * returned workspace is the corrected single source of truth and must reach
   * `appState.workspace`, or the next full-OPF save overwrites this change.
   */
  private async updateContentProperties(
    xhtml: string,
    workspace: WorkspaceState,
    manifestItem: ManifestItem
  ): Promise<void> {
    try {
      // Only content documents carry these properties.
      if (manifestItem.mediaType !== 'application/xhtml+xml') {
        return;
      }

      const current = manifestItem.properties ?? [];
      const next = deriveContentProperties(xhtml, current);
      if (next === null) return; // unchanged (or parse failed) → no write, no callback

      const updated = await this.workspaceService.updateManifestItem(workspace, this.spineItemId, {
        properties: next.length > 0 ? next : undefined,
      });
      this.onWorkspaceUpdate?.(updated);
    } catch (error) {
      console.warn('Failed to update content-derived manifest properties:', error);
    }
  }

  /**
   * Auto-generate chapter metadata from workspace configuration
   */
  private async generateChapterMetadata(): Promise<ChapterMetadata> {
    // Title: the authored chapter title from the sidecar (SOURCE/text/{id}.json),
    // falling back to the spine item id when none has been set.
    const meta = await readChapterMeta(this.fileStorage, this.workspaceId, this.spineItemId);
    const title = meta.title?.trim() || this.spineItemId;
    // Reflowable default; replaced with the fixed-layout viewport below when the
    // publication is pre-paginated.
    let viewport = 'width=device-width, initial-scale=1.0';

    // Language: get from workspace EPUB metadata (fallback to 'en')
    let language = 'en';
    try {
      const workspace = await this.workspaceService.loadWorkspace(this.workspaceId);
      language = primaryLanguage(workspace?.opf?.metadata) || 'en';
    } catch (error) {
      console.warn('Could not load workspace language, using default:', error);
    }

    // Auto-discover CSS and JS files from manifest
    const stylesheets: string[] = [];
    const scripts: string[] = [];
    try {
      const workspace = await this.workspaceService.loadWorkspace(this.workspaceId);

      // Fixed-layout publications carry a single package-level viewport
      // (rendition:viewport); fall back to the shared default if it is absent.
      if (workspace.opf.metadata.renditionLayout === 'pre-paginated') {
        viewport = workspace.opf.metadata.renditionViewport || DEFAULT_FXL_VIEWPORT;
      }

      // Stylesheets: filter CSS files from manifest
      workspace.opf.manifest
        .filter(item => item.mediaType === 'text/css')
        .forEach(item => {
          stylesheets.push(item.href); // Use manifest href directly - already relative to OPF
        });

      // Scripts: filter JS files from manifest
      workspace.opf.manifest
        .filter(
          item =>
            item.mediaType === 'text/javascript' || item.mediaType === 'application/javascript'
        )
        .forEach(item => {
          scripts.push(item.href); // Use manifest href directly - already relative to OPF
        });
    } catch {
      // No CSS/JS files found, that's okay
    }

    return {
      title,
      language,
      stylesheets,
      scripts,
      viewport,
    };
  }

  /**
   * Split the transform engine's <body> output into the inner content (to wrap in
   * the shared template) and the body's own attributes (so a class/data-* a DOM
   * transform set on <body> survives into the output). Uses DOMParser rather than
   * string surgery (per codebase parsing preferences).
   */
  private extractBody(html: string): { content: string; bodyAttributes: string } {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc.body) return { content: html, bodyAttributes: '' };
    // Serialize as XHTML so void elements (<br/>, <hr/>, <img/>) stay
    // self-closed; reading innerHTML would emit HTML-style <br>, which breaks
    // the application/xhtml+xml document the shared template produces.
    return {
      content: serializeInnerXHTML(doc.body),
      bodyAttributes: serializeElementAttributes(doc.body),
    };
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
  spineItem?: any,
  onWorkspaceUpdate?: (workspace: WorkspaceState) => void
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
    spineItem,
    onWorkspaceUpdate
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
