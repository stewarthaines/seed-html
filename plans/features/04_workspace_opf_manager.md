# 04. Workspace & OPF Manager

## Overview

Provides high-level workspace management with integrated EPUB content.opf parsing, generation, and manipulation. Combines workspace operations with EPUB-aware metadata handling for a cohesive development experience.

## Requirements

- Create new EPUB workspaces with proper structure
- List available workspaces with metadata (title/author)
- Switch between workspaces with validation
- Parse and generate content.opf files
- Manage manifest items and spine ordering
- Provide metadata extraction for UI components

## Dependencies

- **#1 File Storage API** - for workspace storage operations
- **#2 EPUB Unpacking** - leverages existing OPF parsing logic
- **#3 EPUB Packaging** - leverages existing metadata extraction

## Technical Approach

- Build on existing EPUB parsing/generation capabilities
- Provide high-level API that combines storage + OPF operations
- Cache workspace metadata for performance
- Integrate with existing XML validation and parsing
- Support EPUB 3.0 structure only

## API Design

```typescript
interface WorkspaceManager {
  // High-level workspace operations
  listWorkspacesWithMetadata(): Promise<WorkspaceInfo[]>;
  createEPUBWorkspace(metadata: EPUBMetadata): Promise<string>;
  switchWorkspace(workspaceId: string): Promise<WorkspaceInfo>;
  deleteWorkspace(workspaceId: string): Promise<void>;

  // OPF operations
  getWorkspaceOPF(workspaceId: string): Promise<OPFDocument>;
  updateWorkspaceOPF(workspaceId: string, opf: OPFDocument): Promise<void>;

  // Manifest and spine management
  addManifestItem(workspaceId: string, item: ManifestItem): Promise<void>;
  removeManifestItem(workspaceId: string, itemId: string): Promise<void>;
  updateSpineOrder(workspaceId: string, spineItems: string[]): Promise<void>;

  // Metadata shortcuts
  getWorkspaceMetadata(workspaceId: string): Promise<EPUBMetadata>;
  updateMetadata(workspaceId: string, metadata: EPUBMetadata): Promise<void>;

  // Utilities
  validateWorkspaceStructure(workspaceId: string): Promise<ValidationResult>;
  generateWorkspacePreview(workspaceId: string): Promise<WorkspacePreview>;
}

interface WorkspaceInfo {
  id: string;
  title: string;
  author?: string;
  language: string;
  lastModified: Date;
  fileCount: number;
  totalSize: number;
  epubVersion: string;
}

interface OPFDocument {
  metadata: EPUBMetadata;
  manifest: ManifestItem[];
  spine: SpineItem[];
  guide?: GuideItem[];
  version: string;
}

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string[];
  fallback?: string;
}

interface SpineItem {
  idref: string;
  linear?: boolean;
  properties?: string[];
}

interface EPUBMetadata {
  // Required Dublin Core elements
  title: string;
  language: string;
  identifier: string;

  // Optional Dublin Core elements
  creator?: string[];
  contributor?: string[];
  publisher?: string;
  date?: string;
  description?: string;
  subject?: string[];
  rights?: string;
  source?: string;
  relation?: string;
  coverage?: string;
  type?: string;
  format?: string;

  // EPUB-specific metadata
  modifiedDate?: string;
  epubVersion?: string;
}

interface WorkspacePreview {
  metadata: EPUBMetadata;
  manifestSummary: {
    textItems: number;
    imageItems: number;
    audioItems: number;
    otherItems: number;
  };
  spineOrder: string[];
  estimatedEPUBSize: number;
}
```

## Workspace Creation

- Generate unique workspace IDs using crypto.randomUUID()
- Create standard EPUB directory structure:
  ```
  workspace-{id}/
  ├── mimetype
  ├── META-INF/
  │   └── container.xml
  ├── OEBPS/
  │   ├── content.opf
  │   ├── Text/
  │   ├── Images/
  │   ├── Styles/
  │   └── Audio/
  └── EDITME/
      ├── src/
      └── scripts/
  ```
- Pre-populate with minimal valid EPUB structure
- Generate initial content.opf with provided metadata

## OPF Integration

**Leverages shared EPUB utilities:**

- Use `OPFUtils.parseOPFMetadata()` for metadata extraction
- Use `OPFUtils.parseContainerXml()` for container parsing
- Use `OPFUtils.validateXML()` for XML validation
- Use `OPFUtils.generateOPFXML()` for OPF generation
- Use `OPFUtils.parseOPFDocument()` for complete OPF parsing

**New OPF operations built on shared utilities:**

- Generate complete content.opf XML using `OPFUtils.generateOPFXML()`
- Parse complete OPF documents using `OPFUtils.parseOPFDocument()`
- Add/remove manifest items with automatic ID generation
- Update spine order with validation via `OPFUtils.validateManifestSpineConsistency()`
- Modify metadata fields with proper XML escaping
- Validate OPF structure using `OPFUtils.validateXML()`

## Workspace Metadata Caching

### Cache Architecture

**Two-tier caching**: Memory cache (fast) + Disk cache (persistent)

### Disk Cache Implementation

**File**: `.workspace-metadata.json` (stored in workspace root)
**Format**:

```typescript
interface WorkspaceCacheEntry {
  version: number; // Cache format version
  workspaceId: string;
  lastCacheUpdate: number; // Timestamp when cache was last updated
  opfFileModified: number; // Timestamp of content.opf file when cached
  metadata: EPUBMetadata;
  fileCount: number;
  totalSize: number;
  epubVersion: string;
}

interface WorkspaceCache {
  [workspaceId: string]: WorkspaceCacheEntry;
}
```

### Cache Invalidation Strategy

```typescript
class WorkspaceMetadataCache {
  private memoryCache = new Map<string, WorkspaceInfo>();
  private readonly CACHE_VERSION = 1;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  async isCacheFresh(workspaceId: string, cacheEntry: WorkspaceCacheEntry): Promise<boolean> {
    // Check cache version compatibility
    if (cacheEntry.version !== this.CACHE_VERSION) return false;

    // Check TTL expiration
    if (Date.now() - cacheEntry.lastCacheUpdate > this.CACHE_TTL) return false;

    // Check if OPF file has been modified
    try {
      const opfStats = await this.storage.getFileStats(workspaceId, 'OEBPS/content.opf');
      return opfStats.lastModified <= cacheEntry.opfFileModified;
    } catch {
      return false; // OPF file missing/inaccessible
    }
  }

  async invalidateCache(workspaceId: string): Promise<void> {
    this.memoryCache.delete(workspaceId);
    // Update disk cache on next access
  }
}
```

### Cache Recovery Strategy

- **Corrupted cache**: Fall back to OPF parsing, rebuild cache entry
- **Missing OPF**: Use cached metadata with warning flag
- **Partial cache**: Rebuild cache entry from fresh OPF parsing

## Manifest Management

### Manifest Item ID Generation

```typescript
class ManifestIDGenerator {
  generateID(href: string, existingIds: Set<string>): string {
    // Extract base name from href
    const fileName = href.split('/').pop() || 'item';
    const baseName = fileName.replace(/\.[^.]+$/, ''); // Remove extension

    // Sanitize for XML ID requirements
    const sanitized = baseName
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/^[^a-zA-Z]/, 'item-') // Ensure starts with letter
      .toLowerCase();

    // Ensure uniqueness
    let id = sanitized;
    let counter = 1;
    while (existingIds.has(id)) {
      id = `${sanitized}-${counter++}`;
    }

    return id;
  }
}
```

### Media Type Detection

```typescript
class MediaTypeDetector {
  private static readonly MEDIA_TYPE_MAP: Record<string, string> = {
    // Text content
    xhtml: 'application/xhtml+xml',
    html: 'application/xhtml+xml',
    xml: 'application/xml',
    css: 'text/css',
    js: 'application/javascript',
    txt: 'text/plain',

    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',

    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',

    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogv: 'video/ogg',

    // Fonts
    ttf: 'font/ttf',
    otf: 'font/otf',
    woff: 'font/woff',
    woff2: 'font/woff2',

    // EPUB specific
    opf: 'application/oebps-package+xml',
    ncx: 'application/x-dtbncx+xml',
  };

  static getMediaType(href: string): string {
    const extension = href.split('.').pop()?.toLowerCase() || '';
    return this.MEDIA_TYPE_MAP[extension] || 'application/octet-stream';
  }
}
```

### Dependency Tracking

```typescript
class ManifestDependencyTracker {
  async findDependencies(workspaceId: string, manifestItem: ManifestItem): Promise<string[]> {
    const dependencies: string[] = [];

    if (manifestItem.mediaType === 'application/xhtml+xml') {
      // Parse XHTML for CSS, image, and other resource references
      const content = await this.storage.readTextFile(workspaceId, manifestItem.href);
      const doc = new DOMParser().parseFromString(content, 'application/xml');

      // Find CSS links
      const cssLinks = doc.querySelectorAll('link[rel="stylesheet"]');
      cssLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href) dependencies.push(this.resolveRelativePath(manifestItem.href, href));
      });

      // Find images
      const images = doc.querySelectorAll('img');
      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src) dependencies.push(this.resolveRelativePath(manifestItem.href, src));
      });

      // Find other media references
      const audio = doc.querySelectorAll('audio source, video source');
      audio.forEach(source => {
        const src = source.getAttribute('src');
        if (src) dependencies.push(this.resolveRelativePath(manifestItem.href, src));
      });
    } else if (manifestItem.mediaType === 'text/css') {
      // Parse CSS for font and image references using CSSOM + regex fallback
      const content = await this.storage.readTextFile(workspaceId, manifestItem.href);

      try {
        // Use CSSOM for robust CSS parsing (supported in all target browsers)
        const sheet = new CSSStyleSheet();
        await sheet.replace(content);

        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSImportRule && rule.href) {
            dependencies.push(this.resolveRelativePath(manifestItem.href, rule.href));
          }

          if (rule instanceof CSSStyleRule) {
            // Extract URLs from style declarations
            const urls = this.extractUrlsFromStyle(rule.style);
            dependencies.push(...urls.map(url => this.resolveRelativePath(manifestItem.href, url)));
          }
        }
      } catch {
        // Fallback to regex parsing if CSSOM fails (malformed CSS)
        const urlMatches = content.match(/url\(['"]?([^'")\s]+)['"]?\)/g);
        if (urlMatches) {
          urlMatches.forEach(match => {
            const url = match.match(/url\(['"]?([^'")\s]+)['"]?\)/)?.[1];
            if (url && !url.startsWith('http') && !url.startsWith('data:')) {
              dependencies.push(this.resolveRelativePath(manifestItem.href, url));
            }
          });
        }
      }
    }

    return dependencies.filter(dep => dep.length > 0);
  }

  private extractUrlsFromStyle(style: CSSStyleDeclaration): string[] {
    const urls: string[] = [];

    // Check common properties that reference URLs
    const urlProperties = [
      'background-image',
      'border-image',
      'list-style-image',
      'content',
      'cursor',
      'src', // for @font-face
    ];

    for (const prop of urlProperties) {
      const value = style.getPropertyValue(prop);
      if (value) {
        const urlMatches = value.match(/url\(['"]?([^'")]+)['"]?\)/g);
        if (urlMatches) {
          urls.push(...urlMatches.map(match => match.replace(/url\(['"]?([^'")]+)['"]?\)/, '$1')));
        }
      }
    }

    return urls.filter(
      url => !url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('#')
    );
  }

  private resolveRelativePath(basePath: string, relativePath: string): string {
    const baseDir = basePath.split('/').slice(0, -1).join('/');
    const resolved = baseDir ? `${baseDir}/${relativePath}` : relativePath;
    return resolved.replace(/\/\.\//g, '/').replace(/\/[^/]+\/\.\.\//g, '/');
  }
}
```

### Manifest Synchronization

- **Add operations**: Auto-generate ID, detect media type, check dependencies
- **Remove operations**: Check for spine references, warn about orphaned dependencies
- **Update operations**: Re-validate dependencies, update spine if href changes
- **Batch operations**: Optimize multiple changes to reduce OPF rewrites

## Spine Management

- Maintain reading order through spine items
- Validate all spine item references exist in manifest
- Support linear/non-linear spine items
- Handle spine item properties (page-spread-left, etc.)
- Reorder spine items with simple ui (just button to move item lower in list)

## Workspace Validation

- Check for required EPUB files (mimetype, container.xml, OPF)
- Validate OPF structure and required metadata
- Verify all spine items reference existing manifest items
- Check for orphaned files not in manifest
- Validate file paths and media types
- Report validation errors with specific locations

## Error Handling

- Workspace corruption detection and reporting
- Missing or malformed OPF file handling
- Invalid XML parsing with detailed error messages
- Manifest/spine synchronization conflicts
- Storage access errors with retry logic
- Concurrent modification detection

## Performance Optimizations

- Lazy loading of workspace contents
- Metadata caching with TTL expiration
- Batch operations for multiple manifest changes
- Background validation for large workspaces
- Efficient workspace switching with cleanup

## EPUB Version Support

- Detect version from OPF package element
- Support EPUB 3.0 nav documents

## Testing Strategy

- Unit tests for OPF parsing/generation
- Integration tests with File Storage API
- Workspace lifecycle testing (create/switch/delete)
- Manifest manipulation accuracy tests
- Validation logic verification
- Performance testing with large workspaces
- Concurrent access testing

## File Structure

The workspace feature will be implemented in `src/lib/workspace/` using kebab-case file naming:

```
src/lib/workspace/
├── index.ts                 # Main exports and public API
├── workspace-manager.ts     # WorkspaceManager class - core operations
├── workspace-cache.ts       # WorkspaceMetadataCache class - caching logic
├── manifest-manager.ts      # ManifestManager class - manifest operations
├── dependency-tracker.ts    # ManifestDependencyTracker class - file analysis
├── types.ts                 # All TypeScript interfaces and types
├── utils.ts                 # Helper functions and utilities
├── API.md                   # Comprehensive API documentation
└── test/                    # Test files
    ├── workspace-manager.test.ts
    ├── workspace-cache.test.ts
    ├── manifest-manager.test.ts
    └── dependency-tracker.test.ts
```

## Error Handling

### Exception Types

```typescript
export class WorkspaceError extends Error {
  constructor(
    message: string,
    public code: string,
    public workspaceId?: string
  ) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

export class ValidationError extends WorkspaceError {
  constructor(
    message: string,
    public errors: string[],
    workspaceId?: string
  ) {
    super(message, 'VALIDATION_ERROR', workspaceId);
    this.name = 'ValidationError';
  }
}

export class CacheError extends WorkspaceError {
  constructor(
    message: string,
    public reason: 'CORRUPTED' | 'MISSING' | 'STALE',
    workspaceId?: string
  ) {
    super(message, 'CACHE_ERROR', workspaceId);
    this.name = 'CacheError';
  }
}
```

### Error Codes

- `WORKSPACE_NOT_FOUND` - Workspace ID doesn't exist
- `INVALID_OPF_STRUCTURE` - OPF file malformed or missing required elements
- `MANIFEST_INCONSISTENCY` - Spine references missing manifest items
- `CACHE_ERROR` - Cache corruption, staleness, or access issues
- `VALIDATION_ERROR` - Workspace validation failures
- `STORAGE_ERROR` - File Storage API errors
- `DEPENDENCY_ERROR` - File dependency analysis failures

### ValidationResult Structure

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    totalFiles: number;
    validFiles: number;
    missingFiles: number;
    orphanedFiles: number;
  };
}

interface ValidationError {
  code: string;
  message: string;
  file?: string;
  line?: number;
  severity: 'error' | 'warning';
}
```

## Configuration Options

```typescript
interface WorkspaceConfig {
  cache: {
    ttl: number; // Cache TTL in milliseconds (default: 24 hours)
    maxEntries: number; // Max memory cache entries (default: 100)
    enableDiskCache: boolean; // Enable persistent disk cache (default: true)
  };
  validation: {
    strict: boolean; // Strict EPUB compliance (default: false)
    checkDependencies: boolean; // Validate file dependencies (default: true)
    allowOrphanedFiles: boolean; // Allow files not in manifest (default: true)
  };
  performance: {
    batchSize: number; // Batch size for bulk operations (default: 50)
    concurrency: number; // Max concurrent file operations (default: 5)
    enableProgressCallbacks: boolean; // Enable progress reporting (default: true)
  };
}
```

## Method Return Values

### addManifestItem()

```typescript
async addManifestItem(
  workspaceId: string,
  item: Partial<ManifestItem>
): Promise<ManifestItem> {
  // Returns complete ManifestItem with auto-generated ID and detected mediaType
  // Throws WorkspaceError if workspace not found
  // Throws ValidationError if item is invalid
}
```

### generateWorkspacePreview()

```typescript
interface WorkspacePreview {
  metadata: EPUBMetadata;
  manifestSummary: {
    textItems: number; // .xhtml, .html files
    imageItems: number; // .jpg, .png, .gif, .svg files
    audioItems: number; // .mp3, .wav, .ogg files
    videoItems: number; // .mp4, .webm files
    fontItems: number; // .ttf, .otf, .woff files
    otherItems: number; // Everything else
  };
  spineOrder: string[]; // Ordered list of spine item IDs
  estimatedEPUBSize: number; // Sum of all file sizes in bytes
  dependencies: {
    // File dependency analysis
    orphanedFiles: string[]; // Files not referenced anywhere
    missingDependencies: string[]; // Referenced files that don't exist
    circularReferences: string[][]; // Circular dependency chains
  };
}
```

## Implementation Plan

### Phase 1: Core Workspace Operations

- Basic workspace CRUD operations
- Integration with File Storage API
- Workspace structure creation
- Simple metadata caching

### Phase 2: OPF Integration

- Extend existing EPUB parsing capabilities
- OPF generation and modification
- Metadata extraction and updates
- Basic validation

### Phase 3: Manifest & Spine Management

- Add/remove manifest items
- Spine order management
- Advanced validation
- Error handling

### Phase 4: Performance & Polish

- Caching optimizations
- Background validation
- Workspace templates

## Storybook Demo

**File:** `src/stories/WorkspaceOPFDemo.svelte`

**Scenarios:**

- Create new workspace with metadata form
- List workspaces with title/author display
- Switch between workspaces
- Basic manifest item management
- OPF metadata editing
- Validation error display
- Workspace structure visualization

## Implementation Examples

### Complete Workflow: Create New EPUB Workspace

```typescript
async function createNewEPUBProject(metadata: EPUBMetadata): Promise<string> {
  const workspaceManager = new WorkspaceManager();

  // 1. Create workspace with EPUB structure
  const workspaceId = await workspaceManager.createEPUBWorkspace(metadata);

  // 2. Add initial content files
  await workspaceManager.addManifestItem(workspaceId, {
    id: 'nav',
    href: 'OEBPS/nav.xhtml',
    mediaType: 'application/xhtml+xml',
    properties: ['nav'],
  });

  await workspaceManager.addManifestItem(workspaceId, {
    id: 'chapter1',
    href: 'OEBPS/Text/chapter1.xhtml',
    mediaType: 'application/xhtml+xml',
  });

  await workspaceManager.addManifestItem(workspaceId, {
    id: 'stylesheet',
    href: 'OEBPS/Styles/style.css',
    mediaType: 'text/css',
  });

  // 3. Set up spine order
  await workspaceManager.updateSpineOrder(workspaceId, ['chapter1']);

  // 4. Validate workspace structure
  const validation = await workspaceManager.validateWorkspaceStructure(workspaceId);
  if (!validation.isValid) {
    throw new Error(`Workspace validation failed: ${validation.errors.join(', ')}`);
  }

  return workspaceId;
}
```

### Common Operation: Add Chapter with Dependencies

```typescript
async function addNewChapter(
  workspaceId: string,
  chapterTitle: string,
  insertAfter?: string
): Promise<void> {
  const workspaceManager = new WorkspaceManager();

  // 1. Generate chapter file
  const chapterHref = `OEBPS/Text/${chapterTitle.toLowerCase().replace(/\s+/g, '-')}.xhtml`;

  // 2. Create XHTML content
  const chapterContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${chapterTitle}</title>
  <link rel="stylesheet" type="text/css" href="../Styles/style.css"/>
</head>
<body>
  <h1>${chapterTitle}</h1>
  <p>Chapter content goes here...</p>
</body>
</html>`;

  // 3. Write file to workspace
  await workspaceManager.storage.writeTextFile(workspaceId, chapterHref, chapterContent);

  // 4. Add to manifest (ID auto-generated, dependencies auto-detected)
  const manifestItem = await workspaceManager.addManifestItem(workspaceId, {
    href: chapterHref,
    mediaType: 'application/xhtml+xml',
  });

  // 5. Insert into spine
  const currentSpine = await workspaceManager.getWorkspaceOPF(workspaceId);
  const spineIds = currentSpine.spine.map(item => item.idref);

  if (insertAfter) {
    const insertIndex = spineIds.indexOf(insertAfter) + 1;
    spineIds.splice(insertIndex, 0, manifestItem.id);
  } else {
    spineIds.push(manifestItem.id);
  }

  await workspaceManager.updateSpineOrder(workspaceId, spineIds);
}
```

### Integration with File Storage API

```typescript
class WorkspaceManager {
  constructor(private storage: FileStorageAPI) {}

  async listWorkspacesWithMetadata(): Promise<WorkspaceInfo[]> {
    // 1. Get all workspace IDs from storage
    const workspaceIds = await this.storage.listWorkspaces();

    // 2. Load cached metadata for each workspace
    const workspaceInfos: WorkspaceInfo[] = [];

    for (const workspaceId of workspaceIds) {
      try {
        const cachedInfo = await this.loadCachedMetadata(workspaceId);
        if (cachedInfo && (await this.isCacheFresh(workspaceId, cachedInfo))) {
          workspaceInfos.push(this.cacheEntryToWorkspaceInfo(cachedInfo));
        } else {
          // Cache miss/stale - parse OPF and update cache
          const freshInfo = await this.parseWorkspaceMetadata(workspaceId);
          await this.updateCache(workspaceId, freshInfo);
          workspaceInfos.push(freshInfo);
        }
      } catch (error) {
        // Workspace has issues - include with error state
        workspaceInfos.push({
          id: workspaceId,
          title: `Workspace ${workspaceId} (Error)`,
          language: 'unknown',
          lastModified: new Date(),
          fileCount: 0,
          totalSize: 0,
          epubVersion: 'unknown',
          hasError: true,
        });
      }
    }

    return workspaceInfos.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }
}
```

## Integration Notes

- **Ready for UI components** (Features 9-11): Provides `WorkspaceInfo[]` for dropdowns and lists
- **Metadata for workspace dropdowns**: Title, author, and last modified info immediately available
- **EPUB pack/unpack integration**: Uses shared `OPFUtils` for consistency
- **Round-trip editing**: Supports import EPUB → edit → export EPUB workflows
- **Content management foundation**: Manifest and spine operations ready for UI features
