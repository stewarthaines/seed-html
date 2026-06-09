<script lang="ts">
  import { t, currentLocale, documentDirection } from '$lib/i18n';
  import { themeStore } from '$lib/stores/theme';
  import PaneHeader from '$lib/components/layout/PaneHeader.svelte';
  import { downloadBlob } from '$lib/zip/index.js';
  import type { PublishService, PublishedEpub } from '$lib/services/publish/publish.service.js';
  import {
    createInitMessage,
    createContextMessage,
    isPluginReadyMessage,
    isNavigateMessage,
  } from '$lib/plugins/contract';

  interface Props {
    publishService: PublishService;
    /** Resolved iframe src for the publish plugin, or null to use the core feature. */
    pluginUrl?: string | null;
    /** Identifier echoed to the plugin in its `init` message. */
    projectId?: string;
  }

  let { publishService, pluginUrl = null, projectId = 'publish' }: Props = $props();

  let pluginFrame = $state<HTMLIFrameElement | null>(null);

  let epubs = $state<PublishedEpub[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

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

  // Core feature: list packaged epubs, refreshing as new ones are packaged.
  // Skipped when the plugin takes over the whole frame.
  $effect(() => {
    if (pluginUrl) return;
    load();
    const onPackaged = () => load();
    window.addEventListener('epub-packaged', onPackaged);
    return () => window.removeEventListener('epub-packaged', onPackaged);
  });

  // Plugin surface: hand the output directory over once the plugin signals ready,
  // and re-hand it whenever a new epub is packaged so the plugin re-reads the dir.
  // Re-sending `init` (with a fresh handle) is enough — no separate refresh message.
  $effect(() => {
    if (!pluginUrl) return;
    const handler = (event: MessageEvent) => {
      if (!pluginFrame || event.source !== pluginFrame.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      if (isPluginReadyMessage(event.data)) {
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
    frameWindow.postMessage(createInitMessage(projectId, handle), targetOrigin);
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
    frameWindow.postMessage(
      createContextMessage($themeStore.current, $currentLocale, dir),
      targetOrigin
    );
  }

  // Re-send context whenever the theme, locale, or direction changes, so the
  // iframe tracks the app live — no reload, no lost plugin state.
  $effect(() => {
    if (!pluginUrl) return;
    // Touch each store so the effect re-runs on change.
    void $themeStore.current;
    void $currentLocale;
    void $documentDirection;
    sendPluginContext();
  });

  async function handleDownload(filename: string) {
    try {
      const blob = await publishService.getPublishedEpubBlob(filename);
      downloadBlob(blob, filename);
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

  function formatSize(bytes: number): string {
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString();
  }
</script>

{#if pluginUrl}
  <iframe bind:this={pluginFrame} class="plugin-frame" src={pluginUrl} title={$t('Publish')}
  ></iframe>
{:else}
  <div class="publish-view">
    <PaneHeader>
      <h1 class="publish-title">{$t('Publish')}</h1>
      {#snippet actions()}
        <button class="btn btn-secondary btn-sm" onclick={load}>{$t('Refresh')}</button>
      {/snippet}
    </PaneHeader>

    <div class="publish-body">
      {#if loading}
        <p class="status">{$t('Loading…')}</p>
      {:else if error}
        <p class="status error">{error}</p>
      {:else if epubs.length === 0}
        <div class="empty-state">
          <p>{$t('No packaged EPUBs yet.')}</p>
          <p class="hint">{$t('Package a project to see it here.')}</p>
        </div>
      {:else}
        <table class="epub-table">
          <thead>
            <tr>
              <th>{$t('Name')}</th>
              <th class="num">{$t('Size')}</th>
              <th class="num">{$t('Modified')}</th>
              <th class="actions">{$t('Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {#each epubs as epub (epub.filename)}
              <tr>
                <td class="name">{epub.filename}</td>
                <td class="num">{formatSize(epub.size)}</td>
                <td class="num">{formatDate(epub.lastModified)}</td>
                <td class="actions">
                  <button
                    class="btn btn-secondary btn-sm"
                    onclick={() => handleDownload(epub.filename)}
                  >
                    {$t('Download')}
                  </button>
                  <button class="btn btn-danger btn-sm" onclick={() => handleDelete(epub.filename)}>
                    {$t('Delete')}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
{/if}

<style>
  .plugin-frame {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }

  /* Full-frame view: pinned PaneHeader + its own scrolling body, mirroring the
     fixed-header/scrolling-body convention the split-pane views use. */
  .publish-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--color-text-primary);
  }

  .publish-title {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
  }

  .publish-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-4);
  }

  .status {
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .status.error {
    color: var(--color-error-text);
  }

  .empty-state {
    padding: var(--space-6) var(--space-4);
    text-align: center;
    color: var(--color-text-secondary);
  }

  .empty-state .hint {
    font-size: var(--text-sm);
  }

  .epub-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .epub-table th,
  .epub-table td {
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border-default);
    text-align: left;
  }

  .epub-table th {
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .epub-table .num {
    text-align: right;
    white-space: nowrap;
  }

  .epub-table .actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
    white-space: nowrap;
  }

  .epub-table .name {
    word-break: break-word;
  }
</style>
