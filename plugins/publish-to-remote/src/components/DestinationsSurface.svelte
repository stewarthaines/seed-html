<!--
  Settings › You › Destinations: where Send puts a book. The list with each
  destination's place, catalog file and state, Edit / Reconnect / Remove, and
  the row of kinds to add one from; the configure form opens inline
  (process/PUBLISH_REWORK.md).
-->
<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import { t, translate } from '../i18n.js';
  import {
    remotesStore,
    remotesLoaded,
    contentVersions,
    saveRemote,
    removeRemote,
  } from '../remotes.js';
  import { listRemote, type Reach } from '../remote-status.js';
  import { catalogFilenamesFor, formatForKey, formatLabel, hasCatalog } from '../catalog.js';
  import { reconnectGoogle, reconnectDevice } from '../reconnect.js';
  import { deleteDeviceHandle, isDeviceSupported } from '../device-upload.js';
  import { showStatus } from '../status.js';
  import type { RemoteConfig } from '../types.js';
  import ConfigureForm from './ConfigureForm.svelte';
  import DestinationBadge from './DestinationBadge.svelte';

  type Kind = RemoteConfig['type'];

  const KINDS: Array<{ type: Kind; label: () => string }> = [
    { type: 's3-compatible', label: () => translate('S3-Compatible') },
    { type: 'google-drive', label: () => translate('Google Drive') },
    { type: 'dropbox', label: () => translate('Dropbox') },
    { type: 'webdav', label: () => translate('WebDAV') },
    { type: 'device', label: () => translate('USB e-reader') },
  ];
  const deviceSupported = isDeviceSupported();

  // --- Each destination's state ------------------------------------------------------
  const reach: Map<string, Reach | 'checking'> = new SvelteMap();
  let checkedVersions = new Map<string, number>();

  $effect(() => {
    if (!$remotesLoaded) return;
    const versions = $contentVersions;
    for (const remote of $remotesStore.remotes) {
      const version = versions[remote.id] ?? 0;
      if (checkedVersions.get(remote.id) === version && reach.has(remote.id)) continue;
      checkedVersions.set(remote.id, version);
      void check(remote);
    }
    for (const id of [...reach.keys()]) {
      if (!$remotesStore.remotes.some((r) => r.id === id)) {
        reach.delete(id);
        checkedVersions.delete(id);
      }
    }
  });

  async function check(remote: RemoteConfig) {
    reach.set(remote.id, 'checking');
    const listing = await listRemote(remote);
    reach.set(remote.id, listing.reach);
  }

  function placeOf(remote: RemoteConfig): string {
    switch (remote.type) {
      case 's3-compatible':
        return remote.bucket;
      case 'google-drive':
        return remote.folderName;
      case 'dropbox':
        return remote.folderPath || '/';
      case 'webdav':
        return remote.url;
      case 'device':
        return [remote.volumeLabel, remote.detail].filter(Boolean).join(' · ');
    }
  }

  function catalogOf(remote: RemoteConfig): string {
    if (!hasCatalog(remote)) return translate('no catalog');
    const file = catalogFilenamesFor(remote)[0];
    return `${file} (${formatLabel(formatForKey(file))})`;
  }

  // --- Add / edit ------------------------------------------------------------------------
  let editing = $state<RemoteConfig | null>(null);
  let adding = $state<Kind | null>(null);
  const formOpen = $derived(editing !== null || adding !== null);

  function startAdd(kind: Kind) {
    if (kind === 'device' && !deviceSupported) return;
    editing = null;
    adding = kind;
  }

  function startEdit(remote: RemoteConfig) {
    adding = null;
    editing = remote;
  }

  async function onSave(remote: RemoteConfig, isNew: boolean) {
    try {
      await saveRemote(remote, isNew);
      editing = null;
      adding = null;
      checkedVersions.delete(remote.id);
      void check(remote);
    } catch (error) {
      showStatus(translate('Failed to save config: {error}', { error: String(error) }), 'error');
    }
  }

  let confirmRemove = $state<string | null>(null);

  async function remove(remote: RemoteConfig) {
    confirmRemove = null;
    try {
      if (remote.type === 'device') await deleteDeviceHandle(remote.id);
      await removeRemote(remote.id);
      showStatus(translate('Removed {name}', { name: remote.name }), 'info');
    } catch (error) {
      showStatus(translate('Sign out error: {error}', { error: String(error) }), 'error');
    }
  }

  async function reconnect(remote: RemoteConfig) {
    try {
      if (remote.type === 'google-drive') {
        await reconnectGoogle(remote);
        const current = $remotesStore.remotes.find((r) => r.id === remote.id) ?? remote;
        await check(current);
      } else if (remote.type === 'device') {
        const ok = await reconnectDevice(remote);
        if (ok) await check(remote);
        else startEdit(remote);
      }
    } catch (error) {
      showStatus(translate('Authorization failed: {error}', { error: String(error) }), 'error');
    }
  }
</script>

<div class="destinations-surface">
  {#if !$remotesLoaded}
    <p class="empty">{$t('Loading…')}</p>
  {:else if $remotesStore.remotes.length === 0 && !formOpen}
    <p class="empty">{$t('No destinations yet.')}</p>
  {:else}
    <ul class="rows">
      {#each $remotesStore.remotes as remote (remote.id)}
        {@const state = reach.get(remote.id) ?? 'checking'}
        <li class="row" class:editing={editing?.id === remote.id}>
          <DestinationBadge {remote} />
          <div class="text">
            <b class="name">{remote.name}</b>
            <span class="detail">{placeOf(remote)} · {catalogOf(remote)}</span>
          </div>
          <span
            class="state"
            class:ok={state === 'ok'}
            class:warn={state === 'sign-in' || state === 'reconnect' || state === 'error'}
          >
            {#if state === 'checking'}
              {$t('Checking…')}
            {:else if state === 'ok'}
              {$t('Connected')}
            {:else if state === 'sign-in'}
              {$t('Sign in needed')}
            {:else if state === 'reconnect'}
              {$t('Needs permission')}
            {:else if state === 'unplugged'}
              {$t('Not plugged in')}
            {:else}
              {$t('Cannot connect')}
            {/if}
          </span>
          <div class="acts">
            {#if state === 'sign-in' || state === 'reconnect'}
              <button type="button" class="btn btn-link" onclick={() => reconnect(remote)}>
                {$t('Reconnect')}
              </button>
            {/if}
            <button type="button" class="btn btn-link" onclick={() => startEdit(remote)}>
              {$t('Edit')}
            </button>
            {#if confirmRemove === remote.id}
              <span class="confirm">
                {$t('Remove {name}?', { name: remote.name })}
                <button type="button" class="btn btn-danger btn-sm" onclick={() => remove(remote)}>
                  {$t('Yes')}
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick={() => (confirmRemove = null)}>
                  {$t('No')}
                </button>
              </span>
            {:else}
              <button type="button" class="btn btn-link" onclick={() => (confirmRemove = remote.id)}>
                {$t('Remove')}
              </button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  {#if formOpen}
    <div class="form">
      <ConfigureForm
        editingRemote={editing}
        initialType={adding ?? 'none'}
        canCancel={true}
        {onSave}
        onCancel={() => {
          editing = null;
          adding = null;
        }}
        onStatus={showStatus}
      />
    </div>
  {:else}
    <section class="add" aria-labelledby="add-destination-title">
      <h3 id="add-destination-title">{$t('Add a destination')}</h3>
      <div class="kinds">
        {#each KINDS as kind (kind.type)}
          <button
            type="button"
            class="kind"
            aria-disabled={kind.type === 'device' && !deviceSupported}
            title={kind.type === 'device' && !deviceSupported
              ? $t(
                  'Not available in this browser — connecting a USB device needs the File System Access API (Chrome, Edge)',
                )
              : undefined}
            onclick={() => startAdd(kind.type)}
          >
            {kind.label()}
          </button>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .destinations-surface {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .empty {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--color-border-strong);
    border-radius: 2px;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    padding: 12px 16px;
    border-block-end: 1px solid var(--color-border-default);
  }

  .row:last-child {
    border-block-end: 0;
  }

  .row.editing {
    background: var(--color-bg-active);
  }

  .text {
    flex: 1 1 220px;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
  }

  .name {
    overflow-wrap: anywhere;
  }

  .detail {
    font-size: 13px;
    color: var(--color-text-secondary);
    overflow-wrap: anywhere;
  }

  .state {
    font-size: 13px;
    color: var(--color-text-tertiary);
    white-space: nowrap;
  }

  .state.ok {
    color: var(--color-success-text);
  }

  .state.warn {
    color: var(--color-warning-text);
  }

  .acts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    font-size: 13px;
  }

  .acts .btn-link {
    font-size: 13px;
    text-decoration: none;
  }

  .acts .btn-link:hover {
    text-decoration: underline;
  }

  .confirm {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .add h3 {
    margin: 0 0 8px;
    font-size: 14px;
  }

  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .kind {
    padding: 6px 12px;
    border: 1px solid var(--color-border-strong);
    border-radius: 14px;
    background: var(--color-surface-primary);
    font: inherit;
    font-size: 13px;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .kind:hover:not([aria-disabled='true']) {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .kind[aria-disabled='true'] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .kind:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-button-focus-ring);
  }

  .form {
    border: 1px solid var(--color-border-strong);
    border-radius: 2px;
  }
</style>
