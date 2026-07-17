<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { navigationStore } from '../navigation-store';
  import { persisted, asString } from '../../state/persisted.svelte.js';
  import { t, currentLocale } from '../../i18n';
  import { languageDisplayName } from '../../epub/bcp47';
  import WorkspaceActionBar from '../../components/workspace/WorkspaceActionBar.svelte';
  import WorkspaceList from '../../components/workspace/WorkspaceList.svelte';
  import OPDSImportDialog from '../../components/workspace/OPDSImportDialog.svelte';
  import PaneHeader from '../../components/layout/PaneHeader.svelte';
  import DuplicateProjectDialog from '../../components/workspace/DuplicateProjectDialog.svelte';

  // Service layer types for return values
  import type {
    WorkspaceInfo,
    WorkspaceRowDetails,
  } from '../../services/workspace/workspace.service.js';

  // Props using Svelte 5 runes syntax
  let {
    onListWorkspaces,
    onCreateNewRequested,
    onDeleteWorkspace,
    onDuplicateWorkspace,
    onLoadWorkspace,
    onLoadWorkspaceDetails,
    onLoadCoverImage,
    onEpubImportRequested,
    onWorkspaceChange = null,
    onWorkspaceOpened,
    onWorkspaceChanged,
    currentWorkspaceId = null,
    advancedMode = false,
    isReadOnly = false,
    onGeneratePdf,
    pdfGenerating = false,
    onPackageWithoutSeed,
    packaging = false,
    onPackageAsReadHtml,
    readHtmlPackaging = false,
  }: {
    onListWorkspaces: () => Promise<WorkspaceInfo[]>;
    /** Open the (app-owned) new-project dialog. */
    onCreateNewRequested: () => void;
    onDeleteWorkspace: (id: string) => Promise<void>;
    onDuplicateWorkspace: (id: string, title?: string) => Promise<string>;
    onLoadWorkspace: (id: string) => Promise<void>;
    onLoadWorkspaceDetails: (id: string) => Promise<WorkspaceRowDetails>;
    /** Full-resolution cover bytes for the detail panel (cards use the cached thumbnail). */
    onLoadCoverImage: (id: string) => Promise<{ buffer: ArrayBuffer; mediaType: string } | null>;
    onEpubImportRequested: (file?: File, sourceUrl?: string) => Promise<void>;
    onWorkspaceChange?: ((workspaceId: string | null) => void) | null;
    onWorkspaceOpened?: (workspaceId: string) => void;
    onWorkspaceChanged?: (workspaceId: string | null) => void;
    currentWorkspaceId?: string | null;
    /** Advanced mode unlocks typing an arbitrary catalog URL in the import dialog. */
    advancedMode?: boolean;
    /** The active project is a read-only (imported) book — export actions disabled. */
    isReadOnly?: boolean;
    /** Export the active project to PDF. Omitted when PDF export isn't available
        (offline file:// build); the button hides then. */
    onGeneratePdf?: () => void;
    pdfGenerating?: boolean;
    /** Export the active project as a plain EPUB (no SEED.zip/SEED.html). */
    onPackageWithoutSeed?: () => void;
    packaging?: boolean;
    /** Export the active project as a plain EPUB wrapped in the READ.html reader —
        one double-clickable file. Omitted when unavailable (offline file:// build). */
    onPackageAsReadHtml?: () => void;
    readHtmlPackaging?: boolean;
  } = $props();

  // Component state using $state()
  let workspaces = $state<WorkspaceInfo[]>([]);
  let loading = $state(false);
  let currentCoverUrl = $state<string | null>(null);

  // Load cover image whenever the selected project changes.
  $effect(() => {
    const id = currentWorkspaceId;
    currentCoverUrl = null;
    if (!id) return;

    let stale = false;
    let blobUrl: string | null = null;

    void onLoadCoverImage(id)
      .then(cover => {
        if (stale || !cover) return;
        blobUrl = URL.createObjectURL(new Blob([cover.buffer], { type: cover.mediaType }));
        currentCoverUrl = blobUrl;
      })
      .catch(() => {});

    return () => {
      stale = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        currentCoverUrl = null;
      }
    };
  });
  let error = $state<string | null>(null);
  let hasUnsavedChanges = $state(false);
  let showOpdsDialog = $state(false);
  let showDuplicateDialog = $state(false);

  // OPDS import fetches over the network, which is pointless (and CORS-blocked)
  // when the app runs offline from a file:// URL — the standalone SEED.html /
  // Active EPUB case. Hide the option there.
  const isFileUrl = typeof location !== 'undefined' && location.protocol === 'file:';

  // Summary info for the currently-selected project (drives the detail panel).
  const currentInfo = $derived(workspaces.find(w => w.id === currentWorkspaceId));
  // Title of the currently-loaded project, for the "Duplicate …" button label.
  const currentProjectTitle = $derived(currentInfo?.title);
  let guardId = $state<string>('');

  // Persisted current workspace id (removed from storage when set to null).
  const currentWorkspace = persisted<string | null>('currentWorkspace', null, asString);

  // Service layer handles state directly - no reactive subscriptions needed

  // Helper to update workspace selection and notify parent
  const setCurrentWorkspace = async (workspaceId: string | null) => {
    currentWorkspace.current = workspaceId;

    if (workspaceId) {
      // Load workspace using callback
      try {
        await onLoadWorkspace(workspaceId);
      } catch (error) {
        console.error('Failed to load workspace:', error);
      }
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

  // Open the duplicate dialog so the user can name the copy first.
  const handleDuplicate = () => {
    if (!currentWorkspaceId) return;
    showDuplicateDialog = true;
  };

  // Pre-filled title for the duplicate dialog: "<current title> (copy)".
  const duplicateDefaultTitle = $derived(`${currentProjectTitle ?? 'Untitled Project'} (copy)`);

  // Confirm from the dialog: duplicate with the chosen title, then select the
  // copy (staying on Projects).
  const handleDuplicateConfirm = async (title: string) => {
    if (!currentWorkspaceId) return;
    try {
      loading = true;
      const newId = await onDuplicateWorkspace(currentWorkspaceId, title);
      await loadWorkspaces();
      await setCurrentWorkspace(newId);
      showDuplicateDialog = false;
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

    // Capture this before deleting: onDeleteWorkspace clears the current workspace
    // when it's the one removed, so currentWorkspaceId would already be null below.
    const wasCurrent = currentWorkspaceId === workspaceId;

    try {
      loading = true;

      // Delete workspace using callback
      await onDeleteWorkspace(workspaceId);

      // Refresh workspace list
      await loadWorkspaces();

      // Deleting always removes the open project (delete is offered only there).
      // Move the selection to the top remaining project so the sidebar repopulates
      // immediately; clear it when none are left. The list is displayed
      // most-recently-modified first (see WorkspaceList), so match that ordering
      // rather than the raw onListWorkspaces() order.
      if (wasCurrent) {
        const top = [...workspaces].sort(
          (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
        )[0];
        await setCurrentWorkspace(top?.id ?? null);
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
    <PaneGroup direction="horizontal" autoSaveId="seedhtml-content-panes">
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
          <PaneHeader>
            <span class="pane-title">{$t('Get Started')}</span>
          </PaneHeader>
          <div class="workspace-pane-body">
            <WorkspaceActionBar
              isLoading={loading}
              {onCreateNewRequested}
              onLoadEpubRequested={handleLoadEpub}
              onImportFromOPDSRequested={isFileUrl ? undefined : handleImportFromOPDS}
              {currentProjectTitle}
              onDuplicateRequested={currentWorkspaceId ? handleDuplicate : undefined}
            />
            {#if currentInfo}
              <section class="active-project">
                <h2 class="active-project-heading">{$t('Currently Active Project')}</h2>
                <div class="book-detail">
                  {#if currentCoverUrl}
                    <img src={currentCoverUrl} alt="" class="cover-preview" />
                  {/if}

                  <h2 class="book-title">{currentInfo.title || $t('Untitled')}</h2>

                  {#if currentInfo.authors && currentInfo.authors.length > 0}
                    <p class="book-authors">{currentInfo.authors.join(', ')}</p>
                  {/if}

                  <dl class="book-facts">
                    {#if currentInfo.language}
                      <div class="book-fact">
                        <dt>{$t('Language')}</dt>
                        <dd>{languageDisplayName(currentInfo.language, $currentLocale)}</dd>
                      </div>
                    {/if}
                    {#if currentInfo.date}
                      <div class="book-fact">
                        <dt>{$t('Published')}</dt>
                        <dd>{currentInfo.date}</dd>
                      </div>
                    {/if}
                  </dl>

                  {#if currentInfo.description}
                    <p class="book-description">{currentInfo.description}</p>
                  {/if}

                  {#if onGeneratePdf || onPackageWithoutSeed || onPackageAsReadHtml}
                    <div class="book-actions">
                      {#if onGeneratePdf}
                        <button
                          type="button"
                          class="export-button"
                          onclick={onGeneratePdf}
                          disabled={pdfGenerating || isReadOnly}
                        >
                          {pdfGenerating ? $t('Preparing…') : $t('Generate PDF')}
                        </button>
                      {/if}
                      {#if onPackageWithoutSeed}
                        <button
                          type="button"
                          class="export-button"
                          onclick={onPackageWithoutSeed}
                          disabled={packaging || isReadOnly}
                          title={isReadOnly
                            ? $t(
                                "This EPUB wasn't created in the Simple EPUB Editor, so it can't be repackaged."
                              )
                            : undefined}
                        >
                          {packaging ? $t('Packaging…') : $t('Package EPUB without SEED')}
                        </button>
                      {/if}
                      {#if onPackageAsReadHtml}
                        <button
                          type="button"
                          class="export-button"
                          onclick={onPackageAsReadHtml}
                          disabled={readHtmlPackaging || isReadOnly}
                          title={isReadOnly
                            ? $t(
                                "This EPUB wasn't created in the Simple EPUB Editor, so it can't be repackaged."
                              )
                            : undefined}
                        >
                          {readHtmlPackaging ? $t('Packaging…') : $t('Package as READ.html')}
                        </button>
                      {/if}
                    </div>
                  {/if}
                </div>
              </section>
            {/if}
          </div>
        </div>
      </Pane>
    </PaneGroup>
  </div>

  {#if showOpdsDialog}
    <OPDSImportDialog
      {advancedMode}
      onImport={handleOpdsImport}
      onClose={() => (showOpdsDialog = false)}
    />
  {/if}

  {#if showDuplicateDialog}
    <DuplicateProjectDialog
      defaultTitle={duplicateDefaultTitle}
      onDuplicate={handleDuplicateConfirm}
      onClose={() => (showDuplicateDialog = false)}
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
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .workspace-pane-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-6);
  }

  .pane-title {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    margin: var(--space-4);
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
    margin: var(--space-4);
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

  /* Reading-system-style detail: centred cover, title and author, a small facts
     list, then the description. */
  /* The active-project preview, separated from the action buttons above by a
     rule and its own heading. */
  .active-project {
    margin-block-start: var(--space-6);
    padding-block-start: var(--space-6);
    border-block-start: 1px solid var(--color-border-default);
  }

  .active-project-heading {
    margin: 0;
    text-align: center;
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--color-text-secondary);
  }

  .book-detail {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-2);
    padding-block-start: var(--space-5);
    max-inline-size: 38rem;
    margin-inline: auto;
  }

  .cover-preview {
    max-height: 40vh;
    max-width: 50%;
    width: auto;
    margin-block-end: var(--space-4);
    border-radius: var(--radius-sm);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  }

  .book-title {
    margin: 0;
    font-size: var(--text-heading-lg);
    line-height: var(--leading-tight);
  }

  .book-authors {
    margin: 0;
    font-size: var(--text-lg);
    color: var(--color-text-secondary);
  }

  .book-facts {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2) var(--space-5);
    margin: var(--space-2) 0 0;
  }

  .book-fact {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .book-fact dt {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-secondary);
  }

  .book-fact dd {
    margin: 0;
    font-size: var(--text-sm);
  }

  .book-description {
    margin: var(--space-3) 0 0;
    text-align: start;
    color: var(--color-text-secondary);
    line-height: var(--leading-relaxed);
    white-space: pre-wrap;
  }

  /* Destination-format exports (PDF, plain EPUB) for the active project. */
  .book-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }

  /* Azure outline that fills on hover/focus — the app's export CTA convention
     (ported from the former Generate PDF button in Project Settings). */
  .export-button {
    display: block;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-accent);
    background: transparent;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      background-color var(--duration-fast) ease,
      color var(--duration-fast) ease;
  }

  .export-button:hover:not(:disabled),
  .export-button:focus-visible {
    background: var(--color-accent);
    color: var(--color-on-accent);
    outline: none;
  }

  .export-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .workspace-pane {
      padding: var(--space-4);
    }
  }
</style>
