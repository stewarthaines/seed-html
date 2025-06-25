# 21. Worker-based File Storage

## Overview

Enhances the File Storage API with Web Worker-based write operations for improved performance and Safari compatibility, providing non-blocking file writes and optimized handling of large files.

## Requirements

- Web Worker wrapper for file write operations
- Message protocol for worker communication
- Lazy initialization of worker on first write
- Fallback to main thread implementation when worker fails
- Safari createSyncAccessHandle compatibility

## Dependencies

- **01. File Storage API** (base implementation)

## Technical Approach

- Extend base FileStorageAPI with worker-enhanced writes
- Keep all read operations on main thread for simplicity
- Progressive enhancement pattern (works without worker)
- Single worker instance shared across all write operations
- Automatic fallback on worker communication failures

## API Design

```typescript
interface WorkerFileStorageAPI extends FileStorageAPI {
  // Enhanced write with worker support
  writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void>;

  // Worker management
  terminateWorker(): Promise<void>;
  isWorkerActive(): boolean;
}

// Worker configuration
interface WorkerConfig {
  timeout: number; // Default: 30000ms
  retryAttempts: number; // Default: 1
  fallbackToMainThread: boolean; // Default: true
}
```

## Worker Message Protocol

```typescript
// Messages sent to worker
interface WriteRequest {
  id: string;
  type: 'write';
  workspaceId: string;
  path: string;
  content: ArrayBuffer;
}

interface InitRequest {
  id: string;
  type: 'init';
}

interface TerminateRequest {
  id: string;
  type: 'terminate';
}

// Messages from worker
interface WriteResponse {
  id: string;
  type: 'response';
  success: true;
}

interface ErrorResponse {
  id: string;
  type: 'error';
  code: string;
  message: string;
}

interface InitResponse {
  id: string;
  type: 'init-complete';
}
```

## Worker Implementation

```typescript
// worker-file-storage.js
class FileStorageWorker {
  async handleMessage(event) {
    const { id, type, workspaceId, path, content } = event.data;

    try {
      switch (type) {
        case 'init':
          await this.initializeOPFS();
          self.postMessage({ id, type: 'init-complete' });
          break;

        case 'write':
          await this.writeFile(workspaceId, path, content);
          self.postMessage({ id, type: 'response', success: true });
          break;

        case 'terminate':
          self.close();
          break;
      }
    } catch (error) {
      self.postMessage({
        id,
        type: 'error',
        code: this.getErrorCode(error),
        message: error.message,
      });
    }
  }

  async writeFile(workspaceId, path, content) {
    const root = await navigator.storage.getDirectory();
    const workspaceDir = await this.ensureWorkspaceDirectory(root, workspaceId);
    const fileHandle = await this.ensureFileHandle(workspaceDir, path);

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

  async ensureDirectoryPath(baseDir, pathParts) {
    let currentDir = baseDir;
    for (const part of pathParts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create: true });
    }
    return currentDir;
  }

  async ensureFileHandle(workspaceDir, path) {
    const pathParts = path.split('/');
    const fileName = pathParts.pop();

    if (pathParts.length > 0) {
      const targetDir = await this.ensureDirectoryPath(workspaceDir, pathParts);
      return await targetDir.getFileHandle(fileName, { create: true });
    }

    return await workspaceDir.getFileHandle(fileName, { create: true });
  }
}

const worker = new FileStorageWorker();
self.addEventListener('message', event => worker.handleMessage(event));
```

## Main Thread Enhancement

```typescript
class WorkerFileStorageAPI extends FileStorageAPI {
  private worker: Worker | null = null;
  private workerInitPromise: Promise<void> | null = null;
  private messageHandler: WorkerMessageHandler;
  private config: WorkerConfig;

  constructor(config: Partial<WorkerConfig> = {}) {
    super();
    this.config = {
      timeout: 30000,
      retryAttempts: 1,
      fallbackToMainThread: true,
      ...config,
    };
    this.messageHandler = new WorkerMessageHandler(this.config.timeout);
  }

  async writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void> {
    try {
      await this.ensureWorkerInitialized();
      await this.messageHandler.sendMessage({
        id: crypto.randomUUID(),
        type: 'write',
        workspaceId,
        path,
        content,
      });
    } catch (error) {
      if (this.config.fallbackToMainThread) {
        console.warn('Worker write failed, falling back to main thread:', error);
        return super.writeFile(workspaceId, path, content);
      }
      throw error;
    }
  }

  private async ensureWorkerInitialized() {
    if (!this.worker && !this.workerInitPromise) {
      this.workerInitPromise = this.initializeWorker();
    }

    if (this.workerInitPromise) {
      await this.workerInitPromise;
    }
  }

  private async initializeWorker() {
    try {
      this.worker = new Worker('/worker-file-storage.js');
      this.worker.addEventListener('message', event =>
        this.messageHandler.handleWorkerMessage(event)
      );

      // Initialize worker
      await this.messageHandler.sendMessage({
        id: crypto.randomUUID(),
        type: 'init',
      });
    } catch (error) {
      this.worker = null;
      this.workerInitPromise = null;
      throw new FileStorageError(
        ErrorCodes.WORKER_INITIALIZATION_FAILED,
        'Failed to initialize worker',
        error
      );
    }
  }

  async terminateWorker(): Promise<void> {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerInitPromise = null;
    }
  }

  isWorkerActive(): boolean {
    return this.worker !== null;
  }
}
```

## Worker Communication Handler

```typescript
class WorkerMessageHandler {
  private pendingMessages = new Map<string, { resolve: Function; reject: Function }>();
  private timeout: number;

  constructor(timeout: number = 30000) {
    this.timeout = timeout;
  }

  async sendMessage(
    message: WriteRequest | InitRequest | TerminateRequest
  ): Promise<WriteResponse | InitResponse> {
    return new Promise((resolve, reject) => {
      this.pendingMessages.set(message.id, { resolve, reject });

      if (!this.worker) {
        reject(new FileStorageError(ErrorCodes.WORKER_NOT_AVAILABLE, 'Worker not available'));
        return;
      }

      this.worker.postMessage(message);

      // Timeout handling
      setTimeout(() => {
        if (this.pendingMessages.has(message.id)) {
          this.pendingMessages.delete(message.id);
          reject(
            new FileStorageError(ErrorCodes.WORKER_COMMUNICATION_FAILED, 'Worker operation timeout')
          );
        }
      }, this.timeout);
    });
  }

  handleWorkerMessage(event: MessageEvent) {
    const response = event.data as WriteResponse | ErrorResponse | InitResponse;
    const pending = this.pendingMessages.get(response.id);

    if (pending) {
      this.pendingMessages.delete(response.id);

      if (response.type === 'error') {
        pending.reject(new FileStorageError(response.code, response.message));
      } else {
        pending.resolve(response);
      }
    }
  }
}
```

## Error Handling

```typescript
// Additional error codes for worker operations
const WorkerErrorCodes = {
  ...ErrorCodes,
  WORKER_INITIALIZATION_FAILED: 'WORKER_INITIALIZATION_FAILED',
  WORKER_NOT_AVAILABLE: 'WORKER_NOT_AVAILABLE',
  WORKER_COMMUNICATION_TIMEOUT: 'WORKER_COMMUNICATION_TIMEOUT',
};

// Worker-specific error handling
try {
  await workerStorage.writeFile('workspace-123', 'OEBPS/chapter1.xhtml', content);
} catch (error) {
  if (error instanceof FileStorageError) {
    switch (error.code) {
      case WorkerErrorCodes.WORKER_COMMUNICATION_FAILED:
        // Worker failed, main thread fallback already attempted
        showErrorDialog('File save failed. Please try again.');
        break;
      case WorkerErrorCodes.WORKER_INITIALIZATION_FAILED:
        // Worker couldn't start, fall back to main thread permanently
        this.useMainThreadStorage = true;
        break;
    }
  }
}
```

## Performance Benefits

- **Non-blocking UI**: Large file writes don't freeze the interface
- **Safari Compatibility**: createSyncAccessHandle runs in worker context
- **Parallel Processing**: Multiple files can be queued for writing
- **Memory Management**: Large file buffers handled in worker scope
- **Graceful Degradation**: Automatic fallback to main thread

## Testing Considerations

- Test worker initialization and termination
- Test message protocol timeout scenarios
- Test fallback to main thread when worker fails
- Verify Safari createSyncAccessHandle works in worker
- Performance benchmarks comparing worker vs main thread
- Test with large files (>10MB) to verify memory handling

## Implementation Notes

- Worker file should be served from content blob url file: schema deployment
- Monitor worker memory usage for very large files
- Implement retry logic for transient worker failures
- Test thoroughly with Safari's synchronous API

## Integration Pattern

```typescript
// App initialization
const storage = new WorkerFileStorageAPI({
  timeout: 45000,
  retryAttempts: 2,
  fallbackToMainThread: true,
});

// Usage (identical to base API)
await storage.writeFile('workspace-123', 'OEBPS/chapter1.xhtml', content);

// Cleanup on app shutdown
await storage.terminateWorker();
```

## Example Usage Patterns

_[Space for implementation examples and common usage patterns]_

```typescript
// Example: Batch file operations with worker
async function saveBatchFiles(
  workspaceId: string,
  files: Array<{ path: string; content: ArrayBuffer }>
) {
  // Your examples here
}

// Example: Large file handling
async function saveLargeEPUBAssets(workspaceId: string, assets: Map<string, ArrayBuffer>) {
  // Your examples here
}

// Example: Worker error recovery
async function saveWithRetry(workspaceId: string, path: string, content: ArrayBuffer) {
  // Your examples here
}
```
