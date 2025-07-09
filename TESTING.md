# Testing Specification Guide

## Overview

This document provides comprehensive guidance for writing tests in the editme-svelte project, with specific focus on the Settings Manager feature. It covers our testing strategy, framework configuration, mock patterns, and the integration between unit tests and Storybook tests in our development workflow.

## Development Workflow

Our feature development follows a structured 6-step process that ensures quality through testing at multiple stages:

1. **Feature Plan** - Detailed specification in `plans/features/`
2. **API Documentation** - Comprehensive API.md with all methods and integration patterns
3. **Public API** - Concise interface definitions in `index.ts`
4. **Unit Tests** - Test-driven development based on API specifications
5. **Implementation** - Code that passes all unit tests
6. **Storybook Stories** - Interactive demos and browser API integration testing

## Modern Testing Strategy (2024)

### Core Testing Philosophy

**Test behavior, not implementation** - Focus on how users interact with features rather than internal code structure. Mock only external boundaries, not internal logic.

### Unit Tests vs Integration Tests vs Storybook

#### Unit Tests (Vitest + happy-dom)

- **Purpose**: Fast testing of pure business logic and validation
- **Environment**: happy-dom (4x faster than jsdom)
- **Focus**: Algorithms, validation rules, pure functions, error handling
- **What to Mock**: External dependencies only (file system, network)
- **What NOT to Mock**: Internal business logic, state management

#### Integration Tests (Vitest + Real APIs)

- **Purpose**: Test feature boundaries with real dependencies where practical
- **Environment**: Node.js with real file system (for file storage tests)
- **Focus**: End-to-end workflows, data persistence, cross-system integration
- **Preferred over**: Heavy mocking of internal systems

#### Storybook Tests (Real Browser)

- **Purpose**: Visual verification and full browser API testing
- **Environment**: Real browser (Chromium-based)
- **Focus**: User interactions, visual components, browser-specific APIs
- **Strengths**: Real DOM behavior, performance testing, accessibility verification

### When to Use Each Approach

| Scenario                | Unit Tests | Integration Tests | Storybook | Notes                                            |
| ----------------------- | ---------- | ----------------- | --------- | ------------------------------------------------ |
| Pure business logic     | ✅         | ❌                | ❌        | Fast unit tests are ideal                        |
| Validation rules        | ✅         | ❌                | ❌        | Pure functions test well                         |
| File operations         | Mock only  | ✅                | ✅        | Integration tests with real FS, Storybook for UI |
| Cross-system workflows  | ❌         | ✅                | ✅        | Test real data flow                              |
| Browser API integration | ❌ (skip)  | ❌                | ✅        | happy-dom limitations                            |
| Error handling          | ✅         | ✅                | ✅        | All levels test different error scenarios        |
| Visual components       | ❌         | ❌                | ✅        | Storybook excels at UI testing                   |
| Performance testing     | ❌         | Limited           | ✅        | Real browser performance metrics                 |

## Testing Framework Configuration

### Vitest Setup

Configuration in `vitest.config.unit.ts`:

```typescript
export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['src/**/*.stories.{js,ts}', '**/node_modules/**'],
  },
});
```

### Test File Organization

Tests are organized within feature modules:

```
src/lib/settings/
├── index.ts                 # Public API
├── API.md                   # Full documentation
├── settings-manager.ts      # Implementation
└── test/
    ├── settings-manager.test.ts     # Core logic tests
    ├── validation.test.ts           # Validation logic tests
    ├── integration.test.ts          # File storage integration
    └── fixtures.ts                  # Test data
```

### Import Path Guidelines for Tests

**Problem**: Test files use `$lib` path aliases which work in Svelte/Vite but fail when running TypeScript compiler directly.

**Solution**: Use relative imports in test files to ensure compatibility with both test runners and TypeScript checking.

#### Correct Import Patterns

```typescript
// ❌ Don't use $lib paths in test files
import type { FileStorageAPI } from '$lib/storage';
import type { ExtensionManager } from '$lib/extensions';

// ✅ Use relative paths instead
import type { FileStorageAPI } from '../../storage/index.js';
import type { ExtensionManager } from '../../extensions/index.js';
```

#### Path Reference Guide

From `src/lib/settings/test/` directory:

- **Storage module**: `../../storage/index.js`
- **Extensions module**: `../../extensions/index.js`
- **Settings types**: `../index.js`

From `src/lib/settings/` directory:

- **Storage module**: `../storage/index.js`
- **Extensions module**: `../extensions/index.js`

#### When to Use Each

- **Implementation files** (`src/lib/settings/index.ts`): Can use `$lib` paths (processed by Vite)
- **Test files** (`src/lib/settings/test/*.ts`): Must use relative paths for TypeScript compatibility
- **Storybook files** (`src/stories/*.svelte`): Can use `$lib` paths (processed by Vite)

### Naming Conventions

- **Unit tests**: `*.test.ts`
- **Storybook stories**: `*.stories.ts`
- **Test utilities**: `test/utils.ts`
- **Test fixtures**: `test/fixtures.ts`

## Settings Manager Testing Specification

### Modern Mock Strategy

Following 2024 best practices, we focus on **simple, behavior-focused mocks** rather than complex factories.

#### Essential Mocks (External Boundaries Only)

```typescript
// Mock only external file system boundary
const mockFileStorage = {
  readJSONFile: vi.fn<[string, string], Promise<any>>(),
  writeJSONFile: vi.fn<[string, string, any], Promise<void>>(),
  listFiles: vi.fn<[string, string?], Promise<string[]>>(),
  isInitialized: () => true,
} satisfies Partial<FileStorageAPI>;

// Mock only external extension discovery
const mockExtensionManager = {
  listWorkspaceExtensions: vi.fn<[string], Promise<ExtensionInfo[]>>(),
} satisfies Partial<ExtensionManager>;

// Mock browser localStorage API
const mockLocalStorage = {
  getItem: vi.fn<[string], string | null>(),
  setItem: vi.fn<[string, string], void>(),
  removeItem: vi.fn<[string], void>(),
  clear: vi.fn<[], void>(),
};
```

#### What NOT to Mock

- ❌ Internal SettingsManager methods
- ❌ Validation logic (test the real functions)
- ❌ Theme store integration (test real behavior)
- ❌ Draft ID generation (pure functions)
- ❌ Transform resolution logic

### Test Data Fixtures

#### Valid Settings

```typescript
export const VALID_GLOBAL_SETTINGS: GlobalSettings = {
  theme: 'dark',
  locale: 'en',
  editor_font_size: 14,
};

export const VALID_WORKSPACE_SETTINGS: WorkspaceSettings = {
  bust_cache: true,
  draft_id: 5,
  editor: {
    preview_delay_ms: 1000,
    advanced_mode: true,
  },
};

export const VALID_EPUB_SETTINGS: EPUBSettings = {
  text_transform: 'SOURCE/scripts/transform.js',
  dom_transforms: ['SOURCE/extensions/markdown-it/transform.js'],
  spine_basename: 'chapter',
  cover: {
    template: 'minimal',
    background_color: '#ffffff',
    text_color: '#000000',
    font_family: 'serif',
  },
};
```

#### Invalid Settings for Validation Testing

```typescript
export const INVALID_SETTINGS_CASES = {
  globalSettings: [
    {
      case: 'invalid theme',
      data: { theme: 'purple' },
      expectedErrors: ['Theme must be light, dark, or system'],
    },
    {
      case: 'invalid locale',
      data: { locale: 'xx' },
      expectedErrors: ['Locale xx is not supported'],
    },
    {
      case: 'font size too small',
      data: { editor_font_size: 5 },
      expectedErrors: ['Font size must be between 8 and 32 pixels'],
    },
    {
      case: 'font size too large',
      data: { editor_font_size: 50 },
      expectedErrors: ['Font size must be between 8 and 32 pixels'],
    },
  ],

  workspaceSettings: [
    {
      case: 'negative draft ID',
      data: { draft_id: -1 },
      expectedErrors: ['Draft ID must be non-negative'],
    },
    {
      case: 'preview delay too short',
      data: { editor: { preview_delay_ms: 50 } },
      expectedErrors: ['Preview delay must be between 100-2000ms'],
    },
    {
      case: 'preview delay too long',
      data: { editor: { preview_delay_ms: 3000 } },
      expectedErrors: ['Preview delay must be between 100-2000ms'],
    },
  ],

  epubSettings: [
    {
      case: 'invalid transform path',
      data: { text_transform: '../../../etc/passwd' },
      expectedErrors: ['Transform path must start with SOURCE/'],
    },
    {
      case: 'empty spine basename',
      data: { spine_basename: '' },
      expectedErrors: ['Spine basename cannot be empty'],
    },
    {
      case: 'invalid cover color',
      data: { cover: { background_color: 'red' } },
      expectedErrors: ['Background color must be a valid hex color'],
    },
  ],
};
```

#### Extension Mock Data

```typescript
export const MOCK_EXTENSIONS: ExtensionInfo[] = [
  {
    name: 'markdown-it',
    files: [
      { filename: 'transform.js', size: 15000, type: 'javascript' },
      { filename: 'markdown-it.min.js', size: 45000, type: 'javascript' },
      { filename: 'LICENSE.txt', size: 1200, type: 'license' },
    ],
    totalSize: 61200,
    location: 'workspace',
  },
  {
    name: 'highlight-js',
    files: [{ filename: 'highlight.min.js', size: 32000, type: 'javascript' }],
    totalSize: 32000,
    location: 'workspace',
  },
];

export const EXPECTED_TRANSFORM_OPTIONS: TransformOption[] = [
  {
    path: 'SOURCE/scripts/transform.js',
    extensionName: 'built-in',
    fileName: 'transform.js',
  },
  {
    path: 'SOURCE/extensions/markdown-it/transform.js',
    extensionName: 'markdown-it',
    fileName: 'transform.js',
  },
  {
    path: 'SOURCE/extensions/markdown-it/markdown-it.min.js',
    extensionName: 'markdown-it',
    fileName: 'markdown-it.min.js',
  },
];
```

### Modern Test Structure

#### Simple, Focused Test Setup

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsManager } from '../settings-manager';
import { createMockFileStorage, createMockExtensionManager } from './test-utils';
import { SETTINGS_FIXTURES } from './fixtures';

describe('SettingsManager', () => {
  let settingsManager: SettingsManager;
  let mockFileStorage: ReturnType<typeof createMockFileStorage>;
  let mockExtensionManager: ReturnType<typeof createMockExtensionManager>;

  beforeEach(() => {
    // Create simple, focused mocks
    mockFileStorage = createMockFileStorage();
    mockExtensionManager = createMockExtensionManager();

    // Mock only localStorage (external boundary)
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });

    // Test the real SettingsManager
    settingsManager = new SettingsManager(mockFileStorage, mockExtensionManager);
  });

  describe('Validation (Pure Functions)', () => {
    // Test real validation logic - no mocks needed
    it('should validate theme values', () => {
      const result = settingsManager.validateGlobalSettings({ theme: 'purple' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Theme must be light, dark, or system');
    });
  });

  describe('File Operations (Mock External Boundary)', () => {
    it('should save workspace settings', async () => {
      const settings = SETTINGS_FIXTURES.workspace.valid();

      await settingsManager.saveWorkspaceSettings('ws-123', settings);

      // Verify behavior at the boundary
      expect(mockFileStorage.writeJSONFile).toHaveBeenCalledWith(
        'ws-123',
        '.workspace-metadata.json',
        expect.objectContaining(settings)
      );
    });
  });
});
```

#### Test Utilities (Not Factories)

```typescript
// test/test-utils.ts
export function createMockFileStorage() {
  return {
    readJSONFile: vi.fn().mockResolvedValue({}),
    writeJSONFile: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue([]),
    isInitialized: () => true,
  } satisfies Partial<FileStorageAPI>;
}

export function createMockExtensionManager() {
  return {
    listWorkspaceExtensions: vi.fn().mockResolvedValue([]),
  } satisfies Partial<ExtensionManager>;
}

// Behavior verification helpers
export function expectSettingsSaved(
  mockStorage: ReturnType<typeof createMockFileStorage>,
  workspaceId: string,
  settings: any
) {
  expect(mockStorage.writeJSONFile).toHaveBeenCalledWith(
    workspaceId,
    '.workspace-metadata.json',
    expect.objectContaining(settings)
  );
}
```

#### Validation Test Pattern

```typescript
describe('Settings Validation', () => {
  describe('Global Settings Validation', () => {
    it.each(INVALID_SETTINGS_CASES.globalSettings)(
      'should reject $case',
      ({ data, expectedErrors }) => {
        const result = settingsManager.validateGlobalSettings(data);

        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(expectedErrors);
      }
    );

    it('should accept valid global settings', () => {
      const result = settingsManager.validateGlobalSettings(VALID_GLOBAL_SETTINGS);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
```

#### Async Operation Testing

```typescript
describe('File Operations', () => {
  it('should load workspace settings from file', async () => {
    // Setup mock
    mockFileStorage.readJSONFile.mockResolvedValue({
      bust_cache: true,
      draft_id: 3,
      editor: { advanced_mode: true, preview_delay_ms: 750 },
    });

    const result = await settingsManager.loadWorkspaceSettings('workspace-123');

    expect(mockFileStorage.readJSONFile).toHaveBeenCalledWith(
      'workspace-123',
      '.workspace-metadata.json'
    );
    expect(result.bust_cache).toBe(true);
    expect(result.draft_id).toBe(3);
  });

  it('should return defaults when file not found', async () => {
    // Mock file not found
    mockFileStorage.readJSONFile.mockRejectedValue(new Error('File not found'));

    const result = await settingsManager.loadWorkspaceSettings('workspace-123');

    // Should return defaults
    const defaults = settingsManager.getDefaultWorkspaceSettings();
    expect(result).toEqual(defaults);
  });
});
```

### happy-dom Limitations & Skip Patterns

#### Known Limitations

1. **matchMedia**: Doesn't work reliably
2. **Complex File APIs**: Some file operations may fail
3. **CSS Object Model**: Limited support
4. **XMLHttpRequest**: Not fully compatible
5. **Web Workers**: Not supported

#### Skip Pattern

```typescript
describe('Browser API Integration', () => {
  // Skip: requires matchMedia which doesn't work in happy-dom
  // This functionality is tested in browser environment via Storybook
  it.skip('should detect system theme preference', () => {
    // Test that requires matchMedia
  });

  // Skip: requires complex File API behavior
  // This functionality is tested in browser environment via Storybook
  it.skip('should handle large file uploads', () => {
    // Test with real File objects
  });
});
```

### Error Simulation Patterns

#### Storage Errors

```typescript
describe('Error Handling', () => {
  it('should handle localStorage quota exceeded', () => {
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(() => {
      settingsManager.saveGlobalSettings(VALID_GLOBAL_SETTINGS);
    }).not.toThrow();

    // Should log warning but not crash
  });

  it('should handle file storage write failures', async () => {
    mockFileStorage.writeJSONFile.mockRejectedValue(new Error('Disk full'));

    await expect(
      settingsManager.saveWorkspaceSettings('workspace-123', VALID_WORKSPACE_SETTINGS)
    ).rejects.toThrow('Disk full');
  });
});
```

#### Network/Permission Errors

```typescript
it('should handle permission denied errors', async () => {
  mockFileStorage.readJSONFile.mockRejectedValue(new Error('Permission denied'));

  // Should fall back to defaults
  const result = await settingsManager.loadEPUBSettings('workspace-123');
  expect(result).toEqual(settingsManager.getDefaultEPUBSettings());
});
```

## Storybook Integration Testing

### Settings Manager Storybook Story

For comprehensive browser testing, create a Storybook story:

```typescript
// src/stories/SettingsManagerDemo.stories.ts
import type { Meta, StoryObj } from '@storybook/svelte';
import SettingsManagerDemo from './SettingsManagerDemo.svelte';

const meta: Meta<SettingsManagerDemo> = {
  title: 'Backend Features/Settings Manager',
  component: SettingsManagerDemo,
  parameters: {
    docs: {
      description: {
        component: 'Interactive demonstration of Settings Manager functionality',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
```

### Demo Component Pattern

```svelte
<!-- src/stories/SettingsManagerDemo.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { SettingsManager } from '$lib/settings';
  import { FileStorageAPI } from '$lib/storage';
  import { ExtensionManager } from '$lib/extensions';

  let settingsManager: SettingsManager;
  let logs: string[] = [];
  let globalSettings = {};
  let workspaceSettings = {};

  onMount(async () => {
    // Initialize with real APIs
    const fileStorage = new FileStorageAPI();
    await fileStorage.init();

    const extensionManager = new ExtensionManager(fileStorage);
    settingsManager = new SettingsManager(fileStorage, extensionManager);

    loadAllSettings();
  });

  async function loadAllSettings() {
    try {
      globalSettings = settingsManager.loadGlobalSettings();
      workspaceSettings = await settingsManager.loadWorkspaceSettings('demo-workspace');
      addLog('Settings loaded successfully');
    } catch (error) {
      addLog(`Error: ${error.message}`);
    }
  }

  function addLog(message: string) {
    logs = [...logs, `${new Date().toLocaleTimeString()}: ${message}`];
  }
</script>

<div class="settings-demo">
  <h2>Settings Manager Demo</h2>

  <!-- Interactive controls for testing -->
  <section>
    <h3>Global Settings</h3>
    <label>
      Theme:
      <select bind:value={globalSettings.theme}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </label>
    <button on:click={() => settingsManager.saveGlobalSettings(globalSettings)}>
      Save Global Settings
    </button>
  </section>

  <!-- Log output -->
  <section>
    <h3>Operation Log</h3>
    <ul class="log">
      {#each logs as log}
        <li>{log}</li>
      {/each}
    </ul>
  </section>
</div>
```

## Testing Checklist

### For Pure Functions (Unit Tests)

- ✅ Test all valid input combinations
- ✅ Test all validation error cases
- ✅ Test boundary conditions
- ✅ Test with malformed input
- ✅ Verify return types match interface
- ✅ Ensure no side effects

### For Storage Operations (Unit Tests + Storybook)

- ✅ Mock file operations in unit tests
- ✅ Test error handling (file not found, permission denied)
- ✅ Test with corrupted data
- ✅ Test concurrent access scenarios
- ✅ Verify atomic operations in Storybook
- ✅ Test with large datasets in Storybook

### For Integration Features (Storybook)

- ✅ Test with real browser APIs
- ✅ Test theme application to DOM
- ✅ Test i18n integration
- ✅ Test extension discovery
- ✅ Test file upload/download workflows
- ✅ Visual verification of UI updates

### Error Scenarios

- ✅ Storage quota exceeded
- ✅ Network failures
- ✅ Permission denied
- ✅ Corrupted settings files
- ✅ Invalid JSON parsing
- ✅ Missing dependencies

## Interface Consolidation Testing Strategy

When consolidating duplicate type definitions across modules, follow these patterns to maintain test reliability:

### 1. Identify Authoritative Source

Choose the most comprehensive, specification-compliant interface as the single source of truth:

```typescript
// ❌ Before: Multiple duplicate definitions
// workspace/types.ts - Simple interface
// epub/opf-utils.ts - Comprehensive EPUB-compliant interface

// ✅ After: Single source of truth
import type { EPUBMetadata, OPFDocument } from '../../epub/opf-utils.js';
```

### 2. Update Imports Systematically

Use relative imports in test files for TypeScript compatibility:

```typescript
// ✅ Update all test files
import type { OPFDocument } from '../../epub/opf-utils.js';

// ❌ Avoid $lib paths in tests (TypeScript compatibility)
import type { OPFDocument } from '$lib/epub/opf-utils.js';
```

### 3. Fix Type Compatibility Issues

Update mock data and test expectations to match the consolidated interface:

```typescript
// ❌ Before: Simple string format
creator: 'Test Author',

// ✅ After: EPUB Dublin Core specification compliance
creator: ['Test Author'], // Array format per EPUB spec
```

### 4. Verify Test Coverage

Ensure all tests pass with the unified interface:

```typescript
// Update test expectations
expect(metadata.creator).toEqual(['Test Author']); // Array format
expect(xml).toContain('<dc:creator>Test Author</dc:creator>'); // Generated XML
```

### 5. Benefits of Interface Consolidation

- **Single Source of Truth**: Eliminates duplicate interface definitions
- **Specification Compliance**: Ensures adherence to standards (EPUB, Dublin Core)
- **Reduced Maintenance**: Changes only need to be made in one location
- **Type Safety**: Prevents interface drift between modules

### 6. Factory Functions for Test Isolation

Use factory functions instead of shared constants to prevent test pollution:

```typescript
// ✅ Good - each test gets fresh data
export function createTestOPF(): MockOPFDocument {
  return {
    manifest: [],
    spine: [],
    metadata: {
      title: 'Test EPUB',
      creator: ['Test Author'],
      language: 'en',
      identifier: 'test-123',
    },
  };
}

// ❌ Avoid - shared mutable state
export const TEST_OPF = { manifest: [], spine: [] }; // Tests can mutate this
```

## Modern Development Best Practices (2024)

### Test-Driven Development with Behavior Focus

1. Write API documentation first (defines behavior contracts)
2. Create test fixtures for realistic data scenarios
3. Write tests that verify user-facing behavior
4. Implement to make behavior tests pass
5. Create integration tests for cross-system workflows
6. Add Storybook stories for visual/browser testing
7. Refactor with confidence knowing behavior is preserved

### Modern Mock Strategy

- **Unit Tests**: Mock external boundaries only (file system, network, browser APIs)
- **Integration Tests**: Use real implementations where practical
- **Storybook**: Use real APIs for authentic user testing
- **Avoid**: Over-mocking internal logic or pure functions

### Test Organization

```
src/lib/settings/
├── settings-manager.ts
├── test/
│   ├── settings-manager.test.ts      # Unit tests (pure logic)
│   ├── integration.test.ts           # Integration tests (real file ops)
│   ├── validation.test.ts            # Validation logic tests
│   ├── fixtures.ts                   # Shared test data
│   └── test-utils.ts                 # Simple helper functions
└── stories/
    └── SettingsManagerDemo.stories.ts # Browser/visual testing
```

### TypeScript-First Testing

- Use `satisfies` for type-safe mocks
- Properly type all mock functions with generics
- Test TypeScript interfaces, not just runtime behavior
- Use `expect.objectContaining()` for flexible assertions

### Array Content Assertions

When testing arrays for substring matches, use `array.some()` instead of `toContain()` with matchers:

```typescript
// ❌ Don't use - doesn't work correctly
expect(result.errors).toContain(expect.stringContaining('Invalid JSON syntax'));

// ✅ Use this pattern instead
expect(result.errors.some(error => error.includes('Invalid JSON syntax'))).toBe(true);
```

### Performance-Conscious Testing

- **Vitest**: 4x faster than Jest, use for all new tests
- **happy-dom**: Faster than jsdom for DOM operations
- **Parallel testing**: Vitest runs tests in parallel by default
- **Focused mocking**: Only mock what's absolutely necessary

### Integration Testing Strategy

For Settings Manager specifically:

```typescript
// integration.test.ts - Tests with real file system
describe('Settings Integration', () => {
  it('should persist settings through save/load cycle', async () => {
    const tempDir = await createTempWorkspace();
    const fileStorage = new FileStorageAPI();
    await fileStorage.init();

    const manager = new SettingsManager(fileStorage, mockExtensionManager);
    const settings = SETTINGS_FIXTURES.workspace.valid();

    await manager.saveWorkspaceSettings(tempDir, settings);
    const loaded = await manager.loadWorkspaceSettings(tempDir);

    expect(loaded).toEqual(settings);
  });
});
```

### Error Testing Philosophy

- **Unit Tests**: Test validation and error handling logic
- **Integration Tests**: Test real error scenarios (disk full, permissions)
- **Storybook**: Test user-facing error experiences
- **Focus**: How errors are handled, not just that they occur

### Continuous Quality

- Run unit tests on every change (sub-second feedback)
- Integration tests in CI pipeline
- Storybook for manual verification and visual regression
- Focus on behavior preservation during refactoring

This modern approach ensures robust, maintainable tests that provide confidence in system behavior while avoiding the overhead and fragility of over-mocked test suites.

## Testing Strategy & TypeScript Quality Assurance

### Test Environment Architecture

The project uses a multi-tiered testing strategy with **mandatory TypeScript validation** at all levels:

- **Unit Tests (happy-dom)**: Fast, focused testing with TypeScript compliance required
- **Storybook Tests (browser)**: Integration testing with TypeScript validation
- **E2E Tests (browser)**: Full workflow testing with type safety
- **TypeScript Validation**: Continuous type checking during test development

### TypeScript Quality in Testing

**CRITICAL**: All tests must be TypeScript compliant. Common issues to avoid:

1. **Import Errors**: Ensure proper imports for test dependencies

   ```typescript
   // ✅ Correct
   import { SettingsManager } from '../settings-manager.js';

   // ❌ Incorrect
   // Commented imports that cause undefined variable errors
   ```

2. **Mock Type Compatibility**: Use proper type assertions for mocks

   ```typescript
   // ✅ Correct
   const mockStorage = createMockFileStorage();
   const manager = new SettingsManager(mockStorage as any, mockExt as any);

   // ❌ Incorrect
   const manager = new SettingsManager(mockStorage, mockExt); // Type error
   ```

3. **Test Variable Initialization**: Initialize variables in beforeEach

   ```typescript
   // ✅ Correct
   beforeEach(() => {
     settingsManager = new SettingsManager(mockStorage as any, mockExt as any);
   });

   // ❌ Incorrect
   beforeEach(() => {
     // settingsManager = new SettingsManager(...); // Commented out
   });
   ```

### Testing Quality Gates

Before considering any test complete:

1. **TypeScript Validation**: `npm run check` must pass
2. **Test Execution**: `npm test` must pass
3. **Combined Validation**: `npm run check && npm test`

### Happy-DOM Limitations

Happy-dom provides excellent performance for unit testing but has limitations with certain browser APIs. The following APIs should be avoided in unit tests:

#### ❌ Not Supported / Problematic APIs

- **DecompressionStream/CompressionStream**: ZIP file extraction hangs in happy-dom
- **getElementsByTagNameNS()**: XML namespace parsing doesn't work correctly
- **CSSOM APIs**: CSS Object Model parsing is incomplete
- **Complex DOM manipulation**: Advanced DOM operations may not work as expected
- **Fetch to localhost**: Network operations fail in test environment

#### ✅ Well-Supported APIs

- **Basic DOM operations**: createElement, querySelector, innerHTML
- **DOMParser**: Basic XML/HTML parsing (without namespaces)
- **File/Blob APIs**: File and Blob creation and basic operations
- **URL.createObjectURL/revokeObjectURL**: Basic blob URL operations

### Testing Patterns

#### When to Skip Tests

Use `.skip` for tests that require unsupported browser APIs:

```typescript
// Skip: requires getElementsByTagNameNS which doesn't work in happy-dom
// This functionality is tested in browser environment via Storybook
it.skip('should parse XML with namespaces', () => {
  // Test that requires namespace parsing
});
```

#### When to Mock vs Skip

- **Mock**: When the API is central to the logic being tested
- **Skip**: When the API is a secondary concern or integration point

#### Documentation Requirements

When skipping tests, always include:

1. **Reason**: Which API limitation causes the skip
2. **Alternative**: Where the functionality is tested (Storybook/E2E)
3. **Clear comment**: Explaining the browser API requirement

### Browser API Testing in Storybook

For functionality requiring full browser APIs:

1. **Create interactive stories** demonstrating the feature
2. **Test real file operations** with actual ZIP/EPUB files
3. **Validate complex DOM operations** in browser environment
4. **Use Storybook test runner** for automated browser testing

### Guidelines for New Tests

1. **Start with unit tests** for pure logic
2. **Mock browser APIs** when testing integration logic
3. **Skip tests** that require unsupported APIs
4. **Create Storybook stories** for browser API integration
5. **Document limitations** clearly in test comments

This strategy ensures comprehensive test coverage while maintaining fast, reliable unit tests that can run in any environment.
