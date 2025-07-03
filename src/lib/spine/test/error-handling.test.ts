/**
 * SpineItemManager Error Handling Tests
 *
 * Unit tests for error scenarios, rollback behavior, atomic operations,
 * and recovery mechanisms in the SpineItemManager.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpineItemManager } from '../spine-item-manager.js';
import type { MockWorkspaceManager } from '../../test/mocks/workspace-manager.mock.js';
import {
  createTestWorkspaceManager,
  setupTestWorkspace,
  setupErrorScenario,
  clearErrorScenario,
} from './test-utils.js';
import { getSampleChapterData } from './fixtures.js';

describe('SpineItemManager Error Handling', () => {
  let spineManager: SpineItemManager;
  let mockWorkspaceManager: MockWorkspaceManager;
  const testWorkspaceId = 'test-workspace-123';

  beforeEach(() => {
    mockWorkspaceManager = createTestWorkspaceManager();
    spineManager = new SpineItemManager(mockWorkspaceManager as any);
  });

  afterEach(() => {
    mockWorkspaceManager.reset();
  });

  describe('WorkspaceManager Error Handling', () => {
    beforeEach(async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');
    });

    it('should handle workspace not found errors', async () => {
      setupErrorScenario(mockWorkspaceManager, 'workspace-not-found');

      await expect(spineManager.loadSpineItems('nonexistent-workspace')).rejects.toThrow(
        'Workspace not found'
      );

      await expect(
        spineManager.addChapter('nonexistent-workspace', getSampleChapterData().basic)
      ).rejects.toThrow('Workspace not found');

      await expect(spineManager.validateSpineOrder('nonexistent-workspace')).rejects.toThrow(
        'Workspace not found'
      );
    });

    it('should handle OPF read failures', async () => {
      setupErrorScenario(mockWorkspaceManager, 'opf-read');

      await expect(spineManager.loadSpineItems(testWorkspaceId)).rejects.toThrow(
        'Failed to read OPF document'
      );

      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow('Failed to read OPF document');
    });

    it('should handle manifest operation failures', async () => {
      setupErrorScenario(mockWorkspaceManager, 'manifest-add');

      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow('Failed to add manifest item');

      // Verify no partial state was created
      clearErrorScenario(mockWorkspaceManager);
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(3); // Original items only
    });

    it('should handle spine operation failures', async () => {
      setupErrorScenario(mockWorkspaceManager, 'spine-add');

      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow('Failed to add spine item');

      // Verify rollback occurred
      clearErrorScenario(mockWorkspaceManager);
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(3); // Original items only
    });

    it('should handle file write failures', async () => {
      setupErrorScenario(mockWorkspaceManager, 'file-write');

      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow('Failed to write file');

      // Verify rollback occurred
      clearErrorScenario(mockWorkspaceManager);
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(3); // Original items only
    });

    it.skip('should handle file read failures', async () => {
      setupErrorScenario(mockWorkspaceManager, 'file-read');

      await expect(spineManager.loadSpineItems(testWorkspaceId)).rejects.toThrow(
        'Failed to read file'
      );
    });

    it.skip('should handle file delete failures', async () => {
      setupErrorScenario(mockWorkspaceManager, 'file-delete');

      await expect(spineManager.deleteChapter(testWorkspaceId, 'chapter1')).rejects.toThrow(
        'Failed to delete file'
      );

      // Verify chapter is still present
      clearErrorScenario(mockWorkspaceManager);
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items.find(item => item.id === 'chapter1')).toBeDefined();
    });

    it('should handle spine update failures during reordering', async () => {
      setupErrorScenario(mockWorkspaceManager, 'spine-update');

      await expect(spineManager.reorderItems(testWorkspaceId, 0, 2)).rejects.toThrow(
        'Failed to update spine order'
      );

      // Verify original order is preserved
      clearErrorScenario(mockWorkspaceManager);
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items[0].id).toBe('chapter1');
      expect(items[1].id).toBe('chapter2');
      expect(items[2].id).toBe('chapter3');
    });
  });

  describe('Atomic Operation Rollback', () => {
    beforeEach(async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');
    });

    it('should rollback on manifest creation failure', async () => {
      setupErrorScenario(mockWorkspaceManager, 'manifest-add');

      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow();

      // Verify no files were created
      clearErrorScenario(mockWorkspaceManager);
      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      const xhtmlFiles = Array.from(files.keys()).filter(path => path.endsWith('.xhtml'));
      const sourceFiles = Array.from(files.keys()).filter(path => path.startsWith('SOURCE/'));

      expect(xhtmlFiles).toHaveLength(0);
      expect(sourceFiles).toHaveLength(0);
    });

    it('should rollback on spine creation failure', async () => {
      // Allow manifest creation to succeed, but fail spine creation
      let manifestAdded = false;
      const originalAddManifest = mockWorkspaceManager.addManifestItem;
      mockWorkspaceManager.addManifestItem = async (...args) => {
        if (!manifestAdded) {
          manifestAdded = true;
          await originalAddManifest.apply(mockWorkspaceManager, args);
          setupErrorScenario(mockWorkspaceManager, 'spine-add');
        }
        return originalAddManifest.apply(mockWorkspaceManager, args);
      };

      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow();

      // Verify manifest item was rolled back
      clearErrorScenario(mockWorkspaceManager);
      const opf = await mockWorkspaceManager.getWorkspaceOPF(testWorkspaceId);
      expect(opf.manifest).toHaveLength(0);
    });

    it('should rollback on XHTML file creation failure', async () => {
      // Allow manifest and spine creation to succeed, but fail file creation
      let operationsCompleted = 0;
      const originalWriteFile = mockWorkspaceManager.writeFile;
      mockWorkspaceManager.writeFile = async (...args) => {
        operationsCompleted++;
        if (operationsCompleted === 1 && args[1].includes('.xhtml')) {
          setupErrorScenario(mockWorkspaceManager, 'file-write');
        }
        return originalWriteFile.apply(mockWorkspaceManager, args);
      };

      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow();

      // Verify complete rollback
      clearErrorScenario(mockWorkspaceManager);
      const opf = await mockWorkspaceManager.getWorkspaceOPF(testWorkspaceId);
      expect(opf.manifest).toHaveLength(0);
      expect(opf.spine).toHaveLength(0);
    });

    it('should rollback on source file creation failure', async () => {
      // Allow XHTML creation to succeed, but fail source file creation
      let xhtmlCreated = false;
      const originalWriteFile = mockWorkspaceManager.writeFile;
      mockWorkspaceManager.writeFile = async (...args) => {
        if (args[1].includes('.xhtml')) {
          xhtmlCreated = true;
          await originalWriteFile.apply(mockWorkspaceManager, args);
        } else if (args[1].includes('SOURCE/') && xhtmlCreated) {
          setupErrorScenario(mockWorkspaceManager, 'file-write');
        }
        return originalWriteFile.apply(mockWorkspaceManager, args);
      };

      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow();

      // Verify complete rollback including XHTML file
      clearErrorScenario(mockWorkspaceManager);
      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      expect(files.size).toBe(0);
    });

    it('should handle partial update rollback', async () => {
      // First add a chapter successfully
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');

      // Then fail during update
      setupErrorScenario(mockWorkspaceManager, 'file-write');

      await expect(
        spineManager.updateChapter(testWorkspaceId, 'chapter1', {
          fileName: 'updated-chapter.xhtml',
          sourceContent: 'Updated content',
        })
      ).rejects.toThrow();

      // Verify original state is preserved
      clearErrorScenario(mockWorkspaceManager);
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      const chapter1 = items.find(item => item.id === 'chapter1');
      expect(chapter1?.href).toBe('Text/chapter1.xhtml'); // Original filename
    });

    it('should handle reorder operation rollback', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');
      const originalOrder = ['chapter1', 'chapter2', 'chapter3'];

      setupErrorScenario(mockWorkspaceManager, 'spine-update');

      await expect(spineManager.reorderItems(testWorkspaceId, 0, 2)).rejects.toThrow();

      // Verify original order is preserved
      clearErrorScenario(mockWorkspaceManager);
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      items.forEach((item, index) => {
        expect(item.id).toBe(originalOrder[index]);
      });
    });
  });

  describe('Concurrent Operation Errors', () => {
    beforeEach(async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');
    });

    it('should handle concurrent modification errors', async () => {
      // Simulate concurrent operations on the same workspace
      const operations = [
        spineManager.addChapter(testWorkspaceId, { title: 'Chapter A' }),
        spineManager.addChapter(testWorkspaceId, { title: 'Chapter B' }),
        spineManager.reorderItems(testWorkspaceId, 0, 2),
      ];

      const results = await Promise.allSettled(operations);

      // Some operations may fail due to conflicts
      const successful = results.filter(r => r.status === 'fulfilled');
      const _failed = results.filter(r => r.status === 'rejected');

      // At least one should succeed
      expect(successful.length).toBeGreaterThan(0);

      // Final state should be consistent
      const finalItems = await spineManager.loadSpineItems(testWorkspaceId);
      expect(finalItems.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle rapid sequential operations with failures', async () => {
      const operations = [];

      // Queue multiple operations rapidly
      for (let i = 0; i < 5; i++) {
        if (i === 2) {
          // Inject failure in the middle
          setupErrorScenario(mockWorkspaceManager, 'manifest-add');
        }
        operations.push(
          spineManager
            .addChapter(testWorkspaceId, { title: `Chapter ${i}` })
            .catch(error => ({ error }))
        );
        if (i === 2) {
          clearErrorScenario(mockWorkspaceManager);
        }
      }

      await Promise.all(operations);

      // Verify final state is consistent
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items.length).toBeGreaterThanOrEqual(3); // At least original items

      // No duplicate IDs
      const ids = items.map(item => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('Data Validation Errors', () => {
    beforeEach(async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');
    });

    it('should handle invalid chapter data', async () => {
      const invalidData = {
        title: '', // Empty title
        fileName: '../../../invalid/path.xhtml', // Invalid path
        linear: 'yes' as any, // Wrong type
        properties: 'invalid' as any, // Wrong type
        insertIndex: -1, // Invalid index
        sourceContent: null as any, // Invalid content
      };

      await expect(spineManager.addChapter(testWorkspaceId, invalidData)).rejects.toThrow();

      // Verify no partial state was created
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(3); // Original items only
    });

    it('should handle invalid update data', async () => {
      const invalidUpdates = {
        fileName: '../../../malicious/path.xhtml',
        linear: 'maybe' as any,
        properties: { invalid: 'object' } as any,
      };

      await expect(
        spineManager.updateChapter(testWorkspaceId, 'chapter1', invalidUpdates)
      ).rejects.toThrow();

      // Verify original chapter is unchanged
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      const chapter1 = items.find(item => item.id === 'chapter1');
      expect(chapter1?.linear).toBe(true); // Original value
    });

    it('should handle invalid reorder indices', async () => {
      await expect(spineManager.reorderItems(testWorkspaceId, -1, 2)).rejects.toThrow(
        'Invalid fromIndex'
      );

      await expect(spineManager.reorderItems(testWorkspaceId, 0, -1)).rejects.toThrow(
        'Invalid toIndex'
      );

      await expect(spineManager.reorderItems(testWorkspaceId, 10, 2)).rejects.toThrow(
        'Invalid fromIndex'
      );

      await expect(spineManager.reorderItems(testWorkspaceId, 0, 10)).rejects.toThrow(
        'Invalid toIndex'
      );

      // Verify original order is preserved
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items[0].id).toBe('chapter1');
      expect(items[1].id).toBe('chapter2');
      expect(items[2].id).toBe('chapter3');
    });

    it('should handle operations on non-existent chapters', async () => {
      await expect(
        spineManager.updateChapter(testWorkspaceId, 'nonexistent', { linear: false })
      ).rejects.toThrow();

      await expect(spineManager.deleteChapter(testWorkspaceId, 'nonexistent')).rejects.toThrow();

      // Verify original state is unchanged
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(3);
    });
  });

  describe('Resource Constraint Errors', () => {
    beforeEach(async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');
    });

    it('should handle storage quota exceeded', async () => {
      // Simulate storage quota exceeded by failing file writes
      setupErrorScenario(mockWorkspaceManager, 'file-write');

      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow();

      // Verify no partial state remains
      clearErrorScenario(mockWorkspaceManager);
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(3);
    });

    it('should handle very large content gracefully', async () => {
      const largeContent = 'A'.repeat(10000000); // 10MB content

      // This might fail due to size limits
      await expect(
        spineManager.addChapter(testWorkspaceId, {
          title: 'Large Chapter',
          sourceContent: largeContent,
        })
      ).resolves.not.toThrow(); // Should handle gracefully
    });

    it('should handle many concurrent operations', async () => {
      const manyOperations = Array.from({ length: 100 }, (_, i) =>
        spineManager
          .addChapter(testWorkspaceId, { title: `Chapter ${i}` })
          .catch(error => ({ error }))
      );

      await Promise.all(manyOperations);

      // Final state should be consistent regardless of failures
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items.length).toBeGreaterThanOrEqual(3);

      // Validate no corruption
      const validation = await spineManager.validateSpineOrder(testWorkspaceId);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Error Recovery and Cleanup', () => {
    beforeEach(async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');
    });

    it('should provide meaningful error messages', async () => {
      setupErrorScenario(mockWorkspaceManager, 'manifest-add');

      try {
        await spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBeTruthy();
        expect(error.message.length).toBeGreaterThan(5);
        expect(error.message).not.toContain('undefined');
        expect(error.message).not.toContain('null');
      }
    });

    it('should preserve error context in error objects', async () => {
      setupErrorScenario(mockWorkspaceManager, 'workspace-not-found');

      try {
        await spineManager.loadSpineItems('nonexistent');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Workspace not found');
        // Could also check for error codes, workspace ID, etc.
      }
    });

    it('should allow recovery after errors', async () => {
      // Cause an error
      setupErrorScenario(mockWorkspaceManager, 'manifest-add');

      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow();

      // Clear error and try again
      clearErrorScenario(mockWorkspaceManager);

      const newChapter = await spineManager.addChapter(
        testWorkspaceId,
        getSampleChapterData().basic
      );
      expect(newChapter).toBeDefined();
      expect(newChapter.id).toBeTruthy();

      // Verify state is consistent
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(4);
    });

    it('should clean up partial state after multiple failures', async () => {
      // Cause multiple failures in sequence
      const errors = ['manifest-add', 'spine-add', 'file-write'] as const;

      for (const errorType of errors) {
        setupErrorScenario(mockWorkspaceManager, errorType);

        await expect(
          spineManager.addChapter(testWorkspaceId, {
            title: `Chapter ${errorType}`,
          })
        ).rejects.toThrow();

        clearErrorScenario(mockWorkspaceManager);
      }

      // Verify clean state
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(3); // Only original items

      const validation = await spineManager.validateSpineOrder(testWorkspaceId);
      expect(validation.isValid).toBe(true);
    });

    it('should handle error during error cleanup', async () => {
      // This tests a very edge case where cleanup itself fails
      let cleanupAttempted = false;
      const originalRemoveManifest = mockWorkspaceManager.removeManifestItem;

      mockWorkspaceManager.removeManifestItem = async (...args) => {
        if (cleanupAttempted) {
          throw new Error('Cleanup failed');
        }
        return originalRemoveManifest.apply(mockWorkspaceManager, args);
      };

      // Cause primary operation to fail after manifest is added
      let manifestAdded = false;
      const originalAddManifest = mockWorkspaceManager.addManifestItem;
      mockWorkspaceManager.addManifestItem = async (...args) => {
        await originalAddManifest.apply(mockWorkspaceManager, args);
        manifestAdded = true;
        if (manifestAdded) {
          cleanupAttempted = true;
          setupErrorScenario(mockWorkspaceManager, 'spine-add');
        }
      };

      // Should still throw the original error, not the cleanup error
      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow('Failed to add spine item');
    });
  });
});
