<script lang="ts">
  import {
    createMockContentPreview,
    createErrorContentPreview,
  } from './mock-data/content-previews.js';
  import { createMockManifestItem } from './mock-data/manifest-items.js';
  import type { ManifestItem, ContentPreview } from '../../lib/manifest/types.js';

  // Story props
  export let contentType = 'none';
  export let selectedItemId = '';
  export let isLoading = false;
  export let hasError = false;
  export let showMetadata = true;
  export let enableActions = true;
  export let contentSize = 'medium';

  // Mock data based on content type
  $: mockItem = (() => {
    if (!selectedItemId || contentType === 'none') return null;

    const mediaTypeMap = {
      text: 'application/xhtml+xml',
      image: 'image/jpeg',
      audio: 'audio/mpeg',
      video: 'video/mp4',
      binary: 'font/woff2',
    };

    const hrefMap = {
      text: 'OEBPS/chapter1.xhtml',
      image: 'OEBPS/images/cover.jpg',
      audio: 'OEBPS/audio/pronunciation.mp3',
      video: 'OEBPS/video/introduction.mp4',
      binary: 'OEBPS/fonts/source-serif-pro.woff2',
    };

    return createMockManifestItem({
      id: selectedItemId,
      href: hrefMap[contentType as keyof typeof hrefMap] || 'OEBPS/file.txt',
      mediaType:
        mediaTypeMap[contentType as keyof typeof mediaTypeMap] || 'application/octet-stream',
      size: contentSize === 'small' ? 1024 : contentSize === 'large' ? 1048576 : 12456,
    });
  })();

  $: contentPreview = (() => {
    if (!mockItem) return null;
    if (hasError) return createErrorContentPreview(mockItem.id, mockItem.mediaType);
    return createMockContentPreview(mockItem.id, mockItem.href, mockItem.mediaType);
  })();

  // Mock action handlers
  const handleEdit = () => {
    console.log('Edit item:', selectedItemId);
  };

  const handleDownload = () => {
    console.log('Download item:', selectedItemId);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this item?')) {
      console.log('Delete item:', selectedItemId);
    }
  };

  const handleRetry = () => {
    console.log('Retry loading:', selectedItemId);
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format duration for audio/video
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
</script>

<div class="manifest-preview-demo">
  {#if contentType === 'none' || !selectedItemId}
    <!-- Empty state -->
    <div class="manifest-empty">
      <h3>No Item Selected</h3>
      <p>Select an item from the manifest table to preview its content.</p>
    </div>
  {:else if isLoading}
    <!-- Loading state -->
    <div class="manifest-preview">
      <div class="preview-header">
        <h3>Loading Preview...</h3>
        <div class="loading-indicator">
          <div class="spinner"></div>
          <span>Loading content for {selectedItemId}</span>
        </div>
      </div>
      <div class="manifest-preview-content loading">
        <div class="skeleton-lines">
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
    </div>
  {:else if hasError}
    <!-- Error state -->
    <div class="manifest-preview">
      <div class="preview-header">
        <h3>Preview Error</h3>
      </div>
      <div class="manifest-preview-content error">
        <div class="error-icon">⚠️</div>
        <h4>Failed to Load Content</h4>
        <p>
          Could not load content for "{selectedItemId}". The file may be corrupted or inaccessible.
        </p>
        <button type="button" class="retry-button" on:click={handleRetry}> Try Again </button>
      </div>
    </div>
  {:else if mockItem && contentPreview}
    <!-- Content preview -->
    <div class="manifest-preview">
      <div class="preview-header">
        <h3>{mockItem.id}</h3>
        <span class="item-path">{mockItem.href}</span>
      </div>

      <!-- Content display based on type -->
      <div class="manifest-preview-content">
        {#if contentPreview.contentType === 'text' && contentPreview.textContent}
          <pre><code>{contentPreview.textContent}</code></pre>
        {:else if contentPreview.contentType === 'image' && contentPreview.previewUrl}
          <img
            src={contentPreview.previewUrl}
            alt="Preview of {mockItem.id}"
            class="preview-image"
          />
        {:else if contentPreview.contentType === 'audio' && contentPreview.previewUrl}
          <audio controls class="preview-audio">
            <source src={contentPreview.previewUrl} type={mockItem.mediaType} />
            Your browser does not support the audio element.
          </audio>
        {:else if contentPreview.contentType === 'video' && contentPreview.previewUrl}
          <video controls class="preview-video">
            <source src={contentPreview.previewUrl} type={mockItem.mediaType} />
            Your browser does not support the video element.
          </video>
        {:else}
          <div class="binary-file-info">
            <div class="file-icon">📄</div>
            <h4>Binary File</h4>
            <p>Preview not available for this file type.</p>
            <p class="media-type">{mockItem.mediaType}</p>
          </div>
        {/if}
      </div>

      <!-- Metadata section -->
      {#if showMetadata}
        <div class="manifest-preview-metadata">
          <dl>
            <dt>File Size</dt>
            <dd>{formatFileSize(mockItem.size || 0)}</dd>

            <dt>Media Type</dt>
            <dd>{mockItem.mediaType}</dd>

            <dt>Modified</dt>
            <dd>{mockItem.modified?.toLocaleDateString() || 'Unknown'}</dd>

            {#if contentPreview.metadata}
              {#if contentPreview.metadata.width && contentPreview.metadata.height}
                <dt>Dimensions</dt>
                <dd>{contentPreview.metadata.width} × {contentPreview.metadata.height}</dd>
              {/if}

              {#if contentPreview.metadata.duration}
                <dt>Duration</dt>
                <dd>{formatDuration(contentPreview.metadata.duration)}</dd>
              {/if}

              {#if contentPreview.metadata.bitrate}
                <dt>Bitrate</dt>
                <dd>{contentPreview.metadata.bitrate} kbps</dd>
              {/if}

              {#if contentPreview.metadata.characterCount}
                <dt>Characters</dt>
                <dd>{contentPreview.metadata.characterCount.toLocaleString()}</dd>
              {/if}

              {#if contentPreview.metadata.wordCount}
                <dt>Words</dt>
                <dd>{contentPreview.metadata.wordCount.toLocaleString()}</dd>
              {/if}

              {#if contentPreview.metadata.lineCount}
                <dt>Lines</dt>
                <dd>{contentPreview.metadata.lineCount.toLocaleString()}</dd>
              {/if}
            {/if}

            {#if mockItem.properties && mockItem.properties.length > 0}
              <dt>Properties</dt>
              <dd>{mockItem.properties.join(', ')}</dd>
            {/if}
          </dl>
        </div>
      {/if}

      <!-- Action buttons -->
      {#if enableActions}
        <div class="manifest-preview-actions">
          <button type="button" on:click={handleEdit}> Edit </button>
          <button type="button" on:click={handleDownload}> Download </button>
          <button type="button" class="danger" on:click={handleDelete}> Delete </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  @import './manifest-demo.css';

  .manifest-preview-demo {
    height: 100vh;
    background-color: var(--color-surface-primary, #f9fafb);
  }

  .preview-header {
    padding: var(--spacing-4, 1rem);
    border-bottom: 1px solid var(--color-border-primary, #e5e7eb);
    background-color: var(--color-surface-secondary, #f9fafb);
  }

  .preview-header h3 {
    margin: 0 0 var(--spacing-2, 0.5rem) 0;
    font-size: var(--font-size-lg, 1.125rem);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text-primary, #374151);
  }

  .item-path {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--color-text-secondary, #6b7280);
    font-family: var(--font-family-mono, 'Fira Code', monospace);
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    gap: var(--spacing-3, 0.75rem);
    color: var(--color-text-secondary, #6b7280);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--color-border-primary, #e5e7eb);
    border-top: 2px solid var(--color-primary-500, #3b82f6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .manifest-preview-content.loading {
    padding: var(--spacing-6, 1.5rem);
  }

  .skeleton-lines {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3, 0.75rem);
  }

  .skeleton-line {
    height: 1rem;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
    border-radius: var(--border-radius-sm, 0.25rem);
  }

  .skeleton-line.short {
    width: 60%;
  }

  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  .manifest-preview-content.error {
    text-align: center;
    padding: var(--spacing-8, 2rem);
  }

  .error-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-4, 1rem);
  }

  .manifest-preview-content.error h4 {
    margin: 0 0 var(--spacing-2, 0.5rem) 0;
    color: var(--color-error-600, #dc2626);
    font-size: var(--font-size-lg, 1.125rem);
  }

  .manifest-preview-content.error p {
    margin-bottom: var(--spacing-4, 1rem);
    color: var(--color-text-secondary, #6b7280);
  }

  .retry-button {
    padding: var(--spacing-2, 0.5rem) var(--spacing-4, 1rem);
    background-color: var(--color-primary-600, #2563eb);
    color: var(--color-white, white);
    border: none;
    border-radius: var(--border-radius-md, 0.375rem);
    font-size: var(--font-size-sm, 0.875rem);
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .retry-button:hover {
    background-color: var(--color-primary-700, #1d4ed8);
  }

  .preview-image {
    max-width: 100%;
    height: auto;
    border-radius: var(--border-radius-md, 0.375rem);
    box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
  }

  .preview-audio,
  .preview-video {
    width: 100%;
    max-width: 32rem;
  }

  .preview-video {
    max-height: 24rem;
  }

  .binary-file-info {
    text-align: center;
    padding: var(--spacing-8, 2rem);
  }

  .file-icon {
    font-size: 4rem;
    margin-bottom: var(--spacing-4, 1rem);
  }

  .binary-file-info h4 {
    margin: 0 0 var(--spacing-2, 0.5rem) 0;
    color: var(--color-text-primary, #374151);
  }

  .binary-file-info p {
    margin-bottom: var(--spacing-2, 0.5rem);
    color: var(--color-text-secondary, #6b7280);
  }

  .media-type {
    font-family: var(--font-family-mono, 'Fira Code', monospace);
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--color-text-tertiary, #9ca3af);
  }
</style>
