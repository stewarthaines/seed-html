<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n';
  import type { WorkspaceInfo } from '../../services/workspace/workspace.service.js';

  const dispatch = createEventDispatcher<{
    selected: { workspaceId: string };
    deleteRequested: { workspaceId: string };
  }>();

  export let workspace: WorkspaceInfo;
  export let isCurrent = false;
  export let hasError = false;

  const handleSelect = () => {
    dispatch('selected', { workspaceId: workspace.id });
  };

  const handleDeleteRequest = (event: Event) => {
    event.stopPropagation(); // Prevent workspace selection
    dispatch('deleteRequested', { workspaceId: workspace.id });
  };


  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelect();
    }
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

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };
</script>

<div
  class="workspace-item"
  class:current={isCurrent}
  class:error={hasError || workspace.hasError}
  role="button"
  tabindex="0"
  onclick={handleSelect}
  onkeydown={handleKeyDown}
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
        </h3>
        <span class="workspace-time">{getRelativeTime(workspace.lastModified)}</span>
      </div>

      <div class="workspace-meta">
        <span class="workspace-language">{workspace.language}</span>
        <span class="meta-separator">•</span>
        <span class="workspace-stats">
          {workspace.fileCount}
          {$t('files')}
          {#if workspace.totalSize > 0}
            • {formatFileSize(workspace.totalSize)}
          {/if}
          {#if workspace.extensionIds && workspace.extensionIds.length > 0}
            • {workspace.extensionIds.join(', ')}
          {/if}
        </span>
      </div>
    </div>
  </div>

  <div class="workspace-actions">
    <button
      type="button"
      class="delete-button"
      onclick={handleDeleteRequest}
      aria-label={$t('Delete project: {title}', { title: workspace.title })}
      title={$t('Delete project')}
    >
      <span aria-hidden="true">🗑️</span>
    </button>
  </div>
</div>

<style>
  .workspace-item {
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

  .workspace-item:focus-visible {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .workspace-item.current {
    border-color: var(--color-primary);
    background-color: var(--color-primary-surface);
  }

  .workspace-item.current:hover {
    border-color: var(--color-primary-hover);
    background-color: var(--color-primary-surface-hover);
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

  .workspace-icon {
    font-size: 1.5rem;
    display: block;
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
    background-color: var(--color-primary);
    color: var(--color-surface);
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
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .delete-button {
    min-width: 44px; /* Accessibility: min touch target */
    min-height: 44px;
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-secondary);
    color: var(--color-text-secondary);
    font-size: 1.25rem;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .delete-button:hover {
    border-color: var(--color-error);
    background-color: var(--color-error-surface);
    color: var(--color-error);
  }

  .delete-button:focus-visible {
    outline: none;
    border-color: var(--color-error);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
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
