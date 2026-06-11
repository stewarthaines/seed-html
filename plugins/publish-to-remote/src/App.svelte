<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { t, translate } from './i18n.js';
  import { dirHandle, activeIdentifier } from './store.js';
  import { readRemotes, writeRemotes, readSidecars, pngDataUri } from './opfs.js';
  import {
    uploadFile,
    listFiles,
    deleteFile,
    getPublicUrl,
    uploadTextFile,
    downloadTextFile,
  } from './remote-ops.js';
  import { loadGoogleScripts, authorizeGoogleDrive } from './google-drive.js';
  import { generateOpdsFeed, acquisitionUrl } from './opds.js';
  import {
    validateEpub,
    saveValidationReport,
    loadValidationReport,
    deleteValidationReport,
    publishLatestReport,
    clearLatestReport,
  } from './epub-validation.js';
  import type {
    RemoteConfig,
    RemotesStore,
    S3Object,
    NavigateMessage,
  } from './types.js';
  import type { ValidationReport } from './epub-validation.js';
  import ConfigureForm from './components/ConfigureForm.svelte';
  import LocalEpubList from './components/LocalEpubList.svelte';
  import PaneHeader from './components/PaneHeader.svelte';
  import RemoteFileList from './components/RemoteFileList.svelte';
  import RemoteSelector from './components/RemoteSelector.svelte';
  import ValidationModal from './components/ValidationModal.svelte';

  const GOOGLE_CLIENT_ID =
    (import.meta.env as Record<string, string>).VITE_GOOGLE_CLIENT_ID || '';
  const GOOGLE_API_KEY =
    (import.meta.env as Record<string, string>).VITE_GOOGLE_API_KEY || '';
  const DROPBOX_APP_KEY = (
    (import.meta.env as Record<string, string>).VITE_DROPBOX_APP_KEY || ''
  ).toString();
  const DROPBOX_REDIRECT_URI =
    (import.meta.env as Record<string, string>).VITE_DROPBOX_REDIRECT_URI || '';

  type ViewState = 'init' | 'loading' | 'ready';

  let view: ViewState = $state('init');
  // Configuring is a sub-state of 'ready': the add/edit form shows in the right
  // pane instead of taking over the whole view.
  let configuring = $state(false);
  let remotesStore: RemotesStore = $state({
    remotes: [],
    activeRemoteId: null,
  });
  const activeRemote = $derived(
    remotesStore.remotes.find((r) => r.id === remotesStore.activeRemoteId) ??
      null,
  );

  let remoteObjects: S3Object[] = $state([]);
  // Remote epub keys selected for inclusion in the catalog. Initialised once per
  // remote (from the existing catalog, or all epubs as a fallback).
  let selectedKeys = $state<Set<string>>(new Set());
  let selectionInitedFor: string | null = $state(null);
  let localEpubs: File[] = $state([]);
  // Per-local-epub sidecar metadata (title/author + inlined thumbnail + the
  // publication identifier), keyed by `<base>.epub`. Rebuilt on each reload.
  let localMeta = $state<
    Map<
      string,
      { title?: string; authors?: string[]; thumbnailUrl?: string; identifier?: string }
    >
  >(new Map());

  // Filenames whose sidecar identifier matches the open project — these rows get
  // the "active" outline. Local epub filenames equal remote object keys, so this
  // one set drives both lists.
  const activeFilenames = $derived(
    new Set(
      [...localMeta]
        .filter(([, m]) => m.identifier && m.identifier === $activeIdentifier)
        .map(([key]) => key),
    ),
  );

  // Hosted thumbnail URL per remote epub key, derived from the listing: each
  // epub's sibling `<base>.thumb.png` resolved to its public URL.
  const remoteThumbUrls = $derived.by(() => {
    const m = new Map<string, string>();
    if (!activeRemote) return m;
    const byKey = new Map(remoteObjects.map((o) => [o.key, o]));
    for (const o of remoteObjects) {
      if (!o.key.toLowerCase().endsWith('.epub')) continue;
      const thumbKey = o.key.replace(/\.epub$/i, '.thumb.png');
      const thumb = byKey.get(thumbKey);
      if (thumb) m.set(o.key, getPublicUrl(activeRemote, thumbKey, thumb.fileId));
    }
    return m;
  });
  let uploading = $state(false);
  let uploadProgress: number | null = $state(null);
  let uploadingEpubName: string | null = $state(null);
  let epubValidationStatus: Map<
    string,
    {
      isValid: boolean | null;
      isValidating: boolean;
      report: ValidationReport | null;
    }
  > = new SvelteMap();
  let showValidationModal = $state(false);
  let validationModalReport: ValidationReport | null = $state(null);
  let generatingFeed = $state(false);
  let googleAuthRequired = $state(false);
  let editingRemote: RemoteConfig | null = $state(null);
  let statusMessage: {
    text: string;
    type: 'info' | 'success' | 'error';
  } | null = $state(null);

  let lastDirHandle: FileSystemDirectoryHandle | null = null;
  $effect(() => {
    if ($dirHandle && $dirHandle !== lastDirHandle) {
      lastDirHandle = $dirHandle;
      loadLocalEpubs().catch((err) => {
        console.error('Failed to load local EPUBs:', err);
        showStatus(
          translate('Failed to load EPUBs: {error}', { error: String(err) }),
          'error',
        );
      });
    }
  });

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    if (window.opener && params.has('code') && params.has('state')) {
      window.opener.postMessage(
        {
          type: 'dropbox-auth',
          code: params.get('code'),
          state: params.get('state'),
        },
        window.location.origin,
      );
      window.close();
      return;
    }

    if (GOOGLE_CLIENT_ID) {
      loadGoogleScripts().catch((err) =>
        console.warn('Failed to preload Google scripts:', err),
      );
    }

    const saved = await readRemotes();
    remotesStore = saved;
    const active = saved.remotes.find((r) => r.id === saved.activeRemoteId);
    if (!active) {
      // No remote yet: show the split with the configure form in the right pane
      // (left pane still lists local EPUBs).
      editingRemote = null;
      configuring = true;
      await loadLocalEpubs();
      view = 'ready';
    } else {
      await refreshObjectList(active);
    }
  });

  async function loadLocalEpubs() {
    if (!$dirHandle) return;
    try {
      const entries: FileSystemHandle[] = [];
      for await (const entry of $dirHandle.values()) {
        entries.push(entry);
      }
      const epubFiles = entries.filter(
        (entry): entry is FileSystemFileHandle =>
          entry.kind === 'file' && entry.name.endsWith('.epub'),
      );
      const files: File[] = [];
      for (const fileHandle of epubFiles) {
        files.push(await fileHandle.getFile());
      }
      localEpubs = files;

      // Sidecar metadata (title/author + thumbnail) to enrich the local rows.
      const sidecars = await readSidecars($dirHandle);
      const meta = new Map<
        string,
        { title?: string; authors?: string[]; thumbnailUrl?: string; identifier?: string }
      >();
      for (const [key, m] of sidecars) {
        meta.set(key, {
          title: m.title,
          authors: m.authors,
          thumbnailUrl: m.thumbnailBytes ? pngDataUri(m.thumbnailBytes) : undefined,
          identifier: m.identifier,
        });
      }
      localMeta = meta;

      for (const file of files) {
        let report = await loadValidationReport(file.name);
        // A report from before the file's last write is stale — the epub was
        // re-packaged under the same name — so drop it and offer Validate again.
        if (report && file.lastModified > report.timestamp) {
          await deleteValidationReport(file.name);
          report = null;
        }
        if (report) report.isValid = report.errorCount === 0;
        epubValidationStatus.set(file.name, {
          isValid: report?.isValid ?? null,
          isValidating: false,
          report: report ?? null,
        });
      }
    } catch (err) {
      console.error('Error reading local EPUBs:', err);
      throw err;
    }
  }

  async function refreshObjectList(remote?: RemoteConfig) {
    const target = remote || activeRemote;
    if (!target) return;
    const result = await listFiles(target);
    if (result.error === 'GOOGLE_AUTH_REQUIRED') {
      googleAuthRequired = true;
      remoteObjects = [];
      await loadLocalEpubs();
      view = 'ready';
    } else if (result.error) {
      showStatus(result.error, 'error');
      // Open the failing remote for fixing, in the right pane.
      editingRemote = target;
      configuring = true;
      await loadLocalEpubs();
      view = 'ready';
    } else {
      googleAuthRequired = false;
      remoteObjects = result.objects;
      // Initialise the catalog selection once per remote (from its existing
      // catalog, or all epubs). Later refreshes preserve the user's choices.
      if (selectionInitedFor !== target.id) {
        selectionInitedFor = target.id;
        selectedKeys = await computeInitialSelection(target, result.objects);
      }
      await loadLocalEpubs();
      view = 'ready';
    }
  }

  async function onSaveRemote(remote: RemoteConfig, isNew: boolean) {
    try {
      let updated = remotesStore.remotes;
      if (isNew) {
        updated = [...updated, remote];
        remotesStore = {
          ...remotesStore,
          remotes: updated,
          activeRemoteId: remote.id,
        };
      } else {
        updated = updated.map((r) => (r.id === remote.id ? remote : r));
        remotesStore = { ...remotesStore, remotes: updated };
      }
      await writeRemotes(remotesStore);
      configuring = false;
      view = 'loading';
      await refreshObjectList();
    } catch (error) {
      showStatus(
        translate('Failed to save config: {error}', { error: String(error) }),
        'error',
      );
    }
  }

  function onOpenConfigure(remoteId?: string) {
    editingRemote = remoteId
      ? (remotesStore.remotes.find((r) => r.id === remoteId) ?? null)
      : null;
    configuring = true;
    view = 'ready';
  }

  function onCancelConfig() {
    configuring = false;
  }

  async function onReconnectGoogleDrive() {
    if (!activeRemote || activeRemote.type !== 'google-drive') return;
    try {
      await loadGoogleScripts();
      const token = await authorizeGoogleDrive(activeRemote.clientId);
      remotesStore = {
        ...remotesStore,
        remotes: remotesStore.remotes.map((r) =>
          r.id === activeRemote!.id ? { ...r, accessToken: token } : r,
        ),
      };
      await writeRemotes(remotesStore);
      googleAuthRequired = false;
      await refreshObjectList();
    } catch (error) {
      showStatus(
        translate('Authorization failed: {error}', { error: String(error) }),
        'error',
      );
    }
  }

  async function onValidateEpub(epub: File) {
    const prev = epubValidationStatus.get(epub.name);
    // SvelteMap only signals when the value reference changes, so set a fresh
    // object each time rather than mutating the stored one in place — otherwise
    // the row's tick wouldn't update until the next full reload.
    epubValidationStatus.set(epub.name, {
      isValid: prev?.isValid ?? null,
      isValidating: true,
      report: prev?.report ?? null,
    });

    try {
      const report = await validateEpub(epub);
      await saveValidationReport(report);
      // Mirror to the host so the spine editor's reference panel can read it.
      publishLatestReport(report);
      epubValidationStatus.set(epub.name, {
        isValid: report.isValid,
        isValidating: false,
        report,
      });
      showStatus(
        translate('{name}: {errors} errors, {warnings} warnings', {
          name: epub.name,
          errors: report.errorCount,
          warnings: report.warningCount,
        }),
        report.isValid ? 'success' : 'info',
      );
      // Surface the report immediately when there's something to act on, saving the
      // extra click on "Report". Info-only/clean results just leave the summary.
      if (report.errorCount > 0 || report.warningCount > 0) {
        validationModalReport = report;
        showValidationModal = true;
      }
    } catch (error) {
      epubValidationStatus.set(epub.name, {
        isValid: prev?.isValid ?? null,
        isValidating: false,
        report: prev?.report ?? null,
      });
      showStatus(
        translate('Validation failed: {error}', { error: String(error) }),
        'error',
      );
    }
  }

  async function onDeleteEpub(epub: File) {
    if (!$dirHandle) return;
    try {
      await $dirHandle.removeEntry(epub.name);
      // Remove the OPDS sidecars (metadata JSON + thumbnail), if any.
      const base = epub.name.replace(/\.epub$/i, '');
      for (const sidecar of [`${base}.json`, `${base}.thumb.png`]) {
        try {
          await $dirHandle.removeEntry(sidecar);
        } catch {
          // Sidecar may not exist — ignore.
        }
      }
      await deleteValidationReport(epub.name);
      clearLatestReport(epub.name);
      epubValidationStatus.delete(epub.name);
      await loadLocalEpubs();
      showStatus(translate('{name} deleted', { name: epub.name }), 'info');
    } catch (error) {
      showStatus(
        translate('Delete error: {error}', { error: String(error) }),
        'error',
      );
    }
  }

  function onViewValidationReport(epub: File) {
    const status = epubValidationStatus.get(epub.name);
    if (!status?.report) return;
    validationModalReport = status.report;
    showValidationModal = true;
    // Opening an older epub's saved report makes it the editor's reference too.
    publishLatestReport(status.report);
  }

  // Ask the host (same-origin parent) to open the chapter for a content path.
  function onValidationNavigate(path: string) {
    const message: NavigateMessage = { type: 'navigate', path };
    window.parent.postMessage(message, window.origin);
  }

  async function onUploadEpub(epub: File) {
    if (!activeRemote) return;
    uploading = true;
    uploadProgress = 0;
    uploadingEpubName = epub.name;

    try {
      const result = await uploadFile(
        activeRemote,
        epub.name,
        epub,
        'application/epub+zip',
        (percent: number) => {
          uploadProgress = percent;
        },
      );
      if (result.success) {
        showStatus(
          translate('{name} uploaded successfully', { name: epub.name }),
          'success',
        );
        await refreshObjectList();
      } else {
        showStatus(result.error || translate('Upload failed'), 'error');
      }
    } catch (error) {
      showStatus(
        translate('Upload error: {error}', { error: String(error) }),
        'error',
      );
    } finally {
      uploading = false;
      uploadProgress = null;
      uploadingEpubName = null;
    }
  }

  // Save a local epub to disk. The epub is already an in-memory File.
  function onDownloadEpub(epub: File) {
    const url = URL.createObjectURL(epub);
    const a = document.createElement('a');
    a.href = url;
    a.download = epub.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function onDeleteObject(key: string) {
    if (!activeRemote) return;
    try {
      const result = await deleteFile(activeRemote, key);
      if (result.success) {
        remoteObjects = remoteObjects.filter((o) => o.key !== key);
        showStatus(translate('{key} deleted', { key }), 'success');
      } else {
        showStatus(result.error || translate('Delete failed'), 'error');
      }
    } catch (error) {
      showStatus(
        translate('Delete error: {error}', { error: String(error) }),
        'error',
      );
    }
  }

  async function onSignOut() {
    if (!activeRemote) return;
    try {
      const name = activeRemote.name;
      const updated = remotesStore.remotes.filter(
        (r) => r.id !== activeRemote!.id,
      );
      remotesStore = {
        remotes: updated,
        activeRemoteId: updated.length > 0 ? updated[0].id : null,
      };
      await writeRemotes(remotesStore);
      remoteObjects = [];
      showStatus(translate('Removed {name}', { name }), 'info');
      // No remotes left → offer the configure form in the right pane.
      if (remotesStore.remotes.length === 0) {
        editingRemote = null;
        configuring = true;
      }
      view = 'ready';
    } catch (error) {
      showStatus(
        translate('Sign out error: {error}', { error: String(error) }),
        'error',
      );
    }
  }

  async function onSetActiveRemote(remoteId: string) {
    const remote = remotesStore.remotes.find((r) => r.id === remoteId);
    if (!remote) return;
    remotesStore = { ...remotesStore, activeRemoteId: remoteId };
    await writeRemotes(remotesStore);
    await refreshObjectList(remote);
  }

  function onCopyUrl(key: string, fileId?: string) {
    if (!activeRemote) return;
    const url = getPublicUrl(activeRemote, key, fileId);
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        showStatus(translate('URL copied to clipboard'), 'success');
      });
    }
  }

  // The catalog filename for a remote (configurable on S3/WebDAV; default below).
  function catalogFilenameFor(remote: RemoteConfig): string {
    return (remote.type === 's3-compatible' || remote.type === 'webdav') &&
      remote.catalogFilename?.trim()
      ? remote.catalogFilename.trim()
      : 'catalog.xml';
  }

  function onToggleSelect(key: string, checked: boolean) {
    const next = new Set(selectedKeys);
    if (checked) next.add(key);
    else next.delete(key);
    selectedKeys = next;
  }

  function onToggleAllEpubs(checked: boolean) {
    selectedKeys = checked
      ? new Set(remoteObjects.filter((o) => o.key.toLowerCase().endsWith('.epub')).map((o) => o.key))
      : new Set();
  }

  // Initial checkbox state for a remote: the epubs already in its catalog.xml
  // (best-effort read). No catalog / unsupported remote / error → include all.
  async function computeInitialSelection(
    remote: RemoteConfig,
    objects: S3Object[],
  ): Promise<Set<string>> {
    const epubs = objects.filter((o) => o.key.toLowerCase().endsWith('.epub'));
    try {
      const xml = await downloadTextFile(remote, catalogFilenameFor(remote));
      if (xml) {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const hrefs = new Set(
          Array.from(doc.querySelectorAll('entry link[type="application/epub+zip"]'))
            .map((l) => l.getAttribute('href'))
            .filter((h): h is string => !!h),
        );
        return new Set(
          epubs.filter((o) => hrefs.has(acquisitionUrl(remote, o))).map((o) => o.key),
        );
      }
    } catch {
      // Fall through to all-selected.
    }
    return new Set(epubs.map((o) => o.key));
  }

  async function onUpdateCatalog() {
    if (!activeRemote) return;
    generatingFeed = true;
    try {
      const catalogName = catalogFilenameFor(activeRemote);
      let feedUrl = '';
      if (activeRemote.type === 's3-compatible') {
        feedUrl = getPublicUrl(activeRemote, catalogName);
      } else if (activeRemote.type === 'google-drive') {
        feedUrl = `https://drive.google.com/${catalogName}`;
      } else if (activeRemote.type === 'dropbox') {
        feedUrl = `https://www.dropbox.com/${catalogName}`;
      } else if (activeRemote.type === 'webdav') {
        feedUrl = getPublicUrl(activeRemote, catalogName);
      }
      // Enrich entries with cover + metadata from local sidecars (matched to
      // remote objects by filename). Absent sidecars degrade to filename-only.
      const metaByKey = $dirHandle ? await readSidecars($dirHandle) : new Map();

      // Host each cover thumbnail on the remote and attach its resolvable URL —
      // OPDS clients (Cantook etc.) render hosted images, not data: URIs. Only
      // for epubs actually present on the remote; reuse an already-uploaded
      // thumbnail rather than re-uploading every time.
      const existing = new Map(remoteObjects.map((o) => [o.key, o]));
      for (const [epubKey, meta] of metaByKey) {
        // Only host thumbnails for epubs that are selected and on the remote.
        if (!meta.thumbnailBytes || !existing.has(epubKey) || !selectedKeys.has(epubKey)) continue;
        const thumbKey = `${epubKey.replace(/\.epub$/i, '')}.thumb.png`;
        const already = existing.get(thumbKey);
        if (already) {
          meta.thumbnailUrl = getPublicUrl(activeRemote, thumbKey, already.fileId);
        } else {
          const blob = new Blob([meta.thumbnailBytes], { type: 'image/png' });
          const res = await uploadFile(activeRemote, thumbKey, blob, 'image/png');
          if (res.success) meta.thumbnailUrl = res.url || getPublicUrl(activeRemote, thumbKey);
        }
        delete meta.thumbnailBytes;
      }

      const xml = generateOpdsFeed(
        activeRemote,
        remoteObjects,
        feedUrl,
        metaByKey,
        selectedKeys,
      );
      const result = await uploadTextFile(activeRemote, catalogName, xml);
      if (result.success) {
        showStatus(
          translate('Catalog updated: {url}', { url: result.url || feedUrl }),
          'success',
        );
        await refreshObjectList();
      } else {
        showStatus(result.error || translate('Catalog update failed'), 'error');
      }
    } catch (error) {
      showStatus(
        translate('Catalog update error: {error}', { error: String(error) }),
        'error',
      );
    } finally {
      generatingFeed = false;
    }
  }

  function showStatus(text: string, type: 'info' | 'success' | 'error') {
    statusMessage = { text, type };
    if (type === 'success') {
      setTimeout(() => {
        if (statusMessage?.text === text) statusMessage = null;
      }, 3000);
    }
  }
</script>

<div class="plugin-container">
  {#if view === 'ready'}
    <div class="panes">
      <!-- Shares the host app's pane key (same-origin, un-sandboxed iframe) so
           the split proportion matches the editor/Settings/Projects splits.
           Pane constraints must match the host's for paneforge to reuse it. -->
      <PaneGroup direction="horizontal" autoSaveId="editme-content-panes">
        <Pane defaultSize={50} minSize={25}>
          <div class="pane">
            <PaneHeader>{$t('Local Packaged EPUBs')}</PaneHeader>
            <div class="pane-body">
              <LocalEpubList
                epubs={localEpubs}
                meta={localMeta}
                {activeFilenames}
                {remoteObjects}
                {epubValidationStatus}
                {uploading}
                {uploadProgress}
                {uploadingEpubName}
                onUpload={onUploadEpub}
                onValidate={onValidateEpub}
                onViewReport={onViewValidationReport}
                onDownload={onDownloadEpub}
                onDelete={onDeleteEpub}
              />
            </div>
          </div>
        </Pane>

        <PaneResizer />

        <Pane defaultSize={50} minSize={20}>
          <div class="pane">
            <PaneHeader>{$t('Bring-your-own File Storage')}</PaneHeader>
            <div class="pane-body">
              {#if configuring}
                <ConfigureForm
                  {editingRemote}
                  googleClientId={GOOGLE_CLIENT_ID}
                  googleApiKey={GOOGLE_API_KEY}
                  dropboxAppKey={DROPBOX_APP_KEY}
                  dropboxRedirectUri={DROPBOX_REDIRECT_URI}
                  canCancel={remotesStore.remotes.length > 0}
                  onSave={onSaveRemote}
                  onCancel={onCancelConfig}
                  onStatus={showStatus}
                />
              {:else}
                <RemoteSelector
                  {remotesStore}
                  {activeRemote}
                  {googleAuthRequired}
                  onAdd={() => onOpenConfigure()}
                  onEdit={(id) => onOpenConfigure(id)}
                  onRemove={onSignOut}
                  onSelect={onSetActiveRemote}
                  onReconnect={onReconnectGoogleDrive}
                />

                <RemoteFileList
                  objects={remoteObjects}
                  thumbnailUrls={remoteThumbUrls}
                  {activeFilenames}
                  {selectedKeys}
                  {onToggleSelect}
                  {onToggleAllEpubs}
                  {googleAuthRequired}
                  {onCopyUrl}
                  onDelete={onDeleteObject}
                />

                {#if activeRemote?.type !== 'google-drive'}
                  <div class="footer">
                    <button
                      class="btn btn-secondary"
                      onclick={onUpdateCatalog}
                      disabled={generatingFeed}
                    >
                      {generatingFeed
                        ? $t('Updating...')
                        : $t('Update Catalog')}
                    </button>
                  </div>
                {/if}
              {/if}
            </div>
          </div>
        </Pane>
      </PaneGroup>
    </div>
  {:else}
    <div class="centered">
      {#if view === 'init'}
        <div class="loading">{$t('Initializing...')}</div>
      {:else if view === 'loading'}
        <div class="loading">{$t('Connecting to storage...')}</div>
      {/if}
    </div>
  {/if}

  <!-- Transient status: a fixed overlay so it never reflows the panes. -->
  {#if statusMessage}
    <div
      class="status-toast"
      class:error={statusMessage.type === 'error'}
      class:success={statusMessage.type === 'success'}
      role="status"
      aria-live="polite"
    >
      <span class="status-toast-text">{statusMessage.text}</span>
      <button
        class="status-toast-close"
        aria-label={$t('Dismiss')}
        onclick={() => (statusMessage = null)}>×</button
      >
    </div>
  {/if}

  <ValidationModal
    report={validationModalReport}
    show={showValidationModal}
    onClose={() => (showValidationModal = false)}
    onNavigate={onValidationNavigate}
  />
</div>

<style>
  .plugin-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* Non-split views (init / configure / loading) keep the centered column. */
  .centered {
    flex: 1;
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    padding: 16px;
    overflow-y: auto;
  }

  /* The split fills the frame; paneforge sizes the group to this wrapper. */
  .panes {
    flex: 1;
    min-height: 0;
  }

  .pane {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .pane-body {
    flex: 1;
    min-height: 0; /* allow the flex child to shrink so overflow-y can scroll */
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  :global([data-pane-resizer]) {
    width: 4px;
    background: var(--color-border-default);
    cursor: col-resize;
    transition: background-color 0.2s ease;
  }

  :global([data-pane-resizer]:hover),
  :global([data-pane-resizer][data-resize-handle-active]) {
    background: var(--color-accent);
  }

  :global([data-pane-resizer]:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: -1px;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .loading {
    text-align: center;
    padding: 40px 20px;
    color: var(--color-text-secondary);
  }

  /* Fixed toast — overlays content, no layout reflow on show/hide. */
  .status-toast {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: min(90%, 480px);
    padding: 10px 12px 10px 16px;
    border-radius: 6px;
    border-left: 4px solid var(--color-info-border);
    background: var(--color-info-bg);
    color: var(--color-info-text);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .status-toast.success {
    border-left-color: var(--color-success-border);
    background: var(--color-success-bg);
    color: var(--color-success-text);
  }

  .status-toast.error {
    border-left-color: var(--color-error-border);
    background: var(--color-error-bg);
    color: var(--color-error-text);
  }

  .status-toast-text {
    flex: 1;
  }

  .status-toast-close {
    background: none;
    border: none;
    color: inherit;
    font-size: 18px;
    line-height: 1;
    padding: 0 4px;
    cursor: pointer;
    opacity: 0.7;
  }

  .status-toast-close:hover {
    opacity: 1;
  }
</style>
