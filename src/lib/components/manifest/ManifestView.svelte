<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n';
  import ManifestContainer from './ManifestContainer.svelte';
  import ManifestPreview from './ManifestPreview.svelte';
  import type { WorkspaceService, WorkspaceState } from '../../services/workspace/workspace.service.js';

  export let workspace: WorkspaceState | null = null;
  export let workspaceService: WorkspaceService;
  export let advancedMode = true;
  
  // Make advancedMode reactive
  let internalAdvancedMode = advancedMode;
  
  // Sync external prop changes
  $: internalAdvancedMode = advancedMode;
  
  const toggleAdvancedMode = () => {
    internalAdvancedMode = !internalAdvancedMode;
    // Store preference in localStorage
    localStorage.setItem('manifest-advanced-mode', internalAdvancedMode.toString());
  };
  
  // Load preference from localStorage on mount
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('manifest-advanced-mode');
    if (stored !== null) {
      internalAdvancedMode = stored === 'true';
    }
  }

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
  <!-- Header with advanced mode toggle -->
  <div class="manifest-header">
    <div class="header-content">
      <h2 class="view-title">{$t('File Manifest')}</h2>
      <div class="header-controls">
        <label class="toggle-label">
          <input
            type="checkbox"
            class="toggle-input"
            bind:checked={internalAdvancedMode}
            on:change={toggleAdvancedMode}
          />
          <span class="toggle-text">{$t('Advanced')} {$t('Mode')}</span>
        </label>
      </div>
    </div>
  </div>

  <div class="manifest-panes">
    <!-- Left pane: Manifest table -->
    <div class="table-pane">
      <ManifestContainer
        {workspace}
        {workspaceService}
        advancedMode={internalAdvancedMode}
        on:itemSelect={handleItemSelection}
      />
    </div>

    <!-- Right pane: Content preview -->
    <div class="preview-pane">
      <ManifestPreview {selectedItem} {selectedItemType} {workspace} {workspaceService} />
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

  .manifest-header {
    flex-shrink: 0;
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border-default);
    background-color: var(--color-surface-secondary);
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 100%;
  }

  .view-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    user-select: none;
  }

  .toggle-input {
    margin: 0;
    cursor: pointer;
  }

  .toggle-text {
    font-weight: var(--font-weight-medium);
  }

  .manifest-panes {
    display: flex;
    flex: 1;
    position: relative;
    overflow: hidden;
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
