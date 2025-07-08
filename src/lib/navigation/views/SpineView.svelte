<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { navigationStore } from '../navigation-store';
  import type { WorkspaceManager } from '../../workspace';
  import type { SpineItemWithSource } from '../../spine/types';
  import { SpineItemManager } from '../../spine/spine-item-manager';
  import { t } from '../../i18n';

  // Props
  export let workspaceId: string;
  export let workspaceManager: WorkspaceManager;
  export let selectedItemId: string | null = null;

  // Component state
  let spineManager: SpineItemManager;
  let selectedItem: SpineItemWithSource | null = null;
  let sourceContent = '';
  let isLoading = false;
  let error: string | null = null;
  let guardId: string;

  // ViewComponent interface implementation
  export function onViewEnter(data?: any): void {
    // Initialize spine manager
    spineManager = new SpineItemManager(workspaceManager);

    // Load selected item if available
    if (selectedItemId) {
      loadSelectedItem();
    }
  }

  export function onViewLeave(): void {
    // Clean up any state if needed
  }

  export function getViewData(): any {
    return {
      selectedItemId,
      selectedItem,
      sourceContent,
    };
  }

  export function setViewData(data: any): void {
    if (data.selectedItemId) {
      selectedItemId = data.selectedItemId;
      loadSelectedItem();
    }
  }

  export async function canLeave(): Promise<boolean> {
    // For now, always allow leaving since this is read-only
    return true;
  }

  // Load selected item data
  async function loadSelectedItem() {
    if (!selectedItemId || !spineManager) return;

    isLoading = true;
    error = null;
    sourceContent = '';

    try {
      // Load spine items to find the selected one
      const spineItems = await spineManager.loadSpineItems(workspaceId);
      selectedItem = spineItems.find(item => item.id === selectedItemId) || null;

      if (selectedItem) {
        // Load source content if available
        try {
          const sourcePath = `SOURCE/text/${selectedItemId}.txt`;
          sourceContent = await workspaceManager.readTextFile(workspaceId, sourcePath);
        } catch (err) {
          // Source file might not exist
          sourceContent = '';
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load spine item';
    } finally {
      isLoading = false;
    }
  }

  // Component lifecycle
  onMount(() => {
    // Register navigation guard
    guardId = navigationStore.addNavigationGuard(canLeave);

    // Call onViewEnter
    onViewEnter();
  });

  onDestroy(() => {
    // Clean up guard
    if (guardId) {
      navigationStore.removeNavigationGuard(guardId);
    }

    // Call onViewLeave
    onViewLeave();
  });

  // React to prop changes
  $: if (selectedItemId && spineManager) {
    loadSelectedItem();
  }

  // Format file size for display
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
</script>

<div class="spine-view">
  <header class="view-header">
    <h2>{$t('Spine Item Details')}</h2>
    <p>{$t('View and manage spine item content')}</p>
  </header>

  <div class="view-content">
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$t('Loading spine item...')}</p>
      </div>
    {:else if error}
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <p>{error}</p>
      </div>
    {:else if !selectedItemId}
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h3>{$t('No spine item selected')}</h3>
        <p>{$t('Select a spine item from the sidebar to view its details')}</p>
      </div>
    {:else if selectedItem}
      <div class="item-details">
        <!-- Item metadata section -->
        <section class="metadata-section">
          <h3>{$t('Item Information')}</h3>
          <div class="metadata-grid">
            <div class="metadata-item">
              <label>{$t('ID')}</label>
              <span class="mono">{selectedItem.id}</span>
            </div>
            <div class="metadata-item">
              <label>{$t('Title')}</label>
              <span>{selectedItem.idref || $t('Untitled')}</span>
            </div>
            <div class="metadata-item">
              <label>{$t('Linear')}</label>
              <span class={selectedItem.linear ? 'status-success' : 'status-warning'}>
                {selectedItem.linear ? $t('Yes') : $t('No')}
              </span>
            </div>
            <div class="metadata-item">
              <label>{$t('XHTML Path')}</label>
              <span class="mono">{selectedItem.href}</span>
            </div>
            <div class="metadata-item">
              <label>{$t('Source Path')}</label>
              <span class="mono">SOURCE/text/{selectedItem.id}.txt</span>
            </div>
            <div class="metadata-item">
              <label>{$t('Source Status')}</label>
              <span class={selectedItem.hasSourceFile ? 'status-success' : 'status-error'}>
                {selectedItem.hasSourceFile ? $t('Available') : $t('Missing')}
              </span>
            </div>
          </div>
        </section>

        <!-- Source content section -->
        <section class="content-section">
          <div class="section-header">
            <h3>{$t('Source Content')}</h3>
            {#if sourceContent}
              <span class="content-size">{formatFileSize(new Blob([sourceContent]).size)}</span>
            {/if}
          </div>

          {#if sourceContent}
            <div class="content-viewer">
              <pre class="source-content">{sourceContent}</pre>
            </div>
          {:else if selectedItem.hasSourceFile}
            <div class="content-placeholder">
              <p>{$t('Unable to load source content')}</p>
            </div>
          {:else}
            <div class="content-missing">
              <span class="warning-icon">⚠️</span>
              <p>{$t('Source file not found')}</p>
              <small>{$t('Expected at')}: SOURCE/text/{selectedItem.id}.txt</small>
            </div>
          {/if}
        </section>

        <!-- Future features placeholder -->
        <section class="future-features">
          <div class="feature-card">
            <span class="feature-icon">✏️</span>
            <h4>{$t('Text Editor')}</h4>
            <p>{$t('Edit source content with syntax highlighting and validation (Phase 4)')}</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">👁️</span>
            <h4>{$t('Preview')}</h4>
            <p>{$t('Live preview with device emulation (Phase 5)')}</p>
          </div>
        </section>
      </div>
    {/if}
  </div>
</div>

<style>
  .spine-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .view-header {
    padding: var(--space-6);
    border-bottom: 1px solid var(--color-border-default);
    background-color: var(--color-bg-secondary);
  }

  .view-header h2 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .view-header p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .view-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-6);
  }

  /* Loading, error, and empty states */
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    text-align: center;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border-default);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--space-4);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-icon,
  .warning-icon {
    font-size: var(--text-2xl);
    margin-bottom: var(--space-3);
  }

  .error-state {
    color: var(--color-status-error);
  }

  .empty-icon {
    font-size: 3rem;
    opacity: 0.5;
    margin-bottom: var(--space-4);
  }

  .empty-state h3 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
  }

  .empty-state p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  /* Item details */
  .item-details {
    max-width: 1200px;
  }

  .metadata-section,
  .content-section {
    margin-bottom: var(--space-8);
  }

  .metadata-section h3,
  .content-section h3 {
    margin: 0 0 var(--space-4) 0;
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
  }

  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: var(--space-4);
    background-color: var(--color-bg-secondary);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-default);
  }

  .metadata-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .metadata-item label {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .metadata-item span {
    font-size: var(--text-sm);
    color: var(--color-text-primary);
  }

  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .status-success {
    color: var(--color-status-success);
  }

  .status-warning {
    color: var(--color-status-warning);
  }

  .status-error {
    color: var(--color-status-error);
  }

  /* Content section */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
  }

  .content-size {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .content-viewer {
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .source-content {
    margin: 0;
    padding: var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: 1.6;
    color: var(--color-text-primary);
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-x: auto;
    max-height: 500px;
    overflow-y: auto;
  }

  .content-placeholder,
  .content-missing {
    padding: var(--space-8);
    text-align: center;
    background-color: var(--color-bg-secondary);
    border: 1px dashed var(--color-border-default);
    border-radius: var(--radius-md);
  }

  .content-missing {
    color: var(--color-status-warning);
  }

  .content-missing small {
    display: block;
    margin-top: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  /* Future features */
  .future-features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-4);
    margin-top: var(--space-8);
  }

  .feature-card {
    padding: var(--space-4);
    background-color: var(--color-bg-secondary);
    border: 1px dashed var(--color-border-default);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .feature-icon {
    font-size: var(--text-2xl);
    display: block;
    margin-bottom: var(--space-3);
    opacity: 0.5;
  }

  .feature-card h4 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-base);
    font-weight: var(--font-medium);
  }

  .feature-card p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  /* Scrollbar styling */
  .source-content::-webkit-scrollbar,
  .view-content::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .source-content::-webkit-scrollbar-track,
  .view-content::-webkit-scrollbar-track {
    background: var(--color-bg-primary);
  }

  .source-content::-webkit-scrollbar-thumb,
  .view-content::-webkit-scrollbar-thumb {
    background: var(--color-border-strong);
    border-radius: var(--radius-xs);
  }

  .source-content::-webkit-scrollbar-thumb:hover,
  .view-content::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-tertiary);
  }
</style>
