/**
 * Settings Validation Tests
 * 
 * Tests for validation logic in the Settings Manager.
 * These tests focus on the validation methods that should be pure functions.
 * 
 * Note: These tests are written to work with the actual SettingsManager implementation
 * when it becomes available. They are currently skipped until then.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SETTINGS_FIXTURES, VALIDATION_TEST_CASES } from './fixtures.js';
import { 
  createMockFileStorage, 
  createMockExtensionManager
} from './test-utils.js';

import { SettingsManager } from '../settings-manager.js';
import type { SettingsManager as ISettingsManager } from '../index.js';

describe('Settings Validation', () => {
  let settingsManager: ISettingsManager;
  let mockFileStorage: ReturnType<typeof createMockFileStorage>;
  let mockExtensionManager: ReturnType<typeof createMockExtensionManager>;

  beforeEach(() => {
    mockFileStorage = createMockFileStorage();
    mockExtensionManager = createMockExtensionManager();
    settingsManager = new SettingsManager(mockFileStorage as any, mockExtensionManager as any);
  });

  describe('validateGlobalSettings', () => {
    it.each(VALIDATION_TEST_CASES.globalSettings)(
      'should reject $name',
      ({ input, expectedErrors }) => {

        const result = settingsManager.validateGlobalSettings(input as any);
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

    it('should accept minimal valid global settings', () => {

      const minimal = SETTINGS_FIXTURES.global.minimal();
      const result = settingsManager.validateGlobalSettings(minimal);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept Hebrew locale settings', () => {

      const hebrew = SETTINGS_FIXTURES.global.hebrew();
      const result = settingsManager.validateGlobalSettings(hebrew);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept large font settings', () => {

      const largeFontSettings = SETTINGS_FIXTURES.global.large_font();
      const result = settingsManager.validateGlobalSettings(largeFontSettings);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial settings validation', () => {

      const partialSettings = { theme: 'dark' as const };
      const result = settingsManager.validateGlobalSettings(partialSettings);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty settings object', () => {

      const result = settingsManager.validateGlobalSettings({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateWorkspaceSettings', () => {
    it.each(VALIDATION_TEST_CASES.workspaceSettings)(
      'should reject $name',
      ({ input, expectedErrors }) => {

        const result = settingsManager.validateWorkspaceSettings(input as any);
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(expectedErrors);
      }
    );
    
    it('should accept valid workspace settings', () => {

      const valid = SETTINGS_FIXTURES.workspace.valid();
      const result = settingsManager.validateWorkspaceSettings(valid);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept advanced workspace settings', () => {

      const advanced = SETTINGS_FIXTURES.workspace.advanced();
      const result = settingsManager.validateWorkspaceSettings(advanced);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept minimal workspace settings', () => {

      const minimal = SETTINGS_FIXTURES.workspace.minimal();
      const result = settingsManager.validateWorkspaceSettings(minimal);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept high draft ID settings', () => {

      const highDraftId = SETTINGS_FIXTURES.workspace.high_draft_id();
      const result = settingsManager.validateWorkspaceSettings(highDraftId);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle settings without editor object', () => {

      const settingsWithoutEditor = { bust_cache: false, draft_id: 5 };
      const result = settingsManager.validateWorkspaceSettings(settingsWithoutEditor);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty editor object', () => {

      const settingsWithEmptyEditor = { 
        bust_cache: true, 
        draft_id: 1, 
        editor: {} as any
      };
      const result = settingsManager.validateWorkspaceSettings(settingsWithEmptyEditor);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateEPUBSettings', () => {
    it.each(VALIDATION_TEST_CASES.epubSettings)(
      'should reject $name',
      ({ input, expectedErrors }) => {

        const result = settingsManager.validateEPUBSettings(input as any);
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(expectedErrors);
      }
    );
    
    it('should accept valid EPUB settings', () => {

      const valid = SETTINGS_FIXTURES.epub.valid();
      const result = settingsManager.validateEPUBSettings(valid);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept minimal EPUB settings', () => {

      const minimal = SETTINGS_FIXTURES.epub.minimal();
      const result = settingsManager.validateEPUBSettings(minimal);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept multiple transforms settings', () => {

      const multipleTransforms = SETTINGS_FIXTURES.epub.multiple_transforms();
      const result = settingsManager.validateEPUBSettings(multipleTransforms);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle settings without cover object', () => {

      const settingsWithoutCover = {
        text_transform: 'SOURCE/scripts/transform.js',
        dom_transforms: [],
        spine_basename: 'chapter'
      };
      const result = settingsManager.validateEPUBSettings(settingsWithoutCover);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty dom_transforms array', () => {

      const settingsWithEmptyTransforms = {
        text_transform: 'SOURCE/scripts/transform.js',
        dom_transforms: [],
        spine_basename: 'section'
      };
      const result = settingsManager.validateEPUBSettings(settingsWithEmptyTransforms);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial cover settings', () => {

      const settingsWithPartialCover = {
        text_transform: 'SOURCE/scripts/transform.js',
        dom_transforms: [],
        spine_basename: 'chapter',
        cover: {
          template: 'minimal',
          background_color: '#ffffff'
          // Missing other cover properties
        } as any
      };
      const result = settingsManager.validateEPUBSettings(settingsWithPartialCover);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Validation Result Structure', () => {
    it('should always return SettingsValidation structure', () => {

      const result = settingsManager.validateGlobalSettings({});
      
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should set isValid to false when errors exist', () => {

      const result = settingsManager.validateGlobalSettings({ theme: 'invalid' } as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should set isValid to true when no errors exist', () => {

      const result = settingsManager.validateGlobalSettings({ theme: 'dark' as const });
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null input gracefully', () => {

      const globalResult = settingsManager.validateGlobalSettings(null as any);
      const workspaceResult = settingsManager.validateWorkspaceSettings(null as any);
      const epubResult = settingsManager.validateEPUBSettings(null as any);
      
      expect(globalResult).toHaveProperty('isValid');
      expect(workspaceResult).toHaveProperty('isValid');
      expect(epubResult).toHaveProperty('isValid');
    });

    it('should handle undefined input gracefully', () => {

      const globalResult = settingsManager.validateGlobalSettings(undefined as any);
      const workspaceResult = settingsManager.validateWorkspaceSettings(undefined as any);
      const epubResult = settingsManager.validateEPUBSettings(undefined as any);
      
      expect(globalResult).toHaveProperty('isValid');
      expect(workspaceResult).toHaveProperty('isValid');
      expect(epubResult).toHaveProperty('isValid');
    });

    it('should handle arrays as input gracefully', () => {

      expect(() => settingsManager.validateGlobalSettings([] as any)).not.toThrow();
      expect(() => settingsManager.validateWorkspaceSettings([] as any)).not.toThrow();
      expect(() => settingsManager.validateEPUBSettings([] as any)).not.toThrow();
    });

    it('should handle strings as input gracefully', () => {

      expect(() => settingsManager.validateGlobalSettings('invalid' as any)).not.toThrow();
      expect(() => settingsManager.validateWorkspaceSettings('invalid' as any)).not.toThrow();
      expect(() => settingsManager.validateEPUBSettings('invalid' as any)).not.toThrow();
    });
  });
});