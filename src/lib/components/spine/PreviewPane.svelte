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

  // Props using Svelte 5 runes syntax
  let {
    xhtmlContent = '',
    isTransforming = false,
    transformError = null,
    transformWarnings = [],
    executionTime = 0,
    spineItemId,
    onPreviewClick = null
  }: {
    xhtmlContent?: string;
    isTransforming?: boolean;
    transformError?: TransformError | null;
    transformWarnings?: string[];
    executionTime?: number;
    spineItemId: string;
    onPreviewClick?: ((detail: { text: string; documentPosition: number; elementType: string }) => void) | null;
  } = $props();

  // Preview configuration
  const DEVICE_PRESETS = [
    { id: 'desktop', name: 'Desktop', width: '100%', height: '100%', icon: '🖥️' },
    { id: 'iphone', name: 'iPhone', width: '375px', height: '667px', icon: '📱' },
    { id: 'iphone-plus', name: 'iPhone Plus', width: '414px', height: '736px', icon: '📱' },
    { id: 'ipad', name: 'iPad', width: '768px', height: '1024px', icon: '📱' },
    { id: 'kindle', name: 'Kindle', width: '600px', height: '800px', icon: '📚' },
  ] as const;

  // Component state
  let selectedDevice = $state('desktop');
  let showSource = $state(false);
  let previewIframe: HTMLIFrameElement;
  let previewContainer: HTMLDivElement;

  // Reactive state
  const lastUpdateTime = writable<number>(Date.now());

  // Update iframe content when XHTML changes
  $effect(() => {
    updatePreviewContent(xhtmlContent);
  });

  /**
   * Find a scroll anchor element that can be used to restore scroll position
   */
  function findScrollAnchor(iframeDoc: Document): { element: Element | null; id: string | null; offset: number } | null {
    try {
      const viewport = iframeDoc.documentElement;
      const scrollTop = viewport.scrollTop || iframeDoc.body.scrollTop;
      
      // Find element at current scroll position (center of viewport)
      const centerX = viewport.clientWidth / 2;
      const checkY = Math.min(100, viewport.clientHeight / 4); // Look near top of viewport
      const elementAtScroll = iframeDoc.elementFromPoint(centerX, checkY);
      
      if (!elementAtScroll || elementAtScroll === iframeDoc.body || elementAtScroll === viewport) {
        return { element: null, id: null, offset: scrollTop };
      }

      // Try to find an element with an ID (most reliable anchor)
      let current: Element | null = elementAtScroll;
      while (current && current !== iframeDoc.body) {
        if (current.id) {
          const elementRect = current.getBoundingClientRect();
          const offset = scrollTop - (elementRect.top + scrollTop - checkY);
          return { element: current, id: current.id, offset };
        }
        current = current.parentElement;
      }

      // Fall back to tag name + index if no ID found
      const tagName = elementAtScroll.tagName.toLowerCase();
      const siblings = Array.from(iframeDoc.querySelectorAll(tagName));
      const index = siblings.indexOf(elementAtScroll);
      
      if (index >= 0) {
        const elementRect = elementAtScroll.getBoundingClientRect();
        const offset = scrollTop - (elementRect.top + scrollTop - checkY);
        return { element: elementAtScroll, id: `${tagName}[${index}]`, offset };
      }

      return { element: null, id: null, offset: scrollTop };
    } catch (error) {
      console.warn('Failed to find scroll anchor:', error);
      return null;
    }
  }

  /**
   * Restore scroll position using anchor element or fallback to pixel position
   */
  function restoreScrollPosition(iframeDoc: Document, anchor: { element: Element | null; id: string | null; offset: number } | null, fallbackScrollTop: number): void {
    if (!anchor) {
      // Simple fallback to pixel position
      iframeDoc.documentElement.scrollTop = fallbackScrollTop;
      iframeDoc.body.scrollTop = fallbackScrollTop;
      return;
    }

    try {
      let targetElement: Element | null = null;

      // Try to find element by ID first
      if (anchor.id) {
        if (anchor.id.includes('[') && anchor.id.includes(']')) {
          // Tag name + index format
          const [tagName, indexStr] = anchor.id.split('[');
          const index = parseInt(indexStr.replace(']', ''), 10);
          const elements = iframeDoc.querySelectorAll(tagName);
          targetElement = elements[index] || null;
        } else {
          // Direct ID lookup
          targetElement = iframeDoc.getElementById(anchor.id);
        }
      }

      if (targetElement) {
        // Scroll to element with offset
        targetElement.scrollIntoView({ behavior: 'instant', block: 'start' });
        
        // Apply additional offset if needed
        if (anchor.offset !== 0) {
          const currentScroll = iframeDoc.documentElement.scrollTop || iframeDoc.body.scrollTop;
          const newScroll = Math.max(0, currentScroll + anchor.offset);
          iframeDoc.documentElement.scrollTop = newScroll;
          iframeDoc.body.scrollTop = newScroll;
        }
      } else {
        // Fallback to pixel position
        iframeDoc.documentElement.scrollTop = fallbackScrollTop;
        iframeDoc.body.scrollTop = fallbackScrollTop;
      }
    } catch (error) {
      console.warn('Failed to restore scroll position:', error);
      // Final fallback
      iframeDoc.documentElement.scrollTop = fallbackScrollTop;
      iframeDoc.body.scrollTop = fallbackScrollTop;
    }
  }

  /**
   * Update iframe with new XHTML content while preserving scroll position
   */
  function updatePreviewContent(content: string): void {
    if (!previewIframe || !content) return;

    try {
      const iframeDoc = previewIframe.contentDocument;
      if (!iframeDoc) return;

      // Save scroll position and find anchor before updating
      const scrollTop = iframeDoc.documentElement.scrollTop || iframeDoc.body.scrollTop;
      const scrollAnchor = scrollTop > 0 ? findScrollAnchor(iframeDoc) : null;

      // Update content (preserves XHTML and blob URLs)
      iframeDoc.open();
      iframeDoc.write(content);
      iframeDoc.close();

      // Re-attach event listeners and styling after content update
      requestAnimationFrame(() => {
        restoreScrollPosition(iframeDoc, scrollAnchor, scrollTop);
        setupIframeInteractivity(iframeDoc);
      });

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
   * Estimate the position of an element within the source document
   */
  function estimateDocumentPosition(element: Element): number {
    const iframeDoc = previewIframe?.contentDocument;
    if (!iframeDoc) return 0;

    try {
      // Create a tree walker to traverse all text nodes before the target element
      const walker = iframeDoc.createTreeWalker(
        iframeDoc.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let position = 0;
      let node: Node | null;
      
      while ((node = walker.nextNode())) {
        // Stop if we've reached our target element
        if (element.contains(node)) {
          break;
        }
        position += (node.textContent?.length || 0);
      }

      return position;
    } catch (error) {
      console.warn('Failed to estimate document position:', error);
      return 0;
    }
  }

  /**
   * Handle clicks on elements in the preview iframe
   */
  function handlePreviewClick(event: MouseEvent): void {
    if (!onPreviewClick) return;

    const target = event.target as Element;
    if (!target) return;

    // Find the best text-containing element
    const textElement = target.closest('p, h1, h2, h3, h4, h5, h6, div, span, li, blockquote, td, th') || target;
    const clickedText = textElement.textContent?.trim();

    // Skip if no meaningful text content (increased minimum length)
    if (!clickedText || clickedText.length < 8) return;

    // Skip if text is too long (likely not a good match target)
    if (clickedText.length > 500) return;

    try {
      const documentPosition = estimateDocumentPosition(textElement);
      const elementType = textElement.tagName.toLowerCase();

      onPreviewClick({
        text: clickedText,
        documentPosition,
        elementType
      });
    } catch (error) {
      console.warn('Failed to handle preview click:', error);
    }
  }

  /**
   * Set up iframe interactivity (event listeners and styling)
   * Called both on initial load and after content updates
   */
  function setupIframeInteractivity(iframeDoc: Document): void {
    // Add click event listener to the iframe document
    iframeDoc.addEventListener('click', handlePreviewClick);

    // Add any global styles or scripts for preview enhancement
    const style = iframeDoc.createElement('style');
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

      /* Indicate clickable text elements */
      p, h1, h2, h3, h4, h5, h6, div, span, li, blockquote, td, th {
        cursor: pointer;
      }

      /* Visual feedback on hover */
      p:hover, h1:hover, h2:hover, h3:hover, h4:hover, h5:hover, h6:hover, 
      div:hover, span:hover, li:hover, blockquote:hover, td:hover, th:hover {
        background-color: rgba(59, 130, 246, 0.1);
        outline: 1px solid rgba(59, 130, 246, 0.3);
        outline-offset: 1px;
      }
    `;
    iframeDoc.head.appendChild(style);
  }

  /**
   * Handle iframe load event
   */
  function handleIframeLoad(): void {
    if (previewIframe?.contentDocument) {
      setupIframeInteractivity(previewIframe.contentDocument);
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
        <pre class="source-code" dir="ltr">{xhtmlContent || '<!-- No content generated yet -->'}</pre>
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
