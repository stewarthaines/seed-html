<script lang="ts">
  import { t, currentLocale, documentDirection, i18nService } from '$lib/i18n';
  import { themeStore } from '$lib/stores/theme';
  import { saveBlob } from '$lib/zip/index.js';
  import type { PublishService, PublishedEpub } from '$lib/services/publish/publish.service.js';
  import {
    createInitMessage,
    createContextMessage,
    isPluginReadyMessage,
    isNavigateMessage,
    isReadEpubMessage,
    workspaceOpfsPath,
  } from '$lib/plugins/contract';
  import { PUBLISH_WORKSPACE_ID } from '$lib/workspace/types';
  import { isHttpContext, openEpubInReader, openEpubUrlInReader } from '$lib/reader/open-in-reader';

  interface Props {
    publishService: PublishService;
    /** Resolved iframe src for the publish plugin, or null to use the core feature. */
    pluginUrl?: string | null;
    /** Identifier echoed to the plugin in its `init` message. */
    projectId?: string;
    /** The open project's dc:identifier, for outlining its published row(s). */
    activeIdentifier?: string;
    /** Package the open book as a SEED EPUB (kept in this browser, listed below). */
    onPackage?: () => void;
    packaging?: boolean;
    /** The other outputs a book can be shared as; each is shown only when passed. */
    onGeneratePdf?: () => void;
    pdfGenerating?: boolean;
    onPackageWithoutSource?: () => void;
    packagingWithoutSource?: boolean;
    onPackageAsReadHtml?: () => void;
    readHtmlPackaging?: boolean;
    onPackageAsSeedHtml?: () => void;
    seedHtmlPackaging?: boolean;
    /** The open book is read-only (not a SEED EPUB): it cannot be repackaged. */
    isReadOnly?: boolean;
  }

  let {
    publishService,
    pluginUrl = null,
    projectId = 'publish',
    activeIdentifier = undefined,
    onPackage,
    packaging = false,
    onGeneratePdf,
    pdfGenerating = false,
    onPackageWithoutSource,
    packagingWithoutSource = false,
    onPackageAsReadHtml,
    readHtmlPackaging = false,
    onPackageAsSeedHtml,
    seedHtmlPackaging = false,
    isReadOnly = false,
  }: Props = $props();

  let pluginFrame = $state<HTMLIFrameElement | null>(null);

  // Plugin load-failure detection. The plugin owns the whole frame only while it's
  // available AND has actually come alive. A blank/error iframe (offline with an
  // uncached plugin.html, a 404, or a crashed plugin) never completes the
  // `plugin-ready` handshake — and `onerror` doesn't fire for a failed navigation
  // (the browser fires `onload` on its error page), so liveness is judged purely by
  // the handshake. On failure we fall back to the core publish view.
  let pluginReady = $state(false);
  let pluginFailed = $state(false);
  let pluginAttempt = $state(0);
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let capTimer: ReturnType<typeof setTimeout> | undefined;
  const showingPlugin = $derived(!!pluginUrl && !pluginFailed);

  let epubs = $state<PublishedEpub[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Cover thumbnail blob URLs, keyed by filename. Rebuilt (and revoked) whenever
  // the list reloads.
  let coverUrls = $state<Record<string, string>>({});
  $effect(() => {
    const created: string[] = [];
    const map: Record<string, string> = {};
    for (const epub of epubs) {
      if (epub.coverImageData) {
        const url = URL.createObjectURL(
          new Blob([epub.coverImageData.buffer], { type: epub.coverImageData.mediaType })
        );
        map[epub.filename] = url;
        created.push(url);
      }
    }
    coverUrls = map;
    return () => created.forEach(u => URL.revokeObjectURL(u));
  });

  async function load() {
    loading = true;
    error = null;
    try {
      epubs = await publishService.listPublishedEpubs();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load published EPUBs';
    } finally {
      loading = false;
    }
  }

  // List packaged epubs, refreshing as new ones are packaged. The cards need this
  // book's latest package whether or not the plugin is showing its own list.
  $effect(() => {
    load();
    const onPackaged = () => load();
    window.addEventListener('epub-packaged', onPackaged);
    return () => window.removeEventListener('epub-packaged', onPackaged);
  });

  // Plugin surface: hand the output directory over once the plugin signals ready,
  // and re-hand it whenever a new epub is packaged so the plugin re-reads the dir.
  // Re-sending `init` (with a fresh handle) is enough — no separate refresh message.
  $effect(() => {
    if (!showingPlugin) return;
    const handler = (event: MessageEvent) => {
      if (!pluginFrame || event.source !== pluginFrame.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      if (isPluginReadyMessage(event.data)) {
        // The plugin came alive — cancel failure detection and hand over.
        pluginReady = true;
        pluginFailed = false;
        clearTimeout(readyTimer);
        clearTimeout(capTimer);
        void sendPluginInit();
        sendPluginContext();
      } else if (isNavigateMessage(event.data)) {
        // Open the chapter for a content-document path by reusing the core's
        // spine selection event. The id is the file basename (same as the nav
        // preview's click-to-navigate), which also drops any OEBPS/ prefix.
        const match = event.data.path.match(/([^/]+)\.xhtml(?:#.*)?$/);
        if (match) {
          window.dispatchEvent(
            new CustomEvent('select-spine-item', { detail: { itemId: match[1] } })
          );
        }
      } else if (isReadEpubMessage(event.data)) {
        if (event.data.url) {
          // A remote object's public URL — the reader fetches it directly.
          openEpubUrlInReader(event.data.url);
        } else if (event.data.filename) {
          // The plugin lists the same OPFS output dir the core reads from, so
          // the filename resolves through the same service either way.
          void handleRead(event.data.filename);
        }
      }
    };
    const onPackaged = () => void sendPluginInit();
    window.addEventListener('message', handler);
    window.addEventListener('epub-packaged', onPackaged);
    return () => {
      window.removeEventListener('message', handler);
      window.removeEventListener('epub-packaged', onPackaged);
    };
  });

  async function sendPluginInit(): Promise<void> {
    const frameWindow = pluginFrame?.contentWindow;
    if (!frameWindow || !pluginUrl) return;
    const handle = await publishService.getOutputDirectoryHandle();
    if (!handle) {
      // No OPFS backend (e.g. the IndexedDB fallback) — there's no directory handle
      // to hand over, so the plugin stays uninitialised and shows its empty state.
      return;
    }
    const targetOrigin = new URL(pluginUrl, window.location.href).origin;
    const dirPath = workspaceOpfsPath(PUBLISH_WORKSPACE_ID);
    try {
      frameWindow.postMessage(createInitMessage(projectId, handle, dirPath), targetOrigin);
    } catch {
      // WebKit (iPadOS Safari) refuses to structured-clone a
      // FileSystemDirectoryHandle into an iframe (DataCloneError). Re-send
      // without the handle: the plugin walks opfsDirPath to an equivalent
      // handle itself (same origin, same OPFS root).
      console.warn('Plugin init: handle not cloneable here; plugin will resolve by OPFS path.');
      frameWindow.postMessage(createInitMessage(projectId, undefined, dirPath), targetOrigin);
    }
  }

  // Hand the ambient app environment (theme/locale/dir) to the plugin so it can
  // mirror it on its own document. Reads the env stores; posting before the frame
  // is ready is harmless (the plugin-ready handler re-sends this snapshot).
  function sendPluginContext(): void {
    const frameWindow = pluginFrame?.contentWindow;
    if (!frameWindow || !pluginUrl) return;
    const targetOrigin = new URL(pluginUrl, window.location.href).origin;
    // documentDirection is a string store; narrow it to the contract's literal.
    const dir = $documentDirection === 'rtl' ? 'rtl' : 'ltr';
    // Hand over the active locale's dictionary so the plugin can translate its
    // own UI from the shared catalog (no plugin-side bundle/pipeline).
    const messages = i18nService.getCatalogs()[$currentLocale]?.messages ?? {};
    frameWindow.postMessage(
      createContextMessage($themeStore.current, $currentLocale, dir, messages, activeIdentifier),
      targetOrigin
    );
  }

  // Re-send context whenever the theme, locale, direction, or active project
  // changes, so the iframe tracks the app live — no reload, no lost plugin state.
  $effect(() => {
    if (!showingPlugin) return;
    // Touch each value so the effect re-runs on change.
    void activeIdentifier;
    void $themeStore.current;
    void $currentLocale;
    void $documentDirection;
    sendPluginContext();
  });

  // (Re)arm failure detection whenever a plugin URL is assigned or a retry is
  // requested. If the plugin never completes its `plugin-ready` handshake, fall back
  // to the core publish view rather than leave a blank/error iframe.
  $effect(() => {
    void pluginAttempt; // re-arm on retry
    if (!pluginUrl) return;
    pluginReady = false;
    pluginFailed = false;
    // Backstop in case `onload` never fires; the onload grace (handlePluginFrameLoad)
    // is the primary, fast detector for the offline/error-page case.
    capTimer = setTimeout(() => {
      if (!pluginReady) pluginFailed = true;
    }, 20000);
    return () => {
      clearTimeout(capTimer);
      clearTimeout(readyTimer);
    };
  });

  function handlePluginFrameLoad(): void {
    // The frame finished navigating. A live plugin posts `plugin-ready` almost
    // immediately afterwards; if none arrives shortly, the frame is an error page
    // (the offline/uncached case) — fail fast rather than wait out the backstop.
    clearTimeout(readyTimer);
    readyTimer = setTimeout(() => {
      if (!pluginReady) pluginFailed = true;
    }, 2000);
  }

  function retryPlugin(): void {
    // Remount the iframe and re-arm detection (e.g. after coming back online).
    pluginAttempt += 1;
  }

  // Reading in the vendored READ.html tab needs dist/read/ served over HTTP.
  const canRead = isHttpContext();

  async function handleRead(filename: string) {
    try {
      openEpubInReader(await publishService.getPublishedEpubBlob(filename));
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to open the reader';
    }
  }

  async function handleDownload(filename: string) {
    try {
      // saveBlob opens the native Save dialog (when available) inside this click
      // gesture, then lazily reads the epub bytes — so the file keeps its real name
      // even on the standalone file:// build in Chrome. Falls back to a download.
      await saveBlob(
        filename,
        () => publishService.getPublishedEpubBlob(filename),
        'application/epub+zip'
      );
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to download';
    }
  }

  async function handleDelete(filename: string) {
    if (!confirm($t('Delete {filename}? This cannot be undone.', { filename }))) return;
    try {
      await publishService.deletePublishedEpub(filename);
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete';
    }
  }

  // This book's packages (matched by dc:identifier), newest first.
  const mine = $derived(
    activeIdentifier
      ? epubs
          .filter(e => e.identifier === activeIdentifier)
          .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
      : []
  );
  const latest = $derived(mine[0] ?? null);
  const totalSize = $derived(epubs.reduce((sum, e) => sum + e.size, 0));
  const showReadCard = $derived(!!(onPackageAsReadHtml || onPackageAsSeedHtml));

  function relativeTime(date: Date): string {
    const seconds = (new Date(date).getTime() - Date.now()) / 1000;
    const abs = Math.abs(seconds);
    const rtf = new Intl.RelativeTimeFormat($currentLocale, { numeric: 'auto' });
    if (abs < 60) return rtf.format(Math.round(seconds), 'second');
    if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), 'day');
    return new Date(date).toLocaleDateString($currentLocale);
  }

  function formatSize(bytes: number): string {
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }
</script>

{#snippet packageButtons(primary: boolean)}
  {#if onPackage}
    <button
      type="button"
      class={primary ? 'btn btn-primary' : 'btn btn-link'}
      onclick={onPackage}
      disabled={packaging || isReadOnly}
    >
      {packaging ? $t('Packaging…') : primary ? $t('Package EPUB') : $t('Package again')}
    </button>
  {/if}
{/snippet}

<div class="share-view">
  <div class="share-page">
    <h1 class="page-title">{$t('Share')}</h1>
    <p class="status-line">
      {#if loading && epubs.length === 0}
        {$t('Loading…')}
      {:else if latest}
        {$t('Packaged {when}', { when: relativeTime(latest.lastModified) })} · {formatSize(
          latest.size
        )}
      {:else}
        {$t('Not packaged yet')}
      {/if}
    </p>

    {#if error}
      <p class="status error" role="alert">{error}</p>
    {/if}

    <h2 class="label">{$t('Get the book')}</h2>
    <div class="cards">
      <article class="card primary">
        <h3>{$t('Download the EPUB')}</h3>
        <p>{$t('For any reading app.')}</p>
        {#if latest}
          <small class="file-line">{latest.filename} · {formatSize(latest.size)}</small>
          <div class="card-actions">
            <button
              type="button"
              class="btn btn-primary"
              onclick={() => handleDownload(latest.filename)}
            >
              {$t('Download')}
            </button>
            {#if canRead}
              <button
                type="button"
                class="btn btn-secondary"
                onclick={() => handleRead(latest.filename)}
              >
                {$t('Read')}
              </button>
            {/if}
          </div>
          <div class="card-more">
            {@render packageButtons(false)}
            {#if onPackageWithoutSource}
              <button
                type="button"
                class="btn btn-link"
                onclick={onPackageWithoutSource}
                disabled={packagingWithoutSource || isReadOnly}
              >
                {packagingWithoutSource ? $t('Packaging…') : $t('Package EPUB without source')}
              </button>
            {/if}
          </div>
        {:else}
          <small class="file-line">{$t('Not made yet')}</small>
          <div class="card-actions">
            {@render packageButtons(true)}
          </div>
          {#if onPackageWithoutSource}
            <div class="card-more">
              <button
                type="button"
                class="btn btn-link"
                onclick={onPackageWithoutSource}
                disabled={packagingWithoutSource || isReadOnly}
              >
                {packagingWithoutSource ? $t('Packaging…') : $t('Package EPUB without source')}
              </button>
            </div>
          {/if}
        {/if}
      </article>

      {#if showReadCard}
        <article class="card">
          <h3>{$t('Read it in the browser')}</h3>
          <p>{$t('One page, no app needed.')}</p>
          <div class="card-actions">
            {#if onPackageAsReadHtml}
              <button
                type="button"
                class="btn btn-secondary"
                onclick={onPackageAsReadHtml}
                disabled={readHtmlPackaging || isReadOnly}
              >
                {readHtmlPackaging ? $t('Packaging…') : $t('Package as READ.html')}
              </button>
            {/if}
          </div>
          {#if onPackageAsSeedHtml}
            <div class="card-more">
              <button
                type="button"
                class="btn btn-link"
                onclick={onPackageAsSeedHtml}
                disabled={seedHtmlPackaging || isReadOnly}
              >
                {seedHtmlPackaging ? $t('Packaging…') : $t('Package as SEED.html')}
              </button>
            </div>
          {/if}
        </article>
      {/if}

      {#if onGeneratePdf}
        <article class="card">
          <h3>{$t('Make a PDF')}</h3>
          <p>{$t('For printing.')}</p>
          <div class="card-actions">
            <button
              type="button"
              class="btn btn-secondary"
              onclick={onGeneratePdf}
              disabled={pdfGenerating || isReadOnly}
            >
              {pdfGenerating ? $t('Preparing…') : $t('Generate PDF')}
            </button>
          </div>
        </article>
      {/if}
    </div>

    {#if pluginUrl}
      <section class="publish-band" aria-labelledby="publish-web-title">
        <h2 id="publish-web-title" class="label">{$t('Publish to the web')}</h2>
        {#if pluginFailed}
          <div class="plugin-fallback" role="status">
            <p class="plugin-fallback-text">
              {$t(
                'The publishing plugin could not be loaded — you may be offline. Showing local publishing instead.'
              )}
            </p>
            <button type="button" class="btn btn-secondary btn-sm" onclick={retryPlugin}>
              {$t('Retry plugin')}
            </button>
          </div>
        {:else}
          {#key pluginAttempt}
            <iframe
              bind:this={pluginFrame}
              class="plugin-frame"
              src={pluginUrl}
              title={$t('Publish to the web')}
              onload={handlePluginFrameLoad}
            ></iframe>
          {/key}
        {/if}
      </section>
    {/if}

    {#if !showingPlugin}
      <section class="packaged" aria-labelledby="packaged-title">
        <div class="section-head">
          <h2 id="packaged-title" class="label">
            {$t('Packaged files')}
            {#if epubs.length > 0}
              <span class="label-detail">
                {$t('Kept in this browser')} · {formatSize(totalSize)}
              </span>
            {/if}
          </h2>
          <button type="button" class="btn btn-secondary btn-sm" onclick={load}>
            {$t('Refresh')}
          </button>
        </div>
        {#if loading && epubs.length === 0}
          <p class="status">{$t('Loading…')}</p>
        {:else if epubs.length === 0}
          <p class="status">{$t('No packaged EPUBs yet.')}</p>
        {:else}
          <table class="epub-table">
            <thead>
              <tr>
                <th class="cover"><span class="sr-only">{$t('Cover')}</span></th>
                <th>{$t('File')}</th>
                <th class="num">{$t('Size')}</th>
                <th class="num">{$t('Made')}</th>
                <th class="actions"><span class="sr-only">{$t('Actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {#each epubs as epub (epub.filename)}
                <tr class:current={!!activeIdentifier && epub.identifier === activeIdentifier}>
                  <td class="cover">
                    {#if coverUrls[epub.filename]}
                      <img src={coverUrls[epub.filename]} alt="" class="cover-thumb" />
                    {/if}
                  </td>
                  <td class="name">
                    <span class="name-title">{epub.title || epub.filename}</span>
                    <span class="name-file">{epub.filename}</span>
                  </td>
                  <td class="num">{formatSize(epub.size)}</td>
                  <td class="num">{relativeTime(epub.lastModified)}</td>
                  <td class="actions">
                    <div class="action-buttons">
                      {#if canRead}
                        <button
                          type="button"
                          class="btn btn-link"
                          onclick={() => handleRead(epub.filename)}
                        >
                          {$t('Read')}
                        </button>
                      {/if}
                      <button
                        type="button"
                        class="btn btn-link"
                        onclick={() => handleDownload(epub.filename)}
                      >
                        {$t('Download')}
                      </button>
                      <button
                        type="button"
                        class="btn btn-link danger"
                        onclick={() => handleDelete(epub.filename)}
                      >
                        {$t('Delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </section>
    {/if}
  </div>
</div>

<style>
  .share-view {
    min-block-size: 100%;
    background: var(--color-bg-primary);
  }

  .share-page {
    max-inline-size: 1040px;
    margin-inline: auto;
    padding-block: var(--space-8);
    padding-inline: var(--space-6);
  }

  .page-title {
    margin: 0 0 var(--space-1);
    font-size: var(--text-4xl);
    font-weight: var(--font-bold);
    letter-spacing: -0.01em;
    color: var(--color-text-primary);
  }

  .status-line {
    margin: 0 0 var(--space-6);
    color: var(--color-text-secondary);
  }

  .label {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .label-detail {
    margin-inline-start: var(--space-3);
    font-weight: var(--font-normal);
    letter-spacing: 0;
    text-transform: none;
    font-size: var(--text-sm);
  }

  .status {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .status.error {
    margin-block-end: var(--space-4);
    color: var(--color-error-text, var(--color-text-primary));
  }

  /* Outcome cards */
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: var(--space-5);
    margin-block-end: var(--space-8);
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-block-size: 170px;
    padding: var(--space-5) var(--space-5) var(--space-4);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
  }

  .card.primary {
    border-color: var(--color-interactive-primary);
    box-shadow: inset 0 0 0 1px var(--color-interactive-primary);
  }

  .card h3 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  /* Whatever follows the description sits at the foot of every card. */
  .card p {
    margin: 0 0 auto;
    color: var(--color-text-primary);
  }

  .file-line {
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .card-more {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }

  .card-more .btn-link {
    padding-inline: 0;
    font-size: var(--text-sm);
  }

  /* Publish to the web: the plugin lives inside the band */
  .publish-band {
    margin-block-end: var(--space-8);
  }

  .plugin-frame {
    display: block;
    inline-size: 100%;
    block-size: min(640px, 70vh);
    border: 1px solid var(--color-border-default);
    background: var(--color-bg-tertiary);
  }

  .plugin-fallback {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--color-border-default);
    background: var(--color-bg-tertiary);
  }

  .plugin-fallback-text {
    flex: 1;
    min-inline-size: 16rem;
    margin: 0;
    color: var(--color-text-secondary);
  }

  /* Packaged files */
  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .epub-table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .epub-table th {
    padding: 0 var(--space-2) var(--space-2) 0;
    border-block-end: 1px solid var(--color-border-default);
    text-align: start;
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .epub-table td {
    padding: var(--space-3) var(--space-2) var(--space-3) 0;
    border-block-end: 1px solid var(--color-border-default);
    vertical-align: middle;
  }

  .epub-table .num {
    text-align: end;
    white-space: nowrap;
    color: var(--color-text-secondary);
  }

  .epub-table .actions {
    text-align: end;
    white-space: nowrap;
  }

  .epub-table .cover {
    inline-size: 32px;
  }

  .cover-thumb {
    display: block;
    inline-size: 24px;
    block-size: 32px;
    object-fit: cover;
    border: 1px solid var(--color-border-default);
  }

  .epub-table tr.current td {
    background: var(--color-bg-tertiary);
  }

  .name {
    display: table-cell;
  }

  .name-title {
    display: block;
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .name-file {
    display: block;
    color: var(--color-text-secondary);
    overflow-wrap: anywhere;
  }

  .action-buttons {
    display: inline-flex;
    gap: var(--space-4);
  }

  .action-buttons .btn-link {
    padding-inline: 0;
  }

  .btn-link.danger {
    color: var(--color-error-text, var(--color-text-primary));
  }

  @media (max-width: 720px) {
    .share-page {
      padding-block: var(--space-6);
      padding-inline: var(--space-4);
    }

    .card {
      min-block-size: 0;
    }

    .epub-table .cover,
    .epub-table .num:nth-child(3) {
      display: none;
    }
  }
</style>
