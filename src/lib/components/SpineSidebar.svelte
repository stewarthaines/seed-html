<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n';
  import SpineItem from './SpineItem.svelte';
  import EditSpineItemDialog from './EditSpineItemDialog.svelte';
  import ImportReviewDialog from './import/ImportReviewDialog.svelte';
  import { FileStorageAPI } from '../storage/index.js';
  import { showToast } from '../stores/toast.svelte.js';
  import { sanitizeChapterId } from '../import/collision.js';
  import {
    stageFiles,
    readStagedText,
    clearImportStaging,
    type StagedFile,
  } from '../import/import-staging.js';
  import type { ReviewDecision, ReviewItem } from '../import/types.js';
  import type { SpineService } from '../services/spine/spine.service.js';
  import type { SpineItemWithSource } from '../spine/types.js';
  import type { WorkspaceState } from '../services/workspace/workspace.service.js';
  import type { SettingsService } from '../services/settings/settings.service.js';
  import FolderSyncReviewDialog from './folder-sync/FolderSyncReviewDialog.svelte';
  import type { FolderSyncDecision } from './folder-sync/FolderSyncReviewDialog.svelte';
  import { pickSyncFolder } from '../folder-sync/capability.js';
  import {
    connectSyncFolder,
    saveFolderHandle,
    deleteFolderHandle,
    FOLDER_NOT_LINKED,
    FOLDER_UNAVAILABLE,
  } from '../folder-sync/handle-store.js';
  import { scanSyncFolder, folderSyncRowKey } from '../folder-sync/scan.js';
  import type { FolderSyncPlan } from '../folder-sync/scan.js';

  // Props
  let {
    workspace = $bindable(null),
    spineService,
    selectedItemId = null,
    isExpanded = true,
    onWorkspaceUpdate = null,
    readOnly = false,
    advancedMode = false,
    settingsService = null,
  }: {
    workspace?: WorkspaceState | null;
    spineService: SpineService;
    selectedItemId?: string | null;
    isExpanded?: boolean;
    onWorkspaceUpdate?: ((workspace: WorkspaceState) => void) | null;
    /** Read-only EPUB: list is view-only (no append/move/drag/delete). */
    readOnly?: boolean;
    /** Advanced mode: forwarded to the edit-chapter dialog to gate the linear toggle. */
    advancedMode?: boolean;
    /** For folder-sync link metadata (folder name, last synced); optional so the
        sidebar still works standalone (Storybook) without settings plumbing. */
    settingsService?: SettingsService | null;
  } = $props();

  // State
  let spineItems = $state<SpineItemWithSource[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let isReordering = false;

  // The spine item currently open in the edit dialog (null = closed).
  let editingItem = $state<SpineItemWithSource | null>(null);

  // Import collision review: items shown in the dialog (null = closed) and the
  // staged colliding files awaiting a commit decision.
  let reviewItems = $state<ReviewItem[] | null>(null);
  let pendingImport = $state<{ stagedPath: string; originalName: string; targetId: string }[]>([]);

  // Folder sync review (see process/FOLDER_SYNC.md): the scanned plan (null =
  // closed) and the linked folder's display metadata.
  let syncPlan = $state<FolderSyncPlan | null>(null);
  let syncFolderName = $state('');
  let syncLastSyncedAt = $state<string | undefined>(undefined);

  // Drag feedback: the item being dragged (dimmed) and the insertion gap where it
  // would land (an index in 0..length; the line is drawn before item `dropGap`,
  // length = after the last item). Both null when no drag is in progress.
  let draggedIndex = $state<number | null>(null);
  let dropGap = $state<number | null>(null);

  // Reactive state - use prop instead of store
  const sidebarExpanded = $derived(isExpanded);

  // Initialize event listeners
  onMount(() => {
    // Listen for append item events from Sidebar
    const handleAppendEvent = () => {
      handleAppendChapter();
    };
    window.addEventListener('append-spine-item', handleAppendEvent);

    // Listen for "import text files as chapters" events from Sidebar
    const handleImportEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ files: File[] }>).detail;
      if (detail?.files?.length) {
        void handleImportTextChapters(detail.files);
      }
    };
    window.addEventListener('import-text-chapters', handleImportEvent);

    // Folder-sync button in the Chapters header (Sidebar) — link, reconnect,
    // or open the sync review, depending on the stored handle's state.
    const handleFolderSyncEvent = () => {
      void handleFolderSyncOpen();
    };
    window.addEventListener('folder-sync-open', handleFolderSyncEvent);

    // Cleanup
    return () => {
      window.removeEventListener('append-spine-item', handleAppendEvent);
      window.removeEventListener('import-text-chapters', handleImportEvent);
      window.removeEventListener('folder-sync-open', handleFolderSyncEvent);
    };
  });

  // Reactive: Load spine items when workspace ID changes (not metadata updates)
  // Using workspace?.id to avoid reloading on metadata-only changes
  const workspaceId = $derived(workspace?.id);
  $effect(() => {
    if (workspaceId && spineService) {
      loadSpineItems();
    } else if (!workspace) {
      // No workspace selected - show empty state
      spineItems = [];
      isLoading = false;
      error = null;
    }
  });

  // Public method to refresh spine items (can be called by parent)
  export async function refreshSpineItems() {
    if (workspace && spineService) {
      await loadSpineItems();
    }
  }

  // Load spine items
  async function loadSpineItems() {
    if (!workspace) return;

    isLoading = true;
    error = null;

    try {
      const items = await spineService.loadSpineItems(workspace);
      spineItems = items;
    } catch (err) {
      console.error('❌ SpineSidebar: Error loading spine items:', err);
      error = err instanceof Error ? err.message : 'Failed to load spine items';
      spineItems = [];
    } finally {
      isLoading = false;
    }
  }

  // Handle item selection
  function handleSelectItem(itemId: string) {
    // Don't update local selectedItemId - let the parent control this via props
    // Dispatch custom event for parent to handle main view navigation
    const event = new CustomEvent('select-spine-item', {
      detail: { itemId },
      bubbles: true,
    });
    window.dispatchEvent(event);
  }

  // Handle append new chapter
  async function handleAppendChapter() {
    if (!workspace || readOnly) return;

    try {
      isLoading = true;
      const result = await spineService.addChapter(workspace, {
        title: 'New Chapter',
        linear: true,
        createSourceFile: true,
      });

      // Update workspace state
      workspace = result.updatedWorkspace;
      if (onWorkspaceUpdate) {
        onWorkspaceUpdate(workspace);
      }

      // Reload spine items with updated workspace
      await loadSpineItems();

      // Select the new chapter
      handleSelectItem(result.newChapter.id);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create chapter';
    } finally {
      isLoading = false;
    }
  }

  // Create a chapter per uploaded plain-text file (filename → idref, text → source).
  // Files whose id matches an existing chapter are routed through a review dialog
  // where the user chooses to overwrite or keep both; the rest import directly.
  async function handleImportTextChapters(files: File[]) {
    if (!workspace) return;

    // Fail the whole operation if any file isn't plain text. Empty type is allowed
    // (browsers often report '' for .txt/.md), otherwise require a text/* type.
    const allPlainText = files.every(file => file.type === '' || file.type.startsWith('text/'));
    if (!allPlainText) {
      error = 'Only plain text files can be imported as chapters.';
      return;
    }

    const existingIds = new Set(workspace.opf.manifest.map(item => item.id));
    const collidingAll = files.filter(file => existingIds.has(sanitizeChapterId(file.name)));
    const clean = files.filter(file => !existingIds.has(sanitizeChapterId(file.name)));

    try {
      isLoading = true;

      const firstId = await importChaptersDirectly(clean);

      // A name collision is only a real conflict when the content actually differs.
      // Identical files are no-ops — skip them rather than prompting to overwrite.
      const storage = FileStorageAPI.getInstance();
      const colliding: File[] = [];
      let identicalCount = 0;
      for (const file of collidingAll) {
        const id = sanitizeChapterId(file.name);
        const incoming = await file.text();
        let current = '';
        try {
          current = await storage.readTextFile(workspace.id, `SOURCE/text/${id}.txt`);
        } catch {
          // No existing source (read-only EPUB chapter) — any incoming text is a change.
        }
        if (incoming === current) identicalCount += 1;
        else colliding.push(file);
      }

      if (colliding.length === 0) {
        if (firstId) handleSelectItem(firstId);
        else if (identicalCount > 0)
          showToast($t('Nothing to import — the file(s) already match the existing content.'));
        return;
      }

      // Stage the changed colliding files and open the review dialog. Staging is
      // cleared once the user confirms or cancels.
      const staged = await stageFiles(colliding);
      reviewItems = await buildChapterReviewItems(staged);
      pendingImport = staged.map((s, i) => ({
        stagedPath: s.stagedPath,
        originalName: s.originalName,
        targetId: sanitizeChapterId(colliding[i].name),
      }));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to import chapters';
    } finally {
      isLoading = false;
    }
  }

  // Import a set of non-colliding text files as new chapters. Returns the first
  // created chapter id (for selection), or null when nothing was imported.
  async function importChaptersDirectly(files: File[]): Promise<string | null> {
    if (!workspace || files.length === 0) return null;
    let firstChapterId: string | null = null;
    for (const file of files) {
      const text = await file.text();
      const result = await spineService.addChapter(workspace, {
        title: file.name,
        baseName: file.name,
        sourceText: text,
        createSourceFile: true,
        linear: true,
      });
      workspace = result.updatedWorkspace;
      if (!firstChapterId) firstChapterId = result.newChapter.id;
    }
    onWorkspaceUpdate?.(workspace);
    await loadSpineItems();
    return firstChapterId;
  }

  // Build the review-dialog items for staged colliding chapter files: the existing
  // SOURCE text vs the incoming staged text, shown as an inline diff.
  async function buildChapterReviewItems(staged: StagedFile[]): Promise<ReviewItem[]> {
    const storage = FileStorageAPI.getInstance();
    const items: ReviewItem[] = [];
    for (const file of staged) {
      const targetId = sanitizeChapterId(file.originalName);
      const incoming = await readStagedText(file.stagedPath);
      let current = '';
      try {
        current = await storage.readTextFile(workspace!.id, `SOURCE/text/${targetId}.txt`);
      } catch {
        // An existing chapter without editable source (e.g. a read-only EPUB
        // chapter) diffs against empty — the whole incoming text shows as added.
      }
      items.push({
        key: file.stagedPath,
        title: file.originalName,
        collisionLabel: targetId,
        preview: { type: 'text', current, incoming },
        resolution: 'overwrite',
      });
    }
    return items;
  }

  async function commitChapterImport(decisions: ReviewDecision[]) {
    if (!workspace) return;
    const byKey = new Map(decisions.map(d => [d.key, d.resolution]));
    let firstId: string | null = null;
    const overwrittenPaths: string[] = [];
    try {
      for (const candidate of pendingImport) {
        if (byKey.get(candidate.stagedPath) === 'skip') continue;
        const text = await readStagedText(candidate.stagedPath);
        if (byKey.get(candidate.stagedPath) === 'keep-both') {
          const result = await spineService.addChapter(workspace, {
            title: candidate.originalName,
            baseName: candidate.originalName,
            sourceText: text,
            createSourceFile: true,
            linear: true,
          });
          workspace = result.updatedWorkspace;
          if (!firstId) firstId = result.newChapter.id;
        } else {
          await spineService.overwriteChapter(workspace, candidate.targetId, {
            title: candidate.originalName,
            sourceText: text,
          });
          overwrittenPaths.push(`SOURCE/text/${candidate.targetId}.txt`);
          if (!firstId) firstId = candidate.targetId;
        }
      }
      onWorkspaceUpdate?.(workspace);
      await loadSpineItems();
      // An overwrite rewrites a chapter's source under its existing id, so the
      // editor's cached store for that file would otherwise keep showing the old
      // text. Nudge any open editor to re-read the affected files.
      if (overwrittenPaths.length > 0) {
        window.dispatchEvent(
          new CustomEvent('seed:source-files-changed', { detail: { paths: overwrittenPaths } })
        );
      }
      if (firstId) handleSelectItem(firstId);
    } finally {
      await closeImportReview();
    }
  }

  async function closeImportReview() {
    reviewItems = null;
    pendingImport = [];
    await clearImportStaging();
  }

  // ---------------------------------------------------------------------------
  // Folder sync (process/FOLDER_SYNC.md)

  const notifyFolderSyncChanged = () =>
    window.dispatchEvent(new CustomEvent('seed:folder-sync-changed'));

  // Link / reconnect / open review, depending on the stored handle's state.
  // Runs inside the button click task, so the picker and permission prompt
  // still have the user gesture they require.
  async function handleFolderSyncOpen() {
    if (!workspace || readOnly) return;
    try {
      const conn = await connectSyncFolder(workspace.id, { interactive: true });
      if (conn.handle) {
        await openSyncReview(conn.handle);
        return;
      }
      if (conn.error === FOLDER_NOT_LINKED) {
        await linkNewFolder();
        return;
      }
      if (conn.error === FOLDER_UNAVAILABLE) {
        showToast(
          $t("The linked folder isn't available — reconnect the drive or relink the folder.")
        );
        return;
      }
      // Reconnect-required after an interactive attempt = the prompt was denied.
      showToast($t('Folder access was not granted.'));
      notifyFolderSyncChanged();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Folder sync failed';
    }
  }

  async function linkNewFolder() {
    if (!workspace) return;
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await pickSyncFolder();
    } catch {
      return; // picker cancelled
    }
    await saveFolderHandle(workspace.id, handle);
    await saveFolderSyncMeta({ folder_name: handle.name });
    notifyFolderSyncChanged();
    await openSyncReview(handle);
  }

  async function openSyncReview(handle: FileSystemDirectoryHandle) {
    if (!workspace) return;
    const storage = FileStorageAPI.getInstance();
    const workspaceId = workspace.id;
    const plan = await scanSyncFolder({
      dir: handle,
      spineIds: workspace.opf.spine.map(item => item.idref),
      manifestIds: workspace.opf.manifest.map(item => item.id),
      readSource: async id => {
        try {
          return await storage.readTextFile(workspaceId, `SOURCE/text/${id}.txt`);
        } catch {
          return null;
        }
      },
    });
    syncFolderName = handle.name;
    syncLastSyncedAt = settingsService
      ? (await settingsService.loadWorkspaceSettings(workspaceId)).folder_sync?.last_synced_at
      : undefined;
    syncPlan = plan;
  }

  /** Write (or with null, clear) the link's display metadata. Best-effort —
      the handle store is the source of truth for whether a link exists. */
  async function saveFolderSyncMeta(meta: { folder_name: string; last_synced_at?: string } | null) {
    if (!workspace || !settingsService) return;
    try {
      const settings = await settingsService.loadWorkspaceSettings(workspace.id);
      if (meta) settings.folder_sync = { ...settings.folder_sync, ...meta };
      else delete settings.folder_sync;
      await settingsService.saveWorkspaceSettings(workspace.id, settings);
    } catch {
      // metadata is cosmetic; never block linking/syncing on it
    }
  }

  // Dialog footer action: pick a different folder and rescan in place.
  async function changeSyncFolder() {
    if (!workspace) return;
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await pickSyncFolder();
    } catch {
      return; // picker cancelled — keep the current plan open
    }
    await saveFolderHandle(workspace.id, handle);
    await saveFolderSyncMeta({ folder_name: handle.name });
    notifyFolderSyncChanged();
    await openSyncReview(handle);
  }

  // Dialog footer action: drop the link. Chapters are untouched.
  async function unlinkSyncFolder() {
    if (!workspace) return;
    await deleteFolderHandle(workspace.id);
    await saveFolderSyncMeta(null);
    syncPlan = null;
    notifyFolderSyncChanged();
    showToast($t('Folder unlinked. Chapters were not changed.'));
  }

  async function commitFolderSync(decisions: FolderSyncDecision[]) {
    if (!workspace || !syncPlan) return;
    const byKey = new Map(decisions.map(d => [d.key, d.resolution]));
    const overwrittenPaths: string[] = [];
    let added = 0;
    let updated = 0;
    let removed = 0;

    for (const row of syncPlan.rows) {
      if (row.kind === 'skipped') continue;
      const resolution = byKey.get(folderSyncRowKey(row)) ?? 'skip';
      if (resolution === 'skip') continue;

      if (row.kind === 'update' && resolution === 'apply') {
        await spineService.overwriteChapter(workspace, row.targetId, {
          title: row.name,
          sourceText: row.incoming,
        });
        overwrittenPaths.push(`SOURCE/text/${row.targetId}.txt`);
        updated += 1;
      } else if (row.kind === 'remove') {
        const result = await spineService.deleteChapter(workspace, row.targetId);
        workspace = result.updatedWorkspace;
        removed += 1;
      } else {
        // add rows, and updates resolved as keep-both — addChapter uniquifies
        // the id, which is also how colliding adds land under a new id.
        const result = await spineService.addChapter(workspace, {
          title: row.name,
          baseName: row.name,
          sourceText: row.incoming,
          createSourceFile: true,
          linear: true,
        });
        workspace = result.updatedWorkspace;
        added += 1;
      }
    }

    onWorkspaceUpdate?.(workspace);
    await loadSpineItems();
    if (overwrittenPaths.length > 0) {
      window.dispatchEvent(
        new CustomEvent('seed:source-files-changed', { detail: { paths: overwrittenPaths } })
      );
    }
    await saveFolderSyncMeta({
      folder_name: syncFolderName,
      last_synced_at: new Date().toISOString(),
    });
    notifyFolderSyncChanged();
    showToast(
      $t('Folder sync: {added} added, {updated} updated, {removed} removed.', {
        added,
        updated,
        removed,
      })
    );
    syncPlan = null;
  }

  // Handle move up
  async function handleMoveUp(index: number) {
    if (isReordering || index === 0 || !workspace || readOnly) return;

    isReordering = true;
    try {
      const result = await spineService.moveChapterUp(workspace, index);

      // Update workspace state
      workspace = result.updatedWorkspace;
      if (onWorkspaceUpdate) {
        onWorkspaceUpdate(workspace);
      }

      spineItems = result.newOrder;

      // Announce move for screen readers
      announceMove(spineItems[index - 1].id, index, index - 1);
    } catch {
      // Failed to move chapter up
      // Reload to restore correct order
      await loadSpineItems();
    } finally {
      isReordering = false;
    }
  }

  // Handle move down
  async function handleMoveDown(index: number) {
    if (isReordering || index === spineItems.length - 1 || !workspace || readOnly) return;

    isReordering = true;
    try {
      const result = await spineService.moveChapterDown(workspace, index);

      // Update workspace state
      workspace = result.updatedWorkspace;
      if (onWorkspaceUpdate) {
        onWorkspaceUpdate(workspace);
      }

      spineItems = result.newOrder;

      // Announce move for screen readers
      announceMove(spineItems[index + 1].id, index, index + 1);
    } catch {
      // Failed to move chapter down
      // Reload to restore correct order
      await loadSpineItems();
    } finally {
      isReordering = false;
    }
  }

  // Screen reader announcement
  function announceMove(itemId: string, fromIndex: number, toIndex: number) {
    const message = `${itemId} moved from position ${fromIndex + 1} to position ${toIndex + 1}`;
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  }

  // Handle drag start
  function handleDragStart(
    event: DragEvent & { currentTarget: EventTarget & HTMLDivElement },
    index: number
  ) {
    if (!sidebarExpanded) return;

    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', index.toString());
    draggedIndex = index;
  }

  // Handle drag over: allow the drop and track the insertion gap so the drop
  // indicator follows the cursor (top half → before this item, bottom half → after).
  function handleDragOver(
    event: DragEvent & { currentTarget: EventTarget & HTMLDivElement },
    index: number
  ) {
    if (!sidebarExpanded) return;

    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';

    if (draggedIndex === null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const gap = event.clientY < rect.top + rect.height / 2 ? index : index + 1;
    // Suppress the line over the dragged item's own slot (those gaps are no-ops).
    dropGap = gap === draggedIndex || gap === draggedIndex + 1 ? null : gap;
  }

  // Clear drag feedback when a drag ends without a drop (cancelled, escaped, or
  // dropped outside the list).
  function handleDragEnd() {
    draggedIndex = null;
    dropGap = null;
  }

  // Handle drop: move the dragged item to the gap the indicator showed.
  async function handleDrop(event: DragEvent & { currentTarget: EventTarget & HTMLDivElement }) {
    if (!sidebarExpanded || isReordering || readOnly) return;
    event.preventDefault();

    const from = draggedIndex;
    const gap = dropGap;
    draggedIndex = null;
    dropGap = null;

    if (from === null || gap === null || !workspace) return;
    // Removing `from` first shifts later positions down by one.
    const to = gap > from ? gap - 1 : gap;
    if (to === from) return;

    isReordering = true;
    try {
      const result = await spineService.reorderItems(workspace, from, to);

      // Update workspace state
      workspace = result.updatedWorkspace;
      if (onWorkspaceUpdate) {
        onWorkspaceUpdate(workspace);
      }

      spineItems = result.newOrder;

      // Announce move for screen readers
      announceMove(spineItems[to].id, from, to);
    } catch {
      // Failed to reorder items
      // Reload to restore correct order
      await loadSpineItems();
    } finally {
      isReordering = false;
    }
  }

  // Handle delete item request
  async function handleDeleteItem(itemId: string) {
    if (!workspace || readOnly) return;

    // A book needs at least one chapter. The delete control is disabled on the only
    // remaining item; guard here too so no other caller can empty the spine.
    if (spineItems.length <= 1) return;

    const confirmed = window.confirm(
      $t(
        "Are you sure you want to delete chapter '{name}'? This will permanently delete the chapter and its source file.",
        { name: itemId }
      )
    );

    if (!confirmed) return;

    try {
      isLoading = true;

      // Remember where the deleted item sat so we can select its neighbour after.
      const deletedIndex = spineItems.findIndex(spineItem => spineItem.id === itemId);
      const result = await spineService.deleteChapter(workspace, itemId);

      // Update workspace state
      workspace = result.updatedWorkspace;
      if (onWorkspaceUpdate) {
        onWorkspaceUpdate(workspace);
      }

      // Reload spine items with updated workspace
      spineItems = await spineService.loadSpineItems(workspace);

      // If the deleted item was selected, move selection to its nearest neighbour
      // (the item that slid into its slot, or the new last one) so the editor stays
      // populated rather than dropping to an empty state. The guard above guarantees
      // at least one item remains.
      if (selectedItemId === itemId && spineItems.length > 0) {
        const next = spineItems[Math.min(deletedIndex, spineItems.length - 1)];
        const event = new CustomEvent('select-spine-item', {
          detail: { itemId: next.id },
          bubbles: true,
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Failed to delete chapter:', error);
      // Could add error notification here
    } finally {
      isLoading = false;
    }
  }

  // Save edits from the dialog: rename the id and/or toggle the linear flag.
  // Errors propagate to the dialog (it stays open and shows the message).
  async function handleSaveEdit(item: SpineItemWithSource, newId: string, linear: boolean) {
    if (!workspace || readOnly) return;

    let effectiveId = item.id;

    if (newId !== item.id) {
      const result = await spineService.renameChapterId(workspace, item.id, newId);
      workspace = result.updatedWorkspace;
      effectiveId = newId;
    }

    if (linear !== item.linear) {
      const result = await spineService.setChapterLinear(workspace, effectiveId, linear);
      workspace = result.updatedWorkspace;
    }

    if (onWorkspaceUpdate) {
      onWorkspaceUpdate(workspace);
    }

    await loadSpineItems();
    handleSelectItem(effectiveId);
    editingItem = null;
  }
</script>

<div class="spine-sidebar">
  {#if isLoading}
    <div class="loading">
      <p>{$t('Loading spine items…')}</p>
    </div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button class="btn btn-secondary" onclick={loadSpineItems}>
        {$t('Retry')}
      </button>
    </div>
  {:else if spineItems.length > 0}
    <div class="spine-list" role="list">
      {#each spineItems as item, index (item.id)}
        <div
          class="spine-item-wrapper"
          class:dragging={draggedIndex === index}
          class:drop-before={dropGap === index}
          class:drop-after={dropGap === spineItems.length && index === spineItems.length - 1}
          draggable={sidebarExpanded && !readOnly}
          ondragstart={e => handleDragStart(e, index)}
          ondragover={e => handleDragOver(e, index)}
          ondrop={handleDrop}
          ondragend={handleDragEnd}
          role="listitem"
        >
          <SpineItem
            {item}
            {index}
            {readOnly}
            isSelected={selectedItemId === item.id}
            isExpanded={sidebarExpanded}
            compact={!isExpanded}
            isFirstItem={index === 0}
            isLastItem={index === spineItems.length - 1}
            isOnlyItem={spineItems.length === 1}
            onSelect={() => handleSelectItem(item.id)}
            onMoveUp={async () => await handleMoveUp(index)}
            onMoveDown={async () => await handleMoveDown(index)}
            onEdit={() => (editingItem = item)}
            onDelete={async () => await handleDeleteItem(item.id)}
            dragHandleProps={{
              draggable: true,
              'data-drag-handle': true,
            }}
          />
        </div>
      {/each}
    </div>
  {:else if workspace && !isLoading}
    <div class="empty-state">
      <p>{$t('No spine items yet')}</p>
      <button class="btn btn-secondary" onclick={loadSpineItems}>
        {$t('Refresh')}
      </button>
    </div>
  {:else}
    <div class="empty-state">
      <p>{$t('No project selected')}</p>
    </div>
  {/if}
</div>

{#if editingItem}
  {@const item = editingItem}
  <EditSpineItemDialog
    currentId={item.id}
    linear={item.linear}
    {advancedMode}
    onSave={({ newId, linear }) => handleSaveEdit(item, newId, linear)}
    onClose={() => (editingItem = null)}
  />
{/if}

{#if reviewItems}
  <ImportReviewDialog
    items={reviewItems}
    kind="chapter"
    onConfirm={commitChapterImport}
    onCancel={closeImportReview}
  />
{/if}

{#if syncPlan}
  <FolderSyncReviewDialog
    plan={syncPlan}
    folderName={syncFolderName}
    lastSyncedAt={syncLastSyncedAt}
    onConfirm={commitFolderSync}
    onCancel={() => (syncPlan = null)}
    onChangeFolder={changeSyncFolder}
    onUnlink={unlinkSyncFolder}
  />
{/if}

<style>
  .spine-sidebar {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    gap: var(--space-2); /* More compact spacing */
    background: var(--color-bg-secondary); /* Light grey background */
    padding: 0; /* var(--space-2); */
    padding-inline-end: 0; /* Remove right padding to allow items to extend to edge */
  }

  .loading,
  .error,
  .empty-state {
    padding: var(--space-2); /* More compact */
    text-align: center;
    color: var(--color-text-secondary);
    font-size: var(--text-sm); /* Smaller text */
  }

  .error {
    color: var(--color-status-error);
  }

  .error .btn,
  .empty-state .btn {
    margin-block-start: var(--space-2);
  }

  .spine-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: visible; /* Allow horizontal overflow for focus rings */
    display: flex;
    flex-direction: column;
    gap: 0; /* No gap between items */
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .spine-list > :global(*) {
    border: none;
  }

  .spine-item-wrapper {
    position: relative; /* anchors the drop-indicator pseudo-elements */
    transition:
      transform var(--duration-fast) ease,
      opacity var(--duration-fast) ease;
    border: none;
    outline: none;
  }

  .spine-item-wrapper[draggable='true']:active {
    opacity: 0.8;
    transform: scale(0.98);
  }

  /* The item being dragged is dimmed. */
  .spine-item-wrapper.dragging {
    opacity: 0.4;
  }

  /* Insertion line showing where the dragged item will land. */
  .spine-item-wrapper.drop-before::before,
  .spine-item-wrapper.drop-after::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    block-size: 2px;
    background: var(--color-interactive-primary);
    pointer-events: none;
  }

  .spine-item-wrapper.drop-before::before {
    inset-block-start: 0;
  }

  .spine-item-wrapper.drop-after::after {
    inset-block-end: 0;
  }

  /* Scrollbar styling */
  .spine-list::-webkit-scrollbar {
    inline-size: 6px;
  }

  .spine-list::-webkit-scrollbar-track {
    background: var(--color-bg-secondary);
  }

  .spine-list::-webkit-scrollbar-thumb {
    background: var(--color-border-strong);
    border-radius: var(--radius-xs);
  }

  .spine-list::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-tertiary);
  }
</style>
