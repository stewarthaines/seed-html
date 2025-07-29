<script lang="ts">
  import { onMount, getContext } from 'svelte';
  import LayoutManager from './lib/LayoutManager.svelte';
  import { navigationStore } from './lib/navigation';
  import WorkspaceView from './lib/navigation/views/WorkspaceView.svelte';
  import MetadataEditor from './lib/components/metadata/MetadataEditor.svelte';
  import PlaceholderView from './lib/navigation/views/PlaceholderView.svelte';
  import SpineView from './lib/navigation/views/SpineView.svelte';
  import SpineSidebar from './lib/components/SpineSidebar.svelte';
  import ManifestContainer from './lib/components/manifest/ManifestContainer.svelte';
  import ManifestPreview from './lib/components/manifest/ManifestPreview.svelte';
  import OutlineView from './lib/components/outline/OutlineView.svelte';
  import ContentPreview from './lib/components/preview/ContentPreview.svelte';
  import { WorkspaceManager } from './lib/workspace';
  import type { IWorkspaceManager } from './lib/workspace/types';
  import { ManifestManagerImpl } from './lib/manifest/manifest-manager';
  import { MetadataManagerImpl } from './lib/metadata/MetadataManager';
  import { SpineItemManager } from './lib/spine/spine-item-manager';
  import { TransformPipeline } from './lib/transform';
  import { BlobURLManager } from './lib/blob-url';
  import { FileStorageAPI } from './lib/storage';
  import { layoutStore } from './lib/stores/layout';
  import { t } from './lib/i18n';
  import type { ManifestItem, SourceItem } from './lib/manifest/types';
  import {
    WORKSPACE_MANAGER_CONTEXT,
    MANIFEST_MANAGER_CONTEXT,
    METADATA_MANAGER_CONTEXT,
    WORKSPACE_ID_CONTEXT,
    type WorkspaceManagerContext,
    type ManifestManagerContext,
    type MetadataManagerContext,
    type WorkspaceIdContext,
  } from './lib/contexts';

  // Get dependencies from context (stories) or create real ones (production)
  const contextWorkspaceManager: WorkspaceManagerContext = getContext(WORKSPACE_MANAGER_CONTEXT);
  const contextManifestManager: ManifestManagerContext = getContext(MANIFEST_MANAGER_CONTEXT);
  const contextMetadataManager: MetadataManagerContext = getContext(METADATA_MANAGER_CONTEXT);
  const contextWorkspaceId: WorkspaceIdContext = getContext(WORKSPACE_ID_CONTEXT);

  // Subscribe to navigation state
  let currentView = $derived($navigationStore.currentView);
  let isExpanded = $derived($layoutStore.sidebar.isExpanded);

  // Root-level dependencies (shared across workspaces)
  let fileStorageAPI: FileStorageAPI | null = $state(null);
  let currentWorkspaceManager: IWorkspaceManager = $state()!;
  
  // Workspace state
  let currentWorkspaceId: string | null = $state(null);
  let selectedSpineItemId: string | null = $state(null);
  let initialized = $state(false);
  
  // Workspace managers
  let currentManifestManager: ManifestManagerImpl | null = $state(null);
  let currentMetadataManager: MetadataManagerImpl | null = $state(null);
  let currentSpineManager: SpineItemManager | null = $state(null);
  
  // Workspace-specific dependencies (recreated per workspace)
  let currentTransformPipeline: TransformPipeline | null = $state(null);
  let currentBlobURLManager: BlobURLManager | null = $state(null);
  
  let spineSidebar: any = $state(null); // Reference to SpineSidebar component

  // Manifest preview state
  let selectedManifestItem: ManifestItem | SourceItem | null = $state(null);
  let selectedManifestItemType: 'manifest' | 'source' | null = $state(null);

  // Navigation preview state
  let navigationPreviewContent: string = $state('');

  // Create workspace-specific dependencies when workspace is loaded
  async function createWorkspaceSpecificDependencies(workspaceId: string) {
    if (!fileStorageAPI || !currentWorkspaceManager) {
      return;
    }

    try {
      // Get workspace-specific basePath from container.xml
      const pathInfo = await currentWorkspaceManager.getWorkspacePathInfo(workspaceId);
      
      // Create BlobURLManager with correct basePath
      currentBlobURLManager = new BlobURLManager({
        fileStorage: fileStorageAPI,
        basePath: pathInfo.basePath, // e.g., "OEBPS" from container.xml
        maxBlobURLs: 100,
      });

      // Create TransformPipeline with full BlobURLManager
      currentTransformPipeline = new TransformPipeline(
        fileStorageAPI,
        currentBlobURLManager
      );
    } catch (error) {
      console.error('Failed to create workspace-specific dependencies:', error);
    }
  }

  // Handler for manifest item selection
  const handleManifestItemSelect = (
    event: CustomEvent<{ item: ManifestItem | SourceItem; type: 'manifest' | 'source' }>
  ) => {
    selectedManifestItem = event.detail.item;
    selectedManifestItemType = event.detail.type;
  };

  // Handler for navigation preview updates
  const handleNavigationPreviewUpdate = (
    event: CustomEvent<{ xhtml: string; warnings?: string[] }>
  ) => {
    navigationPreviewContent = event.detail.xhtml;
  };

  // Initialize workspace manager
  onMount(() => {
    // Async initialization
    (async () => {
      try {
        if (contextWorkspaceManager) {
          // Use context-provided managers (from stories)
          currentWorkspaceManager = contextWorkspaceManager;
          currentWorkspaceId = contextWorkspaceId || null;
          currentManifestManager = contextManifestManager || null;
          currentMetadataManager = contextMetadataManager || null;
          currentSpineManager = new SpineItemManager(contextWorkspaceManager);
          // Note: context mode doesn't create workspace-specific dependencies yet
        } else {
          // Production: create and initialize real managers
          
          // 1. Create and initialize FileStorageAPI first
          fileStorageAPI = FileStorageAPI.getInstance();
          await fileStorageAPI.init();

          // 2. Create WorkspaceManager with FileStorageAPI dependency injection
          const tempWorkspaceManager = new WorkspaceManager(fileStorageAPI);
          await tempWorkspaceManager.init();

          // 3. Create workspace managers that depend on WorkspaceManager
          currentManifestManager = new ManifestManagerImpl(tempWorkspaceManager);
          currentMetadataManager = new MetadataManagerImpl(tempWorkspaceManager);
          currentSpineManager = new SpineItemManager(tempWorkspaceManager);

          // 4. Set manager immediately - enables UI
          currentWorkspaceManager = tempWorkspaceManager;

          // 5. Start background workspace loading (non-blocking)
          tempWorkspaceManager.startLoadingWorkspaces();
        }

        initialized = true;
      } catch (error) {
        console.error('Failed to initialize workspace manager:', error);
      }
    })();

    // Listen for spine item selection events
    const handleSelectSpineItem = (event: Event) => {
      const customEvent = event as CustomEvent<{ itemId: string }>;
      selectedSpineItemId = customEvent.detail.itemId;

      // Automatically navigate to spine view when a spine item is selected
      navigationStore.navigateTo('spine');
    };

    // Listen for spine item clear events
    const handleClearSpineSelection = () => {
      selectedSpineItemId = null;
    };

    window.addEventListener('select-spine-item', handleSelectSpineItem);
    window.addEventListener('clear-spine-selection', handleClearSpineSelection);

    return () => {
      window.removeEventListener('select-spine-item', handleSelectSpineItem);
      window.removeEventListener('clear-spine-selection', handleClearSpineSelection);
    };
  });

  // Subscribe to reactive workspace store for auto-updating currentWorkspaceId
  $effect(() => {
    if (currentWorkspaceManager && currentWorkspaceManager.workspaces) {
      currentWorkspaceManager.workspaces.subscribe((workspaces: any[]) => {
        if (!currentWorkspaceId && workspaces.length > 0) {
          currentWorkspaceId = workspaces[0].id;
        }
      });
    }
  });

  // Create workspace-specific dependencies when workspace changes
  $effect(() => {
    if (currentWorkspaceId && currentWorkspaceManager && fileStorageAPI) {
      createWorkspaceSpecificDependencies(currentWorkspaceId);
    }
  });
</script>

<LayoutManager hasWorkspace={!!currentWorkspaceId}>
  <svelte:fragment slot="sidebar-spine">
    {#if !initialized}
      <div class="placeholder-content">
        <p>{$t('Loading workspace…')}</p>
      </div>
    {:else if !currentWorkspaceId}
      <div class="placeholder-content">
        <p>{$t('No workspace selected')}</p>
      </div>
    {:else if currentWorkspaceManager && currentSpineManager}
      <SpineSidebar
        bind:this={spineSidebar}
        workspaceId={currentWorkspaceId}
        spineManager={currentSpineManager}
        selectedItemId={selectedSpineItemId}
        {isExpanded}
      />
    {:else}
      <div class="placeholder-content">
        <p>{$t('Loading workspace…')}</p>
      </div>
    {/if}
  </svelte:fragment>

  <svelte:fragment slot="left-content">
    <!-- Main content area - switches based on current view -->
    {#if currentView === 'workspace' && currentSpineManager}
      <WorkspaceView
        workspaceManager={currentWorkspaceManager}
        spineManager={currentSpineManager}
        {currentWorkspaceId}
        onWorkspaceChange={workspaceId => {
          currentWorkspaceId = workspaceId;
        }}
        on:workspaceOpened={async () => {
          // Refresh spine items when a workspace is opened/created
          if (spineSidebar) {
            await spineSidebar.refreshSpineItems();
          }
        }}
      />
    {:else if currentView === 'metadata'}
      {#if initialized && currentWorkspaceId && currentMetadataManager}
        <MetadataEditor workspaceId={currentWorkspaceId} metadataManager={currentMetadataManager} />
      {:else}
        <PlaceholderView
          viewType="metadata"
          title={$t('EPUB Metadata')}
          description={$t('Configure publication metadata and details')}
          icon="📝"
        />
      {/if}
    {:else if currentView === 'manifest'}
      {#if initialized && currentWorkspaceId && currentManifestManager}
        <ManifestContainer
          workspaceId={currentWorkspaceId}
          manifestManager={currentManifestManager}
          advancedMode={true}
          on:itemSelect={handleManifestItemSelect}
        />
      {:else}
        <PlaceholderView
          viewType="manifest"
          title={$t('File Manifest')}
          description={$t('Manage EPUB files and resources')}
          icon="📋"
        />
      {/if}
    {:else if currentView === 'navigation'}
      {#if initialized && currentWorkspaceId && currentWorkspaceManager && currentSpineManager && currentTransformPipeline}
        <OutlineView
          workspaceId={currentWorkspaceId}
          workspaceManager={currentWorkspaceManager}
          spineItemManager={currentSpineManager}
          transformPipeline={currentTransformPipeline}
          on:previewUpdate={handleNavigationPreviewUpdate}
        />
      {:else}
        <PlaceholderView
          viewType="navigation"
          title={$t('Table of Contents')}
          description={$t('Loading workspace…')}
          icon="📖"
        />
      {/if}
    {:else if currentView === 'spine'}
      {#if initialized && currentWorkspaceId && currentWorkspaceManager && currentSpineManager}
        <SpineView
          workspaceId={currentWorkspaceId}
          workspaceManager={currentWorkspaceManager}
          spineManager={currentSpineManager}
          selectedItemId={selectedSpineItemId}
        />
      {:else}
        <PlaceholderView
          viewType="spine"
          title={$t('Spine Items')}
          description={$t('Loading workspace…')}
          icon="📚"
        />
      {/if}
    {:else if currentView === 'settings'}
      <PlaceholderView
        viewType="settings"
        title={$t('Application Settings')}
        description={$t('Configure preferences and options')}
        icon="⚙️"
      />
    {:else}
      <div class="placeholder-content">
        <h3>{$t('Unknown View')}</h3>
        <p>{$t('View type')}: {currentView}</p>
      </div>
    {/if}
  </svelte:fragment>

  <svelte:fragment slot="right-content">
    {#if currentView === 'manifest' && initialized && currentWorkspaceId && currentManifestManager}
      <ManifestPreview
        selectedItem={selectedManifestItem}
        selectedItemType={selectedManifestItemType}
        workspaceId={currentWorkspaceId}
        manifestManager={currentManifestManager}
      />
    {:else if currentView === 'navigation'}
      {#if navigationPreviewContent}
        <ContentPreview
          content={navigationPreviewContent}
          deviceSize="responsive"
        />
      {:else}
        <div class="placeholder-content">
          <h3>{$t('Navigation Preview')}</h3>
          <p>{$t('Navigation preview will appear here once content is generated')}</p>
        </div>
      {/if}
    {:else}
      <div class="placeholder-content">
        <h3>{$t('Preview Pane')}</h3>
        <p>{$t('XHTML preview will go here (Phase 4)')}</p>
        <p class="current-view-info">{$t('Current view')}: <strong>{currentView}</strong></p>
      </div>
    {/if}
  </svelte:fragment>
</LayoutManager>

<style>
  .placeholder-content {
    padding: 1rem;
    color: var(--color-text-secondary);
  }

  .placeholder-content h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .placeholder-content p {
    margin: 0;
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .current-view-info {
    margin-top: 1rem !important;
    padding: 0.5rem;
    background: var(--color-bg-secondary);
    border-radius: 4px;
    font-size: 0.75rem !important;
  }
</style>
