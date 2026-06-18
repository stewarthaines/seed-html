<script lang="ts">
  import { t } from '../../i18n';
  import WorkspaceItem from './WorkspaceItem.svelte';
  import PaneHeader from '../layout/PaneHeader.svelte';
  import type {
    WorkspaceInfo,
    WorkspaceRowDetails,
  } from '../../services/workspace/workspace.service.js';
  import { X } from 'phosphor-svelte';

  let {
    workspaces = [],
    currentWorkspaceId = null,
    isLoading = false,
    onLoadWorkspaceDetails = undefined,
    onWorkspaceSelected,
    onWorkspaceDeleted,
  }: {
    workspaces?: WorkspaceInfo[];
    currentWorkspaceId?: string | null;
    isLoading?: boolean;
    onLoadWorkspaceDetails?: (id: string) => Promise<WorkspaceRowDetails>;
    onWorkspaceSelected?: (detail: { workspaceId: string }) => void;
    onWorkspaceDeleted?: (detail: { workspaceId: string }) => void;
  } = $props();

  let searchQuery = $state('');

  // Filter workspaces based on search query
  const filteredWorkspaces = $derived(
    workspaces.filter(workspace => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        workspace.title.toLowerCase().includes(query) ||
        workspace.author?.toLowerCase().includes(query) ||
        workspace.language.toLowerCase().includes(query)
      );
    })
  );

  // Remember the list scroll position across reloads/navigation. Restored once,
  // after the rows have rendered (so there's height to scroll to).
  const SCROLL_KEY = 'editme_projects_scroll';
  let listEl = $state<HTMLDivElement>();
  let scrollRestored = false;

  $effect(() => {
    // Touch the reactive deps so this re-runs once rows are present.
    const ready = !!listEl && !isLoading && filteredWorkspaces.length > 0;
    if (!ready || scrollRestored) return;
    scrollRestored = true;
    try {
      const y = Number(localStorage.getItem(SCROLL_KEY));
      if (y > 0 && listEl) listEl.scrollTop = y;
    } catch {
      // Ignore unavailable storage.
    }
  });

  // Throttle to one write per frame so scrolling stays smooth.
  let scrollSaveQueued = false;
  const saveScroll = () => {
    if (scrollSaveQueued) return;
    scrollSaveQueued = true;
    requestAnimationFrame(() => {
      scrollSaveQueued = false;
      try {
        localStorage.setItem(SCROLL_KEY, String(listEl?.scrollTop ?? 0));
      } catch {
        // Ignore unavailable storage.
      }
    });
  };

  // Sort workspaces by last modified (most recent first)
  const sortedWorkspaces = $derived(
    [...filteredWorkspaces].sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
  );

  const handleSearchInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    searchQuery = target.value;
  };

  const clearSearch = () => {
    searchQuery = '';
  };
</script>

<div class="workspace-list">
  <PaneHeader>
    <div class="search-input-wrapper">
      <input
        type="search"
        class="search-input"
        placeholder={$t('Search projects…')}
        value={searchQuery}
        oninput={handleSearchInput}
        aria-label={$t('Search projects')}
      />
      {#if searchQuery}
        <button
          type="button"
          class="btn btn-icon clear-search"
          onclick={clearSearch}
          aria-label={$t('Clear search')}
        >
          <X size={14} aria-hidden="true" />
        </button>
      {/if}
    </div>
  </PaneHeader>

  <div class="list-content" bind:this={listEl} onscroll={saveScroll}>
    {#if isLoading}
      <div class="loading-state">
        <div class="skeleton-item" aria-hidden="true"></div>
        <div class="skeleton-item" aria-hidden="true"></div>
        <div class="skeleton-item" aria-hidden="true"></div>
        <p class="loading-text">{$t('Loading projects…')}</p>
      </div>
    {:else if workspaces.length === 0}
      <!-- No projects yet — the "Get Started" panel alongside is the first-run guide. -->
    {:else if filteredWorkspaces.length === 0}
      <div class="no-results">
        <div class="no-results-icon" aria-hidden="true">🔍</div>
        <h3 class="no-results-title">{$t('No projects found')}</h3>
        <p class="no-results-description">
          {$t('No projects match your search for "{query}"', { query: searchQuery })}
        </p>
        <button type="button" class="btn btn-secondary" onclick={clearSearch}>
          {$t('Clear search')}
        </button>
      </div>
    {:else}
      <div class="workspace-grid">
        {#each sortedWorkspaces as workspace (workspace.id)}
          <WorkspaceItem
            {workspace}
            {onLoadWorkspaceDetails}
            isCurrent={workspace.id === currentWorkspaceId}
            hasError={workspace.hasError || false}
            onSelected={onWorkspaceSelected}
            onDeleteRequested={onWorkspaceDeleted}
          />
        {/each}
      </div>

      {#if searchQuery && filteredWorkspaces.length < workspaces.length}
        <div class="search-results-info">
          <p class="results-text">
            {$t('Showing {filtered} of {total} workspaces', {
              filtered: filteredWorkspaces.length,
              total: workspaces.length,
            })}
          </p>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .workspace-list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .search-input-wrapper {
    position: relative;
    max-width: 300px;
    width: 100%;
  }

  .search-input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    padding-inline-end: var(--space-8); /* Space for clear button */
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    transition: all var(--duration-fast) ease;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-interactive-primary);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .search-input::placeholder {
    color: var(--color-text-tertiary);
  }

  /* Overlay the shared .btn .btn-icon inside the search field; positioning only. */
  .clear-search {
    position: absolute;
    top: 50%;
    inset-inline-end: var(--space-2);
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
  }

  .list-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-4);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .skeleton-item {
    height: 80px;
    background-color: var(--color-surface-tertiary);
    border-radius: var(--radius-md);
    animation: pulse 2s infinite;
    opacity: 0.6;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 0.8;
    }
  }

  .loading-text {
    text-align: center;
    color: var(--color-text-secondary);
    font-style: italic;
    margin: var(--space-4) 0 0 0;
  }

  .no-results {
    text-align: center;
    padding: var(--space-8) var(--space-4);
    color: var(--color-text-secondary);
  }

  .no-results-icon {
    font-size: 3rem;
    margin-block-end: var(--space-4);
    display: block;
    opacity: 0.6;
  }

  .no-results-title {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .no-results-description {
    margin: 0 0 var(--space-4) 0;
    font-size: var(--text-base);
  }

  .workspace-grid {
    display: flex;
    flex-direction: column;
    gap: 0; /* WorkspaceItem has its own margin-bottom */
  }

  .search-results-info {
    margin-block-start: var(--space-4);
    padding-block-start: var(--space-4);
    border-block-start: 1px solid var(--color-border-default);
  }

  .results-text {
    margin: 0;
    text-align: center;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    font-style: italic;
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .search-input-wrapper {
      max-width: none;
    }
  }
</style>
