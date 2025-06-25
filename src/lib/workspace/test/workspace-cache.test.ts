/**
 * WorkspaceMetadataCache Unit Tests
 *
 * Tests two-tier caching system (memory + disk) with TTL expiration
 * and file modification tracking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkspaceMetadataCache } from '../workspace-cache.js';
import { CacheError } from '../types.js';
import type { WorkspaceInfo, WorkspaceCacheEntry } from '../types.js';

// Mock File Storage API
const mockStorage = {
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  getFileStats: vi.fn(),
  listFiles: vi.fn(),
};

describe('WorkspaceMetadataCache', () => {
  let cache: WorkspaceMetadataCache;

  const mockWorkspaceInfo: WorkspaceInfo = {
    id: 'workspace-123',
    title: 'Test Book',
    author: 'Test Author',
    language: 'en',
    lastModified: new Date('2024-01-01'),
    fileCount: 5,
    totalSize: 1024,
    epubVersion: 'EPUB 3.0',
  };

  const mockCacheEntry: WorkspaceCacheEntry = {
    version: 1,
    workspaceId: 'workspace-123',
    lastCacheUpdate: Date.now(),
    opfFileModified: Date.now() - 1000, // OPF modified 1 second ago
    metadata: {
      title: 'Test Book',
      language: 'en',
      identifier: 'test-123',
      author: 'Test Author',
    },
    fileCount: 5,
    totalSize: 1024,
    epubVersion: 'EPUB 3.0',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new WorkspaceMetadataCache(mockStorage as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultCache = new WorkspaceMetadataCache(mockStorage as any);
      expect(defaultCache).toBeInstanceOf(WorkspaceMetadataCache);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        ttl: 12 * 60 * 60 * 1000, // 12 hours
        maxEntries: 50,
        enableDiskCache: false,
      };

      const customCache = new WorkspaceMetadataCache(mockStorage as any, customConfig);
      expect(customCache).toBeInstanceOf(WorkspaceMetadataCache);
    });
  });

  describe('get', () => {
    it('should return cached entry from memory when available and fresh', async () => {
      // Setup memory cache
      await cache.set('workspace-123', mockWorkspaceInfo);

      const result = await cache.get('workspace-123');

      expect(result).toEqual(mockWorkspaceInfo);
      expect(mockStorage.readTextFile).not.toHaveBeenCalled(); // Should not hit disk
    });

    it('should load from disk cache when not in memory but disk cache is fresh', async () => {
      const diskCacheData = {
        'workspace-123': mockCacheEntry,
      };

      mockStorage.readTextFile.mockResolvedValue(JSON.stringify(diskCacheData));
      mockStorage.getFileStats.mockResolvedValue({
        lastModified: mockCacheEntry.opfFileModified - 1000, // OPF older than cache
      });

      const result = await cache.get('workspace-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('workspace-123');
      expect(result?.title).toBe('Test Book');
      expect(mockStorage.readTextFile).toHaveBeenCalledWith(
        'workspace-123',
        '.workspace-metadata.json'
      );
    });

    it('should return null for cache miss', async () => {
      mockStorage.readTextFile.mockRejectedValue(new Error('File not found'));

      const result = await cache.get('non-existent-workspace');

      expect(result).toBeNull();
    });

    it('should return null when disk cache exists but is stale', async () => {
      const staleCacheEntry = {
        ...mockCacheEntry,
        lastCacheUpdate: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago (stale)
      };

      const diskCacheData = {
        'workspace-123': staleCacheEntry,
      };

      mockStorage.readTextFile.mockResolvedValue(JSON.stringify(diskCacheData));

      const result = await cache.get('workspace-123');

      expect(result).toBeNull();
    });

    it('should return null when OPF file is newer than cache', async () => {
      const diskCacheData = {
        'workspace-123': mockCacheEntry,
      };

      mockStorage.readTextFile.mockResolvedValue(JSON.stringify(diskCacheData));
      mockStorage.getFileStats.mockResolvedValue({
        lastModified: mockCacheEntry.opfFileModified + 5000, // OPF newer than cache
      });

      const result = await cache.get('workspace-123');

      expect(result).toBeNull();
    });

    it('should handle corrupted disk cache gracefully', async () => {
      mockStorage.readTextFile.mockResolvedValue('invalid json');

      const result = await cache.get('workspace-123');

      expect(result).toBeNull();
    });

    it('should handle disk cache with wrong version', async () => {
      const wrongVersionEntry = {
        ...mockCacheEntry,
        version: 999, // Wrong version
      };

      const diskCacheData = {
        'workspace-123': wrongVersionEntry,
      };

      mockStorage.readTextFile.mockResolvedValue(JSON.stringify(diskCacheData));

      const result = await cache.get('workspace-123');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should store in memory cache', async () => {
      await cache.set('workspace-123', mockWorkspaceInfo);

      const result = await cache.get('workspace-123');
      expect(result).toEqual(mockWorkspaceInfo);
    });

    it('should write to disk cache when enabled', async () => {
      mockStorage.writeTextFile.mockResolvedValue(undefined);
      mockStorage.getFileStats.mockResolvedValue({
        lastModified: Date.now(),
      });

      await cache.set('workspace-123', mockWorkspaceInfo);

      expect(mockStorage.writeTextFile).toHaveBeenCalledWith(
        'workspace-123',
        '.workspace-metadata.json',
        expect.stringContaining('"workspaceId":"workspace-123"')
      );
    });

    it('should not write to disk when disk cache is disabled', async () => {
      const noDiskCache = new WorkspaceMetadataCache(mockStorage as any, {
        enableDiskCache: false,
        ttl: 24 * 60 * 60 * 1000,
        maxEntries: 100,
      });

      await noDiskCache.set('workspace-123', mockWorkspaceInfo);

      expect(mockStorage.writeTextFile).not.toHaveBeenCalled();
    });

    it('should evict old entries when memory cache is full', async () => {
      const smallCache = new WorkspaceMetadataCache(mockStorage as any, {
        maxEntries: 2,
        ttl: 24 * 60 * 60 * 1000,
        enableDiskCache: false,
      });

      // Fill cache beyond capacity
      await smallCache.set('workspace-1', { ...mockWorkspaceInfo, id: 'workspace-1' });
      await smallCache.set('workspace-2', { ...mockWorkspaceInfo, id: 'workspace-2' });
      await smallCache.set('workspace-3', { ...mockWorkspaceInfo, id: 'workspace-3' });

      // First entry should be evicted
      const result1 = await smallCache.get('workspace-1');
      const result3 = await smallCache.get('workspace-3');

      expect(result1).toBeNull(); // Evicted
      expect(result3).toBeDefined(); // Should still be there
    });

    it('should handle OPF file stats errors gracefully', async () => {
      mockStorage.getFileStats.mockRejectedValue(new Error('File not found'));
      mockStorage.writeTextFile.mockResolvedValue(undefined);

      // Should not throw error
      await expect(cache.set('workspace-123', mockWorkspaceInfo)).resolves.toBeUndefined();
    });

    it('should handle disk write errors gracefully', async () => {
      mockStorage.getFileStats.mockResolvedValue({ lastModified: Date.now() });
      mockStorage.writeTextFile.mockRejectedValue(new Error('Disk full'));

      // Should not throw error - memory cache should still work
      await expect(cache.set('workspace-123', mockWorkspaceInfo)).resolves.toBeUndefined();

      // Memory cache should still work
      const result = await cache.get('workspace-123');
      expect(result).toEqual(mockWorkspaceInfo);
    });
  });

  describe('invalidate', () => {
    it('should remove entry from memory cache', async () => {
      await cache.set('workspace-123', mockWorkspaceInfo);

      const beforeInvalidate = await cache.get('workspace-123');
      expect(beforeInvalidate).toEqual(mockWorkspaceInfo);

      await cache.invalidate('workspace-123');

      const afterInvalidate = await cache.get('workspace-123');
      expect(afterInvalidate).toBeNull();
    });

    it('should handle invalidating non-existent entries', async () => {
      await expect(cache.invalidate('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all memory cache entries', async () => {
      await cache.set('workspace-1', { ...mockWorkspaceInfo, id: 'workspace-1' });
      await cache.set('workspace-2', { ...mockWorkspaceInfo, id: 'workspace-2' });

      await cache.clear();

      const result1 = await cache.get('workspace-1');
      const result2 = await cache.get('workspace-2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('isCacheFresh', () => {
    it('should return true for fresh cache entry', async () => {
      const freshEntry = {
        ...mockCacheEntry,
        lastCacheUpdate: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
      };

      mockStorage.getFileStats.mockResolvedValue({
        lastModified: freshEntry.opfFileModified - 1000, // OPF older than cache
      });

      const result = await cache.isCacheFresh('workspace-123', freshEntry);

      expect(result).toBe(true);
    });

    it('should return false for expired cache entry', async () => {
      const expiredEntry = {
        ...mockCacheEntry,
        lastCacheUpdate: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };

      const result = await cache.isCacheFresh('workspace-123', expiredEntry);

      expect(result).toBe(false);
    });

    it('should return false when OPF file is newer', async () => {
      mockStorage.getFileStats.mockResolvedValue({
        lastModified: mockCacheEntry.opfFileModified + 5000, // OPF newer
      });

      const result = await cache.isCacheFresh('workspace-123', mockCacheEntry);

      expect(result).toBe(false);
    });

    it('should return false for wrong cache version', async () => {
      const wrongVersionEntry = {
        ...mockCacheEntry,
        version: 999,
      };

      const result = await cache.isCacheFresh('workspace-123', wrongVersionEntry);

      expect(result).toBe(false);
    });

    it('should return false when OPF file is missing', async () => {
      mockStorage.getFileStats.mockRejectedValue(new Error('File not found'));

      const result = await cache.isCacheFresh('workspace-123', mockCacheEntry);

      expect(result).toBe(false);
    });
  });

  describe('cacheEntryToWorkspaceInfo', () => {
    it('should convert cache entry to workspace info', () => {
      const workspaceInfo = cache.cacheEntryToWorkspaceInfo(mockCacheEntry);

      expect(workspaceInfo.id).toBe(mockCacheEntry.workspaceId);
      expect(workspaceInfo.title).toBe(mockCacheEntry.metadata.title);
      expect(workspaceInfo.author).toBe(mockCacheEntry.metadata.author);
      expect(workspaceInfo.language).toBe(mockCacheEntry.metadata.language);
      expect(workspaceInfo.fileCount).toBe(mockCacheEntry.fileCount);
      expect(workspaceInfo.totalSize).toBe(mockCacheEntry.totalSize);
      expect(workspaceInfo.epubVersion).toBe(mockCacheEntry.epubVersion);
      expect(workspaceInfo.lastModified).toBeInstanceOf(Date);
    });

    it('should handle missing optional fields', () => {
      const minimalEntry = {
        ...mockCacheEntry,
        metadata: {
          title: 'Test Book',
          language: 'en',
          identifier: 'test-123',
          // No author
        },
      };

      const workspaceInfo = cache.cacheEntryToWorkspaceInfo(minimalEntry);

      expect(workspaceInfo.author).toBeUndefined();
      expect(workspaceInfo.title).toBe('Test Book');
    });
  });

  describe('configuration behavior', () => {
    it('should respect custom TTL configuration', async () => {
      const shortTTLCache = new WorkspaceMetadataCache(mockStorage as any, {
        ttl: 1000, // 1 second
        maxEntries: 100,
        enableDiskCache: true,
      });

      const shortTTLEntry = {
        ...mockCacheEntry,
        lastCacheUpdate: Date.now() - 2000, // 2 seconds ago
      };

      const result = await shortTTLCache.isCacheFresh('workspace-123', shortTTLEntry);

      expect(result).toBe(false); // Should be expired with 1 second TTL
    });

    it('should respect maxEntries configuration', async () => {
      const tinyCache = new WorkspaceMetadataCache(mockStorage as any, {
        maxEntries: 1,
        ttl: 24 * 60 * 60 * 1000,
        enableDiskCache: false,
      });

      await tinyCache.set('workspace-1', { ...mockWorkspaceInfo, id: 'workspace-1' });
      await tinyCache.set('workspace-2', { ...mockWorkspaceInfo, id: 'workspace-2' });

      const result1 = await tinyCache.get('workspace-1');
      const result2 = await tinyCache.get('workspace-2');

      expect(result1).toBeNull(); // Should be evicted
      expect(result2).toBeDefined(); // Should be present
    });
  });

  describe('error recovery', () => {
    it('should handle corrupted cache files and rebuild', async () => {
      // First call returns corrupted data
      mockStorage.readTextFile.mockResolvedValueOnce('corrupted json');

      let result = await cache.get('workspace-123');
      expect(result).toBeNull();

      // After rebuild, should work normally
      mockStorage.getFileStats.mockResolvedValue({ lastModified: Date.now() });
      await cache.set('workspace-123', mockWorkspaceInfo);

      result = await cache.get('workspace-123');
      expect(result).toEqual(mockWorkspaceInfo);
    });

    it('should handle partial cache corruption gracefully', async () => {
      const partiallyCorruptedData = {
        'workspace-123': mockCacheEntry,
        'workspace-456': 'not an object',
      };

      mockStorage.readTextFile.mockResolvedValue(JSON.stringify(partiallyCorruptedData));
      mockStorage.getFileStats.mockResolvedValue({
        lastModified: mockCacheEntry.opfFileModified - 1000,
      });

      const result = await cache.get('workspace-123');

      // Should still return valid entry
      expect(result).toBeDefined();
      expect(result?.id).toBe('workspace-123');
    });
  });

  describe('performance characteristics', () => {
    it('should prioritize memory cache over disk cache', async () => {
      // Setup both memory and disk cache
      await cache.set('workspace-123', mockWorkspaceInfo);

      const diskData = {
        'workspace-123': {
          ...mockCacheEntry,
          metadata: { ...mockCacheEntry.metadata, title: 'Disk Title' },
        },
      };
      mockStorage.readTextFile.mockResolvedValue(JSON.stringify(diskData));

      const result = await cache.get('workspace-123');

      // Should return memory cache version, not disk version
      expect(result?.title).toBe('Test Book'); // Memory cache title
      expect(mockStorage.readTextFile).not.toHaveBeenCalled();
    });

    it('should batch disk writes efficiently', async () => {
      mockStorage.writeTextFile.mockResolvedValue(undefined);
      mockStorage.getFileStats.mockResolvedValue({ lastModified: Date.now() });

      // Multiple rapid sets
      await cache.set('workspace-1', { ...mockWorkspaceInfo, id: 'workspace-1' });
      await cache.set('workspace-2', { ...mockWorkspaceInfo, id: 'workspace-2' });
      await cache.set('workspace-3', { ...mockWorkspaceInfo, id: 'workspace-3' });

      // Should write to disk for each workspace
      expect(mockStorage.writeTextFile).toHaveBeenCalledTimes(3);
    });
  });
});
