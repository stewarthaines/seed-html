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
  import { dirHandle, dirPath } from './store.js';
  import { randomUUID } from './uuid.js';
  import { t } from './i18n.js';
  import { listAudioItems, readFile } from './opf.js';
  import { loadTemplate } from './template.js';
  import { formatDirective, formatTimeString } from './format.js';
  import { loadClips, saveClips, emptyStore, type ClipRegion, type ClipStore } from './clips.js';
  import Waveform from './Waveform.svelte';
  import Recorder from './Recorder.svelte';
  import { canRecord } from './recording/capture.js';
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

  // Recording: the AudioContext is made inside the Record click (iOS only runs
  // one started by a gesture) and reused for later takes.
  let recording = $state(false);
  let audioContext = $state.raw<AudioContext | null>(null);
  const recordingAvailable = canRecord();

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
    saveClips(handle, $dirPath, store).catch((err: unknown) => {
      errorMessage = err instanceof Error ? err.message : String(err);
    });
  }

  function updateClips(next: ClipRegion[]): void {
    store = { ...store, files: { ...store.files, [selectedHref]: next } };
    persist();
  }

  function handleCreate(begin: number, end: number): void {
    const clip: ClipRegion = { id: randomUUID(), begin, end, label: '' };
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

  // Empty (or 1, or unparsable) clears the rate — the directive then carries no
  // rate attribute at all. JSON.stringify drops the undefined on save.
  function handleRateChange(event: Event): void {
    if (!selectedClip) return;
    const raw = (event.currentTarget as HTMLInputElement).value.trim();
    const parsed = raw === '' ? NaN : Number(raw);
    const rate =
      Number.isFinite(parsed) && parsed > 0 && parsed !== 1
        ? Math.min(4, Math.max(0.25, parsed))
        : undefined;
    updateClips(clips.map(c => (c.id === selectedClip.id ? { ...c, rate } : c)));
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
        rate: clip.rate,
      }),
    };
    window.parent.postMessage(message, window.origin);
  }

  function startRecording(): void {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume();
    waveform?.stop();
    recording = true;
  }

  // The kept take is in the manifest now: list it, select it, and start it
  // with one clip over the whole file so Insert works straight away.
  async function handleKept(href: string, duration: number): Promise<void> {
    recording = false;
    const handle = $dirHandle;
    if (!handle) return;
    try {
      audioItems = await listAudioItems(handle);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      status = 'error';
      return;
    }
    selectedHref = href;
    const clip: ClipRegion = { id: randomUUID(), begin: 0, end: duration, label: '' };
    store = { ...store, files: { ...store.files, [href]: [...(store.files[href] ?? []), clip] } };
    selectedClipId = clip.id;
    persist();
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
  {:else if recording && audioContext}
    <Recorder context={audioContext} onKept={handleKept} onClose={() => (recording = false)} />
  {:else if audioItems.length === 0}
    <p class="status">{$t('No audio files in this project.')}</p>
    {#if recordingAvailable}
      <div class="toolbar">
        <button type="button" class="btn btn-sm" onclick={startRecording}>{$t('Record')}</button>
      </div>
    {/if}
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
      {#if recordingAvailable}
        <button type="button" class="btn btn-sm" onclick={startRecording}>{$t('Record')}</button>
      {/if}
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
      <label class="field">
        <span class="field-label">{$t('Rate')}</span>
        <!-- Unset renders as a real value of 1 (not a placeholder): stepping an
             empty number input would start from min (0.25). 1 ≡ no rate. -->
        <input
          type="number"
          class="rate-input"
          min="0.25"
          max="4"
          step="0.05"
          value={selectedClip?.rate ?? 1}
          onchange={handleRateChange}
          disabled={!selectedClip}
          title={$t('Playback rate — 1 is normal speed (no rate in the directive)')}
        />
      </label>
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

  .rate-input {
    width: 4.5rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-surface-primary);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--text-sm);
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
