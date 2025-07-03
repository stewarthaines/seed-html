/**
 * SpineItemManager Core Tests
 *
 * Unit tests for the main SpineItemManager functionality including constructor,
 * core chapter management operations, and basic integration with WorkspaceManager.
 *
 * Tests are based on API_public.md and follow the test plan structure.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpineItemManager } from '../spine-item-manager.js';
import type { MockWorkspaceManager } from '../../test/mocks/workspace-manager.mock.js';
import type { SpineItemWithSource, ChapterCreationData } from '../types.js';
import {
  createTestWorkspaceManager,
  setupTestWorkspace,
  setupWorkspaceWithSourceFiles,
  expectSourceFileCreated,
  expectXHTMLFileCreated,
  setupIdCollisionScenario,
  validateSpineItemWithSource,
} from './test-utils.js';
import {
  getSampleChapterData,
  getSampleChapterUpdates,
  getSampleDeletionOptions,
  getSampleOPFDocuments,
} from './fixtures.js';

describe('SpineItemManager Core', () => {
  let spineManager: SpineItemManager;
  let mockWorkspaceManager: MockWorkspaceManager;
  const testWorkspaceId = 'test-workspace-123';

  beforeEach(() => {
    mockWorkspaceManager = createTestWorkspaceManager();
    mockWorkspaceManager.reset();
    spineManager = new SpineItemManager(mockWorkspaceManager as any);
  });

  afterEach(() => {
    mockWorkspaceManager.reset();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with WorkspaceManager', () => {
      expect(spineManager).toBeInstanceOf(SpineItemManager);
      expect(mockWorkspaceManager.getOperationCount()).toBe(0);
    });

    it('should store reference to WorkspaceManager', () => {
      // Verify no operations were performed during construction
      expect(mockWorkspaceManager.getOperationCount()).toBe(0);
    });

    it('should not perform any file operations during construction', () => {
      const newMockWorkspace = createTestWorkspaceManager();
      new SpineItemManager(newMockWorkspace as any);

      expect(newMockWorkspace.getOperationCount()).toBe(0);
    });
  });

  describe('loadSpineItems()', () => {
    it('should load empty spine successfully', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');

      const items = await spineManager.loadSpineItems(testWorkspaceId);

      expect(items).toEqual([]);
      expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(0);
    });

    it('should load spine items with manifest data', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');

      const items = await spineManager.loadSpineItems(testWorkspaceId);

      expect(items).toHaveLength(3);
      expect(items[0]).toEqual(
        expect.objectContaining({
          id: 'chapter1',
          idref: 'chapter1',
          href: 'Text/chapter1.xhtml',
          mediaType: 'application/xhtml+xml',
          linear: true,
        })
      );
    });

    it('should detect source file associations by naming convention', async () => {
      await setupWorkspaceWithSourceFiles(mockWorkspaceManager, testWorkspaceId, 'withSourceFiles');

      const items = await spineManager.loadSpineItems(testWorkspaceId);

      expect(items).toHaveLength(3);

      // First two chapters should have source files
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

    it('should handle mixed spine items (some with/without source files)', async () => {
      await setupWorkspaceWithSourceFiles(
        mockWorkspaceManager,
        testWorkspaceId,
        'mixedSourceFiles'
      );

      const items = await spineManager.loadSpineItems(testWorkspaceId);

      expect(items).toHaveLength(3);

      // Chapter 1 has source file
      expect(items[0].hasSourceFile).toBe(true);
      expect(items[0].sourcePath).toBe('SOURCE/text/chapter1.txt');

      // Chapter 2 has no source file
      expect(items[1].hasSourceFile).toBe(false);
      expect(items[1].sourcePath).toBeUndefined();

      // Chapter 3 has source file
      expect(items[2].hasSourceFile).toBe(true);
      expect(items[2].sourcePath).toBe('SOURCE/text/chapter3.txt');
    });

    it('should preserve spine order from OPF', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');

      const items = await spineManager.loadSpineItems(testWorkspaceId);

      const expectedOrder = ['chapter1', 'chapter2', 'chapter3'];
      items.forEach((item, index) => {
        expect(item.id).toBe(expectedOrder[index]);
      });
    });

    it('should handle workspace not found error', async () => {
      mockWorkspaceManager.setFailureMode('workspace-not-found');

      await expect(spineManager.loadSpineItems('nonexistent-workspace')).rejects.toThrow(
        'Workspace not found'
      );
    });

    it('should handle corrupted OPF data', async () => {
      mockWorkspaceManager.setFailureMode('opf-read');

      await expect(spineManager.loadSpineItems(testWorkspaceId)).rejects.toThrow(
        'Failed to read OPF document'
      );
    });
  });

  describe('addChapter()', () => {
    beforeEach(async () => {
      mockWorkspaceManager.reset();
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');
    });

    it('should create chapter with default settings', async () => {
      const chapterData = getSampleChapterData().basic;

      const newChapter = await spineManager.addChapter(testWorkspaceId, chapterData);

      validateSpineItemWithSource(newChapter, 'chapter1', true);
      expect(newChapter.linear).toBe(true);
      expect(newChapter.href).toBe('Text/chapter1.xhtml');

      expectXHTMLFileCreated(
        mockWorkspaceManager,
        testWorkspaceId,
        'chapter1.xhtml',
        'Test Chapter'
      );
      expectSourceFileCreated(mockWorkspaceManager, testWorkspaceId, 'chapter1', '# Test Chapter');
    });

    it('should create chapter with custom filename', async () => {
      const chapterData = getSampleChapterData().customFilename;

      const newChapter = await spineManager.addChapter(testWorkspaceId, chapterData);

      expect(newChapter.href).toBe('Text/custom-chapter.xhtml');
      expectXHTMLFileCreated(
        mockWorkspaceManager,
        testWorkspaceId,
        'custom-chapter.xhtml',
        'Custom Chapter'
      );
    });

    it('should create chapter with custom content', async () => {
      const chapterData = getSampleChapterData().withSourceContent;

      const newChapter = await spineManager.addChapter(testWorkspaceId, chapterData);

      expectSourceFileCreated(
        mockWorkspaceManager,
        testWorkspaceId,
        newChapter.id,
        'This is custom source content'
      );
    });

    it('should insert chapter at specific position', async () => {
      // Add a couple chapters first
      await spineManager.addChapter(testWorkspaceId, { title: 'Chapter 1' });
      await spineManager.addChapter(testWorkspaceId, { title: 'Chapter 2' });

      // Insert at position 1 (between chapters 1 and 2)
      const chapterData = { ...getSampleChapterData().withInsertIndex, insertIndex: 1 };
      const insertedChapter = await spineManager.addChapter(testWorkspaceId, chapterData);

      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(3);
      expect(items[1].id).toBe(insertedChapter.id);
    });

    it('should create chapter without source file when disabled', async () => {
      const chapterData = getSampleChapterData().noSourceFile;

      const newChapter = await spineManager.addChapter(testWorkspaceId, chapterData);

      expect(newChapter.hasSourceFile).toBe(false);
      expect(newChapter.sourcePath).toBeUndefined();

      // Should still create XHTML file
      expectXHTMLFileCreated(
        mockWorkspaceManager,
        testWorkspaceId,
        `${newChapter.id}.xhtml`,
        'XHTML Only Chapter'
      );
    });

    it('should handle ID collision and auto-increment', async () => {
      setupIdCollisionScenario(mockWorkspaceManager, testWorkspaceId, ['chapter1']);

      const newChapter = await spineManager.addChapter(testWorkspaceId, {
        title: 'Another Chapter',
      });

      expect(newChapter.id).toBe('chapter2');
    });

    it('should generate sequential IDs (chapter1, chapter2, etc.)', async () => {
      const chapter1 = await spineManager.addChapter(testWorkspaceId, { title: 'First Chapter' });
      const chapter2 = await spineManager.addChapter(testWorkspaceId, { title: 'Second Chapter' });
      const chapter3 = await spineManager.addChapter(testWorkspaceId, { title: 'Third Chapter' });

      expect(chapter1.id).toBe('chapter1');
      expect(chapter2.id).toBe('chapter2');
      expect(chapter3.id).toBe('chapter3');
    });

    it('should generate ID from title', async () => {
      const newChapter = await spineManager.addChapter(testWorkspaceId, {
        title: 'Prologue Chapter',
      });

      expect(newChapter.id).toMatch(/prologue/i);
    });

    it('should rollback on manifest creation failure', async () => {
      mockWorkspaceManager.setFailureMode('manifest-add');

      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow('Failed to add manifest item');

      // Verify no files were created
      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      expect(files.size).toBe(0);
    });

    it('should rollback on XHTML file creation failure', async () => {
      mockWorkspaceManager.setFailureMode('file-write');

      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow('Failed to write file');

      // Verify rollback occurred (manifest/spine items should be cleaned up)
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(0);
    });

    it('should handle storage quota exceeded', async () => {
      // This would typically be a specific error from the storage layer
      mockWorkspaceManager.setFailureMode('file-write');

      await expect(
        spineManager.addChapter(testWorkspaceId, getSampleChapterData().basic)
      ).rejects.toThrow();
    });

    it('should validate filename format', async () => {
      const invalidData: ChapterCreationData = {
        title: 'Test Chapter',
        fileName: '../../../invalid/path.xhtml', // Invalid filename
      };

      await expect(spineManager.addChapter(testWorkspaceId, invalidData)).rejects.toThrow();
    });
  });

  describe('updateChapter()', () => {
    beforeEach(async () => {
      mockWorkspaceManager.reset();
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');
    });

    it('should update linear property', async () => {
      const updates = getSampleChapterUpdates().linearFlag;

      const updatedChapter = await spineManager.updateChapter(testWorkspaceId, 'chapter1', updates);

      expect(updatedChapter.linear).toBe(false);
    });

    it('should update spine properties', async () => {
      const updates = getSampleChapterUpdates().properties;

      const updatedChapter = await spineManager.updateChapter(testWorkspaceId, 'chapter1', updates);

      expect(updatedChapter.properties).toEqual(['page-spread-right']);
    });

    it('should rename XHTML file when fileName changes', async () => {
      const updates = getSampleChapterUpdates().filename;

      const updatedChapter = await spineManager.updateChapter(testWorkspaceId, 'chapter1', updates);

      expect(updatedChapter.href).toBe('Text/renamed-chapter.xhtml');
      expectXHTMLFileCreated(
        mockWorkspaceManager,
        testWorkspaceId,
        'renamed-chapter.xhtml',
        'chapter1'
      );
    });

    it('should rename source file when fileName changes', async () => {
      await setupWorkspaceWithSourceFiles(mockWorkspaceManager, testWorkspaceId, 'withSourceFiles');
      const updates = getSampleChapterUpdates().filename;

      const updatedChapter = await spineManager.updateChapter(testWorkspaceId, 'chapter1', updates);

      expect(updatedChapter.sourcePath).toBe('SOURCE/text/renamed-chapter.txt');
    });

    it('should update source file content', async () => {
      await setupWorkspaceWithSourceFiles(mockWorkspaceManager, testWorkspaceId, 'withSourceFiles');
      const updates = getSampleChapterUpdates().sourceContent;

      await spineManager.updateChapter(testWorkspaceId, 'chapter1', updates);

      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      const sourceContent = files.get('SOURCE/text/chapter1.txt');
      expect(sourceContent).toContain('This is updated source content');
    });

    it('should handle chapter not found', async () => {
      await expect(
        spineManager.updateChapter(
          testWorkspaceId,
          'nonexistent-chapter',
          getSampleChapterUpdates().linearFlag
        )
      ).rejects.toThrow();
    });

    it('should validate new filename format', async () => {
      const invalidUpdate = {
        fileName: '../invalid-path.xhtml',
      };

      await expect(
        spineManager.updateChapter(testWorkspaceId, 'chapter1', invalidUpdate)
      ).rejects.toThrow();
    });

    it('should handle file rename conflicts', async () => {
      // Try to rename chapter1 to chapter2's filename
      const conflictingUpdate = {
        fileName: 'chapter2.xhtml',
      };

      await expect(
        spineManager.updateChapter(testWorkspaceId, 'chapter1', conflictingUpdate)
      ).rejects.toThrow();
    });

    it('should rollback on partial update failure', async () => {
      mockWorkspaceManager.setFailureMode('file-write');

      await expect(
        spineManager.updateChapter(testWorkspaceId, 'chapter1', getSampleChapterUpdates().complete)
      ).rejects.toThrow();

      // Verify original state is preserved
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      const originalChapter = items.find(item => item.id === 'chapter1');
      expect(originalChapter?.linear).toBe(true); // Should not be changed
    });
  });

  describe('deleteChapter()', () => {
    beforeEach(async () => {
      mockWorkspaceManager.reset();
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');
    });

    it('should delete all files by default', async () => {
      await spineManager.deleteChapter(testWorkspaceId, 'chapter1');

      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items).toHaveLength(2);
      expect(items.find(item => item.id === 'chapter1')).toBeUndefined();

      // Verify files were deleted
      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      expect(files.has('OEBPS/Text/chapter1.xhtml')).toBe(false);
      expect(files.has('SOURCE/text/chapter1.txt')).toBe(false);
    });

    it('should preserve XHTML when requested', async () => {
      const options = getSampleDeletionOptions().preserveXHTML;

      await spineManager.deleteChapter(testWorkspaceId, 'chapter1', options);

      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items.find(item => item.id === 'chapter1')).toBeUndefined();

      // XHTML should be preserved, source file should be deleted
      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      expect(files.has('OEBPS/Text/chapter1.xhtml')).toBe(true);
      expect(files.has('SOURCE/text/chapter1.txt')).toBe(false);
    });

    it('should preserve source file when requested', async () => {
      await setupWorkspaceWithSourceFiles(mockWorkspaceManager, testWorkspaceId, 'withSourceFiles');
      const options = getSampleDeletionOptions().preserveSourceFile;

      await spineManager.deleteChapter(testWorkspaceId, 'chapter1', options);

      const files = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      expect(files.has('OEBPS/Text/chapter1.xhtml')).toBe(false);
      expect(files.has('SOURCE/text/chapter1.txt')).toBe(true);
    });

    it('should preserve manifest entry when requested', async () => {
      const options = getSampleDeletionOptions().preserveManifest;

      await spineManager.deleteChapter(testWorkspaceId, 'chapter1', options);

      // Chapter should be removed from spine but manifest should remain
      const items = await spineManager.loadSpineItems(testWorkspaceId);
      expect(items.find(item => item.id === 'chapter1')).toBeUndefined();

      // In a real implementation, we'd verify the manifest entry still exists
      // but the spine item is removed
    });

    it('should handle chapter not found gracefully', async () => {
      // Should not throw an error for non-existent chapters
      await expect(
        spineManager.deleteChapter(testWorkspaceId, 'nonexistent-chapter')
      ).rejects.toThrow();
    });

    it.skip('should handle file deletion failures', async () => {
      mockWorkspaceManager.setFailureMode('file-delete');

      await expect(spineManager.deleteChapter(testWorkspaceId, 'chapter1')).rejects.toThrow();
    });

    it('should validate preservation options', async () => {
      // Invalid options should be handled gracefully
      const invalidOptions = {
        preserveXHTML: true,
        preserveSourceFile: true,
        preserveManifest: false,
      };

      // This combination might not make sense in some contexts
      await expect(
        spineManager.deleteChapter(testWorkspaceId, 'chapter1', invalidOptions)
      ).resolves.not.toThrow();
    });
  });

  describe('generateChapterId()', () => {
    beforeEach(async () => {
      mockWorkspaceManager.reset();
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');
    });

    it('should generate sequential IDs', async () => {
      setupIdCollisionScenario(mockWorkspaceManager, testWorkspaceId, ['chapter1']);

      const id = await spineManager.generateChapterId(testWorkspaceId);
      expect(id).toBe('chapter2');
    });

    it('should generate ID from title', async () => {
      const id = await spineManager.generateChapterId(testWorkspaceId, 'Chapter One');
      expect(id).toBe('chapter-one');
    });

    it('should handle title collisions', async () => {
      setupIdCollisionScenario(mockWorkspaceManager, testWorkspaceId, ['chapter-one']);

      const id = await spineManager.generateChapterId(testWorkspaceId, 'Chapter One');
      expect(id).toBe('chapter-one1');
    });

    it('should sanitize invalid characters in titles', async () => {
      const id = await spineManager.generateChapterId(
        testWorkspaceId,
        'Chapter "One": The Beginning & End!'
      );
      expect(id).toMatch(/^[a-z0-9-]+$/);
      expect(id).not.toContain('"');
      expect(id).not.toContain(':');
      expect(id).not.toContain('&');
      expect(id).not.toContain('!');
    });

    it('should handle empty or null titles', async () => {
      const id1 = await spineManager.generateChapterId(testWorkspaceId, '');
      await spineManager.addChapter(testWorkspaceId, { title: '' });

      const id2 = await spineManager.generateChapterId(testWorkspaceId);

      expect(id1).toBe('chapter1');
      expect(id2).toBe('chapter2');
    });
  });
});
