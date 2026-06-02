# Persistent Iframe Transform API Documentation

This document describes the public API for the simplified persistent iframe transform system components. This system works alongside the existing transform pipeline to provide real-time preview capabilities with immediate script updates.

## Types

### Core Interfaces

```typescript
export interface TransformRequest {
  plainText: string;
  timeout?: number;
}

export interface TransformResult {
  success: boolean;
  html?: string;
  warnings?: string[];
  error?: {
    stage: 'execution' | 'parsing';
    message: string;
    stack?: string;
  };
  executionTime?: number;
}

export interface PreviewConfig {
  includeStylesheets: boolean; // true for spine items, false for outline
  debounceMs: number; // Re-render debouncing
  transformTimeout: number; // Script execution timeout
}

export interface ChapterMetadata {
  title: string;
  language: string;
  stylesheets: string[];
  scripts: string[];
  customHead?: string;
}

export interface ContentTransformResult {
  success: boolean;
  xhtml?: string;
  warnings?: string[];
  error?: Error;
}

export interface WorkspaceScript {
  path: string;
  name: string;
}

export interface WorkspaceExtension {
  path: string;
  name: string;
}
```

## PersistentTransformIframe

Manages a persistent sandboxed iframe for transform script execution.

**File:** `src/lib/transform/persistent-iframe/persistent-transform-iframe.ts`

### Constructor

```typescript
constructor(
  blobURLManager: BlobURLManager,
  workspaceManager: IWorkspaceManager
)
```

### Public Methods

#### setWorkspace

```typescript
async setWorkspace(workspaceId: string): Promise<void>
```

Set the active workspace and load JavaScript extensions via blob URLs.

**Parameters:**

- `workspaceId: string` - The workspace identifier to activate

**Side Effects:**

- Loads JavaScript extensions from `SOURCE/extensions/` via blob URLs
- Sets up iframe for the specific workspace context

#### updateTransformScripts

```typescript
async updateTransformScripts(
  textTransform?: string,
  domTransforms?: string[]
): Promise<void>
```

Update transform scripts by passing content directly to iframe.

**Parameters:**

- `textTransform?: string` - JavaScript code for text transformation function
- `domTransforms?: string[]` - Array of JavaScript code for DOM transformation functions

**Side Effects:**

- Replaces existing transform functions in iframe memory
- No blob URL management needed - content passed directly

#### executeTransform

```typescript
async executeTransform(request: TransformRequest): Promise<TransformResult>
```

Execute transform pipeline with current loaded scripts and extensions.

**Parameters:**

- `request: TransformRequest` - Transform request with plainText and optional timeout

**Returns:**

- `Promise<TransformResult>` - Transform result with HTML or error information

**Side Effects:**

- Executes transform in sandboxed iframe
- Applies text transform followed by DOM transforms

#### updateExtension

```typescript
async updateExtension(extensionPath: string): Promise<void>
```

Update a JavaScript extension when its file changes.

**Parameters:**

- `extensionPath: string` - Path to the extension file that changed

**Side Effects:**

- Creates new blob URL for the extension
- Reloads extension in iframe
- Revokes old blob URL

#### cleanup

```typescript
cleanup(): void
```

Clean up iframe, blob URLs, and pending requests.

**Side Effects:**

- Removes iframe from DOM
- Revokes all extension blob URLs
- Clears pending transform requests

## PreviewManager

Coordinates file watching, transform execution, and preview generation for editors.

**File:** `src/lib/transform/persistent-iframe/preview-manager.ts`

### Constructor

```typescript
constructor(
  workspaceId: string,
  blobURLManager: BlobURLManager,
  workspaceManager: IWorkspaceManager,
  config: PreviewConfig
)
```

### Public Methods

#### setEditingContext

```typescript
async setEditingContext(context: {
  sourceFile?: string;
  sourceContent: string;
  metadata: ChapterMetadata;
}): Promise<void>
```

Set the current editing context and start watching relevant files.

**Parameters:**

- `sourceFile?: string` - Optional source file path to watch
- `sourceContent: string` - Current content being edited
- `metadata: ChapterMetadata` - Chapter metadata for XHTML generation

**Side Effects:**

- Starts file watching for source, scripts, stylesheets, and extensions
- Loads transform scripts into iframe
- Triggers initial preview render

#### updateSourceContent

```typescript
updateSourceContent(content: string): void
```

Update source content from editor (triggers debounced preview update).

**Parameters:**

- `content: string` - New source content from editor

**Side Effects:**

- Updates internal content state
- Triggers debounced preview regeneration

#### cleanup

```typescript
cleanup(): void
```

Stop file watching, clean up iframe, and clear timers.

**Side Effects:**

- Stops all file watchers
- Cleans up transform iframe
- Clears debounce timers

### Callback Properties

#### onPreviewReady

```typescript
onPreviewReady?: (xhtml: string, warnings: string[]) => void
```

Called when transform succeeds and preview XHTML is ready.

**Parameters:**

- `xhtml: string` - Complete XHTML document ready for preview
- `warnings: string[]` - Non-fatal warnings from transform process

#### onPreviewError

```typescript
onPreviewError?: (error: any) => void
```

Called when transform fails or encounters errors.

**Parameters:**

- `error: any` - Error object or message describing the failure

## ContentTransformService

Simplified service for executing transforms without preview management.

**File:** `src/lib/transform/persistent-iframe/content-transform-service.ts`

### Constructor

```typescript
constructor(
  blobURLManager: BlobURLManager,
  workspaceManager: IWorkspaceManager
)
```

### Public Methods

#### setWorkspace

```typescript
async setWorkspace(workspaceId: string): Promise<void>
```

Set the active workspace for transform operations.

**Parameters:**

- `workspaceId: string` - Workspace identifier to activate

**Side Effects:**

- Initializes persistent iframe for workspace
- Loads JavaScript extensions

#### validateAndTransformUserContent

```typescript
async validateAndTransformUserContent(
  plainText: string,
  workspaceId: string,
  contentId: string,
  metadata: ChapterMetadata
): Promise<ContentTransformResult>
```

Execute transform pipeline and return XHTML result or error.

**Parameters:**

- `plainText: string` - Source content to transform
- `workspaceId: string` - Workspace containing transform scripts
- `contentId: string` - Identifier for the content being transformed
- `metadata: ChapterMetadata` - Metadata for XHTML document generation

**Returns:**

- `Promise<ContentTransformResult>` - Transform result with XHTML or error

**Side Effects:**

- Executes transform in persistent iframe
- Generates complete XHTML document with metadata

#### cleanup

```typescript
cleanup(): void
```

Clean up resources and iframe.

**Side Effects:**

- Cleans up persistent iframe
- Revokes blob URLs

## Usage Patterns

### Basic Preview Setup (Outline Editor)

```typescript
import { PreviewManager } from '$lib/transform/persistent-iframe/preview-manager.js';

const previewManager = new PreviewManager(workspaceId, blobURLManager, workspaceManager, {
  includeStylesheets: false, // No CSS for outline editing
  debounceMs: 300,
  transformTimeout: 2000,
});

previewManager.onPreviewReady = (xhtml, warnings) => {
  displayNavigationPreview(xhtml);
  if (warnings.length > 0) showWarnings(warnings);
};

previewManager.onPreviewError = error => {
  displayTransformError(error);
};

await previewManager.setEditingContext({
  sourceFile: 'SOURCE/text/nav.txt',
  sourceContent: navigationText,
  metadata: {
    title: 'Table of Contents',
    language: 'en',
    stylesheets: [],
    scripts: [],
    customHead: undefined,
  },
});

// Update when user types
function onTextChange(newContent: string) {
  previewManager.updateSourceContent(newContent);
}
```

### Chapter Preview Setup (Spine Editor)

```typescript
import { PreviewManager } from '$lib/transform/persistent-iframe/preview-manager.js';

const previewManager = new PreviewManager(workspaceId, blobURLManager, workspaceManager, {
  includeStylesheets: true, // Include CSS for chapters
  debounceMs: 300,
  transformTimeout: 2000,
});

previewManager.onPreviewReady = (xhtml, warnings) => {
  displayChapterPreview(xhtml);
  if (warnings.length > 0) showWarnings(warnings);
};

previewManager.onPreviewError = error => {
  preventSave();
  displayTransformError(error);
};

await previewManager.setEditingContext({
  sourceFile: 'SOURCE/text/chapter1.txt',
  sourceContent: chapterText,
  metadata: {
    title: 'Chapter 1: Introduction',
    language: 'en',
    stylesheets: ['../Styles/main.css', '../Styles/chapter.css'],
    scripts: [],
    customHead: undefined,
  },
});
```

### Direct Transform Service

```typescript
import { ContentTransformService } from '$lib/transform/persistent-iframe/content-transform-service.js';

const transformService = new ContentTransformService(blobURLManager, workspaceManager);

await transformService.setWorkspace(workspaceId);

const result = await transformService.validateAndTransformUserContent(
  plainText,
  workspaceId,
  'chapter1',
  metadata
);

if (result.success) {
  await saveXHTMLFile(result.xhtml);
} else {
  handleTransformError(result.error);
  showWarnings(result.warnings);
}
```

### Standalone Iframe Usage

```typescript
import { PersistentTransformIframe } from '$lib/transform/persistent-iframe/persistent-transform-iframe.js';

const iframe = new PersistentTransformIframe(blobURLManager, workspaceManager);

await iframe.setWorkspace(workspaceId);

// Load transform scripts
const textTransformCode = await readTextTransformScript();
const domTransformCodes = await readDomTransformScripts();

await iframe.updateTransformScripts(textTransformCode, domTransformCodes);

// Execute transform
const result = await iframe.executeTransform({
  plainText: 'Source content here...',
  timeout: 3000,
});

if (result.success) {
  console.log('Transformed HTML:', result.html);
} else {
  console.error('Transform failed:', result.error);
}

// Cleanup when done
iframe.cleanup();
```

## Integration with Existing Transform System

The persistent iframe system is designed to work alongside the existing `TransformPipeline`:

- **Existing system**: Used for final EPUB generation and batch processing
- **Persistent iframe**: Used for real-time preview and script development
- **Shared scripts**: Both systems use the same transform scripts from `SOURCE/scripts/`
- **Shared extensions**: Both systems load from `SOURCE/extensions/`

## File Watching and Script Development

The system automatically watches for changes to:

- Source files (`SOURCE/text/*.txt`)
- Transform scripts (`SOURCE/scripts/*.js`)
- Stylesheets (`OEBPS/Styles/*.css`)
- JavaScript extensions (`SOURCE/extensions/*.js`)

When files change:

- **Transform scripts**: Content is read and passed directly to iframe
- **Extensions**: New blob URLs are created and loaded
- **Stylesheets**: Blob URLs are updated for preview
- **Source files**: Content is reloaded and preview updated

## Performance Characteristics

- **Single persistent iframe**: No iframe recreation overhead
- **Direct script passing**: Transform scripts loaded as content, not blob URLs
- **Blob URL optimization**: Only used for large extension libraries
- **Debounced updates**: Prevents excessive re-renders during typing
- **Context switching**: Efficient workspace and file set changes

## Error Handling

All components provide comprehensive error handling:

```typescript
try {
  const result = await transformService.validateAndTransformUserContent(
    plainText,
    workspaceId,
    contentId,
    metadata
  );

  if (!result.success) {
    console.error('Transform failed:', result.error?.message);
    if (result.warnings?.length) {
      console.warn('Warnings:', result.warnings);
    }
  }
} catch (error) {
  console.error('Service error:', error);
}
```

Error types:

- **Script loading errors**: Missing or invalid transform scripts
- **Extension loading errors**: Failed to load JavaScript extensions
- **Transform execution errors**: Runtime errors in transform functions
- **Timeout errors**: Transform execution exceeded timeout limit
- **XHTML generation errors**: Failed to create valid XHTML document

## Dependencies

- `BlobURLManager` from `../../blob-url/blob-url-manager.js`
- `IWorkspaceManager` from `../../workspace/index.js`
- `FileWatcher` from `../../workspace/file-watcher.js`
- Existing transform types from `../types.js`
