<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { FileStorageAPI } from '../lib/storage/index.js';
  import { createIsolatedMockStorage, cleanupStoryStorage } from './utils/mock-storage-factory';
  import './storage-demo.css';

  interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'action';
    message: string;
  }

  let storage: FileStorageAPI;
  let logs: LogEntry[] = [];
  let currentWorkspace: string | null = null;
  let workspaces: string[] = [];
  let files: string[] = [];
  let quota: { used: number; available: number } | null = null;
  let isLoading = false;

  onMount(async () => {
    try {
      // Use isolated mock storage instead of persistent storage
      storage = createIsolatedMockStorage();
      await storage.init();
      addLog('success', 'Storage initialized with mock-isolated backend (demo mode)');
      await refreshData();
    } catch (error: unknown) {
      addLog('error', `Failed to initialize storage: ${error.message}`);
    }
  });

  // Cleanup when story unmounts to prevent memory leaks
  onDestroy(() => {
    if (storage) {
      cleanupStoryStorage(storage);
    }
  });

  function addLog(type: LogEntry['type'], message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, { timestamp, type, message }];
  }

  async function refreshData() {
    if (!storage) return;

    try {
      workspaces = await storage.listWorkspaces();
      if (currentWorkspace) {
        files = await storage.listFiles(currentWorkspace);
      }
      quota = await storage.getQuota();
    } catch (error: unknown) {
      addLog('error', `Failed to refresh data: ${error.message}`);
    }
  }

  async function createWorkspace() {
    if (!storage || isLoading) return;
    isLoading = true;
    addLog('action', 'Creating new workspace...');

    try {
      const result = await storage.createWorkspace();
      currentWorkspace = result.id;
      addLog('success', `Created workspace: ${result.id}`);
      await refreshData();
    } catch (error: unknown) {
      addLog('error', `Failed to create workspace: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  async function selectWorkspace(workspaceId: string) {
    if (!storage || isLoading) return;
    currentWorkspace = workspaceId;
    addLog('info', `Selected workspace: ${workspaceId}`);
    await refreshData();
  }

  async function addSampleEPUB() {
    if (!storage || !currentWorkspace || isLoading) return;
    isLoading = true;
    addLog('action', 'Adding sample EPUB files...');

    try {
      // Add EPUB structure
      await storage.writeTextFile(currentWorkspace, 'mimetype', 'application/epub+zip');
      await storage.writeTextFile(
        currentWorkspace,
        'META-INF/container.xml',
        `<?xml version="1.0"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n  <rootfiles>\n    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n  </rootfiles>\n</container>`
      );
      await storage.writeTextFile(
        currentWorkspace,
        'OEBPS/content.opf',
        `<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">\n  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n    <dc:title>Demo EPUB</dc:title>\n    <dc:creator>Storage API Demo</dc:creator>\n    <dc:identifier id="BookId">demo-epub-123</dc:identifier>\n    <dc:language>en</dc:language>\n  </metadata>\n  <manifest>\n    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>\n    <item id="style1" href="styles.css" media-type="text/css"/>\n  </manifest>\n  <spine>\n    <itemref idref="chapter1"/>\n  </spine>\n</package>`
      );
      await storage.writeTextFile(
        currentWorkspace,
        'OEBPS/chapter1.xhtml',
        `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head>\n  <title>Chapter 1</title>\n  <link rel="stylesheet" type="text/css" href="styles.css"/>\n</head>\n<body>\n  <h1>Chapter 1</h1>\n  <p>This is a demo chapter created by the Storage API.</p>\n</body>\n</html>`
      );
      await storage.writeTextFile(
        currentWorkspace,
        'OEBPS/styles.css',
        `body {\n  font-family: serif;\n  margin: 2em;\n}\nh1 {\n  color: #333;\n  border-bottom: 1px solid #ccc;\n}`
      );

      addLog(
        'success',
        'Added sample EPUB files (mimetype, container.xml, content.opf, chapter1.xhtml, styles.css)'
      );
      await refreshData();
    } catch (error: unknown) {
      addLog('error', `Failed to add EPUB files: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  async function readFile(filePath: string) {
    if (!storage || !currentWorkspace || isLoading) return;
    addLog('action', `Reading file: ${filePath}`);

    try {
      const content = await storage.readTextFile(currentWorkspace, filePath);
      const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
      addLog('info', `File content (${content.length} chars): ${preview}`);
    } catch (error: unknown) {
      addLog('error', `Failed to read file: ${error.message}`);
    }
  }

  async function deleteWorkspace(workspaceId: string) {
    if (!storage || isLoading) return;
    isLoading = true;
    addLog('action', `Deleting workspace: ${workspaceId}`);

    try {
      await storage.deleteWorkspace(workspaceId);
      if (currentWorkspace === workspaceId) {
        currentWorkspace = null;
        files = [];
      }
      addLog('success', `Deleted workspace: ${workspaceId}`);
      await refreshData();
    } catch (error: unknown) {
      addLog('error', `Failed to delete workspace: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function clearLogs() {
    logs = [];
  }

  async function resetStorageDemo() {
    if (!storage || isLoading) return;
    isLoading = true;
    addLog('action', 'Resetting storage demo...');

    try {
      // Clear all existing workspaces
      const existingWorkspaces = await storage.listWorkspaces();
      for (const workspaceId of existingWorkspaces) {
        await storage.deleteWorkspace(workspaceId);
      }

      // Reset component state
      currentWorkspace = null;
      workspaces = [];
      files = [];

      addLog('success', 'Storage demo reset complete');
      await refreshData();
    } catch (error: unknown) {
      addLog('error', `Failed to reset storage: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  // Expose reset function for Storybook play functions
  if (typeof window !== 'undefined') {
    (window as Record<string, unknown>).resetStorageDemo = resetStorageDemo;
  }
</script>

<div class="storage-demo">
  <div class="demo-header">
    <h2>File Storage API Demo</h2>
    <p>Interactive demonstration of OPFS/IndexedDB storage capabilities</p>
  </div>

  <div class="demo-content">
    <!-- Control Panel -->
    <div class="control-panel">
      <div class="section">
        <h3>Workspace Management</h3>
        <div class="button-group">
          <button on:click={createWorkspace} disabled={isLoading}> Create Workspace </button>
          <button on:click={() => refreshData()} disabled={isLoading}> Refresh Data </button>
          <button on:click={resetStorageDemo} disabled={isLoading}> Reset Demo </button>
        </div>

        {#if workspaces.length > 0}
          <div class="workspace-list">
            <h4>Workspaces ({workspaces.length}):</h4>
            {#each workspaces as workspace}
              <div class="workspace-item">
                <button
                  class="workspace-btn {currentWorkspace === workspace ? 'active' : ''}"
                  on:click={() => selectWorkspace(workspace)}
                >
                  {workspace}
                </button>
                <button
                  class="delete-btn"
                  on:click={() => deleteWorkspace(workspace)}
                  disabled={isLoading}
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      {#if currentWorkspace}
        <div class="section">
          <h3>File Operations</h3>
          <div class="button-group">
            <button on:click={addSampleEPUB} disabled={isLoading}> Add Sample EPUB </button>
          </div>

          {#if files.length > 0}
            <div class="file-list">
              <h4>Files ({files.length}):</h4>
              {#each files as file}
                <button class="file-item" on:click={() => readFile(file)}>
                  📄 {file}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if quota}
        <div class="section">
          <h3>Storage Info</h3>
          <div class="quota-info">
            <div class="quota-bar">
              <div
                class="quota-used"
                style="width: {quota.available > 0
                  ? (quota.used / (quota.used + quota.available)) * 100
                  : 0}%"
              ></div>
            </div>
            <div class="quota-text">
              Used: {formatBytes(quota.used)} / Available: {formatBytes(quota.available)}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Log Console -->
    <div class="log-console">
      <div class="log-header">
        <h3>Console Log</h3>
        <button on:click={clearLogs}>Clear</button>
      </div>
      <div class="log-content">
        {#each logs as log}
          <div class="log-entry log-{log.type}">
            <span class="log-time">{log.timestamp}</span>
            <span class="log-message">{log.message}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
