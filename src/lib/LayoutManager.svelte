<!--
  LayoutManager — the page frame. A bar across the top (the brand bar on the
  Books screen, the book's TopBar everywhere else), then the body:
  in Write, the chapter column beside the editor and preview; in every other
  view, the content alone, split or single-pane as the view needs.

  The bars and the chapter column are snippets the app fills, so this file
  owns only geometry (process/APP_MAKEOVER_LIBRARY.md, phase 1).
-->
<script lang="ts">
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import type { Snippet } from 'svelte';
  import { layoutStore } from './stores/layout';
  import { t } from './i18n';
  import { CaretLeft } from 'phosphor-svelte';
  import type { ViewType } from './navigation/types';

  let {
    hasWorkspace = false,
    view: viewOverride,
    phone = false,
    phonePane = 'editor',
    topBar,
    brandBar,
    writeSidebar,
    chapterStrip,
    bottomTabs,
    leftContent,
    rightContent,
  }: {
    hasWorkspace?: boolean;
    /** The view to lay out, when it differs from the store's (the Settings sheet
        renders over the last content view). */
    view?: ViewType;
    /** Phone layout: one pane, the chapter strip above it, the tab bar below. */
    phone?: boolean;
    /** Phone, Write view: which of the editor's two panes is showing. */
    phonePane?: 'editor' | 'preview';
    topBar?: Snippet;
    brandBar?: Snippet;
    writeSidebar?: Snippet;
    chapterStrip?: Snippet;
    bottomTabs?: Snippet;
    leftContent?: Snippet;
    rightContent?: Snippet;
  } = $props();

  const sidebar = $derived($layoutStore.sidebar);
  const view = $derived(viewOverride ?? sidebar.activeSection);

  // Books stands outside any book: brand bar, no chapter column.
  const outsideBook = $derived(view === 'workspace' || !hasWorkspace);

  // The chapter column exists only beside the editor, and not on a phone.
  const showWriteSidebar = $derived(view === 'spine' && hasWorkspace && !phone);
  const sidebarWidth = $derived(sidebar.isExpanded ? 'var(--sidebar-width)' : '48px');

  // Which views keep a right-hand pane.
  const showPreviewPane = $derived(
    view !== 'workspace' &&
      view !== 'settings' &&
      view !== 'publish' &&
      view !== 'chapters' &&
      view !== 'cover'
  );

  // Spine view only: the preview pane collapses to a slim rail (writing mode).
  const previewCollapsed = $derived($layoutStore.spinePreviewCollapsed && view === 'spine');
</script>

<div class="app-shell">
  {#if outsideBook}
    {@render brandBar?.()}
  {:else}
    {@render topBar?.()}
  {/if}

  <div
    class="app-body"
    class:with-sidebar={showWriteSidebar}
    style={showWriteSidebar ? `grid-template-columns: ${sidebarWidth} 1fr` : undefined}
  >
    {#if showWriteSidebar}
      {@render writeSidebar?.()}
    {/if}

    <main class="main-content">
      {#if phone && !outsideBook}
        <!-- Phone: one pane at a time. In Write, the tab bar swaps the editor
             for the preview; the other views show their main pane alone. -->
        <div class="phone-layout">
          {#if view === 'spine'}
            {@render chapterStrip?.()}
            <!-- Both of the editor's panes stay mounted: the editor loads the
                 chapter and feeds the preview, so it must keep running while
                 the preview is the one on screen. The inactive pane keeps its
                 layout but is invisible and inert. -->
            <div class="phone-panes">
              <div
                class="single-pane-container phone-pane"
                class:inactive={phonePane === 'preview'}
              >
                {@render leftContent?.()}
              </div>
              <div
                class="single-pane-container phone-pane"
                class:inactive={phonePane !== 'preview'}
              >
                {@render rightContent?.()}
              </div>
            </div>
          {:else}
            <div class="single-pane-container">
              {@render leftContent?.()}
            </div>
          {/if}
        </div>
      {:else if showPreviewPane && previewCollapsed}
        <!-- Writing mode: editor full width, preview folded into a rail. -->
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
        <PaneGroup direction="horizontal" autoSaveId="seedhtml-content-panes">
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
        <div class="single-pane-container">
          {@render leftContent?.()}
        </div>
      {/if}
    </main>
  </div>

  {#if phone && !outsideBook}
    {@render bottomTabs?.()}
  {/if}
</div>

<style>
  .app-shell {
    --sidebar-width: 240px;

    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh; /* dynamic viewport: excludes mobile browser UI chrome */
    width: 100vw;
    margin: 0;
    padding: 0;
    background: var(--color-bg-primary);
  }

  .app-body {
    flex: 1;
    min-block-size: 0;
    display: grid;
    grid-template-columns: 1fr;
  }

  .main-content {
    min-inline-size: 0;
    min-block-size: 0;
    overflow: hidden;
  }

  .pane-content {
    flex: 1;
    overflow: auto;
    background: var(--color-bg-primary);
    height: 100%;
  }

  .phone-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-block-size: 0;
  }

  .phone-layout .single-pane-container {
    flex: 1;
    min-block-size: 0;
  }

  .phone-panes {
    position: relative;
    flex: 1;
    min-block-size: 0;
  }

  .phone-pane {
    position: absolute;
    inset: 0;
  }

  .phone-pane.inactive {
    visibility: hidden;
  }

  .single-pane-container {
    height: 100%;
    overflow: auto;
    background: var(--color-bg-primary);
  }

  /* Writing mode: editor + a slim rail where the preview pane was. The rail
     mirrors the collapsed chapter column — 48px wide, toggle in a header-height strip. */
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

  /* The scoped background above outweighs the shared .btn-icon hover rule —
     restate the azure fill. */
  .preview-rail .btn:hover {
    background: var(--color-hover-accent);
    color: var(--color-on-accent);
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
      inline-size: 44px;
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
    .with-sidebar .main-content {
      border-inline-start: 2px solid var(--color-forced-border);
    }
  }
</style>
