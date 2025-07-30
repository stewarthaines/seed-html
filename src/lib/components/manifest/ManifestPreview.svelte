<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n';
  import type { ManifestItem, SourceItem, ContentPreview } from '../../manifest/types';
  import type { WorkspaceService, WorkspaceState } from '../../services/workspace/workspace.service.js';

  export let selectedItem: ManifestItem | SourceItem | null = null;
  export let selectedItemType: 'manifest' | 'source' | null = null;
  export let workspace: WorkspaceState | null = null;
  export let workspaceService: WorkspaceService;

  const dispatch = createEventDispatcher();

  let contentPreview: ContentPreview | null = null;
  let loading = false;
  let error: string | null = null;

  // Helper function to determine if mediaType represents text content
  const isTextMediaType = (mediaType: string): boolean => {
    return (
      mediaType.startsWith('text/') ||
      mediaType.includes('json') ||
      mediaType.includes('xml') ||
      mediaType.includes('javascript')
    );
  };

  $: if (selectedItem && selectedItemType && workspaceService && workspace) {
    loadContentPreview();
  }

  const loadContentPreview = async () => {
    if (!selectedItem || !selectedItemType || !workspaceService || !workspace) {
      contentPreview = null;
      return;
    }

    try {
      loading = true;
      error = null;

      if (selectedItemType === 'manifest') {
        const manifestItem = selectedItem as ManifestItem;
        // For now, create a simplified preview since we don't have getContentPreview in WorkspaceService yet
        const filePath = manifestItem.href.startsWith(workspace.pathInfo.basePath + '/') ? 
          manifestItem.href : 
          `${workspace.pathInfo.basePath}/${manifestItem.href}`;
        
        try {
          const content = await workspaceService.readFile(workspace.id, filePath);
          const isText = isTextMediaType(manifestItem.mediaType);
          
          let textContent: string | undefined;
          if (isText) {
            const decoder = new TextDecoder('utf-8');
            textContent = decoder.decode(content);
          }
          
          contentPreview = {
            itemId: manifestItem.id,
            mediaType: manifestItem.mediaType,
            contentType: isText ? 'text' : 'binary',
            textContent,
            metadata: {
              characterCount: textContent ? textContent.length : undefined,
              lineCount: textContent ? textContent.split('\n').length : undefined,
              wordCount: textContent
                ? textContent.split(/\s+/).filter(w => w.length > 0).length
                : undefined,
            },
          };
        } catch {
          contentPreview = {
            itemId: manifestItem.id,
            mediaType: manifestItem.mediaType,
            contentType: 'binary',
            error: 'Failed to load content'
          };
        }
      } else {
        // Handle SOURCE items - read and display their content
        const sourceItem = selectedItem as SourceItem;
        try {
          const content = await workspaceService.readFile(workspace.id, sourceItem.path);
          const isText = isTextMediaType(sourceItem.mediaType || 'text/plain');
          
          let textContent: string | undefined;
          if (isText) {
            const decoder = new TextDecoder('utf-8');
            textContent = decoder.decode(content);
          }
          
          contentPreview = {
            itemId: sourceItem.path,
            mediaType: sourceItem.mediaType || 'text/plain',
            contentType: isText ? 'text' : 'binary',
            textContent,
            metadata: {
              characterCount: textContent ? textContent.length : undefined,
              lineCount: textContent ? textContent.split('\n').length : undefined,
              wordCount: textContent
                ? textContent.split(/\s+/).filter(w => w.length > 0).length
                : undefined,
            },
          };
        } catch {
          contentPreview = {
            itemId: sourceItem.path,
            mediaType: sourceItem.mediaType || 'text/plain',
            contentType: 'text',
            error: 'Failed to load SOURCE file content'
          };
        }
      }
    } catch {
      error = $t('Failed to load content preview');
      contentPreview = null;
    } finally {
      loading = false;
    }
  };

  const _handleEditClick = () => {
    if (selectedItem && selectedItemType === 'manifest') {
      dispatch('itemEdit', { item: selectedItem });
    }
  };

  const handleDeleteClick = () => {
    if (selectedItem && selectedItemType === 'manifest') {
      dispatch('itemDelete', { itemId: (selectedItem as ManifestItem).id });
    }
  };

  const handleDownloadClick = () => {
    if (!selectedItem || !workspaceService || !workspace) return;

    // For now, just log - proper download implementation would need file content handling
    console.log('Download requested for:', selectedItem);
    
    // Note: In a real implementation, you would need to get the actual file content
    // and create a blob URL. This is a placeholder.
  };

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return '-';

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const getContentIcon = (contentType: string) => {
    switch (contentType) {
      case 'text':
        return '📄';
      case 'image':
        return '🖼️';
      case 'audio':
        return '🎵';
      case 'video':
        return '🎥';
      default:
        return '📦';
    }
  };
</script>

<div class="manifest-preview">
  {#if !selectedItem}
    <div class="no-selection">
      <p>{$t('Select an item to preview its content')}</p>
      <p class="no-selection-subtitle">{$t('Click on any row in the table to see details')}</p>
    </div>
  {:else if loading}
    <div class="loading-state">
      <p>{$t('Loading preview…')}</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="error-message">{error}</p>
      <button type="button" class="retry-button" on:click={loadContentPreview}>
        {$t('Retry')}
      </button>
    </div>
  {:else}
    <div class="preview-content">
      <!-- Header with item info and actions -->
      <div class="preview-header">
        <div class="preview-info">
          <h2 class="preview-title">
            {selectedItemType === 'manifest'
              ? (selectedItem as ManifestItem).id
              : (selectedItem as SourceItem).name}
          </h2>
          <div class="preview-metadata">
            <span class="item-type">
              {selectedItemType === 'manifest' ? $t('Manifest Item') : $t('SOURCE Item')}
            </span>
            <span class="item-path">
              {selectedItemType === 'manifest'
                ? (selectedItem as ManifestItem).href
                : (selectedItem as SourceItem).path}
            </span>
          </div>
        </div>
        <!-- Action buttons moved to header -->
        <div class="preview-actions">
          {#if selectedItemType === 'manifest'}
            <!-- <button type="button" class="action-button edit-button" on:click={handleEditClick}>
              {$t('Edit')}
            </button> -->
          {/if}
          <button
            type="button"
            class="action-button download-button"
            on:click={handleDownloadClick}
          >
            {$t('Download')}
          </button>
          {#if selectedItemType === 'manifest'}
            <button type="button" class="action-button delete-button" on:click={handleDeleteClick}>
              {$t('Delete')}
            </button>
          {/if}
        </div>
      </div>

      <!-- Content preview -->
      <div class="preview-body">
        {#if contentPreview}
          <div class="content-header">
            <span class="content-type-icon">{getContentIcon(contentPreview.contentType)}</span>
            <span class="content-type">{contentPreview.mediaType}</span>
          </div>

          {#if contentPreview.error}
            <div class="preview-error">
              <p>{$t('Preview Error')}: {contentPreview.error}</p>
            </div>
          {:else if contentPreview.contentType === 'text' && contentPreview.textContent}
            <div class="text-preview">
              <pre class="text-content">{contentPreview.textContent}</pre>
            </div>
          {:else if contentPreview.contentType === 'image' && contentPreview.previewUrl}
            <div class="image-preview">
              <img
                src={contentPreview.previewUrl}
                alt={selectedItemType === 'manifest'
                  ? (selectedItem as ManifestItem).id
                  : (selectedItem as SourceItem).name}
                class="preview-image"
              />
            </div>
          {:else if contentPreview.contentType === 'audio' && contentPreview.previewUrl}
            <div class="audio-preview">
              <audio controls class="preview-audio">
                <source src={contentPreview.previewUrl} type={contentPreview.mediaType} />
                {$t('Your browser does not support the audio element.')}
              </audio>
            </div>
          {:else if contentPreview.contentType === 'video' && contentPreview.previewUrl}
            <div class="video-preview">
              <video controls class="preview-video">
                <track kind="captions" />
                <source src={contentPreview.previewUrl} type={contentPreview.mediaType} />
                {$t('Your browser does not support the video element.')}
              </video>
            </div>
          {:else}
            <div class="binary-preview">
              <p>{$t('Binary file - preview not available')}</p>
              <p class="binary-info">{$t('Use the download button to access the file')}</p>
            </div>
          {/if}

          <!-- Content metadata -->
          {#if contentPreview.metadata}
            <div class="metadata-section">
              <h3>{$t('Content Details')}</h3>
              <dl class="metadata-list">
                {#if contentPreview.metadata.characterCount}
                  <dt>{$t('Characters')}</dt>
                  <dd>{contentPreview.metadata.characterCount.toLocaleString()}</dd>
                {/if}
                {#if contentPreview.metadata.lineCount}
                  <dt>{$t('Lines')}</dt>
                  <dd>{contentPreview.metadata.lineCount.toLocaleString()}</dd>
                {/if}
                {#if contentPreview.metadata.wordCount}
                  <dt>{$t('Words')}</dt>
                  <dd>{contentPreview.metadata.wordCount.toLocaleString()}</dd>
                {/if}
                {#if contentPreview.metadata.width && contentPreview.metadata.height}
                  <dt>{$t('Dimensions')}</dt>
                  <dd>{contentPreview.metadata.width} × {contentPreview.metadata.height}</dd>
                {/if}
                {#if contentPreview.metadata.duration}
                  <dt>{$t('Duration')}</dt>
                  <dd>
                    {Math.floor(contentPreview.metadata.duration / 60)}:{(
                      contentPreview.metadata.duration % 60
                    )
                      .toString()
                      .padStart(2, '0')}
                  </dd>
                {/if}
              </dl>
            </div>
          {/if}
        {/if}

        <!-- File metadata -->
        <div class="file-metadata">
          <h3>{$t('File Information')}</h3>
          <dl class="metadata-list">
            <dt>{$t('Size')}</dt>
            <dd>{formatFileSize(selectedItem.size)}</dd>
            <dt>{$t('Modified')}</dt>
            <dd>{formatDate(selectedItem.modified)}</dd>
            {#if selectedItemType === 'manifest' && (selectedItem as ManifestItem).properties && ((selectedItem as ManifestItem).properties?.length ?? 0) > 0}
              <dt>{$t('Properties')}</dt>
              <dd>
                <div class="properties-list">
                  {#each (selectedItem as ManifestItem).properties || [] as property}
                    <span class="property-tag">{property}</span>
                  {/each}
                </div>
              </dd>
            {/if}
          </dl>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .manifest-preview {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--color-surface);
  }

  .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    text-align: center;
    color: var(--color-text-secondary);
  }

  .no-selection p {
    margin: 0.5rem 0;
  }

  .no-selection-subtitle {
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    text-align: center;
  }

  .error-message {
    color: var(--color-error);
    margin-block-end: 1rem;
  }

  .retry-button {
    padding: 0.75rem 1.5rem;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    background-color: var(--color-primary);
    color: var(--color-surface);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-button:hover {
    background-color: var(--color-interactive-primary-hover);
    border-color: var(--color-interactive-primary-hover);
  }

  .retry-button:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }

  .preview-content {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .preview-header {
    flex-shrink: 0;
    padding: 1rem;
    border-bottom: 1px solid var(--color-border-default);
    background-color: var(--color-surface-secondary);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .preview-info {
    flex: 1;
    min-width: 0;
  }

  .preview-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 0.5rem 0;
    word-break: break-word;
  }

  .preview-metadata {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .item-type {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .item-path {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
    word-break: break-all;
  }

  .preview-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .content-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .content-type-icon {
    font-size: 1.25rem;
  }

  .content-type {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .preview-error {
    color: var(--color-error);
    padding: 1rem;
    background-color: var(--color-error-subtle);
    border-radius: var(--radius-sm);
    margin-bottom: 1rem;
  }

  .text-preview {
    margin-bottom: 1rem;
  }

  .text-content {
    background-color: var(--color-surface-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    padding: 1rem;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.4;
    max-height: 400px;
    overflow: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .image-preview,
  .audio-preview,
  .video-preview {
    margin-bottom: 1rem;
  }

  .preview-image {
    max-width: 100%;
    height: auto;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
  }

  .preview-audio {
    width: 100%;
    max-width: 400px;
  }

  .preview-video {
    width: 100%;
    max-width: 600px;
    height: auto;
    border-radius: var(--radius-sm);
  }

  .binary-preview {
    padding: 1rem;
    background-color: var(--color-surface-secondary);
    border-radius: var(--radius-sm);
    text-align: center;
    color: var(--color-text-secondary);
    margin-bottom: 1rem;
  }

  .binary-info {
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  .metadata-section,
  .file-metadata {
    margin-bottom: 1rem;
  }

  .metadata-section h3,
  .file-metadata h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 0.5rem 0;
  }

  .metadata-list {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.5rem 1rem;
    font-size: 0.875rem;
  }

  .metadata-list dt {
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .metadata-list dd {
    margin: 0;
    color: var(--color-text-primary);
  }

  .properties-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .property-tag {
    background-color: var(--color-primary-subtle);
    color: var(--color-primary);
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-xs);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .preview-actions {
    flex-shrink: 0;
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .action-button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-button:hover {
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-hover);
  }

  .action-button:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }

  .download-button:hover {
    color: var(--color-interactive-secondary);
    border-color: var(--color-interactive-secondary);
  }

  .delete-button:hover {
    color: var(--color-error);
    border-color: var(--color-error);
  }
</style>
