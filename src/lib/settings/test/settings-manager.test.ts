/**
 * Settings Manager Core Tests
 *
 * Unit tests for the Settings Manager functionality including file operations,
 * default settings, draft mode utilities, and transform management.
 *
 * Note: These tests are written to work with the actual SettingsManager implementation
 * when it becomes available. They are currently skipped until then.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SETTINGS_FIXTURES, EXTENSION_FIXTURES, LOCALSTORAGE_FIXTURES } from './fixtures.js';
import {
  createMockFileStorage,
  createMockExtensionManager,
  setupLocalStorageMock,
  resetAllMocks,
  expectWorkspaceSettingsSaved,
  expectEPUBSettingsSaved,
  expectGlobalSettingsSaved,
  mockWorkspaceSettingsReturn,
  mockEPUBSettingsReturn,
  mockFileNotFound,
  mockCorruptedJSON,
  mockDirectoryListing,
  simulateLocalStorageQuotaError,
  simulateLocalStorageAccessError,
  simulateFileWriteError,
  simulateFileReadError,
} from './test-utils.js';

import { SettingsManager } from '../settings-manager.js';

describe('Settings Manager Core', () => {
  let settingsManager: SettingsManager;
  let mockFileStorage: ReturnType<typeof createMockFileStorage>;
  let mockExtensionManager: ReturnType<typeof createMockExtensionManager>;
  let mockLocalStorage: ReturnType<typeof setupLocalStorageMock>;

  beforeEach(() => {
    mockFileStorage = createMockFileStorage();
    mockExtensionManager = createMockExtensionManager();
    mockLocalStorage = setupLocalStorageMock();

    settingsManager = new SettingsManager(mockFileStorage as any, mockExtensionManager as any);

    resetAllMocks(mockFileStorage, mockExtensionManager, mockLocalStorage);
  });

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

    it('should return valid default workspace settings', () => {
      const defaults = settingsManager.getDefaultWorkspaceSettings();

      expect(defaults.bust_cache).toBe(false);
      expect(defaults.draft_id).toBe(0);
      expect(defaults.editor?.advanced_mode).toBe(false);
      expect(defaults.editor?.preview_delay_ms).toBe(500);

      // Defaults should pass validation
      const validation = settingsManager.validateWorkspaceSettings(defaults);
      expect(validation.isValid).toBe(true);
    });

    it('should return valid default EPUB settings', () => {
      const defaults = settingsManager.getDefaultEPUBSettings();

      expect(defaults.text_transform).toBe('SOURCE/scripts/transform.js');
      expect(defaults.dom_transforms).toEqual([]);
      expect(defaults.spine_basename).toBe('chapter');
      expect(defaults.cover?.template).toBe('minimal');
      expect(defaults.cover?.background_color).toBe('#ffffff');
      expect(defaults.cover?.text_color).toBe('#000000');
      expect(defaults.cover?.font_family).toBe('serif');

      // Defaults should pass validation
      const validation = settingsManager.validateEPUBSettings(defaults);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Global Settings (localStorage)', () => {
    it('should save and load global settings', () => {
      const settings = SETTINGS_FIXTURES.global.valid();

      settingsManager.saveGlobalSettings(settings);

      expectGlobalSettingsSaved(mockLocalStorage, settings);
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

    it('should handle corrupted localStorage data', () => {
      mockLocalStorage.getItem.mockReturnValue(LOCALSTORAGE_FIXTURES.corruptedData);

      const loaded = settingsManager.loadGlobalSettings();
      const defaults = settingsManager.getDefaultGlobalSettings();

      expect(loaded).toEqual(defaults);
    });

    it('should handle localStorage access errors', () => {
      simulateLocalStorageAccessError(mockLocalStorage);

      const loaded = settingsManager.loadGlobalSettings();
      const defaults = settingsManager.getDefaultGlobalSettings();

      expect(loaded).toEqual(defaults);
    });

    it('should handle localStorage quota exceeded', () => {
      simulateLocalStorageQuotaError(mockLocalStorage);
      const settings = SETTINGS_FIXTURES.global.valid();

      // Should not throw
      expect(() => settingsManager.saveGlobalSettings(settings)).not.toThrow();
    });
  });

  describe('Workspace Settings', () => {
    const workspaceId = 'test-workspace-123';

    it('should save workspace settings to metadata file', async () => {
      const settings = SETTINGS_FIXTURES.workspace.valid();

      await settingsManager.saveWorkspaceSettings(workspaceId, settings);

      expectWorkspaceSettingsSaved(mockFileStorage, workspaceId, settings);
    });

    it('should load workspace settings from metadata file', async () => {
      const stored = SETTINGS_FIXTURES.workspace.valid();
      mockWorkspaceSettingsReturn(mockFileStorage, stored);

      const loaded = await settingsManager.loadWorkspaceSettings(workspaceId);

      expect(mockFileStorage.readTextFile).toHaveBeenCalledWith(
        workspaceId,
        '.workspace-metadata.json'
      );
      expect(loaded).toEqual(stored);
    });

    it('should return defaults when metadata file not found', async () => {
      mockFileNotFound(mockFileStorage);

      const loaded = await settingsManager.loadWorkspaceSettings(workspaceId);
      const defaults = settingsManager.getDefaultWorkspaceSettings();

      expect(loaded).toEqual(defaults);
    });

    it('should handle corrupted metadata file', async () => {
      mockCorruptedJSON(mockFileStorage);

      const loaded = await settingsManager.loadWorkspaceSettings(workspaceId);
      const defaults = settingsManager.getDefaultWorkspaceSettings();

      expect(loaded).toEqual(defaults);
    });

    it('should handle file write errors gracefully', async () => {
      simulateFileWriteError(mockFileStorage);
      const settings = SETTINGS_FIXTURES.workspace.valid();

      await expect(settingsManager.saveWorkspaceSettings(workspaceId, settings)).rejects.toThrow(
        'Permission denied'
      );
    });

    it('should save advanced workspace settings', async () => {
      const settings = SETTINGS_FIXTURES.workspace.advanced();

      await settingsManager.saveWorkspaceSettings(workspaceId, settings);

      expectWorkspaceSettingsSaved(mockFileStorage, workspaceId, settings);
    });

    it('should save minimal workspace settings', async () => {
      const settings = SETTINGS_FIXTURES.workspace.minimal();

      await settingsManager.saveWorkspaceSettings(workspaceId, settings);

      expectWorkspaceSettingsSaved(mockFileStorage, workspaceId, settings);
    });
  });

  describe('EPUB Settings', () => {
    const workspaceId = 'test-workspace-456';

    it('should save EPUB settings to SOURCE directory', async () => {
      const settings = SETTINGS_FIXTURES.epub.valid();

      await settingsManager.saveEPUBSettings(workspaceId, settings);

      expectEPUBSettingsSaved(mockFileStorage, workspaceId, settings);
    });

    it('should load EPUB settings from SOURCE directory', async () => {
      const stored = SETTINGS_FIXTURES.epub.valid();
      mockEPUBSettingsReturn(mockFileStorage, stored);

      const loaded = await settingsManager.loadEPUBSettings(workspaceId);

      expect(mockFileStorage.readTextFile).toHaveBeenCalledWith(
        workspaceId,
        'SOURCE/settings.json'
      );
      expect(loaded).toEqual(stored);
    });

    it('should return defaults when settings file not found', async () => {
      mockFileNotFound(mockFileStorage);

      const loaded = await settingsManager.loadEPUBSettings(workspaceId);
      const defaults = settingsManager.getDefaultEPUBSettings();

      expect(loaded).toEqual(defaults);
    });

    it('should handle corrupted settings file', async () => {
      mockCorruptedJSON(mockFileStorage);

      const loaded = await settingsManager.loadEPUBSettings(workspaceId);
      const defaults = settingsManager.getDefaultEPUBSettings();

      expect(loaded).toEqual(defaults);
    });

    it('should save minimal EPUB settings', async () => {
      const settings = SETTINGS_FIXTURES.epub.minimal();

      await settingsManager.saveEPUBSettings(workspaceId, settings);

      expectEPUBSettingsSaved(mockFileStorage, workspaceId, settings);
    });

    it('should save EPUB settings with multiple transforms', async () => {
      const settings = SETTINGS_FIXTURES.epub.multiple_transforms();

      await settingsManager.saveEPUBSettings(workspaceId, settings);

      expectEPUBSettingsSaved(mockFileStorage, workspaceId, settings);
    });
  });

  describe('Draft Mode Utilities', () => {
    const workspaceId = 'draft-test-workspace';

    describe('generateDraftTitle', () => {
      it('should append draft ID to title', () => {
        expect(settingsManager.generateDraftTitle('My Book', 3)).toBe('My Book 3');
        expect(settingsManager.generateDraftTitle('Guide to Testing', 1)).toBe(
          'Guide to Testing 1'
        );
      });

      it('should handle titles with numbers', () => {
        expect(settingsManager.generateDraftTitle('Book 2020', 5)).toBe('Book 2020 5');
      });

      it('should handle empty titles', () => {
        expect(settingsManager.generateDraftTitle('', 1)).toBe(' 1');
      });

      it('should handle zero draft ID', () => {
        expect(settingsManager.generateDraftTitle('My Book', 0)).toBe('My Book 0');
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

        expect(settingsManager.extractDraftInfo('Title With Spaces 42')).toEqual({
          baseTitle: 'Title With Spaces',
          draftId: 42,
        });
      });

      it('should handle empty title', () => {
        expect(settingsManager.extractDraftInfo('')).toEqual({
          baseTitle: '',
          draftId: null,
        });
      });

      it('should handle title that is just a number', () => {
        expect(settingsManager.extractDraftInfo('123')).toEqual({
          baseTitle: '123',
          draftId: null,
        });
      });
    });

    describe('incrementDraftId', () => {
      it('should increment draft ID and save settings', async () => {
        const initialSettings = { ...SETTINGS_FIXTURES.workspace.valid(), draft_id: 5 };
        mockWorkspaceSettingsReturn(mockFileStorage, initialSettings);

        const newDraftId = await settingsManager.incrementDraftId(workspaceId);

        expect(newDraftId).toBe(6);
        expect(mockFileStorage.writeTextFile).toHaveBeenCalledWith(
          workspaceId,
          '.workspace-metadata.json',
          expect.stringContaining('"draft_id": 6')
        );
      });

      it('should start from 1 if no existing settings', async () => {
        mockFileNotFound(mockFileStorage);

        const newDraftId = await settingsManager.incrementDraftId(workspaceId);

        expect(newDraftId).toBe(1);
        expect(mockFileStorage.writeTextFile).toHaveBeenCalledWith(
          workspaceId,
          '.workspace-metadata.json',
          expect.stringContaining('"draft_id": 1')
        );
      });

      it('should handle workspace settings with undefined draft_id', async () => {
        const settingsWithoutDraftId = { bust_cache: false } as any;
        mockWorkspaceSettingsReturn(mockFileStorage, settingsWithoutDraftId);

        const newDraftId = await settingsManager.incrementDraftId(workspaceId);

        expect(newDraftId).toBe(1);
      });
    });
  });

  describe('Transform Management', () => {
    const workspaceId = 'transform-test-workspace';

    describe('getAvailableTransforms', () => {
      it('should return transforms from built-in scripts and extensions', async () => {
        // Mock built-in scripts
        mockDirectoryListing(mockFileStorage, ['transform.js', 'custom.js', 'readme.txt']);

        // Mock extensions
        mockExtensionManager.listWorkspaceExtensions.mockResolvedValue(
          EXTENSION_FIXTURES.multipleExtensions()
        );

        const transforms = await settingsManager.getAvailableTransforms(workspaceId);

        expect(transforms).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'SOURCE/scripts/transform.js',
              extensionName: 'built-in',
              fileName: 'transform.js',
            }),
            expect.objectContaining({
              path: 'SOURCE/scripts/custom.js',
              extensionName: 'built-in',
              fileName: 'custom.js',
            }),
            expect.objectContaining({
              path: 'SOURCE/extensions/markdown-it/transform.js',
              extensionName: 'markdown-it',
              fileName: 'transform.js',
            }),
            expect.objectContaining({
              path: 'SOURCE/extensions/highlight-js/highlight.min.js',
              extensionName: 'highlight-js',
              fileName: 'highlight.min.js',
            }),
          ])
        );

        // Should filter out non-JS files
        expect(transforms.find(t => t.fileName === 'readme.txt')).toBeUndefined();
      });

      it('should handle missing scripts directory', async () => {
        mockFileStorage.listFiles.mockRejectedValue(new Error('Directory not found'));
        mockExtensionManager.listWorkspaceExtensions.mockResolvedValue([]);

        const transforms = await settingsManager.getAvailableTransforms(workspaceId);

        expect(transforms).toEqual([]);
      });

      it('should handle extension discovery errors', async () => {
        mockDirectoryListing(mockFileStorage, ['transform.js']);
        mockExtensionManager.listWorkspaceExtensions.mockRejectedValue(
          new Error('Extension error')
        );

        const transforms = await settingsManager.getAvailableTransforms(workspaceId);

        expect(transforms).toEqual([
          expect.objectContaining({
            path: 'SOURCE/scripts/transform.js',
            extensionName: 'built-in',
            fileName: 'transform.js',
          }),
        ]);
      });

      it('should return empty array when no transforms found', async () => {
        mockDirectoryListing(mockFileStorage, []);
        mockExtensionManager.listWorkspaceExtensions.mockResolvedValue([]);

        const transforms = await settingsManager.getAvailableTransforms(workspaceId);

        expect(transforms).toEqual([]);
      });
    });

    describe('resolveTransformScripts', () => {
      it('should validate script paths exist', async () => {
        const settings = SETTINGS_FIXTURES.epub.valid();
        mockFileStorage.fileExists
          .mockResolvedValueOnce(true) // text_transform exists
          .mockResolvedValueOnce(true); // dom_transform exists

        const resolved = await settingsManager.resolveTransformScripts(workspaceId, settings);

        expect(resolved.textTransform).toBe(settings.text_transform);
        expect(resolved.domTransforms).toEqual(settings.dom_transforms);
      });

      it('should handle missing scripts gracefully', async () => {
        const settings = SETTINGS_FIXTURES.epub.valid();
        mockFileStorage.fileExists
          .mockResolvedValueOnce(false) // text_transform missing
          .mockResolvedValueOnce(true); // dom_transform exists

        const resolved = await settingsManager.resolveTransformScripts(workspaceId, settings);

        expect(resolved.textTransform).toBe(null);
        expect(resolved.domTransforms).toEqual(settings.dom_transforms);
      });

      it('should handle multiple DOM transforms', async () => {
        const settings = SETTINGS_FIXTURES.epub.multiple_transforms();
        mockFileStorage.fileExists
          .mockResolvedValueOnce(true) // text_transform exists
          .mockResolvedValueOnce(true) // first dom_transform exists
          .mockResolvedValueOnce(false); // second dom_transform missing

        const resolved = await settingsManager.resolveTransformScripts(workspaceId, settings);

        expect(resolved.textTransform).toBe(settings.text_transform);
        expect(resolved.domTransforms).toEqual([settings.dom_transforms[0]]);
      });

      it('should handle settings without transforms', async () => {
        const settings = { spine_basename: 'chapter' } as any; // No transform settings

        const resolved = await settingsManager.resolveTransformScripts(workspaceId, settings);

        expect(resolved.textTransform).toBe(null);
        expect(resolved.domTransforms).toEqual([]);
      });

      it('should handle file existence check errors', async () => {
        const settings = SETTINGS_FIXTURES.epub.valid();
        mockFileStorage.fileExists.mockRejectedValue(new Error('Access denied'));

        const resolved = await settingsManager.resolveTransformScripts(workspaceId, settings);

        expect(resolved.textTransform).toBe(null);
        expect(resolved.domTransforms).toEqual([]);
      });
    });
  });

  describe('Error Handling', () => {
    describe('File System Errors', () => {
      const workspaceId = 'error-test-workspace';

      it('should handle file read permission errors', async () => {
        simulateFileReadError(mockFileStorage);

        const loaded = await settingsManager.loadWorkspaceSettings(workspaceId);
        const defaults = settingsManager.getDefaultWorkspaceSettings();

        expect(loaded).toEqual(defaults);
      });

      it('should handle concurrent settings operations', async () => {
        const settings1 = SETTINGS_FIXTURES.workspace.valid();
        const settings2 = SETTINGS_FIXTURES.workspace.advanced();

        // Simulate concurrent saves
        await Promise.all([
          settingsManager.saveWorkspaceSettings(workspaceId, settings1),
          settingsManager.saveWorkspaceSettings(workspaceId, settings2),
        ]);

        // Both operations should complete (test that it doesn't crash)
        expect(mockFileStorage.writeTextFile).toHaveBeenCalledTimes(2);
      });
    });
  });
});
