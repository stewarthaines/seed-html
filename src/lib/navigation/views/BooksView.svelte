<!--
  BooksView — the Books screen: a Start row (New book, Open an EPUB, Sample
  books) and the shelf of books, covers largest. Clicking a cover opens the
  book; Duplicate and Delete live in each book's menu. Replaces the two-pane
  Projects view (process/APP_MAKEOVER_LIBRARY.md, phase 1); the export
  actions that page carried now sit on the Share tab.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { t } from '../../i18n';
  import { navigationStore } from '../navigation-store';
  import { persisted, asString } from '../../state/persisted.svelte.js';
  import type {
    WorkspaceInfo,
    WorkspaceRowDetails,
  } from '../../services/workspace/workspace.service.js';
  import { BooksShelf, DeleteBookDialog } from '../../components/books';
  import OPDSImportDialog from '../../components/workspace/OPDSImportDialog.svelte';
  import DuplicateProjectDialog from '../../components/workspace/DuplicateProjectDialog.svelte';

  let {
    onListWorkspaces,
    onCreateNewRequested,
    onDeleteWorkspace,
    onDuplicateWorkspace,
    onLoadWorkspace,
    onLoadWorkspaceDetails,
    onLoadCoverImage,
    onEpubImportRequested,
    onWorkspaceOpened,
    onWorkspaceChanged,
    currentWorkspaceId = null,
    advancedMode = false,
  }: {
    onListWorkspaces: () => Promise<WorkspaceInfo[]>;
    onCreateNewRequested: () => void;
    onDeleteWorkspace: (id: string) => Promise<void>;
    onDuplicateWorkspace: (id: string, title?: string) => Promise<string>;
    onLoadWorkspace: (id: string) => Promise<void>;
    onLoadWorkspaceDetails: (id: string) => Promise<WorkspaceRowDetails>;
    /** The full-size cover, for the shelf; the row thumbnail stands in until it arrives. */
    onLoadCoverImage?: (id: string) => Promise<{ buffer: ArrayBuffer; mediaType: string } | null>;
    onEpubImportRequested: (file?: File, sourceUrl?: string) => Promise<void>;
    /** Called once a book has been loaded from the shelf; the app navigates into it. */
    onWorkspaceOpened?: (workspaceId: string) => void;
    onWorkspaceChanged?: (workspaceId: string | null) => void;
    currentWorkspaceId?: string | null;
    advancedMode?: boolean;
  } = $props();

  let workspaces = $state<WorkspaceInfo[]>([]);
  let covers = $state<Record<string, string | null>>({});
  let details = $state<Record<string, WorkspaceRowDetails>>({});
  let loading = $state(false);
  let error = $state<string | null>(null);
  let guardId: string | null = null;

  let showOpdsDialog = $state(false);
  let duplicateTarget = $state<WorkspaceInfo | null>(null);
  let deleteTarget = $state<WorkspaceInfo | null>(null);

  // The catalog import needs a network; the standalone file has none.
  const isFileUrl = typeof window !== 'undefined' && window.location.protocol === 'file:';

  // Persisted current workspace id (removed from storage when set to null).
  const currentWorkspace = persisted<string | null>('currentWorkspace', null, asString);

  const books = $derived(
    [...workspaces]
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
      .map(w => ({
        id: w.id,
        title: w.title || $t('Untitled Project'),
        author: w.author,
        lastModified: w.lastModified,
        coverUrl: covers[w.id] ?? null,
        readOnly: details[w.id]?.readOnly,
        hasError: w.hasError,
      }))
  );

  const loadWorkspaces = async () => {
    try {
      loading = true;
      error = null;
      workspaces = await onListWorkspaces();
      // Row details carry the cover thumbnail; fetch them together, tolerating
      // a failure on any one row.
      const rows = await Promise.all(
        workspaces.map(async w => {
          try {
            return [w.id, await onLoadWorkspaceDetails(w.id)] as const;
          } catch {
            return [w.id, null] as const;
          }
        })
      );
      const nextCovers: Record<string, string | null> = {};
      const nextDetails: Record<string, WorkspaceRowDetails> = {};
      for (const [id, row] of rows) {
        nextCovers[id] = row?.coverThumbUrl ?? null;
        if (row) nextDetails[id] = row;
      }
      covers = nextCovers;
      details = nextDetails;
      await loadFullCovers(workspaces.map(w => w.id));
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      error = $t('Failed to load projects');
      workspaces = [];
    } finally {
      loading = false;
    }
  };

  // Full-size covers replace the 256px row thumbnails once loaded. Blob URLs
  // are revoked when replaced and when the view goes away.
  let fullCoverUrls: string[] = [];
  const revokeFullCovers = () => {
    for (const url of fullCoverUrls) URL.revokeObjectURL(url);
    fullCoverUrls = [];
  };
  const loadFullCovers = async (ids: string[]) => {
    if (!onLoadCoverImage) return;
    const loaded = await Promise.all(
      ids.map(async id => {
        try {
          const image = await onLoadCoverImage(id);
          if (!image) return null;
          const url = URL.createObjectURL(new Blob([image.buffer], { type: image.mediaType }));
          return [id, url] as const;
        } catch {
          return null;
        }
      })
    );
    revokeFullCovers();
    const next = { ...covers };
    for (const entry of loaded) {
      if (!entry) continue;
      next[entry[0]] = entry[1];
      fullCoverUrls.push(entry[1]);
    }
    covers = next;
  };

  const setCurrentWorkspace = async (workspaceId: string | null) => {
    currentWorkspace.current = workspaceId;
    if (workspaceId) {
      await onLoadWorkspace(workspaceId);
    }
    onWorkspaceChanged?.(workspaceId);
  };

  const handleOpen = async (workspaceId: string) => {
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

  const handleLoadEpub = async () => {
    try {
      loading = true;
      await onEpubImportRequested();
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

  const handleOpdsImport = async (sourceUrl: string) => {
    await onEpubImportRequested(undefined, sourceUrl);
    await loadWorkspaces();
    showOpdsDialog = false;
  };

  const handleDuplicate = (id: string) => {
    duplicateTarget = workspaces.find(w => w.id === id) ?? null;
  };

  const duplicateDefaultTitle = $derived(
    `${duplicateTarget?.title || $t('Untitled Project')} (copy)`
  );

  const handleDuplicateConfirm = async (title: string) => {
    const target = duplicateTarget;
    if (!target) return;
    try {
      loading = true;
      await onDuplicateWorkspace(target.id, title);
      await loadWorkspaces();
      duplicateTarget = null;
    } finally {
      loading = false;
    }
  };

  const handleDelete = (id: string) => {
    deleteTarget = workspaces.find(w => w.id === id) ?? null;
  };

  const handleDeleteConfirm = async () => {
    const target = deleteTarget;
    if (!target) return;
    const wasCurrent = currentWorkspaceId === target.id;
    try {
      await onDeleteWorkspace(target.id);
      await loadWorkspaces();
      if (wasCurrent) await setCurrentWorkspace(null);
      deleteTarget = null;
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      throw err;
    }
  };

  // Navigation guard — nothing on this screen holds unsaved state, but the
  // guard slot is kept so the view can grow one.
  export async function canLeave(): Promise<boolean> {
    return true;
  }

  const handleWorkspaceListRefresh = () => {
    loadWorkspaces();
  };

  onMount(async () => {
    guardId = navigationStore.addNavigationGuard(canLeave);
    window.addEventListener('workspace-list-refresh', handleWorkspaceListRefresh);
    await loadWorkspaces();
  });

  onDestroy(() => {
    revokeFullCovers();
    if (guardId) navigationStore.removeNavigationGuard(guardId);
    if (typeof window !== 'undefined') {
      window.removeEventListener('workspace-list-refresh', handleWorkspaceListRefresh);
    }
  });
</script>

<div class="books-view">
  <div class="books-page">
    <h1 class="page-title">{$t('Books')}</h1>

    {#if error}
      <div class="error-banner" role="alert">
        <span class="error-text">{error}</span>
        <button type="button" class="btn btn-secondary btn-sm" onclick={loadWorkspaces}>
          {$t('Retry')}
        </button>
      </div>
    {/if}

    <p class="label">{$t('Start')}</p>
    <div class="start-row">
      <button
        type="button"
        class="btn btn-secondary"
        onclick={onCreateNewRequested}
        disabled={loading}
        data-testid="create-project"
      >
        {$t('New book')}
      </button>
      <button type="button" class="btn btn-secondary" onclick={handleLoadEpub} disabled={loading}>
        {$t('Open an EPUB…')}
      </button>
      {#if !isFileUrl}
        <button
          type="button"
          class="btn btn-link"
          onclick={() => (showOpdsDialog = true)}
          disabled={loading}
          data-testid="import-from-catalog"
        >
          {$t('Sample books…')}
        </button>
      {/if}
    </div>

    <BooksShelf
      {books}
      currentBookId={currentWorkspaceId}
      isLoading={loading && workspaces.length === 0}
      onOpen={handleOpen}
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
    />
  </div>

  {#if showOpdsDialog}
    <OPDSImportDialog
      {advancedMode}
      onImport={handleOpdsImport}
      onClose={() => (showOpdsDialog = false)}
    />
  {/if}

  {#if duplicateTarget}
    <DuplicateProjectDialog
      defaultTitle={duplicateDefaultTitle}
      onDuplicate={handleDuplicateConfirm}
      onClose={() => (duplicateTarget = null)}
    />
  {/if}

  {#if deleteTarget}
    <DeleteBookDialog
      title={deleteTarget.title || $t('Untitled Project')}
      author={deleteTarget.author}
      coverUrl={covers[deleteTarget.id] ?? null}
      onConfirm={handleDeleteConfirm}
      onClose={() => (deleteTarget = null)}
    />
  {/if}
</div>

<style>
  .books-view {
    min-block-size: 100%;
    background: var(--color-bg-primary);
  }

  .books-page {
    max-inline-size: 1040px;
    margin-inline: auto;
    padding-block: var(--space-8) var(--space-8);
    padding-inline: var(--space-6);
  }

  .page-title {
    margin: 0 0 var(--space-6);
    font-size: var(--text-4xl);
    font-weight: var(--font-bold);
    letter-spacing: -0.01em;
    color: var(--color-text-primary);
  }

  .label {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .start-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    margin-block-end: var(--space-8);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-block-end: var(--space-4);
    padding-block: var(--space-2);
    padding-inline: var(--space-3);
    border: 1px solid var(--color-border-error);
    background: var(--color-bg-error);
    color: var(--color-error-text);
  }
</style>
