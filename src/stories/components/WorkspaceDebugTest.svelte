<script lang="ts">
  import { onMount } from 'svelte';
  import { createWorkspaceStoryComposition, STORY_CONFIGS } from '../utils/story-templates';

  // Props
  export let scenario: keyof typeof STORY_CONFIGS = 'basic';

  // Create story composition
  const story = createWorkspaceStoryComposition();

  // Test state
  let debugInfo = {
    mounted: false,
    configPassed: false,
    initStarted: false,
    initCompleted: false,
    error: null as string | null,
    storyState: {},
  };

  // Build configuration
  $: config = {
    ...STORY_CONFIGS[scenario],
    logging: { enabled: true, showDetails: true },
  };

  onMount(async () => {
    debugInfo.mounted = true;
    debugInfo.configPassed = true;
    debugInfo = { ...debugInfo };

    try {
      debugInfo.initStarted = true;
      debugInfo = { ...debugInfo };

      await story.initializeStory(config);

      debugInfo.initCompleted = true;
      debugInfo.storyState = {
        workspaceManager: !!story.state.workspaceManager,
        workspaceId: story.state.workspaceId,
        initialized: story.state.initialized,
        isLoading: story.state.isLoading,
        error: story.state.error,
      };
      debugInfo = { ...debugInfo };
    } catch (error) {
      debugInfo.error = error.message;
      debugInfo = { ...debugInfo };
    }
  });

  // Watch story state changes
  $: debugInfo.storyState = {
    workspaceManager: !!story.state.workspaceManager,
    workspaceManagerType: story.state.workspaceManager?.constructor?.name,
    workspaceId: story.state.workspaceId,
    initialized: story.state.initialized,
    isLoading: story.state.isLoading,
    error: story.state.error,
  };
</script>

<div class="workspace-debug-test">
  <div class="debug-header">
    <h2>🔧 Workspace Creation Debug Test</h2>
    <p>Testing scenario: <strong>{scenario}</strong></p>
  </div>

  <div class="debug-grid">
    <div class="debug-section">
      <h3>Component Lifecycle</h3>
      <div class="status-list">
        <div class="status-item" class:success={debugInfo.mounted}>
          {debugInfo.mounted ? '✅' : '❌'} Component Mounted
        </div>
        <div class="status-item" class:success={debugInfo.configPassed}>
          {debugInfo.configPassed ? '✅' : '❌'} Config Passed
        </div>
        <div class="status-item" class:success={debugInfo.initStarted}>
          {debugInfo.initStarted ? '✅' : '❌'} Init Started
        </div>
        <div class="status-item" class:success={debugInfo.initCompleted}>
          {debugInfo.initCompleted ? '✅' : '❌'} Init Completed
        </div>
        {#if debugInfo.error}
          <div class="status-item error">
            ❌ Error: {debugInfo.error}
          </div>
        {/if}
      </div>
    </div>

    <div class="debug-section">
      <h3>Story State</h3>
      <div class="state-grid">
        <div class="state-item">
          <label>Workspace Manager:</label>
          <span class:success={debugInfo.storyState.workspaceManager}>
            {debugInfo.storyState.workspaceManager ? 'Present' : 'null'}
          </span>
          {#if debugInfo.storyState.workspaceManagerType}
            <small>({debugInfo.storyState.workspaceManagerType})</small>
          {/if}
        </div>
        <div class="state-item">
          <label>Workspace ID:</label>
          <span class:success={debugInfo.storyState.workspaceId}>
            {debugInfo.storyState.workspaceId || 'null'}
          </span>
        </div>
        <div class="state-item">
          <label>Initialized:</label>
          <span class:success={debugInfo.storyState.initialized}>
            {debugInfo.storyState.initialized ? 'true' : 'false'}
          </span>
        </div>
        <div class="state-item">
          <label>Loading:</label>
          <span class:loading={debugInfo.storyState.isLoading}>
            {debugInfo.storyState.isLoading ? 'true' : 'false'}
          </span>
        </div>
        {#if debugInfo.storyState.error}
          <div class="state-item error">
            <label>Error:</label>
            <span>{debugInfo.storyState.error}</span>
          </div>
        {/if}
      </div>
    </div>

    <div class="debug-section">
      <h3>Config Used</h3>
      <pre class="config-display">{JSON.stringify(config, null, 2)}</pre>
    </div>

    <div class="debug-section">
      <h3>Story Logs</h3>
      <div class="logs-container">
        {#each story.logger.logs as log (log.id)}
          <div class="log-entry {log.level}">
            <span class="log-time">{log.timestamp.toLocaleTimeString()}</span>
            <span class="log-level">{log.level.toUpperCase()}</span>
            <span class="log-message">{log.message}</span>
          </div>
        {/each}
        {#if story.logger.logs.length === 0}
          <p class="no-logs">No logs yet...</p>
        {/if}
      </div>
    </div>
  </div>

  <div class="debug-actions">
    <button on:click={() => story.initializeStory(config)}> 🔄 Retry Initialization </button>
    <button on:click={() => story.logger.clearLogs()}> 🗑️ Clear Logs </button>
  </div>
</div>

<style>
  .workspace-debug-test {
    padding: 1rem;
    font-family: system-ui, sans-serif;
    max-width: 1200px;
    margin: 0 auto;
  }

  .debug-header {
    text-align: center;
    margin-bottom: 2rem;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .debug-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .debug-section {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem;
  }

  .debug-section h3 {
    margin: 0 0 1rem 0;
    color: #333;
    border-bottom: 2px solid #eee;
    padding-bottom: 0.5rem;
  }

  .status-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .status-item {
    padding: 0.5rem;
    border-radius: 4px;
    background: #f9f9f9;
  }

  .status-item.success {
    background: #e8f5e8;
    color: #2d5a2d;
  }

  .status-item.error {
    background: #ffe6e6;
    color: #d63031;
  }

  .state-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .state-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .state-item label {
    font-weight: bold;
    font-size: 0.85rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .state-item span {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: #f5f5f5;
    font-family: monospace;
    font-size: 0.9rem;
  }

  .state-item span.success {
    background: #e8f5e8;
    color: #2d5a2d;
  }

  .state-item span.loading {
    background: #fff3cd;
    color: #856404;
  }

  .state-item.error span {
    background: #ffe6e6;
    color: #d63031;
  }

  .config-display {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    padding: 1rem;
    overflow-x: auto;
    font-size: 0.8rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .logs-container {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fafafa;
  }

  .log-entry {
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: 0.5rem;
    padding: 0.5rem;
    border-bottom: 1px solid #eee;
    font-size: 0.8rem;
    font-family: monospace;
  }

  .log-entry:last-child {
    border-bottom: none;
  }

  .log-time {
    color: #666;
  }

  .log-level {
    font-weight: bold;
    min-width: 60px;
  }

  .log-entry.info .log-level {
    color: #007bff;
  }

  .log-entry.success .log-level {
    color: #28a745;
  }

  .log-entry.warning .log-level {
    color: #ffc107;
  }

  .log-entry.error .log-level {
    color: #dc3545;
  }

  .no-logs {
    padding: 1rem;
    text-align: center;
    color: #666;
    font-style: italic;
  }

  .debug-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .debug-actions button {
    padding: 0.5rem 1rem;
    border: 1px solid #007bff;
    border-radius: 4px;
    background: #007bff;
    color: white;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .debug-actions button:hover {
    background: #0056b3;
    border-color: #0056b3;
  }
</style>
