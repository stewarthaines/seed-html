# Transaction Manager Implementation

## Overview

This document outlines the implementation of a standalone TransactionManager that provides atomic operations across multiple files and OPF updates. The TransactionManager is designed as a separate, reusable component that integrates with the WorkspaceManager through composition rather than inheritance. The design prioritizes simplicity, testability, and reusability while providing reliable rollback capabilities for critical multi-step operations.

## Current State Analysis

### SpineItemManager Transaction Requirements

The SpineItemManager currently uses a conditional transaction pattern:

```typescript
if (this.workspaceManager.startTransaction) {
  this.workspaceManager.startTransaction();
}
try {
  // Perform operations...
  if (this.workspaceManager.commitTransaction) {
    this.workspaceManager.commitTransaction();
  }
} catch (error) {
  if (this.workspaceManager.rollbackTransaction) {
    this.workspaceManager.rollbackTransaction();
  }
  throw error;
}
```

### Critical Operations Needing Transactions

1. **addChapter()**: Creates manifest item, spine item, XHTML file, and optional source file
2. **updateChapter()**: Updates spine properties and potentially renames multiple files
3. **deleteChapter()**: Removes spine item, manifest item, and associated files
4. **addManifestItem()**: Updates OPF and invalidates cache
5. **removeManifestItem()**: Updates OPF, removes from spine, and invalidates cache
6. **updateSpineOrder()**: Updates OPF and invalidates cache

### Storage Backend Capabilities

- **IndexedDB**: Already supports native transactions via `transaction()` method
- **OPFS Async/Sync**: No built-in transaction support, requires manual rollback
- **Current Pattern**: Manual cleanup only in `createEPUBWorkspace()`

## Standalone Transaction Manager Design

### Core Transaction Manager Interface

```typescript
interface TransactionManager {
  // Transaction control methods
  startTransaction(): void;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;

  // Operation tracking
  trackOperation(operation: TransactionOperation): void;
  isTransactionActive(): boolean;

  // Utility methods
  executeInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

interface TransactionOperation {
  type: string;
  rollback: () => Promise<void>;
  metadata?: any;
}
```

### WorkspaceManager Integration

```typescript
class WorkspaceManager {
  private transactionManager: TransactionManager;

  constructor(storage: FileStorageAPI, transactionManager?: TransactionManager) {
    this.storage = storage;
    this.transactionManager = transactionManager || new DefaultTransactionManager();
  }

  // Delegate transaction methods for backward compatibility
  startTransaction(): void {
    this.transactionManager.startTransaction();
  }

  commitTransaction(): Promise<void> {
    return this.transactionManager.commitTransaction();
  }

  rollbackTransaction(): Promise<void> {
    return this.transactionManager.rollbackTransaction();
  }

  // Enhanced methods with transaction tracking
  async addManifestItem(workspaceId: string, item: ManifestItem): Promise<void> {
    if (this.transactionManager.isTransactionActive()) {
      const originalOPF = await this.getWorkspaceOPF(workspaceId);
      this.transactionManager.trackOperation({
        type: 'add_manifest_item',
        rollback: () => this.updateWorkspaceOPF(workspaceId, originalOPF),
      });
    }

    // Existing implementation
    await this.addManifestItemInternal(workspaceId, item);
  }
}
```

### Implementation Strategy

#### 1. Transaction State Management

```typescript
class DefaultTransactionManager implements TransactionManager {
  private transactionState: TransactionState | null = null;

  startTransaction(): void {
    if (this.transactionState?.active) {
      throw new Error('Transaction already active');
    }

    this.transactionState = {
      active: true,
      operations: [],
      startTime: Date.now(),
    };
  }

  trackOperation(operation: TransactionOperation): void {
    if (!this.transactionState?.active) {
      throw new Error('No active transaction');
    }

    this.transactionState.operations.push(operation);
  }

  async commitTransaction(): Promise<void> {
    if (!this.transactionState?.active) {
      throw new Error('No active transaction');
    }

    try {
      // All operations have already been applied
      // Commit just clears the transaction state
      this.transactionState = null;
    } catch (error) {
      // Auto-rollback on commit failure
      await this.rollbackTransaction();
      throw error;
    }
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.transactionState?.active) {
      return; // No-op if no transaction
    }

    try {
      // Execute rollback operations in reverse order
      const operations = this.transactionState.operations.reverse();
      for (const operation of operations) {
        try {
          await operation.rollback();
        } catch (rollbackError) {
          console.error('Rollback operation failed:', rollbackError);
          // Continue with other rollback operations
        }
      }
    } finally {
      this.transactionState = null;
    }
  }
}

interface TransactionState {
  active: boolean;
  operations: TransactionOperation[];
  startTime: number;
}
```

#### 2. Backend-Agnostic Implementation

**Storage Backend Independence:**

- TransactionManager doesn't know about storage backends
- Rollback operations are provided by the calling component
- Works with any storage implementation (IndexedDB, OPFS, etc.)

**Operation Tracking Pattern:**

```typescript
// In WorkspaceManager methods
async writeTextFile(workspaceId: string, path: string, content: string): Promise<void> {
  if (this.transactionManager.isTransactionActive()) {
    // Capture current state for rollback
    const originalContent = await this.readTextFileInternal(workspaceId, path);
    const fileExisted = await this.fileExists(workspaceId, path);

    this.transactionManager.trackOperation({
      type: 'file_write',
      rollback: async () => {
        if (fileExisted) {
          await this.storage.writeTextFile(workspaceId, path, originalContent);
        } else {
          await this.storage.deleteFile(workspaceId, path);
        }
      },
      metadata: { path, workspaceId }
    });
  }

  // Perform actual write
  await this.storage.writeTextFile(workspaceId, path, content);
}
```

#### 3. High-Level Transaction Workflow

```typescript
// Utility method for common transaction pattern
async executeInTransaction<T>(fn: () => Promise<T>): Promise<T> {
  this.startTransaction();

  try {
    const result = await fn();
    await this.commitTransaction();
    return result;
  } catch (error) {
    await this.rollbackTransaction();
    throw error;
  }
}

// Example usage in SpineItemManager
async addChapter(workspaceId: string, chapterData: ChapterCreationData): Promise<SpineItemWithSource> {
  return this.workspaceManager.transactionManager.executeInTransaction(async () => {
    const chapterId = await this.generateChapterId(workspaceId, chapterData.title);

    // All these operations are automatically tracked for rollback
    await this.workspaceManager.addManifestItem(workspaceId, manifestItem);
    await this.workspaceManager.addSpineItem(workspaceId, spineItem);
    await this.workspaceManager.writeTextFile(workspaceId, xhtmlPath, content);

    return spineItemWithSource;
  });
}
```

## Implementation Details

### 1. Composition-Based Integration

```typescript
class WorkspaceManager {
  private transactionManager: TransactionManager;

  constructor(storage: FileStorageAPI, options?: WorkspaceManagerOptions) {
    this.storage = storage;
    this.transactionManager = options?.transactionManager || new DefaultTransactionManager();
  }

  // Expose transaction manager for direct usage
  get transactions(): TransactionManager {
    return this.transactionManager;
  }

  // Backward compatibility methods
  startTransaction(): void {
    this.transactionManager.startTransaction();
  }

  commitTransaction(): Promise<void> {
    return this.transactionManager.commitTransaction();
  }

  rollbackTransaction(): Promise<void> {
    return this.transactionManager.rollbackTransaction();
  }
}
```

### 2. Direct Usage by Other Managers

```typescript
// SpineItemManager can use transactions directly
class SpineItemManager {
  private workspaceManager: WorkspaceManager;

  constructor(workspaceManager: WorkspaceManager) {
    this.workspaceManager = workspaceManager;
  }

  async addChapter(
    workspaceId: string,
    chapterData: ChapterCreationData
  ): Promise<SpineItemWithSource> {
    // Use transaction manager directly
    const transactionManager = this.workspaceManager.transactions;

    return transactionManager.executeInTransaction(async () => {
      // All workspace operations are automatically tracked
      await this.workspaceManager.addManifestItem(workspaceId, manifestItem);
      await this.workspaceManager.addSpineItem(workspaceId, spineItem);
      await this.workspaceManager.writeTextFile(workspaceId, xhtmlPath, content);

      return spineItemWithSource;
    });
  }
}
```

### 3. Testing Benefits

```typescript
// Easy to mock for testing
class MockTransactionManager implements TransactionManager {
  private operations: TransactionOperation[] = [];

  startTransaction(): void {
    this.operations = [];
  }

  trackOperation(operation: TransactionOperation): void {
    this.operations.push(operation);
  }

  async commitTransaction(): Promise<void> {
    // No-op for testing
  }

  async rollbackTransaction(): Promise<void> {
    // Execute rollbacks for testing
    for (const op of this.operations.reverse()) {
      await op.rollback();
    }
  }

  getTrackedOperations(): TransactionOperation[] {
    return this.operations;
  }
}

// Test WorkspaceManager with mock transactions
const mockTransactionManager = new MockTransactionManager();
const workspaceManager = new WorkspaceManager(storage, {
  transactionManager: mockTransactionManager,
});
```

### 4. Alternative Transaction Manager Implementations

#### IndexedDB-Optimized Transaction Manager

```typescript
class IndexedDBTransactionManager implements TransactionManager {
  private storage: IndexedDBBackend;
  private transactionState: TransactionState | null = null;

  constructor(storage: IndexedDBBackend) {
    this.storage = storage;
  }

  startTransaction(): void {
    // Leverage IndexedDB's native transaction support
    this.transactionState = {
      active: true,
      operations: [],
      startTime: Date.now(),
      nativeTransaction: this.storage.transaction(['workspaces'], 'readwrite'),
    };
  }

  async commitTransaction(): Promise<void> {
    if (!this.transactionState?.active) {
      throw new Error('No active transaction');
    }

    // IndexedDB commits automatically when transaction scope ends
    this.transactionState = null;
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.transactionState?.active) {
      return;
    }

    // IndexedDB rollback happens automatically on error
    // But we still need to handle app-level rollbacks
    await this.executeRollbackOperations();
    this.transactionState = null;
  }
}
```

#### Memory-Optimized Transaction Manager

```typescript
class LightweightTransactionManager implements TransactionManager {
  private operations: TransactionOperation[] = [];
  private active = false;

  startTransaction(): void {
    if (this.active) {
      throw new Error('Transaction already active');
    }
    this.active = true;
    this.operations = [];
  }

  trackOperation(operation: TransactionOperation): void {
    if (!this.active) {
      throw new Error('No active transaction');
    }
    this.operations.push(operation);
  }

  async commitTransaction(): Promise<void> {
    this.active = false;
    this.operations = [];
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.active) {
      return;
    }

    try {
      // Execute rollbacks in reverse order
      for (const operation of this.operations.reverse()) {
        await operation.rollback();
      }
    } finally {
      this.active = false;
      this.operations = [];
    }
  }
}
```

## Integration Points

### 1. SpineItemManager Compatibility

The current conditional transaction pattern in SpineItemManager works with enhanced flexibility:

```typescript
// Existing pattern continues to work
if (this.workspaceManager.startTransaction) {
  this.workspaceManager.startTransaction();
}

// New pattern with direct transaction manager access
const transactionManager = this.workspaceManager.transactions;
if (transactionManager) {
  return transactionManager.executeInTransaction(async () => {
    // All operations
  });
}

// Or simplified with utility method
return this.workspaceManager.executeInTransaction(async () => {
  // All operations
});
```

### 2. Error Handling

```typescript
// Simplified error handling with executeInTransaction
try {
  return await this.workspaceManager.executeInTransaction(async () => {
    await this.workspaceManager.addManifestItem(workspaceId, item);
    await this.workspaceManager.writeTextFile(workspaceId, path, content);
    return result;
  });
} catch (error) {
  // Transaction automatically rolled back
  throw new WorkspaceError(`Transaction failed: ${error.message}`, error);
}

// Manual transaction control for complex scenarios
const transactionManager = this.workspaceManager.transactions;
transactionManager.startTransaction();

try {
  await this.performComplexOperations();
  await transactionManager.commitTransaction();
} catch (error) {
  await transactionManager.rollbackTransaction();
  throw error;
}
```

### 3. Backward Compatibility

- All existing WorkspaceManager methods remain unchanged
- Transaction methods are still available on WorkspaceManager (delegated to TransactionManager)
- SpineItemManager's conditional usage pattern continues to work
- No breaking changes to public API
- Enhanced functionality through composition

## Implementation Phases

### Phase 1: Core Transaction Infrastructure

- Add transaction state management
- Implement operation tracking
- Add public transaction methods

### Phase 2: Backend Integration

- Enhance IndexedDB backend with transaction support
- Add OPFS rollback mechanisms
- Implement storage-aware commit/rollback

### Phase 3: Method Enhancement

- Add transaction tracking to critical methods
- Implement rollback for file operations
- Add cache state restoration

### Phase 4: Testing & Validation

- Unit tests for transaction scenarios
- Integration tests with SpineItemManager
- Performance testing across backends

## Benefits

1. **Atomic Operations**: Multi-step operations are all-or-nothing
2. **Data Integrity**: Prevents partial state corruption
3. **Graceful Failure**: Automatic rollback on errors
4. **Backend Agnostic**: Works across all storage implementations
5. **Simple API**: Minimal interface changes
6. **Backward Compatible**: Existing code continues to work
7. **Reusable**: Other managers can use TransactionManager directly
8. **Testable**: Easy to mock and test in isolation
9. **Composable**: Can inject different transaction implementations
10. **Single Responsibility**: Transaction logic separated from workspace logic

## Trade-offs

1. **Performance**: Additional overhead for operation tracking
2. **Memory Usage**: Storing rollback functions and metadata
3. **Complexity**: More complex error handling paths
4. **Abstraction**: Additional layer between WorkspaceManager and operations
5. **Testing**: More components to test (but easier to test in isolation)

## Conclusion

This standalone TransactionManager implementation provides a minimal but robust foundation for atomic operations across the entire application. By separating transaction logic from workspace operations, it achieves:

- **Better Architecture**: Clear separation of concerns
- **Enhanced Reusability**: Other managers can use transactions directly
- **Improved Testability**: Components can be tested in isolation
- **Maintained Compatibility**: Existing code continues to work unchanged
- **Future Flexibility**: Easy to swap transaction implementations

The design prioritizes simplicity, testability, and data integrity over performance, making it suitable for the EPUB editor's use case where reliable atomic operations are more important than raw speed. The composition-based approach ensures that the WorkspaceManager remains focused on its core responsibilities while transaction management is handled by a dedicated, reusable component.
