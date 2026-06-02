# SettingsService Contract

**Date:** 2025-01-29  
**Status:** TDD Contract - Red Phase  
**Purpose:** Executable specification for SettingsService implementation in the clean service architecture

## Contract Overview

The SettingsService is the **settings management service** in the clean service architecture. It has **single responsibility** for managing application settings across three storage tiers: global (localStorage), workspace (.workspace-metadata.json), and EPUB (SOURCE/settings.json). It **never calls other services** - all coordination happens through reactive state in AppState.

### Core Responsibilities (Single Service Boundary)

1. **Global Settings Management**: User preferences stored in localStorage
2. **Workspace Settings Management**: Editor configuration per workspace
3. **EPUB Settings Management**: Book-specific settings that travel with EPUB
4. **Settings Validation**: Validate settings before persistence
5. **Transform Discovery**: List available transform scripts for UI

### What This Service Does NOT Do

- **Content transformation**: Handled by ContentService
- **Workspace management**: Handled by WorkspaceService
- **Theme/i18n state management**: Uses existing stores directly
- **Extension management**: Uses ExtensionManager as infrastructure
- **Cross-service coordination**: Handled by AppState reactive layers

### Architecture Principle

**Services never call other services**. The SettingsService only depends on infrastructure (FileStorageAPI, ExtensionManager, theme/i18n stores) and returns pure settings objects. All service coordination happens through AppState reactive effects.

## Interface Contract

### Core Interface

```typescript
interface SettingsService {
  // Global settings operations (localStorage)
  loadGlobalSettings(): GlobalSettings;
  saveGlobalSettings(settings: GlobalSettings): void;
  getDefaultGlobalSettings(): GlobalSettings;

  // Workspace settings operations (.workspace-metadata.json)
  loadWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings>;
  saveWorkspaceSettings(workspaceId: string, settings: WorkspaceSettings): Promise<void>;
  getDefaultWorkspaceSettings(): WorkspaceSettings;

  // EPUB settings operations (SOURCE/settings.json)
  loadEPUBSettings(workspaceId: string): Promise<EPUBSettings>;
  saveEPUBSettings(workspaceId: string, settings: EPUBSettings): Promise<void>;
  getDefaultEPUBSettings(): EPUBSettings;

  // Draft mode utilities
  incrementDraftId(workspaceId: string): Promise<number>;
  generateDraftTitle(baseTitle: string, draftId: number): string;
  extractDraftInfo(title: string): { baseTitle: string; draftId: number | null };

  // Transform management
  getAvailableTransforms(workspaceId: string): Promise<TransformOption[]>;
  resolveTransformScripts(
    workspaceId: string,
    settings: EPUBSettings
  ): Promise<{
    textTransform: string | null;
    domTransforms: string[];
  }>;

  // Validation
  validateGlobalSettings(settings: Partial<GlobalSettings>): SettingsValidation;
  validateWorkspaceSettings(settings: Partial<WorkspaceSettings>): SettingsValidation;
  validateEPUBSettings(settings: Partial<EPUBSettings>): SettingsValidation;
}
```

### Type Dependencies

SettingsService uses its own domain-specific types that align with the existing SettingsManager API:

**Service-Specific Types:**

```typescript
interface GlobalSettings {
  theme: 'light' | 'dark' | 'system';
  locale: string;
  editor_font_size: number; // 8-32 pixels
}

interface WorkspaceSettings {
  bust_cache: boolean;
  draft_id: number;
  editor?: {
    preview_delay_ms: number; // 100-2000ms
    advanced_mode: boolean;
  };
}

interface EPUBSettings {
  text_transform: string;
  dom_transforms: string[];
  spine_basename: string;
  cover?: {
    template: string;
    background_color: string;
    text_color: string;
    font_family: string;
  };
}

interface SettingsValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface TransformOption {
  path: string;
  extensionName: string;
  fileName: string;
}
```

These types are settings-domain specific and don't need to be shared with other services, as they represent the three-tier settings architecture unique to the SettingsService.

## Behavioral Contracts (Test-First Specifications)

### Contract 1: Global Settings Management

**Specification**: Global settings must persist to localStorage and integrate with theme/i18n stores.

```typescript
describe('Contract: Global Settings Management', () => {
  test('loadGlobalSettings returns stored settings', () => {
    // Setup localStorage
    localStorage.setItem(
      'editme_global_settings',
      JSON.stringify({
        theme: 'dark',
        locale: 'fr',
        editor_font_size: 16,
      })
    );

    const result = service.loadGlobalSettings();

    // CONTRACT: MUST return stored settings
    expect(result).toEqual({
      theme: 'dark',
      locale: 'fr',
      editor_font_size: 16,
    });
  });

  test('loadGlobalSettings returns defaults when no storage', () => {
    localStorage.clear();

    const result = service.loadGlobalSettings();

    // CONTRACT: MUST return defaults when no stored settings
    expect(result).toEqual({
      theme: 'system',
      locale: 'en',
      editor_font_size: 14,
    });
  });

  test('saveGlobalSettings persists to localStorage', () => {
    const settings = {
      theme: 'light' as const,
      locale: 'de',
      editor_font_size: 18,
    };

    service.saveGlobalSettings(settings);

    // CONTRACT: MUST persist to localStorage
    const stored = JSON.parse(localStorage.getItem('editme_global_settings')!);
    expect(stored).toEqual(settings);
  });

  test('saveGlobalSettings updates theme store', () => {
    const mockThemeStore = createMockThemeStore();
    const service = new SettingsService(mockFileStorage, mockExtensionManager, mockThemeStore);

    service.saveGlobalSettings({
      theme: 'dark',
      locale: 'en',
      editor_font_size: 14,
    });

    // CONTRACT: MUST update theme store
    expect(mockThemeStore.setTheme).toHaveBeenCalledWith('dark');
  });
});
```

### Contract 2: Workspace Settings Management

**Specification**: Workspace settings must persist to workspace metadata file.

```typescript
describe('Contract: Workspace Settings Management', () => {
  test('loadWorkspaceSettings reads from metadata file', async () => {
    const mockMetadata = {
      bust_cache: true,
      draft_id: 5,
      editor: {
        preview_delay_ms: 1000,
        advanced_mode: true,
      },
    };

    mockFileStorage.readJSONFile.mockResolvedValue(mockMetadata);

    const result = await service.loadWorkspaceSettings('workspace-123');

    // CONTRACT: MUST read from .workspace-metadata.json
    expect(mockFileStorage.readJSONFile).toHaveBeenCalledWith(
      'workspace-123',
      '.workspace-metadata.json'
    );
    expect(result).toEqual(mockMetadata);
  });

  test('loadWorkspaceSettings returns defaults when file missing', async () => {
    mockFileStorage.readJSONFile.mockRejectedValue(new Error('File not found'));

    const result = await service.loadWorkspaceSettings('workspace-123');

    // CONTRACT: MUST return defaults when file missing
    expect(result).toEqual({
      bust_cache: false,
      draft_id: 0,
      editor: {
        preview_delay_ms: 500,
        advanced_mode: false,
      },
    });
  });

  test('saveWorkspaceSettings merges with existing metadata', async () => {
    const existingMetadata = { someOtherField: 'value' };
    const newSettings = {
      bust_cache: true,
      draft_id: 3,
      editor: { preview_delay_ms: 800, advanced_mode: true },
    };

    mockFileStorage.readJSONFile.mockResolvedValue(existingMetadata);

    await service.saveWorkspaceSettings('workspace-123', newSettings);

    // CONTRACT: MUST merge settings with existing metadata
    expect(mockFileStorage.writeJSONFile).toHaveBeenCalledWith(
      'workspace-123',
      '.workspace-metadata.json',
      {
        someOtherField: 'value',
        bust_cache: true,
        draft_id: 3,
        editor: { preview_delay_ms: 800, advanced_mode: true },
      }
    );
  });
});
```

### Contract 3: EPUB Settings Management

**Specification**: EPUB settings must persist to SOURCE/settings.json.

```typescript
describe('Contract: EPUB Settings Management', () => {
  test('loadEPUBSettings reads from SOURCE/settings.json', async () => {
    const mockSettings = {
      text_transform: 'SOURCE/scripts/custom.js',
      dom_transforms: ['SOURCE/scripts/cleanup.js'],
      spine_basename: 'section',
      cover: {
        template: 'modern',
        background_color: '#ffffff',
        text_color: '#000000',
        font_family: 'serif',
      },
    };

    mockFileStorage.readJSONFile.mockResolvedValue(mockSettings);

    const result = await service.loadEPUBSettings('workspace-123');

    // CONTRACT: MUST read from SOURCE/settings.json
    expect(mockFileStorage.readJSONFile).toHaveBeenCalledWith(
      'workspace-123',
      'SOURCE/settings.json'
    );
    expect(result).toEqual(mockSettings);
  });

  test('saveEPUBSettings creates SOURCE directory if needed', async () => {
    const settings = {
      text_transform: 'SOURCE/scripts/transform.js',
      dom_transforms: [],
      spine_basename: 'chapter',
    };

    await service.saveEPUBSettings('workspace-123', settings);

    // CONTRACT: MUST write to SOURCE/settings.json (creates directory implicitly)
    expect(mockFileStorage.writeJSONFile).toHaveBeenCalledWith(
      'workspace-123',
      'SOURCE/settings.json',
      settings
    );
  });
});
```

### Contract 4: Draft Mode Utilities

**Specification**: Draft mode utilities must manage version tracking correctly.

```typescript
describe('Contract: Draft Mode Utilities', () => {
  test('incrementDraftId updates workspace settings', async () => {
    const mockSettings = { bust_cache: true, draft_id: 2, editor: {} };
    mockFileStorage.readJSONFile.mockResolvedValue(mockSettings);

    const result = await service.incrementDraftId('workspace-123');

    // CONTRACT: MUST increment draft ID and save
    expect(result).toBe(3);
    expect(mockFileStorage.writeJSONFile).toHaveBeenCalledWith(
      'workspace-123',
      '.workspace-metadata.json',
      expect.objectContaining({ draft_id: 3 })
    );
  });

  test('generateDraftTitle appends draft ID', () => {
    const result = service.generateDraftTitle('My Book', 5);

    // CONTRACT: MUST append draft ID to title
    expect(result).toBe('My Book 5');
  });

  test('extractDraftInfo parses title with draft ID', () => {
    const result = service.extractDraftInfo('My Book 7');

    // CONTRACT: MUST extract base title and draft ID
    expect(result).toEqual({
      baseTitle: 'My Book',
      draftId: 7,
    });
  });

  test('extractDraftInfo handles title without draft ID', () => {
    const result = service.extractDraftInfo('Regular Title');

    // CONTRACT: MUST handle titles without draft ID
    expect(result).toEqual({
      baseTitle: 'Regular Title',
      draftId: null,
    });
  });
});
```

### Contract 5: Transform Management

**Specification**: Transform management must discover available scripts without calling other services.

```typescript
describe('Contract: Transform Management', () => {
  test('getAvailableTransforms lists built-in and extension scripts', async () => {
    mockFileStorage.listFiles.mockResolvedValue(['transform.js', 'cleanup.js']);
    mockExtensionManager.listWorkspaceExtensions.mockResolvedValue([
      {
        name: 'markdown-it',
        files: [{ filename: 'transform.js', type: 'javascript' }],
      },
    ]);

    const result = await service.getAvailableTransforms('workspace-123');

    // CONTRACT: MUST list built-in and extension transforms
    expect(result).toContainEqual({
      path: 'SOURCE/scripts/transform.js',
      extensionName: 'built-in',
      fileName: 'transform.js',
    });
    expect(result).toContainEqual({
      path: 'SOURCE/extensions/markdown-it/transform.js',
      extensionName: 'markdown-it',
      fileName: 'transform.js',
    });
  });

  test('resolveTransformScripts validates script existence', async () => {
    const settings = {
      text_transform: 'SOURCE/scripts/transform.js',
      dom_transforms: ['SOURCE/scripts/cleanup.js', 'SOURCE/scripts/missing.js'],
      spine_basename: 'chapter',
    };

    mockFileStorage.fileExists
      .mockResolvedValueOnce(true) // transform.js exists
      .mockResolvedValueOnce(true) // cleanup.js exists
      .mockResolvedValueOnce(false); // missing.js doesn't exist

    const result = await service.resolveTransformScripts('workspace-123', settings);

    // CONTRACT: MUST validate script existence
    expect(result).toEqual({
      textTransform: 'SOURCE/scripts/transform.js',
      domTransforms: ['SOURCE/scripts/cleanup.js'], // missing.js filtered out
    });
  });
});
```

### Contract 6: Settings Validation

**Specification**: Settings validation must catch invalid values before persistence.

```typescript
describe('Contract: Settings Validation', () => {
  test('validateGlobalSettings catches invalid values', () => {
    const invalidSettings = {
      theme: 'invalid-theme' as any,
      locale: 'invalid-locale',
      editor_font_size: -5,
    };

    const result = service.validateGlobalSettings(invalidSettings);

    // CONTRACT: MUST catch invalid settings
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid theme: invalid-theme');
    expect(result.errors).toContain('Invalid locale: invalid-locale');
    expect(result.errors).toContain('Font size must be between 8 and 32');
  });

  test('validateEPUBSettings validates transform paths', () => {
    const invalidSettings = {
      text_transform: '../../../etc/passwd', // Path traversal
      dom_transforms: ['valid/path.js', '../../bad/path.js'],
      spine_basename: '', // Empty basename
    };

    const result = service.validateEPUBSettings(invalidSettings);

    // CONTRACT: MUST validate transform paths and required fields
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid transform path: must start with SOURCE/');
    expect(result.errors).toContain('Spine basename cannot be empty');
    expect(result.errors).toContain('Invalid DOM transform path: ../../bad/path.js');
  });

  test('validateWorkspaceSettings validates numeric ranges', () => {
    const invalidSettings = {
      bust_cache: true,
      draft_id: -1,
      editor: {
        preview_delay_ms: 50, // Too low
        advanced_mode: true,
      },
    };

    const result = service.validateWorkspaceSettings(invalidSettings);

    // CONTRACT: MUST validate numeric ranges
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Draft ID must be non-negative');
    expect(result.errors).toContain('Preview delay must be between 100 and 2000ms');
  });
});
```

## Infrastructure Integration Contract

**Specification**: SettingsService must properly use infrastructure components without calling other services.

```typescript
describe('Contract: Infrastructure Integration', () => {
  test('uses FileStorageAPI for workspace and EPUB settings', async () => {
    const mockFileStorage = createMockFileStorage();
    const service = new SettingsService(mockFileStorage, mockExtensionManager);

    await service.loadWorkspaceSettings('workspace-123');
    await service.loadEPUBSettings('workspace-123');

    // CONTRACT: MUST use FileStorageAPI for file operations
    expect(mockFileStorage.readJSONFile).toHaveBeenCalledWith(
      'workspace-123',
      '.workspace-metadata.json'
    );
    expect(mockFileStorage.readJSONFile).toHaveBeenCalledWith(
      'workspace-123',
      'SOURCE/settings.json'
    );
  });

  test('uses ExtensionManager for transform discovery', async () => {
    const mockExtensionManager = createMockExtensionManager();
    const service = new SettingsService(mockFileStorage, mockExtensionManager);

    await service.getAvailableTransforms('workspace-123');

    // CONTRACT: MUST use ExtensionManager for extension discovery
    expect(mockExtensionManager.listWorkspaceExtensions).toHaveBeenCalledWith('workspace-123');
  });

  test('integrates with theme store for global settings', () => {
    const mockThemeStore = createMockThemeStore();
    const service = new SettingsService(mockFileStorage, mockExtensionManager, mockThemeStore);

    service.saveGlobalSettings({
      theme: 'system',
      locale: 'en',
      editor_font_size: 14,
    });

    // CONTRACT: MUST integrate with theme store
    expect(mockThemeStore.useSystemPreference).toHaveBeenCalled();
  });
});
```

## Performance Contract

**Specification**: Settings operations must be fast and cacheable.

```typescript
describe('Contract: Performance', () => {
  test('global settings load synchronously', () => {
    const startTime = Date.now();
    const result = service.loadGlobalSettings();
    const duration = Date.now() - startTime;

    // CONTRACT: MUST load global settings synchronously within 10ms
    expect(duration).toBeLessThan(10);
    expect(result).toBeDefined();
  });

  test('transform discovery caches results', async () => {
    await service.getAvailableTransforms('workspace-123');
    await service.getAvailableTransforms('workspace-123'); // Second call

    // CONTRACT: MUST cache transform discovery results
    expect(mockExtensionManager.listWorkspaceExtensions).toHaveBeenCalledTimes(1);
    expect(mockFileStorage.listFiles).toHaveBeenCalledTimes(1);
  });
});
```

## Implementation Guidance

### Red Phase (Failing Tests)

1. **Copy all contract tests** into `src/lib/services/settings/settings.service.test.ts`
2. **Run tests** - they should all fail (Red phase)
3. **Create minimal class** that satisfies TypeScript compilation

### Green Phase (Make Tests Pass)

1. **Implement SettingsService class** with infrastructure dependencies only
2. **Use FileStorageAPI, ExtensionManager, theme/i18n stores** as dependencies
3. **Make each contract test pass** one at a time
4. **Focus on simplest implementation** that satisfies contracts

### Refactor Phase (Optimize)

1. **Add caching** for transform discovery
2. **Optimize validation** performance
3. **Add debouncing** for frequent saves
4. **Ensure all contracts still pass**

## Success Criteria

- ✅ All contract tests pass
- ✅ No dependencies on other services (only infrastructure)
- ✅ Returns pure settings objects for reactive consumption
- ✅ Handles all three storage tiers correctly
- ✅ Provides comprehensive validation
- ✅ Integrates properly with theme/i18n stores
- ✅ Meets performance expectations

This contract serves as the **executable specification** for TDD implementation of SettingsService in the clean service architecture.
