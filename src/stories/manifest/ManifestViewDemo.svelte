<script lang="ts">
  import { onMount } from 'svelte';
  import { createMockManifestItems } from './mock-data/manifest-items.js';
  import { createMockSourceItems } from './mock-data/source-items.js';
  import { createMockContentPreview } from './mock-data/content-previews.js';
  import type { ManifestItem, SourceItem, ContentPreview, ValidationResult, CreateTextItemData } from '../../lib/manifest/types.js';
  import type { IManifestManager } from '../../lib/manifest/manifest-manager.js';

  // Story props
  export let layout = 'desktop';
  export let itemCount = 8;
  export let advancedMode = false;
  export let selectedItemId = '';
  export let hasValidationErrors = false;
  export let showCreateModal = false;
  export let filterText = '';
  export let contentTypes = ['text', 'image', 'audio', 'video', 'binary'];
  export let isLoading = false;

  // Component state
  let manifestItems: ManifestItem[] = [];
  let sourceItems: SourceItem[] = [];
  let selectedItem: ManifestItem | SourceItem | null = null;
  let selectedItemType: 'manifest' | 'source' | null = null;
  let contentPreview: ContentPreview | null = null;
  let validationErrors: ValidationResult[] = [];
  let currentFilterText = filterText;
  let isModalOpen = showCreateModal;
  let modalMode: 'create-text' | 'create-file' | 'edit' = 'create-text';

  // Mock ManifestManager
  const mockManifestManager: IManifestManager = {
    async loadManifest(workspaceId: string): Promise<ManifestItem[]> {
      if (isLoading) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      manifestItems = createMockManifestItems({
        count: itemCount,
        includeErrors: hasValidationErrors,
        contentTypes: contentTypes as ('text' | 'image' | 'audio' | 'video' | 'binary')[]
      });
      
      return manifestItems;
    },

    async getManifestItem(workspaceId: string, itemId: string): Promise<ManifestItem> {
      const item = manifestItems.find(item => item.id === itemId);
      if (!item) throw new Error(`Item not found: ${itemId}`);
      return item;
    },

    async updateManifestItem(workspaceId: string, itemId: string, updates: Partial<ManifestItem>): Promise<void> {
      const index = manifestItems.findIndex(item => item.id === itemId);
      if (index === -1) throw new Error(`Item not found: ${itemId}`);
      manifestItems[index] = { ...manifestItems[index], ...updates };
    },

    async deleteManifestItem(workspaceId: string, itemId: string): Promise<void> {
      const index = manifestItems.findIndex(item => item.id === itemId);
      if (index === -1) throw new Error(`Item not found: ${itemId}`);
      manifestItems.splice(index, 1);
      manifestItems = manifestItems; // Trigger reactivity
    },

    async getItemContent(workspaceId: string, itemId: string): Promise<ArrayBuffer | string> {
      return 'Mock content for ' + itemId;
    },

    async setItemContent(workspaceId: string, itemId: string, content: ArrayBuffer | string): Promise<void> {
      // Mock implementation
    },

    async getContentPreview(workspaceId: string, itemId: string): Promise<ContentPreview> {
      const item = await this.getManifestItem(workspaceId, itemId);
      return createMockContentPreview(itemId, item.href, item.mediaType);
    },

    async createTextItem(workspaceId: string, itemData: CreateTextItemData): Promise<ManifestItem> {
      const newItem: ManifestItem = {
        id: itemData.id || `item-${Date.now()}`,
        href: `OEBPS/${itemData.fileName}`,
        mediaType: itemData.mediaType || 'application/xhtml+xml',
        size: itemData.content.length,
        modified: new Date(),
        properties: itemData.properties,
      };
      manifestItems.push(newItem);
      manifestItems = manifestItems; // Trigger reactivity
      return newItem;
    },

    async createFileItem(workspaceId: string, file: File, targetPath?: string): Promise<ManifestItem> {
      const newItem: ManifestItem = {
        id: `file-${Date.now()}`,
        href: targetPath || `OEBPS/${file.name}`,
        mediaType: file.type || 'application/octet-stream',
        size: file.size,
        modified: new Date(),
      };
      manifestItems.push(newItem);
      manifestItems = manifestItems; // Trigger reactivity
      return newItem;
    },

    async importFileItem(workspaceId: string, filePath: string, content: ArrayBuffer): Promise<ManifestItem> {
      const fileName = filePath.split('/').pop() || 'imported-file';
      const newItem: ManifestItem = {
        id: `import-${Date.now()}`,
        href: filePath,
        mediaType: 'application/octet-stream',
        size: content.byteLength,
        modified: new Date(),
      };
      manifestItems.push(newItem);
      manifestItems = manifestItems; // Trigger reactivity
      return newItem;
    },

    async reorderManifestItems(workspaceId: string, itemIds: string[]): Promise<void> {
      // Mock implementation
    },

    async getManifestOrder(workspaceId: string): Promise<string[]> {
      return manifestItems.map(item => item.id);
    },

    async validateManifest(workspaceId: string): Promise<ValidationResult[]> {
      if (hasValidationErrors) {
        return [
          {
            field: 'id',
            message: 'Duplicate ID found',
            severity: 'error',
            itemId: 'invalid-missing-href'
          },
          {
            field: 'href',
            message: 'Missing href attribute',
            severity: 'error',
            itemId: 'invalid-missing-href'
          }
        ];
      }
      return [];
    },

    async listSourceItems(workspaceId: string): Promise<SourceItem[]> {
      if (advancedMode) {
        sourceItems = createMockSourceItems();
        return sourceItems;
      }
      return [];
    },

    async getSourceItemContent(workspaceId: string, sourcePath: string): Promise<ArrayBuffer | string> {
      return 'Mock SOURCE content for ' + sourcePath;
    },

    async isAdvancedModeEnabled(workspaceId: string): Promise<boolean> {
      return advancedMode;
    },

    generateItemId(fileName: string): string {
      return fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    },

    detectMediaType(fileName: string, content?: ArrayBuffer): string {
      const ext = fileName.split('.').pop()?.toLowerCase();
      const mediaTypeMap: Record<string, string> = {
        'xhtml': 'application/xhtml+xml',
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'mp3': 'audio/mpeg',
        'mp4': 'video/mp4',
        'pdf': 'application/pdf',
      };
      return mediaTypeMap[ext || ''] || 'application/octet-stream';
    },

    getMediaTypeCategories() {
      return {
        text: [],
        image: [],
        audio: [],
        video: [],
        application: []
      };
    },

    clearCache(workspaceId?: string): void {},
    async preloadManifest(workspaceId: string): Promise<void> {},
    clearContentCache(workspaceId: string, itemId?: string): void {}
  };

  // Load initial data
  const loadData = async () => {
    manifestItems = await mockManifestManager.loadManifest('demo-workspace');
    if (advancedMode) {
      sourceItems = await mockManifestManager.listSourceItems('demo-workspace');
    }
    validationErrors = await mockManifestManager.validateManifest('demo-workspace');
    
    // Auto-select item if provided
    if (selectedItemId) {
      selectItem(selectedItemId, 'manifest');
    }
  };

  // Filter items based on search text
  $: filteredManifestItems = manifestItems.filter(item => {
    if (!currentFilterText) return true;
    const searchTerm = currentFilterText.toLowerCase();
    return (
      item.id.toLowerCase().includes(searchTerm) ||
      item.href.toLowerCase().includes(searchTerm) ||
      item.mediaType.toLowerCase().includes(searchTerm)
    );
  });

  $: filteredSourceItems = sourceItems.filter(item => {
    if (!currentFilterText) return true;
    const searchTerm = currentFilterText.toLowerCase();
    return (
      item.name.toLowerCase().includes(searchTerm) ||
      item.path.toLowerCase().includes(searchTerm)
    );
  });

  // Handle item selection
  const selectItem = async (itemId: string, type: 'manifest' | 'source') => {
    try {
      if (type === 'manifest') {
        selectedItem = manifestItems.find(item => item.id === itemId) || null;
        selectedItemType = 'manifest';
        if (selectedItem && 'id' in selectedItem) {
          contentPreview = await mockManifestManager.getContentPreview('demo-workspace', selectedItem.id);
        }
      } else {
        selectedItem = sourceItems.find(item => item.path.endsWith(itemId)) || null;
        selectedItemType = 'source';
        contentPreview = null; // SOURCE items might have different preview logic
      }
    } catch (error) {
      console.error('Failed to load content preview:', error);
    }
  };

  // Handle toolbar actions
  const handleCreateText = () => {
    modalMode = 'create-text';
    isModalOpen = true;
  };

  const handleCreateFile = () => {
    modalMode = 'create-file';
    isModalOpen = true;
  };

  const handleEdit = (item: ManifestItem) => {
    selectedItem = item;
    selectedItemType = 'manifest';
    modalMode = 'edit';
    isModalOpen = true;
  };

  const handleDelete = async (itemId: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await mockManifestManager.deleteManifestItem('demo-workspace', itemId);
      if (selectedItem && 'id' in selectedItem && selectedItem.id === itemId) {
        selectedItem = null;
        selectedItemType = null;
        contentPreview = null;
      }
    }
  };

  const handleSave = async (event: CustomEvent) => {
    const { item } = event.detail;
    
    if (modalMode === 'edit' && selectedItem && 'id' in selectedItem) {
      await mockManifestManager.updateManifestItem('demo-workspace', selectedItem.id, item);
    } else if (modalMode === 'create-text') {
      await mockManifestManager.createTextItem('demo-workspace', {
        fileName: item.href.split('/').pop() || 'untitled.txt',
        content: '',
        id: item.id,
        mediaType: item.mediaType,
        properties: item.properties
      });
    }
    
    isModalOpen = false;
    await loadData(); // Refresh data
  };

  const handleModalClose = () => {
    isModalOpen = false;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Initialize data on mount
  onMount(loadData);

  // Watch for prop changes
  $: if (selectedItemId && manifestItems.length > 0) {
    selectItem(selectedItemId, 'manifest');
  }

  $: currentFilterText = filterText;
  $: isModalOpen = showCreateModal;
</script>

<div class="manifest-view-demo" class:mobile={layout === 'mobile'} class:tablet={layout === 'tablet'}>
  <!-- Toolbar -->
  <div class="manifest-toolbar">
    <input 
      type="text" 
      placeholder="Filter items..." 
      bind:value={currentFilterText}
      class="filter-input"
    />
    <button type="button" class="primary" on:click={handleCreateText}>
      📝 Create Text File
    </button>
    <button type="button" class="secondary" on:click={handleCreateFile}>
      📁 Load File
    </button>
    {#if advancedMode}
      <span class="advanced-badge">Advanced Mode</span>
    {/if}
  </div>

  <!-- Main content area -->
  <div class="manifest-content">
    <!-- Table section -->
    <div class="manifest-main">
      {#if isLoading}
        <div class="loading-table">
          <div class="skeleton-header"></div>
          {#each Array(5) as _}
            <div class="skeleton-row"></div>
          {/each}
        </div>
      {:else}
        <div class="manifest-table">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>ID</th>
                <th>Path</th>
                <th>Type</th>
                <th>Size</th>
                <th>Modified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredManifestItems as item (item.id)}
                <tr 
                  class:selected={selectedItem && 'id' in selectedItem && selectedItem.id === item.id}
                  on:click={() => selectItem(item.id, 'manifest')}
                  tabindex="0"
                  role="button"
                >
                  <td>
                    <span 
                      class="status-indicator" 
                      class:error={validationErrors.some(e => e.itemId === item.id)}
                      class:success={!validationErrors.some(e => e.itemId === item.id)}
                    ></span>
                  </td>
                  <td>{item.id}</td>
                  <td class="path-cell">{item.href}</td>
                  <td class="type-cell">{item.mediaType}</td>
                  <td>{formatFileSize(item.size || 0)}</td>
                  <td>{item.modified?.toLocaleDateString() || '-'}</td>
                  <td class="actions-cell">
                    <button type="button" on:click|stopPropagation={() => handleEdit(item)}>
                      Edit
                    </button>
                    <button type="button" class="danger" on:click|stopPropagation={() => handleDelete(item.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              {/each}
              
              {#if advancedMode}
                {#each filteredSourceItems as item (item.path)}
                  <tr 
                    class="source-item"
                    class:selected={selectedItem && 'path' in selectedItem && selectedItem.path === item.path}
                    on:click={() => selectItem(item.name, 'source')}
                    tabindex="0"
                    role="button"
                  >
                    <td><span class="status-indicator success"></span></td>
                    <td>📁 {item.name}</td>
                    <td class="path-cell">{item.path}</td>
                    <td class="type-cell">{item.mediaType || 'directory'}</td>
                    <td>{item.size ? formatFileSize(item.size) : '-'}</td>
                    <td>{item.modified?.toLocaleDateString() || '-'}</td>
                    <td class="actions-cell">
                      <button type="button">View</button>
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
          
          {#if filteredManifestItems.length === 0 && !isLoading}
            <div class="empty-state">
              <h3>No Items Found</h3>
              <p>
                {#if currentFilterText}
                  No items match the filter "{currentFilterText}".
                {:else}
                  No manifest items to display. Create some content to get started.
                {/if}
              </p>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Preview sidebar -->
    {#if layout === 'desktop'}
      <div class="manifest-sidebar">
        {#if selectedItem && contentPreview}
          <div class="manifest-preview">
            <div class="preview-header">
              <h3>
                {'id' in selectedItem ? selectedItem.id : selectedItem.name}
              </h3>
              <span class="item-path">
                {'href' in selectedItem ? selectedItem.href : selectedItem.path}
              </span>
            </div>

            <div class="manifest-preview-content">
              {#if contentPreview.contentType === 'text' && contentPreview.textContent}
                <pre><code>{contentPreview.textContent}</code></pre>
              {:else if contentPreview.contentType === 'image' && contentPreview.previewUrl}
                <img src={contentPreview.previewUrl} alt="Preview" class="preview-image" />
              {:else if contentPreview.contentType === 'audio' && contentPreview.previewUrl}
                <audio controls class="preview-audio">
                  <source src={contentPreview.previewUrl} type={selectedItem && 'mediaType' in selectedItem ? selectedItem.mediaType : ''} />
                </audio>
              {:else if contentPreview.contentType === 'video' && contentPreview.previewUrl}
                <video controls class="preview-video">
                  <source src={contentPreview.previewUrl} type={selectedItem && 'mediaType' in selectedItem ? selectedItem.mediaType : ''} />
                </video>
              {:else}
                <div class="binary-file-info">
                  <div class="file-icon">📄</div>
                  <h4>Binary File</h4>
                  <p>Preview not available for this file type.</p>
                </div>
              {/if}
            </div>

            {#if selectedItem && 'mediaType' in selectedItem}
              <div class="manifest-preview-metadata">
                <dl>
                  <dt>File Size</dt>
                  <dd>{formatFileSize(selectedItem.size || 0)}</dd>
                  <dt>Media Type</dt>
                  <dd>{selectedItem.mediaType}</dd>
                  <dt>Modified</dt>
                  <dd>{selectedItem.modified?.toLocaleDateString() || 'Unknown'}</dd>
                  {#if selectedItem.properties && selectedItem.properties.length > 0}
                    <dt>Properties</dt>
                    <dd>{selectedItem.properties.join(', ')}</dd>
                  {/if}
                </dl>
              </div>

              <div class="manifest-preview-actions">
                <button type="button" on:click={() => handleEdit(selectedItem)}>Edit</button>
                <button type="button">Download</button>
                <button type="button" class="danger" on:click={() => handleDelete(selectedItem.id)}>Delete</button>
              </div>
            {/if}
          </div>
        {:else}
          <div class="manifest-empty">
            <h3>No Selection</h3>
            <p>Select an item from the table to preview its content.</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Create/Edit Modal -->
  {#if isModalOpen}
    <div class="modal-backdrop" on:click={handleModalClose}>
      <div class="modal-content" on:click|stopPropagation>
        <div class="modal-header">
          <h2>
            {#if modalMode === 'create-text'}
              Create Text File
            {:else if modalMode === 'create-file'}
              Upload File
            {:else}
              Edit Item
            {/if}
          </h2>
          <button type="button" class="close-button" on:click={handleModalClose}>×</button>
        </div>
        
        <div class="modal-body">
          <p>Mock item creation/editing interface would appear here.</p>
          <p>Form fields for ID, href, media type, properties, etc.</p>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="secondary" on:click={handleModalClose}>Cancel</button>
          <button type="button" class="primary" on:click={() => handleSave(new CustomEvent('save', { detail: { item: {} } }))}>
            {modalMode === 'edit' ? 'Save Changes' : 'Create Item'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  @import './manifest-demo.css';

  .manifest-view-demo {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-surface-primary, #f9fafb);
  }

  .filter-input {
    flex: 1;
    max-width: 20rem;
    padding: var(--spacing-2, 0.5rem) var(--spacing-3, 0.75rem);
    border: 1px solid var(--color-border-primary, #d1d5db);
    border-radius: var(--border-radius-md, 0.375rem);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .advanced-badge {
    padding: var(--spacing-1, 0.25rem) var(--spacing-2, 0.5rem);
    background-color: var(--color-primary-100, #dbeafe);
    color: var(--color-primary-700, #1d4ed8);
    border-radius: var(--border-radius-md, 0.375rem);
    font-size: var(--font-size-xs, 0.75rem);
    font-weight: var(--font-weight-medium, 500);
  }

  .loading-table {
    padding: var(--spacing-4, 1rem);
  }

  .skeleton-header,
  .skeleton-row {
    height: 2.5rem;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
    border-radius: var(--border-radius-sm, 0.25rem);
    margin-bottom: var(--spacing-2, 0.5rem);
  }

  .skeleton-header {
    height: 3rem;
    background-color: var(--color-surface-secondary, #f9fafb);
  }

  .path-cell {
    font-family: var(--font-family-mono, 'Fira Code', monospace);
    font-size: var(--font-size-xs, 0.75rem);
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .type-cell {
    font-family: var(--font-family-mono, 'Fira Code', monospace);
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--color-text-secondary, #6b7280);
  }

  .actions-cell {
    white-space: nowrap;
  }

  .actions-cell button {
    padding: var(--spacing-1, 0.25rem) var(--spacing-2, 0.5rem);
    margin-right: var(--spacing-1, 0.25rem);
    border: 1px solid var(--color-border-primary, #d1d5db);
    border-radius: var(--border-radius-sm, 0.25rem);
    background-color: var(--color-surface-primary, white);
    color: var(--color-text-secondary, #6b7280);
    font-size: var(--font-size-xs, 0.75rem);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .actions-cell button:hover {
    background-color: var(--color-surface-secondary, #f9fafb);
  }

  .actions-cell button.danger {
    color: var(--color-error-600, #dc2626);
    border-color: var(--color-error-300, #fca5a5);
  }

  .actions-cell button.danger:hover {
    background-color: var(--color-error-50, #fef2f2);
  }

  .source-item {
    background-color: var(--color-blue-50, #eff6ff);
  }

  .source-item:hover {
    background-color: var(--color-blue-100, #dbeafe);
  }

  .preview-image {
    max-width: 100%;
    height: auto;
    border-radius: var(--border-radius-md, 0.375rem);
  }

  .preview-audio,
  .preview-video {
    width: 100%;
  }

  .binary-file-info {
    text-align: center;
    padding: var(--spacing-6, 1.5rem);
  }

  .file-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-4, 1rem);
  }

  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background-color: var(--color-surface-primary, white);
    border-radius: var(--border-radius-lg, 0.5rem);
    box-shadow: var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1));
    width: 90%;
    max-width: 32rem;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-6, 1.5rem);
    border-bottom: 1px solid var(--color-border-primary, #e5e7eb);
  }

  .modal-header h2 {
    margin: 0;
    font-size: var(--font-size-xl, 1.25rem);
    font-weight: var(--font-weight-semibold, 600);
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-text-secondary, #6b7280);
    cursor: pointer;
    padding: var(--spacing-1, 0.25rem);
    line-height: 1;
  }

  .modal-body {
    flex: 1;
    padding: var(--spacing-6, 1.5rem);
  }

  .modal-footer {
    display: flex;
    gap: var(--spacing-3, 0.75rem);
    justify-content: flex-end;
    padding: var(--spacing-6, 1.5rem);
    border-top: 1px solid var(--color-border-primary, #e5e7eb);
  }

  .modal-footer button {
    padding: var(--spacing-2, 0.5rem) var(--spacing-4, 1rem);
    border-radius: var(--border-radius-md, 0.375rem);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .modal-footer button.secondary {
    background-color: var(--color-surface-primary, white);
    color: var(--color-text-secondary, #6b7280);
    border: 1px solid var(--color-border-primary, #d1d5db);
  }

  .modal-footer button.primary {
    background-color: var(--color-primary-600, #2563eb);
    color: var(--color-white, white);
    border: 1px solid var(--color-primary-600, #2563eb);
  }

  /* Responsive adjustments */
  .manifest-view-demo.tablet .manifest-content {
    flex-direction: column;
  }

  .manifest-view-demo.tablet .manifest-sidebar {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--color-border-primary, #e5e7eb);
    max-height: 20rem;
  }

  .manifest-view-demo.mobile .manifest-content {
    flex-direction: column;
  }

  .manifest-view-demo.mobile .manifest-sidebar {
    display: none; /* Would show as modal in real implementation */
  }

  .manifest-view-demo.mobile .manifest-toolbar {
    flex-wrap: wrap;
    gap: var(--spacing-2, 0.5rem);
  }
</style>