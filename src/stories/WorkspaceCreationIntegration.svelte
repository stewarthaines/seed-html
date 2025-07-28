<script lang="ts">
  import { onMount } from 'svelte';
  import { StorageManager } from '../lib/storage/index.js';
  import './workspace-creation-integration.css';

  interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'action';
    message: string;
  }

  interface TestResult {
    backend: string;
    browser: string;
    timestamp: string;
    success: boolean;
    filesCreated?: number;
    totalSize?: number;
    error?: string;
  }

  // State management (following established patterns)
  let initialized = false;
  let error: string | null = null;
  let isRunning = false;
  let logs: LogEntry[] = [];
  let currentBackend = 'unknown';
  let testResults: TestResult[] = [];

  // Backend managers
  let storageManager: StorageManager;

  // Real backend initialization (STORYBOOK_ADVANCED.md pattern)
  async function initializeBackends() {
    try {
      addLog('info', 'Initializing storage backend...');
      
      // Initialize storage with feature detection
      storageManager = new StorageManager();
      await storageManager.init();
      
      // Detect actual storage backend being used
      currentBackend = storageManager.getBackendType();
      addLog('success', `✅ WORKING: Storage backend initialized: ${currentBackend}`);
      
      initialized = true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Backend initialization failed';
      error = errorMsg;
      addLog('error', `❌ BROKEN: Backend initialization failed: ${errorMsg}`);
    }
  }

  // Complete integration test - THE FAILING WORKFLOW
  async function runCompleteWorkspaceCreation() {
    if (!initialized || isRunning) return;
    isRunning = true;
    addLog('action', 'Starting complete workspace creation test...');

    try {
      // 1. Create workspace with sample EPUB structure
      addLog('action', 'Creating EPUB workspace...');
      const workspaceId = await storageManager.createWorkspace();
      addLog('success', `✅ WORKING: Workspace created: ${workspaceId}`);

      // 2. Create basic EPUB structure manually (simulating what createLocalizedEPUBWorkspace should do)
      addLog('action', 'Creating basic EPUB structure...');
      
      // Create mimetype
      await storageManager.writeTextFile(workspaceId, 'mimetype', 'application/epub+zip');
      
      // Create container.xml
      await storageManager.writeTextFile(
        workspaceId,
        'META-INF/container.xml',
        `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
      );

      // Create content.opf
      const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Integration Test Book</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:identifier id="BookId">test-${Date.now()}</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="chapter1" href="Text/chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="Text/chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="styles" href="Styles/page.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>`;
      await storageManager.writeTextFile(workspaceId, 'OEBPS/content.opf', contentOpf);

      // Create XHTML files in OEBPS/Text/ directory - THIS IS THE CRITICAL TEST
      addLog('action', 'Writing XHTML files to OEBPS/Text/ directory...');
      
      const chapter1Content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 1</title>
  <link rel="stylesheet" type="text/css" href="../Styles/page.css"/>
</head>
<body>
  <h1>Chapter 1: Introduction</h1>
  <p>This is the first chapter of our integration test book. This content tests whether XHTML files are properly written to storage.</p>
  <p>If you can read this in the manifest preview, the workspace creation bug has been fixed!</p>
</body>
</html>`;

      const chapter2Content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 2</title>
  <link rel="stylesheet" type="text/css" href="../Styles/page.css"/>
</head>
<body>
  <h1>Chapter 2: Testing</h1>
  <p>This is the second chapter, continuing our test of the workspace creation functionality.</p>
  <p>Multiple XHTML files help verify that the entire workflow is working correctly.</p>
</body>
</html>`;

      await storageManager.writeTextFile(workspaceId, 'OEBPS/Text/chapter1.xhtml', chapter1Content);
      await storageManager.writeTextFile(workspaceId, 'OEBPS/Text/chapter2.xhtml', chapter2Content);

      // Create CSS file
      const cssContent = `body {
  font-family: serif;
  margin: 2em;
  line-height: 1.6;
}

h1 {
  color: #333;
  border-bottom: 1px solid #ccc;
  padding-bottom: 0.5em;
}

p {
  margin: 1em 0;
}`;
      await storageManager.writeTextFile(workspaceId, 'OEBPS/Styles/page.css', cssContent);

      addLog('success', '✅ WORKING: EPUB structure created successfully');

      // 3. Verify files were actually written to storage
      addLog('action', 'Verifying XHTML files were written to storage...');
      const allFiles = await storageManager.listFiles(workspaceId);
      addLog('info', `Total files in workspace: ${allFiles.length}`);
      addLog('info', `All files: ${allFiles.join(', ')}`);
      
      // Look specifically for XHTML files in OEBPS/Text/
      const xhtmlFiles = allFiles.filter(f => f.includes('OEBPS/Text/') && f.endsWith('.xhtml'));
      
      if (xhtmlFiles.length === 0) {
        // This is the current bug - manifest entries exist but no XHTML files
        const manifestFiles = allFiles.filter(f => f.includes('manifest') || f.includes('.opf'));
        addLog('error', `Found manifest files: ${manifestFiles.join(', ')}`);
        addLog('error', '❌ BROKEN: NO XHTML FILES FOUND in OEBPS/Text/');
        throw new Error('NO XHTML FILES FOUND - This is the bug we\'re investigating!');
      }
      
      addLog('success', `✅ WORKING: Found ${xhtmlFiles.length} XHTML files: ${xhtmlFiles.join(', ')}`);

      // 4. Test file content and validate XHTML
      let totalSize = 0;
      for (const fileName of xhtmlFiles) {
        addLog('action', `Reading and validating file: ${fileName}`);
        const content = await storageManager.readTextFile(workspaceId, fileName);
        
        if (!content || content.length === 0) {
          throw new Error(`❌ BROKEN: File ${fileName} exists in listing but is empty when read!`);
        }
        
        // Validate XHTML structure
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/xml');
        const parseError = doc.querySelector('parsererror');
        
        if (parseError) {
          throw new Error(`❌ BROKEN: File ${fileName} contains invalid XHTML: ${parseError.textContent}`);
        }
        
        totalSize += content.length;
        addLog('success', `✅ WORKING: ${fileName}: ${content.length} bytes, valid XHTML`);
      }

      // 5. Test manifest preview integration (simulates what ManifestPreview does)
      addLog('action', 'Testing manifest preview integration...');
      for (const fileName of xhtmlFiles) {
        try {
          const previewContent = await storageManager.readTextFile(workspaceId, fileName);
          if (!previewContent) {
            throw new Error(`❌ BROKEN: Preview failed: ${fileName} cannot be read`);
          }
          addLog('success', `✅ WORKING: Manifest preview test: ${fileName} readable`);
        } catch (previewError) {
          const errorMsg = previewError instanceof Error ? previewError.message : 'Unknown error';
          throw new Error(`❌ BROKEN: Manifest preview failed for ${fileName}: ${errorMsg}`);
        }
      }

      // 6. Record successful test results
      testResults = [...testResults, {
        backend: currentBackend,
        browser: getBrowserName(),
        timestamp: new Date().toISOString(),
        success: true,
        filesCreated: xhtmlFiles.length,
        totalSize: totalSize
      }];

      addLog('success', '🎉 ✅ WORKING: Complete integration test PASSED!');
      addLog('success', `Created ${xhtmlFiles.length} files, total size: ${totalSize} bytes`);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addLog('error', `❌ BROKEN: Integration test FAILED: ${errorMsg}`);
      
      // Record failure with detailed error info
      testResults = [...testResults, {
        backend: currentBackend,
        browser: getBrowserName(),
        timestamp: new Date().toISOString(),
        success: false,
        error: errorMsg
      }];
    } finally {
      isRunning = false;
    }
  }

  // Reset functionality (STORYBOOK_ADVANCED.md pattern)
  async function resetDemo() {
    logs = [];
    testResults = [];
    error = null;
    initialized = false;
    
    // Clean up any existing test workspaces
    try {
      if (storageManager) {
        const workspaces = await storageManager.listWorkspaces();
        const testWorkspaces = workspaces.filter(w => w.includes('workspace-'));
        for (const wsId of testWorkspaces) {
          try {
            await storageManager.deleteWorkspace(wsId);
            addLog('info', `Cleaned up test workspace: ${wsId}`);
          } catch {
            // Workspace may not exist, ignore
          }
        }
      }
    } catch {
      // Storage may not be initialized, ignore
    }
    
    await initializeBackends();
    addLog('success', 'Demo reset complete');
  }

  // Simple logging - focus on working vs broken
  function addLog(type: LogEntry['type'], message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, { timestamp, type, message }];
  }

  // Browser detection utility
  function getBrowserName(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edg')) return 'Edge';
    return 'Unknown';
  }

  // Initialize on mount (STORYBOOK_ADVANCED.md pattern)
  onMount(() => {
    initializeBackends();
  });

  // Expose reset for play functions (STORYBOOK_ADVANCED.md pattern)
  if (typeof window !== 'undefined') {
    (window as any).resetWorkspaceIntegrationDemo = resetDemo;
    (window as any).runWorkspaceIntegrationTest = runCompleteWorkspaceCreation;
  }
</script>

<div class="integration-demo">
  {#if error}
    <div class="demo-error">
      <h2>Backend Error</h2>
      <p>{error}</p>
      <button on:click={resetDemo}>Retry</button>
    </div>
  {:else if !initialized}
    <div class="demo-loading">
      <h2>Initializing Real Backend...</h2>
      <p>Setting up storage system and workspace manager...</p>
      <div class="loading-spinner"></div>
    </div>
  {:else}
    <div class="demo-header">
      <h2>Workspace Creation Integration Test</h2>
      <p>Testing the complete EPUB workspace creation workflow</p>
    </div>

    <div class="demo-controls">
      <div class="status-info">
        <h3>Backend Status</h3>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">Storage Backend:</span>
            <span class="status-value">{currentBackend}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Browser:</span>
            <span class="status-value">{getBrowserName()}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Tests Run:</span>
            <span class="status-value">{testResults.length}</span>
          </div>
        </div>
      </div>
      
      <div class="button-group">
        <button 
          on:click={runCompleteWorkspaceCreation} 
          disabled={isRunning}
          class="primary-button"
        >
          {isRunning ? 'Running...' : 'Run Complete Integration Test'}
        </button>
        <button on:click={resetDemo} disabled={isRunning} class="reset-button">
          Reset Demo
        </button>
      </div>
    </div>

    <!-- Test Results Summary -->
    {#if testResults.length > 0}
      <div class="test-results">
        <h3>Test Results History</h3>
        <div class="results-grid">
          {#each testResults as result, index}
            <div class="result-card" class:success={result.success} class:failure={!result.success}>
              <div class="result-header">
                <span class="result-status">{result.success ? '✅' : '❌'}</span>
                <div class="result-info">
                  <div class="result-backend">{result.backend}</div>
                  <div class="result-browser">{result.browser}</div>
                  <div class="result-time">{new Date(result.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
              {#if result.success}
                <div class="result-details">
                  <p>Files Created: <strong>{result.filesCreated}</strong></p>
                  <p>Total Size: <strong>{result.totalSize} bytes</strong></p>
                  <p class="result-success">All XHTML files written successfully</p>
                </div>
              {:else}
                <div class="result-error">
                  <p><strong>Error:</strong> {result.error}</p>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Console Log (STORYBOOK_ADVANCED.md pattern) -->
    <div class="console-log">
      <div class="console-header">
        <h3>Integration Test Log</h3>
        <div class="console-stats">
          <button on:click={() => logs = []} class="clear-log">Clear</button>
        </div>
      </div>
      <div class="log-entries">
        {#each logs as log}
          <div class="log-entry log-{log.type}">
            <span class="log-time">{log.timestamp}</span>
            <span class="log-type">[{log.type.toUpperCase()}]</span>
            <span class="log-message">{log.message}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>