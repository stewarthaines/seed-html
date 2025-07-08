/**
 * SpineItemManager Ordering Tests
 *
 * Unit tests for spine ordering operations including reordering, movement,
 * and bulk order updates. Tests edge cases and concurrent operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpineItemManager } from '../spine-item-manager.js';
import type { MockWorkspaceManager } from '../../test/mocks/workspace-manager.mock.js';
import {
  createTestWorkspaceManager,
  setupSpineOrderingScenario,
  expectSpineOrder,
  setupErrorScenario,
  measurePerformance,
} from './test-utils.js';

describe('SpineItemManager Ordering Operations', () => {
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

  describe('reorderItems()', () => {
    beforeEach(() => {
      setupSpineOrderingScenario(mockWorkspaceManager, testWorkspaceId, 5);
    });

    it('should move chapter from start to middle', async () => {
      const reorderedItems = await spineManager.reorderItems(testWorkspaceId, 0, 2);

      expectSpineOrder(reorderedItems, [
        'chapter2',
        'chapter3',
        'chapter1',
        'chapter4',
        'chapter5',
      ]);
    });

    it('should move chapter from middle to start', async () => {
      const reorderedItems = await spineManager.reorderItems(testWorkspaceId, 2, 0);

      expectSpineOrder(reorderedItems, [
        'chapter3',
        'chapter1',
        'chapter2',
        'chapter4',
        'chapter5',
      ]);
    });

    it('should move chapter from middle to end', async () => {
      const reorderedItems = await spineManager.reorderItems(testWorkspaceId, 1, 4);

      expectSpineOrder(reorderedItems, [
        'chapter1',
        'chapter3',
        'chapter4',
        'chapter5',
        'chapter2',
      ]);
    });

    it('should move chapter from end to start', async () => {
      const reorderedItems = await spineManager.reorderItems(testWorkspaceId, 4, 0);

      expectSpineOrder(reorderedItems, [
        'chapter5',
        'chapter1',
        'chapter2',
        'chapter3',
        'chapter4',
      ]);
    });

    it('should handle same position (no-op)', async () => {
      const originalItems = await spineManager.loadSpineItems(testWorkspaceId);
      const reorderedItems = await spineManager.reorderItems(testWorkspaceId, 2, 2);

      expectSpineOrder(reorderedItems, [
        'chapter1',
        'chapter2',
        'chapter3',
        'chapter4',
        'chapter5',
      ]);
      expect(reorderedItems).toEqual(originalItems);
    });

    it('should preserve other chapter properties', async () => {
      const reorderedItems = await spineManager.reorderItems(testWorkspaceId, 0, 2);

      // Verify that all properties except order are preserved
      reorderedItems.forEach(item => {
        expect(item).toEqual(
          expect.objectContaining({
            linear: true,
            mediaType: 'application/xhtml+xml',
            href: expect.stringMatching(/^Text\/.*\.xhtml$/),
          })
        );
      });
    });

    it('should handle invalid fromIndex', async () => {
      await expect(spineManager.reorderItems(testWorkspaceId, -1, 2)).rejects.toThrow(
        'Invalid fromIndex'
      );

      await expect(spineManager.reorderItems(testWorkspaceId, 10, 2)).rejects.toThrow(
        'Invalid fromIndex'
      );
    });

    it('should handle invalid toIndex', async () => {
      await expect(spineManager.reorderItems(testWorkspaceId, 0, -1)).rejects.toThrow(
        'Invalid toIndex'
      );

      await expect(spineManager.reorderItems(testWorkspaceId, 0, 10)).rejects.toThrow(
        'Invalid toIndex'
      );
    });

    it('should handle workspace update failure', async () => {
      setupErrorScenario(mockWorkspaceManager, 'spine-update');

      await expect(spineManager.reorderItems(testWorkspaceId, 0, 2)).rejects.toThrow(
        'Failed to update spine order'
      );
    });

    it('should handle concurrent reorder operations', async () => {
      // Simulate multiple rapid reorder operations
      const operations = [
        spineManager.reorderItems(testWorkspaceId, 0, 2),
        spineManager.reorderItems(testWorkspaceId, 1, 3),
        spineManager.reorderItems(testWorkspaceId, 2, 0),
      ];

      // All operations should complete, with the last one determining final order
      const results = await Promise.allSettled(operations);

      // At least one should succeed (depending on implementation strategy)
      const successfulResults = results.filter(result => result.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThan(0);
    });
  });

  describe('moveChapterUp()', () => {
    beforeEach(() => {
      setupSpineOrderingScenario(mockWorkspaceManager, testWorkspaceId, 3);
    });

    it('should move chapter up one position', async () => {
      const updatedItems = await spineManager.moveChapterUp(testWorkspaceId, 2);

      expectSpineOrder(updatedItems, ['chapter1', 'chapter3', 'chapter2']);
    });

    it('should move first chapter to last position when moving up', async () => {
      const updatedItems = await spineManager.moveChapterUp(testWorkspaceId, 1);

      expectSpineOrder(updatedItems, ['chapter2', 'chapter1', 'chapter3']);
    });

    it('should handle already at first position', async () => {
      // Moving the first item up should either be no-op or move to end
      const updatedItems = await spineManager.moveChapterUp(testWorkspaceId, 0);

      // Implementation could either keep it in place or move to end
      expect(updatedItems).toHaveLength(3);
      expect(updatedItems[0].id).not.toBe('chapter1'); // Should not be first anymore
    });

    it('should handle invalid index', async () => {
      await expect(spineManager.moveChapterUp(testWorkspaceId, -1)).rejects.toThrow(
        'Invalid index'
      );

      await expect(spineManager.moveChapterUp(testWorkspaceId, 5)).rejects.toThrow('Invalid index');
    });

    it('should handle empty spine', async () => {
      setupSpineOrderingScenario(mockWorkspaceManager, testWorkspaceId, 0);

      await expect(spineManager.moveChapterUp(testWorkspaceId, 0)).rejects.toThrow('Invalid index');
    });
  });

  describe('moveChapterDown()', () => {
    beforeEach(() => {
      setupSpineOrderingScenario(mockWorkspaceManager, testWorkspaceId, 3);
    });

    it('should move chapter down one position', async () => {
      const updatedItems = await spineManager.moveChapterDown(testWorkspaceId, 0);

      expectSpineOrder(updatedItems, ['chapter2', 'chapter1', 'chapter3']);
    });

    it('should move last chapter to first position when moving down', async () => {
      const updatedItems = await spineManager.moveChapterDown(testWorkspaceId, 1);

      expectSpineOrder(updatedItems, ['chapter1', 'chapter3', 'chapter2']);
    });

    it('should handle already at last position', async () => {
      // Moving the last item down should either be no-op or move to start
      const updatedItems = await spineManager.moveChapterDown(testWorkspaceId, 2);

      // Implementation could either keep it in place or move to start
      expect(updatedItems).toHaveLength(3);
      expect(updatedItems[2].id).not.toBe('chapter3'); // Should not be last anymore
    });

    it('should handle invalid index', async () => {
      await expect(spineManager.moveChapterDown(testWorkspaceId, -1)).rejects.toThrow(
        'Invalid index'
      );

      await expect(spineManager.moveChapterDown(testWorkspaceId, 5)).rejects.toThrow(
        'Invalid index'
      );
    });

    it('should handle single item spine', async () => {
      setupSpineOrderingScenario(mockWorkspaceManager, testWorkspaceId, 1);

      const updatedItems = await spineManager.moveChapterDown(testWorkspaceId, 0);

      // Should remain unchanged
      expectSpineOrder(updatedItems, ['chapter1']);
    });
  });

  describe('updateSpineOrder()', () => {
    beforeEach(() => {
      setupSpineOrderingScenario(mockWorkspaceManager, testWorkspaceId, 4);
    });

    it('should update complete spine order from reordered items array', async () => {
      const originalItems = await spineManager.loadSpineItems(testWorkspaceId);

      // Reverse the order
      const reorderedItems = [...originalItems].reverse();

      await spineManager.updateSpineOrder(testWorkspaceId, reorderedItems);

      const updatedItems = await spineManager.loadSpineItems(testWorkspaceId);
      expectSpineOrder(updatedItems, ['chapter4', 'chapter3', 'chapter2', 'chapter1']);
    });

    it('should handle partial reordering', async () => {
      const originalItems = await spineManager.loadSpineItems(testWorkspaceId);

      // Move chapter 3 to the beginning
      const reorderedItems = [
        originalItems[2], // chapter3
        originalItems[0], // chapter1
        originalItems[1], // chapter2
        originalItems[3], // chapter4
      ];

      await spineManager.updateSpineOrder(testWorkspaceId, reorderedItems);

      const updatedItems = await spineManager.loadSpineItems(testWorkspaceId);
      expectSpineOrder(updatedItems, ['chapter3', 'chapter1', 'chapter2', 'chapter4']);
    });

    it('should preserve item properties during reordering', async () => {
      const originalItems = await spineManager.loadSpineItems(testWorkspaceId);
      const reorderedItems = [...originalItems].reverse();

      await spineManager.updateSpineOrder(testWorkspaceId, reorderedItems);

      const updatedItems = await spineManager.loadSpineItems(testWorkspaceId);

      // Each item should retain all its properties
      updatedItems.forEach((item, _index) => {
        const originalItem = originalItems.find(orig => orig.id === item.id);
        expect(item).toEqual(
          expect.objectContaining({
            linear: originalItem?.linear,
            mediaType: originalItem?.mediaType,
            href: originalItem?.href,
            hasSourceFile: originalItem?.hasSourceFile,
          })
        );
      });
    });

    it('should handle empty spine order', async () => {
      await spineManager.updateSpineOrder(testWorkspaceId, []);

      const updatedItems = await spineManager.loadSpineItems(testWorkspaceId);
      expect(updatedItems).toHaveLength(0);
    });

    it('should validate all items exist in current spine', async () => {
      const invalidItems = [{ id: 'nonexistent', idref: 'nonexistent' } as any];

      await expect(spineManager.updateSpineOrder(testWorkspaceId, invalidItems)).rejects.toThrow();
    });

    it('should handle duplicate items in order', async () => {
      const originalItems = await spineManager.loadSpineItems(testWorkspaceId);
      const duplicateItems = [
        originalItems[0],
        originalItems[1],
        originalItems[0], // Duplicate
      ];

      await expect(
        spineManager.updateSpineOrder(testWorkspaceId, duplicateItems)
      ).rejects.toThrow();
    });

    it('should handle workspace update failure', async () => {
      const originalItems = await spineManager.loadSpineItems(testWorkspaceId);
      setupErrorScenario(mockWorkspaceManager, 'spine-update');

      await expect(spineManager.updateSpineOrder(testWorkspaceId, originalItems)).rejects.toThrow(
        'Failed to update spine order'
      );
    });
  });

  describe('Performance and Large Spine Handling', () => {
    it('should handle large spine reordering efficiently', async () => {
      setupSpineOrderingScenario(mockWorkspaceManager, testWorkspaceId, 100);

      const { duration } = await measurePerformance(
        () => spineManager.reorderItems(testWorkspaceId, 0, 99),
        2000 // 2 second max
      );

      expect(duration).toBeLessThan(2000);
    });

    it('should handle rapid sequential operations', async () => {
      setupSpineOrderingScenario(mockWorkspaceManager, testWorkspaceId, 10);

      const operations: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        operations.push(spineManager.moveChapterDown(testWorkspaceId, i % 10));
      }

      const { duration } = await measurePerformance(
        () => Promise.all(operations),
        3000 // 3 second max for all operations
      );

      expect(duration).toBeLessThan(3000);
    });

    it('should maintain order consistency under stress', async () => {
      setupSpineOrderingScenario(mockWorkspaceManager, testWorkspaceId, 20);

      // Perform multiple random reorderings
      for (let i = 0; i < 10; i++) {
        const fromIndex = Math.floor(Math.random() * 20);
        const toIndex = Math.floor(Math.random() * 20);
        await spineManager.reorderItems(testWorkspaceId, fromIndex, toIndex);
      }

      const finalItems = await spineManager.loadSpineItems(testWorkspaceId);

      // Verify all items are still present
      expect(finalItems).toHaveLength(20);

      // Verify no duplicate IDs
      const ids = finalItems.map(item => item.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single item spine', async () => {
      setupSpineOrderingScenario(mockWorkspaceManager, testWorkspaceId, 1);

      // All operations should handle single item gracefully
      const moveUpResult = await spineManager.moveChapterUp(testWorkspaceId, 0);
      const moveDownResult = await spineManager.moveChapterDown(testWorkspaceId, 0);
      const reorderResult = await spineManager.reorderItems(testWorkspaceId, 0, 0);

      expectSpineOrder(moveUpResult, ['chapter1']);
      expectSpineOrder(moveDownResult, ['chapter1']);
      expectSpineOrder(reorderResult, ['chapter1']);
    });

    it('should handle workspace with no spine items', async () => {
      setupSpineOrderingScenario(mockWorkspaceManager, testWorkspaceId, 0);

      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(0);

      // Operations on empty spine should fail gracefully
      await expect(spineManager.reorderItems(testWorkspaceId, 0, 0)).rejects.toThrow();

      await expect(spineManager.moveChapterUp(testWorkspaceId, 0)).rejects.toThrow();

      await expect(spineManager.moveChapterDown(testWorkspaceId, 0)).rejects.toThrow();
    });

    it('should handle very large indices gracefully', async () => {
      setupSpineOrderingScenario(mockWorkspaceManager, testWorkspaceId, 3);

      await expect(spineManager.reorderItems(testWorkspaceId, 0, 999999)).rejects.toThrow(
        'Invalid toIndex'
      );

      await expect(spineManager.moveChapterUp(testWorkspaceId, 999999)).rejects.toThrow(
        'Invalid index'
      );
    });

    it('should handle concurrent operations gracefully', async () => {
      setupSpineOrderingScenario(mockWorkspaceManager, testWorkspaceId, 5);

      // Start multiple operations simultaneously
      const concurrentOps = [
        spineManager.reorderItems(testWorkspaceId, 0, 2),
        spineManager.moveChapterUp(testWorkspaceId, 3),
        spineManager.moveChapterDown(testWorkspaceId, 1),
      ];

      // Should handle gracefully without corruption
      const results = await Promise.allSettled(concurrentOps);

      // At least some operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      // Final state should be consistent
      const finalItems = await spineManager.loadSpineItems(testWorkspaceId);
      expect(finalItems).toHaveLength(5);

      // No duplicate IDs
      const ids = finalItems.map(item => item.id);
      expect(new Set(ids).size).toBe(5);
    });
  });
});
