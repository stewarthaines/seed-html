<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { navigationStore } from '../navigation-store';
  import { t, currentLocale } from '../../i18n';
  import type { EPUBMetadata } from '../../epub/opf-utils';
  import WorkspaceActionBar from '../../components/workspace/WorkspaceActionBar.svelte';
  import WorkspaceList from '../../components/workspace/WorkspaceList.svelte';
  import { EPUBPackager } from '../../epub/EPUBPackager.js';

  // Service layer types for return values
  import type { WorkspaceInfo } from '../../services/workspace/workspace.service.js';

  // Props using Svelte 5 runes syntax
  let {
    onListWorkspaces,
    onCreateWorkspace,
    onDeleteWorkspace,
    onLoadWorkspace,
    onEpubImportRequested,
    onWorkspaceChange = null,
    onWorkspaceOpened,
    onNavigationRequested,
    onSmartNavigationRequested,
    onWorkspaceChanged,
    currentWorkspaceId = null,
  }: {
    onListWorkspaces: () => Promise<WorkspaceInfo[]>;
    onCreateWorkspace: (data: { title: string; language: string }) => Promise<string>;
    onDeleteWorkspace: (id: string) => Promise<void>;
    onLoadWorkspace: (id: string) => Promise<void>;
    onEpubImportRequested: (file?: File, sourceUrl?: string) => Promise<void>;
    onWorkspaceChange?: ((workspaceId: string | null) => void) | null;
    onWorkspaceOpened?: (workspaceId: string) => void;
    onNavigationRequested?: (view: string, workspaceId?: string) => void;
    onSmartNavigationRequested?: (workspaceId: string) => void;
    onWorkspaceChanged?: (workspaceId: string | null) => void;
    currentWorkspaceId?: string | null;
  } = $props();

  // Component state using $state()
  let workspaces = $state<WorkspaceInfo[]>([]);
  let currentWorkspace = $state<WorkspaceInfo | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let hasUnsavedChanges = $state(false);
  let guardId = $state<string>('');
  let isPackaging = $state(false);

  // Initialize EPUB packager
  const epubPackager = new EPUBPackager();

  // Service layer handles state directly - no reactive subscriptions needed

  // Derived: Update currentWorkspace when prop changes
  $effect(() => {
    if (currentWorkspaceId && workspaces.length > 0) {
      currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || null;
    } else {
      currentWorkspace = null;
    }
  });

  // Helper to update workspace selection and notify parent
  const setCurrentWorkspace = async (workspaceId: string | null) => {
    if (workspaceId) {
      currentWorkspace = workspaces.find(w => w.id === workspaceId) || null;
      localStorage.setItem('currentWorkspace', workspaceId);
      
      // Load workspace using callback
      try {
        await onLoadWorkspace(workspaceId);
      } catch (error) {
        console.error('Failed to load workspace:', error);
      }
    } else {
      currentWorkspace = null;
      localStorage.removeItem('currentWorkspace');
    }

    // Notify parent component about workspace change
    if (onWorkspaceChange) {
      onWorkspaceChange(workspaceId);
    }

    // Call callback for workspace change notification
    onWorkspaceChanged?.(workspaceId);
  };

  // Load current workspace from props (reactive statement handles the sync)
  const loadCurrentWorkspace = () => {
    // Reactive statement now handles workspace sync
    // This function remains for compatibility but doesn't need to do anything
  };
  
  // Service layer initialization handled on-demand

  // Load workspaces using callback
  const loadWorkspaces = async () => {
    try {
      loading = true;
      error = null;
      
      // Direct assignment - no transformation needed
      workspaces = await onListWorkspaces();
      
      loadCurrentWorkspace();
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      error = $t('Failed to load projects');
      workspaces = []; // Clear workspaces on error
    } finally {
      loading = false;
    }
  };

  // Create minimal EPUB metadata for new workspace
  const createMinimalEPUBMetadata = (): Partial<EPUBMetadata> => ({
    title: 'Untitled Book Project',
    // Note: language is intentionally omitted so createLocalizedEPUBWorkspace can set it from locale
    identifier: crypto.randomUUID(),
    creator: ['Unknown'],
  });

  // Handle create new workspace using callback
  const handleCreateNew = async () => {
    try {
      loading = true;

      // Get current locale for localized content
      const locale = $currentLocale;
      const metadata = createMinimalEPUBMetadata();

      // Create workspace using callback function
      const workspaceId = await onCreateWorkspace({
        title: metadata.title || 'Untitled Book Project',
        language: locale
      });
      
      console.log('✅ Workspace created:', workspaceId);
      
      // Refresh workspace list
      await loadWorkspaces();

      // Set as current workspace
      await setCurrentWorkspace(workspaceId);

      // Navigate to metadata view for immediate review
      onNavigationRequested?.('metadata', workspaceId);

      onWorkspaceOpened?.(workspaceId);
    } catch (err) {
      console.error('Failed to create workspace:', err);
      alert(
        $t('Failed to create workspace: {error}', {
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      );
    } finally {
      loading = false;
    }
  };

  // Handle load EPUB file
  const handleLoadEpub = async () => {
    try {
      loading = true;
      await onEpubImportRequested();
      
      // Refresh workspace list after import
      await loadWorkspaces();
    } catch (err) {
      console.error('Failed to import EPUB:', err);
      alert(
        $t('Failed to import EPUB: {error}', {
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      );
    } finally {
      loading = false;
    }
  };

  // Handle workspace selection (open workspace) with smart navigation
  const handleWorkspaceSelect = async (event: CustomEvent<{ workspaceId: string }>) => {
    const { workspaceId } = event.detail;

    try {
      // Set as current workspace
      await setCurrentWorkspace(workspaceId);

      // Use smart navigation to go to first spine item (or metadata fallback)
      onSmartNavigationRequested?.(workspaceId);

      onWorkspaceOpened?.(workspaceId);
    } catch (err) {
      console.error('Failed to open workspace:', err);
      alert(
        $t('Failed to open workspace: {error}', {
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      );
    }
  };

  // Handle workspace deletion using service layer
  const handleWorkspaceDelete = async (event: CustomEvent<{ workspaceId: string }>) => {
    const { workspaceId } = event.detail;
    const workspace = workspaces.find(w => w.id === workspaceId);

    if (!workspace) return;

    const confirmed = confirm(
      $t('Delete "{title}"? This cannot be undone.', {
        title: workspace.title,
      })
    );

    if (!confirmed) return;

    try {
      loading = true;

      // Delete workspace using callback
      await onDeleteWorkspace(workspaceId);
      
      // Refresh workspace list
      await loadWorkspaces();

      // If this was the current workspace, clear it
      if (currentWorkspaceId === workspaceId) {
        await setCurrentWorkspace(null);
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      alert(
        $t('Failed to delete workspace: {error}', {
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      );
    } finally {
      loading = false;
    }
  };

  // Handle EPUB packaging and download
  const handlePackageRequest = async (event: CustomEvent<{ workspaceId: string }>) => {
    const { workspaceId } = event.detail;
    const workspace = workspaces.find(w => w.id === workspaceId);

    if (!workspace) return;

    try {
      isPackaging = true;
      
      // Package EPUB with progress tracking
      const result = await epubPackager.packageEPUB(workspaceId, {
        progressCallback: (progress) => {
          console.log(`Packaging progress: ${progress.phase} - ${progress.processedFiles}/${progress.totalFiles} files`);
        }
      });

      if (result.success && result.blob && result.filename) {
        // Immediately download the packaged EPUB
        epubPackager.downloadEPUB(result.blob, result.filename);
        
        console.log(`✅ Successfully packaged and downloaded: ${result.filename}`);
      } else {
        throw new Error(result.error || 'Unknown packaging error');
      }
    } catch (err) {
      console.error('Failed to package EPUB:', err);
      alert(
        $t('Failed to package EPUB: {error}', {
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      );
    } finally {
      isPackaging = false;
    }
  };

  // Handle cleanup of orphaned workspaces (service layer handles errors gracefully)
  const handleCleanupOrphaned = async () => {
    // Service layer doesn't have explicit "error" workspaces like the old manager
    // If needed, this could be implemented as a service method
    alert($t('Cleanup functionality will be implemented in a future service update.'));
  };

  // Handle current workspace actions
  const handleSwitchWorkspace = () => {
    // Just scroll to workspace list for now
    const workspaceListElement = document.querySelector('.workspace-list');
    if (workspaceListElement) {
      workspaceListElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCloseWorkspace = async () => {
    if (hasUnsavedChanges) {
      const confirmed = confirm($t('You have unsaved project changes. Continue?'));
      if (!confirmed) return;
    }

    await setCurrentWorkspace(null);
    hasUnsavedChanges = false;
  };

  // Navigation guard
  export async function canLeave(): Promise<boolean> {
    if (hasUnsavedChanges) {
      return window.confirm($t('You have unsaved project changes. Continue?'));
    }
    return true;
  }

  // ViewComponent interface implementation
  export function onViewEnter(data?: any): void {
    // Component is recreated on navigation, so onMount handles loading
    // No need to reload workspaces here
  }

  export function onViewLeave(): void {
    // Save any state if needed
  }

  export function getViewData(): any {
    return {
      currentWorkspaceId,
      hasUnsavedChanges,
    };
  }

  export async function setViewData(data: any): Promise<void> {
    if (data.currentWorkspaceId) {
      await setCurrentWorkspace(data.currentWorkspaceId);
    }
    if (data.hasUnsavedChanges !== undefined) {
      hasUnsavedChanges = data.hasUnsavedChanges;
    }
  }

  // Handle workspace list refresh event
  const handleWorkspaceListRefresh = () => {
    loadWorkspaces();
  };

  // Component lifecycle
  onMount(async () => {
    // Register navigation guard
    guardId = navigationStore.addNavigationGuard(canLeave);
    
    // Listen for workspace list refresh events
    window.addEventListener('workspace-list-refresh', handleWorkspaceListRefresh);
    
    // Load workspaces on initial mount
    await loadWorkspaces();
  });

  onDestroy(() => {
    // Clean up guard
    if (guardId) {
      navigationStore.removeNavigationGuard(guardId);
    }

    // Clean up event listener
    window.removeEventListener('workspace-list-refresh', handleWorkspaceListRefresh);

    // Call onViewLeave
    onViewLeave();
  });
</script>

<div class="workspace-view">
  <main class="view-content">
    <!-- Action Bar -->
    <WorkspaceActionBar
      isLoading={loading}
      on:createNewRequested={handleCreateNew}
      on:loadEpubRequested={handleLoadEpub}
    />

    <!-- Error State -->
    {#if error}
      <div class="error-banner">
        <span class="error-icon" aria-hidden="true">⚠️</span>
        <span class="error-text">{error}</span>
        <button type="button" class="retry-button" onclick={loadWorkspaces}>
          {$t('Retry')}
        </button>
      </div>
    {/if}

    <!-- Cleanup Banner removed - service layer handles error detection -->

    <!-- Workspace List -->
    <WorkspaceList
      {workspaces}
      {currentWorkspaceId}
      isLoading={loading || isPackaging}
      on:workspaceSelected={handleWorkspaceSelect}
      on:workspaceDeleted={handleWorkspaceDelete}
      on:packageRequested={handlePackageRequest}
    />

    <!-- Unsaved Changes Indicator -->
    {#if hasUnsavedChanges}
      <div class="unsaved-indicator">
        <span class="indicator-icon" aria-hidden="true">⚠️</span>
        <span>{$t('You have unsaved changes')}</span>
      </div>
    {/if}
  </main>
</div>

<style>
  .workspace-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .view-content {
    flex: 1;
    padding: var(--space-6);
    overflow-y: auto;
  }


  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    margin-block-end: var(--space-6);
    background-color: var(--color-error-surface);
    color: var(--color-error);
    border: 1px solid var(--color-error);
    border-radius: var(--radius-md);
  }

  .error-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .error-text {
    flex: 1;
    font-weight: 500;
  }

  .retry-button {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-error);
    border-radius: var(--radius-sm);
    background-color: transparent;
    color: var(--color-error);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    min-height: 44px; /* Accessibility: min touch target */
  }

  .retry-button:hover {
    background-color: var(--color-error);
    color: var(--color-surface);
  }

  .retry-button:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }


  .unsaved-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    margin-block-start: var(--space-6);
    background-color: var(--color-warning-surface);
    color: var(--color-warning);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .indicator-icon {
    font-size: var(--text-base);
    flex-shrink: 0;
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .view-content {
      padding: var(--space-4);
    }
  }
</style>
