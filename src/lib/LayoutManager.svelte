<script lang="ts">
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import Sidebar from './Sidebar.svelte';
  import { layoutStore } from './stores/layout';

  // Subscribe to layout store
  $: ({ sidebar } = $layoutStore);

  // Reactive sidebar width for grid template
  $: sidebarWidth = sidebar.isExpanded ? '250px' : '48px';
</script>

<div class="app-layout" style="grid-template-columns: {sidebarWidth} 1fr">
  <Sidebar isExpanded={sidebar.isExpanded} activeSection={sidebar.activeSection}>
    <svelte:fragment slot="sidebar-workspace">
      <slot name="sidebar-workspace" />
    </svelte:fragment>

    <svelte:fragment slot="sidebar-metadata">
      <slot name="sidebar-metadata" />
    </svelte:fragment>

    <svelte:fragment slot="sidebar-manifest">
      <slot name="sidebar-manifest" />
    </svelte:fragment>

    <svelte:fragment slot="sidebar-nav">
      <slot name="sidebar-nav" />
    </svelte:fragment>

    <svelte:fragment slot="sidebar-spine">
      <slot name="sidebar-spine" />
    </svelte:fragment>

    <svelte:fragment slot="sidebar-settings">
      <slot name="sidebar-settings" />
    </svelte:fragment>
  </Sidebar>

  <main class="main-content">
    <PaneGroup direction="horizontal" autoSaveId="editme-content-panes">
      <Pane defaultSize={50} minSize={25}>
        <div class="pane-container">
          <div class="pane-header">
            <slot name="left-header" />
          </div>
          <div class="pane-content">
            <slot name="left-content" />
          </div>
        </div>
      </Pane>

      <PaneResizer />

      <Pane defaultSize={50} minSize={20}>
        <div class="pane-container">
          <div class="pane-header">
            <slot name="right-header" />
          </div>
          <div class="pane-content">
            <slot name="right-content" />
          </div>
        </div>
      </Pane>
    </PaneGroup>
  </main>
</div>

<style>
  .app-layout {
    display: grid;
    height: 100vh;
    width: 100vw;
    margin: 0;
    padding: 0;
  }

  .main-content {
    min-width: 0;
    overflow: hidden;
  }

  .pane-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .pane-header {
    flex-shrink: 0;
    border-bottom: 1px solid #e0e0e0;
    background: #f8f9fa;
    min-height: 40px;
    display: flex;
    align-items: center;
    padding: 0 1rem;
  }

  .pane-content {
    flex: 1;
    overflow: auto;
    background: white;
  }

  /* PaneForge resizer styling */
  :global([data-pane-resizer]) {
    background: #e0e0e0;
    width: 4px;
    cursor: col-resize;
    transition: background-color 0.2s ease;
  }

  :global([data-pane-resizer]:hover) {
    background: #ccc;
  }

  :global([data-pane-resizer][data-resize-handle-active]) {
    background: #999;
  }
</style>
