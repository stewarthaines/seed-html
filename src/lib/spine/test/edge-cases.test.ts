/**
 * SpineItemManager Edge Cases Tests
 *
 * Unit tests for boundary conditions, unusual inputs, and edge cases
 * that could occur in real-world usage of the SpineItemManager.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpineItemManager } from '../spine-item-manager.js';
import type { MockWorkspaceManager } from '../../test/mocks/workspace-manager.mock.js';
import {
  createTestWorkspaceManager,
  setupTestWorkspace,
  setupLargeSpine,
  measurePerformance,
} from './test-utils.js';
import { getEdgeCaseData, createLargeSpineData } from './fixtures.js';

describe('SpineItemManager Edge Cases', () => {
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

  describe('Empty and Minimal Workspaces', () => {
    it('should handle empty workspace', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');

      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toEqual([]);

      const validation = await spineManager.validateSpineOrder(testWorkspaceId);
      expect(validation.isValid).toBe(true);
      expect(validation.summary.totalItems).toBe(0);
    });

    it('should handle workspace with only manifest items (no spine)', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' },
          { id: 'chapter2', href: 'Text/chapter2.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spine: [], // Empty spine
        metadata: {
          title: 'Manifest Only EPUB',
          language: 'en',
          identifier: 'test-manifest-only',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toEqual([]);

      const validation = await spineManager.validateSpineOrder(testWorkspaceId);
      expect(validation.warnings.length).toBeGreaterThan(0); // Should warn about orphaned manifest items
    });

    it('should handle workspace with only spine items (no manifest)', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [], // Empty manifest
        spine: [
          { idref: 'chapter1', linear: true },
          { idref: 'chapter2', linear: true },
        ],
        metadata: {
          title: 'Spine Only EPUB',
          language: 'en',
          identifier: 'test-spine-only',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      const validation = await spineManager.validateSpineOrder(testWorkspaceId);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0); // Should error on missing manifest items
    });

    it('should handle single-item workspace', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [{ id: 'single', href: 'Text/single.xhtml', mediaType: 'application/xhtml+xml' }],
        spine: [{ idref: 'single', linear: true }],
        metadata: {
          title: 'Single Item EPUB',
          language: 'en',
          identifier: 'test-single',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(1);

      // Test single-item operations
      const reordered = await spineManager.reorderItems(testWorkspaceId, 0, 0);
      expect(reordered).toHaveLength(1);
      expect(reordered[0].id).toBe('single');

      const movedUp = await spineManager.moveChapterUp(testWorkspaceId, 0);
      expect(movedUp).toHaveLength(1);

      const movedDown = await spineManager.moveChapterDown(testWorkspaceId, 0);
      expect(movedDown).toHaveLength(1);
    });
  });

  describe('Special Character Handling', () => {
    it('should handle special characters in chapter titles', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');

      for (const title of getEdgeCaseData().specialCharacterTitles) {
        const chapterId = await spineManager.generateChapterId(testWorkspaceId, title);

        // Should generate valid ID
        expect(chapterId).toMatch(/^[a-z0-9-]+$/);
        expect(chapterId).not.toContain('"');
        expect(chapterId).not.toContain('&');
        expect(chapterId).not.toContain('<');
        expect(chapterId).not.toContain('>');

        // Should be able to create chapter
        const chapter = await spineManager.addChapter(testWorkspaceId, { title });
        expect(chapter.id).toBe(chapterId);
      }
    });

    it('should handle very long chapter titles', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');

      for (const longTitle of getEdgeCaseData().longTitles) {
        const chapterId = await spineManager.generateChapterId(testWorkspaceId, longTitle);

        // Should generate reasonable-length ID
        expect(chapterId.length).toBeLessThan(200);
        expect(chapterId).toMatch(/^[a-z0-9-]+$/);

        // Should be able to create chapter
        await expect(
          spineManager.addChapter(testWorkspaceId, { title: longTitle })
        ).resolves.not.toThrow();
      }
    });

    it('should handle Unicode characters in titles', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');

      for (const unicodeTitle of getEdgeCaseData().unicodeCharacters) {
        const chapterId = await spineManager.generateChapterId(testWorkspaceId, unicodeTitle);

        // Should handle gracefully (may transliterate or use fallback)
        expect(chapterId).toBeTruthy();
        expect(chapterId.length).toBeGreaterThan(0);

        const chapter = await spineManager.addChapter(testWorkspaceId, { title: unicodeTitle });
        expect(chapter.id).toBe(chapterId);
      }
    });

    it('should handle empty and whitespace-only titles', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');

      for (const emptyTitle of getEdgeCaseData().emptyAndNull) {
        const chapterId = await spineManager.generateChapterId(testWorkspaceId, emptyTitle);

        // Should generate fallback ID
        expect(chapterId).toMatch(/^chapter\d+$/);

        const chapter = await spineManager.addChapter(testWorkspaceId, {
          title: emptyTitle || 'Untitled',
        });
        expect(chapter.id).toBe(chapterId);
      }
    });

    it('should handle chapters with identical titles', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');

      const duplicateTitle = 'Chapter One';
      const ids = [];

      for (let i = 0; i < 5; i++) {
        const chapterId = await spineManager.generateChapterId(testWorkspaceId, duplicateTitle);
        ids.push(chapterId);

        await spineManager.addChapter(testWorkspaceId, { title: duplicateTitle });
      }

      // All IDs should be unique
      expect(new Set(ids).size).toBe(5);

      // Should follow collision resolution pattern
      expect(ids[0]).toBe('chapter-one');
      expect(ids[1]).toBe('chapter-one1');
      expect(ids[2]).toBe('chapter-one2');
      expect(ids[3]).toBe('chapter-one3');
      expect(ids[4]).toBe('chapter-one4');
    });
  });

  describe('Large-Scale Operations', () => {
    it('should handle maximum spine size (1000+ items)', async () => {
      setupLargeSpine(mockWorkspaceManager, testWorkspaceId, 1000);

      const { result: items, duration } = await measurePerformance(
        () => spineManager.loadSpineItems(testWorkspaceId),
        10000 // 10 second max
      );

      expect(items).toHaveLength(1000);
      expect(duration).toBeLessThan(10000);
    });

    it('should handle large spine reordering efficiently', async () => {
      setupLargeSpine(mockWorkspaceManager, testWorkspaceId, 500);

      const { duration } = await measurePerformance(
        () => spineManager.reorderItems(testWorkspaceId, 0, 499), // Move first to last
        5000 // 5 second max
      );

      expect(duration).toBeLessThan(5000);
    });

    it('should handle large spine validation efficiently', async () => {
      setupLargeSpine(mockWorkspaceManager, testWorkspaceId, 2000);

      const { result: validation, duration } = await measurePerformance(
        () => spineManager.validateSpineOrder(testWorkspaceId),
        15000 // 15 second max
      );

      expect(validation.isValid).toBe(true);
      expect(validation.summary.totalItems).toBe(2000);
      expect(duration).toBeLessThan(15000);
    });

    it('should handle bulk chapter creation', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');

      const bulkOperations = Array.from({ length: 100 }, (_, i) =>
        spineManager.addChapter(testWorkspaceId, { title: `Bulk Chapter ${i + 1}` })
      );

      const { duration } = await measurePerformance(
        () => Promise.all(bulkOperations),
        30000 // 30 second max
      );

      expect(duration).toBeLessThan(30000);

      // Verify all chapters were created
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(100);
    });

    it('should maintain performance with many source files', async () => {
      const { manifest, spine } = createLargeSpineData(200);
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest,
        spine,
        metadata: {
          title: 'Large EPUB with Sources',
          language: 'en',
          identifier: 'test-large-sources',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      // Add source files for all chapters
      const sourceFiles: Record<string, string> = {};
      for (let i = 1; i <= 200; i++) {
        sourceFiles[`SOURCE/text/chapter${i}.txt`] = `# Chapter ${i}\n\nContent for chapter ${i}.`;
      }
      mockWorkspaceManager.addTestFiles(testWorkspaceId, sourceFiles);

      const { result: items, duration } = await measurePerformance(
        () => spineManager.loadSpineItems(testWorkspaceId),
        5000 // 5 second max
      );

      expect(items).toHaveLength(200);
      expect(items.every(item => item.hasSourceFile)).toBe(true);
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Boundary Value Testing', () => {
    beforeEach(async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');
    });

    it('should handle boundary indices in reordering', async () => {
      // Test boundary values: 0, length-1, etc.
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      const maxIndex = items.length - 1;

      // Move first to last
      await spineManager.reorderItems(testWorkspaceId, 0, maxIndex);

      // Move last to first
      await spineManager.reorderItems(testWorkspaceId, maxIndex, 0);

      // No-op moves
      await spineManager.reorderItems(testWorkspaceId, 0, 0);
      await spineManager.reorderItems(testWorkspaceId, maxIndex, maxIndex);

      // All operations should complete successfully
      const finalItems = await spineManager.loadSpineItems(testWorkspaceId);
      expect(finalItems).toHaveLength(3);
    });

    it('should handle edge cases in chapter movement', async () => {
      // Move first chapter up (should wrap to end or stay in place)
      await spineManager.moveChapterUp(testWorkspaceId, 0);

      // Move last chapter down (should wrap to start or stay in place)
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      await spineManager.moveChapterDown(testWorkspaceId, items.length - 1);

      // Operations should complete without errors
      const finalItems = await spineManager.loadSpineItems(testWorkspaceId);
      expect(finalItems).toHaveLength(3);
    });

    it('should handle maximum string lengths', async () => {
      const maxLengthTitle = 'A'.repeat(65535); // Very long title

      await expect(
        spineManager.addChapter(testWorkspaceId, { title: maxLengthTitle })
      ).resolves.not.toThrow();

      const maxLengthContent = 'B'.repeat(1000000); // 1MB content

      await expect(
        spineManager.createSourceFile(testWorkspaceId, 'test-chapter', maxLengthContent)
      ).resolves.not.toThrow();
    });

    it('should handle numeric edge cases in indices', async () => {
      // Test with Number.MAX_SAFE_INTEGER
      await expect(
        spineManager.reorderItems(testWorkspaceId, 0, Number.MAX_SAFE_INTEGER)
      ).rejects.toThrow();

      // Test with negative numbers
      await expect(spineManager.reorderItems(testWorkspaceId, -1, 0)).rejects.toThrow();

      // Test with floating point numbers
      await expect(spineManager.reorderItems(testWorkspaceId, 1.5, 2)).rejects.toThrow();
    });
  });

  describe('Unusual File Structures', () => {
    it('should handle chapters with unusual filenames', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');

      const unusualFilenames = [
        'chapter-with-many-dashes.xhtml',
        'chapter_with_underscores.xhtml',
        'chapter.with.dots.xhtml',
        'chapter123numbers.xhtml',
        'UPPERCASE.xhtml',
        'mixedCaseFile.xhtml',
      ];

      for (const fileName of unusualFilenames) {
        await expect(
          spineManager.addChapter(testWorkspaceId, {
            title: `Chapter for ${fileName}`,
            fileName,
          })
        ).resolves.not.toThrow();
      }

      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(unusualFilenames.length);
    });

    it('should handle source files in non-standard locations', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spine: [{ idref: 'chapter1', linear: true }],
        metadata: {
          title: 'Non-standard Sources',
          language: 'en',
          identifier: 'test-nonstandard',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      // Add source files in various locations
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'SOURCE/chapter1.txt': '# Chapter 1', // Wrong location
        'SOURCE/texts/chapter1.txt': '# Chapter 1', // Wrong subdirectory
        'SOURCES/text/chapter1.txt': '# Chapter 1', // Wrong parent directory
        'SOURCE/text/Chapter1.txt': '# Chapter 1', // Wrong case
      });

      const items = await spineManager.loadSpineItems(testWorkspaceId);

      // Should not find any source files due to naming convention mismatch
      expect(items[0].hasSourceFile).toBe(false);

      // But creating in correct location should work
      await spineManager.createSourceFile(testWorkspaceId, 'chapter1');

      const updatedItems = await spineManager.loadSpineItems(testWorkspaceId);
      expect(updatedItems[0].hasSourceFile).toBe(true);
    });

    it('should handle deeply nested chapter structures', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          {
            id: 'part1-ch1',
            href: 'Text/Part1/Chapter1/content.xhtml',
            mediaType: 'application/xhtml+xml',
          },
          {
            id: 'part2-ch1',
            href: 'Text/Part2/Chapter1/content.xhtml',
            mediaType: 'application/xhtml+xml',
          },
        ],
        spine: [
          { idref: 'part1-ch1', linear: true },
          { idref: 'part2-ch1', linear: true },
        ],
        metadata: {
          title: 'Nested Structure EPUB',
          language: 'en',
          identifier: 'test-nested',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(2);

      // Should handle operations normally
      await spineManager.reorderItems(testWorkspaceId, 0, 1);
      await spineManager.createSourceFile(testWorkspaceId, 'part1-ch1');

      const validation = await spineManager.validateSpineOrder(testWorkspaceId);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('System Resource Edge Cases', () => {
    it.skip('should handle memory pressure with large operations', async () => {
      // Create large spine and perform memory-intensive operations
      setupLargeSpine(mockWorkspaceManager, testWorkspaceId, 10000);

      // Multiple concurrent operations
      const operations = [
        spineManager.loadSpineItems(testWorkspaceId),
        spineManager.validateSpineOrder(testWorkspaceId),
        spineManager.reorderItems(testWorkspaceId, 0, 9999),
      ];

      const results = await Promise.allSettled(operations);

      // At least some operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle rapid-fire operations', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');

      // Fire many operations in rapid succession
      const rapidOperations = [];
      for (let i = 0; i < 50; i++) {
        rapidOperations.push(spineManager.addChapter(testWorkspaceId, { title: `Rapid ${i}` }));
      }

      const results = await Promise.allSettled(rapidOperations);
      const successful = results.filter(r => r.status === 'fulfilled');

      // Most operations should succeed
      expect(successful.length).toBeGreaterThan(40);

      // Final state should be consistent
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items.length).toBe(successful.length);

      const validation = await spineManager.validateSpineOrder(testWorkspaceId);
      expect(validation.isValid).toBe(true);
    });

    it('should handle extremely frequent ID generation', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');

      // Generate thousands of IDs
      const generatedIds = new Set();

      for (let i = 0; i < 5000; i++) {
        const id = await spineManager.generateChapterId(testWorkspaceId, `Chapter ${i}`);
        generatedIds.add(id);

        // Simulate adding some chapters to create ID conflicts
        if (i % 100 === 0) {
          await spineManager.addChapter(testWorkspaceId, { title: `Chapter ${i}` });
        }
      }

      // All IDs should be unique
      expect(generatedIds.size).toBe(5000);
    });
  });

  describe('Concurrent Edge Cases', () => {
    beforeEach(async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');
    });

    it.skip('should handle simultaneous modifications of same chapter', async () => {
      const simultaneousUpdates = [
        spineManager.updateChapter(testWorkspaceId, 'chapter1', { linear: false }),
        spineManager.updateChapter(testWorkspaceId, 'chapter1', {
          properties: ['page-spread-left'],
        }),
        spineManager.updateChapter(testWorkspaceId, 'chapter1', {
          fileName: 'updated-chapter1.xhtml',
        }),
      ];

      const results = await Promise.allSettled(simultaneousUpdates);

      // At least one should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      // Final state should be consistent
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      const chapter1 = items.find(item => item.id === 'chapter1');
      expect(chapter1).toBeDefined();
    });

    it('should handle concurrent reordering operations', async () => {
      const concurrentReorders = [
        spineManager.reorderItems(testWorkspaceId, 0, 2),
        spineManager.reorderItems(testWorkspaceId, 1, 0),
        spineManager.moveChapterUp(testWorkspaceId, 2),
      ];

      const _results = await Promise.allSettled(concurrentReorders);

      // Final state should be consistent regardless of which succeeded
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(3);

      // No duplicate IDs
      const ids = items.map(item => item.id);
      expect(new Set(ids).size).toBe(3);

      const validation = await spineManager.validateSpineOrder(testWorkspaceId);
      expect(validation.isValid).toBe(true);
    });
  });
});
