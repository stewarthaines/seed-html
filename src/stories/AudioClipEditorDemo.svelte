<!--
  AudioClipEditor Demo Component for Storybook

  This demo component showcases the AudioClipEditor functionality with:
  - Mock workspace containing the sample audio file
  - Interactive controls for testing all editor features
  - Real-time preview of generated clip directives
  - Integration with all required services (AudioClipService, WorkspaceService, SettingsService)
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import AudioClipEditor from '../lib/components/audio/AudioClipEditor.svelte';
  import { AudioClipService } from '../lib/audio/audio-clip.service.js';
  import { WorkspaceService } from '../lib/services/workspace/workspace.service.js';
  import { SettingsService } from '../lib/services/settings/settings.service.js';
  import { FileStorageAPI } from '../lib/storage/index.js';
  import type { WorkspaceState } from '../lib/services/workspace/workspace.service.js';
  import type { GlobalSettings } from '../lib/types/settings.js';
  import type { I18nStore } from '../lib/i18n/types.js';
  import type { ThemeStore } from '../lib/theme/types.js';

  // Demo state
  let initialized = false;
  let error: string | null = null;
  let isLoading = true;

  // Services and workspace state
  let workspace: WorkspaceState | null = null;
  let audioClipService: AudioClipService | null = null;
  let workspaceService: WorkspaceService | null = null;
  let settingsService: SettingsService | null = null;
  
  // Demo text content and selection state
  let textContent = `# Audio Integration Demo

This demo shows how to integrate audio clips into EPUB content.

## Sample Content

Here you can test the audio clip editor with the sample audio file. Try selecting different time ranges and inserting clip directives.

:clip[]{src=Audio/a1-19_Lesson1_Dialogue.mp3 begin=0:00:05.00 end=0:00:15.00}

This existing clip directive above demonstrates the format. You can edit it or create new ones using the Audio Clip Editor.

## Instructions

1. Use the Audio Clip Editor panel to select time ranges
2. Set start and end times using the controls
3. Click Insert to add a new clip directive at the cursor position

The generated directives can then be processed by the EPUB transform pipeline.`;

  let textareaSelection: { start: number; end: number } | null = null;
  let insertedClips: string[] = [];

  // Mock implementations for required dependencies
  const mockI18nStore: I18nStore = {
    locale: 'en',
    translations: {},
    isLoading: false,
    error: null
  };

  const mockThemeStore: ThemeStore = {
    theme: 'light',
    systemTheme: 'light',
    preferSystemTheme: false
  };

  /**
   * Handle clip insertion from AudioClipEditor
   */
  function handleInsertClip(clipText: string): void {
    insertedClips = [...insertedClips, clipText];
    
    // Insert at current cursor position or append
    if (textareaSelection) {
      const before = textContent.substring(0, textareaSelection.start);
      const after = textContent.substring(textareaSelection.end);
      textContent = before + '\n' + clipText + '\n' + after;
    } else {
      textContent += '\n\n' + clipText + '\n';
    }
  }

  /**
   * Update textarea selection tracking
   */
  function handleTextareaSelection(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textareaSelection = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd
    };
  }


  /**
   * Initialize demo workspace with sample audio file
   */
  async function initializeDemo(): Promise<void> {
    try {
      isLoading = true;
      error = null;

      // Initialize storage
      const fileStorage = FileStorageAPI.getInstance();
      await fileStorage.init();

      // Initialize services
      workspaceService = new WorkspaceService(fileStorage);
      settingsService = new SettingsService(fileStorage, null, mockThemeStore, mockI18nStore);
      
      // Create demo workspace using FileStorageAPI (like other demos)
      const workspaceId = await fileStorage.createWorkspace();
      console.log('🎵 Demo: Created workspace:', workspaceId);

      // Load real sample audio file from assets
      console.log('🎵 Demo: Fetching audio from:', '/src/assets/sample/a1-19_Lesson1_Dialogue.mp3');
      const audioResponse = await fetch('/src/assets/sample/a1-19_Lesson1_Dialogue.mp3');
      console.log('🎵 Demo: Audio response status:', audioResponse.status, audioResponse.ok);
      const realAudioData = await audioResponse.arrayBuffer();
      console.log('🎵 Demo: Audio data size:', realAudioData.byteLength, 'bytes');

      const audioPath = 'OEBPS/Audio/a1-19_Lesson1_Dialogue.mp3';
      console.log('🎵 Demo: Storing audio at workspace path:', audioPath);
      await fileStorage.writeFile(workspaceId, audioPath, realAudioData);
      console.log('🎵 Demo: Audio file stored in workspace:', workspaceId);

      // Create a basic workspace state for the demo (simplified)
      workspace = {
        id: workspaceId,
        opf: {
          metadata: {
            title: 'Audio Clip Demo',
            language: 'en',
            identifier: 'demo-audio-clip-' + Date.now(),
            creator: ['Demo Author'],
            date: new Date().toISOString().split('T')[0]
          },
          manifest: [
            {
              id: 'audio_lesson1',
              href: 'Audio/a1-19_Lesson1_Dialogue.mp3',
              mediaType: 'audio/mpeg'
            }
          ],
          spine: []
        }
      };

      // Create AudioClipService with new architecture (owns its BlobURLManager)
      audioClipService = new AudioClipService(fileStorage, workspaceService, settingsService);
      
      // Override getAvailableAudioFiles to return our demo audio file
      const originalGetAvailableAudioFiles = audioClipService.getAvailableAudioFiles.bind(audioClipService);
      audioClipService.getAvailableAudioFiles = async (workspaceId: string) => {
        return workspace?.opf.manifest.filter(item => 
          item.mediaType && item.mediaType.startsWith('audio/')
        ) || [];
      };

      initialized = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to initialize demo';
      console.error('Demo initialization error:', err);
    } finally {
      isLoading = false;
    }
  }

  /**
   * Reset demo to clean state
   */
  async function resetDemo(): Promise<void> {
    insertedClips = [];
    textareaSelection = null;
    textContent = `# Audio Integration Demo

This demo shows how to integrate audio clips into EPUB content.

## Sample Content

Here you can test the audio clip editor with the sample audio file. Try selecting different time ranges and inserting clip directives.

The generated directives can then be processed by the EPUB transform pipeline.`;

    await initializeDemo();
  }

  // Initialize on mount
  onMount(initializeDemo);
</script>

<div class="audio-clip-demo" role="main">
  <div class="demo-header">
    <h1>🎵 Audio Clip Editor Demo</h1>
    <p>Interactive demonstration of the AudioClipEditor component with sample audio file</p>
    
    <div class="demo-controls">
      <button type="button" onclick={resetDemo} disabled={isLoading}>
        🔄 Reset Demo
      </button>
    </div>
  </div>

  {#if error}
    <div class="error-display" role="alert">
      <h3>❌ Demo Error</h3>
      <p>{error}</p>
      <button type="button" onclick={resetDemo}>Try Again</button>
    </div>
  {:else if isLoading}
    <div class="loading-display">
      <p>🔄 Initializing demo workspace with sample audio...</p>
    </div>
  {:else if !initialized || !workspace || !audioClipService || !workspaceService || !settingsService}
    <div class="error-display">
      <p>❌ Demo services not properly initialized</p>
      <button type="button" onclick={resetDemo}>Try Again</button>
    </div>
  {:else}
    <div class="demo-content">
      <!-- Text Content Editor -->
      <div class="text-section">
        <h2>📝 Text Content</h2>
        <p class="section-description">
          Edit the text content below. Select text or position the cursor where you want to insert clip directives.
        </p>
        
        <div class="textarea-container">
          <textarea
            bind:value={textContent}
            onselect={handleTextareaSelection}
            onclick={handleTextareaSelection}
            onkeyup={handleTextareaSelection}
            placeholder="Enter your EPUB text content here..."
            rows="15"
            cols="80"
            class="content-textarea"
          ></textarea>
          
          {#if textareaSelection}
            <div class="selection-info">
              Selection: {textareaSelection.start} - {textareaSelection.end}
            </div>
          {/if}
        </div>
      </div>

      <!-- Audio Clip Editor -->
      <div class="audio-editor-section">
        <h2>🎵 Audio Clip Editor</h2>
        <p class="section-description">
          Use the controls below to select audio clips and insert them into your content.
        </p>
        
        <div class="audio-editor-container">
          <AudioClipEditor
            {workspace}
            {audioClipService}
            {workspaceService}
            {settingsService}
            {textContent}
            {textareaSelection}
            onInsertClip={handleInsertClip}
          />
        </div>
      </div>

      <!-- Inserted Clips Log -->
      {#if insertedClips.length > 0}
        <div class="inserted-clips-section">
          <h3>📋 Recently Inserted Clips</h3>
          <div class="clips-log">
            {#each insertedClips as clip, index}
              <div class="clip-entry">
                <span class="clip-number">{index + 1}.</span>
                <code class="clip-text">{clip}</code>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .audio-clip-demo {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }

  .demo-header {
    text-align: center;
    margin-bottom: 2rem;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 1rem;
  }

  .demo-header h1 {
    margin: 0 0 0.5rem 0;
    color: #2c3e50;
    font-size: 2rem;
  }

  .demo-header p {
    margin: 0 0 1rem 0;
    color: #666;
    font-size: 1.1rem;
  }

  .demo-controls {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 1rem;
  }

  .demo-controls button {
    background: #3498db;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background-color 0.2s;
  }

  .demo-controls button:hover:not(:disabled) {
    background: #2980b9;
  }

  .demo-controls button:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
  }

  .error-display,
  .loading-display {
    text-align: center;
    padding: 2rem;
    margin: 2rem 0;
    border-radius: 8px;
  }

  .error-display {
    background: #fff5f5;
    border: 1px solid #fed7d7;
    color: #c53030;
  }

  .loading-display {
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    color: #2d3748;
  }

  .demo-content {
    display: grid;
    gap: 2rem;
    grid-template-columns: 1fr;
  }

  .text-section,
  .audio-editor-section {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1.5rem;
    background: #fafafa;
  }

  .text-section h2,
  .audio-editor-section h2 {
    margin: 0 0 0.5rem 0;
    color: #2c3e50;
    font-size: 1.3rem;
  }

  .section-description {
    margin: 0 0 1rem 0;
    color: #666;
    font-size: 0.95rem;
  }

  .textarea-container {
    position: relative;
  }

  .content-textarea {
    width: 100%;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    line-height: 1.4;
    resize: vertical;
    background: white;
  }

  .content-textarea:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }

  .selection-info {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(52, 152, 219, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.75rem;
    color: #3498db;
    pointer-events: none;
  }

  .audio-editor-container {
    background: white;
    border-radius: 6px;
    padding: 1rem;
    border: 1px solid #e0e0e0;
  }

  .inserted-clips-section {
    margin-top: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #e9ecef;
  }

  .inserted-clips-section h3 {
    margin: 0 0 1rem 0;
    color: #495057;
    font-size: 1.1rem;
  }

  .clips-log {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .clip-entry {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .clip-number {
    color: #666;
    font-weight: bold;
    min-width: 2rem;
  }

  .clip-text {
    background: #e9ecef;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    word-break: break-all;
    flex: 1;
  }

  /* Responsive design */
  @media (min-width: 768px) {
    .demo-content {
      grid-template-columns: 1fr 1fr;
    }
    
    .audio-editor-section {
      grid-column: 1 / -1;
    }
  }
</style>