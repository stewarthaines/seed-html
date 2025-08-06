<!--
  Editor Pane Component
  
  Left pane of the spine editor providing stacked editor panes with file dropdowns
  for editing different file types (text, CSS, JavaScript, transform scripts).
  
  Features:
  - Single/dual pane mode with toggle button
  - File dropdown selection for each pane
  - Metadata editor with chapter configuration
  - Transform status and error display
  - Manual preview update trigger
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { 
    TransformError 
  } from '$lib/types/spine-editor.js';
  import { t } from '$lib/i18n';
  
  // Props
  export let transformError: TransformError | null = null;
  export let transformWarnings: string[] = [];
  export let isTransforming: boolean = false;
  export let executionTime: number = 0;
  export let availableFiles: Array<{ value: string; label: string; path: string; type: 'text' | 'css' | 'javascript' | 'transform' }> = [];
  
  // Controlled component props - parent owns all state
  export let editorMode: 'single' | 'dual' = 'single';
  export let pane1SelectedFile: string = '';
  export let pane2SelectedFile: string = '';
  export let pane1Content: string = '';
  export let pane2Content: string = '';
  
  const dispatch = createEventDispatcher<{
    paneToggle: void;
    fileSelect: { pane: 1 | 2; filePath: string; fileType: string };
    contentChange: { pane: 1 | 2; content: string };
    forceUpdate: void;
  }>();
  
  /**
   * Toggle between single and dual pane mode
   */
  function togglePaneMode(): void {
    dispatch('paneToggle');
  }
  
  /**
   * Handle file selection change
   */
  function handleFileSelect(pane: 1 | 2, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const selectedFile = availableFiles.find(f => f.value === target.value);
    
    if (selectedFile) {
      dispatch('fileSelect', { 
        pane, 
        filePath: selectedFile.path, 
        fileType: selectedFile.type 
      });
    }
  }
  
  /**
   * Handle content changes in textarea
   */
  function handleContentInput(pane: 1 | 2, event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    
    dispatch('contentChange', {
      pane,
      content: target.value
    });
  }
  
  
  /**
   * Force immediate preview update
   */
  function handleForceUpdate(): void {
    dispatch('forceUpdate');
  }
  
  /**
   * Get syntax highlighting class for textarea
   */
  function getSyntaxClass(fileType: string): string {
    if (fileType.includes('css')) return 'syntax-css';
    if (fileType.includes('javascript') || fileType.includes('js')) return 'syntax-js';
    if (fileType.includes('transform')) return 'syntax-js';
    return 'syntax-text';
  }
  
  /**
   * Get appropriate placeholder text
   */
  function getPlaceholder(fileType: string): string {
    if (fileType === 'text') {
      return 'Enter your chapter content here...\n\nThis will be transformed to XHTML using your configured text transform script.';
    }
    if (fileType.includes('css')) {
      return '/* Stylesheet content */\n\nbody {\n  /* Your styles here */\n}';
    }
    if (fileType.includes('javascript') || fileType.includes('js')) {
      return '// JavaScript content\n\n(function() {\n  // Your code here\n})();';
    }
    if (fileType.includes('transform')) {
      return '// Transform script\n\nfunction transform(input) {\n  // Your transform logic here\n  return input;\n}';
    }
    return '';
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
</script>

<div class="editor-pane-container">
  <!-- Header with pane toggle and status -->
  <div class="editor-header">
    <div class="editor-controls">
      <button
        type="button"
        class="pane-toggle-btn"
        on:click={togglePaneMode}
        title={editorMode === 'single' ? 'Add second editor pane' : 'Switch to single pane'}
      >
        <span class="toggle-icon" aria-hidden="true">
          {editorMode === 'single' ? '⊞' : '⊟'}
        </span>
        <span class="toggle-label">
          {editorMode === 'single' ? $t('Add Pane') : $t('Single Pane')}
        </span>
      </button>
    </div>
    
    <div class="editor-status">
      {#if isTransforming}
        <div class="status-indicator transforming" title="Transform in progress">
          <div class="status-spinner"></div>
          <span>Transforming...</span>
        </div>
      {:else if transformError}
        <div class="status-indicator error" title="Transform error">
          <span class="status-icon">⚠️</span>
          <span>Error</span>
        </div>
      {:else if transformWarnings.length > 0}
        <div class="status-indicator warning" title={`${transformWarnings.length} warnings`}>
          <span class="status-icon">⚠️</span>
          <span>{transformWarnings.length} warnings</span>
        </div>
      {:else}
        <div class="status-indicator success" title="Transform successful">
          <span class="status-icon">✅</span>
          <span>{formatExecutionTime(executionTime)}</span>
        </div>
      {/if}
      
      <button
        type="button"
        class="force-update-btn"
        on:click={handleForceUpdate}
        disabled={isTransforming}
        title="Force immediate preview update"
      >
        🔄
      </button>
    </div>
  </div>
  
  <!-- Stacked editor panes -->
  <div class="editor-content">
    <div class="editor-panes" class:dual-mode={editorMode === 'dual'}>
      <!-- Pane 2 (top when in dual mode) -->
      {#if editorMode === 'dual'}
        <div class="editor-pane pane-2">
          <div class="pane-header">
            <select
              class="file-selector"
              value={pane2SelectedFile}
              on:change={(e) => handleFileSelect(2, e)}
              aria-label="Select file for pane 2"
            >
              <option value="" disabled>Select file...</option>
              {#each availableFiles as file}
                <option value={file.value}>{file.label}</option>
              {/each}
            </select>
          </div>
          
          <div class="textarea-container">
            <textarea
              class="content-textarea {getSyntaxClass(pane2SelectedFile)}"
              value={pane2Content}
              placeholder={getPlaceholder(pane2SelectedFile)}
              on:input={(e) => handleContentInput(2, e)}
              spellcheck={pane2SelectedFile === 'text'}
              autocomplete="off"
              autocapitalize="off"
              aria-label="Pane 2 content"
            ></textarea>
          </div>
        </div>
      {/if}
      
      <!-- Pane 1 (always visible, bottom when in dual mode) -->
      <div class="editor-pane pane-1">
        <div class="pane-header">
          <select
            class="file-selector"
            value={pane1SelectedFile}
            on:change={(e) => handleFileSelect(1, e)}
            aria-label="Select file for pane 1"
          >
            <option value="" disabled>Select file...</option>
            {#each availableFiles as file}
              <option value={file.value}>{file.label}</option>
            {/each}
          </select>
        </div>
        
        <div class="textarea-container">
          <textarea
            class="content-textarea {getSyntaxClass(pane1SelectedFile)}"
            value={pane1Content}
            placeholder={getPlaceholder(pane1SelectedFile)}
            on:input={(e) => handleContentInput(1, e)}
            spellcheck={pane1SelectedFile === 'text'}
            autocomplete="off"
            autocapitalize="off"
            aria-label="Pane 1 content"
          ></textarea>
        </div>
      </div>
    </div>
  </div>
  
  
  <!-- Error display -->
  {#if transformError}
    <div class="error-display">
      <div class="error-header">
        <span class="error-icon" aria-hidden="true">🚨</span>
        <strong>Transform Error ({transformError.stage})</strong>
      </div>
      <div class="error-message">{transformError.message}</div>
      {#if transformError.stack}
        <details class="error-stack">
          <summary>Stack Trace</summary>
          <pre>{transformError.stack}</pre>
        </details>
      {/if}
    </div>
  {/if}
  
  <!-- Warnings display -->
  {#if transformWarnings.length > 0}
    <div class="warnings-display">
      <div class="warnings-header">
        <span class="warning-icon" aria-hidden="true">⚠️</span>
        <strong>{transformWarnings.length} Warnings</strong>
      </div>
      <ul class="warnings-list">
        {#each transformWarnings as warning}
          <li>{warning}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .editor-pane-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-secondary);
  }
  
  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2);
    border-bottom: 1px solid var(--color-border-default);
    background: var(--color-bg-tertiary);
  }
  
  .editor-controls {
    display: flex;
    gap: var(--space-2);
  }
  
  .pane-toggle-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }
  
  .pane-toggle-btn:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent-primary);
  }
  
  .pane-toggle-btn:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }
  
  .toggle-icon {
    font-size: var(--text-base);
    font-weight: bold;
  }
  
  .toggle-label {
    font-size: var(--text-sm);
  }
  
  .editor-status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
  }
  
  .status-indicator.transforming {
    background: var(--color-info-bg);
    color: var(--color-info-text);
  }
  
  .status-indicator.error {
    background: var(--color-error-bg);
    color: var(--color-error-text);
  }
  
  .status-indicator.warning {
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
  }
  
  .status-indicator.success {
    background: var(--color-success-bg);
    color: var(--color-success-text);
  }
  
  .status-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
    border-top: 2px solid transparent;
    border-radius: 50%;
    animation: spin var(--duration-normal) linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .force-update-btn {
    padding: var(--space-1);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    cursor: pointer;
    font-size: var(--text-sm);
    transition: all var(--duration-fast) ease;
  }
  
  .force-update-btn:hover:not(:disabled) {
    background: var(--color-bg-hover);
  }
  
  .force-update-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .editor-content {
    flex: 1;
    overflow: hidden;
  }
  
  .editor-panes {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .editor-panes.dual-mode {
    /* In dual mode, stack pane 2 above pane 1 */
  }
  
  .editor-pane {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0; /* Allow flex shrinking */
  }
  
  .editor-panes.dual-mode .editor-pane {
    /* Equal height distribution in dual mode */
    flex: 1;
  }
  
  .pane-2 {
    border-bottom: 1px solid var(--color-border-default);
  }
  
  .pane-header {
    padding: var(--space-2);
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border-default);
  }
  
  .file-selector {
    width: 100%;
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }
  
  .file-selector:focus {
    outline: none;
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 0 var(--focus-ring-width) var(--color-focus);
  }
  
  .textarea-container {
    flex: 1;
    padding: var(--space-2);
    overflow: hidden;
  }
  
  .content-textarea {
    width: 100%;
    height: 100%;
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    resize: none;
    outline: none;
  }
  
  .content-textarea:focus {
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 0 var(--focus-ring-width) var(--color-focus);
  }
  
  
  .error-display,
  .warnings-display {
    margin: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-md);
  }
  
  .error-display {
    background: var(--color-error-bg);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
  }
  
  .warnings-display {
    background: var(--color-warning-bg);
    border: 1px solid var(--color-warning-border);
    color: var(--color-warning-text);
  }
  
  .error-header,
  .warnings-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  
  .error-message {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }
  
  .error-stack {
    margin-top: var(--space-2);
  }
  
  .error-stack pre {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    overflow-x: auto;
    margin: var(--space-1) 0 0;
  }
  
  .warnings-list {
    margin: 0;
    padding-left: var(--space-4);
    font-size: var(--text-sm);
  }
  
  .warnings-list li {
    margin-bottom: var(--space-1);
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .status-spinner {
      animation: none;
    }
    
    .pane-toggle-btn,
    .force-update-btn {
      transition: none;
    }
  }
</style>