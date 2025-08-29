<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { t } from '../../i18n';
  import type { ManifestItem, SourceItem, ContentPreview } from '../../manifest/types';
  import type {
    WorkspaceService,
    WorkspaceState,
  } from '../../services/workspace/workspace.service.js';

  export let selectedItem: ManifestItem | SourceItem | any | null = null;
  export let selectedItemType: 'manifest' | 'source' | 'opf' | null = null;
  export let workspace: WorkspaceState | null = null;
  export let workspaceService: WorkspaceService | undefined = undefined;

  const dispatch = createEventDispatcher();

  let contentPreview: ContentPreview | null = null;
  let loading = false;
  let error: string | null = null;
  let activeBlobUrl: string | null = null;

  // Helper function to determine if mediaType represents text content
  const isTextMediaType = (mediaType: string): boolean => {
    return (
      mediaType.startsWith('text/') ||
      mediaType.includes('json') ||
      mediaType.includes('xml') ||
      mediaType.includes('javascript')
    );
  };

  // Helper function to determine if mediaType represents image content
  const isImageMediaType = (mediaType: string): boolean => {
    return mediaType.startsWith('image/');
  };

  // Helper function to determine if mediaType represents audio content
  const isAudioMediaType = (mediaType: string): boolean => {
    return mediaType.startsWith('audio/');
  };

  // Helper function to determine if mediaType represents video content
  const isVideoMediaType = (mediaType: string): boolean => {
    return mediaType.startsWith('video/');
  };

  // Helper function to determine if content should use LTR direction (for technical files)
  const shouldUseLtrDirection = (mediaType: string): boolean => {
    return (
      mediaType.includes('css') ||
      mediaType.includes('javascript') ||
      mediaType.includes('json') ||
      mediaType.includes('xml') ||
      mediaType.startsWith('text/css') ||
      mediaType.startsWith('text/javascript') ||
      mediaType.startsWith('application/json') ||
      mediaType.startsWith('application/xml') ||
      mediaType.startsWith('application/xhtml+xml')
    );
  };

  // Clean up blob URLs to prevent memory leaks
  const cleanupBlobUrl = () => {
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
      activeBlobUrl = null;
    }
  };

  $: if (selectedItem && selectedItemType && workspaceService && workspace) {
    loadContentPreview();
  }

  // Clean up on component destroy
  onDestroy(() => {
    cleanupBlobUrl();
  });

  const loadContentPreview = async () => {
    if (!selectedItem || !selectedItemType || !workspaceService || !workspace) {
      contentPreview = null;
      cleanupBlobUrl();
      return;
    }

    try {
      loading = true;
      error = null;
      cleanupBlobUrl();

      if (selectedItemType === 'manifest') {
        const manifestItem = selectedItem as ManifestItem;
        // For now, create a simplified preview since we don't have getContentPreview in WorkspaceService yet
        const filePath = manifestItem.href.startsWith(workspace.pathInfo.basePath + '/')
          ? manifestItem.href
          : `${workspace.pathInfo.basePath}/${manifestItem.href}`;

        try {
          let content;
          try {
            content = await workspaceService.readFile(workspace.id, filePath);
          } catch (err) {
            // Try original href if constructed path fails
            content = await workspaceService.readFile(workspace.id, manifestItem.href);
          }

          const isText = isTextMediaType(manifestItem.mediaType);
          const isImage = isImageMediaType(manifestItem.mediaType);
          const isAudio = isAudioMediaType(manifestItem.mediaType);
          const isVideo = isVideoMediaType(manifestItem.mediaType);

          let textContent: string | undefined;
          let previewUrl: string | undefined;
          let contentType: 'text' | 'image' | 'audio' | 'video' | 'binary';

          if (isText) {
            const decoder = new TextDecoder('utf-8');
            textContent = decoder.decode(content);
            contentType = 'text';
          } else if (isImage) {
            // Create blob URL for image preview
            const blob = new Blob([content], { type: manifestItem.mediaType });
            previewUrl = URL.createObjectURL(blob);
            activeBlobUrl = previewUrl;
            contentType = 'image';
          } else if (isAudio) {
            // Create blob URL for audio preview
            const blob = new Blob([content], { type: manifestItem.mediaType });
            previewUrl = URL.createObjectURL(blob);
            activeBlobUrl = previewUrl;
            contentType = 'audio';
          } else if (isVideo) {
            // Create blob URL for video preview
            const blob = new Blob([content], { type: manifestItem.mediaType });
            previewUrl = URL.createObjectURL(blob);
            activeBlobUrl = previewUrl;
            contentType = 'video';
          } else {
            contentType = 'binary';
          }

          contentPreview = {
            itemId: manifestItem.id,
            mediaType: manifestItem.mediaType,
            contentType,
            textContent,
            previewUrl,
            metadata: {
              characterCount: textContent ? textContent.length : undefined,
              lineCount: textContent ? textContent.split('\n').length : undefined,
              wordCount: textContent
                ? textContent.split(/\s+/).filter(w => w.length > 0).length
                : undefined,
            },
          };
        } catch (err) {
          contentPreview = {
            itemId: manifestItem.id,
            mediaType: manifestItem.mediaType,
            contentType: 'binary',
            error: 'Failed to load content',
          };
        }
      } else if (selectedItemType === 'source') {
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
            error: 'Failed to load SOURCE file content',
          };
        }
      } else if (selectedItemType === 'opf') {
        // Handle OPF file - read the content.opf file directly
        const opfItem = selectedItem as any;
        try {
          const content = await workspaceService.readFile(
            workspace.id,
            workspace.pathInfo.rootfilePath
          );
          const decoder = new TextDecoder('utf-8');
          const textContent = decoder.decode(content);

          contentPreview = {
            itemId: opfItem.name,
            mediaType: 'application/xml',
            contentType: 'text',
            textContent,
            metadata: {
              characterCount: textContent.length,
              lineCount: textContent.split('\n').length,
              wordCount: textContent.split(/\s+/).filter(w => w.length > 0).length,
            },
          };
        } catch {
          contentPreview = {
            itemId: opfItem.name,
            mediaType: 'application/xml',
            contentType: 'text',
            error: 'Failed to load content.opf file',
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

  const handleEditClick = () => {
    if (selectedItem && selectedItemType === 'manifest') {
      dispatch('itemEdit', { item: selectedItem });
    }
  };

  const handleDeleteClick = () => {
    if (selectedItem && selectedItemType === 'manifest') {
      dispatch('itemDelete', { itemId: (selectedItem as ManifestItem).id });
    }
  };

  const handleDownloadClick = async () => {
    if (!selectedItem || !workspaceService || !workspace) return;

    try {
      let content: ArrayBuffer;
      let filename: string;
      let mimeType: string;

      if (selectedItemType === 'manifest') {
        const manifestItem = selectedItem as ManifestItem;
        
        // Resolve file path using same logic as loadContentPreview
        const filePath = manifestItem.href.startsWith(workspace.pathInfo.basePath + '/')
          ? manifestItem.href
          : `${workspace.pathInfo.basePath}/${manifestItem.href}`;

        try {
          content = await workspaceService.readFile(workspace.id, filePath);
        } catch {
          // Try original href if constructed path fails
          content = await workspaceService.readFile(workspace.id, manifestItem.href);
        }

        // Extract filename from href (remove directory prefix)
        filename = manifestItem.href.split('/').pop() || manifestItem.id;
        mimeType = manifestItem.mediaType;
        
      } else if (selectedItemType === 'source') {
        const sourceItem = selectedItem as SourceItem;
        content = await workspaceService.readFile(workspace.id, sourceItem.path);
        filename = sourceItem.name || sourceItem.path.split('/').pop() || 'source-file';
        mimeType = sourceItem.mediaType || 'application/octet-stream';
        
      } else if (selectedItemType === 'opf') {
        content = await workspaceService.readFile(workspace.id, workspace.pathInfo.rootfilePath);
        filename = 'content.opf';
        mimeType = 'application/xml';
      } else {
        return;
      }

      // Create blob and download link
      const blob = new Blob([content], { type: mimeType });
      const downloadUrl = URL.createObjectURL(blob);
      
      // Create temporary download link and trigger download
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;
      downloadLink.style.display = 'none';
      
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Clean up blob URL
      URL.revokeObjectURL(downloadUrl);
      
    } catch (err) {
      console.error('Download failed:', err);
      // Could dispatch an error event or show a toast notification here
    }
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
        <!-- Action buttons moved to header -->
        <div class="preview-actions">
          {#if selectedItemType === 'manifest'}
            <button type="button" class="action-button edit-button" on:click={handleEditClick}>
              {$t('Edit')}
            </button>
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
              <pre
                class="text-content"
                dir={shouldUseLtrDirection(contentPreview.mediaType)
                  ? 'ltr'
                  : undefined}>{contentPreview.textContent}</pre>
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
        {/if}
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


  .preview-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
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
    flex: 1;
  }

  .text-content {
    background-color: var(--color-surface-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    padding: 1rem;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.4;
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

  .edit-button:hover {
    color: var(--color-interactive-primary);
    border-color: var(--color-interactive-primary);
  }

  .delete-button:hover {
    color: var(--color-error);
    border-color: var(--color-error);
  }
</style>
