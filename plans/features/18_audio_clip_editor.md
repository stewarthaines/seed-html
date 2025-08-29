# 18. Audio Clip Editor

## Overview

Integrated audio clip editor within the spine item editor that enables precise timestamp selection, clip range definition, and seamless insertion of audio clip directives into plain text content. Designed for creating audio-enhanced EPUB content with precise timing control.

## Integration Context

### Positioning & Activation
- **Location**: Optional pane within spine item editor, positioned above the textarea
- **Layout**: Single horizontal row when space permits, compact integration
- **Activation**: Toggle-able when workspace contains manifest items with `media-type="audio/*"`
- **Workflow**: Seamless integration with text editing - users can set clips and insert directives without leaving the spine editor

### User Experience Flow
1. User edits spine item text content
2. Audio clip editor appears when audio files available in workspace
3. User selects audio file, sets timing, previews clip
4. Inserts formatted directive into text at cursor position
5. Can also select existing `:clip[]{}` text to load values back into editor

## Requirements

### Core Functionality
- Audio file selection from workspace manifest items
- Precise timestamp input with 2-decimal precision (`h:mm:ss.dd`)
- Duration-based end time calculation
- Clip playback with start/end boundaries
- "Last 2 seconds" preview functionality
- Configurable playback rate

### Text Integration
- Bi-directional synchronization with textarea content
- Automatic parsing of selected `:clip[]{}` directives
- Configurable output template (workspace setting)
- Real-time selection sensitivity with explicit load confirmation

## Dependencies

- `BlobURLManager` for audio file access as blob URLs
- Existing spine editor architecture and components
- Workspace settings for output template configuration
- Manifest management for audio file enumeration

## Technical Approach

### Core Technologies
- HTML5 Audio API for playback control
- Svelte 5 runes for reactive state management
- Service architecture integration following project patterns
- Precise timestamp handling and validation
- Text parsing utilities for clip directive format

## API Design

### AudioClipService

Following the project's service architecture pattern with dependency injection:

```typescript
export class AudioClipService {
  constructor(
    private blobUrlManager: BlobURLManager,
    private workspaceService: WorkspaceService
  ) {}

  // Audio file management
  async getAvailableAudioFiles(workspaceId: string): Promise<ManifestItem[]>;
  async loadAudioFile(workspaceId: string, href: string): Promise<string>; // returns blob URL
  getAudioMetadata(audioElement: HTMLAudioElement): AudioMetadata;

  // Clip management
  setClipRange(start: number, end: number): void;
  getClipRange(): { start: number; end: number } | null;
  setPlaybackRate(rate: number): void;
  clearClipRange(): void;

  // Playback control
  async playClip(audioElement: HTMLAudioElement): Promise<void>;
  async playLastSeconds(audioElement: HTMLAudioElement, seconds?: number): Promise<void>;
  pause(audioElement: HTMLAudioElement): void;
  stop(audioElement: HTMLAudioElement): void;

  // Text integration
  parseClipDirective(text: string): ClipDirective | null;
  formatClipDirective(data: ClipData, template: string): string;
  getDefaultTemplate(): string;

  // Utility
  validateTimeFormat(timeString: string): boolean;
  parseTimeString(timeString: string): number; // converts h:mm:ss.dd to seconds
  formatTimeString(seconds: number): string; // converts seconds to h:mm:ss.dd
}

interface AudioMetadata {
  duration: number;
  sampleRate?: number;
  channels?: number;
  format: string;
  title?: string;
  artist?: string;
}

interface ClipData {
  href: string;
  startTime: number;
  duration: number;
  endTime: number; // calculated from startTime + duration
  playbackRate?: number;
}

interface ClipDirective {
  href: string;
  begin: string; // formatted time string
  end: string; // formatted time string
  rate?: string;
  label?: string; // content inside :clip[label]
}

// Service-specific errors
export class AudioClipServiceError extends Error {
  constructor(message: string, public code: string, public audioHref?: string) {
    super(message);
    this.name = 'AudioClipServiceError';
  }
}
```

## Audio Clip Editor Component

Integrated component using Svelte 5 runes and service injection:

```svelte
<!-- AudioClipEditor.svelte -->
<script lang="ts">
  import type { WorkspaceState } from '$lib/workspace/workspace.service.js';
  import type { ManifestItem } from '$lib/workspace/workspace.service.js';
  import type { AudioClipService } from '$lib/audio/audio-clip.service.js';
  import type { SettingsService } from '$lib/settings/settings.service.js';
  import { onMount } from 'svelte';

  // Service injection via props
  let { 
    workspace,
    audioClipService,
    settingsService,
    textContent = $bindable(),
    textareaSelection = $bindable(),
    onInsertClip
  } = $props<{
    workspace: WorkspaceState;
    audioClipService: AudioClipService;
    settingsService: SettingsService;
    textContent: string;
    textareaSelection: { start: number; end: number } | null;
    onInsertClip: (clipText: string) => void;
  }>();

  // Reactive state
  let audioElement = $state<HTMLAudioElement | null>(null);
  let availableAudioFiles = $state<ManifestItem[]>([]);
  let selectedAudioHref = $state<string>('');
  let audioSrc = $state<string>('');
  let isPlaying = $state(false);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  
  // Clip timing state
  let startTimeString = $state('0:00:00.00');
  let durationString = $state('0:00:05.00');
  let playbackRate = $state(1.0);
  
  // Derived state
  let startSeconds = $derived(audioClipService.parseTimeString(startTimeString));
  let durationSeconds = $derived(audioClipService.parseTimeString(durationString));
  let endSeconds = $derived(startSeconds + durationSeconds);
  let endTimeString = $derived(audioClipService.formatTimeString(endSeconds));
  let hasValidClip = $derived(startSeconds >= 0 && durationSeconds > 0);
  let selectedAudioFile = $derived(
    availableAudioFiles.find(item => item.href === selectedAudioHref)
  );

  // Text selection synchronization
  $effect(() => {
    if (textareaSelection && textContent) {
      const selectedText = textContent.slice(textareaSelection.start, textareaSelection.end);
      const parsed = audioClipService.parseClipDirective(selectedText);
      if (parsed) {
        // Auto-populate from selected clip directive
        selectedAudioHref = parsed.href;
        startTimeString = parsed.begin;
        const endTime = audioClipService.parseTimeString(parsed.end);
        const startTime = audioClipService.parseTimeString(parsed.begin);
        durationString = audioClipService.formatTimeString(endTime - startTime);
        if (parsed.rate) {
          playbackRate = parseFloat(parsed.rate);
        }
      }
    }
  });

  onMount(async () => {
    try {
      availableAudioFiles = await audioClipService.getAvailableAudioFiles(workspace.id);
      if (availableAudioFiles.length > 0) {
        selectedAudioHref = availableAudioFiles[0].href;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load audio files';
    }
  });

  // Load selected audio file
  $effect(async () => {
    if (selectedAudioHref && workspace.id) {
      try {
        isLoading = true;
        error = null;
        audioSrc = await audioClipService.loadAudioFile(workspace.id, selectedAudioHref);
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to load audio file';
        audioSrc = '';
      } finally {
        isLoading = false;
      }
    }
  });

  // Component methods
  const insertClipDirective = () => {
    if (!hasValidClip || !selectedAudioFile) return;
    
    const template = settingsService.getSetting(workspace.id, 'audioClipTemplate') || 
                    audioClipService.getDefaultTemplate();
    
    const clipData: ClipData = {
      href: selectedAudioHref,
      startTime: startSeconds,
      duration: durationSeconds,
      endTime: endSeconds,
      playbackRate: playbackRate !== 1.0 ? playbackRate : undefined
    };
    
    const clipText = audioClipService.formatClipDirective(clipData, template);
    onInsertClip(clipText);
  };
  
  const loadFromSelection = () => {
    // This is handled automatically by the $effect above,
    // but we could add explicit confirmation here
    if (textareaSelection && textContent) {
      const selectedText = textContent.slice(textareaSelection.start, textareaSelection.end);
      const parsed = audioClipService.parseClipDirective(selectedText);
      if (!parsed) {
        error = 'Selected text is not a valid clip directive';
        setTimeout(() => error = null, 3000);
      }
    }
  };

  // Jog controls: modify start time and reset audio position
  const jogStartTime = (deltaSeconds: number) => {
    if (!audioElement) return;
    
    const newStartTime = Math.max(0, startSeconds + deltaSeconds);
    const maxStartTime = audioElement.duration - durationSeconds;
    const clampedStartTime = Math.min(newStartTime, maxStartTime);
    
    startTimeString = audioClipService.formatTimeString(clampedStartTime);
    audioClipService.setClipRange(clampedStartTime, clampedStartTime + durationSeconds);
    
    // Reset audio to new start position
    audioElement.currentTime = clampedStartTime;
  };

  // Slider interaction: update start time from visual slider
  const updateStartFromSlider = (newStartTime: number) => {
    if (!audioElement) return;
    
    const maxStartTime = audioElement.duration - durationSeconds;
    const clampedStartTime = Math.min(newStartTime, maxStartTime);
    
    startTimeString = audioClipService.formatTimeString(clampedStartTime);
    audioClipService.setClipRange(clampedStartTime, clampedStartTime + durationSeconds);
    
    // Update audio position if not playing
    if (audioElement.paused) {
      audioElement.currentTime = clampedStartTime;
    }
  };
</script>

<div class="audio-clip-editor">
  {#if availableAudioFiles.length === 0}
    <div class="no-audio-message">
      No audio files found in workspace
    </div>
  {:else}
    <!-- Desktop: Single row layout -->
    <div class="audio-controls-row">
      <!-- Audio file selection -->
      <div class="control-group">
        <label for="audio-select">Audio:</label>
        <select id="audio-select" bind:value={selectedAudioHref}>
          {#each availableAudioFiles as manifestItem}
            <option value={manifestItem.href}>
              {manifestItem.id}
            </option>
          {/each}
        </select>
      </div>

      <!-- Visual slider (desktop only) -->
      <div class="control-group slider-group desktop-only">
        <input
          type="range"
          class="start-time-slider"
          min="0"
          max={audioElement?.duration || 100}
          step="0.1"
          value={startSeconds}
          oninput={(e) => updateStartFromSlider(parseFloat(e.target.value))}
        />
      </div>

      <!-- Time inputs -->
      <div class="control-group">
        <label for="start-time">Start:</label>
        <input
          id="start-time"
          type="text"
          bind:value={startTimeString}
          placeholder="0:00:00.00"
          pattern="\\d+:\\d{2}:\\d{2}\\.\\d{2}"
        />
      </div>

      <!-- Jog controls -->
      <div class="control-group jog-controls">
        <button onclick={() => jogStartTime(-1)} disabled={isLoading} title="Start -1 second">-1</button>
        <button onclick={() => jogStartTime(-0.1)} disabled={isLoading} title="Start -0.1 second">-.1</button>
        <button onclick={() => jogStartTime(0.1)} disabled={isLoading} title="Start +0.1 second">+.1</button>
        <button onclick={() => jogStartTime(1)} disabled={isLoading} title="Start +1 second">+1</button>
      </div>

      <div class="control-group">
        <label for="duration">Duration:</label>
        <input
          id="duration"
          type="text"
          bind:value={durationString}
          placeholder="0:00:05.00"
          pattern="\\d+:\\d{2}:\\d{2}\\.\\d{2}"
        />
      </div>

      <div class="control-group">
        <label for="end-time">End:</label>
        <span class="calculated-time">{endTimeString}</span>
      </div>

      <!-- Playback and actions -->
      <div class="control-group playback-controls">
        <button
          onclick={() => audioClipService.playClip(audioElement)}
          disabled={!hasValidClip || !audioElement || isLoading}
        >
          Play
        </button>
        <button
          onclick={() => audioClipService.playLastSeconds(audioElement, 2)}
          disabled={!hasValidClip || !audioElement || isLoading}
        >
          Last 2s
        </button>
      </div>

      <div class="control-group actions">
        <button
          onclick={insertClipDirective}
          disabled={!hasValidClip}
          class="primary"
        >
          Insert
        </button>
      </div>
    </div>

    <!-- Mobile: Second row for slider and extended controls -->
    <div class="audio-controls-row mobile-row">
      <!-- Visual slider (mobile) -->
      <div class="control-group slider-group mobile-only">
        <input
          type="range"
          class="start-time-slider"
          min="0"
          max={audioElement?.duration || 100}
          step="0.1"
          value={startSeconds}
          oninput={(e) => updateStartFromSlider(parseFloat(e.target.value))}
        />
      </div>

      <!-- Extended controls -->
      <div class="control-group mobile-actions">
        <button
          onclick={loadFromSelection}
          disabled={!textareaSelection}
          title="Load from selected text"
        >
          Load Selection
        </button>
      </div>
    </div>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if isLoading}
      <div class="loading-indicator">Loading audio...</div>
    {/if}

    <!-- Hidden audio element -->
    <audio
      bind:this={audioElement}
      src={audioSrc}
      preload="metadata"
      onloadedmetadata={() => {
        if (audioElement) {
          audioClipService.setPlaybackRate(playbackRate);
        }
      }}
    ></audio>
  {/if}
</div>

<style>
  .audio-clip-editor {
    margin-bottom: 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 0.75rem;
  }

  .no-audio-message {
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
    padding: 1rem;
  }

  .audio-controls-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: max-content;
  }

  .control-group label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-secondary);
    min-width: max-content;
  }

  .control-group select,
  .control-group input[type="text"] {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-primary);
    min-width: 120px;
  }

  .control-group input[type="text"] {
    width: 100px;
  }

  .calculated-time {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--text-muted);
    padding: 0.25rem 0.5rem;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    min-width: 100px;
    text-align: center;
  }

  .playback-controls {
    gap: 0.5rem;
  }

  .playback-controls button {
    padding: 0.25rem 0.75rem;
    font-size: var(--text-sm);
  }

  .actions {
    gap: 0.5rem;
    margin-left: auto;
  }

  .actions button {
    padding: 0.25rem 0.75rem;
    font-size: var(--text-sm);
  }

  .actions .primary {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .error-message {
    color: var(--color-error);
    font-size: var(--text-sm);
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--color-error-bg);
    border-radius: var(--radius-sm);
  }

  .loading-indicator {
    color: var(--text-muted);
    font-size: var(--text-sm);
    text-align: center;
    padding: 0.5rem;
  }

  /* Visual slider styles */
  .slider-group {
    flex: 1;
    min-width: 200px;
  }

  .start-time-slider {
    width: 100%;
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
  }

  .start-time-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: var(--color-primary);
    border-radius: 50%;
    cursor: pointer;
  }

  .start-time-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: var(--color-primary);
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }

  /* Jog controls */
  .jog-controls {
    gap: 0.25rem;
  }

  .jog-controls button {
    min-width: 44px;
    min-height: 44px;
    padding: 0.5rem;
    font-size: var(--text-sm);
    font-family: var(--font-mono);
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .jog-controls button:hover:not(:disabled) {
    background: var(--bg-secondary);
    border-color: var(--color-primary);
  }

  .jog-controls button:active:not(:disabled) {
    background: var(--color-primary);
    color: white;
  }

  .jog-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Responsive breakpoints */
  .desktop-only {
    display: flex;
  }

  .mobile-only,
  .mobile-row {
    display: none;
  }

  /* Mobile layout */
  @media (max-width: 768px) {
    .desktop-only {
      display: none;
    }

    .mobile-only,
    .mobile-row {
      display: flex;
    }

    .audio-controls-row {
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    
    .mobile-row {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-color);
    }

    .control-group {
      justify-content: space-between;
      min-width: auto;
    }
    
    .actions {
      margin-left: 0;
      justify-content: center;
      width: 100%;
    }

    .slider-group {
      flex: 1;
      margin-right: 1rem;
    }

    .mobile-actions {
      margin-left: auto;
    }

    /* Ensure all buttons meet 44px touch target */
    button {
      min-width: 44px;
      min-height: 44px;
      padding: 0.75rem 1rem;
    }

    .jog-controls button {
      min-width: 48px;
      min-height: 48px;
    }
  }

  /* Tablet layout */
  @media (min-width: 769px) and (max-width: 1024px) {
    .audio-controls-row {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .slider-group {
      flex-basis: 100%;
      order: -1;
      margin-bottom: 0.5rem;
    }

    .control-group {
      flex: 0 1 auto;
    }

    .actions {
      margin-left: auto;
    }
  }
</style>
```

## Service Implementation Details

### AudioClipService Methods

```typescript
// src/lib/audio/audio-clip.service.ts

export class AudioClipService {
  private clipRange: { start: number; end: number } | null = null;
  private playbackRate: number = 1.0;

  async playClip(audioElement: HTMLAudioElement): Promise<void> {
    if (!audioElement || !this.clipRange) {
      throw new AudioClipServiceError('Invalid audio element or clip range', 'INVALID_STATE');
    }

    try {
      // Set up event listeners for clip boundary monitoring
      const handleTimeUpdate = (event: Event) => {
        const audio = event.target as HTMLAudioElement;
        if (audio.currentTime >= this.clipRange!.end) {
          audio.pause();
          // Clean up event listeners
          audio.removeEventListener('timeupdate', handleTimeUpdate);
          audio.removeEventListener('seeked', handleSeeked);
        }
      };

      const handleSeeked = (event: Event) => {
        const audio = event.target as HTMLAudioElement;
        if (audio.currentTime === this.clipRange!.start) {
          console.log('Seeked to clip start:', audio.currentTime);
        }
      };

      // Add event listeners
      audioElement.addEventListener('timeupdate', handleTimeUpdate);
      audioElement.addEventListener('seeked', handleSeeked);

      // Set playback properties and start
      audioElement.currentTime = this.clipRange.start;
      audioElement.playbackRate = this.playbackRate;
      await audioElement.play();
    } catch (error) {
      throw new AudioClipServiceError(
        `Failed to play clip: ${error.message}`, 
        'PLAYBACK_ERROR'
      );
    }
  }

  async playLastSeconds(audioElement: HTMLAudioElement, seconds: number = 2): Promise<void> {
    if (!audioElement || !this.clipRange) return;

    const startTime = Math.max(this.clipRange.start, this.clipRange.end - seconds);

    try {
      // Set up event listeners for clip boundary monitoring
      const handleTimeUpdate = (event: Event) => {
        const audio = event.target as HTMLAudioElement;
        if (audio.currentTime >= this.clipRange!.end) {
          audio.pause();
          // Clean up event listeners
          audio.removeEventListener('timeupdate', handleTimeUpdate);
          audio.removeEventListener('seeked', handleSeeked);
        }
      };

      const handleSeeked = (event: Event) => {
        const audio = event.target as HTMLAudioElement;
        if (audio.currentTime === startTime) {
          console.log('Seeked to last seconds start:', audio.currentTime);
        }
      };

      // Add event listeners
      audioElement.addEventListener('timeupdate', handleTimeUpdate);
      audioElement.addEventListener('seeked', handleSeeked);

      // Set playback properties and start
      audioElement.currentTime = startTime;
      audioElement.playbackRate = this.playbackRate;
      await audioElement.play();
    } catch (error) {
      throw new AudioClipServiceError(
        `Failed to play last seconds: ${error.message}`,
        'PLAYBACK_ERROR'
      );
    }
  }

  parseTimeString(timeString: string): number {
    const timeRegex = /^(\d+):(\d{2}):(\d{2})\.(\d{2})$/;
    const match = timeString.match(timeRegex);
    
    if (!match) {
      throw new AudioClipServiceError(`Invalid time format: ${timeString}`, 'INVALID_TIME_FORMAT');
    }

    const [, hours, minutes, seconds, centiseconds] = match;
    return (
      parseInt(hours) * 3600 +
      parseInt(minutes) * 60 +
      parseInt(seconds) +
      parseInt(centiseconds) / 100
    );
  }

  formatTimeString(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const centiseconds = Math.floor((seconds % 1) * 100);

    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }

  parseClipDirective(text: string): ClipDirective | null {
    // Parse :clip[label]{src=href begin=time end=time rate=rate} format
    const clipRegex = /:clip\[([^\]]*)\]\{([^}]+)\}/;
    const match = text.match(clipRegex);
    
    if (!match) return null;
    
    const label = match[1] || '';
    const attrs = match[2];
    
    // Parse attributes
    const attrRegex = /(\w+)=([^\s}]+)/g;
    const attributes: Record<string, string> = {};
    let attrMatch;
    
    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
      attributes[attrMatch[1]] = attrMatch[2];
    }
    
    if (!attributes.src || !attributes.begin || !attributes.end) {
      return null;
    }
    
    return {
      href: attributes.src,
      begin: attributes.begin,
      end: attributes.end,
      rate: attributes.rate,
      label: label
    };
  }

  formatClipDirective(data: ClipData, template: string): string {
    // Default template: ':clip[]{src=<href> begin=<begin> end=<end>}'
    let result = template
      .replace('<href>', data.href)
      .replace('<begin>', this.formatTimeString(data.startTime))
      .replace('<end>', this.formatTimeString(data.endTime));
    
    if (data.playbackRate && data.playbackRate !== 1.0) {
      // Add rate parameter if template supports it
      if (template.includes('<rate>')) {
        result = result.replace('<rate>', data.playbackRate.toString());
      } else {
        // Insert rate parameter before closing brace
        result = result.replace('}', ` rate=${data.playbackRate}}`);
      }
    } else {
      // Remove rate parameter if present in template
      result = result.replace(/\s*rate=<rate>/, '');
    }
    
    return result;
  }

  getDefaultTemplate(): string {
    return ':clip[]{src=<href> begin=<begin> end=<end>}';
  }
}
```

## Text Directive Format

### Default Output Format
```
:clip[optional label]{src=audio.mp3 begin=1:23:45.67 end=1:28:50.33}
```

### Configurable Templates
Workspace setting `audioClipTemplate` supports various formats:

**Default**: `:clip[]{src=<href> begin=<begin> end=<end>}`
**HTML-like**: `<audio-clip src="<href>" begin="<begin>" end="<end>"></audio-clip>`
**Custom**: `:audio[]{file=<href> start=<begin> duration=<duration>}`

### Bi-directional Parsing
- Automatic detection when user selects `:clip[]{}` text in textarea
- Real-time population of editor fields from selected directive
- Explicit "Load from Selection" button for confirmation
- Invalid directive selection shows error message

## Development Process

Following the project's 5-step development workflow:

### 1. Feature Planning ✅
- This document serves as the comprehensive feature plan
- Technical approach and integration defined
- User experience flow documented

### 2. API Documentation 📝
- Create `src/lib/audio/API.md` with complete AudioClipService documentation
- Document all public methods with Input/Output/Side Effects/Usage examples
- Include error scenarios and integration patterns

### 3. Unit Test Development 🧪
- Write comprehensive tests for AudioClipService before implementation
- Test time parsing/formatting, clip directive parsing, playback control
- Use shared mocks for BlobURLManager and WorkspaceService
- Cover error scenarios and validation

### 4. Implementation 💻
- Implement AudioClipService following the API specification
- Create AudioClipEditor component with Svelte 5 runes
- Integrate with spine editor following established patterns

### 5. Storybook Story Creation 📖
- Create interactive story demonstrating audio clip editing
- Show integration with text content and directive insertion
- Test browser audio APIs and real file handling

## Error Handling

### Service-Level Errors
```typescript
export class AudioClipServiceError extends Error {
  constructor(message: string, public code: string, public audioHref?: string) {
    super(message);
    this.name = 'AudioClipServiceError';
  }
}
```

### Error Types & Recovery
- `AUDIO_NOT_FOUND`: Audio file missing from workspace → Show file selector
- `INVALID_TIME_FORMAT`: Bad time string → Reset to default format
- `PLAYBACK_ERROR`: Audio playback failure → Show error, allow retry
- `BLOB_URL_ERROR`: Failed to create blob URL → Try alternative loading
- `PARSE_ERROR`: Invalid clip directive → Show parsing error details

## Testing Strategy

### Unit Tests (Vitest + happy-dom)
- AudioClipService methods (time parsing, directive formatting)
- Validation logic and error handling
- Text parsing and synchronization utilities

### Integration Tests
- BlobURLManager integration for audio loading
- WorkspaceService integration for manifest item access
- Settings service integration for template configuration

### Storybook Tests (Real Browser)
- HTML5 audio element behavior
- File blob URL creation and playback
- User interactions and form validation
- Cross-browser audio format compatibility

## Browser Compatibility

### Required APIs
- HTML5 Audio element with precise seeking and event handling
- Blob URLs for audio file access
- Audio event listeners (`timeupdate`, `seeked`) for playback control

### Feature Detection
- Audio format support (MP3, OGG, WAV)
- Playback rate control capability
- Precise currentTime seeking accuracy

## Performance Considerations

- Lazy loading of audio files (load on selection)
- Blob URL cleanup to prevent memory leaks
- Efficient time string parsing with caching
- Event-driven playback monitoring (no polling)
- Proper event listener cleanup to prevent memory leaks