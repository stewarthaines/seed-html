# OutlineGenerator Utility Service API

## Overview

The OutlineGenerator is a utility service that creates EPUB-compliant navigation documents from spine items and user content. It serves as the bridge between the EPUB structure (spine items) and the navigation table of contents, supporting both automatic generation and user-customized content processing.

## Core Responsibilities

1. **Automatic Generation**: Convert spine items into complete EPUB navigation XHTML documents
2. **User Content Processing**: Transform user-written navigation content through the transform pipeline
3. **Metadata Management**: Create and manage navigation-specific metadata for OPF integration
4. **EPUB Compliance**: Ensure all generated content follows EPUB 3.x navigation standards

## Static Methods API

### generateFromSpine()

```typescript
static async generateFromSpine(
  spineItems: SpineItemWithSource[],
  workspaceManager: IWorkspaceManager,
  workspaceId: string,
  options?: GenerationOptions
): Promise<NavigationDocument>
```

**Purpose**: Automatically generate complete EPUB navigation from spine items

**Parameters**:

- `spineItems`: Array of spine items with source file information
- `workspaceManager`: Workspace manager instance for file access
- `workspaceId`: Workspace identifier for file operations
- `options`: Optional configuration for generation behavior

**Returns**: Complete navigation document with XHTML content and metadata

**Generation Logic**:

- Read XHTML files from workspace using spine item hrefs
- Skip spine items where XHTML files are missing or unreadable
- Extract chapter titles from spine item metadata or XHTML headings
- Create hierarchical navigation structure based on spine order
- Generate EPUB-compliant XHTML with proper semantics
- Include navigation-specific metadata for OPF manifest registration
- Log warnings for any skipped items

### processUserContent()

```typescript
static async processUserContent(
  navText: string,
  transformPipeline: TransformPipeline,
  workspaceId: string,
  options?: ProcessingOptions
): Promise<NavigationDocument>
```

**Purpose**: Process user-written navigation content through transform pipeline

**Parameters**:

- `navText`: User-written navigation content (plain text)
- `transformPipeline`: Transform pipeline instance for content processing
- `workspaceId`: Workspace identifier for context
- `options`: Optional configuration for processing behavior

**Returns**: Processed navigation document with transformed XHTML and metadata

**Processing Flow**:

1. Transform user text through transform pipeline
2. Validate resulting XHTML for navigation compliance
3. Extract/generate navigation metadata
4. Return complete navigation document

## Data Types

### NavigationDocument

```typescript
interface NavigationDocument {
  /** Complete EPUB navigation XHTML content */
  xhtmlContent: string;

  /** Navigation metadata for OPF manifest */
  metadata: NavigationMetadata;

  /** Generation timestamp */
  generatedAt: Date;

  /** Source type: 'auto-generated' | 'user-content' */
  sourceType: 'auto-generated' | 'user-content';
}
```

### NavigationMetadata

```typescript
interface NavigationMetadata {
  /** Manifest item ID (typically 'nav') */
  id: string;

  /** File path relative to OEBPS (typically 'nav.xhtml') */
  href: string;

  /** Media type (always 'application/xhtml+xml') */
  mediaType: string;

  /** EPUB properties (always ['nav']) */
  properties: string[];

  /** Spine inclusion flag (typically false for navigation) */
  linear: boolean;
}
```

### GenerationOptions

```typescript
interface GenerationOptions {
  /** Include spine items without titles */
  includeUntitled?: boolean;

  /** Custom title generation strategy */
  titleStrategy?: 'filename' | 'heading' | 'fallback';

  /** Navigation document title */
  documentTitle?: string;

  /** Additional CSS classes for styling */
  cssClasses?: Record<string, string>;
}
```

### ProcessingOptions

```typescript
interface ProcessingOptions {
  /** Validation strictness level */
  validationLevel?: 'strict' | 'lenient';

  /** Error handling strategy */
  errorHandling?: 'throw' | 'fallback';

  /** Navigation document title */
  documentTitle?: string;
}
```

## Implementation Requirements

### EPUB Navigation Standards Compliance

The generated XHTML must follow EPUB 3.x navigation standards with a **flat list structure**:

```xhtml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>Table of Contents</title>
    <meta charset="UTF-8" />
  </head>
  <body>
    <nav epub:type="toc" role="navigation">
      <h1>Table of Contents</h1>
      <ol>
        <li><a href="chapter01.xhtml">Chapter 1: Title</a></li>
        <li><a href="chapter02.xhtml">Chapter 2: Title</a></li>
        <li><a href="chapter03.xhtml">Chapter 3: Title</a></li>
      </ol>
    </nav>
  </body>
</html>
```

**Future Enhancement**: Nested structure support based on heading levels within XHTML files may be added later.

### Title Extraction Strategies

1. **Metadata Priority**: Use spine item title metadata if available
2. **XHTML Analysis**: Extract from first heading (`<h1>`, `<h2>`, etc.) in transformed XHTML files
3. **Filename Fallback**: Generate from filename if no heading found
4. **Default Fallback**: Use "Chapter N" pattern for untitled items

### Error Handling Requirements

- **Missing XHTML Files**: Skip spine items that can't be read, continue with remaining items
- **Transform Errors**: Wrap and re-throw with navigation context (for user content processing)
- **Invalid XHTML**: Skip items with malformed XHTML that can't be parsed for titles
- **Empty Spine**: Generate valid but empty navigation document
- **All Items Skipped**: Generate navigation with informational message about missing content

## Testing Strategy

### Unit Tests (`OutlineGenerator.test.ts`)

#### Auto-Generation Tests

```typescript
describe('generateFromSpine', () => {
  test('generates valid EPUB navigation from spine items');
  test('handles spine items with titles');
  test('handles spine items without titles');
  test('respects title generation strategy options');
  test('creates proper navigation metadata');
  test('handles empty spine array');
  test('includes CSS classes when specified');
  test('skips spine items with missing XHTML files');
  test('skips spine items with malformed XHTML');
  test('generates valid navigation when all items are skipped');
  test('logs warnings for skipped items');
});
```

#### User Content Processing Tests

```typescript
describe('processUserContent', () => {
  test('processes user content through transform pipeline');
  test('handles transform pipeline errors');
  test('validates resulting XHTML for navigation compliance');
  test('creates navigation metadata from processed content');
  test('handles empty user content');
  test('respects processing options');
});
```

#### EPUB Compliance Tests

```typescript
describe('EPUB compliance', () => {
  test('generates valid EPUB 3.x navigation structure');
  test('includes required namespace declarations');
  test('uses proper epub:type and role attributes');
  test('creates valid anchor href references');
  test('generates flat list structure (not nested)');
  test('creates valid XHTML document with proper DOCTYPE');
});
```

### Integration Tests

#### Transform Pipeline Integration

- Mock `TransformPipeline` for content processing tests
- Test error handling with `TransformError` scenarios
- Verify proper workspace context passing

#### Spine Item Integration

- Mock `SpineItemWithSource` data structures
- Test with various spine item configurations
- Verify proper file path resolution

### Test Data Fixtures

Mock spine items with various configurations:

- Items with titles and without titles
- Different file extensions and paths
- Various metadata configurations
- Edge cases (empty arrays, malformed data)

## Usage Examples

### Basic Auto-Generation

```typescript
import { OutlineGenerator } from './outline-generator.js';

const navigationDoc = await OutlineGenerator.generateFromSpine(
  spineItems,
  workspaceManager,
  workspaceId,
  {
    titleStrategy: 'heading',
    documentTitle: 'Table of Contents',
    includeUntitled: true
  }
);

// Use with ContentPreview
<ContentPreview content={navigationDoc.xhtmlContent} />
```

### User Content Processing

```typescript
const userNavText = `
Chapter 1: The Beginning
Chapter 2: The Middle
Chapter 3: The End
`;

const navigationDoc = await OutlineGenerator.processUserContent(
  userNavText,
  transformPipeline,
  workspaceId,
  {
    validationLevel: 'strict',
    errorHandling: 'throw',
  }
);
```

### Integration with Workspace

```typescript
// Generate navigation and register in manifest
const navigationDoc = await OutlineGenerator.generateFromSpine(
  spineItems,
  workspaceManager,
  workspaceId
);

// Save XHTML file
await workspaceManager.writeTextFile(
  workspaceId,
  navigationDoc.metadata.href,
  navigationDoc.xhtmlContent
);

// Register in OPF manifest
await manifestManager.addItem(workspaceId, navigationDoc.metadata);
```

## Dependencies

### Required Imports

- `SpineItemWithSource` from spine types
- `IWorkspaceManager` from workspace types
- `TransformPipeline` from transform system
- `TransformError` from transform errors

### Dependencies

- **Workspace APIs**: Uses `workspaceManager.readTextFile()` for XHTML access
- **Transform Pipeline**: Uses transform pipeline for user content processing

### No Dependencies On

- UI components (static methods only)
- File storage implementation details (uses workspace abstraction)

## Implementation Location

**File**: `src/lib/outline/OutlineGenerator.ts`
**Tests**: `src/lib/outline/OutlineGenerator.test.ts`
**Types**: Include types in the same file or separate `types.ts` if shared

---

## Editor Components

The Outline Editor system consists of two main UI components that enable users to create and edit EPUB navigation documents (table of contents):

1. **OutlineEditor** - Text editing component for navigation content (`nav.txt`)
2. **OutlineView** - Coordination component that manages editor/preview integration

This system integrates with:

- **TextEditorStore** - General-purpose text editor state management (see `../stores/text-editor-store-API.md`)
- **OutlineGenerator** - The utility service documented above

The store-based architecture enables efficient content management without passing large strings through component events.

### OutlineEditor Component

**File:** `src/lib/components/outline/OutlineEditor.svelte`

A textarea-based editor component for editing navigation content with debounced change events and accessibility features.

#### Props

```typescript
interface OutlineEditorProps {
  editorStore: TextEditorStore; // Required: Store instance for this editor
  placeholder?: string; // Optional: Placeholder text when empty
}
```

#### Events

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

#### Usage

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

#### Behavior

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

### OutlineView Component

**File:** `src/lib/components/outline/OutlineView.svelte`

Coordination component that manages the relationship between OutlineEditor, preview updates, and workspace file operations.

#### Props

```typescript
interface OutlineViewProps {
  workspaceId: string; // Required: Active workspace identifier
  workspaceManager: IWorkspaceManager; // Required: Workspace file operations
  spineItemManager: SpineItemManager; // Required: Spine management
  transformPipeline: TransformPipeline; // Required: Content transformation
}
```

#### Events

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

#### Public Methods

##### loadNavigationContent()

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

##### saveNavigationContent()

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

#### Store Integration Pattern

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

#### Complete Integration Workflow

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

### Mode Switching Behavior

The OutlineView component automatically manages two modes:

#### Auto-Generation Mode

- **Triggered when:** Editor content is empty (`content.trim() === ''`)
- **Behavior:**
  - Calls `OutlineGenerator.generateFromSpine()` with current spine items
  - Generates EPUB-compliant navigation XHTML
  - Updates preview with generated content
  - Does not save to files until user adds manual content

#### Manual Editing Mode

- **Triggered when:** User types content into editor
- **Behavior:**
  - Calls `OutlineGenerator.processUserContent()` with editor text
  - Processes through transform pipeline
  - Updates preview with transformed XHTML
  - Auto-saves to `nav.txt` and `nav.xhtml` after successful transform

### Error Handling

#### Transform Errors

```typescript
// Transform pipeline failures
{
  stage: 'transform',
  message: 'Transform script execution failed: SyntaxError in line 5'
}
```

#### File Operation Errors

```typescript
// Workspace file I/O failures
{
  stage: 'save',
  message: 'Failed to write nav.xhtml: insufficient storage quota'
}
```

#### Generation Errors

```typescript
// Spine processing failures
{
  stage: 'generation',
  message: 'No spine items found for navigation generation'
}
```

### LayoutManager Integration

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

### Performance Characteristics

- **Debounced Updates**: 300ms debounce on editor changes prevents excessive transform calls
- **Memory Efficient**: Content stored in TextEditorStore, no string duplication across components
- **Store-Based Architecture**: Lightweight events without large string payloads
- **Transform Caching**: Transform pipeline caches loaded scripts for repeated executions
- **Incremental Updates**: Only transforms and saves when content actually changes
- **Isolated State**: Each editor gets its own store instance for clean separation

### Component Dependencies

- `createTextEditorStore` from `../../stores/text-editor-store.js` - Text editor state management
- `OutlineGenerator` from `../../outline/outline-generator.js` - Static utility methods
- `ContentPreview` from `../preview/ContentPreview.svelte` - Preview display
- `IWorkspaceManager` from `../../workspace/types.js` - File operations interface
- `SpineItemManager` from `../../spine/spine-item-manager.js` - Chapter management
- `TransformPipeline` from `../../transform/transform-pipeline.js` - Content transformation
- Design system tokens from `../../styles/` - Accessibility and styling

### Browser Compatibility

- **Modern browsers only** (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)
- **File system features** require secure context (HTTPS or localhost)
- **Transform execution** uses Web Workers for script isolation
- **Accessibility features** work with screen readers and high contrast modes

---

## Questions for Clarification

1. ✅ **Title Extraction**: Use transformed XHTML files only for title extraction

2. ✅ **File Access Method**: Use `workspaceManager.readTextFile()` for direct file access

3. ✅ **Error Handling Strategy**: Skip missing/unreadable XHTML files and continue with remaining spine items

4. ✅ **Default Navigation Structure**: Simple flat list initially, with nested structure as a future enhancement

The API specification is now complete and ready for implementation!
