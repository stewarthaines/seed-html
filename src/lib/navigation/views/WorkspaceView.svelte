<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { navigationStore } from '../navigation-store';
  import { t, currentLocale } from '../../i18n';
  import WorkspaceActionBar from '../../components/workspace/WorkspaceActionBar.svelte';
  import WorkspaceList from '../../components/workspace/WorkspaceList.svelte';
  import OPDSImportDialog from '../../components/workspace/OPDSImportDialog.svelte';
  import CreateProjectDialog, {
    type CreateProjectData,
  } from '../../components/workspace/CreateProjectDialog.svelte';
  import type { ExtensionCatalogEntry } from '../../extensions/extension-catalog';

  // Service layer types for return values
  import type {
    WorkspaceInfo,
    WorkspaceRowDetails,
  } from '../../services/workspace/workspace.service.js';

  // Props using Svelte 5 runes syntax
  let {
    onListWorkspaces,
    onCreateProject,
    onDeleteWorkspace,
    onDuplicateWorkspace,
    onLoadWorkspace,
    onLoadWorkspaceDetails,
    onEpubImportRequested,
    onWorkspaceChange = null,
    onWorkspaceOpened,
    onWorkspaceChanged,
    currentWorkspaceId = null,
    availableExtensions = [],
  }: {
    onListWorkspaces: () => Promise<WorkspaceInfo[]>;
    /** Create a project from the new-project dialog and open its first chapter. */
    onCreateProject: (data: CreateProjectData) => Promise<void>;
    onDeleteWorkspace: (id: string) => Promise<void>;
    onDuplicateWorkspace: (id: string) => Promise<string>;
    onLoadWorkspace: (id: string) => Promise<void>;
    onLoadWorkspaceDetails: (id: string) => Promise<WorkspaceRowDetails>;
    onEpubImportRequested: (file?: File, sourceUrl?: string) => Promise<void>;
    onWorkspaceChange?: ((workspaceId: string | null) => void) | null;
    onWorkspaceOpened?: (workspaceId: string) => void;
    onWorkspaceChanged?: (workspaceId: string | null) => void;
    currentWorkspaceId?: string | null;
    /** Extensions catalog (empty unless served over HTTP); the dialog offers text formats. */
    availableExtensions?: ExtensionCatalogEntry[];
  } = $props();

  // Component state using $state()
  let workspaces = $state<WorkspaceInfo[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let hasUnsavedChanges = $state(false);
  let showOpdsDialog = $state(false);
  let showCreateDialog = $state(false);

  // Only text-format extensions (markup languages) are offered in the create dialog.
  const textFormats = $derived(availableExtensions.filter(e => e.textTransforms.length > 0));

  // OPDS import fetches over the network, which is pointless (and CORS-blocked)
  // when the app runs offline from a file:// URL — the standalone SEED.html /
  // Active EPUB case. Hide the option there.
  const isFileUrl = typeof location !== 'undefined' && location.protocol === 'file:';

  // Title of the currently-loaded project, for the "Duplicate …" button label.
  const currentProjectTitle = $derived(workspaces.find(w => w.id === currentWorkspaceId)?.title);
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

  // "Create New" now opens the new-project dialog (title/author/language +
  // text-format choice) instead of creating from hardcoded metadata.
  const handleCreateNew = () => {
    showCreateDialog = true;
  };

  // Confirm from the dialog: App owns the end-to-end create (project + metadata +
  // chosen text-format extension) and navigates into the first chapter.
  const handleCreateConfirm = async (data: CreateProjectData) => {
    await onCreateProject(data);
    showCreateDialog = false;
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

  // Duplicate the current project, then select the copy (staying on Projects).
  const handleDuplicate = async () => {
    if (!currentWorkspaceId) return;
    try {
      loading = true;
      const newId = await onDuplicateWorkspace(currentWorkspaceId);
      await loadWorkspaces();
      await setCurrentWorkspace(newId);
    } catch (err) {
      console.error('Failed to duplicate project:', err);
      alert(
        $t('Failed to duplicate project: {error}', {
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

  // Handle workspace selection: load it as the current project but stay on the
  // Projects view (no navigation), so the list is stable and the duplicate
  // action can target the selection. Opening into the editor is via the sidebar.
  const handleWorkspaceSelect = async (detail: { workspaceId: string }) => {
    const { workspaceId } = detail;

    try {
      await setCurrentWorkspace(workspaceId);
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
            onImportFromOPDSRequested={isFileUrl ? undefined : handleImportFromOPDS}
            {currentProjectTitle}
            onDuplicateRequested={currentWorkspaceId ? handleDuplicate : undefined}
          />
        </div>
      </Pane>
    </PaneGroup>
  </div>

  {#if showOpdsDialog}
    <OPDSImportDialog onImport={handleOpdsImport} onClose={() => (showOpdsDialog = false)} />
  {/if}

  {#if showCreateDialog}
    <CreateProjectDialog
      {textFormats}
      defaultLanguage={$currentLocale}
      onCreate={handleCreateConfirm}
      onClose={() => (showCreateDialog = false)}
    />
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
