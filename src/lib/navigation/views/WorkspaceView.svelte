<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { navigationStore } from '../navigation-store';
  import { t, currentLocale } from '../../i18n';
  import type { EPUBMetadata } from '../../epub/opf-utils';
  import WorkspaceActionBar from '../../components/workspace/WorkspaceActionBar.svelte';
  import WorkspaceList from '../../components/workspace/WorkspaceList.svelte';
  import OPDSImportDialog from '../../components/workspace/OPDSImportDialog.svelte';

  // Service layer types for return values
  import type {
    WorkspaceInfo,
    WorkspaceRowDetails,
  } from '../../services/workspace/workspace.service.js';

  // Props using Svelte 5 runes syntax
  let {
    onListWorkspaces,
    onCreateWorkspace,
    onDeleteWorkspace,
    onLoadWorkspace,
    onLoadWorkspaceDetails,
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
    onLoadWorkspaceDetails: (id: string) => Promise<WorkspaceRowDetails>;
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
  let loading = $state(false);
  let error = $state<string | null>(null);
  let hasUnsavedChanges = $state(false);
  let showOpdsDialog = $state(false);
  let guardId = $state<string>('');

  // Service layer handles state directly - no reactive subscriptions needed

  // Helper to update workspace selection and notify parent
  const setCurrentWorkspace = async (workspaceId: string | null) => {
    if (workspaceId) {
      localStorage.setItem('currentWorkspace', workspaceId);

      // Load workspace using callback
      try {
        await onLoadWorkspace(workspaceId);
      } catch (error) {
        console.error('Failed to load workspace:', error);
      }
    } else {
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
    creator: [{ name: 'Unknown', roles: [] }],
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
        language: locale,
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

  // Open the OPDS import dialog
  const handleImportFromOPDS = () => {
    showOpdsDialog = true;
  };

  // Import the chosen book from the OPDS feed, reusing the EPUB-from-URL path.
  const handleOpdsImport = async (sourceUrl: string) => {
    await onEpubImportRequested(undefined, sourceUrl);
    await loadWorkspaces();
    showOpdsDialog = false;
  };

  // Handle workspace selection (open workspace) with smart navigation
  const handleWorkspaceSelect = async (detail: { workspaceId: string }) => {
    const { workspaceId } = detail;

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
  const handleWorkspaceDelete = async (detail: { workspaceId: string }) => {
    const { workspaceId } = detail;
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

  // Navigation guard
  export async function canLeave(): Promise<boolean> {
    if (hasUnsavedChanges) {
      return window.confirm($t('You have unsaved project changes. Continue?'));
    }
    return true;
  }

  // ViewComponent interface implementation
  export function onViewEnter(_data?: any): void {
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
  <!-- Shares the editor's pane key so the split proportion is one global value. -->
  <div class="workspace-panes-wrap">
    <PaneGroup direction="horizontal" autoSaveId="editme-content-panes">
      <!-- Left: the list of existing projects. -->
      <Pane defaultSize={50} minSize={25}>
        <div class="workspace-pane">
          <h2 class="pane-title">{$t('Projects')}</h2>

          {#if error}
            <div class="error-banner">
              <span class="error-icon" aria-hidden="true">⚠️</span>
              <span class="error-text">{error}</span>
              <button type="button" class="btn btn-secondary" onclick={loadWorkspaces}>
                {$t('Retry')}
              </button>
            </div>
          {/if}

          <WorkspaceList
            {workspaces}
            {currentWorkspaceId}
            {onLoadWorkspaceDetails}
            isLoading={loading}
            onWorkspaceSelected={handleWorkspaceSelect}
            onWorkspaceDeleted={handleWorkspaceDelete}
          />

          {#if hasUnsavedChanges}
            <div class="unsaved-indicator">
              <span class="indicator-icon" aria-hidden="true">⚠️</span>
              <span>{$t('You have unsaved changes')}</span>
            </div>
          {/if}
        </div>
      </Pane>

      <PaneResizer />

      <!-- Right: the ways to start a new project. -->
      <Pane defaultSize={50} minSize={20}>
        <div class="workspace-pane">
          <h2 class="pane-title">{$t('Get Started')}</h2>

          <WorkspaceActionBar
            isLoading={loading}
            onCreateNewRequested={handleCreateNew}
            onLoadEpubRequested={handleLoadEpub}
            onImportFromOPDSRequested={handleImportFromOPDS}
          />
        </div>
      </Pane>
    </PaneGroup>
  </div>

  {#if showOpdsDialog}
    <OPDSImportDialog onImport={handleOpdsImport} onClose={() => (showOpdsDialog = false)} />
  {/if}
</div>

<style>
  .workspace-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .workspace-panes-wrap {
    flex: 1;
    min-height: 0;
  }

  .workspace-pane {
    height: 100%;
    overflow-y: auto;
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .pane-title {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text-primary);
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
    .workspace-pane {
      padding: var(--space-4);
    }
  }
</style>
