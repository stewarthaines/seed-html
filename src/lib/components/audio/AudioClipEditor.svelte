<!--
  Audio Clip Editor Component

  Provides precise audio timestamp selection, clip range definition, and seamless
  integration with EPUB text content. Features responsive layout with natural wrapping,
  bidirectional range slider and time input synchronization, and accessibility support.

  UX Features:
  - Audio file dropdown selection from workspace manifest
  - Range input slider for approximate start time positioning
  - Precise time inputs (start time, duration) with h:mm:ss.dd format validation
  - Calculated end time display
  - Audio playback controls (Play, Play Last 2s) with Play/Stop toggle
  - Jog controls for fine time adjustments (+/-1s, +/-0.1s)
  - Text selection parsing from :clip[]{} directives
  - Formatted directive insertion at textarea cursor position

  Architecture Integration:
  - Svelte 5 runes for reactive state management
  - Service injection via props (AudioClipService, WorkspaceService, SettingsService)
  - Follows project's clean service architecture patterns
  - Uses existing design system tokens for consistent styling
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import type { AudioClipService, ClipData } from '$lib/audio/audio-clip.service.js';
  import type { WorkspaceService, WorkspaceState } from '$lib/services/workspace/workspace.service.js';
  import type { SettingsService } from '$lib/services/settings/settings.service.js';
  import type { ManifestItem } from '$lib/epub/opf-utils.js';

  // Required props - service injection following project architecture
  let {
    workspace,
    audioClipService,
    workspaceService: _workspaceService,
    settingsService,
    textContent = '',
    textareaSelection = null,
    onInsertClip,
  }: {
    workspace: WorkspaceState;
    audioClipService: AudioClipService;
    workspaceService: WorkspaceService;
    settingsService: SettingsService;
    textContent?: string;
    textareaSelection?: { start: number; end: number } | null;
    onInsertClip?: (clipText: string) => void;
  } = $props();

  // Component reactive state using Svelte 5 runes
  let availableAudioFiles = $state<ManifestItem[]>([]);
  let selectedAudioHref = $state<string>('');
  let audioSrc = $state<string>('');
  let audioElement = $state<HTMLAudioElement>();
  let audioDuration = $state<number>(0);
  let isLoading = $state<boolean>(false);
  let error = $state<string | null>(null);

  // Clip timing state
  let startTimeString = $state<string>('0:00:00.00');
  let durationString = $state<string>('0:00:10.00');
  let rangeSliderValue = $state<number>(0);
  
  // Clip metadata state
  let labelString = $state<string>('');

  // Playback state
  let isPlaying = $state<boolean>(false);
  let isPlayingLast = $state<boolean>(false);
  let playbackMode = $state<'clip' | 'last' | null>(null);

  // Derived reactive computations
  let startSeconds = $derived((() => {
    try {
      return audioClipService.parseTimeString(startTimeString);
    } catch {
      return 0;
    }
  })());

  let durationSeconds = $derived((() => {
    try {
      return audioClipService.parseTimeString(durationString);
    } catch {
      return 10;
    }
  })());

  let endSeconds = $derived(startSeconds + durationSeconds);
  let _endTimeString = $derived(audioClipService.formatTimeString(endSeconds));

  let canLoadFromSelection = $derived((() => {
    if (!textareaSelection || !textContent) return false;
    const selectedText = textContent.slice(textareaSelection.start, textareaSelection.end);
    const parsed = audioClipService.parseClipDirective(selectedText);
    return parsed !== null;
  })());

  let audioButtonsDisabled = $derived(isLoading || !audioSrc);
  let playButtonLabel = $derived(isPlaying && playbackMode === 'clip' ? 'Stop' : 'Play');
  let playLastButtonLabel = $derived(isPlayingLast && playbackMode === 'last' ? 'Stop' : 'Play Last 2s');

  // Load available audio files on mount
  onMount(async () => {
    try {
      availableAudioFiles = await audioClipService.getAvailableAudioFiles(workspace.id);
      if (availableAudioFiles.length > 0 && !selectedAudioHref) {
        selectedAudioHref = availableAudioFiles[0].href;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load audio files';
    }
  });

  // Load selected audio file reactively
  $effect(() => {
    if (selectedAudioHref && workspace.id) {
      (async () => {
        try {
          console.log('🎵 Component: Loading audio - href:', selectedAudioHref, 'workspace:', workspace.id);
          isLoading = true;
          error = null;
          
          const newAudioSrc = await audioClipService.loadAudioFile(workspace.id, selectedAudioHref);
          console.log('🎵 Component: Audio src received:', newAudioSrc);
          console.log('🎵 Component: Setting audioSrc, will trigger audio element load');
          audioSrc = newAudioSrc;
        } catch (err) {
          console.error('🎵 Component: Audio loading error:', err);
          error = err instanceof Error ? err.message : 'Failed to load audio file';
          audioSrc = '';
        } finally {
          isLoading = false;
        }
      })();
    }
  });

  // Handle audio metadata loading
  $effect(() => {
    if (audioElement && audioSrc) {
      console.log('🎵 Component: Audio element and src available:', {
        audioSrc,
        audioElementSrc: audioElement.src,
        readyState: audioElement.readyState
      });
      
      const handleLoadedMetadata = () => {
        if (!audioElement) return;
        console.log('🎵 Component: loadedmetadata event fired');
        console.log('🎵 Component: Audio duration:', audioElement.duration);
        console.log('🎵 Component: Audio ready state:', audioElement.readyState);
        
        const metadata = audioClipService.getAudioMetadata(audioElement);
        console.log('🎵 Component: Extracted metadata:', metadata);
        audioDuration = metadata.duration;
        console.log('🎵 Component: Set audioDuration to:', audioDuration);
        
        // Update clip range in service
        audioClipService.setClipRange(startSeconds, endSeconds);
      };

      const handleEnded = () => {
        isPlaying = false;
        isPlayingLast = false;
        playbackMode = null;
      };

      const handleTimeUpdate = () => {
        // Auto-stop at clip end
        if (audioElement && playbackMode === 'clip') {
          if (audioElement.currentTime >= endSeconds) {
            audioClipService.stop(audioElement);
            isPlaying = false;
            playbackMode = null;
          }
        } else if (audioElement && playbackMode === 'last') {
          if (audioElement.currentTime >= endSeconds) {
            audioClipService.stop(audioElement);
            isPlayingLast = false;
            playbackMode = null;
          }
        }
      };

      audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioElement.addEventListener('ended', handleEnded);
      audioElement.addEventListener('timeupdate', handleTimeUpdate);

      return () => {
        audioElement?.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioElement?.removeEventListener('ended', handleEnded);
        audioElement?.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }
  });

  // Unidirectional synchronization: Start time input → Range slider
  $effect(() => {
    // Update range slider when start time changes (jog buttons, manual input, etc.)
    if (audioDuration > 0) {
      const newRangeValue = (startSeconds / audioDuration) * 100;
      rangeSliderValue = newRangeValue;
    }
  });

  // Update service clip range when timing changes
  $effect(() => {
    if (startSeconds >= 0 && endSeconds > startSeconds) {
      try {
        audioClipService.setClipRange(startSeconds, endSeconds);
      } catch (err) {
        // Ignore validation errors during input
      }
    }
  });

  /**
   * Handle audio file selection change
   */
  function handleAudioSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    selectedAudioHref = select.value;
  }

  /**
   * Handle range slider input
   */
  function handleRangeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    rangeSliderValue = parseFloat(input.value);
    
    // Directly update start time based on slider position to avoid sync conflicts
    if (audioDuration > 0) {
      const newStartSeconds = (rangeSliderValue / 100) * audioDuration;
      startTimeString = audioClipService.formatTimeString(newStartSeconds);
    }
  }

  /**
   * Handle range slider drag end - clamp duration if needed
   */
  function handleRangeEnd(): void {
    if (audioDuration > 0) {
      const currentStartSeconds = startSeconds;
      const currentDurationSeconds = durationSeconds;
      const maxDuration = audioDuration - currentStartSeconds;
      
      // Clamp duration if start + duration exceeds audio length
      if (currentDurationSeconds > maxDuration) {
        durationString = audioClipService.formatTimeString(maxDuration);
      }
    }
  }

  /**
   * Parse flexible time input formats for user convenience
   * Examples: '2' -> '0:00:02.00', '2:01' -> '0:02:01.00', '1:23:45' -> '1:23:45.00'
   */
  function parseFlexibleTimeInput(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '0:00:00.00';
    
    // If it's already a complete time format, try to parse it directly
    try {
      audioClipService.parseTimeString(trimmed);
      return trimmed; // Valid format, return as-is
    } catch {
      // Fall through to flexible parsing
    }
    
    // Remove any non-digit/colon/period characters
    const cleaned = trimmed.replace(/[^\d:.]/g, '');
    
    // Split by colons and periods
    const parts = cleaned.split(':');
    const lastPart = parts[parts.length - 1];
    const [seconds, centiseconds] = lastPart.split('.');
    
    let hours = '0';
    let minutes = '00';
    let secs = '00';
    let cs = '00';
    
    if (parts.length === 1) {
      // Just a number: treat as seconds
      secs = parts[0].padStart(2, '0');
      if (centiseconds) cs = centiseconds.padEnd(2, '0').substring(0, 2);
    } else if (parts.length === 2) {
      // mm:ss format
      minutes = parts[0].padStart(2, '0');
      secs = seconds.padStart(2, '0');
      if (centiseconds) cs = centiseconds.padEnd(2, '0').substring(0, 2);
    } else if (parts.length >= 3) {
      // h:mm:ss format
      hours = parts[0];
      minutes = parts[1].padStart(2, '0');
      secs = seconds.padStart(2, '0');
      if (centiseconds) cs = centiseconds.padEnd(2, '0').substring(0, 2);
    }
    
    return `${hours}:${minutes}:${secs}.${cs}`;
  }

  /**
   * Format time string for compact display (removes unnecessary zero-padding)
   * e.g., '0:02:30.00' becomes '2:30.0'
   */
  function formatTimeForDisplay(timeString: string): string {
    const parts = timeString.split(':');
    if (parts.length !== 3) return timeString;
    
    const hours = parts[0];
    const minutes = parts[1];
    const secondsPart = parts[2].split('.');
    const seconds = secondsPart[0];
    const centiseconds = secondsPart[1] || '00';
    
    // Remove leading zeros and unnecessary precision
    const h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const s = parseInt(seconds, 10);
    const cs = centiseconds.replace(/0+$/, ''); // Remove trailing zeros
    
    // Build display string
    let result = '';
    if (h > 0) {
      result += `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
      result += `${m}:${s.toString().padStart(2, '0')}`;
    }
    
    // Add centiseconds if not zero
    if (cs && cs !== '0' && cs !== '00') {
      result += `.${cs}`;
    }
    
    return result;
  }

  /**
   * Handle time input validation and update
   */
  function handleTimeInput(type: 'start' | 'duration', event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    // Only normalize and validate on blur or enter events
    // Allow free typing without interruption
    if (event.type !== 'blur' && (event as KeyboardEvent)?.key !== 'Enter') {
      return;
    }

    try {
      // Use flexible parsing for both start and duration inputs
      const normalizedTime = parseFlexibleTimeInput(value);
      
      // Validate the normalized time
      const parsedSeconds = audioClipService.parseTimeString(normalizedTime);
      
      // Clamp duration to remaining audio length
      let finalTime = normalizedTime;
      if (type === 'duration' && audioDuration > 0) {
        const maxDuration = audioDuration - startSeconds;
        if (parsedSeconds > maxDuration) {
          finalTime = audioClipService.formatTimeString(maxDuration);
        }
      }
      
      // Update state with clamped value
      if (type === 'start') {
        startTimeString = finalTime;
      } else {
        durationString = finalTime;
      }
      
      // Update the input field with compact display format
      input.value = formatTimeForDisplay(finalTime);
    } catch {
      // Reset to last valid value on invalid input
      const lastValidTime = type === 'start' ? startTimeString : durationString;
      input.value = formatTimeForDisplay(lastValidTime);
    }
  }

  /**
   * Handle time input key events (Enter validation)
   */
  function handleTimeKeydown(type: 'start' | 'duration', event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      handleTimeInput(type, event);
    }
  }

  /**
   * Jog start time by specified seconds
   */
  function jogStartTime(deltaSeconds: number): void {
    if (!audioElement) return;
    
    const newStartTime = Math.max(0, startSeconds + deltaSeconds);
    const maxStartTime = Math.max(0, audioElement.duration - durationSeconds);
    const clampedStartTime = Math.min(newStartTime, maxStartTime);
    
    startTimeString = audioClipService.formatTimeString(clampedStartTime);
    
    // Reset audio position if playing
    if (audioElement && (isPlaying || isPlayingLast)) {
      audioElement.currentTime = clampedStartTime;
    }
  }

  /**
   * Handle play clip button
   */
  async function handlePlayClip(): Promise<void> {
    if (!audioElement) return;

    try {
      if (isPlaying && playbackMode === 'clip') {
        // Stop current playback
        audioClipService.stop(audioElement);
        isPlaying = false;
        playbackMode = null;
      } else {
        // Stop any other playback first
        if (isPlayingLast) {
          audioClipService.stop(audioElement);
          isPlayingLast = false;
        }
        
        // Start clip playback
        await audioClipService.playClip(audioElement);
        isPlaying = true;
        playbackMode = 'clip';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Playback failed';
    }
  }

  /**
   * Handle play last seconds button
   */
  async function handlePlayLastSeconds(): Promise<void> {
    if (!audioElement) return;

    try {
      if (isPlayingLast && playbackMode === 'last') {
        // Stop current playback
        audioClipService.stop(audioElement);
        isPlayingLast = false;
        playbackMode = null;
      } else {
        // Stop any other playback first
        if (isPlaying) {
          audioClipService.stop(audioElement);
          isPlaying = false;
        }
        
        // Start last seconds playback
        await audioClipService.playLastSeconds(audioElement, 2);
        isPlayingLast = true;
        playbackMode = 'last';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Playback failed';
    }
  }

  /**
   * Load clip data from selected text
   */
  function handleLoadFromSelection(): void {
    if (!textareaSelection || !textContent) return;
    
    const selectedText = textContent.slice(textareaSelection.start, textareaSelection.end);
    const parsed = audioClipService.parseClipDirective(selectedText);
    
    if (parsed) {
      // Find matching audio file
      const audioFile = availableAudioFiles.find(file => file.href === parsed.href);
      if (audioFile) {
        selectedAudioHref = audioFile.href;
      }
      
      // Update timing
      startTimeString = parsed.begin;
      
      // Update label
      labelString = parsed.label || '';
      
      try {
        const endTime = audioClipService.parseTimeString(parsed.end);
        const startTime = audioClipService.parseTimeString(parsed.begin);
        const duration = endTime - startTime;
        durationString = audioClipService.formatTimeString(duration);
      } catch {
        // Keep current duration if parsing fails
      }
    }
  }

  /**
   * Insert formatted clip directive
   */
  async function handleInsertClip(): Promise<void> {
    if (!selectedAudioHref) return;

    try {
      // Load template from EPUB settings
      const template = await audioClipService.getTemplate(workspace.id);

      const clipData: ClipData = {
        href: selectedAudioHref,
        startTime: startSeconds,
        duration: durationSeconds,
        endTime: endSeconds,
        label: labelString.trim() || undefined,
      };

      const clipText = audioClipService.formatClipDirective(clipData, template);
      onInsertClip?.(clipText);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to insert clip';
    }
  }

  // Clear error after timeout
  $effect(() => {
    if (error) {
      const timeoutId = setTimeout(() => error = null, 5000);
      return () => clearTimeout(timeoutId);
    }
  });
</script>

<div class="audio-clip-editor">
  <!-- Audio element for playback -->
  <audio bind:this={audioElement} src={audioSrc} preload="metadata"></audio>

  <!-- Error display -->
  {#if error}
    <div class="error-message">
      <span class="error-icon" aria-hidden="true">⚠️</span>
      <span>{error}</span>
    </div>
  {/if}

  <!-- Audio controls -->
  <div class="control-row">
    <!-- Audio file selection -->
    <div class="control-group">
      <select
        id="audio-select"
        class="audio-select"
        value={selectedAudioHref}
        onchange={handleAudioSelect}
        aria-label="Select audio file"
      >
        <option value="" disabled>Select audio...</option>
        {#each availableAudioFiles as file}
          <option value={file.href}>{file.id}</option>
        {/each}
      </select>
    </div>

    <!-- Range input slider -->
    <div class="control-group range-group">
      <input
        id="range-slider"
        type="range"
        class="range-slider"
        min="0"
        max="100"
        step="0.1"
        value={rangeSliderValue}
        disabled={!audioDuration}
        oninput={handleRangeInput}
        onchange={handleRangeEnd}
        aria-label="Approximate start position"
      />
    </div>

    <!-- Start time controls group -->
    <div class="control-pair">
      <div class="control-group time-input-group">
        <input
          id="start-time"
          type="text"
          class="time-input"
          value={formatTimeForDisplay(startTimeString)}
          placeholder="h:mm:ss.dd"
          oninput={e => handleTimeInput('start', e)}
          onblur={e => handleTimeInput('start', e)}
          onkeydown={e => handleTimeKeydown('start', e)}
          aria-label="Start time"
        />
      </div>

      <div class="control-group">
        <button
          type="button"
          class="control-btn play-btn"
          class:active={isPlaying && playbackMode === 'clip'}
          disabled={audioButtonsDisabled}
          onclick={handlePlayClip}
          aria-label={playButtonLabel}
          title={playButtonLabel}
        >
          {#if isPlaying && playbackMode === 'clip'}
            ⏹️
          {:else}
            ▶️
          {/if}
        </button>
      </div>
    </div>

    <!-- Duration controls group -->
    <div class="control-pair">
      <div class="control-group time-input-group">
        <input
          id="duration"
          type="text"
          class="time-input"
          value={formatTimeForDisplay(durationString)}
          placeholder="h:mm:ss.dd"
          oninput={e => handleTimeInput('duration', e)}
          onblur={e => handleTimeInput('duration', e)}
          onkeydown={e => handleTimeKeydown('duration', e)}
          aria-label="Duration"
        />
      </div>

      <div class="control-group">
        <button
          type="button"
          class="control-btn play-last-btn"
          class:active={isPlayingLast && playbackMode === 'last'}
          disabled={audioButtonsDisabled}
          onclick={handlePlayLastSeconds}
          aria-label={playLastButtonLabel}
          title={playLastButtonLabel}
        >
          {#if isPlayingLast && playbackMode === 'last'}
            ⏹️
          {:else}
            ▶️
          {/if}
        </button>
      </div>
    </div>

    <!-- Jog controls -->
    <div class="control-group jog-group">
      <div class="jog-controls">
        <button
          type="button"
          class="jog-btn"
          onclick={() => jogStartTime(-1)}
          aria-label="Move start time back 1 second"
          title="-1s"
        >
          -1
        </button>
        <button
          type="button"
          class="jog-btn"
          onclick={() => jogStartTime(-0.1)}
          aria-label="Move start time back 0.1 seconds"
          title="-0.1s"
        >
          -0.1
        </button>
        <button
          type="button"
          class="jog-btn"
          onclick={() => jogStartTime(0.1)}
          aria-label="Move start time forward 0.1 seconds"
          title="+0.1s"
        >
          +0.1
        </button>
        <button
          type="button"
          class="jog-btn"
          onclick={() => jogStartTime(1)}
          aria-label="Move start time forward 1 second"
          title="+1s"
        >
          +1
        </button>
      </div>
    </div>

    <!-- Load from selection button -->
    <button
      type="button"
      class="control-btn load-btn"
      disabled={!canLoadFromSelection}
      onclick={handleLoadFromSelection}
      aria-label="Load clip data from selected text"
      title="Load from Selection"
    >
      ↑
    </button>

    <!-- Insert clip directive button -->
    <button
      type="button"
      class="control-btn insert-btn primary-btn"
      disabled={!selectedAudioHref}
      onclick={handleInsertClip}
      aria-label="Insert clip directive at cursor position"
      title="Insert Clip Directive"
    >
      ➕
    </button>

    <!-- Label input -->
    <div class="control-group">
      <input
        id="clip-label"
        type="text"
        class="label-input"
        value={labelString}
        placeholder="Optional label"
        oninput={e => labelString = (e.target as HTMLInputElement).value}
        aria-label="Clip label"
      />
    </div>
  </div>

  <!-- Loading indicator -->
  {#if isLoading}
    <div class="loading-indicator">
      <div class="spinner"></div>
      <span>Loading audio...</span>
    </div>
  {/if}
</div>

<style>
  .audio-clip-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-error-bg);
    border: 1px solid var(--color-error-border);
    border-radius: var(--radius-sm);
    color: var(--color-error-text);
    font-size: var(--text-sm);
  }

  .control-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }


  .control-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0; /* Allow flex shrinking */
  }

  .control-pair {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: nowrap; /* Keep paired elements together */
  }


  /* Audio selection dropdown */
  .audio-select {
    min-width: 120px;
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .audio-select:focus {
    outline: none;
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 0 var(--focus-ring-width) var(--color-focus);
  }

  /* Range slider group */
  .range-group {
    flex: 1;
    min-width: 100px;
    justify-content: center;
  }

  .range-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--color-bg-tertiary);
    outline: none;
    cursor: pointer;
  }

  .range-slider::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-accent-primary);
    cursor: pointer;
    border: 2px solid var(--color-bg-primary);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .range-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-accent-primary);
    cursor: pointer;
    border: 2px solid var(--color-bg-primary);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .range-slider:focus {
    box-shadow: 0 0 0 var(--focus-ring-width) var(--color-focus);
  }

  /* Time inputs */
  .time-input {
    width: 80px;
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    font-family: var(--font-mono);
    text-align: center;
  }

  .time-input:focus {
    outline: none;
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 0 var(--focus-ring-width) var(--color-focus);
  }

  /* Label input */
  .label-input {
    width: 120px;
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
  }

  .label-input:focus {
    outline: none;
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 0 var(--focus-ring-width) var(--color-focus);
  }


  /* Time input groupings */
  .time-input-group {
    flex-direction: row !important;
  }

  /* Control buttons */
  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    white-space: nowrap;
    height: 36px;
    box-sizing: border-box;
  }

  .control-btn:hover:not(:disabled) {
    background: var(--color-bg-hover);
    border-color: var(--color-accent-primary);
  }

  .control-btn:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .control-btn.active {
    background: var(--color-accent-primary);
    color: var(--color-accent-contrast);
    border-color: var(--color-accent-primary);
  }

  .primary-btn {
    background: var(--color-accent-primary);
    color: var(--color-accent-contrast);
    border-color: var(--color-accent-primary);
    font-weight: var(--font-semibold);
  }

  .primary-btn:hover:not(:disabled) {
    background: var(--color-accent-secondary);
    border-color: var(--color-accent-secondary);
  }


  /* Jog controls group */
  .jog-group {
    align-items: center;
  }

  .jog-controls {
    display: flex;
    gap: 1px;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    overflow: hidden;
    height: 36px;
    box-sizing: border-box;
  }

  .jog-btn {
    padding: var(--space-2) var(--space-2);
    border: none;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    cursor: pointer;
    transition: background-color var(--duration-fast) ease;
    min-width: 36px;
    height: 36px;
    box-sizing: border-box;
  }

  .jog-btn:hover {
    background: var(--color-bg-hover);
  }

  .jog-btn:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: -2px;
    z-index: 1;
    position: relative;
  }

  .jog-btn + .jog-btn {
    border-left: 1px solid var(--color-border-default);
  }

  /* Loading indicator */
  .loading-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-border-default);
    border-top: 2px solid var(--color-accent-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Responsive behavior */
  @media (max-width: 768px) {
    .control-row {
      gap: var(--space-1);
    }
    
    .time-input {
      width: 70px;
    }
    
    .audio-select {
      min-width: 100px;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .control-btn,
    .audio-select,
    .time-input {
      border: 2px solid var(--color-forced-border);
    }
    
    .range-slider::-webkit-slider-thumb,
    .range-slider::-moz-range-thumb {
      border: 2px solid var(--color-forced-border);
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .control-btn,
    .spinner {
      transition: none;
      animation: none;
    }
  }

  /* Dark mode optimizations */
  @media (prefers-color-scheme: dark) {
    .range-slider::-webkit-slider-thumb,
    .range-slider::-moz-range-thumb {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    }
  }
</style>