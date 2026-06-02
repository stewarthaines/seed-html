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

## Questions for Clarification

1. ✅ **Title Extraction**: Use transformed XHTML files only for title extraction

2. ✅ **File Access Method**: Use `workspaceManager.readTextFile()` for direct file access

3. ✅ **Error Handling Strategy**: Skip missing/unreadable XHTML files and continue with remaining spine items

4. ✅ **Default Navigation Structure**: Simple flat list initially, with nested structure as a future enhancement

The API specification is now complete and ready for implementation!
