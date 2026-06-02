# Text Editor Store API Documentation

This document describes the public API for the general-purpose text editor store system that manages text content state across multiple editors in the application.

## Overview

The text editor store system provides a factory-based approach for creating isolated, performant stores for text editing components. Each editor gets its own store instance, enabling multiple editors to coexist on screen without state interference.

**Use Cases:**

- Outline/navigation editing (`nav.txt`)
- Spine chapter source editing (`chapter-1.txt`)
- Transform script editing (`transformText.js`, `transformDom.js`)
- Manifest resource editing (CSS, JavaScript files)
- Any text-based file editing in the workspace

## Core Factory Function

### createTextEditorStore()

```typescript
function createTextEditorStore(editorId: string, initialContent?: string): TextEditorStore;
```

**Input:**

- `editorId: string` - Unique identifier for this editor instance (e.g., 'outline-nav', 'chapter-1-source')
- `initialContent?: string` - Optional initial text content (defaults to empty string)

**Output:** `TextEditorStore` - A Svelte store instance with text editing capabilities

**Side Effects:** Creates a new writable store instance with derived state

**Error Handling:** Throws an error if `editorId` is already in use by another store instance

**Usage:**

```typescript
import { createTextEditorStore } from './text-editor-store.js';

// Create stores for different editors
const outlineStore = createTextEditorStore('outline-nav', 'Initial outline content');
const chapterStore = createTextEditorStore('chapter-1-source');
const transformStore = createTextEditorStore('transform-text-js', '// Transform script');

// Error handling for duplicate IDs
try {
  const duplicateStore = createTextEditorStore('outline-nav'); // Throws error
} catch (error) {
  console.error('Editor ID already in use:', error.message);
}
```

## TextEditorStore Interface

### Store State

```typescript
interface TextEditorState {
  content: string; // Current text content
  isEmpty: boolean; // Derived: content.trim() === ''
  lastUpdated: number; // Timestamp of last content change
}
```

### Store Methods

#### subscribe()

```typescript
subscribe(subscriber: (state: TextEditorState) => void): () => void
```

**Input:** `subscriber` - Function called when store state changes

**Output:** Unsubscribe function

**Side Effects:** Subscribes to store updates, calls subscriber with current state immediately and synchronously on each state update

**Usage:**

```typescript
const unsubscribe = outlineStore.subscribe(state => {
  console.log('Content updated:', state.content);
  console.log('Is empty:', state.isEmpty);
});

// Later: unsubscribe when component is destroyed
onDestroy(unsubscribe);
```

#### updateContent()

```typescript
updateContent(newContent: string): void
```

**Input:** `newContent: string` - New text content to store (non-string inputs are ignored)

**Output:** None

**Side Effects:**

- Updates store state with new content (only if input is a string)
- Recalculates `isEmpty` flag
- Updates `lastUpdated` timestamp
- Notifies all subscribers immediately and synchronously

**Input Handling:** Non-string inputs (null, undefined, numbers, objects) are ignored and do not trigger state updates

**Usage:**

```typescript
// Update content (typically from textarea input)
outlineStore.updateContent('# New Outline\n\nChapter 1...');

// Empty content triggers isEmpty flag
outlineStore.updateContent(''); // isEmpty becomes true
```

#### reset()

```typescript
reset(): void
```

**Input:** None

**Output:** None

**Side Effects:**

- Clears content to empty string
- Sets `isEmpty` to true
- Updates `lastUpdated` timestamp
- Notifies all subscribers

**Usage:**

```typescript
// Clear editor content
outlineStore.reset();
```

#### getContent()

```typescript
getContent(): string
```

**Input:** None

**Output:** `string` - Current content without subscribing to changes

**Side Effects:** None

**Usage:**

```typescript
// Get current content synchronously (useful for event handlers)
const currentText = outlineStore.getContent();
await saveToFile(currentText);
```

## Integration Patterns

### Basic Component Integration

```svelte
<!-- TextEditor.svelte -->
<script>
  import { createTextEditorStore } from '../stores/text-editor-store.js';

  export let editorId;
  export let initialContent = '';
  export let placeholder = '';

  // Create store for this editor instance
  const store = createTextEditorStore(editorId, initialContent);

  let textareaValue = '';

  // Subscribe to store updates
  $: textareaValue = $store.content;

  // Handle textarea input with debouncing
  let debounceTimer;
  function handleInput(event) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      store.updateContent(event.target.value);
    }, 300);
  }

  // Dispatch lightweight change events
  $: if ($store.lastUpdated) {
    dispatch('contentChanged', {
      editorId,
      timestamp: $store.lastUpdated,
      isEmpty: $store.isEmpty,
    });
  }
</script>

<textarea bind:value={textareaValue} on:input={handleInput} {placeholder} class="text-editor" />
```

### Multi-Editor Scenario

```svelte
<!-- SpineEditor.svelte - Multiple editors on screen -->
<script>
  import { createTextEditorStore } from '../stores/text-editor-store.js';
  import TextEditor from './TextEditor.svelte';

  export let chapterId;
  export let transformScriptId;

  // Create separate stores for each editor
  const chapterStore = createTextEditorStore(`chapter-${chapterId}-source`);
  const transformStore = createTextEditorStore(`transform-${transformScriptId}`);

  // Handle changes from either editor
  function handleEditorChange(event) {
    const { editorId, isEmpty } = event.detail;

    if (editorId.includes('chapter') && !isEmpty) {
      // Process chapter content
      processChapterContent(chapterStore.getContent());
    } else if (editorId.includes('transform')) {
      // Update transform script
      updateTransformScript(transformStore.getContent());
    }
  }
</script>

<div class="split-editor">
  <div class="left-pane">
    <h3>Chapter Source</h3>
    <TextEditor
      editorId="chapter-{chapterId}-source"
      editorStore={chapterStore}
      placeholder="Enter chapter content..."
      on:contentChanged={handleEditorChange}
    />
  </div>

  <div class="right-pane">
    <h3>Transform Script</h3>
    <TextEditor
      editorId="transform-{transformScriptId}"
      editorStore={transformStore}
      placeholder="function transformText(input) { ... }"
      on:contentChanged={handleEditorChange}
    />
  </div>
</div>
```

### Store Cleanup Pattern

```svelte
<script>
  import { onDestroy } from 'svelte';
  import { createTextEditorStore } from '../stores/text-editor-store.js';

  const store = createTextEditorStore('temp-editor');

  // Clean up when component is destroyed
  onDestroy(() => {
    store.reset(); // Optional: clear content
    // Store will be garbage collected automatically
  });
</script>
```

## Advanced Usage Patterns

### File-Backed Editors

```typescript
// Editor that loads from and saves to workspace files
async function createFileBackedEditor(
  editorId: string,
  workspaceId: string,
  filePath: string,
  workspaceManager: IWorkspaceManager
) {
  // Load initial content from file
  let initialContent = '';
  try {
    initialContent = await workspaceManager.readTextFile(workspaceId, filePath);
  } catch {
    // File doesn't exist, start with empty content
  }

  const store = createTextEditorStore(editorId, initialContent);

  // Auto-save to file when content changes (debounced)
  let saveTimeout;
  store.subscribe(state => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        await workspaceManager.writeTextFile(workspaceId, filePath, state.content);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 1000); // 1 second debounce for file saves
  });

  return store;
}
```

### Transform Pipeline Integration

```typescript
// Editor that processes content through transform pipeline
function createTransformEditor(editorId: string, transformer: TransformPipeline) {
  const store = createTextEditorStore(editorId);

  // Transform content whenever it changes
  store.subscribe(async state => {
    if (!state.isEmpty) {
      try {
        const result = await transformer.processContent(state.content);
        // Emit transformed result to preview
        dispatchTransformResult(result);
      } catch (error) {
        dispatchTransformError(error);
      }
    }
  });

  return store;
}
```

## Performance Characteristics

**Memory Efficiency:**

- Each store instance holds only necessary state (content, isEmpty, timestamp)
- No duplicate content storage across components
- Automatic garbage collection when editors are destroyed

**Update Performance:**

- Immediate, synchronous store updates (no built-in debouncing)
- Debouncing is handled at the component level, not in the store
- Derived `isEmpty` calculation is lightweight
- Subscribers receive immediate notifications on state changes

**Multi-Editor Scalability:**

- Independent store instances prevent cross-contamination
- Each editor only subscribes to its own store
- No global state polling or complex coordination needed

## Error Handling

### Store Creation Errors

```typescript
// Duplicate ID usage throws an error
try {
  const store1 = createTextEditorStore('my-editor', 'Content 1');
  const store2 = createTextEditorStore('my-editor', 'Content 2'); // Throws error
} catch (error) {
  console.error('Editor ID already in use:', error.message);
  // Handle error - use different ID or reuse existing store
}
```

### Content Update Errors

```typescript
// Stores are resilient to invalid input types
store.updateContent(null); // Ignored, no state change
store.updateContent(undefined); // Ignored, no state change
store.updateContent(123); // Ignored, no state change
store.updateContent({ text: 'content' }); // Ignored, no state change

// Only strings trigger updates
store.updateContent('valid content'); // Updates state normally
```

## Type Definitions

```typescript
export interface TextEditorState {
  content: string;
  isEmpty: boolean;
  lastUpdated: number;
}

export interface TextEditorStore {
  subscribe(subscriber: (state: TextEditorState) => void): () => void;
  updateContent(newContent: string): void;
  reset(): void;
  getContent(): string;
}

export type EditorId = string;
```

## Dependencies

- `svelte/store` - Core Svelte store functionality
- No external dependencies - pure Svelte store implementation

## Browser Compatibility

- **All modern browsers** - Uses standard JavaScript and Svelte store APIs
- **No polyfills required** - Vanilla store implementation
- **Memory efficient** - Stores are lightweight and automatically cleaned up

## Testing Considerations

**Unit Testing:**

- Test store creation with various `editorId` and `initialContent` values
- Test duplicate `editorId` error handling (should throw error)
- Test `updateContent()` method with different input types (string, null, undefined, number, object)
- Test input sanitization (non-strings should be ignored, no state changes)
- Test `isEmpty` derivation with edge cases (whitespace, empty strings)
- Test `lastUpdated` timestamp updates and synchronous subscriber notifications
- Test `reset()` functionality
- Test store isolation (multiple stores don't interfere with each other)

**Integration Testing:**

- Test multiple stores coexisting without interference
- Test component integration with store subscription/unsubscription
- Test debounced content updates in components (store updates are immediate)
- Test synchronous subscription notification timing
- Test store cleanup on component destruction (automatic garbage collection)

**Performance Testing:**

- Test with large content strings (book chapter size)
- Test rapid content updates (immediate store updates, no debouncing)
- Test synchronous subscriber notification performance
- Test memory usage with multiple editor instances
- Test store creation/destruction cycles
