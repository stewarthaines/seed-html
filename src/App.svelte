<script lang="ts">
  import { onMount } from 'svelte';
  import LayoutManager from './lib/LayoutManager.svelte';
  import { navigationStore } from './lib/navigation';
  import WorkspaceView from './lib/navigation/views/WorkspaceView.svelte';
  import MetadataView from './lib/navigation/views/MetadataView.svelte';
  import PlaceholderView from './lib/navigation/views/PlaceholderView.svelte';
  import SpineView from './lib/navigation/views/SpineView.svelte';
  import SpineSidebar from './lib/components/SpineSidebar.svelte';
  import { WorkspaceManager } from './lib/workspace';
  import { layoutStore } from './lib/stores/layout';
  import { t } from './lib/i18n';

  // Optional props for dependency injection (used by stories)
  export let workspaceManager: WorkspaceManager | null = null;
  export let initialWorkspaceId: string | null = null;

  // Subscribe to navigation state
  $: currentView = $navigationStore.currentView;
  $: isExpanded = $layoutStore.sidebar.isExpanded;

  // Spine management state
  let currentWorkspaceManager: WorkspaceManager;
  let currentWorkspaceId: string | null = null;
  let selectedSpineItemId: string | null = null;
  let initialized = false;

  // Initialize workspace manager
  onMount(async () => {
    try {
      if (!workspaceManager) {
        // Default behavior - create own manager
        currentWorkspaceManager = new WorkspaceManager();
        await currentWorkspaceManager.init();
        
        // Get the first available workspace
        const workspaces = await currentWorkspaceManager.listWorkspacesWithMetadata();
        if (workspaces.length > 0) {
          currentWorkspaceId = workspaces[0].id;
        }
      } else {
        // Use provided manager and workspace ID
        currentWorkspaceManager = workspaceManager;
        currentWorkspaceId = initialWorkspaceId;
      }
      
      initialized = true;
    } catch (error) {
      console.error('Failed to initialize workspace manager:', error);
    }

    // Listen for spine item selection events
    const handleSelectSpineItem = (event: Event) => {
      const customEvent = event as CustomEvent<{ itemId: string }>;
      selectedSpineItemId = customEvent.detail.itemId;
    };

    window.addEventListener('select-spine-item', handleSelectSpineItem);
    return () => window.removeEventListener('select-spine-item', handleSelectSpineItem);
  });
</script>

<LayoutManager>
  <svelte:fragment slot="sidebar-spine">
    {#if initialized && currentWorkspaceId && currentWorkspaceManager}
      <SpineSidebar
        workspaceId={currentWorkspaceId}
        workspaceManager={currentWorkspaceManager}
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
    {#if currentView === 'workspace'}
      <WorkspaceView />
    {:else if currentView === 'metadata'}
      <MetadataView />
    {:else if currentView === 'manifest'}
      <PlaceholderView 
        viewType="manifest" 
        title={$t('File Manifest')} 
        description={$t('Manage EPUB files and resources')}
        icon="📋" 
      />
    {:else if currentView === 'navigation'}
      <PlaceholderView 
        viewType="navigation" 
        title={$t('Table of Contents')} 
        description={$t('Edit navigation structure and TOC')}
        icon="📖" 
      />
    {:else if currentView === 'spine'}
      {#if initialized && currentWorkspaceId && currentWorkspaceManager}
        <SpineView 
          workspaceId={currentWorkspaceId}
          workspaceManager={currentWorkspaceManager}
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
    <div class="placeholder-content">
      <h3>{$t('Preview Pane')}</h3>
      <p>{$t('XHTML preview will go here (Phase 4)')}</p>
      <p class="current-view-info">{$t('Current view')}: <strong>{currentView}</strong></p>
    </div>
  </svelte:fragment>
</LayoutManager>

<style>
  .placeholder-content {
    padding: 1rem;
    color: #666;
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
    background: #f0f0f0;
    border-radius: 4px;
    font-size: 0.75rem !important;
  }
</style>
