<script lang="ts">
  import { t } from '../../i18n';
  import type { ManifestItem, SourceItem, ValidationResult } from '../../manifest/types';

  type SortableFields = 'id' | 'href' | 'size';

  let {
    manifestItems = [],
    sourceItems = [],
    advancedMode = true,
    validationErrors = [],
    selectedItem = null,
    selectedItemType = null,
    loading = false,
    onItemSelect,
    onItemDelete,
    onFileUpload,
  }: {
    manifestItems?: ManifestItem[];
    sourceItems?: SourceItem[];
    advancedMode?: boolean;
    validationErrors?: ValidationResult[];
    selectedItem?: ManifestItem | SourceItem | null;
    selectedItemType?: 'manifest' | 'source' | 'opf' | null;
    loading?: boolean;
    onItemSelect?: (detail: { item: ManifestItem | SourceItem; type: 'manifest' | 'source' | 'opf' }) => void;
    onItemDelete?: (detail: { itemId: string }) => void;
    onFileUpload?: (detail: { files: FileList }) => void;
  } = $props();

  // Filter state
  let filterText = $state('');
  // oxlint-disable-next-line no-unassigned-vars
  let fileInputRef: HTMLInputElement;

  let sortField = $state<SortableFields>('id');
  let sortDirection = $state<'asc' | 'desc'>('asc');

  // Combine and filter items
  const allItems = $derived([
    ...manifestItems.map(item => ({ ...item, _type: 'manifest' as const })),
    // Always show content.opf in both modes
    {
      name: 'content.opf',
      path: 'content.opf',
      size: undefined,
      _type: 'opf' as const,
    },
    // Advanced mode: show individual SOURCE files
    ...(advancedMode ? sourceItems.map(item => ({ ...item, _type: 'source' as const })) : []),
    // Non-advanced mode: show SOURCE.zip placeholder
    ...(!advancedMode ? [
      {
        name: 'SOURCE.zip',
        path: 'SOURCE.zip',
        size: undefined,
        _type: 'source-zip' as const,
        isPlaceholder: true,
      },
    ] : []),
  ]);


  // Filter items based on filter text
  const filteredItems = $derived(allItems.filter(item => {
    if (!filterText) return true;

    const searchText = filterText.toLowerCase();

    if (item._type === 'manifest') {
      const manifestItem = item as ManifestItem & { _type: 'manifest' };
      return (
        manifestItem.id.toLowerCase().includes(searchText) ||
        manifestItem.href.toLowerCase().includes(searchText) ||
        manifestItem.properties?.some(prop => prop.toLowerCase().includes(searchText)) ||
        false
      );
    } else if (item._type === 'source') {
      const sourceItem = item as SourceItem & { _type: 'source' };
      return (
        sourceItem.name.toLowerCase().includes(searchText) ||
        sourceItem.path.toLowerCase().includes(searchText)
      );
    } else if (item._type === 'source-zip') {
      // SOURCE.zip placeholder
      const sourceZipItem = item as any;
      return (
        sourceZipItem.name.toLowerCase().includes(searchText) ||
        sourceZipItem.path.toLowerCase().includes(searchText)
      );
    } else {
      // OPF item
      const opfItem = item as any;
      return (
        opfItem.name.toLowerCase().includes(searchText) ||
        opfItem.path.toLowerCase().includes(searchText)
      );
    }
  }));

  // Sort a set of rows by the active column (reactive so the grouping below
  // re-runs when the sort changes).
  const sortGroup = $derived((items: typeof filteredItems) => {
    return [...items].sort((a, b) => {
      let aValue: string | number | Date = '';
      let bValue: string | number | Date = '';

      if (sortField === 'id') {
        aValue = a._type === 'manifest' ? (a as ManifestItem).id : (a as any).name;
        bValue = b._type === 'manifest' ? (b as ManifestItem).id : (b as any).name;
      } else if (sortField === 'href') {
        aValue = a._type === 'manifest' ? (a as ManifestItem).href : (a as any).path;
        bValue = b._type === 'manifest' ? (b as ManifestItem).href : (b as any).path;
      } else if (sortField === 'size') {
        aValue = a.size || 0;
        bValue = b.size || 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  });

  type RowGroup = {
    key: string;
    label: string;
    kind: 'root' | 'dir' | 'source' | 'opf';
    indent: number;
    items: typeof filteredItems;
  };

  // Group manifest items by their full directory path (the href's dirname).
  // Every distinct directory that directly contains files becomes its own
  // group, so nesting is honoured and a parent with no direct files yields no
  // heading while its subgroups still do. SOURCE files stay in one flat group;
  // content.opf gets its own. Root-level files (no directory) render first
  // without a heading.
  const groups = $derived.by((): RowGroup[] => {
    const manifest = filteredItems.filter(i => i._type === 'manifest');
    const source = filteredItems.filter(i => i._type === 'source' || i._type === 'source-zip');
    const opf = filteredItems.filter(i => i._type === 'opf');

    const root: typeof filteredItems = [];
    const byDir = new Map<string, typeof filteredItems>();
    for (const item of manifest) {
      const segs = (item as ManifestItem).href.split('/');
      const dir = segs.slice(0, -1).join('/');
      if (!dir) {
        root.push(item);
      } else {
        const list = byDir.get(dir) ?? [];
        list.push(item);
        byDir.set(dir, list);
      }
    }

    const result: RowGroup[] = [];
    if (root.length) {
      result.push({ key: 'root', label: '', kind: 'root', indent: 0, items: sortGroup(root) });
    }
    const dirs = [...byDir.keys()].sort((a, b) => {
      const al = a.toLowerCase();
      const bl = b.toLowerCase();
      return al < bl ? -1 : al > bl ? 1 : 0;
    });
    for (const dir of dirs) {
      result.push({
        key: `dir:${dir}`,
        label: `${dir}/`,
        kind: 'dir',
        indent: dir.split('/').length - 1,
        items: sortGroup(byDir.get(dir)!),
      });
    }
    if (source.length) {
      result.push({ key: 'source', label: 'SOURCE.zip', kind: 'source', indent: 0, items: sortGroup(source) });
    }
    if (opf.length) {
      result.push({ key: 'opf', label: 'Package Files', kind: 'opf', indent: 0, items: sortGroup(opf) });
    }
    return result;
  });

  // While filtering, show every match regardless of collapse state.
  const forceExpand = $derived(filterText.trim().length > 0);

  // --- Collapse state (persisted so the table feels stable across reloads) ---
  const COLLAPSED_STORAGE_KEY = 'editme_manifest_collapsed_groups';

  const loadCollapsedGroups = (): Set<string> => {
    try {
      const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      // Ignore unavailable/malformed storage.
    }
    return new Set();
  };

  let collapsedGroups = $state(loadCollapsedGroups());

  const toggleGroup = (key: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    collapsedGroups = next;
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...collapsedGroups]));
    } catch {
      // Best effort.
    }
  };

  const handleSort = (field: SortableFields) => {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
  };

  const handleRowClick = (
    item: ManifestItem | SourceItem | any,
    type: 'manifest' | 'source' | 'opf' | 'source-zip'
  ) => {
    // Treat source-zip as 'source' for compatibility with parent component
    const dispatchType = type === 'source-zip' ? 'source' : type;
    onItemSelect?.({ item, type: dispatchType });
  };

  const handleRowKeyDown = (
    event: KeyboardEvent,
    item: ManifestItem | SourceItem | any,
    type: 'manifest' | 'source' | 'opf' | 'source-zip'
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRowClick(item, type);
    }
  };

  const _handleDeleteClick = (event: Event, item: ManifestItem) => {
    event.stopPropagation();
    onItemDelete?.({ itemId: item.id });
  };

  const isItemSelected = (
    item: ManifestItem | SourceItem | any,
    type: 'manifest' | 'source' | 'opf' | 'source-zip'
  ) => {
    if (!selectedItem) return false;
    
    // Treat source-zip as 'source' for selection comparison
    const compareType = type === 'source-zip' ? 'source' : type;
    if (selectedItemType !== compareType) return false;

    if (type === 'manifest') {
      return (item as ManifestItem).id === (selectedItem as ManifestItem).id;
    } else if (type === 'source' || type === 'source-zip') {
      return (item as SourceItem).path === (selectedItem as SourceItem).path;
    } else {
      return (item as any).path === (selectedItem as any).path;
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
      onFileUpload?.({ files: target.files });
      target.value = ''; // Clear the input
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
    role="toolbar"
    aria-label={$t('Manifest actions')}
    tabindex="0"
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
          oninput={handleFilterInput}
          disabled={loading}
        />
        {#if filterText}
          <button
            type="button"
            class="clear-filter-button"
            aria-label={$t('Clear filter')}
            onclick={handleClearFilter}
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
        onclick={handleLoadFileClick}
        disabled={loading}
      >
        📁 {$t('Load File')}
      </button>
    </div>

    <!-- Hidden file input -->
    <input
      bind:this={fileInputRef}
      type="file"
      multiple
      accept="*/*"
      style="display: none;"
      onchange={handleFileInputChange}
    />
  </div>

  <!-- Table container -->
  <div class="table-container">
    {#if filteredItems.length === 0}
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
                onclick={() => handleSort('id')}
                aria-label={$t('Sort by ID')}
              >
                {$t('ID')}
                {getSortIcon('id')}
              </button>
            </th>
            <th scope="col">
              <button
                type="button"
                class="sort-button"
                onclick={() => handleSort('href')}
                aria-label={$t('Sort by path')}
              >
                {$t('Path')}
                {getSortIcon('href')}
              </button>
            </th>
            <th scope="col">
              <button
                type="button"
                class="sort-button"
                onclick={() => handleSort('size')}
                aria-label={$t('Sort by size')}
              >
                {$t('Size')}
                {getSortIcon('size')}
              </button>
            </th>
            <th scope="col">{$t('Properties')}</th>
          </tr>
        </thead>
        <tbody>
          {#each groups as group (group.key)}
            {@const collapsed = !forceExpand && collapsedGroups.has(group.key)}
            {#if group.kind !== 'root'}
              <tr class="group-heading" class:collapsed>
                <td colspan="4" class="separator-cell">
                  <button
                    type="button"
                    class="group-toggle"
                    style="padding-inline-start: {group.indent}rem"
                    aria-expanded={!collapsed}
                    onclick={() => toggleGroup(group.key)}
                  >
                    <span class="disclosure" aria-hidden="true">▸</span>
                    <span class="separator-label">{group.label}</span>
                  </button>
                </td>
              </tr>
            {/if}

            {#if !collapsed}
              {#each group.items as item}
                {@const itemType = item._type}
                {@const isSelected = isItemSelected(item, itemType)}
                {@const hasError =
                  itemType === 'manifest' ? hasValidationError(item as ManifestItem) : false}
                <tr
                  class="manifest-row"
                  class:selected={isSelected}
                  class:error={hasError}
                  class:source-item={itemType === 'source'}
                  class:source-zip-item={itemType === 'source-zip'}
                  class:opf-item={itemType === 'opf'}
                  tabindex="0"
                  aria-selected={isSelected}
                  onclick={() => handleRowClick(item, itemType)}
                  onkeydown={event => handleRowKeyDown(event, item, itemType)}
                >
                  <td class="id-cell">
                    <span class="item-id" dir="ltr">
                      {itemType === 'manifest'
                        ? (item as ManifestItem).id
                        : itemType === 'source' || itemType === 'source-zip'
                          ? (item as SourceItem).name || (item as any).name
                          : (item as any).name}
                    </span>
                  </td>
                  <td class="href-cell">
                    <span class="item-href" dir="ltr">
                      {itemType === 'manifest'
                        ? (item as ManifestItem).href
                        : itemType === 'source' || itemType === 'source-zip'
                          ? (item as SourceItem).path || (item as any).path
                          : (item as any).path}
                    </span>
                  </td>
                  <td class="size-cell">
                    {formatFileSize(item.size)}
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
                </tr>
              {/each}
            {/if}
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

  .action-button:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-focus-ring);
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

  .manifest-row:focus:not(.selected) {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: -2px;
    background-color: var(--color-surface-hover);
  }

  .manifest-row.selected:focus {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: -2px;
  }

  .manifest-row.selected {
    background-color: var(--color-bg-accent);
  }

  .manifest-row.error {
    background-color: var(--color-bg-error);
  }

  .manifest-row.source-zip-item {
    opacity: 0.8;
    font-style: italic;
    background-color: var(--color-bg-muted, rgba(0, 0, 0, 0.05));
  }

  .manifest-row.source-zip-item .item-id,
  .manifest-row.source-zip-item .item-href {
    color: var(--color-text-secondary);
  }

  .group-heading {
    background-color: var(--color-bg-secondary);
  }

  /* More specific than `.manifest-table td` so the heading cell keeps zero
     padding (the toggle button supplies its own compact padding). */
  .manifest-table td.separator-cell {
    padding: 0;
    border-bottom: 2px solid var(--color-border-strong);
    border-top: 1px solid var(--color-border-default);
  }

  .group-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.35rem 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: start;
    color: inherit;
  }

  .group-toggle:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .disclosure {
    display: inline-block;
    font-size: 1.4rem;
    /* Tight line box so the larger glyph paints big without inflating the
       compact heading row. */
    line-height: 0.6;
    color: var(--color-text-secondary);
    transition: transform 0.15s ease;
  }

  .group-heading:not(.collapsed) .disclosure {
    transform: rotate(90deg);
  }

  .separator-label {
    font-size: 0.8125rem;
    line-height: 1;
    font-weight: 600;
    color: var(--color-text-secondary);
    letter-spacing: 0.05em;
  }

  .id-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 200px;
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

  .properties-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .property-tag {
    background-color: var(--color-bg-accent);
    color: var(--color-primary);
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-xs);
    font-size: 0.75rem;
    font-weight: 500;
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

    .properties-list {
      flex-direction: column;
    }
  }
</style>
