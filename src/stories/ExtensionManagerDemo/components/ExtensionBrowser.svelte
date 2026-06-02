<!--
  ExtensionBrowser Component

  Provides tabbed interface for browsing workspace and cached extensions
  with search, filtering, and batch operation capabilities.
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ExtensionInfo } from '../../../lib/extensions/types.js';
  import { EXTENSIONS_BY_CATEGORY } from '../mock-data/sample-extensions.js';

  export let workspaceExtensions: ExtensionInfo[] = [];
  export let cachedExtensions: ExtensionInfo[] = [];
  export let selectedWorkflowId: string = 'basic-import';

  const dispatch = createEventDispatcher();

  // Browser state
  let activeTab: 'workspace' | 'cache' = 'workspace';
  let searchQuery = '';
  let selectedCategory = 'all';
  let viewMode: 'grid' | 'list' = 'grid';
  let selectedExtensions = new Set<string>();
  let sortBy: 'name' | 'size' | 'type' = 'name';
  let sortDirection: 'asc' | 'desc' = 'asc';

  // Get available categories
  $: categories = ['all', ...Object.keys(EXTENSIONS_BY_CATEGORY)];

  // Filter and sort extensions
  $: filteredWorkspaceExtensions = filterAndSortExtensions(workspaceExtensions);
  $: filteredCachedExtensions = filterAndSortExtensions(cachedExtensions);

  // Current extensions based on active tab
  $: currentExtensions =
    activeTab === 'workspace' ? filteredWorkspaceExtensions : filteredCachedExtensions;

  function filterAndSortExtensions(extensions: ExtensionInfo[]): ExtensionInfo[] {
    let filtered = extensions;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        ext =>
          ext.name.toLowerCase().includes(query) ||
          ext.files.some(file => file.filename.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      // For demo purposes, we'll use basic category matching
      filtered = filtered.filter(ext => {
        // Simple category matching based on extension name patterns
        const name = ext.name.toLowerCase();
        switch (selectedCategory) {
          case 'Text Processing':
            return name.includes('markdown') || name.includes('marked');
          case 'Syntax Highlighting':
            return name.includes('highlight') || name.includes('prism');
          case 'Data Visualization':
            return name.includes('d3') || name.includes('chart');
          case 'Utilities':
            return name.includes('lodash') || name.includes('jquery');
          case 'Math':
            return name.includes('katex') || name.includes('mathjax');
          case 'Music Notation':
            return name.includes('abc') || name.includes('vex');
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.totalSize - b.totalSize;
          break;
        case 'type':
          // Sort by primary file type
          const aType = a.files.find(f => f.type === 'javascript')?.type || 'other';
          const bType = b.files.find(f => f.type === 'javascript')?.type || 'other';
          comparison = aType.localeCompare(bType);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }

  // Extension selection
  function handleExtensionClick(extension: ExtensionInfo) {
    dispatch('extensionSelect', { extension });
  }

  // Extension actions
  function handleImportFromCache(extension: ExtensionInfo) {
    dispatch('importFromCache', { extensionName: extension.name });
  }

  function handleDeleteExtension(extension: ExtensionInfo) {
    dispatch('extensionDelete', {
      extensionName: extension.name,
      location: activeTab,
    });
  }

  // Batch operations
  function toggleExtensionSelection(extensionName: string) {
    if (selectedExtensions.has(extensionName)) {
      selectedExtensions.delete(extensionName);
    } else {
      selectedExtensions.add(extensionName);
    }
    selectedExtensions = selectedExtensions; // Trigger reactivity
  }

  function selectAllExtensions() {
    selectedExtensions = new Set(currentExtensions.map(ext => ext.name));
  }

  function clearSelection() {
    selectedExtensions = new Set();
  }

  function handleBatchOperation(operation: string) {
    if (selectedExtensions.size === 0) return;

    dispatch('batchOperation', {
      operation,
      extensions: Array.from(selectedExtensions),
    });

    clearSelection();
  }

  // Sort controls
  function handleSort(newSortBy: typeof sortBy) {
    if (sortBy === newSortBy) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = newSortBy;
      sortDirection = 'asc';
    }
  }

  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Get extension category for display
  function getExtensionCategory(extension: ExtensionInfo): string {
    const name = extension.name.toLowerCase();
    if (name.includes('markdown') || name.includes('marked')) return 'Text Processing';
    if (name.includes('highlight') || name.includes('prism')) return 'Syntax Highlighting';
    if (name.includes('d3') || name.includes('chart')) return 'Data Visualization';
    if (name.includes('lodash') || name.includes('jquery')) return 'Utilities';
    if (name.includes('katex') || name.includes('mathjax')) return 'Math';
    if (name.includes('abc') || name.includes('vex')) return 'Music Notation';
    return 'Other';
  }

  // Get extension icon based on category
  function getExtensionIcon(extension: ExtensionInfo): string {
    const category = getExtensionCategory(extension);
    switch (category) {
      case 'Text Processing':
        return '📝';
      case 'Syntax Highlighting':
        return '🎨';
      case 'Data Visualization':
        return '📊';
      case 'Utilities':
        return '🔧';
      case 'Math':
        return '🧮';
      case 'Music Notation':
        return '🎵';
      default:
        return '📦';
    }
  }
</script>

<div class="extension-browser">
  <div class="browser-header">
    <h3>Extension Browser</h3>

    <!-- Tab Navigation -->
    <div class="tab-nav">
      <button
        class="tab-button"
        class:active={activeTab === 'workspace'}
        on:click={() => (activeTab = 'workspace')}
      >
        Workspace ({workspaceExtensions.length})
      </button>
      <button
        class="tab-button"
        class:active={activeTab === 'cache'}
        on:click={() => (activeTab = 'cache')}
      >
        Global Cache ({cachedExtensions.length})
      </button>
    </div>
  </div>

  <!-- Search and Filter Controls -->
  <div class="browser-controls">
    <div class="search-section">
      <input
        type="text"
        placeholder="Search extensions..."
        bind:value={searchQuery}
        class="search-input"
      />
    </div>

    <div class="filter-section">
      <select bind:value={selectedCategory} class="category-filter">
        {#each categories as category}
          <option value={category}>
            {category === 'all' ? 'All Categories' : category}
          </option>
        {/each}
      </select>

      <div class="view-controls">
        <button
          class="view-button"
          class:active={viewMode === 'grid'}
          on:click={() => (viewMode = 'grid')}
          title="Grid view"
        >
          ⊞
        </button>
        <button
          class="view-button"
          class:active={viewMode === 'list'}
          on:click={() => (viewMode = 'list')}
          title="List view"
        >
          ☰
        </button>
      </div>
    </div>
  </div>

  <!-- Sort Controls -->
  <div class="sort-controls">
    <span class="sort-label">Sort by:</span>
    <button
      class="sort-button"
      class:active={sortBy === 'name'}
      on:click={() => handleSort('name')}
    >
      Name {sortBy === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
    </button>
    <button
      class="sort-button"
      class:active={sortBy === 'size'}
      on:click={() => handleSort('size')}
    >
      Size {sortBy === 'size' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
    </button>
    <button
      class="sort-button"
      class:active={sortBy === 'type'}
      on:click={() => handleSort('type')}
    >
      Type {sortBy === 'type' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
    </button>
  </div>

  <!-- Batch Operations -->
  {#if currentExtensions.length > 0}
    <div class="batch-operations">
      <div class="selection-controls">
        <span class="selection-count">
          {selectedExtensions.size} of {currentExtensions.length} selected
        </span>
        <button class="btn btn-small" on:click={selectAllExtensions}> Select All </button>
        <button class="btn btn-small" on:click={clearSelection}> Clear </button>
      </div>

      {#if selectedExtensions.size > 0}
        <div class="batch-actions">
          {#if activeTab === 'workspace'}
            <button
              class="btn btn-small btn-primary"
              on:click={() => handleBatchOperation('cache')}
            >
              Cache Selected ({selectedExtensions.size})
            </button>
            <button
              class="btn btn-small btn-danger"
              on:click={() => handleBatchOperation('delete')}
            >
              Delete Selected
            </button>
          {:else}
            <button
              class="btn btn-small btn-danger"
              on:click={() => handleBatchOperation('delete')}
            >
              Remove from Cache
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Extensions Grid/List -->
  <div
    class="extension-list"
    class:grid-view={viewMode === 'grid'}
    class:list-view={viewMode === 'list'}
  >
    {#if currentExtensions.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <h4>No extensions found</h4>
        <p>
          {#if activeTab === 'workspace'}
            Import some extensions to get started.
          {:else}
            The global cache is empty.
          {/if}
        </p>
      </div>
    {:else}
      {#each currentExtensions as extension (extension.name)}
        <div
          class="extension-card"
          class:selected={selectedExtensions.has(extension.name)}
          on:click={() => handleExtensionClick(extension)}
          role="button"
          tabindex="0"
          on:keydown={e => e.key === 'Enter' && handleExtensionClick(extension)}
        >
          <!-- Selection checkbox -->
          <div
            class="selection-checkbox"
            on:click|stopPropagation
            on:keydown={() => {
              /* noop */
            }}
            role="none"
          >
            <input
              type="checkbox"
              checked={selectedExtensions.has(extension.name)}
              on:change={() => toggleExtensionSelection(extension.name)}
              aria-label="Select {extension.name}"
            />
          </div>

          <!-- Extension info -->
          <div class="extension-info">
            <div class="extension-header">
              <span class="extension-icon">{getExtensionIcon(extension)}</span>
              <div class="extension-title">
                <h4>{extension.name}</h4>
                <span class="extension-category">{getExtensionCategory(extension)}</span>
              </div>
            </div>

            <div class="extension-details">
              <div class="file-count">
                {extension.files.length} file{extension.files.length !== 1 ? 's' : ''}
              </div>
              <div class="extension-size">
                {formatFileSize(extension.totalSize)}
              </div>
              <div class="extension-location">
                {extension.location}
              </div>
            </div>

            {#if viewMode === 'list'}
              <div class="file-list">
                {#each extension.files as file}
                  <span class="file-item">
                    {file.filename} ({formatFileSize(file.size)})
                  </span>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Extension actions -->
          <div class="extension-actions">
            {#if activeTab === 'cache'}
              <button
                class="action-button"
                on:click|stopPropagation={() => handleImportFromCache(extension)}
                title="Import to workspace"
              >
                ⬇️
              </button>
            {/if}
            <button
              class="action-button delete-button"
              on:click|stopPropagation={() => handleDeleteExtension(extension)}
              title="Delete extension"
            >
              🗑️
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .extension-browser {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .browser-header {
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border-secondary);
    background: var(--color-bg-tertiary);
  }

  .browser-header h3 {
    margin: 0 0 var(--space-3) 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-lg);
  }

  .tab-nav {
    display: flex;
    gap: var(--space-1);
  }

  .tab-button {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab-button.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
  }

  .browser-controls {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border-secondary);
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }

  .search-section {
    flex: 1;
  }

  .search-input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .filter-section {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .category-filter {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .view-controls {
    display: flex;
    gap: var(--space-1);
  }

  .view-button {
    padding: var(--space-2);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: var(--font-size-lg);
  }

  .view-button.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
  }

  .sort-controls {
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--color-border-secondary);
    display: flex;
    gap: var(--space-2);
    align-items: center;
    font-size: var(--font-size-sm);
  }

  .sort-label {
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-medium);
  }

  .sort-button {
    padding: var(--space-1) var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: var(--font-size-sm);
  }

  .sort-button.active {
    background: var(--color-bg-accent);
    border-color: var(--color-border-accent);
    color: var(--color-text-primary);
  }

  .batch-operations {
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--color-border-secondary);
    background: var(--color-bg-accent);
  }

  .selection-controls {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    margin-bottom: var(--space-2);
  }

  .selection-count {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .batch-actions {
    display: flex;
    gap: var(--space-2);
  }

  .extension-list {
    padding: var(--space-4);
    max-height: 500px;
    overflow-y: auto;
  }

  .extension-list.grid-view {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-3);
  }

  .extension-list.list-view {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .extension-card {
    position: relative;
    padding: var(--space-3);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .extension-card:hover {
    border-color: var(--color-border-accent);
    background: var(--color-bg-accent);
    transform: translateY(-1px);
  }

  .extension-card.selected {
    border-color: var(--color-accent);
    background: var(--color-bg-accent);
  }

  .selection-checkbox {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
  }

  .selection-checkbox input {
    cursor: pointer;
  }

  .extension-info {
    margin-left: var(--space-6);
  }

  .extension-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .extension-icon {
    font-size: var(--font-size-xl);
  }

  .extension-title h4 {
    margin: 0;
    font-size: var(--font-size-md);
    color: var(--color-text-primary);
  }

  .extension-category {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .extension-details {
    display: flex;
    gap: var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-2);
  }

  .list-view .extension-details {
    flex: 1;
  }

  .file-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
  }

  .file-item {
    padding: var(--space-1) var(--space-2);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
  }

  .extension-actions {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    display: flex;
    gap: var(--space-1);
  }

  .action-button {
    padding: var(--space-1);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    cursor: pointer;
    font-size: var(--font-size-sm);
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .extension-card:hover .action-button {
    opacity: 1;
  }

  .delete-button:hover {
    background: var(--color-error);
    border-color: var(--color-error);
    color: white;
  }

  .empty-state {
    text-align: center;
    padding: var(--space-8);
    color: var(--color-text-secondary);
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: var(--space-3);
    opacity: 0.5;
  }

  .empty-state h4 {
    margin: 0 0 var(--space-2) 0;
    color: var(--color-text-primary);
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  /* Button styles */
  .btn {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    transition: all 0.2s ease;
  }

  .btn:hover {
    background: var(--color-bg-accent);
  }

  .btn-small {
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-xs);
  }

  .btn-primary {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .btn-danger {
    background: var(--color-error);
    border-color: var(--color-error);
    color: white;
  }
</style>
