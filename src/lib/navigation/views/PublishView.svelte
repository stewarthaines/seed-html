<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import { downloadBlob } from '$lib/zip/index.js';
  import type { PublishService, PublishedEpub } from '$lib/services/publish/publish.service.js';

  interface Props {
    publishService: PublishService;
  }

  let { publishService }: Props = $props();

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

  onMount(() => {
    load();
    // Refresh when the main app packages a new epub into the publish directory.
    const onPackaged = () => load();
    window.addEventListener('epub-packaged', onPackaged);
    return () => window.removeEventListener('epub-packaged', onPackaged);
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

<div class="publish-view">
  <header class="publish-header">
    <h1>{$t('Publish')}</h1>
    <button class="refresh-button" onclick={load}>{$t('Refresh')}</button>
  </header>

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
              <button onclick={() => handleDownload(epub.filename)}>{$t('Download')}</button>
              <button class="danger" onclick={() => handleDelete(epub.filename)}>
                {$t('Delete')}
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .publish-view {
    padding: var(--space-4);
    height: 100%;
    overflow-y: auto;
    color: var(--color-text-primary);
  }

  .publish-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-4);
  }

  .publish-header h1 {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 600;
  }

  .refresh-button {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .refresh-button:hover {
    background-color: var(--color-bg-tertiary);
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
    opacity: 0.8;
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
    text-align: right;
    white-space: nowrap;
  }

  .epub-table .name {
    word-break: break-word;
  }

  .epub-table .actions button {
    margin-left: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .epub-table .actions button:hover {
    background-color: var(--color-bg-tertiary);
  }

  .epub-table .actions button.danger {
    color: var(--color-error-text);
    border-color: var(--color-error-text);
  }
</style>
