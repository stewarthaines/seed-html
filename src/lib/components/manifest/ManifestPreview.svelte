<script lang="ts">
  import { onDestroy } from 'svelte';
  import { t } from '../../i18n';
  import PaneHeader from '../layout/PaneHeader.svelte';
  import type { ManifestItem, SourceItem, ContentPreview } from '../../manifest/types';
  import type {
    WorkspaceService,
    WorkspaceState,
  } from '../../services/workspace/workspace.service.js';

  let {
    selectedItem = null,
    selectedItemType = null,
    workspace = null,
    workspaceService = undefined,
    onWorkspaceUpdate = undefined,
    onItemDelete,
    onSourceDelete,
    readOnly = false,
  }: {
    selectedItem?: ManifestItem | SourceItem | any | null;
    selectedItemType?: 'manifest' | 'source' | 'opf' | null;
    workspace?: WorkspaceState | null;
    // Propagate manifest edits to global app state (keeps content.opf, the
    // table, and the in-memory workspace in lockstep).
    workspaceService?: WorkspaceService;
    onWorkspaceUpdate?: (workspace: WorkspaceState) => void;
    onItemDelete?: (detail: { itemId: string }) => void;
    /** Delete a transform-created SOURCE/data/ file (not in the OPF manifest). */
    onSourceDelete?: (detail: { path: string }) => void;
    /** Read-only EPUB: no edit fields, no delete. */
    readOnly?: boolean;
  } = $props();

  // --- Inline manifest-item editing -------------------------------------------
  // EPUB properties that apply to XHTML content documents. (cover-image is the
  // only manifest property that targets an image rather than XHTML; it isn't
  // offered here.)
  const XHTML_PROPERTIES = [
    { value: 'mathml', label: 'MathML' },
    { value: 'nav', label: 'Navigation' },
    { value: 'remote-resources', label: 'Remote Resources' },
    { value: 'scripted', label: 'Scripted' },
    { value: 'svg', label: 'SVG' },
  ];

  let liveItem = $state<ManifestItem | null>(null);
  let editId = $state('');
  let editHref = $state('');
  let editProperties = $state<string[]>([]);
  let editError = $state<string | null>(null);

  // Only manifest items get the edit form; SOURCE/ files, the bundled editor-
  // source archive (SEED.zip) and content.opf stay preview-only.
  const isManifestItem = $derived(
    selectedItemType === 'manifest' && !!selectedItem && 'id' in selectedItem
  );
  // XHTML content documents (chapters, nav) are named via the spine/chapter
  // system, so we don't expose id/href here; instead they get EPUB properties.
  // Other media (images, audio, fonts, CSS, JS) get editable id/href, no
  // properties. Media type is fixed at upload and shown read-only in the header.
  const isXhtmlItem = $derived(
    isManifestItem && (selectedItem as ManifestItem).mediaType === 'application/xhtml+xml'
  );
  // Images can additionally be marked as the publication cover (cover-image is
  // the one manifest property that targets an image rather than XHTML).
  const isImageItem = $derived(
    isManifestItem && (selectedItem as ManifestItem).mediaType.startsWith('image/')
  );
  // The selected item's path, shown as the right-pane header label.
  const itemLabel = $derived(
    (selectedItem as { href?: string; path?: string } | null)?.href ??
      (selectedItem as { href?: string; path?: string } | null)?.path ??
      ''
  );

  // Reseed the form whenever the selected item changes (not on our own edits).
  $effect(() => {
    if (isManifestItem) {
      seedEditForm(selectedItem as ManifestItem);
    } else {
      liveItem = null;
    }
  });

  function seedEditForm(item: ManifestItem) {
    liveItem = item;
    editId = item.id;
    editHref = item.href;
    editProperties = [...(item.properties ?? [])];
    editError = null;
  }

  async function persistEdit(updates: Partial<ManifestItem>) {
    if (!workspace || !workspaceService || !liveItem) return;
    try {
      const updated = await workspaceService.updateManifestItem(workspace, liveItem.id, updates);
      // Track the live item by its (possibly new) id so further edits target it.
      const newId = updates.id ?? liveItem.id;
      liveItem = updated.opf.manifest.find(m => m.id === newId) ?? { ...liveItem, ...updates };
      // Re-seed the form from the persisted item so fields reflect any
      // normalization the service applied (e.g. a sanitized file path).
      seedEditForm(liveItem);
      editError = null;
      onWorkspaceUpdate?.(updated);
    } catch (err) {
      editError = err instanceof Error ? err.message : $t('Failed to update item');
      // Revert the form to the last persisted values.
      if (liveItem) seedEditForm(liveItem);
    }
  }

  const commitId = () => {
    if (!liveItem || isXhtmlItem) return;
    const value = editId.trim();
    if (!value || value === liveItem.id) {
      editId = liveItem.id;
      return;
    }
    persistEdit({ id: value });
  };

  const commitHref = () => {
    if (!liveItem || isXhtmlItem) return;
    const value = editHref.trim();
    if (!value || value === liveItem.href) {
      editHref = liveItem.href;
      return;
    }
    persistEdit({ href: value });
  };

  const toggleProperty = (value: string, checked: boolean) => {
    editProperties = checked ? [...editProperties, value] : editProperties.filter(p => p !== value);
    persistEdit({ properties: editProperties.length ? editProperties : undefined });
  };

  // Mark/unmark this image as the cover. EPUB allows a single cover image, so
  // marking one clears the property from any other item that carries it.
  const setCoverImage = async (checked: boolean) => {
    const item = liveItem;
    if (!workspace || !workspaceService || !item) return;
    try {
      let ws = workspace;
      if (checked) {
        for (const other of ws.opf.manifest) {
          if (other.id !== item.id && other.properties?.includes('cover-image')) {
            ws = await workspaceService.updateManifestItem(ws, other.id, {
              properties: other.properties.filter(p => p !== 'cover-image'),
            });
          }
        }
      }
      const nextProps = checked
        ? [...editProperties.filter(p => p !== 'cover-image'), 'cover-image']
        : editProperties.filter(p => p !== 'cover-image');
      editProperties = nextProps;
      const updated = await workspaceService.updateManifestItem(ws, item.id, {
        properties: nextProps.length ? nextProps : undefined,
      });
      liveItem = updated.opf.manifest.find(m => m.id === item.id) ?? item;
      editError = null;
      onWorkspaceUpdate?.(updated);
    } catch (err) {
      editError = err instanceof Error ? err.message : $t('Failed to update item');
      seedEditForm(item);
    }
  };

  let contentPreview = $state<ContentPreview | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
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

  $effect(() => {
    if (selectedItem && selectedItemType && workspaceService && workspace) {
      loadContentPreview();
    }
  });

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
        // Use the live (possibly just-edited) item so a renamed File Path is
        // read from its new location rather than the stale selectedItem prop.
        const manifestItem = (liveItem ?? selectedItem) as ManifestItem;
        // For now, create a simplified preview since we don't have getContentPreview in WorkspaceService yet
        const filePath = manifestItem.href.startsWith(workspace.pathInfo.basePath + '/')
          ? manifestItem.href
          : `${workspace.pathInfo.basePath}/${manifestItem.href}`;

        try {
          let content;
          try {
            content = await workspaceService.readFile(workspace.id, filePath);
          } catch {
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

          // Image is checked before text: SVG matches both (its media type
          // contains "xml"), and we want the rendered preview, plus the source
          // shown beneath it.
          if (isImage) {
            // Create blob URL for image preview
            const blob = new Blob([content], { type: manifestItem.mediaType });
            previewUrl = URL.createObjectURL(blob);
            activeBlobUrl = previewUrl;
            contentType = 'image';
            // SVG: also expose the source so the template can render both
            if (manifestItem.mediaType === 'image/svg+xml') {
              textContent = new TextDecoder('utf-8').decode(content);
            }
          } else if (isText) {
            const decoder = new TextDecoder('utf-8');
            textContent = decoder.decode(content);
            contentType = 'text';
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
        } catch {
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

  // A SOURCE/data/ file (created by a transform script) is the only SOURCE item
  // we allow deleting here — chapter text, settings and scripts stay protected.
  const isDeletableSource = $derived(
    selectedItemType === 'source' &&
      !!selectedItem &&
      typeof (selectedItem as SourceItem).path === 'string' &&
      (selectedItem as SourceItem).path.startsWith('SOURCE/data/')
  );

  const handleDeleteClick = () => {
    if (selectedItemType === 'manifest' && selectedItem) {
      onItemDelete?.({ itemId: (selectedItem as ManifestItem).id });
    } else if (isDeletableSource) {
      onSourceDelete?.({ path: (selectedItem as SourceItem).path });
    }
  };

  const handleDownloadClick = async () => {
    if (!selectedItem || !workspaceService || !workspace) return;

    try {
      let content: ArrayBuffer;
      let filename: string;
      let mimeType: string;

      if (selectedItemType === 'manifest') {
        // Use the live (possibly just-edited) item so a renamed File Path
        // downloads from its new location.
        const manifestItem = (liveItem ?? selectedItem) as ManifestItem;

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
      <button type="button" class="btn btn-primary" onclick={loadContentPreview}>
        {$t('Retry')}
      </button>
    </div>
  {:else}
    <div class="preview-content">
      <!-- Right pane header: item label (main) + Download/Delete (actions). -->
      <PaneHeader>
        <span class="preview-item-label" title={itemLabel}>{itemLabel}</span>
        {#snippet actions()}
          <button type="button" class="btn btn-secondary" onclick={handleDownloadClick}>
            {$t('Download')}
          </button>
          {#if (selectedItemType === 'manifest' || isDeletableSource) && !readOnly}
            <button type="button" class="btn btn-danger" onclick={handleDeleteClick}>
              {$t('Delete')}
            </button>
          {/if}
        {/snippet}
      </PaneHeader>

      {#if isManifestItem && !readOnly}
        <!-- Inline manifest-item editor (compact; saves on blur / toggle).
             XHTML items show EPUB properties; other media show editable
             id/href. Media type is fixed at upload (shown in the header). -->
        <div class="item-edit-form">
          {#if isXhtmlItem}
            <fieldset class="edit-properties">
              <legend class="edit-label">{$t('EPUB Properties')}</legend>
              <div class="edit-properties-grid">
                {#each XHTML_PROPERTIES as property}
                  <label class="edit-checkbox">
                    <input
                      type="checkbox"
                      checked={editProperties.includes(property.value)}
                      onchange={e => toggleProperty(property.value, e.currentTarget.checked)}
                    />
                    {property.label}
                  </label>
                {/each}
              </div>
            </fieldset>
          {:else}
            <div class="edit-field">
              <label class="edit-label" for="manifest-edit-id">{$t('ID')}</label>
              <input
                id="manifest-edit-id"
                class="edit-input"
                type="text"
                dir="ltr"
                bind:value={editId}
                onblur={commitId}
              />
            </div>

            <div class="edit-field">
              <label class="edit-label" for="manifest-edit-href">{$t('File Path')}</label>
              <input
                id="manifest-edit-href"
                class="edit-input"
                type="text"
                dir="ltr"
                bind:value={editHref}
                onblur={commitHref}
              />
            </div>

            {#if isImageItem}
              <label class="edit-checkbox">
                <input
                  type="checkbox"
                  checked={editProperties.includes('cover-image')}
                  onchange={e => setCoverImage(e.currentTarget.checked)}
                />
                {$t('Cover image')}
              </label>
            {/if}
          {/if}

          {#if editError}
            <p class="edit-error" role="alert">{editError}</p>
          {/if}
        </div>
      {/if}

      <!-- Content preview -->
      <div class="preview-body">
        {#if contentPreview}
          <div class="content-header">
            <span class="content-type">{contentPreview.mediaType}</span>
          </div>

          {#if contentPreview.error}
            <div class="preview-error">
              <p>{$t('Preview Error')}: {contentPreview.error}</p>
            </div>
          {:else if contentPreview.contentType === 'text' && typeof contentPreview.textContent === 'string'}
            <div class="text-preview">
              {#if contentPreview.textContent.length === 0}
                <!-- A 0-byte text file is empty, not binary — say so plainly. -->
                <p class="empty-file-note">{$t('This file is empty.')}</p>
              {:else}
                <pre
                  class="text-content"
                  dir={shouldUseLtrDirection(contentPreview.mediaType)
                    ? 'ltr'
                    : undefined}>{contentPreview.textContent}</pre>
              {/if}
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
            {#if contentPreview.mediaType === 'image/svg+xml' && contentPreview.textContent}
              <div class="text-preview">
                <pre class="text-content" dir="ltr">{contentPreview.textContent}</pre>
              </div>
            {/if}
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
    background-color: var(--color-bg-primary);
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
    color: var(--color-text-secondary);
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

  .preview-content {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .preview-item-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    direction: ltr;
  }

  .item-edit-form {
    flex-shrink: 0;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border-default);
    background-color: var(--color-surface-secondary);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .edit-field {
    display: grid;
    grid-template-columns: 6rem 1fr;
    align-items: center;
    gap: 0.5rem;
  }

  .edit-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .edit-input {
    width: 100%;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: 0.8125rem;
  }

  .edit-input:focus {
    outline: none;
    border-color: var(--color-focus-ring);
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }

  .edit-properties {
    border: none;
    margin: 0;
    padding: 0;
  }

  .edit-properties-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.25rem 0.75rem;
    margin-top: 0.25rem;
  }

  .edit-checkbox {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .edit-error {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-error);
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

  .empty-file-note {
    padding: 1rem;
    font-style: italic;
    color: var(--color-text-secondary);
  }
</style>
