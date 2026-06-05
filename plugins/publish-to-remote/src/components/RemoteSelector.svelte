<script lang="ts">
  import type { RemoteConfig, RemotesStore } from '../types.js';

  let {
    remotesStore,
    activeRemote,
    googleAuthRequired,
    onAdd,
    onEdit,
    onRemove,
    onSelect,
    onReconnect,
  }: {
    remotesStore: RemotesStore;
    activeRemote: RemoteConfig | null;
    googleAuthRequired: boolean;
    onAdd: () => void;
    onEdit: (id: string) => void;
    onRemove: () => void;
    onSelect: (id: string) => void;
    onReconnect: () => void;
  } = $props();
</script>

{#if remotesStore.remotes.length > 1}
  <div class="remote-selector-bar">
    <label for="remote-select">Active Remote:</label>
    <select
      id="remote-select"
      value={remotesStore.activeRemoteId}
      onchange={(e) => {
        const remoteId = e.currentTarget.value;
        if (remoteId) onSelect(remoteId);
      }}
    >
      {#each remotesStore.remotes as remote (remote.id)}
        <option value={remote.id}>
          {remote.name}
          ({remote.type === 's3-compatible'
            ? remote.bucket
            : remote.type === 'google-drive'
              ? remote.folderName
              : remote.type === 'dropbox'
                ? remote.folderPath
                : remote.url})
        </option>
      {/each}
    </select>
    <button class="btn btn-secondary" onclick={onAdd}>Add Remote</button>
    <button
      class="btn btn-secondary"
      onclick={() => activeRemote && onEdit(activeRemote.id)}
    >
      Edit
    </button>
    <button class="btn btn-danger btn-sm" onclick={onRemove}>Remove</button>
  </div>
{:else if remotesStore.remotes.length === 1}
  <div class="remote-selector-bar">
    <span>Remote: <strong>{activeRemote?.name}</strong></span>
    <button class="btn btn-secondary" onclick={onAdd}>Add Remote</button>
    <button
      class="btn btn-secondary"
      onclick={() => activeRemote && onEdit(activeRemote.id)}
    >
      Edit
    </button>
    <button class="btn btn-danger btn-sm" onclick={onRemove}>Remove</button>
  </div>
{/if}

{#if googleAuthRequired && activeRemote?.type === 'google-drive'}
  <div class="auth-required-banner">
    <span>Google Drive authorization required.</span>
    <button class="btn btn-primary" onclick={onReconnect}>
      Connect to Google Drive
    </button>
  </div>
{/if}

<style>
  .remote-selector-bar {
    background: var(--color-surface-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .remote-selector-bar label {
    font-weight: 500;
    white-space: nowrap;
  }

  .remote-selector-bar select {
    padding: 6px 8px;
    border: 1px solid var(--color-border-default);
    border-radius: 4px;
    font-size: 14px;
  }

  .remote-selector-bar span {
    flex: 1;
    min-width: 200px;
  }

  .auth-required-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    margin-bottom: 16px;
    background: var(--color-warning-bg);
    border: 1px solid var(--color-warning-border);
    border-radius: 4px;
    font-size: 14px;
  }
</style>
