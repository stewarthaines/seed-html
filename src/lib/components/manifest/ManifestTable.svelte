<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n';
  import type { ManifestItem, SourceItem, ValidationResult } from '../../manifest/types';

  export let manifestItems: ManifestItem[] = [];
  export let sourceItems: SourceItem[] = [];
  export let advancedMode = false;
  export let validationErrors: ValidationResult[] = [];
  export let selectedItem: ManifestItem | SourceItem | null = null;
  export let selectedItemType: 'manifest' | 'source' | null = null;
  export let loading = false;

  const dispatch = createEventDispatcher();

  // Filter state
  let filterText = '';
  let dragActive = false;
  let fileInputRef: HTMLInputElement;

  type SortableFields = 'id' | 'href' | 'size' | 'modified';
  let sortField: SortableFields = 'id';
  let sortDirection: 'asc' | 'desc' = 'asc';

  // Combine and filter items
  $: allItems = [
    ...manifestItems.map(item => ({ ...item, _type: 'manifest' as const })),
    ...(advancedMode ? sourceItems.map(item => ({ ...item, _type: 'source' as const })) : [])
  ];

  // Filter items based on filter text
  $: filteredItems = allItems.filter(item => {
    if (!filterText) return true;
    
    const searchText = filterText.toLowerCase();
    
    if (item._type === 'manifest') {
      const manifestItem = item as ManifestItem & { _type: 'manifest' };
      return (
        manifestItem.id.toLowerCase().includes(searchText) ||
        manifestItem.href.toLowerCase().includes(searchText) ||
        (manifestItem.properties?.some(prop => prop.toLowerCase().includes(searchText)) || false)
      );
    } else {
      const sourceItem = item as SourceItem & { _type: 'source' };
      return (
        sourceItem.name.toLowerCase().includes(searchText) ||
        sourceItem.path.toLowerCase().includes(searchText)
      );
    }
  });

  // Sort filtered items
  $: sortedItems = [...filteredItems].sort((a, b) => {
    let aValue: string | number | Date = '';
    let bValue: string | number | Date = '';

    if (sortField === 'id') {
      aValue = a._type === 'manifest' ? (a as ManifestItem).id : (a as SourceItem).name;
      bValue = b._type === 'manifest' ? (b as ManifestItem).id : (b as SourceItem).name;
    } else if (sortField === 'href') {
      aValue = a._type === 'manifest' ? (a as ManifestItem).href : (a as SourceItem).path;
      bValue = b._type === 'manifest' ? (b as ManifestItem).href : (b as SourceItem).path;
    } else if (sortField === 'size') {
      aValue = a.size || 0;
      bValue = b.size || 0;
    } else if (sortField === 'modified') {
      aValue = a.modified || new Date(0);
      bValue = b.modified || new Date(0);
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortableFields) => {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
  };

  const handleRowClick = (item: ManifestItem | SourceItem, type: 'manifest' | 'source') => {
    dispatch('itemSelect', { item, type });
  };

  const handleRowKeyDown = (event: KeyboardEvent, item: ManifestItem | SourceItem, type: 'manifest' | 'source') => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRowClick(item, type);
    }
  };

  const handleEditClick = (event: Event, item: ManifestItem) => {
    event.stopPropagation();
    dispatch('itemEdit', { item });
  };

  const handleDeleteClick = (event: Event, item: ManifestItem) => {
    event.stopPropagation();
    dispatch('itemDelete', { itemId: item.id });
  };

  const isItemSelected = (item: ManifestItem | SourceItem, type: 'manifest' | 'source') => {
    if (!selectedItem || selectedItemType !== type) return false;
    
    if (type === 'manifest') {
      return (item as ManifestItem).id === (selectedItem as ManifestItem).id;
    } else {
      return (item as SourceItem).path === (selectedItem as SourceItem).path;
    }
  };

  const getItemValidationErrors = (item: ManifestItem) => {
    return validationErrors.filter(error => error.itemId === item.id);
  };

  const hasValidationError = (item: ManifestItem) => {
    return getItemValidationErrors(item).length > 0;
  };

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return '-';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      // For today, show only time
      return new Intl.DateTimeFormat('en-US', {
        timeStyle: 'short'
      }).format(date);
    } else {
      // For other dates, show only date
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'short'
      }).format(date);
    }
  };

  const getSortIcon = (field: SortableFields) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // Toolbar event handlers
  const handleFilterInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    filterText = target.value;
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
    dispatch('itemCreate', { mode: 'create-text' });
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
    filterText = '';
  };
</script>

<div class="manifest-table-container">
  <!-- Toolbar -->
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

  <!-- Table container -->
  <div class="table-container">
  {#if sortedItems.length === 0}
    <div class="empty-state">
      {#if filterText}
        <p>{$t('No items match your filter')}</p>
        <p class="empty-state-subtitle">{$t('Try adjusting your search terms')}</p>
      {:else}
        <p>{$t('No manifest items found')}</p>
        <p class="empty-state-subtitle">{$t('Create your first item using the buttons above')}</p>
      {/if}
    </div>
  {:else}
    <table class="manifest-table">
      <thead>
        <tr>
          <th scope="col">
            <button 
              type="button" 
              class="sort-button" 
              on:click={() => handleSort('id')}
              aria-label={$t('Sort by ID')}
            >
              {$t('ID')} {getSortIcon('id')}
            </button>
          </th>
          <th scope="col">
            <button 
              type="button" 
              class="sort-button" 
              on:click={() => handleSort('href')}
              aria-label={$t('Sort by path')}
            >
              {$t('Path')} {getSortIcon('href')}
            </button>
          </th>
          <th scope="col">
            <button 
              type="button" 
              class="sort-button" 
              on:click={() => handleSort('size')}
              aria-label={$t('Sort by size')}
            >
              {$t('Size')} {getSortIcon('size')}
            </button>
          </th>
          <th scope="col">
            <button 
              type="button" 
              class="sort-button" 
              on:click={() => handleSort('modified')}
              aria-label={$t('Sort by modification date')}
            >
              {$t('Modified')} {getSortIcon('modified')}
            </button>
          </th>
          <th scope="col">{$t('Properties')}</th>
        </tr>
      </thead>
      <tbody>
        {#each sortedItems as item}
          {@const itemType = item._type}
          {@const isSelected = isItemSelected(item, itemType)}
          {@const hasError = itemType === 'manifest' ? hasValidationError(item as ManifestItem) : false}
          <tr
            class="manifest-row"
            class:selected={isSelected}
            class:error={hasError}
            class:source-item={itemType === 'source'}
            tabindex="0"
            aria-selected={isSelected}
            on:click={() => handleRowClick(item, itemType)}
            on:keydown={(event) => handleRowKeyDown(event, item, itemType)}
          >
            <td class="id-cell">
              {#if itemType === 'source'}
                <span class="source-icon">📁</span>
              {/if}
              <span class="item-id">
                {itemType === 'manifest' ? (item as ManifestItem).id : (item as SourceItem).name}
              </span>
            </td>
            <td class="href-cell">
              <span class="item-href">
                {itemType === 'manifest' ? (item as ManifestItem).href : (item as SourceItem).path}
              </span>
            </td>
            <td class="size-cell">
              {formatFileSize(item.size)}
            </td>
            <td class="modified-cell">
              {formatDate(item.modified)}
            </td>
            <td class="properties-cell">
              {#if itemType === 'manifest' && (item as ManifestItem).properties && ((item as ManifestItem).properties?.length ?? 0) > 0}
                <div class="properties-list">
                  {#each (item as ManifestItem).properties || [] as property}
                    <span class="property-tag">{property}</span>
                  {/each}
                </div>
              {:else}
                -
              {/if}
            </td>
            <!-- Hover-based action buttons -->
            {#if itemType === 'manifest'}
              <td class="actions-overlay">
                <div class="row-actions">
                  <button
                    type="button"
                    class="action-button edit-button"
                    title={$t('Edit {id}', { id: (item as ManifestItem).id })}
                    tabindex={isSelected ? 0 : -1}
                    on:click={(event) => handleEditClick(event, item as ManifestItem)}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    class="action-button delete-button"
                    title={$t('Delete {id}', { id: (item as ManifestItem).id })}
                    tabindex={isSelected ? 0 : -1}
                    on:click={(event) => handleDeleteClick(event, item as ManifestItem)}
                  >
                    🗑️
                  </button>
                </div>
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
  </div>
</div>

<style>
  .manifest-table-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--color-surface);
  }

  .manifest-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background-color: var(--color-surface-primary);
    border-block-end: 1px solid var(--color-border-default);
    position: relative;
    min-height: 3rem;
    flex-shrink: 0;
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

  .table-container {
    flex: 1;
    overflow: auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    text-align: center;
    color: var(--color-text-secondary);
  }

  .empty-state p {
    margin: 0.5rem 0;
  }

  .empty-state-subtitle {
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .manifest-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .manifest-table th,
  .manifest-table td {
    padding: 0.5rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border-default);
  }

  .manifest-table th {
    background-color: var(--color-surface-secondary);
    font-weight: 600;
    color: var(--color-text-primary);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .sort-button {
    background: none;
    border: none;
    font-size: inherit;
    font-weight: inherit;
    color: inherit;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .sort-button:hover {
    color: var(--color-interactive-primary);
  }

  .sort-button:focus {
    outline: none;
    color: var(--color-interactive-primary);
  }

  .manifest-row {
    cursor: pointer;
    transition: background-color 0.15s ease;
    position: relative;
  }

  .manifest-row:hover {
    background-color: var(--color-surface-hover);
  }

  .manifest-row:focus {
    outline: none;
    background-color: var(--color-surface-hover);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .manifest-row.selected {
    background-color: var(--color-interactive-primary-subtle);
  }

  .manifest-row.error {
    background-color: var(--color-error-subtle);
  }

  .manifest-row.source-item {
    background-color: var(--color-surface-tertiary);
  }

  .id-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 200px;
  }

  .source-icon {
    font-size: 1rem;
  }

  .item-id {
    font-weight: 500;
    word-break: break-word;
  }

  .href-cell {
    max-width: 300px;
  }

  .item-href {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    word-break: break-all;
  }


  .size-cell {
    text-align: right;
    color: var(--color-text-secondary);
  }

  .modified-cell {
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .properties-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .property-tag {
    background-color: var(--color-primary-subtle);
    color: var(--color-primary);
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-xs);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .actions-overlay {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: auto;
    padding: 0;
    border: none;
    background: none;
    pointer-events: none;
  }

  .row-actions {
    position: absolute;
    top: 50%;
    right: 0.5rem;
    transform: translateY(-50%);
    display: flex;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 0.15s ease;
    background-color: var(--color-surface);
    border-radius: var(--radius-sm);
    padding: 0.25rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    pointer-events: auto;
  }

  .manifest-row:hover .row-actions,
  .manifest-row.selected .row-actions,
  .manifest-row:focus-within .row-actions {
    opacity: 1;
  }

  .action-button {
    padding: 0.375rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-xs);
    background-color: var(--color-surface);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-button:hover {
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-hover);
  }

  .action-button:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }

  .edit-button:hover {
    color: var(--color-interactive-primary);
    border-color: var(--color-interactive-primary);
  }

  .delete-button:hover {
    color: var(--color-error);
    border-color: var(--color-error);
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

    .manifest-table {
      font-size: 0.8125rem;
    }

    .manifest-table th,
    .manifest-table td {
      padding: 0.5rem 0.25rem;
    }

    .href-cell {
      max-width: 150px;
    }

    .modified-cell {
      display: none;
    }

    .properties-list {
      flex-direction: column;
    }

    .row-actions {
      position: static;
      transform: none;
      opacity: 1;
      background: none;
      box-shadow: none;
      padding: 0;
      margin-top: 0.5rem;
    }
  }
</style>