<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { navigationStore } from '../navigation-store';
  import { t, currentLocale } from '../../i18n';
  import type { EPUBMetadata } from '../../epub/opf-utils';
  import WorkspaceActionBar from '../../components/workspace/WorkspaceActionBar.svelte';
  import WorkspaceList from '../../components/workspace/WorkspaceList.svelte';

  // Service layer types for return values
  import type { WorkspaceInfo } from '../../services/workspace/workspace.service.js';

  const dispatch = createEventDispatcher<{
    workspaceOpened: { workspaceId: string };
    navigationRequested: { view: string; workspaceId?: string };
    workspaceChanged: { workspaceId: string | null };
  }>();

  // Props for callback-based operations
  export let onListWorkspaces: () => Promise<WorkspaceInfo[]>;
  export let onCreateWorkspace: (data: { title: string; language: string }) => Promise<string>;
  export let onDeleteWorkspace: (id: string) => Promise<void>;
  export let onLoadWorkspace: (id: string) => Promise<void>;
  export let onWorkspaceChange: ((workspaceId: string | null) => void) | null = null;
  export let currentWorkspaceId: string | null = null;

  // Component state
  let workspaces: WorkspaceInfo[] = [];
  let currentWorkspace: WorkspaceInfo | null = null;
  let loading = false;
  let error: string | null = null;
  let hasUnsavedChanges = false;
  let guardId: string;

  // Service layer handles state directly - no reactive subscriptions needed

  // Reactive: Update currentWorkspace when prop changes
  $: {
    if (currentWorkspaceId && workspaces.length > 0) {
      currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || null;
    } else {
      currentWorkspace = null;
    }
  }

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

    // Dispatch event for backward compatibility
    dispatch('workspaceChanged', { workspaceId });
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
      
      const serviceWorkspaces = await onListWorkspaces();
      
      // Convert service workspace info to component format
      workspaces = serviceWorkspaces.map(w => ({
        id: w.id,
        title: w.title,
        language: w.language,
        lastModified: w.lastModified,
        fileCount: w.fileCount,
        totalSize: w.totalSize,
        epubVersion: '3.0' // Service layer defaults to EPUB 3.0
      }));
      
      loadCurrentWorkspace();
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      error = $t('Failed to load workspaces');
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
      dispatch('navigationRequested', {
        view: 'metadata',
        workspaceId: workspaceId,
      });

      dispatch('workspaceOpened', { workspaceId: workspaceId });
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
  const handleLoadEpub = () => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.epub';

    input.onchange = async event => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        loading = true;

        // TODO: Implement EPUB import in WorkspaceService
        // For now, show a placeholder message
        alert(
          $t(
            'EPUB import functionality is coming soon. For now, use "Create New" to start a fresh project.'
          )
        );
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

    input.click();
  };

  // Handle workspace selection (open workspace) with smart navigation
  const handleWorkspaceSelect = async (event: CustomEvent<{ workspaceId: string }>) => {
    const { workspaceId } = event.detail;

    try {
      // Set as current workspace
      await setCurrentWorkspace(workspaceId);

      // Navigate to metadata view after opening workspace
      dispatch('navigationRequested', {
        view: 'metadata',
        workspaceId,
      });

      dispatch('workspaceOpened', { workspaceId });
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
      const confirmed = confirm($t('You have unsaved workspace changes. Continue?'));
      if (!confirmed) return;
    }

    await setCurrentWorkspace(null);
    hasUnsavedChanges = false;
  };

  // Navigation guard
  export async function canLeave(): Promise<boolean> {
    if (hasUnsavedChanges) {
      return window.confirm($t('You have unsaved workspace changes. Continue?'));
    }
    return true;
  }

  // ViewComponent interface implementation
  export function onViewEnter(data?: any): void {
    // Load workspaces when entering view
    loadWorkspaces();
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

  // Component lifecycle
  onMount(async () => {
    // Register navigation guard
    guardId = navigationStore.addNavigationGuard(canLeave);
    
    // Load workspaces on initial mount
    await loadWorkspaces();
  });

  onDestroy(() => {
    // Clean up guard
    if (guardId) {
      navigationStore.removeNavigationGuard(guardId);
    }

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
        <button type="button" class="retry-button" on:click={loadWorkspaces}>
          {$t('Retry')}
        </button>
      </div>
    {/if}

    <!-- Cleanup Banner removed - service layer handles error detection -->

    <!-- Workspace List -->
    <WorkspaceList
      {workspaces}
      {currentWorkspaceId}
      isLoading={loading}
      on:workspaceSelected={handleWorkspaceSelect}
      on:workspaceDeleted={handleWorkspaceDelete}
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

  .debug-banner {
    padding: var(--space-3);
    margin-block-end: var(--space-4);
    background-color: var(--color-info-surface, #e6f3ff);
    color: var(--color-info, #0066cc);
    border: 1px solid var(--color-info, #0066cc);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
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

  .cleanup-banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    margin-block-end: var(--space-6);
    background-color: var(--color-warning-surface);
    color: var(--color-warning);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-md);
  }

  .cleanup-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .cleanup-text {
    flex: 1;
    font-weight: 500;
  }

  .cleanup-button {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-sm);
    background-color: transparent;
    color: var(--color-warning);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    min-height: 44px; /* Accessibility: min touch target */
  }

  .cleanup-button:hover {
    background-color: var(--color-warning);
    color: var(--color-surface);
  }

  .cleanup-button:focus-visible {
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
