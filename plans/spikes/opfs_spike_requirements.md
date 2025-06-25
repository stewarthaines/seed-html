# OPFS Spike Requirements Document

## Overview

Define requirements for OPFS spike implementation using feature detection and progressive fallback to support file:// protocol across all browsers.

## Objectives

- Support file:// protocol execution across all browsers
- Use feature detection instead of browser detection
- Implement progressive fallback with error-based triggers
- Provide transparent backend abstraction for Feature 01 implementation

## Backend Strategy

### 1. Safari: createSyncAccessHandle + Worker Thread

- **Feature**: `createSyncAccessHandle()` available on FileSystemFileHandle
- **Context**: Web Worker thread for synchronous API
- **Use Case**: file:// protocol support

### 2. Firefox: createWritable + Main Thread

- **Feature**: `createWritable()` available on FileSystemFileHandle
- **Context**: Main thread for asynchronous API
- **Use Case**: file:// protocol support

### 3. Chrome/Edge: IndexedDB + Main Thread

- **Feature**: OPFS blocked on file:// protocol, fall back to IndexedDB
- **Context**: Main thread using IndexedDB API
- **Use Case**: file:// protocol fallback when OPFS fails

## Feature Detection Logic

### Primary Detection Sequence

```javascript
async function detectStorageBackend() {
  // Step 1: Check OPFS basic support
  if (!('storage' in navigator && 'getDirectory' in navigator.storage)) {
    return 'indexeddb';
  }

  try {
    // Step 2: Test OPFS access
    const root = await navigator.storage.getDirectory();
    const testHandle = await root.getFileHandle('__capability_test__', { create: true });

    // Step 3: Test createWritable on main thread first (generally preferred)
    if ('createWritable' in testHandle) {
      try {
        const writable = await testHandle.createWritable();
        await writable.close();
        await root.removeEntry('__capability_test__');
        return 'opfs-async'; // Main thread async (preferred when available)
      } catch (error) {
        // OPFS blocked (typically file:// protocol restrictions)
        // Don't clean up test file yet, may need it for worker test
      }
    }

    // Step 4: Test worker sync as fallback
    const workerSupportsSync = await testWorkerSyncAccessHandle();
    if (workerSupportsSync) {
      await root.removeEntry('__capability_test__');
      return 'opfs-sync'; // Worker sync fallback
    }

    // Step 5: Test createSyncAccessHandle on main thread (rare)
    if ('createSyncAccessHandle' in testHandle) {
      try {
        const syncHandle = await testHandle.createSyncAccessHandle();
        syncHandle.close();
        await root.removeEntry('__capability_test__');
        return 'opfs-sync'; // Main thread sync approach
      } catch (error) {
        // Expected to fail in most browsers
      }
    }

    // No write capability available
    await root.removeEntry('__capability_test__');
    return 'indexeddb';
  } catch (error) {
    // OPFS completely unavailable
    return 'indexeddb';
  }
}

async function testWorkerSyncAccessHandle() {
  return new Promise(resolve => {
    const workerScript = `
      (async () => {
        try {
          const root = await navigator.storage.getDirectory();
          const testHandle = await root.getFileHandle('__worker_test__', { create: true });
          if ('createSyncAccessHandle' in testHandle) {
            const syncHandle = await testHandle.createSyncAccessHandle();
            syncHandle.close();
            await root.removeEntry('__worker_test__');
            self.postMessage({ success: true });
          } else {
            self.postMessage({ success: false });
          }
        } catch (error) {
          self.postMessage({ success: false, error: error.message });
        }
      })();
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerURL = URL.createObjectURL(blob);
    const worker = new Worker(workerURL);

    const timeout = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(workerURL);
      resolve(false);
    }, 3000);

    worker.onmessage = event => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(workerURL);
      resolve(event.data.success === true);
    };

    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(workerURL);
      resolve(false);
    };
  });
}
```

### Main Thread First Detection Strategy

**Problem**: Different browsers have different optimal OPFS implementations. Some browsers (Firefox, Chrome) work best with main thread `createWritable`, while others (Safari) perform better with worker-based `createSyncAccessHandle`.

**Solution**:

1. **Main thread first**: Test `createWritable` on main thread first (generally preferred)
2. **Worker fallback**: Use worker sync only when main thread async fails or isn't available
3. **Performance optimization**: Avoids worker overhead when main thread works well
4. **Browser agnostic**: No browser detection needed - pure feature detection

**Key Implementation Details**:

- Main thread `createWritable` preferred for Firefox, Chrome, Edge (no worker overhead)
- Worker `createSyncAccessHandle` used as fallback (good for Safari, file:// restrictions)
- Worker test includes proper cleanup and timeout handling
- 3-second timeout prevents hanging on worker creation failures
- Blob URL cleanup prevents memory leaks

### Error-Based Fallback Triggers

- **DOMException**: Security errors on file:// protocol
- **NotSupportedError**: API not available in context
- **QuotaExceededError**: Storage quota issues
- **Access denied errors**: Permission problems

## Unified API Layer

### Storage Backend Interface

```javascript
interface StorageBackend {
  // Workspace management
  createWorkspace(id: string): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;
  listWorkspaces(): Promise<string[]>;

  // File operations
  writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void>;
  readFile(workspaceId: string, path: string): Promise<ArrayBuffer>;
  deleteFile(workspaceId: string, path: string): Promise<void>;
  listFiles(workspaceId: string, path?: string): Promise<string[]>;

  // Storage info
  getQuota(): Promise<{ used: number; available: number }>;
  getBackendType(): 'opfs-sync' | 'opfs-async' | 'indexeddb';
}
```

### Backend Factory Implementation

```javascript
class StorageBackendFactory {
  static async create(): Promise<StorageBackend> {
    const backendType = await detectStorageBackend();

    switch (backendType) {
      case 'opfs-sync':
        return new OPFSSyncBackend(); // Safari + Worker
      case 'opfs-async':
        return new OPFSAsyncBackend(); // Firefox + Main Thread
      case 'indexeddb':
        return new IndexedDBBackend(); // Chrome/Edge fallback
      default:
        throw new Error(`Unsupported backend: ${backendType}`);
    }
  }
}
```

## Implementation Requirements

### 1. OPFS Sync Backend (Safari)

- **Worker Thread**: Dedicated Web Worker for createSyncAccessHandle
- **Message Protocol**: PostMessage communication with main thread
- **File Operations**: Synchronous read/write within worker
- **Error Handling**: Worker error propagation to main thread

### 2. OPFS Async Backend (Firefox)

- **Main Thread**: Direct OPFS operations on main thread
- **Async Operations**: Promise-based createWritable API
- **Performance**: No worker overhead, direct access
- **Error Handling**: Standard try/catch with async/await

### 3. IndexedDB Backend (Chrome/Edge)

- **Main Thread**: IndexedDB operations on main thread
- **Object Stores**: Separate stores for workspaces and files
- **Path Mapping**: Convert file paths to IndexedDB keys
- **Quota Management**: Use IndexedDB storage quota APIs

## Directory Structure Mapping

### OPFS Backends

```
/ (OPFS root)
├── workspaces/
│   ├── workspace-{uuid}/
│   │   ├── META-INF/content.opf
│   │   ├── OEBPS/chapter1.xhtml
│   │   └── EDITME/src/chapter1.txt
```

### IndexedDB Backend

```javascript
// Database: 'editme-storage'
// Object Stores:
//   - 'workspaces': { id: string, created: Date }
//   - 'files': {
//       workspaceId: string,
//       path: string,
//       content: ArrayBuffer,
//       modified: Date
//     }
```

## Error Handling Strategy

### Graceful Degradation

- **Feature detection before usage**: Never assume API availability
- **Runtime error recovery**: Catch and handle storage access errors
- **User notification**: Clear messaging about storage backend in use
- **Retry logic**: Automatic retry with exponential backoff

### Error Types and Responses

```javascript
const ERROR_RESPONSES = {
  SecurityError: 'fallback', // file:// protocol blocked
  NotSupportedError: 'fallback', // API not available
  QuotaExceededError: 'retry', // Storage full
  PermissionDeniedError: 'fallback', // Access denied
  NetworkError: 'retry', // Temporary network issue
};
```

## Performance Considerations

### Backend Performance Characteristics

- **OPFS Sync**: Fastest for small files, worker overhead
- **OPFS Async**: Good balance, main thread blocking
- **IndexedDB**: Consistent, works everywhere, some overhead

### Optimization Strategies

- **Connection pooling**: Reuse worker connections
- **Batch operations**: Group multiple file operations
- **Caching**: Cache frequently accessed metadata
- **Compression**: Compress large file content

## Testing Requirements

### Cross-Browser Testing

- **Chrome HTTPS**: OPFS async main thread (preferred)
- **Chrome file://**: IndexedDB fallback due to OPFS restrictions
- **Firefox HTTPS**: OPFS async main thread (preferred)
- **Firefox file://**: OPFS async main thread (preferred)
- **Safari HTTPS**: OPFS sync worker thread (main thread createWritable not available)
- **Safari file://**: OPFS sync worker thread (main thread createWritable not available)
- **Edge HTTPS**: OPFS async main thread (preferred)
- **Edge file://**: IndexedDB fallback due to OPFS restrictions

### Test Scenarios

- **Feature detection accuracy**: Correct backend selection across all browsers
- **Main thread preference**: Firefox/Chrome correctly prefer main thread over worker
- **Worker fallback**: Safari correctly falls back to worker when main thread unavailable
- **Performance optimization**: Most efficient backend automatically selected per browser
- **Timeout handling**: Worker tests complete within 3-second timeout
- **Error-based fallback**: Graceful degradation on access errors
- **File operations**: Read/write/delete across all backends
- **Workspace isolation**: No cross-contamination between workspaces
- **Memory management**: Proper cleanup of worker resources and blob URLs

### File:// Protocol Validation

- **Local file access**: All backends work from file:// URLs
- **Security restrictions**: Proper error handling when APIs blocked
- **Fallback transitions**: Smooth transitions between backends

## Implementation Phases

### Phase 1: Feature Detection

- Implement detectStorageBackend() function
- Add error-based fallback logic
- Test detection accuracy across browsers

### Phase 2: Backend Implementations

- Implement OPFSSyncBackend with worker
- Implement OPFSAsyncBackend for main thread
- Implement IndexedDBBackend as fallback

### Phase 3: Unified API

- Create StorageBackend interface
- Implement StorageBackendFactory
- Add transparent backend switching

### Phase 4: Integration Testing

- Test all backends with real EPUB data
- Validate file:// protocol support
- Performance benchmarking

## Success Criteria

### Functional Requirements

- ✅ All backends support complete file operations API
- ✅ Feature detection selects optimal backend automatically
- ✅ Error-based fallback works reliably
- ✅ file:// protocol support across all browsers

### Performance Requirements

- ✅ File operations complete within 100ms for typical EPUB files
- ✅ Workspace operations complete within 50ms
- ✅ Backend detection completes within 200ms

### Compatibility Requirements

- ✅ Works on Chrome, Firefox, Safari, Edge
- ✅ Works from both http:// and file:// protocols
- ✅ Graceful degradation when storage APIs unavailable

## Key Insights for Feature 01 Implementation

### Architecture Decisions

- **Pure feature detection**: No browser detection needed - more reliable and future-proof
- **Worker-first testing**: Automatically detects optimal performance capabilities
- **Error-based fallbacks**: Handle runtime restrictions elegantly
- **Unified API abstraction**: Hide backend complexity from application code
- **Performance optimization**: Fastest available backend selected automatically

### Implementation Priorities

1. **Robust feature detection**: Foundation for all other functionality
2. **IndexedDB fallback**: Ensures universal compatibility
3. **Error handling**: Critical for file:// protocol edge cases
4. **Performance optimization**: Each backend has different characteristics

This requirements document provides the foundation for implementing a robust, cross-browser file storage system that works reliably from file:// URLs through intelligent feature detection and progressive fallback strategies.
