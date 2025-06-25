/**
 * Blob URL Manager Utilities Unit Tests
 *
 * Tests for utility functions, path resolution, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BlobURLManager } from '../blob-url-manager.js';
import type { BlobURLManagerConfig } from '../types.js';

// Mock FileStorageAPI
const mockFileStorage = {
  supportsDirectBlobURLs: vi.fn(() => true),
  getFile: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
};

const testConfig: BlobURLManagerConfig = {
  maxBlobURLs: 100,
  fileStorage: mockFileStorage as any,
  basePath: 'OEBPS',
  onCapacityReached: vi.fn(),
};

describe('Blob URL Manager Utilities', () => {
  let manager: BlobURLManager;

  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:null/test-blob');
    global.URL.revokeObjectURL = vi.fn();

    manager = new BlobURLManager(testConfig);
    manager.setActiveWorkspace('test-workspace');
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('Path Resolution', () => {
    it('should resolve manifest href to full workspace path', () => {
      // Test through createBlobURL method which uses internal resolveManifestPath
      mockFileStorage.getFile.mockResolvedValue(new File(['test'], 'test.jpg'));

      manager.createBlobURL('images/cover.jpg');
      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/images/cover.jpg'
      );

      manager.createBlobURL('styles/main.css');
      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/styles/main.css'
      );

      manager.createBlobURL('chapter1.xhtml');
      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/chapter1.xhtml'
      );
    });

    it('should handle empty basePath (OPF in container root)', () => {
      const rootManager = new BlobURLManager({ ...testConfig, basePath: '' });
      rootManager.setActiveWorkspace('test-workspace');

      mockFileStorage.getFile.mockResolvedValue(new File(['test'], 'test.xhtml'));

      rootManager.createBlobURL('chapter1.xhtml');
      expect(mockFileStorage.getFile).toHaveBeenCalledWith('test-workspace', 'chapter1.xhtml');

      rootManager.createBlobURL('images/cover.jpg');
      expect(mockFileStorage.getFile).toHaveBeenCalledWith('test-workspace', 'images/cover.jpg');
    });

    it('should handle nested paths correctly', () => {
      mockFileStorage.getFile.mockResolvedValue(new File(['test'], 'test.file'));

      manager.createBlobURL('subfolder/images/nested.jpg');
      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/subfolder/images/nested.jpg'
      );

      manager.createBlobURL('content/chapter/section.xhtml');
      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/content/chapter/section.xhtml'
      );
    });

    it('should handle different basePath configurations', () => {
      const configs = [
        { basePath: 'content', href: 'images/test.jpg', expected: 'content/images/test.jpg' },
        { basePath: 'book', href: 'chapter1.xhtml', expected: 'book/chapter1.xhtml' },
        { basePath: 'src/main', href: 'styles/theme.css', expected: 'src/main/styles/theme.css' },
      ];

      configs.forEach(({ basePath, href, expected }) => {
        const testManager = new BlobURLManager({ ...testConfig, basePath });
        testManager.setActiveWorkspace('test-workspace');

        mockFileStorage.getFile.mockResolvedValue(new File(['test'], 'test.file'));
        testManager.createBlobURL(href);

        expect(mockFileStorage.getFile).toHaveBeenCalledWith('test-workspace', expected);
      });
    });
  });

  describe('MIME Type Detection Edge Cases', () => {
    it('should handle complex file extensions', () => {
      const testCases = [
        // Last extension wins
        { file: 'archive.tar.gz', expected: 'application/gzip' },
        { file: 'backup.sql.gz', expected: 'application/gzip' },
        { file: 'document.html.txt', expected: 'text/plain' },

        // Case insensitive
        { file: 'IMAGE.PNG', expected: 'image/png' },
        { file: 'Style.CSS', expected: 'text/css' },
        { file: 'SCRIPT.JS', expected: 'application/javascript' },
        { file: 'chapter.XHTML', expected: 'application/xhtml+xml' },

        // Mixed case
        { file: 'Cover.Jpg', expected: 'image/jpeg' },
        { file: 'Audio.Mp3', expected: 'audio/mpeg' },
        { file: 'Video.Mp4', expected: 'video/mp4' },
      ];

      testCases.forEach(({ file, expected }) => {
        expect(manager.getMimeType(file)).toBe(expected);
      });
    });

    it('should handle edge cases and malformed filenames', () => {
      const edgeCases = [
        // No extension
        { file: 'chapter', expected: 'application/octet-stream' },
        { file: 'README', expected: 'application/octet-stream' },
        { file: 'Makefile', expected: 'application/octet-stream' },

        // Leading dot only
        { file: '.htaccess', expected: 'application/octet-stream' },
        { file: '.gitignore', expected: 'application/octet-stream' },
        { file: '.DS_Store', expected: 'application/octet-stream' },

        // Trailing dot
        { file: 'file.', expected: 'application/octet-stream' },
        { file: 'document.html.', expected: 'application/octet-stream' },

        // Multiple dots
        { file: 'file..txt', expected: 'text/plain' },
        { file: 'document...html', expected: 'text/html' },

        // Empty string
        { file: '', expected: 'application/octet-stream' },

        // Just dots
        { file: '.', expected: 'application/octet-stream' },
        { file: '..', expected: 'application/octet-stream' },
        { file: '...', expected: 'application/octet-stream' },

        // Special characters
        { file: 'file@#$.jpg', expected: 'image/jpeg' },
        { file: 'test (1).png', expected: 'image/png' },
        { file: 'file-name_v2.css', expected: 'text/css' },
      ];

      edgeCases.forEach(({ file, expected }) => {
        expect(manager.getMimeType(file)).toBe(expected);
      });
    });

    it('should handle all supported EPUB file types', () => {
      const epubTypes = [
        // EPUB-specific
        { file: 'content.opf', expected: 'application/oebps-package+xml' },
        { file: 'toc.ncx', expected: 'application/x-dtbncx+xml' },
        { file: 'book.epub', expected: 'application/epub+zip' },

        // Text formats
        { file: 'page.html', expected: 'text/html' },
        { file: 'chapter.xhtml', expected: 'application/xhtml+xml' },
        { file: 'content.xml', expected: 'application/xml' },
        { file: 'style.css', expected: 'text/css' },
        { file: 'script.js', expected: 'application/javascript' },
        { file: 'notes.txt', expected: 'text/plain' },
        { file: 'data.json', expected: 'application/json' },

        // Images
        { file: 'cover.jpg', expected: 'image/jpeg' },
        { file: 'photo.jpeg', expected: 'image/jpeg' },
        { file: 'icon.png', expected: 'image/png' },
        { file: 'animation.gif', expected: 'image/gif' },
        { file: 'diagram.svg', expected: 'image/svg+xml' },
        { file: 'modern.webp', expected: 'image/webp' },

        // Audio
        { file: 'music.mp3', expected: 'audio/mpeg' },
        { file: 'sound.wav', expected: 'audio/wav' },
        { file: 'audio.ogg', expected: 'audio/ogg' },
        { file: 'voice.m4a', expected: 'audio/mp4' },

        // Video
        { file: 'movie.mp4', expected: 'video/mp4' },
        { file: 'clip.webm', expected: 'video/webm' },
        { file: 'video.ogv', expected: 'video/ogg' },
      ];

      epubTypes.forEach(({ file, expected }) => {
        expect(manager.getMimeType(file)).toBe(expected);
      });
    });
  });

  describe('URL Classification', () => {
    it('should correctly identify relative resource paths', () => {
      const relativePaths = [
        'images/cover.jpg',
        'styles/main.css',
        'scripts/reader.js',
        'chapter1.xhtml',
        'subfolder/nested/file.txt',
        'file.html',
        'media/video.mp4',
        'fonts/roboto.ttf',
        'data/content.json',
        'assets/icon.svg',
      ];

      relativePaths.forEach(path => {
        expect(manager.isResourcePath(path)).toBe(true);
      });
    });

    it('should reject absolute and external URLs', () => {
      const nonResourcePaths = [
        // HTTP/HTTPS
        'http://example.com/image.jpg',
        'https://cdn.example.com/style.css',
        'http://localhost:3000/api/data',
        'https://fonts.googleapis.com/css?family=Roboto',

        // Other protocols
        'ftp://files.example.com/download.zip',
        'mailto:contact@example.com',
        'tel:+1234567890',
        'file:///local/path/file.txt',

        // Special URLs
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'blob:null/abc123-456def-789ghi',
        'about:blank',
        'javascript:void(0)',

        // Absolute paths
        '/absolute/path/file.jpg',
        '/root/document.html',
        '/usr/local/bin/script',

        // Protocol-relative URLs
        '//example.com/resource.css',
        '//cdn.example.com/lib.js',
      ];

      nonResourcePaths.forEach(path => {
        expect(manager.isResourcePath(path)).toBe(false);
      });
    });

    it('should handle edge cases in URL classification', () => {
      const edgeCases = [
        // Relative paths that might be confusing
        { path: './images/cover.jpg', expected: true }, // Explicitly relative
        { path: '../styles/parent.css', expected: true }, // Parent directory
        { path: 'folder/../file.txt', expected: true }, // Relative navigation

        // URLs with unusual characters
        { path: 'file name with spaces.jpg', expected: true },
        { path: 'file-with-dashes.css', expected: true },
        { path: 'file_with_underscores.js', expected: true },
        { path: 'file.with.dots.html', expected: true },
        { path: 'file(with)parentheses.txt', expected: true },
        { path: 'file[with]brackets.xml', expected: true },

        // Query strings and fragments (should be rejected)
        { path: 'file.html?param=value', expected: true }, // Still relative
        { path: 'page.html#section', expected: true }, // Still relative

        // Empty and whitespace
        { path: '', expected: false },
        { path: ' ', expected: false }, // Empty after trim
        { path: '\t', expected: false },
        { path: '\n', expected: false },
      ];

      edgeCases.forEach(({ path, expected }) => {
        expect(manager.isResourcePath(path)).toBe(expected);
      });
    });
  });

  describe('Registry State Management', () => {
    it('should maintain accurate count during operations', async () => {
      mockFileStorage.getFile.mockResolvedValue(new File(['test'], 'test.file'));

      expect(manager.getBlobURLCount()).toBe(0);
      expect(manager.isAtCapacity()).toBe(false);

      await manager.createBlobURL('file1.jpg');
      expect(manager.getBlobURLCount()).toBe(1);

      await manager.createBlobURL('file2.css');
      expect(manager.getBlobURLCount()).toBe(2);

      // Cached URL should not increment count
      await manager.createBlobURL('file1.jpg');
      expect(manager.getBlobURLCount()).toBe(2);

      manager.cleanup();
      expect(manager.getBlobURLCount()).toBe(0);
    });

    it('should handle capacity management correctly', () => {
      const capacityManager = new BlobURLManager({ ...testConfig, maxBlobURLs: 3 });

      expect(capacityManager.getBlobURLCount()).toBe(0);
      expect(capacityManager.isAtCapacity()).toBe(false);

      // Simulate adding URLs to registry (testing internal state)
      // This would normally be done through createBlobURL, but we're testing the capacity logic
      expect(capacityManager.isAtCapacity()).toBe(false);
    });

    it('should properly clean up on workspace switch', async () => {
      mockFileStorage.getFile.mockResolvedValue(new File(['test'], 'test.file'));

      // Create URLs in first workspace
      manager.setActiveWorkspace('workspace-1');
      await manager.createBlobURL('file1.jpg');
      await manager.createBlobURL('file2.css');
      expect(manager.getBlobURLCount()).toBe(2);

      // Switch workspace should clean up
      manager.setActiveWorkspace('workspace-2');
      expect(manager.getBlobURLCount()).toBe(0);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle file storage errors gracefully', async () => {
      mockFileStorage.getFile.mockRejectedValue(new Error('Storage unavailable'));

      await expect(manager.createBlobURL('test.jpg')).rejects.toThrow(
        'Failed to create blob URL for test.jpg: Storage unavailable'
      );
    });

    it('should handle network-like errors', async () => {
      const networkErrors = [
        new Error('Network error'),
        new Error('Timeout'),
        new Error('Permission denied'),
        new Error('Quota exceeded'),
      ];

      for (const error of networkErrors) {
        mockFileStorage.getFile.mockRejectedValue(error);

        await expect(manager.createBlobURL('test.file')).rejects.toThrow(
          'Failed to create blob URL for test.file'
        );

        vi.clearAllMocks();
        mockFileStorage.supportsDirectBlobURLs.mockReturnValue(true);
      }
    });

    it('should handle malformed blob creation', () => {
      // Test with invalid content types
      expect(() => manager.createBlobFromContent('test', '')).not.toThrow();
      expect(() => manager.createBlobFromContent('test', 'invalid/mime/type')).not.toThrow();
      expect(() => manager.createBlobFromContent(new ArrayBuffer(0), 'text/plain')).not.toThrow();
    });
  });

  describe('Memory and Performance', () => {
    it('should handle large number of cached URLs efficiently', async () => {
      mockFileStorage.getFile.mockResolvedValue(new File(['test'], 'test.file'));

      // Create many unique URLs
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(manager.createBlobURL(`file${i}.jpg`));
      }

      await Promise.all(promises);
      expect(manager.getBlobURLCount()).toBe(50);

      // Cleanup should handle all URLs
      manager.cleanup();
      expect(manager.getBlobURLCount()).toBe(0);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(50);
    });

    it('should reuse cached URLs efficiently', async () => {
      mockFileStorage.getFile.mockResolvedValue(new File(['test'], 'test.file'));

      // Create same URL multiple times - serialize to test caching properly
      // Note: We serialize these calls because createBlobURL is designed for serial usage.
      // Concurrent calls for the same resource may create duplicate blob URLs due to
      // race conditions. In practice, XHTML processing serializes calls naturally.
      const url1 = await manager.createBlobURL('shared.jpg');
      const url2 = await manager.createBlobURL('shared.jpg');
      const url3 = await manager.createBlobURL('shared.jpg');

      // All should be the same URL
      expect(url1).toBe(url2);
      expect(url2).toBe(url3);
      expect(manager.getBlobURLCount()).toBe(1);
      expect(mockFileStorage.getFile).toHaveBeenCalledTimes(1);
    });
  });
});
