<script lang="ts">
  import { onMount } from 'svelte';
  import MetadataEditor from '../../lib/components/metadata/MetadataEditor.svelte';
  import { WorkspaceManager } from '../../lib/workspace/index.js';
  import { MetadataManagerImpl } from '../../lib/metadata/MetadataManager';

  // State management following the established pattern
  let workspaceManager: WorkspaceManager;
  let metadataManager: MetadataManagerImpl;
  let initialized = false;
  let error: string | null = null;
  let workspaceId = 'metadata-demo-workspace';

  // Demo metadata for the story
  const demoMetadata = {
    title: 'The Adventures of Tom Sawyer',
    language: 'en',
    identifier: 'urn:uuid:12345678-1234-5678-9012-123456789012',
    creator: ['Mark Twain'],
    description:
      'A classic American novel about a young boy growing up along the Mississippi River. This story follows the mischievous adventures of Tom Sawyer in the fictional town of St. Petersburg, Missouri.',
    publisher: 'American Publishing Company',
    date: '1876-06-01',
    rights: 'Public Domain',
    subject: ['Fiction', 'Adventure', 'American Literature', 'Coming of Age'],
    contributor: ['Samuel Clemens (Editor)'],
    type: 'fiction',
    source: 'Original 1876 edition',
  };

  // Real backend initialization following the established pattern
  async function initializeDemo() {
    try {
      workspaceManager = new WorkspaceManager();
      await workspaceManager.init();

      // Clean up any existing demo workspace
      try {
        await workspaceManager.deleteWorkspace(workspaceId);
      } catch {
        // Workspace doesn't exist, which is fine
      }

      // Create new demo workspace with real content
      workspaceId = await workspaceManager.createEPUBWorkspace(demoMetadata);

      // Initialize metadata manager with real workspace manager
      metadataManager = new MetadataManagerImpl(workspaceManager);

      initialized = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to initialize metadata demo:', err);
    }
  }

  // Initialize on mount - key pattern for real backend integration
  onMount(() => {
    initializeDemo();
  });

  // Expose reset for Storybook play functions
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).resetMetadataDemo = initializeDemo;
  }
</script>

<div class="metadata-demo">
  {#if error}
    <div class="demo-error">
      <h2>Error</h2>
      <p>{error}</p>
      <button on:click={initializeDemo}>Retry</button>
    </div>
  {:else if !initialized}
    <div class="demo-loading">
      <h2>Loading...</h2>
      <p>Initializing real backend...</p>
      <p>Creating workspace and setting up metadata...</p>
    </div>
  {:else}
    <!-- Metadata Editor with real backend -->
    <div class="metadata-editor-container">
      <MetadataEditor {workspaceId} {metadataManager} />
    </div>
  {/if}
</div>

<style>
  .metadata-demo {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: #f9fafb;
  }

  .demo-loading,
  .demo-error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem;
  }

  .demo-loading h2,
  .demo-error h2 {
    color: #1f2937;
    margin-bottom: 1rem;
  }

  .demo-loading p {
    color: #6b7280;
    margin: 0.5rem 0;
  }

  .demo-error p {
    color: #dc2626;
    margin-bottom: 1rem;
  }

  .demo-error button {
    padding: 0.75rem 1.5rem;
    background-color: #dc2626;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .demo-error button:hover {
    background-color: #b91c1c;
  }

  .metadata-editor-container {
    flex: 1;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    margin: 1rem;
    overflow: hidden;
    background-color: white;
  }
</style>
