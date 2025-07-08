<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { navigationStore } from '../navigation-store';
  import { t } from '../../i18n';
  import { WorkspaceManager } from '../../workspace/workspace-manager';
  import type { WorkspaceInfo } from '../../workspace/types';
  import type { EPUBMetadata } from '../../epub/opf-utils';
  import CurrentWorkspaceBar from '../../components/workspace/CurrentWorkspaceBar.svelte';
  import WorkspaceActionBar from '../../components/workspace/WorkspaceActionBar.svelte';
  import WorkspaceList from '../../components/workspace/WorkspaceList.svelte';

  const dispatch = createEventDispatcher<{
    workspaceOpened: { workspaceId: string };
    navigationRequested: { view: string; workspaceId?: string };
  }>();

  // Initialize WorkspaceManager
  const workspaceManager = new WorkspaceManager();

  // Component state
  let workspaces: WorkspaceInfo[] = [];
  let currentWorkspaceId: string | null = null;
  let currentWorkspace: WorkspaceInfo | null = null;
  let loading = true;
  let error: string | null = null;
  let hasUnsavedChanges = false;
  let guardId: string;

  // Load current workspace from localStorage
  const loadCurrentWorkspace = () => {
    const stored = localStorage.getItem('currentWorkspace');
    if (stored && workspaces.find(w => w.id === stored)) {
      currentWorkspaceId = stored;
      currentWorkspace = workspaces.find(w => w.id === stored) || null;
    } else {
      currentWorkspaceId = null;
      currentWorkspace = null;
      localStorage.removeItem('currentWorkspace');
    }
  };

  // Load workspaces from WorkspaceManager
  const loadWorkspaces = async () => {
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
  const createMinimalEPUBMetadata = (): EPUBMetadata => ({
    title: 'Untitled Book Project',
    language: 'en',
    identifier: crypto.randomUUID(),
    creator: ['Unknown'],
  });

  // Handle create new workspace
  const handleCreateNew = async () => {
    try {
      loading = true;
      const metadata = createMinimalEPUBMetadata();
      const workspaceId = await workspaceManager.createEPUBWorkspace(metadata);

      // Refresh workspace list
      await loadWorkspaces();

      // Set as current workspace
      currentWorkspaceId = workspaceId;
      currentWorkspace = workspaces.find(w => w.id === workspaceId) || null;
      localStorage.setItem('currentWorkspace', workspaceId);

      // Navigate to metadata view
      dispatch('navigationRequested', {
        view: 'metadata',
        workspaceId,
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

  // Handle workspace selection (open workspace)
  const handleWorkspaceSelect = async (event: CustomEvent<{ workspaceId: string }>) => {
    const { workspaceId } = event.detail;

    try {
      // Set as current workspace
      currentWorkspaceId = workspaceId;
      currentWorkspace = workspaces.find(w => w.id === workspaceId) || null;
      localStorage.setItem('currentWorkspace', workspaceId);

      // Navigate to workspace (metadata view)
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
        currentWorkspaceId = null;
        currentWorkspace = null;
        localStorage.removeItem('currentWorkspace');
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

    currentWorkspaceId = null;
    currentWorkspace = null;
    localStorage.removeItem('currentWorkspace');
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

  export function setViewData(data: any): void {
    if (data.currentWorkspaceId) {
      currentWorkspaceId = data.currentWorkspaceId;
    }
    if (data.hasUnsavedChanges !== undefined) {
      hasUnsavedChanges = data.hasUnsavedChanges;
    }
  }

  // Component lifecycle
  onMount(async () => {
    // Initialize workspace manager
    await workspaceManager.init();

    // Register navigation guard
    guardId = navigationStore.addNavigationGuard(canLeave);

    // Call onViewEnter
    onViewEnter();
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
    background-color: var(--color-background);
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
    .view-header {
      padding: var(--space-4);
    }

    .view-content {
      padding: var(--space-4);
    }

    .view-title {
      font-size: var(--text-xl);
    }

    .view-description {
      font-size: var(--text-sm);
    }
  }
</style>
