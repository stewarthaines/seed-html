# 06. Blob URL Manager

## Overview
Converts manifest items from storage into blob URLs and substitutes them in XHTML content for preview iframe usage. Enables preview iframes to load EPUB assets (CSS, JS, SVG) using standard relative URLs without modifying the original EPUB HTML structure.

## Requirements
- Convert manifest items to blob URLs for preview
- Handle different content types (text, image, audio, video)
- Resource cleanup and memory management
- **URL substitution for preview iframe** - Replace relative EPUB URLs with blob URLs
- Preserve original EPUB HTML structure (no manual URL modification)
- Support standard EPUB asset references: `styles/page.css`, `scripts/responsive.js`, `images/play.svg`

## Dependencies
- **#1 File Storage API** - for reading manifest item content

## Technical Approach
- Create blob objects from stored file content
- Generate blob URLs with proper MIME types
- Track created URLs for cleanup
- **Parse and substitute resource references in XHTML content**
- Process XHTML before sending to preview iframe
- Maintain mapping between relative paths and blob URLs
- Handle nested CSS @import statements and relative references

## API Design
```typescript
interface BlobURLManager {
  // Blob creation
  createBlobURL(workspaceId: string, filePath: string, mimeType: string): Promise<string>
  createBlobFromContent(content: ArrayBuffer | string, mimeType: string): string
  
  // URL management
  revokeBlobURL(url: string): void
  revokeAllURLs(): void
  
  // Content processing
  substituteResourceURLs(xhtmlContent: string, workspaceId: string): Promise<string>
  processXHTMLForPreview(xhtmlContent: string, workspaceId: string): Promise<string>
  processCSSContent(cssContent: string, basePath: string, workspaceId: string): Promise<string>
  
  // Utilities
  getMimeType(filePath: string): string
  isResourcePath(href: string): boolean
}

interface BlobURLRegistry {
  urls: Map<string, string>  // filePath -> blobURL
  created: Map<string, Date> // track creation time
  cleanup(): void
}
```

## MIME Type Detection
```typescript
const MIME_TYPES = {
  // Text
  '.html': 'text/html',
  '.xhtml': 'application/xhtml+xml',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.txt': 'text/plain',
  '.json': 'application/json',
  
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  
  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg'
}
```

## Resource URL Substitution Strategy

### XHTML Processing
1. **Parse XHTML content** for resource references using DOM parser
2. **Find asset elements**: `<link>`, `<img>`, `<audio>`, `<video>`, `<script>`
3. **Extract relative URLs**: `href` and `src` attributes
4. **Resolve to manifest paths**: Convert `styles/page.css` → `OEBPS/styles/page.css`
5. **Create blob URLs**: Generate blob URL for each manifest item
6. **Replace in content**: Substitute original URLs with blob URLs
7. **Preserve absolute URLs**: Leave `http://`, `data:`, blob URLs unchanged

### CSS Processing with Base Path Resolution
- **Extract CSS file directory** for relative path resolution
- **Parse CSS for @import** statements and url() references  
- **Resolve relative paths** from CSS file's directory context
- **Create blob URLs** for referenced assets (fonts, images)
- **Replace URLs** in CSS content before creating CSS blob

```typescript
function resolveCSSAssetPath(cssFilePath: string, relativeUrl: string): string {
  // Extract directory from CSS file path
  // OEBPS/styles/page.css -> OEBPS/styles/
  const cssDir = cssFilePath.substring(0, cssFilePath.lastIndexOf('/'))
  
  // Resolve relative path from CSS directory
  // ../images/bg.jpg from OEBPS/styles/ -> OEBPS/images/bg.jpg
  return resolvePath(cssDir, relativeUrl)
}

function resolvePath(basePath: string, relativePath: string): string {
  const parts = basePath.split('/')
  const relativeParts = relativePath.split('/')
  
  for (const part of relativeParts) {
    if (part === '..') {
      parts.pop()
    } else if (part !== '.') {
      parts.push(part)
    }
  }
  
  return parts.join('/')
}
```

### Example Substitution
```html
<!-- Original EPUB XHTML -->
<link rel="stylesheet" href="styles/page.css">
<script src="scripts/responsive.js"></script>
<img src="images/play.svg" alt="Play">

<!-- After blob URL substitution -->
<link rel="stylesheet" href="blob:null/abc123-css">
<script src="blob:null/def456-js"></script>
<img src="blob:null/ghi789-svg" alt="Play">
```

## URL Substitution Workflow

### 1. XHTML Processing Pipeline
```typescript
async function processXHTMLForPreview(xhtmlContent: string, workspaceId: string): Promise<string> {
  // 1. Parse XHTML with DOMParser
  const doc = parser.parseFromString(xhtmlContent, 'application/xhtml+xml')
  
  // 2. Find all asset references
  const assetElements = findAssetElements(doc)
  
  // 3. Create blob URLs for each asset
  const substitutions = await createBlobURLsForAssets(assetElements, workspaceId)
  
  // 4. Replace URLs in DOM
  applyURLSubstitutions(doc, substitutions)
  
  // 5. Serialize back to string
  return new XMLSerializer().serializeToString(doc)
}
```

### 2. Blob Creation Process
1. **Read file content** from storage (OPFS/IndexedDB)
2. **Determine MIME type** from file extension
3. **Process content** if needed (CSS url() substitution)
4. **Create Blob object** with proper type
5. **Generate blob URL** using URL.createObjectURL()
6. **Register URL** for cleanup tracking
7. **Cache blob URL** for reuse
8. **Return blob URL** for substitution

### 3. CSS Content Processing
```typescript
async function processCSSContent(cssContent: string, basePath: string, workspaceId: string): Promise<string> {
  // Find url() references in CSS
  const urlMatches = cssContent.match(/url\(["']?([^"'\)]+)["']?\)/g)
  
  // Create blob URLs for referenced assets
  for (const match of urlMatches) {
    const assetPath = extractURLFromMatch(match)
    if (isRelativeURL(assetPath)) {
      const manifestPath = resolveManifestPath(assetPath, basePath)
      const blobURL = await createBlobURL(workspaceId, manifestPath)
      cssContent = cssContent.replace(match, `url(${blobURL})`)
    }
  }
  
  return cssContent
}
```

## Resource Reference Detection

### DOM-based Parsing (Preferred)
```typescript
// Use DOMParser for accurate HTML parsing
const parser = new DOMParser()
const doc = parser.parseFromString(xhtmlContent, 'application/xhtml+xml')

// Find elements with asset references
const linkElements = doc.querySelectorAll('link[href]')
const scriptElements = doc.querySelectorAll('script[src]')
const imgElements = doc.querySelectorAll('img[src]')
const audioElements = doc.querySelectorAll('audio[src]')
const videoElements = doc.querySelectorAll('video[src]')
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
  /url\(["']?([^"'\)]+)["']?\)/g
]
```

### URL Classification
```typescript
function isRelativeURL(url: string): boolean {
  return !url.startsWith('http') && 
         !url.startsWith('data:') && 
         !url.startsWith('blob:') &&
         !url.startsWith('/') // Absolute paths
}

function resolveManifestPath(relativeUrl: string, basePath = 'OEBPS'): string {
  return `${basePath}/${relativeUrl}`
}
```

## Memory Management
- Track all created blob URLs
- Implement cleanup on workspace switch
- Set cleanup timeouts for unused URLs
- Monitor memory usage
- Revoke URLs when no longer needed

## Caching Strategy

### Blob URL Cache
- **Cache blob URLs** by manifest file path
- **Reuse existing blob URLs** for same content
- **Invalidate cache** when workspace files are modified
- **LRU eviction** for memory management
- **Track file modification** timestamps for cache validation

### Processed Content Cache
- **Cache processed XHTML** after URL substitution
- **Cache processed CSS** with resolved blob URLs
- **Invalidate on workspace change** or file updates
- **Memory-aware caching** with size limits

```typescript
interface BlobURLCache {
  // manifestPath -> { blobURL, created, lastAccessed }
  urls: Map<string, CachedBlobURL>
  
  // xhtmlPath -> { processedContent, dependencies, created }
  processedContent: Map<string, CachedContent>
  
  // Track memory usage
  totalMemory: number
  maxMemory: number
}
```

## Error Handling Strategy

### Missing Asset Handling
**CSS/JavaScript Files Missing:**
- Log console warning with file path
- Leave original relative URL in content (will 404 in browser)
- Continue processing other assets

**Image/Media Files Missing:**
- Replace src with error icon data URL
- Log console warning
- Use inline SVG error icon for visibility

```typescript
const ERROR_ICON_SVG = `data:image/svg+xml,${encodeURIComponent(`
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#f44336" stroke="#d32f2f"/>
    <text x="12" y="16" text-anchor="middle" fill="white" font-size="12">!</text>
  </svg>
`)}`

async function handleMissingAsset(element: Element, assetPath: string): Promise<void> {
  const tagName = element.tagName.toLowerCase()
  
  if (tagName === 'link' || tagName === 'script') {
    console.warn(`Missing asset: ${assetPath}`)
    // Leave original URL - will 404
  } else if (tagName === 'img') {
    console.warn(`Missing image: ${assetPath}`)
    element.setAttribute('src', ERROR_ICON_SVG)
    element.setAttribute('alt', `Missing: ${assetPath}`)
  }
}
```

### Other Error Scenarios
- **Invalid MIME type**: Default to 'application/octet-stream'
- **Blob creation failures**: Log error, leave original URL
- **DOM parsing errors**: Fall back to regex substitution
- **CSS parsing failures**: Return original CSS content

## Performance Considerations

### Optimization Strategies
- **Lazy blob creation** - Only create blobs when assets are referenced
- **Batch processing** - Process all assets in XHTML document together
- **Avoid duplicates** - Reuse blob URLs for identical content
- **DOM parsing** - Use DOMParser instead of regex for accuracy
- **Parallel processing** - Create multiple blob URLs concurrently
- **Memory monitoring** - Track blob URL memory usage
- **Cleanup scheduling** - Automatic cleanup of unused blob URLs

### Efficient URL Substitution
```typescript
// Process all asset elements in single DOM traversal
async function processAllAssets(doc: Document, workspaceId: string): Promise<void> {
  const assetPromises: Promise<void>[] = []
  
  // Process different element types in parallel
  assetPromises.push(processLinkElements(doc, workspaceId))
  assetPromises.push(processScriptElements(doc, workspaceId))
  assetPromises.push(processImageElements(doc, workspaceId))
  
  await Promise.all(assetPromises)
}
```

### Memory Management
- **Workspace cleanup** - Clear all URLs when switching workspaces via `setActiveWorkspace()`
- **Simple cleanup strategy** - No memory limits or reference counting
- **Manual cleanup** - Optional `cleanup()` method for explicit cleanup

```typescript
class BlobURLManager {
  private activeWorkspaceId: string | null = null
  private blobURLs = new Map<string, string>() // filePath -> blobURL
  
  setActiveWorkspace(workspaceId: string): void {
    if (this.activeWorkspaceId !== workspaceId) {
      this.cleanup() // Clean up previous workspace URLs
      this.activeWorkspaceId = workspaceId
    }
  }
  
  cleanup(): void {
    // Revoke all blob URLs for current workspace
    for (const blobURL of this.blobURLs.values()) {
      URL.revokeObjectURL(blobURL)
    }
    this.blobURLs.clear()
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

## Implementation Steps

### Phase 1: Basic Blob Creation
1. **File Storage Integration** - Read manifest items from storage
2. **MIME Type Detection** - Accurate content type mapping
3. **Blob URL Generation** - Basic blob creation and URL generation
4. **Cleanup Framework** - URL tracking and revocation system

### Phase 2: URL Substitution
1. **DOM Parser Integration** - Parse XHTML with proper XML handling
2. **Asset Element Detection** - Find all elements with asset references
3. **URL Classification** - Identify relative vs absolute URLs
4. **Basic Substitution** - Replace relative URLs with blob URLs

### Phase 3: CSS Processing
1. **CSS Parsing** - Extract url() references from stylesheets
2. **Relative Path Resolution** - Handle CSS-relative asset paths
3. **Nested Processing** - Process @import and url() recursively
4. **CSS Blob Creation** - Generate blob URLs for processed CSS

### Phase 4: Optimization
1. **Caching Layer** - Implement blob URL and content caching
2. **Memory Management** - Automatic cleanup and memory monitoring
3. **Performance Tuning** - Parallel processing and batching
4. **Error Recovery** - Graceful handling of missing assets

## API Integration

### File Storage Integration
```typescript
// Dependency injection pattern
class BlobURLManager {
  constructor(private fileStorage: FileStorageAPI) {}
  
  private async readFile(filePath: string): Promise<ArrayBuffer | string> {
    if (!this.activeWorkspaceId) {
      throw new Error('No active workspace set')
    }
    return this.fileStorage.readFile(this.activeWorkspaceId, filePath)
  }
}

// Usage with file storage
const blobURLManager = new BlobURLManager(fileStorage)
blobURLManager.setActiveWorkspace('workspace-123')
```

### Preview Integration
```typescript
// Usage in preview iframe creation
async function createPreviewIframe(xhtmlPath: string): Promise<HTMLIFrameElement> {
  // 1. Ensure workspace is set
  blobURLManager.setActiveWorkspace(currentWorkspaceId)
  
  // 2. Read original XHTML from storage
  const originalXHTML = await fileStorage.readFile(currentWorkspaceId, xhtmlPath)
  
  // 3. Process XHTML with blob URL substitution
  const processedXHTML = await blobURLManager.processXHTMLForPreview(originalXHTML)
  
  // 4. Create iframe with processed content
  const iframe = document.createElement('iframe')
  iframe.srcdoc = processedXHTML
  
  return iframe
}

// Workspace switching
function switchWorkspace(newWorkspaceId: string): void {
  blobURLManager.setActiveWorkspace(newWorkspaceId) // Automatically cleans up old URLs
  // ... update UI for new workspace
}
```

## Testing Priority

### Core Functionality
- **Asset substitution accuracy** - Verify all relative URLs are replaced correctly
- **Content integrity** - Ensure XHTML structure and content are preserved
- **CSS base path resolution** - Test relative paths from different CSS locations
- **Error handling** - Missing assets show appropriate warnings/icons

### Integration Testing
- **File storage integration** - Test with OPFS and IndexedDB backends
- **Workspace switching** - Verify cleanup on workspace change
- **Preview iframe integration** - Test complete workflow

### Edge Cases
- **Malformed XHTML** - Test parser error handling
- **Complex CSS** - Nested @import and url() references
- **Mixed content** - Absolute and relative URLs in same document
- **Large files** - Performance with many asset references

### Error Scenarios
```typescript
// Test cases for missing assets
test('missing CSS shows console warning', async () => {
  const xhtml = '<link rel="stylesheet" href="missing.css">'
  const processed = await blobURLManager.processXHTMLForPreview(xhtml)
  expect(console.warn).toHaveBeenCalledWith('Missing asset: OEBPS/missing.css')
  expect(processed).toContain('href="missing.css"') // Original URL preserved
})

test('missing image shows error icon', async () => {
  const xhtml = '<img src="missing.jpg" alt="test">'
  const processed = await blobURLManager.processXHTMLForPreview(xhtml)
  expect(processed).toContain('data:image/svg+xml')
  expect(processed).toContain('alt="Missing: OEBPS/missing.jpg"')
})
```