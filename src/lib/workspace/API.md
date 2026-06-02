# Workspace & OPF Manager API

## Overview

The Workspace & OPF Manager provides high-level workspace management with integrated EPUB content.opf parsing, generation, and manipulation. It combines workspace operations with EPUB-aware metadata handling for a cohesive development experience.

**Main Classes:**

- `WorkspaceManager` - Core workspace operations and OPF management
- `WorkspaceMetadataCache` - Two-tier caching system for performance
- `ManifestManager` - Manifest item manipulation and validation
- `ManifestDependencyTracker` - File dependency analysis using CSSOM + regex fallback

## WorkspaceManager Class

### Constructor

```typescript
constructor(
  config?: Partial<WorkspaceConfig>,
  contentGenerator?: SampleContentGenerator,
  transformExecutor?: TransformExecutor
)
```

**Input:**

- `config?: Partial<WorkspaceConfig>` - Optional configuration overrides
- `contentGenerator?: SampleContentGenerator` - Optional content generator for localized workspace creation (defaults to new instance with unified i18n service)
- `transformExecutor?: TransformExecutor` - Optional transform executor for text/DOM transformations (defaults to new instance)

**Side Effects:** Initializes File Storage API, cache system, and dependency injection for content generation

**Usage:**

```typescript
// Basic usage with default dependencies
const workspaceManager = new WorkspaceManager({
  cache: { ttl: 12 * 60 * 60 * 1000 }, // 12 hour cache
  validation: { strict: true },
});

// Advanced usage with custom dependencies (for testing or customization)
const customContentGenerator = new SampleContentGenerator(customI18nService);
const customTransformExecutor = new TransformExecutor();
const workspaceManager = new WorkspaceManager(
  { validation: { strict: true } },
  customContentGenerator,
  customTransformExecutor
);
```

### listWorkspacesWithMetadata()

```typescript
listWorkspacesWithMetadata(): Promise<WorkspaceInfo[]>
```

**Output:** `Promise<WorkspaceInfo[]>` - Array of workspace metadata sorted by last modified date

**Side Effects:** Updates cache entries for stale workspaces, may trigger OPF parsing

**Usage:**

```typescript
const workspaces = await workspaceManager.listWorkspacesWithMetadata();
console.log(`Found ${workspaces.length} workspaces`);
workspaces.forEach(ws => console.log(`${ws.title} by ${ws.author}`));
```

### createEPUBWorkspace()

```typescript
createEPUBWorkspace(metadata: EPUBMetadata): Promise<string>
```

**Input:**

- `metadata: EPUBMetadata` - EPUB metadata for initial OPF generation

**Output:** `Promise<string>` - Generated workspace ID (UUID)

**Side Effects:** Creates workspace directory structure, generates initial content.opf, updates cache

**Usage:**

```typescript
const workspaceId = await workspaceManager.createEPUBWorkspace({
  title: 'My EPUB Book',
  author: 'Jane Smith',
  language: 'en',
  identifier: 'isbn:9781234567890',
});
```

### createLocalizedEPUBWorkspace()

```typescript
createLocalizedEPUBWorkspace(
  metadata: Partial<EPUBMetadata> = {},
  locale = 'en'
): Promise<string>
```

**Input:**

- `metadata?: Partial<EPUBMetadata>` - Optional EPUB metadata (defaults to localized sample metadata)
- `locale?: string` - Target locale for sample content generation (defaults to 'en')

**Output:** `Promise<string>` - Generated workspace ID (UUID)

**Side Effects:** Creates workspace with localized sample content, installs transform scripts, creates SOURCE directory structure

**Usage:**

```typescript
// Create workspace with English sample content
const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({
  title: 'My Localized Book',
  author: 'Jane Smith',
});

// Create workspace with German sample content
const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace(
  {
    title: 'Mein Lokalisiertes Buch',
    author: 'Jane Smith',
    language: 'de',
  },
  'de'
);

// Create workspace with Arabic sample content (RTL support)
const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace(
  {
    title: 'كتابي المترجم',
    author: 'Jane Smith',
    language: 'ar',
  },
  'ar'
);
```

**Features:**

- **Localized Content**: Generates sample chapters, prologue, and appendix in the target locale
- **Universal Assets**: Installs CSS with RTL support and transform scripts
- **SOURCE Directory**: Creates SOURCE/text/, SOURCE/scripts/, and SOURCE/settings.json
- **Transform Pipeline**: Installs transformText.js and transformDom.js for content processing
- **Locale Detection**: Automatically detects RTL languages and applies appropriate styling

### switchWorkspace()

```typescript
switchWorkspace(workspaceId: string): Promise<WorkspaceInfo>
```

**Input:**

- `workspaceId: string` - Workspace ID to switch to

**Output:** `Promise<WorkspaceInfo>` - Workspace metadata and validation status

**Side Effects:** Validates workspace structure, updates cache, sets current workspace context

**Usage:**

```typescript
try {
  const workspace = await workspaceManager.switchWorkspace('workspace-123');
  console.log(`Switched to: ${workspace.title}`);
} catch (error) {
  if (error instanceof WorkspaceError && error.code === 'WORKSPACE_NOT_FOUND') {
    console.error('Workspace does not exist');
  }
}
```

### getWorkspaceOPF()

```typescript
getWorkspaceOPF(workspaceId: string): Promise<OPFDocument>
```

**Input:**

- `workspaceId: string` - Workspace ID

**Output:** `Promise<OPFDocument>` - Parsed OPF document with metadata, manifest, and spine

**Side Effects:** Reads and parses content.opf file, may update cache

**Usage:**

```typescript
const opf = await workspaceManager.getWorkspaceOPF(workspaceId);
console.log(`EPUB version: ${opf.version}`);
console.log(`Manifest items: ${opf.manifest.length}`);
console.log(`Spine items: ${opf.spine.length}`);
```

### updateWorkspaceOPF()

```typescript
updateWorkspaceOPF(workspaceId: string, opf: OPFDocument): Promise<void>
```

**Input:**

- `workspaceId: string` - Workspace ID
- `opf: OPFDocument` - Updated OPF document

**Output:** `Promise<void>`

**Side Effects:** Writes content.opf file, validates OPF structure, invalidates cache

**Usage:**

```typescript
const opf = await workspaceManager.getWorkspaceOPF(workspaceId);
opf.metadata.title = 'Updated Title';
opf.metadata.modifiedDate = new Date().toISOString();
await workspaceManager.updateWorkspaceOPF(workspaceId, opf);
```

### addManifestItem()

```typescript
addManifestItem(workspaceId: string, item: Partial<ManifestItem>): Promise<ManifestItem>
```

**Input:**

- `workspaceId: string` - Workspace ID
- `item: Partial<ManifestItem>` - Manifest item (ID and mediaType auto-generated if missing)

**Output:** `Promise<ManifestItem>` - Complete manifest item with generated ID and detected mediaType

**Side Effects:** Updates content.opf file, analyzes file dependencies, invalidates cache

**Usage:**

```typescript
const manifestItem = await workspaceManager.addManifestItem(workspaceId, {
  href: 'OEBPS/Text/chapter1.xhtml',
  // ID auto-generated: "chapter1"
  // mediaType auto-detected: "application/xhtml+xml"
});

console.log(`Added item: ${manifestItem.id}`);
```

### validateWorkspaceStructure()

```typescript
validateWorkspaceStructure(workspaceId: string): Promise<ValidationResult>
```

**Input:**

- `workspaceId: string` - Workspace ID

**Output:** `Promise<ValidationResult>` - Detailed validation results with errors, warnings, and summary

**Side Effects:** Reads workspace files, analyzes structure, may update cache with validation status

**Usage:**

```typescript
const validation = await workspaceManager.validateWorkspaceStructure(workspaceId);

if (!validation.isValid) {
  console.error('Validation errors:');
  validation.errors.forEach(error => {
    console.error(`- ${error.message} (${error.code})`);
  });
}

if (validation.warnings.length > 0) {
  console.warn('Validation warnings:');
  validation.warnings.forEach(warning => {
    console.warn(`- ${warning.message}`);
  });
}

console.log(
  `Summary: ${validation.summary.validFiles}/${validation.summary.totalFiles} files valid`
);
```

### generateWorkspacePreview()

```typescript
generateWorkspacePreview(workspaceId: string): Promise<WorkspacePreview>
```

**Input:**

- `workspaceId: string` - Workspace ID

**Output:** `Promise<WorkspacePreview>` - Comprehensive workspace analysis including file counts, dependencies, and estimated size

**Side Effects:** Analyzes all workspace files, calculates dependencies, reads file sizes

**Usage:**

```typescript
const preview = await workspaceManager.generateWorkspacePreview(workspaceId);

console.log(`Title: ${preview.metadata.title}`);
console.log(
  `Files: ${preview.manifestSummary.textItems} text, ${preview.manifestSummary.imageItems} images`
);
console.log(`Size: ${Math.round(preview.estimatedEPUBSize / 1024)} KB`);

if (preview.dependencies.orphanedFiles.length > 0) {
  console.warn('Orphaned files:', preview.dependencies.orphanedFiles);
}
```

### readFile()

```typescript
readFile(workspaceId: string, path: string): Promise<ArrayBuffer>
```

**Input:**

- `workspaceId: string` - Workspace ID
- `path: string` - File path relative to workspace root

**Output:** `Promise<ArrayBuffer>` - File content as ArrayBuffer (use TextDecoder for text files)

**Side Effects:** Reads file from workspace storage

**Usage:**

```typescript
// Read text file and decode
const buffer = await workspaceManager.readFile(workspaceId, 'OEBPS/Text/chapter1.xhtml');
const textContent = new TextDecoder().decode(buffer);
console.log('Chapter content:', textContent);

// Read binary file (image, audio, etc.)
const binaryContent = await workspaceManager.readFile(workspaceId, 'OEBPS/Images/cover.jpg');
console.log('Image size:', binaryContent.byteLength, 'bytes');

// For text files, prefer readTextFile() method instead
const textContent2 = await workspaceManager.readTextFile(workspaceId, 'OEBPS/Text/chapter1.xhtml');
```

### writeFile()

```typescript
writeFile(workspaceId: string, path: string, content: string | ArrayBuffer): Promise<void>
```

**Input:**

- `workspaceId: string` - Workspace ID
- `path: string` - File path relative to workspace root
- `content: string | ArrayBuffer` - File content as string for text files or ArrayBuffer for binary files

**Output:** `Promise<void>`

**Side Effects:** Writes file to workspace storage, invalidates workspace cache

**Usage:**

```typescript
// Write text file
await workspaceManager.writeFile(
  workspaceId,
  'OEBPS/Text/chapter2.xhtml',
  '<?xml version="1.0"?><html><body><h1>Chapter 2</h1></body></html>'
);

// Write binary file
const imageBuffer = new ArrayBuffer(1024);
await workspaceManager.writeFile(workspaceId, 'OEBPS/Images/new-image.jpg', imageBuffer);
```

### readTextFile()

```typescript
readTextFile(workspaceId: string, path: string): Promise<string>
```

**Input:**

- `workspaceId: string` - Workspace ID
- `path: string` - File path relative to workspace root

**Output:** `Promise<string>` - File content as UTF-8 string

**Side Effects:** Reads text file from workspace storage

**Usage:**

```typescript
const content = await workspaceManager.readTextFile(workspaceId, 'OEBPS/content.opf');
console.log('OPF content:', content);
```

### writeTextFile()

```typescript
writeTextFile(workspaceId: string, path: string, content: string): Promise<void>
```

**Input:**

- `workspaceId: string` - Workspace ID
- `path: string` - File path relative to workspace root
- `content: string` - Text content to write

**Output:** `Promise<void>`

**Side Effects:** Writes text file to workspace storage, invalidates workspace cache

**Usage:**

```typescript
await workspaceManager.writeTextFile(
  workspaceId,
  'OEBPS/Styles/style.css',
  'body { font-family: serif; margin: 2em; }'
);
```

### deleteFile()

```typescript
deleteFile(workspaceId: string, path: string): Promise<void>
```

**Input:**

- `workspaceId: string` - Workspace ID
- `path: string` - File path relative to workspace root

**Output:** `Promise<void>`

**Side Effects:** Deletes file from workspace storage, invalidates workspace cache

**Usage:**

```typescript
await workspaceManager.deleteFile(workspaceId, 'OEBPS/Images/old-cover.jpg');
```

### fileExists()

```typescript
fileExists(workspaceId: string, path: string): Promise<boolean>
```

**Input:**

- `workspaceId: string` - Workspace ID
- `path: string` - File path relative to workspace root

**Output:** `Promise<boolean>` - True if file exists, false otherwise

**Side Effects:** Checks file existence in workspace storage

**Usage:**

```typescript
const exists = await workspaceManager.fileExists(workspaceId, 'OEBPS/nav.xhtml');
if (exists) {
  console.log('Navigation document exists');
}
```

## ManifestDependencyTracker Class

### findDependencies()

```typescript
findDependencies(workspaceId: string, manifestItem: ManifestItem): Promise<string[]>
```

**Input:**

- `workspaceId: string` - Workspace ID
- `manifestItem: ManifestItem` - Manifest item to analyze

**Output:** `Promise<string[]>` - Array of relative file paths that this item depends on

**Side Effects:** Reads file content, parses XHTML/CSS using DOM/CSSOM APIs

**Usage:**

```typescript
const tracker = new ManifestDependencyTracker(storage);
const dependencies = await tracker.findDependencies(workspaceId, {
  id: 'chapter1',
  href: 'OEBPS/Text/chapter1.xhtml',
  mediaType: 'application/xhtml+xml',
});

console.log('Dependencies:', dependencies);
// Output: ["OEBPS/Styles/style.css", "OEBPS/Images/cover.jpg"]
```

## Type Definitions

### WorkspaceInfo

```typescript
interface WorkspaceInfo {
  id: string;
  title: string;
  author?: string;
  language: string;
  lastModified: Date;
  fileCount: number;
  totalSize: number;
  epubVersion: string;
  hasError?: boolean; // Set when workspace has validation errors
}
```

### OPFDocument

```typescript
interface OPFDocument {
  metadata: EPUBMetadata;
  manifest: ManifestItem[];
  spine: SpineItem[];
  guide?: GuideItem[];
  version: string; // "2.0" or "3.0"
}
```

### ManifestItem

```typescript
interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string[];
  fallback?: string;
}
```

### WorkspaceConfig

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

## Error Handling

### Exception Types

The workspace API throws specific error types for different failure scenarios:

```typescript
// Base workspace error
class WorkspaceError extends Error {
  constructor(message: string, public code: string, public workspaceId?: string)
}

// Validation failures
class ValidationError extends WorkspaceError {
  constructor(message: string, public errors: string[], workspaceId?: string)
}

// Cache-related errors
class CacheError extends WorkspaceError {
  constructor(message: string, public reason: 'CORRUPTED' | 'MISSING' | 'STALE', workspaceId?: string)
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

### Error Handling Patterns

```typescript
try {
  const workspace = await workspaceManager.switchWorkspace('invalid-id');
} catch (error) {
  if (error instanceof WorkspaceError) {
    switch (error.code) {
      case 'WORKSPACE_NOT_FOUND':
        console.error('Workspace not found:', error.workspaceId);
        break;
      case 'INVALID_OPF_STRUCTURE':
        console.error('Invalid EPUB structure:', error.message);
        break;
      case 'CACHE_ERROR':
        console.warn('Cache error, will rebuild:', error.message);
        break;
      default:
        console.error('Workspace error:', error.message);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Common Integration Patterns

### Complete EPUB Workspace Creation

```typescript
async function createNewEPUBProject(metadata: EPUBMetadata): Promise<string> {
  const workspaceManager = new WorkspaceManager();

  // 1. Create workspace with EPUB structure
  const workspaceId = await workspaceManager.createEPUBWorkspace(metadata);

  // 2. Add navigation document
  await workspaceManager.addManifestItem(workspaceId, {
    id: 'nav',
    href: 'OEBPS/nav.xhtml',
    mediaType: 'application/xhtml+xml',
    properties: ['nav'],
  });

  // 3. Add first chapter
  await workspaceManager.addManifestItem(workspaceId, {
    href: 'OEBPS/Text/chapter1.xhtml',
    mediaType: 'application/xhtml+xml',
  });

  // 4. Add stylesheet
  await workspaceManager.addManifestItem(workspaceId, {
    href: 'OEBPS/Styles/style.css',
    mediaType: 'text/css',
  });

  // 5. Create SOURCE directory with default content
  const fileStorage = new FileStorage();

  // Add default settings
  const defaultSettings = {
    is_draft: false,
    draft_id: 0,
    text_transform: 'SOURCE/extensions/markdown-it/transform.js',
    dom_transforms: [],
  };
  await fileStorage.writeFile(
    workspaceId,
    'SOURCE/settings.json',
    JSON.stringify(defaultSettings, null, 2)
  );

  // Add source text for first chapter
  const defaultChapterContent = `# Chapter 1\n\nStart writing your content here...\n`;
  await fileStorage.writeFile(workspaceId, 'SOURCE/text/chapter1.txt', defaultChapterContent);

  // Add default transform script
  const defaultTransform = `// Default markdown transform\nreturn window.markdownit().render(plainText);`;
  await fileStorage.writeFile(workspaceId, 'SOURCE/scripts/transform.js', defaultTransform);

  // 6. Validate final structure (excludes SOURCE/ files from orphan checks)
  const validation = await workspaceManager.validateWorkspaceStructure(workspaceId);
  if (!validation.isValid) {
    throw new ValidationError(
      `Workspace validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
      validation.errors.map(e => e.message),
      workspaceId
    );
  }

  return workspaceId;
}
```

### Workspace Metadata Management

```typescript
async function updateWorkspaceMetadata(
  workspaceId: string,
  updates: Partial<EPUBMetadata>
): Promise<void> {
  const workspaceManager = new WorkspaceManager();

  // Get current OPF
  const opf = await workspaceManager.getWorkspaceOPF(workspaceId);

  // Update metadata
  opf.metadata = { ...opf.metadata, ...updates };
  opf.metadata.modifiedDate = new Date().toISOString();

  // Save changes
  await workspaceManager.updateWorkspaceOPF(workspaceId, opf);
}
```

### Dependency Analysis Workflow

```typescript
async function analyzeWorkspaceDependencies(workspaceId: string): Promise<{
  validDependencies: string[];
  missingDependencies: string[];
  orphanedFiles: string[];
}> {
  const workspaceManager = new WorkspaceManager();
  const tracker = new ManifestDependencyTracker(workspaceManager.storage);

  const opf = await workspaceManager.getWorkspaceOPF(workspaceId);
  const allFiles = await workspaceManager.storage.listFiles(workspaceId);

  const referencedFiles = new Set<string>();
  const missingDependencies: string[] = [];

  // Analyze each manifest item
  for (const item of opf.manifest) {
    const dependencies = await tracker.findDependencies(workspaceId, item);

    for (const dep of dependencies) {
      referencedFiles.add(dep);
      if (!allFiles.includes(dep)) {
        missingDependencies.push(dep);
      }
    }
  }

  // Find orphaned files
  const manifestFiles = new Set(opf.manifest.map(item => item.href));
  const orphanedFiles = allFiles.filter(
    file =>
      !manifestFiles.has(file) &&
      !referencedFiles.has(file) &&
      !file.startsWith('META-INF/') &&
      file !== 'mimetype'
  );

  return {
    validDependencies: Array.from(referencedFiles).filter(file => allFiles.includes(file)),
    missingDependencies,
    orphanedFiles,
  };
}
```

## Performance Considerations

### Caching Strategy

- **Memory Cache**: Fast access for recently used workspaces (configurable max entries)
- **Disk Cache**: Persistent cache with TTL expiration and file modification tracking
- **Cache Invalidation**: Automatic invalidation on OPF file changes, manual cache clearing available

### Optimization Tips

1. **Batch Operations**: Use bulk methods for multiple manifest changes to reduce OPF file rewrites
2. **Lazy Loading**: Workspace contents loaded on-demand, not during listing operations
3. **Concurrent Limits**: Configure concurrency limits for file operations in large workspaces
4. **Progress Callbacks**: Enable progress reporting for long-running operations

### Browser Compatibility

- **CSSOM CSS Parsing**: Uses CSSStyleSheet constructor with fallback to regex parsing
- **File Storage**: OPFS with IndexedDB fallback for broader browser support
- **Target Browsers**: Recent Safari, Chrome, Firefox, Edge (modern browsers only)

## Integration Notes

- **File Storage API Integration**: Built on top of Feature #1 (File Storage API)
- **EPUB Library Integration**: Uses shared OPFUtils from Feature #2/#3 for consistency
- **UI Component Ready**: Provides WorkspaceInfo[] for dropdowns and workspace lists
- **Round-trip Editing**: Supports import EPUB → edit → export EPUB workflows
- **Content Management Foundation**: Manifest and spine operations ready for UI features (Features 9-11)
