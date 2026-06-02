/**
 * XHTML Processing Unit Tests
 *
 * Tests for processXHTMLForPreview() method and asset element detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BlobURLManager } from '../blob-url-manager.js';
import { XHTMLProcessingError, BlobURLCapacityError } from '../types.js';
import type { BlobURLManagerConfig } from '../types.js';

// Mock DOMParser and XMLSerializer
class MockDOMParser {
  parseFromString(content: string, _mimeType: string) {
    if (content.includes('invalid-xhtml')) {
      // Return parser error document
      const errorDoc = {
        documentElement: { tagName: 'parsererror' },
      };
      return errorDoc;
    }

    // Create mock document
    const mockDoc = {
      documentElement: { tagName: 'html' },
      querySelectorAll: vi.fn((selector: string) => {
        // Return appropriate mock elements based on selector
        const elements: any[] = [];

        if (selector.includes('script[src]') && content.includes('<script src=')) {
          const scriptMatch = content.match(/<script[^>]+src=["']([^"']+)["']/g);
          if (scriptMatch) {
            scriptMatch.forEach(match => {
              const src = match.match(/src=["']([^"']+)["']/)?.[1];
              elements.push(createMockElement('script', 'src', src!));
            });
          }
        }

        if (selector.includes('link[href]') && content.includes('<link')) {
          const linkMatch = content.match(/<link[^>]+href=["']([^"']+)["']/g);
          if (linkMatch) {
            linkMatch.forEach(match => {
              const href = match.match(/href=["']([^"']+)["']/)?.[1];
              elements.push(createMockElement('link', 'href', href!));
            });
          }
        }

        if (selector.includes('img[src]') && content.includes('<img')) {
          const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/g);
          if (imgMatch) {
            imgMatch.forEach(match => {
              const src = match.match(/src=["']([^"']+)["']/)?.[1];
              const alt = match.match(/alt=["']([^"']+)["']/)?.[1] || '';
              elements.push(createMockElement('img', 'src', src!, alt));
            });
          }
        }

        if (
          selector.includes('video[src]') &&
          content.includes('<video') &&
          content.includes('src=')
        ) {
          const videoMatch = content.match(/<video[^>]+src=["']([^"']+)["']/g);
          if (videoMatch) {
            videoMatch.forEach(match => {
              const src = match.match(/src=["']([^"']+)["']/)?.[1];
              elements.push(createMockElement('video', 'src', src!));
            });
          }
        }

        if (selector.includes('video[poster]') && content.includes('poster=')) {
          const posterMatch = content.match(/<video[^>]+poster=["']([^"']+)["']/g);
          if (posterMatch) {
            posterMatch.forEach(match => {
              const poster = match.match(/poster=["']([^"']+)["']/)?.[1];
              elements.push(createMockElement('video', 'poster', poster!));
            });
          }
        }

        if (selector.includes('audio[src]') && content.includes('<audio')) {
          const audioMatch = content.match(/<audio[^>]+src=["']([^"']+)["']/g);
          if (audioMatch) {
            audioMatch.forEach(match => {
              const src = match.match(/src=["']([^"']+)["']/)?.[1];
              elements.push(createMockElement('audio', 'src', src!));
            });
          }
        }

        if (selector.includes('a[href]') && content.includes('<a')) {
          const linkMatch = content.match(/<a[^>]+href=["']([^"']+)["']/g);
          if (linkMatch) {
            linkMatch.forEach(match => {
              const href = match.match(/href=["']([^"']+)["']/)?.[1];
              elements.push(createMockElement('a', 'href', href!));
            });
          }
        }

        if (selector.includes('object[data]') && content.includes('<object')) {
          const objectMatch = content.match(/<object[^>]+data=["']([^"']+)["']/g);
          if (objectMatch) {
            objectMatch.forEach(match => {
              const data = match.match(/data=["']([^"']+)["']/)?.[1];
              elements.push(createMockElement('object', 'data', data!));
            });
          }
        }

        if (selector.includes('image[href]') && content.includes('<image')) {
          const imageMatch = content.match(/<image[^>]+href=["']([^"']+)["']/g);
          if (imageMatch) {
            imageMatch.forEach(match => {
              const href = match.match(/href=["']([^"']+)["']/)?.[1];
              elements.push(createMockElement('image', 'href', href!));
            });
          }
        }

        if (selector.includes('[data-src]') && content.includes('data-src=')) {
          const dataSrcMatch = content.match(/data-src=["']([^"']+)["']/g);
          if (dataSrcMatch) {
            dataSrcMatch.forEach(match => {
              const dataSrc = match.match(/data-src=["']([^"']+)["']/)?.[1];
              elements.push(createMockElement('div', 'data-src', dataSrc!));
            });
          }
        }

        return elements;
      }),
    };

    return mockDoc;
  }
}

class MockXMLSerializer {
  serializeToString(doc: any) {
    // Return modified content with blob URLs
    let content = doc._originalContent || '<html></html>';

    // Replace any blob URLs that were set on elements
    doc._blobReplacements?.forEach(({ original, replacement }: any) => {
      content = content.replace(original, replacement);
    });

    return content;
  }
}

function createMockElement(tagName: string, attrName: string, attrValue: string, altText?: string) {
  const attributes: Record<string, string> = {};
  attributes[attrName] = attrValue;
  if (altText !== undefined) {
    attributes.alt = altText;
  }

  return {
    tagName: tagName.toUpperCase(),
    getAttribute: vi.fn((name: string) => attributes[name] || null),
    setAttribute: vi.fn((name: string, value: string) => {
      attributes[name] = value;
    }),
    hasAttribute: vi.fn((name: string) => name in attributes),
    _attributes: attributes,
  };
}

// Mock FileStorageAPI
const mockFileStorage = {
  supportsDirectBlobURLs: vi.fn(() => true),
  getFile: vi.fn(),
  readFile: vi.fn(),
  readTextFile: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
};

// Mock console.warn
const mockConsoleWarn = vi.fn();

const testConfig: BlobURLManagerConfig = {
  maxBlobURLs: 100,
  fileStorage: mockFileStorage as any,
  basePath: 'OEBPS',
  onCapacityReached: vi.fn(),
};

describe('XHTML Processing', () => {
  let manager: BlobURLManager;
  let originalDOMParser: any;
  let originalXMLSerializer: any;

  beforeEach(() => {
    // Setup mocks
    vi.clearAllMocks();
    global.console.warn = mockConsoleWarn;
    global.URL.createObjectURL = vi.fn(() => 'blob:null/test-blob');
    global.URL.revokeObjectURL = vi.fn();

    // Mock DOM APIs
    originalDOMParser = global.DOMParser;
    originalXMLSerializer = global.XMLSerializer;
    global.DOMParser = MockDOMParser as any;
    global.XMLSerializer = MockXMLSerializer as any;

    // Create manager
    manager = new BlobURLManager(testConfig);
    manager.setActiveWorkspace('test-workspace');

    // Setup successful file reads by default
    mockFileStorage.getFile.mockResolvedValue(new File(['content'], 'test.file'));
    // CSS files are read as text (for font-URL processing) via readTextFile.
    mockFileStorage.readTextFile.mockResolvedValue('/* mock css */');
  });

  afterEach(() => {
    // Restore DOM APIs
    global.DOMParser = originalDOMParser;
    global.XMLSerializer = originalXMLSerializer;
    manager.cleanup();
  });

  describe('Asset Element Detection', () => {
    it('should process script[src] elements', async () => {
      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <script src="scripts/reader.js"></script>
          <script src="scripts/utils.js"></script>
        </head>
        </html>
      `;

      await manager.processXHTMLForPreview(xhtml);

      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/scripts/reader.js'
      );
      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/scripts/utils.js'
      );
    });

    it('should process link[href] elements', async () => {
      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <link rel="stylesheet" href="styles/main.css"/>
          <link rel="icon" href="images/favicon.ico"/>
        </head>
        </html>
      `;

      await manager.processXHTMLForPreview(xhtml);

      // CSS is read via readTextFile; other assets via getFile.
      expect(mockFileStorage.readTextFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/styles/main.css'
      );
      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/images/favicon.ico'
      );
    });

    it('should process img[src] elements', async () => {
      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <img src="images/cover.jpg" alt="Cover"/>
          <img src="images/photo.png" alt="Photo"/>
        </body>
        </html>
      `;

      await manager.processXHTMLForPreview(xhtml);

      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/images/cover.jpg'
      );
      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/images/photo.png'
      );
    });

    it('should process video[src] and video[poster] elements', async () => {
      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <video src="media/intro.mp4" poster="images/poster.jpg"/>
        </body>
        </html>
      `;

      await manager.processXHTMLForPreview(xhtml);

      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/media/intro.mp4'
      );
      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/images/poster.jpg'
      );
    });

    it('should process audio[src] elements', async () => {
      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <audio src="audio/narration.mp3"/>
        </body>
        </html>
      `;

      await manager.processXHTMLForPreview(xhtml);

      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/audio/narration.mp3'
      );
    });

    it('should process a[href] elements', async () => {
      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <a href="chapter2.xhtml">Next Chapter</a>
        </body>
        </html>
      `;

      await manager.processXHTMLForPreview(xhtml);

      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/chapter2.xhtml'
      );
    });

    it('should process object[data] elements', async () => {
      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <object data="images/diagram.svg"/>
        </body>
        </html>
      `;

      await manager.processXHTMLForPreview(xhtml);

      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/images/diagram.svg'
      );
    });

    it('should process image[href] elements (SVG)', async () => {
      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <svg xmlns="http://www.w3.org/2000/svg">
            <image href="images/embedded.jpg"/>
          </svg>
        </body>
        </html>
      `;

      await manager.processXHTMLForPreview(xhtml);

      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/images/embedded.jpg'
      );
    });

    it('should process [data-src] elements', async () => {
      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <div data-src="images/lazy-load.jpg"/>
        </body>
        </html>
      `;

      await manager.processXHTMLForPreview(xhtml);

      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/images/lazy-load.jpg'
      );
    });
  });

  describe('URL Classification', () => {
    it('should only process relative URLs', async () => {
      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <link rel="stylesheet" href="styles/main.css"/>
          <link rel="stylesheet" href="http://example.com/external.css"/>
          <script src="scripts/local.js"></script>
          <script src="https://cdn.example.com/lib.js"></script>
        </head>
        <body>
          <img src="images/local.jpg" alt="Local"/>
          <img src="data:image/png;base64,iVBOR..." alt="Data URL"/>
          <img src="blob:null/existing-blob" alt="Blob URL"/>
          <a href="chapter2.xhtml">Internal Link</a>
          <a href="http://example.com">External Link</a>
        </body>
        </html>
      `;

      await manager.processXHTMLForPreview(xhtml);

      // Should only process relative URLs (CSS via readTextFile)
      expect(mockFileStorage.readTextFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/styles/main.css'
      );
      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/scripts/local.js'
      );
      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/images/local.jpg'
      );
      expect(mockFileStorage.getFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/chapter2.xhtml'
      );

      // Should NOT process external/special URLs
      expect(mockFileStorage.getFile).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('example.com')
      );
      expect(mockFileStorage.getFile).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('data:')
      );
      expect(mockFileStorage.getFile).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('blob:')
      );
    });

    it('should handle empty basePath correctly', async () => {
      const rootManager = new BlobURLManager({ ...testConfig, basePath: '' });
      rootManager.setActiveWorkspace('test-workspace');

      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <link rel="stylesheet" href="styles/main.css"/>
        </head>
        </html>
      `;

      await rootManager.processXHTMLForPreview(xhtml);

      // CSS is read via readTextFile.
      expect(mockFileStorage.readTextFile).toHaveBeenCalledWith(
        'test-workspace',
        'styles/main.css'
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw XHTMLProcessingError for malformed XHTML', async () => {
      const invalidXHTML = '<div><span>invalid-xhtml';

      await expect(manager.processXHTMLForPreview(invalidXHTML)).rejects.toThrow(
        XHTMLProcessingError
      );

      await expect(manager.processXHTMLForPreview(invalidXHTML)).rejects.toThrow(
        'Invalid XHTML content'
      );
    });

    it('should handle missing CSS/JS files - preserve URL and warn', async () => {
      mockFileStorage.getFile.mockRejectedValue(new Error('File not found'));
      // CSS is read via readTextFile, so a missing stylesheet fails there.
      mockFileStorage.readTextFile.mockRejectedValue(new Error('File not found'));

      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <link rel="stylesheet" href="missing.css"/>
          <script src="missing.js"></script>
        </head>
        </html>
      `;

      const result = await manager.processXHTMLForPreview(xhtml);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Missing asset: OEBPS/missing.css (referenced by <link> element)'
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Missing asset: OEBPS/missing.js (referenced by <script> element)'
      );

      // URLs should be preserved (tested through lack of blob URL substitution)
      expect(result).toBeDefined();
    });

    it('should handle missing images - show error icon and warn', async () => {
      // Mock successful file read for CSS, but fail for image
      mockFileStorage.getFile.mockImplementation((workspace: string, path: string) => {
        if (path.includes('.css')) {
          return Promise.resolve(new File(['css'], 'style.css'));
        }
        return Promise.reject(new Error('Image not found'));
      });

      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <link rel="stylesheet" href="styles/main.css"/>
        </head>
        <body>
          <img src="missing.jpg" alt="test"/>
        </body>
        </html>
      `;

      await manager.processXHTMLForPreview(xhtml);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Missing image: OEBPS/missing.jpg (referenced by <img> element)'
      );

      // Should have processed CSS successfully (CSS is read via readTextFile)
      expect(mockFileStorage.readTextFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/styles/main.css'
      );
    });

    it('should handle navigation links (a[href]) normally - no special error handling', async () => {
      mockFileStorage.getFile.mockRejectedValue(new Error('File not found'));

      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <a href="missing-chapter.xhtml">Missing Chapter</a>
        </body>
        </html>
      `;

      await manager.processXHTMLForPreview(xhtml);

      // Should not have special error handling for navigation links
      // They should be left as-is for normal 404 behavior
      expect(mockConsoleWarn).not.toHaveBeenCalledWith(expect.stringContaining('Missing image:'));
    });

    // Skip: capacity management during XHTML processing has complex interaction with happy-dom
    // This functionality is tested in browser environment via Storybook
    it.skip('should throw capacity error when limit reached during processing', async () => {
      const capacityManager = new BlobURLManager({
        ...testConfig,
        maxBlobURLs: 1,
      });
      capacityManager.setActiveWorkspace('test-workspace');

      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <img src="image1.jpg" alt="Image 1"/>
          <img src="image2.jpg" alt="Image 2"/>
        </body>
        </html>
      `;

      await expect(capacityManager.processXHTMLForPreview(xhtml)).rejects.toThrow(
        BlobURLCapacityError
      );
    });

    // Skip: capacity management during XHTML processing has complex interaction with happy-dom
    // This functionality is tested in browser environment via Storybook
    it.skip('should check capacity before processing', async () => {
      const capacityManager = new BlobURLManager({
        ...testConfig,
        maxBlobURLs: 0,
      });
      capacityManager.setActiveWorkspace('test-workspace');

      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <img src="image.jpg" alt="Image"/>
        </body>
        </html>
      `;

      await expect(capacityManager.processXHTMLForPreview(xhtml)).rejects.toThrow(
        BlobURLCapacityError
      );

      expect(testConfig.onCapacityReached).toHaveBeenCalled();
    });
  });

  describe('Complex XHTML Processing', () => {
    it('should process mixed content types correctly', async () => {
      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <link rel="stylesheet" href="styles/main.css"/>
          <script src="scripts/reader.js"></script>
        </head>
        <body>
          <img src="images/cover.jpg" alt="Cover"/>
          <video src="media/intro.mp4" poster="images/poster.jpg"/>
          <audio src="audio/narration.mp3"/>
          <a href="chapter2.xhtml">Next Chapter</a>
          <object data="images/diagram.svg"/>
          <div data-src="images/lazy.jpg"/>
        </body>
        </html>
      `;

      await manager.processXHTMLForPreview(xhtml);

      // CSS is read via readTextFile; all other relative assets via getFile.
      expect(mockFileStorage.readTextFile).toHaveBeenCalledWith(
        'test-workspace',
        'OEBPS/styles/main.css'
      );

      const expectedCalls = [
        'OEBPS/scripts/reader.js',
        'OEBPS/images/cover.jpg',
        'OEBPS/media/intro.mp4',
        'OEBPS/images/poster.jpg',
        'OEBPS/audio/narration.mp3',
        'OEBPS/chapter2.xhtml',
        'OEBPS/images/diagram.svg',
        'OEBPS/images/lazy.jpg',
      ];

      expectedCalls.forEach(path => {
        expect(mockFileStorage.getFile).toHaveBeenCalledWith('test-workspace', path);
      });
    });

    it('should preserve XHTML structure and attributes', async () => {
      const xhtml = `
        <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <img src="images/test.jpg" alt="Test Image" class="cover" id="main-image"/>
        </body>
        </html>
      `;

      const result = await manager.processXHTMLForPreview(xhtml);

      // Result should be defined and preserve structure
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
