<!--
  OperationLog Component
  
  Real-time activity logging component that displays timestamped operations
  with color-coded log levels and filtering capabilities.
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface LogEntry {
    id: string;
    timestamp: Date;
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
    details?: any;
  }

  export let entries: LogEntry[] = [];

  const dispatch = createEventDispatcher();

  // Filter state
  let selectedLevel: string = 'all';
  let isAutoScroll = true;
  let searchQuery = '';

  // Log levels for filtering
  const logLevels = [
    { value: 'all', label: 'All', count: 0 },
    { value: 'info', label: 'Info', count: 0 },
    { value: 'success', label: 'Success', count: 0 },
    { value: 'warning', label: 'Warning', count: 0 },
    { value: 'error', label: 'Error', count: 0 }
  ];

  // Log container for auto-scroll
  let logContainer: HTMLElement;

  // Filter entries
  $: filteredEntries = filterEntries(entries);
  $: updateLogCounts(entries);

  function filterEntries(allEntries: LogEntry[]): LogEntry[] {
    let filtered = allEntries;

    // Apply level filter
    if (selectedLevel !== 'all') {
      filtered = filtered.filter(entry => entry.level === selectedLevel);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.message.toLowerCase().includes(query) ||
        (entry.details && JSON.stringify(entry.details).toLowerCase().includes(query))
      );
    }

    return filtered;
  }

  function updateLogCounts(allEntries: LogEntry[]) {
    const counts = allEntries.reduce((acc, entry) => {
      acc[entry.level] = (acc[entry.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    logLevels[0].count = allEntries.length; // all
    logLevels[1].count = counts.info || 0;
    logLevels[2].count = counts.success || 0;
    logLevels[3].count = counts.warning || 0;
    logLevels[4].count = counts.error || 0;
  }

  // Auto-scroll to bottom when new entries are added
  $: if (isAutoScroll && logContainer && entries.length > 0) {
    setTimeout(() => {
      logContainer.scrollTop = logContainer.scrollHeight;
    }, 0);
  }

  // Format timestamp
  function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // Get log level icon
  function getLogIcon(level: LogEntry['level']): string {
    switch (level) {
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '📝';
    }
  }

  // Get log level color class
  function getLogLevelClass(level: LogEntry['level']): string {
    return `log-${level}`;
  }

  // Clear log
  function handleClearLog() {
    dispatch('clearLog');
  }

  // Copy log entry to clipboard
  function copyLogEntry(entry: LogEntry) {
    const logText = `[${formatTime(entry.timestamp)}] ${entry.level.toUpperCase()}: ${entry.message}`;
    navigator.clipboard.writeText(logText).then(() => {
      // Could show a toast notification here
    });
  }

  // Export logs as JSON
  function exportLogs() {
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalEntries: entries.length,
      entries: entries.map(entry => ({
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        message: entry.message,
        details: entry.details
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extension-manager-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Toggle auto-scroll
  function toggleAutoScroll() {
    isAutoScroll = !isAutoScroll;
  }

  // Manual scroll to bottom
  function scrollToBottom() {
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  // Show log details in modal or expanded view
  function showLogDetails(entry: LogEntry) {
    if (entry.details) {
      // For demo purposes, we'll use alert. In real app, would use a modal.
      alert(`Log Details:\n\n${JSON.stringify(entry.details, null, 2)}`);
    }
  }
</script>

<div class="operation-log">
  <!-- Log Header -->
  <div class="log-header">
    <h3>Operation Log</h3>
    <div class="log-controls">
      <button 
        class="control-btn"
        class:active={isAutoScroll}
        on:click={toggleAutoScroll}
        title="Toggle auto-scroll"
      >
        📜
      </button>
      <button class="control-btn" on:click={scrollToBottom} title="Scroll to bottom">
        ⬇️
      </button>
      <button class="control-btn" on:click={exportLogs} title="Export logs">
        💾
      </button>
      <button class="control-btn clear-btn" on:click={handleClearLog} title="Clear log">
        🗑️
      </button>
    </div>
  </div>

  <!-- Log Filters -->
  <div class="log-filters">
    <!-- Level filters -->
    <div class="level-filters">
      {#each logLevels as level}
        <button
          class="level-filter"
          class:active={selectedLevel === level.value}
          class:has-entries={level.count > 0}
          on:click={() => selectedLevel = level.value}
        >
          <span class="level-label">{level.label}</span>
          <span class="level-count">{level.count}</span>
        </button>
      {/each}
    </div>

    <!-- Search filter -->
    <div class="search-filter">
      <input
        type="text"
        placeholder="Search logs..."
        bind:value={searchQuery}
        class="search-input"
      />
    </div>
  </div>

  <!-- Log Entries -->
  <div class="log-container" bind:this={logContainer}>
    {#if filteredEntries.length === 0}
      <div class="empty-log">
        {#if entries.length === 0}
          <div class="empty-icon">📝</div>
          <p>No operations logged yet.</p>
          <p class="empty-hint">Operations will appear here as you use the Extension Manager.</p>
        {:else}
          <div class="empty-icon">🔍</div>
          <p>No matching log entries found.</p>
          <p class="empty-hint">Try adjusting your filters or search query.</p>
        {/if}
      </div>
    {:else}
      <div class="log-entries">
        {#each filteredEntries as entry (entry.id)}
          <div 
            class="log-entry {getLogLevelClass(entry.level)}"
            class:has-details={entry.details}
            on:click={() => entry.details && showLogDetails(entry)}
            role={entry.details ? 'button' : 'listitem'}
            tabindex={entry.details ? 0 : -1}
            on:keydown={(e) => e.key === 'Enter' && entry.details && showLogDetails(entry)}
          >
            <div class="log-timestamp">
              {formatTime(entry.timestamp)}
            </div>
            <div class="log-icon">
              {getLogIcon(entry.level)}
            </div>
            <div class="log-content">
              <div class="log-message">{entry.message}</div>
              {#if entry.details}
                <div class="log-details-indicator">
                  Click to view details
                </div>
              {/if}
            </div>
            <div class="log-actions">
              <button
                class="log-action-btn"
                on:click|stopPropagation={() => copyLogEntry(entry)}
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Log Statistics -->
  <div class="log-footer">
    <div class="log-stats">
      <span class="stat-item">
        Total: {entries.length}
      </span>
      <span class="stat-item">
        Filtered: {filteredEntries.length}
      </span>
      {#if entries.length > 0}
        <span class="stat-item">
          Latest: {formatTime(entries[0]?.timestamp)}
        </span>
      {/if}
    </div>
  </div>
</div>

<style>
  .operation-log {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    height: 400px;
    overflow: hidden;
  }

  .log-header {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border-secondary);
    background: var(--color-bg-tertiary);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .log-header h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-lg);
  }

  .log-controls {
    display: flex;
    gap: var(--space-1);
  }

  .control-btn {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: all 0.2s ease;
  }

  .control-btn:hover {
    background: var(--color-bg-accent);
  }

  .control-btn.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
  }

  .clear-btn:hover {
    background: var(--color-error);
    border-color: var(--color-error);
    color: white;
  }

  .log-filters {
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--color-border-secondary);
    background: var(--color-bg-accent);
  }

  .level-filters {
    display: flex;
    gap: var(--space-1);
    margin-bottom: var(--space-2);
  }

  .level-filter {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    cursor: pointer;
    font-size: var(--font-size-sm);
    display: flex;
    align-items: center;
    gap: var(--space-1);
    transition: all 0.2s ease;
  }

  .level-filter:hover {
    background: var(--color-bg-secondary);
  }

  .level-filter.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
  }

  .level-filter.has-entries .level-count {
    opacity: 1;
  }

  .level-count {
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    min-width: 20px;
    text-align: center;
    opacity: 0.6;
  }

  .level-filter.active .level-count {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .search-input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
  }

  .log-container {
    flex: 1;
    overflow-y: auto;
    background: var(--color-bg-primary);
  }

  .log-entries {
    padding: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .log-entry {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-secondary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    transition: all 0.2s ease;
  }

  .log-entry.has-details {
    cursor: pointer;
  }

  .log-entry.has-details:hover {
    background: var(--color-bg-accent);
    border-color: var(--color-border-accent);
  }

  .log-entry.log-info {
    border-left: 3px solid var(--color-info);
  }

  .log-entry.log-success {
    border-left: 3px solid var(--color-success);
  }

  .log-entry.log-warning {
    border-left: 3px solid var(--color-warning);
    background: var(--color-bg-warning);
  }

  .log-entry.log-error {
    border-left: 3px solid var(--color-error);
    background: var(--color-bg-error);
  }

  .log-timestamp {
    color: var(--color-text-secondary);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-xs);
    min-width: 60px;
  }

  .log-icon {
    font-size: var(--font-size-md);
  }

  .log-content {
    flex: 1;
    min-width: 0;
  }

  .log-message {
    color: var(--color-text-primary);
    word-wrap: break-word;
  }

  .log-details-indicator {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    font-style: italic;
    margin-top: var(--space-1);
  }

  .log-actions {
    display: flex;
    gap: var(--space-1);
  }

  .log-action-btn {
    padding: var(--space-1);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    cursor: pointer;
    font-size: var(--font-size-xs);
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .log-entry:hover .log-action-btn {
    opacity: 1;
  }

  .log-action-btn:hover {
    background: var(--color-bg-accent);
  }

  .empty-log {
    padding: var(--space-8);
    text-align: center;
    color: var(--color-text-secondary);
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: var(--space-3);
    opacity: 0.5;
  }

  .empty-log p {
    margin: 0 0 var(--space-1) 0;
  }

  .empty-hint {
    font-size: var(--font-size-sm);
    opacity: 0.8;
  }

  .log-footer {
    padding: var(--space-2) var(--space-4);
    border-top: 1px solid var(--color-border-secondary);
    background: var(--color-bg-tertiary);
  }

  .log-stats {
    display: flex;
    gap: var(--space-3);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .stat-item {
    white-space: nowrap;
  }

  /* Custom scrollbar */
  .log-container::-webkit-scrollbar {
    width: 8px;
  }

  .log-container::-webkit-scrollbar-track {
    background: var(--color-bg-secondary);
  }

  .log-container::-webkit-scrollbar-thumb {
    background: var(--color-border-secondary);
    border-radius: var(--radius-sm);
  }

  .log-container::-webkit-scrollbar-thumb:hover {
    background: var(--color-border-primary);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .log-header {
      flex-direction: column;
      gap: var(--space-2);
      align-items: stretch;
    }

    .level-filters {
      flex-wrap: wrap;
    }

    .log-entry {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-1);
    }

    .log-timestamp {
      min-width: auto;
    }

    .log-stats {
      flex-direction: column;
      gap: var(--space-1);
    }
  }
</style>