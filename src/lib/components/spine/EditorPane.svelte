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
  import type { TransformError } from '$lib/types/spine-editor.js';
  import type { TextEditorStore } from '$lib/stores/index.js';
  import type { ContentService } from '$lib/services/content/content.service.js';
  import { t } from '$lib/i18n';

  // Props using Svelte 5 runes syntax
  let {
    transformError = null,
    transformWarnings = [],
    isTransforming = false,
    executionTime = 0,
    availableFiles1 = [],
    availableFiles2 = [],
    editorMode = 'single',
    pane1SelectedFile = '',
    pane2SelectedFile = '',
    pane1Error = $bindable(),
    pane2Error = $bindable(),
    pane1FileStore = null,
    pane2FileStore = null,
    contentService,
    onPaneToggle,
    onFileSelect,
    onContentChange,
    onForceUpdate,
    onPreviewClick = null,
  }: {
    transformError?: TransformError | null;
    transformWarnings?: string[];
    isTransforming?: boolean;
    executionTime?: number;
    availableFiles1?: Array<{
      value: string;
      label: string;
      path: string;
      type: 'text' | 'css' | 'javascript' | 'transform';
    }>;
    availableFiles2?: Array<{
      value: string;
      label: string;
      path: string;
      type: 'text' | 'css' | 'javascript' | 'transform';
    }>;
    editorMode?: 'single' | 'dual';
    pane1SelectedFile?: string;
    pane2SelectedFile?: string;
    pane1Error?: string | null;
    pane2Error?: string | null;
    pane1FileStore?: TextEditorStore | null;
    pane2FileStore?: TextEditorStore | null;
    contentService: ContentService;
    onPaneToggle?: () => void;
    onFileSelect?: (pane: 1 | 2, filePath: string, fileType: string) => void;
    onContentChange?: (pane: 1 | 2, content: string) => void;
    onForceUpdate?: () => void;
    onPreviewClick?: ((detail: { text: string; documentPosition: number; elementType: string }) => void) | null;
  } = $props();

  /**
   * Toggle between single and dual pane mode
   */
  function togglePaneMode(): void {
    onPaneToggle?.();
  }

  /**
   * Handle file selection change
   */
  function handleFileSelect(pane: 1 | 2, event: Event): void {
    const target = event.target as HTMLSelectElement;

    // Use the appropriate available files array for each pane
    const availableFiles = pane === 1 ? availableFiles1 : availableFiles2;
    const selectedFile = availableFiles.find(f => f.value === target.value);

    if (selectedFile) {
      onFileSelect?.(pane, selectedFile.path, selectedFile.type);
    }
  }

  /**
   * Force immediate preview update
   */
  function handleForceUpdate(): void {
    onForceUpdate?.();
  }

  /**
   * Handle pane 1 content input with validation-first logic
   */
  function handlePane1Input(event: Event): void {
    const content = (event.target as HTMLTextAreaElement).value;

    if (!pane1FileStore) {
      console.warn('🚫 No file store available for input in pane 1');
      return;
    }

    // Validation-first: validate before persistence
    const validationError = contentService.validateFileContent(content, pane1SelectedFile);

    if (validationError) {
      pane1Error = validationError;
      // Block persistence - store keeps last valid content
      return;
    } else {
      pane1Error = null;
    }

    // Only persist valid content (or non-validated content)
    pane1FileStore.updateContent(content);
  }

  /**
   * Handle pane 2 content input with validation-first logic
   */
  function handlePane2Input(event: Event): void {
    const content = (event.target as HTMLTextAreaElement).value;

    if (!pane2FileStore) {
      console.warn('🚫 No file store available for input in pane 2');
      return;
    }

    // Validation-first: validate before persistence
    const validationError = contentService.validateFileContent(content, pane2SelectedFile);

    if (validationError) {
      pane2Error = validationError;
      // Block persistence - store keeps last valid content
      return;
    } else {
      pane2Error = null;
    }

    // Only persist valid content (or non-validated content)
    pane2FileStore.updateContent(content);
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
   * Determine if file type should use LTR direction (for code syntax)
   */
  function shouldUseLtrDirection(fileType: string): boolean {
    return fileType.includes('css') || 
           fileType.includes('javascript') || 
           fileType.includes('js') || 
           fileType.includes('transform');
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

  // Textarea references for navigation
  let pane1Textarea: HTMLTextAreaElement | undefined = $state();
  let pane2Textarea: HTMLTextAreaElement | undefined = $state();

  /**
   * Normalize text for better matching by removing/standardizing punctuation and whitespace
   */
  function normalizeText(text: string): string {
    // Use character code approach for apostrophe normalization
    let result = text.trim();
    
    // Convert curly quotes to straight quotes using character codes
    result = result.split('').map(char => {
      const code = char.charCodeAt(0);
      if (code === 8217 || code === 8216) { // ' and ' (apostrophes)
        return "'";
      }
      if (code === 8221 || code === 8220) { // " and " (double quotes)
        return '"';
      }
      return char;
    }).join('');
    
    // Normalize other quote variants
    result = result.replace(/[""„‚]/g, '"');
    
    // Normalize whitespace
    result = result.replace(/\s+/g, ' ');
    
    return result;
  }

  /**
   * Find and select text in the editor based on preview click
   */
  function findAndSelectText(detail: { text: string; documentPosition: number; elementType: string }): void {
    const { text } = detail;
    
    // Try both panes to find content
    let textarea: HTMLTextAreaElement | null = null;
    let content = '';
    
    // Check pane 1 first
    if (pane1FileStore && pane1SelectedFile && pane1Textarea && $pane1FileStore?.content) {
      textarea = pane1Textarea;
      content = $pane1FileStore.content;
    }
    // Then check pane 2
    else if (pane2FileStore && pane2SelectedFile && pane2Textarea && $pane2FileStore?.content) {
      textarea = pane2Textarea;
      content = $pane2FileStore.content;
    }
    
    if (!textarea || !content) return;

    const searchText = text.trim();
    
    
    // Normalize the preview text (convert curly quotes to straight quotes)
    const normalizedSearchText = normalizeText(searchText);
    
    // Try exact match with normalized preview text (case-insensitive)
    const contentLower = content.toLowerCase();
    const normalizedSearchLower = normalizedSearchText.toLowerCase();
    
    let index = contentLower.indexOf(normalizedSearchLower);
    if (index !== -1) {
      selectTextRange(textarea, index, index + normalizedSearchText.length);
      return;
    }

    // If normalized search fails and text is substantial, try exact original search as fallback
    if (searchText.length >= 8) {
      const searchLower = searchText.toLowerCase();
      index = contentLower.indexOf(searchLower);
      if (index !== -1) {
        selectTextRange(textarea, index, index + searchText.length);
        return;
      }
    }

    // No good match found - fail silently rather than select wrong text
  }

  /**
   * Select text range in textarea and scroll to it
   */
  function selectTextRange(textarea: HTMLTextAreaElement, start: number, end: number): void {
    // Focus the textarea
    textarea.focus();
    
    // Set selection
    textarea.setSelectionRange(start, end);
    
    // Scroll to the selection
    const lines = textarea.value.substring(0, start).split('\n');
    const targetLine = lines.length - 1;
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const scrollTop = targetLine * lineHeight;
    
    // Scroll to make the selection visible
    textarea.scrollTop = Math.max(0, scrollTop - textarea.clientHeight / 2);
  }

  // Export the findAndSelectText function for parent component access
  export { findAndSelectText };
</script>

<div class="editor-pane-container">
  <!-- Header with pane toggle and status -->
  <div class="editor-header">
    <div class="editor-controls">
      <button
        type="button"
        class="pane-toggle-btn"
        onclick={togglePaneMode}
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
      {:else if transformError && transformError.stage !== 'syntax-validation'}
        <div class="status-indicator error" title="Transform error">
          <span class="status-icon">⚠️</span>
          <span>Error</span>
        </div>
      {:else if pane1Error || pane2Error}
        <div class="status-indicator error" title="Syntax error prevents transform">
          <span class="status-icon">⚠️</span>
          <span>Syntax Error</span>
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
        onclick={handleForceUpdate}
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
              onchange={e => handleFileSelect(2, e)}
              aria-label="Select file for pane 2"
            >
              <option value="" disabled>Select file...</option>
              {#each availableFiles2 as file}
                <option value={file.value}>{file.label}</option>
              {/each}
            </select>
          </div>

          <div class="textarea-container">
            <textarea
              bind:this={pane2Textarea}
              class="content-textarea {getSyntaxClass(pane2SelectedFile)}"
              class:has-error={pane2Error}
              value={pane2FileStore ? $pane2FileStore?.content || '' : ''}
              placeholder={getPlaceholder(pane2SelectedFile)}
              oninput={handlePane2Input}
              spellcheck={pane2SelectedFile === 'text'}
              autocomplete="off"
              autocapitalize="off"
              aria-label="Pane 2 content"
              dir={shouldUseLtrDirection(pane2SelectedFile) ? 'ltr' : undefined}
            ></textarea>
            {#if pane2Error}
              <div class="pane-error-overlay">
                <span class="error-icon" aria-hidden="true">⚠️</span>
                <span class="error-message">{pane2Error}</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Pane 1 (always visible, bottom when in dual mode) -->
      <div class="editor-pane pane-1">
        <div class="pane-header">
          <select
            class="file-selector"
            value={pane1SelectedFile}
            onchange={e => handleFileSelect(1, e)}
            aria-label="Select file for pane 1"
          >
            <option value="" disabled>Select file...</option>
            {#each availableFiles1 as file}
              <option value={file.value}>{file.label}</option>
            {/each}
          </select>
        </div>

        <div class="textarea-container">
          <textarea
            bind:this={pane1Textarea}
            class="content-textarea {getSyntaxClass(pane1SelectedFile)}"
            class:has-error={pane1Error}
            value={pane1FileStore ? $pane1FileStore?.content || '' : ''}
            placeholder={getPlaceholder(pane1SelectedFile)}
            oninput={handlePane1Input}
            spellcheck={pane1SelectedFile === 'text'}
            autocomplete="off"
            autocapitalize="off"
            aria-label="Pane 1 content"
            dir={shouldUseLtrDirection(pane1SelectedFile) ? 'ltr' : undefined}
          ></textarea>
          {#if pane1Error}
            <div class="pane-error-overlay">
              <span class="error-icon" aria-hidden="true">⚠️</span>
              <span class="error-message">{pane1Error}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Global error display (suppress for pane-specific syntax errors) -->
  {#if transformError && transformError.stage !== 'syntax-validation'}
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
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
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
    position: relative; /* For absolute positioning of error overlay */
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

  .content-textarea.has-error {
    border-color: var(--color-error-border);
  }

  .content-textarea.has-error:focus {
    border-color: var(--color-error-border);
    box-shadow: 0 0 0 var(--focus-ring-width) var(--color-error-text);
  }

  .pane-error-overlay {
    position: absolute;
    bottom: var(--space-3);
    left: var(--space-3);
    right: var(--space-3);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-error-bg);
    border: 1px solid var(--color-error-border);
    border-radius: var(--radius-sm);
    color: var(--color-error-text);
    font-size: var(--text-sm);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 10;
  }

  .pane-error-overlay .error-icon {
    font-size: var(--text-base);
    flex-shrink: 0;
  }

  .pane-error-overlay .error-message {
    flex: 1;
    font-family: var(--font-mono);
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
