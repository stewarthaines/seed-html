<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { navigationStore } from '../navigation-store';
  import { t, currentLocale } from '../../i18n';
  import { WorkspaceManager } from '../../workspace/workspace-manager';
  import type { WorkspaceInfo } from '../../workspace/types';
  import type { EPUBMetadata } from '../../epub/opf-utils';
  import type { SpineItemManager } from '../../spine/spine-item-manager';
  import CurrentWorkspaceBar from '../../components/workspace/CurrentWorkspaceBar.svelte';
  import WorkspaceActionBar from '../../components/workspace/WorkspaceActionBar.svelte';
  import WorkspaceList from '../../components/workspace/WorkspaceList.svelte';

  const dispatch = createEventDispatcher<{
    workspaceOpened: { workspaceId: string };
    navigationRequested: { view: string; workspaceId?: string };
    workspaceChanged: { workspaceId: string | null };
  }>();

  // Props for dependency injection
  export let workspaceManager: WorkspaceManager;
  export let spineManager: SpineItemManager;
  export let onWorkspaceChange: ((workspaceId: string | null) => void) | null = null;
  export let currentWorkspaceId: string | null = null;

  // Component state
  let workspaces: WorkspaceInfo[] = [];
  let currentWorkspace: WorkspaceInfo | null = null;
  let loading = true;
  let error: string | null = null;
  let hasUnsavedChanges = false;
  let guardId: string;

  // Reactive: Update currentWorkspace when prop changes
  $: {
    if (currentWorkspaceId && workspaces.length > 0) {
      currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || null;
    } else {
      currentWorkspace = null;
    }
  }

  // Helper to update workspace selection and notify parent
  const setCurrentWorkspace = (workspaceId: string | null) => {
    if (workspaceId) {
      currentWorkspace = workspaces.find(w => w.id === workspaceId) || null;
      localStorage.setItem('currentWorkspace', workspaceId);
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

  // Reactive: load workspaces when manager becomes available
  $: if (workspaceManager) {
    loadWorkspaces();
  }

  // Load workspaces from WorkspaceManager
  const loadWorkspaces = async () => {
    if (!workspaceManager) return; // Guard against undefined
    
    try {
      loading = true;
      error = null;
      workspaces = await workspaceManager.listWorkspacesWithMetadata();
      loadCurrentWorkspace();
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      error = $t('Failed to load workspaces');
      workspaces = [];
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

  // Handle create new workspace
  const handleCreateNew = async () => {
    try {
      loading = true;
      
      // Get current locale for localized content
      const locale = $currentLocale;
      const metadata = createMinimalEPUBMetadata();
      
      // Use enhanced workspace creation with localized sample content
      const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace(metadata, locale);

      // Refresh workspace list
      await loadWorkspaces();

      // Set as current workspace
      setCurrentWorkspace(workspaceId);

      // Navigate to first content (prologue) for immediate preview
      dispatch('navigationRequested', {
        view: 'text',
        workspaceId,
        spineItemId: 'prologue',
      });

      dispatch('workspaceOpened', { workspaceId });
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

        // TODO: Implement EPUB import in WorkspaceManager
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
      setCurrentWorkspace(workspaceId);

      // Smart navigation: check for spine items first
      try {
        const spineItems = await spineManager.loadSpineItems(workspaceId);
        
        if (spineItems.length > 0) {
          // Navigate to first spine item
          const firstSpineItem = spineItems[0];
          window.dispatchEvent(new CustomEvent('select-spine-item', {
            detail: { itemId: firstSpineItem.id }
          }));
          // Navigation to spine view happens automatically via existing event handler in App.svelte
        } else {
          // Fallback to metadata view if no spine items
          dispatch('navigationRequested', {
            view: 'metadata',
            workspaceId,
          });
        }
      } catch (spineError) {
        // Error loading spine items - fallback to metadata view
        console.warn('Failed to load spine items, falling back to metadata view:', spineError);
        dispatch('navigationRequested', {
          view: 'metadata',
          workspaceId,
        });
      }

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

  // Handle workspace deletion
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
      await workspaceManager.deleteWorkspace(workspaceId);

      // If this was the current workspace, clear it
      if (currentWorkspaceId === workspaceId) {
        setCurrentWorkspace(null);
      }

      // Refresh workspace list
      await loadWorkspaces();
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

  // Handle cleanup of orphaned workspaces
  const handleCleanupOrphaned = async () => {
    const errorWorkspaces = workspaces.filter(w => w.hasError).length;
    
    if (errorWorkspaces === 0) {
      alert($t('No corrupted workspaces found to clean up.'));
      return;
    }

    const confirmed = confirm(
      $t('Clean up {count} corrupted workspace(s)? This will permanently delete workspaces that cannot be loaded properly.', {
        count: errorWorkspaces,
      })
    );

    if (!confirmed) return;

    try {
      loading = true;
      const result = await workspaceManager.cleanupOrphanedWorkspaces();
      
      // Show results
      if (result.cleaned.length > 0) {
        alert(
          $t('Successfully cleaned up {count} corrupted workspace(s).', {
            count: result.cleaned.length,
          })
        );
      }
      
      if (result.errors.length > 0) {
        console.error('Cleanup errors:', result.errors);
        alert(
          $t('Some workspaces could not be cleaned: {errors}', {
            errors: result.errors.join(', '),
          })
        );
      }

      // Refresh workspace list
      await loadWorkspaces();
    } catch (err) {
      console.error('Failed to cleanup orphaned workspaces:', err);
      alert(
        $t('Failed to cleanup workspaces: {error}', {
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      );
    } finally {
      loading = false;
    }
  };

  // Handle current workspace actions
  const handleSwitchWorkspace = () => {
    // Just scroll to workspace list for now
    const workspaceListElement = document.querySelector('.workspace-list');
    if (workspaceListElement) {
      workspaceListElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCloseWorkspace = () => {
    if (hasUnsavedChanges) {
      const confirmed = confirm($t('You have unsaved workspace changes. Continue?'));
      if (!confirmed) return;
    }

    setCurrentWorkspace(null);
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
    // Load workspaces when entering view (safe to call anytime)
    if (workspaceManager) {
      loadWorkspaces();
    }
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

  export function setViewData(_data: any): void {
    if (_data.currentWorkspaceId) {
      setCurrentWorkspace(_data.currentWorkspaceId);
    }
    if (_data.hasUnsavedChanges !== undefined) {
      hasUnsavedChanges = _data.hasUnsavedChanges;
    }
  }

  // Component lifecycle
  onMount(async () => {
    // Register navigation guard
    guardId = navigationStore.addNavigationGuard(canLeave);
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
    <!-- Current Workspace Bar -->
    <CurrentWorkspaceBar
      {currentWorkspace}
      on:switchRequested={handleSwitchWorkspace}
      on:closeRequested={handleCloseWorkspace}
    />

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

    <!-- Cleanup Banner (show when there are error workspaces) -->
    {#if workspaces.some(w => w.hasError)}
      <div class="cleanup-banner">
        <span class="cleanup-icon" aria-hidden="true">🧹</span>
        <span class="cleanup-text">
          {$t('{count} corrupted workspace(s) detected', {
            count: workspaces.filter(w => w.hasError).length,
          })}
        </span>
        <button type="button" class="cleanup-button" on:click={handleCleanupOrphaned}>
          {$t('Clean Up')}
        </button>
      </div>
    {/if}

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
