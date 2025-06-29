# 18. Audio Clip Editor

## Overview

Specialized editor for audio manifest items with timestamp selection, clip range definition, and playback controls for audio content creation.

## Requirements

- Begin/end timestamp selection
- Clip playback functionality
- "Last 2 seconds" preview option
- playbackRate variable

## Dependencies

- None (independent advanced feature)

## Technical Approach

- HTML5 Audio API for playback control
- Precise timestamp handling and storage (up to 2 decimal places)
- Audio metadata extraction and display

## API Design

```typescript
interface AudioClipEditor {
  // Audio loading
  loadAudioFile(workspaceId: string, filePath: string): Promise<void>;
  getAudioMetadata(): AudioMetadata;

  // Clip management
  setClipRange(start: number, end: number): void;
  getClipRange(): { start: number; end: number };
  setPlaybackRate()(rate: number): void;
  clearClipRange(): void;

  // Playback control
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  playClip(): Promise<void>;
  playLastSeconds(seconds?: number): Promise<void>;

  // Timeline navigation
  seekTo(timestamp: number): void;
  getCurrentTime(): number;
  getDuration(): number;

  // Export
  exportClipData(): ClipData;
  saveClipMarkers(): Promise<void>;
}

interface AudioMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  bitRate?: number;
  format: string;
  title?: string;
  artist?: string;
  album?: string;
}

interface ClipData {
  startTime: number;
  endTime: number;
  duration: number;
  filePath: string;
  metadata: AudioMetadata;
}

interface TimelineMarker {
  id: string;
  time: number;
  label: string;
  type: 'start' | 'end' | 'marker';
}
```

## Audio Editor Component

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let workspaceId = '';
  export let audioFilePath = '';

  let audioElement;
  let timelineCanvas;
  let waveformData = [];
  let isPlaying = false;
  let currentTime = 0;
  let duration = 0;
  let clipStart = 0;
  let clipEnd = 0;
  let isLoading = false;
  let audioMetadata = null;

  $: clipDuration = clipEnd - clipStart;
  $: hasClipRange = clipStart < clipEnd;
</script>

<div class="audio-clip-editor">
  <div class="audio-header">
    <h3>Audio Clip Editor</h3>
    <span class="file-path">{audioFilePath}</span>
  </div>

  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading audio file...</span>
    </div>
  {:else if audioMetadata}
    <div class="audio-metadata">
      <div class="metadata-item">
        <label>Duration:</label>
        <span>{formatTime(duration)}</span>
      </div>
      <div class="metadata-item">
        <label>Format:</label>
        <span>{audioMetadata.format}</span>
      </div>
      <div class="metadata-item">
        <label>Sample Rate:</label>
        <span>{audioMetadata.sampleRate} Hz</span>
      </div>
      {#if audioMetadata.title}
        <div class="metadata-item">
          <label>Title:</label>
          <span>{audioMetadata.title}</span>
        </div>
      {/if}
    </div>

    <div class="timeline-container">
      <canvas
        bind:this={timelineCanvas}
        class="timeline-canvas"
        on:click={handleTimelineClick}
        on:mousedown={handleTimelineMouseDown}
        on:mousemove={handleTimelineMouseMove}
        on:mouseup={handleTimelineMouseUp}
      ></canvas>

      <div class="timeline-controls">
        <div class="time-display">
          <span class="current-time">{formatTime(currentTime)}</span>
          <span class="separator">/</span>
          <span class="total-time">{formatTime(duration)}</span>
        </div>

        <div class="playback-controls">
          <button on:click={seekToStart} title="Start">
            <Icon name="skip-back" />
          </button>
          <button on:click={togglePlayback} title={isPlaying ? 'Pause' : 'Play'}>
            <Icon name={isPlaying ? 'pause' : 'play'} />
          </button>
          <button on:click={seekToEnd} title="End">
            <Icon name="skip-forward" />
          </button>
        </div>

        <div class="clip-controls">
          <button on:click={setClipStart} disabled={!audioElement}> Set Start </button>
          <button on:click={setClipEnd} disabled={!audioElement}> Set End </button>
          <button on:click={clearClip} disabled={!hasClipRange}> Clear Clip </button>
          <button on:click={setPlaybackRate} disabled={!hasClipRange}> Set Playback Rate </button>
        </div>
      </div>
    </div>

    {#if hasClipRange}
      <div class="clip-info">
        <div class="clip-range">
          <div class="range-item">
            <label>Start:</label>
            <input
              type="number"
              bind:value={clipStart}
              min="0"
              max={duration}
              step="0.1"
              on:change={updateClipRange}
            />
            <span class="time-format">{formatTime(clipStart)}</span>
          </div>

          <div class="range-item">
            <label>End:</label>
            <input
              type="number"
              bind:value={clipEnd}
              min="0"
              max={duration}
              step="0.1"
              on:change={updateClipRange}
            />
            <span class="time-format">{formatTime(clipEnd)}</span>
          </div>

          <div class="range-item">
            <label>Duration:</label>
            <span class="clip-duration">{formatTime(clipDuration)}</span>
          </div>
        </div>

        <div class="clip-actions">
          <button on:click={playClip} class="primary"> Play Clip </button>
          <button on:click={() => playLastSeconds(2)}> Last 2 Seconds </button>
          <button on:click={exportClip}> Export Clip Data </button>
        </div>
      </div>
    {/if}

    <audio
      bind:this={audioElement}
      on:loadedmetadata={handleAudioLoaded}
      on:timeupdate={handleTimeUpdate}
      on:ended={handleAudioEnded}
      on:error={handleAudioError}
      preload="metadata"
    >
      <source src={audioSrc} />
      Your browser does not support the audio element.
    </audio>
  {/if}
</div>

<style>
  .audio-clip-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-primary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .timeline-canvas {
    width: 100%;
    height: 120px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: crosshair;
    background: var(--bg-secondary);
  }

  .timeline-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
  }

  .playback-controls {
    display: flex;
    gap: 0.5rem;
  }

  .clip-controls {
    display: flex;
    gap: 0.5rem;
  }

  .clip-info {
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: 4px;
  }

  .clip-range {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .range-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .range-item input {
    width: 100%;
  }

  .clip-actions {
    display: flex;
    gap: 0.5rem;
  }

  .audio-metadata {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .metadata-item {
    display: flex;
    gap: 0.5rem;
  }

  .metadata-item label {
    font-weight: 500;
    min-width: 80px;
  }
</style>
```

## Playback Control

```typescript
const playClip = async (): Promise<void> => {
  if (!audioElement || !hasClipRange) return;

  try {
    audioElement.currentTime = clipStart;
    await audioElement.play();

    // Stop at clip end
    const checkClipEnd = () => {
      if (audioElement.currentTime >= clipEnd) {
        audioElement.pause();
      } else if (!audioElement.paused) {
        requestAnimationFrame(checkClipEnd);
      }
    };

    requestAnimationFrame(checkClipEnd);
  } catch (error) {
    console.error('Failed to play clip:', error);
  }
};

const playLastSeconds = async (seconds: number = 2): Promise<void> => {
  if (!audioElement || !hasClipRange) return;

  const startTime = Math.max(clipStart, clipEnd - seconds);

  try {
    audioElement.currentTime = startTime;
    await audioElement.play();

    const checkEnd = () => {
      if (audioElement.currentTime >= clipEnd) {
        audioElement.pause();
      } else if (!audioElement.paused) {
        requestAnimationFrame(checkEnd);
      }
    };

    requestAnimationFrame(checkEnd);
  } catch (error) {
    console.error('Failed to play last seconds:', error);
  }
};

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};
```

## Clip Data Export

- Generates markdown-style directive with clip parameters eg. `:clip[clickable clip label]{src=filename.mp3 begin=1:0.5 end=1:54 rate=0.8}`
- TBD

## Error Handling

- Unsupported audio formats
- Warn on non Constant Bit Rate encoding
- Audio loading failures
- Invalid timestamp ranges
- Playback errors

## Testing Considerations

- Test with various audio formats
- Test clip range validation
- Test playback controls
- Test performance with large audio files

## Implementation Notes

- Start with basic playback controls
- Implement precise timestamp handling
- Test across different browsers
- Consider Web Audio API for advanced features
