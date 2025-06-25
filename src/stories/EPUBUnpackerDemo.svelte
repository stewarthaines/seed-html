<script lang="ts">
  import { onMount } from 'svelte';
  import { EPUBUnpacker } from '$lib/epub/EPUBUnpacker';
  import { FileStorageAPI } from '$lib/storage';
  import { mockEPUBScenarios } from './epub-mock-data';
  import './_templates/backend-feature-demo.css';

  interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'action';
    message: string;
  }

  let unpacker: EPUBUnpacker;
  let storage: FileStorageAPI;
  let logs: LogEntry[] = [];
  let isLoading = false;

  // EPUB state
  let currentWorkspace: string | null = null;
  let validationResults: unknown = null;
  let extractedFiles: string[] = [];
  let analysisResults: unknown = null;
  let uploadedEPUB: File | null = null;

  onMount(async () => {
    try {
      storage = new FileStorageAPI();
      await storage.init();
      unpacker = new EPUBUnpacker();
      addLog('success', 'EPUB Unpacker initialized');
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  function addLog(type: LogEntry['type'], message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, { timestamp, type, message }];
  }

  // File upload handler
  function handleFileUpload(event: Event) {
    const target = event.target as globalThis.HTMLInputElement;
    if (target.files && target.files[0]) {
      uploadedEPUB = target.files[0];
      addLog(
        'info',
        `Uploaded file: ${uploadedEPUB.name} (${(uploadedEPUB.size / 1024).toFixed(1)} KB)`
      );
      addLog(
        'info',
        `File type: ${uploadedEPUB.type}, Constructor: ${uploadedEPUB.constructor.name}`
      );
      addLog('info', `Has arrayBuffer method: ${typeof uploadedEPUB.arrayBuffer === 'function'}`);
    }
  }

  // Process uploaded EPUB
  async function processUploadedEPUB() {
    if (!uploadedEPUB || !unpacker || isLoading) return;

    // Verify it's actually a File object
    if (!(uploadedEPUB instanceof File)) {
      addLog('error', 'Invalid file object - not a File instance');
      return;
    }

    // Check if arrayBuffer method exists
    if (typeof uploadedEPUB.arrayBuffer !== 'function') {
      addLog('error', 'File object missing arrayBuffer method - browser compatibility issue');
      return;
    }

    isLoading = true;
    addLog('action', `Processing uploaded EPUB: ${uploadedEPUB.name}`);

    try {
      await processEPUBFile(uploadedEPUB, `Custom EPUB: ${uploadedEPUB.name}`);
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to process upload: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      isLoading = false;
    }
  }

  // Process EPUB file (for real File objects)
  async function processEPUBFile(file: File, name: string, analysisOnly = false) {
    if (!unpacker || !storage) {
      addLog('error', 'Unpacker or storage not initialized');
      return;
    }

    try {
      if (analysisOnly) {
        // Analysis mode - just validate structure
        addLog('action', `Analyzing EPUB structure...`);
        const analysis = await unpacker.analyzeEPUB(file);
        analysisResults = analysis;

        addLog(
          'success',
          `Analysis complete: ${analysis.fileCount} files, ${(analysis.totalSize / 1024).toFixed(1)} KB`
        );
        addLog('info', `Valid EPUB: ${analysis.isValid ? 'Yes' : 'No'}`);

        if (analysis.validation.errors.length > 0) {
          analysis.validation.errors.forEach(error => addLog('error', `Validation: ${error}`));
        }
        if (analysis.validation.warnings.length > 0) {
          analysis.validation.warnings.forEach(warning => addLog('info', `Warning: ${warning}`));
        }
      } else {
        // Full unpacking mode
        if (!currentWorkspace) {
          currentWorkspace = `epub-demo-${Date.now()}`;
          await storage.createWorkspace(currentWorkspace);
          addLog('info', `Created workspace: ${currentWorkspace}`);
        }

        const result = await unpacker.unpackEPUB(file, currentWorkspace);

        if (result.success) {
          addLog('success', `Unpacked ${result.processedFiles} files to workspace`);
          if (result.extractedFiles) {
            result.extractedFiles.slice(0, 5).forEach(file => addLog('info', `Extracted: ${file}`));
            if (result.extractedFiles.length > 5) {
              addLog('info', `... and ${result.extractedFiles.length - 5} more files`);
            }
          }
        } else {
          addLog('error', `Failed to unpack ${name}: ${result.error}`);
        }
      }
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to unpack ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Process EPUB scenario
  async function processScenario(scenarioKey: string, analysisOnly = false) {
    if (!unpacker || isLoading) return;

    const scenario = mockEPUBScenarios[scenarioKey as keyof typeof mockEPUBScenarios];
    if (!scenario) return;

    isLoading = true;
    addLog('action', `${analysisOnly ? 'Analyzing' : 'Processing'} ${scenario.name}...`);

    try {
      const arrayBuffer = await scenario.create();
      await processEPUBData(arrayBuffer, scenario.name, analysisOnly);
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to process ${scenario.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      isLoading = false;
    }
  }

  // Core EPUB processing logic
  async function processEPUBData(arrayBuffer: ArrayBuffer, name: string, analysisOnly = false) {
    try {
      // Convert ArrayBuffer to File object for API compatibility
      const blob = new Blob([arrayBuffer], { type: 'application/epub+zip' });
      const file = new File([blob], `${name}.epub`, { type: 'application/epub+zip' });

      if (analysisOnly) {
        // Analysis mode - don't extract files
        const analysis = await unpacker.analyzeEPUB(file);
        analysisResults = analysis;
        validationResults = analysis.validation;

        addLog('success', `Analysis complete for ${name}`);
        addLog(
          'info',
          `Files: ${analysis.fileCount}, Size: ${(analysis.totalSize / 1024).toFixed(1)} KB`
        );

        if (analysis.validation.errors.length > 0) {
          analysis.validation.errors.forEach(error => addLog('error', `Validation: ${error}`));
        }
        if (analysis.validation.warnings.length > 0) {
          analysis.validation.warnings.forEach(warning => addLog('info', `Warning: ${warning}`));
        }
      } else {
        // Full unpacking mode
        if (!currentWorkspace) {
          currentWorkspace = `epub-demo-${Date.now()}`;
          await storage.createWorkspace(currentWorkspace);
          addLog('info', `Created workspace: ${currentWorkspace}`);
        }

        const result = await unpacker.unpackEPUB(file, currentWorkspace);

        if (result.success) {
          extractedFiles = result.extractedFiles || [];
          validationResults = result.validation;

          addLog('success', `Unpacked ${name} successfully`);
          addLog(
            'info',
            `Extracted ${result.processedFiles} files, ${(result.totalSize! / 1024).toFixed(1)} KB`
          );

          if (result.validation?.errors.length > 0) {
            result.validation.errors.forEach(error => addLog('error', `Validation: ${error}`));
          }
          if (result.validation?.warnings.length > 0) {
            result.validation.warnings.forEach(warning => addLog('info', `Warning: ${warning}`));
          }
        } else {
          addLog('error', `Failed to unpack ${name}: ${result.error}`);
          validationResults = result.validation;
        }
      }
    } catch (error: unknown) {
      addLog(
        'error',
        `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Demo reset
  async function resetDemo() {
    if (isLoading) return;

    isLoading = true;
    addLog('action', 'Resetting demo...');

    try {
      if (currentWorkspace && storage) {
        await storage.deleteWorkspace(currentWorkspace);
        addLog('info', `Deleted workspace: ${currentWorkspace}`);
      }

      currentWorkspace = null;
      validationResults = null;
      extractedFiles = [];
      analysisResults = null;
      uploadedEPUB = null;

      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as globalThis.HTMLInputElement;
      if (fileInput) fileInput.value = '';

      addLog('success', 'Demo reset complete');
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to reset: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      isLoading = false;
    }
  }

  function clearLogs() {
    logs = [];
  }

  function formatValidationResults(results: unknown): string {
    if (!results || typeof results !== 'object') return 'No validation results';

    const validation = results as { isValid: boolean; errors: string[]; warnings: string[] };
    let output = `Valid: ${validation.isValid}\n`;
    if (validation.errors && validation.errors.length > 0) {
      output += `\nErrors:\n${validation.errors.map((e: string) => `  • ${e}`).join('\n')}`;
    }
    if (validation.warnings && validation.warnings.length > 0) {
      output += `\nWarnings:\n${validation.warnings.map((w: string) => `  • ${w}`).join('\n')}`;
    }
    return output;
  }
</script>

<div class="backend-feature-demo">
  <div class="demo-header">
    <h2>EPUB Unpacker Demo</h2>
    <p>Interactive demonstration of EPUB unpacking and validation capabilities</p>
  </div>

  <div class="demo-content">
    <!-- Control Panel -->
    <div class="control-panel">
      <!-- File Upload Section -->
      <div class="section">
        <h3>Custom EPUB Upload</h3>
        <div class="upload-area">
          <input type="file" accept=".epub" on:change={handleFileUpload} disabled={isLoading} />
          {#if uploadedEPUB}
            <button on:click={processUploadedEPUB} disabled={isLoading}>
              Unpack Uploaded EPUB
            </button>
          {/if}
        </div>
      </div>

      <!-- Preset Scenarios -->
      <div class="section">
        <h3>Test Scenarios</h3>
        <div class="button-group">
          <button on:click={() => processScenario('validEPUB')} disabled={isLoading}>
            Valid EPUB 3.0
          </button>
          <button on:click={() => processScenario('validEPUB', true)} disabled={isLoading}>
            Analysis Mode
          </button>
          <button on:click={() => processScenario('missingFiles')} disabled={isLoading}>
            Missing Files
          </button>
          <button on:click={() => processScenario('corruptedContainer')} disabled={isLoading}>
            Corrupted XML
          </button>
        </div>
      </div>

      <!-- Additional Error Scenarios -->
      <div class="section">
        <h3>More Error Scenarios</h3>
        <div class="button-group">
          <button on:click={() => processScenario('missingContainer')} disabled={isLoading}>
            Missing Container
          </button>
          <button on:click={() => processScenario('corruptedOPF')} disabled={isLoading}>
            Corrupted OPF
          </button>
          <button on:click={() => processScenario('wrongMimetype')} disabled={isLoading}>
            Wrong Mimetype
          </button>
        </div>
      </div>

      <!-- Demo Controls -->
      <div class="section">
        <h3>Demo Controls</h3>
        <div class="button-group">
          <button on:click={resetDemo} disabled={isLoading}> Reset Demo </button>
        </div>
      </div>

      <!-- Validation Results -->
      {#if validationResults}
        <div class="section">
          <h3>Validation Results</h3>
          <div class="validation-display" class:validation-error={!validationResults.isValid}>
            <pre>{formatValidationResults(validationResults)}</pre>
          </div>
        </div>
      {/if}

      <!-- Extracted Files -->
      {#if extractedFiles.length > 0}
        <div class="section">
          <h3>Extracted Files ({extractedFiles.length})</h3>
          <div class="file-list">
            {#each extractedFiles as file}
              <div class="file-item">📄 {file}</div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Analysis Results -->
      {#if analysisResults}
        <div class="section">
          <h3>Analysis Results</h3>
          <div class="analysis-display">
            <div class="analysis-stat">Files: {analysisResults.fileCount}</div>
            <div class="analysis-stat">
              Size: {(analysisResults.totalSize / 1024).toFixed(1)} KB
            </div>
            <div class="analysis-stat">Valid: {analysisResults.isValid ? '✅' : '❌'}</div>
            {#if analysisResults.fileList.length > 0}
              <div class="file-list-preview">
                <strong>Files:</strong>
                {#each analysisResults.fileList.slice(0, 5) as file}
                  <div class="file-item">📄 {file}</div>
                {/each}
                {#if analysisResults.fileList.length > 5}
                  <div class="file-item">... and {analysisResults.fileList.length - 5} more</div>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Console Log -->
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

<style>
  .upload-area {
    border: 2px dashed #ccc;
    border-radius: 6px;
    padding: 20px;
    text-align: center;
    margin-bottom: 10px;
  }

  .upload-area input[type='file'] {
    margin-bottom: 10px;
  }

  .validation-display {
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 10px;
    font-family: monospace;
    font-size: 0.9em;
  }

  .validation-error {
    background: #ffeaea;
    border-color: #ff6b6b;
  }

  .analysis-display {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    padding: 15px;
  }

  .analysis-stat {
    margin-bottom: 5px;
    font-weight: bold;
  }

  .file-list-preview {
    margin-top: 10px;
  }

  .file-list-preview .file-item {
    font-size: 0.85em;
    margin: 2px 0;
  }
</style>
