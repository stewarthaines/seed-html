<script lang="ts">
  import type { S3Object } from '../types.js';
  import FileName from './FileName.svelte';
  import { formatFileSize } from '../format.js';
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
    onLoadCatalog,
    loadedCatalogKey = '',
    loading = false,
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
    /** Click a remote .xml catalog to load it into the editor. Omit to disable. */
    onLoadCatalog?: (key: string) => void;
    /** The catalog currently loaded in the editor — its row gets the active bar. */
    loadedCatalogKey?: string;
    /** True while the remote's file list is being (re)fetched. */
    loading?: boolean;
  } = $props();

  let deleteConfirmKey: string | null = $state(null);

  const isEpub = (key: string) => key.toLowerCase().endsWith('.epub');
  const isXml = (key: string) => key.toLowerCase().endsWith('.xml');
  // A catalog row is loadable when it's an .xml and the remote supports reads.
  const isLoadable = (key: string) => isXml(key) && !!onLoadCatalog;

  // Hide the uploaded cover thumbnails (.png) from the list; they remain on the
  // remote to back the OPDS covers. Books and catalog.xml stay visible.
  const visibleObjects = $derived(
    objects.filter((o) => !o.key.toLowerCase().endsWith('.png')),
  );

  // Master checkbox state across all epub rows.
  const epubKeys = $derived(
    visibleObjects.filter((o) => isEpub(o.key)).map((o) => o.key),
  );
  const allSelected = $derived(
    epubKeys.length > 0 && epubKeys.every((k) => selectedKeys.has(k)),
  );
  const noneSelected = $derived(epubKeys.every((k) => !selectedKeys.has(k)));
</script>

{#if googleAuthRequired}
  <p class="empty-message">{$t('Connect to Google Drive to view files.')}</p>
{:else if loading && visibleObjects.length === 0}
  <p class="empty-message">{$t('Loading…')}</p>
{:else if visibleObjects.length === 0}
  <p class="empty-message">{$t('Bucket is empty')}</p>
{:else}
  <div class="remote-list">
    {#each visibleObjects as obj (obj.key)}
      <div
        class="remote-item"
        class:current={activeFilenames.has(obj.key) ||
          obj.key === loadedCatalogKey}
        class:loadable={isLoadable(obj.key)}
      >
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
        {#if isLoadable(obj.key)}
          <button
            type="button"
            class="remote-info remote-info-btn"
            onclick={() => onLoadCatalog?.(obj.key)}
            title={$t('Load this catalog into the editor')}
          >
            <FileName name={obj.key} />
            <span class="remote-meta">
              {formatFileSize(obj.size)} · {new Date(
                obj.lastModified,
              ).toLocaleDateString()}
            </span>
          </button>
        {:else}
          <div class="remote-info">
            <FileName name={obj.key} />
            <span class="remote-meta">
              {formatFileSize(obj.size)} · {new Date(
                obj.lastModified,
              ).toLocaleDateString()}
            </span>
          </div>
        {/if}
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

  /* The currently-open project, or the catalog loaded in the editor. */
  .remote-item.current {
    box-shadow: inset 3px 0 0 var(--color-accent);
    background: var(--color-bg-active);
  }

  /* A clickable .xml catalog row: solid-azure hover (white on azure), matching
     the app's hover convention. The loaded catalog keeps its tint + left bar
     rather than flipping to the hover fill. */
  .remote-item.loadable:not(.current):hover {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }

  .remote-item.loadable:not(.current):hover .remote-meta {
    color: var(--color-on-accent);
  }

  /* The catalog name acts as the load trigger — reset button chrome but keep
     the .remote-info flex layout (the class is shared). */
  .remote-info-btn {
    appearance: none;
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }

  /* On the azure hover fill the name turns white; on keyboard focus (no fill) it
     reads azure to mark the load trigger. */
  .remote-item.loadable:not(.current):hover
    .remote-info-btn
    :global(.filename) {
    color: var(--color-on-accent);
  }

  .remote-info-btn:focus-visible :global(.filename) {
    color: var(--color-accent);
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
