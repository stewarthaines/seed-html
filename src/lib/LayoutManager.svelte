<script lang="ts">
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import type { Snippet } from 'svelte';
  import Sidebar from './Sidebar.svelte';
  import { layoutStore } from './stores/layout';
  import { t as _t } from './i18n';

  // Props
  let {
    hasWorkspace = false,
    readOnly = false,
    hasPublishedEpubs = false,
    enabledPluginIds = [],
    currentWorkspace = null,
    workspaceTitle = undefined,
    extensionManager = null,
    leftContent,
    rightContent,
    sidebarWorkspace,
    sidebarMetadata,
    sidebarManifest,
    sidebarNavigation,
    sidebarSpine,
    sidebarSettings,
    sidebarFooter,
  }: {
    hasWorkspace?: boolean;
    readOnly?: boolean;
    hasPublishedEpubs?: boolean;
    enabledPluginIds?: string[];
    currentWorkspace?: any;
    workspaceTitle?: string | undefined;
    extensionManager?: any;
    leftContent?: Snippet;
    rightContent?: Snippet;
    sidebarWorkspace?: Snippet;
    sidebarMetadata?: Snippet;
    sidebarManifest?: Snippet;
    sidebarNavigation?: Snippet;
    sidebarSpine?: Snippet;
    sidebarSettings?: Snippet;
    sidebarFooter?: Snippet;
  } = $props();

  // Subscribe to layout store
  const sidebar = $derived($layoutStore.sidebar);

  // Reactive sidebar width for grid template
  const sidebarWidth = $derived(sidebar.isExpanded ? '250px' : '48px');

  // Determine which sections should show preview pane
  const showPreviewPane = $derived(
    sidebar.activeSection !== 'workspace' &&
      sidebar.activeSection !== 'settings' &&
      sidebar.activeSection !== 'publish'
  );
</script>

<div class="app-layout" style="grid-template-columns: {sidebarWidth} 1fr">
  <Sidebar
    isExpanded={sidebar.isExpanded}
    activeSection={sidebar.activeSection}
    {hasWorkspace}
    {readOnly}
    {hasPublishedEpubs}
    {enabledPluginIds}
    {currentWorkspace}
    {workspaceTitle}
    {extensionManager}
    {sidebarWorkspace}
    {sidebarMetadata}
    {sidebarManifest}
    {sidebarNavigation}
    {sidebarSpine}
    {sidebarSettings}
    {sidebarFooter}
  />

  <main class="main-content">
    {#if showPreviewPane}
      <PaneGroup direction="horizontal" autoSaveId="editme-content-panes">
        <Pane defaultSize={50} minSize={25}>
          <div class="pane-content">
            {@render leftContent?.()}
          </div>
        </Pane>

        <PaneResizer />

        <Pane defaultSize={50} minSize={20}>
          <div class="pane-content">
            {@render rightContent?.()}
          </div>
        </Pane>
      </PaneGroup>
    {:else}
      <!-- Single pane mode for workspace and settings views -->
      <div class="single-pane-container">
        {@render leftContent?.()}
      </div>
    {/if}
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

  :global([data-pane-resizer]:hover),
  :global([data-pane-resizer][data-resize-handle-active]) {
    background: var(--color-accent);
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
