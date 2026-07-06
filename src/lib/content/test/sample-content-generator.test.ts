/**
 * Unit tests for SampleContentGenerator
 *
 * Comprehensive test suite following TDD principles - these tests are written
 * BEFORE the implementation exists and should FAIL initially, proving the TDD approach.
 *
 * Tests cover all public API methods with both success and error scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SampleContentGenerator } from '../sample-content-generator.js';
import type { TranslationCatalog } from '../../i18n/types.js';
import {
  SAMPLE_MSGIDS,
  TranslationMissingError,
  UnsupportedLocaleError,
  InvalidContentError,
  type DemoChapter,
} from '../types.js';
import {
  expectLocalizedContent,
  expectDemoChapters,
  expectEPUBMetadata,
  expectValidationResult,
  TEST_LOCALES,
} from './test-utils.js';

describe('SampleContentGenerator', () => {
  let generator: SampleContentGenerator;
  let catalogs: Record<string, TranslationCatalog>;

  beforeEach(() => {
    // Create complete translation catalogs for testing
    catalogs = {
      en: {
        locale: 'en',
        messages: {
          [SAMPLE_MSGIDS.bookTitle]: 'Introduction to EPUB',
          [SAMPLE_MSGIDS.bookDescription]: 'A comprehensive guide to EPUB creation',
          [SAMPLE_MSGIDS.authorName]: 'EDITME Editorial Team',
          [SAMPLE_MSGIDS.publisherName]: 'EDITME Publishing',
          [SAMPLE_MSGIDS.chapter1Title]: 'Getting Started',
          [SAMPLE_MSGIDS.chapter1Content]:
            '# This is a Heading 1\n\nA heading 1 (H1) is the main title of a document, created with a single hash mark.\n\n## This is a Heading 2\n\nA heading 2 (H2) is a section heading, created with two hash marks.\n\n**This text is bold** - Bold text adds strong emphasis and is created by wrapping text in double asterisks.\n\n*This text is emphasized* - Emphasized text (usually italic) adds mild emphasis and is created by wrapping text in single asterisks.',
        },
        headers: {},
      },
      fr: {
        locale: 'fr',
        messages: {
          [SAMPLE_MSGIDS.bookTitle]: 'Introduction à EPUB',
          [SAMPLE_MSGIDS.bookDescription]: 'Un guide complet pour la création EPUB',
          [SAMPLE_MSGIDS.authorName]: 'Équipe éditoriale EDITME',
          [SAMPLE_MSGIDS.publisherName]: 'Éditions EDITME',
          [SAMPLE_MSGIDS.chapter1Title]: 'Premiers pas',
          [SAMPLE_MSGIDS.chapter1Content]:
            "# Ceci est un titre 1\n\nUn titre 1 (H1) est le titre principal d'un document, créé avec un seul dièse.\n\n## Ceci est un titre 2\n\nUn titre 2 (H2) est un titre de section, créé avec deux dièses.\n\n**Ce texte est en gras** - Le texte en gras ajoute une forte emphase et est créé en encadrant le texte de doubles astérisques.\n\n*Ce texte est mis en emphase* - Le texte mis en emphase (généralement italique) ajoute une emphase légère et est créé en encadrant le texte d'astérisques simples.",
        },
        headers: {},
      },
      de: {
        locale: 'de',
        messages: {
          [SAMPLE_MSGIDS.bookTitle]: 'Einführung in EPUB',
          [SAMPLE_MSGIDS.bookDescription]: 'Ein umfassender Leitfaden zur EPUB-Erstellung',
          [SAMPLE_MSGIDS.authorName]: 'EDITME Redaktionsteam',
          [SAMPLE_MSGIDS.publisherName]: 'EDITME Publikationen',
          [SAMPLE_MSGIDS.chapter1Title]: 'Erste Schritte',
          [SAMPLE_MSGIDS.chapter1Content]:
            '# Das ist eine Überschrift 1\n\nEine Überschrift 1 (H1) ist der Haupttitel eines Dokuments, erstellt mit einem einzigen Rautezeichen.\n\n## Das ist eine Überschrift 2\n\nEine Überschrift 2 (H2) ist eine Abschnittsüberschrift, erstellt mit zwei Rautezeichen.\n\n**Dieser Text ist fett** - Fetter Text fügt starke Betonung hinzu und wird erstellt, indem Text in doppelte Sternchen eingeschlossen wird.\n\n*Dieser Text ist hervorgehoben* - Hervorgehobener Text (normalerweise kursiv) fügt leichte Betonung hinzu und wird erstellt, indem Text in einfache Sternchen eingeschlossen wird.',
        },
        headers: {},
      },
      ar: {
        locale: 'ar',
        messages: {
          [SAMPLE_MSGIDS.bookTitle]: 'مقدمة إلى EPUB',
          [SAMPLE_MSGIDS.bookDescription]: 'دليل شامل لإنشاء EPUB',
          [SAMPLE_MSGIDS.authorName]: 'فريق تحرير EDITME',
          [SAMPLE_MSGIDS.publisherName]: 'منشورات EDITME',
          [SAMPLE_MSGIDS.chapter1Title]: 'البداية',
          [SAMPLE_MSGIDS.chapter1Content]:
            '# هذا عنوان 1\n\nالعنوان 1 (H1) هو العنوان الرئيسي للوثيقة، يُنشأ بعلامة مربع واحدة.\n\n## هذا عنوان 2\n\nالعنوان 2 (H2) هو عنوان قسم، يُنشأ بعلامتي مربع.\n\n**هذا النص غامق** - النص الغامق يضيف تأكيداً قوياً ويُنشأ بوضع النص بين نجمتين مزدوجتين.\n\n*هذا النص مؤكد* - النص المؤكد (عادة مائل) يضيف تأكيداً خفيفاً ويُنشأ بوضع النص بين نجمتين مفردتين.',
        },
        headers: {},
      },
    };

    // Create generator instance with catalogs
    generator = new SampleContentGenerator(catalogs);
  });

  describe('constructor', () => {
    it('should create instance with valid I18nSystem', () => {
      expect(generator).toBeInstanceOf(SampleContentGenerator);
      expect(generator).toBeDefined();
    });

    it('should store translation catalogs', () => {
      // Verify the catalogs are properly stored
      expect(generator).toBeDefined();
    });
  });

  describe('generateLocalizedContent()', () => {
    describe('successful content generation', () => {
      it('should generate complete English content', async () => {
        const result = await generator.generateLocalizedContent('en');

        // Verify structure matches LocalizedSampleContent interface
        expectLocalizedContent(result, 'en', 1);

        // Verify specific content
        expect(result.locale).toBe('en');
        expect(result.isRTL).toBe(false);
        expect(result.pageProgressionDirection).toBe('ltr');
        expect(result.metadata.title).toBe('Introduction to EPUB');
        expect(result.chapters).toHaveLength(1);

        // Verify chapters are in correct order
        expect(result.chapters[0].id).toBe('chapter01');

        // Verify linear property
        expect(result.chapters[0].linear).toBe(true); // appendix is non-linear
      });

      it('should generate complete German content', async () => {
        const result = await generator.generateLocalizedContent('de');

        expectLocalizedContent(result, 'de', 1);
        expect(result.locale).toBe('de');
        expect(result.isRTL).toBe(false);
        expect(result.pageProgressionDirection).toBe('ltr');
        expect(result.metadata.title).toBe('Einführung in EPUB');
        expect(result.metadata.author).toBe('EDITME Redaktionsteam');
      });

      it('should generate complete Arabic content with RTL support', async () => {
        const result = await generator.generateLocalizedContent('ar');

        expectLocalizedContent(result, 'ar', 1);
        expect(result.locale).toBe('ar');
        expect(result.isRTL).toBe(true);
        expect(result.pageProgressionDirection).toBe('rtl');
        expect(result.metadata.title).toBe('مقدمة إلى EPUB');
        expect(result.metadata.author).toBe('فريق تحرير EDITME');
      });
    });

    describe('error handling', () => {
      it('should throw UnsupportedLocaleError for invalid locale', async () => {
        await expect(generator.generateLocalizedContent('invalid-xx')).rejects.toThrow(
          UnsupportedLocaleError
        );

        await expect(generator.generateLocalizedContent('invalid-xx')).rejects.toThrow(
          'Unsupported locale: invalid-xx'
        );
      });

      it('should throw TranslationMissingError for missing keys', async () => {
        // Create catalog missing some keys
        const incompleteCatalogs = {
          incomplete: {
            locale: 'incomplete',
            messages: {
              [SAMPLE_MSGIDS.bookTitle]: 'Test Title',
              // Missing other required keys
            },
            headers: {},
          },
        };
        const incompleteGenerator = new SampleContentGenerator(incompleteCatalogs);

        await expect(incompleteGenerator.generateLocalizedContent('incomplete')).rejects.toThrow(
          TranslationMissingError
        );
      });

      it('should throw InvalidContentError for empty translations', async () => {
        // Create catalog with empty translations
        const emptyCatalogs = {
          empty: {
            locale: 'empty',
            messages: {
              [SAMPLE_MSGIDS.bookTitle]: '', // Empty translation
              [SAMPLE_MSGIDS.bookDescription]: 'Valid description',
              [SAMPLE_MSGIDS.authorName]: 'Valid author',
              [SAMPLE_MSGIDS.publisherName]: 'Valid publisher',
              [SAMPLE_MSGIDS.chapter1Title]: 'Valid title',
              [SAMPLE_MSGIDS.chapter1Content]: 'Valid content',
            },
            headers: {},
          },
        };
        const emptyGenerator = new SampleContentGenerator(emptyCatalogs);

        await expect(emptyGenerator.generateLocalizedContent('empty')).rejects.toThrow(
          InvalidContentError
        );

        await expect(emptyGenerator.generateLocalizedContent('empty')).rejects.toThrow(
          `Invalid content for empty.${SAMPLE_MSGIDS.bookTitle}: Translation is empty`
        );
      });
    });
  });

  describe('generateLocalizedMetadata()', () => {
    describe('successful metadata generation', () => {
      it('should generate EPUB metadata for English', async () => {
        const result = await generator.generateLocalizedMetadata('en');

        expectEPUBMetadata(result, 'en');
        expect(result.title).toBe('Introduction to EPUB');
        expect(result.language).toEqual(['en']);
        expect(result.creator).toEqual([{ name: 'EDITME Editorial Team', roles: [] }]);
        expect(result.publisher).toBe('EDITME Publishing');
        expect(result.pageProgressionDirection).toBe('ltr');
      });

      it('should generate EPUB metadata for Arabic with RTL', async () => {
        const result = await generator.generateLocalizedMetadata('ar');

        expectEPUBMetadata(result, 'ar');
        expect(result.title).toBe('مقدمة إلى EPUB');
        expect(result.language).toEqual(['ar']);
        expect(result.creator).toEqual([{ name: 'فريق تحرير EDITME', roles: [] }]);
        expect(result.pageProgressionDirection).toBe('rtl');
      });

      it('should generate unique identifiers', async () => {
        const result1 = await generator.generateLocalizedMetadata('en');
        const result2 = await generator.generateLocalizedMetadata('en');

        expect(result1.identifier).not.toBe(result2.identifier);
        expect(result1.identifier).toMatch(/^sample-content-en-\d+$/);
        expect(result2.identifier).toMatch(/^sample-content-en-\d+$/);
      });

      it('should include all required EPUB metadata fields', async () => {
        const result = await generator.generateLocalizedMetadata('de');

        // Verify all required Dublin Core fields are present
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('language');
        expect(result).toHaveProperty('identifier');
        expect(result).toHaveProperty('creator');
        expect(result).toHaveProperty('publisher');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('pageProgressionDirection');

        // Verify creator is an array (EPUB spec requirement)
        expect(Array.isArray(result.creator)).toBe(true);
        expect(result.creator?.length).toBeGreaterThan(0);
      });
    });

    describe('error handling', () => {
      it('should throw UnsupportedLocaleError for invalid locale', async () => {
        await expect(generator.generateLocalizedMetadata('invalid-xx')).rejects.toThrow(
          UnsupportedLocaleError
        );
      });

      it('should succeed for locale with complete metadata keys', async () => {
        const result = await generator.generateLocalizedMetadata('fr');

        expectEPUBMetadata(result, 'fr');
        expect(result.title).toBe('Introduction à EPUB');
        expect(result.creator).toEqual([{ name: 'Équipe éditoriale EDITME', roles: [] }]);
        expect(result.publisher).toBe('Éditions EDITME');
      });
    });
  });

  describe('generateLocalizedChapters()', () => {
    describe('successful chapter generation', () => {
      it('should generate chapters for English', async () => {
        const result = await generator.generateLocalizedChapters('en');

        expectDemoChapters(result, 1);

        // Verify first chapter structure
        expect(result[0]).toEqual({
          id: 'chapter01',
          title: 'Getting Started',
          content: expect.stringContaining('# This is a Heading 1'),
          linear: true,
          mediaType: 'application/xhtml+xml',
        });
      });

      it('should generate chapters for German', async () => {
        const result = await generator.generateLocalizedChapters('de');

        expectDemoChapters(result, 1);
        expect(result[0].title).toBe('Erste Schritte');
      });

      it('should generate chapters for Arabic', async () => {
        const result = await generator.generateLocalizedChapters('ar');

        expectDemoChapters(result, 1);
        expect(result[0].title).toBe('البداية');
      });

      it('should set correct mediaType for all chapters', async () => {
        const result = await generator.generateLocalizedChapters('en');

        result.forEach((chapter: DemoChapter) => {
          expect(chapter.mediaType).toBe('application/xhtml+xml');
        });
      });

      it('should preserve chapter order', async () => {
        const result = await generator.generateLocalizedChapters('en');

        const expectedOrder = ['chapter01'];
        const actualOrder = result.map((chapter: DemoChapter) => chapter.id);

        expect(actualOrder).toEqual(expectedOrder);
      });
    });

    describe('error handling', () => {
      it('should throw UnsupportedLocaleError for invalid locale', async () => {
        await expect(generator.generateLocalizedChapters('invalid-xx')).rejects.toThrow(
          UnsupportedLocaleError
        );
      });

      it('should throw TranslationMissingError for missing chapter keys', async () => {
        // Create catalog missing chapter keys
        const incompleteCatalogs = {
          incomplete: {
            locale: 'incomplete',
            messages: {
              [SAMPLE_MSGIDS.bookTitle]: 'Test Title',
              [SAMPLE_MSGIDS.bookDescription]: 'Test Description',
              [SAMPLE_MSGIDS.authorName]: 'Test Author',
              [SAMPLE_MSGIDS.publisherName]: 'Test Publisher',
              // Missing chapter keys
            },
            headers: {},
          },
        };
        const incompleteGenerator = new SampleContentGenerator(incompleteCatalogs);

        await expect(incompleteGenerator.generateLocalizedChapters('incomplete')).rejects.toThrow(
          TranslationMissingError
        );
      });
    });
  });

  describe('getAvailableLocales()', () => {
    it('should return locales with complete translations', async () => {
      const result = await generator.getAvailableLocales();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(expect.arrayContaining(['en', 'fr', 'de', 'ar']));
      expect(result).toHaveLength(4);
    });

    it('should only include locales with all required keys', async () => {
      // Create catalog with incomplete translations
      const mixedCatalogs = {
        ...catalogs,
        incomplete: {
          locale: 'incomplete',
          messages: {
            [SAMPLE_MSGIDS.bookTitle]: 'Test Title',
            // Missing other required keys
          },
          headers: {},
        },
      };
      const mixedGenerator = new SampleContentGenerator(mixedCatalogs);

      const result = await mixedGenerator.getAvailableLocales();

      // Should not include 'incomplete' which is missing keys
      expect(result).not.toContain('incomplete');
      // Should still include complete locales
      expect(result).toContain('en');
      expect(result).toContain('de');
      expect(result).toContain('ar');
      expect(result).toContain('fr');
    });

    it('should return empty array if no complete locales', async () => {
      // Create catalogs with incomplete translations only
      const emptyCatalogs = {
        incomplete: {
          locale: 'incomplete',
          messages: {
            [SAMPLE_MSGIDS.bookTitle]: 'Test Title',
            // Missing other required keys
          },
          headers: {},
        },
      };
      const emptyGenerator = new SampleContentGenerator(emptyCatalogs);

      const result = await emptyGenerator.getAvailableLocales();

      expect(result).toEqual([]);
    });
  });

  describe('validateLocaleCompleteness()', () => {
    describe('valid locales', () => {
      it('should validate English as complete', async () => {
        const result = await generator.validateLocaleCompleteness('en');

        expectValidationResult(result, 'en', true, [], []);
      });

      it('should validate German as complete', async () => {
        const result = await generator.validateLocaleCompleteness('de');

        expectValidationResult(result, 'de', true, [], []);
      });

      it('should validate Arabic as complete', async () => {
        const result = await generator.validateLocaleCompleteness('ar');

        expectValidationResult(result, 'ar', true, [], []);
      });
    });

    describe('incomplete locales', () => {
      it('should identify missing translation keys', async () => {
        // Create catalog missing some keys
        const incompleteCatalogs = {
          incomplete: {
            locale: 'incomplete',
            messages: {
              [SAMPLE_MSGIDS.bookTitle]: 'Test Title',
              [SAMPLE_MSGIDS.bookDescription]: 'Test Description',
              [SAMPLE_MSGIDS.authorName]: 'Test Author',
              [SAMPLE_MSGIDS.publisherName]: 'Test Publisher',
              // Missing chapter1 keys
            },
            headers: {},
          },
        };
        const incompleteGenerator = new SampleContentGenerator(incompleteCatalogs);

        const result = await incompleteGenerator.validateLocaleCompleteness('incomplete');

        expectValidationResult(
          result,
          'incomplete',
          false,
          [SAMPLE_MSGIDS.chapter1Title, SAMPLE_MSGIDS.chapter1Content],
          []
        );
      });

      it('should identify empty translation keys', async () => {
        // Create catalog with empty keys
        const emptyCatalogs = {
          empty: {
            locale: 'empty',
            messages: {
              [SAMPLE_MSGIDS.bookTitle]: '', // Empty
              [SAMPLE_MSGIDS.bookDescription]: 'Test Description',
              [SAMPLE_MSGIDS.authorName]: 'Test Author',
              [SAMPLE_MSGIDS.publisherName]: 'Test Publisher',
              [SAMPLE_MSGIDS.chapter1Title]: 'Test Chapter 1',
              [SAMPLE_MSGIDS.chapter1Content]: 'Test Content',
            },
            headers: {},
          },
        };
        const emptyGenerator = new SampleContentGenerator(emptyCatalogs);

        const result = await emptyGenerator.validateLocaleCompleteness('empty');

        expectValidationResult(result, 'empty', false, [], [SAMPLE_MSGIDS.bookTitle]);
      });

      it('should handle both missing and empty keys', async () => {
        // Create catalog with both missing and empty keys
        const problematicCatalogs = {
          problematic: {
            locale: 'problematic',
            messages: {
              [SAMPLE_MSGIDS.bookTitle]: '', // Empty
              [SAMPLE_MSGIDS.bookDescription]: 'Test Description',
              [SAMPLE_MSGIDS.authorName]: 'Test Author',
              [SAMPLE_MSGIDS.publisherName]: 'Test Publisher',
              // Missing chapter1 keys
            },
            headers: {},
          },
        };
        const problematicGenerator = new SampleContentGenerator(problematicCatalogs);
        const result = await problematicGenerator.validateLocaleCompleteness('problematic');

        expect(result.isValid).toBe(false);
        expect(result.locale).toBe('problematic');
        expect(result.missingKeys.length + result.emptyKeys.length).toBeGreaterThan(0);
        expect(result.emptyKeys).toContain(SAMPLE_MSGIDS.bookTitle);
        expect(result.missingKeys).toEqual(
          expect.arrayContaining([SAMPLE_MSGIDS.chapter1Title, SAMPLE_MSGIDS.chapter1Content])
        );
      });
    });

    describe('error handling', () => {
      it('should throw UnsupportedLocaleError for invalid locale', async () => {
        await expect(generator.validateLocaleCompleteness('invalid-xx')).rejects.toThrow(
          UnsupportedLocaleError
        );
      });
    });

    describe('validation completeness', () => {
      it('should check all required sample content keys', async () => {
        const result = await generator.validateLocaleCompleteness('en');

        // For complete locale, should have zero missing/empty
        expect(result.isValid).toBe(true);
        expect(result.missingKeys).toHaveLength(0);
        expect(result.emptyKeys).toHaveLength(0);
      });

      it('should return correct key counts', async () => {
        const result = await generator.validateLocaleCompleteness('en');

        // For complete locale, should have zero missing/empty
        expect(result.missingKeys).toHaveLength(0);
        expect(result.emptyKeys).toHaveLength(0);
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle full workflow for multiple locales', async () => {
      // Test generating content for all supported locales
      for (const locale of TEST_LOCALES) {
        const content = await generator.generateLocalizedContent(locale);
        const metadata = await generator.generateLocalizedMetadata(locale);
        const chapters = await generator.generateLocalizedChapters(locale);
        const validation = await generator.validateLocaleCompleteness(locale);

        // All should succeed for supported locales
        expect(content.locale).toBe(locale);
        expect(metadata.language).toEqual([locale]);
        expect(chapters.length).toBe(1);
        expect(validation.isValid).toBe(true);
      }
    });

    it('should maintain consistency between methods', async () => {
      const locale = 'de';

      const content = await generator.generateLocalizedContent(locale);
      const metadata = await generator.generateLocalizedMetadata(locale);
      const chapters = await generator.generateLocalizedChapters(locale);

      // Metadata should match between methods
      expect(content.metadata.title).toBe(metadata.title);
      expect(content.metadata.description).toBe(metadata.description);
      expect(content.metadata.author).toBe(metadata.creator?.[0]?.name);
      expect(content.metadata.publisher).toBe(metadata.publisher);

      // Chapters should match between methods
      expect(content.chapters).toHaveLength(chapters.length);
      content.chapters.forEach((contentChapter: any, index: number) => {
        const methodChapter = chapters[index];
        expect(contentChapter.id).toBe(methodChapter.id);
        expect(contentChapter.title).toBe(methodChapter.title);
        expect(contentChapter.content).toBe(methodChapter.content);
        expect(contentChapter.linear).toBe(methodChapter.linear);
      });
    });

    it('should handle RTL detection consistently', async () => {
      const rtlLocale = 'ar';
      const ltrLocale = 'en';

      const rtlContent = await generator.generateLocalizedContent(rtlLocale);
      const rtlMetadata = await generator.generateLocalizedMetadata(rtlLocale);

      const ltrContent = await generator.generateLocalizedContent(ltrLocale);
      const ltrMetadata = await generator.generateLocalizedMetadata(ltrLocale);

      // RTL locale
      expect(rtlContent.isRTL).toBe(true);
      expect(rtlContent.pageProgressionDirection).toBe('rtl');
      expect(rtlMetadata.pageProgressionDirection).toBe('rtl');

      // LTR locale
      expect(ltrContent.isRTL).toBe(false);
      expect(ltrContent.pageProgressionDirection).toBe('ltr');
      expect(ltrMetadata.pageProgressionDirection).toBe('ltr');
    });
  });

  describe('error type verification', () => {
    it('should create TranslationMissingError with correct properties', async () => {
      // Create catalog missing keys
      const incompleteCatalogs = {
        incomplete: {
          locale: 'incomplete',
          messages: {
            [SAMPLE_MSGIDS.bookTitle]: 'Test Title',
            // Missing other required keys
          },
          headers: {},
        },
      };
      const incompleteGenerator = new SampleContentGenerator(incompleteCatalogs);

      try {
        await incompleteGenerator.generateLocalizedContent('incomplete');
        expect.fail('Expected TranslationMissingError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TranslationMissingError);
        const typedError = error as TranslationMissingError;
        expect(typedError.name).toBe('TranslationMissingError');
        expect(typedError.locale).toBe('incomplete');
        expect(Array.isArray(typedError.missingKeys)).toBe(true);
        expect(typedError.missingKeys.length).toBeGreaterThan(0);
      }
    });

    it('should create UnsupportedLocaleError with correct properties', async () => {
      try {
        await generator.generateLocalizedContent('invalid-xx');
        expect.fail('Expected UnsupportedLocaleError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UnsupportedLocaleError);
        const typedError = error as UnsupportedLocaleError;
        expect(typedError.name).toBe('UnsupportedLocaleError');
        expect(typedError.locale).toBe('invalid-xx');
      }
    });

    it('should create InvalidContentError with correct properties', async () => {
      // Create catalog with empty translations
      const emptyCatalogs = {
        empty: {
          locale: 'empty',
          messages: {
            [SAMPLE_MSGIDS.bookTitle]: '', // Empty translation
            [SAMPLE_MSGIDS.bookDescription]: 'Valid description',
            [SAMPLE_MSGIDS.authorName]: 'Valid author',
            [SAMPLE_MSGIDS.publisherName]: 'Valid publisher',
            [SAMPLE_MSGIDS.chapter1Title]: 'Valid title',
            [SAMPLE_MSGIDS.chapter1Content]: 'Valid content',
          },
          headers: {},
        },
      };
      const emptyGenerator = new SampleContentGenerator(emptyCatalogs);

      try {
        await emptyGenerator.generateLocalizedContent('empty');
        expect.fail('Expected InvalidContentError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidContentError);
        const typedError = error as InvalidContentError;
        expect(typedError.name).toBe('InvalidContentError');
        expect(typedError.locale).toBe('empty');
        expect(typedError.key).toBe(SAMPLE_MSGIDS.bookTitle);
        expect(typedError.reason).toBe('Translation is empty');
      }
    });
  });
});
