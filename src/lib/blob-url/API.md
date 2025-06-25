# Blob URL Manager API Reference

## Overview

The Blob URL Manager converts EPUB manifest items into blob URLs and substitutes them in XHTML content for preview iframe usage. It enables preview iframes to load EPUB assets (CSS, JS, SVG) using standard relative URLs without modifying the original EPUB HTML structure.

**Main Classes:**

- `BlobURLManager` - Core blob URL creation and XHTML processing with OPFS optimization
- `XHTMLProcessor` - DOM-based XHTML parsing and asset URL substitution

**Shared Utilities:**

- `getMimeType()` - File extension to MIME type mapping (from `src/lib/utils/mime-types.ts`)

**Key Features:**

- **OPFS Optimization**: Zero-copy blob creation for supported browsers
- **Dual-path Backend**: Automatic OPFS vs IndexedDB detection for optimal performance
- **Capacity Management**: Hard limit of 100 blob URLs with user notification
- **XHTML Processing**: DOM-based asset URL substitution for preview iframes
- **Workspace Cleanup**: Simple memory management tied to workspace switching

## BlobURLManager Class

### Constructor

```typescript
constructor(config: BlobURLManagerConfig)
```

**Input:**

- `config: BlobURLManagerConfig` - Configuration object with file storage, base path, capacity limits, and callbacks

**Side Effects:** Initializes blob URL registry and sets up capacity management

**Usage:**

```typescript
// Get workspace path info first
const workspaceManager = new WorkspaceManager();
const pathInfo = await workspaceManager.getWorkspacePathInfo('workspace-123');

const blobURLManager = new BlobURLManager({
  fileStorage: fileStorageInstance,
  basePath: pathInfo.basePath, // e.g., "OEBPS" or "content"
  maxBlobURLs: 100,
  onCapacityReached: () => alert('Blob URL limit reached!'),
});
```

### setActiveWorkspace()

```typescript
setActiveWorkspace(workspaceId: string): void
```

**Input:**

- `workspaceId: string` - Workspace identifier to set as active

**Output:** `void`

**Side Effects:** Cleans up all existing blob URLs and resets registry for new workspace

**Usage:**

```typescript
// Switch to new workspace - automatically cleans up old blob URLs
blobURLManager.setActiveWorkspace('workspace-123');

// Previous workspace blob URLs are automatically revoked
console.log('Blob count reset:', blobURLManager.getBlobURLCount()); // 0
```

### createBlobURL()

```typescript
createBlobURL(filePath: string): Promise<string>
```

**Input:**

- `filePath: string` - Manifest item href (relative path, e.g., "images/cover.jpg", "styles/main.css")

**Output:** `Promise<string>` - Blob URL for the file content

**Side Effects:**

- Resolves relative href to full workspace path using configured base path
- Creates and registers blob URL for cleanup tracking
- Uses OPFS zero-copy path if supported, otherwise reads content into memory
- Increments blob URL count toward capacity limit

**Usage:**

```typescript
// Pass manifest item hrefs directly (without base path)
const imageURL = await blobURLManager.createBlobURL('images/cover.jpg');
// Internally resolves to: basePath + '/images/cover.jpg' (e.g., "OEBPS/images/cover.jpg")
console.log('Image blob URL:', imageURL); // blob:null/abc123-456

// Automatic caching - second call returns same URL
const cachedURL = await blobURLManager.createBlobURL('images/cover.jpg');
console.log('Same URL returned:', imageURL === cachedURL); // true

// CSS file blob creation
const cssURL = await blobURLManager.createBlobURL('styles/main.css');
// Resolves to: basePath + '/styles/main.css'
```

### createBlobFromContent()

```typescript
createBlobFromContent(content: ArrayBuffer | string, mimeType: string): string
```

**Input:**

- `content: ArrayBuffer | string` - File content data
- `mimeType: string` - MIME type for the blob

**Output:** `string` - Blob URL for the content

**Side Effects:** Creates blob URL but does not register for cleanup (caller manages)

**Usage:**

```typescript
// Create blob from generated content
const transformedCSS = 'body { background: #fff; }';
const cssBlob = blobURLManager.createBlobFromContent(transformedCSS, 'text/css');

// Create blob from binary data
const imageData = new Uint8Array([
  /* image bytes */
]);
const imageBlob = blobURLManager.createBlobFromContent(imageData.buffer, 'image/png');
```

### processXHTMLForPreview()

```typescript
processXHTMLForPreview(xhtmlContent: string): Promise<string>
```

**Input:**

- `xhtmlContent: string` - XHTML content with relative asset URLs

**Output:** `Promise<string>` - XHTML with relative URLs replaced by blob URLs

**Side Effects:**

- Parses XHTML with DOMParser
- Creates blob URLs for referenced assets
- May reach capacity limit and throw error

**Usage:**

```typescript
const originalXHTML = `
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <link rel="stylesheet" href="styles/main.css"/>
  <script src="scripts/reader.js"></script>
</head>
<body>
  <img src="images/cover.jpg" alt="Cover"/>
</body>
</html>
`;

const processedXHTML = await blobURLManager.processXHTMLForPreview(originalXHTML);
// Results in blob URLs:
// <link rel="stylesheet" href="blob:null/abc123-css"/>
// <script src="blob:null/def456-js"></script>
// <img src="images/cover.jpg" alt="Cover"/> <!-- Missing file = error icon -->
```

### revokeBlobURL()

```typescript
revokeBlobURL(url: string): void
```

**Input:**

- `url: string` - Blob URL to revoke

**Output:** `void`

**Side Effects:** Revokes blob URL and removes from registry

**Usage:**

```typescript
const blobURL = await blobURLManager.createBlobURL('OEBPS/temp-file.txt');
// Use blob URL...
blobURLManager.revokeBlobURL(blobURL);
```

### cleanup()

```typescript
cleanup(): void
```

**Input:** None

**Output:** `void`

**Side Effects:** Revokes all blob URLs and clears registry

**Usage:**

```typescript
// Manual cleanup of all blob URLs
blobURLManager.cleanup();
console.log('All blob URLs revoked:', blobURLManager.getBlobURLCount()); // 0
```

### getMimeType()

```typescript
getMimeType(filePath: string): string
```

**Input:**

- `filePath: string` - File path with extension

**Output:** `string` - MIME type for the file extension

**Side Effects:** None (pure function)

**Note:** This method delegates to the shared `getMimeType()` utility from `src/lib/utils/mime-types.ts` for consistency across the application.

**Usage:**

```typescript
console.log(blobURLManager.getMimeType('chapter.xhtml')); // "application/xhtml+xml"
console.log(blobURLManager.getMimeType('style.css')); // "text/css"
console.log(blobURLManager.getMimeType('cover.jpg')); // "image/jpeg"
console.log(blobURLManager.getMimeType('unknown.xyz')); // "application/octet-stream"
```

### isResourcePath()

```typescript
isResourcePath(href: string): boolean
```

**Input:**

- `href: string` - URL or path to check

**Output:** `boolean` - True if this is a relative resource path

**Side Effects:** None (pure function)

**Usage:**

```typescript
console.log(blobURLManager.isResourcePath('images/cover.jpg')); // true
console.log(blobURLManager.isResourcePath('http://example.com')); // false
console.log(blobURLManager.isResourcePath('data:image/png;base64')); // false
console.log(blobURLManager.isResourcePath('blob:null/abc123')); // false
console.log(blobURLManager.isResourcePath('/absolute/path')); // false
```

### getBlobURLCount()

```typescript
getBlobURLCount(): number
```

**Input:** None

**Output:** `number` - Current number of active blob URLs

**Side Effects:** None (read-only)

**Usage:**

```typescript
const count = blobURLManager.getBlobURLCount();
console.log(`${count}/100 blob URLs used`);

if (count > 80) {
  console.warn('Approaching blob URL capacity limit');
}
```

### isAtCapacity()

```typescript
isAtCapacity(): boolean
```

**Input:** None

**Output:** `boolean` - True if at maximum blob URL capacity

**Side Effects:** None (read-only)

**Usage:**

```typescript
if (blobURLManager.isAtCapacity()) {
  console.warn('Cannot create more blob URLs - at capacity');
  // Show user notification or cleanup old URLs
}
```

## Type Definitions

### BlobURLManagerConfig

```typescript
interface BlobURLManagerConfig {
  maxBlobURLs: number; // Default: 100
  fileStorage: FileStorageAPI; // File Storage API instance
  basePath: string; // EPUB content base path (from WorkspacePathInfo)
  onCapacityReached?: () => void; // Callback when limit reached
}
```

### BlobURLRegistry

```typescript
interface BlobURLRegistry {
  urls: Map<string, string>; // filePath -> blobURL mapping
  created: Map<string, Date>; // Creation time tracking
  count: number; // Current URL count
  maxCount: number; // Maximum allowed URLs
}
```

### Extended File Storage API

The Blob URL Manager extends the File Storage API with OPFS optimization methods:

```typescript
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

### Error Classes

```typescript
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
```

## OPFS Optimization Strategy

### Performance Benefits

The Blob URL Manager automatically detects OPFS support and uses the optimal path:

- **Zero-copy blob creation** - Direct File object access without ArrayBuffer copying
- **Instant blob URLs** - No memory transfer for large assets (images, audio, video)
- **Lower memory usage** - Files stay in OPFS, not duplicated in memory
- **Better browser responsiveness** - No blocking memory transfers

### Backend Detection

```typescript
import { getMimeType } from '../utils/mime-types.js';

// Automatic detection based on File Storage API capabilities
if (fileStorage.supportsDirectBlobURLs()) {
  // OPFS path: Safari, Firefox, Chrome+Edge on http://
  // Use direct File objects (zero-copy)
  const file = await fileStorage.getFile(workspaceId, filePath);
  const mimeType = getMimeType(filePath);
  const correctedFile = new File([file], file.name, { type: mimeType });
  return URL.createObjectURL(correctedFile);
} else {
  // IndexedDB path: Chrome+Edge on https://, fallback scenarios
  // Use traditional content reading (with memory copy)
  const content = await fileStorage.readFile(workspaceId, filePath);
  const mimeType = getMimeType(filePath);
  const blob = new Blob([content], { type: mimeType });
  return URL.createObjectURL(blob);
}
```

### Performance Comparison

- **OPFS**: `getFile() → new File() → URL.createObjectURL()` (instant)
- **IndexedDB**: `readFile() → new Blob() → URL.createObjectURL()` (memory copy)

For a 10MB image file:

- **OPFS**: ~1ms (zero-copy)
- **IndexedDB**: ~100ms (memory allocation and copy)

## Common Integration Patterns

### Basic Blob URL Creation

```typescript
const storage = new FileStorageAPI();
await storage.init();

const workspaceManager = new WorkspaceManager();
const pathInfo = await workspaceManager.getWorkspacePathInfo('epub-project-123');

const blobURLManager = new BlobURLManager({
  fileStorage: storage,
  basePath: pathInfo.basePath, // e.g., "OEBPS"
  maxBlobURLs: 100,
  onCapacityReached: () => {
    console.warn('Blob URL capacity reached - consider cleanup');
  },
});

// Set active workspace
blobURLManager.setActiveWorkspace('epub-project-123');

// Create blob URLs using manifest item hrefs (no base path needed)
const coverURL = await blobURLManager.createBlobURL('images/cover.jpg');
const styleURL = await blobURLManager.createBlobURL('styles/main.css');
const scriptURL = await blobURLManager.createBlobURL('scripts/reader.js');
// These resolve to: OEBPS/images/cover.jpg, OEBPS/styles/main.css, etc.

// Use in HTML
const img = document.createElement('img');
img.src = coverURL;
```

### XHTML Processing for Preview

```typescript
async function processEPUBChapterForPreview(
  workspaceId: string,
  chapterPath: string
): Promise<string> {
  // Read original XHTML content
  const content = await storage.readTextFile(workspaceId, chapterPath);

  // Process with blob URL substitution
  const processedContent = await blobURLManager.processXHTMLForPreview(content);

  return processedContent;
}

// Usage in preview iframe
const processedHTML = await processEPUBChapterForPreview(
  'workspace-123',
  'OEBPS/Text/chapter1.xhtml'
);

// Send to preview iframe
previewIframe.srcdoc = processedHTML;
```

### Transform Pipeline Integration

```typescript
class TransformPipeline {
  constructor(
    private blobURLManager: BlobURLManager,
    private transformScripts: TransformScript[]
  ) {}

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

// Usage
const pipeline = new TransformPipeline(blobURLManager, transformScripts);
const finalHTML = await pipeline.transformForPreview(originalHTML);
```

### Workspace Switching Workflow

```typescript
async function switchToWorkspace(newWorkspaceId: string): Promise<void> {
  try {
    // Automatic cleanup of previous workspace blob URLs
    blobURLManager.setActiveWorkspace(newWorkspaceId);

    // Verify workspace exists and is valid
    const workspaces = await storage.listWorkspaces();
    if (!workspaces.includes(newWorkspaceId)) {
      throw new Error(`Workspace ${newWorkspaceId} not found`);
    }

    console.log(`Switched to workspace: ${newWorkspaceId}`);
    console.log(`Blob URLs reset to: ${blobURLManager.getBlobURLCount()}`);
  } catch (error) {
    console.error('Failed to switch workspace:', error);
    throw error;
  }
}
```

### Capacity Management

```typescript
async function createBlobURLWithCapacityCheck(filePath: string): Promise<string> {
  // Check capacity before creating
  if (blobURLManager.isAtCapacity()) {
    console.warn('At blob URL capacity - cleaning up oldest URLs');

    // Custom cleanup strategy (optional)
    blobURLManager.cleanup();
  }

  try {
    return await blobURLManager.createBlobURL(filePath);
  } catch (error) {
    if (error instanceof BlobURLCapacityError) {
      // Handle capacity error
      console.error('Blob URL capacity exceeded:', error.message);
      throw new Error('Cannot create more blob URLs - storage full');
    }
    throw error;
  }
}
```

### Error Handling with Missing Assets

```typescript
async function processXHTMLWithErrorHandling(xhtmlContent: string): Promise<string> {
  try {
    return await blobURLManager.processXHTMLForPreview(xhtmlContent);
  } catch (error) {
    if (error instanceof XHTMLProcessingError) {
      console.error('XHTML processing failed:', error.message);
      // Return original content if processing fails
      return xhtmlContent;
    } else if (error instanceof BlobURLCapacityError) {
      console.warn('Blob URL capacity reached during processing');
      // Show user notification
      alert('Too many assets loaded. Some images may not display.');
      // Return partially processed content
      return xhtmlContent;
    }
    throw error;
  }
}
```

## Error Handling

### Exception Types

The Blob URL Manager throws specific error types for different failure scenarios:

```typescript
try {
  const blobURL = await blobURLManager.createBlobURL('non-existent-file.jpg');
} catch (error) {
  if (error instanceof BlobURLError) {
    switch (error.code) {
      case 'CAPACITY_EXCEEDED':
        console.log('Blob URL limit reached');
        break;
      case 'CREATION_FAILED':
        console.log('Failed to create blob URL:', error.message);
        break;
      case 'XHTML_PROCESSING_ERROR':
        console.log('XHTML parsing failed:', error.message);
        break;
      case 'NO_WORKSPACE':
        console.log('No active workspace set');
        break;
      default:
        console.error('Unknown blob URL error:', error.message);
    }
  }
}
```

### Missing Asset Handling

The XHTML processor handles missing assets gracefully:

**CSS/JavaScript Files Missing:**

- Logs console warning with file path
- Leaves original relative URL (browser shows 404)
- Continues processing other assets

**Image/Media Files Missing:**

- Replaces src with error icon data URL
- Logs console warning
- Sets alt text to indicate missing file

**XHTML Processing Errors:**

- Throws XHTMLProcessingError for malformed content
- No regex fallback - fails fast and clearly

## Performance Notes

### Browser Backend Performance

- **OPFS**: Supported in Safari, Firefox, Chrome+Edge on http://
  - Zero-copy blob creation
  - Instant large file handling
  - Lower memory footprint
- **IndexedDB**: Fallback for Chrome+Edge on https://, older browsers
  - Memory-copy blob creation
  - Slower for large files
  - Higher memory usage

### Optimization Strategies

1. **Lazy blob creation** - Only create blobs when assets are referenced
2. **Avoid duplicates** - Reuse blob URLs for identical file paths
3. **DOM parsing** - Use DOMParser only (no regex fallback)
4. **Sequential processing** - Process one XHTML file at a time
5. **Backend-aware processing** - Use optimal path based on storage backend
6. **Capacity limits** - Stop at 100 blob URLs to prevent memory issues

### Memory Management

- **Workspace cleanup** - Clear all URLs when switching workspaces
- **Simple cleanup strategy** - No memory limits or reference counting
- **Manual cleanup** - Optional `cleanup()` method for explicit cleanup

## Browser Compatibility

- **OPFS Support**: Chrome 86+, Edge 86+, Firefox 111+, Safari 15.2+
- **IndexedDB Fallback**: All modern browsers
- **File API**: All browsers with File constructor support
- **DOMParser**: Universal support for XHTML processing

The API automatically detects capabilities and uses the best available backend for optimal performance while maintaining broad browser support.

## Implementation Details

### Path Resolution

```typescript
function resolveManifestPath(href: string, basePath: string): string {
  // Handle OPF in container root (empty basePath)
  if (!basePath) return href;

  // Standard case: basePath + href
  // Examples: "OEBPS" + "images/cover.jpg" → "OEBPS/images/cover.jpg"
  return `${basePath}/${href}`;
}
```

**EPUB Specification Compliance:**

- Manifest hrefs are relative to the Package Document (content.opf) location
- No complex `../` or `./` handling needed (EPUB spec restricts these)
- Simple concatenation follows EPUB path resolution rules

### XHTML Asset Element Detection

The XHTML processor handles these element/attribute combinations:

```typescript
const ASSET_SELECTORS = [
  { tag: 'script', attr: 'src' }, // JavaScript files
  { tag: 'link', attr: 'href' }, // Stylesheets, icons
  { tag: 'a', attr: 'href' }, // Navigation links
  { tag: 'audio', attr: 'src' }, // Audio files
  { tag: 'video', attr: 'src' }, // Video files
  { tag: 'video', attr: 'poster' }, // Video poster images
  { tag: 'img', attr: 'src' }, // Images
  { tag: 'object', attr: 'data' }, // Embedded objects
  { tag: 'image', attr: 'href' }, // SVG image elements
  { tag: '*', attr: 'data-src' }, // Custom lazy-loading attributes
];
```

**CSS Processing:** CSS `url()` and `@import` references are **not handled** by this manager - they should be processed by the Transform Pipeline (Feature #12).

### Backend Detection Strategy

```typescript
class BlobURLManager {
  private supportsDirectBlobs: boolean;

  constructor(config: BlobURLManagerConfig) {
    // Cache backend capability at initialization
    this.supportsDirectBlobs = config.fileStorage.supportsDirectBlobURLs();
  }

  async createBlobURL(href: string): Promise<string> {
    // Use cached capability check (no re-detection during runtime)
    if (this.supportsDirectBlobs) {
      // OPFS zero-copy path
    } else {
      // IndexedDB memory-copy path
    }
  }
}
```

### Registry and Caching

```typescript
interface BlobURLRegistry {
  urls: Map<string, string>; // href → blobURL (uses original href as key)
  created: Map<string, Date>; // href → creation timestamp
  count: number; // Current URL count
  maxCount: number; // Capacity limit
}

// Cache key examples:
// registry.urls.set("images/cover.jpg", "blob:null/abc123")
// registry.urls.set("styles/main.css", "blob:null/def456")
```

**Cache Behavior:**

- **Key Format**: Original href (e.g., `"images/cover.jpg"`)
- **Lifetime**: Until `setActiveWorkspace()` or manual `cleanup()`
- **No Expiration**: URLs persist until explicit cleanup (no TTL)

## Error Handling Specifications

### Missing Asset Behavior

**CSS/JavaScript Files (Non-Visual Assets):**

```typescript
// Missing stylesheet or script file
console.warn(`Missing asset: ${resolvedPath} (referenced by <${tagName}> element)`);
// Leave original href unchanged - browser will show 404
element.setAttribute(attr, originalHref);
```

**Images/Media Files (Visual Assets):**

```typescript
// Missing image, video, or audio file
console.warn(`Missing image: ${resolvedPath} (referenced by <${tagName}> element)`);
// Replace with error icon and descriptive alt text
element.setAttribute('src', ERROR_ICON_SVG);
element.setAttribute('alt', `Missing: ${originalHref}`);
```

**Navigation Links:**

```typescript
// Missing <a href> targets - leave unchanged for normal 404 behavior
// No special error handling or console warnings
```

### Error Icon SVG

```typescript
const ERROR_ICON_SVG = `data:image/svg+xml,${encodeURIComponent(`
  <svg width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="#f44336" stroke="#d32f2f"/>
    <text x="12" y="16" text-anchor="middle" fill="white" font-size="12">!</text>
  </svg>
`)}`;
```

### Error Messages Format

```typescript
// Capacity errors
`Blob URL capacity exceeded: ${currentCount}/${maxCount}`
// File not found
`Missing asset: OEBPS/styles/main.css (referenced by <link> element)``Missing image: OEBPS/images/cover.jpg (referenced by <img> element)`
// XHTML processing errors
`Invalid XHTML content: ${parserError.message}`
// File storage errors
`Failed to create blob URL for ${href}: ${storageError.message}`;
```

### MIME Type Edge Cases

```typescript
// Edge case handling in getMimeType()
getMimeType('file.tar.gz'); // → "application/gzip" (last extension wins)
getMimeType('chapter'); // → "application/octet-stream" (no extension)
getMimeType('FILE.JPEG'); // → "image/jpeg" (case insensitive)
getMimeType('.htaccess'); // → "application/octet-stream" (leading dot only)
getMimeType('file.'); // → "application/octet-stream" (trailing dot)
getMimeType(''); // → "application/octet-stream" (empty string)
```

## Testing Considerations

### Mock Setup Patterns

```typescript
// Mock FileStorageAPI for testing
const mockFileStorage = {
  supportsDirectBlobURLs: jest.fn(() => true), // or false for IndexedDB path
  getFile: jest.fn(),
  readFile: jest.fn(),
  // ... other methods
};

// Mock workspace path info
const mockPathInfo = {
  rootfilePath: 'OEBPS/content.opf',
  basePath: 'OEBPS',
  opfFileName: 'content.opf',
};
```

### Sample XHTML Test Cases

```typescript
// Input XHTML with various asset types
const inputXHTML = `
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <link rel="stylesheet" href="styles/main.css"/>
  <script src="scripts/reader.js"></script>
</head>
<body>
  <img src="images/cover.jpg" alt="Cover"/>
  <video src="media/intro.mp4" poster="images/poster.jpg"/>
  <a href="chapter2.xhtml">Next Chapter</a>
</body>
</html>`;

// Expected output after processing
const expectedXHTML = `
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <link rel="stylesheet" href="blob:null/css-blob-url"/>
  <script src="blob:null/js-blob-url"></script>
</head>
<body>
  <img src="blob:null/img-blob-url" alt="Cover"/>
  <video src="blob:null/video-blob-url" poster="blob:null/poster-blob-url"/>
  <a href="chapter2.xhtml">Next Chapter</a>
</body>
</html>`;
```

### Error Scenario Test Cases

```typescript
test('missing CSS file shows warning and preserves URL', async () => {
  // Setup: file storage returns error for missing file
  mockFileStorage.readFile.mockRejectedValue(new Error('File not found'));

  const input = '<link rel="stylesheet" href="missing.css">';
  const result = await blobURLManager.processXHTMLForPreview(input);

  expect(console.warn).toHaveBeenCalledWith(
    'Missing asset: OEBPS/missing.css (referenced by <link> element)'
  );
  expect(result).toContain('href="missing.css"'); // Original preserved
});

test('missing image shows error icon', async () => {
  mockFileStorage.readFile.mockRejectedValue(new Error('File not found'));

  const input = '<img src="missing.jpg" alt="test">';
  const result = await blobURLManager.processXHTMLForPreview(input);

  expect(console.warn).toHaveBeenCalledWith(
    'Missing image: OEBPS/missing.jpg (referenced by <img> element)'
  );
  expect(result).toContain('data:image/svg+xml'); // Error icon
  expect(result).toContain('alt="Missing: missing.jpg"');
});
```

### Cache Behavior Tests

```typescript
test('blob URLs are cached by original href', async () => {
  const href = 'images/cover.jpg';

  // First call creates blob URL
  const url1 = await blobURLManager.createBlobURL(href);
  expect(mockFileStorage.getFile).toHaveBeenCalledWith('workspace-id', 'OEBPS/images/cover.jpg');

  // Second call returns cached URL
  const url2 = await blobURLManager.createBlobURL(href);
  expect(url1).toBe(url2);
  expect(mockFileStorage.getFile).toHaveBeenCalledTimes(1); // No second call
});

test('workspace switch clears cache', async () => {
  await blobURLManager.createBlobURL('images/test.jpg');
  expect(blobURLManager.getBlobURLCount()).toBe(1);

  blobURLManager.setActiveWorkspace('new-workspace');
  expect(blobURLManager.getBlobURLCount()).toBe(0);
});
```

## Internal API Reference

### Private Methods (for testing internal behavior)

```typescript
class BlobURLManager {
  // Path resolution (testable)
  private resolveManifestPath(href: string): string;

  // Asset element processing (testable)
  private findAssetElements(doc: Document): Element[];
  private processAssetElement(element: Element): Promise<void>;

  // Error handling (testable)
  private handleMissingAsset(element: Element, href: string, error: Error): void;

  // Registry management (testable)
  private addToRegistry(href: string, blobURL: string): void;
  private removeFromRegistry(href: string): void;
}
```

### Internal State Structure

```typescript
interface InternalState {
  activeWorkspaceId: string | null;
  basePath: string;
  supportsDirectBlobs: boolean;
  registry: {
    urls: Map<string, string>; // href → blob URL
    created: Map<string, Date>; // href → creation time
    count: number; // current count
    maxCount: number; // capacity limit
  };
}
```

### Test Access Patterns

```typescript
// Access internal state for testing
const manager = new BlobURLManager(config);

// Test registry state
expect(manager['registry'].count).toBe(0);
expect(manager['registry'].urls.size).toBe(0);

// Test path resolution
expect(manager['resolveManifestPath']('images/test.jpg')).toBe('OEBPS/images/test.jpg');

// Test backend detection
expect(manager['supportsDirectBlobs']).toBe(true);
```

## Integration Notes

- **File Storage API Integration**: Built on top of Feature #1 (File Storage API)
- **Transform Pipeline Ready**: Designed for integration with Feature #12 (Transform Pipeline)
- **Preview System Foundation**: Enables Features #15/#16 (Device Preview/Preview Iframe)
- **Workspace Aware**: Integrates with Feature #4 (Workspace & OPF Manager)
- **Memory Efficient**: Optimized for large EPUB files with many assets
