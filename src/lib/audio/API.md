# Audio Clip Editor API

## Overview

The Audio Clip Editor provides precise audio timestamp selection, clip range definition, and seamless integration with EPUB text content through the AudioClipService. This service follows the project's clean service architecture with dependency injection and integrates with workspace manifest management and blob URL handling for efficient audio file access.

**Key Features:**
- Event-driven audio playback with precise timing control
- Visual and text-based timestamp editing with bi-directional synchronization
- Configurable clip directive output formats
- Integration with EPUB manifest management
- Responsive design with accessibility compliance

## Class Documentation

### AudioClipService

The primary service class for audio clip editing functionality, following the project's service architecture pattern.

```typescript
export class AudioClipService {
  constructor(
    private blobUrlManager: BlobURLManager,
    private workspaceService: WorkspaceService
  )
}
```

**Dependencies:**
- `BlobURLManager` - For creating blob URLs from workspace audio files
- `WorkspaceService` - For accessing workspace manifest and file operations

**Architecture Integration:**
- Injected as service prop into components
- No service-to-service calls - maintains clean separation
- Follows project's error handling patterns with typed errors

## Method Documentation

### getAvailableAudioFiles()

```typescript
async getAvailableAudioFiles(workspaceId: string): Promise<ManifestItem[]>
```

**Input:**
- `workspaceId: string` - Unique identifier for the workspace

**Output:** `Promise<ManifestItem[]>` - Array of manifest items with `media-type` starting with "audio/"

**Side Effects:** 
- Loads workspace state through WorkspaceService
- Filters manifest items by audio media types

**Usage:**

```typescript
const audioService = new AudioClipService(blobUrlManager, workspaceService);
const audioFiles = await audioService.getAvailableAudioFiles('workspace-123');

// Use in component for audio file selection dropdown
console.log(`Found ${audioFiles.length} audio files`);
audioFiles.forEach(item => console.log(`${item.id}: ${item.href}`));
```

**Error Scenarios:**
- Throws `AudioClipServiceError` with code `WORKSPACE_NOT_FOUND` if workspace doesn't exist
- Throws `AudioClipServiceError` with code `MANIFEST_ERROR` if OPF parsing fails

### loadAudioFile()

```typescript
async loadAudioFile(workspaceId: string, href: string): Promise<string>
```

**Input:**
- `workspaceId: string` - Workspace identifier
- `href: string` - Manifest item href path to audio file

**Output:** `Promise<string>` - Blob URL for use with HTML5 audio element

**Side Effects:**
- Creates blob URL through BlobURLManager
- File is loaded from workspace storage

**Usage:**

```typescript
// Load audio file for playback
const blobUrl = await audioService.loadAudioFile('workspace-123', 'Audio/chapter1.mp3');

// Use with HTML5 audio element
audioElement.src = blobUrl;
await audioElement.load();
```

**Error Scenarios:**
- Throws `AudioClipServiceError` with code `AUDIO_NOT_FOUND` if file doesn't exist in workspace
- Throws `AudioClipServiceError` with code `BLOB_URL_ERROR` if blob creation fails

### getAudioMetadata()

```typescript
getAudioMetadata(audioElement: HTMLAudioElement): AudioMetadata
```

**Input:**
- `audioElement: HTMLAudioElement` - Audio element with loaded metadata

**Output:** `AudioMetadata` - Object containing duration, format, and optional metadata

**Side Effects:** None (read-only metadata extraction)

**Usage:**

```typescript
// After audio metadata is loaded
audioElement.addEventListener('loadedmetadata', () => {
  const metadata = audioService.getAudioMetadata(audioElement);
  console.log(`Duration: ${metadata.duration}s, Format: ${metadata.format}`);
});
```

### setClipRange()

```typescript
setClipRange(start: number, end: number): void
```

**Input:**
- `start: number` - Clip start time in seconds
- `end: number` - Clip end time in seconds

**Output:** `void`

**Side Effects:** 
- Updates internal clip range state
- Validates that start < end and both are positive

**Usage:**

```typescript
// Set a 30-second clip starting at 1:23
audioService.setClipRange(83.0, 113.0);

// Used internally by component jog controls
const jogStartTime = (deltaSeconds: number) => {
  const newStart = Math.max(0, currentStart + deltaSeconds);
  audioService.setClipRange(newStart, newStart + duration);
};
```

### getClipRange()

```typescript
getClipRange(): { start: number; end: number } | null
```

**Input:** None

**Output:** `{ start: number; end: number } | null` - Current clip range or null if not set

**Side Effects:** None (read-only access)

**Usage:**

```typescript
const clipRange = audioService.getClipRange();
if (clipRange) {
  console.log(`Clip: ${clipRange.start}s to ${clipRange.end}s`);
}
```

### playClip()

```typescript
async playClip(audioElement: HTMLAudioElement): Promise<void>
```

**Input:**
- `audioElement: HTMLAudioElement` - Audio element for playback

**Output:** `Promise<void>` - Resolves when playback starts

**Side Effects:**
- Sets audio currentTime to clip start
- Starts audio playback
- Adds event listeners for `timeupdate` and `seeked`
- Automatically pauses when reaching clip end
- Cleans up event listeners when stopping

**Usage:**

```typescript
// Play the defined clip with automatic stopping
await audioService.playClip(audioElement);

// Event-driven monitoring handles stopping at clip end
// No manual polling or timers required
```

**Implementation Notes:**
- Uses HTML5 audio events (`timeupdate`, `seeked`) following the project's event-driven approach
- No `requestAnimationFrame` or polling - relies on browser's native event system
- Automatic cleanup prevents memory leaks

### playLastSeconds()

```typescript
async playLastSeconds(audioElement: HTMLAudioElement, seconds?: number): Promise<void>
```

**Input:**
- `audioElement: HTMLAudioElement` - Audio element for playback
- `seconds?: number` - Number of seconds from end to play (default: 2)

**Output:** `Promise<void>` - Resolves when playback starts

**Side Effects:**
- Calculates start time as `max(clipStart, clipEnd - seconds)`
- Sets audio currentTime and starts playback
- Same event-driven stopping mechanism as `playClip()`

**Usage:**

```typescript
// Play last 2 seconds of clip
await audioService.playLastSeconds(audioElement);

// Play last 5 seconds
await audioService.playLastSeconds(audioElement, 5);
```

### pause()

```typescript
pause(audioElement: HTMLAudioElement): void
```

**Input:**
- `audioElement: HTMLAudioElement` - Audio element to pause

**Output:** `void`

**Side Effects:** 
- Pauses audio playback
- Event listeners remain active for potential resume

**Usage:**

```typescript
// Simple pause control
audioService.pause(audioElement);
```

### stop()

```typescript
stop(audioElement: HTMLAudioElement): void
```

**Input:**
- `audioElement: HTMLAudioElement` - Audio element to stop

**Output:** `void`

**Side Effects:**
- Pauses audio and resets to clip start position
- Cleans up active event listeners

**Usage:**

```typescript
// Stop and reset to clip beginning
audioService.stop(audioElement);
```

### parseClipDirective()

```typescript
parseClipDirective(text: string): ClipDirective | null
```

**Input:**
- `text: string` - Text potentially containing a clip directive

**Output:** `ClipDirective | null` - Parsed directive object or null if invalid

**Side Effects:** None (pure parsing function)

**Usage:**

```typescript
const selectedText = ':clip[label]{src=audio.mp3 begin=1:23:45.67 end=1:28:50.33}';
const parsed = audioService.parseClipDirective(selectedText);

if (parsed) {
  console.log(`Audio: ${parsed.href}, Start: ${parsed.begin}, End: ${parsed.end}`);
  // Auto-populate component fields from parsed values
}
```

**Supported Formats:**
- `:clip[label]{src=file.mp3 begin=h:mm:ss.dd end=h:mm:ss.dd}`
- `:clip[]{src=file.mp3 begin=h:mm:ss.dd end=h:mm:ss.dd rate=1.5}`
- Flexible attribute parsing with regex patterns

### formatClipDirective()

```typescript
formatClipDirective(data: ClipData, template: string): string
```

**Input:**
- `data: ClipData` - Clip timing and file information
- `template: string` - Template string with placeholders

**Output:** `string` - Formatted clip directive ready for insertion

**Side Effects:** None (pure formatting function)

**Usage:**

```typescript
const clipData: ClipData = {
  href: 'Audio/chapter1.mp3',
  startTime: 83.67,
  duration: 30.0,
  endTime: 113.67,
  playbackRate: 1.0
};

// Use default template
const directive = audioService.formatClipDirective(clipData, audioService.getDefaultTemplate());
// Result: ':clip[]{src=Audio/chapter1.mp3 begin=0:01:23.67 end=0:01:53.67}'

// Use custom template
const htmlTemplate = '<audio-clip src="<href>" begin="<begin>" end="<end>"></audio-clip>';
const htmlDirective = audioService.formatClipDirective(clipData, htmlTemplate);
```

**Template Placeholders:**
- `<href>` - Audio file manifest href
- `<begin>` - Formatted start time (h:mm:ss.dd)
- `<end>` - Formatted end time (h:mm:ss.dd)  
- `<rate>` - Playback rate (added automatically if not 1.0)

### parseTimeString()

```typescript
parseTimeString(timeString: string): number
```

**Input:**
- `timeString: string` - Time in `h:mm:ss.dd` format

**Output:** `number` - Time converted to total seconds

**Side Effects:** None (pure conversion function)

**Usage:**

```typescript
const seconds = audioService.parseTimeString('1:23:45.67');
console.log(seconds); // 5025.67

// Used in component for reactive calculations
let startSeconds = $derived(audioService.parseTimeString(startTimeString));
```

**Validation:**
- Strict regex pattern: `/^(\d+):(\d{2}):(\d{2})\.(\d{2})$/`
- Throws `AudioClipServiceError` with code `INVALID_TIME_FORMAT` for invalid input

### formatTimeString()

```typescript
formatTimeString(seconds: number): string
```

**Input:**
- `seconds: number` - Time in total seconds

**Output:** `string` - Formatted time string in `h:mm:ss.dd` format

**Side Effects:** None (pure formatting function)

**Usage:**

```typescript
const timeString = audioService.formatTimeString(5025.67);
console.log(timeString); // '1:23:45.67'

// Used in component for display
let endTimeString = $derived(audioService.formatTimeString(endSeconds));
```

### getDefaultTemplate()

```typescript
getDefaultTemplate(): string
```

**Input:** None

**Output:** `string` - Default clip directive template

**Side Effects:** None (constant value)

**Usage:**

```typescript
const template = audioService.getDefaultTemplate();
// Returns: ':clip[]{src=<href> begin=<begin> end=<end>}'
```

## Type Definitions

### AudioMetadata

```typescript
interface AudioMetadata {
  duration: number;
  sampleRate?: number;
  channels?: number;
  format: string;
  title?: string;
  artist?: string;
}
```

**Properties:**
- `duration` - Audio length in seconds (required)
- `sampleRate` - Sample rate in Hz (optional)
- `channels` - Number of audio channels (optional)
- `format` - File format/codec (required)
- `title` - Track title from metadata (optional)
- `artist` - Artist from metadata (optional)

### ClipData

```typescript
interface ClipData {
  href: string;
  startTime: number;
  duration: number;
  endTime: number;
  playbackRate?: number;
}
```

**Properties:**
- `href` - Manifest item href path to audio file
- `startTime` - Clip start in seconds
- `duration` - Clip length in seconds
- `endTime` - Calculated end time (startTime + duration)
- `playbackRate` - Optional playback speed multiplier

### ClipDirective

```typescript
interface ClipDirective {
  href: string;
  begin: string;
  end: string;
  rate?: string;
  label?: string;
}
```

**Properties:**
- `href` - Audio file reference from src attribute
- `begin` - Start time as formatted string (h:mm:ss.dd)
- `end` - End time as formatted string (h:mm:ss.dd)
- `rate` - Optional playback rate as string
- `label` - Optional content from :clip[label] brackets

### AudioClipServiceError

```typescript
export class AudioClipServiceError extends Error {
  constructor(message: string, public code: string, public audioHref?: string)
}
```

**Error Codes:**
- `WORKSPACE_NOT_FOUND` - Workspace doesn't exist
- `AUDIO_NOT_FOUND` - Audio file missing from workspace
- `BLOB_URL_ERROR` - Failed to create blob URL
- `INVALID_TIME_FORMAT` - Time string parsing failed
- `PLAYBACK_ERROR` - Audio playback operation failed
- `INVALID_STATE` - Service in invalid state for operation

## Common Integration Patterns

### Component Service Injection

```typescript
// Component receives service via props
let { 
  workspace,
  audioClipService,
  settingsService,
  textContent = $bindable(),
  onInsertClip
} = $props<{
  workspace: WorkspaceState;
  audioClipService: AudioClipService;
  settingsService: SettingsService;
  textContent: string;
  onInsertClip: (clipText: string) => void;
}>();
```

### Audio File Loading Pattern

```typescript
// Load available audio files on mount
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

// Load selected audio file reactively
$effect(async () => {
  if (selectedAudioHref && workspace.id) {
    try {
      isLoading = true;
      audioSrc = await audioClipService.loadAudioFile(workspace.id, selectedAudioHref);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load audio file';
    } finally {
      isLoading = false;
    }
  }
});
```

### Bi-directional Text Synchronization

```typescript
// Auto-populate from selected text
$effect(() => {
  if (textareaSelection && textContent) {
    const selectedText = textContent.slice(textareaSelection.start, textareaSelection.end);
    const parsed = audioClipService.parseClipDirective(selectedText);
    if (parsed) {
      selectedAudioHref = parsed.href;
      startTimeString = parsed.begin;
      const endTime = audioClipService.parseTimeString(parsed.end);
      const startTime = audioClipService.parseTimeString(parsed.begin);
      durationString = audioClipService.formatTimeString(endTime - startTime);
    }
  }
});

// Insert formatted directive
const insertClipDirective = () => {
  const template = settingsService.getSetting(workspace.id, 'audioClipTemplate') || 
                  audioClipService.getDefaultTemplate();
  
  const clipData: ClipData = {
    href: selectedAudioHref,
    startTime: startSeconds,
    duration: durationSeconds,
    endTime: endSeconds
  };
  
  const clipText = audioClipService.formatClipDirective(clipData, template);
  onInsertClip(clipText);
};
```

### Jog Controls Implementation

```typescript
// Modify start time and reset audio position
const jogStartTime = (deltaSeconds: number) => {
  if (!audioElement) return;
  
  const newStartTime = Math.max(0, startSeconds + deltaSeconds);
  const maxStartTime = audioElement.duration - durationSeconds;
  const clampedStartTime = Math.min(newStartTime, maxStartTime);
  
  startTimeString = audioClipService.formatTimeString(clampedStartTime);
  audioClipService.setClipRange(clampedStartTime, clampedStartTime + durationSeconds);
  
  // Reset audio to new start position (continues playback if playing)
  audioElement.currentTime = clampedStartTime;
};
```

## Error Handling

### Service-Level Error Recovery

```typescript
// Comprehensive error handling with recovery strategies
try {
  await audioClipService.playClip(audioElement);
} catch (error) {
  if (error instanceof AudioClipServiceError) {
    switch (error.code) {
      case 'AUDIO_NOT_FOUND':
        showMessage('Audio file not found. Please select a different file.');
        availableAudioFiles = await audioClipService.getAvailableAudioFiles(workspace.id);
        break;
      case 'PLAYBACK_ERROR':
        showMessage('Playback failed. Check audio format compatibility.');
        break;
      case 'INVALID_STATE':
        showMessage('Please set clip range before playing.');
        break;
      default:
        showMessage(`Audio error: ${error.message}`);
    }
  } else {
    showMessage('Unexpected error occurred');
    console.error('AudioClipService error:', error);
  }
}
```

### Component Error Display

```typescript
// Reactive error state with auto-clearing
let error = $state<string | null>(null);

// Clear error after timeout
$effect(() => {
  if (error) {
    const timeoutId = setTimeout(() => error = null, 5000);
    return () => clearTimeout(timeoutId);
  }
});
```

## Testing Considerations

### Unit Test Patterns

```typescript
// Mock dependencies for isolated testing
const mockBlobUrlManager = {
  createBlobUrl: vi.fn().mockResolvedValue('blob:test-url'),
  revokeBlobUrl: vi.fn()
};

const mockWorkspaceService = {
  loadWorkspace: vi.fn().mockResolvedValue({
    opf: {
      manifest: [
        { href: 'audio1.mp3', mediaType: 'audio/mpeg', id: 'audio1' },
        { href: 'text1.html', mediaType: 'text/html', id: 'text1' }
      ]
    }
  })
};

const audioService = new AudioClipService(mockBlobUrlManager, mockWorkspaceService);
```

### Time Parsing Tests

```typescript
describe('parseTimeString', () => {
  it('should parse valid time formats', () => {
    expect(audioService.parseTimeString('1:23:45.67')).toBe(5025.67);
    expect(audioService.parseTimeString('0:00:03.50')).toBe(3.5);
  });
  
  it('should throw for invalid formats', () => {
    expect(() => audioService.parseTimeString('invalid')).toThrow(AudioClipServiceError);
    expect(() => audioService.parseTimeString('1:23')).toThrow('INVALID_TIME_FORMAT');
  });
});
```

### Event-Driven Playback Tests

```typescript
// Test audio event handling (requires browser environment/Storybook)
describe('playClip integration', () => {
  it('should stop playback at clip end', async () => {
    const audioElement = document.createElement('audio');
    audioElement.duration = 100;
    
    audioService.setClipRange(10, 15);
    await audioService.playClip(audioElement);
    
    // Simulate timeupdate event
    audioElement.currentTime = 15.1;
    audioElement.dispatchEvent(new Event('timeupdate'));
    
    expect(audioElement.paused).toBe(true);
  });
});
```

## Browser Compatibility

### Required Features

**HTML5 Audio API:**
- `HTMLAudioElement` with precise seeking support
- `timeupdate` and `seeked` event handling
- `playbackRate` control for speed adjustment
- `currentTime` property with centisecond precision

**Web APIs:**
- Blob URLs for audio file access
- Event listeners with proper cleanup
- File API integration through BlobURLManager

### Feature Detection

```typescript
// Detect audio format support
const canPlayMp3 = audioElement.canPlayType('audio/mpeg') !== '';
const canPlayOgg = audioElement.canPlayType('audio/ogg') !== '';

// Test playback rate support
const supportsPlaybackRate = 'playbackRate' in HTMLAudioElement.prototype;

// Verify precise seeking
const supportsPreciseSeeking = () => {
  // Test with known audio file - implementation specific
  return new Promise(resolve => {
    audioElement.addEventListener('seeked', () => resolve(true), { once: true });
    audioElement.currentTime = 1.234;
  });
};
```

### Browser-Specific Considerations

- **Safari**: May have restrictions on autoplay and seeking before user interaction
- **Firefox**: OGG Vorbis preferred over MP3 for licensing reasons
- **Chrome**: Excellent format support, most reliable precise seeking
- **Mobile**: Touch event handling required, larger button sizes for accessibility

## Performance Characteristics

### Event-Driven Architecture
- **No polling overhead** - Uses native HTML5 audio events
- **Memory efficient** - Proper event listener cleanup prevents leaks
- **Battery friendly** - No continuous JavaScript execution during playback

### Optimization Strategies
- **Lazy loading**: Audio files loaded only when selected
- **Blob URL management**: Automatic cleanup prevents memory accumulation
- **Time string caching**: Efficient parsing with regex optimization
- **Reactive updates**: Minimal DOM manipulation through Svelte 5 runes

This API provides a complete foundation for audio clip editing functionality while maintaining performance, accessibility, and integration with the project's established architectural patterns.