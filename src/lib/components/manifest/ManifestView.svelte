<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ManifestContainer from './ManifestContainer.svelte';
  import ManifestPreview from './ManifestPreview.svelte';
  import type { IManifestManager } from '../../manifest/manifest-manager';

  export let workspaceId = '';
  export let manifestManager: IManifestManager | null = null;
  export let advancedMode = false;

  let selectedItem: any = null;
  let selectedItemType: 'manifest' | 'source' | null = null;

  const handleItemSelection = (event: any) => {
    selectedItem = event.detail.item;
    selectedItemType = event.detail.type;
    
    // Forward the event to parent components
    dispatch('itemSelect', event.detail);
  };
  
  const dispatch = createEventDispatcher();
</script>

<div class="manifest-view">
  <div class="manifest-panes">
    <!-- Left pane: Manifest table -->
    <div class="table-pane">
      <ManifestContainer
        {workspaceId}
        {manifestManager}
        {advancedMode}
        on:itemSelect={handleItemSelection}
      />
    </div>

    <!-- Right pane: Content preview -->
    <div class="preview-pane">
      <ManifestPreview
        {selectedItem}
        {selectedItemType}
        {workspaceId}
        {manifestManager}
      />
    </div>
  </div>
</div>

<style>
  .manifest-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--color-surface-primary);
  }

  .manifest-panes {
    display: flex;
    height: 100%;
    position: relative;
  }

  .table-pane {
    flex: 1;
    overflow: hidden;
    border-inline-end: 1px solid var(--color-border-default);
  }

  .preview-pane {
    flex: 1;
    overflow: hidden;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .manifest-panes {
      flex-direction: column;
    }

    .table-pane {
      border-inline-end: none;
      border-block-end: 1px solid var(--color-border-default);
    }
  }
</style>