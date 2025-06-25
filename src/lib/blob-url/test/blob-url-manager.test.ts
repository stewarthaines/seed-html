/**
 * Blob URL Manager Unit Tests
 *
 * Comprehensive test suite based on API.md specification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BlobURLManager } from '../blob-url-manager.js';
import { BlobURLError, BlobURLCapacityError } from '../types.js';
import type { BlobURLManagerConfig } from '../types.js';

// Mock FileStorageAPI
const mockFileStorage = {
  supportsDirectBlobURLs: vi.fn(),
  getFile: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
};

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();

// Mock console.warn
const mockConsoleWarn = vi.fn();

// Test configuration
const testConfig: BlobURLManagerConfig = {
  maxBlobURLs: 100,
  fileStorage: mockFileStorage as any,
  basePath: 'OEBPS',
  onCapacityReached: vi.fn(),
};

describe('BlobURLManager', () => {
  let manager: BlobURLManager;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup URL mocks
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    // Setup console mock
    global.console.warn = mockConsoleWarn;

    // Default mock return values
    mockFileStorage.supportsDirectBlobURLs.mockReturnValue(true);
    mockCreateObjectURL.mockReturnValue('blob:null/test-blob-url');

    // Create fresh manager instance
    manager = new BlobURLManager(testConfig);
  });

  afterEach(() => {
    // Cleanup
    manager.cleanup();
  });

  describe('Constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(manager.getBlobURLCount()).toBe(0);
      expect(manager.isAtCapacity()).toBe(false);
    });

    it('should cache backend capability detection at initialization', () => {
      expect(mockFileStorage.supportsDirectBlobURLs).toHaveBeenCalledTimes(1);

      // Create another manager - should call detection again
      new BlobURLManager(testConfig);
      expect(mockFileStorage.supportsDirectBlobURLs).toHaveBeenCalledTimes(2);
    });

    it('should handle empty basePath for OPF in container root', () => {
      const rootConfig = { ...testConfig, basePath: '' };
      const rootManager = new BlobURLManager(rootConfig);
      expect(rootManager).toBeInstanceOf(BlobURLManager);
    });
  });

  describe('setActiveWorkspace()', () => {
    it('should set active workspace', () => {
      manager.setActiveWorkspace('workspace-123');
      // Workspace is set (tested indirectly through other operations)
      expect(() => manager.setActiveWorkspace('workspace-123')).not.toThrow();
    });

    it('should cleanup existing blob URLs when switching workspaces', async () => {
      manager.setActiveWorkspace('workspace-1');

      // Create some blob URLs
      mockFileStorage.getFile.mockResolvedValue(new File(['test'], 'test.jpg'));
      await manager.createBlobURL('images/test1.jpg');
      await manager.createBlobURL('images/test2.jpg');

      expect(manager.getBlobURLCount()).toBe(2);

      // Switch workspace
      manager.setActiveWorkspace('workspace-2');

      expect(manager.getBlobURLCount()).toBe(0);
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2);
    });

    it('should not cleanup when switching to same workspace', async () => {
      manager.setActiveWorkspace('workspace-1');

      mockFileStorage.getFile.mockResolvedValue(new File(['test'], 'test.jpg'));
      await manager.createBlobURL('images/test.jpg');

      expect(manager.getBlobURLCount()).toBe(1);

      // Switch to same workspace
      manager.setActiveWorkspace('workspace-1');

      expect(manager.getBlobURLCount()).toBe(1);
      expect(mockRevokeObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('createBlobURL() - OPFS Path', () => {
    beforeEach(() => {
      mockFileStorage.supportsDirectBlobURLs.mockReturnValue(true);
      manager.setActiveWorkspace('test-workspace');
    });

    it('should create blob URL using OPFS zero-copy path', async () => {
      const mockFile = new File(['test content'], 'cover.jpg', {
        type: 'wrong/type',
      });
      mockFileStorage.getFile.mockResolvedValue(mockFile);
      mockCreateObjectURL.mockReturnValue('blob:null/opfs-blob-url');

      const blobURL = await manager.createBlobURL('images/cover.jpg');

      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/images/cover.jpg'
      );
      expect(mockCreateObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'cover.jpg',
          type: 'image/jpeg', // Should use our MIME detection, not file.type
        })
      );
      expect(blobURL).toBe('blob:null/opfs-blob-url');
      expect(manager.getBlobURLCount()).toBe(1);
    });

    it('should resolve manifest href to full workspace path', async () => {
      const mockFile = new File(['css content'], 'main.css');
      mockFileStorage.getFile.mockResolvedValue(mockFile);

      await manager.createBlobURL('styles/main.css');

      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/styles/main.css'
      );
    });

    it('should handle empty basePath for OPF in root', async () => {
      const rootManager = new BlobURLManager({ ...testConfig, basePath: '' });
      rootManager.setActiveWorkspace('test-workspace');

      const mockFile = new File(['content'], 'chapter.xhtml');
      mockFileStorage.getFile.mockResolvedValue(mockFile);

      await rootManager.createBlobURL('chapter1.xhtml');

      expect(mockFileStorage.getFile).toHaveBeenCalledWith('test-workspace', 'chapter1.xhtml');
    });

    it('should cache blob URLs by original href', async () => {
      const mockFile = new File(['test'], 'test.jpg');
      mockFileStorage.getFile.mockResolvedValue(mockFile);
      mockCreateObjectURL.mockReturnValue('blob:null/cached-url');

      const url1 = await manager.createBlobURL('images/test.jpg');
      const url2 = await manager.createBlobURL('images/test.jpg');

      expect(url1).toBe(url2);
      expect(url1).toBe('blob:null/cached-url');
      expect(mockFileStorage.getFile).toHaveBeenCalledTimes(1);
      expect(manager.getBlobURLCount()).toBe(1);
    });

    it('should use correct MIME type detection', async () => {
      const testCases = [
        { href: 'chapter.xhtml', expectedType: 'application/xhtml+xml' },
        { href: 'style.css', expectedType: 'text/css' },
        { href: 'cover.jpg', expectedType: 'image/jpeg' },
        { href: 'audio.mp3', expectedType: 'audio/mpeg' },
        { href: 'unknown.xyz', expectedType: 'application/octet-stream' },
      ];

      for (const testCase of testCases) {
        const mockFile = new File(['content'], testCase.href);
        mockFileStorage.getFile.mockResolvedValue(mockFile);

        await manager.createBlobURL(testCase.href);

        expect(mockCreateObjectURL).toHaveBeenCalledWith(
          expect.objectContaining({ type: testCase.expectedType })
        );

        // Reset for next test
        vi.clearAllMocks();
        mockFileStorage.supportsDirectBlobURLs.mockReturnValue(true);
        mockCreateObjectURL.mockReturnValue('blob:null/test');
      }
    });

    it('should throw error when file not found', async () => {
      mockFileStorage.getFile.mockRejectedValue(new Error('File not found'));

      await expect(manager.createBlobURL('missing/file.jpg')).rejects.toThrow(BlobURLError);

      await expect(manager.createBlobURL('missing/file.jpg')).rejects.toThrow(
        'Failed to create blob URL for missing/file.jpg: File not found'
      );
    });
  });

  describe('createBlobURL() - IndexedDB Path', () => {
    beforeEach(() => {
      mockFileStorage.supportsDirectBlobURLs.mockReturnValue(false);
      manager = new BlobURLManager(testConfig);
      manager.setActiveWorkspace('test-workspace');
    });

    it('should create blob URL using IndexedDB memory-copy path', async () => {
      const mockContent = new ArrayBuffer(100);
      mockFileStorage.readFile.mockResolvedValue(mockContent);
      mockCreateObjectURL.mockReturnValue('blob:null/indexeddb-blob-url');

      const blobURL = await manager.createBlobURL('images/cover.jpg');

      expect(mockFileStorage.readFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/images/cover.jpg'
      );
      expect(mockCreateObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'image/jpeg',
        })
      );
      expect(blobURL).toBe('blob:null/indexeddb-blob-url');
    });

    it('should handle readFile errors', async () => {
      mockFileStorage.readFile.mockRejectedValue(new Error('Storage error'));

      await expect(manager.createBlobURL('test.jpg')).rejects.toThrow(BlobURLError);
    });
  });

  describe('createBlobFromContent()', () => {
    it('should create blob URL from string content', () => {
      const content = 'test content';
      const mimeType = 'text/plain';
      mockCreateObjectURL.mockReturnValue('blob:null/content-blob');

      const blobURL = manager.createBlobFromContent(content, mimeType);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: mimeType }));
      expect(blobURL).toBe('blob:null/content-blob');
    });

    it('should create blob URL from ArrayBuffer content', () => {
      const content = new ArrayBuffer(100);
      const mimeType = 'application/octet-stream';
      mockCreateObjectURL.mockReturnValue('blob:null/binary-blob');

      const blobURL = manager.createBlobFromContent(content, mimeType);

      expect(blobURL).toBe('blob:null/binary-blob');
    });

    it('should not register blob URL for cleanup (caller manages)', () => {
      manager.createBlobFromContent('test', 'text/plain');
      expect(manager.getBlobURLCount()).toBe(0);
    });
  });

  describe('Capacity Management', () => {
    beforeEach(() => {
      // Create manager with low capacity for testing
      const lowCapacityConfig = { ...testConfig, maxBlobURLs: 2 };
      manager = new BlobURLManager(lowCapacityConfig);
      manager.setActiveWorkspace('test-workspace');

      mockFileStorage.getFile.mockResolvedValue(new File(['test'], 'test.jpg'));
    });

    it('should track blob URL count correctly', async () => {
      expect(manager.getBlobURLCount()).toBe(0);
      expect(manager.isAtCapacity()).toBe(false);

      await manager.createBlobURL('image1.jpg');
      expect(manager.getBlobURLCount()).toBe(1);
      expect(manager.isAtCapacity()).toBe(false);

      await manager.createBlobURL('image2.jpg');
      expect(manager.getBlobURLCount()).toBe(2);
      expect(manager.isAtCapacity()).toBe(true);
    });

    it('should throw capacity error when limit exceeded', async () => {
      // Fill to capacity
      await manager.createBlobURL('image1.jpg');
      await manager.createBlobURL('image2.jpg');

      // Try to exceed capacity
      await expect(manager.createBlobURL('image3.jpg')).rejects.toThrow(BlobURLCapacityError);

      await expect(manager.createBlobURL('image3.jpg')).rejects.toThrow(
        'Blob URL capacity exceeded: 2/2'
      );
    });

    it('should call onCapacityReached callback when limit exceeded', async () => {
      await manager.createBlobURL('image1.jpg');
      await manager.createBlobURL('image2.jpg');

      await expect(manager.createBlobURL('image3.jpg')).rejects.toThrow();

      expect(testConfig.onCapacityReached).toHaveBeenCalled();
    });

    it('should not increment count for cached URLs', async () => {
      await manager.createBlobURL('image1.jpg');
      await manager.createBlobURL('image1.jpg'); // Same URL - should be cached

      expect(manager.getBlobURLCount()).toBe(1);
    });
  });

  describe('revokeBlobURL()', () => {
    it('should revoke blob URL and remove from registry', async () => {
      manager.setActiveWorkspace('test-workspace');
      mockFileStorage.getFile.mockResolvedValue(new File(['test'], 'test.jpg'));

      const blobURL = await manager.createBlobURL('test.jpg');
      expect(manager.getBlobURLCount()).toBe(1);

      manager.revokeBlobURL(blobURL);

      expect(mockRevokeObjectURL).toHaveBeenCalledWith(blobURL);
      expect(manager.getBlobURLCount()).toBe(0);
    });

    it('should handle revoking non-existent URLs gracefully', () => {
      expect(() => manager.revokeBlobURL('blob:null/non-existent')).not.toThrow();
    });
  });

  describe('cleanup()', () => {
    it('should revoke all blob URLs and clear registry', async () => {
      manager.setActiveWorkspace('test-workspace');
      mockFileStorage.getFile.mockResolvedValue(new File(['test'], 'test.jpg'));

      await manager.createBlobURL('image1.jpg');
      await manager.createBlobURL('image2.jpg');
      expect(manager.getBlobURLCount()).toBe(2);

      manager.cleanup();

      expect(manager.getBlobURLCount()).toBe(0);
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup with no URLs', () => {
      expect(() => manager.cleanup()).not.toThrow();
      expect(manager.getBlobURLCount()).toBe(0);
    });
  });

  describe('getMimeType()', () => {
    it('should detect common EPUB file types', () => {
      const testCases = [
        { file: 'chapter.xhtml', expected: 'application/xhtml+xml' },
        { file: 'style.css', expected: 'text/css' },
        { file: 'script.js', expected: 'application/javascript' },
        { file: 'cover.jpg', expected: 'image/jpeg' },
        { file: 'cover.jpeg', expected: 'image/jpeg' },
        { file: 'image.png', expected: 'image/png' },
        { file: 'icon.svg', expected: 'image/svg+xml' },
        { file: 'audio.mp3', expected: 'audio/mpeg' },
        { file: 'video.mp4', expected: 'video/mp4' },
        { file: 'content.opf', expected: 'application/oebps-package+xml' },
        { file: 'toc.ncx', expected: 'application/x-dtbncx+xml' },
      ];

      testCases.forEach(({ file, expected }) => {
        expect(manager.getMimeType(file)).toBe(expected);
      });
    });

    it('should handle edge cases', () => {
      const edgeCases = [
        { file: 'file.tar.gz', expected: 'application/gzip' }, // Last extension wins
        { file: 'chapter', expected: 'application/octet-stream' }, // No extension
        { file: 'FILE.JPEG', expected: 'image/jpeg' }, // Case insensitive
        { file: '.htaccess', expected: 'application/octet-stream' }, // Leading dot only
        { file: 'file.', expected: 'application/octet-stream' }, // Trailing dot
        { file: '', expected: 'application/octet-stream' }, // Empty string
      ];

      edgeCases.forEach(({ file, expected }) => {
        expect(manager.getMimeType(file)).toBe(expected);
      });
    });
  });

  describe('isResourcePath()', () => {
    it('should identify relative resource paths', () => {
      const relativePaths = [
        'images/cover.jpg',
        'styles/main.css',
        'scripts/reader.js',
        'chapter1.xhtml',
        'subfolder/file.txt',
      ];

      relativePaths.forEach(path => {
        expect(manager.isResourcePath(path)).toBe(true);
      });
    });

    it('should reject absolute and special URLs', () => {
      const nonResourcePaths = [
        'http://example.com/image.jpg',
        'https://cdn.example.com/style.css',
        'data:image/png;base64,iVBOR...',
        'blob:null/abc123-456',
        '/absolute/path/file.jpg',
        'ftp://example.com/file.txt',
        'mailto:test@example.com',
      ];

      nonResourcePaths.forEach(path => {
        expect(manager.isResourcePath(path)).toBe(false);
      });
    });
  });
});
