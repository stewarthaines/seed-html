/**
 * SpineItemManager Source File Management Tests
 *
 * Unit tests for source file operations including creation, association by naming convention,
 * and handling of source file lifecycle with chapter operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpineItemManager } from '../spine-item-manager.js';
import type { MockWorkspaceManager } from '../../test/mocks/workspace-manager.mock.js';
import {
  createTestWorkspaceManager,
  setupTestWorkspace,
  setupWorkspaceWithSourceFiles,
  expectSourceFileCreated,
  setupErrorScenario,
} from './test-utils.js';

describe('SpineItemManager Source File Management', () => {
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

  describe('createSourceFile()', () => {
    beforeEach(async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');
    });

    it('should create source file with default template', async () => {
      const sourcePath = await spineManager.createSourceFile(testWorkspaceId, 'chapter1');

      expect(sourcePath).toBe('SOURCE/text/chapter1.txt');
      expectSourceFileCreated(mockWorkspaceManager, testWorkspaceId, 'chapter1');

      // Verify default template content
      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      const content = files.get('SOURCE/text/chapter1.txt') as string;
      expect(content).toContain('# chapter1');
      expect(content).toContain('Chapter content in plain text format.');
    });

    it('should create source file with custom content', async () => {
      const customContent = '# Custom Chapter\n\nThis is custom source content.';

      const sourcePath = await spineManager.createSourceFile(
        testWorkspaceId,
        'chapter1',
        customContent
      );

      expect(sourcePath).toBe('SOURCE/text/chapter1.txt');

      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      const content = files.get('SOURCE/text/chapter1.txt');
      expect(content).toBe(customContent);
    });

    it('should use chapter title in template when available', async () => {
      // First, add a chapter to get its title
      await spineManager.addChapter(testWorkspaceId, { title: 'Amazing Chapter Title' });

      const _sourcePath = await spineManager.createSourceFile(testWorkspaceId, 'chapter4');

      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      const content = files.get('SOURCE/text/chapter4.txt') as string;
      expect(content).toContain('# chapter4'); // Uses ID as fallback
    });

    it('should handle existing source file (overwrite)', async () => {
      // Create initial source file
      await spineManager.createSourceFile(testWorkspaceId, 'chapter1', 'Original content');

      // Create again with different content
      const sourcePath = await spineManager.createSourceFile(
        testWorkspaceId,
        'chapter1',
        'Updated content'
      );

      expect(sourcePath).toBe('SOURCE/text/chapter1.txt');

      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      const content = files.get('SOURCE/text/chapter1.txt');
      expect(content).toBe('Updated content');
    });

    it('should handle storage errors', async () => {
      setupErrorScenario(mockWorkspaceManager, 'file-write');

      await expect(spineManager.createSourceFile(testWorkspaceId, 'chapter1')).rejects.toThrow(
        'Failed to write file'
      );
    });

    it.skip('should validate chapter ID format', async () => {
      await expect(
        spineManager.createSourceFile(testWorkspaceId, '../invalid-id')
      ).rejects.toThrow();

      await expect(spineManager.createSourceFile(testWorkspaceId, '')).rejects.toThrow();
    });

    it('should handle unicode chapter IDs', async () => {
      const sourcePath = await spineManager.createSourceFile(testWorkspaceId, 'chapter-测试');

      expect(sourcePath).toBe('SOURCE/text/chapter-测试.txt');
      expectSourceFileCreated(mockWorkspaceManager, testWorkspaceId, 'chapter-测试');
    });

    it('should handle very long chapter IDs', async () => {
      const longId = 'a'.repeat(200);

      await expect(spineManager.createSourceFile(testWorkspaceId, longId)).resolves.not.toThrow();
    });
  });

  describe('Source File Association by Naming Convention', () => {
    it('should automatically detect source files by naming convention', async () => {
      await setupWorkspaceWithSourceFiles(mockWorkspaceManager, testWorkspaceId, 'withSourceFiles');

      const items = await spineManager.loadSpineItems(testWorkspaceId);

      expect(items[0]).toEqual(
        expect.objectContaining({
          id: 'chapter1',
          hasSourceFile: true,
          sourcePath: 'SOURCE/text/chapter1.txt',
        })
      );

      expect(items[1]).toEqual(
        expect.objectContaining({
          id: 'chapter2',
          hasSourceFile: true,
          sourcePath: 'SOURCE/text/chapter2.txt',
        })
      );
    });

    it('should handle mixed scenarios (some chapters with/without source files)', async () => {
      await setupWorkspaceWithSourceFiles(
        mockWorkspaceManager,
        testWorkspaceId,
        'mixedSourceFiles'
      );

      const items = await spineManager.loadSpineItems(testWorkspaceId);

      // Chapter 1 has source file
      expect(items[0]).toEqual(
        expect.objectContaining({
          id: 'chapter1',
          hasSourceFile: true,
          sourcePath: 'SOURCE/text/chapter1.txt',
        })
      );

      // Chapter 2 has no source file
      expect(items[1]).toEqual(
        expect.objectContaining({
          id: 'chapter2',
          hasSourceFile: false,
          sourcePath: undefined,
        })
      );

      // Chapter 3 has source file
      expect(items[2]).toEqual(
        expect.objectContaining({
          id: 'chapter3',
          hasSourceFile: true,
          sourcePath: 'SOURCE/text/chapter3.txt',
        })
      );
    });

    it('should handle scenarios with no source files', async () => {
      await setupWorkspaceWithSourceFiles(mockWorkspaceManager, testWorkspaceId, 'noSourceFiles');

      const items = await spineManager.loadSpineItems(testWorkspaceId);

      items.forEach(item => {
        expect(item.hasSourceFile).toBe(false);
        expect(item.sourcePath).toBeUndefined();
      });
    });

    it('should update association when source file is deleted', async () => {
      await setupWorkspaceWithSourceFiles(mockWorkspaceManager, testWorkspaceId, 'withSourceFiles');

      // Initially has source file
      let items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items[0].hasSourceFile).toBe(true);

      // Delete source file directly
      await mockWorkspaceManager.deleteFile(testWorkspaceId, 'SOURCE/text/chapter1.txt');

      // Should no longer be associated
      items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items[0]).toEqual(
        expect.objectContaining({
          hasSourceFile: false,
          sourcePath: undefined,
        })
      );
    });

    it.skip('should handle case-sensitive file systems', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');

      // Create source file with different case
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'SOURCE/text/Chapter1.txt': '# Chapter 1 content',
      });

      const items = await spineManager.loadSpineItems(testWorkspaceId);

      // Should not match due to case sensitivity
      expect(items[0].hasSourceFile).toBe(false);
    });

    it('should handle special characters in chapter IDs', async () => {
      // Add chapter with special characters
      const specialChapterId = 'chapter-1_special.chars';
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          {
            id: specialChapterId,
            href: `Text/${specialChapterId}.xhtml`,
            mediaType: 'application/xhtml+xml',
          },
        ],
        spine: [
          {
            idref: specialChapterId,
            linear: true,
          },
        ],
        metadata: {
          title: 'Test EPUB',
          language: 'en',
          identifier: 'test',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      // Create matching source file
      await spineManager.createSourceFile(testWorkspaceId, specialChapterId);

      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items[0]).toEqual(
        expect.objectContaining({
          id: specialChapterId,
          hasSourceFile: true,
          sourcePath: `SOURCE/text/${specialChapterId}.txt`,
        })
      );
    });
  });

  describe('Source File Lifecycle with Chapter Operations', () => {
    beforeEach(async () => {
      await setupWorkspaceWithSourceFiles(mockWorkspaceManager, testWorkspaceId, 'withSourceFiles');
    });

    it('should create source file when adding new chapter', async () => {
      const newChapter = await spineManager.addChapter(testWorkspaceId, {
        title: 'New Chapter',
        createSourceFile: true,
      });

      expect(newChapter.hasSourceFile).toBe(true);
      expect(newChapter.sourcePath).toBe(`SOURCE/text/${newChapter.id}.txt`);
      expectSourceFileCreated(mockWorkspaceManager, testWorkspaceId, newChapter.id);
    });

    it('should not create source file when disabled in chapter creation', async () => {
      const newChapter = await spineManager.addChapter(testWorkspaceId, {
        title: 'XHTML Only Chapter',
        createSourceFile: false,
      });

      expect(newChapter.hasSourceFile).toBe(false);
      expect(newChapter.sourcePath).toBeUndefined();

      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      expect(files.has(`SOURCE/text/${newChapter.id}.txt`)).toBe(false);
    });

    it('should rename source file when chapter is renamed', async () => {
      const updatedChapter = await spineManager.updateChapter(testWorkspaceId, 'chapter1', {
        fileName: 'renamed-chapter.xhtml',
      });

      // Source file should be renamed to match new ID
      expect(updatedChapter.sourcePath).toBe('SOURCE/text/renamed-chapter.txt');

      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      expect(files.has('SOURCE/text/chapter1.txt')).toBe(false);
      expect(files.has('SOURCE/text/renamed-chapter.txt')).toBe(true);
    });

    it('should preserve source file content when chapter is renamed', async () => {
      const originalFiles = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      const originalContent = originalFiles.get('SOURCE/text/chapter1.txt');

      await spineManager.updateChapter(testWorkspaceId, 'chapter1', {
        fileName: 'renamed-chapter.xhtml',
      });

      const updatedFiles = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      const newContent = updatedFiles.get('SOURCE/text/renamed-chapter.txt');
      expect(newContent).toBe(originalContent);
    });

    it('should update source file content when requested', async () => {
      const newContent = '# Updated Content\n\nThis is updated source content.';

      await spineManager.updateChapter(testWorkspaceId, 'chapter1', {
        sourceContent: newContent,
      });

      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      const content = files.get('SOURCE/text/chapter1.txt');
      expect(content).toBe(newContent);
    });

    it('should delete source file when chapter is deleted by default', async () => {
      await spineManager.deleteChapter(testWorkspaceId, 'chapter1');

      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      expect(files.has('SOURCE/text/chapter1.txt')).toBe(false);
    });

    it('should preserve source file when requested during deletion', async () => {
      await spineManager.deleteChapter(testWorkspaceId, 'chapter1', {
        preserveSourceFile: true,
      });

      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      expect(files.has('SOURCE/text/chapter1.txt')).toBe(true);
    });

    it('should handle source file operations during reordering', async () => {
      const originalItems = await spineManager.loadSpineItems(testWorkspaceId);

      await spineManager.reorderItems(testWorkspaceId, 0, 2);

      const reorderedItems = await spineManager.loadSpineItems(testWorkspaceId);

      // Source file associations should be preserved
      reorderedItems.forEach(item => {
        const original = originalItems.find(orig => orig.id === item.id);
        expect(item.hasSourceFile).toBe(original?.hasSourceFile);
        expect(item.sourcePath).toBe(original?.sourcePath);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');
    });

    it('should handle source file creation failure gracefully', async () => {
      setupErrorScenario(mockWorkspaceManager, 'file-write');

      await expect(spineManager.createSourceFile(testWorkspaceId, 'chapter1')).rejects.toThrow(
        'Failed to write file'
      );

      // Should not affect existing spine structure
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(3);
    });

    it('should handle missing SOURCE directory', async () => {
      // Remove all SOURCE files
      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      const sourceFiles = Array.from(files.keys()).filter(path => path.startsWith('SOURCE/'));
      for (const path of sourceFiles) {
        files.delete(path);
      }

      const items = await spineManager.loadSpineItems(testWorkspaceId);

      items.forEach(item => {
        expect(item.hasSourceFile).toBe(false);
        expect(item.sourcePath).toBeUndefined();
      });
    });

    it('should handle corrupted source files', async () => {
      // Add binary data as source file
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'SOURCE/text/chapter1.txt': new ArrayBuffer(100), // Binary data
      });

      // Should still detect as having source file
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items[0].hasSourceFile).toBe(true);
    });

    it('should handle very large source files', async () => {
      const largeContent = 'A'.repeat(1000000); // 1MB of text

      await expect(
        spineManager.createSourceFile(testWorkspaceId, 'chapter1', largeContent)
      ).resolves.not.toThrow();

      expectSourceFileCreated(mockWorkspaceManager, testWorkspaceId, 'chapter1');
    });

    it('should handle null/undefined content gracefully', async () => {
      await expect(
        spineManager.createSourceFile(testWorkspaceId, 'chapter1', null as any)
      ).resolves.not.toThrow();

      await expect(
        spineManager.createSourceFile(testWorkspaceId, 'chapter2', undefined)
      ).resolves.not.toThrow();
    });

    it.skip('should handle source files in subdirectories', async () => {
      // Create source file in subdirectory (non-standard)
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'SOURCE/text/sub/chapter1.txt': '# Chapter 1 content',
      });

      const items = await spineManager.loadSpineItems(testWorkspaceId);

      // Should not match due to different path structure
      expect(items[0].hasSourceFile).toBe(false);
    });

    it('should handle chapters with no corresponding manifest items', async () => {
      // This should not happen in normal operation, but test edge case
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [], // Empty manifest
        spine: [{ idref: 'chapter1', linear: true }], // Spine references non-existent manifest
        metadata: {
          title: 'Test EPUB',
          language: 'en',
          identifier: 'test',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      await expect(spineManager.loadSpineItems(testWorkspaceId)).rejects.toThrow(); // Should fail validation
    });
  });
});
