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
  import { WorkspaceManager } from './lib/workspace';
  import { ManifestManagerImpl } from './lib/manifest/manifest-manager';
  import { MetadataManagerImpl } from './lib/metadata/MetadataManager';
  import { SpineItemManager } from './lib/spine/spine-item-manager';
  import { layoutStore } from './lib/stores/layout';
  import { t } from './lib/i18n';
  import {
    WORKSPACE_MANAGER_CONTEXT,
    MANIFEST_MANAGER_CONTEXT,
    METADATA_MANAGER_CONTEXT,
    WORKSPACE_ID_CONTEXT,
    type WorkspaceManagerContext,
    type ManifestManagerContext,
    type MetadataManagerContext,
    type WorkspaceIdContext
  } from './lib/contexts';

  // Get dependencies from context (stories) or create real ones (production)
  const contextWorkspaceManager: WorkspaceManagerContext = getContext(WORKSPACE_MANAGER_CONTEXT);
  const contextManifestManager: ManifestManagerContext = getContext(MANIFEST_MANAGER_CONTEXT);
  const contextMetadataManager: MetadataManagerContext = getContext(METADATA_MANAGER_CONTEXT);
  const contextWorkspaceId: WorkspaceIdContext = getContext(WORKSPACE_ID_CONTEXT);

  // Subscribe to navigation state
  $: currentView = $navigationStore.currentView;
  $: isExpanded = $layoutStore.sidebar.isExpanded;

  // Spine management state
  let currentWorkspaceManager: WorkspaceManager;
  let currentWorkspaceId: string | null = null;
  let selectedSpineItemId: string | null = null;
  let initialized = false;
  let currentManifestManager: ManifestManagerImpl | null = null;
  let currentMetadataManager: MetadataManagerImpl | null = null;
  let currentSpineManager: SpineItemManager | null = null;

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
        } else {
          // Production: create and initialize real managers
          const tempWorkspaceManager = new WorkspaceManager();
          await tempWorkspaceManager.init();

          // Get the first available workspace
          const workspaces = await tempWorkspaceManager.listWorkspacesWithMetadata();
          if (workspaces.length > 0) {
            currentWorkspaceId = workspaces[0].id;
          }

          // Create real manifest, metadata, and spine managers
          currentManifestManager = new ManifestManagerImpl(tempWorkspaceManager);
          currentMetadataManager = new MetadataManagerImpl(tempWorkspaceManager);
          currentSpineManager = new SpineItemManager(tempWorkspaceManager);
          
          // Set manager only after full initialization
          currentWorkspaceManager = tempWorkspaceManager;
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
</script>

<LayoutManager hasWorkspace={!!currentWorkspaceId}>
  <svelte:fragment slot="sidebar-spine">
    {#if initialized && currentWorkspaceId && currentWorkspaceManager && currentSpineManager}
      <SpineSidebar
        workspaceId={currentWorkspaceId}
        workspaceManager={currentWorkspaceManager}
        spineManager={currentSpineManager}
        selectedItemId={selectedSpineItemId}
        {isExpanded}
      />
    {:else}
      <div class="placeholder-content">
        <p>{$t('Loading workspace...')}</p>
      </div>
    {/if}
  </svelte:fragment>

  <svelte:fragment slot="left-content">
    <!-- Main content area - switches based on current view -->
    {#if currentView === 'workspace' && currentSpineManager}
      <WorkspaceView 
        workspaceManager={currentWorkspaceManager}
        spineManager={currentSpineManager}
        currentWorkspaceId={currentWorkspaceId}
        onWorkspaceChange={(workspaceId) => {
          currentWorkspaceId = workspaceId;
        }}
      />
    {:else if currentView === 'metadata'}
      {#if initialized && currentWorkspaceId && currentMetadataManager}
        <MetadataEditor
          workspaceId={currentWorkspaceId}
          metadataManager={currentMetadataManager}
        />
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
      <PlaceholderView
        viewType="navigation"
        title={$t('Table of Contents')}
        description={$t('Edit navigation structure and TOC')}
        icon="📖"
      />
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
          description={$t('Loading workspace...')}
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
        selectedItem={null}
        selectedItemType={null}
        workspaceId={currentWorkspaceId}
        manifestManager={currentManifestManager}
      />
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
