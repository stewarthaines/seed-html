<script lang="ts">
  import { t } from '../../i18n';

  let {
    isLoading = false,
    onCreateNewRequested,
    onLoadEpubRequested,
  }: {
    isLoading?: boolean;
    onCreateNewRequested?: () => void;
    onLoadEpubRequested?: () => void;
  } = $props();

  const handleCreateNew = () => {
    onCreateNewRequested?.();
  };

  const handleLoadEpub = () => {
    onLoadEpubRequested?.();
  };

  // Future: import from folder functionality
  const _handleImportFolder = () => {
    // Placeholder for future implementation
    console.log('Import from folder - coming soon');
  };
</script>

<div class="workspace-action-bar">
  <h3 class="section-title">{$t('Get Started')}</h3>
  <div class="action-buttons">
    <button
      type="button"
      class="action-button primary"
      onclick={handleCreateNew}
      disabled={isLoading}
      aria-label={$t('Create a new minimal EPUB project')}
    >
      <span class="button-icon" aria-hidden="true">➕</span>
      <div class="button-content">
        <span class="button-title">{$t('Create New')}</span>
        <span class="button-subtitle">{$t('Start fresh')}</span>
      </div>
    </button>

    <button
      type="button"
      class="action-button secondary"
      onclick={handleLoadEpub}
      disabled={isLoading}
      aria-label={$t('Load an existing EPUB file for editing')}
    >
      <span class="button-icon" aria-hidden="true">📁</span>
      <div class="button-content">
        <span class="button-title">{$t('Load EPUB')}</span>
        <span class="button-subtitle">{$t('Edit existing file')}</span>
      </div>
    </button>
    <!--
    <button
      type="button"
      class="action-button secondary disabled"
      onclick={handleImportFolder}
      disabled={true}
      aria-label={$t('Import from folder - coming soon')}
      title={$t('Coming soon')}
    >
      <span class="button-icon" aria-hidden="true">📂</span>
      <div class="button-content">
        <span class="button-title">{$t('From Folder')}</span>
        <span class="button-subtitle">{$t('Future')}</span>
      </div>
    </button>
    -->
  </div>
</div>

<style>
  .workspace-action-bar {
    margin-block-end: var(--space-6);
  }

  .section-title {
    margin: 0 0 var(--space-4) 0;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .action-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15em, 1fr));
    gap: var(--space-4);
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 2px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
    font-family: inherit;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    text-align: left;
    min-height: 80px; /* Accessibility: larger touch target */
    position: relative;
  }

  .action-button:not(:disabled):hover {
    border-color: var(--color-border-hover);
    background-color: var(--color-surface-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .action-button:focus-visible {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .action-button.primary {
    border-color: var(--color-primary);
    background-color: var(--color-primary);
    color: var(--color-surface);
  }

  .action-button.primary:not(:disabled):hover {
    border-color: var(--color-primary-hover);
    background-color: var(--color-primary-hover);
  }

  .action-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .action-button:disabled:hover {
    border-color: var(--color-border-default);
    background-color: var(--color-surface-primary);
    transform: none;
    box-shadow: none;
  }

  .action-button.primary:disabled:hover {
    border-color: var(--color-primary);
    background-color: var(--color-primary);
  }

  .button-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .button-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
    min-width: 0;
  }

  .button-title {
    font-size: var(--text-base);
    font-weight: 600;
    line-height: 1.2;
  }

  .button-subtitle {
    font-size: var(--text-sm);
    opacity: 0.8;
    line-height: 1.2;
  }

  .action-button.primary .button-subtitle {
    opacity: 0.9;
  }

  /* Loading state */
  .action-button:disabled .button-icon {
    opacity: 0.5;
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .action-buttons {
      grid-template-columns: 1fr;
      gap: var(--space-3);
    }

    .action-button {
      min-height: 70px;
      padding: var(--space-3);
    }

    .button-icon {
      font-size: 1.5rem;
    }
  }

  /* Smaller mobile adjustments */
  @media (max-width: 480px) {
    .action-button {
      flex-direction: column;
      text-align: center;
      gap: var(--space-2);
      min-height: 90px;
    }

    .button-content {
      align-items: center;
    }
  }
</style>
