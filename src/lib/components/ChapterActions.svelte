<!--
  ChapterActions — the book's chapter-adding actions, mounted whenever a book is
  open, whichever view shows: add a chapter, import text or image files as
  chapters, and folder sync (process/FOLDER_SYNC.md), with their review dialogs.

  Their buttons live in several views (Write's sidebar, Contents, the phone
  chapter strip) and send window events: `append-spine-item`,
  `import-text-chapters`, `import-image-chapters` and `folder-sync-open`. These
  handlers used to live in SpineSidebar, which only Write shows on wide
  screens, so the same buttons in Contents and on a phone did nothing.

  An event is dispatched synchronously inside the click, so the folder picker
  and permission prompt still run in the user gesture they need.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n';
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
  import {
    importFileToManifest,
    reliableMediaType,
    filenameStem,
    formatImageSnippet,
  } from '../import/import-media.js';
  import { convertManifestPathToXHTMLPath } from '../epub/path-utils.js';
  import type { SpineService } from '../services/spine/spine.service.js';
  import type {
    WorkspaceService,
    WorkspaceState,
  } from '../services/workspace/workspace.service.js';
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

  let {
    workspace,
    spineService,
    selectedItemId = null,
    readOnly = false,
    settingsService = null,
    workspaceService = null,
    onWorkspaceUpdate,
  }: {
    workspace: WorkspaceState;
    spineService: SpineService;
    /** A new chapter goes after the selected one. */
    selectedItemId?: string | null;
    /** Read-only EPUB or review mode: the chapter list can't change. */
    readOnly?: boolean;
    /** For the spine basename and folder-sync link metadata. */
    settingsService?: SettingsService | null;
    /** For image-chapter import (manifest file writes). */
    workspaceService?: WorkspaceService | null;
    /** Every change lands here; the views reload from the new workspace. */
    onWorkspaceUpdate: (workspace: WorkspaceState) => void;
  } = $props();

  // Import collision review: items shown in the dialog (null = closed) and the
  // staged colliding files awaiting a commit decision.
  let reviewItems = $state<ReviewItem[] | null>(null);
  let pendingImport = $state<{ stagedPath: string; originalName: string; targetId: string }[]>([]);

  // Folder sync review: the scanned plan (null = closed) and the linked
  // folder's display metadata.
  let syncPlan = $state<FolderSyncPlan | null>(null);
  let syncFolderName = $state('');
  let syncLastSyncedAt = $state<string | undefined>(undefined);

  onMount(() => {
    const handleAppendEvent = () => void handleAppendChapter();
    const handleImportEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ files: File[] }>).detail;
      if (detail?.files?.length) void handleImportTextChapters(detail.files);
    };
    const handleImportImagesEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ files: File[] }>).detail;
      if (detail?.files?.length) void handleImportImageChapters(detail.files);
    };
    const handleFolderSyncEvent = () => void handleFolderSyncOpen();

    window.addEventListener('append-spine-item', handleAppendEvent);
    window.addEventListener('import-text-chapters', handleImportEvent);
    window.addEventListener('import-image-chapters', handleImportImagesEvent);
    window.addEventListener('folder-sync-open', handleFolderSyncEvent);
    return () => {
      window.removeEventListener('append-spine-item', handleAppendEvent);
      window.removeEventListener('import-text-chapters', handleImportEvent);
      window.removeEventListener('import-image-chapters', handleImportImagesEvent);
      window.removeEventListener('folder-sync-open', handleFolderSyncEvent);
    };
  });

  function selectChapter(itemId: string) {
    window.dispatchEvent(new CustomEvent('select-spine-item', { detail: { itemId } }));
  }

  function fail(err: unknown, fallback: string) {
    showToast(err instanceof Error ? err.message : fallback);
  }

  // Add a chapter after the selected one, or at the end when none is selected.
  async function handleAppendChapter() {
    if (readOnly) return;
    try {
      let insertIndex: number | undefined;
      if (selectedItemId) {
        const idx = workspace.opf.spine.findIndex(item => item.idref === selectedItemId);
        if (idx >= 0) insertIndex = idx + 1;
      }
      const result = await spineService.addChapter(workspace, {
        title: 'New Chapter',
        idBasename: settingsService
          ? (await settingsService.loadEPUBSettings(workspace.id)).spine_basename
          : undefined,
        linear: true,
        createSourceFile: true,
        insertIndex,
      });
      onWorkspaceUpdate(result.updatedWorkspace);
      selectChapter(result.newChapter.id);
    } catch (err) {
      fail(err, 'Failed to create chapter');
    }
  }

  // Create a chapter per uploaded plain-text file (filename → idref, text → source).
  // Files whose id matches an existing chapter are routed through a review dialog
  // where the user chooses to overwrite or keep both; the rest import directly.
  async function handleImportTextChapters(files: File[]) {
    if (readOnly) return;

    // Fail the whole operation if any file isn't plain text. Empty type is allowed
    // (browsers often report '' for .txt/.md), otherwise require a text/* type.
    const allPlainText = files.every(file => file.type === '' || file.type.startsWith('text/'));
    if (!allPlainText) {
      showToast('Only plain text files can be imported as chapters.');
      return;
    }

    const existingIds = new Set(workspace.opf.manifest.map(item => item.id));
    const collidingAll = files.filter(file => existingIds.has(sanitizeChapterId(file.name)));
    const clean = files.filter(file => !existingIds.has(sanitizeChapterId(file.name)));

    try {
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
        if (firstId) selectChapter(firstId);
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
      fail(err, 'Failed to import chapters');
    }
  }

  // EPUB core image media types — what an image chapter may be made from.
  const CHAPTER_IMAGE_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ]);

  // Create a chapter per uploaded image (fixed-layout page import): the image
  // lands in the manifest (Images/, auto-renamed on collision) and the chapter
  // source is the project's image insertion template pointing at it. Files are
  // ordered by name so a picker's selection order can't scramble the pages.
  async function handleImportImageChapters(files: File[]) {
    if (readOnly || !workspaceService) return;

    const unsupported = files.filter(file => !CHAPTER_IMAGE_TYPES.has(reliableMediaType(file)));
    if (unsupported.length > 0) {
      showToast('Only PNG, JPEG, GIF, WebP or SVG images can be imported as chapters.');
      return;
    }

    const ordered = [...files].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    try {
      const settings = settingsService
        ? await settingsService.loadEPUBSettings(workspace.id)
        : null;

      let current = workspace;
      let firstChapterId: string | null = null;
      for (const file of ordered) {
        const imported = await importFileToManifest(current, workspaceService, file);
        current = imported.workspace;
        const sourceText = formatImageSnippet(settings?.image_template || '![<alt>](<href>)', {
          href: convertManifestPathToXHTMLPath(imported.href),
          alt: filenameStem(file.name),
        });
        const result = await spineService.addChapter(current, {
          title: filenameStem(file.name),
          idBasename: settings?.spine_basename,
          sourceText,
          createSourceFile: true,
          linear: true,
        });
        current = result.updatedWorkspace;
        if (!firstChapterId) firstChapterId = result.newChapter.id;
      }

      onWorkspaceUpdate(current);
      if (firstChapterId) selectChapter(firstChapterId);
    } catch (err) {
      fail(err, 'Failed to import image chapters');
    }
  }

  // Import a set of non-colliding text files as new chapters. Returns the first
  // created chapter id (for selection), or null when nothing was imported.
  async function importChaptersDirectly(files: File[]): Promise<string | null> {
    if (files.length === 0) return null;
    let current = workspace;
    let firstChapterId: string | null = null;
    for (const file of files) {
      const text = await file.text();
      const result = await spineService.addChapter(current, {
        title: file.name,
        baseName: file.name,
        sourceText: text,
        createSourceFile: true,
        linear: true,
      });
      current = result.updatedWorkspace;
      if (!firstChapterId) firstChapterId = result.newChapter.id;
    }
    onWorkspaceUpdate(current);
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
        current = await storage.readTextFile(workspace.id, `SOURCE/text/${targetId}.txt`);
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
    const byKey = new Map(decisions.map(d => [d.key, d.resolution]));
    let current = workspace;
    let firstId: string | null = null;
    const overwrittenPaths: string[] = [];
    try {
      for (const candidate of pendingImport) {
        if (byKey.get(candidate.stagedPath) === 'skip') continue;
        const text = await readStagedText(candidate.stagedPath);
        if (byKey.get(candidate.stagedPath) === 'keep-both') {
          const result = await spineService.addChapter(current, {
            title: candidate.originalName,
            baseName: candidate.originalName,
            sourceText: text,
            createSourceFile: true,
            linear: true,
          });
          current = result.updatedWorkspace;
          if (!firstId) firstId = result.newChapter.id;
        } else {
          await spineService.overwriteChapter(current, candidate.targetId, {
            title: candidate.originalName,
            sourceText: text,
          });
          overwrittenPaths.push(`SOURCE/text/${candidate.targetId}.txt`);
          if (!firstId) firstId = candidate.targetId;
        }
      }
      onWorkspaceUpdate(current);
      // An overwrite rewrites a chapter's source under its existing id, so the
      // editor's cached store for that file would otherwise keep showing the old
      // text. Nudge any open editor to re-read the affected files.
      if (overwrittenPaths.length > 0) {
        window.dispatchEvent(
          new CustomEvent('seed:source-files-changed', { detail: { paths: overwrittenPaths } })
        );
      }
      if (firstId) selectChapter(firstId);
    } catch (err) {
      fail(err, 'Failed to import chapters');
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
  async function handleFolderSyncOpen() {
    if (readOnly) return;
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
      fail(err, 'Folder sync failed');
    }
  }

  async function linkNewFolder() {
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
    if (!settingsService) return;
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
    await deleteFolderHandle(workspace.id);
    await saveFolderSyncMeta(null);
    syncPlan = null;
    notifyFolderSyncChanged();
    showToast($t('Folder unlinked. Chapters were not changed.'));
  }

  async function commitFolderSync(decisions: FolderSyncDecision[]) {
    if (!syncPlan) return;
    const byKey = new Map(decisions.map(d => [d.key, d.resolution]));
    const overwrittenPaths: string[] = [];
    let current = workspace;
    let added = 0;
    let updated = 0;
    let removed = 0;

    for (const row of syncPlan.rows) {
      if (row.kind === 'skipped') continue;
      const resolution = byKey.get(folderSyncRowKey(row)) ?? 'skip';
      if (resolution === 'skip') continue;

      if (row.kind === 'update' && resolution === 'apply') {
        await spineService.overwriteChapter(current, row.targetId, {
          title: row.name,
          sourceText: row.incoming,
        });
        overwrittenPaths.push(`SOURCE/text/${row.targetId}.txt`);
        updated += 1;
      } else if (row.kind === 'remove') {
        const result = await spineService.deleteChapter(current, row.targetId);
        current = result.updatedWorkspace;
        removed += 1;
      } else {
        // add rows, and updates resolved as keep-both — addChapter uniquifies
        // the id, which is also how colliding adds land under a new id.
        const result = await spineService.addChapter(current, {
          title: row.name,
          baseName: row.name,
          sourceText: row.incoming,
          createSourceFile: true,
          linear: true,
        });
        current = result.updatedWorkspace;
        added += 1;
      }
    }

    onWorkspaceUpdate(current);
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
</script>

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
