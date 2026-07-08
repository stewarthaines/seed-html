<script lang="ts">
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import type { Snippet } from 'svelte';
  import Sidebar from './Sidebar.svelte';
  import { layoutStore } from './stores/layout';
  import { t } from './i18n';
  import { CaretLeft } from 'phosphor-svelte';

  // Props
  let {
    hasWorkspace = false,
    readOnly = false,
    reviewMode = false,
    hasPackagedEpubs = false,
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
    reviewMode?: boolean;
    hasPackagedEpubs?: boolean;
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

  // Spine view only: the preview pane collapses to a slim rail (writing mode).
  // Other views always keep their right pane.
  const previewCollapsed = $derived(
    $layoutStore.spinePreviewCollapsed && sidebar.activeSection === 'spine'
  );
</script>

<div class="app-layout" style="grid-template-columns: {sidebarWidth} 1fr">
  <Sidebar
    isExpanded={sidebar.isExpanded}
    activeSection={sidebar.activeSection}
    {hasWorkspace}
    {readOnly}
    {reviewMode}
    {hasPackagedEpubs}
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
    {#if showPreviewPane && previewCollapsed}
      <!-- Writing mode: editor full width, preview folded into a rail that
           mirrors the collapsed sidebar (toggle at the top edge). -->
      <div class="preview-collapsed-layout">
        <div class="pane-content">
          {@render leftContent?.()}
        </div>
        <div class="preview-rail">
          <button
            class="btn btn-icon btn-icon-lg"
            onclick={() => layoutStore.toggleSpinePreview()}
            aria-expanded="false"
            aria-label={$t('Show preview')}
            title={$t('Show preview')}
          >
            <CaretLeft size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    {:else if showPreviewPane}
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
    height: 100dvh; /* dynamic viewport: excludes mobile browser UI chrome */
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

  /* Writing mode: editor + a slim rail where the preview pane was. The rail
     mirrors the collapsed sidebar — 48px wide, toggle in a header-height strip. */
  .preview-collapsed-layout {
    display: flex;
    height: 100%;
    min-inline-size: 0;
  }

  .preview-rail {
    flex-shrink: 0;
    inline-size: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--color-sidebar-bg);
    border-inline-start: 1px solid var(--color-border-strong);
  }

  .preview-rail .btn {
    background: var(--color-bg-tertiary);
    inline-size: 100%;
    min-block-size: var(--touch-target-min);
    border-radius: 0;
  }

  /* PaneForge resizer styling - using logical properties.
     border-strong (one step more contrasted than the bg-tertiary header) gives a
     clear division in both themes: darker than the header in light (#e0e0e0 vs
     #f0f0f0), lighter in dark (#666 vs #444). */
  :global([data-pane-resizer]) {
    background: var(--color-border-strong);
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

  /* Touch devices: the 4px strip is too fine a drag target, so grow a thumb at
     the bottom of the handle. A pseudo-element extends the resizer's hit area
     (pseudo-elements hit-test as their originating element), so dragging the
     thumb IS dragging the handle — no extra wiring. */
  @media (pointer: coarse) {
    :global([data-pane-resizer]) {
      position: relative;
      z-index: 1; /* the thumb overlays the neighbouring pane content */
      touch-action: none;
    }

    :global([data-pane-resizer])::after {
      content: '⋮⋮';
      position: absolute;
      inset-block-end: var(--space-4);
      /* Physical centering on the strip (translateX doesn't flip in RTL). */
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      inline-size: 66px;
      block-size: 44px;
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-full);
      background: var(--color-bg-tertiary);
      box-shadow: var(--shadow-sm);
      color: var(--color-text-secondary);
      font-size: var(--text-base);
      letter-spacing: -2px;
      line-height: 1;
    }

    :global([data-pane-resizer][data-resize-handle-active])::after {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .main-content {
      border-inline-start: 2px solid var(--color-forced-border);
    }
  }
</style>
