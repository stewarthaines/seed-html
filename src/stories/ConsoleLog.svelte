<script lang="ts">
  export let logs: string[] = [];
  export let title: string = 'Console Log';
  export let maxHeight: string = '200px';

  let logContainer: HTMLElement;

  // Auto-scroll to bottom when new logs are added
  $: if (logContainer && logs.length > 0) {
    // Capture the reference to avoid null access in setTimeout
    const container = logContainer;
    setTimeout(() => {
      // Double-check the element still exists and is connected to DOM
      if (container && container.scrollHeight !== undefined) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }

  function clearLogs() {
    logs = [];
  }
</script>

<div class="console-log">
  <div class="console-header">
    <h4 class="console-title">{title}</h4>
    <button class="clear-button" on:click={clearLogs} title="Clear logs">
      Clear
    </button>
  </div>
  
  <div class="console-content" bind:this={logContainer} style="max-height: {maxHeight}">
    {#if logs.length === 0}
      <div class="empty-state">
        No log entries yet...
      </div>
    {:else}
      {#each logs as log, index}
        <div class="log-entry">
          <span class="log-index">{index + 1}.</span>
          <span class="log-message">{log}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .console-log {
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-md);
    background-color: var(--color-surface);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-sm);
  }

  .console-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-2) var(--spacing-3);
    background-color: var(--color-surface-elevated);
    border-bottom: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-md) var(--border-radius-md) 0 0;
  }

  .console-title {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
    font-family: var(--font-family-sans);
  }

  .clear-button {
    padding: var(--spacing-1) var(--spacing-2);
    background-color: var(--color-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: background-color var(--transition-fast);
  }

  .clear-button:hover {
    background-color: var(--color-surface-hover);
  }

  .console-content {
    padding: var(--spacing-2);
    overflow-y: auto;
    line-height: var(--line-height-relaxed);
  }

  .empty-state {
    color: var(--color-text-subtle);
    font-style: italic;
    text-align: center;
    padding: var(--spacing-4);
  }

  .log-entry {
    display: flex;
    padding: var(--spacing-1) 0;
    border-bottom: 1px solid transparent;
  }

  .log-entry:hover {
    background-color: var(--color-surface-hover);
    border-bottom-color: var(--color-border-subtle);
  }

  .log-index {
    color: var(--color-text-subtle);
    min-width: 2rem;
    margin-right: var(--spacing-2);
  }

  .log-message {
    color: var(--color-text-primary);
    word-break: break-all;
  }

  /* Custom scrollbar */
  .console-content::-webkit-scrollbar {
    width: 6px;
  }

  .console-content::-webkit-scrollbar-track {
    background: var(--color-surface);
  }

  .console-content::-webkit-scrollbar-thumb {
    background: var(--color-border-subtle);
    border-radius: var(--border-radius-sm);
  }

  .console-content::-webkit-scrollbar-thumb:hover {
    background: var(--color-border-focus);
  }

  /* Dark theme adjustments */
  [data-theme="dark"] .console-log {
    background-color: var(--color-surface);
    border-color: var(--color-border-subtle);
  }
</style>