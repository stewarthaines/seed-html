# Transform Pipeline API Documentation

## Overview

The Transform Pipeline executes JavaScript transform scripts to convert plain text sources into XHTML spine items with proper error handling and sandboxing. It provides a secure, extensible system for text and DOM transformations using user-defined scripts and 3rd party libraries.

**Main Classes:**

- `TransformPipeline` - Core pipeline execution and management
- `TransformManager` - Script loading and validation from SOURCE/ directory
- `TransformError` - Transform error handling and user messaging
- `XHTMLTemplateGenerator` - XHTML document generation with metadata

## Core Files

- **`transform-pipeline.ts`** - Main TransformPipeline class with execution methods
- **`transform-manager.ts`** - Script loading and validation from SOURCE/scripts/
- **`transform-error.ts`** - Error handling and user-friendly messaging
- **`xhtml-template.ts`** - XHTML document generation and template system
- **`types.ts`** - Complete TypeScript interfaces and type definitions
- **`index.ts`** - Clean API exports

## Key Features

- Secure sandboxed JavaScript execution with 2-second timeout
- Sequential pipeline: text transform → DOM transforms in order
- Integration with SOURCE.zip for script loading
- 3rd party library support via global injection
- Context-aware transforms for advanced features (navigation TOC)
- Fail-fast error handling with detailed user messaging
- XHTML template system with metadata support

## Class Documentation

### TransformPipeline

#### constructor()

```typescript
constructor(
  private fileStorage: FileStorageAPI,
  private blobUrlManager: BlobUrlManager
)
```

**Input:**

- `fileStorage: FileStorageAPI` - File storage instance for workspace operations
- `blobUrlManager: BlobUrlManager` - Blob URL manager for library loading

**Output:** `TransformPipeline` - Transform pipeline instance

**Side Effects:** None (dependencies are stored for later use)

**Usage:**

```typescript
import { FileStorageAPI } from '$lib/storage';
import { BlobUrlManager } from '$lib/blob-url';
import { TransformPipeline } from '$lib/transform';

const storage = new FileStorageAPI();
const blobManager = new BlobUrlManager();
const pipeline = new TransformPipeline(storage, blobManager);
```

#### executeTransformPipeline()

```typescript
async executeTransformPipeline(
  plainText: string,
  workspaceId: string,
  spineItemId: string,
  chapterMetadata: ChapterMetadata
): Promise<TransformResult>
```

**Input:**

- `plainText: string` - Source plain text content to transform
- `workspaceId: string` - Workspace identifier containing transform scripts
- `spineItemId: string` - Current spine item being transformed
- `chapterMetadata: ChapterMetadata` - Metadata for XHTML template generation

**Output:** `Promise<TransformResult>` - Complete transformation result with XHTML document

**Side Effects:**

- Loads and executes transform scripts from SOURCE/scripts/
- Creates blob URLs for 3rd party extension libraries
- Generates final XHTML document with template system

**Usage:**

```typescript
const metadata = {
  title: 'Chapter 1',
  language: 'en',
  stylesheets: ['../Styles/stylesheet.css'],
  scripts: [],
};

const result = await pipeline.executeTransformPipeline(
  '# Chapter 1\n\nContent here...',
  'workspace-123',
  'chapter1',
  metadata
);

if (result.success) {
  console.log('Transform completed:', result.xhtmlDocument);
} else {
  console.error('Transform failed:', result.error?.toUserMessage());
}
```

#### transformText()

```typescript
async transformText(
  plainText: string,
  workspaceId: string,
  spineItemId: string
): Promise<TransformResult>
```

**Input:**

- `plainText: string` - Source plain text to transform
- `workspaceId: string` - Workspace containing transform scripts and settings
- `spineItemId: string` - Current spine item identifier

**Output:** `Promise<TransformResult>` - Text transformation result with HTML content

**Side Effects:**

- Loads text transform script from SOURCE/scripts/ based on settings.json
- Executes transform function in sandboxed context with 2-second timeout
- Provides context with manifest items for advanced features

**Usage:**

```typescript
const result = await pipeline.transformText(
  '# Heading\n\nMarkdown content',
  'workspace-123',
  'chapter1'
);

if (result.success) {
  console.log('Transformed HTML:', result.transformedText);
} else {
  console.error('Text transform error:', result.error?.message);
}
```

#### transformDOM()

```typescript
async transformDOM(
  xhtmlDocument: Document,
  workspaceId: string,
  spineItemId: string
): Promise<Document>
```

**Input:**

- `xhtmlDocument: Document` - XHTML document to transform
- `workspaceId: string` - Workspace containing DOM transform scripts
- `spineItemId: string` - Current spine item identifier

**Output:** `Promise<Document>` - Transformed XHTML document

**Side Effects:**

- Loads DOM transform scripts from SOURCE/scripts/ based on settings.json
- Executes transforms sequentially in order specified
- Clones document to avoid modifying original

**Usage:**

```typescript
const parser = new DOMParser();
const doc = parser.parseFromString(htmlContent, 'application/xhtml+xml');

const transformedDoc = await pipeline.transformDOM(doc, 'workspace-123', 'chapter1');
console.log('DOM transformed:', transformedDoc.documentElement.outerHTML);
```

#### generateXHTMLDocument()

```typescript
generateXHTMLDocument(
  content: string,
  metadata: ChapterMetadata
): string
```

**Input:**

- `content: string` - Transformed HTML content for document body
- `metadata: ChapterMetadata` - Document metadata (title, stylesheets, scripts)

**Output:** `string` - Complete XHTML document as string

**Side Effects:** None (pure function)

**Usage:**

```typescript
const metadata = {
  title: 'Chapter 1: Introduction',
  language: 'en',
  stylesheets: ['../Styles/main.css', '../Styles/chapter.css'],
  scripts: ['../Scripts/reader.js'],
};

const xhtml = pipeline.generateXHTMLDocument('<h1>Chapter 1</h1><p>Content...</p>', metadata);
console.log('Generated XHTML:', xhtml);
```

### TransformManager

#### constructor()

```typescript
constructor(private fileStorage: FileStorageAPI)
```

**Input:**

- `fileStorage: FileStorageAPI` - File storage instance for script loading

**Output:** `TransformManager` - Transform script manager instance

**Side Effects:** None

#### loadTransformScripts()

```typescript
async loadTransformScripts(workspaceId: string): Promise<TransformScripts>
```

**Input:**

- `workspaceId: string` - Workspace containing SOURCE/scripts/ directory

**Output:** `Promise<TransformScripts>` - Loaded transform scripts with metadata

**Side Effects:**

- Reads settings.json to determine which scripts to load
- Loads script files from SOURCE/scripts/ directory
- Validates script file existence and accessibility

**Usage:**

```typescript
const manager = new TransformManager(fileStorage);
const scripts = await manager.loadTransformScripts('workspace-123');

if (scripts.textTransform) {
  console.log('Text transform loaded:', scripts.textTransform.filename);
}

console.log('DOM transforms loaded:', scripts.domTransforms.length);
```

#### loadTransformSettings()

```typescript
async loadTransformSettings(workspaceId: string): Promise<TransformSettings>
```

**Input:**

- `workspaceId: string` - Workspace containing SOURCE/settings.json

**Output:** `Promise<TransformSettings>` - Transform pipeline settings

**Side Effects:**

- Reads and parses SOURCE/settings.json
- Validates settings structure and script references

**Usage:**

```typescript
const settings = await manager.loadTransformSettings('workspace-123');
console.log('Text transform script:', settings.transform_pipeline?.text_transform);
console.log('DOM transform scripts:', settings.transform_pipeline?.dom_transforms);
```

#### validateTransformScript()

```typescript
validateTransformScript(
  scriptContent: string,
  expectedFunctions: ('transformText' | 'transformDOM')[]
): ValidationResult
```

**Input:**

- `scriptContent: string` - JavaScript source code to validate
- `expectedFunctions: array` - Functions that should be present in script

**Output:** `ValidationResult` - Validation results with errors and warnings

**Side Effects:** None (static analysis only)

**Usage:**

```typescript
const validation = manager.validateTransformScript(scriptContent, ['transformText']);

if (!validation.isValid) {
  console.error('Script validation errors:', validation.errors);
}
```

### TransformError

#### constructor()

```typescript
constructor(details: {
  stage: 'text' | 'dom' | 'template' | 'loading';
  message: string;
  scriptName?: string;
  line?: number;
  column?: number;
  stack?: string;
})
```

**Input:**

- `details: object` - Error details including stage, message, and location

**Output:** `TransformError` - Transform error instance

**Side Effects:** None

#### toUserMessage()

```typescript
toUserMessage(): string
```

**Input:** None

**Output:** `string` - User-friendly error message

**Side Effects:** None

**Usage:**

```typescript
try {
  await pipeline.transformText(plainText, workspaceId, spineItemId);
} catch (error) {
  if (error instanceof TransformError) {
    console.error('User message:', error.toUserMessage());
    console.error('Technical details:', error.message);
    console.error('Error stage:', error.stage);
    if (error.scriptName) {
      console.error('Script:', error.scriptName);
    }
  }
}
```

#### getErrorDetails()

```typescript
getErrorDetails(): TransformErrorDetails
```

**Input:** None

**Output:** `TransformErrorDetails` - Complete error information for debugging

**Side Effects:** None

**Usage:**

```typescript
const errorDetails = transformError.getErrorDetails();
console.log('Stage:', errorDetails.stage);
console.log('Script:', errorDetails.scriptName);
console.log('Location:', `${errorDetails.line}:${errorDetails.column}`);
```

## Type Definitions

```typescript
interface TransformResult {
  success: boolean;
  transformedText?: string; // Output from text transform
  xhtmlDocument?: Document; // Final XHTML document
  warnings?: string[]; // Non-fatal issues
  error?: TransformError; // Transform failure details
  executionTime?: number; // Transform duration in milliseconds
}

interface TransformScripts {
  textTransform?: TransformScript; // Text transform script
  domTransforms: TransformScript[]; // DOM transform scripts in order
  settings: TransformSettings; // Pipeline settings from SOURCE/settings.json
}

interface TransformScript {
  filename: string; // Script filename (relative to SOURCE/scripts/)
  content: string; // JavaScript source code
  lastModified?: Date; // File modification time
  size: number; // File size in bytes
}

interface TransformSettings {
  transform_pipeline?: {
    text_transform?: string; // Text transform script filename
    dom_transforms?: string[]; // DOM transform script filenames in order
    enabled?: boolean; // Pipeline enabled/disabled
    timeout_ms?: number; // Custom timeout (default 2000ms)
  };
}

interface ChapterMetadata {
  title: string; // Document title
  language: string; // Document language (en, fr, etc.)
  stylesheets: string[]; // CSS stylesheet hrefs
  scripts: string[]; // JavaScript script srcs
  customHead?: string; // Additional head content
}

interface TransformContext {
  workspaceId: string; // Current workspace identifier
  spineItemId: string; // Current spine item being transformed
  manifestItems?: Record<string, string>; // Manifest ID to blob URL mapping (for :toc directive)
  settings?: any; // Workspace settings for transform access
}

interface ValidationResult {
  isValid: boolean; // Overall validation status
  errors: string[]; // Critical validation errors
  warnings: string[]; // Non-critical validation issues
  requiredFunctions?: string[]; // Missing required function names
}

interface TransformErrorDetails {
  stage: 'text' | 'dom' | 'template' | 'loading';
  message: string; // Error message
  scriptName?: string; // Script that failed
  line?: number; // Error line number
  column?: number; // Error column number
  stack?: string; // JavaScript stack trace
  userMessage: string; // User-friendly error description
}
```

## Common Integration Patterns

### Basic Text Transform Execution

```typescript
import { TransformPipeline } from '$lib/transform';
import { FileStorageAPI } from '$lib/storage';
import { BlobUrlManager } from '$lib/blob-url';

// Initialize pipeline
const storage = new FileStorageAPI();
const blobManager = new BlobUrlManager();
const pipeline = new TransformPipeline(storage, blobManager);

// Execute text transform
async function transformChapter(plainText: string, workspaceId: string) {
  try {
    const result = await pipeline.transformText(plainText, workspaceId, 'chapter1');

    if (result.success) {
      return result.transformedText;
    } else {
      throw new Error(result.error?.toUserMessage());
    }
  } catch (error) {
    console.error('Transform failed:', error.message);
    throw error;
  }
}
```

### Complete Pipeline with XHTML Generation

```typescript
import { TransformPipeline } from '$lib/transform';

// Full pipeline execution
async function processSpineItem(plainText: string, workspaceId: string, spineItemId: string) {
  const pipeline = new TransformPipeline(storage, blobManager);

  const metadata = {
    title: 'Chapter Title',
    language: 'en',
    stylesheets: ['../Styles/main.css'],
    scripts: [],
  };

  const result = await pipeline.executeTransformPipeline(
    plainText,
    workspaceId,
    spineItemId,
    metadata
  );

  if (result.success) {
    // Save XHTML document to workspace
    const xhtmlContent = result.xhtmlDocument!.documentElement.outerHTML;
    await storage.writeTextFile(workspaceId, `OEBPS/Text/${spineItemId}.xhtml`, xhtmlContent);

    return result;
  } else {
    // Handle transform error
    console.error('Pipeline error:', result.error?.toUserMessage());

    // Show warnings if any
    if (result.warnings?.length) {
      console.warn('Transform warnings:', result.warnings);
    }

    throw result.error;
  }
}
```

### Advanced Transform with Navigation Context

```typescript
// Transform with manifest context for :toc directive support
async function transformWithNavigationContext(
  plainText: string,
  workspaceId: string,
  spineItemId: string,
  manifestItems: Record<string, string>
) {
  const pipeline = new TransformPipeline(storage, blobManager);

  // The pipeline will automatically provide manifestItems in transform context
  // Transform scripts can access this via context.manifestItems for :toc directives
  const result = await pipeline.transformText(plainText, workspaceId, spineItemId);

  return result;
}
```

### Extension Library Management

```typescript
import { TransformPipeline } from '$lib/transform';
import { BlobUrlManager } from '$lib/blob-url';

// Load extension libraries as globals
async function setupTransformEnvironment(workspaceId: string) {
  const blobManager = new BlobUrlManager();

  // Load extension libraries from SOURCE/extensions/
  const extensionLibraries = [
    'SOURCE/extensions/markdown-it/markdown-it.min.js',
    'SOURCE/extensions/abcjs/abcjs-basic.min.js',
  ];

  // Libraries will be loaded as globals in the transform execution context
  // Transform scripts can then use: new markdownit(), ABCJS.renderAbc(), etc.

  const pipeline = new TransformPipeline(storage, blobManager);
  return pipeline;
}
```

### Error Handling and Recovery

```typescript
import { TransformError } from '$lib/transform';

async function transformWithErrorHandling(plainText: string, workspaceId: string) {
  try {
    const result = await pipeline.transformText(plainText, workspaceId, 'chapter1');

    if (result.success) {
      // Check for warnings
      if (result.warnings?.length) {
        console.warn('Transform completed with warnings:', result.warnings);
      }
      return result.transformedText;
    } else {
      throw result.error;
    }
  } catch (error) {
    if (error instanceof TransformError) {
      // Get user-friendly error message
      const userMessage = error.toUserMessage();
      console.error('Transform error:', userMessage);

      // Get technical details for debugging
      const details = error.getErrorDetails();
      console.debug('Error details:', details);

      // Handle different error stages
      switch (error.stage) {
        case 'loading':
          console.error('Failed to load transform script:', details.scriptName);
          break;
        case 'text':
          console.error('Text transform failed:', details.message);
          break;
        case 'dom':
          console.error('DOM transform failed:', details.message);
          break;
        case 'template':
          console.error('XHTML template generation failed:', details.message);
          break;
      }

      // Provide fallback behavior
      return plainText; // Return original text on transform failure
    } else {
      // Handle other errors
      console.error('Unexpected error:', error);
      throw error;
    }
  }
}
```

### Custom Transform Script Development

```typescript
// Example transform script structure for SOURCE/scripts/markdown-transform.js

function transformText(plainText, context) {
  // Access global libraries loaded from SOURCE/extensions/
  if (typeof markdownit === 'undefined') {
    throw new Error('markdown-it library not available. Please add to SOURCE/extensions/');
  }

  // Initialize markdown processor
  const md = markdownit({
    html: true,
    xhtmlOut: true,
    breaks: false,
    linkify: true,
    typographer: true,
  });

  // Access transform context for advanced features
  if (context.manifestItems) {
    // Handle :toc directives for navigation
    plainText = plainText.replace(/:toc\[([^\]]+)\]\{src="([^"]+)"\}/g, (match, title, pattern) => {
      // Use context.manifestItems to build table of contents
      return generateTOC(title, pattern, context.manifestItems);
    });
  }

  // Transform markdown to HTML
  return md.render(plainText);
}

function transformDOM(document) {
  // Add IDs to headings for navigation
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

  headings.forEach((heading, index) => {
    if (!heading.id) {
      const text = heading.textContent || '';
      const id =
        text
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') || `heading-${index + 1}`;

      heading.id = id;
    }
  });

  return document;
}

// Helper function for :toc directive
function generateTOC(title, pattern, manifestItems) {
  // Implementation for generating table of contents
  // from manifest items matching the pattern
  return `<h2>${title}</h2><ul>...</ul>`;
}
```

## Error Handling

The Transform Pipeline uses comprehensive error handling with user-friendly messaging:

```typescript
try {
  const result = await pipeline.executeTransformPipeline(
    plainText,
    workspaceId,
    spineItemId,
    metadata
  );
} catch (error) {
  if (error instanceof TransformError) {
    switch (error.stage) {
      case 'loading':
        // Script loading errors - missing files, invalid syntax
        console.error('Script loading failed:', error.toUserMessage());
        break;
      case 'text':
        // Text transform runtime errors
        console.error('Text transform failed:', error.toUserMessage());
        break;
      case 'dom':
        // DOM transform runtime errors
        console.error('DOM transform failed:', error.toUserMessage());
        break;
      case 'template':
        // XHTML template generation errors
        console.error('Template generation failed:', error.toUserMessage());
        break;
    }
  }
}
```

Common error scenarios:

- **Missing transform scripts** - Scripts referenced in settings.json don't exist
- **Script syntax errors** - Invalid JavaScript in transform scripts
- **Runtime errors** - Exceptions during transform function execution
- **Timeout errors** - Transform functions exceed 2-second limit
- **Library errors** - Missing or incompatible extension libraries
- **Context errors** - Invalid manifest items or workspace data

## Testing

**Comprehensive unit tests** covering all TransformPipeline methods:

- Mock File Storage API and Blob URL Manager integration
- Transform script loading and validation
- Text and DOM transform execution with various inputs
- Error handling and timeout scenarios
- XHTML template generation and metadata handling
- Extension library loading and global injection

Run tests with: `npm test src/lib/transform`

## Performance Notes

- **2-second timeout** for all transform function execution
- **No caching** - Transform functions re-evaluated each execution
- **Sequential execution** - DOM transforms applied in order specified
- **Fail-fast behavior** - Pipeline stops on first error
- **Memory efficiency** - Document cloning for DOM transforms
- **Global library loading** - Extension libraries available as globals

## Security Considerations

- **Sandboxed execution** - Transform functions run in restricted context
- **Dangerous globals removed** - eval, Function, setTimeout, etc. not available
- **Library whitelisting** - Only approved extension libraries loaded as globals
- **Timeout protection** - Prevents infinite loops and long-running operations
- **Content validation** - Transform outputs validated before use

## Integration Notes

- **SOURCE.zip Integration** - Scripts and extensions loaded from SOURCE/ structure
- **Blob URL Manager** - Extension libraries loaded via blob URLs for security
- **File Storage API** - Seamless integration with OPFS/IndexedDB backends
- **Navigation Editor** - Manifest context provided for :toc directive support
- **EPUB Workflows** - XHTML generation compatible with EPUB standards
