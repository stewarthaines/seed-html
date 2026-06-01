<script lang="ts">
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import Sidebar from './Sidebar.svelte';
  import { layoutStore } from './stores/layout';
  import { t as _t } from './i18n';

  // Props
  export let hasWorkspace: boolean = false;
  export let currentWorkspace: any = null;
  export let workspaceTitle: string | undefined = undefined;
  export let extensionManager: any = null;

  // Subscribe to layout store
  $: ({ sidebar } = $layoutStore);

  // Reactive sidebar width for grid template
  $: sidebarWidth = sidebar.isExpanded ? '250px' : '48px';

  // Determine which sections should show preview pane
  $: showPreviewPane =
    sidebar.activeSection !== 'workspace' &&
    sidebar.activeSection !== 'settings' &&
    sidebar.activeSection !== 'publish';
</script>

<div class="app-layout" style="grid-template-columns: {sidebarWidth} 1fr">
  <Sidebar isExpanded={sidebar.isExpanded} activeSection={sidebar.activeSection} {hasWorkspace} {currentWorkspace} {workspaceTitle} {extensionManager}>
    {#snippet sidebarWorkspace()}<slot name="sidebar-workspace" />{/snippet}
    {#snippet sidebarMetadata()}<slot name="sidebar-metadata" />{/snippet}
    {#snippet sidebarManifest()}<slot name="sidebar-manifest" />{/snippet}
    {#snippet sidebarNavigation()}<slot name="sidebar-navigation" />{/snippet}
    {#snippet sidebarSpine()}<slot name="sidebar-spine" />{/snippet}
    {#snippet sidebarSettings()}<slot name="sidebar-settings" />{/snippet}
    {#snippet sidebarFooter()}<slot name="sidebar-footer" />{/snippet}
  </Sidebar>

  <div class="main-content">
    {#if showPreviewPane}
      <PaneGroup direction="horizontal" autoSaveId="editme-content-panes">
        <Pane defaultSize={50} minSize={25}>
          <div class="pane-content">
            <slot name="left-content" />
          </div>
        </Pane>

        <PaneResizer />

        <Pane defaultSize={50} minSize={20}>
          <div class="pane-content">
            <slot name="right-content" />
          </div>
        </Pane>
      </PaneGroup>
    {:else}
      <!-- Single pane mode for workspace and settings views -->
      <div class="single-pane-container">
        <slot name="left-content" />
      </div>
    {/if}
  </div>
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
    min-inline-size: 0; /* Using logical properties */
    overflow: hidden;
  }

  .pane-content {
    flex: 1;
    overflow: auto;
    background: var(--color-bg-primary); /* Using design tokens */
    height: 100%;
  }

  .single-pane-container {
    height: 100%;
    overflow: auto;
    background: var(--color-bg-primary);
  }

  /* PaneForge resizer styling - using logical properties */
  :global([data-pane-resizer]) {
    background: var(--color-border-default);
    inline-size: 4px; /* Using logical properties */
    cursor: col-resize;
    transition: background-color var(--duration-fast) ease; /* Using motion tokens */
  }

  :global([data-pane-resizer]:hover) {
    background: var(--color-border-strong);
  }

  :global([data-pane-resizer][data-resize-handle-active]) {
    background: var(--color-border-accent);
  }

  /* Focus indicators for accessibility */
  :global([data-pane-resizer]:focus-visible) {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .main-content {
      border-inline-start: 2px solid var(--color-forced-border);
    }
  }
</style>
