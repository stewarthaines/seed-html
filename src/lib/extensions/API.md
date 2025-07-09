# Extension Manager API Documentation

## Overview

The Extension Manager provides unified JavaScript extension management for workspaces, including importing new extensions, managing existing ones, and utilizing a global extension cache. Extensions are stored in `SOURCE/extensions/` within workspaces and cached globally at `extensions-cache/` in File Storage for reuse.

## Main Classes

### ExtensionManager

Core class for all extension operations including import, cache management, and workspace integration.

### ExtensionCache

Internal utility class for global cache operations (used by ExtensionManager).

## Core Methods

### Constructor

#### ExtensionManager()

```typescript
constructor(fileStorage: FileStorageAPI)
```

**Input:**

- `fileStorage: FileStorageAPI` - Initialized File Storage API instance

**Output:** `ExtensionManager` instance

**Side Effects:** None (initialization only)

**Usage:**

```typescript
import { FileStorageAPI } from '$lib/storage';
import { ExtensionManager } from '$lib/extensions';

const fileStorage = new FileStorageAPI();
await fileStorage.init();
const extensionManager = new ExtensionManager(fileStorage);
```

## Extension Import Methods

#### importExtension()

```typescript
importExtension(workspaceId: string, file: File, extensionName: string): Promise<ExtensionInfo>
```

**Input:**

- `workspaceId: string` - Target workspace identifier
- `file: File` - JavaScript file to import
- `extensionName: string` - User-confirmed extension name (normalized)

**Output:** `Promise<ExtensionInfo>` - Information about the created extension

**Side Effects:**

- Creates `SOURCE/extensions/{extensionName}/` directory in workspace
- Saves uploaded file to extension directory
- Automatically caches extension to global cache

**Usage:**

```typescript
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const detectedName = extensionManager.detectExtensionName(file.name);
const userConfirmedName = await promptUser(detectedName);

const extensionInfo = await extensionManager.importExtension(
  'workspace-123',
  file,
  userConfirmedName
);

console.log('Extension created:', extensionInfo.name);
console.log('Files:', extensionInfo.files.length);
```

#### addFileToExtension()

```typescript
addFileToExtension(workspaceId: string, extensionName: string, file: File): Promise<void>
```

**Input:**

- `workspaceId: string` - Target workspace identifier
- `extensionName: string` - Existing extension name
- `file: File` - Additional JavaScript or LICENSE file

**Output:** `Promise<void>`

**Side Effects:**

- Adds file to existing extension directory
- Updates cache if extension is cached and content matches

**Usage:**

```typescript
// Add a plugin file to existing markdown-it extension
const pluginFile = new File([pluginCode], 'markdown-it-footnote.js');
await extensionManager.addFileToExtension('workspace-123', 'markdown-it', pluginFile);
```

## Workspace Extension Management

#### listWorkspaceExtensions()

```typescript
listWorkspaceExtensions(workspaceId: string): Promise<ExtensionInfo[]>
```

**Input:**

- `workspaceId: string` - Target workspace identifier

**Output:** `Promise<ExtensionInfo[]>` - Array of extensions in workspace

**Side Effects:** None (read-only operation)

**Usage:**

```typescript
const workspaceExtensions = await extensionManager.listWorkspaceExtensions('workspace-123');

workspaceExtensions.forEach(ext => {
  console.log(`${ext.name}: ${ext.files.length} files, ${ext.totalSize} bytes`);
});
```

#### deleteWorkspaceExtension()

```typescript
deleteWorkspaceExtension(workspaceId: string, extensionName: string): Promise<void>
```

**Input:**

- `workspaceId: string` - Target workspace identifier
- `extensionName: string` - Extension to delete

**Output:** `Promise<void>`

**Side Effects:** Removes entire extension directory from workspace (cache unaffected)

**Usage:**

```typescript
await extensionManager.deleteWorkspaceExtension('workspace-123', 'old-extension');
```

## Cache Management Methods

#### listCachedExtensions()

```typescript
listCachedExtensions(): Promise<ExtensionInfo[]>
```

**Input:** None

**Output:** `Promise<ExtensionInfo[]>` - Array of globally cached extensions

**Side Effects:** None (read-only operation)

**Usage:**

```typescript
const cachedExtensions = await extensionManager.listCachedExtensions();

// Show available extensions for import
const availableForImport = cachedExtensions.filter(
  ext => !currentWorkspaceExtensions.some(we => we.name === ext.name)
);
```

#### importFromCache()

```typescript
importFromCache(workspaceId: string, extensionName: string): Promise<void>
```

**Input:**

- `workspaceId: string` - Target workspace identifier
- `extensionName: string` - Name of cached extension to import

**Output:** `Promise<void>`

**Side Effects:** Copies extension files from cache to workspace `SOURCE/extensions/`

**Usage:**

```typescript
// Import popular extension from cache
await extensionManager.importFromCache('workspace-123', 'markdown-it');
```

#### deleteCachedExtension()

```typescript
deleteCachedExtension(extensionName: string): Promise<void>
```

**Input:**

- `extensionName: string` - Cached extension to delete

**Output:** `Promise<void>`

**Side Effects:** Removes extension from global cache (workspace copies unaffected)

**Usage:**

```typescript
await extensionManager.deleteCachedExtension('unused-extension');
```

#### cacheExtension()

```typescript
cacheExtension(workspaceId: string, extensionName: string): Promise<void>
```

**Input:**

- `workspaceId: string` - Source workspace identifier
- `extensionName: string` - Extension to cache

**Output:** `Promise<void>`

**Side Effects:** Copies extension from workspace to global cache

**Usage:**

```typescript
// Manually cache a workspace extension
await extensionManager.cacheExtension('workspace-123', 'custom-extension');
```

## Batch Operations

#### scanAndCacheExtensions()

```typescript
scanAndCacheExtensions(workspaceId: string): Promise<CachingSummary>
```

**Input:**

- `workspaceId: string` - Workspace to scan for extensions

**Output:** `Promise<CachingSummary>` - Summary of caching results

**Side Effects:** Automatically caches all workspace extensions not already in cache

**Usage:**

```typescript
// Called automatically during workspace import
const summary = await extensionManager.scanAndCacheExtensions('workspace-123');

console.log(`Cached ${summary.successCount} extensions`);
if (summary.conflicts.length > 0) {
  console.log(`Conflicts: ${summary.conflicts.join(', ')}`);
}
```

## Utility Methods

#### detectExtensionName()

```typescript
detectExtensionName(filename: string): string
```

**Input:**

- `filename: string` - JavaScript filename

**Output:** `string` - Normalized extension name

**Side Effects:** None (pure function)

**Usage:**

```typescript
const name1 = extensionManager.detectExtensionName('markdown-it-13.0.1.min.js');
// Returns: 'markdown-it'

const name2 = extensionManager.detectExtensionName('highlight.js');
// Returns: 'highlight'

const name3 = extensionManager.detectExtensionName('Custom Library.js');
// Returns: 'custom-library'
```

#### validateExtensionFile()

```typescript
validateExtensionFile(file: File): ValidationResult
```

**Input:**

- `file: File` - File to validate

**Output:** `ValidationResult` - Validation status and file type

**Side Effects:** None (read-only validation)

**Usage:**

```typescript
const result = extensionManager.validateExtensionFile(uploadedFile);

if (result.isValid) {
  console.log(`Valid ${result.fileType} file`);
} else {
  console.error(`Invalid file: ${result.error}`);
}
```

## Type Definitions

### ExtensionInfo

```typescript
interface ExtensionInfo {
  name: string; // Extension directory name
  files: ExtensionFile[]; // All JS and license files
  totalSize: number; // Combined size of all files in bytes
  location: 'workspace' | 'cache'; // Where this info was retrieved from
}
```

### ExtensionFile

```typescript
interface ExtensionFile {
  filename: string; // e.g., "markdown-it.min.js", "LICENSE.txt"
  size: number; // File size in bytes
  type: 'javascript' | 'license'; // File type classification
}
```

### CachingSummary

```typescript
interface CachingSummary {
  successCount: number; // Number of extensions successfully cached
  totalScanned: number; // Total extensions found in workspace
  conflicts: string[]; // Names of extensions with cache conflicts
  errors: CachingError[]; // Detailed error information
}
```

### CachingError

```typescript
interface CachingError {
  extensionName: string; // Extension that failed to cache
  reason: 'conflict' | 'storage' | 'validation';
  message: string; // Human-readable error message
}
```

### ValidationResult

```typescript
interface ValidationResult {
  isValid: boolean; // Whether file passed validation
  fileType: 'javascript' | 'license' | 'unknown';
  error?: string; // Error message if validation failed
}
```

## Error Handling

### Common Exceptions

The Extension Manager throws standard JavaScript errors for various failure scenarios:

#### Extension Name Conflicts

```typescript
// Thrown when importing extension with existing name in workspace
throw new Error(`Extension '${extensionName}' already exists in workspace`);
```

#### Cache Conflicts

```typescript
// Thrown when manually caching extension that conflicts with existing cache
throw new Error(`Extension '${extensionName}' already cached with different content`);
```

#### File Storage Errors

```typescript
// Thrown when underlying file operations fail
throw new Error(`Failed to write extension file: ${storageError.message}`);
```

#### Validation Errors

```typescript
// Thrown when extension name is invalid
throw new Error(`Invalid extension name: '${extensionName}' contains illegal characters`);
```

### Error Handling Patterns

```typescript
// Basic error handling
try {
  await extensionManager.importExtension(workspaceId, file, name);
} catch (error) {
  if (error.message.includes('already exists')) {
    // Handle name conflict
    showNameConflictDialog(name);
  } else {
    // Handle other errors
    showErrorNotification(error.message);
  }
}

// Batch operation error handling
const summary = await extensionManager.scanAndCacheExtensions(workspaceId);
if (summary.errors.length > 0) {
  // Log errors but don't interrupt workflow
  console.warn('Some extensions could not be cached:', summary.errors);
}
```

## Common Integration Patterns

### Extension Import Workflow

Complete workflow for importing a new extension from file upload:

```typescript
async function handleExtensionImport(workspaceId: string, file: File) {
  try {
    // 1. Validate file
    const validation = extensionManager.validateExtensionFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // 2. Detect and confirm name
    const detectedName = extensionManager.detectExtensionName(file.name);
    const confirmedName = await promptUserForName(detectedName);

    // 3. Check for conflicts
    const existing = await extensionManager.listWorkspaceExtensions(workspaceId);
    if (existing.some(ext => ext.name === confirmedName)) {
      throw new Error(`Extension '${confirmedName}' already exists`);
    }

    // 4. Import extension (automatically caches)
    const extensionInfo = await extensionManager.importExtension(workspaceId, file, confirmedName);

    // 5. Update UI
    showSuccessMessage(`Extension '${extensionInfo.name}' imported successfully`);
    refreshExtensionList();
  } catch (error) {
    showErrorMessage(`Failed to import extension: ${error.message}`);
  }
}
```

### Cache Import Workflow

Importing an extension from the global cache:

```typescript
async function importExtensionFromCache(workspaceId: string, extensionName: string) {
  try {
    // 1. Verify extension exists in cache
    const cached = await extensionManager.listCachedExtensions();
    const extension = cached.find(ext => ext.name === extensionName);
    if (!extension) {
      throw new Error(`Extension '${extensionName}' not found in cache`);
    }

    // 2. Check workspace conflicts
    const workspace = await extensionManager.listWorkspaceExtensions(workspaceId);
    if (workspace.some(ext => ext.name === extensionName)) {
      throw new Error(`Extension '${extensionName}' already exists in workspace`);
    }

    // 3. Import from cache
    await extensionManager.importFromCache(workspaceId, extensionName);

    // 4. Update UI
    showSuccessMessage(`Extension '${extensionName}' imported from cache`);
    refreshExtensionList();
  } catch (error) {
    showErrorMessage(`Failed to import from cache: ${error.message}`);
  }
}
```

### Workspace Import Integration

Integration with workspace import process:

```typescript
async function importWorkspaceWithExtensions(epubFile: File) {
  try {
    // 1. Standard EPUB import
    const result = await epubUnpacker.unpackEPUB(epubFile, workspaceId);

    // 2. Auto-cache discovered extensions
    const cachingSummary = await extensionManager.scanAndCacheExtensions(workspaceId);

    // 3. Log caching results (non-blocking)
    if (cachingSummary.successCount > 0) {
      console.log(`Cached ${cachingSummary.successCount} new extensions`);
    }
    if (cachingSummary.conflicts.length > 0) {
      console.log(`Cache conflicts: ${cachingSummary.conflicts.join(', ')}`);
    }

    // 4. Continue with normal import workflow
    showSuccessMessage(`Workspace imported with ${result.extensionCount} extensions`);
  } catch (error) {
    showErrorMessage(`Import failed: ${error.message}`);
  }
}
```

## Internal API Details

### Cache Storage Structure

Extensions are stored in the global cache using the File Storage API with workspace ID `'extensions-cache'`:

```
File Storage:
├── workspace-123/           # Regular workspaces
├── workspace-456/
└── extensions-cache/        # Global extension cache
    ├── markdown-it/
    │   ├── markdown-it.min.js
    │   ├── markdown-it-footnote.js
    │   └── LICENSE.txt
    └── prism/
        └── prism.min.js
```

### Extension Comparison Logic

For cache conflict detection, extensions are compared using file list and total size:

```typescript
interface ExtensionSignature {
  files: Array<{ name: string; size: number }>;
  totalSize: number;
}

function compareExtensions(sig1: ExtensionSignature, sig2: ExtensionSignature): boolean {
  if (sig1.totalSize !== sig2.totalSize) return false;
  if (sig1.files.length !== sig2.files.length) return false;

  const files1 = sig1.files.sort((a, b) => a.name.localeCompare(b.name));
  const files2 = sig2.files.sort((a, b) => a.name.localeCompare(b.name));

  return files1.every(
    (file, index) => file.name === files2[index].name && file.size === files2[index].size
  );
}
```

### Name Normalization

Extension names are normalized to ensure safe directory names:

```typescript
function normalizeExtensionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}
```

## Performance Considerations

### Efficient Cache Operations

- **Lazy Loading**: Extension details loaded only when needed
- **Batch Caching**: Multiple extensions cached in single operation during import
- **Signature Comparison**: Fast conflict detection using file metadata

### Memory Management

- **Streaming**: Large extension files processed in chunks
- **Cleanup**: Temporary objects released promptly after operations
- **File Handles**: Proper cleanup of File API objects

### Network Optimization

- **Local Operations**: All caching operations use local File Storage
- **No External Requests**: License validation doesn't fetch remote content
- **Minimal Transfers**: Only necessary files copied between cache and workspace

## Browser Compatibility

### Required APIs

- **File API**: For file upload and processing
- **Structured Cloning**: For copying extension data
- **Blob/ArrayBuffer**: For file content handling

### Fallback Strategies

- **Error Handling**: Graceful degradation when File API unavailable
- **Memory Limits**: Chunked processing for large extensions
- **Storage Quota**: Quota-aware caching with cleanup

## Testing Considerations

### Unit Test Coverage

- Extension name detection and normalization
- File validation logic
- Cache conflict detection
- Error handling scenarios

### Integration Test Scenarios

- End-to-end import workflows
- Cache population during workspace import
- Multi-file extension handling
- Error recovery and cleanup

### Browser Testing

- File upload handling across browsers
- Large file processing
- Memory usage patterns
- Storage quota behavior
