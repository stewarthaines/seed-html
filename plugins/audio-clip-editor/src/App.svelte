<!--
  Audio Clip Editor panel (see process/AUDIO_CLIP_PLUGIN_DESIGN.md): pick an
  audio file from the manifest, define clip regions on the waveform (drag to
  create, drag edges to adjust, wheel to zoom, minimap to orient), and insert
  the selected clip at the editor cursor as a directive formatted with the
  project's audio_clip_template. The clip library persists per audio file in
  SOURCE/plugins/audio-clip-editor/clips.json, so returning to a file restores
  its regions.
-->
<script lang="ts">
  import { dirHandle } from './store.js';
  import { t } from './i18n.js';
  import { listAudioItems, readFile } from './opf.js';
  import { loadTemplate } from './template.js';
  import { formatDirective, formatTimeString } from './format.js';
  import { loadClips, saveClips, emptyStore, type ClipRegion, type ClipStore } from './clips.js';
  import Waveform from './Waveform.svelte';
  import type { AudioManifestItem, InsertMessage } from './types.js';

  let audioItems = $state<AudioManifestItem[]>([]);
  let selectedHref = $state('');
  let status = $state<'waiting' | 'loading' | 'ready' | 'error'>('waiting');
  let errorMessage = $state('');

  let audioFile = $state<File | null>(null);
  let store = $state<ClipStore>(emptyStore());
  let selectedClipId = $state<string | null>(null);
  let loop = $state(false);
  let playing = $state(false);
  let waveform = $state<Waveform | null>(null);

  const clips = $derived(store.files[selectedHref] ?? []);
  const selectedClip = $derived(clips.find(c => c.id === selectedClipId) ?? null);

  // Load the manifest's audio list and the clip library whenever the host
  // (re-)hands the workspace handle. $dirHandle is null until `init` arrives.
  $effect(() => {
    const handle = $dirHandle;
    if (!handle) {
      status = 'waiting';
      return;
    }
    status = 'loading';
    Promise.all([listAudioItems(handle), loadClips(handle)])
      .then(([items, clipStore]) => {
        audioItems = items;
        store = clipStore;
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

  // Load the chosen file's bytes for the waveform; guard against a stale read
  // when the selection changes mid-flight.
  $effect(() => {
    const handle = $dirHandle;
    const item = audioItems.find(i => i.href === selectedHref);
    audioFile = null;
    playing = false;
    if (!handle || !item) return;
    readFile(handle, item.storagePath)
      .then(file => {
        if (selectedHref === item.href) audioFile = file;
      })
      .catch((err: unknown) => {
        errorMessage = err instanceof Error ? err.message : String(err);
        status = 'error';
      });
  });

  // Keep the clip selection valid as the file or library changes.
  $effect(() => {
    if (!clips.some(c => c.id === selectedClipId)) {
      selectedClipId = clips[0]?.id ?? null;
    }
  });

  // Persist the library (fire-and-forget; failures surface in the status row).
  function persist(): void {
    const handle = $dirHandle;
    if (!handle) return;
    saveClips(handle, store).catch((err: unknown) => {
      errorMessage = err instanceof Error ? err.message : String(err);
    });
  }

  function updateClips(next: ClipRegion[]): void {
    store = { ...store, files: { ...store.files, [selectedHref]: next } };
    persist();
  }

  function handleCreate(begin: number, end: number): void {
    const clip: ClipRegion = { id: crypto.randomUUID(), begin, end, label: '' };
    updateClips([...clips, clip]);
    selectedClipId = clip.id;
  }

  function handleChange(id: string, begin: number, end: number): void {
    updateClips(clips.map(c => (c.id === id ? { ...c, begin, end } : c)));
    selectedClipId = id;
  }

  function handleLabelChange(event: Event): void {
    if (!selectedClip) return;
    const label = (event.currentTarget as HTMLInputElement).value;
    updateClips(clips.map(c => (c.id === selectedClip.id ? { ...c, label } : c)));
  }

  function deleteSelected(): void {
    if (!selectedClip) return;
    waveform?.stop();
    updateClips(clips.filter(c => c.id !== selectedClip.id));
  }

  function togglePlay(): void {
    if (playing) waveform?.stop();
    else waveform?.playSelected();
  }

  async function insertSelected(): Promise<void> {
    const handle = $dirHandle;
    const clip = selectedClip;
    if (!handle || !clip || !selectedHref) return;
    const template = await loadTemplate(handle);
    const message: InsertMessage = {
      type: 'insert',
      content: formatDirective(template, {
        href: selectedHref,
        begin: clip.begin,
        end: clip.end,
        label: clip.label,
      }),
    };
    window.parent.postMessage(message, window.origin);
  }

  function clipOptionLabel(clip: ClipRegion): string {
    const range = `${formatTimeString(clip.begin)} – ${formatTimeString(clip.end)}`;
    return clip.label ? `${clip.label} (${range})` : range;
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
    <div class="toolbar">
      <label class="field">
        <span class="field-label">{$t('Audio file')}</span>
        <select bind:value={selectedHref}>
          {#each audioItems as item (item.href)}
            <option value={item.href}>{item.id}</option>
          {/each}
        </select>
      </label>
      <label class="field">
        <span class="field-label">{$t('Clip')}</span>
        <select bind:value={selectedClipId} disabled={clips.length === 0}>
          {#each clips as clip (clip.id)}
            <option value={clip.id}>{clipOptionLabel(clip)}</option>
          {/each}
        </select>
      </label>
      <button
        type="button"
        class="btn btn-sm"
        onclick={deleteSelected}
        disabled={!selectedClip}
        title={$t('Delete the selected clip from the library')}
      >
        {$t('Delete')}
      </button>
      {#if clips.length === 0}
        <span class="hint">{$t('Drag on the waveform to define a clip.')}</span>
      {/if}
    </div>

    <Waveform
      bind:this={waveform}
      file={audioFile}
      {clips}
      selectedId={selectedClipId}
      {loop}
      onSelect={id => (selectedClipId = id)}
      onChange={handleChange}
      onCreate={handleCreate}
      onPlayStateChange={p => (playing = p)}
    />

    <div class="toolbar">
      <button
        type="button"
        class="btn btn-sm"
        onclick={togglePlay}
        disabled={!selectedClip || !audioFile}
      >
        {playing ? $t('Stop') : $t('Play')}
      </button>
      <label class="field checkbox">
        <input type="checkbox" bind:checked={loop} />
        <span class="field-label">{$t('Loop')}</span>
      </label>
      <input
        type="text"
        class="label-input"
        value={selectedClip?.label ?? ''}
        onchange={handleLabelChange}
        disabled={!selectedClip}
        placeholder={$t('Clip label')}
        aria-label={$t('Clip label')}
      />
      <button
        type="button"
        class="btn btn-sm"
        onclick={insertSelected}
        disabled={!selectedClip}
        title={$t('Insert the clip directive at the editor cursor')}
      >
        {$t('Insert')}
      </button>
    </div>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
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
    min-width: 0;
  }

  .field-label {
    color: var(--color-text-secondary);
  }

  .field select {
    max-width: 14rem;
    text-overflow: ellipsis;
  }

  .field.checkbox {
    gap: 0.25rem;
  }

  .hint {
    color: var(--color-text-secondary);
    font-size: 0.8rem;
  }

  .label-input {
    flex: 1;
    min-width: 6rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-surface-primary);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--text-sm);
  }
</style>
