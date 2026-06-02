/**
 * ManifestDependencyTracker Unit Tests
 *
 * Tests dependency analysis using CSSOM + regex fallback for CSS
 * and DOM parsing for XHTML files.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { ManifestDependencyTracker } from '../dependency-tracker.js';
import type { ManifestItem } from '../types.js';

// Mock File Storage API
const mockStorage = {
  readTextFile: vi.fn(),
  listFiles: vi.fn(),
  getFileInfo: vi.fn(),
};

// Mock DOMParser for Node.js environment
beforeAll(() => {
  if (!globalThis.DOMParser) {
    // @ts-expect-error - Mock DOMParser for testing
    globalThis.DOMParser = class MockDOMParser {
      parseFromString(xmlStr: string, contentType: string) {
        // Simple mock that handles our test cases
        return {
          querySelectorAll: (selector: string) => {
            if (selector === 'link[rel="stylesheet"]') {
              if (xmlStr.includes('href="../Styles/style.css"')) {
                return [
                  {
                    getAttribute: (attr: string) =>
                      attr === 'href' ? '../Styles/style.css' : null,
                  },
                ];
              }
              if (xmlStr.includes('href="style.css"')) {
                return [{ getAttribute: (attr: string) => (attr === 'href' ? 'style.css' : null) }];
              }
            }
            if (selector === 'img') {
              if (xmlStr.includes('src="../Images/cover.jpg"')) {
                return [
                  {
                    getAttribute: (attr: string) => (attr === 'src' ? '../Images/cover.jpg' : null),
                  },
                ];
              }
              if (xmlStr.includes('src="image.png"')) {
                return [{ getAttribute: (attr: string) => (attr === 'src' ? 'image.png' : null) }];
              }
            }
            if (selector === 'audio source, video source') {
              if (xmlStr.includes('src="../Audio/narration.mp3"')) {
                return [
                  {
                    getAttribute: (attr: string) =>
                      attr === 'src' ? '../Audio/narration.mp3' : null,
                  },
                ];
              }
            }
            return [];
          },
        };
      }
    };
  }

  // Mock CSSStyleSheet for CSSOM testing
  if (!globalThis.CSSStyleSheet) {
    // @ts-expect-error - Mock CSSStyleSheet for testing
    globalThis.CSSStyleSheet = class MockCSSStyleSheet {
      cssRules: any[] = [];

      async replace(content: string) {
        this.cssRules = [];

        // Mock CSS parsing for test cases
        if (content.includes('@import "fonts.css"')) {
          this.cssRules.push({
            type: 3, // CSSRule.IMPORT_RULE
            href: 'fonts.css',
          });
        }

        if (content.includes('background-image: url(bg.jpg)')) {
          this.cssRules.push({
            type: 1, // CSSRule.STYLE_RULE
            style: {
              getPropertyValue: (prop: string) => {
                if (prop === 'background-image') return 'url(bg.jpg)';
                return '';
              },
            },
          });
        }

        if (content.includes('src: url(font.ttf)')) {
          this.cssRules.push({
            type: 1,
            style: {
              getPropertyValue: (prop: string) => {
                if (prop === 'src') return 'url(font.ttf)';
                return '';
              },
            },
          });
        }

        return this;
      }
    };

    // Mock CSSImportRule and CSSStyleRule classes
    (globalThis as any).CSSImportRule = class MockCSSImportRule {
      type = 3;
      href: string = '';
      layerName: string | null = null;
      media: MediaList = {} as MediaList;
      styleSheet: CSSStyleSheet | null = null;
      supportsText: string | null = null;
      // Add other required properties as empty implementations
      cssText: string = '';
      parentRule: CSSRule | null = null;
      parentStyleSheet: CSSStyleSheet | null = null;
      constructor(href?: string) {
        if (href) this.href = href;
      }
    } as any;

    (globalThis as any).CSSStyleRule = class MockCSSStyleRule {
      type = 1;
      style: any = {};
      selectorText: string = '';
      styleMap: any = {};
      cssRules: CSSRuleList = {} as CSSRuleList;
      // Add other required properties as empty implementations
      cssText: string = '';
      parentRule: CSSRule | null = null;
      parentStyleSheet: CSSStyleSheet | null = null;
      deleteRule: (index: number) => void = () => {
        /* mock noop */
      };
      insertRule: (rule: string, index?: number) => number = () => 0;
      constructor(style?: any) {
        if (style) this.style = style;
      }
    } as any;
  }
});

describe('ManifestDependencyTracker', () => {
  let tracker: ManifestDependencyTracker;
  const workspaceId = 'workspace-123';

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new ManifestDependencyTracker(mockStorage as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findDependencies', () => {
    describe('XHTML file dependencies', () => {
      const xhtmlItem: ManifestItem = {
        id: 'chapter1',
        href: 'OEBPS/Text/chapter1.xhtml',
        mediaType: 'application/xhtml+xml',
      };

      it('should extract CSS dependencies from XHTML', async () => {
        const xhtmlContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <link rel="stylesheet" type="text/css" href="../Styles/style.css"/>
</head>
<body>
  <h1>Chapter 1</h1>
</body>
</html>`;

        mockStorage.readTextFile.mockResolvedValue(xhtmlContent);

        const dependencies = await tracker.findDependencies(workspaceId, xhtmlItem);

        expect(dependencies).toContain('OEBPS/Styles/style.css');
        expect(mockStorage.readTextFile).toHaveBeenCalledWith(
          workspaceId,
          'OEBPS/Text/chapter1.xhtml'
        );
      });

      it('should extract image dependencies from XHTML', async () => {
        const xhtmlContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<body>
  <img src="../Images/cover.jpg" alt="Cover"/>
  <img src="image.png" alt="Inline"/>
</body>
</html>`;

        mockStorage.readTextFile.mockResolvedValue(xhtmlContent);

        const dependencies = await tracker.findDependencies(workspaceId, xhtmlItem);

        expect(dependencies).toContain('OEBPS/Images/cover.jpg');
        expect(dependencies).toContain('OEBPS/Text/image.png');
      });

      it('should extract audio/video dependencies from XHTML', async () => {
        const xhtmlContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<body>
  <audio controls>
    <source src="../Audio/narration.mp3" type="audio/mpeg"/>
  </audio>
</body>
</html>`;

        mockStorage.readTextFile.mockResolvedValue(xhtmlContent);

        const dependencies = await tracker.findDependencies(workspaceId, xhtmlItem);

        expect(dependencies).toContain('OEBPS/Audio/narration.mp3');
      });

      it('should resolve relative paths correctly', async () => {
        const xhtmlContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <link rel="stylesheet" href="style.css"/>
</head>
<body>
  <img src="image.png"/>
</body>
</html>`;

        mockStorage.readTextFile.mockResolvedValue(xhtmlContent);

        const dependencies = await tracker.findDependencies(workspaceId, xhtmlItem);

        // Should resolve relative to the XHTML file's directory
        expect(dependencies).toContain('OEBPS/Text/style.css');
        expect(dependencies).toContain('OEBPS/Text/image.png');
      });

      it('should filter out external URLs and data URIs', async () => {
        const xhtmlContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<body>
  <img src="http://example.com/external.jpg"/>
  <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhE..."/>
  <img src="local.jpg"/>
</body>
</html>`;

        mockStorage.readTextFile.mockResolvedValue(xhtmlContent);

        const dependencies = await tracker.findDependencies(workspaceId, xhtmlItem);

        // Should only include local file
        expect(dependencies).not.toContain('http://example.com/external.jpg');
        expect(dependencies).not.toContain('data:image/png;base64,iVBORw0KGgoAAAANSUhE...');
        expect(dependencies).toContain('OEBPS/Text/local.jpg');
      });
    });

    describe('CSS file dependencies using CSSOM', () => {
      const cssItem: ManifestItem = {
        id: 'stylesheet',
        href: 'OEBPS/Styles/style.css',
        mediaType: 'text/css',
      };

      // Skip: CSSOM API not fully supported in happy-dom test environment
      // This functionality is tested in browser environment via Storybook
      it.skip('should extract @import dependencies using CSSOM', async () => {
        const cssContent = `@import "fonts.css";
body { font-family: Arial; }`;

        mockStorage.readTextFile.mockResolvedValue(cssContent);

        const dependencies = await tracker.findDependencies(workspaceId, cssItem);

        expect(dependencies).toContain('OEBPS/Styles/fonts.css');
      });

      it('should extract URL dependencies from CSS properties using CSSOM', async () => {
        const cssContent = `body {
  background-image: url(bg.jpg);
}
@font-face {
  src: url(font.ttf);
}`;

        mockStorage.readTextFile.mockResolvedValue(cssContent);

        const dependencies = await tracker.findDependencies(workspaceId, cssItem);

        expect(dependencies).toContain('OEBPS/Styles/bg.jpg');
        expect(dependencies).toContain('OEBPS/Styles/font.ttf');
      });

      it('should fallback to regex parsing when CSSOM fails', async () => {
        const cssContent = `/* Malformed CSS that breaks CSSOM */
body { background-image: url(fallback.jpg); }`;

        mockStorage.readTextFile.mockResolvedValue(cssContent);

        // Mock CSSOM to throw error
        const originalCSSStyleSheet = globalThis.CSSStyleSheet;
        // @ts-expect-error - Mock CSS failure for testing
        globalThis.CSSStyleSheet = class {
          async replace() {
            throw new Error('CSS parsing failed');
          }
        };

        const dependencies = await tracker.findDependencies(workspaceId, cssItem);

        // Should fall back to regex and still find the URL
        expect(dependencies).toContain('OEBPS/Styles/fallback.jpg');

        // Restore original
        globalThis.CSSStyleSheet = originalCSSStyleSheet;
      });

      it('should handle various URL quote styles in CSS', async () => {
        const cssContent = `body {
  background: url("quoted.jpg");
  list-style-image: url('single-quoted.png');
  border-image: url(unquoted.gif);
}`;

        mockStorage.readTextFile.mockResolvedValue(cssContent);

        // Use regex fallback for this test to ensure quote handling
        const originalCSSStyleSheet = globalThis.CSSStyleSheet;
        // @ts-expect-error - Force regex fallback for testing
        globalThis.CSSStyleSheet = class {
          async replace() {
            throw new Error('Force regex fallback');
          }
        };

        const dependencies = await tracker.findDependencies(workspaceId, cssItem);

        expect(dependencies).toContain('OEBPS/Styles/quoted.jpg');
        expect(dependencies).toContain('OEBPS/Styles/single-quoted.png');
        expect(dependencies).toContain('OEBPS/Styles/unquoted.gif');

        globalThis.CSSStyleSheet = originalCSSStyleSheet;
      });

      it('should filter out external URLs and data URIs from CSS', async () => {
        const cssContent = `body {
  background: url("http://example.com/external.jpg");
  content: url("data:image/svg+xml,<svg>...</svg>");
  list-style-image: url("local.png");
}`;

        mockStorage.readTextFile.mockResolvedValue(cssContent);

        // Force regex fallback to test URL filtering
        const originalCSSStyleSheet = globalThis.CSSStyleSheet;
        // @ts-expect-error - Force regex fallback for URL filtering test
        globalThis.CSSStyleSheet = class {
          async replace() {
            throw new Error('Force regex fallback');
          }
        };

        const dependencies = await tracker.findDependencies(workspaceId, cssItem);

        expect(dependencies).not.toContain('http://example.com/external.jpg');
        expect(dependencies).not.toContain('data:image/svg+xml,<svg>...</svg>');
        expect(dependencies).toContain('OEBPS/Styles/local.png');

        globalThis.CSSStyleSheet = originalCSSStyleSheet;
      });
    });

    describe('non-text file dependencies', () => {
      it('should return empty array for binary files', async () => {
        const imageItem: ManifestItem = {
          id: 'cover',
          href: 'OEBPS/Images/cover.jpg',
          mediaType: 'image/jpeg',
        };

        const dependencies = await tracker.findDependencies(workspaceId, imageItem);

        expect(dependencies).toEqual([]);
        expect(mockStorage.readTextFile).not.toHaveBeenCalled();
      });

      it('should return empty array for audio files', async () => {
        const audioItem: ManifestItem = {
          id: 'narration',
          href: 'OEBPS/Audio/narration.mp3',
          mediaType: 'audio/mpeg',
        };

        const dependencies = await tracker.findDependencies(workspaceId, audioItem);

        expect(dependencies).toEqual([]);
      });

      it('should return empty array for font files', async () => {
        const fontItem: ManifestItem = {
          id: 'custom-font',
          href: 'OEBPS/Fonts/custom.ttf',
          mediaType: 'font/ttf',
        };

        const dependencies = await tracker.findDependencies(workspaceId, fontItem);

        expect(dependencies).toEqual([]);
      });
    });

    describe('path resolution', () => {
      it('should resolve relative paths correctly', () => {
        const basePath = 'OEBPS/Text/chapter1.xhtml';
        const relativePath = '../Styles/style.css';

        const resolved = (tracker as any).resolveRelativePath(basePath, relativePath);

        expect(resolved).toBe('OEBPS/Styles/style.css');
      });

      it('should handle same-directory references', () => {
        const basePath = 'OEBPS/Text/chapter1.xhtml';
        const relativePath = 'image.png';

        const resolved = (tracker as any).resolveRelativePath(basePath, relativePath);

        expect(resolved).toBe('OEBPS/Text/image.png');
      });

      it('should handle multiple directory traversals', () => {
        const basePath = 'OEBPS/Text/Parts/chapter1.xhtml';
        const relativePath = '../../Images/cover.jpg';

        const resolved = (tracker as any).resolveRelativePath(basePath, relativePath);

        expect(resolved).toBe('OEBPS/Images/cover.jpg');
      });

      it('should handle root-level files', () => {
        const basePath = 'OEBPS/content.opf';
        const relativePath = 'Text/chapter1.xhtml';

        const resolved = (tracker as any).resolveRelativePath(basePath, relativePath);

        expect(resolved).toBe('OEBPS/Text/chapter1.xhtml');
      });

      it('should normalize path separators', () => {
        const basePath = 'OEBPS/Text/chapter1.xhtml';
        const relativePath = './././../Styles/style.css';

        const resolved = (tracker as any).resolveRelativePath(basePath, relativePath);

        expect(resolved).toBe('OEBPS/Styles/style.css');
      });
    });

    describe('error handling', () => {
      const xhtmlItem: ManifestItem = {
        id: 'chapter1',
        href: 'OEBPS/Text/chapter1.xhtml',
        mediaType: 'application/xhtml+xml',
      };

      it('should handle file read errors gracefully', async () => {
        mockStorage.readTextFile.mockRejectedValue(new Error('File not found'));

        const dependencies = await tracker.findDependencies(workspaceId, xhtmlItem);

        expect(dependencies).toEqual([]);
      });

      it('should handle malformed XML gracefully', async () => {
        mockStorage.readTextFile.mockResolvedValue('<html><unclosed-tag></html>');

        const dependencies = await tracker.findDependencies(workspaceId, xhtmlItem);

        // Should not throw error, may return empty array or partial results
        expect(Array.isArray(dependencies)).toBe(true);
      });

      it('should handle empty file content', async () => {
        mockStorage.readTextFile.mockResolvedValue('');

        const dependencies = await tracker.findDependencies(workspaceId, xhtmlItem);

        expect(dependencies).toEqual([]);
      });
    });

    describe('extractUrlsFromStyle method', () => {
      it('should extract URLs from CSS style declarations', () => {
        const mockStyle = {
          getPropertyValue: vi.fn((prop: string) => {
            const values: Record<string, string> = {
              'background-image': 'url("background.jpg")',
              'border-image': 'url(border.png)',
              'list-style-image': "url('bullet.gif')",
              content: 'url(icon.svg)',
              cursor: 'url(cursor.cur), pointer',
              src: 'url(font.woff2)', // for @font-face
            };
            return values[prop] || '';
          }),
        };

        const urls = (tracker as any).extractUrlsFromStyle(mockStyle);

        expect(urls).toContain('background.jpg');
        expect(urls).toContain('border.png');
        expect(urls).toContain('bullet.gif');
        expect(urls).toContain('icon.svg');
        expect(urls).toContain('cursor.cur');
        expect(urls).toContain('font.woff2');
      });

      it('should filter out external URLs and data URIs', () => {
        const mockStyle = {
          getPropertyValue: vi.fn((prop: string) => {
            const values: Record<string, string> = {
              'background-image': 'url("http://example.com/bg.jpg")',
              content: 'url("data:image/svg+xml,<svg></svg>")',
              cursor: 'url("#cursor")',
              'list-style-image': 'url("local.png")',
            };
            return values[prop] || '';
          }),
        };

        const urls = (tracker as any).extractUrlsFromStyle(mockStyle);

        expect(urls).not.toContain('http://example.com/bg.jpg');
        expect(urls).not.toContain('data:image/svg+xml,<svg></svg>');
        expect(urls).not.toContain('#cursor');
        expect(urls).toContain('local.png');
      });
    });
  });

  describe('browser compatibility', () => {
    it('should work when CSSStyleSheet is not available', async () => {
      const cssItem: ManifestItem = {
        id: 'style',
        href: 'OEBPS/Styles/style.css',
        mediaType: 'text/css',
      };

      const cssContent = 'body { background: url(bg.jpg); }';
      mockStorage.readTextFile.mockResolvedValue(cssContent);

      // Temporarily remove CSSStyleSheet
      const originalCSSStyleSheet = globalThis.CSSStyleSheet;
      // @ts-expect-error - Temporarily remove CSSStyleSheet for testing
      delete globalThis.CSSStyleSheet;

      const dependencies = await tracker.findDependencies(workspaceId, cssItem);

      expect(dependencies).toContain('OEBPS/Styles/bg.jpg');

      // Restore CSSStyleSheet
      globalThis.CSSStyleSheet = originalCSSStyleSheet;
    });

    it('should work when DOMParser is not available', async () => {
      const xhtmlItem: ManifestItem = {
        id: 'chapter',
        href: 'OEBPS/Text/chapter.xhtml',
        mediaType: 'application/xhtml+xml',
      };

      mockStorage.readTextFile.mockResolvedValue('<html></html>');

      // Temporarily remove DOMParser
      const originalDOMParser = globalThis.DOMParser;
      // @ts-expect-error - Temporarily remove DOMParser for testing
      delete globalThis.DOMParser;

      const dependencies = await tracker.findDependencies(workspaceId, xhtmlItem);

      // Should gracefully handle missing DOMParser
      expect(Array.isArray(dependencies)).toBe(true);

      // Restore DOMParser
      globalThis.DOMParser = originalDOMParser;
    });
  });
});
