<script lang="ts">
  import { onMount } from 'svelte';
  import { WorkspaceManager } from '../lib/workspace/index.js';
  import './workspace-opf-demo.css';
  
  interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'action' | 'warning';
    message: string;
  }

  let workspaceManager: WorkspaceManager;
  let initialized = false;
  let error: string | null = null;
  let workspaces: any[] = [];
  let selectedWorkspace: any = null;
  let opfDocument: any = null;
  let validationResult: any = null;
  let workspacePreview: any = null;
  let cacheStats: any = null;
  let logs: LogEntry[] = [];
  let isLoading = false;
  
  // Demo data
  const sampleMetadata = {
    title: 'Interactive EPUB Demo',
    language: 'en',
    identifier: 'demo-epub-' + Date.now(),
    creator: ['Demo Author'],
    publisher: 'Storybook Demo',
    description: 'A sample EPUB created for demonstration purposes'
  };

  const sampleChapters = [
    { title: 'Introduction', href: 'OEBPS/Text/intro.xhtml' },
    { title: 'Chapter 1: Getting Started', href: 'OEBPS/Text/chapter1.xhtml' },
    { title: 'Chapter 2: Advanced Features', href: 'OEBPS/Text/chapter2.xhtml' },
    { title: 'Conclusion', href: 'OEBPS/Text/conclusion.xhtml' }
  ];

  const sampleResources = [
    { href: 'OEBPS/Styles/main.css', mediaType: 'text/css' },
    { href: 'OEBPS/Images/cover.jpg', mediaType: 'image/jpeg' },
    { href: 'OEBPS/Images/diagram.png', mediaType: 'image/png' },
    { href: 'OEBPS/Fonts/SourceSans.ttf', mediaType: 'font/ttf' }
  ];

  function addLog(message: string, type: LogEntry['type'] = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, { timestamp, message, type }];
    if (logs.length > 50) {
      logs = logs.slice(-50);
    }
  }

  async function initializeDemo() {
    try {
      isLoading = true;
      addLog('Initializing Workspace Manager...', 'action');
      workspaceManager = new WorkspaceManager({
        cache: { ttl: 5 * 60 * 1000, maxEntries: 10, enableDiskCache: true },
        validation: { strict: false, checkDependencies: true, allowOrphanedFiles: true }
      });
      
      await workspaceManager.init();
      initialized = true;
      addLog('✅ Workspace Manager initialized successfully', 'success');
      
      await refreshWorkspaceList();
    } catch (err: any) {
      error = err.message;
      addLog(`❌ Initialization failed: ${err.message}`, 'error');
    } finally {
      isLoading = false;
    }
  }

  async function refreshWorkspaceList() {
    try {
      workspaces = await workspaceManager.listWorkspacesWithMetadata();
      addLog(`📋 Found ${workspaces.length} workspaces`, 'info');
      
      // Update cache stats if available
      if ((workspaceManager as any).cache) {
        cacheStats = (workspaceManager as any).cache.getCacheStats();
      }
    } catch (err: any) {
      addLog(`❌ Failed to list workspaces: ${err.message}`, 'error');
    }
  }

  async function createSampleWorkspace() {
    if (!workspaceManager || isLoading) return;
    
    try {
      isLoading = true;
      addLog('🏗️ Creating sample EPUB workspace...', 'action');
      const workspaceId = await workspaceManager.createEPUBWorkspace(sampleMetadata);
      addLog(`✅ Created workspace: ${workspaceId}`, 'success');
      
      // Add sample chapters to manifest and spine
      addLog('📄 Adding sample chapters...', 'action');
      for (const chapter of sampleChapters) {
        await workspaceManager.addManifestItem(workspaceId, {
          href: chapter.href,
          mediaType: 'application/xhtml+xml'
        });
        addLog(`📄 Added chapter: ${chapter.title}`, 'info');
      }
      
      // Add resources
      addLog('📎 Adding sample resources...', 'action');
      for (const resource of sampleResources) {
        await workspaceManager.addManifestItem(workspaceId, resource);
        addLog(`📎 Added resource: ${resource.href}`, 'info');
      }
      
      // Update spine order
      const updatedOpf = await workspaceManager.getWorkspaceOPF(workspaceId);
      const chapterIds = updatedOpf.manifest
        .filter((item: any) => item.mediaType === 'application/xhtml+xml')
        .map((item: any) => item.id);
      
      await workspaceManager.updateSpineOrder(workspaceId, chapterIds);
      addLog(`📖 Updated spine order with ${chapterIds.length} chapters`, 'success');
      
      await refreshWorkspaceList();
    } catch (err: any) {
      addLog(`❌ Failed to create workspace: ${err.message}`, 'error');
    } finally {
      isLoading = false;
    }
  }

  async function selectWorkspace(workspace: any) {
    if (!workspaceManager || isLoading) return;
    
    try {
      isLoading = true;
      selectedWorkspace = workspace;
      addLog(`🔍 Switching to workspace: ${workspace.title}`, 'action');
      
      // Load OPF document
      opfDocument = await workspaceManager.getWorkspaceOPF(workspace.id);
      addLog(`📋 Loaded OPF with ${opfDocument.manifest.length} items`, 'success');
      
      // Validate workspace structure
      validationResult = await workspaceManager.validateWorkspaceStructure(workspace.id);
      const status = validationResult.isValid ? '✅ Valid' : '⚠️ Issues found';
      addLog(`🔍 Validation: ${status} (${validationResult.errors.length} errors, ${validationResult.warnings.length} warnings)`, 
             validationResult.isValid ? 'success' : 'warning');
      
      // Generate preview
      workspacePreview = await workspaceManager.generateWorkspacePreview(workspace.id);
      addLog(`📊 Generated preview: ${workspacePreview.estimatedEPUBSize} bytes estimated`, 'success');
      
    } catch (err: any) {
      addLog(`❌ Failed to load workspace: ${err.message}`, 'error');
    } finally {
      isLoading = false;
    }
  }

  async function updateMetadata() {
    if (!selectedWorkspace || !opfDocument || !workspaceManager) return;
    
    try {
      isLoading = true;
      const newMetadata = {
        ...opfDocument.metadata,
        title: opfDocument.metadata.title + ' (Updated)',
        modifiedDate: new Date().toISOString()
      };
      
      await workspaceManager.updateMetadata(selectedWorkspace.id, newMetadata);
      addLog(`✏️ Updated metadata for: ${selectedWorkspace.title}`, 'success');
      
      // Refresh the OPF document
      opfDocument = await workspaceManager.getWorkspaceOPF(selectedWorkspace.id);
      await refreshWorkspaceList();
    } catch (err: any) {
      addLog(`❌ Failed to update metadata: ${err.message}`, 'error');
    } finally {
      isLoading = false;
    }
  }

  async function deleteWorkspace(workspaceId: string) {
    if (!workspaceManager) return;
    
    try {
      isLoading = true;
      await workspaceManager.deleteWorkspace(workspaceId);
      addLog(`🗑️ Deleted workspace: ${workspaceId}`, 'success');
      
      if (selectedWorkspace?.id === workspaceId) {
        selectedWorkspace = null;
        opfDocument = null;
        validationResult = null;
        workspacePreview = null;
      }
      
      await refreshWorkspaceList();
    } catch (err: any) {
      addLog(`❌ Failed to delete workspace: ${err.message}`, 'error');
    } finally {
      isLoading = false;
    }
  }

  function clearLogs() {
    logs = [];
  }

  // Helper functions for display
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  function formatDate(date: string | Date): string {
    return new Date(date).toLocaleString();
  }

  onMount(() => {
    initializeDemo();
  });
</script>

<div class="workspace-opf-demo">
  <div class="demo-header">
    <h1>🏗️ Workspace & OPF Manager Demo</h1>
    <p>Interactive demonstration of EPUB workspace management backend functionality</p>
    
    {#if !initialized && !error}
      <div class="loading">
        <div class="spinner"></div>
        <p>Initializing workspace manager...</p>
      </div>
    {/if}

    {#if error}
      <div class="error">
        <strong>❌ Error:</strong> {error}
      </div>
    {/if}
  </div>

  {#if initialized}
    <div class="demo-content">
      <!-- Workspace Management Panel -->
      <div class="panel">
        <div class="panel-header">
          <h2>📚 Workspace Management</h2>
          <div class="panel-actions">
            <button on:click={createSampleWorkspace} class="btn btn-primary" disabled={isLoading}>
              {isLoading ? '⏳' : '➕'} Create Sample Workspace
            </button>
            <button on:click={refreshWorkspaceList} class="btn btn-secondary" disabled={isLoading}>
              🔄 Refresh
            </button>
          </div>
        </div>
        
        <div class="workspace-list">
          {#if workspaces.length === 0}
            <div class="empty-state">
              <p>No workspaces found. Create a sample workspace to get started!</p>
            </div>
          {:else}
            {#each workspaces as workspace}
              <div class="workspace-item" class:selected={selectedWorkspace?.id === workspace.id}>
                <div class="workspace-info" on:click={() => selectWorkspace(workspace)} on:keydown={() => {}}>
                  <h3>{workspace.title}</h3>
                  <div class="workspace-meta">
                    <span>👤 {workspace.author || 'Unknown Author'}</span>
                    <span>🌐 {workspace.language}</span>
                    <span>📄 {workspace.fileCount} files</span>
                    <span>💾 {formatFileSize(workspace.totalSize)}</span>
                    <span>📅 {formatDate(workspace.lastModified)}</span>
                  </div>
                  {#if workspace.hasError}
                    <div class="workspace-error">⚠️ Workspace has validation errors</div>
                  {/if}
                </div>
                <button 
                  on:click|stopPropagation={() => deleteWorkspace(workspace.id)} 
                  class="btn btn-danger btn-small"
                  disabled={isLoading}
                >
                  🗑️
                </button>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Selected Workspace Details -->
      {#if selectedWorkspace}
        <div class="workspace-details">
          <!-- OPF Document Panel -->
          <div class="panel">
            <div class="panel-header">
              <h2>📋 OPF Document</h2>
              <button on:click={updateMetadata} class="btn btn-secondary" disabled={isLoading}>
                ✏️ Update Metadata
              </button>
            </div>
            
            {#if opfDocument}
              <div class="opf-content">
                <div class="metadata-section">
                  <h3>📝 Metadata</h3>
                  <div class="metadata-grid">
                    <div><strong>Title:</strong> {opfDocument.metadata.title}</div>
                    <div><strong>Language:</strong> {opfDocument.metadata.language}</div>
                    <div><strong>Identifier:</strong> {opfDocument.metadata.identifier}</div>
                    <div><strong>Creator:</strong> {opfDocument.metadata.creator?.join(', ') || 'N/A'}</div>
                    {#if opfDocument.metadata.publisher}
                      <div><strong>Publisher:</strong> {opfDocument.metadata.publisher}</div>
                    {/if}
                    {#if opfDocument.metadata.modifiedDate}
                      <div><strong>Modified:</strong> {formatDate(opfDocument.metadata.modifiedDate)}</div>
                    {/if}
                  </div>
                </div>

                <div class="manifest-section">
                  <h3>📦 Manifest ({opfDocument.manifest.length} items)</h3>
                  <div class="manifest-list">
                    {#each opfDocument.manifest as item}
                      <div class="manifest-item">
                        <span class="manifest-id">{item.id}</span>
                        <span class="manifest-href">{item.href}</span>
                        <span class="manifest-type">{item.mediaType}</span>
                        {#if item.properties}
                          <span class="manifest-props">{item.properties}</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>

                <div class="spine-section">
                  <h3>📖 Spine ({opfDocument.spine.length} items)</h3>
                  <div class="spine-list">
                    {#each opfDocument.spine as item, index}
                      <div class="spine-item">
                        <span class="spine-order">{index + 1}.</span>
                        <span class="spine-idref">{item.idref}</span>
                        <span class="spine-linear">{item.linear ? '📖' : '🔗'}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <!-- Validation Results Panel -->
          {#if validationResult}
            <div class="panel">
              <div class="panel-header">
                <h2>🔍 Validation Results</h2>
                <div class="validation-status" class:valid={validationResult.isValid} class:invalid={!validationResult.isValid}>
                  {validationResult.isValid ? '✅ Valid' : '⚠️ Issues Found'}
                </div>
              </div>
              
              <div class="validation-content">
                <div class="validation-summary">
                  <div class="summary-item">
                    <strong>Total Files:</strong> {validationResult.summary.totalFiles}
                  </div>
                  <div class="summary-item">
                    <strong>Valid Files:</strong> {validationResult.summary.validFiles}
                  </div>
                  <div class="summary-item">
                    <strong>Missing Files:</strong> {validationResult.summary.missingFiles}
                  </div>
                  <div class="summary-item">
                    <strong>Orphaned Files:</strong> {validationResult.summary.orphanedFiles}
                  </div>
                </div>

                {#if validationResult.errors.length > 0}
                  <div class="validation-errors">
                    <h4>❌ Errors ({validationResult.errors.length})</h4>
                    {#each validationResult.errors as errorItem}
                      <div class="validation-error">
                        <span class="error-code">{errorItem.code}</span>
                        <span class="error-message">{errorItem.message}</span>
                        {#if errorItem.file}
                          <span class="error-file">{errorItem.file}</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}

                {#if validationResult.warnings.length > 0}
                  <div class="validation-warnings">
                    <h4>⚠️ Warnings ({validationResult.warnings.length})</h4>
                    {#each validationResult.warnings as warning}
                      <div class="validation-warning">
                        <span class="warning-code">{warning.code}</span>
                        <span class="warning-message">{warning.message}</span>
                        {#if warning.file}
                          <span class="warning-file">{warning.file}</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Workspace Preview Panel -->
          {#if workspacePreview}
            <div class="panel">
              <div class="panel-header">
                <h2>📊 Workspace Preview</h2>
              </div>
              
              <div class="preview-content">
                <div class="preview-stats">
                  <div class="stat-item">
                    <strong>Estimated EPUB Size:</strong> {formatFileSize(workspacePreview.estimatedEPUBSize)}
                  </div>
                </div>

                <div class="manifest-summary">
                  <h4>📦 Content Summary</h4>
                  <div class="content-types">
                    <div class="content-type">
                      <span class="type-icon">📄</span>
                      <span class="type-label">Text Items:</span>
                      <span class="type-count">{workspacePreview.manifestSummary.textItems}</span>
                    </div>
                    <div class="content-type">
                      <span class="type-icon">🖼️</span>
                      <span class="type-label">Images:</span>
                      <span class="type-count">{workspacePreview.manifestSummary.imageItems}</span>
                    </div>
                    <div class="content-type">
                      <span class="type-icon">🎵</span>
                      <span class="type-label">Audio:</span>
                      <span class="type-count">{workspacePreview.manifestSummary.audioItems}</span>
                    </div>
                    <div class="content-type">
                      <span class="type-icon">🎬</span>
                      <span class="type-label">Video:</span>
                      <span class="type-count">{workspacePreview.manifestSummary.videoItems}</span>
                    </div>
                    <div class="content-type">
                      <span class="type-icon">🔤</span>
                      <span class="type-label">Fonts:</span>
                      <span class="type-count">{workspacePreview.manifestSummary.fontItems}</span>
                    </div>
                    <div class="content-type">
                      <span class="type-icon">📎</span>
                      <span class="type-label">Other:</span>
                      <span class="type-count">{workspacePreview.manifestSummary.otherItems}</span>
                    </div>
                  </div>
                </div>

                <div class="spine-preview">
                  <h4>📖 Reading Order</h4>
                  <div class="spine-order">
                    {#each workspacePreview.spineOrder as itemId, index}
                      <span class="spine-item-preview">{index + 1}. {itemId}</span>
                    {/each}
                  </div>
                </div>

                {#if workspacePreview.dependencies.orphanedFiles.length > 0 || workspacePreview.dependencies.missingDependencies.length > 0}
                  <div class="dependency-issues">
                    <h4>🔗 Dependency Issues</h4>
                    {#if workspacePreview.dependencies.orphanedFiles.length > 0}
                      <div class="orphaned-files">
                        <strong>Orphaned Files ({workspacePreview.dependencies.orphanedFiles.length}):</strong>
                        {#each workspacePreview.dependencies.orphanedFiles as file}
                          <span class="orphaned-file">{file}</span>
                        {/each}
                      </div>
                    {/if}
                    {#if workspacePreview.dependencies.missingDependencies.length > 0}
                      <div class="missing-deps">
                        <strong>Missing Dependencies ({workspacePreview.dependencies.missingDependencies.length}):</strong>
                        {#each workspacePreview.dependencies.missingDependencies as dep}
                          <span class="missing-dep">{dep}</span>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Cache Stats Panel -->
      {#if cacheStats}
        <div class="panel">
          <div class="panel-header">
            <h2>💾 Cache Statistics</h2>
          </div>
          <div class="cache-stats">
            <div class="cache-stat">
              <strong>Memory Entries:</strong> {cacheStats.memoryEntries} / {cacheStats.maxEntries}
            </div>
            {#if cacheStats.cacheHitRate !== undefined}
              <div class="cache-stat">
                <strong>Hit Rate:</strong> {(cacheStats.cacheHitRate * 100).toFixed(1)}%
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Activity Log Panel -->
      <div class="panel">
        <div class="panel-header">
          <h2>📝 Activity Log</h2>
          <button on:click={clearLogs} class="btn btn-secondary btn-small">
            🗑️ Clear
          </button>
        </div>
        <div class="activity-log">
          {#each logs.slice().reverse() as log}
            <div class="log-entry log-{log.type}">
              <span class="log-time">[{log.timestamp}]</span>
              <span class="log-message">{log.message}</span>
            </div>
          {/each}
          {#if logs.length === 0}
            <div class="empty-log">No activity yet...</div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>