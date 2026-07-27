<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { t } from '../../i18n';
  import PaneHeader from '../layout/PaneHeader.svelte';
  import { previewKeyFor } from '../../manifest/signatures.js';
  import type { ManifestItem, SourceItem, ContentPreview } from '../../manifest/types';
  import type {
    WorkspaceService,
    WorkspaceState,
  } from '../../services/workspace/workspace.service.js';
  import { FileStorageAPI } from '../../storage/index.js';
  import {
    hrefDir,
    hrefBasename,
    type MovePlan,
    type MoveRequest,
  } from '../../manifest/move-plan.js';
  import {
    prepareMovePlan,
    commitMovePlan,
    findItemUsage,
  } from '../../services/manifest/manifest-move.js';
  import type { ReferenceHit } from '../../manifest/move-plan.js';
  import { coverThumbDataUrl } from '../../epub/image-thumbnail.js';
  import MoveReviewDialog from './MoveReviewDialog.svelte';

  let {
    selectedItem = null,
    selectedItemType = null,
    selectedItems = [],
    workspace = null,
    workspaceService = undefined,
    onWorkspaceUpdate = undefined,
    onItemDelete,
    onSourceDelete,
    onFilesMoved,
    readOnly = false,
  }: {
    selectedItem?: ManifestItem | SourceItem | any | null;
    selectedItemType?: 'manifest' | 'source' | 'opf' | null;
    /** Multi-selected manifest items (batch move). */
    selectedItems?: ManifestItem[];
    workspace?: WorkspaceState | null;
    // Propagate manifest edits to global app state (keeps content.opf, the
    // table, and the in-memory workspace in lockstep).
    workspaceService?: WorkspaceService;
    onWorkspaceUpdate?: (workspace: WorkspaceState) => void;
    onItemDelete?: (detail: { itemId: string }) => void;
    /** Delete a transform-created SOURCE/data/ file (not in the OPF manifest). */
    onSourceDelete?: (detail: { path: string }) => void;
    /** Moved/rewritten hrefs whose cached blob URLs are now stale. */
    onFilesMoved?: (staleHrefs: string[]) => void;
    /** Read-only EPUB: no edit fields, no delete. */
    readOnly?: boolean;
  } = $props();

  const fileStorage = FileStorageAPI.getInstance();

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
  // The href split into its two editable halves (directory may be '').
  let editDir = $state('');
  let editName = $state('');
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
  // The selected item's path, shown as the right-pane header label. Prefer the
  // live (possibly just-renamed) item over the selectedItem prop, which goes
  // stale after an href edit until the selection is refreshed.
  const itemLabel = $derived(
    liveItem?.href ??
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
    editDir = hrefDir(item.href);
    editName = hrefBasename(item.href);
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
      // An href edit is a rename — the bytes are unchanged — so mark the new
      // preview key as already loaded and keep the current preview/blob URL.
      if (updates.href && workspace) {
        loadedPreviewKey = previewKeyFor(
          workspace.id,
          'manifest',
          liveItem.href,
          liveItem.mediaType
        );
      }
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

  // --- File moves (plan → optional review → commit) --------------------------
  // A path edit is a MOVE: manifest + storage + references (SOURCE text,
  // CSS url()) change together. Single edits with no references to rewrite
  // commit directly; anything with rewrites — and every batch — is reviewed.
  let movePlan = $state<MovePlan | null>(null);
  let moveBusy = $state(false);

  const commitPath = () => {
    if (!liveItem || isXhtmlItem) return;
    const name = editName.trim();
    const dir = editDir.trim().replace(/^\/+|\/+$/g, '');
    if (!name) {
      seedEditForm(liveItem);
      return;
    }
    const newHref = dir ? `${dir}/${name}` : name;
    if (newHref === liveItem.href) {
      seedEditForm(liveItem);
      return;
    }
    void requestMove([{ id: liveItem.id, newHref }], { alwaysReview: false });
  };

  async function requestMove(moves: MoveRequest[], { alwaysReview }: { alwaysReview: boolean }) {
    if (!workspace || !workspaceService || moveBusy) return;
    moveBusy = true;
    editError = null;
    try {
      const plan = await prepareMovePlan(workspaceService, fileStorage, workspace, moves);
      const actionable = plan.rows.filter(row => !row.blocked);
      const blocked = plan.rows.filter(row => row.blocked);
      if (actionable.length === 0 && blocked.length === 0) {
        // Every request was a no-op.
        if (liveItem) seedEditForm(liveItem);
        return;
      }
      if (!alwaysReview && blocked.length === 0 && plan.fileChanges.length === 0) {
        await executeMove(plan);
      } else {
        movePlan = plan;
      }
    } catch (err) {
      editError = err instanceof Error ? err.message : $t('Failed to move files');
      if (liveItem) seedEditForm(liveItem);
    } finally {
      moveBusy = false;
    }
  }

  async function executeMove(plan: MovePlan) {
    if (!workspace || !workspaceService) return;
    const result = await commitMovePlan(workspaceService, fileStorage, workspace, plan);
    // Keep the form and preview in step with the (possibly moved) live item.
    if (liveItem) {
      const moved = result.updatedWorkspace.opf.manifest.find(m => m.id === liveItem!.id);
      if (moved) {
        seedEditForm(moved);
        // A move is a rename — bytes unchanged — keep the current preview.
        loadedPreviewKey = previewKeyFor(
          result.updatedWorkspace.id,
          'manifest',
          moved.href,
          moved.mediaType
        );
      }
    }
    onFilesMoved?.(result.staleHrefs);
    onWorkspaceUpdate?.(result.updatedWorkspace);
  }

  async function confirmMove() {
    if (!movePlan) return;
    // Throws propagate to the dialog, which shows the error inline.
    await executeMove(movePlan);
    movePlan = null;
  }

  // --- Batch move panel -------------------------------------------------------
  // The multi-selection, viewed through the CURRENT manifest (hrefs change
  // under a move; ids are stable). XHTML chapters are excluded — their paths
  // belong to the spine/chapter system.
  const batchItems = $derived(
    selectedItems
      .map(sel => workspace?.opf.manifest.find(m => m.id === sel.id) ?? sel)
      .filter(item => item.mediaType !== 'application/xhtml+xml')
  );
  const batchMode = $derived(batchItems.length > 1);
  const batchDirs = $derived([...new Set(batchItems.map(item => hrefDir(item.href)))]);
  // Uniform-only: the directory is editable only when the whole selection
  // shares one (otherwise a single input would be a lie).
  const batchUniform = $derived(batchDirs.length === 1);
  let batchDir = $state('');
  $effect(() => {
    const seeded = batchUniform ? batchDirs[0] : '';
    untrack(() => {
      batchDir = seeded;
      editError = null;
    });
  });
  // The Move button only arms once the directory actually differs.
  const batchDirty = $derived(
    batchUniform && batchDir.trim().replace(/^\/+|\/+$/g, '') !== batchDirs[0]
  );

  // Thumbnail grid for the selection (small data URLs — no blob lifecycle).
  // Capped so a select-all on a 400-image book doesn't decode the world; the
  // overflow is shown as a +N tile.
  const BATCH_THUMB_LIMIT = 48;
  let batchThumbs = $state<{ id: string; href: string; thumb: string | null }[]>([]);
  const thumbCache = new Map<string, string | null>();

  $effect(() => {
    if (!batchMode || !workspace) {
      batchThumbs = [];
      return;
    }
    const items = batchItems.slice(0, BATCH_THUMB_LIMIT);
    const wsId = workspace.id;
    const base = workspace.pathInfo.basePath;
    let cancelled = false;
    void (async () => {
      const out: { id: string; href: string; thumb: string | null }[] = [];
      for (const item of items) {
        if (cancelled) return;
        const key = `${item.id}${item.href}`;
        let thumb = thumbCache.get(key);
        if (thumb === undefined) {
          if (item.mediaType.startsWith('image/')) {
            try {
              const bytes = await fileStorage.readFile(
                wsId,
                base ? `${base}/${item.href}` : item.href
              );
              thumb = await coverThumbDataUrl(bytes, item.mediaType, 128);
            } catch {
              thumb = null;
            }
          } else {
            thumb = null;
          }
          thumbCache.set(key, thumb);
        }
        out.push({ id: item.id, href: item.href, thumb });
        if (!cancelled) batchThumbs = [...out]; // progressive fill
      }
    })();
    return () => {
      cancelled = true;
    };
  });

  // --- Usage (where is this item referenced?) --------------------------------
  // Read-only scan on selection; null while loading so "no references" only
  // shows once the scan has actually run.
  let usageHits = $state<ReferenceHit[] | null>(null);

  $effect(() => {
    const href = liveItem?.href;
    if (!isManifestItem || isXhtmlItem || batchMode || !workspace || !workspaceService || !href) {
      usageHits = null;
      return;
    }
    const ws = workspace;
    const service = workspaceService;
    let cancelled = false;
    usageHits = null;
    void (async () => {
      try {
        const hits = await findItemUsage(service, fileStorage, ws, href);
        if (!cancelled) usageHits = hits;
      } catch {
        if (!cancelled) usageHits = [];
      }
    })();
    return () => {
      cancelled = true;
    };
  });

  /** SOURCE/text/<idref>.txt → idref, or null for non-chapter paths. */
  const sourceIdref = (path: string): string | null =>
    path.match(/^SOURCE\/text\/(.+)\.txt$/)?.[1] ?? null;

  // Open the referencing chapter in the editor — the same select-spine-item
  // event the sidebar rows dispatch (App selects the chapter and navigates).
  const openChapter = (idref: string) => {
    window.dispatchEvent(
      new CustomEvent('select-spine-item', { detail: { itemId: idref }, bubbles: true })
    );
  };

  const applyBatchMove = () => {
    if (!batchUniform || !batchDirty || moveBusy) return;
    const dir = batchDir.trim().replace(/^\/+|\/+$/g, '');
    const moves = batchItems.map(item => ({
      id: item.id,
      newHref: dir ? `${dir}/${hrefBasename(item.href)}` : hrefBasename(item.href),
    }));
    void requestMove(moves, { alwaysReview: true });
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

  // Read an image's intrinsic pixel dimensions by loading it off its blob URL.
  // Resolves null if the image fails to load or has no intrinsic size (e.g. an SVG
  // with only a viewBox and no width/height).
  const getImageDimensions = (url: string): Promise<{ width: number; height: number } | null> =>
    new Promise(resolve => {
      const img = new Image();
      img.onload = () =>
        resolve(
          img.naturalWidth && img.naturalHeight
            ? { width: img.naturalWidth, height: img.naturalHeight }
            : null
        );
      img.onerror = () => resolve(null);
      img.src = url;
    });

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

  // Identity of the bytes the preview should show. An id-only edit recomputes
  // this to an equal string, so the effect below never re-fires and the blob
  // URL survives; a workspace save that doesn't touch this item is likewise
  // invisible here.
  const previewKey = $derived.by(() => {
    if (!selectedItem || !selectedItemType || !workspaceService || !workspace) return null;
    if (selectedItemType === 'manifest') {
      const item = (liveItem ?? selectedItem) as ManifestItem;
      return previewKeyFor(workspace.id, 'manifest', item.href, item.mediaType);
    }
    if (selectedItemType === 'source') {
      return previewKeyFor(workspace.id, 'source', (selectedItem as SourceItem).path);
    }
    return previewKeyFor(workspace.id, 'opf', workspace.pathInfo.rootfilePath);
  });
  // Imperative bookkeeping, deliberately non-reactive: which key the current
  // contentPreview was loaded for. persistEdit pre-seeds it on a rename (the
  // bytes are unchanged), so the key change alone doesn't force a reload.
  let loadedPreviewKey: string | null = null;

  $effect(() => {
    const key = previewKey;
    if (!key) {
      contentPreview = null;
      cleanupBlobUrl();
      loadedPreviewKey = null;
      return;
    }
    if (key === loadedPreviewKey) return;
    loadedPreviewKey = key;
    // untrack: loadContentPreview reads liveItem/workspace deeply; previewKey
    // is the single contract for when the shown bytes could differ.
    untrack(() => loadContentPreview());
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

          // Image pixel dimensions, shown next to the media type in the preview header.
          const imageDimensions =
            contentType === 'image' && previewUrl ? await getImageDimensions(previewUrl) : null;

          contentPreview = {
            itemId: manifestItem.id,
            mediaType: manifestItem.mediaType,
            contentType,
            textContent,
            previewUrl,
            metadata: {
              width: imageDimensions?.width,
              height: imageDimensions?.height,
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
        <span class="preview-item-label" title={itemLabel}>
          {#if batchMode}
            {$t('{count} selected', { count: batchItems.length })}
          {:else if !(isManifestItem && !isXhtmlItem && !readOnly)}
            <!-- The Directory/Filename inputs already show the path; repeat it
                 here only where that form is absent (sources, opf, chapters,
                 read-only projects). -->
            {itemLabel}
          {/if}
        </span>
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

      {#if batchMode && !readOnly}
        <!-- Batch move: one directory for the whole selection (uniform-only —
             mixed directories disable the input and list the distinct paths). -->
        <div class="item-edit-form">
          <div class="edit-field">
            <label class="edit-label" for="manifest-batch-dir">{$t('Directory')}</label>
            <input
              id="manifest-batch-dir"
              class="edit-input"
              type="text"
              dir="ltr"
              bind:value={batchDir}
              disabled={!batchUniform}
            />
          </div>
          {#if !batchUniform}
            <p class="batch-dirs" dir="ltr">{batchDirs.join(' · ')}</p>
          {/if}
          <div class="batch-actions">
            <button
              type="button"
              class="btn btn-primary"
              onclick={applyBatchMove}
              disabled={!batchUniform || !batchDirty || moveBusy}
            >
              {$t('Move')}
            </button>
          </div>
          {#if editError}
            <p class="edit-error" role="alert">{editError}</p>
          {/if}
        </div>
      {:else if isManifestItem && !readOnly}
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
              <label class="edit-label" for="manifest-edit-dir">{$t('Directory')}</label>
              <input
                id="manifest-edit-dir"
                class="edit-input"
                type="text"
                dir="ltr"
                bind:value={editDir}
                onblur={commitPath}
              />
            </div>

            <div class="edit-field">
              <label class="edit-label" for="manifest-edit-name">{$t('Filename')}</label>
              <input
                id="manifest-edit-name"
                class="edit-input"
                type="text"
                dir="ltr"
                bind:value={editName}
                onblur={commitPath}
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
        {#if batchMode}
          <!-- Thumbnail grid of the multi-selection (replaces the single-item
               preview, which only ever showed the last-clicked row). -->
          <div class="batch-grid">
            {#each batchThumbs as entry (entry.id)}
              <figure class="batch-tile">
                {#if entry.thumb}
                  <img src={entry.thumb} alt="" />
                {:else}
                  <span class="batch-tile-ext" aria-hidden="true"
                    >{hrefBasename(entry.href).split('.').pop()}</span
                  >
                {/if}
                <figcaption dir="ltr">{hrefBasename(entry.href)}</figcaption>
              </figure>
            {/each}
            {#if batchItems.length > BATCH_THUMB_LIMIT}
              <div class="batch-tile batch-tile-more">
                +{batchItems.length - BATCH_THUMB_LIMIT}
              </div>
            {/if}
          </div>
        {:else if contentPreview}
          <div class="content-header">
            <span class="content-type">{contentPreview.mediaType}</span>
            {#if contentPreview.metadata?.width && contentPreview.metadata?.height}
              <span class="content-dimensions"
                >{contentPreview.metadata.width} × {contentPreview.metadata.height} px</span
              >
            {/if}
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

      {#if !batchMode && isManifestItem && !isXhtmlItem && usageHits !== null}
        <!-- Usage: which sources/stylesheets reference this item; source hits
             link to the chapter in the editor. Below the preview so the
             late-arriving list never shifts the thumbnail. Shown read-only too. -->
        <div class="usage-section">
          {#if usageHits.length === 0}
            <p class="usage-empty">{$t('No references found')}</p>
          {:else}
            <ul class="usage-list">
              {#each usageHits as hit (hit.path)}
                {@const idref = hit.kind === 'source' ? sourceIdref(hit.path) : null}
                <li>
                  {#if idref}
                    <button
                      type="button"
                      class="usage-link"
                      dir="ltr"
                      onclick={() => openChapter(idref)}
                    >
                      {idref}
                    </button>
                  {:else}
                    <span dir="ltr">{hit.path}</span>
                  {/if}
                  <span class="usage-count">{hit.count}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if movePlan}
  <MoveReviewDialog plan={movePlan} onConfirm={confirmMove} onCancel={() => (movePlan = null)} />
{/if}

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

  /* Usage list (references to the selected item; sits below the preview) */
  .usage-section {
    flex-shrink: 0;
    padding: 0.5rem 1rem;
    border-top: 1px solid var(--color-border-default);
    font-size: 0.8125rem;
  }

  .usage-empty {
    margin: 0;
    color: var(--color-text-tertiary);
  }

  .usage-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-block-size: 8rem;
    overflow-y: auto;
  }

  .usage-list li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .usage-link {
    border: none;
    background: transparent;
    padding: 0;
    font: inherit;
    color: var(--color-interactive-primary);
    text-decoration: underline;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .usage-link:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 1px;
  }

  .usage-count {
    flex: none;
    color: var(--color-text-tertiary);
  }

  /* Batch move panel */
  .batch-dirs {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-text-tertiary);
  }

  .batch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
    gap: 0.75rem;
    padding: 1rem;
    overflow-y: auto;
  }

  .batch-tile {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
  }

  .batch-tile img {
    inline-size: 100%;
    aspect-ratio: 1;
    object-fit: contain;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
  }

  .batch-tile-ext {
    inline-size: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
    color: var(--color-text-tertiary);
    font-size: 0.8125rem;
    text-transform: uppercase;
  }

  .batch-tile figcaption {
    inline-size: 100%;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .batch-tile-more {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: 0.9375rem;
  }

  .batch-actions {
    display: flex;
    justify-content: flex-end;
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

  .content-dimensions {
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
