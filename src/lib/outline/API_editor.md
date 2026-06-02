# Outline Editor API Documentation

This document describes the public API for the Outline Editor UI components that enable users to create and edit EPUB navigation documents (table of contents).

## Overview

The Outline Editor system consists of two main UI components:

1. **OutlineEditor** - Text editing component for navigation content (`nav.txt`)
2. **OutlineView** - Coordination component that manages editor/preview integration

This system integrates with:

- **TextEditorStore** - General-purpose text editor state management (see `../stores/text-editor-store-API.md`)
- **OutlineGenerator** - Utility service for EPUB navigation generation (see `API.md`)

The store-based architecture enables efficient content management without passing large strings through component events.

## OutlineEditor Component

**File:** `src/lib/components/outline/OutlineEditor.svelte`

A textarea-based editor component for editing navigation content with debounced change events and accessibility features.

### Props

```typescript
interface OutlineEditorProps {
  editorStore: TextEditorStore; // Required: Store instance for this editor
  placeholder?: string; // Optional: Placeholder text when empty
}
```

### Events

```typescript
interface OutlineEditorEvents {
  contentChanged: {
    detail: {
      editorId: string; // Editor identifier from store
      timestamp: number; // When content was updated
      isEmpty: boolean; // True if content.trim() === ''
    };
  };
}
```

### Usage

```svelte
<script>
  import OutlineEditor from '../components/outline/OutlineEditor.svelte';
  import { createTextEditorStore } from '../stores/text-editor-store.js';

  // Create store for this editor instance
  const outlineStore = createTextEditorStore('outline-nav');

  function handleContentChanged(event) {
    const { isEmpty } = event.detail;

    if (isEmpty) {
      // Trigger auto-generation from spine
      generateNavigationFromSpine();
    } else {
      // Process user content through transform pipeline
      const content = outlineStore.getContent();
      processUserContent(content);
    }
  }
</script>

<OutlineEditor
  editorStore={outlineStore}
  placeholder="Navigation content will be auto-generated from your chapters..."
  on:contentChanged={handleContentChanged}
/>
```

### Behavior

**Content Management:**

- Content stored in provided TextEditorStore instance (no file I/O)
- Fills available horizontal and vertical space in container
- Uses textarea element for multi-line text editing
- Textarea value stays synchronized with store state

**Event Emission:**

- Emits `contentChanged` events debounced at 300ms after user stops typing
- Event includes lightweight metadata (timestamp, isEmpty) without content string
- Empty state detection uses store's derived `isEmpty` flag
- Parent components access content via `store.getContent()` when needed

**Store Integration:**

- Updates store via `store.updateContent()` on user input
- Subscribes to store changes to keep textarea synchronized
- Store automatically handles isEmpty calculation and timestamp updates

**Accessibility Features:**

- Proper focus management with design system focus indicators
- Uses semantic HTML textarea element
- Keyboard accessible (not a focus trap)
- Integrates with design system color tokens for high contrast support
- Minimum touch target compliance for mobile accessibility

**CSS Integration:**

- Uses design system tokens from `src/styles/`
- Consistent focus styles with `--color-focus-ring` and `--focus-ring-width`
- Responsive to `prefers-reduced-motion` and `prefers-contrast` preferences
- Fills container space provided by LayoutManager left pane

## OutlineView Component

**File:** `src/lib/components/outline/OutlineView.svelte`

Coordination component that manages the relationship between OutlineEditor, preview updates, and workspace file operations.

### Props

```typescript
interface OutlineViewProps {
  workspaceId: string; // Required: Active workspace identifier
  workspaceManager: IWorkspaceManager; // Required: Workspace file operations
  spineItemManager: SpineItemManager; // Required: Spine management
  transformPipeline: TransformPipeline; // Required: Content transformation
}
```

### Events

```typescript
interface OutlineViewEvents {
  previewUpdate: {
    detail: {
      xhtml: string; // Generated XHTML for preview
      warnings?: string[]; // Transform warnings
    };
  };

  error: {
    detail: {
      message: string; // Error description
      stage: 'generation' | 'transform' | 'save'; // Where error occurred
    };
  };
}
```

### Public Methods

#### loadNavigationContent()

```typescript
async loadNavigationContent(): Promise<void>
```

**Input:** None (uses component props for workspace context)

**Output:** `Promise<void>` - Resolves when content is loaded

**Side Effects:**

- Loads existing `nav.txt` content from workspace if it exists
- Updates internal TextEditorStore with loaded content
- Triggers initial preview generation

**Usage:**

```svelte
<script>
  import OutlineView from '../components/outline/OutlineView.svelte';
  import { onMount } from 'svelte';

  let outlineView;

  onMount(async () => {
    await outlineView.loadNavigationContent();
  });
</script>

<OutlineView
  bind:this={outlineView}
  {workspaceId}
  {workspaceManager}
  {spineItemManager}
  {transformPipeline}
  on:previewUpdate={handlePreviewUpdate}
  on:error={handleError}
/>
```

#### saveNavigationContent()

```typescript
async saveNavigationContent(): Promise<void>
```

**Input:** None (uses current editor content)

**Output:** `Promise<void>` - Resolves when content is saved

**Side Effects:**

- Saves current store content to `SOURCE/text/nav.txt`
- Saves transformed XHTML to `OEBPS/nav.xhtml`
- Updates OPF manifest with navigation metadata
- May throw error if transform or file operations fail

**Usage:**

```typescript
async function saveCurrentWork() {
  try {
    await outlineView.saveNavigationContent();
    showSuccessMessage('Navigation saved successfully');
  } catch (error) {
    showErrorMessage(`Save failed: ${error.message}`);
  }
}
```

### Store Integration Pattern

The OutlineView component creates and manages its own TextEditorStore internally:

```svelte
<!-- OutlineView.svelte implementation pattern -->
<script>
  import OutlineEditor from './OutlineEditor.svelte';
  import { createTextEditorStore } from '../../stores/text-editor-store.js';
  import { OutlineGenerator } from '../../outline/outline-generator.js';

  export let workspaceId;
  export let workspaceManager;
  export let spineItemManager;
  export let transformPipeline;

  // Create store for this outline editor instance
  const outlineStore = createTextEditorStore('outline-nav');

  // React to store changes for transform processing
  $: if ($outlineStore.lastUpdated) {
    handleContentChange($outlineStore.isEmpty);
  }

  async function handleContentChange(isEmpty) {
    if (isEmpty) {
      // Auto-generate from spine
      const spineItems = await spineItemManager.loadSpineItems(workspaceId);
      const result = OutlineGenerator.generateFromSpine(spineItems);
      dispatch('previewUpdate', { xhtml: result.xhtml });
    } else {
      // Process user content
      const content = outlineStore.getContent();
      const result = await OutlineGenerator.processUserContent(
        content,
        workspaceId,
        'nav',
        transformPipeline
      );
      if (result.success) {
        dispatch('previewUpdate', { xhtml: result.xhtml, warnings: result.warnings });
      } else {
        dispatch('error', { message: result.error.message, stage: 'transform' });
      }
    }
  }
</script>

<OutlineEditor
  editorStore={outlineStore}
  placeholder="Navigation content will be auto-generated from your chapters..."
  on:contentChanged={handleContentChange}
/>
```

### Complete Integration Workflow

```svelte
<!-- Parent component using OutlineView -->
<script>
  import OutlineView from '../components/outline/OutlineView.svelte';
  import ContentPreview from '../components/preview/ContentPreview.svelte';

  let outlineView;
  let previewContent = '';
  let previewWarnings = [];

  function handlePreviewUpdate(event) {
    previewContent = event.detail.xhtml;
    previewWarnings = event.detail.warnings || [];
  }

  function handleError(event) {
    console.error(`Outline error (${event.detail.stage}):`, event.detail.message);
    showUserNotification(event.detail.message, 'error');
  }
</script>

<div class="outline-interface">
  <div class="editor-pane">
    <OutlineView
      bind:this={outlineView}
      {workspaceId}
      {workspaceManager}
      {spineItemManager}
      {transformPipeline}
      on:previewUpdate={handlePreviewUpdate}
      on:error={handleError}
    />
  </div>

  <div class="preview-pane">
    <ContentPreview content={previewContent} device="responsive" />

    {#if previewWarnings.length > 0}
      <div class="warnings">
        {#each previewWarnings as warning}
          <p class="warning-text">{warning}</p>
        {/each}
      </div>
    {/if}
  </div>
</div>
```

## Mode Switching Behavior

The OutlineView component automatically manages two modes:

### Auto-Generation Mode

- **Triggered when:** Editor content is empty (`content.trim() === ''`)
- **Behavior:**
  - Calls `OutlineGenerator.generateFromSpine()` with current spine items
  - Generates EPUB-compliant navigation XHTML
  - Updates preview with generated content
  - Does not save to files until user adds manual content

### Manual Editing Mode

- **Triggered when:** User types content into editor
- **Behavior:**
  - Calls `OutlineGenerator.processUserContent()` with editor text
  - Processes through transform pipeline
  - Updates preview with transformed XHTML
  - Auto-saves to `nav.txt` and `nav.xhtml` after successful transform

## Error Handling

### Transform Errors

```typescript
// Transform pipeline failures
{
  stage: 'transform',
  message: 'Transform script execution failed: SyntaxError in line 5'
}
```

### File Operation Errors

```typescript
// Workspace file I/O failures
{
  stage: 'save',
  message: 'Failed to write nav.xhtml: insufficient storage quota'
}
```

### Generation Errors

```typescript
// Spine processing failures
{
  stage: 'generation',
  message: 'No spine items found for navigation generation'
}
```

## LayoutManager Integration

The OutlineView component is designed to work with the existing LayoutManager:

```svelte
<LayoutManager>
  <svelte:fragment slot="left-content">
    <OutlineView
      {workspaceId}
      {workspaceManager}
      {spineItemManager}
      {transformPipeline}
      on:previewUpdate={handlePreviewUpdate}
    />
  </svelte:fragment>

  <svelte:fragment slot="right-content">
    <ContentPreview content={previewXHTML} />
  </svelte:fragment>
</LayoutManager>
```

## Performance Characteristics

- **Debounced Updates**: 300ms debounce on editor changes prevents excessive transform calls
- **Memory Efficient**: Content stored in TextEditorStore, no string duplication across components
- **Store-Based Architecture**: Lightweight events without large string payloads
- **Transform Caching**: Transform pipeline caches loaded scripts for repeated executions
- **Incremental Updates**: Only transforms and saves when content actually changes
- **Isolated State**: Each editor gets its own store instance for clean separation

## Dependencies

- `createTextEditorStore` from `../../stores/text-editor-store.js` - Text editor state management
- `OutlineGenerator` from `../../outline/outline-generator.js` - Static utility methods
- `ContentPreview` from `../preview/ContentPreview.svelte` - Preview display
- `IWorkspaceManager` from `../../workspace/types.js` - File operations interface
- `SpineItemManager` from `../../spine/spine-item-manager.js` - Chapter management
- `TransformPipeline` from `../../transform/transform-pipeline.js` - Content transformation
- Design system tokens from `../../styles/` - Accessibility and styling

## Browser Compatibility

- **Modern browsers only** (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)
- **File system features** require secure context (HTTPS or localhost)
- **Transform execution** uses Web Workers for script isolation
- **Accessibility features** work with screen readers and high contrast modes
