<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { t, translate } from './i18n.js';
  import { X } from 'phosphor-svelte';
  import { dirHandle, activeIdentifier } from './store.js';
  import {
    readRemotes,
    writeRemotes,
    readSidecars,
    pngDataUri,
  } from './opfs.js';
  import {
    uploadFile,
    listFiles,
    deleteFile,
    getPublicUrl,
    uploadTextFile,
    downloadTextFile,
  } from './remote-ops.js';
  import { loadGoogleScripts, authorizeGoogleDrive } from './google-drive.js';
  import {
    generateOpdsFeed,
    parseOpdsFeed,
    acquisitionUrl,
    defaultCatalogTitle,
    DEFAULT_CATALOG_AUTHOR_NAME,
    DEFAULT_CATALOG_AUTHOR_URI,
  } from './opds.js';
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
  // True while the active remote's file list is being (re)fetched, so the list
  // can show "Loading…" instead of the previous remote's stale files.
  let loadingObjects = $state(false);
  // Remote epub keys selected for inclusion in the catalog. Initialised once per
  // remote (from the existing catalog, or all epubs as a fallback).
  let selectedKeys = $state<Set<string>>(new Set());
  let selectionInitedFor: string | null = $state(null);

  // The catalog currently being edited in the right pane. `catalogFile` is the
  // remote object key it reads from / writes to (multiple catalogs can live on
  // one remote); name/uri drive the feed-level <author>. The bucket itself is
  // the source of truth — clicking a remote .xml loads it into these.
  const DEFAULT_CATALOG_FILE = 'catalog.xml';
  let catalogFile = $state(DEFAULT_CATALOG_FILE);
  let catalogTitle = $state('');
  let catalogName = $state(DEFAULT_CATALOG_AUTHOR_NAME);
  let catalogUri = $state(DEFAULT_CATALOG_AUTHOR_URI);
  // Snapshot of the last loaded/published catalog, for change detection. Null
  // until a remote loads, or when the typed filename isn't on the remote yet.
  let catalogSnapshot = $state<{
    file: string;
    title: string;
    name: string;
    uri: string;
    keys: string[];
  } | null>(null);

  const currentCatalog = $derived({
    file: catalogFile.trim(),
    title: catalogTitle.trim(),
    name: catalogName.trim(),
    uri: catalogUri.trim(),
    keys: [...selectedKeys].sort(),
  });
  // The editor is "dirty" (Update/Create enabled) when the filename, title,
  // name, uri, or epub selection differs from the loaded snapshot. No snapshot
  // (a brand-new or never-loaded catalog) counts as dirty so the first publish
  // is allowed.
  const catalogDirty = $derived.by(() => {
    const snap = catalogSnapshot;
    if (!snap) return true;
    const cur = currentCatalog;
    return (
      snap.file !== cur.file ||
      snap.title !== cur.title ||
      snap.name !== cur.name ||
      snap.uri !== cur.uri ||
      snap.keys.length !== cur.keys.length ||
      snap.keys.some((k, i) => k !== cur.keys[i])
    );
  });
  // Whether the typed filename already exists on the remote (→ "Update" vs "Create").
  const catalogExistsRemotely = $derived(
    remoteObjects.some((o) => o.key === catalogFile.trim()),
  );
  // Only S3 + WebDAV can read a catalog back, so only they support click-to-load.
  const catalogReadable = $derived(
    activeRemote?.type === 's3-compatible' || activeRemote?.type === 'webdav',
  );

  function captureCatalogSnapshot() {
    catalogSnapshot = {
      file: catalogFile.trim(),
      title: catalogTitle.trim(),
      name: catalogName.trim(),
      uri: catalogUri.trim(),
      keys: [...selectedKeys].sort(),
    };
  }
  let localEpubs: File[] = $state([]);
  // Per-local-epub sidecar metadata (title/author + inlined thumbnail + the
  // publication identifier), keyed by `<base>.epub`. Rebuilt on each reload.
  let localMeta = $state<
    Map<
      string,
      {
        title?: string;
        authors?: string[];
        thumbnailUrl?: string;
        identifier?: string;
      }
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
      if (thumb) {
        // Cache-bust by the file's modified time so an updated cover shows
        // immediately instead of the browser's cached image (same URL).
        const url = getPublicUrl(activeRemote, thumbKey, thumb.fileId);
        const v = encodeURIComponent(thumb.lastModified);
        m.set(o.key, url + (url.includes('?') ? '&' : '?') + 'v=' + v);
      }
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
        {
          title?: string;
          authors?: string[];
          thumbnailUrl?: string;
          identifier?: string;
        }
      >();
      for (const [key, m] of sidecars) {
        meta.set(key, {
          title: m.title,
          authors: m.authors,
          thumbnailUrl: m.thumbnailBytes
            ? pngDataUri(m.thumbnailBytes)
            : undefined,
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
    loadingObjects = true;
    try {
      await refreshObjectListInner(target);
    } finally {
      loadingObjects = false;
    }
  }

  async function refreshObjectListInner(target: RemoteConfig) {
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
        await initCatalogForRemote(target, result.objects);
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
      // Stamp the validated EPUB's identifier so the host's spine editor only
      // surfaces this report for the matching project.
      const report = await validateEpub(
        epub,
        localMeta.get(epub.name)?.identifier,
      );
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
    // Drop the previous remote's files immediately (and show "Loading…") so the
    // list never shows another remote's contents while the switch resolves.
    remoteObjects = [];
    loadingObjects = true;
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

  // Match an existing catalog's epub hrefs back to remote object keys.
  function keysFromHrefs(
    remote: RemoteConfig,
    objects: S3Object[],
    hrefs: Set<string>,
  ): Set<string> {
    return new Set(
      objects
        .filter((o) => o.key.toLowerCase().endsWith('.epub'))
        .filter((o) => hrefs.has(acquisitionUrl(remote, o)))
        .map((o) => o.key),
    );
  }

  // Initialise the editor for a remote from its default catalog (catalog.xml or
  // the configured filename): load name/uri + selection if it exists, else start
  // a new catalog with all epubs selected. Snapshots the clean state.
  async function initCatalogForRemote(
    remote: RemoteConfig,
    objects: S3Object[],
  ) {
    const file = catalogFilenameFor(remote);
    catalogFile = file;
    catalogTitle = defaultCatalogTitle(remote);
    catalogName = DEFAULT_CATALOG_AUTHOR_NAME;
    catalogUri = DEFAULT_CATALOG_AUTHOR_URI;
    const epubs = objects.filter((o) => o.key.toLowerCase().endsWith('.epub'));
    try {
      const xml = await downloadTextFile(remote, file);
      if (xml) {
        const parsed = parseOpdsFeed(xml);
        if (parsed.title) catalogTitle = parsed.title;
        if (parsed.authorName) catalogName = parsed.authorName;
        if (parsed.authorUri) catalogUri = parsed.authorUri;
        selectedKeys = keysFromHrefs(remote, objects, parsed.epubHrefs);
        captureCatalogSnapshot();
        return;
      }
    } catch {
      // Fall through to a new catalog with all epubs selected.
    }
    selectedKeys = new Set(epubs.map((o) => o.key));
    catalogSnapshot = null;
  }

  // Click a remote .xml catalog to load it into the editor: parse its author +
  // selection, then snapshot so the button reads clean until something changes.
  async function onLoadCatalog(key: string) {
    if (!activeRemote) return;
    try {
      const xml = await downloadTextFile(activeRemote, key);
      if (!xml) {
        showStatus(translate('Could not read that catalog'), 'error');
        return;
      }
      const parsed = parseOpdsFeed(xml);
      catalogFile = key;
      catalogTitle = parsed.title || defaultCatalogTitle(activeRemote);
      catalogName = parsed.authorName || DEFAULT_CATALOG_AUTHOR_NAME;
      catalogUri = parsed.authorUri || DEFAULT_CATALOG_AUTHOR_URI;
      selectedKeys = keysFromHrefs(
        activeRemote,
        remoteObjects,
        parsed.epubHrefs,
      );
      captureCatalogSnapshot();
    } catch (error) {
      showStatus(
        translate('Could not load catalog: {error}', { error: String(error) }),
        'error',
      );
    }
  }

  async function onUpdateCatalog() {
    if (!activeRemote) return;
    const catalogKey = catalogFile.trim();
    if (!catalogKey) return;
    generatingFeed = true;
    try {
      let feedUrl = '';
      if (activeRemote.type === 's3-compatible') {
        feedUrl = getPublicUrl(activeRemote, catalogKey);
      } else if (activeRemote.type === 'google-drive') {
        feedUrl = `https://drive.google.com/${catalogKey}`;
      } else if (activeRemote.type === 'dropbox') {
        feedUrl = `https://www.dropbox.com/${catalogKey}`;
      } else if (activeRemote.type === 'webdav') {
        feedUrl = getPublicUrl(activeRemote, catalogKey);
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
        if (
          !meta.thumbnailBytes ||
          !existing.has(epubKey) ||
          !selectedKeys.has(epubKey)
        )
          continue;
        const thumbKey = `${epubKey.replace(/\.epub$/i, '')}.thumb.png`;
        // Always (re)upload so a regenerated cover replaces the old remote
        // thumbnail (thumbnails are small; correctness over a saved request).
        const blob = new Blob([meta.thumbnailBytes], { type: 'image/png' });
        const res = await uploadFile(activeRemote, thumbKey, blob, 'image/png');
        if (res.success)
          meta.thumbnailUrl = res.url || getPublicUrl(activeRemote, thumbKey);
        delete meta.thumbnailBytes;
      }

      const xml = generateOpdsFeed(
        activeRemote,
        remoteObjects,
        feedUrl,
        metaByKey,
        selectedKeys,
        {
          title: catalogTitle,
          authorName: catalogName,
          authorUri: catalogUri,
        },
      );
      const result = await uploadTextFile(activeRemote, catalogKey, xml);
      if (result.success) {
        showStatus(
          translate('Catalog updated: {url}', { url: result.url || feedUrl }),
          'success',
        );
        // The just-pushed state is now the clean baseline.
        captureCatalogSnapshot();
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
                  {googleAuthRequired}
                  {onCopyUrl}
                  onLoadCatalog={catalogReadable ? onLoadCatalog : undefined}
                  loadedCatalogKey={catalogFile.trim()}
                  loading={loadingObjects}
                  onDelete={onDeleteObject}
                />

                {#if activeRemote?.type !== 'google-drive'}
                  <div class="catalog-editor">
                    <div class="catalog-fields">
                      <label class="catalog-field catalog-field-file">
                        <span class="catalog-field-label"
                          >{$t('Catalog file')}</span
                        >
                        <input
                          type="text"
                          class="catalog-input"
                          bind:value={catalogFile}
                          placeholder={DEFAULT_CATALOG_FILE}
                          spellcheck="false"
                          autocomplete="off"
                        />
                      </label>
                      <label class="catalog-field catalog-field-file">
                        <span class="catalog-field-label">{$t('Title')}</span>
                        <input
                          type="text"
                          class="catalog-input"
                          bind:value={catalogTitle}
                          placeholder={activeRemote
                            ? defaultCatalogTitle(activeRemote)
                            : ''}
                        />
                      </label>
                      <label class="catalog-field">
                        <span class="catalog-field-label">{$t('Name')}</span>
                        <input
                          type="text"
                          class="catalog-input"
                          bind:value={catalogName}
                          placeholder={DEFAULT_CATALOG_AUTHOR_NAME}
                        />
                      </label>
                      <label class="catalog-field">
                        <span class="catalog-field-label">{$t('URI')}</span>
                        <input
                          type="text"
                          class="catalog-input"
                          bind:value={catalogUri}
                          placeholder={DEFAULT_CATALOG_AUTHOR_URI}
                          spellcheck="false"
                          autocomplete="off"
                        />
                      </label>
                    </div>
                    <div class="footer">
                      <button
                        class="btn btn-primary"
                        onclick={onUpdateCatalog}
                        disabled={generatingFeed ||
                          !catalogDirty ||
                          !catalogFile.trim()}
                      >
                        {generatingFeed
                          ? $t('Updating...')
                          : catalogExistsRemotely
                            ? $t('Update Catalog')
                            : $t('Create Catalog')}
                      </button>
                    </div>
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
        onclick={() => (statusMessage = null)}
        ><X size={16} aria-hidden="true" /></button
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
    /* Slightly darker than the header for a clear division (#e0e0e0 vs #f0f0f0). */
    background: var(--color-border-default);
    cursor: col-resize;
    transition: background-color 0.2s ease;
  }

  /* Dark: border-default equals the header (#444), so lighten the divider to
     border-strong (#666) — matches the core app's resizer in both themes. */
  :global([data-theme='dark'] [data-pane-resizer]) {
    background: var(--color-border-strong);
  }

  :global([data-pane-resizer]:hover),
  :global([data-pane-resizer][data-resize-handle-active]) {
    background: var(--color-accent);
  }

  :global([data-pane-resizer]:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: -1px;
  }

  /* Catalog editor: per-catalog name/uri + filename, above the publish button. */
  .catalog-editor {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 12px;
  }

  .catalog-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
  }

  .catalog-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1 1 140px;
    min-width: 0;
  }

  /* The filename takes a line of its own; name + uri share the next row. */
  .catalog-field-file {
    flex-basis: 100%;
  }

  .catalog-field-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .catalog-input {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    font-size: 13px;
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-default);
    border-radius: 4px;
  }

  .catalog-input:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-bg-active);
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
