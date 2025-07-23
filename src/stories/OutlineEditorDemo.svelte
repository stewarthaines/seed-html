<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import OutlineView from '../lib/components/outline/OutlineView.svelte';
  import ConsoleLog from './ConsoleLog.svelte';
  import { createMockWorkspaceManager } from '../lib/test/mocks/workspace-manager.mock.js';
  import { createMockTransformPipeline } from '../lib/test/mocks/transform-pipeline.mock.js';
  import { SpineItemManager } from '../lib/spine/spine-item-manager.js';
  import type { SpineItemWithSource } from '../lib/spine/types.js';
  import './outline-editor-demo.css';

  // Demo state
  let outlineView: OutlineView;
  let previewContent = '';
  let isLoading = true;
  let error = '';
  let logs: string[] = [];

  // Cleanup tracking
  let isDestroyed = false;
  let initializationTimeout: number | null = null;

  // Demo setup using shared mocks
  const mockWorkspaceId = 'outline-demo-workspace';
  
  // Create shared mocks
  const mockWorkspaceManager = createMockWorkspaceManager();
  const mockTransformPipeline = createMockTransformPipeline();
  const mockSpineItemManager = new SpineItemManager(mockWorkspaceManager);
  
  // Mock spine items for demonstration
  const mockSpineItems: SpineItemWithSource[] = [
    {
      idref: 'chapter1',
      linear: true,
      id: 'chapter1',
      href: 'Text/chapter1.xhtml',
      mediaType: 'application/xhtml+xml',
      hasSourceFile: true,
      sourcePath: 'SOURCE/text/chapter1.txt'
    },
    {
      idref: 'chapter2', 
      linear: true,
      id: 'chapter2',
      href: 'Text/chapter2.xhtml',
      mediaType: 'application/xhtml+xml',
      hasSourceFile: true,
      sourcePath: 'SOURCE/text/chapter2.txt'
    },
    {
      idref: 'chapter3',
      linear: true, 
      id: 'chapter3',
      href: 'Text/chapter3.xhtml',
      mediaType: 'application/xhtml+xml',
      hasSourceFile: false
    }
  ];

  // Setup mock data
  mockWorkspaceManager.addTestFiles(mockWorkspaceId, {
    'SOURCE/text/nav.txt': '',
    'SOURCE/text/chapter1.txt': '# Introduction\n\nThis is the first chapter...',
    'SOURCE/text/chapter2.txt': '# Getting Started\n\nThis chapter covers the basics...',
    'Text/chapter1.xhtml': '<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head><title>Introduction</title></head>\n<body><h1>Introduction</h1><p>This is the first chapter...</p></body>\n</html>',
    'Text/chapter2.xhtml': '<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head><title>Getting Started</title></head>\n<body><h1>Getting Started</h1><p>This chapter covers the basics...</p></body>\n</html>',
    'Text/chapter3.xhtml': '<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head><title>Advanced Topics</title></head>\n<body><h1>Advanced Topics</h1><p>Advanced content here...</p></body>\n</html>'
  });

  // Override loadSpineItems for demo
  mockSpineItemManager.loadSpineItems = async (_workspaceId: string) => {
    addLog(`Loading spine items for workspace: ${_workspaceId}`);
    return mockSpineItems;
  };

  // Add logging to workspace manager
  const originalFileExists = mockWorkspaceManager.fileExists.bind(mockWorkspaceManager);
  mockWorkspaceManager.fileExists = async (_workspaceId: string, filePath: string) => {
    addLog(`Checking file existence: ${filePath}`);
    return originalFileExists(_workspaceId, filePath);
  };

  const originalReadTextFile = mockWorkspaceManager.readTextFile.bind(mockWorkspaceManager);
  mockWorkspaceManager.readTextFile = async (_workspaceId: string, filePath: string) => {
    addLog(`Reading file: ${filePath}`);
    return originalReadTextFile(_workspaceId, filePath);
  };

  const originalWriteTextFile = mockWorkspaceManager.writeTextFile.bind(mockWorkspaceManager);
  mockWorkspaceManager.writeTextFile = async (_workspaceId: string, filePath: string, content: string) => {
    addLog(`Writing file: ${filePath} (${content.length} chars)`);
    return originalWriteTextFile(_workspaceId, filePath, content);
  };

  // Add logging to transform pipeline
  const originalTransformText = mockTransformPipeline.transformText.bind(mockTransformPipeline);
  mockTransformPipeline.transformText = async (text: string, _workspaceId: string, itemId: string) => {
    addLog(`Transforming text for ${itemId} (${text.length} chars)`);
    return originalTransformText(text, _workspaceId, itemId);
  };

  function addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, `[${timestamp}] ${message}`];
  }

  function handlePreviewUpdate(event: CustomEvent) {
    previewContent = event.detail.xhtml;
    addLog(`Preview updated (${event.detail.xhtml.length} chars)`);
    if (event.detail.warnings?.length > 0) {
      addLog(`Warnings: ${event.detail.warnings.join(', ')}`);
    }
  }

  function handleError(event: CustomEvent) {
    error = event.detail.message;
    addLog(`Error in ${event.detail.stage}: ${event.detail.message}`);
  }

  function handleComponentReady(_event: CustomEvent) {
    addLog('Ready event received');
    addLog(`Component state: isDestroyed=${isDestroyed}, isLoading=${isLoading}`);
    
    if (isDestroyed) {
      addLog('Component already destroyed, ignoring ready event');
      return;
    }
    
    addLog('OutlineView component ready - stopping loading state');
    
    // Component is ready, stop loading and initialize content
    isLoading = false;
    addLog(`Loading state set to: ${isLoading}`);
    
    // Load initial content
    if (outlineView && outlineView.loadNavigationContent) {
      addLog('Calling loadNavigationContent...');
      outlineView.loadNavigationContent()
        .then(() => addLog('Initial navigation content loaded'))
        .catch((err) => {
          const errorMsg = err instanceof Error ? err.message : 'Failed to load initial content';
          addLog(`Failed to load initial content: ${errorMsg}`);
        });
    } else {
      addLog('OutlineView component or loadNavigationContent method not available');
    }
  }

  function handleComponentDestroyed(_event: CustomEvent) {
    addLog('OutlineView component destroyed');
  }

  function resetDemo() {
    // Reset files to initial state using shared mock
    const workspaceFiles = mockWorkspaceManager.getWorkspaceFiles(mockWorkspaceId);
    workspaceFiles.set('SOURCE/text/nav.txt', '');
    workspaceFiles.delete('OEBPS/nav.xhtml');
    
    previewContent = '';
    error = '';
    logs = [];
    
    addLog('Demo reset');
    
    // Reload content
    if (outlineView && outlineView.loadNavigationContent) {
      outlineView.loadNavigationContent();
    }
  }

  async function saveNavigation() {
    if (!outlineView || !outlineView.saveNavigationContent) {
      addLog('Error: OutlineView not ready');
      return;
    }
    
    try {
      addLog('Manual save triggered');
      await outlineView.saveNavigationContent();
      addLog('Save completed successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`Save failed: ${errorMsg}`);
    }
  }

  onMount(() => {
    isDestroyed = false;
    isLoading = true; // Reset loading state for new story instance
    addLog('Demo initialized - waiting for OutlineView component');
    addLog(`Initial state: isLoading=${isLoading}, isDestroyed=${isDestroyed}`);
    
    // Set a fallback timeout in case component doesn't emit ready event
    initializationTimeout = window.setTimeout(() => {
      if (isLoading && !isDestroyed) {
        addLog('Warning: Component ready event not received, forcing initialization');
        addLog('Timeout triggered - checking component state...');
        if (outlineView) {
          addLog('OutlineView component exists but no ready event received');
        } else {
          addLog('OutlineView component does not exist');
        }
        isLoading = false;
      }
    }, 3000);
  });

  onDestroy(() => {
    isDestroyed = true;
    
    // Clear any pending timeouts
    if (initializationTimeout) {
      clearTimeout(initializationTimeout);
      initializationTimeout = null;
    }
    
    addLog('Demo destroyed');
  });
</script>

<div class="outline-demo">
  <div class="demo-header">
    <h2>Outline Editor Demo</h2>
    <div class="demo-controls">
      <button on:click={resetDemo} class="reset-btn">Reset Demo</button>
      <button on:click={saveNavigation} class="save-btn">Save Navigation</button>
    </div>
  </div>

  {#if error}
    <div class="error-message" role="alert">
      <strong>Error:</strong> {error}
    </div>
  {/if}

  <div class="demo-content">
    <div class="editor-section">
      <h3>Navigation Editor</h3>
      <p class="section-description">
        Leave empty for auto-generation from chapters, or enter custom navigation content.
        Use Ctrl+Enter (Cmd+Enter) to save.
      </p>
      
      {#if isLoading}
        <div class="loading">Loading editor...</div>
      {:else}
        <OutlineView
          bind:this={outlineView}
          workspaceId={mockWorkspaceId}
          workspaceManager={mockWorkspaceManager}
          spineItemManager={mockSpineItemManager}
          transformPipeline={mockTransformPipeline}
          on:previewUpdate={handlePreviewUpdate}
          on:error={handleError}
          on:ready={handleComponentReady}
          on:destroyed={handleComponentDestroyed}
        />
      {/if}
    </div>

    <div class="preview-section">
      <h3>Generated XHTML Preview</h3>
      <p class="section-description">
        Real-time preview of generated navigation XHTML
      </p>
      
      <div class="preview-container">
        {#if previewContent}
          <pre class="xhtml-preview"><code>{previewContent}</code></pre>
        {:else}
          <div class="preview-placeholder">
            Navigation preview will appear here...
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="demo-footer">
    <div class="spine-info">
      <h4>Demo Spine Items</h4>
      <ul class="spine-list">
        {#each mockSpineItems as item}
          <li class="spine-item">
            <strong>{item.id}</strong> - {item.href}
            {#if item.hasSourceFile}
              <span class="source-indicator">📄 Has source</span>
            {/if}
          </li>
        {/each}
      </ul>
    </div>

    <div class="console-section">
      <ConsoleLog {logs} title="Demo Activity Log" />
    </div>
  </div>
</div>