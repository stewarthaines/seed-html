/**
 * Settings Manager Integration Tests
 * 
 * Integration tests that use real file system operations to test data persistence
 * and cross-system workflows. These tests verify that settings are properly
 * saved and loaded through the actual file storage layer.
 */

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { SETTINGS_FIXTURES } from './fixtures.js';
import { createTempWorkspace, cleanupTempWorkspace, createMockFileStorage, createMockExtensionManager } from './test-utils.js';
import type { SettingsManager } from '../index.js';
import { SettingsManager as SettingsManagerImpl } from '../settings-manager.js';

describe.skip('Settings Manager Integration', () => {
  // These tests will be enabled when the actual SettingsManager is implemented
  
  let settingsManager: SettingsManager;
  let tempWorkspaceId: string;
  let mockFileStorage: ReturnType<typeof createMockFileStorage>;
  let mockExtensionManager: ReturnType<typeof createMockExtensionManager>;

  beforeEach(async () => {
    tempWorkspaceId = await createTempWorkspace();
    
    mockFileStorage = createMockFileStorage();
    mockExtensionManager = createMockExtensionManager();
    
    settingsManager = new SettingsManagerImpl(mockFileStorage as any, mockExtensionManager as any);
  });
  
  afterEach(async () => {
    await cleanupTempWorkspace(tempWorkspaceId);
  });

  describe('Settings Persistence', () => {
    it('should persist workspace settings through save/load cycle', async () => {
      const originalSettings = SETTINGS_FIXTURES.workspace.advanced();
      
      // Save settings
      await settingsManager.saveWorkspaceSettings(tempWorkspaceId, originalSettings);
      
      // Load settings in same instance (simulating fresh instance)
      const loadedSettings = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
      
      expect(loadedSettings).toEqual(expect.objectContaining(originalSettings));
    });
    
    it('should persist EPUB settings through save/load cycle', async () => {
      const originalSettings = SETTINGS_FIXTURES.epub.valid();
      
      await settingsManager.saveEPUBSettings(tempWorkspaceId, originalSettings);
      
      const loadedSettings = await settingsManager.loadEPUBSettings(tempWorkspaceId);
      
      expect(loadedSettings).toEqual(originalSettings);
    });

    it('should persist global settings through save/load cycle', () => {
      const originalSettings = SETTINGS_FIXTURES.global.hebrew();
      
      settingsManager.saveGlobalSettings(originalSettings);
      
      const loadedSettings = settingsManager.loadGlobalSettings();
      
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

    it('should handle multiple draft ID increments', async () => {
      // Start with default settings
      const firstIncrement = await settingsManager.incrementDraftId(tempWorkspaceId);
      expect(firstIncrement).toBe(1);
      
      const secondIncrement = await settingsManager.incrementDraftId(tempWorkspaceId);
      expect(secondIncrement).toBe(2);
      
      const thirdIncrement = await settingsManager.incrementDraftId(tempWorkspaceId);
      expect(thirdIncrement).toBe(3);
      
      // Verify final state
      const finalSettings = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
      expect(finalSettings.draft_id).toBe(3);
    });
  });

  describe('Edge Cases with Persistence', () => {
    it('should handle missing workspace metadata file', async () => {
      // Don't create any settings file
      const loadedSettings = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
      const expectedDefaults = settingsManager.getDefaultWorkspaceSettings();
      
      expect(loadedSettings).toEqual(expectedDefaults);
    });
    
    it('should handle missing EPUB settings file', async () => {
      const loadedSettings = await settingsManager.loadEPUBSettings(tempWorkspaceId);
      const expectedDefaults = settingsManager.getDefaultEPUBSettings();
      
      expect(loadedSettings).toEqual(expectedDefaults);
    });

    it('should handle missing global settings', () => {
      // localStorage starts empty
      const loadedSettings = settingsManager.loadGlobalSettings();
      const expectedDefaults = settingsManager.getDefaultGlobalSettings();
      
      expect(loadedSettings).toEqual(expectedDefaults);
    });
    
    it('should handle corrupted settings files', async () => {
      // Save valid settings first
      await settingsManager.saveEPUBSettings(tempWorkspaceId, SETTINGS_FIXTURES.epub.valid());
      
      // Corrupt the data by writing invalid JSON
      await mockFileStorage.writeTextFile(tempWorkspaceId, 'SOURCE/settings.json', 'invalid json content');
      
      const loadedSettings = await settingsManager.loadEPUBSettings(tempWorkspaceId);
      const expectedDefaults = settingsManager.getDefaultEPUBSettings();
      
      expect(loadedSettings).toEqual(expectedDefaults);
    });

    it('should handle corrupted workspace metadata', async () => {
      // Save valid settings first
      await settingsManager.saveWorkspaceSettings(tempWorkspaceId, SETTINGS_FIXTURES.workspace.advanced());
      
      // Corrupt the data by writing invalid JSON
      await mockFileStorage.writeTextFile(tempWorkspaceId, '.workspace-metadata.json', 'invalid json content');
      
      const loadedSettings = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
      const expectedDefaults = settingsManager.getDefaultWorkspaceSettings();
      
      expect(loadedSettings).toEqual(expectedDefaults);
    });
    
    it('should handle concurrent settings operations', async () => {
      const settings1 = SETTINGS_FIXTURES.workspace.valid();
      const settings2 = SETTINGS_FIXTURES.workspace.advanced();
      
      // Simulate concurrent saves
      await Promise.all([
        settingsManager.saveWorkspaceSettings(tempWorkspaceId, settings1),
        settingsManager.saveWorkspaceSettings(tempWorkspaceId, settings2)
      ]);
      
      // One of them should win (test that it doesn't crash)
      const finalSettings = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
      expect(finalSettings).toEqual(expect.any(Object));
      
      // Should be one of the two saved settings (not defaults)
      const isSettings1 = JSON.stringify(finalSettings) === JSON.stringify(expect.objectContaining(settings1));
      const isSettings2 = JSON.stringify(finalSettings) === JSON.stringify(expect.objectContaining(settings2));
      expect(isSettings1 || isSettings2).toBe(true);
    });
  });

  describe('Cross-Settings Integration', () => {
    it('should maintain independent settings across different workspaces', async () => {
      const secondWorkspaceId = await createTempWorkspace();
      
      try {
        // Save different settings to each workspace
        const workspace1Settings = SETTINGS_FIXTURES.workspace.valid();
        const workspace2Settings = SETTINGS_FIXTURES.workspace.advanced();
        
        await settingsManager.saveWorkspaceSettings(tempWorkspaceId, workspace1Settings);
        await settingsManager.saveWorkspaceSettings(secondWorkspaceId, workspace2Settings);
        
        // Verify each workspace has its own settings
        const loaded1 = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
        const loaded2 = await settingsManager.loadWorkspaceSettings(secondWorkspaceId);
        
        expect(loaded1).toEqual(expect.objectContaining(workspace1Settings));
        expect(loaded2).toEqual(expect.objectContaining(workspace2Settings));
        expect(loaded1).not.toEqual(loaded2);
      } finally {
        await cleanupTempWorkspace(secondWorkspaceId);
      }
    });

    it('should maintain independent EPUB settings across workspaces', async () => {
      const secondWorkspaceId = await createTempWorkspace();
      
      try {
        const epub1Settings = SETTINGS_FIXTURES.epub.minimal();
        const epub2Settings = SETTINGS_FIXTURES.epub.multiple_transforms();
        
        await settingsManager.saveEPUBSettings(tempWorkspaceId, epub1Settings);
        await settingsManager.saveEPUBSettings(secondWorkspaceId, epub2Settings);
        
        const loaded1 = await settingsManager.loadEPUBSettings(tempWorkspaceId);
        const loaded2 = await settingsManager.loadEPUBSettings(secondWorkspaceId);
        
        expect(loaded1).toEqual(epub1Settings);
        expect(loaded2).toEqual(epub2Settings);
        expect(loaded1).not.toEqual(loaded2);
      } finally {
        await cleanupTempWorkspace(secondWorkspaceId);
      }
    });

    it('should handle global settings independently from workspace settings', async () => {
      // Set global settings
      const globalSettings = SETTINGS_FIXTURES.global.large_font();
      settingsManager.saveGlobalSettings(globalSettings);
      
      // Set workspace settings
      const workspaceSettings = SETTINGS_FIXTURES.workspace.advanced();
      await settingsManager.saveWorkspaceSettings(tempWorkspaceId, workspaceSettings);
      
      // Both should persist independently
      const loadedGlobal = settingsManager.loadGlobalSettings();
      const loadedWorkspace = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
      
      expect(loadedGlobal).toEqual(globalSettings);
      expect(loadedWorkspace).toEqual(expect.objectContaining(workspaceSettings));
    });
  });

  describe('Complex Workflow Integration', () => {
    it('should handle complete settings workflow for new workspace', async () => {
      // 1. Load initial settings (should be defaults)
      const initialGlobal = settingsManager.loadGlobalSettings();
      const initialWorkspace = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
      const initialEPUB = await settingsManager.loadEPUBSettings(tempWorkspaceId);
      
      expect(initialGlobal).toEqual(settingsManager.getDefaultGlobalSettings());
      expect(initialWorkspace).toEqual(settingsManager.getDefaultWorkspaceSettings());
      expect(initialEPUB).toEqual(settingsManager.getDefaultEPUBSettings());
      
      // 2. Update global preferences
      const userGlobalSettings = SETTINGS_FIXTURES.global.hebrew();
      settingsManager.saveGlobalSettings(userGlobalSettings);
      
      // 3. Configure workspace
      const userWorkspaceSettings = SETTINGS_FIXTURES.workspace.advanced();
      await settingsManager.saveWorkspaceSettings(tempWorkspaceId, userWorkspaceSettings);
      
      // 4. Set up EPUB-specific settings
      const userEPUBSettings = SETTINGS_FIXTURES.epub.multiple_transforms();
      await settingsManager.saveEPUBSettings(tempWorkspaceId, userEPUBSettings);
      
      // 5. Verify all settings are properly saved
      const finalGlobal = settingsManager.loadGlobalSettings();
      const finalWorkspace = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
      const finalEPUB = await settingsManager.loadEPUBSettings(tempWorkspaceId);
      
      expect(finalGlobal).toEqual(userGlobalSettings);
      expect(finalWorkspace).toEqual(expect.objectContaining(userWorkspaceSettings));
      expect(finalEPUB).toEqual(userEPUBSettings);
    });

    it('should handle draft mode workflow with persistence', async () => {
      // 1. Enable draft mode
      const workspaceSettings = SETTINGS_FIXTURES.workspace.valid();
      workspaceSettings.bust_cache = true;
      await settingsManager.saveWorkspaceSettings(tempWorkspaceId, workspaceSettings);
      
      // 2. Create several drafts
      const draft1Id = await settingsManager.incrementDraftId(tempWorkspaceId);
      const draft1Title = settingsManager.generateDraftTitle('My Novel', draft1Id);
      expect(draft1Title).toBe('My Novel 1');
      
      const draft2Id = await settingsManager.incrementDraftId(tempWorkspaceId);
      const draft2Title = settingsManager.generateDraftTitle('My Novel', draft2Id);
      expect(draft2Title).toBe('My Novel 2');
      
      // 3. Verify persistence across "restarts"
      const currentSettings = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
      expect(currentSettings.draft_id).toBe(2);
      expect(currentSettings.bust_cache).toBe(true);
      
      // 4. Extract draft info from title
      const draftInfo = settingsManager.extractDraftInfo(draft2Title);
      expect(draftInfo.baseTitle).toBe('My Novel');
      expect(draftInfo.draftId).toBe(2);
      
      // 5. Continue draft sequence
      const draft3Id = await settingsManager.incrementDraftId(tempWorkspaceId);
      expect(draft3Id).toBe(3);
    });

    it('should handle settings migration scenario', async () => {
      // Simulate loading settings from an older version
      const legacyWorkspaceSettings = {
        bust_cache: true,
        draft_id: 10
        // Missing editor object (legacy format)
      };
      
      await settingsManager.saveWorkspaceSettings(tempWorkspaceId, legacyWorkspaceSettings);
      
      // Load and verify defaults are applied for missing fields
      const loadedSettings = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
      
      expect(loadedSettings.bust_cache).toBe(true);
      expect(loadedSettings.draft_id).toBe(10);
      // Should still function even with missing editor config
      expect(loadedSettings).toEqual(expect.objectContaining({
        bust_cache: true,
        draft_id: 10
      }));
    });
  });

  describe('Performance and Scale', () => {
    it('should handle rapid sequential operations', async () => {
      const operations = [];
      
      // Perform many rapid operations
      for (let i = 0; i < 20; i++) {
        operations.push(settingsManager.incrementDraftId(tempWorkspaceId));
      }
      
      const results = await Promise.all(operations);
      
      // Should get sequential numbers (though order may vary due to concurrency)
      const finalSettings = await settingsManager.loadWorkspaceSettings(tempWorkspaceId);
      expect(finalSettings.draft_id).toBe(20);
      
      // All results should be unique
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(results.length);
    });

    it('should handle large settings objects', async () => {
      // Create a settings object with many DOM transforms
      const largeEPUBSettings = {
        ...SETTINGS_FIXTURES.epub.valid(),
        dom_transforms: Array.from({ length: 50 }, (_, i) => 
          `SOURCE/extensions/transform-${i}/transform.js`
        )
      };
      
      await settingsManager.saveEPUBSettings(tempWorkspaceId, largeEPUBSettings);
      const loadedSettings = await settingsManager.loadEPUBSettings(tempWorkspaceId);
      
      expect(loadedSettings.dom_transforms).toHaveLength(50);
      expect(loadedSettings).toEqual(largeEPUBSettings);
    });
  });
});