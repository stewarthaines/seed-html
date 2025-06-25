<!--
  Template for Backend Feature Demo Components
  
  Copy this file and rename to match your feature:
  - BackendFeatureDemo.template.svelte -> YourFeatureDemo.svelte
  - Update imports, API calls, and component logic
  - Follow the patterns established here for consistency
-->

<script lang="ts">
  import { onMount } from 'svelte';
  // Import your feature API here
  // import { YourFeatureAPI } from '../lib/your-feature';
  import './backend-feature-demo.css';

  interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'action';
    message: string;
  }

  // Replace with your feature API
  let api: unknown; // Replace with: YourFeatureAPI;
  let logs: LogEntry[] = [];
  let isLoading = false;

  // Add feature-specific state variables here
  let featureState: unknown = null;
  let operationResults: unknown[] = [];

  onMount(async () => {
    try {
      // Initialize your API
      // api = new YourFeatureAPI();
      // await api.init();
      addLog('success', 'Feature API initialized');
      await refreshData();
    } catch (error: unknown) {
      addLog('error', `Failed to initialize: ${error.message}`);
    }
  });

  function addLog(type: LogEntry['type'], message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, { timestamp, type, message }];
  }

  async function refreshData() {
    if (!api) return;

    try {
      // Refresh any data from your API
      // featureState = await api.getCurrentState();
      // operationResults = await api.getResults();
    } catch (error: unknown) {
      addLog('error', `Failed to refresh data: ${error.message}`);
    }
  }

  // Example operation - replace with your feature's operations
  async function performExampleOperation() {
    if (!api || isLoading) return;
    isLoading = true;
    addLog('action', 'Performing example operation...');

    try {
      // Replace with actual API call
      // const result = await api.performOperation();
      // addLog('success', `Operation complete: ${result}`);
      addLog('success', 'Example operation complete');
      await refreshData();
    } catch (error: unknown) {
      addLog('error', `Operation failed: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  // Add more feature-specific operations here
  async function performAnotherOperation() {
    if (!api || isLoading) return;
    isLoading = true;
    addLog('action', 'Performing another operation...');

    try {
      // Your operation logic here
      addLog('success', 'Another operation complete');
      await refreshData();
    } catch (error: unknown) {
      addLog('error', `Operation failed: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  async function resetDemo() {
    if (!api || isLoading) return;
    isLoading = true;
    addLog('action', 'Resetting demo...');

    try {
      // Clear any persistent state in your API
      // await api.reset();

      // Reset component state
      featureState = null;
      operationResults = [];

      addLog('success', 'Demo reset complete');
      await refreshData();
    } catch (error: unknown) {
      addLog('error', `Failed to reset: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  function clearLogs() {
    logs = [];
  }

  // Helper functions for display
  function formatResult(result: unknown): string {
    if (typeof result === 'object') {
      return JSON.stringify(result, null, 2);
    }
    return String(result);
  }
</script>

<div class="backend-feature-demo">
  <div class="demo-header">
    <h2>Your Feature API Demo</h2>
    <p>Interactive demonstration of Your Feature capabilities</p>
  </div>

  <div class="demo-content">
    <!-- Control Panel -->
    <div class="control-panel">
      <div class="section">
        <h3>Operations</h3>
        <div class="button-group">
          <button on:click={performExampleOperation} disabled={isLoading}>
            Example Operation
          </button>
          <button on:click={performAnotherOperation} disabled={isLoading}>
            Another Operation
          </button>
          <button on:click={() => refreshData()} disabled={isLoading}> Refresh Data </button>
          <button on:click={resetDemo} disabled={isLoading}> Reset Demo </button>
        </div>
      </div>

      <!-- Feature State Display -->
      {#if featureState}
        <div class="section">
          <h3>Current State</h3>
          <div class="state-display">
            <pre>{formatResult(featureState)}</pre>
          </div>
        </div>
      {/if}

      <!-- Results Display -->
      {#if operationResults.length > 0}
        <div class="section">
          <h3>Results ({operationResults.length})</h3>
          <div class="results-list">
            {#each operationResults as result, index}
              <div class="result-item">
                <strong>Result {index + 1}:</strong>
                <pre>{formatResult(result)}</pre>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Console Log -->
    <div class="log-console">
      <div class="log-header">
        <h3>Console Log</h3>
        <button on:click={clearLogs}>Clear</button>
      </div>
      <div class="log-content">
        {#each logs as log}
          <div class="log-entry log-{log.type}">
            <span class="log-time">{log.timestamp}</span>
            <span class="log-message">{log.message}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
