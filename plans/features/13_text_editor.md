# 13. Text Editor

## Overview

Provides a flexible editor pane system supporting single or dual-pane editing of text sources, CSS, and JavaScript files with validation, synchronized scrolling, and real-time preview updates.

## Requirements

- Single/dual pane iframe-based editor with configurable layout
- Source file selection from current spine item and manifest resources
- Real-time content validation for CSS and JavaScript
- Line-numbered textarea with synchronized scrolling
- Debounced change event handling with validation
- Auto-save functionality with conflict resolution
- Per-pane error display with line number references

## Dependencies

- **#12 Transform Pipeline** - for converting text to preview
- **#04 Workspace & OPF Manager** - for manifest file listings
- **#05 Blob URL Manager** - for preview URL generation

## Technical Approach

- Flexible pane system with configurable single/dual iframe layout
- Source dropdown populated from spine item text + manifest CSS/JS files
- Real-time syntax validation for CSS and JavaScript content
- Line-numbered editor with synchronized scrolling and font consistency
- Debounced change events with validation pipeline
- Per-pane error panels with parse error details and line numbers
- Session persistence for user layout preferences
- Auto-save with conflict resolution and validation gates

## API Design

```typescript
interface EditorPane {
  // Pane management
  loadFile(filePath: string): Promise<void>;
  saveContent(): Promise<boolean>;
  getContent(): string;
  setContent(content: string): void;
  getFileType(): 'text' | 'css' | 'javascript';

  // Validation
  validateContent(): ValidationResult;
  hasValidContent(): boolean;
  getValidationErrors(): ParseError[];

  // Editor state
  focus(): void;
  blur(): void;
  setReadOnly(readOnly: boolean): void;
  getCursorPosition(): { line: number; column: number };

  // Events
  onContentChange(callback: (content: string, isValid: boolean) => void): () => void;
  onValidationChange(callback: (errors: ParseError[]) => void): () => void;
}

interface TextEditor {
  // Pane configuration
  setPaneMode(mode: 'single' | 'dual'): void;
  setSplitOrientation(orientation: 'horizontal' | 'vertical'): void;
  getPaneMode(): 'single' | 'dual';
  getSplitOrientation(): 'horizontal' | 'vertical';

  // File management
  loadSpineItem(spineItemId: string): Promise<void>;
  getAvailableFiles(): ManifestFile[];
  getSelectedFiles(): { pane1?: string; pane2?: string };
  setFileForPane(paneIndex: 1 | 2, filePath: string): Promise<void>;

  // Editor access
  getPane(index: 1 | 2): EditorPane | null;
  getPrimaryPane(): EditorPane;
  getSecondaryPane(): EditorPane | null;

  // Auto-save
  enableAutoSave(interval?: number): void;
  disableAutoSave(): void;
  getAutoSaveStatus(): AutoSaveStatus;

  // Session persistence
  saveLayoutPreferences(): void;
  loadLayoutPreferences(): void;

  // Events
  onPreviewUpdate(callback: (hasValidChanges: boolean) => void): () => void;
  onLayoutChange(callback: (mode: PaneMode, orientation: SplitOrientation) => void): () => void;
}

interface ValidationResult {
  isValid: boolean;
  errors: ParseError[];
  warnings?: ParseWarning[];
}

interface ParseError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
  source: string;
}

interface ManifestFile {
  path: string;
  type: 'text' | 'css' | 'javascript';
  title?: string;
  isSpineItem: boolean;
}

interface AutoSaveStatus {
  enabled: boolean;
  interval: number;
  lastSaved: Date | null;
  isProcessing: boolean;
  error?: string;
}

interface EditorState {
  paneMode: 'single' | 'dual';
  splitOrientation: 'horizontal' | 'vertical';
  selectedFiles: { pane1?: string; pane2?: string };
  hasUnsavedChanges: boolean;
  validationErrors: { pane1: ParseError[]; pane2: ParseError[] };
  isLoading: boolean;
}

type PaneMode = 'single' | 'dual';
type SplitOrientation = 'horizontal' | 'vertical';
```

## Editor Component Structure

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let spineItemId = '';
  export let readOnly = false;
  export let autoSaveInterval = 2000;

  let paneMode = 'single';
  let splitOrientation = 'horizontal';
  let selectedFiles = { pane1: null, pane2: null };
  let availableFiles = [];
  let pane1Frame, pane2Frame;
  let validationErrors = { pane1: [], pane2: [] };
  let hasUnsavedChanges = false;
  let autoSaveEnabled = true;
  let lastSaved = null;
</script>

<div class="text-editor-container">
  <div class="editor-toolbar">
    <div class="layout-controls">
      <button
        class="pane-toggle"
        class:active={paneMode === 'single'}
        on:click={() => setPaneMode('single')}
      >
        Single
      </button>
      <button
        class="pane-toggle"
        class:active={paneMode === 'dual'}
        on:click={() => setPaneMode('dual')}
      >
        Dual
      </button>

      {#if paneMode === 'dual'}
        <button
          class="split-toggle"
          on:click={toggleSplitOrientation}
          title="Toggle split orientation"
        >
          {splitOrientation === 'horizontal' ? '⬌' : '⬍'}
        </button>
      {/if}
    </div>

    <div class="editor-actions">
      <button on:click={saveAllPanes} disabled={!hasUnsavedChanges || readOnly}> Save All </button>
      <button on:click={toggleAutoSave}>
        Auto-save: {autoSaveEnabled ? 'On' : 'Off'}
      </button>
      {#if lastSaved}
        <span class="last-saved">Saved {formatTime(lastSaved)}</span>
      {/if}
    </div>
  </div>

  <div
    class="editor-content"
    class:dual-pane={paneMode === 'dual'}
    class:vertical-split={splitOrientation === 'vertical'}
  >
    <!-- Primary Pane -->
    <div class="editor-pane" class:pane-1={true}>
      <div class="pane-header">
        <select
          bind:value={selectedFiles.pane1}
          on:change={e => loadFileInPane(1, e.target.value)}
          class="file-selector"
        >
          <option value="">Select file...</option>
          {#each getAvailableFilesForPane(1) as file}
            <option value={file.path} disabled={file.path === selectedFiles.pane2}>
              {file.title || file.path} ({file.type})
            </option>
          {/each}
        </select>

        {#if hasUnsavedChanges}
          <span class="unsaved-indicator">●</span>
        {/if}
      </div>

      <div class="pane-content">
        <iframe
          bind:this={pane1Frame}
          src="about:blank"
          class="editor-iframe"
          title="Editor Pane 1"
          on:load={() => initializePane(1)}
        ></iframe>

        {#if validationErrors.pane1.length > 0}
          <div class="error-panel">
            {#each validationErrors.pane1 as error}
              <div class="error-item">
                <span class="error-location">Line {error.line}:</span>
                <span class="error-message">{error.message}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Secondary Pane (dual mode only) -->
    {#if paneMode === 'dual'}
      <div class="pane-splitter"></div>

      <div class="editor-pane" class:pane-2={true}>
        <div class="pane-header">
          <select
            bind:value={selectedFiles.pane2}
            on:change={e => loadFileInPane(2, e.target.value)}
            class="file-selector"
          >
            <option value="">Select file...</option>
            {#each getAvailableFilesForPane(2) as file}
              <option value={file.path} disabled={file.path === selectedFiles.pane1}>
                {file.title || file.path} ({file.type})
              </option>
            {/each}
          </select>

          {#if hasUnsavedChanges}
            <span class="unsaved-indicator">●</span>
          {/if}
        </div>

        <div class="pane-content">
          <iframe
            bind:this={pane2Frame}
            src="about:blank"
            class="editor-iframe"
            title="Editor Pane 2"
            on:load={() => initializePane(2)}
          ></iframe>

          {#if validationErrors.pane2.length > 0}
            <div class="error-panel">
              {#each validationErrors.pane2 as error}
                <div class="error-item">
                  <span class="error-location">Line {error.line}:</span>
                  <span class="error-message">{error.message}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
```

## Pane Management Implementation

```typescript
const setPaneMode = (mode: PaneMode) => {
  paneMode = mode;

  if (mode === 'single' && selectedFiles.pane2) {
    // Clear secondary pane when switching to single mode
    selectedFiles.pane2 = null;
  }

  // Save layout preference
  saveLayoutPreferences();

  dispatch('layout-change', { mode, orientation: splitOrientation });
};

const toggleSplitOrientation = () => {
  splitOrientation = splitOrientation === 'horizontal' ? 'vertical' : 'horizontal';
  saveLayoutPreferences();
  dispatch('layout-change', { mode: paneMode, orientation: splitOrientation });
};

const getAvailableFilesForPane = (paneIndex: 1 | 2): ManifestFile[] => {
  return availableFiles.filter(file => {
    // Exclude files already selected in other panes
    const otherPaneFile = paneIndex === 1 ? selectedFiles.pane2 : selectedFiles.pane1;
    return file.path !== otherPaneFile;
  });
};

const loadFileInPane = async (paneIndex: 1 | 2, filePath: string) => {
  if (!filePath) return;

  try {
    const fileContent = await fileStorage.readFile(currentWorkspaceId, filePath);
    const paneKey = `pane${paneIndex}` as keyof typeof selectedFiles;

    selectedFiles[paneKey] = filePath;

    // Initialize the iframe for this pane
    const iframe = paneIndex === 1 ? pane1Frame : pane2Frame;
    if (iframe) {
      await initializePaneContent(iframe, filePath, fileContent);
    }

    // Clear validation errors for this pane
    validationErrors[paneKey] = [];
  } catch (error) {
    console.error(`Failed to load file ${filePath}:`, error);
    // Show error notification
  }
};
```

## Content Validation System

```typescript
const validateContent = (
  content: string,
  fileType: 'text' | 'css' | 'javascript'
): ValidationResult => {
  const errors: ParseError[] = [];

  if (fileType === 'css') {
    try {
      // Simple CSS syntax validation
      const testStyle = document.createElement('style');
      testStyle.textContent = content;
      document.head.appendChild(testStyle);

      // Check if CSS was parsed successfully
      if (testStyle.sheet?.cssRules) {
        // CSS is valid
      }

      document.head.removeChild(testStyle);
    } catch (error) {
      errors.push({
        line: extractLineNumber(error),
        column: 0,
        message: error.message,
        severity: 'error',
        source: 'css-parser',
      });
    }
  }

  if (fileType === 'javascript') {
    try {
      // JavaScript syntax validation using Function constructor
      new Function(content);
    } catch (error) {
      const lineMatch = error.stack?.match(/Function:(\d+):(\d+)/);
      errors.push({
        line: lineMatch ? parseInt(lineMatch[1]) : 1,
        column: lineMatch ? parseInt(lineMatch[2]) : 0,
        message: error.message,
        severity: 'error',
        source: 'js-parser',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const handleContentChange = (paneIndex: 1 | 2, content: string, fileType: string) => {
  const paneKey = `pane${paneIndex}` as keyof typeof validationErrors;

  // Always allow text content changes
  if (fileType === 'text') {
    validationErrors[paneKey] = [];
    triggerPreviewUpdate();
    return;
  }

  // Validate CSS and JavaScript
  const validation = validateContent(content, fileType as 'css' | 'javascript');
  validationErrors[paneKey] = validation.errors;

  // Only update preview if content is valid
  if (validation.isValid) {
    triggerPreviewUpdate();
  }

  // Update auto-save if enabled
  if (autoSaveEnabled && validation.isValid) {
    debouncedSave(paneIndex, content);
  }
};
```

## Layout CSS Implementation

```css
.text-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-primary);
}

.layout-controls {
  display: flex;
  gap: 4px;
}

.pane-toggle {
  padding: 6px 12px;
  border: 1px solid var(--border-primary);
  background: var(--bg-primary);
  border-radius: 4px;
  cursor: pointer;
}

.pane-toggle.active {
  background: var(--accent-primary);
  color: var(--text-on-accent);
}

.split-toggle {
  padding: 6px 8px;
  margin-left: 8px;
  font-size: 16px;
  border: 1px solid var(--border-primary);
  background: var(--bg-primary);
  border-radius: 4px;
  cursor: pointer;
}

.editor-content {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

.editor-content.dual-pane.vertical-split {
  flex-direction: column;
}

.editor-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.pane-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-primary);
  gap: 8px;
}

.file-selector {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-primary);
}

.pane-content {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
}

.editor-iframe {
  flex: 1;
  border: none;
  width: 100%;
}

.pane-splitter {
  width: 4px;
  background: var(--border-primary);
  cursor: col-resize;
  flex-shrink: 0;
}

.editor-content.vertical-split .pane-splitter {
  width: auto;
  height: 4px;
  cursor: row-resize;
}

.error-panel {
  background: var(--error-bg);
  border-top: 1px solid var(--error-border);
  padding: 8px 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  max-height: 120px;
  overflow-y: auto;
}

.error-item {
  margin-bottom: 4px;
}

.error-location {
  color: var(--error-text);
  font-weight: 600;
  margin-right: 8px;
}

.error-message {
  color: var(--text-secondary);
}

.unsaved-indicator {
  color: var(--warning-primary);
  font-weight: bold;
}
```

## Session Persistence

```typescript
const saveLayoutPreferences = () => {
  const preferences = {
    paneMode,
    splitOrientation,
    selectedFiles: { ...selectedFiles },
  };

  localStorage.setItem(`editor-layout-${spineItemId}`, JSON.stringify(preferences));
};

const loadLayoutPreferences = () => {
  try {
    const stored = localStorage.getItem(`editor-layout-${spineItemId}`);
    if (stored) {
      const preferences = JSON.parse(stored);
      paneMode = preferences.paneMode || 'single';
      splitOrientation = preferences.splitOrientation || 'horizontal';

      // Restore file selections if files still exist
      if (preferences.selectedFiles) {
        Object.assign(selectedFiles, preferences.selectedFiles);
      }
    }
  } catch (error) {
    console.warn('Failed to load layout preferences:', error);
  }
};
```

## Iframe Editor Implementation

```typescript
const initializeEditor = () => {
  const iframeDoc = editorFrame.contentDocument;

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          padding: 16px;
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 14px;
          line-height: 1.5;
          background: var(--bg-primary);
          color: var(--text-primary);
        }
        
        #editor {
          width: 100%;
          height: calc(100vh - 32px);
          border: none;
          outline: none;
          resize: none;
          background: transparent;
          color: inherit;
          font-family: inherit;
          font-size: inherit;
          line-height: inherit;
        }
        
        #editor:focus {
          background: var(--bg-secondary);
        }
      </style>
    </head>
    <body>
      <textarea id="editor" placeholder="Start writing..."></textarea>
      
      <script>
        const editor = document.getElementById('editor')
        let debounceTimeout
        
        // Handle content changes with debouncing
        editor.addEventListener('input', (e) => {
          clearTimeout(debounceTimeout)
          debounceTimeout = setTimeout(() => {
            window.parent.postMessage({
              type: 'content-change',
              content: editor.value
            }, '*')
          }, 300)
        })
        
        // Handle cursor position changes
        editor.addEventListener('selectionchange', (e) => {
          window.parent.postMessage({
            type: 'selection-change',
            start: editor.selectionStart,
            end: editor.selectionEnd
          }, '*')
        })
        
        // Handle keyboard shortcuts
        editor.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault()
            window.parent.postMessage({
              type: 'save-request'
            }, '*')
          }
        })
        
        // Expose editor API to parent
        window.setContent = (content) => {
          editor.value = content
        }
        
        window.getContent = () => {
          return editor.value
        }
        
        window.focus = () => {
          editor.focus()
        }
        
        window.setReadOnly = (readOnly) => {
          editor.readOnly = readOnly
        }
      </script>
    </body>
    </html>
  `);
  iframeDoc.close();

  // Set up message handling
  window.addEventListener('message', handleEditorMessage);

  // Load initial content
  loadInitialContent();
};
```

## Debounced Change Handling

```typescript
let changeTimeout: number;
let previewTimeout: number;

const handleContentChange = (newContent: string) => {
  content = newContent;
  hasUnsavedChanges = true;

  // Debounced auto-save
  if (autoSaveEnabled) {
    clearTimeout(changeTimeout);
    changeTimeout = setTimeout(() => {
      saveContent();
    }, autoSaveInterval);
  }

  // Debounced preview update
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(() => {
    updatePreview(newContent);
  }, 500);

  dispatch('content-change', { content: newContent });
};
```

## Auto-Save Implementation

```typescript
const saveContent = async (): Promise<boolean> => {
  if (!hasUnsavedChanges || readOnly) return true;

  try {
    // Save to file storage
    await fileStorage.writeFile(currentWorkspaceId, sourceFilePath, content);

    // Update modification timestamp
    lastSaved = new Date();
    hasUnsavedChanges = false;

    dispatch('save', { success: true, timestamp: lastSaved });
    return true;
  } catch (error) {
    console.error('Failed to save content:', error);
    dispatch('save', { success: false, error: error.message });
    return false;
  }
};

const enableAutoSave = (interval = 2000) => {
  autoSaveInterval = interval;
  autoSaveEnabled = true;
};

const disableAutoSave = () => {
  autoSaveEnabled = false;
  clearTimeout(changeTimeout);
};
```

## Preview Integration

```typescript
const updatePreview = async (content: string) => {
  try {
    const transformResult = await transformPipeline.transformText(
      content,
      currentWorkspaceId,
      spineItemId
    );

    if (transformResult.success) {
      dispatch('preview-update', {
        xhtml: transformResult.xhtmlDocument,
        content: transformResult.transformedText,
      });
    } else {
      dispatch('preview-error', {
        error: transformResult.error,
      });
    }
  } catch (error) {
    dispatch('preview-error', {
      error: { message: error.message, stage: 'text' },
    });
  }
};
```

## Editor State Management

```svelte
<script>
  import { writable } from 'svelte/store';

  interface EditorState {
    content: string;
    hasChanges: boolean;
    cursorPosition: { start: number; end: number };
    scrollPosition: number;
    isLoading: boolean;
    lastSaved: Date | null;
  }

  const createEditorStore = () => {
    const { subscribe, set, update } = writable<EditorState>({
      content: '',
      hasChanges: false,
      cursorPosition: { start: 0, end: 0 },
      scrollPosition: 0,
      isLoading: true,
      lastSaved: null,
    });

    return {
      subscribe,
      setContent: (content: string) =>
        update(state => ({
          ...state,
          content,
          hasChanges: content !== state.content,
        })),
      markSaved: () =>
        update(state => ({
          ...state,
          hasChanges: false,
          lastSaved: new Date(),
        })),
      setCursorPosition: (start: number, end: number) =>
        update(state => ({
          ...state,
          cursorPosition: { start, end },
        })),
    };
  };

  export const editorStore = createEditorStore();
</script>
```

## Conflict Resolution

```typescript
const handleSaveConflict = async (
  localContent: string,
  remoteContent: string
): Promise<'local' | 'remote' | 'merge'> => {
  // Show conflict resolution dialog
  const choice = await showConflictDialog({
    local: localContent,
    remote: remoteContent,
    lastSaved: lastSaved,
  });

  switch (choice) {
    case 'keep-local':
      return 'local';
    case 'use-remote':
      setContent(remoteContent);
      return 'remote';
    case 'merge':
      const merged = await showMergeDialog(localContent, remoteContent);
      setContent(merged);
      return 'merge';
  }
};
```

## Keyboard Shortcuts

```typescript
const KEYBOARD_SHORTCUTS = {
  'Ctrl+S': () => saveContent(),
  'Ctrl+Z': () => undo(),
  'Ctrl+Y': () => redo(),
  'Ctrl+F': () => showFindDialog(),
  'Ctrl+H': () => showReplaceDialog(),
  F11: () => toggleFullscreen(),
};

const handleKeyboardShortcut = (event: KeyboardEvent) => {
  const key = `${event.ctrlKey ? 'Ctrl+' : ''}${event.key}`;
  const handler = KEYBOARD_SHORTCUTS[key];

  if (handler) {
    event.preventDefault();
    handler();
  }
};
```

## Error Handling

- File loading failures
- Save operation errors
- Preview generation failures
- Network connectivity issues
- Storage quota exceeded
- Invalid content encoding

## Testing Considerations

- Test auto-save functionality
- Test debounced change handling
- Test keyboard shortcuts
- Test conflict resolution
- Test iframe security isolation
- Test with large documents
- Test performance under heavy editing

## Line-Numbered Editor Architecture

### Layout Structure

```css
.line-numbered-editor {
  display: flex;
  overflow: hidden; /* Prevents scrollbar overlap */
  position: relative;
}

.line-numbers-gutter {
  width: 50px;
  flex-shrink: 0; /* Prevents compression */
  z-index: 1; /* Stays above textarea */
  background: #f8f9fa;
  border-right: 1px solid #dee2e6;
  overflow: hidden;
  user-select: none;
}

.textarea-container {
  flex: 1;
  position: relative;
  overflow: hidden; /* Contains scrollbars within textarea */
}

#editor {
  box-sizing: border-box; /* Predictable sizing */
  overflow: auto; /* Scrollbars only on textarea */
}
```

### Key Design Principles

- **Fixed gutter width** prevents layout shifts during editing
- **Flex-shrink: 0** on gutter ensures consistent 50px width
- **Overflow containment** keeps scrollbars within textarea area
- **Z-index layering** prevents textarea from overlapping gutter
- **Font consistency** between gutter and textarea for alignment

## Synchronization Implementation

### Core Functions

```typescript
function updateLineNumbers() {
  if (!lineNumbersElement || !editorElement) return;

  const content = editorElement.value;
  const lines = content.split('\n');
  const lineCount = lines.length;

  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
  lineNumbersElement.textContent = lineNumbers;
}

function syncScroll() {
  if (!lineNumbersElement || !editorElement) return;
  lineNumbersElement.scrollTop = editorElement.scrollTop;
}
```

### Event Management

```typescript
function initializeLineNumbers() {
  // Initial line numbers
  updateLineNumbers();

  // Sync scroll events
  editorElement.addEventListener('scroll', syncScroll);

  // Update line numbers on content change
  editorElement.addEventListener('input', updateLineNumbers);

  // Handle font mode changes
  const observer = new MutationObserver(() => {
    updateLineNumbers();
  });
  observer.observe(editorElement, { attributes: true, attributeFilter: ['class'] });
}
```

### Performance Considerations

- **Debounced updates** for input events (300ms)
- **RequestAnimationFrame** for smooth scroll synchronization
- **MutationObserver** for efficient class change detection
- **Event cleanup** on component unmount

## CSS Best Practices

### Scrollbar Containment

```css
/* Main container prevents any overflow */
.line-numbered-editor {
  overflow: hidden;
}

/* Gutter never scrolls horizontally, only vertically via JS */
.line-numbers-gutter {
  overflow: hidden;
}

/* Only textarea has scrollbars */
.textarea-container {
  overflow: hidden;
}

#editor {
  overflow: auto; /* Scrollbars contained here */
}
```

### Font Consistency

```css
/* Shared font properties for alignment */
.line-numbers-gutter,
#editor {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
}

/* Mode-specific font switching */
.text-mode .line-numbers-gutter,
.text-mode #editor {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

### Responsive Considerations

- **Fixed gutter width** works on all screen sizes
- **Flex layout** adapts to container changes
- **Z-index stacking** prevents mobile scroll issues
- **Touch-friendly** line number area (non-selectable)

## Implementation Notes

- Implement iframe security carefully
- Test auto-save with various intervals
- Handle browser refresh/close gracefully
- Consider offline editing capabilities
- Test accessibility features thoroughly
