<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../i18n';
  import ManifestTable from './ManifestTable.svelte';
  import { ManifestUtils } from '../../manifest/utils.js';
  import { generateEPUBPath } from '../../epub/opf-utils.js';
  import type { ManifestItem, SourceItem, ValidationResult } from '../../manifest/types';
  import type { WorkspaceService, WorkspaceState } from '../../services/workspace/workspace.service.js';

  // Props using Svelte 5 runes syntax
  let {
    workspace = null,
    workspaceService,
    advancedMode = true,
    onItemSelect,
    onWorkspaceUpdate,
  }: {
    workspace?: WorkspaceState | null;
    workspaceService: WorkspaceService;
    advancedMode?: boolean;
    onItemSelect?: (event: { item: ManifestItem | SourceItem | any; type: 'manifest' | 'source' | 'opf' }) => void;
    onWorkspaceUpdate?: (workspace: WorkspaceState) => void;
  } = $props();

  // Component state using runes
  let manifestItems = $state<ManifestItem[]>([]);
  let sourceItems = $state<SourceItem[]>([]);
  let selectedItem = $state<ManifestItem | SourceItem | any | null>(null);
  let selectedItemType = $state<'manifest' | 'source' | 'opf' | null>(null);
  let validationErrors = $state<ValidationResult[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const loadManifest = async () => {
    if (!workspace) return;

    try {
      loading = true;
      error = null;

      // Load manifest items directly from workspace state
      const baseManifestItems = workspace.opf.manifest;

      // Populate file sizes for manifest items
      const manifestItemsWithSizes = await Promise.all(
        baseManifestItems.map(async (item) => {
          try {
            // Resolve manifest item href to full workspace path
            const resolvedPath = workspace!.pathInfo.basePath 
              ? `${workspace!.pathInfo.basePath}/${item.href}`
              : item.href;
            
            // Get file info using workspace service method
            const fileInfo = await workspaceService.getFileInfo(workspace!.id, resolvedPath);
            
            return {
              ...item,
              size: fileInfo.size
            };
          } catch {
            // If file doesn't exist or can't be accessed, keep item without size
            return item;
          }
        })
      );

      manifestItems = manifestItemsWithSizes;

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

  const handleItemSelection = (detail: {
    item: ManifestItem | SourceItem;
    type: 'manifest' | 'source' | 'opf';
  }) => {
    selectedItem = detail.item;
    selectedItemType = detail.type;

    // Call the callback function to notify parent component
    onItemSelect?.({
      item: detail.item,
      type: detail.type,
    });
  };

  const handleItemDelete = async (detail: { itemId: string }) => {
    if (!workspace) return;

    const confirmed = confirm($t('Are you sure you want to delete this item?'));
    if (!confirmed) return;

    try {
      workspace = await workspaceService.removeManifestItem(workspace, detail.itemId);
      // Keep global app state in sync with the persisted content.opf.
      onWorkspaceUpdate?.(workspace);
      await loadManifest(); // Refresh the manifest

      // Clear selection if deleted item was selected
      if (selectedItem && 'id' in selectedItem && selectedItem.id === detail.itemId) {
        selectedItem = null;
        selectedItemType = null;
      }
    } catch {
      error = $t('Failed to delete item');
    }
  };

  const handleFileUpload = async (detail: { files: FileList | File[] }) => {
    if (!workspace) return;

    const files = detail.files;
    const successfulFiles: string[] = [];
    const failedFiles: { name: string; error: string }[] = [];

    for (const file of files) {
      try {
        // Create manifest item with reliable media type detection
        const browserType = file.type;
        const filenameType = ManifestUtils.detectMediaType(file.name);
        
        // For font files and JavaScript files, always use filename detection (browsers are unreliable)
        // For other files, prefer browser detection unless it's generic
        const isGeneric = !browserType || browserType === 'application/octet-stream';
        const isFontFile = filenameType.startsWith('font/');
        const isJavaScriptFile = filenameType === 'application/javascript' || filenameType === 'text/javascript';
        const reliableMediaType = (isGeneric || isFontFile || isJavaScriptFile) ? filenameType : browserType;
        
        const manifestItem = {
          href: generateEPUBPath(file.name, reliableMediaType),
          mediaType: reliableMediaType
        };

        // Step 1: Add to manifest (may fail on duplicate ID). This persists content.opf.
        workspace = await workspaceService.addManifestItem(workspace, manifestItem);
        // addManifestItem appends the new entry, so it is the last one.
        const addedItemId = workspace.opf.manifest[workspace.opf.manifest.length - 1].id;

        // Step 2: Write the file content. If this fails, roll back the manifest
        // entry so content.opf never references a file that isn't in storage.
        const filePath = `${workspace.pathInfo.basePath}/${manifestItem.href}`;
        try {
          if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('xml')) {
            const text = await file.text();
            await workspaceService.writeFile(workspace.id, filePath, text);
          } else {
            // Handle binary files (images, fonts, etc.)
            const arrayBuffer = await file.arrayBuffer();
            await workspaceService.writeBinaryFile(workspace.id, filePath, arrayBuffer);
          }
        } catch (writeError) {
          // Undo the manifest entry we just added (also removes the absent file).
          workspace = await workspaceService.removeManifestItem(workspace, addedItemId);
          throw writeError;
        }

        // Both operations succeeded
        successfulFiles.push(file.name);
      } catch (fileError) {
        // Log specific file upload failure
        console.warn(`Failed to upload ${file.name}:`, fileError);
        failedFiles.push({
          name: file.name,
          error: fileError instanceof Error ? fileError.message : 'Unknown error'
        });
      }
    }

    // Push the persisted workspace back to global app state so a later save
    // can't overwrite content.opf with a stale copy that lacks these items.
    if (successfulFiles.length > 0) {
      onWorkspaceUpdate?.(workspace);
    }

    // Refresh the manifest to show successfully uploaded files
    await loadManifest();

    // Provide user feedback about upload results
    if (failedFiles.length === 0) {
      // All files succeeded
      console.log(`Successfully uploaded ${successfulFiles.length} files:`, successfulFiles);
    } else if (successfulFiles.length === 0) {
      // All files failed
      error = $t('Failed to upload all files');
      console.error('Upload failures:', failedFiles);
    } else {
      // Partial success
      console.log(`Uploaded ${successfulFiles.length} files successfully:`, successfulFiles);
      console.warn(`Failed to upload ${failedFiles.length} files:`, failedFiles);
      error = $t('Some files failed to upload - see console for details');
    }
  };

  // Load manifest when component mounts or dependencies change
  onMount(loadManifest);

  // React to workspace changes (e.g., after delete/add operations)
  $effect(() => {
    if (workspace) {
      loadManifest();
    }
  });

  // React to advancedMode changes
  $effect(() => {
    if (!workspace) return;

    // When advancedMode changes, reload source items
    if (advancedMode) {
      // Load SOURCE items if advanced mode is enabled
      workspaceService.listSourceFiles(workspace)
        .then(items => {
          sourceItems = items;
        })
        .catch(error => {
          console.warn('Failed to load SOURCE items:', error);
          sourceItems = [];
        });
    } else {
      // Clear SOURCE items if advanced mode is disabled
      sourceItems = [];
    }
  });
  
  // React to workspace changes
  $effect(() => {
    if (workspace) {
      loadManifest();
    }
  });

  // --- Window-wide drag-and-drop ---------------------------------------------
  // This component is mounted only while the Manifest view is active, so a file
  // dropped anywhere in the window is unambiguous intent to add it. Listen at
  // the window level and route the files through the same upload path as the
  // Load File button.
  let isDragging = $state(false);
  let dragDepth = 0; // enter/leave counter so nested elements don't flicker

  const dragHasFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files');

  const handleWindowDragEnter = (event: DragEvent) => {
    if (!dragHasFiles(event)) return;
    dragDepth += 1;
    isDragging = true;
  };

  const handleWindowDragOver = (event: DragEvent) => {
    if (!dragHasFiles(event)) return;
    event.preventDefault(); // required for a drop to fire
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };

  const handleWindowDragLeave = (event: DragEvent) => {
    if (!dragHasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) isDragging = false;
  };

  const handleWindowDrop = (event: DragEvent) => {
    dragDepth = 0;
    isDragging = false;
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    handleFileUpload({ files: event.dataTransfer.files });
  };
</script>

<svelte:window
  ondragenter={handleWindowDragEnter}
  ondragover={handleWindowDragOver}
  ondragleave={handleWindowDragLeave}
  ondrop={handleWindowDrop}
/>

{#if loading}
  <div class="loading-state">
    <p>{$t('Loading manifest…')}</p>
  </div>
{:else if error}
  <div class="error-state">
    <p class="error-message">{error}</p>
    <button type="button" class="retry-button" onclick={loadManifest}>
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
    onItemSelect={handleItemSelection}
    onItemDelete={handleItemDelete}
    onFileUpload={handleFileUpload}
  />
{/if}

{#if isDragging}
  <div class="drop-overlay" aria-hidden="true">
    <div class="drop-message">
      <p class="drop-title">{$t('Drop to add to the manifest')}</p>
      <p class="drop-subtitle">{$t('Release the file anywhere to add it')}</p>
    </div>
  </div>
{/if}

<style>
  .drop-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    /* Let drag events fall through to the window handlers. */
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(var(--color-primary-rgb), 0.12);
    border: 3px dashed var(--color-primary);
  }

  .drop-message {
    padding: 1.5rem 2rem;
    background-color: var(--color-surface);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg, var(--shadow-sm));
    text-align: center;
  }

  .drop-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .drop-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

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
