<!--
  Preview Pane Component

  Right pane of the spine editor displaying real-time XHTML preview
  with transform status, error handling, and device simulation options.

  Features:
  - Real-time XHTML preview in iframe
  - Device simulation (iPhone, iPad, etc.)
  - Transform status and error display
  - Source view toggle for debugging
  - Performance metrics display
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import type { TransformError } from '$lib/types/spine-editor.js';
  import { t } from '$lib/i18n';

  // Props
  export let xhtmlContent: string = '';
  export let isTransforming: boolean = false;
  export let transformError: TransformError | null = null;
  export let transformWarnings: string[] = [];
  export let executionTime: number = 0;
  export let spineItemId: string;

  // Preview configuration
  const DEVICE_PRESETS = [
    { id: 'desktop', name: 'Desktop', width: '100%', height: '100%', icon: '🖥️' },
    { id: 'iphone', name: 'iPhone', width: '375px', height: '667px', icon: '📱' },
    { id: 'iphone-plus', name: 'iPhone Plus', width: '414px', height: '736px', icon: '📱' },
    { id: 'ipad', name: 'iPad', width: '768px', height: '1024px', icon: '📱' },
    { id: 'kindle', name: 'Kindle', width: '600px', height: '800px', icon: '📚' },
  ] as const;

  // Component state
  let selectedDevice = 'desktop';
  let showSource = false;
  let previewIframe: HTMLIFrameElement;
  let previewContainer: HTMLDivElement;

  // Reactive state
  const lastUpdateTime = writable<number>(Date.now());

  // Update iframe content when XHTML changes
  $: updatePreviewContent(xhtmlContent);

  /**
   * Update iframe with new XHTML content
   */
  function updatePreviewContent(content: string): void {
    if (!previewIframe || !content) return;

    try {
      const iframeDoc = previewIframe.contentDocument;
      if (!iframeDoc) return;

      // Clear existing content
      iframeDoc.open();
      iframeDoc.write(content);
      iframeDoc.close();

      lastUpdateTime.set(Date.now());
    } catch (error) {
      console.error('Failed to update preview content:', error);
    }
  }

  /**
   * Handle device preset selection
   */
  function handleDeviceChange(deviceId: string): void {
    selectedDevice = deviceId;
    const device = DEVICE_PRESETS.find(d => d.id === deviceId);

    if (device && previewContainer) {
      if (device.id === 'desktop') {
        previewContainer.style.width = '100%';
        previewContainer.style.height = '100%';
        previewContainer.style.maxWidth = 'none';
        previewContainer.style.maxHeight = 'none';
      } else {
        previewContainer.style.width = device.width;
        previewContainer.style.height = device.height;
        previewContainer.style.maxWidth = device.width;
        previewContainer.style.maxHeight = device.height;
      }
    }
  }

  /**
   * Toggle source view
   */
  function toggleSourceView(): void {
    showSource = !showSource;
    if (!showSource) {
      setTimeout(() => {
        updatePreviewContent(xhtmlContent);
      }, 0);
    }
  }

  /**
   * Format execution time for display
   */
  function formatExecutionTime(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  }

  /**
   * Format timestamp for display
   */
  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  /**
   * Handle iframe load event
   */
  function handleIframeLoad(): void {
    // Apply any post-load styling or setup if needed
    if (previewIframe?.contentDocument) {
      // Add any global styles or scripts for preview enhancement
      const style = previewIframe.contentDocument.createElement('style');
      style.textContent = `
        body {
          margin: 0;
          padding: 1rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
        }

        /* Ensure images are responsive */
        img {
          max-width: 100%;
          height: auto;
        }

        /* Add some visual feedback for empty content */
        body:empty::before {
          content: 'No content to preview';
          color: #666;
          font-style: italic;
          display: block;
          text-align: center;
          padding: 2rem;
        }
      `;
      previewIframe.contentDocument.head.appendChild(style);
    }
  }

  /**
   * Copy XHTML source to clipboard
   */
  async function copySourceToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(xhtmlContent);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }

  /**
   * Download XHTML as file
   */
  function downloadXHTML(): void {
    const blob = new Blob([xhtmlContent], { type: 'application/xhtml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${spineItemId}.xhtml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  onMount(() => {
    // Initialize with default device
    handleDeviceChange(selectedDevice);
  });
</script>

<div class="preview-pane-container">
  <!-- Header with controls -->
  <div class="preview-header">
    <div class="preview-title">
      <span class="preview-icon" aria-hidden="true">👁️</span>
      <span>Preview</span>
      {#if executionTime > 0}
        <span class="preview-timing">({formatExecutionTime(executionTime)})</span>
      {/if}
    </div>

    <div class="preview-controls">
      <!-- Device selector -->
      <select
        class="device-selector"
        bind:value={selectedDevice}
        on:change={e => handleDeviceChange((e.target as HTMLSelectElement).value)}
        aria-label="Select device preset"
      >
        {#each DEVICE_PRESETS as device}
          <option value={device.id}>
            {device.icon}
            {device.name}
          </option>
        {/each}
      </select>

      <!-- View toggle -->
      <button
        type="button"
        class="view-toggle"
        class:active={showSource}
        on:click={toggleSourceView}
        title="Toggle source view"
        aria-pressed={showSource}
      >
        {showSource ? '👁️' : '📄'}
      </button>
    </div>
  </div>

  <!-- Transform status -->
  {#if isTransforming}
    <div class="transform-status transforming">
      <div class="status-spinner"></div>
      <span>Transforming content...</span>
    </div>
  {:else if transformError}
    <div class="transform-status error">
      <span class="status-icon">🚨</span>
      <span>Transform failed: {transformError.message}</span>
    </div>
  {:else if transformWarnings.length > 0}
    <div class="transform-status warning">
      <span class="status-icon">⚠️</span>
      <span>{transformWarnings.length} warnings</span>
    </div>
  {/if}

  <!-- Preview content -->
  <div class="preview-content">
    {#if showSource}
      <!-- Source view -->
      <div class="source-view">
        <pre class="source-code">{xhtmlContent || '<!-- No content generated yet -->'}</pre>
      </div>
    {:else}
      <!-- Live preview -->
      <div class="preview-viewport">
        <div
          class="preview-frame-container"
          class:device-frame={selectedDevice !== 'desktop'}
          bind:this={previewContainer}
        >
          {#if transformError}
            <div class="preview-error">
              <div class="error-content">
                <h3>Transform Error</h3>
                <p><strong>Stage:</strong> {transformError.stage}</p>
                <p><strong>Message:</strong> {transformError.message}</p>
                {#if transformError.stack}
                  <details>
                    <summary>Stack Trace</summary>
                    <pre class="error-stack">{transformError.stack}</pre>
                  </details>
                {/if}
              </div>
            </div>
          {:else if xhtmlContent}
            <iframe
              bind:this={previewIframe}
              class="preview-iframe"
              title="XHTML Preview"
              on:load={handleIframeLoad}
            ></iframe>
          {:else}
            <div class="preview-empty">
              <div class="empty-content">
                <span class="empty-icon" aria-hidden="true">📝</span>
                <h3>No Content</h3>
                <p>Start typing in the editor to see your XHTML preview here.</p>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Footer with meta info -->
  <div class="preview-footer">
    <div class="meta-info">
      {#if $lastUpdateTime}
        <span class="update-time">Updated: {formatTimestamp($lastUpdateTime)}</span>
      {/if}

      {#if xhtmlContent}
        <span class="content-size">{Math.round(xhtmlContent.length / 1024)}KB</span>
      {/if}

      {#if transformWarnings.length > 0}
        <span class="warning-count">{transformWarnings.length} warnings</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .preview-pane-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-secondary);
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2);
    border-bottom: 1px solid var(--color-border-default);
    background: var(--color-bg-tertiary);
  }

  .preview-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
  }

  .preview-timing {
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
    font-weight: var(--font-normal);
  }

  .preview-controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .device-selector {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-xs);
    cursor: pointer;
  }

  .device-selector:focus {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  .view-toggle {
    padding: var(--space-1);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    cursor: pointer;
    font-size: var(--text-sm);
    transition: all var(--duration-fast) ease;
  }

  .view-toggle:hover {
    background: var(--color-bg-hover);
  }

  .view-toggle.active {
    background: var(--color-accent-primary);
    color: var(--color-accent-contrast);
    border-color: var(--color-accent-primary);
  }

  .transform-status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }

  .transform-status.transforming {
    background: var(--color-info-bg);
    color: var(--color-info-text);
  }

  .transform-status.error {
    background: var(--color-error-bg);
    color: var(--color-error-text);
  }

  .transform-status.warning {
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
  }

  .status-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-top: 2px solid transparent;
    border-radius: 50%;
    animation: spin var(--duration-normal) linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .preview-content {
    flex: 1;
    overflow: hidden;
    background: var(--color-bg-primary);
  }

  .source-view {
    height: 100%;
    overflow: auto;
  }

  .source-code {
    margin: 0;
    padding: var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--leading-relaxed);
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .preview-viewport {
    height: 100%;
    overflow: auto;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: var(--space-2);
  }

  .preview-frame-container {
    width: 100%;
    height: 100%;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: white;
    position: relative;
  }

  .preview-frame-container.device-frame {
    box-shadow: var(--shadow-lg);
    border: 2px solid var(--color-border-strong);
  }

  .preview-iframe {
    width: 100%;
    height: 100%;
    border: none;
    background: white;
  }

  .preview-error,
  .preview-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--space-4);
  }

  .error-content,
  .empty-content {
    text-align: center;
    max-width: 400px;
  }

  .error-content {
    color: var(--color-error-text);
  }

  .error-content h3 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-lg);
  }

  .error-content p {
    margin: var(--space-1) 0;
    font-size: var(--text-sm);
  }

  .error-stack {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-align: left;
    background: var(--color-bg-secondary);
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    margin-top: var(--space-2);
    overflow-x: auto;
  }

  .empty-content {
    color: var(--color-text-secondary);
  }

  .empty-icon {
    font-size: var(--text-4xl);
    display: block;
    margin-bottom: var(--space-3);
  }

  .empty-content h3 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-lg);
    color: var(--color-text-primary);
  }

  .empty-content p {
    margin: 0;
    font-size: var(--text-sm);
  }

  .preview-footer {
    padding: var(--space-2);
    border-top: 1px solid var(--color-border-default);
    background: var(--color-bg-tertiary);
  }

  .meta-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
  }

  .meta-info > span {
    margin-right: var(--space-3);
  }

  .meta-info > span:last-child {
    margin-right: 0;
  }

  .warning-count {
    color: var(--color-warning-text);
    background: var(--color-warning-bg);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .status-spinner {
      animation: none;
    }

    .view-toggle {
      transition: none;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .preview-frame-container {
      border: 2px solid var(--color-forced-border);
    }
  }
</style>
