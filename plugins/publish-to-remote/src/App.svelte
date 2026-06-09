<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { dirHandle } from './store.js';
  import { readRemotes, writeRemotes } from './opfs.js';
  import {
    uploadFile,
    listFiles,
    deleteFile,
    getPublicUrl,
    uploadTextFile,
  } from './remote-ops.js';
  import { loadGoogleScripts, authorizeGoogleDrive } from './google-drive.js';
  import { generateOpdsFeed } from './opds.js';
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
  let localEpubs: File[] = $state([]);
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
        showStatus(`Failed to load EPUBs: ${String(err)}`, 'error');
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
      showStatus(`Failed to save config: ${String(error)}`, 'error');
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
      showStatus(`Authorization failed: ${String(error)}`, 'error');
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
        `${epub.name}: ${report.errorCount} errors, ${report.warningCount} warnings`,
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
      showStatus(`Validation failed: ${String(error)}`, 'error');
    }
  }

  async function onDeleteEpub(epub: File) {
    if (!$dirHandle) return;
    try {
      await $dirHandle.removeEntry(epub.name);
      await deleteValidationReport(epub.name);
      clearLatestReport(epub.name);
      epubValidationStatus.delete(epub.name);
      await loadLocalEpubs();
      showStatus(`${epub.name} deleted`, 'info');
    } catch (error) {
      showStatus(`Delete error: ${String(error)}`, 'error');
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
        showStatus(`${epub.name} uploaded successfully`, 'success');
        await refreshObjectList();
      } else {
        showStatus(result.error || 'Upload failed', 'error');
      }
    } catch (error) {
      showStatus(`Upload error: ${String(error)}`, 'error');
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
        showStatus(`${key} deleted`, 'success');
      } else {
        showStatus(result.error || 'Delete failed', 'error');
      }
    } catch (error) {
      showStatus(`Delete error: ${String(error)}`, 'error');
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
      showStatus(`Removed ${name}`, 'info');
      // No remotes left → offer the configure form in the right pane.
      if (remotesStore.remotes.length === 0) {
        editingRemote = null;
        configuring = true;
      }
      view = 'ready';
    } catch (error) {
      showStatus(`Sign out error: ${String(error)}`, 'error');
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
        showStatus('URL copied to clipboard', 'success');
      });
    }
  }

  async function onUpdateCatalog() {
    if (!activeRemote) return;
    generatingFeed = true;
    try {
      // Configurable per remote (S3/WebDAV); defaults to catalog.xml.
      const catalogName =
        (activeRemote.type === 's3-compatible' || activeRemote.type === 'webdav') &&
        activeRemote.catalogFilename?.trim()
          ? activeRemote.catalogFilename.trim()
          : 'catalog.xml';
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
      const xml = generateOpdsFeed(activeRemote, remoteObjects, feedUrl);
      const result = await uploadTextFile(activeRemote, catalogName, xml);
      if (result.success) {
        showStatus(`Catalog updated: ${result.url || feedUrl}`, 'success');
        await refreshObjectList();
      } else {
        showStatus(result.error || 'Catalog update failed', 'error');
      }
    } catch (error) {
      showStatus(`Catalog update error: ${String(error)}`, 'error');
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
            <PaneHeader>Local epubs</PaneHeader>
            <div class="pane-body">
              <LocalEpubList
                epubs={localEpubs}
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
            <PaneHeader>Remote files</PaneHeader>
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
                      {generatingFeed ? 'Updating...' : 'Update Catalog'}
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
        <div class="loading">Initializing...</div>
      {:else if view === 'loading'}
        <div class="loading">Connecting to storage...</div>
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
        aria-label="Dismiss"
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
