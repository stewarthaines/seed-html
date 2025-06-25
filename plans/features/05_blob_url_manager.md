# 05. Blob URL Manager

## Overview

Converts manifest items from storage into blob URLs and substitutes them in XHTML content for preview iframe usage. Enables preview iframes to load EPUB assets (CSS, JS, SVG) using standard relative URLs without modifying the original EPUB HTML structure.

## Requirements

- Convert manifest items to blob URLs for preview
- Handle different content types (text, image, audio, video)
- Simple memory management with workspace-based cleanup
- **URL substitution for preview iframe** - Replace relative EPUB URLs with blob URLs
- Preserve original EPUB HTML structure (no manual URL modification)
- Support standard EPUB asset references: `images/play.svg`, `scripts/responsive.js`
- Hard limit of 100 blob URLs with user notification on limit
- Minimal error handling with fixed error indicators

## Dependencies

- **#1 File Storage API** - for reading manifest item content and direct file access

## Technical Approach

- **OPFS Optimization**: Direct File object blob URLs for zero-copy performance
- **Dual-path creation**: Direct file access (OPFS) vs content reading (IndexedDB)
- Generate blob URLs with consistent MIME type detection
- Track created URLs for simple workspace-based cleanup
- **Parse and substitute resource references in XHTML content**
- Process XHTML before sending to preview iframe
- Maintain mapping between relative paths and blob URLs
- Enforce 100 blob URL limit with user notification
- CSS processing handled by caller (not included in this manager)

## API Design

```typescript
interface BlobURLManager {
  // Workspace management
  setActiveWorkspace(workspaceId: string): void;

  // Blob creation
  createBlobURL(filePath: string): Promise<string>;
  createBlobFromContent(content: ArrayBuffer | string, mimeType: string): string;

  // URL management
  revokeBlobURL(url: string): void;
  cleanup(): void; // Revoke all URLs for current workspace

  // Content processing
  processXHTMLForPreview(xhtmlContent: string): Promise<string>;

  // Utilities
  getMimeType(filePath: string): string;
  isResourcePath(href: string): boolean;
  getBlobURLCount(): number;
  isAtCapacity(): boolean;

  // Events (via callback, no event emitter)
  onCapacityReached?: () => void;
}

interface BlobURLManagerConfig {
  maxBlobURLs: number; // Default: 100
  fileStorage: FileStorageAPI;
  basePath: string; // EPUB content base path (e.g., "OEBPS" from WorkspacePathInfo)
  onCapacityReached?: () => void;
}

interface BlobURLRegistry {
  urls: Map<string, string>; // filePath -> blobURL
  created: Map<string, Date>; // track creation time
  count: number;
  maxCount: number;
}

// Error classes
export class BlobURLError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'BlobURLError';
  }
}

export class BlobURLCapacityError extends BlobURLError {
  constructor(currentCount: number, maxCount: number) {
    super(`Blob URL capacity exceeded: ${currentCount}/${maxCount}`, 'CAPACITY_EXCEEDED');
  }
}

export class XHTMLProcessingError extends BlobURLError {
  constructor(
    message: string,
    public originalError?: Error
  ) {
    super(message, 'XHTML_PROCESSING_ERROR');
  }
}

// Extended File Storage API for OPFS optimization
interface FileStorageAPI {
  // Existing methods
  readFile(workspaceId: string, filePath: string): Promise<ArrayBuffer>;
  writeFile(workspaceId: string, filePath: string, content: ArrayBuffer | string): Promise<void>;
  deleteFile(workspaceId: string, filePath: string): Promise<void>;

  // OPFS optimization methods
  supportsDirectBlobURLs(): boolean;
  getFile(workspaceId: string, filePath: string): Promise<File>;
}
```

## OPFS Optimization Strategy

### Performance Benefits

- **Zero-copy blob creation** - Direct File object access without ArrayBuffer copying
- **Instant blob URLs** - No memory transfer for large assets (images, audio, video)
- **Lower memory usage** - Files stay in OPFS, not duplicated in memory
- **Better for large files** - No memory limits for image/media blob creation

### Backend Detection

```typescript
// Automatic detection based on File Storage API capabilities
if (fileStorage.supportsDirectBlobURLs()) {
  // OPFS path: Safari, Firefox, Chrome+Edge on http://
  // Use direct File objects (zero-copy)
} else {
  // IndexedDB path: Chrome+Edge on https://, fallback scenarios
  // Use traditional content reading (with memory copy)
}
```

### Dual-Path Implementation

```typescript
async createBlobURL(filePath: string): Promise<string> {
  try {
    if (this.fileStorage.supportsDirectBlobURLs()) {
      // OPFS: Direct file access (zero-copy)
      const file = await this.fileStorage.getFile(this.activeWorkspaceId, filePath)
      const mimeType = this.getMimeType(filePath) // Always use our detection
      const correctedFile = new File([file], file.name, { type: mimeType })
      return URL.createObjectURL(correctedFile)
    } else {
      // IndexedDB: Traditional content reading
      const content = await this.fileStorage.readFile(this.activeWorkspaceId, filePath)
      const mimeType = this.getMimeType(filePath)
      const blob = new Blob([content], { type: mimeType })
      return URL.createObjectURL(blob)
    }
  } catch (error) {
    throw new BlobURLError(`Failed to create blob URL for ${filePath}: ${error.message}`, 'CREATION_FAILED')
  }
}
```

### MIME Type Consistency

- **Always use our detection** - Ignore File.type property for consistency
- **Override File object type** - Create new File with correct MIME type
- **Consistent behavior** - Both OPFS and IndexedDB paths use same MIME logic

## MIME Type Detection

Uses shared MIME type utility from `src/lib/utils/mime-types.ts` (extracted from EPUBPackager):

```typescript
import { getMimeType } from '../utils/mime-types.js';

// Consistent MIME type detection across the application
const mimeType = getMimeType('chapter.xhtml'); // "application/xhtml+xml"
const cssType = getMimeType('style.css'); // "text/css"
const imageType = getMimeType('cover.jpg'); // "image/jpeg"
```

## Resource URL Substitution Strategy

### XHTML Processing (Simplified)

1. **Parse XHTML content** for resource references using DOM parser
2. **Find asset elements**: `<img>`, `<audio>`, `<video>`, `<script>`, `<link>`
3. **Extract relative URLs**: `href` and `src` attributes
4. **Resolve to workspace paths**: Convert `images/play.svg` → `{basePath}/images/play.svg`
5. **Check capacity**: Stop processing if 100 blob URL limit reached
6. **Create blob URLs**: Generate blob URL for each manifest item
7. **Replace in content**: Substitute original URLs with blob URLs
8. **Preserve absolute URLs**: Leave `http://`, `data:`, `blob:` URLs unchanged
9. **Error handling**: Throw error if DOM parsing fails

### CSS Processing

- **Not handled by this manager** - CSS url() substitution is the caller's responsibility
- **Simple blob creation only** - CSS files get blob URLs but content is not processed

```typescript
// Path resolution using configured base path from workspace
function resolveManifestPath(relativeUrl: string, basePath: string): string {
  // Convert relative URL to full workspace path
  // images/play.svg + "OEBPS" -> OEBPS/images/play.svg
  // styles/main.css + "content" -> content/styles/main.css
  return basePath ? `${basePath}/${relativeUrl}` : relativeUrl;
}

function isRelativeURL(url: string): boolean {
  return (
    !url.startsWith('http') &&
    !url.startsWith('data:') &&
    !url.startsWith('blob:') &&
    !url.startsWith('/')
  ); // Absolute paths
}
```

### Example Substitution

```html
<!-- Original EPUB XHTML -->
<link rel="stylesheet" href="styles/page.css" />
<script src="scripts/responsive.js"></script>
<img src="images/play.svg" alt="Play" />

<!-- After blob URL substitution -->
<link rel="stylesheet" href="blob:null/abc123-css" />
<script src="blob:null/def456-js"></script>
<img src="blob:null/ghi789-svg" alt="Play" />
```

## URL Substitution Workflow

### 1. XHTML Processing Pipeline (Simplified)

```typescript
async function processXHTMLForPreview(xhtmlContent: string): Promise<string> {
  // 1. Check capacity before processing
  if (this.isAtCapacity()) {
    this.onCapacityReached?.();
    throw new BlobURLCapacityError(this.getBlobURLCount(), this.maxBlobURLs);
  }

  // 2. Parse XHTML with DOMParser - throw error if fails
  const doc = new DOMParser().parseFromString(xhtmlContent, 'application/xhtml+xml');

  if (doc.documentElement.tagName === 'parsererror') {
    throw new XHTMLProcessingError('Invalid XHTML content');
  }

  // 3. Find all asset references
  const assetElements = findAssetElements(doc);

  // 4. Create blob URLs for each asset (check capacity for each)
  await processAssetElements(assetElements);

  // 5. Serialize back to string
  return new XMLSerializer().serializeToString(doc);
}
```

### 2. Optimized Blob Creation Process

1. **Detect storage backend** capabilities (OPFS vs IndexedDB)
2. **OPFS path**: Get File object directly (zero-copy)
3. **IndexedDB path**: Read content then create Blob (memory copy)
4. **Apply consistent MIME type** using our detection logic
5. **Generate blob URL** using URL.createObjectURL()
6. **Register URL** for cleanup tracking
7. **Return blob URL** for substitution

**Performance Comparison:**

- **OPFS**: `getFile() → new File() → URL.createObjectURL()` (instant)
- **IndexedDB**: `readFile() → new Blob() → URL.createObjectURL()` (memory copy)

### 3. Optimized Capacity Management

```typescript
async function createBlobURL(filePath: string): Promise<string> {
  // Check if we're at capacity
  if (this.getBlobURLCount() >= this.maxBlobURLs) {
    this.onCapacityReached?.();
    throw new BlobURLCapacityError(this.getBlobURLCount(), this.maxBlobURLs);
  }

  // Check if already cached
  if (this.registry.urls.has(filePath)) {
    return this.registry.urls.get(filePath)!;
  }

  // Create new blob URL using optimal path
  let blobURL: string;

  if (this.fileStorage.supportsDirectBlobURLs()) {
    // OPFS: Zero-copy approach
    const file = await this.fileStorage.getFile(this.activeWorkspaceId, filePath);
    const mimeType = this.getMimeType(filePath);
    const correctedFile = new File([file], file.name, { type: mimeType });
    blobURL = URL.createObjectURL(correctedFile);
  } else {
    // IndexedDB: Traditional approach
    const content = await this.fileStorage.readFile(this.activeWorkspaceId, filePath);
    const mimeType = this.getMimeType(filePath);
    const blob = new Blob([content], { type: mimeType });
    blobURL = URL.createObjectURL(blob);
  }

  // Register for cleanup
  this.registry.urls.set(filePath, blobURL);
  this.registry.created.set(filePath, new Date());
  this.registry.count++;

  return blobURL;
}
```

## Resource Reference Detection

### DOM-based Parsing (Preferred)

```typescript
// Use DOMParser for accurate HTML parsing
const parser = new DOMParser();
const doc = parser.parseFromString(xhtmlContent, 'application/xhtml+xml');

// Find elements with asset references
const linkElements = doc.querySelectorAll('link[href]');
const scriptElements = doc.querySelectorAll('script[src]');
const imgElements = doc.querySelectorAll('img[src]');
const audioElements = doc.querySelectorAll('audio[src]');
const videoElements = doc.querySelectorAll('video[src]');
```

### Regex Fallback Patterns

```typescript
// Fallback regex patterns for edge cases
const RESOURCE_PATTERNS = [
  /<link[^>]+href=["']([^"']+)["']/g,
  /<img[^>]+src=["']([^"']+)["']/g,
  /<audio[^>]+src=["']([^"']+)["']/g,
  /<video[^>]+src=["']([^"']+)["']/g,
  /<script[^>]+src=["']([^"']+)["']/g,
  // CSS @import and url() patterns
  /@import\s+url\(["']?([^"'\)]+)["']?\)/g,
  /@import\s+["']([^"']+)["']/g,
  /url\(["']?([^"'\)]+)["']?\)/g,
];
```

### URL Classification

```typescript
function isRelativeURL(url: string): boolean {
  return (
    !url.startsWith('http') &&
    !url.startsWith('data:') &&
    !url.startsWith('blob:') &&
    !url.startsWith('/')
  ); // Absolute paths
}

function resolveManifestPath(relativeUrl: string, basePath = 'OEBPS'): string {
  return `${basePath}/${relativeUrl}`;
}
```

## Memory Management (Simplified)

### Workspace-Based Cleanup

- **Simple strategy**: Clean up all blob URLs when switching workspaces
- **No timeouts**: URLs persist until workspace switch or manual cleanup
- **Hard limit**: Maximum 100 blob URLs, stop creating new ones when reached
- **User notification**: Callback when capacity is reached

### Memory Monitoring

- **Check memory before large files**: Use basic memory availability check
- **No complex monitoring**: Simple blob URL counting only
- **Manual cleanup**: Optional cleanup() method for explicit cleanup

## Caching Strategy (Simplified)

### Memory-Only Blob URL Cache

- **Cache blob URLs** by manifest file path in memory only
- **Reuse existing blob URLs** for same content within workspace
- **Content-based invalidation**: New blob content invalidates cached URL
- **Simple cleanup**: Clear all on workspace switch
- **No persistence**: Cache lost on page refresh (acceptable for transient URLs)

### No Content Processing Cache

- **No XHTML caching**: Process XHTML fresh each time (minimal overhead)
- **No CSS processing**: CSS url() substitution handled by caller
- **Simple approach**: Focus on blob URL creation and caching only

## Error Handling Strategy (Simplified)

### Missing Asset Handling

**CSS/JavaScript Files Missing:**

- Log console warning with file path
- Leave original relative URL in content (browser will show 404)
- Continue processing other assets

**Image/Media Files Missing:**

- Replace src with fixed error icon data URL
- Log console warning
- Use simple red circle SVG error icon

**XHTML Processing Errors:**

- Throw XHTMLProcessingError if DOM parsing fails
- No regex fallback - fail fast and clearly

```typescript
const ERROR_ICON_SVG = `data:image/svg+xml,${encodeURIComponent(`
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#f44336" stroke="#d32f2f"/>
    <text x="12" y="16" text-anchor="middle" fill="white" font-size="12">!</text>
  </svg>
`)}`;

async function handleMissingAsset(element: Element, assetPath: string): Promise<void> {
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'link' || tagName === 'script') {
    console.warn(`Missing asset: ${assetPath}`);
    // Leave original URL - will 404
  } else if (tagName === 'img') {
    console.warn(`Missing image: ${assetPath}`);
    element.setAttribute('src', ERROR_ICON_SVG);
    element.setAttribute('alt', `Missing: ${assetPath}`);
  }
}
```

### Other Error Scenarios

- **Invalid MIME type**: Default to 'application/octet-stream'
- **Blob creation failures**: Log error, leave original URL
- **DOM parsing errors**: Fall back to regex substitution
- **CSS parsing failures**: Return original CSS content

## Performance Considerations (Optimized)

### OPFS Performance Benefits

- **Zero-copy blob creation** - Direct File objects eliminate memory copying
- **Instant large file handling** - Multi-MB images/audio create blob URLs instantly
- **Lower memory footprint** - Files stay in OPFS, not duplicated in RAM
- **Better browser responsiveness** - No blocking memory transfers

### General Optimization Strategies

- **Lazy blob creation** - Only create blobs when assets are referenced
- **Avoid duplicates** - Reuse blob URLs for identical file paths
- **DOM parsing** - Use DOMParser only (no regex fallback)
- **Single-file processing** - Process one XHTML file at a time
- **Backend-aware processing** - Use optimal path based on storage backend
- **Capacity limits** - Stop at 100 blob URLs to prevent memory issues

### Efficient URL Substitution

```typescript
// Simple sequential processing (no parallel complexity)
async function processAssetElements(elements: Element[]): Promise<void> {
  for (const element of elements) {
    const src = element.getAttribute('src') || element.getAttribute('href');
    if (src && isRelativeURL(src)) {
      try {
        const manifestPath = resolveManifestPath(src);
        const blobURL = await this.createBlobURL(manifestPath);
        element.setAttribute(element.hasAttribute('src') ? 'src' : 'href', blobURL);
      } catch (error) {
        handleAssetError(element, src, error);
      }
    }
  }
}
```

### Memory Management

- **Workspace cleanup** - Clear all URLs when switching workspaces via `setActiveWorkspace()`
- **Simple cleanup strategy** - No memory limits or reference counting
- **Manual cleanup** - Optional `cleanup()` method for explicit cleanup

```typescript
class BlobURLManager {
  private activeWorkspaceId: string | null = null;
  private blobURLs = new Map<string, string>(); // filePath -> blobURL

  setActiveWorkspace(workspaceId: string): void {
    if (this.activeWorkspaceId !== workspaceId) {
      this.cleanup(); // Clean up previous workspace URLs
      this.activeWorkspaceId = workspaceId;
    }
  }

  cleanup(): void {
    // Revoke all blob URLs for current workspace
    for (const blobURL of this.blobURLs.values()) {
      URL.revokeObjectURL(blobURL);
    }
    this.blobURLs.clear();
  }
}
```

## Testing Considerations

- Test blob creation for all supported file types
- Test URL substitution accuracy
- Test memory cleanup functionality
- Test with large files and many resources
- Verify MIME type detection
- Test error handling scenarios

## File Structure

The blob URL manager will be implemented in `src/lib/blob-url/` using kebab-case file naming:

```
src/lib/blob-url/
├── index.ts                    # Main exports and public API
├── blob-url-manager.ts         # BlobURLManager class - core operations
├── url-substitution.ts         # XHTML processing and URL substitution
├── types.ts                    # All TypeScript interfaces and types
├── utils.ts                    # Helper functions and utilities
├── API.md                      # Comprehensive API documentation
└── test/                       # Test files
    ├── blob-url-manager.test.ts
    ├── url-substitution.test.ts
    └── utils.test.ts
```

**Note:** MIME type detection uses the shared utility `src/lib/utils/mime-types.ts` (extracted from EPUBPackager) for consistency across features.

## Implementation Steps (Simplified)

### Phase 1: Core Blob Management

1. **File Storage Integration** - Read manifest items from storage
2. **MIME Type Detection** - Accurate content type mapping
3. **Blob URL Generation** - Basic blob creation and URL generation
4. **Capacity Management** - 100 URL limit with user notification

### Phase 2: XHTML Processing

1. **DOM Parser Integration** - Parse XHTML with proper XML handling
2. **Asset Element Detection** - Find all elements with asset references
3. **URL Classification** - Identify relative vs absolute URLs
4. **Basic Substitution** - Replace relative URLs with blob URLs

### Phase 3: Error Handling & Cleanup

1. **Missing Asset Handling** - Error icons and console warnings
2. **Workspace Cleanup** - Simple cleanup on workspace switch
3. **Error Classes** - Proper error types and messaging
4. **Integration Testing** - Test with File Storage API and Transform Pipeline

## API Integration

### File Storage Integration

```typescript
// Simple dependency injection
class BlobURLManager {
  constructor(private config: BlobURLManagerConfig) {
    this.fileStorage = config.fileStorage;
    this.maxBlobURLs = config.maxBlobURLs || 100;
    this.onCapacityReached = config.onCapacityReached;
  }

  private async readFile(filePath: string): Promise<ArrayBuffer | string> {
    if (!this.activeWorkspaceId) {
      throw new BlobURLError('No active workspace set', 'NO_WORKSPACE');
    }
    return this.fileStorage.readFile(this.activeWorkspaceId, filePath);
  }
}

// Usage with file storage and workspace path info
const workspaceManager = new WorkspaceManager();
const pathInfo = await workspaceManager.getWorkspacePathInfo('workspace-123');

const blobURLManager = new BlobURLManager({
  fileStorage,
  basePath: pathInfo.basePath, // e.g., "OEBPS"
  maxBlobURLs: 100,
  onCapacityReached: () => alert('Blob URL limit reached!'),
});
blobURLManager.setActiveWorkspace('workspace-123');
```

### Transform Pipeline Integration

```typescript
// Transform Pipeline calls blob manager as needed
class TransformPipeline {
  constructor(private blobURLManager: BlobURLManager) {}

  async transformForPreview(xhtmlContent: string): Promise<string> {
    // 1. Apply text transforms first
    let transformedContent = await this.applyTextTransforms(xhtmlContent);

    // 2. Apply DOM transforms
    transformedContent = await this.applyDOMTransforms(transformedContent);

    // 3. Process with blob URL substitution
    transformedContent = await this.blobURLManager.processXHTMLForPreview(transformedContent);

    return transformedContent;
  }
}

// Simple workspace switching
function switchWorkspace(newWorkspaceId: string): void {
  blobURLManager.setActiveWorkspace(newWorkspaceId); // Automatically cleans up old URLs
  // Transform pipeline automatically gets new workspace context
}
```

## Testing Priority (Simplified)

### Core Functionality

- **Asset substitution accuracy** - Verify all relative URLs are replaced correctly
- **Content integrity** - Ensure XHTML structure and content are preserved
- **Capacity management** - Test 100 blob URL limit and user notification
- **Error handling** - Missing assets show appropriate warnings/icons

### Integration Testing

- **File storage integration** - Test with both OPFS and IndexedDB backends
- **Backend detection** - Verify correct path selection based on `supportsDirectBlobURLs()`
- **OPFS optimization** - Test zero-copy blob creation with large files
- **Workspace switching** - Verify cleanup on workspace change
- **Transform pipeline integration** - Test blob URL substitution after transforms

### Simplified Edge Cases

- **Malformed XHTML** - Test parser error throwing (no fallback)
- **Mixed content** - Absolute and relative URLs in same document
- **Capacity limits** - Behavior when 100 URL limit is reached

### Error Scenarios

```typescript
// Test cases for simplified error handling
test('missing CSS shows console warning and preserves URL', async () => {
  const xhtml = '<link rel="stylesheet" href="missing.css">';
  const processed = await blobURLManager.processXHTMLForPreview(xhtml);
  expect(console.warn).toHaveBeenCalledWith('Missing asset: OEBPS/missing.css');
  expect(processed).toContain('href="missing.css"'); // Original URL preserved
});

test('missing image shows fixed error icon', async () => {
  const xhtml = '<img src="missing.jpg" alt="test">';
  const processed = await blobURLManager.processXHTMLForPreview(xhtml);
  expect(processed).toContain('data:image/svg+xml');
  expect(processed).toContain('alt="Missing: OEBPS/missing.jpg"');
});

test('capacity limit throws error and calls callback', async () => {
  const onCapacityReached = jest.fn();
  const manager = new BlobURLManager({ fileStorage, maxBlobURLs: 2, onCapacityReached });

  // Fill capacity
  await manager.createBlobURL('file1.jpg');
  await manager.createBlobURL('file2.jpg');

  // Should throw on third
  await expect(manager.createBlobURL('file3.jpg')).rejects.toThrow(BlobURLCapacityError);
  expect(onCapacityReached).toHaveBeenCalled();
});

test('malformed XHTML throws error without fallback', async () => {
  const invalidXHTML = '<div><span>unclosed tags';
  await expect(blobURLManager.processXHTMLForPreview(invalidXHTML)).rejects.toThrow(
    XHTMLProcessingError
  );
});
```
