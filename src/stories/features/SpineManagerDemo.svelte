<script lang="ts">
  import { onMount } from 'svelte';
  import SpineSidebar from '../../lib/components/SpineSidebar.svelte';
  import Sidebar from '../../lib/Sidebar.svelte';
  import { layoutStore } from '../../lib/stores/layout';
  import { WorkspaceManager } from '../../lib/workspace';

  // Story props
  export let preloadChapters = false;
  export let startCollapsed = false;
  export let simulateError = false;

  // State
  let selectedItemId: string | null = null;
  let selectedItemContent = '';
  let workspaceManager: WorkspaceManager;
  let initialized = false;
  let error: string | null = null;
  let workspaceId = 'spine-demo-workspace';

  // Demo EPUB data
  const demoMetadata = {
    title: 'Spine Demo EPUB',
    language: 'en',
    identifier: 'spine-demo-' + Date.now(),
    creator: ['Demo Author'],
    publisher: 'Storybook Demo',
  };

  const demoChapters = [
    { id: 'prologue', title: 'Prologue', content: '# Prologue\n\nThe story begins...' },
    {
      id: 'chapter1',
      title: 'Chapter 1',
      content: '# Chapter 1\n\nIt was a dark and stormy night...',
    },
    { id: 'chapter2', title: 'Chapter 2', content: '# Chapter 2\n\nThe adventure continues...' },
    { id: 'chapter3', title: 'Chapter 3', content: '# Chapter 3\n\nThe plot thickens...' },
    {
      id: 'epilogue',
      title: 'Epilogue',
      content: '# Epilogue\n\nAnd they lived happily ever after...',
    },
  ];

  async function initializeDemo() {
    try {
      // Initialize workspace manager
      workspaceManager = new WorkspaceManager();
      await workspaceManager.init();

      // Clean up any existing demo workspace
      try {
        await workspaceManager.deleteWorkspace(workspaceId);
      } catch {
        // Workspace doesn't exist, which is fine
      }

      if (simulateError) {
        throw new Error('Simulated error for testing');
      }

      if (preloadChapters) {
        // Create new demo workspace with sample content
        workspaceId = await workspaceManager.createEPUBWorkspace(demoMetadata);

        // Add chapters to the workspace
        for (const chapter of demoChapters) {
          // Add to manifest
          await workspaceManager.addManifestItem(workspaceId, {
            id: chapter.id,
            href: `Text/${chapter.id}.xhtml`,
            mediaType: 'application/xhtml+xml',
          });

          // Add to spine (epilogue is non-linear to show validation warning)
          await workspaceManager.addSpineItem(workspaceId, {
            idref: chapter.id,
            linear: chapter.id !== 'epilogue',
          });

          // Write source text file (skip chapter2 to show missing file error)
          if (chapter.id !== 'chapter2') {
            await workspaceManager.writeTextFile(
              workspaceId,
              `SOURCE/text/${chapter.id}.txt`,
              chapter.content
            );
          }
        }
      } else {
        // Create empty workspace
        workspaceId = await workspaceManager.createEPUBWorkspace(demoMetadata);
      }

      initialized = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.log(error);
    }
  }

  // Set initial sidebar state
  if (startCollapsed) {
    layoutStore.toggleSidebar();
  }

  // Always show spine section
  layoutStore.setSidebarSection('spine');

  // Reactive sidebar width for layout
  $: sidebarWidth = $layoutStore.sidebar.isExpanded ? '250px' : '48px';

  // Handle spine item selection
  function handleSpineItemSelect(
    event: CustomEvent<{ itemId: string }> & { currentTarget: EventTarget & Window }
  ) {
    selectedItemId = event.detail.itemId;
    loadSelectedItemContent();
  }

  async function loadSelectedItemContent() {
    if (!selectedItemId) return;

    try {
      const sourcePath = `SOURCE/text/${selectedItemId}.txt`;
      selectedItemContent = await workspaceManager.readTextFile(workspaceId, sourcePath);
    } catch (error) {
      selectedItemContent = `No content available for ${selectedItemId}`;
    }
  }

  // Initialize demo and listen for spine item selection
  onMount(() => {
    // Initialize the demo workspace
    initializeDemo();

    // Listen for spine item selection events
    const handleSelect = (event: Event) => {
      const customEvent = event as any;
      if (customEvent.detail && customEvent.detail.itemId) {
        handleSpineItemSelect(customEvent);
      }
    };

    window.addEventListener('select-spine-item', handleSelect);
    return () => window.removeEventListener('select-spine-item', handleSelect);
  });
</script>

<div class="demo-container" style="grid-template-columns: {sidebarWidth} 1fr">
  {#if error}
    <div class="demo-error">
      <h2>Error</h2>
      <p>{error}</p>
      <button on:click={initializeDemo}>Retry</button>
    </div>
  {:else if !initialized}
    <div class="demo-loading">
      <h2>Loading...</h2>
      <p>Initializing spine manager demo...</p>
    </div>
  {:else}
    <div class="demo-sidebar">
      <Sidebar
        isExpanded={$layoutStore.sidebar.isExpanded}
        activeSection={$layoutStore.sidebar.activeSection}
      >
        <svelte:fragment slot="sidebar-spine">
          <SpineSidebar
            {workspaceId}
            {workspaceManager}
            {selectedItemId}
            isExpanded={$layoutStore.sidebar.isExpanded}
          />
        </svelte:fragment>
      </Sidebar>
    </div>

    <div class="demo-main">
      <div class="main-header">
        <h2>Main View</h2>
        {#if selectedItemId}
          <p>Selected: <strong>{selectedItemId}</strong></p>
        {:else}
          <p>Select a spine item from the sidebar</p>
        {/if}
      </div>

      {#if selectedItemContent}
        <div class="content-preview">
          <h3>Content Preview</h3>
          <pre>{selectedItemContent}</pre>
        </div>
      {/if}

      <div class="demo-info">
        <h3>Demo Features</h3>
        <ul>
          <li>Click on a spine item to select it</li>
          <li>When selected, use the up/down arrows to reorder</li>
          <li>With expanded sidebar, drag items to reorder</li>
          <li>Items with ⚠️ are missing source files or are non-linear</li>
          <li>Click "Append Item" to add a new chapter</li>
        </ul>

        <div class="demo-status">
          <h4>Backend Status</h4>
          <p>✅ Using real WorkspaceManager</p>
          <p>✅ Using real SpineItemManager</p>
          <p>✅ Using real FileStorageAPI backend</p>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .demo-container {
    display: grid;
    height: 100vh;
    background: var(--color-bg-primary);
  }

  .demo-sidebar {
    background: var(--color-bg-secondary);
    min-width: 0;
    overflow: hidden;
  }

  .demo-main {
    padding: var(--space-6);
    overflow-y: auto;
    min-width: 0;
  }

  .main-header {
    margin-bottom: var(--space-6);
  }

  .main-header h2 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-2xl);
    color: var(--color-text-primary);
  }

  .main-header p {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .content-preview {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    margin-bottom: var(--space-6);
  }

  .content-preview h3 {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--text-lg);
    color: var(--color-text-primary);
  }

  .content-preview pre {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .demo-info {
    background: var(--color-info-bg);
    border: 1px solid var(--color-info-border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
  }

  .demo-info h3 {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--text-lg);
    color: var(--color-text-primary);
  }

  .demo-info ul {
    margin: 0;
    padding-left: var(--space-6);
  }

  .demo-info li {
    margin-bottom: var(--space-2);
    color: var(--color-text-secondary);
  }

  .demo-error,
  .demo-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    padding: var(--space-6);
    text-align: center;
  }

  .demo-error {
    background: var(--color-error-bg);
    color: var(--color-error-text);
  }

  .demo-error button {
    margin-top: var(--space-4);
    padding: var(--space-3) var(--space-6);
    background: var(--color-primary);
    color: var(--color-primary-text);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .demo-loading {
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
  }

  .demo-status {
    margin-top: var(--space-4);
    padding: var(--space-4);
    background: var(--color-success-bg);
    border: 1px solid var(--color-success-border);
    border-radius: var(--radius-md);
  }

  .demo-status h4 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-sm);
    color: var(--color-success-text);
  }

  .demo-status p {
    margin: var(--space-1) 0;
    font-size: var(--text-xs);
    color: var(--color-success-text);
  }
</style>
