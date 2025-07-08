<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n';
  import WorkspaceItem from './WorkspaceItem.svelte';
  import type { WorkspaceInfo } from '../../workspace/types';

  const dispatch = createEventDispatcher<{
    workspaceSelected: { workspaceId: string };
    workspaceDeleted: { workspaceId: string };
  }>();

  export let workspaces: WorkspaceInfo[] = [];
  export let currentWorkspaceId: string | null = null;
  export let isLoading = false;

  let searchQuery = '';

  // Filter workspaces based on search query
  $: filteredWorkspaces = workspaces.filter(workspace => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      workspace.title.toLowerCase().includes(query) ||
      workspace.author?.toLowerCase().includes(query) ||
      workspace.language.toLowerCase().includes(query)
    );
  });

  // Sort workspaces: current first, then by last modified
  $: sortedWorkspaces = [...filteredWorkspaces].sort((a, b) => {
    // Current workspace always first
    if (a.id === currentWorkspaceId) return -1;
    if (b.id === currentWorkspaceId) return 1;
    
    // Then by last modified (most recent first)
    return b.lastModified.getTime() - a.lastModified.getTime();
  });

  const handleWorkspaceSelect = (event: CustomEvent<{ workspaceId: string }>) => {
    dispatch('workspaceSelected', event.detail);
  };

  const handleWorkspaceDelete = (event: CustomEvent<{ workspaceId: string }>) => {
    dispatch('workspaceDeleted', event.detail);
  };

  const handleSearchInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    searchQuery = target.value;
  };

  const clearSearch = () => {
    searchQuery = '';
  };
</script>

<div class="workspace-list">
  <div class="list-header">
    <h3 class="list-title">
      {#if workspaces.length === 0}
        {$t('Workspaces')}
      {:else}
        {$t('Workspaces ({count} total)', { count: workspaces.length })}
      {/if}
    </h3>

    {#if workspaces.length > 0}
      <div class="search-container">
        <div class="search-input-wrapper">
          <input
            type="search"
            class="search-input"
            placeholder={$t('Search workspaces...')}
            value={searchQuery}
            on:input={handleSearchInput}
            aria-label={$t('Search workspaces')}
          />
          {#if searchQuery}
            <button
              type="button"
              class="clear-search"
              on:click={clearSearch}
              aria-label={$t('Clear search')}
            >
              ×
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <div class="list-content">
    {#if isLoading}
      <div class="loading-state">
        <div class="skeleton-item" aria-hidden="true"></div>
        <div class="skeleton-item" aria-hidden="true"></div>
        <div class="skeleton-item" aria-hidden="true"></div>
        <p class="loading-text">{$t('Loading workspaces...')}</p>
      </div>
    {:else if workspaces.length === 0}
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">📚</div>
        <h4 class="empty-title">{$t('No workspaces yet')}</h4>
        <p class="empty-description">
          {$t('Get started by creating your first EPUB')}
        </p>
        <div class="empty-tips">
          <h5 class="tips-title">{$t('Quick Start Tips:')}</h5>
          <ul class="tips-list">
            <li>{$t('Create New: Start with a template or blank project')}</li>
            <li>{$t('Import EPUB: Convert existing .epub files to edit')}</li>
            <li>{$t('All your work is saved automatically')}</li>
          </ul>
        </div>
      </div>
    {:else if filteredWorkspaces.length === 0}
      <div class="no-results">
        <div class="no-results-icon" aria-hidden="true">🔍</div>
        <h4 class="no-results-title">{$t('No workspaces found')}</h4>
        <p class="no-results-description">
          {$t('No workspaces match your search for "{query}"', { query: searchQuery })}
        </p>
        <button type="button" class="clear-search-button" on:click={clearSearch}>
          {$t('Clear search')}
        </button>
      </div>
    {:else}
      <div class="workspace-grid">
        {#each sortedWorkspaces as workspace (workspace.id)}
          <WorkspaceItem
            {workspace}
            isCurrent={workspace.id === currentWorkspaceId}
            hasError={workspace.hasError || false}
            on:selected={handleWorkspaceSelect}
            on:deleteRequested={handleWorkspaceDelete}
          />
        {/each}
      </div>

      {#if searchQuery && filteredWorkspaces.length < workspaces.length}
        <div class="search-results-info">
          <p class="results-text">
            {$t('Showing {filtered} of {total} workspaces', {
              filtered: filteredWorkspaces.length,
              total: workspaces.length
            })}
          </p>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .workspace-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .list-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .list-title {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .search-container {
    display: flex;
    justify-content: flex-end;
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
    border-color: var(--color-primary);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .search-input::placeholder {
    color: var(--color-text-tertiary);
  }

  .clear-search {
    position: absolute;
    top: 50%;
    inset-inline-end: var(--space-2);
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-tertiary);
    color: var(--color-text-secondary);
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-search:hover {
    background-color: var(--color-surface-hover);
    color: var(--color-text-primary);
  }

  .list-content {
    min-height: 200px;
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
    0%, 100% { opacity: 0.6; }
    50% { opacity: 0.8; }
  }

  .loading-text {
    text-align: center;
    color: var(--color-text-secondary);
    font-style: italic;
    margin: var(--space-4) 0 0 0;
  }

  .empty-state {
    text-align: center;
    padding: var(--space-8) var(--space-4);
    color: var(--color-text-secondary);
  }

  .empty-icon {
    font-size: 4rem;
    margin-block-end: var(--space-4);
    display: block;
  }

  .empty-title {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .empty-description {
    margin: 0 0 var(--space-6) 0;
    font-size: var(--text-base);
  }

  .empty-tips {
    max-width: 400px;
    margin: 0 auto;
    text-align: left;
  }

  .tips-title {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .tips-list {
    margin: 0;
    padding-inline-start: var(--space-4);
    list-style-type: disc;
  }

  .tips-list li {
    margin-block-end: var(--space-1);
    font-size: var(--text-sm);
    line-height: 1.5;
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

  .clear-search-button {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-md);
    background-color: transparent;
    color: var(--color-primary);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .clear-search-button:hover {
    background-color: var(--color-primary);
    color: var(--color-surface);
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
    .list-header {
      gap: var(--space-2);
    }

    .search-container {
      justify-content: stretch;
    }

    .search-input-wrapper {
      max-width: none;
    }

    .empty-state {
      padding: var(--space-6) var(--space-2);
    }

    .empty-icon {
      font-size: 3rem;
    }

    .empty-tips {
      text-align: center;
    }
  }
</style>