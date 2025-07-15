<script lang="ts">
  import { onMount } from 'svelte';
  import { ManifestManagerImpl } from '../../lib/manifest/manifest-manager.js';
  import { WorkspaceManager } from '../../lib/workspace/index.js';
  import { createMockManifestItems } from './mock-data/manifest-items.js';
  import type { ManifestItem, ValidationResult, ContentPreview } from '../../lib/manifest/types.js';

  // Demo state
  let workspaceManager: WorkspaceManager;
  let manifestManager: ManifestManagerImpl;
  let initialized = false;
  let error: string | null = null;
  let workspaceId = 'manifest-backend-demo';
  
  // Operation tracking
  let operationLog: string[] = [];
  let currentOperation = '';
  let operationCount = 0;
  
  // Demo data
  let manifestItems: ManifestItem[] = [];
  let validationResults: ValidationResult[] = [];
  let selectedItem: ManifestItem | null = null;
  let contentPreview: ContentPreview | null = null;

  // Demo controls
  let autoRun = true;
  let showDetails = true;

  // Initialize backend services
  async function initializeDemo() {
    try {
      currentOperation = 'Initializing WorkspaceManager...';
      logOperation('🚀 Starting ManifestManager backend demo');
      
      workspaceManager = new WorkspaceManager();
      await workspaceManager.init();
      
      logOperation('✅ WorkspaceManager initialized');
      currentOperation = 'Creating demo workspace...';

      // Clean up any existing demo workspace
      try {
        await workspaceManager.deleteWorkspace(workspaceId);
        logOperation('🧹 Cleaned up existing demo workspace');
      } catch {
        // Workspace doesn't exist, which is fine
      }

      // Create new demo workspace with sample content
      const demoMetadata = {
        title: 'Manifest Manager Demo',
        language: 'en',
        identifier: 'urn:uuid:manifest-demo-' + Date.now(),
        creator: ['Demo System'],
        description: 'Backend demonstration workspace for ManifestManager API testing',
      };

      workspaceId = await workspaceManager.createEPUBWorkspace(demoMetadata);
      logOperation(`📝 Created workspace: ${workspaceId}`);

      // Initialize ManifestManager
      currentOperation = 'Initializing ManifestManager...';
      manifestManager = new ManifestManagerImpl(workspaceManager);
      logOperation('✅ ManifestManager initialized');

      initialized = true;
      currentOperation = '';

      if (autoRun) {
        await runAllDemos();
      }

    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      logOperation(`❌ Initialization failed: ${error}`);
      currentOperation = '';
    }
  }

  // Run all demo operations
  async function runAllDemos() {
    if (!manifestManager) return;

    try {
      await demonstrateCRUDOperations();
      await demonstrateFileUpload();
      await demonstrateValidation();
      await demonstrateContentOperations();
      await demonstrateAdvancedFeatures();
      
      logOperation('🎉 All demonstrations completed successfully');
    } catch (err) {
      logOperation(`❌ Demo error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Demonstrate CRUD operations
  async function demonstrateCRUDOperations() {
    logOperation('📋 === CRUD Operations Demo ===');
    
    try {
      // CREATE - Add sample items
      logOperation('Creating sample manifest items...');
      
      const textItem = await manifestManager.createTextItem(workspaceId, {
        fileName: 'chapter1.xhtml',
        content: '<h1>Chapter 1</h1><p>This is the first chapter.</p>',
        id: 'chapter1',
        mediaType: 'application/xhtml+xml',
        properties: ['nav']
      });
      logOperation(`✅ Created text item: ${textItem.id}`);

      // READ - Load manifest
      manifestItems = await manifestManager.loadManifest(workspaceId);
      logOperation(`📖 Loaded ${manifestItems.length} manifest items`);

      // UPDATE - Modify an item
      if (manifestItems.length > 0) {
        const itemToUpdate = manifestItems[0];
        await manifestManager.updateManifestItem(workspaceId, itemToUpdate.id, {
          properties: ['nav', 'mathml']
        });
        logOperation(`🔄 Updated item: ${itemToUpdate.id}`);
      }

      // DELETE - Remove an item (we'll create a temporary one first)
      const tempItem = await manifestManager.createTextItem(workspaceId, {
        fileName: 'temp.xhtml',
        content: '<p>Temporary content</p>',
        id: 'temp-item'
      });
      logOperation(`➕ Created temporary item: ${tempItem.id}`);
      
      await manifestManager.deleteManifestItem(workspaceId, tempItem.id);
      logOperation(`🗑️ Deleted temporary item: ${tempItem.id}`);

      // Refresh manifest
      manifestItems = await manifestManager.loadManifest(workspaceId);
      
    } catch (err) {
      logOperation(`❌ CRUD operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Demonstrate file upload
  async function demonstrateFileUpload() {
    logOperation('📁 === File Upload Demo ===');
    
    try {
      // Create a mock file for demonstration
      const mockContent = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
      const mockFile = new File([mockContent], 'demo-image.png', { type: 'image/png' });
      
      logOperation(`📤 Uploading file: ${mockFile.name} (${mockFile.size} bytes)`);
      
      const uploadedItem = await manifestManager.createFileItem(workspaceId, mockFile);
      logOperation(`✅ File uploaded successfully: ${uploadedItem.id}`);
      logOperation(`   - Href: ${uploadedItem.href}`);
      logOperation(`   - Media Type: ${uploadedItem.mediaType}`);
      logOperation(`   - Size: ${uploadedItem.size} bytes`);

      // Import file demonstration
      const importContent = new TextEncoder().encode('/* Demo CSS content */\nbody { font-family: serif; }');
      const importedItem = await manifestManager.importFileItem(workspaceId, 'OEBPS/styles/demo.css', importContent.buffer);
      logOperation(`📥 Imported file: ${importedItem.id}`);

      // Refresh manifest
      manifestItems = await manifestManager.loadManifest(workspaceId);
      
    } catch (err) {
      logOperation(`❌ File upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Demonstrate validation
  async function demonstrateValidation() {
    logOperation('🔍 === Validation Demo ===');
    
    try {
      // Run manifest validation
      validationResults = await manifestManager.validateManifest(workspaceId);
      logOperation(`🔍 Validation completed: ${validationResults.length} issues found`);
      
      if (validationResults.length === 0) {
        logOperation('✅ No validation errors - manifest is valid');
      } else {
        validationResults.forEach((result, index) => {
          const icon = result.severity === 'error' ? '❌' : '⚠️';
          logOperation(`${icon} ${result.field}: ${result.message}`);
        });
      }

      // Demonstrate validation of invalid item
      try {
        await manifestManager.updateManifestItem(workspaceId, 'nonexistent-item', {
          href: 'invalid-path'
        });
      } catch (validationError) {
        logOperation(`🛡️ Validation correctly prevented invalid update: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`);
      }
      
    } catch (err) {
      logOperation(`❌ Validation demo failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Demonstrate content operations
  async function demonstrateContentOperations() {
    logOperation('📄 === Content Operations Demo ===');
    
    try {
      if (manifestItems.length > 0) {
        const testItem = manifestItems[0];
        
        // Read content
        logOperation(`📖 Reading content for: ${testItem.id}`);
        const content = await manifestManager.getItemContent(workspaceId, testItem.id);
        const contentSize = typeof content === 'string' ? content.length : content.byteLength;
        logOperation(`✅ Content loaded: ${contentSize} ${typeof content === 'string' ? 'characters' : 'bytes'}`);

        // Generate content preview
        logOperation(`🖼️ Generating content preview for: ${testItem.id}`);
        contentPreview = await manifestManager.getContentPreview(workspaceId, testItem.id);
        logOperation(`✅ Preview generated: ${contentPreview.contentType} content`);
        
        if (contentPreview.metadata) {
          Object.entries(contentPreview.metadata).forEach(([key, value]) => {
            logOperation(`   - ${key}: ${value}`);
          });
        }

        // Update content
        const newContent = typeof content === 'string' 
          ? content + '\n<!-- Updated by ManifestManager demo -->'
          : content;
        
        await manifestManager.setItemContent(workspaceId, testItem.id, newContent);
        logOperation(`✅ Content updated for: ${testItem.id}`);

        selectedItem = testItem;
      }
      
    } catch (err) {
      logOperation(`❌ Content operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Demonstrate advanced features
  async function demonstrateAdvancedFeatures() {
    logOperation('🚀 === Advanced Features Demo ===');
    
    try {
      // Check advanced mode
      const isAdvancedMode = await manifestManager.isAdvancedModeEnabled(workspaceId);
      logOperation(`🔧 Advanced mode: ${isAdvancedMode ? 'enabled' : 'disabled'}`);

      if (isAdvancedMode) {
        const sourceItems = await manifestManager.listSourceItems(workspaceId);
        logOperation(`📁 Found ${sourceItems.length} SOURCE items`);
      }

      // Media type detection
      const detectedType = manifestManager.detectMediaType('test.mp4');
      logOperation(`🎯 Media type detection: test.mp4 → ${detectedType}`);

      // ID generation
      const generatedId = manifestManager.generateItemId('My Test File.xhtml');
      logOperation(`🆔 ID generation: 'My Test File.xhtml' → '${generatedId}'`);

      // Manifest ordering
      const currentOrder = await manifestManager.getManifestOrder(workspaceId);
      logOperation(`📋 Current manifest order: [${currentOrder.join(', ')}]`);

      // Cache operations
      logOperation('🗄️ Demonstrating cache operations...');
      manifestManager.clearContentCache(workspaceId);
      logOperation('✅ Content cache cleared');
      
      await manifestManager.preloadManifest(workspaceId);
      logOperation('✅ Manifest preloaded into cache');

    } catch (err) {
      logOperation(`❌ Advanced features demo failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Utility functions
  function logOperation(message: string) {
    operationLog = [...operationLog, `[${new Date().toLocaleTimeString()}] ${message}`];
    operationCount++;
    
    // Keep log size manageable
    if (operationLog.length > 100) {
      operationLog = operationLog.slice(-50);
    }
  }

  function clearLog() {
    operationLog = [];
    operationCount = 0;
  }

  function downloadLog() {
    const logContent = operationLog.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manifest-manager-demo-log.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Initialize on mount
  onMount(initializeDemo);

  // Expose demo functions for manual control
  if (typeof window !== 'undefined') {
    (window as any).manifestManagerDemo = {
      runAllDemos,
      demonstrateCRUDOperations,
      demonstrateFileUpload,
      demonstrateValidation,
      demonstrateContentOperations,
      demonstrateAdvancedFeatures,
      clearLog,
      downloadLog
    };
  }
</script>

<div class="manifest-manager-demo">
  {#if error}
    <div class="demo-error">
      <h2>Demo Error</h2>
      <p>{error}</p>
      <button type="button" on:click={initializeDemo}>Retry Initialization</button>
    </div>
  {:else if !initialized}
    <div class="demo-loading">
      <h2>Initializing ManifestManager Backend Demo</h2>
      <p>{currentOperation || 'Setting up backend services...'}</p>
      <div class="loading-spinner"></div>
    </div>
  {:else}
    <div class="demo-interface">
      <!-- Header -->
      <div class="demo-header">
        <h1>ManifestManager Backend Demo</h1>
        <p>Interactive demonstration of the ManifestManager API with real backend integration</p>
        
        <div class="demo-controls">
          <button type="button" on:click={runAllDemos} class="primary">
            🔄 Run All Demos
          </button>
          <button type="button" on:click={clearLog} class="secondary">
            🗑️ Clear Log
          </button>
          <button type="button" on:click={downloadLog} class="secondary">
            💾 Download Log
          </button>
        </div>
      </div>

      <!-- Main content -->
      <div class="demo-content">
        <!-- Operation log -->
        <div class="operation-log">
          <div class="log-header">
            <h3>Operation Log</h3>
            <span class="operation-count">{operationCount} operations</span>
          </div>
          
          <div class="log-content">
            {#each operationLog as logEntry (logEntry)}
              <div class="log-entry" class:error={logEntry.includes('❌')} class:success={logEntry.includes('✅')}>
                {logEntry}
              </div>
            {/each}
            
            {#if currentOperation}
              <div class="log-entry current">
                <span class="spinner">⏳</span> {currentOperation}
              </div>
            {/if}
          </div>
        </div>

        <!-- Data panels -->
        {#if showDetails}
          <div class="data-panels">
            <!-- Manifest items -->
            <div class="data-panel">
              <h3>Manifest Items ({manifestItems.length})</h3>
              <div class="item-list">
                {#each manifestItems as item (item.id)}
                  <div 
                    class="item-card" 
                    class:selected={selectedItem?.id === item.id}
                    on:click={() => selectedItem = item}
                    role="button"
                    tabindex="0"
                  >
                    <div class="item-header">
                      <span class="item-id">{item.id}</span>
                      <span class="item-size">{(item.size || 0) > 0 ? `${(item.size / 1024).toFixed(1)}KB` : '-'}</span>
                    </div>
                    <div class="item-details">
                      <div class="item-href">{item.href}</div>
                      <div class="item-type">{item.mediaType}</div>
                      {#if item.properties && item.properties.length > 0}
                        <div class="item-properties">
                          {#each item.properties as property}
                            <span class="property-tag">{property}</span>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
                
                {#if manifestItems.length === 0}
                  <div class="empty-state">
                    <p>No manifest items yet. Run the demos to create some.</p>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Validation results -->
            <div class="data-panel">
              <h3>Validation Results</h3>
              <div class="validation-list">
                {#each validationResults as result (result.field + result.message)}
                  <div class="validation-item" class:error={result.severity === 'error'} class:warning={result.severity === 'warning'}>
                    <div class="validation-header">
                      <span class="validation-icon">
                        {result.severity === 'error' ? '❌' : '⚠️'}
                      </span>
                      <span class="validation-field">{result.field}</span>
                      {#if result.itemId}
                        <span class="validation-item-id">({result.itemId})</span>
                      {/if}
                    </div>
                    <div class="validation-message">{result.message}</div>
                  </div>
                {/each}
                
                {#if validationResults.length === 0}
                  <div class="validation-success">
                    <span class="success-icon">✅</span>
                    <span>No validation issues found</span>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Content preview -->
            {#if selectedItem && contentPreview}
              <div class="data-panel">
                <h3>Content Preview: {selectedItem.id}</h3>
                <div class="preview-content">
                  <div class="preview-meta">
                    <span>Type: {contentPreview.contentType}</span>
                    <span>Media: {contentPreview.mediaType}</span>
                  </div>
                  
                  {#if contentPreview.textContent}
                    <pre class="preview-text">{contentPreview.textContent}</pre>
                  {:else if contentPreview.previewUrl}
                    <div class="preview-media">
                      {#if contentPreview.contentType === 'image'}
                        <img src={contentPreview.previewUrl} alt="Preview" />
                      {:else if contentPreview.contentType === 'audio'}
                        <audio controls>
                          <source src={contentPreview.previewUrl} type={contentPreview.mediaType} />
                        </audio>
                      {:else if contentPreview.contentType === 'video'}
                        <video controls>
                          <source src={contentPreview.previewUrl} type={contentPreview.mediaType} />
                        </video>
                      {/if}
                    </div>
                  {:else}
                    <div class="preview-placeholder">
                      <span>Preview not available for this content type</span>
                    </div>
                  {/if}
                  
                  {#if contentPreview.metadata && Object.keys(contentPreview.metadata).length > 0}
                    <div class="preview-metadata">
                      <h4>Metadata</h4>
                      <dl>
                        {#each Object.entries(contentPreview.metadata) as [key, value]}
                          <dt>{key}</dt>
                          <dd>{value}</dd>
                        {/each}
                      </dl>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Manual controls -->
      <div class="demo-footer">
        <h3>Manual Demo Controls</h3>
        <div class="manual-controls">
          <button type="button" on:click={demonstrateCRUDOperations}>CRUD Operations</button>
          <button type="button" on:click={demonstrateFileUpload}>File Upload</button>
          <button type="button" on:click={demonstrateValidation}>Validation</button>
          <button type="button" on:click={demonstrateContentOperations}>Content Operations</button>
          <button type="button" on:click={demonstrateAdvancedFeatures}>Advanced Features</button>
        </div>
        
        <div class="demo-options">
          <label>
            <input type="checkbox" bind:checked={showDetails} />
            Show data panels
          </label>
          <label>
            <input type="checkbox" bind:checked={autoRun} />
            Auto-run demos on init
          </label>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  @import './manifest-demo.css';

  .manifest-manager-demo {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-surface-primary, #f9fafb);
    font-family: var(--font-family-base, system-ui, sans-serif);
  }

  .demo-header {
    padding: var(--spacing-6, 1.5rem);
    background-color: var(--color-surface-primary, white);
    border-bottom: 1px solid var(--color-border-primary, #e5e7eb);
  }

  .demo-header h1 {
    margin: 0 0 var(--spacing-2, 0.5rem) 0;
    font-size: var(--font-size-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text-primary, #374151);
  }

  .demo-header p {
    margin: 0 0 var(--spacing-4, 1rem) 0;
    color: var(--color-text-secondary, #6b7280);
  }

  .demo-controls {
    display: flex;
    gap: var(--spacing-3, 0.75rem);
    flex-wrap: wrap;
  }

  .demo-controls button {
    padding: var(--spacing-2, 0.5rem) var(--spacing-4, 1rem);
    border-radius: var(--border-radius-md, 0.375rem);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .demo-controls button.primary {
    background-color: var(--color-primary-600, #2563eb);
    color: var(--color-white, white);
    border: 1px solid var(--color-primary-600, #2563eb);
  }

  .demo-controls button.primary:hover {
    background-color: var(--color-primary-700, #1d4ed8);
  }

  .demo-controls button.secondary {
    background-color: var(--color-surface-primary, white);
    color: var(--color-text-secondary, #6b7280);
    border: 1px solid var(--color-border-primary, #d1d5db);
  }

  .demo-controls button.secondary:hover {
    background-color: var(--color-surface-secondary, #f9fafb);
  }

  .demo-content {
    flex: 1;
    display: flex;
    min-height: 0;
    gap: var(--spacing-4, 1rem);
    padding: var(--spacing-4, 1rem);
  }

  .operation-log {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .log-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-3, 0.75rem);
  }

  .log-header h3 {
    margin: 0;
    font-size: var(--font-size-lg, 1.125rem);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text-primary, #374151);
  }

  .operation-count {
    padding: var(--spacing-1, 0.25rem) var(--spacing-2, 0.5rem);
    background-color: var(--color-surface-secondary, #f3f4f6);
    color: var(--color-text-secondary, #6b7280);
    border-radius: var(--border-radius-md, 0.375rem);
    font-size: var(--font-size-xs, 0.75rem);
  }

  .log-content {
    flex: 1;
    background-color: var(--color-surface-primary, white);
    border: 1px solid var(--color-border-primary, #e5e7eb);
    border-radius: var(--border-radius-lg, 0.5rem);
    padding: var(--spacing-4, 1rem);
    overflow-y: auto;
    font-family: var(--font-family-mono, 'Fira Code', monospace);
    font-size: var(--font-size-sm, 0.875rem);
    line-height: 1.5;
  }

  .log-entry {
    margin-bottom: var(--spacing-2, 0.5rem);
    color: var(--color-text-primary, #374151);
  }

  .log-entry.error {
    color: var(--color-error-600, #dc2626);
  }

  .log-entry.success {
    color: var(--color-success-600, #059669);
  }

  .log-entry.current {
    color: var(--color-primary-600, #2563eb);
    font-weight: var(--font-weight-medium, 500);
  }

  .spinner {
    animation: spin 1s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .data-panels {
    width: 24rem;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4, 1rem);
    overflow-y: auto;
  }

  .data-panel {
    background-color: var(--color-surface-primary, white);
    border: 1px solid var(--color-border-primary, #e5e7eb);
    border-radius: var(--border-radius-lg, 0.5rem);
    padding: var(--spacing-4, 1rem);
  }

  .data-panel h3 {
    margin: 0 0 var(--spacing-3, 0.75rem) 0;
    font-size: var(--font-size-base, 1rem);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text-primary, #374151);
  }

  .item-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2, 0.5rem);
    max-height: 16rem;
    overflow-y: auto;
  }

  .item-card {
    padding: var(--spacing-3, 0.75rem);
    border: 1px solid var(--color-border-secondary, #f3f4f6);
    border-radius: var(--border-radius-md, 0.375rem);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .item-card:hover {
    border-color: var(--color-border-primary, #d1d5db);
    background-color: var(--color-surface-secondary, #f9fafb);
  }

  .item-card.selected {
    border-color: var(--color-primary-500, #3b82f6);
    background-color: var(--color-primary-50, #eff6ff);
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-2, 0.5rem);
  }

  .item-id {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text-primary, #374151);
  }

  .item-size {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--color-text-tertiary, #9ca3af);
  }

  .item-details {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--color-text-secondary, #6b7280);
  }

  .item-href {
    font-family: var(--font-family-mono, 'Fira Code', monospace);
    margin-bottom: var(--spacing-1, 0.25rem);
  }

  .item-type {
    font-family: var(--font-family-mono, 'Fira Code', monospace);
    margin-bottom: var(--spacing-1, 0.25rem);
  }

  .item-properties {
    display: flex;
    gap: var(--spacing-1, 0.25rem);
    flex-wrap: wrap;
  }

  .property-tag {
    padding: var(--spacing-1, 0.25rem) var(--spacing-2, 0.5rem);
    background-color: var(--color-primary-100, #dbeafe);
    color: var(--color-primary-700, #1d4ed8);
    border-radius: var(--border-radius-sm, 0.25rem);
    font-size: var(--font-size-xs, 0.75rem);
  }

  .validation-list {
    max-height: 12rem;
    overflow-y: auto;
  }

  .validation-item {
    padding: var(--spacing-3, 0.75rem);
    margin-bottom: var(--spacing-2, 0.5rem);
    border-radius: var(--border-radius-md, 0.375rem);
    border-left: 4px solid var(--color-border-primary, #e5e7eb);
  }

  .validation-item.error {
    border-left-color: var(--color-error-500, #ef4444);
    background-color: var(--color-error-50, #fef2f2);
  }

  .validation-item.warning {
    border-left-color: var(--color-warning-500, #f59e0b);
    background-color: var(--color-warning-50, #fffbeb);
  }

  .validation-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-2, 0.5rem);
    margin-bottom: var(--spacing-1, 0.25rem);
  }

  .validation-field {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text-primary, #374151);
  }

  .validation-item-id {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--color-text-tertiary, #9ca3af);
  }

  .validation-message {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--color-text-secondary, #6b7280);
  }

  .validation-success {
    display: flex;
    align-items: center;
    gap: var(--spacing-2, 0.5rem);
    padding: var(--spacing-3, 0.75rem);
    background-color: var(--color-success-50, #f0fdf4);
    border-radius: var(--border-radius-md, 0.375rem);
    color: var(--color-success-700, #047857);
  }

  .preview-content {
    font-size: var(--font-size-sm, 0.875rem);
  }

  .preview-meta {
    display: flex;
    gap: var(--spacing-4, 1rem);
    margin-bottom: var(--spacing-3, 0.75rem);
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--color-text-secondary, #6b7280);
  }

  .preview-text {
    background-color: var(--color-surface-secondary, #f9fafb);
    border: 1px solid var(--color-border-primary, #e5e7eb);
    border-radius: var(--border-radius-md, 0.375rem);
    padding: var(--spacing-3, 0.75rem);
    max-height: 8rem;
    overflow: auto;
    font-family: var(--font-family-mono, 'Fira Code', monospace);
    font-size: var(--font-size-xs, 0.75rem);
    line-height: 1.4;
    white-space: pre-wrap;
  }

  .preview-media {
    text-align: center;
  }

  .preview-media img {
    max-width: 100%;
    max-height: 8rem;
    border-radius: var(--border-radius-md, 0.375rem);
  }

  .preview-media audio,
  .preview-media video {
    max-width: 100%;
  }

  .preview-placeholder {
    padding: var(--spacing-6, 1.5rem);
    text-align: center;
    color: var(--color-text-tertiary, #9ca3af);
    background-color: var(--color-surface-secondary, #f9fafb);
    border-radius: var(--border-radius-md, 0.375rem);
  }

  .preview-metadata {
    margin-top: var(--spacing-3, 0.75rem);
    padding-top: var(--spacing-3, 0.75rem);
    border-top: 1px solid var(--color-border-secondary, #f3f4f6);
  }

  .preview-metadata h4 {
    margin: 0 0 var(--spacing-2, 0.5rem) 0;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text-primary, #374151);
  }

  .preview-metadata dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--spacing-1, 0.25rem) var(--spacing-3, 0.75rem);
    font-size: var(--font-size-xs, 0.75rem);
  }

  .preview-metadata dt {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text-secondary, #6b7280);
  }

  .preview-metadata dd {
    margin: 0;
    color: var(--color-text-primary, #374151);
  }

  .demo-footer {
    padding: var(--spacing-4, 1rem);
    background-color: var(--color-surface-primary, white);
    border-top: 1px solid var(--color-border-primary, #e5e7eb);
  }

  .demo-footer h3 {
    margin: 0 0 var(--spacing-3, 0.75rem) 0;
    font-size: var(--font-size-base, 1rem);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text-primary, #374151);
  }

  .manual-controls {
    display: flex;
    gap: var(--spacing-2, 0.5rem);
    flex-wrap: wrap;
    margin-bottom: var(--spacing-4, 1rem);
  }

  .manual-controls button {
    padding: var(--spacing-1, 0.25rem) var(--spacing-3, 0.75rem);
    background-color: var(--color-surface-primary, white);
    color: var(--color-text-secondary, #6b7280);
    border: 1px solid var(--color-border-primary, #d1d5db);
    border-radius: var(--border-radius-md, 0.375rem);
    font-size: var(--font-size-sm, 0.875rem);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .manual-controls button:hover {
    background-color: var(--color-surface-secondary, #f9fafb);
    color: var(--color-text-primary, #374151);
  }

  .demo-options {
    display: flex;
    gap: var(--spacing-4, 1rem);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .demo-options label {
    display: flex;
    align-items: center;
    gap: var(--spacing-2, 0.5rem);
    color: var(--color-text-secondary, #6b7280);
    cursor: pointer;
  }

  .empty-state {
    padding: var(--spacing-4, 1rem);
    text-align: center;
    color: var(--color-text-tertiary, #9ca3af);
    font-style: italic;
  }

  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--color-surface-secondary, #f3f4f6);
    border-top: 3px solid var(--color-primary-500, #3b82f6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: var(--spacing-4, 1rem) auto;
  }

  /* Responsive adjustments */
  @media (max-width: 1024px) {
    .demo-content {
      flex-direction: column;
    }
    
    .data-panels {
      width: 100%;
      flex-direction: row;
      overflow-x: auto;
    }
    
    .data-panel {
      flex: 0 0 20rem;
    }
  }

  @media (max-width: 768px) {
    .demo-controls {
      flex-direction: column;
    }
    
    .data-panels {
      flex-direction: column;
    }
    
    .data-panel {
      flex: none;
    }
    
    .manual-controls {
      flex-direction: column;
    }
    
    .demo-options {
      flex-direction: column;
      gap: var(--spacing-2, 0.5rem);
    }
  }
</style>