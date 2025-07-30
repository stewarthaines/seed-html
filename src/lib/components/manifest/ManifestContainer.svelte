<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { t } from '../../i18n';
  import ManifestTable from './ManifestTable.svelte';
  import ManifestItemEditor from './ManifestItemEditor.svelte';
  import type { ManifestItem, SourceItem, ValidationResult } from '../../manifest/types';
  import type { WorkspaceService, WorkspaceState } from '../../services/workspace/workspace.service.js';

  export let workspace: WorkspaceState | null = null;
  export let workspaceService: WorkspaceService;
  export let advancedMode = true;

  // Create event dispatcher for item selection
  const dispatch = createEventDispatcher<{
    itemSelect: { item: ManifestItem | SourceItem; type: 'manifest' | 'source' };
  }>();

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
    if (!workspace) return;

    try {
      loading = true;
      error = null;

      // Load manifest items directly from workspace state
      manifestItems = workspace.opf.manifest;

      // Load SOURCE items if advanced mode is enabled
      if (advancedMode) {
        try {
          sourceItems = await workspaceService.listSourceFiles(workspace);
        } catch (error) {
          console.warn('Failed to load SOURCE items:', error);
          sourceItems = [];
        }
      } else {
        sourceItems = [];
      }

      // Skip validation for now - not essential for basic functionality
      validationErrors = [];
    } catch {
      error = $t('Failed to load manifest');
    } finally {
      loading = false;
    }
  };

  const handleItemSelection = (event: {
    detail: { item: ManifestItem | SourceItem; type: 'manifest' | 'source' };
  }) => {
    selectedItem = event.detail.item;
    selectedItemType = event.detail.type;

    // Dispatch the selection event to parent component
    dispatch('itemSelect', {
      item: event.detail.item,
      type: event.detail.type,
    });
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
    if (!workspace) return;

    const confirmed = confirm($t('Are you sure you want to delete this item?'));
    if (!confirmed) return;

    try {
      workspace = await workspaceService.removeManifestItem(workspace, event.detail.itemId);
      await loadManifest(); // Refresh the manifest

      // Clear selection if deleted item was selected
      if (selectedItem && 'id' in selectedItem && selectedItem.id === event.detail.itemId) {
        selectedItem = null;
        selectedItemType = null;
      }
    } catch {
      error = $t('Failed to delete item');
    }
  };

  const handleItemSave = async (event: { detail: { item: ManifestItem } }) => {
    if (!workspace) return;

    try {
      const { item } = event.detail;

      if (itemEditorMode === 'edit' && selectedItem && 'id' in selectedItem) {
        workspace = await workspaceService.updateManifestItem(workspace, selectedItem.id, item);
      } else {
        // Create new item based on mode
        if (itemEditorMode === 'create-text') {
          // Add manifest item first
          workspace = await workspaceService.addManifestItem(workspace, item);
          
          // Write the file content  
          const filePath = item.href.startsWith(workspace.pathInfo.basePath + '/') ? 
            item.href : 
            `${workspace.pathInfo.basePath}/${item.href}`;
          await workspaceService.writeFile(workspace.id, filePath, '');
        }
      }

      showItemEditor = false;
      await loadManifest(); // Refresh the manifest
    } catch {
      error = $t('Failed to save item');
    }
  };

  const handleFileUpload = async (event: { detail: { files: File[] } }) => {
    if (!workspace) return;

    try {
      const files = event.detail.files;

      for (const file of files) {        
        // Create manifest item
        const manifestItem = {
          href: file.name,
          mediaType: file.type || 'application/octet-stream'
        };
        
        workspace = await workspaceService.addManifestItem(workspace, manifestItem);
        
        // For text files, write as text; for binary files, we need a different approach
        const filePath = `${workspace.pathInfo.basePath}/${file.name}`;
        if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('xml')) {
          const text = await file.text();
          await workspaceService.writeFile(workspace.id, filePath, text);
        } else {
          // For binary files, we'd need a writeBinaryFile method or different handling
          // For now, skip binary file upload functionality
          console.warn('Binary file upload not yet implemented:', file.name);
        }
      }

      await loadManifest(); // Refresh the manifest
    } catch {
      error = $t('Failed to upload files');
    }
  };

  const handleEditorClose = () => {
    showItemEditor = false;
  };

  // Load manifest when component mounts or dependencies change
  onMount(loadManifest);
  $: if (workspace) {
    loadManifest();
  }
</script>

{#if loading}
  <div class="loading-state">
    <p>{$t('Loading manifest…')}</p>
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
