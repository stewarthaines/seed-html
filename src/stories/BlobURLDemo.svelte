<script lang="ts">
  import { onMount } from 'svelte';
  import { FileStorageAPI } from '../lib/storage/index.js';
  import { BlobURLManager } from '../lib/blob-url/index.js';
  import './blob-url-demo.css';

  interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'action';
    message: string;
  }

  interface AssetInfo {
    path: string;
    blobURL?: string;
    type: string;
  }

  let storage: FileStorageAPI;
  let blobURLManager: BlobURLManager;
  let logs: LogEntry[] = [];
  let currentWorkspace: string | null = null;
  let assets: AssetInfo[] = [];
  let originalXHTML = '';
  let processedXHTML = '';
  let isLoading = false;

  // Sample assets to create
  const sampleAssets = [
    { path: 'cover.jpg', type: 'Image', content: 'fake-jpeg-content' },
    {
      path: 'styles.css',
      type: 'Stylesheet',
      content: 'body { font-family: serif; margin: 2em; }',
    },
    { path: 'reader.js', type: 'Script', content: 'console.log("EPUB reader loaded");' },
  ];

  // Sample XHTML with asset references
  const sampleXHTML =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE html>\n' +
    '<html xmlns="http://www.w3.org/1999/xhtml">\n' +
    '<head>\n' +
    '  <title>Sample Chapter</title>\n' +
    '  <link rel="stylesheet" type="text/css" href="styles.css"/>\n' +
    '  <' +
    'script src="reader.js"><' +
    '/script>\n' +
    '</head>\n' +
    '<body>\n' +
    '  <h1>Chapter 1: Introduction</h1>\n' +
    '  <img src="cover.jpg" alt="Book Cover" class="cover-image"/>\n' +
    '  <p>This is a sample chapter demonstrating blob URL substitution.</p>\n' +
    '</body>\n' +
    '</html>';

  onMount(async () => {
    try {
      storage = new FileStorageAPI();
      await storage.init();
      addLog('success', `Storage initialized with ${storage.getBackendType()} backend`);
    } catch (error: unknown) {
      addLog('error', `Failed to initialize storage: ${(error as Error).message}`);
    }
  });

  function addLog(type: LogEntry['type'], message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, { timestamp, type, message }];
  }

  async function setupDemo() {
    if (!storage || isLoading) return;
    isLoading = true;
    addLog('action', 'Setting up demo...');

    try {
      // Create workspace
      currentWorkspace = await storage.createWorkspace();
      addLog('success', `Created workspace: ${currentWorkspace}`);

      // Initialize blob URL manager
      blobURLManager = new BlobURLManager({
        fileStorage: storage,
        basePath: 'OEBPS',
        maxBlobURLs: 100,
        onCapacityReached: () => addLog('error', 'Blob URL capacity reached!'),
      });
      blobURLManager.setActiveWorkspace(currentWorkspace);
      addLog('success', 'Blob URL Manager initialized');

      // Add sample assets
      for (const asset of sampleAssets) {
        const filePath = `OEBPS/${asset.path}`;
        await storage.writeTextFile(currentWorkspace, filePath, asset.content);
        addLog('info', `Created asset: ${asset.path}`);
      }

      // Setup asset tracking
      assets = sampleAssets.map(asset => ({
        path: asset.path,
        type: asset.type,
      }));

      // Set original XHTML
      originalXHTML = sampleXHTML;
      processedXHTML = '';

      addLog('success', 'Demo setup complete! Ready to create blob URLs.');
    } catch (error: unknown) {
      addLog('error', `Setup failed: ${(error as Error).message}`);
    } finally {
      isLoading = false;
    }
  }

  async function createBlobURLs() {
    if (!blobURLManager || !currentWorkspace || isLoading) return;
    isLoading = true;
    addLog('action', 'Creating blob URLs for assets...');

    try {
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const startTime = Date.now();
        const blobURL = await blobURLManager.createBlobURL(asset.path);
        const duration = Date.now() - startTime;

        assets[i] = { ...asset, blobURL };
        addLog('success', `${asset.path} → blob URL (${duration}ms)`);
      }

      addLog('success', `Created ${assets.length} blob URLs. Ready to process XHTML.`);
    } catch (error: unknown) {
      addLog('error', `Blob URL creation failed: ${(error as Error).message}`);
    } finally {
      isLoading = false;
    }
  }

  async function processXHTML() {
    if (!blobURLManager || !originalXHTML || isLoading) return;
    isLoading = true;
    addLog('action', 'Processing XHTML content...');

    try {
      const startTime = Date.now();
      processedXHTML = await blobURLManager.processXHTMLForPreview(originalXHTML);
      const duration = Date.now() - startTime;

      addLog('success', `XHTML processed successfully (${duration}ms)`);
      addLog('info', 'Asset URLs have been replaced with blob URLs');
    } catch (error: unknown) {
      addLog('error', `XHTML processing failed: ${(error as Error).message}`);
    } finally {
      isLoading = false;
    }
  }

  async function resetDemo() {
    if (isLoading) return;
    isLoading = true;
    addLog('action', 'Resetting demo...');

    try {
      // Cleanup blob URLs
      if (blobURLManager) {
        blobURLManager.cleanup();
        addLog('info', 'Blob URLs cleaned up');
      }

      // Delete workspace
      if (storage && currentWorkspace) {
        await storage.deleteWorkspace(currentWorkspace);
        addLog('info', 'Workspace deleted');
      }

      // Reset state
      currentWorkspace = null;
      assets = [];
      originalXHTML = '';
      processedXHTML = '';
      blobURLManager = null as any;

      addLog('success', 'Demo reset complete');
    } catch (error: unknown) {
      addLog('error', `Reset failed: ${(error as Error).message}`);
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="blob-url-demo">
  <header class="demo-header">
    <h2>Blob URL Manager Demo</h2>
    <p>Demonstrates blob URL creation and XHTML asset substitution for EPUB preview</p>
  </header>

  <div class="demo-controls">
    <button on:click={setupDemo} disabled={isLoading || currentWorkspace} class="primary">
      Setup Demo
    </button>

    <button
      on:click={createBlobURLs}
      disabled={isLoading || !currentWorkspace || assets.some(a => a.blobURL)}
    >
      Create Blob URLs
    </button>

    <button on:click={processXHTML} disabled={isLoading || !assets.some(a => a.blobURL)}>
      Process XHTML
    </button>

    <button on:click={resetDemo} disabled={isLoading} class="secondary"> Reset Demo </button>
  </div>

  <div class="demo-content">
    <!-- Assets Panel -->
    <div class="panel">
      <h3>Assets</h3>
      {#if assets.length > 0}
        <div class="asset-list">
          {#each assets as asset}
            <div class="asset-item">
              <div class="asset-info">
                <span class="asset-path">{asset.path}</span>
                <span class="asset-type">{asset.type}</span>
              </div>
              {#if asset.blobURL}
                <div class="blob-url" title={asset.blobURL}>
                  blob:null/{asset.blobURL.split('/').pop()?.substring(0, 8)}...
                </div>
              {:else}
                <div class="no-blob">No blob URL</div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-state">No assets created yet. Click "Setup Demo" to begin.</p>
      {/if}
    </div>

    <!-- XHTML Panel -->
    <div class="panel">
      <h3>XHTML Processing</h3>
      {#if originalXHTML}
        <div class="xhtml-comparison">
          <div class="xhtml-section">
            <h4>Original XHTML</h4>
            <pre class="xhtml-content">{originalXHTML}</pre>
          </div>

          {#if processedXHTML}
            <div class="xhtml-section">
              <h4>Processed XHTML (with blob URLs)</h4>
              <pre class="xhtml-content">{processedXHTML}</pre>
            </div>
          {/if}
        </div>
      {:else}
        <p class="empty-state">No XHTML content yet. Set up the demo first.</p>
      {/if}
    </div>
  </div>

  <!-- Console Log -->
  <div class="console-log">
    <h3>Console Log</h3>
    <div class="log-entries">
      {#each logs as log}
        <div class="log-entry log-{log.type}">
          <span class="log-time">{log.timestamp}</span>
          <span class="log-message">{log.message}</span>
        </div>
      {/each}
    </div>
  </div>
</div>
