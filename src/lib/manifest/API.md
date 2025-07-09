# ManifestManager Public API

This document defines the complete public API for the ManifestManager system, including all interfaces, type definitions, and method signatures needed for EPUB manifest management and content operations.

## Core Interfaces

### ManifestManager

```typescript
interface IManifestManager {
  // Core data operations
  loadManifest(workspaceId: string): Promise<ManifestItem[]>;
  getManifestItem(workspaceId: string, itemId: string): Promise<ManifestItem>;
  updateManifestItem(
    workspaceId: string,
    itemId: string,
    updates: Partial<ManifestItem>
  ): Promise<void>;
  deleteManifestItem(workspaceId: string, itemId: string): Promise<void>;

  // Content operations
  getItemContent(workspaceId: string, itemId: string): Promise<ArrayBuffer | string>;
  setItemContent(workspaceId: string, itemId: string, content: ArrayBuffer | string): Promise<void>;
  getContentPreview(workspaceId: string, itemId: string): Promise<ContentPreview>;

  // Item creation operations
  createTextItem(workspaceId: string, itemData: CreateTextItemData): Promise<ManifestItem>;
  createFileItem(workspaceId: string, file: File, targetPath?: string): Promise<ManifestItem>;
  importFileItem(
    workspaceId: string,
    filePath: string,
    content: ArrayBuffer
  ): Promise<ManifestItem>;

  // Manifest structure operations
  reorderManifestItems(workspaceId: string, itemIds: string[]): Promise<void>;
  getManifestOrder(workspaceId: string): Promise<string[]>;
  validateManifest(workspaceId: string): Promise<ValidationResult[]>;

  // Advanced mode operations
  listSourceItems(workspaceId: string): Promise<SourceItem[]>;
  getSourceItemContent(workspaceId: string, sourcePath: string): Promise<ArrayBuffer | string>;
  isAdvancedModeEnabled(workspaceId: string): Promise<boolean>;

  // Utility operations
  generateItemId(fileName: string): string;
  detectMediaType(fileName: string, content?: ArrayBuffer): string;
  getMediaTypeCategories(): MediaTypeCategories;

  // Cache management
  clearCache(workspaceId?: string): void;
  preloadManifest(workspaceId: string): Promise<void>;
  clearContentCache(workspaceId: string, itemId?: string): void;
}
```

### ManifestValidator

```typescript
class ManifestValidator {
  static validateManifestItem(item: Partial<ManifestItem>): ValidationResult[];
  static validateItemId(id: string, existingIds: string[]): ValidationResult | null;
  static validateHref(href: string, existingHrefs: string[]): ValidationResult | null;
  static validateMediaType(mediaType: string): ValidationResult | null;
  static validateProperties(properties: string[]): ValidationResult[];
  static validateManifestStructure(items: ManifestItem[]): ValidationResult[];
}
```

### ManifestUtils

```typescript
class ManifestUtils {
  static generateItemId(fileName: string): string;
  static detectMediaType(fileName: string, content?: ArrayBuffer): string;
  static getMediaTypeCategories(): MediaTypeCategories;
  static createBlobUrl(content: ArrayBuffer | string, mediaType: string): string;
  static revokeBlobUrl(url: string): void;
  static formatFileSize(bytes: number): string;
  static getFileExtension(fileName: string): string;
  static sanitizeFileName(fileName: string): string;
}
```

## Type Definitions

### ManifestItem

```typescript
interface ManifestItem {
  // Required EPUB manifest fields
  id: string; // Unique identifier within manifest
  href: string; // Relative path within EPUB
  mediaType: string; // MIME type

  // Optional EPUB manifest fields
  properties?: string[]; // EPUB properties (e.g., 'nav', 'cover-image')

  // Extended metadata for management
  size?: number; // File size in bytes
  modified?: Date; // Last modification time
  isInSpine?: boolean; // Whether item appears in spine
  spineIndex?: number; // Position in spine (if applicable)
}
```

### CreateTextItemData

```typescript
interface CreateTextItemData {
  id?: string; // Optional ID (will be generated if not provided)
  fileName: string; // File name (e.g., 'chapter1.xhtml')
  content: string; // Text content
  mediaType?: string; // Optional media type (will be detected if not provided)
  properties?: string[]; // Optional EPUB properties
  targetDirectory?: string; // Optional subdirectory (defaults to 'OEBPS/')
}
```

### ContentPreview

```typescript
interface ContentPreview {
  itemId: string;
  mediaType: string;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'binary';
  previewUrl?: string; // Blob URL for binary content
  textContent?: string; // For text content types
  metadata?: ContentMetadata;
  error?: string; // If preview generation failed
}
```

### ContentMetadata

```typescript
interface ContentMetadata {
  // Image metadata
  width?: number;
  height?: number;

  // Audio/Video metadata
  duration?: number;
  bitrate?: number;

  // Text metadata
  characterCount?: number;
  lineCount?: number;
  wordCount?: number;
}
```

### SourceItem

```typescript
interface SourceItem {
  path: string; // Relative path within SOURCE directory
  name: string; // File name
  type: 'file' | 'directory';
  size?: number; // Size in bytes (for files)
  modified?: Date; // Last modification time
  mediaType?: string; // Detected MIME type (for files)
}
```

### ValidationResult

```typescript
interface ValidationResult {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  itemId?: string; // For item-specific validation errors
}
```

### MediaTypeCategories

```typescript
interface MediaTypeCategories {
  text: MediaTypeDefinition[];
  image: MediaTypeDefinition[];
  audio: MediaTypeDefinition[];
  video: MediaTypeDefinition[];
  application: MediaTypeDefinition[];
}

interface MediaTypeDefinition {
  mediaType: string;
  extensions: string[];
  description: string;
  isEpubCore?: boolean; // Whether it's a core EPUB media type
}
```

## Method Specifications

### loadManifest()

```typescript
loadManifest(workspaceId: string): Promise<ManifestItem[]>
```

**Input:**

- `workspaceId: string` - Unique identifier for the workspace

**Output:** `Promise<ManifestItem[]>` - Array of all manifest items in manifest order

**Side Effects:**

- Loads manifest from WorkspaceManager OPF data if not cached
- Updates internal manifest cache
- May throw errors if workspace doesn't exist or OPF is corrupted

**Usage:**

```typescript
const manifestItems = await manifestManager.loadManifest('workspace-123');
console.log(`Found ${manifestItems.length} items in manifest`);
```

### getManifestItem()

```typescript
getManifestItem(workspaceId: string, itemId: string): Promise<ManifestItem>
```

**Input:**

- `workspaceId: string` - Unique identifier for the workspace
- `itemId: string` - Manifest item ID

**Output:** `Promise<ManifestItem>` - Complete manifest item data

**Side Effects:**

- Loads manifest if not cached
- May throw error if item doesn't exist

### updateManifestItem()

```typescript
updateManifestItem(workspaceId: string, itemId: string, updates: Partial<ManifestItem>): Promise<void>
```

**Input:**

- `workspaceId: string` - Unique identifier for the workspace
- `itemId: string` - Manifest item ID to update
- `updates: Partial<ManifestItem>` - Fields to update

**Output:** `Promise<void>` - Resolves when item is updated and persisted

**Side Effects:**

- Updates manifest in WorkspaceManager OPF data
- Updates internal manifest cache
- Persists changes to content.opf file
- May throw errors on save failures or validation failures

**Usage:**

```typescript
await manifestManager.updateManifestItem('workspace-123', 'chapter1', {
  properties: ['nav'],
  mediaType: 'application/xhtml+xml',
});
```

### deleteManifestItem()

```typescript
deleteManifestItem(workspaceId: string, itemId: string): Promise<void>
```

**Input:**

- `workspaceId: string` - Unique identifier for the workspace
- `itemId: string` - Manifest item ID to delete

**Output:** `Promise<void>` - Resolves when item is deleted and persisted

**Side Effects:**

- Removes item from manifest in WorkspaceManager OPF data
- Deletes associated file content from workspace
- Updates internal manifest cache
- Clears any cached content for the item
- May throw errors if item doesn't exist or is referenced in spine

### getItemContent()

```typescript
getItemContent(workspaceId: string, itemId: string): Promise<ArrayBuffer | string>
```

**Input:**

- `workspaceId: string` - Unique identifier for the workspace
- `itemId: string` - Manifest item ID

**Output:** `Promise<ArrayBuffer | string>` - File content (string for text types, ArrayBuffer for binary)

**Side Effects:**

- Loads content from WorkspaceManager file operations
- Caches content in memory (with size limits)
- May throw errors if file doesn't exist

**Usage:**

```typescript
const content = await manifestManager.getItemContent('workspace-123', 'chapter1');
if (typeof content === 'string') {
  console.log('Text content:', content);
} else {
  console.log('Binary content size:', content.byteLength);
}
```

### setItemContent()

```typescript
setItemContent(workspaceId: string, itemId: string, content: ArrayBuffer | string): Promise<void>
```

**Input:**

- `workspaceId: string` - Unique identifier for the workspace
- `itemId: string` - Manifest item ID
- `content: ArrayBuffer | string` - New content

**Output:** `Promise<void>` - Resolves when content is saved

**Side Effects:**

- Saves content to workspace file system via WorkspaceManager
- Updates content cache
- Updates manifest item metadata (size, modified date)
- May throw errors on save failures or storage quota exceeded

### getContentPreview()

```typescript
getContentPreview(workspaceId: string, itemId: string): Promise<ContentPreview>
```

**Input:**

- `workspaceId: string` - Unique identifier for the workspace
- `itemId: string` - Manifest item ID

**Output:** `Promise<ContentPreview>` - Preview data with appropriate content type handling

**Side Effects:**

- Loads content if not cached
- Creates blob URLs for binary content types
- Extracts metadata for supported content types
- Caches preview data

**Usage:**

```typescript
const preview = await manifestManager.getContentPreview('workspace-123', 'cover.jpg');
if (preview.contentType === 'image' && preview.previewUrl) {
  imageElement.src = preview.previewUrl;
}
```

### createTextItem()

```typescript
createTextItem(workspaceId: string, itemData: CreateTextItemData): Promise<ManifestItem>
```

**Input:**

- `workspaceId: string` - Unique identifier for the workspace
- `itemData: CreateTextItemData` - Item creation data

**Output:** `Promise<ManifestItem>` - Created manifest item

**Side Effects:**

- Generates unique item ID if not provided
- Creates file in workspace with provided content
- Adds item to manifest in OPF
- Updates manifest cache
- May throw errors on validation failures or storage issues

**Usage:**

```typescript
const newItem = await manifestManager.createTextItem('workspace-123', {
  fileName: 'chapter2.xhtml',
  content: '<?xml version="1.0"?><!DOCTYPE html><html>...</html>',
  mediaType: 'application/xhtml+xml',
});
```

### createFileItem()

```typescript
createFileItem(workspaceId: string, file: File, targetPath?: string): Promise<ManifestItem>
```

**Input:**

- `workspaceId: string` - Unique identifier for the workspace
- `file: File` - File object from file input or drag-and-drop
- `targetPath?: string` - Optional target path (defaults to OEBPS/filename)

**Output:** `Promise<ManifestItem>` - Created manifest item

**Side Effects:**

- Reads file content as ArrayBuffer
- Detects media type from file extension and content
- Generates unique item ID
- Creates file in workspace storage
- Adds item to manifest in OPF
- Updates manifest cache

**Usage:**

```typescript
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const newItem = await manifestManager.createFileItem('workspace-123', file);
```

### reorderManifestItems()

```typescript
reorderManifestItems(workspaceId: string, itemIds: string[]): Promise<void>
```

**Input:**

- `workspaceId: string` - Unique identifier for the workspace
- `itemIds: string[]` - Array of item IDs in desired order

**Output:** `Promise<void>` - Resolves when manifest order is updated

**Side Effects:**

- Updates manifest order in OPF
- Updates manifest cache
- Persists changes to content.opf file

### listSourceItems()

```typescript
listSourceItems(workspaceId: string): Promise<SourceItem[]>
```

**Input:**

- `workspaceId: string` - Unique identifier for the workspace

**Output:** `Promise<SourceItem[]>` - Array of items in SOURCE directory

**Side Effects:**

- Lists contents of SOURCE directory via WorkspaceManager
- May return empty array if Advanced Mode is disabled or SOURCE doesn't exist

**Usage:**

```typescript
const sourceItems = await manifestManager.listSourceItems('workspace-123');
console.log(
  'SOURCE directory contains:',
  sourceItems.map(item => item.path)
);
```

### generateItemId()

```typescript
generateItemId(fileName: string): string
```

**Input:**

- `fileName: string` - File name to base ID on

**Output:** `string` - Unique item ID suitable for EPUB manifest

**Side Effects:** None (pure function)

**Logic:**

- Removes file extension
- Converts to lowercase
- Replaces non-alphanumeric characters with underscores
- Ensures uniqueness within current manifest

**Usage:**

```typescript
const itemId = manifestManager.generateItemId('My Chapter 1.xhtml');
// Returns: "my_chapter_1"
```

### detectMediaType()

```typescript
detectMediaType(fileName: string, content?: ArrayBuffer): string
```

**Input:**

- `fileName: string` - File name with extension
- `content?: ArrayBuffer` - Optional file content for content-based detection

**Output:** `string` - Detected MIME type

**Side Effects:** None (pure function)

**Logic:**

- Primary detection based on file extension
- Secondary detection based on content magic bytes (if provided)
- Falls back to 'application/octet-stream' for unknown types

**Usage:**

```typescript
const mediaType = manifestManager.detectMediaType('image.jpg');
// Returns: "image/jpeg"
```

## Validation Specifications

### ManifestValidator.validateManifestItem()

```typescript
static validateManifestItem(item: Partial<ManifestItem>): ValidationResult[]
```

**Input:**

- `item: Partial<ManifestItem>` - Manifest item to validate

**Output:** `ValidationResult[]` - Array of validation errors and warnings

**Validation Logic:**

- **Required fields**: id, href, mediaType must be present and non-empty
- **ID format**: Must be valid XML ID (alphanumeric, underscore, hyphen)
- **HREF format**: Must be valid relative path, no absolute URLs
- **Media type**: Must be valid MIME type format
- **Properties**: Must be valid EPUB properties if provided

### ManifestValidator.validateItemId()

```typescript
static validateItemId(id: string, existingIds: string[]): ValidationResult | null
```

**Input:**

- `id: string` - Item ID to validate
- `existingIds: string[]` - Array of existing IDs in manifest

**Output:** `ValidationResult | null` - Error if validation fails, null if valid

**Validation Logic:**

- Returns error if ID is empty or null
- Returns error if ID already exists in manifest
- Returns error if ID doesn't match XML ID format: `^[a-zA-Z_][a-zA-Z0-9_.-]*$`

### ManifestValidator.validateHref()

```typescript
static validateHref(href: string, existingHrefs: string[]): ValidationResult | null
```

**Input:**

- `href: string` - File path to validate
- `existingHrefs: string[]` - Array of existing hrefs in manifest

**Output:** `ValidationResult | null` - Error if validation fails, null if valid

**Validation Logic:**

- Returns error if href is empty or null
- Returns error if href already exists in manifest
- Returns error if href is absolute path or contains invalid characters
- Returns warning if href doesn't start with 'OEBPS/' (convention)

### ManifestValidator.validateManifestStructure()

```typescript
static validateManifestStructure(items: ManifestItem[]): ValidationResult[]
```

**Input:**

- `items: ManifestItem[]` - Complete manifest items array

**Output:** `ValidationResult[]` - Array of structural validation errors

**Validation Logic:**

- Ensures at least one item exists
- Validates that required EPUB files are present (e.g., nav document)
- Checks for orphaned spine references
- Validates media type distribution (warnings for missing core types)

## Content Type Handling

### Supported Content Types

```typescript
const CONTENT_TYPE_CATEGORIES = {
  text: {
    pattern: /^text\/|application\/(json|xml|javascript|xhtml\+xml)/,
    maxPreviewSize: 1024 * 1024, // 1MB
    encoding: 'utf-8',
  },
  image: {
    pattern: /^image\//,
    maxPreviewSize: 10 * 1024 * 1024, // 10MB
    supportedFormats: ['jpeg', 'png', 'gif', 'webp', 'svg'],
  },
  audio: {
    pattern: /^audio\//,
    maxPreviewSize: 50 * 1024 * 1024, // 50MB
    supportedFormats: ['mp3', 'ogg', 'wav', 'm4a'],
  },
  video: {
    pattern: /^video\//,
    maxPreviewSize: 100 * 1024 * 1024, // 100MB
    supportedFormats: ['mp4', 'webm', 'ogg'],
  },
};
```

### Content Loading Strategy

```typescript
interface ContentLoadingStrategy {
  // Text content: Load into string
  text: (content: ArrayBuffer) => string;

  // Image content: Create blob URL
  image: (content: ArrayBuffer, mediaType: string) => string;

  // Audio/Video: Create blob URL with metadata extraction
  media: (content: ArrayBuffer, mediaType: string) => Promise<ContentPreview>;

  // Binary: Limited metadata only
  binary: (content: ArrayBuffer) => ContentMetadata;
}
```

## Error Handling

### Expected Error Types

The ManifestManager methods may throw the following types of errors:

1. **WorkspaceNotFoundError** - When workspace doesn't exist
2. **ManifestCorruptedError** - When manifest in OPF cannot be parsed
3. **ItemNotFoundError** - When requested manifest item doesn't exist
4. **DuplicateItemError** - When trying to create item with existing ID or href
5. **StorageQuotaExceededError** - When storage limit is reached
6. **InvalidMediaTypeError** - When media type is not supported
7. **ContentTooBigError** - When file exceeds size limits
8. **ValidationError** - When manifest item validation fails

### Error Propagation

- All async methods should properly propagate errors from WorkspaceManager
- Content operations should handle large file scenarios gracefully
- Validation errors should be collected and returned as arrays
- Cache operations should handle missing entries without throwing

## Cache Management

### Manifest Cache

```typescript
interface ManifestCache {
  // Manifest items cache (keyed by workspaceId)
  manifests: Map<string, ManifestItem[]>;

  // Content cache (keyed by workspaceId:itemId)
  content: Map<string, ArrayBuffer | string>;

  // Preview cache (keyed by workspaceId:itemId)
  previews: Map<string, ContentPreview>;

  // Blob URL tracking for cleanup
  blobUrls: Set<string>;
}
```

### Cache Policies

- **Manifest items**: Cache until explicitly cleared or workspace modified
- **Content**: Cache with LRU eviction when memory limit reached
- **Previews**: Cache blob URLs but clean up when content changes
- **Size limits**: Text content max 1MB, binary content max 10MB in cache

## Usage Patterns

### Basic Manifest Operations

```typescript
const manager = new ManifestManagerImpl(workspaceManager);

// Load complete manifest
const items = await manager.loadManifest('workspace-123');

// Get specific item
const item = await manager.getManifestItem('workspace-123', 'chapter1');

// Update item properties
await manager.updateManifestItem('workspace-123', 'chapter1', {
  properties: ['nav'],
});
```

### Content Operations

```typescript
// Get content for editing
const content = await manager.getItemContent('workspace-123', 'chapter1');
if (typeof content === 'string') {
  // Edit text content
  const updatedContent = content.replace(/old/g, 'new');
  await manager.setItemContent('workspace-123', 'chapter1', updatedContent);
}

// Get preview for display
const preview = await manager.getContentPreview('workspace-123', 'cover.jpg');
if (preview.previewUrl) {
  imgElement.src = preview.previewUrl;
}
```

### File Creation

```typescript
// Create text file
const textItem = await manager.createTextItem('workspace-123', {
  fileName: 'styles.css',
  content: 'body { font-family: serif; }',
  mediaType: 'text/css',
});

// Upload binary file
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const binaryItem = await manager.createFileItem('workspace-123', file);
```

### Advanced Mode Operations

```typescript
// Check if advanced mode is enabled
const isAdvanced = await manager.isAdvancedModeEnabled('workspace-123');

if (isAdvanced) {
  // List SOURCE directory contents
  const sourceItems = await manager.listSourceItems('workspace-123');

  // Access SOURCE file content
  const sourceContent = await manager.getSourceItemContent('workspace-123', 'settings.json');
}
```

## Testing Requirements

### Unit Tests Should Cover:

1. **All public methods** with valid inputs and expected outputs
2. **Error scenarios** for each method (invalid workspace, missing items, etc.)
3. **Content type handling** for all supported media types
4. **Cache behavior** (cache hits, misses, invalidation, cleanup)
5. **Validation logic** for all manifest item fields and constraints
6. **File operations** with various file sizes and types
7. **Advanced mode** functionality and SOURCE directory operations

### Integration Tests Should Cover:

1. **WorkspaceManager integration** for all persistence operations
2. **Large file handling** and memory management
3. **Concurrent operations** on the same workspace
4. **Cache cleanup** and blob URL management
5. **Error recovery** from storage failures

### Mocking Requirements:

- **WorkspaceManager** - Use existing mock or create manifest-specific mock
- **File API** - Mock File objects for upload testing
- **Blob URLs** - Mock URL.createObjectURL/revokeObjectURL
- **Content detection** - Mock file content for media type detection

### Performance Tests Should Cover:

1. **Large manifest handling** (1000+ items)
2. **Memory usage** during content operations
3. **Cache eviction** behavior under memory pressure
4. **Concurrent content loading** performance
