<script lang="ts">
  import { onMount } from 'svelte';
  import App from '../../App.svelte';
  import {
    createWorkspaceStoryComposition,
    STORY_CONFIGS,
    type StoryConfiguration,
  } from '../utils/story-templates';
  import { formatLogEntry, getLogLevelClass } from '../utils/story-logging';

  // Props
  export let scenario: keyof typeof STORY_CONFIGS = 'basic';
  export let startCollapsed = false;
  export let simulateError = false;
  export let enableLogging = true;

  // Create story composition
  const story = createWorkspaceStoryComposition();

  // Build configuration from props
  $: config = {
    ...STORY_CONFIGS[scenario],
    layout: {
      ...(STORY_CONFIGS[scenario].layout || {}),
      startCollapsed,
    },
    errorHandling: {
      simulateError,
      errorMessage: 'Simulated initialization error',
    },
    logging: {
      enabled: enableLogging,
      showDetails: true,
    },
  };

  // Initialize story on mount
  onMount(() => {
    console.log('🚀 AppWithWorkspace onMount - Starting initialization');
    console.log('📋 Config passed to initializeStory:', config);
    console.log('🏭 Story composition created:', story);

    story.initializeStory(config);

    // Set up event listeners for spine item selection
    const handleSelectSpineItem = (event: Event) => {
      const customEvent = event as CustomEvent<{ itemId: string }>;
      story.setSelectedItem(customEvent.detail.itemId);
    };

    window.addEventListener('select-spine-item', handleSelectSpineItem);

    return () => {
      window.removeEventListener('select-spine-item', handleSelectSpineItem);
    };
  });

  // Debug: Log story state changes
  $: {
    console.log('📊 Story state updated:');
    console.log('  - workspaceManager:', story.state.workspaceManager);
    console.log('  - workspaceId:', story.state.workspaceId);
    console.log('  - initialized:', story.state.initialized);
    console.log('  - isLoading:', story.state.isLoading);
    console.log('  - error:', story.state.error);
  }

  // Debug: Log values being passed to App component when they change
  $: if (enableLogging) {
    console.log('🎯 Values being passed to App component:');
    console.log('  - workspaceManager:', story.state.workspaceManager);
    console.log('  - initialWorkspaceId:', story.state.workspaceId);
    console.log(
      '  - Are these null?',
      story.state.workspaceManager === null,
      story.state.workspaceId === null
    );
  }

  // Demo actions
  async function handleRefresh() {
    await story.refreshWorkspace();
  }

  async function handleReset() {
    await story.resetStory();
  }
</script>

<div class="app-with-workspace">
  <!-- Always visible debug indicator -->
  <div
    style="position: fixed; top: 10px; right: 10px; background: #ff6b6b; color: white; padding: 8px; border-radius: 4px; z-index: 9999; font-size: 12px;"
  >
    🔧 AppWithWorkspace Active | Scenario: {scenario} | Logging: {enableLogging}
  </div>

  <!-- Demo controls -->
  {#if enableLogging}
    <div class="demo-controls">
      <div class="controls-section">
        <h3>Demo Controls</h3>
        <div class="control-buttons">
          <button on:click={handleRefresh} disabled={!story.state.initialized}> 🔄 Refresh </button>
          <button on:click={handleReset}> 🔄 Reset </button>
          <button on:click={() => story.logger.clearLogs()}> 🗑️ Clear Logs </button>
        </div>
      </div>

      <div class="debug-section">
        <h4>🔍 Debug Info</h4>
        <div class="debug-grid">
          <div class="debug-item">
            <strong>Scenario:</strong>
            {scenario}
          </div>
          <div class="debug-item">
            <strong>Workspace Manager:</strong>
            <span
              class:success={!!story.state.workspaceManager}
              class:error={!story.state.workspaceManager}
            >
              {story.state.workspaceManager ? 'Present' : 'null'}
            </span>
          </div>
          <div class="debug-item">
            <strong>Workspace ID:</strong>
            <span class:success={!!story.state.workspaceId} class:error={!story.state.workspaceId}>
              {story.state.workspaceId || 'null'}
            </span>
          </div>
          <div class="debug-item">
            <strong>Initialized:</strong>
            <span class:success={story.state.initialized} class:error={!story.state.initialized}>
              {story.state.initialized}
            </span>
          </div>
          <div class="debug-item">
            <strong>Loading:</strong>
            <span class:loading={story.state.isLoading}>
              {story.state.isLoading}
            </span>
          </div>
          {#if story.state.error}
            <div class="debug-item error">
              <strong>Error:</strong>
              {story.state.error}
            </div>
          {/if}
        </div>
      </div>

      <div class="status-section">
        <h4>Status</h4>
        <div class="status-grid">
          <div class="status-item">
            <label>Workspace ID:</label>
            <span class="mono">{story.state.workspaceId || 'None'}</span>
          </div>
          <div class="status-item">
            <label>Initialized:</label>
            <span class="status" class:success={story.state.initialized}>
              {story.state.initialized ? '✅ Yes' : '❌ No'}
            </span>
          </div>
          <div class="status-item">
            <label>Loading:</label>
            <span class="status" class:loading={story.state.isLoading}>
              {story.state.isLoading ? '⏳ Loading...' : '✅ Ready'}
            </span>
          </div>
          <div class="status-item">
            <label>Selected Item:</label>
            <span class="mono">{story.selectedItemId || 'None'}</span>
          </div>
          {#if story.state.error}
            <div class="status-item error">
              <label>Error:</label>
              <span>{story.state.error}</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Logs display -->
      {#if story.logger.logs.length > 0}
        <div class="logs-section">
          <h4>Activity Log</h4>
          <div class="logs-container">
            {#each story.logger.logs.slice(-10) as log (log.id)}
              <div class="log-entry {getLogLevelClass(log.level)}">
                <span class="log-time">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span class="log-level">{log.level.toUpperCase()}</span>
                <span class="log-message">{log.message}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Main App -->
  <div class="app-container">
    <App
      workspaceManager={story.state.workspaceManager}
      initialWorkspaceId={story.state.workspaceId}
    />
  </div>
</div>

<style>
  .app-with-workspace {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--color-bg-primary);
  }

  .demo-controls {
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border-default);
    padding: var(--space-4);
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-6);
    align-items: start;
  }

  .controls-section h3,
  .status-section h4,
  .logs-section h4 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
  }

  .control-buttons {
    display: flex;
    gap: var(--space-2);
  }

  .control-buttons button {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-xs);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .control-buttons button:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-border-strong);
  }

  .control-buttons button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-2);
  }

  .status-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .status-item label {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status-item span {
    font-size: var(--text-sm);
    color: var(--color-text-primary);
  }

  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .status.success {
    color: var(--color-status-success);
  }

  .status.loading {
    color: var(--color-status-warning);
  }

  .status-item.error {
    grid-column: 1 / -1;
  }

  .status-item.error span {
    color: var(--color-status-error);
    font-size: var(--text-xs);
  }

  .logs-section {
    min-width: 300px;
  }

  .logs-container {
    max-height: 120px;
    overflow-y: auto;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
  }

  .log-entry {
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border-bottom: 1px solid var(--color-border-subtle);
    font-size: var(--text-xs);
    font-family: var(--font-mono);
  }

  .log-entry:last-child {
    border-bottom: none;
  }

  .log-time {
    color: var(--color-text-tertiary);
  }

  .log-level {
    font-weight: var(--font-medium);
    min-width: 60px;
  }

  .log-message {
    color: var(--color-text-primary);
  }

  .log-entry.log-info .log-level {
    color: var(--color-text-secondary);
  }

  .log-entry.log-success .log-level {
    color: var(--color-status-success);
  }

  .log-entry.log-warning .log-level {
    color: var(--color-status-warning);
  }

  .log-entry.log-error .log-level {
    color: var(--color-status-error);
  }

  .app-container {
    flex: 1;
    min-height: 0;
  }

  /* Scrollbar styling */
  .logs-container::-webkit-scrollbar {
    width: 6px;
  }

  .logs-container::-webkit-scrollbar-track {
    background: var(--color-bg-primary);
  }

  .logs-container::-webkit-scrollbar-thumb {
    background: var(--color-border-strong);
    border-radius: var(--radius-xs);
  }

  .logs-container::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-tertiary);
  }

  /* Debug section styles */
  .debug-section {
    min-width: 300px;
  }

  .debug-section h4 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
  }

  .debug-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .debug-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-1) var(--space-2);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
  }

  .debug-item strong {
    color: var(--color-text-secondary);
    margin-right: var(--space-2);
  }

  .debug-item span.success {
    color: var(--color-status-success);
    font-weight: var(--font-medium);
  }

  .debug-item span.error {
    color: var(--color-status-error);
    font-weight: var(--font-medium);
  }

  .debug-item span.loading {
    color: var(--color-status-warning);
    font-weight: var(--font-medium);
  }

  .debug-item.error {
    background: var(--color-bg-error, #ffe6e6);
    border-color: var(--color-status-error);
  }
</style>
