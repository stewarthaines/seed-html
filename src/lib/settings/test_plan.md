# Settings Manager Test Plan

## Overview

This document provides comprehensive test specifications for the Settings Manager feature. Combined with the public API in `index.ts`, it contains all the context needed to write robust unit and integration tests.

## Testing Strategy

### Test Categories

1. **Unit Tests** - Pure business logic and validation (fast, comprehensive)
2. **Integration Tests** - Data persistence and cross-system workflows (selective, high-value)
3. **Storybook Stories** - UI interactions and visual verification (covered separately)

### Focus Areas

- ✅ **Test behavior, not implementation**
- ✅ **Mock external boundaries only** (file system, localStorage, extensions)
- ✅ **Use real validation and business logic**
- ✅ **TypeScript-first approach** with proper typing

## Test File Organization

```
src/lib/settings/test/
├── settings-manager.test.ts      # Core unit tests
├── validation.test.ts            # Validation logic tests
├── integration.test.ts           # File persistence integration tests
├── fixtures.ts                   # Shared test data
└── test-utils.ts                 # Simple mock helpers
```

## Mock Strategy

### What to Mock (External Boundaries)

```typescript
// File system operations
const mockFileStorage = {
  readJSONFile: vi.fn<[string, string], Promise<any>>(),
  writeJSONFile: vi.fn<[string, string, any], Promise<void>>(),
  listFiles: vi.fn<[string, string?], Promise<string[]>>(),
  isInitialized: () => true,
} satisfies Partial<FileStorageAPI>;

// Extension discovery
const mockExtensionManager = {
  listWorkspaceExtensions: vi.fn<[string], Promise<ExtensionInfo[]>>(),
} satisfies Partial<ExtensionManager>;

// Browser localStorage
const mockLocalStorage = {
  getItem: vi.fn<[string], string | null>(),
  setItem: vi.fn<[string, string], void>(),
  removeItem: vi.fn<[string], void>(),
};
```

### What NOT to Mock

- ❌ SettingsManager internal methods
- ❌ Validation logic (test real functions)
- ❌ Draft ID generation (pure functions)
- ❌ Transform resolution logic
- ❌ Default settings generation

## Test Data Fixtures

### Valid Settings Data

```typescript
export const SETTINGS_FIXTURES = {
  global: {
    valid: (): GlobalSettings => ({
      theme: 'dark',
      locale: 'en',
      editor_font_size: 14,
    }),
    minimal: (): GlobalSettings => ({
      theme: 'system',
      locale: 'de',
      editor_font_size: 12,
    }),
  },

  workspace: {
    valid: (): WorkspaceSettings => ({
      bust_cache: false,
      draft_id: 0,
      editor: {
        advanced_mode: false,
        preview_delay_ms: 500,
      },
    }),
    advanced: (): WorkspaceSettings => ({
      bust_cache: true,
      draft_id: 7,
      editor: {
        advanced_mode: true,
        preview_delay_ms: 1000,
      },
    }),
    minimal: (): WorkspaceSettings => ({
      bust_cache: false,
      draft_id: 0,
      // No editor object
    }),
  },

  epub: {
    valid: (): EPUBSettings => ({
      text_transform: 'SOURCE/scripts/transform.js',
      dom_transforms: ['SOURCE/extensions/markdown-it/transform.js'],
      spine_basename: 'chapter',
      cover: {
        template: 'minimal',
        background_color: '#ffffff',
        text_color: '#000000',
        font_family: 'serif',
      },
    }),
    minimal: (): EPUBSettings => ({
      text_transform: 'SOURCE/scripts/transform.js',
      dom_transforms: [],
      spine_basename: 'section',
      // No cover config
    }),
  },
};
```

### Invalid Settings for Validation Testing

```typescript
export const VALIDATION_TEST_CASES = {
  globalSettings: [
    {
      name: 'invalid theme',
      input: { theme: 'purple' },
      expectedErrors: ['Theme must be light, dark, or system'],
    },
    {
      name: 'invalid locale',
      input: { locale: 'invalid-locale' },
      expectedErrors: ['Locale invalid-locale is not supported'],
    },
    {
      name: 'font size too small',
      input: { editor_font_size: 5 },
      expectedErrors: ['Font size must be between 8 and 32 pixels'],
    },
    {
      name: 'font size too large',
      input: { editor_font_size: 50 },
      expectedErrors: ['Font size must be between 8 and 32 pixels'],
    },
    {
      name: 'negative font size',
      input: { editor_font_size: -10 },
      expectedErrors: ['Font size must be between 8 and 32 pixels'],
    },
  ],

  workspaceSettings: [
    {
      name: 'negative draft ID',
      input: { draft_id: -1 },
      expectedErrors: ['Draft ID must be non-negative'],
    },
    {
      name: 'preview delay too short',
      input: { editor: { preview_delay_ms: 50 } },
      expectedErrors: ['Preview delay must be between 100-2000ms'],
    },
    {
      name: 'preview delay too long',
      input: { editor: { preview_delay_ms: 3000 } },
      expectedErrors: ['Preview delay must be between 100-2000ms'],
    },
    {
      name: 'invalid bust_cache type',
      input: { bust_cache: 'yes' },
      expectedErrors: ['Bust cache must be a boolean'],
    },
  ],

  epubSettings: [
    {
      name: 'invalid transform path - outside SOURCE',
      input: { text_transform: '../../../etc/passwd' },
      expectedErrors: ['Transform path must start with SOURCE/'],
    },
    {
      name: 'invalid transform path - no .js extension',
      input: { text_transform: 'SOURCE/scripts/transform.txt' },
      expectedErrors: ['Transform path must end with .js'],
    },
    {
      name: 'empty spine basename',
      input: { spine_basename: '' },
      expectedErrors: ['Spine basename cannot be empty'],
    },
    {
      name: 'spine basename with invalid characters',
      input: { spine_basename: 'chapter/../evil' },
      expectedErrors: ['Spine basename contains invalid characters'],
    },
    {
      name: 'invalid background color',
      input: { cover: { background_color: 'red' } },
      expectedErrors: ['Background color must be a valid hex color (#RRGGBB)'],
    },
    {
      name: 'invalid text color',
      input: { cover: { text_color: '#xyz' } },
      expectedErrors: ['Text color must be a valid hex color (#RRGGBB)'],
    },
  ],
};
```

### Extension Mock Data

```typescript
export const EXTENSION_FIXTURES = {
  singleExtension: (): ExtensionInfo[] => [
    {
      name: 'markdown-it',
      files: [
        { filename: 'transform.js', size: 15000, type: 'javascript' },
        { filename: 'LICENSE.txt', size: 1200, type: 'license' },
      ],
      totalSize: 16200,
      location: 'workspace',
    },
  ],

  multipleExtensions: (): ExtensionInfo[] => [
    {
      name: 'markdown-it',
      files: [
        { filename: 'transform.js', size: 15000, type: 'javascript' },
        { filename: 'markdown-it.min.js', size: 45000, type: 'javascript' },
      ],
      totalSize: 60000,
      location: 'workspace',
    },
    {
      name: 'highlight-js',
      files: [{ filename: 'highlight.min.js', size: 32000, type: 'javascript' }],
      totalSize: 32000,
      location: 'workspace',
    },
  ],

  expectedTransformOptions: (): TransformOption[] => [
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
  ],
};
```

## Unit Test Specifications

### Validation Logic Tests

**File**: `validation.test.ts`

Test all validation methods with both valid and invalid inputs:

```typescript
describe('Settings Validation', () => {
  describe('validateGlobalSettings', () => {
    it.each(VALIDATION_TEST_CASES.globalSettings)(
      'should reject $name',
      ({ input, expectedErrors }) => {
        const result = settingsManager.validateGlobalSettings(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(expectedErrors);
      }
    );

    it('should accept valid global settings', () => {
      const valid = SETTINGS_FIXTURES.global.valid();
      const result = settingsManager.validateGlobalSettings(valid);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // Similar tests for validateWorkspaceSettings and validateEPUBSettings
});
```

### Default Settings Tests

Test that all default methods return valid, expected values:

```typescript
describe('Default Settings', () => {
  it('should return valid default global settings', () => {
    const defaults = settingsManager.getDefaultGlobalSettings();

    expect(defaults.theme).toBe('system');
    expect(defaults.locale).toBe('en');
    expect(defaults.editor_font_size).toBe(14);

    // Defaults should pass validation
    const validation = settingsManager.validateGlobalSettings(defaults);
    expect(validation.isValid).toBe(true);
  });

  // Similar tests for workspace and EPUB defaults
});
```

### Draft Mode Utilities Tests

Test pure functions for draft ID handling:

```typescript
describe('Draft Mode Utilities', () => {
  describe('generateDraftTitle', () => {
    it('should append draft ID to title', () => {
      expect(settingsManager.generateDraftTitle('My Book', 3)).toBe('My Book 3');
      expect(settingsManager.generateDraftTitle('Guide to Testing', 1)).toBe('Guide to Testing 1');
    });

    it('should handle titles with numbers', () => {
      expect(settingsManager.generateDraftTitle('Book 2020', 5)).toBe('Book 2020 5');
    });
  });

  describe('extractDraftInfo', () => {
    it('should extract draft ID from title', () => {
      const result = settingsManager.extractDraftInfo('My Book 3');
      expect(result.baseTitle).toBe('My Book');
      expect(result.draftId).toBe(3);
    });

    it('should return null for titles without draft ID', () => {
      const result = settingsManager.extractDraftInfo('Regular Title');
      expect(result.baseTitle).toBe('Regular Title');
      expect(result.draftId).toBe(null);
    });

    it('should handle edge cases', () => {
      expect(settingsManager.extractDraftInfo('Book 123 456')).toEqual({
        baseTitle: 'Book 123',
        draftId: 456,
      });

      expect(settingsManager.extractDraftInfo('Book')).toEqual({
        baseTitle: 'Book',
        draftId: null,
      });
    });
  });
});
```

### File Operations with Mocks

Test save/load operations with mocked file system:

```typescript
describe('Settings File Operations', () => {
  describe('Global Settings (localStorage)', () => {
    it('should save and load global settings', () => {
      const settings = SETTINGS_FIXTURES.global.valid();

      settingsManager.saveGlobalSettings(settings);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'editme_global_settings',
        JSON.stringify(settings)
      );
    });

    it('should load settings from localStorage', () => {
      const stored = SETTINGS_FIXTURES.global.valid();
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(stored));

      const loaded = settingsManager.loadGlobalSettings();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('editme_global_settings');
      expect(loaded).toEqual(stored);
    });

    it('should return defaults when localStorage is empty', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const loaded = settingsManager.loadGlobalSettings();
      const defaults = settingsManager.getDefaultGlobalSettings();

      expect(loaded).toEqual(defaults);
    });
  });

  describe('Workspace Settings', () => {
    it('should save workspace settings to metadata file', async () => {
      const settings = SETTINGS_FIXTURES.workspace.valid();

      await settingsManager.saveWorkspaceSettings('ws-123', settings);

      expect(mockFileStorage.writeJSONFile).toHaveBeenCalledWith(
        'ws-123',
        '.workspace-metadata.json',
        expect.objectContaining(settings)
      );
    });

    it('should load workspace settings from metadata file', async () => {
      const stored = SETTINGS_FIXTURES.workspace.valid();
      mockFileStorage.readJSONFile.mockResolvedValue(stored);

      const loaded = await settingsManager.loadWorkspaceSettings('ws-123');

      expect(mockFileStorage.readJSONFile).toHaveBeenCalledWith(
        'ws-123',
        '.workspace-metadata.json'
      );
      expect(loaded).toEqual(stored);
    });
  });
});
```

### Transform Management Tests

Test extension discovery and script resolution:

```typescript
describe('Transform Management', () => {
  describe('getAvailableTransforms', () => {
    it('should return transforms from built-in scripts and extensions', async () => {
      // Mock built-in scripts
      mockFileStorage.listFiles.mockResolvedValue(['transform.js', 'custom.js']);

      // Mock extensions
      mockExtensionManager.listWorkspaceExtensions.mockResolvedValue(
        EXTENSION_FIXTURES.multipleExtensions()
      );

      const transforms = await settingsManager.getAvailableTransforms('ws-123');

      expect(transforms).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'SOURCE/scripts/transform.js',
            extensionName: 'built-in',
            fileName: 'transform.js',
          }),
          expect.objectContaining({
            path: 'SOURCE/extensions/markdown-it/transform.js',
            extensionName: 'markdown-it',
            fileName: 'transform.js',
          }),
        ])
      );
    });
  });

  describe('resolveTransformScripts', () => {
    it('should validate script paths exist', async () => {
      const settings = SETTINGS_FIXTURES.epub.valid();
      mockFileStorage.fileExists = vi
        .fn()
        .mockResolvedValueOnce(true) // text_transform exists
        .mockResolvedValueOnce(true); // dom_transform exists

      const resolved = await settingsManager.resolveTransformScripts('ws-123', settings);

      expect(resolved.textTransform).toBe(settings.text_transform);
      expect(resolved.domTransforms).toEqual(settings.dom_transforms);
    });

    it('should handle missing scripts gracefully', async () => {
      const settings = SETTINGS_FIXTURES.epub.valid();
      mockFileStorage.fileExists = vi
        .fn()
        .mockResolvedValueOnce(false) // text_transform missing
        .mockResolvedValueOnce(true); // dom_transform exists

      const resolved = await settingsManager.resolveTransformScripts('ws-123', settings);

      expect(resolved.textTransform).toBe(null);
      expect(resolved.domTransforms).toEqual(settings.dom_transforms);
    });
  });
});
```

### Error Handling Tests

Test various error scenarios:

```typescript
describe('Error Handling', () => {
  describe('localStorage Errors', () => {
    it('should handle localStorage quota exceeded', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const settings = SETTINGS_FIXTURES.global.valid();

      // Should not throw
      expect(() => settingsManager.saveGlobalSettings(settings)).not.toThrow();
    });

    it('should handle localStorage access denied', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Access denied');
      });

      // Should return defaults
      const loaded = settingsManager.loadGlobalSettings();
      const defaults = settingsManager.getDefaultGlobalSettings();
      expect(loaded).toEqual(defaults);
    });
  });

  describe('File System Errors', () => {
    it('should handle file not found', async () => {
      mockFileStorage.readJSONFile.mockRejectedValue(new Error('File not found'));

      const loaded = await settingsManager.loadWorkspaceSettings('ws-123');
      const defaults = settingsManager.getDefaultWorkspaceSettings();

      expect(loaded).toEqual(defaults);
    });

    it('should handle corrupted JSON', async () => {
      mockFileStorage.readJSONFile.mockRejectedValue(new SyntaxError('Invalid JSON'));

      const loaded = await settingsManager.loadEPUBSettings('ws-123');
      const defaults = settingsManager.getDefaultEPUBSettings();

      expect(loaded).toEqual(defaults);
    });
  });

  describe('Draft ID Operations', () => {
    it('should handle increment when workspace settings missing', async () => {
      mockFileStorage.readJSONFile.mockRejectedValue(new Error('File not found'));

      const newDraftId = await settingsManager.incrementDraftId('ws-123');

      // Should start from 1 if no existing settings
      expect(newDraftId).toBe(1);

      // Should save updated settings
      expect(mockFileStorage.writeJSONFile).toHaveBeenCalledWith(
        'ws-123',
        '.workspace-metadata.json',
        expect.objectContaining({ draft_id: 1 })
      );
    });
  });
});
```

## Integration Test Specifications

**File**: `integration.test.ts`

Integration tests use real file system operations to test data persistence:

### Test Setup

```typescript
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { SettingsManager } from '../settings-manager';
import { FileStorageAPI } from '$lib/storage';
import { createTempWorkspace, cleanupTempWorkspace } from './test-utils';

describe('Settings Manager Integration', () => {
  let settingsManager: SettingsManager;
  let fileStorage: FileStorageAPI;
  let tempWorkspaceId: string;

  beforeEach(async () => {
    tempWorkspaceId = await createTempWorkspace();
    fileStorage = new FileStorageAPI();
    await fileStorage.init();

    const mockExtensionManager = {
      listWorkspaceExtensions: vi.fn().mockResolvedValue([]),
    };

    settingsManager = new SettingsManager(fileStorage, mockExtensionManager);
  });

  afterEach(async () => {
    await cleanupTempWorkspace(tempWorkspaceId);
    fileStorage.destroy();
  });
});
```

### Core Integration Tests

```typescript
describe('Settings Persistence', () => {
  it('should persist workspace settings through save/load cycle', async () => {
    const originalSettings = SETTINGS_FIXTURES.workspace.advanced();

    // Save settings
    await settingsManager.saveWorkspaceSettings(tempWorkspaceId, originalSettings);

    // Load settings in fresh instance
    const freshManager = new SettingsManager(fileStorage, mockExtensionManager);
    const loadedSettings = await freshManager.loadWorkspaceSettings(tempWorkspaceId);

    expect(loadedSettings).toEqual(originalSettings);
  });

  it('should persist EPUB settings through save/load cycle', async () => {
    const originalSettings = SETTINGS_FIXTURES.epub.valid();

    await settingsManager.saveEPUBSettings(tempWorkspaceId, originalSettings);

    const loadedSettings = await settingsManager.loadEPUBSettings(tempWorkspaceId);

    expect(loadedSettings).toEqual(originalSettings);
  });

  it('should handle draft ID increments with real persistence', async () => {
    // Set initial workspace settings
    const initialSettings = SETTINGS_FIXTURES.workspace.valid();
    initialSettings.draft_id = 5;
    await settingsManager.saveWorkspaceSettings(tempWorkspaceId, initialSettings);

    // Increment draft ID
    const newDraftId = await settingsManager.incrementDraftId(tempWorkspaceId);
    expect(newDraftId).toBe(6);

    // Verify persistence
    const loadedSettings = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
    expect(loadedSettings.draft_id).toBe(6);
  });
});

describe('Edge Cases with Real File System', () => {
  it('should handle missing workspace metadata file', async () => {
    // Don't create any settings file
    const loadedSettings = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
    const expectedDefaults = settingsManager.getDefaultWorkspaceSettings();

    expect(loadedSettings).toEqual(expectedDefaults);
  });

  it('should handle corrupted settings files', async () => {
    // Write invalid JSON to settings file
    await fileStorage.writeFile(tempWorkspaceId, 'SOURCE/settings.json', 'invalid json content');

    const loadedSettings = await settingsManager.loadEPUBSettings(tempWorkspaceId);
    const expectedDefaults = settingsManager.getDefaultEPUBSettings();

    expect(loadedSettings).toEqual(expectedDefaults);
  });

  it('should handle concurrent settings operations', async () => {
    const settings1 = SETTINGS_FIXTURES.workspace.valid();
    const settings2 = SETTINGS_FIXTURES.workspace.advanced();

    // Simulate concurrent saves
    await Promise.all([
      settingsManager.saveWorkspaceSettings(tempWorkspaceId, settings1),
      settingsManager.saveWorkspaceSettings(tempWorkspaceId, settings2),
    ]);

    // One of them should win (test that it doesn't crash)
    const finalSettings = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
    expect(finalSettings).toEqual(expect.any(Object));
  });
});
```

## Test Utilities

**File**: `test-utils.ts`

```typescript
import { vi } from 'vitest';
import type { FileStorageAPI } from '$lib/storage';
import type { ExtensionManager } from '$lib/extensions';

// Simple mock creators
export function createMockFileStorage() {
  return {
    readJSONFile: vi.fn().mockResolvedValue({}),
    writeJSONFile: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue([]),
    fileExists: vi.fn().mockResolvedValue(true),
    isInitialized: () => true,
  } satisfies Partial<FileStorageAPI>;
}

export function createMockExtensionManager() {
  return {
    listWorkspaceExtensions: vi.fn().mockResolvedValue([]),
  } satisfies Partial<ExtensionManager>;
}

// Integration test helpers
export async function createTempWorkspace(): Promise<string> {
  const workspaceId = `test-workspace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  // Setup temp directory structure if needed
  return workspaceId;
}

export async function cleanupTempWorkspace(workspaceId: string): Promise<void> {
  // Cleanup temp files
}

// Behavior verification helpers
export function expectWorkspaceSettingsSaved(
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

export function expectEPUBSettingsSaved(
  mockStorage: ReturnType<typeof createMockFileStorage>,
  workspaceId: string,
  settings: any
) {
  expect(mockStorage.writeJSONFile).toHaveBeenCalledWith(
    workspaceId,
    'SOURCE/settings.json',
    settings
  );
}

// localStorage mock setup
export function setupLocalStorageMock() {
  const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });

  return mockLocalStorage;
}
```

## Coverage Requirements

### Unit Tests Should Cover:

- ✅ All validation methods with valid/invalid inputs
- ✅ All default settings generation
- ✅ Draft mode utilities (pure functions)
- ✅ Transform discovery and resolution
- ✅ Error handling for external dependencies
- ✅ File operation mocking scenarios

### Integration Tests Should Cover:

- ✅ Real file persistence cycles
- ✅ Draft ID increment with persistence
- ✅ Corrupted file recovery
- ✅ Missing file fallback behavior
- ✅ Concurrent operations handling

### Edge Cases to Test:

- ✅ Empty/null input handling
- ✅ Malformed JSON recovery
- ✅ Storage quota exceeded
- ✅ Permission denied scenarios
- ✅ Network timeout (for any network operations)
- ✅ Large dataset handling

## Expected Test Performance

- **Unit Tests**: Complete suite should run in < 500ms
- **Integration Tests**: Should run in < 2000ms
- **Total Test Suite**: Target < 3000ms for fast feedback

## Implementation Notes

1. **Use `vi.fn()` with TypeScript generics** for proper typing
2. **Use `satisfies` keyword** for type-safe mocks
3. **Test fixtures return functions** to avoid shared mutable state
4. **Integration tests use real FileStorageAPI** but mocked ExtensionManager
5. **Focus on behavior verification** rather than implementation details
6. **Group tests logically** by feature area, not by method name

This test plan provides comprehensive coverage while maintaining fast execution and clear organization. The combination of unit tests for business logic and selective integration tests for data persistence ensures robust validation of the Settings Manager functionality.
