<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n';
  import type { WorkspaceInfo } from '../../workspace/types';

  const dispatch = createEventDispatcher();

  export let currentWorkspace: WorkspaceInfo | null = null;

  const handleSwitchRequest = () => {
    dispatch('switchRequested');
  };

  const handleCloseRequest = () => {
    dispatch('closeRequested');
  };
</script>

<div class="current-workspace-bar">
  {#if currentWorkspace}
    <div class="workspace-info">
      <span class="workspace-icon" aria-hidden="true">📖</span>
      <div class="workspace-details">
        <span class="workspace-title">{currentWorkspace.title}</span>
        <span class="workspace-meta">
          {currentWorkspace.author || $t('Unknown')} • {currentWorkspace.language}
        </span>
      </div>
    </div>
    <div class="workspace-actions">
      <button
        type="button"
        class="action-button"
        on:click={handleSwitchRequest}
        aria-label={$t('Switch workspace')}
      >
        {$t('Switch')}
      </button>
      <button
        type="button"
        class="action-button close-button"
        on:click={handleCloseRequest}
        aria-label={$t('Close workspace')}
      >
        {$t('Close')}
      </button>
    </div>
  {:else}
    <div class="no-workspace">
      <span class="workspace-icon" aria-hidden="true">📂</span>
      <span class="no-workspace-text">{$t('No workspace selected')}</span>
    </div>
  {/if}
</div>

<style>
  .current-workspace-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4);
    background-color: var(--color-surface-primary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    margin-block-end: var(--space-6);
  }

  .workspace-info {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex: 1;
    min-width: 0; /* Allow flex item to shrink */
  }

  .workspace-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .workspace-details {
    display: flex;
    flex-direction: column;
    min-width: 0; /* Allow text to truncate */
  }

  .workspace-title {
    font-weight: 600;
    color: var(--color-text-primary);
    font-size: var(--text-base);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workspace-meta {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workspace-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .action-button {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    min-height: 44px; /* Accessibility: min touch target */
    min-width: 44px;
  }

  .action-button:hover {
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-hover);
  }

  .action-button:focus-visible {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .close-button {
    background-color: var(--color-surface-tertiary);
    color: var(--color-text-secondary);
  }

  .close-button:hover {
    background-color: var(--color-error-bg);
    border-color: var(--color-error);
    color: var(--color-error);
  }

  .no-workspace {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .no-workspace-text {
    font-size: var(--text-base);
  }

  /* Responsive adjustments */
  @media (max-width: 480px) {
    .current-workspace-bar {
      flex-direction: column;
      gap: var(--space-3);
      align-items: stretch;
    }

    .workspace-info {
      justify-content: center;
    }

    .workspace-actions {
      justify-content: center;
    }

    .action-button {
      flex: 1;
    }
  }
</style>
