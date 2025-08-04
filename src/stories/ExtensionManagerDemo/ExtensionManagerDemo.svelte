<!--
  Extension Manager Demo - Main Orchestrator Component
  
  Provides interactive demonstration of Extension Manager capabilities through
  realistic workflows. Manages state coordination between sub-components.
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ExtensionManager } from '../../lib/extensions/extension-manager.js';
  import { FileStorageAPI } from '../../lib/storage/index.js';
  import { createIsolatedMockStorage, cleanupStoryStorage } from '../utils/mock-storage-factory';
  import type { ExtensionInfo } from '../../lib/extensions/types.js';

  // Components
  import ExtensionUploader from './components/ExtensionUploader.svelte';
  import ExtensionBrowser from './components/ExtensionBrowser.svelte';
  import ExtensionDetails from './components/ExtensionDetails.svelte';
  import OperationLog from './components/OperationLog.svelte';
  import StatusPanel from './components/StatusPanel.svelte';

  // Sample data
  import {
    SAMPLE_EXTENSIONS,
    getPopularExtensions,
    createSampleFile,
  } from './mock-data/sample-extensions.js';
  import { SAMPLE_EPUBS, createWorkspaceFromEPUB } from './mock-data/sample-epub.js';
  import { CONFLICT_SCENARIOS, createConflictingCache } from './mock-data/conflict-scenarios.js';

  // State Management
  interface ExtensionManagerState {
    workspaceExtensions: ExtensionInfo[];
    cachedExtensions: ExtensionInfo[];
    selectedWorkspace: string;
    operationLog: LogEntry[];
    uploadProgress: UploadProgress | null;
    isLoading: boolean;
    storageQuota: StorageQuota;
    selectedExtension: ExtensionInfo | null;
    currentWorkflow: string;
  }

  interface LogEntry {
    id: string;
    timestamp: Date;
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
    details?: any;
  }

  interface UploadProgress {
    filename: string;
    progress: number;
    status: 'uploading' | 'validating' | 'importing' | 'caching' | 'complete' | 'error';
  }

  interface StorageQuota {
    used: number;
    total: number;
    extensionCount: number;
    cacheCount: number;
  }

  // Initialize state
  let state: ExtensionManagerState = {
    workspaceExtensions: [],
    cachedExtensions: [],
    selectedWorkspace: 'demo-workspace',
    operationLog: [],
    uploadProgress: null,
    isLoading: false,
    storageQuota: { used: 0, total: 1000000000, extensionCount: 0, cacheCount: 0 },
    selectedExtension: null,
    currentWorkflow: 'basic-import',
  };

  // Extension Manager instance
  let extensionManager: ExtensionManager;
  let fileStorage: FileStorageAPI;

  // Workflow selection
  const workflows = [
    {
      id: 'basic-import',
      name: 'Basic Extension Import',
      description: 'Upload → Validate → Import → Cache',
    },
    {
      id: 'cache-management',
      name: 'Cache Management',
      description: 'Browse Cache → Import → Conflict Detection',
    },
    {
      id: 'multi-file',
      name: 'Multi-File Extensions',
      description: 'Import Base → Add Files → Manage Complete Extension',
    },
    {
      id: 'workspace-import',
      name: 'Workspace Import',
      description: 'EPUB Upload → Auto-Scan → Batch Cache → Summary',
    },
    {
      id: 'extension-library',
      name: 'Extension Library',
      description: 'Browse → Organize → Batch Operations → Export',
    },
  ];

  let selectedWorkflowId = 'basic-import';

  // Initialize Extension Manager
  onMount(async () => {
    try {
      // Use isolated mock storage instead of persistent storage
      fileStorage = createIsolatedMockStorage();
      await fileStorage.init();
      extensionManager = new ExtensionManager(fileStorage);

      log('info', 'Extension Manager initialized with mock-isolated backend (demo mode)');

      // Pre-populate cache for demonstration
      await setupDemoEnvironment();

      // Load initial data
      await refreshData();

      log('success', 'Demo environment ready');
    } catch (error) {
      log('error', 'Failed to initialize Extension Manager', error);
    }
  });

  // Cleanup when story unmounts to prevent memory leaks
  onDestroy(() => {
    if (fileStorage) {
      cleanupStoryStorage(fileStorage);
    }
  });

  // Setup demo environment with sample data
  async function setupDemoEnvironment() {
    log('info', 'Setting up demo environment...');

    // Create demo workspace
    const result = await fileStorage.createWorkspace();
    log('info', `Created demo workspace: ${result.id}`);

    // Pre-populate cache with popular extensions
    const popularExtensions = getPopularExtensions();

    for (const extension of popularExtensions) {
      try {
        const files = new Map<string, ArrayBuffer>();

        for (const [filename, content] of Object.entries(extension.files)) {
          const encoder = new TextEncoder();
          files.set(filename, encoder.encode(content));
        }

        await extensionManager.extensionCache.cacheExtension(extension.name, files);
        log('info', `Cached extension: ${extension.name}`);
      } catch (error) {
        log('warning', `Failed to cache ${extension.name}:`, error);
      }
    }

    // Set up conflict scenarios for cache management demo
    if (selectedWorkflowId === 'cache-management') {
      // Note: Conflict scenarios would be handled through extension cache directly
      log('info', 'Cache management scenario setup (conflicts handled via extension cache)');
    }

    log('info', 'Demo environment setup complete');
  }

  // Refresh all data from Extension Manager
  async function refreshData() {
    state.isLoading = true;

    try {
      // Load workspace extensions
      state.workspaceExtensions = await extensionManager.listWorkspaceExtensions(
        state.selectedWorkspace
      );

      // Load cached extensions
      state.cachedExtensions = await extensionManager.listCachedExtensions();

      // Update storage quota
      await updateStorageQuota();

      log(
        'info',
        `Loaded ${state.workspaceExtensions.length} workspace extensions, ${state.cachedExtensions.length} cached extensions`
      );
    } catch (error) {
      log('error', 'Failed to refresh data', error);
    } finally {
      state.isLoading = false;
    }
  }

  // Update storage quota information
  async function updateStorageQuota() {
    try {
      const cacheStats = await extensionManager.extensionCache.getCacheStats();

      state.storageQuota = {
        used:
          cacheStats.totalSize +
          state.workspaceExtensions.reduce((sum, ext) => sum + ext.totalSize, 0),
        total: 1000000000, // 1GB demo quota
        extensionCount: state.workspaceExtensions.length,
        cacheCount: state.cachedExtensions.length,
      };
    } catch (error) {
      log('warning', 'Failed to update storage quota', error);
    }
  }

  // Logging utility
  function log(level: LogEntry['level'], message: string, details?: any) {
    const entry: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      level,
      message,
      details,
    };

    state.operationLog = [entry, ...state.operationLog].slice(0, 100); // Keep last 100 entries

    // Also log to console for debugging
    console.log(`[${level.toUpperCase()}] ${message}`, details || '');
  }

  // Clear operation log
  function clearLog() {
    state.operationLog = [];
    log('info', 'Operation log cleared');
  }

  // File upload handler
  async function handleFileUpload(event: CustomEvent<{ files: FileList }>) {
    const files = Array.from(event.detail.files);

    for (const file of files) {
      await importSingleFile(file);
    }
  }

  // Import single file
  async function importSingleFile(file: File) {
    const filename = file.name;

    log('info', `Starting import of ${filename}`);

    state.uploadProgress = {
      filename,
      progress: 0,
      status: 'uploading',
    };

    try {
      // Validate file
      state.uploadProgress.status = 'validating';
      state.uploadProgress.progress = 25;

      const validation = extensionManager.validateExtensionFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error!);
      }

      // Detect extension name
      const detectedName = extensionManager.detectExtensionName(filename);
      log('info', `Detected extension name: ${detectedName}`);

      // Import to workspace
      state.uploadProgress.status = 'importing';
      state.uploadProgress.progress = 50;

      const result = await extensionManager.importExtension(
        state.selectedWorkspace,
        file,
        detectedName
      );

      // Caching happens automatically during import
      state.uploadProgress.status = 'caching';
      state.uploadProgress.progress = 75;

      state.uploadProgress.status = 'complete';
      state.uploadProgress.progress = 100;

      log('success', `Successfully imported ${result.name} (${formatFileSize(result.totalSize)})`);

      // Refresh data
      await refreshData();
    } catch (error) {
      state.uploadProgress.status = 'error';
      log('error', `Failed to import ${filename}`, error);
    } finally {
      // Clear progress after delay
      setTimeout(() => {
        state.uploadProgress = null;
      }, 2000);
    }
  }

  // Import from cache
  async function handleCacheImport(event: CustomEvent<{ extensionName: string }>) {
    const { extensionName } = event.detail;

    try {
      log('info', `Importing ${extensionName} from cache`);

      await extensionManager.importFromCache(state.selectedWorkspace, extensionName);

      log('success', `Successfully imported ${extensionName} from cache`);
      await refreshData();
    } catch (error) {
      log('error', `Failed to import ${extensionName} from cache`, error);
    }
  }

  // Delete extension
  async function handleExtensionDelete(
    event: CustomEvent<{ extensionName: string; location: 'workspace' | 'cache' }>
  ) {
    const { extensionName, location } = event.detail;

    try {
      log('info', `Deleting ${extensionName} from ${location}`);

      if (location === 'workspace') {
        await extensionManager.deleteWorkspaceExtension(state.selectedWorkspace, extensionName);
      } else {
        await extensionManager.deleteCachedExtension(extensionName);
      }

      log('success', `Successfully deleted ${extensionName} from ${location}`);
      await refreshData();
    } catch (error) {
      log('error', `Failed to delete ${extensionName} from ${location}`, error);
    }
  }

  // Extension selection
  function handleExtensionSelect(event: CustomEvent<{ extension: ExtensionInfo }>) {
    state.selectedExtension = event.detail.extension;
    log('info', `Selected extension: ${state.selectedExtension.name}`);
  }

  // Workflow change
  async function handleWorkflowChange(workflowId: string) {
    selectedWorkflowId = workflowId;
    state.currentWorkflow = workflowId;

    log('info', `Switched to workflow: ${workflows.find(w => w.id === workflowId)?.name}`);

    // Reset demo environment for new workflow
    await setupDemoEnvironment();
    await refreshData();
  }

  // Batch operations
  async function handleBatchOperation(
    event: CustomEvent<{ operation: string; extensions: string[] }>
  ) {
    const { operation, extensions } = event.detail;

    log('info', `Starting batch ${operation} for ${extensions.length} extensions`);

    for (const extensionName of extensions) {
      try {
        switch (operation) {
          case 'cache':
            await extensionManager.cacheExtension(state.selectedWorkspace, extensionName);
            break;
          case 'delete':
            await extensionManager.deleteWorkspaceExtension(state.selectedWorkspace, extensionName);
            break;
          default:
            log('warning', `Unknown batch operation: ${operation}`);
        }
      } catch (error) {
        log('error', `Batch ${operation} failed for ${extensionName}`, error);
      }
    }

    log('success', `Batch ${operation} completed`);
    await refreshData();
  }

  // EPUB import simulation
  async function simulateEPUBImport(epubName: string) {
    const epub = SAMPLE_EPUBS[epubName];
    if (!epub) {
      log('error', `EPUB ${epubName} not found`);
      return;
    }

    log('info', `Importing EPUB: ${epub.name}`);

    // Simulate EPUB extraction to workspace
    const workspaceFiles = createWorkspaceFromEPUB(epub);

    // Write sample files to demonstrate the workflow
    for (const [filePath, content] of Object.entries(workspaceFiles)) {
      try {
        if (typeof content === 'string') {
          await fileStorage.writeTextFile(state.selectedWorkspace, filePath, content);
        } else {
          await fileStorage.writeFile(state.selectedWorkspace, filePath, content);
        }
      } catch (error) {
        log('warning', `Failed to write ${filePath}:`, error);
      }
    }

    // Auto-scan and cache extensions
    const summary = await extensionManager.scanAndCacheExtensions(state.selectedWorkspace);

    log(
      'success',
      `EPUB import complete: ${summary.successCount} extensions cached, ${summary.conflicts.length} conflicts`
    );

    if (summary.conflicts.length > 0) {
      log('warning', `Conflicts detected: ${summary.conflicts.join(', ')}`);
    }

    await refreshData();
  }

  // Utility functions
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatTimestamp(date: Date): string {
    return date.toLocaleTimeString();
  }

  // Reactive statements
  $: selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);
</script>

<div class="extension-manager-demo">
  <!-- Header -->
  <header class="demo-header">
    <h1>Extension Manager Demo</h1>
    <div class="workflow-selector">
      <label for="workflow-select">Workflow:</label>
      <select
        id="workflow-select"
        bind:value={selectedWorkflowId}
        on:change={e => handleWorkflowChange(e.currentTarget.value)}
      >
        {#each workflows as workflow}
          <option value={workflow.id}>{workflow.name}</option>
        {/each}
      </select>
    </div>
  </header>

  <!-- Workflow Description -->
  {#if selectedWorkflow}
    <div class="workflow-description">
      <h2>{selectedWorkflow.name}</h2>
      <p>{selectedWorkflow.description}</p>
    </div>
  {/if}

  <!-- Main Demo Interface -->
  <div class="demo-layout">
    <!-- Left Panel: Upload & Browser -->
    <div class="left-panel">
      <ExtensionUploader
        {state}
        on:filesUploaded={handleFileUpload}
        on:epubImport={e => simulateEPUBImport(e.detail.epubName)}
      />

      <ExtensionBrowser
        workspaceExtensions={state.workspaceExtensions}
        cachedExtensions={state.cachedExtensions}
        {selectedWorkflowId}
        on:extensionSelect={handleExtensionSelect}
        on:importFromCache={handleCacheImport}
        on:extensionDelete={handleExtensionDelete}
        on:batchOperation={handleBatchOperation}
      />
    </div>

    <!-- Center Panel: Details -->
    <div class="center-panel">
      <ExtensionDetails
        extension={state.selectedExtension}
        on:extensionAction={e => {
          if (e.detail.action === 'delete') {
            handleExtensionDelete(e);
          }
        }}
      />
    </div>

    <!-- Right Panel: Status & Log -->
    <div class="right-panel">
      <StatusPanel
        storageQuota={state.storageQuota}
        uploadProgress={state.uploadProgress}
        isLoading={state.isLoading}
      />

      <OperationLog entries={state.operationLog} on:clearLog={clearLog} />
    </div>
  </div>
</div>

<style>
  .extension-manager-demo {
    height: 100vh;
    max-height: 100vh;
    overflow: auto;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: var(--font-family-sans);
    display: flex;
    flex-direction: column;
  }

  .demo-header {
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border-primary);
    background: var(--color-bg-secondary);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .demo-header h1 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
  }

  .workflow-selector {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .workflow-selector label {
    font-weight: var(--font-weight-medium);
  }

  .workflow-selector select {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .workflow-description {
    padding: var(--space-4);
    background: var(--color-bg-accent);
    border-bottom: 1px solid var(--color-border-primary);
  }

  .workflow-description h2 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--font-size-lg);
    color: var(--color-text-accent);
  }

  .workflow-description p {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .demo-layout {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--space-4);
    padding: var(--space-4);
    flex: 1;
    overflow: auto;
  }

  .left-panel,
  .center-panel,
  .right-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* Responsive design */
  @media (max-width: 1024px) {
    .demo-layout {
      grid-template-columns: 1fr 1fr;
    }

    .right-panel {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 768px) {
    .demo-header {
      flex-direction: column;
      gap: var(--space-3);
      align-items: stretch;
    }

    .demo-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
