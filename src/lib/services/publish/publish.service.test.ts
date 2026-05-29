/**
 * Publish Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PublishService } from './publish.service.js';
import { PUBLISH_WORKSPACE_ID } from '../../workspace/types.js';
import type { FileStorageAPI } from '../../storage/index.js';

function createMockFileStorage() {
  return {
    listFiles: vi.fn(),
    getFileInfo: vi.fn(),
    readFile: vi.fn(),
    deleteFile: vi.fn(),
  };
}

describe('PublishService', () => {
  let storage: ReturnType<typeof createMockFileStorage>;
  let service: PublishService;

  beforeEach(() => {
    storage = createMockFileStorage();
    service = new PublishService(storage as unknown as FileStorageAPI);
  });

  describe('listPublishedEpubs', () => {
    it('lists .epub files in the publish workspace with size and modified date', async () => {
      const modifiedA = new Date('2026-05-12T10:00:00Z');
      const modifiedB = new Date('2026-05-11T09:00:00Z');

      storage.listFiles.mockResolvedValue([
        'Book A - 2026-05-12.epub',
        'Book B - 2026-05-11.epub',
      ]);
      storage.getFileInfo.mockImplementation((_workspaceId: string, path: string) =>
        Promise.resolve(
          path.includes('Book A')
            ? { size: 166000, lastModified: modifiedA }
            : { size: 77000, lastModified: modifiedB }
        )
      );

      const result = await service.listPublishedEpubs();

      expect(storage.listFiles).toHaveBeenCalledWith(PUBLISH_WORKSPACE_ID);
      expect(result).toEqual([
        { filename: 'Book A - 2026-05-12.epub', size: 166000, lastModified: modifiedA },
        { filename: 'Book B - 2026-05-11.epub', size: 77000, lastModified: modifiedB },
      ]);
    });

    it('ignores non-epub files in the publish workspace', async () => {
      storage.listFiles.mockResolvedValue(['Book A.epub', '.DS_Store', 'notes.txt']);
      storage.getFileInfo.mockResolvedValue({ size: 100, lastModified: new Date('2026-05-12') });

      const result = await service.listPublishedEpubs();

      expect(result.map(e => e.filename)).toEqual(['Book A.epub']);
      expect(storage.getFileInfo).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPublishedEpubBlob', () => {
    it('reads the epub from the publish workspace as an epub Blob', async () => {
      const bytes = new TextEncoder().encode('epub-bytes').buffer;
      storage.readFile.mockResolvedValue(bytes);

      const blob = await service.getPublishedEpubBlob('Book A - 2026-05-12.epub');

      expect(storage.readFile).toHaveBeenCalledWith(
        PUBLISH_WORKSPACE_ID,
        'Book A - 2026-05-12.epub'
      );
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/epub+zip');
      expect(await blob.text()).toBe('epub-bytes');
    });
  });

  describe('deletePublishedEpub', () => {
    it('deletes the epub from the publish workspace', async () => {
      await service.deletePublishedEpub('Book A - 2026-05-12.epub');

      expect(storage.deleteFile).toHaveBeenCalledWith(
        PUBLISH_WORKSPACE_ID,
        'Book A - 2026-05-12.epub'
      );
    });
  });
});
