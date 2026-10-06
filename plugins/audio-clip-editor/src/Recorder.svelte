<!--
  Record one take, listen back, optionally crop it, and keep it (see
  process/AUDIO_CLIP_RECORDING.md). The take is decoded to PCM and shown as a
  WAV on the waveform (Chrome's own recording has no duration to scrub), with
  one crop region over the whole take. Keep encodes the crop to CBR mp3 and
  asks the host to add it to the book; nothing reaches the project before that.
-->
<script lang="ts">
  import mp3WasmUrl from 'wasm-media-encoders/wasm/mp3?url&no-inline';
  import { onMount } from 'svelte';
  import { t } from './i18n.js';
  import Waveform from './Waveform.svelte';
  import { startCapture, microphone, type Capture, type StreamSource } from './recording/capture.js';
  import {
    cropTake,
    encodeWav,
    monoTake,
    recordingFilename,
    takeDuration,
    type MonoTake,
  } from './recording/pcm.js';
  import { encodeMp3 } from './recording/mp3.js';
  import { addMedia } from './host.js';
  import { formatTimeString } from './format.js';
  import type { ClipRegion } from './clips.js';

  let {
    context,
    source = microphone,
    addFile = addMedia,
    onKept,
    onClose,
  }: {
    /** Created or resumed inside the user's click, so iOS lets it run. */
    context: AudioContext;
    source?: StreamSource;
    /** Hands the encoded file to the host; resolves to its href. */
    addFile?: typeof addMedia;
    /** The kept take is in the book at `href`, `duration` seconds long. */
    onKept: (href: string, duration: number) => void;
    onClose: () => void;
  } = $props();

  type Phase = 'starting' | 'recording' | 'preparing' | 'review' | 'saving' | 'error';
  let phase = $state<Phase>('starting');
  let errorMessage = $state('');
  let elapsed = $state(0);
  let level = $state(0);
  let take = $state<MonoTake | null>(null);
  let takeFile = $state<File | null>(null);
  let crop = $state<ClipRegion>({ id: 'crop', begin: 0, end: 0, label: '' });
  let playing = $state(false);
  let waveform = $state<Waveform | null>(null);

  let capture: Capture | null = null;
  let frame = 0;

  const cropDuration = $derived(Math.max(0, crop.end - crop.begin));

  onMount(() => {
    void record();
    return () => {
      cancelAnimationFrame(frame);
      capture?.cancel();
    };
  });

  async function record(): Promise<void> {
    phase = 'starting';
    take = null;
    takeFile = null;
    try {
      capture = await startCapture(context, source);
    } catch (err) {
      fail($t('Could not record: {error}', { error: describe(err) }));
      return;
    }
    phase = 'recording';
    const started = performance.now();
    const tick = () => {
      elapsed = (performance.now() - started) / 1000;
      level = capture?.level() ?? 0;
      frame = requestAnimationFrame(tick);
    };
    tick();
  }

  async function stop(): Promise<void> {
    const current = capture;
    if (!current) return;
    capture = null;
    cancelAnimationFrame(frame);
    phase = 'preparing';
    try {
      const blob = await current.stop();
      const decoded = monoTake(await context.decodeAudioData(await blob.arrayBuffer()));
      if (decoded.samples.length === 0) throw new Error('empty');
      take = decoded;
      takeFile = new File([encodeWav(decoded)], 'take.wav', { type: 'audio/wav' });
      crop = { id: 'crop', begin: 0, end: takeDuration(decoded), label: '' };
      phase = 'review';
    } catch (err) {
      fail($t('Could not record: {error}', { error: describe(err) }));
    }
  }

  async function keep(): Promise<void> {
    if (!take || cropDuration <= 0) return;
    waveform?.stop();
    phase = 'saving';
    try {
      const kept = cropTake(take, crop.begin, crop.end);
      const bytes = await encodeMp3(kept, mp3WasmUrl);
      const href = await addFile(recordingFilename(new Date()), 'audio/mpeg', bytes.buffer as ArrayBuffer);
      onKept(href, takeDuration(kept));
    } catch (err) {
      fail($t('Could not save the recording: {error}', { error: describe(err) }));
    }
  }

  function discard(): void {
    capture?.cancel();
    capture = null;
    waveform?.stop();
    onClose();
  }

  function fail(message: string): void {
    cancelAnimationFrame(frame);
    capture?.cancel();
    capture = null;
    errorMessage = message;
    phase = 'error';
  }

  function describe(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  function togglePlay(): void {
    if (playing) waveform?.stop();
    else waveform?.playSelected();
  }

  function setCrop(begin: number, end: number): void {
    crop = { ...crop, begin, end };
  }
</script>

<div class="recorder">
  {#if phase === 'starting' || phase === 'recording'}
    <div class="toolbar">
      <button type="button" class="btn btn-sm" onclick={stop} disabled={phase !== 'recording'}>
        {$t('Stop')}
      </button>
      <span class="elapsed" aria-live="off">{formatTimeString(elapsed)}</span>
      <div
        class="meter"
        role="meter"
        aria-label={$t('Recording level')}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={Math.round(level * 100)}
      >
        <div class="meter-fill" style:inline-size="{level * 100}%"></div>
      </div>
      <button type="button" class="btn btn-sm" onclick={discard}>{$t('Cancel')}</button>
    </div>
  {:else if phase === 'preparing'}
    <p class="status">{$t('Preparing the recording…')}</p>
  {:else if phase === 'review' || phase === 'saving'}
    <Waveform
      bind:this={waveform}
      file={takeFile}
      clips={[crop]}
      selectedId="crop"
      loop={false}
      onSelect={() => {}}
      onChange={(_id, begin, end) => setCrop(begin, end)}
      onCreate={setCrop}
      onPlayStateChange={(p) => (playing = p)}
    />
    <div class="toolbar">
      <button type="button" class="btn btn-sm" onclick={togglePlay} disabled={phase === 'saving'}>
        {playing ? $t('Stop') : $t('Play')}
      </button>
      <span class="elapsed">{formatTimeString(cropDuration)}</span>
      <button type="button" class="btn btn-sm" onclick={record} disabled={phase === 'saving'}>
        {$t('Record again')}
      </button>
      <button type="button" class="btn btn-sm" onclick={discard} disabled={phase === 'saving'}>
        {$t('Discard')}
      </button>
      <button
        type="button"
        class="btn btn-sm"
        onclick={keep}
        disabled={phase === 'saving' || cropDuration <= 0}
      >
        {phase === 'saving' ? $t('Saving…') : $t('Keep')}
      </button>
    </div>
  {:else}
    <p class="status error">{errorMessage}</p>
    <div class="toolbar">
      <button type="button" class="btn btn-sm" onclick={record}>{$t('Record again')}</button>
      <button type="button" class="btn btn-sm" onclick={discard}>{$t('Cancel')}</button>
    </div>
  {/if}
</div>

<style>
  .recorder {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .elapsed {
    font-variant-numeric: tabular-nums;
    color: var(--color-text-secondary);
  }

  .meter {
    flex: 1;
    min-inline-size: 6rem;
    max-inline-size: 16rem;
    block-size: 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--color-border-default);
    overflow: hidden;
  }

  .meter-fill {
    block-size: 100%;
    background: var(--color-interactive-primary);
  }

  .status {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .status.error {
    color: var(--color-error-text);
  }
</style>
