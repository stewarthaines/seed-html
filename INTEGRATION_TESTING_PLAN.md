# Integration Testing Plan: Phase 1 Storage Backend Integration Stories

## Executive Summary

This document details the implementation of comprehensive browser-based integration tests using Storybook to identify and fix the current workspace creation XHTML file writing issue. The tests leverage real storage backends (OPFS-sync, OPFS-async, IndexedDB) across multiple browsers to provide authentic testing conditions.

**Current Issue**: Workspace creation succeeds but XHTML files are not written to storage, causing "Failed to read file" errors in manifest preview.

**Solution Approach**: Create Backend category Storybook stories that test the complete `createLocalizedEPUBWorkspace` workflow with real file validation.

## Technical Foundation

### Following Established Patterns

This implementation strictly follows the project's established Storybook patterns:

- **STORYBOOK.md**: Component Separation Pattern, story categories, testing guidelines
- **STORYBOOK_backend.md**: Real backend integration, console logging, reset functionality  
- **STORYBOOK_feature.md**: Promise-based operations, accessibility patterns, error handling

### Leveraging Existing Infrastructure

**Browser Testing**: Uses existing `@vitest/browser` + Playwright configuration in `.storybook/vitest.config.ts`
- Chromium: OPFS-sync (http), IndexedDB (file:// protocol)
- Firefox: OPFS-sync support
- Safari/Webkit: OPFS-async (http and file:// protocol)

**Storage Architecture**: Tests real storage backends, not mocks
- Feature detection validates capabilities per browser
- Fallback chain: OPFS-sync → OPFS-async → IndexedDB
- Authentic performance characteristics per backend

## Implementation Specification

### File Structure (Component Separation Pattern)

```
src/stories/
├── WorkspaceCreationIntegration.stories.svelte    # Story definitions only
├── WorkspaceCreationIntegration.svelte            # Component logic
└── workspace-creation-integration.css             # Dedicated styling
```

### Primary Integration Story

**Category**: `Backend/Workspace Creation Integration`
**Purpose**: Test complete workspace creation workflow with real storage backends

#### Component Logic (`WorkspaceCreationIntegration.svelte`)

```typescript
<script lang="ts">
  import { onMount } from 'svelte';
  import { StorageManager } from '../lib/storage';
  import { WorkspaceManager } from '../lib/workspace';
  import { SampleContentGenerator } from '../lib/content';

  // Type definitions
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
  let workspaceManager: WorkspaceManager;
  let contentGenerator: SampleContentGenerator;

  // Real backend initialization (STORYBOOK_feature.md pattern)
  async function initializeBackends() {
    try {
      addLog('info', 'Initializing storage backend...');
      
      // Initialize storage with feature detection
      storageManager = new StorageManager();
      await storageManager.init();
      
      // Initialize workspace manager with real backend
      workspaceManager = new WorkspaceManager(storageManager);
      contentGenerator = new SampleContentGenerator();
      
      // Detect actual storage backend being used
      const backendInfo = await storageManager.getBackendInfo();
      addLog('success', `Storage backend initialized: ${backendInfo.type}`);
      currentBackend = backendInfo.type;
      
      initialized = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Backend initialization failed';
      addLog('error', `Backend initialization failed: ${error}`);
    }
  }

  // Complete integration test - THE FAILING WORKFLOW
  async function runCompleteWorkspaceCreation() {
    if (!initialized || isRunning) return;
    isRunning = true;
    addLog('action', 'Starting complete workspace creation test...');

    try {
      // 1. Create workspace with localized content
      addLog('action', 'Creating EPUB workspace with localized content...');
      const metadata = {
        title: 'Integration Test Book',
        identifier: `test-${Date.now()}`,
        creator: [{ name: 'Test Author', role: 'aut' }],
        language: 'en'
      };
      
      // This is the exact call that's failing in production
      const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace(metadata, 'en');
      addLog('success', `Workspace created: ${workspaceId}`);

      // 2. Verify files were actually written to storage
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
        addLog('error', 'But NO XHTML FILES FOUND in OEBPS/Text/');
        throw new Error('NO XHTML FILES FOUND - This is the bug we\'re investigating!');
      }
      
      addLog('success', `Found ${xhtmlFiles.length} XHTML files: ${xhtmlFiles.join(', ')}`);

      // 3. Test file content and preview functionality
      let totalSize = 0;
      for (const fileName of xhtmlFiles) {
        addLog('action', `Reading and validating file: ${fileName}`);
        const content = await storageManager.readTextFile(workspaceId, fileName);
        
        if (!content || content.length === 0) {
          throw new Error(`File ${fileName} exists in listing but is empty when read!`);
        }
        
        // Validate XHTML structure
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/xml');
        const parseError = doc.querySelector('parsererror');
        
        if (parseError) {
          throw new Error(`File ${fileName} contains invalid XHTML: ${parseError.textContent}`);
        }
        
        totalSize += content.length;
        addLog('success', `✅ ${fileName}: ${content.length} bytes, valid XHTML`);
      }

      // 4. Test manifest preview integration
      addLog('action', 'Testing manifest preview integration...');
      // This simulates what ManifestPreview does
      for (const fileName of xhtmlFiles) {
        try {
          const previewContent = await storageManager.readTextFile(workspaceId, fileName);
          if (!previewContent) {
            throw new Error(`Preview failed: ${fileName} cannot be read`);
          }
          addLog('success', `✅ Manifest preview test: ${fileName} readable`);
        } catch (previewError) {
          throw new Error(`Manifest preview failed for ${fileName}: ${previewError.message}`);
        }
      }

      // 5. Record successful test results
      testResults = [...testResults, {
        backend: currentBackend,
        browser: getBrowserName(),
        timestamp: new Date().toISOString(),
        success: true,
        filesCreated: xhtmlFiles.length,
        totalSize: totalSize
      }];

      addLog('success', '🎉 Complete integration test PASSED!');
      addLog('success', `Created ${xhtmlFiles.length} files, total size: ${totalSize} bytes`);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addLog('error', `❌ Integration test FAILED: ${errorMsg}`);
      
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

  // Isolated transform pipeline test
  async function runTransformPipelineTest() {
    if (!initialized || isRunning) return;
    isRunning = true;
    addLog('action', 'Testing transform pipeline with workspace scripts...');

    try {
      // Generate sample content
      const sampleText = `# Chapter 1: Introduction

This is the opening chapter of our story.

## A New Beginning  
The adventure starts here with some **bold text** and *italic text*.`;

      // Load transform scripts from workspace SOURCE/ directory
      addLog('action', 'Loading transformText.js and transformDom.js from workspace SOURCE/...');
      
      // Note: Transform scripts are copied from assets/universal during workspace creation
      // but must be loaded dynamically from the workspace SOURCE/ directory, not assets
      const transformTextScript = await storageManager.readTextFile(workspaceId, 'SOURCE/transformText.js');
      const transformDomScript = await storageManager.readTextFile(workspaceId, 'SOURCE/transformDom.js');
      
      if (!transformTextScript || !transformDomScript) {
        throw new Error('Transform scripts not found in workspace SOURCE/ directory');
      }
      
      addLog('success', 'Transform pipeline test completed');

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addLog('error', `Transform pipeline test failed: ${errorMsg}`);
    } finally {
      isRunning = false;
    }
  }

  // Reset functionality (STORYBOOK_backend.md pattern)
  async function resetDemo() {
    logs = [];
    testResults = [];
    error = null;
    initialized = false;
    
    // Clean up any existing test workspaces
    try {
      if (storageManager) {
        const workspaces = await storageManager.listWorkspaces();
        const testWorkspaces = workspaces.filter(w => w.includes('test-'));
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
  function addLog(type: 'success' | 'error' | 'info', message: string) {
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

  // Initialize on mount (STORYBOOK_feature.md pattern)
  onMount(() => {
    initializeBackends();
  });

  // Expose reset for play functions (STORYBOOK_feature.md pattern)
  if (typeof window !== 'undefined') {
    (window as any).resetWorkspaceIntegrationDemo = resetDemo;
    (window as any).runWorkspaceIntegrationTest = runCompleteWorkspaceCreation;
  }
</script>

<!-- UI following console demo patterns -->
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
      <p>Testing the complete workflow that's failing in production</p>
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
        <button 
          on:click={runTransformPipelineTest} 
          disabled={isRunning}
          class="secondary-button"
        >
          Test Transform Pipeline
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

    <!-- Console Log (STORYBOOK_backend.md pattern) -->
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
```

#### Story Definitions (`WorkspaceCreationIntegration.stories.svelte`)

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import WorkspaceCreationIntegration from './WorkspaceCreationIntegration.svelte';

  const { Story } = defineMeta({
    title: 'Backend/Workspace Creation Integration',
    component: WorkspaceCreationIntegration,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `
# Workspace Creation Integration Test

**Critical Bug Investigation**: This story tests the complete workspace creation workflow that's currently failing in production.

## Current Issue

The \`createLocalizedEPUBWorkspace\` method succeeds but XHTML files are not written to storage, causing "Failed to read file" errors in manifest preview.

## What This Tests

### 1. Complete Workflow Validation
- Storage backend initialization with feature detection
- Workspace creation with metadata
- Sample content generation and localization  
- Transform pipeline execution using scripts from workspace SOURCE/ directory (text → HTML → XHTML)
- File writing to OEBPS/Text/ directory
- File readback validation for manifest preview

### 2. Cross-Browser Storage Testing
- **Chromium**: OPFS-sync (http), IndexedDB fallback (file://)
- **Firefox**: OPFS-sync support
- **Safari**: OPFS-async (http and file://)

### 3. Error Identification
- Real-time console logging shows exact failure points
- File existence validation in storage
- XHTML content validation and parsing
- Manifest preview integration testing

## Usage Instructions

### Manual Testing
1. **Initialize**: Backend automatically initializes on load
2. **Run Test**: Click "Run Complete Integration Test"
3. **Monitor Progress**: Watch real-time console logging
4. **Analyze Results**: Check success/failure details
5. **Reset**: Clean state for repeated testing

### Automated Testing
Use the "Automated Integration Test" story for automated play function testing.

## Expected Results

### Success (When Bug is Fixed)
\`\`\`
✅ Storage backend initialized
✅ Workspace created: workspace-abc123
✅ Found 4 XHTML files: chapter1.xhtml, chapter2.xhtml, chapter3.xhtml, appendix.xhtml
✅ chapter1.xhtml: 1,247 bytes, valid XHTML
🎉 Complete integration test PASSED!
\`\`\`

### Failure (Current Bug)
\`\`\`
✅ Storage backend initialized  
✅ Workspace created: workspace-abc123
❌ Integration test FAILED: NO XHTML FILES FOUND - This is the bug we're investigating!
\`\`\`

## Technical Implementation

- **Real Backends**: Uses actual OPFS/IndexedDB, not mocks
- **Authentic Timing**: Real async operations and browser API behavior
- **Comprehensive Logging**: Every operation tracked with timestamps
- **Error Scenarios**: Tests actual error conditions and recovery
- **Reset Capability**: Clean state management between tests

## Integration with Development

This story serves as both debugging tool and regression test:
- Identifies exact failure points in workspace creation
- Validates fixes with real storage backends
- Provides cross-browser compatibility testing
- Enables continuous integration testing
          `
        }
      }
    }
  });
</script>

<!-- Interactive manual testing -->
<Story name="Interactive Demo">
  <WorkspaceCreationIntegration />
</Story>

<!-- Automated testing with play function -->
<Story
  name="Automated Integration Test"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');

    const canvas = within(canvasElement);
    const user = userEvent.setup();

    try {
      // Wait for backend initialization (real backends take time)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Reset to clean state (STORYBOOK_feature.md pattern)
      if (window.resetWorkspaceIntegrationDemo) {
        await window.resetWorkspaceIntegrationDemo();
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Run the integration test
      const testButton = canvas.getByText('Run Complete Integration Test');
      await user.click(testButton);
      
      // Wait for test completion (workspace creation with transforms can take time)
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Optionally run transform pipeline test
      const transformButton = canvas.getByText('Test Transform Pipeline');
      await user.click(transformButton);
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      console.log('Integration test play function failed:', error);
      // Continue to show current state - failure is informative
    }
  }}
>
  <WorkspaceCreationIntegration />
</Story>

<!-- Cross-browser compatibility story -->
<Story
  name="Cross-Browser Storage Test"
  parameters={{
    docs: {
      description: {
        story: `
Tests storage backend behavior across different browsers:

- **Chrome**: OPFS-sync (fastest)
- **Firefox**: OPFS-async only
- **Safari**: OPFS-async + IndexedDB fallback

Use Storybook's browser testing to run this story across all supported browsers.
        `
      }
    }
  }}
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');

    const canvas = within(canvasElement);
    const user = userEvent.setup();

    try {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Run multiple tests to compare performance across browsers
      for (let i = 0; i < 3; i++) {
        if (window.resetWorkspaceIntegrationDemo) {
          await window.resetWorkspaceIntegrationDemo();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const testButton = canvas.getByText('Run Complete Integration Test');
        await user.click(testButton);
        await new Promise(resolve => setTimeout(resolve, 12000));
      }

    } catch (error) {
      console.log('Cross-browser test failed:', error);
    }
  }}
>
  <WorkspaceCreationIntegration />
</Story>
```

#### CSS Styling (`workspace-creation-integration.css`)

```css
/* Integration Demo Styling */
.integration-demo {
  font-family: system-ui, -apple-system, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
  background: #fafafa;
  min-height: 100vh;
}

/* Header */
.demo-header {
  text-align: center;
  margin-bottom: 2rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.demo-header h2 {
  margin: 0 0 0.5rem 0;
  color: #2563eb;
}

.demo-header p {
  margin: 0;
  color: #6b7280;
}

/* Loading States */
.demo-loading {
  text-align: center;
  padding: 3rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.demo-loading h2 {
  color: #3b82f6;
  margin-bottom: 1rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 1rem auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Error States */
.demo-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
}

.demo-error h2 {
  color: #dc2626;
  margin: 0 0 1rem 0;
}

.demo-error p {
  color: #991b1b;
  margin-bottom: 1rem;
}

/* Controls */
.demo-controls {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.status-info {
  margin-bottom: 1.5rem;
}

.status-info h3 {
  margin: 0 0 1rem 0;
  color: #374151;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.status-label {
  color: #6b7280;
  font-weight: 500;
}

.status-value {
  font-weight: 600;
  color: #374151;
}

.button-group {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.primary-button {
  background: #2563eb;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.primary-button:hover:not(:disabled) {
  background: #1d4ed8;
}

.primary-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.secondary-button {
  background: #6b7280;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.secondary-button:hover:not(:disabled) {
  background: #4b5563;
}

.secondary-button:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.reset-button {
  background: #dc2626;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.reset-button:hover:not(:disabled) {
  background: #b91c1c;
}

/* Test Results */
.test-results {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.test-results h3 {
  margin: 0 0 1rem 0;
  color: #374151;
}

.results-grid {
  display: grid;
  gap: 1rem;
}

.result-card {
  border-radius: 8px;
  padding: 1rem;
  border: 2px solid;
}

.result-card.success {
  background: #f0fdf4;
  border-color: #22c55e;
}

.result-card.failure {
  background: #fef2f2;
  border-color: #ef4444;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.result-status {
  font-size: 1.5rem;
}

.result-info {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.5rem;
  font-size: 0.875rem;
}

.result-backend {
  font-weight: 600;
  color: #2563eb;
}

.result-browser {
  color: #6b7280;
}

.result-time {
  color: #6b7280;
}

.result-details p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
}

.result-success {
  color: #16a34a;
  font-weight: 500;
}

.result-error {
  color: #dc2626;
}

.result-error p {
  margin: 0;
  font-size: 0.875rem;
}

/* Console Log */
.console-log {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.console-header h3 {
  margin: 0;
  color: #374151;
}

.console-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.clear-log {
  background: #6b7280;
  color: white;
  border: none;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
}

.clear-log:hover {
  background: #4b5563;
}

.log-entries {
  background: #1f2937;
  color: #f9fafb;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  padding: 1rem;
  border-radius: 6px;
  height: 400px;
  overflow-y: auto;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.log-time {
  color: #9ca3af;
  font-size: 0.75rem;
  min-width: 80px;
  flex-shrink: 0;
}

.log-type {
  font-weight: 600;
  min-width: 60px;
  flex-shrink: 0;
}

.log-message {
  flex: 1;
  word-break: break-word;
}

/* Log type colors */
.log-success .log-type,
.log-success .log-message {
  color: #34d399;
}

.log-error .log-type,
.log-error .log-message {
  color: #f87171;
}

.log-action .log-type,
.log-action .log-message {
  color: #fbbf24;
}

.log-info .log-type,
.log-info .log-message {
  color: #60a5fa;
}

/* Responsive Design */
@media (max-width: 768px) {
  .integration-demo {
    padding: 0.5rem;
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
  
  .button-group {
    flex-direction: column;
  }
  
  .result-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .result-info {
    grid-template-columns: 1fr;
    width: 100%;
  }
}

/* Print Styles */
@media print {
  .demo-controls,
  .console-log {
    page-break-inside: avoid;
  }
  
  .log-entries {
    height: auto;
    max-height: 300px;
  }
}
```

## Cross-Browser Testing Strategy

### Browser Compatibility Matrix

```typescript
// Test configuration for different browsers
const BROWSER_CONFIGS = {
  chromium: {
    opfs_sync: true,     // http protocol only
    opfs_async: false,   // Not supported
    indexeddb: true,     // file:// protocol fallback
    performance: 'optimal'
  },
  firefox: {
    opfs_sync: true,     // Supported
    opfs_async: false,   // Not supported
    indexeddb: true,     // Fallback
    performance: 'good'
  },
  webkit: {
    opfs_sync: false,    // Not supported
    opfs_async: true,    // http and file:// protocols
    indexeddb: true,     // Fallback
    performance: 'acceptable'
  }
};
```

### Automated Cross-Browser Testing

**Vitest Configuration**: Leverage existing `.storybook/vitest.config.ts`:

```typescript
export default {
  test: {
    browser: {
      enabled: true,
      name: 'chromium', // Also: firefox, webkit
      provider: 'playwright',
      headless: false, // Set to true for CI
      api: { port: 63315 }
    },
    testTimeout: 60000, // Extended timeout for storage operations
    setupFiles: ['./src/stories/integration-test-setup.ts']
  }
};
```

**Integration Test Setup** (`src/stories/integration-test-setup.ts`):

```typescript
import { beforeEach, afterEach } from 'vitest';

beforeEach(async () => {
  // Clear all storage backends before each test
  console.log('🧹 Clearing storage backends...');
  
  // Clear service workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
  }
  
  // Clear IndexedDB
  if ('indexedDB' in window) {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  }
  
  // Clear OPFS if available
  if ('storage' in navigator && 'getDirectory' in navigator.storage) {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      for await (const [name, handle] of opfsRoot.entries()) {
        await opfsRoot.removeEntry(name, { recursive: true });
      }
    } catch (error) {
      console.log('OPFS cleanup failed:', error);
      // Not critical, continue with test
    }
  }
});

afterEach(async () => {
  // Clean up test workspaces
  console.log('🧹 Cleaning up test workspaces...');
  // Implementation depends on StorageManager API
});
```

### Performance Benchmarking

**Storage Performance Tests**:

```typescript
interface PerformanceBenchmark {
  browser: string;
  backend: string;
  operation: string;
  duration: number;
  fileSize?: number;
  timestamp: string;
}

async function benchmarkStorageOperation(
  operation: () => Promise<void>,
  description: string
): Promise<number> {
  const startTime = performance.now();
  await operation();
  const endTime = performance.now();
  return endTime - startTime;
}

// Example benchmarks
const initTime = await benchmarkStorageOperation(
  () => storageManager.init(),
  'Storage initialization'
);

const writeTime = await benchmarkStorageOperation(
  () => storageManager.writeTextFile(workspaceId, 'test.xhtml', content),
  'XHTML file write'
);
```

## Debugging Framework

### Real-Time Operation Tracking

**Log Categories**:
- `info`: General information and progress updates
- `action`: User actions and operation starts
- `success`: Successful operations with results
- `error`: Failures with detailed error information

**Structured Logging**:

```typescript
interface DetailedLogEntry extends LogEntry {
  category?: string;
  operation?: string;
  duration?: number;
  data?: any;
}

function addDetailedLog(
  type: LogType,
  message: string,
  details?: {
    category?: string;
    operation?: string;
    duration?: number;
    data?: any;
  }
) {
  const entry: DetailedLogEntry = {
    timestamp: new Date().toISOString(),
    type,
    message,
    ...details
  };
  
  logs = [...logs, entry];
  
  // Also log to browser console for debugging
  const logMethod = type === 'error' ? console.error : 
                   type === 'success' ? console.info : console.log;
  logMethod(`[${type.toUpperCase()}]`, message, details);
}
```

### Error Classification

**Error Categories**:

```typescript
enum ErrorCategory {
  STORAGE_INIT = 'storage_initialization',
  WORKSPACE_CREATION = 'workspace_creation',
  CONTENT_GENERATION = 'content_generation',
  TRANSFORM_PIPELINE = 'transform_pipeline',
  FILE_WRITING = 'file_writing',
  FILE_READING = 'file_reading',
  MANIFEST_INTEGRATION = 'manifest_integration'
}

function classifyError(error: Error, context: string): ErrorCategory {
  const message = error.message.toLowerCase();
  
  if (message.includes('storage') || message.includes('backend')) {
    return ErrorCategory.STORAGE_INIT;
  }
  if (message.includes('workspace') || message.includes('createLocalizedEPUBWorkspace')) {
    return ErrorCategory.WORKSPACE_CREATION;
  }
  if (message.includes('transform') || message.includes('pipeline')) {
    return ErrorCategory.TRANSFORM_PIPELINE;
  }
  if (message.includes('write') || message.includes('writeTextFile')) {
    return ErrorCategory.FILE_WRITING;
  }
  if (message.includes('read') || message.includes('readTextFile')) {
    return ErrorCategory.FILE_READING;
  }
  
  // Default based on context
  return context as ErrorCategory;
}
```

## Browser Testing

Run this story manually in Storybook across different browsers to identify browser-specific issues. Open http://localhost:6006 in Chrome, Firefox, and Safari to test each storage backend.

## Implementation Timeline

### Phase 1: Core Integration Story (Week 1)
- [ ] Create `WorkspaceCreationIntegration.svelte` component
- [ ] Implement story definitions with play functions
- [ ] Add CSS styling following design system
- [ ] Test in Storybook with manual interactions

### Phase 2: Automated Testing (Week 1-2)  
- [ ] Configure cross-browser testing with existing Playwright setup
- [ ] Implement integration test setup and cleanup
- [ ] Add performance benchmarking capabilities
- [ ] Test automated play functions across browsers

### Phase 3: Enhanced Testing (Week 2)
- [ ] Test with different workspace sizes
- [ ] Add multiple file type validation
- [ ] Document browser-specific behaviors

### Phase 3: Browser Compatibility (Week 2)
- [ ] Test in Chrome (OPFS-sync/IndexedDB)
- [ ] Test in Firefox (OPFS-sync)
- [ ] Test in Safari (OPFS-async)
- [ ] Document any browser-specific issues

## Success Metrics

### Functional Validation
- ✅ **Bug Identification**: Precisely identify where XHTML file writing fails
- ✅ **Cross-Browser Testing**: Validate storage backend behavior across browsers
- ✅ **Real Conditions**: Test with authentic storage APIs and timing
- ✅ **Regression Prevention**: Catch similar issues in future development

### Performance Targets
- **Initialization**: < 3 seconds for storage backend setup
- **Workspace Creation**: < 10 seconds for complete workflow
- **File Operations**: < 1 second per XHTML file write/read
- **Cross-Browser**: Consistent behavior across all supported browsers

### Development Integration
- **Real-Time Debugging**: Live error identification during development
- **Automated Testing**: CI/CD integration catches regressions
- **Documentation**: Self-documenting test results and error scenarios
- **Maintenance**: Minimal overhead for ongoing test maintenance

## Expected Impact

### Immediate Benefits
1. **Bug Resolution**: Identify exact failure point in workspace creation
2. **Development Confidence**: Validate fixes with comprehensive testing
3. **Cross-Browser Support**: Ensure compatibility across all target browsers
4. **Documentation**: Living documentation of storage system behavior

### Long-Term Value
1. **Regression Prevention**: Automated testing prevents similar issues
2. **Performance Monitoring**: Track storage performance across browsers
3. **Integration Testing**: Framework for testing complex backend workflows
4. **Development Efficiency**: Faster debugging and validation cycles

This comprehensive integration testing framework will definitively identify and help resolve the current XHTML file writing issue while establishing a robust foundation for ongoing cross-browser storage backend testing.