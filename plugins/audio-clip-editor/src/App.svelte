<!--
  Walking-skeleton panel UI: proves the host wiring end-to-end (init handle →
  OPF manifest listing → insert at cursor). Session 2 replaces the body with the
  wavesurfer region editor per process/AUDIO_CLIP_PLUGIN_DESIGN.md.
-->
<script lang="ts">
  import { dirHandle } from './store.js';
  import { t } from './i18n.js';
  import { listAudioItems } from './opf.js';
  import type { AudioManifestItem, InsertMessage } from './types.js';

  let audioItems = $state<AudioManifestItem[]>([]);
  let selectedHref = $state('');
  let status = $state<'waiting' | 'loading' | 'ready' | 'error'>('waiting');
  let errorMessage = $state('');

  // Load the manifest's audio list whenever the host (re-)hands the workspace
  // handle. $dirHandle is null until the first `init` arrives.
  $effect(() => {
    const handle = $dirHandle;
    if (!handle) {
      status = 'waiting';
      return;
    }
    status = 'loading';
    listAudioItems(handle)
      .then(items => {
        audioItems = items;
        if (!items.some(i => i.href === selectedHref)) {
          selectedHref = items[0]?.href ?? '';
        }
        status = 'ready';
      })
      .catch((err: unknown) => {
        errorMessage = err instanceof Error ? err.message : String(err);
        status = 'error';
      });
  });

  // Default directive template, matching the core `audio_clip_template` default
  // so output renders through the existing transform out of the box. Becomes a
  // plugin-persisted setting in session 2.
  function formatDirective(href: string): string {
    return `:clip[]{src=${href} begin=0:00:00.00 end=0:00:05.00}`;
  }

  function insertTestClip(): void {
    if (!selectedHref) return;
    const message: InsertMessage = { type: 'insert', content: formatDirective(selectedHref) };
    window.parent.postMessage(message, window.origin);
  }
</script>

<div class="panel">
  {#if status === 'waiting' || status === 'loading'}
    <p class="status">{$t('Loading audio files…')}</p>
  {:else if status === 'error'}
    <p class="status error">{$t('Could not read the project: {error}', { error: errorMessage })}</p>
  {:else if audioItems.length === 0}
    <p class="status">{$t('No audio files in this project.')}</p>
  {:else}
    <label class="field">
      <span class="field-label">{$t('Audio file')}</span>
      <select bind:value={selectedHref}>
        {#each audioItems as item (item.href)}
          <option value={item.href}>{item.id}</option>
        {/each}
      </select>
    </label>
    <button type="button" class="btn btn-sm" onclick={insertTestClip}>
      {$t('Insert test clip')}
    </button>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .status {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .status.error {
    color: var(--color-error-text);
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .field-label {
    color: var(--color-text-secondary);
  }
</style>
