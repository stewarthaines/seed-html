<!--
  ExtensionUploader Component
  
  Provides drag & drop file upload interface with validation feedback,
  name detection, and support for both single files and EPUB imports.
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { SAMPLE_EPUBS } from '../mock-data/sample-epub.js';

  export let state: any;

  const dispatch = createEventDispatcher();

  // Upload state
  let isDragOver = false;
  let uploadInput: HTMLInputElement;
  let detectedName = '';
  let confirmationFile: File | null = null;
  let showNameConfirmation = false;

  // File validation feedback
  let validationResult: {
    isValid: boolean;
    fileType?: string;
    error?: string;
  } | null = null;

  // Handle drag and drop events
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }

  // Handle file input change
  function handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      handleFiles(input.files);
    }
  }

  // Process uploaded files
  function handleFiles(files: FileList) {
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.epub')) {
        handleEPUBFile(file);
      } else {
        handleJavaScriptFile(file);
      }
    }
  }

  // Handle JavaScript file upload
  function handleJavaScriptFile(file: File) {
    // Validate file (using mock validation for demo)
    validationResult = validateFile(file);
    
    if (!validationResult.isValid) {
      return;
    }

    // Detect extension name
    detectedName = detectExtensionName(file.name);
    confirmationFile = file;
    showNameConfirmation = true;
  }

  // Handle EPUB file upload
  function handleEPUBFile(file: File) {
    // For demo, we'll simulate EPUB import with predefined samples
    const epubName = Object.keys(SAMPLE_EPUBS)[0]; // Use first sample EPUB
    dispatch('epubImport', { epubName });
  }

  // Confirm extension name and proceed with import
  function confirmImport() {
    if (confirmationFile) {
      dispatch('filesUploaded', { files: [confirmationFile] });
      resetUploadState();
    }
  }

  // Cancel import
  function cancelImport() {
    resetUploadState();
  }

  // Reset upload state
  function resetUploadState() {
    confirmationFile = null;
    showNameConfirmation = false;
    detectedName = '';
    validationResult = null;
    if (uploadInput) {
      uploadInput.value = '';
    }
  }

  // Mock file validation (simplified for demo)
  function validateFile(file: File): { isValid: boolean; fileType?: string; error?: string } {
    if (!file.name.endsWith('.js')) {
      return {
        isValid: false,
        error: 'Only JavaScript files (.js) are allowed'
      };
    }

    if (file.size === 0) {
      return {
        isValid: false,
        error: 'JavaScript file cannot be empty'
      };
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      return {
        isValid: false,
        error: 'File too large (max 50MB)'
      };
    }

    return {
      isValid: true,
      fileType: 'javascript'
    };
  }

  // Mock extension name detection (simplified for demo)
  function detectExtensionName(filename: string): string {
    let name = filename;
    if (name.endsWith('.js')) name = name.slice(0, -3);
    if (name.endsWith('.min')) name = name.slice(0, -4);
    
    // Remove version numbers
    name = name.replace(/[-@](?:v?\d+[\.\-]\d+|\d+[\.\-]\d+)(?:[\.\-]\w+)*$/i, '');
    
    // Normalize
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // Quick upload buttons for demo
  function quickUpload(extensionName: string) {
    // Simulate uploading a sample extension
    const sampleContent = `/*! ${extensionName} demo */\nfunction ${extensionName}() { return 'demo'; }`;
    const blob = new Blob([sampleContent], { type: 'text/javascript' });
    const file = new File([blob], `${extensionName}.min.js`, { type: 'text/javascript' });
    
    dispatch('filesUploaded', { files: [file] });
  }

  // EPUB demo import
  function importSampleEPUB(epubKey: string) {
    dispatch('epubImport', { epubName: epubKey });
  }
</script>

<div class="extension-uploader">
  <h3>Extension Import</h3>
  
  <!-- Upload Zone -->
  <div 
    class="upload-zone"
    class:drag-over={isDragOver}
    class:has-error={validationResult && !validationResult.isValid}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
    role="button"
    tabindex="0"
    on:click={() => uploadInput?.click()}
    on:keydown={(e) => e.key === 'Enter' && uploadInput?.click()}
  >
    <div class="upload-content">
      {#if state.uploadProgress}
        <div class="upload-progress">
          <div class="progress-info">
            <span class="filename">{state.uploadProgress.filename}</span>
            <span class="status">{state.uploadProgress.status}</span>
          </div>
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              style="width: {state.uploadProgress.progress}%"
            ></div>
          </div>
        </div>
      {:else}
        <div class="upload-icon">📁</div>
        <p class="upload-text">
          Drag & drop JavaScript files here<br>
          or click to browse
        </p>
        <p class="upload-hint">
          Supported: .js files up to 50MB
        </p>
      {/if}
    </div>
  </div>

  <!-- Hidden file input -->
  <input
    bind:this={uploadInput}
    type="file"
    accept=".js"
    multiple
    style="display: none"
    on:change={handleFileInput}
  />

  <!-- Validation feedback -->
  {#if validationResult && !validationResult.isValid}
    <div class="validation-error">
      <span class="error-icon">⚠️</span>
      {validationResult.error}
    </div>
  {/if}

  <!-- Name confirmation dialog -->
  {#if showNameConfirmation}
    <div class="name-confirmation">
      <h4>Confirm Extension Name</h4>
      <p>Detected name: <strong>{detectedName}</strong></p>
      <div class="name-input">
        <label for="extension-name">Extension name:</label>
        <input
          id="extension-name"
          type="text"
          bind:value={detectedName}
          placeholder="Enter extension name"
        />
      </div>
      <div class="confirmation-actions">
        <button class="btn btn-primary" on:click={confirmImport}>
          Import Extension
        </button>
        <button class="btn btn-secondary" on:click={cancelImport}>
          Cancel
        </button>
      </div>
    </div>
  {/if}

  <!-- Quick Actions for Demo -->
  <div class="quick-actions">
    <h4>Quick Demo Actions</h4>
    
    <div class="action-group">
      <h5>Upload Sample Extensions</h5>
      <div class="quick-buttons">
        <button class="btn btn-small" on:click={() => quickUpload('lodash')}>
          Lodash
        </button>
        <button class="btn btn-small" on:click={() => quickUpload('d3')}>
          D3.js
        </button>
        <button class="btn btn-small" on:click={() => quickUpload('highlight')}>
          Highlight.js
        </button>
      </div>
    </div>

    <div class="action-group">
      <h5>Import Sample EPUBs</h5>
      <div class="epub-buttons">
        <button 
          class="btn btn-small"
          on:click={() => importSampleEPUB('MARKDOWN_BOOK')}
        >
          Markdown Book
        </button>
        <button 
          class="btn btn-small"
          on:click={() => importSampleEPUB('MUSIC_BOOK')}
        >
          Music Book
        </button>
        <button 
          class="btn btn-small"
          on:click={() => importSampleEPUB('DATA_VIZ_BOOK')}
        >
          Data Viz Book
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .extension-uploader {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    padding: var(--space-4);
  }

  .extension-uploader h3 {
    margin: 0 0 var(--space-3) 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-lg);
  }

  .upload-zone {
    border: 2px dashed var(--color-border-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-6);
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    background: var(--color-bg-primary);
  }

  .upload-zone:hover {
    border-color: var(--color-border-accent);
    background: var(--color-bg-accent);
  }

  .upload-zone.drag-over {
    border-color: var(--color-accent);
    background: var(--color-bg-accent);
    transform: scale(1.02);
  }

  .upload-zone.has-error {
    border-color: var(--color-error);
    background: var(--color-bg-error);
  }

  .upload-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .upload-icon {
    font-size: 3rem;
    opacity: 0.6;
  }

  .upload-text {
    margin: 0;
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
  }

  .upload-hint {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .upload-progress {
    width: 100%;
    max-width: 300px;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-2);
  }

  .filename {
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
  }

  .status {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    text-transform: capitalize;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-accent);
    transition: width 0.3s ease;
  }

  .validation-error {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    margin-top: var(--space-3);
    background: var(--color-bg-error);
    border: 1px solid var(--color-error);
    border-radius: var(--radius-sm);
    color: var(--color-error);
    font-size: var(--font-size-sm);
  }

  .name-confirmation {
    margin-top: var(--space-4);
    padding: var(--space-4);
    background: var(--color-bg-accent);
    border: 1px solid var(--color-border-accent);
    border-radius: var(--radius-md);
  }

  .name-confirmation h4 {
    margin: 0 0 var(--space-2) 0;
    color: var(--color-text-primary);
  }

  .name-confirmation p {
    margin: 0 0 var(--space-3) 0;
    color: var(--color-text-secondary);
  }

  .name-input {
    margin-bottom: var(--space-4);
  }

  .name-input label {
    display: block;
    margin-bottom: var(--space-1);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
  }

  .name-input input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .confirmation-actions {
    display: flex;
    gap: var(--space-2);
  }

  .quick-actions {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border-secondary);
  }

  .quick-actions h4 {
    margin: 0 0 var(--space-3) 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-md);
  }

  .action-group {
    margin-bottom: var(--space-3);
  }

  .action-group h5 {
    margin: 0 0 var(--space-2) 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }

  .quick-buttons,
  .epub-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  /* Button styles */
  .btn {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn:hover {
    background: var(--color-bg-accent);
    border-color: var(--color-border-accent);
  }

  .btn-primary {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-accent-hover, var(--color-accent));
  }

  .btn-secondary {
    background: var(--color-bg-secondary);
  }

  .btn-small {
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-sm);
  }
</style>