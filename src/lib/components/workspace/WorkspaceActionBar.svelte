<script lang="ts">
  import { t } from '../../i18n';

  let {
    isLoading = false,
    onCreateNewRequested,
    onLoadEpubRequested,
    onImportFromOPDSRequested,
    onDuplicateRequested,
    currentProjectTitle,
  }: {
    isLoading?: boolean;
    onCreateNewRequested?: () => void;
    onLoadEpubRequested?: () => void;
    onImportFromOPDSRequested?: () => void;
    onDuplicateRequested?: () => void;
    currentProjectTitle?: string;
  } = $props();

  const handleCreateNew = () => {
    onCreateNewRequested?.();
  };

  const handleLoadEpub = () => {
    onLoadEpubRequested?.();
  };

  const handleImportFromOPDS = () => {
    onImportFromOPDSRequested?.();
  };

  const handleDuplicate = () => {
    onDuplicateRequested?.();
  };

  // Future: import from folder functionality
  const _handleImportFolder = () => {
    // Placeholder for future implementation
    console.log('Import from folder - coming soon');
  };
</script>

<div class="workspace-action-bar">
  <div class="action-buttons">
    <button
      type="button"
      class="btn btn-secondary"
      onclick={handleCreateNew}
      disabled={isLoading}
      aria-label={$t('Create a new minimal EPUB project')}
      data-testid="create-project"
    >
      {$t('Create New')}
    </button>

    <button
      type="button"
      class="btn btn-secondary"
      onclick={handleLoadEpub}
      disabled={isLoading}
      aria-label={$t('Import an existing EPUB file for editing')}
    >
      {$t('Import from File')}
    </button>

    <!-- OPDS import reaches the network; shown only when a handler is wired
         (the Projects view omits it when running offline from a file:// URL). -->
    {#if onImportFromOPDSRequested}
      <button
        type="button"
        class="btn btn-secondary"
        onclick={handleImportFromOPDS}
        disabled={isLoading}
        aria-label={$t('Import an EPUB from a catalog URL')}
      >
        {$t('Import from Catalog')}
      </button>
    {/if}

    <!-- Duplicate the current project; shown only when a project is loaded. -->
    {#if onDuplicateRequested}
      <button
        type="button"
        class="btn btn-secondary"
        onclick={handleDuplicate}
        disabled={isLoading}
        aria-label={$t('Duplicate the current project: {name}', {
          name: currentProjectTitle ?? '',
        })}
      >
        {$t('Duplicate')}
      </button>
    {/if}
  </div>
</div>

<style>
  /* Query the pane width (not the viewport) so the grid reflows with the split. */
  .workspace-action-bar {
    container-type: inline-size;
  }

  /* Flat, app-standard CTAs — all identical. Responsive grid: one row → 2×2 →
     single column as the pane narrows. */
  .action-buttons {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-2);
  }

  @container (max-width: 34rem) {
    .action-buttons {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container (max-width: 17rem) {
    .action-buttons {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
