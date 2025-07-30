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
  import { layoutStore } from './lib/stores/layout';
  import { t } from './lib/i18n';
  import { AppState } from './lib/app-state.svelte.js';
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

  // Create AppState instance
  const appState = new AppState();

  // Reactive getters for template access
  let currentView = $derived($navigationStore.currentView);
  let isExpanded = $derived($layoutStore.sidebar.isExpanded);
  let currentWorkspaceManager = $derived(appState.currentWorkspaceManager);
  let currentWorkspaceId = $derived(appState.currentWorkspaceId);
  let selectedSpineItemId = $derived(appState.selectedSpineItemId);
  let initialized = $derived(appState.initialized);
  let currentManifestManager = $derived(appState.currentManifestManager);
  let currentSpineManager = $derived(appState.currentSpineManager);
  let currentTransformPipeline = $derived(appState.currentTransformPipeline);
  let selectedManifestItem = $derived(appState.selectedManifestItem);
  let selectedManifestItemType = $derived(appState.selectedManifestItemType);
  let navigationPreviewContent = $derived(appState.navigationPreviewContent);

  // New service layer reactive getters (Phase 2 migration)
  let workspaceService = $derived(appState.workspaceService);
  let metadataService = $derived(appState.metadataService);
  let spineService = $derived(appState.spineService);
  let currentWorkspaceState = $derived(appState.currentWorkspaceState);

  // Initialize app state
  onMount(() => {
    // Async initialization
    (async () => {
      try {
        if (contextWorkspaceManager) {
          // Use context-provided managers (from stories)
          appState.initializeFromContext(
            contextWorkspaceManager,
            contextManifestManager,
            contextMetadataManager,
            contextWorkspaceId
          );
        } else {
          // Production: create and initialize real managers
          await appState.initializeForProduction();
        }
      } catch (error) {
        console.error('Failed to initialize app state:', error);
      }
    })();

    // Listen for spine item selection events
    const handleSelectSpineItem = (event: Event) => {
      const customEvent = event as CustomEvent<{ itemId: string }>;
      appState.setSelectedSpineItem(customEvent.detail.itemId);

      // Automatically navigate to spine view when a spine item is selected
      navigationStore.navigateTo('spine');
    };

    // Listen for spine item clear events
    const handleClearSpineSelection = () => {
      appState.setSelectedSpineItem(null);
    };

    window.addEventListener('select-spine-item', handleSelectSpineItem);
    window.addEventListener('clear-spine-selection', handleClearSpineSelection);

    return () => {
      window.removeEventListener('select-spine-item', handleSelectSpineItem);
      window.removeEventListener('clear-spine-selection', handleClearSpineSelection);
      appState.cleanup();
    };
  });

  // Subscribe to reactive workspace store for auto-updating currentWorkspaceId
  $effect(() => {
    appState.setupWorkspaceSubscription();
  });

  // Create workspace-specific dependencies when workspace changes
  $effect(() => {
    if (appState.currentWorkspaceId && appState.currentWorkspaceManager) {
      appState.createWorkspaceSpecificDependencies(appState.currentWorkspaceId);
    }
  });

  // Load workspace state for services when workspace changes
  $effect(() => {
    if (appState.currentWorkspaceId && appState.workspaceService && !appState.currentWorkspaceState) {
      appState.loadWorkspaceViaService(appState.currentWorkspaceId);
    }
  });
</script>

<LayoutManager hasWorkspace={!!currentWorkspaceId}>
  <svelte:fragment slot="sidebar-spine">
    {#if !initialized}
      <div class="placeholder-content">
        <p>{$t('Loading workspace…')}</p>
      </div>
    {:else if !currentWorkspaceState}
      <div class="placeholder-content">
        <p>{$t('No workspace selected')}</p>
      </div>
    {:else if currentWorkspaceState && spineService}
      <SpineSidebar
        bind:this={appState.spineSidebar}
        workspace={currentWorkspaceState}
        {spineService}
        selectedItemId={selectedSpineItemId}
        {isExpanded}
        onWorkspaceUpdate={(updatedWorkspace: import('./lib/services/workspace/workspace.service.js').WorkspaceState) => {
          appState.currentWorkspaceState = updatedWorkspace;
        }}
      />
    {:else}
      <div class="placeholder-content">
        <p>{$t('Loading workspace…')}</p>
      </div>
    {/if}
  </svelte:fragment>

  <svelte:fragment slot="left-content">
    <!-- Main content area - switches based on current view -->
    {#if currentView === 'workspace' && currentSpineManager && workspaceService}
      <WorkspaceView
        {workspaceService}
        spineManager={currentSpineManager}
        {currentWorkspaceId}
        {appState}
        onWorkspaceChange={appState.onWorkspaceChange.bind(appState)}
        on:workspaceOpened={appState.onWorkspaceOpened.bind(appState)}
      />
    {:else if currentView === 'metadata'}
      {#if initialized && currentWorkspaceState && metadataService}
        <MetadataEditor workspace={currentWorkspaceState} {metadataService} />
      {:else}
        <PlaceholderView
          viewType="metadata"
          title={$t('EPUB Metadata')}
          description={$t('Configure publication metadata and details')}
          icon="📝"
        />
      {/if}
    {:else if currentView === 'manifest'}
      {#if initialized && appState.currentWorkspaceState && appState.workspaceService}
        <ManifestContainer
          workspace={appState.currentWorkspaceState}
          workspaceService={appState.workspaceService}
          advancedMode={true}
          on:itemSelect={appState.handleManifestItemSelect.bind(appState)}
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
      {#if initialized && appState.currentWorkspaceState && appState.workspaceService && appState.spineService && currentTransformPipeline}
        <OutlineView
          workspace={appState.currentWorkspaceState}
          workspaceService={appState.workspaceService}
          spineService={appState.spineService}
          transformPipeline={currentTransformPipeline}
          on:previewUpdate={appState.handleNavigationPreviewUpdate.bind(appState)}
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
      {#if initialized && currentWorkspaceState && workspaceService && spineService}
        <SpineView
          workspace={currentWorkspaceState}
          workspaceService={workspaceService}
          spineService={spineService}
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
    {#if currentView === 'manifest' && initialized && appState.currentWorkspaceState && appState.workspaceService}
      <ManifestPreview
        selectedItem={selectedManifestItem}
        selectedItemType={selectedManifestItemType}
        workspace={appState.currentWorkspaceState}
        workspaceService={appState.workspaceService}
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
