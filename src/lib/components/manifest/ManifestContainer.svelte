<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../i18n';
  import ManifestTable from './ManifestTable.svelte';
  import ImportReviewDialog from '../import/ImportReviewDialog.svelte';
  import { ManifestUtils } from '../../manifest/utils.js';
  import { generateEPUBPath, ensureUniqueHref } from '../../epub/opf-utils.js';
  import { FileStorageAPI } from '../../storage/index.js';
  import { hasSeedHtml } from '../../epub/seed-html.js';
  import { manifestCollision } from '../../import/collision.js';
  import { showToast } from '../../stores/toast.svelte.js';
  import {
    stageFiles,
    readStagedBytes,
    clearImportStaging,
    type StagedFile,
  } from '../../import/import-staging.js';
  import type { ReviewDecision, ReviewItem, ReviewPreview } from '../../import/types.js';
  import type { ManifestItem, SourceItem, ValidationResult } from '../../manifest/types';
  import type {
    WorkspaceService,
    WorkspaceState,
  } from '../../services/workspace/workspace.service.js';

  // Props using Svelte 5 runes syntax
  let {
    workspace = null,
    workspaceService,
    advancedMode = true,
    readOnly = false,
    refreshToken = 0,
    onItemSelect,
    onWorkspaceUpdate,
  }: {
    workspace?: WorkspaceState | null;
    workspaceService: WorkspaceService;
    advancedMode?: boolean;
    /** Read-only EPUB: no upload/delete. */
    readOnly?: boolean;
    /** Bump to force a reload of the file list (e.g. after a SOURCE/data delete). */
    refreshToken?: number;
    onItemSelect?: (event: {
      item: ManifestItem | SourceItem | any;
      type: 'manifest' | 'source' | 'opf';
    }) => void;
    onWorkspaceUpdate?: (workspace: WorkspaceState) => void;
  } = $props();

  // Component state using runes
  let manifestItems = $state<ManifestItem[]>([]);
  let sourceItems = $state<SourceItem[]>([]);
  // Whether the editor build (SEED.html) is embedded — shown as a non-deletable row.
  let seedHtmlPresent = $state(false);
  let selectedItem = $state<ManifestItem | SourceItem | any | null>(null);
  let selectedItemType = $state<'manifest' | 'source' | 'opf' | null>(null);
  let validationErrors = $state<ValidationResult[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Import collision review: items shown in the dialog (null = closed) and the
  // staged colliding files awaiting a commit decision.
  let reviewItems = $state<ReviewItem[] | null>(null);
  let pendingManifestImport = $state<
    { stagedPath: string; originalName: string; mediaType: string; existingHref: string }[]
  >([]);

  const loadManifest = async () => {
    if (!workspace) return;

    try {
      loading = true;
      error = null;

      // Load manifest items directly from workspace state
      const baseManifestItems = workspace.opf.manifest;

      // Populate file sizes for manifest items
      const manifestItemsWithSizes = await Promise.all(
        baseManifestItems.map(async item => {
          try {
            // Resolve manifest item href to full workspace path
            const resolvedPath = workspace!.pathInfo.basePath
              ? `${workspace!.pathInfo.basePath}/${item.href}`
              : item.href;

            // Get file info using workspace service method
            const fileInfo = await workspaceService.getFileInfo(workspace!.id, resolvedPath);

            return {
              ...item,
              size: fileInfo.size,
            };
          } catch {
            // If file doesn't exist or can't be accessed, keep item without size
            return item;
          }
        })
      );

      manifestItems = manifestItemsWithSizes;

      // Load SOURCE items if advanced mode is enabled
      if (advancedMode) {
        try {
          sourceItems = await workspaceService.listSourceFiles(workspace);
        } catch (error) {
          console.warn('Failed to load SOURCE items:', error);
          sourceItems = [];
        }
      } else {
        sourceItems = [];
      }

      seedHtmlPresent = await hasSeedHtml(FileStorageAPI.getInstance(), workspace.id).catch(
        () => false
      );

      // Skip validation for now - not essential for basic functionality
      validationErrors = [];
    } catch {
      error = $t('Failed to load manifest');
    } finally {
      loading = false;
    }
  };

  const handleItemSelection = (detail: {
    item: ManifestItem | SourceItem;
    type: 'manifest' | 'source' | 'opf';
  }) => {
    selectedItem = detail.item;
    selectedItemType = detail.type;

    // Call the callback function to notify parent component
    onItemSelect?.({
      item: detail.item,
      type: detail.type,
    });
  };

  const handleItemDelete = async (detail: { itemId: string }) => {
    if (!workspace || readOnly) return;

    const confirmed = confirm($t('Are you sure you want to delete this item?'));
    if (!confirmed) return;

    try {
      workspace = await workspaceService.removeManifestItem(workspace, detail.itemId);
      // Keep global app state in sync with the persisted content.opf.
      onWorkspaceUpdate?.(workspace);
      await loadManifest(); // Refresh the manifest

      // Clear selection if deleted item was selected
      if (selectedItem && 'id' in selectedItem && selectedItem.id === detail.itemId) {
        selectedItem = null;
        selectedItemType = null;
      }
    } catch {
      error = $t('Failed to delete item');
    }
  };

  // Reliable media type: browsers misreport fonts and JavaScript, so prefer
  // filename detection for those (and whenever the browser type is generic).
  const reliableMediaType = (file: File): string => {
    const browserType = file.type;
    const filenameType = ManifestUtils.detectMediaType(file.name);
    const isGeneric = !browserType || browserType === 'application/octet-stream';
    const isFontFile = filenameType.startsWith('font/');
    const isJavaScriptFile =
      filenameType === 'application/javascript' || filenameType === 'text/javascript';
    return isGeneric || isFontFile || isJavaScriptFile ? filenameType : browserType;
  };

  const isTextLike = (mediaType: string): boolean =>
    mediaType.startsWith('text/') || mediaType.includes('json') || mediaType.includes('xml');

  const resolvePath = (href: string): string =>
    workspace!.pathInfo.basePath ? `${workspace!.pathInfo.basePath}/${href}` : href;

  const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean => {
    if (a.byteLength !== b.byteLength) return false;
    for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
    return true;
  };

  const writeBytes = async (filePath: string, mediaType: string, bytes: Uint8Array): Promise<void> => {
    if (isTextLike(mediaType)) {
      await workspaceService.writeFile(workspace!.id, filePath, new TextDecoder('utf-8').decode(bytes));
    } else {
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      await workspaceService.writeBinaryFile(workspace!.id, filePath, buffer);
    }
  };

  // Add a new manifest item from a File (non-colliding path). Rolls back the
  // manifest entry if the content write fails. Throws on failure.
  const uploadNewFile = async (file: File, mediaType: string): Promise<void> => {
    const href = ensureUniqueHref(
      generateEPUBPath(file.name, mediaType),
      workspace!.opf.manifest.map(m => m.href)
    );
    workspace = await workspaceService.addManifestItem(workspace!, { href, mediaType });
    const addedItemId = workspace.opf.manifest[workspace.opf.manifest.length - 1].id;
    const filePath = resolvePath(href);
    try {
      if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('xml')) {
        await workspaceService.writeFile(workspace.id, filePath, await file.text());
      } else {
        await workspaceService.writeBinaryFile(workspace.id, filePath, await file.arrayBuffer());
      }
    } catch (writeError) {
      workspace = await workspaceService.removeManifestItem(workspace, addedItemId);
      throw writeError;
    }
  };

  // Add a new (suffixed) manifest item from staged bytes — the "keep both" commit.
  const addManifestFromBytes = async (
    name: string,
    mediaType: string,
    bytes: Uint8Array
  ): Promise<void> => {
    const href = ensureUniqueHref(
      generateEPUBPath(name, mediaType),
      workspace!.opf.manifest.map(m => m.href)
    );
    workspace = await workspaceService.addManifestItem(workspace!, { href, mediaType });
    const addedItemId = workspace.opf.manifest[workspace.opf.manifest.length - 1].id;
    try {
      await writeBytes(resolvePath(href), mediaType, bytes);
    } catch (writeError) {
      workspace = await workspaceService.removeManifestItem(workspace, addedItemId);
      throw writeError;
    }
  };

  const handleFileUpload = async (detail: { files: FileList | File[] }) => {
    if (!workspace || readOnly) return;

    // Split incoming files into clean imports and ones that collide with an
    // existing manifest href. Media type is needed to compute the target path.
    const entries = Array.from(detail.files).map(file => {
      const mediaType = reliableMediaType(file);
      return { file, mediaType, existingHref: manifestCollision(file.name, mediaType, workspace!) };
    });
    const clean = entries.filter(e => !e.existingHref);
    const colliding = entries.filter(e => e.existingHref);

    // Import the non-colliding files immediately (existing behaviour).
    const successfulFiles: string[] = [];
    const failedFiles: { name: string; error: string }[] = [];
    for (const e of clean) {
      try {
        await uploadNewFile(e.file, e.mediaType);
        successfulFiles.push(e.file.name);
      } catch (fileError) {
        console.warn(`Failed to upload ${e.file.name}:`, fileError);
        failedFiles.push({
          name: e.file.name,
          error: fileError instanceof Error ? fileError.message : 'Unknown error',
        });
      }
    }
    if (successfulFiles.length > 0) onWorkspaceUpdate?.(workspace);
    await loadManifest();

    if (clean.length > 0 && successfulFiles.length === 0) {
      error = $t('Failed to upload all files');
      console.error('Upload failures:', failedFiles);
    } else if (failedFiles.length > 0) {
      error = $t('Some files failed to upload - see console for details');
      console.warn(`Failed to upload ${failedFiles.length} files:`, failedFiles);
    }

    // A name collision is only a real conflict when the bytes differ; an identical
    // upload is a no-op, so skip it rather than prompting to overwrite.
    const changedColliding: typeof colliding = [];
    let identicalCount = 0;
    for (const e of colliding) {
      const incoming = new Uint8Array(await e.file.arrayBuffer());
      let existing: Uint8Array | null = null;
      try {
        existing = new Uint8Array(
          await workspaceService.readFile(workspace.id, resolvePath(e.existingHref!))
        );
      } catch {
        existing = null;
      }
      if (existing && bytesEqual(existing, incoming)) identicalCount += 1;
      else changedColliding.push(e);
    }

    // Route the genuinely-changed collisions through the review dialog.
    if (changedColliding.length > 0) {
      try {
        const staged = await stageFiles(changedColliding.map(e => e.file));
        reviewItems = await buildManifestReviewItems(
          staged,
          changedColliding.map(e => ({ mediaType: e.mediaType, existingHref: e.existingHref! }))
        );
        pendingManifestImport = staged.map((s, i) => ({
          stagedPath: s.stagedPath,
          originalName: s.originalName,
          mediaType: changedColliding[i].mediaType,
          existingHref: changedColliding[i].existingHref!,
        }));
      } catch (stageError) {
        console.warn('Failed to stage colliding files:', stageError);
        error = $t('Failed to import files');
        await clearImportStaging();
      }
    } else if (identicalCount > 0 && successfulFiles.length === 0) {
      showToast($t('Nothing to import — the file(s) already match the existing content.'));
    }
  };

  // Build review items for staged colliding files: existing content vs incoming,
  // as an inline text diff, side-by-side image preview, or size comparison.
  const buildManifestReviewItems = async (
    staged: StagedFile[],
    meta: { mediaType: string; existingHref: string }[]
  ): Promise<ReviewItem[]> => {
    const decoder = new TextDecoder('utf-8');
    const items: ReviewItem[] = [];
    for (let i = 0; i < staged.length; i++) {
      const { mediaType, existingHref } = meta[i];
      const incoming = await readStagedBytes(staged[i].stagedPath);
      let current: Uint8Array | null = null;
      try {
        current = new Uint8Array(await workspaceService.readFile(workspace!.id, resolvePath(existingHref)));
      } catch {
        // Existing file unreadable — diff/preview against empty content.
      }
      let preview: ReviewPreview;
      if (mediaType.startsWith('image/')) {
        preview = { type: 'image', mediaType, current: current ?? new Uint8Array(), incoming };
      } else if (isTextLike(mediaType)) {
        preview = {
          type: 'text',
          current: current ? decoder.decode(current) : '',
          incoming: decoder.decode(incoming),
        };
      } else {
        preview = {
          type: 'binary',
          mediaType,
          currentSize: current?.byteLength ?? 0,
          incomingSize: incoming.byteLength,
        };
      }
      items.push({
        key: staged[i].stagedPath,
        title: staged[i].originalName,
        collisionLabel: existingHref,
        preview,
        resolution: 'overwrite',
      });
    }
    return items;
  };

  const commitManifestImport = async (decisions: ReviewDecision[]) => {
    if (!workspace) return;
    const byKey = new Map(decisions.map(d => [d.key, d.resolution]));
    try {
      for (const p of pendingManifestImport) {
        const bytes = await readStagedBytes(p.stagedPath);
        if (byKey.get(p.stagedPath) === 'keep-both') {
          await addManifestFromBytes(p.originalName, p.mediaType, bytes);
        } else {
          // Overwrite: replace the bytes at the existing item's path, leaving the
          // manifest entry (id, media-type) unchanged.
          await writeBytes(resolvePath(p.existingHref), p.mediaType, bytes);
        }
      }
      onWorkspaceUpdate?.(workspace);
      await loadManifest();
    } finally {
      await closeManifestReview();
    }
  };

  const closeManifestReview = async () => {
    reviewItems = null;
    pendingManifestImport = [];
    await clearImportStaging();
  };

  // Load manifest when component mounts or dependencies change
  onMount(loadManifest);

  // React to workspace changes (e.g., after delete/add operations) and to an
  // explicit refresh nudge (SOURCE/data deletes don't change the workspace ref).
  $effect(() => {
    void refreshToken;
    if (workspace) {
      loadManifest();
    }
  });

  // React to advancedMode changes
  $effect(() => {
    if (!workspace) return;

    // When advancedMode changes, reload source items
    if (advancedMode) {
      // Load SOURCE items if advanced mode is enabled
      workspaceService
        .listSourceFiles(workspace)
        .then(items => {
          sourceItems = items;
        })
        .catch(error => {
          console.warn('Failed to load SOURCE items:', error);
          sourceItems = [];
        });
    } else {
      // Clear SOURCE items if advanced mode is disabled
      sourceItems = [];
    }
  });

  // React to workspace changes
  $effect(() => {
    if (workspace) {
      loadManifest();
    }
  });

  // --- Window-wide drag-and-drop ---------------------------------------------
  // This component is mounted only while the Manifest view is active, so a file
  // dropped anywhere in the window is unambiguous intent to add it. Listen at
  // the window level and route the files through the same upload path as the
  // Load File button.
  let isDragging = $state(false);
  let dragDepth = 0; // enter/leave counter so nested elements don't flicker

  const dragHasFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files');

  const handleWindowDragEnter = (event: DragEvent) => {
    if (readOnly || !dragHasFiles(event)) return;
    dragDepth += 1;
    isDragging = true;
  };

  const handleWindowDragOver = (event: DragEvent) => {
    if (readOnly || !dragHasFiles(event)) return;
    event.preventDefault(); // required for a drop to fire
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };

  const handleWindowDragLeave = (event: DragEvent) => {
    if (!dragHasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) isDragging = false;
  };

  const handleWindowDrop = (event: DragEvent) => {
    dragDepth = 0;
    isDragging = false;
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    handleFileUpload({ files: event.dataTransfer.files });
  };
</script>

<svelte:window
  ondragenter={handleWindowDragEnter}
  ondragover={handleWindowDragOver}
  ondragleave={handleWindowDragLeave}
  ondrop={handleWindowDrop}
/>

{#if loading}
  <div class="loading-state">
    <p>{$t('Loading manifest…')}</p>
  </div>
{:else if error}
  <div class="error-state">
    <p class="error-message">{error}</p>
    <button type="button" class="btn btn-primary" onclick={loadManifest}>
      {$t('Retry')}
    </button>
  </div>
{:else}
  <ManifestTable
    {manifestItems}
    {sourceItems}
    {seedHtmlPresent}
    {advancedMode}
    {readOnly}
    {validationErrors}
    {selectedItem}
    {selectedItemType}
    onItemSelect={handleItemSelection}
    onItemDelete={handleItemDelete}
    onFileUpload={handleFileUpload}
  />
{/if}

{#if isDragging}
  <div class="drop-overlay" aria-hidden="true">
    <div class="drop-message">
      <p class="drop-title">{$t('Drop to add to the manifest')}</p>
      <p class="drop-subtitle">{$t('Release the file anywhere to add it')}</p>
    </div>
  </div>
{/if}

{#if reviewItems}
  <ImportReviewDialog
    items={reviewItems}
    kind="manifest"
    onConfirm={commitManifestImport}
    onCancel={closeManifestReview}
  />
{/if}

<style>
  .drop-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    /* Let drag events fall through to the window handlers. */
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(var(--color-primary-rgb), 0.12);
    border: 3px dashed var(--color-interactive-primary);
  }

  .drop-message {
    padding: 1.5rem 2rem;
    background-color: var(--color-bg-primary);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg, var(--shadow-sm));
    text-align: center;
  }

  .drop-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .drop-subtitle {
    margin: 0.25rem 0 0;
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
</style>
