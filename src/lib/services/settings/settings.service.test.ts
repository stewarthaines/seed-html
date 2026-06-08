/**
 * SettingsService TDD Tests - Following Contract Specifications
 *
 * These tests implement the behavioral contracts from SETTINGS_SERVICE_CONTRACT.md
 * following the TDD Red-Green-Refactor cycle.
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import type { FileStorageAPI } from '../../storage/index.js';
import { SettingsService } from './settings.service.js';

// Test utilities and mocks
function createMockFileStorage(): jest.Mocked<FileStorageAPI> {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
    readTextFile: vi.fn().mockImplementation(async (workspaceId: string, path: string) => {
      if (path === '.workspace-metadata.json') {
        return JSON.stringify({ someOtherField: 'value' });
      }
      if (path === 'SOURCE/settings.json') {
        return JSON.stringify({
          text_transform: 'SOURCE/scripts/transform.js',
          dom_transforms: [],
          spine_basename: 'chapter',
        });
      }
      throw new Error('File not found');
    }),
    writeTextFile: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue([]),
    fileExists: vi.fn().mockResolvedValue(true),
  } as any;
}

function createMockExtensionManager() {
  return {
    getAvailableTransforms: vi.fn().mockResolvedValue([
      {
        path: 'SOURCE/scripts/transform.js',
        extensionName: 'Default Transform',
        fileName: 'transform.js',
      },
      {
        path: 'SOURCE/scripts/custom.js',
        extensionName: 'Custom Transform',
        fileName: 'custom.js',
      },
    ]),
    readTransformScript: vi.fn().mockResolvedValue('// transform script content'),
  };
}

function createMockThemeStore() {
  return {
    setTheme: vi.fn(),
    useSystemPreference: vi.fn(),
    getCurrentTheme: vi.fn().mockReturnValue('system'),
  };
}

function createMockI18nStore() {
  return {
    setLocale: vi.fn(),
    getCurrentLocale: vi.fn().mockReturnValue('en'),
  };
}

describe('SettingsService Contract Tests', () => {
  let service: SettingsService;
  let mockFileStorage: jest.Mocked<FileStorageAPI>;
  let mockExtensionManager: any;
  let mockThemeStore: any;
  let mockI18nStore: any;

  beforeEach(() => {
    mockFileStorage = createMockFileStorage();
    mockExtensionManager = createMockExtensionManager();
    mockThemeStore = createMockThemeStore();
    mockI18nStore = createMockI18nStore();
    service = new SettingsService(
      mockFileStorage,
      mockExtensionManager,
      mockThemeStore,
      mockI18nStore
    );

    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

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

      // CONTRACT: MUST return stored settings (enabled_plugins defaults in when absent)
      expect(result).toEqual({
        theme: 'dark',
        locale: 'fr',
        editor_font_size: 16,
        enabled_plugins: [],
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
        enabled_plugins: [],
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
      service.saveGlobalSettings({
        theme: 'dark',
        locale: 'en',
        editor_font_size: 14,
      });

      // CONTRACT: MUST update theme store
      expect(mockThemeStore.setTheme).toHaveBeenCalledWith('dark');
    });

    test('saveGlobalSettings updates i18n store', () => {
      service.saveGlobalSettings({
        theme: 'system',
        locale: 'fr',
        editor_font_size: 14,
      });

      // CONTRACT: MUST update i18n store
      expect(mockI18nStore.setLocale).toHaveBeenCalledWith('fr');
    });
  });

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

      mockFileStorage.readTextFile.mockResolvedValue(JSON.stringify(mockMetadata));

      const result = await service.loadWorkspaceSettings('workspace-123');

      // CONTRACT: MUST read from .workspace-metadata.json
      expect(mockFileStorage.readTextFile).toHaveBeenCalledWith(
        'workspace-123',
        '.workspace-metadata.json'
      );
      expect(result).toEqual(mockMetadata);
    });

    test('loadWorkspaceSettings returns defaults when file missing', async () => {
      mockFileStorage.readTextFile.mockRejectedValue(new Error('File not found'));

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

      mockFileStorage.readTextFile.mockResolvedValue(JSON.stringify(existingMetadata));

      await service.saveWorkspaceSettings('workspace-123', newSettings);

      // CONTRACT: MUST merge settings with existing metadata
      expect(mockFileStorage.writeTextFile).toHaveBeenCalledWith(
        'workspace-123',
        '.workspace-metadata.json',
        JSON.stringify(
          {
            someOtherField: 'value',
            bust_cache: true,
            draft_id: 3,
            editor: { preview_delay_ms: 800, advanced_mode: true },
          },
          null,
          2
        )
      );
    });
  });

  describe('Contract: EPUB Settings Management', () => {
    test('loadEPUBSettings reads from SOURCE/settings.json', async () => {
      const mockSettings = {
        text_transform: 'SOURCE/scripts/custom.js',
        dom_transforms: ['SOURCE/scripts/cleanup.js'],
        spine_basename: 'section',
        audio_clip_template: ':clip[<label>]{src=<href> begin=<begin> end=<end>}',
        filename_template: '<title> - <date>',
        cover: {
          template: 'modern',
          background_color: '#ffffff',
          text_color: '#000000',
          font_family: 'serif',
        },
      };

      mockFileStorage.readTextFile.mockResolvedValue(JSON.stringify(mockSettings));

      const result = await service.loadEPUBSettings('workspace-123');

      // CONTRACT: MUST read from SOURCE/settings.json
      expect(mockFileStorage.readTextFile).toHaveBeenCalledWith(
        'workspace-123',
        'SOURCE/settings.json'
      );
      expect(result).toEqual(mockSettings);
    });

    test('loadEPUBSettings returns defaults when file missing', async () => {
      mockFileStorage.readTextFile.mockRejectedValue(new Error('File not found'));

      const result = await service.loadEPUBSettings('workspace-123');

      // CONTRACT: MUST return defaults when file missing
      expect(result).toEqual({
        text_transform: 'SOURCE/scripts/transformText.js',
        dom_transforms: ['SOURCE/scripts/transformDom.js'],
        spine_basename: 'chapter',
        audio_clip_template: ':clip[<label>]{src=<href> begin=<begin> end=<end>}',
        filename_template: '<title> - <author> - <date>',
      });
    });

    test('loadEPUBSettings canonicalizes bare transform paths to SOURCE/scripts/', async () => {
      mockFileStorage.readTextFile.mockResolvedValue(
        JSON.stringify({
          text_transform: 'transformText.js',
          dom_transforms: ['transformDom.js', 'SOURCE/extensions/x/t.js'],
          spine_basename: 'chapter',
        })
      );

      const result = await service.loadEPUBSettings('workspace-123');

      expect(result.text_transform).toBe('SOURCE/scripts/transformText.js');
      // Bare names get the SOURCE/scripts/ prefix; full SOURCE/ paths are left alone.
      expect(result.dom_transforms).toEqual([
        'SOURCE/scripts/transformDom.js',
        'SOURCE/extensions/x/t.js',
      ]);
    });

    test('saveEPUBSettings writes to SOURCE/settings.json', async () => {
      const settings = {
        text_transform: 'SOURCE/scripts/transform.js',
        dom_transforms: [],
        spine_basename: 'chapter',
      };

      await service.saveEPUBSettings('workspace-123', settings);

      // CONTRACT: MUST write to SOURCE/settings.json
      expect(mockFileStorage.writeTextFile).toHaveBeenCalledWith(
        'workspace-123',
        'SOURCE/settings.json',
        JSON.stringify(settings, null, 2)
      );
    });
  });

  describe('Contract: Draft Mode Utilities', () => {
    test('incrementDraftId increases and saves draft ID', async () => {
      const currentSettings = {
        bust_cache: false,
        draft_id: 2,
        editor: { preview_delay_ms: 500, advanced_mode: false },
      };

      mockFileStorage.readTextFile.mockResolvedValue(JSON.stringify(currentSettings));

      const result = await service.incrementDraftId('workspace-123');

      // CONTRACT: MUST increment draft ID and save
      expect(result).toBe(3);
      expect(mockFileStorage.writeTextFile).toHaveBeenCalledWith(
        'workspace-123',
        '.workspace-metadata.json',
        JSON.stringify(
          {
            bust_cache: false,
            draft_id: 3,
            editor: { preview_delay_ms: 500, advanced_mode: false },
          },
          null,
          2
        )
      );
    });

    test('generateDraftTitle creates versioned title', () => {
      const result = service.generateDraftTitle('My Book', 3);

      // CONTRACT: MUST generate draft title format
      expect(result).toBe('My Book (Draft 3)');
    });

    test('extractDraftInfo parses draft titles', () => {
      const result = service.extractDraftInfo('My Book (Draft 5)');

      // CONTRACT: MUST extract draft information
      expect(result).toEqual({
        baseTitle: 'My Book',
        draftId: 5,
      });
    });

    test('extractDraftInfo handles non-draft titles', () => {
      const result = service.extractDraftInfo('Regular Book Title');

      // CONTRACT: MUST handle non-draft titles
      expect(result).toEqual({
        baseTitle: 'Regular Book Title',
        draftId: null,
      });
    });
  });

  describe('Contract: Transform Management', () => {
    test('getAvailableTransforms returns extension transforms', async () => {
      const result = await service.getAvailableTransforms('workspace-123');

      // CONTRACT: MUST return available transforms
      expect(result).toEqual([
        {
          path: 'SOURCE/scripts/transform.js',
          extensionName: 'Default Transform',
          fileName: 'transform.js',
        },
        {
          path: 'SOURCE/scripts/custom.js',
          extensionName: 'Custom Transform',
          fileName: 'custom.js',
        },
      ]);
      expect(mockExtensionManager.getAvailableTransforms).toHaveBeenCalledWith('workspace-123');
    });

    test('resolveTransformScripts loads script content', async () => {
      const settings = {
        text_transform: 'SOURCE/scripts/transform.js',
        dom_transforms: ['SOURCE/scripts/cleanup.js'],
        spine_basename: 'chapter',
      };

      mockFileStorage.readTextFile.mockImplementation(async (workspaceId, path) => {
        if (path === 'SOURCE/scripts/transform.js') return '// text transform';
        if (path === 'SOURCE/scripts/cleanup.js') return '// dom transform';
        return '';
      });

      const result = await service.resolveTransformScripts('workspace-123', settings);

      // CONTRACT: MUST resolve transform scripts
      expect(result).toEqual({
        textTransform: '// text transform',
        domTransforms: ['// dom transform'],
      });
    });
  });

  describe('Contract: Settings Validation', () => {
    test('validateGlobalSettings accepts valid settings', () => {
      const validSettings = {
        theme: 'dark' as const,
        locale: 'en',
        editor_font_size: 16,
      };

      const result = service.validateGlobalSettings(validSettings);

      // CONTRACT: MUST validate successfully
      expect(result).toEqual({
        isValid: true,
        errors: [],
        warnings: [],
      });
    });

    test('validateGlobalSettings rejects invalid theme', () => {
      const invalidSettings = {
        theme: 'invalid' as any,
        locale: 'en',
        editor_font_size: 14,
      };

      const result = service.validateGlobalSettings(invalidSettings);

      // CONTRACT: MUST reject invalid values
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid theme: invalid');
    });

    test('validateWorkspaceSettings rejects invalid preview delay', () => {
      const invalidSettings = {
        bust_cache: false,
        draft_id: 0,
        editor: {
          preview_delay_ms: 50, // Too low
          advanced_mode: false,
        },
      };

      const result = service.validateWorkspaceSettings(invalidSettings);

      // CONTRACT: MUST reject out-of-range values
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Preview delay must be between 100-2000ms');
    });

    test('validateEPUBSettings validates transform paths', () => {
      const invalidSettings = {
        text_transform: 'invalid/path.js',
        dom_transforms: [],
        spine_basename: '',
      };

      const result = service.validateEPUBSettings(invalidSettings);

      // CONTRACT: MUST validate transform paths and required fields
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Text transform must start with SOURCE/');
      expect(result.errors).toContain('Spine basename cannot be empty');
    });
  });

  describe('Contract: Infrastructure Integration', () => {
    test('uses FileStorageAPI for workspace and EPUB settings', async () => {
      await service.loadWorkspaceSettings('test-workspace');
      await service.loadEPUBSettings('test-workspace');

      // CONTRACT: MUST use FileStorageAPI for file operations
      expect(mockFileStorage.readTextFile).toHaveBeenCalledWith(
        'test-workspace',
        '.workspace-metadata.json'
      );
      expect(mockFileStorage.readTextFile).toHaveBeenCalledWith(
        'test-workspace',
        'SOURCE/settings.json'
      );
    });

    test('uses ExtensionManager for transform discovery', async () => {
      await service.getAvailableTransforms('test-workspace');

      // CONTRACT: MUST use ExtensionManager for transforms
      expect(mockExtensionManager.getAvailableTransforms).toHaveBeenCalledWith('test-workspace');
    });
  });
});
