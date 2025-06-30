<script lang="ts">
  import { onMount } from 'svelte';
  import { FileStorageAPI } from '$lib/storage';
  import { SourceManager } from '$lib/source';
  import { DEFAULT_SOURCE_SETTINGS } from '$lib/source';
  import { EPUBPackager, EPUBUnpacker } from '$lib/epub';
  import { OPFUtils } from '$lib/epub';
  import type { EPUBMetadata } from '$lib/epub';
  import './epub-source-integration-demo.css';

  interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'action';
    message: string;
  }

  // Component state
  let fileStorage: FileStorageAPI;
  let sourceManager: SourceManager;
  let epubPackager: EPUBPackager;
  let epubUnpacker: EPUBUnpacker;
  let logs: LogEntry[] = [];
  let isLoading = false;
  let currentWorkspaceId = '';
  let sourceFiles: any[] = [];
  let sourceStats: any = null;
  let validation: any = null;
  let uploadedFile: File | null = null;
  
  // EPUB-specific state
  let epubFiles: string[] = [];
  let epubMetadata: EPUBMetadata | null = null;
  let packagedEPUB: Blob | null = null;
  let epubAnalysis: any = null;
  let unpackedWorkspaceId = '';

  // Initialize storage and EPUB managers
  onMount(async () => {
    try {
      fileStorage = new FileStorageAPI();
      await fileStorage.init();
      sourceManager = new SourceManager(fileStorage);
      epubPackager = new EPUBPackager();
      epubUnpacker = new EPUBUnpacker();
      addLog('success', 'EPUB integration managers initialized');
      
      // Create a demo EPUB workspace
      await createEPUBWorkspace();
    } catch (error: any) {
      addLog('error', `Failed to initialize: ${error.message}`);
    }
  });

  // EPUB Workspace Creation
  async function createEPUBWorkspace() {
    if (!fileStorage || isLoading) return;
    isLoading = true;
    addLog('action', 'Creating demo EPUB workspace...');

    try {
      // Create new workspace
      currentWorkspaceId = await fileStorage.createWorkspace();
      addLog('success', `EPUB workspace created: ${currentWorkspaceId}`);

      // Create EPUB structure
      await createEPUBStructure();
      
      // Initialize SOURCE/ structure
      await sourceManager.initializeSourceStructure(currentWorkspaceId);
      addLog('success', 'SOURCE/ directory structure initialized');

      // Add demo content for both EPUB and SOURCE
      await createDemoContent();
      
      // Refresh all info
      await refreshAllInfo();
    } catch (error: any) {
      addLog('error', `Failed to create EPUB workspace: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  async function createEPUBStructure() {
    if (!currentWorkspaceId) return;
    
    addLog('action', 'Creating EPUB structure...');

    try {
      // Create mimetype
      await fileStorage.writeTextFile(currentWorkspaceId, 'mimetype', 'application/epub+zip');
      
      // Create container.xml
      const containerXML = OPFUtils.generateContainerXML();
      await fileStorage.writeTextFile(currentWorkspaceId, 'META-INF/container.xml', containerXML);
      
      // Create basic OPF with metadata
      const metadata: EPUBMetadata = {
        title: 'Demo EPUB with SOURCE Integration',
        creator: ['EPUB Demo Author'],
        language: 'en',
        identifier: 'demo-epub-' + Date.now(),
        modifiedDate: new Date().toISOString()
      };
      
      const opfDocument = {
        version: '3.0' as const,
        metadata,
        manifest: [
          { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: ['nav'] },
          { id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' },
          { id: 'chapter2', href: 'Text/chapter2.xhtml', mediaType: 'application/xhtml+xml' },
          { id: 'style', href: 'Styles/style.css', mediaType: 'text/css' }
        ],
        spine: [
          { idref: 'nav', linear: true },
          { idref: 'chapter1', linear: true },
          { idref: 'chapter2', linear: true }
        ]
      };
      
      const opfXML = OPFUtils.generateOPFXML(opfDocument);
      await fileStorage.writeTextFile(currentWorkspaceId, 'OEBPS/content.opf', opfXML);
      
      epubMetadata = metadata;
      addLog('success', 'EPUB structure created');
    } catch (error: any) {
      addLog('error', `Failed to create EPUB structure: ${error.message}`);
    }
  }

  async function createDemoContent() {
    if (!currentWorkspaceId) return;
    
    addLog('action', 'Adding demo content to EPUB and SOURCE/...');

    try {
      // Add EPUB content files
      await fileStorage.writeTextFile(currentWorkspaceId, 'OEBPS/nav.xhtml',
        `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body><nav epub:type="toc"><ol>
<li><a href="Text/chapter1.xhtml">Chapter 1</a></li>
<li><a href="Text/chapter2.xhtml">Chapter 2</a></li>
</ol></nav></body></html>`);
      
      await fileStorage.writeTextFile(currentWorkspaceId, 'OEBPS/Text/chapter1.xhtml',
        `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title><link rel="stylesheet" href="../Styles/style.css"/></head>
<body><h1>Chapter 1: Introduction</h1><p>Welcome to the world of EPUB creation with SOURCE integration...</p></body></html>`);
      
      await fileStorage.writeTextFile(currentWorkspaceId, 'OEBPS/Text/chapter2.xhtml',
        `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 2</title><link rel="stylesheet" href="../Styles/style.css"/></head>
<body><h1>Chapter 2: Getting Started</h1><p>Let's begin with the basics of EPUB with SOURCE.zip...</p></body></html>`);
      
      await fileStorage.writeTextFile(currentWorkspaceId, 'OEBPS/Styles/style.css',
        `body { font-family: serif; margin: 2em; }\nh1 { color: #333; border-bottom: 1px solid #ccc; }\np { line-height: 1.6; }`);

      // Add SOURCE/ files
      await fileStorage.writeTextFile(currentWorkspaceId, 'SOURCE/text/chapter1.txt', 
        '# Chapter 1: Introduction\n\nWelcome to the world of EPUB creation with SOURCE integration...');
      await fileStorage.writeTextFile(currentWorkspaceId, 'SOURCE/text/chapter2.txt',
        '# Chapter 2: Getting Started\n\nLet\'s begin with the basics of EPUB with SOURCE.zip...');

      // Add script files
      await fileStorage.writeTextFile(currentWorkspaceId, 'SOURCE/scripts/markdown-transform.js',
        `function transformText(text) {
  return text.replace(/^# (.+)$/gm, '<h1>$1</h1>');
}
module.exports = { transformText };`);

      // Add extension
      await fileStorage.writeTextFile(currentWorkspaceId, 'SOURCE/extensions/highlight/package.json',
        JSON.stringify({ name: 'highlight-js', version: '1.0.0', main: 'index.js' }, null, 2));

      addLog('success', 'Demo content added to both EPUB and SOURCE/ directories');
    } catch (error: any) {
      addLog('error', `Failed to create demo content: ${error.message}`);
    }
  }

  async function packageToEPUB() {
    if (!epubPackager || !currentWorkspaceId || isLoading) return;
    isLoading = true;
    addLog('action', 'Packaging workspace to EPUB (will create SOURCE.zip automatically)...');

    try {
      const result = await epubPackager.packageEPUB(currentWorkspaceId, {
        progressCallback: (progress) => {
          addLog('info', `Packaging progress: ${progress.phase} - ${progress.processedFiles}/${progress.totalFiles} files`);
        }
      });
      
      if (result.success && result.blob) {
        packagedEPUB = result.blob;
        addLog('success', `EPUB packaged successfully (${result.blob.size} bytes, ${result.fileCount} files)`);
        addLog('info', `Compression ratio: ${((1 - result.compressedSize! / result.totalSize!) * 100).toFixed(1)}%`);
        
        // Offer download
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || 'demo-epub.epub';
        a.click();
        URL.revokeObjectURL(url);
        
        addLog('info', 'EPUB download started - contains SOURCE.zip automatically');
        
        // Analyze the created EPUB
        await analyzeEPUB(result.blob);
      } else {
        addLog('error', `EPUB packaging failed: ${result.error}`);
      }
    } catch (error: any) {
      addLog('error', `Failed to package EPUB: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  async function unpackEPUB() {
    if (!epubUnpacker || !uploadedFile || isLoading) return;
    isLoading = true;
    addLog('action', 'Unpacking uploaded EPUB (will extract SOURCE.zip automatically)...');

    try {
      // Create new workspace for unpacked EPUB
      unpackedWorkspaceId = await fileStorage.createWorkspace();
      addLog('info', `Created unpacking workspace: ${unpackedWorkspaceId}`);
      
      const result = await epubUnpacker.unpackEPUB(uploadedFile, unpackedWorkspaceId);
      
      if (result.success) {
        addLog('success', `EPUB unpacked successfully to workspace ${result.workspaceId}`);
        addLog('info', `Extracted ${result.extractedFiles?.length} files, total size: ${result.totalSize} bytes`);
        
        // Check if SOURCE.zip was extracted
        const hasSourceZip = result.extractedFiles?.some(f => f.includes('SOURCE.zip'));
        if (hasSourceZip) {
          addLog('success', 'SOURCE.zip found and automatically extracted to SOURCE/ directory');
        } else {
          addLog('info', 'No SOURCE.zip found in EPUB');
        }
        
        // Switch to unpacked workspace for analysis
        currentWorkspaceId = unpackedWorkspaceId;
        await refreshAllInfo();
        
      } else {
        addLog('error', `EPUB unpacking failed: ${result.error}`);
        await fileStorage.deleteWorkspace(unpackedWorkspaceId);
      }
      
      // Clear uploaded file
      uploadedFile = null;
    } catch (error: any) {
      addLog('error', `Failed to unpack EPUB: ${error.message}`);
      if (unpackedWorkspaceId) {
        await fileStorage.deleteWorkspace(unpackedWorkspaceId);
      }
    } finally {
      isLoading = false;
    }
  }

  async function validateSourceStructure() {
    if (!sourceManager || !currentWorkspaceId || isLoading) return;
    isLoading = true;
    addLog('action', 'Validating SOURCE/ directory structure...');

    try {
      validation = await sourceManager.validateSourceStructure(currentWorkspaceId);
      
      if (validation.isValid) {
        addLog('success', `SOURCE/ structure is valid (${validation.fileCount} files, ${validation.totalSize} bytes)`);
      } else {
        addLog('error', `SOURCE/ validation failed: ${validation.errors.join(', ')}`);
      }
      
      if (validation.warnings.length > 0) {
        addLog('info', `Warnings: ${validation.warnings.join(', ')}`);
      }
    } catch (error: any) {
      addLog('error', `Failed to validate structure: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  async function refreshAllInfo() {
    if (!sourceManager || !currentWorkspaceId) return;
    
    try {
      // Get SOURCE/ file listing
      sourceFiles = await sourceManager.listSourceFiles(currentWorkspaceId);
      
      // Get SOURCE/ statistics
      sourceStats = await sourceManager.getSourceDirectoryStats(currentWorkspaceId);
      
      // Get EPUB files
      const allFiles = await fileStorage.listFiles(currentWorkspaceId);
      epubFiles = allFiles.filter(f => !f.startsWith('SOURCE/'));
      
      addLog('info', `Refreshed workspace info: ${sourceFiles.length} SOURCE files, ${epubFiles.length} EPUB files`);
    } catch (error: any) {
      addLog('error', `Failed to refresh info: ${error.message}`);
    }
  }
  
  async function analyzeEPUB(epubBlob: Blob) {
    if (!epubUnpacker) return;
    
    try {
      addLog('action', 'Analyzing EPUB structure...');
      
      // Convert Blob to File for analysis
      const epubFile = new File([epubBlob], 'analysis.epub', { type: 'application/epub+zip' });
      const analysis = await epubUnpacker.analyzeEPUB(epubFile);
      
      epubAnalysis = analysis;
      
      if (analysis.isValid) {
        addLog('success', `EPUB analysis complete: ${analysis.fileCount} files, ${(analysis.totalSize / 1024).toFixed(1)} KB`);
        
        // Check for SOURCE.zip in file list
        const hasSourceZip = analysis.fileList.includes('OEBPS/SOURCE.zip') || analysis.fileList.includes('SOURCE.zip');
        if (hasSourceZip) {
          addLog('success', '✅ SOURCE.zip found in EPUB manifest');
        } else {
          addLog('info', 'No SOURCE.zip found in EPUB');
        }
      } else {
        addLog('error', `EPUB analysis failed: ${analysis.validation.errors.join(', ')}`);
      }
    } catch (error: any) {
      addLog('error', `Failed to analyze EPUB: ${error.message}`);
    }
  }

  async function resetDemo() {
    if (isLoading) return;
    isLoading = true;
    addLog('action', 'Resetting demo...');

    try {
      // Clear current workspaces
      if (currentWorkspaceId) {
        await fileStorage.deleteWorkspace(currentWorkspaceId);
        addLog('info', 'Previous workspace deleted');
      }
      if (unpackedWorkspaceId && unpackedWorkspaceId !== currentWorkspaceId) {
        await fileStorage.deleteWorkspace(unpackedWorkspaceId);
        addLog('info', 'Unpacked workspace deleted');
      }

      // Reset state
      currentWorkspaceId = '';
      unpackedWorkspaceId = '';
      sourceFiles = [];
      sourceStats = null;
      validation = null;
      uploadedFile = null;
      epubFiles = [];
      epubMetadata = null;
      packagedEPUB = null;
      epubAnalysis = null;
      
      // Create new demo workspace
      await createEPUBWorkspace();
      
      addLog('success', 'Demo reset complete');
    } catch (error: any) {
      addLog('error', `Failed to reset demo: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  function addLog(type: 'info' | 'success' | 'error' | 'action', message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, { timestamp, type, message }];
  }

  function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      uploadedFile = target.files[0];
      const fileType = uploadedFile.name.endsWith('.epub') ? 'EPUB' : 'unknown';
      addLog('info', `${fileType} file selected: ${uploadedFile.name} (${(uploadedFile.size / 1024).toFixed(1)} KB)`);
    }
  }

  function clearLogs() {
    logs = [];
    addLog('info', 'Console cleared');
  }
</script>

<div class="epub-source-integration-demo">
  <div class="demo-header">
    <h2>📚 EPUB with SOURCE.zip Integration Demo</h2>
    <p>Interactive demonstration of complete EPUB workflow with automatic SOURCE.zip management.</p>
  </div>

  <div class="demo-grid">
    <!-- EPUB Operations Panel -->
    <div class="epub-operations-panel">
      <h3>📚 EPUB Operations</h3>
      
      <div class="button-group">
        <button 
          on:click={packageToEPUB} 
          disabled={isLoading || !currentWorkspaceId}
          class="btn-primary"
        >
          📦 Package to EPUB
        </button>
        
        <button 
          on:click={validateSourceStructure} 
          disabled={isLoading || !currentWorkspaceId}
          class="btn-secondary"
        >
          ✅ Validate Workspace
        </button>
        
        <button 
          on:click={refreshAllInfo} 
          disabled={isLoading || !currentWorkspaceId}
          class="btn-secondary"
        >
          🔄 Refresh Info
        </button>
      </div>

      <div class="upload-section">
        <h4>📤 Upload EPUB File</h4>
        <input 
          type="file" 
          accept=".epub" 
          on:change={handleFileUpload}
          disabled={isLoading}
        />
        {#if uploadedFile}
          <button 
            on:click={unpackEPUB} 
            disabled={isLoading}
            class="btn-primary"
          >
            📂 Unpack EPUB
          </button>
        {/if}
      </div>

      <div class="reset-section">
        <button 
          on:click={resetDemo} 
          disabled={isLoading}
          class="btn-danger"
        >
          🔄 Reset Demo
        </button>
        
        <button 
          on:click={clearLogs} 
          disabled={isLoading}
          class="btn-secondary"
        >
          🧹 Clear Logs
        </button>
      </div>
    </div>

    <!-- Workspace State Panel -->
    <div class="workspace-state-panel">
      <h3>📊 Workspace State</h3>
      
      {#if epubMetadata}
        <div class="epub-metadata">
          <h4>📚 EPUB Metadata</h4>
          <div class="metadata-grid">
            <div class="metadata-item">
              <span class="metadata-label">Title:</span>
              <span class="metadata-value">{epubMetadata.title}</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Author:</span>
              <span class="metadata-value">{epubMetadata.creator?.[0] || 'Unknown'}</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Language:</span>
              <span class="metadata-value">{epubMetadata.language}</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">EPUB Files:</span>
              <span class="metadata-value">{epubFiles.length}</span>
            </div>
          </div>
        </div>
      {/if}
      
      {#if sourceStats}
        <div class="source-stats">
          <h4>📂 SOURCE/ Directory</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">SOURCE Files:</span>
              <span class="stat-value">{sourceStats.totalFiles}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Size:</span>
              <span class="stat-value">{(sourceStats.totalSize / 1024).toFixed(1)} KB</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Text Files:</span>
              <span class="stat-value">{sourceStats.directories.text}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Scripts:</span>
              <span class="stat-value">{sourceStats.directories.scripts}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Extensions:</span>
              <span class="stat-value">{sourceStats.directories.extensions}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Has Settings:</span>
              <span class="stat-value">{sourceStats.hasSettingsFile ? '✅' : '❌'}</span>
            </div>
          </div>
        </div>
      {:else}
        <p class="no-data">No SOURCE/ statistics available</p>
      {/if}

      {#if validation}
        <div class="validation-section">
          <h4>🔍 Workspace Validation</h4>
          <div class="validation-status" class:valid={validation.isValid} class:invalid={!validation.isValid}>
            {validation.isValid ? '✅ Valid' : '❌ Invalid'}
          </div>
          {#if validation.errors.length > 0}
            <div class="validation-errors">
              <strong>Errors:</strong>
              <ul>
                {#each validation.errors as error}
                  <li>{error}</li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if validation.warnings.length > 0}
            <div class="validation-warnings">
              <strong>Warnings:</strong>
              <ul>
                {#each validation.warnings as warning}
                  <li>{warning}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- EPUB Analysis Panel -->
    <div class="epub-analysis-panel">
      <h3>🔍 EPUB Analysis</h3>
      
      {#if epubAnalysis}
        <div class="epub-analysis">
          <div class="analysis-summary">
            <h4>📋 EPUB Structure</h4>
            <div class="analysis-stats">
              <div class="analysis-item">
                <span class="analysis-label">Valid EPUB:</span>
                <span class="analysis-value">{epubAnalysis.isValid ? '✅' : '❌'}</span>
              </div>
              <div class="analysis-item">
                <span class="analysis-label">File Count:</span>
                <span class="analysis-value">{epubAnalysis.fileCount}</span>
              </div>
              <div class="analysis-item">
                <span class="analysis-label">Total Size:</span>
                <span class="analysis-value">{(epubAnalysis.totalSize / 1024).toFixed(1)} KB</span>
              </div>
              <div class="analysis-item">
                <span class="analysis-label">SOURCE.zip:</span>
                <span class="analysis-value">
                  {epubAnalysis.fileList.some(f => f.includes('SOURCE.zip')) ? '✅ Present' : '❌ Missing'}
                </span>
              </div>
            </div>
          </div>
          
          <div class="file-list-section">
            <h4>📄 EPUB Files</h4>
            <div class="file-list-scroll">
              {#each epubAnalysis.fileList as file}
                <div class="file-item" class:source-zip={file.includes('SOURCE.zip')}>
                  <span class="file-name">{file}</span>
                  {#if file.includes('SOURCE.zip')}
                    <span class="source-zip-indicator">📦 SOURCE.zip</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else if packagedEPUB}
        <p class="analysis-pending">EPUB packaged - analysis available above</p>
      {:else}
        <p class="no-analysis">No EPUB analysis available - package an EPUB first</p>
      {/if}
    </div>
    
    <!-- Files Panel -->
    <div class="files-panel">
      <h3>📁 Workspace Files</h3>
      
      <div class="file-sections">
        <div class="file-section">
          <h4>📚 EPUB Files ({epubFiles.length})</h4>
          {#if epubFiles.length > 0}
            <div class="files-list">
              {#each epubFiles.slice(0, 10) as file}
                <div class="file-item epub-file">
                  <span class="file-path">{file}</span>
                </div>
              {/each}
              {#if epubFiles.length > 10}
                <div class="file-item more-files">... and {epubFiles.length - 10} more files</div>
              {/if}
            </div>
          {:else}
            <p class="no-files">No EPUB files found</p>
          {/if}
        </div>
        
        <div class="file-section">
          <h4>📂 SOURCE/ Files ({sourceFiles.length})</h4>
          {#if sourceFiles.length > 0}
            <div class="files-list">
              {#each sourceFiles as file}
                <div class="file-item source-file">
                  <div class="file-info">
                    <span class="file-path">{file.path}</span>
                    <span class="file-type type-{file.type}">{file.type}</span>
                  </div>
                  <span class="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="no-files">No SOURCE/ files found</p>
          {/if}
        </div>
      </div>
    </div>

    <!-- Console Panel -->
    <div class="console-panel">
      <h3>📟 Console Log</h3>
      <div class="console-log">
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