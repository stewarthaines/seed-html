<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../i18n';
  import ManifestTable from './ManifestTable.svelte';
  import ManifestPreview from './ManifestPreview.svelte';
  import ManifestItemEditor from './ManifestItemEditor.svelte';
  import type { ManifestItem, SourceItem, ValidationResult } from '../../manifest/types';
  import type { IManifestManager } from '../../manifest/manifest-manager';

  export let workspaceId = '';
  export let manifestManager: IManifestManager | null = null;
  export let advancedMode = false;

  let manifestItems: ManifestItem[] = [];
  let sourceItems: SourceItem[] = [];
  let selectedItem: ManifestItem | SourceItem | null = null;
  let selectedItemType: 'manifest' | 'source' | null = null;
  let validationErrors: ValidationResult[] = [];
  let loading = true;
  let error: string | null = null;
  let showItemEditor = false;
  let itemEditorMode: 'create-text' | 'create-file' | 'edit' = 'create-text';

  const loadManifest = async () => {
    if (!manifestManager || !workspaceId) return;

    try {
      loading = true;
      error = null;
      
      // Load manifest items
      manifestItems = await manifestManager.loadManifest(workspaceId);
      
      // Load SOURCE items if advanced mode is enabled
      if (advancedMode) {
        const isAdvancedModeEnabled = await manifestManager.isAdvancedModeEnabled(workspaceId);
        if (isAdvancedModeEnabled) {
          sourceItems = await manifestManager.listSourceItems(workspaceId);
        }
      }
      
      // Validate manifest
      validationErrors = await manifestManager.validateManifest(workspaceId);
      
    } catch (err) {
      error = $t('Failed to load manifest');
    } finally {
      loading = false;
    }
  };

  const handleItemSelection = (event: { detail: { item: ManifestItem | SourceItem; type: 'manifest' | 'source' } }) => {
    selectedItem = event.detail.item;
    selectedItemType = event.detail.type;
  };

  const handleItemCreate = (event: { detail: { mode: 'create-text' | 'create-file' } }) => {
    itemEditorMode = event.detail.mode;
    showItemEditor = true;
  };

  const handleItemEdit = (event: { detail: { item: ManifestItem } }) => {
    selectedItem = event.detail.item;
    selectedItemType = 'manifest';
    itemEditorMode = 'edit';
    showItemEditor = true;
  };

  const handleItemDelete = async (event: { detail: { itemId: string } }) => {
    if (!manifestManager || !workspaceId) return;

    const confirmed = confirm($t('Are you sure you want to delete this item?'));
    if (!confirmed) return;

    try {
      await manifestManager.deleteManifestItem(workspaceId, event.detail.itemId);
      await loadManifest(); // Refresh the manifest
      
      // Clear selection if deleted item was selected
      if (selectedItem && 'id' in selectedItem && selectedItem.id === event.detail.itemId) {
        selectedItem = null;
        selectedItemType = null;
      }
    } catch (err) {
      error = $t('Failed to delete item');
    }
  };

  const handleItemSave = async (event: { detail: { item: ManifestItem } }) => {
    if (!manifestManager || !workspaceId) return;

    try {
      const { item } = event.detail;
      
      if (itemEditorMode === 'edit' && selectedItem && 'id' in selectedItem) {
        await manifestManager.updateManifestItem(workspaceId, selectedItem.id, item);
      } else {
        // Create new item based on mode
        if (itemEditorMode === 'create-text') {
          await manifestManager.createTextItem(workspaceId, {
            fileName: item.href.split('/').pop() || 'untitled.txt',
            content: '',
            id: item.id,
            mediaType: item.mediaType,
            properties: item.properties
          });
        }
      }
      
      showItemEditor = false;
      await loadManifest(); // Refresh the manifest
    } catch (err) {
      error = $t('Failed to save item');
    }
  };

  const handleFileUpload = async (event: { detail: { files: File[] } }) => {
    if (!manifestManager || !workspaceId) return;

    try {
      const files = event.detail.files;
      
      for (const file of files) {
        await manifestManager.createFileItem(workspaceId, file);
      }
      
      await loadManifest(); // Refresh the manifest
    } catch (err) {
      error = $t('Failed to upload files');
    }
  };

  const handleEditorClose = () => {
    showItemEditor = false;
  };

  // Load manifest when component mounts or dependencies change
  onMount(loadManifest);
  $: if (workspaceId && manifestManager) {
    loadManifest();
  }
</script>

{#if loading}
  <div class="loading-state">
    <p>{$t('Loading manifest...')}</p>
  </div>
{:else if error}
  <div class="error-state">
    <p class="error-message">{error}</p>
    <button type="button" class="retry-button" on:click={loadManifest}>
      {$t('Retry')}
    </button>
  </div>
{:else}
  <ManifestTable
    {manifestItems}
    {sourceItems}
    {advancedMode}
    {validationErrors}
    {selectedItem}
    {selectedItemType}
    on:itemSelect={handleItemSelection}
    on:itemCreate={handleItemCreate}
    on:itemEdit={handleItemEdit}
    on:itemDelete={handleItemDelete}
    on:fileUpload={handleFileUpload}
  />
{/if}

{#if showItemEditor}
  <ManifestItemEditor
    {itemEditorMode}
    item={itemEditorMode === 'edit' ? selectedItem : null}
    {validationErrors}
    on:save={handleItemSave}
    on:close={handleEditorClose}
  />
{/if}

<style>
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    text-align: center;
  }

  .error-message {
    color: var(--color-error);
    margin-block-end: 1rem;
  }

  .retry-button {
    padding: 0.75rem 1.5rem;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    background-color: var(--color-primary);
    color: var(--color-surface);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-button:hover {
    background-color: var(--color-interactive-primary-hover);
    border-color: var(--color-interactive-primary-hover);
  }

  .retry-button:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }
</style>