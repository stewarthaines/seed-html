import { FileStorageAPI } from './storage';
import { WorkspaceManager } from './workspace';
import type { IWorkspaceManager } from './workspace/types';
import { ManifestManagerImpl } from './manifest/manifest-manager';
import { MetadataManagerImpl } from './metadata/MetadataManager';
import { SpineItemManager } from './spine/spine-item-manager';
import { TransformPipeline } from './transform';
import { BlobURLManager } from './blob-url';
import type { ManifestItem, SourceItem } from './manifest/types';

// New service layer imports
import { WorkspaceService, type WorkspaceState } from './services/workspace/workspace.service.js';
import { MetadataService } from './services/metadata/metadata.service.js';
import { SpineService } from './services/spine/spine.service.js';
import { ContentService } from './services/content/content.service.js';
import { TransformExecutor } from './transform/transform-executor.js';
import { i18nService } from './i18n/index.js';
import {
  type WorkspaceManagerContext,
  type ManifestManagerContext,
  type MetadataManagerContext,
  type WorkspaceIdContext,
} from './contexts';

interface WorkspaceDependencies {
  transformPipeline: TransformPipeline;
  blobURLManager: BlobURLManager;
}

export class AppState {
  // Root-level dependencies (shared across workspaces)
  fileStorageAPI = $state<FileStorageAPI | null>(null);
  currentWorkspaceManager = $state<IWorkspaceManager | null>(null);

  // New service layer (Phase 2 migration)
  workspaceService = $state<WorkspaceService | null>(null);
  metadataService = $state<MetadataService | null>(null);
  spineService = $state<SpineService | null>(null);
  contentService = $state<ContentService | null>(null);
  currentWorkspaceState = $state<WorkspaceState | null>(null);

  // Workspace state
  currentWorkspaceId = $state<string | null>(null);
  selectedSpineItemId = $state<string | null>(null);
  initialized = $state(false);

  // Workspace managers (legacy, to be migrated)
  currentManifestManager = $state<ManifestManagerImpl | null>(null);
  currentMetadataManager = $state<MetadataManagerImpl | null>(null);
  currentSpineManager = $state<SpineItemManager | null>(null);

  // Workspace-specific dependencies (recreated per workspace)
  currentTransformPipeline = $state<TransformPipeline | null>(null);
  currentBlobURLManager = $state<BlobURLManager | null>(null);

  // Component references
  spineSidebar = $state<any>(null);

  // Manifest preview state
  selectedManifestItem = $state<ManifestItem | SourceItem | null>(null);
  selectedManifestItemType = $state<'manifest' | 'source' | null>(null);

  // Navigation preview state
  navigationPreviewContent = $state('');

  // Cache for workspace-specific dependencies to prevent memory leaks
  private workspaceDependenciesCache = new Map<string, WorkspaceDependencies>();

  // Public getters for reactive access
  get hasWorkspace(): boolean {
    return !!this.currentWorkspaceId;
  }

  get isWorkspaceReady(): boolean {
    return this.initialized && !!this.currentWorkspaceId && !!this.currentWorkspaceManager;
  }

  get isNavigationReady(): boolean {
    return this.isWorkspaceReady && !!this.currentSpineManager && !!this.currentTransformPipeline;
  }

  // Public setters with validation
  setWorkspaceId(workspaceId: string | null): void {
    if (this.currentWorkspaceId !== workspaceId) {
      this.currentWorkspaceId = workspaceId;
      this.selectedSpineItemId = null; // Clear spine selection when workspace changes
    }
  }

  setSelectedSpineItem(itemId: string | null): void {
    this.selectedSpineItemId = itemId;
  }

  setSpineSidebar(ref: any): void {
    this.spineSidebar = ref;
  }

  setManifestSelection(
    item: ManifestItem | SourceItem | null,
    type: 'manifest' | 'source' | null
  ): void {
    this.selectedManifestItem = item;
    this.selectedManifestItemType = type;
  }

  setNavigationPreviewContent(content: string): void {
    this.navigationPreviewContent = content;
  }

  // Initialization methods
  async initializeForProduction(): Promise<void> {
    try {
      // 1. Create and initialize FileStorageAPI first
      this.fileStorageAPI = FileStorageAPI.getInstance();
      await this.fileStorageAPI.init();

      // 2. Initialize service layer (primary architecture)
      this.workspaceService = new WorkspaceService(this.fileStorageAPI);
      this.metadataService = new MetadataService(this.workspaceService);
      this.spineService = new SpineService(this.workspaceService);
      
      // Initialize ContentService with dependencies for sample content generation
      const transformExecutor = new TransformExecutor();
      this.contentService = new ContentService(
        transformExecutor,
        i18nService,
        this.workspaceService
      );

      // 3. Keep minimal managers for components not yet migrated
      const tempWorkspaceManager = new WorkspaceManager(this.fileStorageAPI);
      await tempWorkspaceManager.init();

      this.currentManifestManager = new ManifestManagerImpl(tempWorkspaceManager);
      this.currentMetadataManager = new MetadataManagerImpl(tempWorkspaceManager);
      this.currentSpineManager = new SpineItemManager(tempWorkspaceManager);
      this.currentWorkspaceManager = tempWorkspaceManager;

      // Start background workspace loading (for non-migrated components)
      tempWorkspaceManager.startLoadingWorkspaces();

      this.initialized = true;
      console.log('✅ AppState initialized: Service-first architecture with legacy support');
    } catch (error) {
      console.error('Failed to initialize for production:', error);
      throw error;
    }
  }

  initializeFromContext(
    contextWorkspaceManager: WorkspaceManagerContext,
    contextManifestManager: ManifestManagerContext,
    contextMetadataManager: MetadataManagerContext,
    contextWorkspaceId: WorkspaceIdContext
  ): void {
    // Use context-provided managers (from stories)
    this.currentWorkspaceManager = contextWorkspaceManager || null;
    this.currentWorkspaceId = contextWorkspaceId || null;
    this.currentManifestManager = contextManifestManager || null;
    this.currentMetadataManager = contextMetadataManager || null;

    if (contextWorkspaceManager) {
      this.currentSpineManager = new SpineItemManager(contextWorkspaceManager);
    }

    // Note: context mode doesn't create workspace-specific dependencies yet
    this.initialized = true;
  }

  // Create workspace-specific dependencies when workspace is loaded
  async createWorkspaceSpecificDependencies(workspaceId: string): Promise<void> {
    if (!this.fileStorageAPI || !this.currentWorkspaceManager) {
      return;
    }

    // Check cache first to prevent unnecessary recreation
    const cached = this.workspaceDependenciesCache.get(workspaceId);
    if (cached) {
      this.currentTransformPipeline = cached.transformPipeline;
      this.currentBlobURLManager = cached.blobURLManager;
      return;
    }

    try {
      // Get workspace-specific basePath from container.xml
      const pathInfo = await this.currentWorkspaceManager.getWorkspacePathInfo(workspaceId);

      // Create BlobURLManager with correct basePath
      const blobURLManager = new BlobURLManager({
        fileStorage: this.fileStorageAPI,
        basePath: pathInfo.basePath, // e.g., "OEBPS" from container.xml
        maxBlobURLs: 100,
      });

      // Create TransformPipeline with full BlobURLManager
      const transformPipeline = new TransformPipeline(this.fileStorageAPI, blobURLManager);

      // Cache the dependencies
      this.workspaceDependenciesCache.set(workspaceId, {
        transformPipeline,
        blobURLManager,
      });

      // Set current dependencies
      this.currentBlobURLManager = blobURLManager;
      this.currentTransformPipeline = transformPipeline;
    } catch (error) {
      console.error('Failed to create workspace-specific dependencies:', error);
    }
  }

  // Subscribe to reactive workspace store for auto-updating currentWorkspaceId
  setupWorkspaceSubscription(): void {
    if (this.currentWorkspaceManager && this.currentWorkspaceManager.workspaces) {
      this.currentWorkspaceManager.workspaces.subscribe((workspaces: any[]) => {
        if (!this.currentWorkspaceId && workspaces.length > 0) {
          this.setWorkspaceId(workspaces[0].id);
        }
      });
    }
  }

  // Service layer bridge methods (Phase 2 migration helpers)
  async loadWorkspaceViaService(workspaceId: string): Promise<void> {
    if (!this.workspaceService) return;
    
    try {
      const workspaceState = await this.workspaceService.loadWorkspace(workspaceId);
      this.currentWorkspaceState = workspaceState;
      this.setWorkspaceId(workspaceId);
    } catch (error) {
      console.error('Failed to load workspace via service:', error);
      throw error;
    }
  }

  async createWorkspaceViaService(metadata: { title: string; language: string; identifier: string }): Promise<string> {
    if (!this.workspaceService) throw new Error('WorkspaceService not initialized');
    
    try {
      const workspaceState = await this.workspaceService.createWorkspace(metadata);
      this.currentWorkspaceState = workspaceState;
      this.setWorkspaceId(workspaceState.id);
      return workspaceState.id;
    } catch (error) {
      console.error('Failed to create workspace via service:', error);
      throw error;
    }
  }

  // Event handlers
  handleManifestItemSelect(
    event: CustomEvent<{ item: ManifestItem | SourceItem; type: 'manifest' | 'source' }>
  ): void {
    this.setManifestSelection(event.detail.item, event.detail.type);
  }

  handleNavigationPreviewUpdate(event: CustomEvent<{ xhtml: string; warnings?: string[] }>): void {
    this.setNavigationPreviewContent(event.detail.xhtml);
  }

  onWorkspaceChange(workspaceId: string | null): void {
    this.setWorkspaceId(workspaceId);
    
    // Load workspace state for services
    if (workspaceId && this.workspaceService) {
      this.loadWorkspaceViaService(workspaceId);
    } else {
      this.currentWorkspaceState = null;
    }
  }

  async onWorkspaceOpened(): Promise<void> {
    // Refresh spine items when a workspace is opened/created
    if (this.spineSidebar) {
      await this.spineSidebar.refreshSpineItems();
    }
  }

  /**
   * Create localized workspace with sample content (SERVICE ORCHESTRATION)
   */
  async createLocalizedWorkspace(metadata: any, locale: string): Promise<WorkspaceState> {
    if (!this.workspaceService || !this.contentService) {
      throw new Error('Services not initialized. Call initializeForProduction() first.');
    }

    try {
      // Step 1: Create basic workspace using WorkspaceService
      let workspace = await this.workspaceService.createWorkspace({
        title: metadata.title || 'Untitled Book Project',
        language: locale,
        identifier: metadata.identifier || crypto.randomUUID()
      });

      // Step 2: Add localized sample content using ContentService
      workspace = await this.contentService.addLocalizedSampleContent(workspace, locale);

      // Step 3: Update current workspace state
      this.currentWorkspaceState = workspace;

      return workspace;
    } catch (error) {
      console.error('Failed to create localized workspace:', error);
      throw error;
    }
  }

  // Cleanup method
  cleanup(): void {
    this.workspaceDependenciesCache.clear();
    this.initialized = false;
  }
}
