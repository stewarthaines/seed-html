<script lang="ts">
  import type { S3Object } from '../types.js';
  import FileName from './FileName.svelte';
  import { t } from '../i18n.js';

  let {
    objects,
    thumbnailUrls,
    activeFilenames,
    selectedKeys,
    onToggleSelect,
    onToggleAllEpubs,
    googleAuthRequired,
    onCopyUrl,
    onDelete,
  }: {
    objects: S3Object[];
    thumbnailUrls: Map<string, string>;
    activeFilenames: Set<string>;
    selectedKeys: Set<string>;
    onToggleSelect: (key: string, checked: boolean) => void;
    onToggleAllEpubs: (checked: boolean) => void;
    googleAuthRequired: boolean;
    onCopyUrl: (key: string, fileId?: string) => void;
    onDelete: (key: string) => void;
  } = $props();

  let deleteConfirmKey: string | null = $state(null);

  const isEpub = (key: string) => key.toLowerCase().endsWith('.epub');

  // Hide the uploaded cover thumbnails (.png) from the list; they remain on the
  // remote to back the OPDS covers. Books and catalog.xml stay visible.
  const visibleObjects = $derived(
    objects.filter((o) => !o.key.toLowerCase().endsWith('.png')),
  );

  // Master checkbox state across all epub rows.
  const epubKeys = $derived(visibleObjects.filter((o) => isEpub(o.key)).map((o) => o.key));
  const allSelected = $derived(epubKeys.length > 0 && epubKeys.every((k) => selectedKeys.has(k)));
  const noneSelected = $derived(epubKeys.every((k) => !selectedKeys.has(k)));
</script>

{#if googleAuthRequired}
  <p class="empty-message">{$t('Connect to Google Drive to view files.')}</p>
{:else if visibleObjects.length === 0}
  <p class="empty-message">{$t('Bucket is empty')}</p>
{:else}
  {#if epubKeys.length > 0}
    <label class="catalog-select-all">
      <input
        type="checkbox"
        checked={allSelected}
        indeterminate={!allSelected && !noneSelected}
        onchange={(e) => onToggleAllEpubs(e.currentTarget.checked)}
      />
      {$t('Include in catalog')}
    </label>
  {/if}
  <div class="remote-list">
    {#each visibleObjects as obj (obj.key)}
      <div class="remote-item" class:current={activeFilenames.has(obj.key)}>
        {#if isEpub(obj.key)}
          <input
            type="checkbox"
            class="remote-check"
            checked={selectedKeys.has(obj.key)}
            onchange={(e) => onToggleSelect(obj.key, e.currentTarget.checked)}
            title={$t('Include in catalog')}
            aria-label={$t('Include in catalog')}
          />
        {:else}
          <span class="remote-check-spacer" aria-hidden="true"></span>
        {/if}
        {#if thumbnailUrls.get(obj.key)}
          <img
            src={thumbnailUrls.get(obj.key)}
            alt=""
            class="remote-cover"
            aria-hidden="true"
            onerror={(e) =>
              ((e.currentTarget as HTMLImageElement).style.display = 'none')}
          />
        {/if}
        <div class="remote-info">
          <FileName name={obj.key} />
          <span class="remote-meta">
            {(obj.size / 1024).toFixed(0)} KB · {new Date(
              obj.lastModified,
            ).toLocaleDateString()}
          </span>
        </div>
        <div class="remote-actions">
          <button
            class="btn btn-secondary btn-sm"
            onclick={() => onCopyUrl(obj.key, obj.fileId)}
            title={$t('Copy URL')}>{$t('Copy')}</button
          >
          {#if deleteConfirmKey === obj.key}
            <div class="delete-confirm">
              <span>{$t('Confirm delete?')}</span>
              <button
                class="btn btn-danger btn-sm"
                onclick={() => {
                  onDelete(obj.key);
                  deleteConfirmKey = null;
                }}>{$t('Yes')}</button
              >
              <button
                class="btn btn-secondary btn-sm"
                onclick={() => (deleteConfirmKey = null)}>{$t('No')}</button
              >
            </div>
          {:else}
            <button
              class="btn btn-danger btn-sm"
              onclick={() => (deleteConfirmKey = obj.key)}
              >{$t('Delete')}</button
            >
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .remote-list {
    /* Fill the remaining pane height and scroll internally (keeps the remote
       selector and the Update Catalog footer pinned). */
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    border: 1px solid var(--color-border-default);
    border-radius: 4px;
  }

  .remote-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    padding: 12px;
    border-bottom: 1px solid var(--color-border-default);
  }

  .remote-item:last-child {
    border-bottom: none;
  }

  .catalog-select-all {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .remote-check {
    flex-shrink: 0;
    margin: 0;
    cursor: pointer;
  }

  /* Keep non-epub rows (e.g. catalog.xml) aligned with the checkbox column. */
  .remote-check-spacer {
    flex-shrink: 0;
    inline-size: 13px;
  }

  /* The currently-open project. */
  .remote-item.current {
    outline: 2px solid var(--color-button-primary-bg);
    outline-offset: -2px;
  }

  .remote-cover {
    flex-shrink: 0;
    width: 32px;
    height: 48px;
    object-fit: cover;
    border-radius: 3px;
  }

  /* Same responsive pattern as the local list: name takes the width and
     middle-ellipsises; actions wrap below when the pane is too narrow. */
  .remote-info {
    flex: 1 1 200px;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 2px 8px;
    align-items: baseline;
  }

  .remote-meta {
    font-size: 12px;
    color: var(--color-text-tertiary);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .remote-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .delete-confirm {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
  }
</style>
