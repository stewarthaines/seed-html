# Shared Test Utilities

This directory contains shared testing utilities and mocks used across multiple feature modules in the editme-svelte project.

## Purpose

Following TESTING.md principles, this consolidates duplicate test utilities into a single location to:

- **Eliminate code duplication**: Prevents maintaining identical mocks across modules
- **Ensure consistency**: All modules use the same mock implementations and behaviors
- **Simplify maintenance**: Changes to shared mocks only need to be made in one place
- **Follow DRY principles**: As documented in TESTING.md

## Contents

### `mocks/file-storage.mock.ts`

Comprehensive mock implementation of `FileStorageAPI` used across all feature modules.

**Previously duplicated in:**

- `src/lib/source/test/mocks/file-storage.mock.ts` ✅ **Removed**
- `src/lib/transform/test/mocks/file-storage.mock.ts` ✅ **Removed**
- `src/lib/extensions/test/mocks/file-storage.mock.ts` ✅ **Removed**

**Features:**

- In-memory file storage simulation
- Controllable error injection for testing failure scenarios
- Operation counting for test verification
- Rich helper methods for test setup and verification
- Full compatibility with FileStorageAPI interface

**Usage:**

```typescript
// Import from shared location
import { MockFileStorage, createMockFileStorage } from '../../test/mocks/file-storage.mock.js';

// For class-based mocking with full control
const mockStorage = new MockFileStorage();
mockStorage.setFailureMode('read');

// For simple function-based mocking
const mockStorage = createMockFileStorage();
```

### `mocks/workspace-manager.mock.ts`

Comprehensive mock implementation of `WorkspaceManager` used across spine and EPUB testing modules.

**Features:**

- In-memory OPF document simulation with EPUB specification compliance
- EPUB metadata management with Dublin Core support (creator[], contributor[], etc.)
- Spine/manifest operations with atomic transaction support
- Source file association tracking by naming convention
- Comprehensive validation and error injection capabilities
- Rich helper methods for workspace setup and verification

**Usage:**

```typescript
// Import from shared location
import { MockWorkspaceManager, createMockWorkspaceManager } from '../../test/mocks/workspace-manager.mock.js';

// For class-based mocking with full control
const mockWorkspace = new MockWorkspaceManager();
mockWorkspace.setWorkspaceOPF('workspace-123', {
  manifest: [...],
  spine: [...],
  metadata: {
    title: 'Test EPUB',
    creator: ['Author Name'], // EPUB-compliant array format
    language: 'en',
    identifier: 'test-123'
  }
});

// For simple function-based mocking
const mockWorkspace = createMockWorkspaceManager();
```

**Key Features:**

- **EPUB Compliance**: Uses specification-compliant interfaces from `epub/opf-utils.ts`
- **Transaction Support**: Atomic operations with rollback capabilities
- **Error Injection**: Controllable failure modes for testing error scenarios
- **File Association**: Tracks SOURCE/text/{id}.txt file associations
- **Validation Helpers**: Built-in validation state checking for spine consistency

## When to Use Shared vs Module-Specific Mocks

### ✅ Use Shared Mocks When:

- Multiple modules need identical mock functionality
- The mock represents an external system boundary (FileStorageAPI, browser APIs)
- The mock is complex enough to benefit from centralized maintenance

### ✅ Use Module-Specific Mocks When:

- Following TESTING.md modern mock strategy (simple vi.fn() patterns)
- Module-specific internal interfaces that other modules don't use
- Quick, focused mocks for a single test file

**Example of modern simple mocking (keep module-specific):**

```typescript
// src/lib/settings/test/test-utils.ts - Keep this pattern
export function createMockFileStorage() {
  return {
    readTextFile: vi.fn().mockResolvedValue('{}'),
    writeTextFile: vi.fn().mockResolvedValue(undefined),
    // Simple vi.fn() mocks per TESTING.md modern strategy
  } satisfies Partial<FileStorageAPI>;
}
```

## Guidelines

1. **Import Paths**: Always use relative imports from test files to shared mocks:

   ```typescript
   // ✅ Correct
   import { MockFileStorage } from '../../test/mocks/file-storage.mock.js';

   // ❌ Don't use $lib paths in tests
   import { MockFileStorage } from '$lib/test/mocks/file-storage.mock.js';
   ```

2. **TypeScript Compatibility**: All shared mocks use relative imports to ensure compatibility with TypeScript compiler checks.

3. **Documentation**: Each shared mock includes comprehensive JSDoc explaining usage patterns and when to use alternatives.

## Integration with TESTING.md

This shared utilities approach aligns with TESTING.md principles:

- **DRY Principle**: Eliminates duplicate mock implementations
- **External Boundary Mocking**: Shared mocks focus on external system boundaries
- **Modern Mock Strategy**: Supports both comprehensive class-based mocks and simple function-based mocks as appropriate
- **TypeScript-First**: All mocks properly typed and compatible with TypeScript checking
