# File Storage API Reference

## Overview

The File Storage API provides workspace-based file management with automatic browser storage backend detection:

- **FileStorageAPI**: Main class for workspace and file operations
- **StorageBackendFactory**: Detects optimal storage backend (OPFS vs IndexedDB)

The API automatically selects the best available storage backend (OPFS with IndexedDB fallback) for optimal blob content url handling and maximum browser compatibility.

## FileStorageAPI

### Constructor

```typescript
new FileStorageAPI();
```

Creates a new file storage instance. Storage backend is automatically detected and initialized on first use.

### Methods

#### init()

```typescript
init(): Promise<void>
```

**Input:** None

**Output:** `Promise<void>`

**Side Effects:**

- Detects and initializes optimal storage backend
- Sets up workspace directory structure
- Required before any other operations

**Usage:**

```typescript
const storage = new FileStorageAPI();
await storage.init();
console.log('Storage initialized with backend:', storage.getBackendType());
```

#### createWorkspace()

```typescript
createWorkspace(id?: string): Promise<string>
```

**Input:**

- `id?: string` - Optional workspace identifier (auto-generated if not provided)

**Output:** `Promise<string>` - The workspace ID (generated or provided)

**Side Effects:** Creates new workspace directory structure

**Usage:**

```typescript
// Auto-generate workspace ID
const workspaceId = await storage.createWorkspace();

// Use specific workspace ID
const customId = await storage.createWorkspace('my-epub-project');
```

#### deleteWorkspace()

```typescript
deleteWorkspace(id: string): Promise<void>
```

**Input:**

- `id: string` - Workspace identifier to delete

**Output:** `Promise<void>`

**Side Effects:** Permanently removes workspace and all contained files

**Usage:**

```typescript
await storage.deleteWorkspace('old-workspace-id');
```

#### listWorkspaces()

```typescript
listWorkspaces(): Promise<string[]>
```

**Input:** None

**Output:** `Promise<string[]>` - Array of workspace IDs

**Side Effects:** None (read-only)

**Usage:**

```typescript
const workspaces = await storage.listWorkspaces();
console.log('Available workspaces:', workspaces);
```

#### writeFile()

```typescript
writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void>
```

**Input:**

- `workspaceId: string` - Target workspace
- `path: string` - File path within workspace (supports nested directories)
- `content: ArrayBuffer` - File content as binary data

**Output:** `Promise<void>`

**Side Effects:**

- Creates file at specified path
- Creates intermediate directories as needed
- Overwrites existing files

**Usage:**

```typescript
const content = new TextEncoder().encode('Hello World');
await storage.writeFile('workspace-id', 'OEBPS/chapter1.xhtml', content.buffer);

// Nested path - creates directories automatically
await storage.writeFile('workspace-id', 'OEBPS/images/cover.jpg', imageBuffer);
```

#### readFile()

```typescript
readFile(workspaceId: string, path: string): Promise<ArrayBuffer>
```

**Input:**

- `workspaceId: string` - Source workspace
- `path: string` - File path within workspace

**Output:** `Promise<ArrayBuffer>` - File content as binary data

**Side Effects:** None (read-only)

**Usage:**

```typescript
const buffer = await storage.readFile('workspace-id', 'OEBPS/content.opf');
const text = new TextDecoder().decode(buffer);
console.log('OPF content:', text);
```

#### deleteFile()

```typescript
deleteFile(workspaceId: string, path: string): Promise<void>
```

**Input:**

- `workspaceId: string` - Target workspace
- `path: string` - File path to delete

**Output:** `Promise<void>`

**Side Effects:** Permanently removes file

**Usage:**

```typescript
await storage.deleteFile('workspace-id', 'OEBPS/old-chapter.xhtml');
```

#### listFiles()

```typescript
listFiles(workspaceId: string, path?: string): Promise<string[]>
```

**Input:**

- `workspaceId: string` - Target workspace
- `path?: string` - Optional directory path (lists all files if not provided)

**Output:** `Promise<string[]>` - Array of file paths relative to workspace root

**Side Effects:** None (read-only)

**Usage:**

```typescript
// List all files in workspace
const allFiles = await storage.listFiles('workspace-id');

// List files in specific directory
const imageFiles = await storage.listFiles('workspace-id', 'OEBPS/images');
```

#### getQuota()

```typescript
getQuota(): Promise<StorageQuota>
```

**Input:** None

**Output:** `Promise<StorageQuota>` - Storage usage information

**Side Effects:** None (read-only)

**Usage:**

```typescript
const quota = await storage.getQuota();
console.log(`Used: ${quota.used} bytes, Available: ${quota.available} bytes`);
```

#### getBackendType()

```typescript
getBackendType(): BackendType
```

**Input:** None

**Output:** `BackendType` - Current storage backend type

**Side Effects:** None

**Usage:**

```typescript
const backendType = storage.getBackendType();
console.log('Using storage backend:', backendType); // 'opfs-async' | 'opfs-sync' | 'indexeddb'
```

### Convenience Methods

#### writeTextFile()

```typescript
writeTextFile(workspaceId: string, path: string, content: string): Promise<void>
```

Helper method for writing text files. Automatically encodes string to ArrayBuffer.

**Usage:**

```typescript
await storage.writeTextFile('workspace-id', 'OEBPS/content.opf', opfXmlString);
```

#### readTextFile()

```typescript
readTextFile(workspaceId: string, path: string): Promise<string>
```

Helper method for reading text files. Automatically decodes ArrayBuffer to string.

**Usage:**

```typescript
const opfContent = await storage.readTextFile('workspace-id', 'OEBPS/content.opf');
```

## StorageBackendFactory

### Static Methods

#### detectStorageBackend()

```typescript
static detectStorageBackend(): Promise<BackendType>
```

Detects the optimal storage backend for the current browser environment.

#### testWorkerSyncAccessHandle()

```typescript
static testWorkerSyncAccessHandle(): Promise<boolean>
```

Tests if OPFS synchronous access handles work in a Web Worker (most performant option).

## Type Definitions

### StorageQuota

```typescript
interface StorageQuota {
  used: number; // Bytes currently used
  available: number; // Bytes available for use
}
```

### BackendType

```typescript
type BackendType = 'opfs-async' | 'opfs-sync' | 'indexeddb';
```

### StorageError

```typescript
class StorageError extends Error {
  code: StorageErrorCode;
  cause?: Error;
}

enum StorageErrorCode {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  BACKEND_UNAVAILABLE = 'BACKEND_UNAVAILABLE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  INVALID_PATH = 'INVALID_PATH',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
}
```

## Common Integration Patterns

### Basic Workspace Setup

```typescript
const storage = new FileStorageAPI();
await storage.init();

// Create workspace for new EPUB project
const workspaceId = await storage.createWorkspace();

// Add EPUB structure files
await storage.writeTextFile(workspaceId, 'mimetype', 'application/epub+zip');
await storage.writeTextFile(workspaceId, 'META-INF/container.xml', containerXml);
await storage.writeTextFile(workspaceId, 'OEBPS/content.opf', opfXml);
```

### File Management

```typescript
// Check what files exist
const files = await storage.listFiles(workspaceId);
console.log('Workspace contains:', files);

// Read and modify content
const content = await storage.readTextFile(workspaceId, 'OEBPS/chapter1.xhtml');
const modifiedContent = content.replace('old text', 'new text');
await storage.writeTextFile(workspaceId, 'OEBPS/chapter1.xhtml', modifiedContent);

// Clean up old files
await storage.deleteFile(workspaceId, 'OEBPS/unused-chapter.xhtml');
```

### Storage Monitoring

```typescript
// Check storage usage
const quota = await storage.getQuota();
const usedMB = quota.used / (1024 * 1024);
const availableMB = quota.available / (1024 * 1024);

if (quota.available < 10 * 1024 * 1024) {
  // Less than 10MB available
  console.warn('Low storage space available');
}

// Check backend type for feature availability
const backend = storage.getBackendType();
if (backend === 'indexeddb') {
  console.info('Using IndexedDB fallback - some features may be slower');
}
```

## Error Handling

All methods can throw `StorageError` with specific error codes:

```typescript
try {
  await storage.readFile('workspace-id', 'nonexistent-file.txt');
} catch (error) {
  if (error instanceof StorageError) {
    switch (error.code) {
      case StorageErrorCode.FILE_NOT_FOUND:
        console.log('File does not exist');
        break;
      case StorageErrorCode.WORKSPACE_NOT_FOUND:
        console.log('Workspace does not exist');
        break;
      case StorageErrorCode.QUOTA_EXCEEDED:
        console.log('Storage quota exceeded');
        break;
      default:
        console.error('Storage error:', error.message);
    }
  }
}
```

## Browser Compatibility

- **OPFS (Synchronous)**: Chrome 102+, Edge 102+ (fastest, Web Worker support)
- **OPFS (Asynchronous)**: Chrome 86+, Edge 86+, Firefox 111+, Safari 15.2+
- **IndexedDB Fallback**: All modern browsers (universal compatibility)

The API automatically detects and uses the best available backend for optimal performance while maintaining broad browser support.

## Performance Notes

- **OPFS Sync**: Best performance, uses Web Workers for background operations
- **OPFS Async**: Good performance, main thread operations
- **IndexedDB**: Slowest but most compatible, all operations async

File operations are optimized for EPUB workflows:

- Directory structures created automatically
- Binary and text file handling
- Efficient file listing and metadata access
- Memory-efficient for large files
