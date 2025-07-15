<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n';

  export let filterText = '';
  export let loading = false;

  const dispatch = createEventDispatcher();

  let dragActive = false;
  let fileInputRef: HTMLInputElement;

  const handleFilterInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const newFilterText = target.value;
    dispatch('filterChange', { filterText: newFilterText });
  };

  const handleLoadFileClick = () => {
    fileInputRef?.click();
  };

  const handleFileInputChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      dispatch('fileUpload', { files: target.files });
      target.value = ''; // Clear the input
    }
  };

  const handleCreateTextClick = () => {
    dispatch('createItem', { mode: 'create-text' });
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    dragActive = true;
  };

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault();
    dragActive = false;
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    dragActive = false;
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      dispatch('fileUpload', { files: event.dataTransfer.files });
    }
  };

  const handleClearFilter = () => {
    dispatch('filterChange', { filterText: '' });
  };
</script>

<div 
  class="manifest-toolbar"
  class:drag-active={dragActive}
  role="toolbar"
  aria-label={$t('Manifest actions')}
  tabindex="0"
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
>
  <!-- Filter input -->
  <div class="filter-section">
    <label for="manifest-filter" class="filter-label">
      {$t('Filter')}:
    </label>
    <div class="filter-input-container">
      <input
        id="manifest-filter"
        type="text"
        class="filter-input"
        placeholder={$t('Filter by ID, path, or media type...')}
        value={filterText}
        on:input={handleFilterInput}
        disabled={loading}
      />
      {#if filterText}
        <button
          type="button"
          class="clear-filter-button"
          aria-label={$t('Clear filter')}
          on:click={handleClearFilter}
        >
          ×
        </button>
      {/if}
    </div>
  </div>

  <!-- Action buttons -->
  <div class="action-buttons">
    <button
      type="button"
      class="action-button primary"
      on:click={handleLoadFileClick}
      disabled={loading}
    >
      📁 {$t('Load File')}
    </button>
    
    <button
      type="button"
      class="action-button secondary"
      on:click={handleCreateTextClick}
      disabled={loading}
    >
      📝 {$t('Create Text File')}
    </button>
  </div>

  <!-- Hidden file input -->
  <input
    bind:this={fileInputRef}
    type="file"
    multiple
    accept="*/*"
    style="display: none;"
    on:change={handleFileInputChange}
  />

  <!-- Drag and drop overlay -->
  {#if dragActive}
    <div class="drag-overlay">
      <div class="drag-message">
        <p>{$t('Drop files here to add them to the manifest')}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .manifest-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background-color: var(--color-surface-primary);
    border-block-end: 1px solid var(--color-border-default);
    position: relative;
    min-height: 3rem;
  }

  .filter-section {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    max-width: 400px;
  }

  .filter-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .filter-input-container {
    position: relative;
    flex: 1;
  }

  .filter-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    padding-inline-end: 2rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    transition: border-color 0.2s ease;
  }

  .filter-input:focus {
    outline: none;
    border-color: var(--color-focus-ring);
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }

  .filter-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .filter-input::placeholder {
    color: var(--color-text-placeholder);
  }

  .clear-filter-button {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    font-size: 1.25rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
    transition: color 0.2s ease;
  }

  .clear-filter-button:hover {
    color: var(--color-text-primary);
  }

  .clear-filter-button:focus {
    outline: none;
    color: var(--color-text-primary);
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .action-button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .action-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .action-button.primary {
    background-color: var(--color-primary);
    color: var(--color-surface);
    border-color: var(--color-primary);
  }

  .action-button.primary:hover:not(:disabled) {
    background-color: var(--color-interactive-primary-hover);
    border-color: var(--color-interactive-primary-hover);
  }

  .action-button.secondary {
    background-color: var(--color-surface);
    color: var(--color-text-primary);
  }

  .action-button.secondary:hover:not(:disabled) {
    background-color: var(--color-interactive-secondary-hover);
    border-color: var(--color-interactive-secondary-hover);
  }

  .action-button:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }

  .drag-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(var(--color-primary-rgb), 0.1);
    border: 2px dashed var(--color-primary);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .drag-message {
    padding: 1rem;
    background-color: var(--color-surface);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
  }

  .drag-message p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-primary);
    text-align: center;
  }

  .drag-active {
    background-color: rgba(var(--color-primary-rgb), 0.05);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .manifest-toolbar {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .filter-section {
      max-width: none;
    }

    .action-buttons {
      justify-content: center;
    }
  }
</style>