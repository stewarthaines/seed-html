# 01. File Storage API

## Overview

Implements browser-local file storage using OPFS with dual API support for cross-browser compatibility, providing the foundation for all workspace data persistence.

## Requirements

- OPFS implementation with dual API support (createWritable + createSyncAccessHandle)
- Fallback-based API usage (no upfront feature detection)
- Storage quota monitoring and error handling
- Workspace folder management with unique IDs

## Dependencies

- None (foundational feature)

## Implementation File Structure

```
src/lib/storage/
├── index.ts                    // Main exports and backend implementations
├── types.ts                    // TypeScript interfaces and types
├── feature-detector.ts         // Comprehensive capability detection
├── worker-manager.ts           // OPFS sync worker management
├── opfs-worker.js             // JavaScript worker script (imported as ?raw)
├── test-setup.ts              // Testing utilities and mocks
├── file-storage.test.ts        // Core API functionality tests
├── feature-detection.test.ts   // Feature detection logic tests
├── integration.test.ts         // Cross-browser integration tests
├── opfs-worker.test.ts        // Worker script functionality tests
└── worker.test.ts             // Worker manager tests
```

## Primary Implementation

- **File**: `src/lib/storage/index.ts`
- **Export**: `FileStorageAPI` class
- **Usage**: `import { FileStorageAPI } from '$lib/storage'`

## Technical Approach

- **Multi-Backend Architecture**: Automatic backend selection via factory pattern
- **OPFS Implementation**: Main thread (async) and worker-based (sync) support
- **IndexedDB Fallback**: Universal compatibility for file:// protocol and older browsers
- **Worker Manager**: Dedicated worker management for OPFS sync operations in Safari
- **Feature Detection**: Comprehensive capability testing with parallel execution and caching
- **Workspace Isolation**: Files organized under `workspaces/` subdirectory structure
- **Event-Driven Monitoring**: Storage events for quota warnings and backend changes
- **Error Handling**: Structured error system with specific error codes and recovery strategies
- **Testing Infrastructure**: Extensive mocking and testing utilities for cross-browser scenarios

## API Design

```typescript
interface FileStorageAPI {
  // Workspace management
  createWorkspace(id: string): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;
  listWorkspaces(): Promise<string[]>;

  // File operations
  writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void>;
  readFile(workspaceId: string, path: string): Promise<ArrayBuffer>;
  deleteFile(workspaceId: string, path: string): Promise<void>;
  renameFile(workspaceId: string, oldPath: string, newPath: string): Promise<void>;
  listFiles(workspaceId: string, path?: string): Promise<string[]>;

  // Storage monitoring
  getQuota(): Promise<{ used: number; available: number }>;
  estimateWorkspaceSize(workspaceId: string): Promise<number>;

  // Utility methods
  writeTextFile(workspaceId: string, path: string, content: string): Promise<void>;
  readTextFile(workspaceId: string, path: string): Promise<string>;
  fileExists(workspaceId: string, path: string): Promise<boolean>;
}
```

## OPFS Implementation

- Use `navigator.storage.getDirectory()` for root access
- Organize files under structured top-level directories
- Create workspace subdirectories under `workspaces/` for isolation
- Dual API support with fallback strategy (try createWritable first, fallback to createSyncAccessHandle)
- **Path Handling**: Treat paths as directory elements within workspace (e.g., `OEBPS/chapter1.xhtml` creates `OEBPS/` directory with `chapter1.xhtml` file)

### Directory Structure

```
/ (OPFS root)
├── workspaces/
│   ├── workspace-{uuid}/
│   │   ├── META-INF/
│   │   ├── OEBPS/
│   │   └── EDITME/
│   └── workspace-{uuid}/
├── temp/
├── cache/
└── packaging/
```

### Dual API with Fallback Strategy

```typescript
async function writeFileWithFallback(fileHandle: FileSystemFileHandle, content: ArrayBuffer) {
  try {
    // Try createWritable first (Chrome, Firefox, Edge)
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (error) {
    // Fallback to createSyncAccessHandle (Safari)
    const syncHandle = await fileHandle.createSyncAccessHandle();
    syncHandle.write(content, { at: 0 });
    syncHandle.flush();
    syncHandle.close();
  }
}
```

### OPFS Support Detection

```typescript
function isOPFSSupported(): boolean {
  return 'storage' in navigator && 'getDirectory' in navigator.storage;
}

// Usage: Check basic support, handle failures during actual operations
if (!isOPFSSupported()) {
  throw new FileStorageError(ErrorCodes.OPFS_NOT_SUPPORTED, 'OPFS not supported in this browser');
}
```

## Implementation Details

### Main Thread Operations

```typescript
// Workspace operations
const root = await navigator.storage.getDirectory();
const workspacesDir = await root.getDirectoryHandle('workspaces', {
  create: true,
});
const workspaceDir = await workspacesDir.getDirectoryHandle(workspaceId, {
  create: true,
});

// Read operations - all browsers support async getFile()
const fileHandle = await workspaceDir.getFileHandle(fileName);
const file = await fileHandle.getFile();
const content = await file.arrayBuffer();

// List operations - all browsers support async iteration
for await (const [name, handle] of workspaceDir.entries()) {
  if (handle.kind === 'file') {
    // Process file
  }
}

// Delete operations - all browsers support async removeEntry()
await workspaceDir.removeEntry(fileName);

// List workspaces
const workspaceIds = [];
for await (const [name, handle] of workspacesDir.entries()) {
  if (handle.kind === 'directory') {
    workspaceIds.push(name);
  }
}
```

### Root Namespace Organization

- **`workspaces/`** - All EPUB workspace data isolated in subdirectories
- **`temp/`** - Temporary files during EPUB processing
- **`cache/`** - Cached transform results and blob URLs
- **`packaging/`** - Intermediate files during EPUB creation/export
- **Root level** - Available for app-level configuration and metadata

## Architecture Components

### Storage Backend Factory

```typescript
class StorageBackendFactory {
  static async detectStorageBackend(): Promise<BackendType>;
  static async create(): Promise<StorageBackend>;
  static async getCapabilities(): Promise<StorageCapabilities>;
  static clearCache(): void;
}
```

**Purpose**: Automatically detects optimal storage backend and creates appropriate implementation.

**Backend Priority**:

1. OPFS Async (Chrome/Firefox/Edge main thread)
2. OPFS Sync Worker (Safari, file:// restrictions)
3. IndexedDB (Universal fallback)

### Feature Detection System

```typescript
class FeatureDetector {
  async detectCapabilities(): Promise<StorageCapabilities>;
  async detectOptimalBackend(): Promise<BackendType>;
  async testOPFSAvailable(): Promise<boolean>;
  async testOPFSAsync(): Promise<boolean>;
  async testOPFSSync(): Promise<boolean>;
  async testOPFSSyncWorker(): Promise<boolean>;
  async testIndexedDB(): Promise<boolean>;
  async testStorageEstimate(): Promise<boolean>;
  clearCache(): void;
}
```

**Features**:

- Parallel capability testing for performance
- Real browser testing with actual API calls
- Capability result caching
- Worker-based sync testing with timeout handling
- Graceful fallback on test failures

### Worker Manager (OPFS Sync)

```typescript
// Worker Manager (main thread)
class OPFSWorkerManager {
  async createWorkspace(id: string): Promise<OperationResult>;
  async writeFile(
    workspaceId: string,
    path: string,
    content: ArrayBuffer
  ): Promise<OperationResult>;
  async readFile(workspaceId: string, path: string): Promise<OperationResult>;
  // ... other operations
  destroy(): void;
}

// Worker Script (opfs-worker.js)
import workerScript from './opfs-worker.js?raw';
```

**Purpose**: Manages Web Worker for OPFS sync access handle operations (Safari).

**Architecture**:

- **Separate JavaScript Worker File**: `opfs-worker.js` (plain JavaScript for browser compatibility)
- **Vite `?raw` Import**: Worker script imported as string at build time
- **Blob URL Creation**: Dynamic worker creation from imported JavaScript
- **Type-Safe Communication**: Structured message/response interfaces (TypeScript types in main thread)

**Implementation Pattern**:

```typescript
// Worker Manager imports JavaScript worker as raw string
import workerScript from './opfs-worker.js?raw';

class OPFSWorkerManager {
  private initWorker(): void {
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerURL = URL.createObjectURL(blob);
    this.worker = new Worker(workerURL);
    URL.revokeObjectURL(workerURL);
  }
}
```

**Features**:

- **Message-based communication** with type safety
- **Operation timeouts** and error handling
- **Resource cleanup** and worker lifecycle management
- **Structured result objects** with success/error states
- **Individual function testability** - worker functions can be tested independently
- **Browser compatibility** - plain JavaScript avoids TypeScript interface syntax errors
- **Better maintainability** - separate file enables better code organization

### Storage Event System

```typescript
interface StorageEvents {
  'quota-warning': { used: number; available: number; threshold: number };
  'quota-exceeded': { used: number; available: number };
  'backend-changed': { from: BackendType; to: BackendType };
  'workspace-created': { workspaceId: string };
  'workspace-deleted': { workspaceId: string };
  'file-written': { workspaceId: string; path: string; size: number };
  'file-deleted': { workspaceId: string; path: string };
}
```

**Purpose**: Event-driven architecture for storage monitoring and notifications.

### Testing Infrastructure

```typescript
class MockBrowserAPIs {
  static setupGlobalMocks(): void;
  static mockNavigator(): any;
  static mockIndexedDB(): any;
  // ... other browser API mocks
}

class TestDataGenerator {
  static createWorkspaceId(): string;
  static createTextContent(size: number): ArrayBuffer;
  static createEPUBStructure(): Map<string, ArrayBuffer>;
  // ... other test data generators
}

class PerformanceTestHelpers {
  static async measureTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }>;
  static async runConcurrent<T>(
    operations: (() => Promise<T>)[],
    maxConcurrency: number
  ): Promise<T[]>;
  // ... other performance utilities
}
```

**Purpose**: Comprehensive testing utilities for cross-browser compatibility and performance testing.

## Error Handling

### Error Types

```typescript
class FileStorageError extends Error {
  constructor(
    public code: string,
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'FileStorageError';
  }
}

// Enhanced error code system
enum StorageErrorCode {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  BACKEND_UNAVAILABLE = 'BACKEND_UNAVAILABLE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  INVALID_PATH = 'INVALID_PATH',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
```

### Error Handling Examples

```typescript
try {
  await fileStorage.writeFile('workspace-123', 'OEBPS/chapter1.xhtml', content);
} catch (error) {
  if (error instanceof FileStorageError) {
    switch (error.code) {
      default:
        // Generic error handling
        showErrorToast(error.message);
    }
  }
}

// Quota monitoring with proactive handling
const quota = await fileStorage.getQuota();
if (quota.used / quota.available > 0.9) {
  // Warn user before quota exceeded
  showQuotaWarning(quota);
}
```

## Testing Considerations

### Comprehensive Test Coverage (52 Tests)

- **Core API Functionality**: All storage operations across backends
- **Feature Detection Logic**: Capability testing with browser simulation
- **Cross-Browser Scenarios**: Chrome, Firefox, Safari, Edge compatibility
- **Worker Management**: OPFS sync worker communication and lifecycle
- **Worker Script Testing**: Individual worker function testing with JavaScript compatibility
- **Error Handling**: All error codes and recovery scenarios
- **Performance Testing**: Concurrent operations and large file handling
- **Data Type Compatibility**: ArrayBuffer, text encoding, binary data
- **Mock Infrastructure**: Complete browser API simulation
- **Build System Integration**: Vite `?raw` import testing with JavaScript worker files

### Test Files Structure

- `file-storage.test.ts` - Core functionality and data handling (14 tests)
- `feature-detection.test.ts` - Backend selection and capability logic (13 tests)
- `integration.test.ts` - Cross-browser integration scenarios (13 tests)
- `opfs-worker.test.ts` - Worker script functionality and importability (9 tests)
- `worker.test.ts` - Worker manager lifecycle and communication (3 tests)

### Worker Testing Architecture

```typescript
// Test JavaScript worker import
const workerScript = await import('./opfs-worker.js?raw');
expect(typeof workerScript.default).toBe('string');

// Test worker function patterns through simulation
const simulateCreateWorkspace = async (workspaceId: string) => {
  // Simulate worker logic for testing
};

// Test message handling patterns
const simulateMessageHandler = (messageType: string, data: any, id: number) => {
  // Test worker communication protocol
};
```

## Performance Benefits

- **Intelligent Backend Selection**: Automatic optimization based on browser capabilities
- **Parallel Feature Detection**: All capability tests run concurrently for faster initialization
- **Capability Caching**: Feature detection results cached to avoid repeated testing
- **Worker Management**: Efficient worker lifecycle for OPFS sync operations when needed
- **Main Thread Optimization**: OPFS async operations on main thread when available
- **Structured Error Handling**: Specific error codes enable optimized error recovery
- **Event-Driven Architecture**: Non-blocking storage monitoring and notifications
- **Workspace Isolation**: Each EPUB project completely isolated from others
- **Memory Efficient**: ArrayBuffer-based operations with minimal copying

## Implementation Notes

### Development Approach

- **Factory Pattern**: StorageBackendFactory automatically selects optimal backend
- **Feature Detection First**: Comprehensive capability testing before backend creation
- **Worker Fallback**: OPFS sync worker for Safari and file:// protocol restrictions
- **Type Safety**: Full TypeScript implementation with strict type checking
- **Event-Driven Design**: Storage events for monitoring and notifications
- **Comprehensive Testing**: 52 tests covering all functionality and edge cases
- **Build System Integration**: Vite `?raw` imports for JavaScript worker files

### Build System Integration

```typescript
// TypeScript declarations for raw imports
declare module '*.js?raw' {
  const content: string;
  export default content;
}

// Worker import and usage
import workerScript from './opfs-worker.js?raw';

class OPFSWorkerManager {
  private initWorker(): void {
    // JavaScript worker file imported as-is (no TypeScript compilation needed)
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerURL = URL.createObjectURL(blob);
    this.worker = new Worker(workerURL);
    URL.revokeObjectURL(workerURL);
  }
}
```

**Benefits**:

- **Browser Compatibility**: Plain JavaScript avoids TypeScript interface syntax errors in workers
- **Direct Import**: No compilation needed - JavaScript files imported as-is
- **Type Safety in Main Thread**: TypeScript interfaces used for message communication from main thread
- **Testability**: Worker functions can be tested individually and imported for testing
- **Maintainability**: Separate files enable better code organization and debugging

**Important Note**: The worker script must be plain JavaScript (`.js`) rather than TypeScript (`.ts`) because when imported as raw text and executed in a Web Worker, browsers cannot parse TypeScript interfaces. TypeScript type safety is maintained in the main thread through proper interface definitions for worker communication.

### Production Considerations

- **Automatic Fallback**: Graceful degradation from OPFS → IndexedDB
- **Resource Management**: Proper cleanup of workers and event listeners
- **Error Recovery**: Structured error handling with specific recovery strategies
- **Performance Monitoring**: Built-in performance measurement utilities
- **Memory Management**: Efficient ArrayBuffer operations with minimal copying

## Implementation Pattern

```typescript
class FileStorageAPI {
  async writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void> {
    const root = await navigator.storage.getDirectory();
    const workspaceDir = await this.ensureWorkspaceDirectory(root, workspaceId);
    const fileHandle = await this.ensureFileHandle(workspaceDir, path);

    // Use fallback strategy for cross-browser compatibility
    await this.writeFileWithFallback(fileHandle, content);
  }

  private async writeFileWithFallback(fileHandle: FileSystemFileHandle, content: ArrayBuffer) {
    try {
      // Try createWritable first (Chrome, Firefox, Edge)
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    } catch (error) {
      // Fallback to createSyncAccessHandle (Safari)
      const syncHandle = await fileHandle.createSyncAccessHandle();
      syncHandle.write(content, { at: 0 });
      syncHandle.flush();
      syncHandle.close();
    }
  }

  async createWorkspace(workspaceId: string) {
    const root = await navigator.storage.getDirectory();
    const workspacesDir = await root.getDirectoryHandle('workspaces', {
      create: true,
    });
    await workspacesDir.getDirectoryHandle(workspaceId, { create: true });
  }

  async listWorkspaces(): Promise<string[]> {
    const root = await navigator.storage.getDirectory();
    const workspacesDir = await root.getDirectoryHandle('workspaces', {
      create: true,
    });

    const workspaceIds: string[] = [];
    for await (const [name, handle] of workspacesDir.entries()) {
      if (handle.kind === 'directory') {
        workspaceIds.push(name);
      }
    }
    return workspaceIds;
  }

  private async ensureFileHandle(workspaceDir: FileSystemDirectoryHandle, path: string) {
    const pathParts = path.split('/');
    const fileName = pathParts.pop();

    if (pathParts.length > 0) {
      const targetDir = await this.ensureDirectoryPath(workspaceDir, pathParts);
      return await targetDir.getFileHandle(fileName, { create: true });
    }

    return await workspaceDir.getFileHandle(fileName, { create: true });
  }

  private async ensureDirectoryPath(baseDir: FileSystemDirectoryHandle, pathParts: string[]) {
    let currentDir = baseDir;
    for (const part of pathParts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create: true });
    }
    return currentDir;
  }
}
```

## Example Usage Patterns

```typescript
// Example: Loading an EPUB workspace
import { FileStorageAPI } from '$lib/storage';
const storage = new FileStorageAPI();
async function loadEPUBWorkspace(workspaceId: string) {
  try {
    const package = await storage.readFile(workspaceId, 'OEBPS/content.opf');
    const decoder = new TextDecoder();
    const packageContent = decoder.decode(package);
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'application/xml');
    const title = doc.querySelector('metadata dc:title').value;
    const author = doc.querySelector('metadata dc:creator').value;

    // process content.opf to extract book title and author from metadata...
  } catch (error) {
    console.error('Failed to handle file:', error);
  }
}

// Example: Saving editor content
async function saveChapterContent(workspaceId: string, chapterPath: string, content: string) {
  try {
    await storage.writeFile(workspaceId, chapterPath, encoder.encode(chapter1));
  } catch (error) {
    console.error('Failed to update chapter', error);
  }
}
```
