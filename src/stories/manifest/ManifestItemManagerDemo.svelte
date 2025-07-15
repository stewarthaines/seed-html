<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ManifestItem } from '../../lib/manifest/types.js';

  // Story props
  export let mode: 'create-text' | 'create-file' | 'edit' = 'create-text';
  export let isOpen = true;
  export let hasValidationErrors = false;
  export let isLoading = false;
  export let uploadProgress = 0;
  export let existingItemId = '';
  export let prefilledData = {};

  const dispatch = createEventDispatcher();

  // Form state
  let formData = {
    id: '',
    href: '',
    mediaType: '',
    properties: [] as string[],
    targetDirectory: 'OEBPS/',
    fileName: '',
    content: '',
    ...prefilledData
  };

  // Validation errors
  let errors: Record<string, string> = {};

  // File upload state
  let selectedFiles: File[] = [];
  let isDragging = false;

  // Mock validation
  const validateForm = () => {
    errors = {};
    
    if (hasValidationErrors) {
      if (!formData.id.trim()) {
        errors.id = 'ID is required';
      }
      if (!formData.href.trim()) {
        errors.href = 'Href is required';
      }
      if (!formData.mediaType.trim()) {
        errors.mediaType = 'Media type is required';
      }
      if (mode === 'create-text' && !formData.fileName.trim()) {
        errors.fileName = 'File name is required';
      }
    }

    return Object.keys(errors).length === 0;
  };

  // Auto-generate ID from filename
  const generateId = (fileName: string) => {
    return fileName
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[^a-zA-Z0-9]/g, '-') // Replace non-alphanumeric with dash
      .toLowerCase();
  };

  // Detect media type from filename
  const detectMediaType = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mediaTypeMap: Record<string, string> = {
      'xhtml': 'application/xhtml+xml',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4',
      'pdf': 'application/pdf',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
    };
    return mediaTypeMap[ext || ''] || 'application/octet-stream';
  };

  // Handle filename change
  const handleFileNameChange = () => {
    if (mode === 'create-text' && formData.fileName) {
      if (!formData.id || formData.id === generateId(formData.fileName.replace(formData.fileName.split('.').pop() || '', ''))) {
        formData.id = generateId(formData.fileName);
      }
      formData.href = formData.targetDirectory + formData.fileName;
      formData.mediaType = detectMediaType(formData.fileName);
    }
  };

  // Handle file selection
  const handleFileSelect = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      selectedFiles = Array.from(input.files);
      if (selectedFiles.length > 0) {
        const file = selectedFiles[0];
        formData.fileName = file.name;
        formData.id = generateId(file.name);
        formData.href = formData.targetDirectory + file.name;
        formData.mediaType = detectMediaType(file.name);
      }
    }
  };

  // Handle drag and drop
  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    isDragging = true;
  };

  const handleDragLeave = () => {
    isDragging = false;
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    isDragging = false;
    
    if (event.dataTransfer?.files) {
      selectedFiles = Array.from(event.dataTransfer.files);
      if (selectedFiles.length > 0) {
        const file = selectedFiles[0];
        formData.fileName = file.name;
        formData.id = generateId(file.name);
        formData.href = formData.targetDirectory + file.name;
        formData.mediaType = detectMediaType(file.name);
      }
    }
  };

  // Handle property toggle
  const toggleProperty = (property: string) => {
    if (formData.properties.includes(property)) {
      formData.properties = formData.properties.filter(p => p !== property);
    } else {
      formData.properties = [...formData.properties, property];
    }
  };

  // Handle form submission
  const handleSubmit = () => {
    if (!validateForm()) return;
    
    if (isLoading) return;

    const item: Partial<ManifestItem> = {
      id: formData.id,
      href: formData.href,
      mediaType: formData.mediaType,
      properties: formData.properties.length > 0 ? formData.properties : undefined,
    };

    dispatch('save', { item });
  };

  // Handle close
  const handleClose = () => {
    dispatch('close');
  };

  // Common EPUB properties
  const availableProperties = [
    'nav',
    'cover-image',
    'mathml',
    'remote-resources',
    'scripted',
    'svg',
  ];

  // React to prop changes
  $: if (existingItemId && mode === 'edit') {
    formData = {
      ...formData,
      ...prefilledData
    };
  }

  // Run validation when hasValidationErrors changes
  $: if (hasValidationErrors) {
    validateForm();
  }
</script>

<div class="manifest-item-manager-demo">
  {#if !isOpen}
    <div class="demo-background">
      <p>Modal is closed. Toggle the "isOpen" control to show the item manager.</p>
    </div>
  {/if}

  {#if isOpen}
    <!-- Modal backdrop -->
    <div class="modal-backdrop" on:click={handleClose} role="presentation">
      <!-- Modal content -->
      <div class="modal-content" on:click|stopPropagation role="dialog" aria-labelledby="modal-title">
        <div class="modal-header">
          <h2 id="modal-title">
            {#if mode === 'create-text'}
              Create Text File
            {:else if mode === 'create-file'}
              Upload File
            {:else}
              Edit Item
            {/if}
          </h2>
          <button type="button" class="close-button" on:click={handleClose} aria-label="Close">
            ×
          </button>
        </div>

        <div class="modal-body">
          {#if mode === 'create-file'}
            <!-- File upload interface -->
            <div class="upload-section">
              <div 
                class="drop-zone" 
                class:dragging={isDragging}
                class:has-files={selectedFiles.length > 0}
                on:dragover={handleDragOver}
                on:dragleave={handleDragLeave}
                on:drop={handleDrop}
                role="button"
                tabindex="0"
              >
                {#if selectedFiles.length > 0}
                  <div class="file-info">
                    <div class="file-icon">📄</div>
                    <div class="file-details">
                      <h4>{selectedFiles[0].name}</h4>
                      <p>{(selectedFiles[0].size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                {:else}
                  <div class="drop-zone-content">
                    <div class="upload-icon">📁</div>
                    <h4>Drop files here or click to browse</h4>
                    <p>Supports images, audio, video, fonts, and other media files</p>
                  </div>
                {/if}
                
                <input 
                  type="file" 
                  class="file-input" 
                  on:change={handleFileSelect}
                  accept="*/*"
                />
              </div>

              {#if uploadProgress > 0 && isLoading}
                <div class="upload-progress">
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: {uploadProgress}%"></div>
                  </div>
                  <span class="progress-text">{uploadProgress}% uploaded</span>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Form fields -->
          <div class="form-section">
            {#if mode === 'create-text'}
              <div class="form-group">
                <label for="fileName">File Name</label>
                <input 
                  id="fileName"
                  type="text" 
                  bind:value={formData.fileName}
                  on:input={handleFileNameChange}
                  class:error={errors.fileName}
                  placeholder="chapter1.xhtml"
                  disabled={isLoading}
                />
                {#if errors.fileName}
                  <span class="error-message">{errors.fileName}</span>
                {/if}
              </div>
            {/if}

            <div class="form-group">
              <label for="id">ID</label>
              <input 
                id="id"
                type="text" 
                bind:value={formData.id}
                class:error={errors.id}
                placeholder="chapter1"
                disabled={isLoading}
              />
              {#if errors.id}
                <span class="error-message">{errors.id}</span>
              {/if}
            </div>

            <div class="form-group">
              <label for="href">Href</label>
              <input 
                id="href"
                type="text" 
                bind:value={formData.href}
                class:error={errors.href}
                placeholder="OEBPS/chapter1.xhtml"
                disabled={isLoading}
              />
              {#if errors.href}
                <span class="error-message">{errors.href}</span>
              {/if}
            </div>

            <div class="form-group">
              <label for="mediaType">Media Type</label>
              <input 
                id="mediaType"
                type="text" 
                bind:value={formData.mediaType}
                class:error={errors.mediaType}
                placeholder="application/xhtml+xml"
                disabled={isLoading}
              />
              {#if errors.mediaType}
                <span class="error-message">{errors.mediaType}</span>
              {/if}
            </div>

            <div class="form-group">
              <label>Properties</label>
              <div class="properties-grid">
                {#each availableProperties as property}
                  <label class="property-checkbox">
                    <input 
                      type="checkbox" 
                      checked={formData.properties.includes(property)}
                      on:change={() => toggleProperty(property)}
                      disabled={isLoading}
                    />
                    {property}
                  </label>
                {/each}
              </div>
            </div>

            {#if mode === 'create-text'}
              <div class="form-group">
                <label for="content">Initial Content</label>
                <textarea 
                  id="content"
                  bind:value={formData.content}
                  placeholder="Enter initial content for the file..."
                  rows="4"
                  disabled={isLoading}
                ></textarea>
              </div>
            {/if}
          </div>
        </div>

        <div class="modal-footer">
          <button 
            type="button" 
            class="secondary" 
            on:click={handleClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            type="button" 
            class="primary" 
            on:click={handleSubmit}
            disabled={isLoading || (mode === 'create-file' && selectedFiles.length === 0)}
          >
            {#if isLoading}
              Saving...
            {:else if mode === 'edit'}
              Save Changes
            {:else}
              Create Item
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  @import './manifest-demo.css';

  .manifest-item-manager-demo {
    height: 100vh;
    position: relative;
  }

  .demo-background {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color-surface-secondary, #f9fafb);
    color: var(--color-text-secondary, #6b7280);
  }

  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background-color: var(--color-surface-primary, white);
    border-radius: var(--border-radius-lg, 0.5rem);
    box-shadow: var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1));
    width: 90%;
    max-width: 32rem;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-6, 1.5rem);
    border-bottom: 1px solid var(--color-border-primary, #e5e7eb);
  }

  .modal-header h2 {
    margin: 0;
    font-size: var(--font-size-xl, 1.25rem);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text-primary, #374151);
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-text-secondary, #6b7280);
    cursor: pointer;
    padding: var(--spacing-1, 0.25rem);
    line-height: 1;
  }

  .close-button:hover {
    color: var(--color-text-primary, #374151);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-6, 1.5rem);
  }

  .upload-section {
    margin-bottom: var(--spacing-6, 1.5rem);
  }

  .drop-zone {
    border: 2px dashed var(--color-border-primary, #d1d5db);
    border-radius: var(--border-radius-lg, 0.5rem);
    padding: var(--spacing-8, 2rem);
    text-align: center;
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .drop-zone:hover,
  .drop-zone.dragging {
    border-color: var(--color-primary-500, #3b82f6);
    background-color: var(--color-primary-50, #eff6ff);
  }

  .drop-zone.has-files {
    border-color: var(--color-success-500, #10b981);
    background-color: var(--color-success-50, #f0fdf4);
  }

  .file-input {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .drop-zone-content {
    pointer-events: none;
  }

  .upload-icon,
  .file-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-4, 1rem);
  }

  .drop-zone-content h4 {
    margin: 0 0 var(--spacing-2, 0.5rem) 0;
    color: var(--color-text-primary, #374151);
    font-weight: var(--font-weight-medium, 500);
  }

  .drop-zone-content p {
    margin: 0;
    color: var(--color-text-secondary, #6b7280);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-4, 1rem);
    pointer-events: none;
  }

  .file-details h4 {
    margin: 0;
    color: var(--color-text-primary, #374151);
    font-weight: var(--font-weight-medium, 500);
  }

  .file-details p {
    margin: 0;
    color: var(--color-text-secondary, #6b7280);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .upload-progress {
    margin-top: var(--spacing-4, 1rem);
  }

  .progress-bar {
    width: 100%;
    height: 0.5rem;
    background-color: var(--color-surface-secondary, #f3f4f6);
    border-radius: var(--border-radius-full, 9999px);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background-color: var(--color-primary-500, #3b82f6);
    transition: width 0.3s ease;
  }

  .progress-text {
    display: block;
    text-align: center;
    margin-top: var(--spacing-2, 0.5rem);
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--color-text-secondary, #6b7280);
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4, 1rem);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2, 0.5rem);
  }

  .form-group label {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text-primary, #374151);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .form-group input,
  .form-group textarea {
    padding: var(--spacing-3, 0.75rem);
    border: 1px solid var(--color-border-primary, #d1d5db);
    border-radius: var(--border-radius-md, 0.375rem);
    font-size: var(--font-size-sm, 0.875rem);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary-500, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-group input.error,
  .form-group textarea.error {
    border-color: var(--color-error-500, #ef4444);
  }

  .form-group input:disabled,
  .form-group textarea:disabled {
    background-color: var(--color-surface-secondary, #f9fafb);
    color: var(--color-text-tertiary, #9ca3af);
    cursor: not-allowed;
  }

  .error-message {
    color: var(--color-error-600, #dc2626);
    font-size: var(--font-size-xs, 0.75rem);
  }

  .properties-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: var(--spacing-2, 0.5rem);
  }

  .property-checkbox {
    display: flex;
    align-items: center;
    gap: var(--spacing-2, 0.5rem);
    font-size: var(--font-size-sm, 0.875rem);
    cursor: pointer;
  }

  .property-checkbox input[type="checkbox"] {
    margin: 0;
  }

  .modal-footer {
    display: flex;
    gap: var(--spacing-3, 0.75rem);
    justify-content: flex-end;
    padding: var(--spacing-6, 1.5rem);
    border-top: 1px solid var(--color-border-primary, #e5e7eb);
  }

  .modal-footer button {
    padding: var(--spacing-2, 0.5rem) var(--spacing-4, 1rem);
    border-radius: var(--border-radius-md, 0.375rem);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .modal-footer button.secondary {
    background-color: var(--color-surface-primary, white);
    color: var(--color-text-secondary, #6b7280);
    border: 1px solid var(--color-border-primary, #d1d5db);
  }

  .modal-footer button.secondary:hover {
    background-color: var(--color-surface-secondary, #f9fafb);
  }

  .modal-footer button.primary {
    background-color: var(--color-primary-600, #2563eb);
    color: var(--color-white, white);
    border: 1px solid var(--color-primary-600, #2563eb);
  }

  .modal-footer button.primary:hover {
    background-color: var(--color-primary-700, #1d4ed8);
  }

  .modal-footer button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .modal-content {
      width: 95%;
      max-height: 95vh;
    }

    .properties-grid {
      grid-template-columns: 1fr;
    }
  }
</style>