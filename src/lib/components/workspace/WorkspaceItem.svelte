<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../i18n';
  import type {
    WorkspaceInfo,
    WorkspaceRowDetails,
  } from '../../services/workspace/workspace.service.js';

  let {
    workspace,
    isCurrent = false,
    hasError = false,
    onLoadWorkspaceDetails = undefined,
    onSelected,
    onDeleteRequested,
  }: {
    workspace: WorkspaceInfo;
    isCurrent?: boolean;
    hasError?: boolean;
    onLoadWorkspaceDetails?: (id: string) => Promise<WorkspaceRowDetails>;
    onSelected?: (detail: { workspaceId: string }) => void;
    onDeleteRequested?: (detail: { workspaceId: string }) => void;
  } = $props();

  // Per-row details (file count, extensions, cover thumbnail) are loaded
  // lazily after the list renders, so the Projects view appears instantly.
  // The thumbnail is a data URL (persistently cached in the service layer),
  // so there is no blob-URL lifecycle to manage here.
  let details = $state<WorkspaceRowDetails | null>(null);
  const coverUrl = $derived(details?.coverThumbUrl ?? null);

  onMount(async () => {
    if (!onLoadWorkspaceDetails) return;
    try {
      details = await onLoadWorkspaceDetails(workspace.id);
    } catch {
      // Row details are non-critical; leave them unshown on failure.
    }
  });

  const handleSelect = () => {
    onSelected?.({ workspaceId: workspace.id });
  };

  const handleDeleteRequest = (event: Event) => {
    event.stopPropagation(); // Prevent workspace selection
    onDeleteRequested?.({ workspaceId: workspace.id });
  };

  // Format relative time
  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) {
      return $t('Just now');
    } else if (hours < 24) {
      return $t('{count}h ago', { count: hours });
    } else if (days === 1) {
      return $t('1 day ago');
    } else if (days < 7) {
      return $t('{count} days ago', { count: days });
    } else {
      return $t('{count}w ago', { count: Math.floor(days / 7) });
    }
  };
</script>

<div class="workspace-item" class:current={isCurrent} class:error={hasError || workspace.hasError}>
  <button
    type="button"
    class="workspace-select"
    onclick={handleSelect}
    aria-label={$t('Open project: {title}', { title: workspace.title })}
  >
    <div class="workspace-main">
      <div class="workspace-icon-container">
        {#if hasError || workspace.hasError}
          <span
            class="workspace-icon error"
            aria-label={$t('Error')}
            title={$t('Project has errors')}>⚠️</span
          >
        {:else if coverUrl}
          <img src={coverUrl} alt="" class="workspace-cover" aria-hidden="true" />
        {:else}
          <span class="workspace-icon" aria-hidden="true">📖</span>
        {/if}
      </div>

      <div class="workspace-info">
        <div class="workspace-header">
          <h3 class="workspace-title">
            {workspace.title}
            {#if workspace.author}
              <span class="workspace-author-inline"> - {workspace.author}</span>
            {/if}
            {#if isCurrent}
              <span class="current-badge" aria-label={$t('Currently open')}>{$t('Current')}</span>
            {/if}
            {#if details?.readOnly}
              <span
                class="readonly-badge"
                title={$t('Not created in the Simple EPUB Editor — viewable but not editable.')}
              >
                {$t('Read-only')}
              </span>
            {/if}
          </h3>
          <span class="workspace-time">{getRelativeTime(workspace.lastModified)}</span>
        </div>

        <div class="workspace-meta">
          <span class="workspace-language">{workspace.language}</span>
          <span class="meta-separator">•</span>
          <span class="workspace-stats">
            {#if details}
              {details.fileCount}
              {$t('files')}
              {#if details.extensionIds && details.extensionIds.length > 0}
                • {details.extensionIds.join(', ')}
              {/if}
            {:else}
              <span class="stats-loading">…</span>
            {/if}
          </span>
        </div>
      </div>
    </div>
  </button>

  <!-- Delete is offered only on the open project, so the user sees it populated
       in the sidebar before deciding to remove it. -->
  {#if isCurrent}
    <div class="workspace-actions">
      <button
        type="button"
        class="btn btn-danger"
        onclick={handleDeleteRequest}
        aria-label={$t('Delete project: {title}', { title: workspace.title })}
        title={$t('Delete project')}
      >
        {$t('Delete')}
      </button>
    </div>
  {/if}
</div>

<style>
  .workspace-item {
    position: relative; /* anchor the select button's full-row hit area */
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-primary);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    margin-block-end: var(--space-3);
    min-height: 44px; /* Accessibility: min touch target */
  }

  .workspace-item:hover {
    border-color: var(--color-border-hover);
    background-color: var(--color-surface-hover);
    box-shadow: var(--shadow-sm);
  }

  /* The selectable area is a real button so the row isn't an interactive control
     wrapping the delete button (which would nest interactive controls). It fills the
     row and resets button chrome so the appearance is unchanged. */
  .workspace-select {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  /* Stretch the select button's hit area over the whole row so a click anywhere
     (not just the label) opens the project. The delete button is lifted above it. */
  .workspace-select::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .workspace-select:focus-visible {
    outline: none;
    border-color: var(--color-interactive-primary);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  /* Current project: the shared azure left-bar + tint convention (the card
     keeps its default border rather than a full blue one). */
  .workspace-item.current {
    box-shadow: inset 3px 0 0 var(--color-accent);
    background-color: var(--color-bg-active);
  }

  .workspace-item.current:hover {
    background-color: var(--color-bg-active);
  }

  .workspace-item.error {
    border-color: var(--color-warning);
    background-color: var(--color-warning-surface);
  }

  .workspace-item.error:hover {
    border-color: var(--color-warning-hover);
  }

  .workspace-main {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex: 1;
    min-width: 0; /* Allow content to shrink */
  }

  .workspace-icon-container {
    flex-shrink: 0;
  }

  /* Full-height cover: the fixed-size thumbnail bleeds through the row's
     vertical padding to sit flush with the card's top/bottom edges (it sets
     the row height), inset half a step from the left so the current-project
     bar stays visible. */
  .workspace-icon-container:has(.workspace-cover) {
    margin: calc(-1 * var(--space-4)) 0 calc(-1 * var(--space-4)) calc(-1 * var(--space-2));
  }

  .workspace-icon {
    font-size: 1.5rem;
    display: block;
  }

  .workspace-cover {
    display: block;
    width: 4rem;
    aspect-ratio: 2 / 3;
    /* Thumbnails keep their source proportions (image-thumbnail.ts) — crop
       non-2:3 covers to fill the tile instead of distorting them. */
    object-fit: cover;
  }

  .workspace-icon.error {
    font-size: 1.25rem;
    color: var(--color-warning);
  }

  .workspace-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .workspace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .workspace-title {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
    min-width: 0;
  }

  .current-badge {
    font-size: var(--text-xs);
    font-weight: 500;
    padding: 2px var(--space-1);
    background-color: var(--color-accent);
    color: var(--color-on-accent);
    border-radius: var(--radius-xs);
    flex-shrink: 0;
  }

  .readonly-badge {
    font-size: var(--text-xs);
    font-weight: 500;
    padding: 2px var(--space-1);
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-xs);
    flex-shrink: 0;
  }

  .workspace-time {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .workspace-meta {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    overflow: hidden;
  }

  .workspace-author-inline {
    color: var(--color-text-secondary);
    font-weight: 400;
  }

  .meta-separator {
    flex-shrink: 0;
    opacity: 0.6;
  }

  .workspace-language {
    flex-shrink: 0;
    text-transform: uppercase;
    font-weight: 500;
  }

  .workspace-stats {
    flex-shrink: 0;
  }

  .workspace-actions {
    position: relative; /* sit above the select button's full-row overlay */
    z-index: 1;
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  /* Mobile adjustments */
  @media (max-width: 640px) {
    .workspace-item {
      padding: var(--space-3);
    }

    .workspace-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-1);
    }

    .workspace-time {
      order: -1;
      align-self: flex-end;
    }

    .workspace-meta {
      flex-wrap: wrap;
    }

    .workspace-stats {
      flex: 1 0 100%;
      margin-block-start: var(--space-1);
    }
  }

  /* Smaller mobile screens */
  @media (max-width: 480px) {
    .workspace-main {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
    }

    .workspace-icon-container {
      align-self: center;
    }

    .workspace-info {
      width: 100%;
    }

    .workspace-actions {
      align-self: center;
    }
  }
</style>
