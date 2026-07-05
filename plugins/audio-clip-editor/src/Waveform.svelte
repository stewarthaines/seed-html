<!--
  The wavesurfer surface: waveform + minimap (whole-file orientation) + wheel
  zoom (fine boundary placement), with one draggable/resizable region per saved
  clip. Regions are re-rendered from the `clips` prop (single source of truth in
  App.svelte); a drag on empty waveform reports onCreate and the transient
  region is dropped, so the parent's store round-trip renders the durable one.
-->
<script lang="ts">
  import WaveSurfer from 'wavesurfer.js';
  import RegionsPlugin, { type Region } from 'wavesurfer.js/plugins/regions';
  import MinimapPlugin from 'wavesurfer.js/plugins/minimap';
  import ZoomPlugin from 'wavesurfer.js/plugins/zoom';
  import type { ClipRegion } from './clips.js';

  let {
    file = null,
    clips = [],
    selectedId = null,
    loop = false,
    onSelect,
    onChange,
    onCreate,
    onPlayStateChange,
  }: {
    file?: File | null;
    clips?: ClipRegion[];
    selectedId?: string | null;
    /** Replay the clip when it reaches its end instead of stopping. */
    loop?: boolean;
    onSelect?: (id: string) => void;
    onChange?: (id: string, begin: number, end: number) => void;
    onCreate?: (begin: number, end: number) => void;
    onPlayStateChange?: (playing: boolean) => void;
  } = $props();

  let container = $state<HTMLDivElement | null>(null);
  let ready = $state(false);
  let ws: WaveSurfer | null = null;
  let regionsPlugin: RegionsPlugin | null = null;
  // True while this component re-renders regions from props, so the plugin's
  // region-created events can be told apart from the user's drag-selection.
  let syncing = false;
  let playingId: string | null = null;

  const BASE_COLOR = 'rgba(59, 130, 246, 0.2)';
  const SELECTED_COLOR = 'rgba(234, 88, 12, 0.35)';

  // (Re)build the instance whenever the audio file changes.
  $effect(() => {
    const el = container;
    const f = file;
    ready = false;
    if (!el || !f) return;

    const regions = RegionsPlugin.create();
    const instance = WaveSurfer.create({
      container: el,
      height: 88,
      waveColor: '#94a3b8',
      progressColor: '#64748b',
      plugins: [
        regions,
        MinimapPlugin.create({ height: 18, waveColor: '#cbd5e1', progressColor: '#94a3b8' }),
        ZoomPlugin.create({ scale: 0.4, maxZoom: 500 }),
      ],
    });

    regions.enableDragSelection({ color: BASE_COLOR });

    regions.on('region-created', (region: Region) => {
      if (syncing) return;
      // A drag-selection on empty waveform: hand the bounds to the parent and
      // drop the transient region (the store round-trip renders the real one).
      const { start, end } = region;
      region.remove();
      if (end - start >= 0.05) onCreate?.(start, end);
    });

    regions.on('region-updated', (region: Region) => {
      onChange?.(region.id, region.start, region.end);
    });

    regions.on('region-clicked', (region: Region, event: MouseEvent) => {
      event.stopPropagation();
      onSelect?.(region.id);
    });

    // Manual stop/loop at the clip boundary — regions don't auto-stop.
    regions.on('region-out', (region: Region) => {
      if (region.id !== playingId) return;
      if (loop) region.play();
      else stop();
    });

    instance.on('finish', () => {
      if (playingId) stop();
    });

    instance.on('ready', () => {
      ready = true;
    });

    void instance.loadBlob(f);
    ws = instance;
    regionsPlugin = regions;

    return () => {
      playingId = null;
      ready = false;
      instance.destroy();
      if (ws === instance) {
        ws = null;
        regionsPlugin = null;
      }
    };
  });

  // Render the saved clips as regions whenever they (or the selection) change.
  $effect(() => {
    const regions = regionsPlugin;
    if (!ready || !regions) return;
    syncing = true;
    regions.clearRegions();
    for (const clip of clips) {
      regions.addRegion({
        id: clip.id,
        start: clip.begin,
        end: clip.end,
        color: clip.id === selectedId ? SELECTED_COLOR : BASE_COLOR,
        content: clip.label || undefined,
        drag: true,
        resize: true,
      });
    }
    syncing = false;
  });

  /** Play the selected clip from its start; reports state via onPlayStateChange. */
  export function playSelected(): void {
    if (!ready || !regionsPlugin || !selectedId) return;
    const region = regionsPlugin.getRegions().find(r => r.id === selectedId);
    if (!region) return;
    playingId = selectedId;
    region.play();
    onPlayStateChange?.(true);
  }

  export function stop(): void {
    playingId = null;
    ws?.pause();
    onPlayStateChange?.(false);
  }
</script>

<div class="waveform" bind:this={container}></div>

<style>
  .waveform {
    width: 100%;
    /* Reserve waveform + minimap height so the panel doesn't jump on load. */
    min-height: 106px;
  }

  /* Region label chips (wavesurfer renders `content` into a part-less div). */
  .waveform :global(.wavesurfer-region-content),
  .waveform :global([part='region-content']) {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
    padding: 0 2px;
    white-space: nowrap;
    overflow: hidden;
  }
</style>
