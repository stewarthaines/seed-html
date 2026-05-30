/**
 * Enhanced AppState - Clean Service Architecture with Svelte 5 Runes
 *
 * Implements reactive state coordination using $derived and $effect patterns
 * with the new service layer (WorkspaceService, ContentService, SettingsService, EPUBProcessor).
 */

// Svelte 5 runes are globally available in .svelte.ts files
// No explicit import needed for $state, $effect, $derived
import type { FileStorageAPI } from './storage/index.js';
import { WorkspaceService } from './services/workspace/workspace.service.js';
import { ContentService } from './services/content/content.service.js';
import { SettingsService } from './services/settings/settings.service.js';
import { EPUBProcessor } from './services/epub/epub-processor.service.js';
import { AudioClipService } from './audio/audio-clip.service.js';
import type {
  WorkspaceState,
  WorkspaceInfo,
  ChapterContent,
} from './services/workspace/workspace.service.js';
import { creatorName } from './epub/opf-utils.js';
import type {
  GlobalSettings,
  WorkspaceSettings,
  EPUBSettings,
} from './services/settings/settings.service.js';
import type { TransformExecutor } from './transform/transform-executor.js';
import type { TransformEngine } from './infrastructure/transform-engine.js';
import type { ExtensionManager } from './extensions/extension-manager.js';

// Storage keys for workspace state persistence (following navigationStore pattern)
const STORAGE_KEYS = {
  WORKSPACE_ID: 'editme_app_workspace_id',
  SPINE_ITEM_ID: 'editme_app_spine_item_id',
} as const;

interface I18nSystem {
  translate: (key: string, params?: Record<string, any>) => string;
  getCatalogs: () => any;
  isInitialized: () => boolean;
  getCurrentLocale: () => string;
}


interface ThemeStore {
  setTheme: (theme: 'light' | 'dark') => void;
  useSystemPreference: () => void;
  getCurrentTheme: () => string;
}

interface I18nStore {
  setLocale: (locale: string) => void;
  getCurrentLocale: () => string;
}

// Enhanced app state with reactive coordination
export class EnhancedAppState {
  // Infrastructure layer
  private fileStorage: FileStorageAPI;
  private transformEngine: TransformEngine;
  private extensionManager: ExtensionManager;

  // Service layer
  private workspaceService: WorkspaceService;
  private contentService: ContentService;
  private settingsService: SettingsService;
  private epubProcessor: EPUBProcessor;
  private audioClipService: AudioClipService;

  // Core reactive state - single source of truth
  workspace = $state<WorkspaceState | null>(null);
  selectedChapterId = $state<string | null>(null);
  selectedManifestItemId = $state<string | null>(null);

  // UI state
  initialized = $state(false);
  isLoading = $state(false);
  errorMessage = $state<string | null>(null);

  // Settings state
  globalSettings = $state<GlobalSettings | null>(null);
  workspaceSettings = $state<WorkspaceSettings | null>(null);
  epubSettings = $state<EPUBSettings | null>(null);

  constructor(
    fileStorage: FileStorageAPI,
    transformExecutor: TransformExecutor,
    i18nSystem: I18nSystem,
    extensionManager: ExtensionManager,
    themeStore: ThemeStore,
    i18nStore: I18nStore,
    transformEngine: TransformEngine,
    private skipReactiveEffects = false
  ) {
    this.fileStorage = fileStorage;
    this.transformEngine = transformEngine;
    this.extensionManager = extensionManager;
    

    // Initialize services with dependency injection
    // Create services without circular dependencies first
    this.settingsService = new SettingsService(
      fileStorage,
      extensionManager,
      themeStore,
      i18nStore
    );
    this.epubProcessor = new EPUBProcessor(fileStorage);
    this.workspaceService = new WorkspaceService(fileStorage);

    // Create ContentService without dependencies (pure functions only)
    this.contentService = new ContentService(transformExecutor, i18nSystem);

    // Initialize AudioClipService with required dependencies
    this.audioClipService = new AudioClipService(this.fileStorage, this.workspaceService, this.settingsService);

    // Initialize global settings immediately
    this.loadGlobalSettings();

    // Set up reactive effects for state coordination (skip in tests)
    if (!skipReactiveEffects) {
      this.setupReactiveEffects();
    }
  }

  // ============================================================================
  // Computed Properties ($derived)
  // ============================================================================

  // Workspace state derived values
  get hasWorkspace(): boolean {
    return this.workspace !== null;
  }

  get isWorkspaceReady(): boolean {
    return this.initialized && this.workspace !== null;
  }

  get currentWorkspaceId(): string | null {
    return this.workspace?.id || null;
  }

  get workspaceInfo(): WorkspaceInfo | null {
    if (!this.workspace) return null;

    return {
      id: this.workspace.id,
      title: this.workspace.opf.metadata.title,
      language: this.workspace.opf.metadata.language,
      lastModified: new Date(), // Could be enhanced with actual timestamp
      fileCount: this.workspace.opf.manifest.length,
      totalSize: 0, // Could be enhanced with actual size calculation
      author: creatorName(this.workspace.opf.metadata.creator?.[0]) || undefined,
      hasError: false,
      epubVersion: '3.0',
    };
  }

  // Content derived values
  get selectedChapter(): ChapterContent | null {
    if (!this.workspace || !this.selectedChapterId) return null;

    const manifestItem = this.workspace.opf.manifest.find(
      item => item.id === this.selectedChapterId
    );
    if (!manifestItem) return null;

    return {
      id: manifestItem.id,
      href: manifestItem.href,
      xhtmlContent: '', // Will be loaded reactively
      linear: true, // Could be determined from spine
      mediaType: manifestItem.mediaType || 'application/xhtml+xml',
    };
  }

  get navigationItems(): Array<{ id: string; title: string; href: string; order: number }> {
    if (!this.workspace) return [];

    return this.workspace.opf.spine.map((spineItem, index) => {
      const manifestItem = this.workspace!.opf.manifest.find(item => item.id === spineItem.idref);
      return {
        id: spineItem.idref,
        title: manifestItem?.id || `Chapter ${index + 1}`,
        href: manifestItem?.href || '',
        order: index,
      };
    });
  }

  get availableChapters(): Array<{ id: string; title: string; href: string }> {
    if (!this.workspace) return [];

    return this.workspace.opf.manifest
      .filter(item => item.mediaType === 'application/xhtml+xml')
      .map(item => ({
        id: item.id,
        title: item.id, // Could be enhanced with actual title extraction
        href: item.href,
      }));
  }

  // Settings derived values
  get currentTheme(): 'light' | 'dark' | 'system' {
    return this.globalSettings?.theme || 'system';
  }

  get currentLocale(): string {
    return this.globalSettings?.locale || 'en';
  }

  get editorFontSize(): number {
    return this.globalSettings?.editor_font_size || 14;
  }

  get isDraftMode(): boolean {
    return (this.workspaceSettings?.draft_id || 0) > 0;
  }

  get currentDraftId(): number {
    return this.workspaceSettings?.draft_id || 0;
  }

  get isAdvancedMode(): boolean {
    return this.workspaceSettings?.editor?.advanced_mode ?? false;
  }

  // Infrastructure access for components
  getTransformEngine(): TransformEngine {
    return this.transformEngine;
  }

  getContentService(): ContentService {
    return this.contentService;
  }
  getSettingsService(): SettingsService {
    return this.settingsService;
  }

  getAudioClipService(): AudioClipService {
    return this.audioClipService;
  }


  getExtensionManager(): ExtensionManager {
    return this.extensionManager;
  }

  // ============================================================================
  // Reactive Effects ($effect)
  // ============================================================================

  private setupReactiveEffects(): void {
    // Create root effect scope for EnhancedAppState reactive effects
    // This allows $effect to work when created outside component initialization
    $effect.root(() => {
      // Effect: Load workspace settings when workspace changes
      $effect(() => {
        if (this.workspace?.id) {
          this.loadWorkspaceSettings(this.workspace.id);
          this.loadEPUBSettings(this.workspace.id);
        } else {
          this.workspaceSettings = null;
          this.epubSettings = null;
        }
      });

      // Effect: Update error state
      $effect(() => {
        if (this.errorMessage) {
          // Auto-clear error after 5 seconds
          setTimeout(() => {
            this.errorMessage = null;
          }, 5000);
        }
      });

    });
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  async initialize(): Promise<void> {
    try {
      this.isLoading = true;
      this.errorMessage = null;

      // Initialize FileStorageAPI
      if (!this.fileStorage.isInitialized()) {
        await this.fileStorage.init();
      }

      // Restore workspace state from localStorage (following navigationStore pattern)
      await this.restoreWorkspaceState();

      this.initialized = true;
    } catch (error) {
      this.errorMessage = `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Workspace operations
  async listWorkspaces(): Promise<WorkspaceInfo[]> {
    try {
      this.isLoading = true;
      this.errorMessage = null;

      const workspaces = await this.workspaceService.listWorkspaces();
      return workspaces;
    } catch (error) {
      this.errorMessage = `Failed to list workspaces: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load the per-row details (file count, extensions) for a single workspace.
   * Used by the Projects list to fill in each row after the fast initial render.
   */
  async getWorkspaceRowDetails(id: string) {
    return this.workspaceService.getWorkspaceRowDetails(id);
  }

  async createWorkspace(title: string, language: string = 'en'): Promise<string> {
    try {
      this.isLoading = true;
      this.errorMessage = null;

      // Step 1: Create empty workspace
      const workspace = await this.workspaceService.createWorkspace({
        title,
        language,
        identifier: `urn:uuid:${crypto.randomUUID()}`,
      });

      // Step 2: Generate sample content data (pure function - no file I/O)
      const sampleContentData = await this.contentService.generateSampleContentData(language);

      // Step 3: Populate workspace with sample content (file I/O operation)
      const populatedWorkspace = await this.workspaceService.populateWithContent(
        workspace.id,
        sampleContentData
      );

      // Set the newly created workspace
      this.workspace = populatedWorkspace;

      return workspace.id;
    } catch (error) {
      this.errorMessage = `Failed to create workspace: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async loadWorkspace(workspaceId: string): Promise<void> {
    try {
      this.isLoading = true;
      this.errorMessage = null;

      this.workspace = await this.workspaceService.loadWorkspace(workspaceId);

      // Clear selections when loading new workspace
      this.selectedChapterId = null;
      this.selectedManifestItemId = null;

      // Persist workspace state to localStorage (following navigationStore pattern)
      this.persistWorkspaceId(workspaceId);
    } catch (error) {
      this.errorMessage = `Failed to load workspace: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async saveWorkspace(): Promise<void> {
    if (!this.workspace) {
      throw new Error('No workspace to save');
    }

    try {
      this.isLoading = true;
      this.errorMessage = null;

      this.workspace = await this.workspaceService.saveWorkspace(this.workspace);
    } catch (error) {
      this.errorMessage = `Failed to save workspace: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    try {
      this.isLoading = true;
      this.errorMessage = null;

      await this.workspaceService.deleteWorkspace(workspaceId);

      // Clear current workspace if it was deleted
      if (this.workspace?.id === workspaceId) {
        this.workspace = null;
        this.selectedChapterId = null;
        this.selectedManifestItemId = null;
        // Clear persisted state when current workspace is deleted
        this.clearPersistedState();
      }
    } catch (error) {
      this.errorMessage = `Failed to delete workspace: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Selection methods
  selectChapter(chapterId: string | null): void {
    this.selectedChapterId = chapterId;
    // Persist spine item selection to localStorage (following navigationStore pattern)
    this.persistSpineItemId(chapterId);
  }

  selectManifestItem(itemId: string | null): void {
    this.selectedManifestItemId = itemId;
  }

  // Content operations
  async generateSampleContent(locale: string = 'en'): Promise<void> {
    if (!this.workspace) {
      throw new Error('No workspace loaded');
    }

    try {
      this.isLoading = true;
      this.errorMessage = null;

      const sampleContent = await this.contentService.generateLocalizedContent(locale);

      // Update workspace metadata with sample content
      this.workspace.opf.metadata = {
        ...this.workspace.opf.metadata,
        ...sampleContent.metadata,
      };

      // Add sample chapters to manifest and spine
      sampleContent.chapters.forEach((chapter, index) => {
        const manifestItem = {
          id: `chapter${index + 1}`,
          href: `Text/${chapter.title}.xhtml`, // Use title instead of filename
          mediaType: 'application/xhtml+xml',
        };

        this.workspace!.opf.manifest.push(manifestItem);
        this.workspace!.opf.spine.push({
          idref: manifestItem.id,
          linear: true,
        });
      });

      // Save the updated workspace
      await this.saveWorkspace();
    } catch (error) {
      this.errorMessage = `Failed to generate sample content: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Settings operations
  private loadGlobalSettings(): void {
    try {
      this.globalSettings = this.settingsService.loadGlobalSettings();
    } catch (error) {
      console.warn('Failed to load global settings:', error);
      this.globalSettings = this.settingsService.getDefaultGlobalSettings();
    }
  }

  updateGlobalSettings(settings: Partial<GlobalSettings>): void {
    if (!this.globalSettings) return;

    const updatedSettings = { ...this.globalSettings, ...settings };

    try {
      this.settingsService.saveGlobalSettings(updatedSettings);
      this.globalSettings = updatedSettings;
    } catch (error) {
      this.errorMessage = `Failed to save global settings: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  async loadWorkspaceSettings(workspaceId: string): Promise<void> {
    try {
      this.workspaceSettings = await this.settingsService.loadWorkspaceSettings(workspaceId);
    } catch (error) {
      console.warn('Failed to load workspace settings:', error);
      this.workspaceSettings = this.settingsService.getDefaultWorkspaceSettings();
    }
  }

  async updateWorkspaceSettings(settings: Partial<WorkspaceSettings>): Promise<void> {
    if (!this.workspace || !this.workspaceSettings) return;

    const updatedSettings = { ...this.workspaceSettings, ...settings };

    try {
      await this.settingsService.saveWorkspaceSettings(this.workspace.id, updatedSettings);
      this.workspaceSettings = updatedSettings;
    } catch (error) {
      this.errorMessage = `Failed to save workspace settings: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  async loadEPUBSettings(workspaceId: string): Promise<void> {
    try {
      this.epubSettings = await this.settingsService.loadEPUBSettings(workspaceId);
    } catch (error) {
      console.warn('Failed to load EPUB settings:', error);
      this.epubSettings = this.settingsService.getDefaultEPUBSettings();
    }
  }

  async updateEPUBSettings(settings: Partial<EPUBSettings>): Promise<void> {
    if (!this.workspace || !this.epubSettings) return;

    const updatedSettings = { ...this.epubSettings, ...settings };

    try {
      await this.settingsService.saveEPUBSettings(this.workspace.id, updatedSettings);
      this.epubSettings = updatedSettings;
    } catch (error) {
      this.errorMessage = `Failed to save EPUB settings: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // Draft mode operations
  async incrementDraftId(): Promise<void> {
    if (!this.workspace) return;

    try {
      const newDraftId = await this.settingsService.incrementDraftId(this.workspace.id);

      if (this.workspaceSettings) {
        this.workspaceSettings.draft_id = newDraftId;
      }

      // Update workspace title with draft info
      const baseTitle = this.settingsService.extractDraftInfo(
        this.workspace.opf.metadata.title
      ).baseTitle;
      this.workspace.opf.metadata.title = this.settingsService.generateDraftTitle(
        baseTitle,
        newDraftId
      );
    } catch (error) {
      this.errorMessage = `Failed to increment draft ID: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // EPUB operations
  async packageEPUB(): Promise<Blob | null> {
    if (!this.workspace) {
      throw new Error('No workspace to package');
    }

    try {
      this.isLoading = true;
      this.errorMessage = null;

      const result = await this.epubProcessor.packageEPUB(this.workspace.id, {
        compressionLevel: 'balanced',
        validateStructure: true,
        progressCallback: progress => {
          // Could emit progress events here
          console.log('Package progress:', progress);
        },
      });

      if (!result.success) {
        throw new Error(result.error || 'Package failed');
      }

      return result.blob || null;
    } catch (error) {
      this.errorMessage = `Failed to package EPUB: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async unpackEPUB(file: File): Promise<string> {
    try {
      this.isLoading = true;
      this.errorMessage = null;

      const result = await this.epubProcessor.unpackEPUB(file, `workspace-${Date.now()}`);

      if (!result.success) {
        throw new Error(result.error || 'Unpack failed');
      }

      const workspaceId = result.workspaceId!;

      // Load the unpacked workspace
      await this.loadWorkspace(workspaceId);

      return workspaceId;
    } catch (error) {
      this.errorMessage = `Failed to unpack EPUB: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // ============================================================================
  // Private Persistence Methods (following navigationStore pattern)
  // ============================================================================

  /**
   * Restore workspace state from localStorage
   */
  private async restoreWorkspaceState(): Promise<void> {
    try {
      // Restore workspace ID
      const savedWorkspaceId = localStorage.getItem(STORAGE_KEYS.WORKSPACE_ID);
      if (savedWorkspaceId) {
        await this.loadWorkspace(savedWorkspaceId);

        // Restore spine item selection after workspace is loaded
        const savedSpineItemId = localStorage.getItem(STORAGE_KEYS.SPINE_ITEM_ID);
        if (savedSpineItemId) {
          this.selectedChapterId = savedSpineItemId;
        }
      }
    } catch (error) {
      // Ignore restoration errors and log warning (like navigationStore)
      console.warn('Failed to restore workspace state:', error);
      // Clear invalid stored state
      this.clearPersistedState();
    }
  }

  /**
   * Persist workspace ID to localStorage
   */
  private persistWorkspaceId(workspaceId: string | null): void {
    try {
      if (workspaceId) {
        localStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, workspaceId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.WORKSPACE_ID);
      }
    } catch (error) {
      console.warn('Failed to persist workspace ID:', error);
    }
  }

  /**
   * Persist spine item ID to localStorage
   */
  private persistSpineItemId(spineItemId: string | null): void {
    try {
      if (spineItemId) {
        localStorage.setItem(STORAGE_KEYS.SPINE_ITEM_ID, spineItemId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.SPINE_ITEM_ID);
      }
    } catch (error) {
      console.warn('Failed to persist spine item ID:', error);
    }
  }

  /**
   * Clear all persisted state
   */
  private clearPersistedState(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.WORKSPACE_ID);
      localStorage.removeItem(STORAGE_KEYS.SPINE_ITEM_ID);
    } catch (error) {
      console.warn('Failed to clear persisted state:', error);
    }
  }

  // Cleanup
  cleanup(): void {
    this.workspace = null;
    this.selectedChapterId = null;
    this.selectedManifestItemId = null;
    this.initialized = false;
    this.isLoading = false;
    this.errorMessage = null;
  }
}
