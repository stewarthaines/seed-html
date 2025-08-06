<!--
  Spine Item Text Editor Component
  
  Main spine item editor component that provides a full-featured editing environment
  for EPUB spine items with real-time XHTML preview and multi-file content management.
  
  Features:
  - Real-time text → XHTML transform pipeline (300ms debounce)
  - Multi-file editing (plain text, CSS, JavaScript)
  - Transform script configuration
  - Auto-save workflow with blob URL processing
  - XHTML persistence as spine item content
  - Error handling and user feedback
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { createSpinePreviewManager, DEFAULT_PREVIEW_CONFIG } from '$lib/transform/spine-preview-manager.js';
  import { createSpineTransformPipeline } from '$lib/transform/spine-transform-pipeline.js';
  import EditorPane from './EditorPane.svelte';
  import PreviewPane from './PreviewPane.svelte';
  import type { 
    PreviewUpdateEvent, 
    PreviewErrorEvent, 
    CurrentContent,
    ContentType,
    TransformError
  } from '$lib/types/spine-editor.js';
  
  // Required props - external service dependencies
  export let workspaceId: string;
  export let spineItemId: string;
  export let fileStorage: any; // FileStorageAPI
  export let extensionManager: any; // ExtensionManager
  export let blobURLManager: any; // BlobURLManager
  export let workspaceService: any; // WorkspaceService  
  export let settingsManager: any; // SettingsManager
  export let transformEngine: any; // TransformEngine
  
  // Optional configuration
  export let config = DEFAULT_PREVIEW_CONFIG;
  
  // Internal state stores
  const previewContent = writable<string>('');
  const transformWarnings = writable<string[]>([]);
  const transformError = writable<TransformError | null>(null);
  const isTransforming = writable<boolean>(false);
  const executionTime = writable<number>(0);
  
  // Content management
  let previewManager: any = null;
  let currentContent: CurrentContent = {
    text: ''
  };
  
  // Component state
  let initialized = false;
  
  /**
   * Initialize preview manager and load initial content
   */
  onMount(async () => {
    try {
      // Create preview manager with event handlers
      previewManager = createSpinePreviewManager(
        workspaceId,
        spineItemId,
        fileStorage,
        extensionManager,
        blobURLManager,
        workspaceService,
        settingsManager,
        transformEngine,
        config,
        handlePreviewUpdate,
        handlePreviewError
      );
      
      // Load initial content from workspace
      await previewManager.loadInitialContent();
      currentContent = previewManager.getCurrentContent();
      
      initialized = true;
    } catch (error) {
      console.error('Failed to initialize spine editor:', error);
      transformError.set({
        stage: 'initialization',
        message: error instanceof Error ? error.message : 'Failed to initialize editor'
      });
    }
  });
  
  /**
   * Cleanup resources on component destroy
   */
  onDestroy(() => {
    if (previewManager) {
      previewManager.cleanup();
    }
  });
  
  /**
   * Handle successful preview updates
   */
  function handlePreviewUpdate(event: PreviewUpdateEvent): void {
    previewContent.set(event.xhtml);
    transformWarnings.set(event.warnings);
    transformError.set(null);
    isTransforming.set(false);
    executionTime.set(event.executionTime);
  }
  
  /**
   * Handle preview errors
   */  
  function handlePreviewError(event: PreviewErrorEvent): void {
    transformError.set(event.error);
    isTransforming.set(false);
    console.error(`Transform error in ${event.stage}:`, event.error);
  }
  
  /**
   * Handle content changes from editor panes
   */
  function handleContentChange(type: ContentType, content: string): void {
    if (!previewManager) return;
    
    currentContent[type] = content;
    isTransforming.set(true);
    previewManager.updateContent(type, content);
  }
  
  
  /**
   * Force immediate preview update (bypasses debounce)
   */
  async function forcePreviewUpdate(): Promise<void> {
    if (!previewManager) return;
    
    isTransforming.set(true);
    try {
      await previewManager.forcePreviewUpdate();
    } catch (error) {
      handlePreviewError({
        error: {
          stage: 'manual-update',
          message: error instanceof Error ? error.message : 'Manual update failed'
        },
        stage: 'manual-update',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Get current transform pipeline statistics
   */
  function getTransformStats() {
    return previewManager?.getStats() || {
      isTransforming: false,
      lastTransformTime: 0,
      contentLength: { text: 0, css: 0, javascript: 0 }
    };
  }
</script>

{#if initialized}
  <div class="spine-editor">
    <!-- Editor Pane (Left) -->
    <div class="editor-pane">
      <EditorPane
        availableFiles={[]}
        transformError={$transformError}
        transformWarnings={$transformWarnings}
        isTransforming={$isTransforming}
        executionTime={$executionTime}
        on:paneToggle={() => {}}
        on:fileSelect={() => {}}
        on:contentChange={() => {}}
        on:forceUpdate={forcePreviewUpdate}
      />
    </div>
    
    <!-- Preview Pane (Right) -->  
    <div class="preview-pane">
      <PreviewPane
        xhtmlContent={$previewContent}
        isTransforming={$isTransforming}
        transformError={$transformError}
        transformWarnings={$transformWarnings}
        executionTime={$executionTime}
        {spineItemId}
      />
    </div>
  </div>
{:else}
  <div class="spine-editor-loading">
    <div class="loading-indicator">
      <div class="spinner"></div>
      <p>Initializing spine editor...</p>
    </div>
  </div>
{/if}

<style>
  .spine-editor {
    display: grid;
    grid-template-columns: 1fr 1fr;
    height: 100%;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--color-bg-primary);
  }
  
  .editor-pane,
  .preview-pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  
  .spine-editor-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: var(--color-bg-primary);
  }
  
  .loading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    color: var(--color-text-secondary);
  }
  
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border-default);
    border-top: 3px solid var(--color-accent-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  /* Responsive layout for smaller screens */
  @media (max-width: 1024px) {
    .spine-editor {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr;
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .editor-pane,
    .preview-pane {
      border: 2px solid var(--color-forced-border);
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>