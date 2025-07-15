<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n';
  import type { ManifestItem, SourceItem, ValidationResult } from '../../manifest/types';

  export let itemEditorMode: 'create-text' | 'create-file' | 'edit' = 'create-text';
  export let item: ManifestItem | SourceItem | null = null;
  export let validationErrors: ValidationResult[] = [];

  const dispatch = createEventDispatcher();

  let modalRef: HTMLElement;
  let formData: Partial<ManifestItem> = {
    id: '',
    href: '',
    mediaType: '',
    properties: []
  };
  let textContent = '';
  let fileInput: HTMLInputElement;
  let selectedFile: File | null = null;

  // Initialize form data based on mode and item
  $: if (itemEditorMode === 'edit' && item && 'id' in item) {
    const manifestItem = item as ManifestItem;
    formData = {
      id: manifestItem.id,
      href: manifestItem.href,
      mediaType: manifestItem.mediaType,
      properties: manifestItem.properties || []
    };
  } else {
    formData = {
      id: '',
      href: '',
      mediaType: itemEditorMode === 'create-text' ? 'text/plain' : '',
      properties: []
    };
  }

  // Common media types for dropdown
  const mediaTypes = [
    { value: 'application/xhtml+xml', label: 'XHTML' },
    { value: 'text/html', label: 'HTML' },
    { value: 'text/css', label: 'CSS' },
    { value: 'text/javascript', label: 'JavaScript' },
    { value: 'text/plain', label: 'Plain Text' },
    { value: 'image/jpeg', label: 'JPEG Image' },
    { value: 'image/png', label: 'PNG Image' },
    { value: 'image/svg+xml', label: 'SVG Image' },
    { value: 'audio/mpeg', label: 'MP3 Audio' },
    { value: 'audio/ogg', label: 'OGG Audio' },
    { value: 'video/mp4', label: 'MP4 Video' },
    { value: 'video/webm', label: 'WebM Video' },
    { value: 'application/pdf', label: 'PDF' },
    { value: 'application/epub+zip', label: 'EPUB' }
  ];

  // EPUB properties for checkboxes
  const epubProperties = [
    { value: 'cover-image', label: 'Cover Image' },
    { value: 'mathml', label: 'MathML' },
    { value: 'nav', label: 'Navigation' },
    { value: 'remote-resources', label: 'Remote Resources' },
    { value: 'scripted', label: 'Scripted' },
    { value: 'svg', label: 'SVG' }
  ];

  const handleClose = () => {
    dispatch('close');
  };

  const handleBackdropClick = (event: Event) => {
    if (event.target === modalRef) {
      handleClose();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  };

  const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      selectedFile = target.files[0];
      
      // Auto-fill form data based on file
      if (!formData.id) {
        formData.id = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_');
      }
      if (!formData.href) {
        formData.href = `OEBPS/${selectedFile.name}`;
      }
      if (!formData.mediaType) {
        formData.mediaType = selectedFile.type || detectMediaType(selectedFile.name);
      }
    }
  };

  const detectMediaType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      'html': 'text/html',
      'xhtml': 'application/xhtml+xml',
      'css': 'text/css',
      'js': 'text/javascript',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'mp3': 'audio/mpeg',
      'ogg': 'audio/ogg',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'pdf': 'application/pdf'
    };
    return typeMap[ext || ''] || 'application/octet-stream';
  };

  const handleSubmit = (event: Event) => {
    event.preventDefault();
    
    // Basic validation
    if (!formData.id || !formData.href || !formData.mediaType) {
      alert($t('Please fill in all required fields'));
      return;
    }

    // Create the manifest item
    const manifestItem: ManifestItem = {
      id: formData.id,
      href: formData.href,
      mediaType: formData.mediaType,
      properties: formData.properties?.filter(p => p.length > 0)
    };

    dispatch('save', { item: manifestItem, textContent, selectedFile });
  };

  const handlePropertyChange = (propertyValue: string, checked: boolean) => {
    if (checked) {
      formData.properties = [...(formData.properties || []), propertyValue];
    } else {
      formData.properties = (formData.properties || []).filter(p => p !== propertyValue);
    }
  };

  const generateIdFromHref = () => {
    if (formData.href) {
      const filename = formData.href.split('/').pop() || '';
      formData.id = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_');
    }
  };

  const generateHrefFromId = () => {
    if (formData.id && !formData.href) {
      const extension = getExtensionFromMediaType(formData.mediaType || '');
      formData.href = `OEBPS/${formData.id}${extension}`;
    }
  };

  const getExtensionFromMediaType = (mediaType: string): string => {
    const typeMap: Record<string, string> = {
      'application/xhtml+xml': '.xhtml',
      'text/html': '.html',
      'text/css': '.css',
      'text/javascript': '.js',
      'text/plain': '.txt',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'application/pdf': '.pdf'
    };
    return typeMap[mediaType] || '.dat';
  };

  const getFieldError = (field: string): string | null => {
    const error = validationErrors.find(e => e.field === field);
    return error ? error.message : null;
  };

  const hasFieldError = (field: string): boolean => {
    return validationErrors.some(e => e.field === field);
  };
</script>

<svelte:window on:keydown={handleKeyDown} />

<div 
  class="modal-overlay"
  bind:this={modalRef}
  on:click={handleBackdropClick}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  tabindex="-1"
>
  <div class="modal-content">
    <div class="modal-header">
      <h2 id="modal-title">
        {#if itemEditorMode === 'create-text'}
          {$t('Create Text File')}
        {:else if itemEditorMode === 'create-file'}
          {$t('Upload File')}
        {:else}
          {$t('Edit Manifest Item')}
        {/if}
      </h2>
      <button type="button" class="close-button" aria-label={$t('Close')} on:click={handleClose}>
        ×
      </button>
    </div>

    <form class="modal-form" on:submit={handleSubmit}>
      <div class="form-body">
        {#if itemEditorMode === 'create-file'}
          <div class="form-group">
            <label for="file-input" class="form-label">
              {$t('Select File')} <span class="required">*</span>
            </label>
            <input
              id="file-input"
              bind:this={fileInput}
              type="file"
              class="file-input"
              required
              on:change={handleFileSelect}
            />
            {#if selectedFile}
              <p class="file-info">
                {$t('Selected')}: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            {/if}
          </div>
        {/if}

        <div class="form-group">
          <label for="item-id" class="form-label">
            {$t('ID')} <span class="required">*</span>
          </label>
          <input
            id="item-id"
            type="text"
            class="form-input"
            class:error={hasFieldError('id')}
            bind:value={formData.id}
            on:blur={generateHrefFromId}
            placeholder={$t('Unique identifier for this item')}
            required
          />
          {#if getFieldError('id')}
            <p class="error-message">{getFieldError('id')}</p>
          {/if}
        </div>

        <div class="form-group">
          <label for="item-href" class="form-label">
            {$t('File Path')} <span class="required">*</span>
          </label>
          <input
            id="item-href"
            type="text"
            class="form-input"
            class:error={hasFieldError('href')}
            bind:value={formData.href}
            on:blur={generateIdFromHref}
            placeholder={$t('OEBPS/filename.ext')}
            required
          />
          {#if getFieldError('href')}
            <p class="error-message">{getFieldError('href')}</p>
          {/if}
        </div>

        <div class="form-group">
          <label for="item-mediatype" class="form-label">
            {$t('Media Type')} <span class="required">*</span>
          </label>
          <select
            id="item-mediatype"
            class="form-select"
            class:error={hasFieldError('mediaType')}
            bind:value={formData.mediaType}
            required
          >
            <option value="">{$t('Select media type...')}</option>
            {#each mediaTypes as mediaType}
              <option value={mediaType.value}>{mediaType.label}</option>
            {/each}
          </select>
          {#if getFieldError('mediaType')}
            <p class="error-message">{getFieldError('mediaType')}</p>
          {/if}
        </div>

        <div class="form-group">
          <label class="form-label">{$t('EPUB Properties')}</label>
          <div class="checkbox-group">
            {#each epubProperties as property}
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  class="checkbox-input"
                  checked={formData.properties?.includes(property.value) || false}
                  on:change={(e) => handlePropertyChange(property.value, e.currentTarget.checked)}
                />
                {property.label}
              </label>
            {/each}
          </div>
        </div>

        {#if itemEditorMode === 'create-text'}
          <div class="form-group">
            <label for="text-content" class="form-label">
              {$t('Initial Content')}
            </label>
            <textarea
              id="text-content"
              class="form-textarea"
              bind:value={textContent}
              placeholder={$t('Enter the initial content for this text file...')}
              rows="10"
            ></textarea>
            <p class="field-help">
              {$t('You can edit the content later in the main editor')}
            </p>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button type="button" class="cancel-button" on:click={handleClose}>
          {$t('Cancel')}
        </button>
        <button type="submit" class="save-button">
          {#if itemEditorMode === 'create-text'}
            {$t('Create Text File')}
          {:else if itemEditorMode === 'create-file'}
            {$t('Upload File')}
          {:else}
            {$t('Save Changes')}
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .modal-overlay {
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
    background-color: var(--color-surface);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border-default);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
    transition: color 0.2s ease;
  }

  .close-button:hover {
    color: var(--color-text-primary);
  }

  .close-button:focus {
    outline: none;
    color: var(--color-text-primary);
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .form-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .required {
    color: var(--color-error);
  }

  .form-input,
  .form-select,
  .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    transition: border-color 0.2s ease;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--color-focus-ring);
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }

  .form-input.error,
  .form-select.error,
  .form-textarea.error {
    border-color: var(--color-error);
  }

  .form-input::placeholder,
  .form-textarea::placeholder {
    color: var(--color-text-placeholder);
  }

  .file-input {
    width: 100%;
    padding: 0.75rem;
    border: 2px dashed var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-secondary);
    cursor: pointer;
    transition: border-color 0.2s ease;
  }

  .file-input:hover {
    border-color: var(--color-interactive-primary);
  }

  .file-input:focus {
    outline: none;
    border-color: var(--color-focus-ring);
  }

  .file-info {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .checkbox-group {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .checkbox-input {
    width: 1rem;
    height: 1rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-xs);
    background-color: var(--color-surface);
    cursor: pointer;
  }

  .checkbox-input:checked {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .checkbox-input:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }

  .error-message {
    margin-top: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-error);
  }

  .field-help {
    margin-top: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
  }

  .modal-footer {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding: 1.5rem;
    border-top: 1px solid var(--color-border-default);
  }

  .cancel-button,
  .save-button {
    padding: 0.75rem 1.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-button {
    background-color: var(--color-surface);
    color: var(--color-text-primary);
  }

  .cancel-button:hover {
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-hover);
  }

  .save-button {
    background-color: var(--color-primary);
    color: var(--color-surface);
    border-color: var(--color-primary);
  }

  .save-button:hover {
    background-color: var(--color-interactive-primary-hover);
    border-color: var(--color-interactive-primary-hover);
  }

  .cancel-button:focus,
  .save-button:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .modal-content {
      width: 95%;
      max-height: 95vh;
    }

    .modal-header {
      padding: 1rem;
    }

    .form-body {
      padding: 1rem;
    }

    .modal-footer {
      padding: 1rem;
      flex-direction: column;
    }

    .checkbox-group {
      grid-template-columns: 1fr;
    }
  }
</style>