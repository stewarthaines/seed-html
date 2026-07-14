/**
 * ContentService TDD Tests - Following Contract Specifications
 *
 * These tests implement the behavioral contracts from CONTENT_SERVICE_CONTRACT.md
 * following the TDD Red-Green-Refactor cycle.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { TransformExecutor, TransformContext } from '../../transform/transform-executor.js';
import type { TranslationFunction } from '../../i18n/types.js';
import { SAMPLE_MSGIDS } from '../../content/types.js';
import { ContentService } from './content.service.js';

// Test utilities and mocks
function createMockTransformExecutor(): jest.Mocked<TransformExecutor> {
  return {
    executeTextTransform: vi.fn().mockImplementation(async (script, scriptName, text, context) => {
      // Add small delay to simulate real transformation time
      await new Promise(resolve => setTimeout(resolve, 10));

      // Mock markdown-to-HTML transformation
      if (text.includes('# ')) {
        return text
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      }
      if (text.includes('```javascript')) {
        throw new Error('Unclosed code block');
      }
      return `<p>${text}</p>`;
    }),
    executeDOMTransform: vi.fn().mockResolvedValue(document.createElement('html')),
  } as any;
}

// Minimal sample-content catalogs consumed by SampleContentGenerator (via
// getCatalogs). Each locale must carry the required SAMPLE_MSGIDS keys; chapter
// content is markdown (starts with "# ").
function sampleMessages(label: string): Record<string, string> {
  return {
    [SAMPLE_MSGIDS.bookTitle]: `${label} Sample Book`,
    [SAMPLE_MSGIDS.bookDescription]: `${label} description`,
    [SAMPLE_MSGIDS.authorName]: `${label} Author`,
    [SAMPLE_MSGIDS.publisherName]: `${label} Publisher`,
    [SAMPLE_MSGIDS.chapter1Title]: `${label} Chapter 1`,
    [SAMPLE_MSGIDS.chapter1Content]: `# ${label} Chapter 1\n\nSample content.`,
  };
}

const mockSampleCatalogs: Record<
  string,
  { locale: string; messages: Record<string, string>; headers: Record<string, string> }
> = {
  en: { locale: 'en', messages: sampleMessages('English'), headers: {} },
  fr: { locale: 'fr', messages: sampleMessages('French'), headers: {} },
  ar: { locale: 'ar', messages: sampleMessages('Arabic'), headers: {} },
};

function createMockI18nSystem() {
  const mockTranslate: TranslationFunction = vi.fn().mockImplementation((key, params = {}) => {
    const translations: Record<string, string> = {
      'navigation.title': 'Navigation',
      'navigation.tableOfContents': 'Table of Contents',
      'content.chapter1': 'Chapter 1',
      'content.chapter2': 'Chapter 2',
      'sample.title': 'Sample Book Title',
      'sample.author': 'Sample Author',
      'sample.description': 'A sample book for demonstration',
    };

    let translation = translations[key] || key;

    // Simple parameter substitution
    Object.entries(params).forEach(([param, value]) => {
      translation = translation.replace(`{${param}}`, String(value));
    });

    return translation;
  });

  return {
    translate: mockTranslate,
    getCatalogs: vi.fn().mockReturnValue(mockSampleCatalogs),
    isInitialized: vi.fn().mockReturnValue(true),
    getCurrentLocale: vi.fn().mockReturnValue('en'),
  };
}

describe('ContentService Contract Tests', () => {
  let service: ContentService;
  let mockTransformExecutor: jest.Mocked<TransformExecutor>;
  let mockI18nSystem: any;

  beforeEach(() => {
    mockTransformExecutor = createMockTransformExecutor();
    mockI18nSystem = createMockI18nSystem();
    service = new ContentService(mockTransformExecutor, mockI18nSystem);
  });

  describe('Contract: Content Transformation', () => {
    test('transformContent converts markdown to XHTML', async () => {
      const sourceText = '# Chapter 1\n\nHello **world**!';
      const context: TransformContext = {};

      const result = await service.transformContent(sourceText, context);

      // CONTRACT: MUST return valid XHTML
      expect(result.xhtml).toContain('<h1>Chapter 1</h1>');
      expect(result.xhtml).toContain('<strong>world</strong>');
      expect(result.warnings).toEqual([]);
      expect(result.transformTime).toBeGreaterThan(0);
    });

    test('transformContent handles transform errors gracefully', async () => {
      const invalidText = '```javascript\nunclosed code block';

      const result = await service.transformContent(invalidText, {});

      // CONTRACT: MUST handle errors gracefully
      expect(result.xhtml).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('code block');
    });
  });

  describe('Contract: Navigation Generation', () => {
    test('generateNavigationFromContent creates valid EPUB navigation', () => {
      const chapters = [
        {
          id: 'chapter1',
          href: 'Text/chapter1.xhtml',
          xhtmlContent:
            '<html><body><h1>Chapter 1: The Beginning</h1><p>Content...</p></body></html>',
          linear: true,
          mediaType: 'application/xhtml+xml',
        },
        {
          id: 'chapter2',
          href: 'Text/chapter2.xhtml',
          xhtmlContent: '<html><body><h1>Chapter 2: The Middle</h1><p>Content...</p></body></html>',
          linear: true,
          mediaType: 'application/xhtml+xml',
        },
      ];

      const result = service.generateNavigationFromContent(chapters);

      // CONTRACT: MUST return EPUB-compliant navigation
      expect(result.xhtmlContent).toContain('epub:type="toc"');
      expect(result.xhtmlContent).toContain('role="doc-toc"');
      expect(result.xhtmlContent).toContain(
        '<a href="Text/chapter1.xhtml">Chapter 1: The Beginning</a>'
      );
      expect(result.xhtmlContent).toContain(
        '<a href="Text/chapter2.xhtml">Chapter 2: The Middle</a>'
      );
      expect(result.metadata.properties).toEqual(['nav']);
    });

    test('generateNavigationFromContent extracts titles from XHTML headings', () => {
      const chapters = [
        {
          id: 'intro',
          href: 'Text/intro.xhtml',
          xhtmlContent:
            '<html><body><h2>Introduction to the Story</h2><p>Content...</p></body></html>',
          linear: true,
          mediaType: 'application/xhtml+xml',
        },
      ];

      const result = service.generateNavigationFromContent(chapters);

      // CONTRACT: MUST extract title from first heading in XHTML
      expect(result.xhtmlContent).toContain(
        '<a href="Text/intro.xhtml">Introduction to the Story</a>'
      );
    });

    test('generateNavigationFromContent uses fallback titles for headingless content', () => {
      const chapters = [
        {
          id: 'chapter1',
          href: 'Text/chapter1.xhtml',
          xhtmlContent: '<html><body><p>Content without heading...</p></body></html>',
          linear: true,
          mediaType: 'application/xhtml+xml',
        },
      ];

      const result = service.generateNavigationFromContent(chapters);

      // CONTRACT: MUST use filename fallback when no heading found
      expect(result.xhtmlContent).toContain('<a href="Text/chapter1.xhtml">chapter1</a>');
    });

    test('generateNavigationFromContent handles empty chapters array', () => {
      const result = service.generateNavigationFromContent([]);

      // CONTRACT: MUST handle empty chapters gracefully
      expect(result.xhtmlContent).toContain('epub:type="toc"');
      expect(result.xhtmlContent).toMatch(/<ol>\s*<\/ol>/); // Empty list (with possible whitespace)
      expect(result.metadata.id).toBe('nav');
    });

    test('generateNavigationFromContent skips non-linear chapters', () => {
      const chapters = [
        {
          id: 'chapter1',
          href: 'Text/chapter1.xhtml',
          xhtmlContent: '<html><body><h1>Chapter 1</h1></body></html>',
          linear: true,
          mediaType: 'application/xhtml+xml',
        },
        {
          id: 'appendix',
          href: 'Text/appendix.xhtml',
          xhtmlContent: '<html><body><h1>Appendix</h1></body></html>',
          linear: false,
          mediaType: 'application/xhtml+xml',
        },
      ];

      const result = service.generateNavigationFromContent(chapters);

      // CONTRACT: MUST only include linear chapters in navigation
      expect(result.xhtmlContent).toContain('Chapter 1');
      expect(result.xhtmlContent).not.toContain('Appendix');
    });
  });

  describe('Contract: Sample Content Generation', () => {
    test('generateLocalizedContent creates complete localized content', async () => {
      const result = await service.generateLocalizedContent('fr');

      // CONTRACT: MUST return complete localized content
      expect(result.locale).toBe('fr');
      expect(result.metadata.title).toBeDefined();
      expect(result.metadata.language).toEqual(['fr']);
      expect(result.chapters.length).toBeGreaterThan(0);
      expect(result.chapters[0].content).toContain('# '); // Markdown content
      expect(result.isRTL).toBe(false); // French is LTR
    });

    test('generateLocalizedContent handles RTL languages', async () => {
      const result = await service.generateLocalizedContent('ar');

      // CONTRACT: MUST handle RTL languages correctly
      expect(result.locale).toBe('ar');
      expect(result.isRTL).toBe(true);
      expect(result.pageProgressionDirection).toBe('rtl');
    });

    test('generateLocalizedContent validates locale support', async () => {
      // CONTRACT: MUST reject unsupported locales
      await expect(service.generateLocalizedContent('invalid-locale')).rejects.toThrowError(
        expect.objectContaining({
          name: 'UnsupportedLocaleError',
        })
      );
    });
  });

  describe('Contract: User Navigation Processing', () => {
    test('processUserNavigation transforms markdown to navigation XHTML', () => {
      const userNavText = `
# Table of Contents

- [Chapter 1: The Beginning](Text/chapter1.xhtml)
- [Chapter 2: The Middle](Text/chapter2.xhtml)
- [Chapter 3: The End](Text/chapter3.xhtml)
      `;

      const result = service.processUserNavigation(userNavText);

      // CONTRACT: MUST return EPUB-compliant navigation from user content
      expect(result.xhtmlContent).toContain('epub:type="toc"');
      expect(result.xhtmlContent).toContain('role="doc-toc"');
      expect(result.xhtmlContent).toContain(
        '<a href="Text/chapter1.xhtml">Chapter 1: The Beginning</a>'
      );
    });

    test('processUserNavigation handles plain text navigation', () => {
      const userNavText = `
Table of Contents

Chapter 1 - Text/chapter1.xhtml
Chapter 2 - Text/chapter2.xhtml
      `;

      const result = service.processUserNavigation(userNavText);

      // CONTRACT: MUST parse plain text navigation patterns
      expect(result.xhtmlContent).toContain('epub:type="toc"');
      expect(result.xhtmlContent).toContain('Chapter 1');
      expect(result.xhtmlContent).toContain('Chapter 2');
    });

    test('processUserNavigation handles empty navigation content', () => {
      const result = service.processUserNavigation('');

      // CONTRACT: MUST handle empty navigation gracefully
      expect(result.xhtmlContent).toContain('epub:type="toc"');
      expect(result.xhtmlContent).toContain('<ol></ol>');
      expect(result.metadata.id).toBe('nav');
    });
  });

  describe('Contract: Infrastructure Integration', () => {
    test('uses TransformExecutor for content transformation', async () => {
      const sourceText = 'Test content';
      const context: TransformContext = {};

      await service.transformContent(sourceText, context);

      // CONTRACT: MUST use infrastructure only
      expect(mockTransformExecutor.executeTextTransform).toHaveBeenCalledWith(
        expect.any(String), // script content
        expect.any(String), // script name
        sourceText,
        context
      );
    });

    test('uses I18nSystem for localized content generation', async () => {
      await service.generateLocalizedContent('en');

      // CONTRACT: MUST use I18nSystem for translations
      expect(mockI18nSystem.translate).toHaveBeenCalled();
    });
  });
});
