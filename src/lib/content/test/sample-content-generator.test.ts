/**
 * Unit tests for SampleContentGenerator
 *
 * Comprehensive test suite following TDD principles - these tests are written
 * BEFORE the implementation exists and should FAIL initially, proving the TDD approach.
 *
 * Tests cover all public API methods with both success and error scenarios.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SampleContentGenerator } from '../sample-content-generator.js';

// Mock the i18n translate function
vi.mock('../../i18n/index.js', () => ({
  translate: vi.fn(),
}));
import {
  TranslationMissingError,
  UnsupportedLocaleError,
  InvalidContentError,
  type DemoChapter,
} from '../types.js';
import {
  createMockI18nSystem,
  createMockI18nSystemWithMissing,
  createMockI18nSystemUnsupported,
  setMockLocale,
  expectLocalizedContent,
  expectDemoChapters,
  expectEPUBMetadata,
  expectValidationResult,
  expectTranslationCalls,
  expectLocaleSupportCheck,
  expectRTLCheck,
  resetAllMocks,
  EXPECTED_SAMPLE_KEYS,
  TEST_LOCALES,
  type MockI18nSystem,
} from './test-utils.js';
import { LOCALE_CONFIGS } from '../../i18n/locale-config.js';
import { expectedAvailableLocales } from './fixtures.js';
import { translate as mockTranslate } from '../../i18n/index.js';

describe('SampleContentGenerator', () => {
  let generator: SampleContentGenerator;
  let mockI18nSystem: MockI18nSystem;

  beforeEach(() => {
    // Create fresh mock for each test
    mockI18nSystem = createMockI18nSystem();

    // Set up global translate mock to use same data as mockI18nSystem
    (mockTranslate as any).mockImplementation((key: string) => 
      mockI18nSystem.translate(key, {})
    );

    // Create generator instance with mock - this should FAIL initially (TDD)
    generator = new SampleContentGenerator(mockI18nSystem as any);

    // Clear mocks after creating but reset to 'en' locale
    vi.clearAllMocks();
    setMockLocale(mockI18nSystem, 'en');
    
    // Re-setup the translate mock after clearing
    (mockTranslate as any).mockImplementation((key: string) => 
      mockI18nSystem.translate(key, {})
    );
  });

  afterEach(() => {
    resetAllMocks(mockI18nSystem);
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid I18nSystem', () => {
      expect(generator).toBeInstanceOf(SampleContentGenerator);
      expect(generator).toBeDefined();
    });

    it('should store I18nSystem reference', () => {
      // Verify the mock system is properly integrated
      expect(mockI18nSystem.getCurrentLocale()).toBe('en');
    });
  });

  describe('generateLocalizedContent()', () => {
    describe('successful content generation', () => {
      it('should generate complete English content', async () => {
        setMockLocale(mockI18nSystem, 'en');

        const result = await generator.generateLocalizedContent('en');

        // Verify structure matches LocalizedSampleContent interface
        expectLocalizedContent(result, 'en', 4);

        // Verify specific content
        expect(result.locale).toBe('en');
        expect(result.isRTL).toBe(false);
        expect(result.pageProgressionDirection).toBe('ltr');
        expect(result.metadata.title).toBe('Introduction to EPUB');
        expect(result.chapters).toHaveLength(4);

        // Verify chapters are in correct order
        expect(result.chapters[0].id).toBe('prologue');
        expect(result.chapters[1].id).toBe('chapter1');
        expect(result.chapters[2].id).toBe('chapter2');
        expect(result.chapters[3].id).toBe('appendix');

        // Verify linear property
        expect(result.chapters[0].linear).toBe(true);
        expect(result.chapters[1].linear).toBe(true);
        expect(result.chapters[2].linear).toBe(true);
        expect(result.chapters[3].linear).toBe(false); // appendix is non-linear
      });

      it('should generate complete German content', async () => {
        setMockLocale(mockI18nSystem, 'de');

        const result = await generator.generateLocalizedContent('de');

        expectLocalizedContent(result, 'de', 4);
        expect(result.locale).toBe('de');
        expect(result.isRTL).toBe(false);
        expect(result.pageProgressionDirection).toBe('ltr');
        expect(result.metadata.title).toBe('Einführung in EPUB');
        expect(result.metadata.author).toBe('EDITME Redaktionsteam');
      });

      it('should generate complete Arabic content with RTL support', async () => {
        setMockLocale(mockI18nSystem, 'ar');

        const result = await generator.generateLocalizedContent('ar');

        expectLocalizedContent(result, 'ar', 4);
        expect(result.locale).toBe('ar');
        expect(result.isRTL).toBe(true);
        expect(result.pageProgressionDirection).toBe('rtl');
        expect(result.metadata.title).toBe('مقدمة إلى EPUB');
        expect(result.metadata.author).toBe('فريق تحرير EDITME');
      });

      it('should verify all required translation keys are called', async () => {
        await generator.generateLocalizedContent('en');

        expectTranslationCalls(mockI18nSystem, [...EXPECTED_SAMPLE_KEYS]);
      });

      it('should verify locale support is checked', async () => {
        await generator.generateLocalizedContent('en');

        expectLocaleSupportCheck(mockI18nSystem, 'en');
      });

      it('should verify RTL direction is checked', async () => {
        await generator.generateLocalizedContent('ar');

        expectRTLCheck(mockI18nSystem, 'ar');
      });
    });

    describe('error handling', () => {
      it('should throw UnsupportedLocaleError for invalid locale', async () => {
        const unsupportedMock = createMockI18nSystemUnsupported();
        const unsupportedGenerator = new SampleContentGenerator(unsupportedMock as any);

        await expect(unsupportedGenerator.generateLocalizedContent('invalid-xx')).rejects.toThrow(
          UnsupportedLocaleError
        );

        await expect(unsupportedGenerator.generateLocalizedContent('invalid-xx')).rejects.toThrow(
          'Unsupported locale: invalid-xx'
        );
      });

      it('should throw TranslationMissingError for missing keys', async () => {
        const missingMock = createMockI18nSystemWithMissing();
        const missingGenerator = new SampleContentGenerator(missingMock as any);

        await expect(missingGenerator.generateLocalizedContent('fr')).rejects.toThrow(
          TranslationMissingError
        );

        await expect(missingGenerator.generateLocalizedContent('fr')).rejects.toThrow(
          'Missing translation keys for locale fr'
        );
      });

      it('should throw InvalidContentError for empty translations', async () => {
        const missingMock = createMockI18nSystemWithMissing();
        const missingGenerator = new SampleContentGenerator(missingMock as any);

        await expect(missingGenerator.generateLocalizedContent('es')).rejects.toThrow(
          InvalidContentError
        );

        await expect(missingGenerator.generateLocalizedContent('es')).rejects.toThrow(
          'Invalid content for es.sample.book.title: Translation is empty'
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
        expect(result.language).toBe('en');
        expect(result.creator).toEqual(['EDITME Editorial Team']);
        expect(result.publisher).toBe('EDITME Publishing');
        expect(result.pageProgressionDirection).toBe('ltr');
      });

      it('should generate EPUB metadata for Arabic with RTL', async () => {
        const result = await generator.generateLocalizedMetadata('ar');

        expectEPUBMetadata(result, 'ar');
        expect(result.title).toBe('مقدمة إلى EPUB');
        expect(result.language).toBe('ar');
        expect(result.creator).toEqual(['فريق تحرير EDITME']);
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
        const unsupportedMock = createMockI18nSystemUnsupported();
        const unsupportedGenerator = new SampleContentGenerator(unsupportedMock as any);

        await expect(unsupportedGenerator.generateLocalizedMetadata('invalid-xx')).rejects.toThrow(
          UnsupportedLocaleError
        );
      });

      it('should succeed for locale with complete metadata keys', async () => {
        const missingMock = createMockI18nSystemWithMissing();
        const missingGenerator = new SampleContentGenerator(missingMock as any);

        const result = await missingGenerator.generateLocalizedMetadata('fr');

        expectEPUBMetadata(result, 'fr');
        expect(result.title).toBe('Introduction à EPUB');
        expect(result.creator).toEqual(['Équipe éditoriale EDITME']);
        expect(result.publisher).toBe('Éditions EDITME');
      });
    });
  });

  describe('generateLocalizedChapters()', () => {
    describe('successful chapter generation', () => {
      it('should generate chapters for English', async () => {
        const result = await generator.generateLocalizedChapters('en');

        expectDemoChapters(result, 4);

        // Verify first chapter structure
        expect(result[0]).toEqual({
          id: 'prologue',
          title: 'Welcome to Active EPUB',
          content: expect.stringContaining(
            'This document demonstrates the power of **Active EPUB** technology'
          ),
          linear: true,
          mediaType: 'application/xhtml+xml',
        });

        // Verify appendix is non-linear
        expect(result[3]).toEqual({
          id: 'appendix',
          title: 'Technical Reference',
          content: expect.stringContaining('Active EPUBs follow this enhanced structure'),
          linear: false,
          mediaType: 'application/xhtml+xml',
        });
      });

      it('should generate chapters for German', async () => {
        const result = await generator.generateLocalizedChapters('de');

        expectDemoChapters(result, 4);
        expect(result[0].title).toBe('Willkommen zu Active EPUB');
        expect(result[1].title).toBe('Erste Schritte');
        expect(result[2].title).toBe('Erweiterte Funktionen');
        expect(result[3].title).toBe('Technische Referenz');
      });

      it('should generate chapters for Arabic', async () => {
        const result = await generator.generateLocalizedChapters('ar');

        expectDemoChapters(result, 4);
        expect(result[0].title).toBe('مرحباً بكم في Active EPUB');
        expect(result[1].title).toBe('البداية');
        expect(result[2].title).toBe('الميزات المتقدمة');
        expect(result[3].title).toBe('المرجع التقني');
      });

      it('should set correct mediaType for all chapters', async () => {
        const result = await generator.generateLocalizedChapters('en');

        result.forEach((chapter: DemoChapter) => {
          expect(chapter.mediaType).toBe('application/xhtml+xml');
        });
      });

      it('should preserve chapter order', async () => {
        const result = await generator.generateLocalizedChapters('en');

        const expectedOrder = ['prologue', 'chapter1', 'chapter2', 'appendix'];
        const actualOrder = result.map((chapter: DemoChapter) => chapter.id);

        expect(actualOrder).toEqual(expectedOrder);
      });
    });

    describe('error handling', () => {
      it('should throw UnsupportedLocaleError for invalid locale', async () => {
        const unsupportedMock = createMockI18nSystemUnsupported();
        const unsupportedGenerator = new SampleContentGenerator(unsupportedMock as any);

        await expect(unsupportedGenerator.generateLocalizedChapters('invalid-xx')).rejects.toThrow(
          UnsupportedLocaleError
        );
      });

      it('should throw TranslationMissingError for missing chapter keys', async () => {
        const missingMock = createMockI18nSystemWithMissing();
        const missingGenerator = new SampleContentGenerator(missingMock as any);

        await expect(missingGenerator.generateLocalizedChapters('fr')).rejects.toThrow(
          TranslationMissingError
        );
      });
    });
  });

  describe('getAvailableLocales()', () => {
    it('should return locales with complete translations', async () => {
      const result = await generator.getAvailableLocales();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(expect.arrayContaining(expectedAvailableLocales));
      expect(result).toHaveLength(expectedAvailableLocales.length);
    });

    it('should only include locales with all required keys', async () => {
      const missingMock = createMockI18nSystemWithMissing();
      const missingGenerator = new SampleContentGenerator(missingMock as any);

      const result = await missingGenerator.getAvailableLocales();

      // Should not include 'fr' which is missing keys
      expect(result).not.toContain('fr');
      // Should still include complete locales
      expect(result).toContain('en');
      expect(result).toContain('de');
      expect(result).toContain('ar');
    });

    it('should call hasTranslation for each required key', async () => {
      await generator.getAvailableLocales();

      // Verify translation checks were performed
      expect(mockI18nSystem.hasTranslation).toHaveBeenCalled();

      // Should check each key for each locale
      const callCount = (mockI18nSystem.hasTranslation as any).mock.calls.length;
      expect(callCount).toBeGreaterThan(0);
    });

    it('should return empty array if no complete locales', async () => {
      // Create mock that returns false for all hasTranslation calls
      const emptyMock = createMockI18nSystem();
      (emptyMock.hasTranslation as any).mockReturnValue(false);
      const emptyGenerator = new SampleContentGenerator(emptyMock as any);

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
        const missingMock = createMockI18nSystemWithMissing();
        const missingGenerator = new SampleContentGenerator(missingMock as any);

        const result = await missingGenerator.validateLocaleCompleteness('fr');

        expectValidationResult(
          result,
          'fr',
          false,
          [
            'sample.chapter2.title',
            'sample.chapter2.content',
            'sample.appendix.title',
            'sample.appendix.content',
          ],
          []
        );
      });

      it('should identify empty translation keys', async () => {
        const missingMock = createMockI18nSystemWithMissing();
        const missingGenerator = new SampleContentGenerator(missingMock as any);

        const result = await missingGenerator.validateLocaleCompleteness('es');

        expectValidationResult(
          result,
          'es',
          false,
          [],
          ['sample.book.title', 'sample.prologue.content']
        );
      });

      it('should handle both missing and empty keys', async () => {
        // Create mock with both missing and empty keys
        const problematicMock = createMockI18nSystem();
        (problematicMock.hasTranslation as any).mockImplementation(
          (locale: string, key: string) => {
            if (locale === 'problematic') {
              // Some keys missing, some empty
              if (key === 'sample.chapter2.title') return false; // missing
              if (key === 'sample.book.title') return false; // empty (would be caught differently)
              return true;
            }
            return true;
          }
        );

        // Also make the 'problematic' locale supported
        (problematicMock.isLocaleSupported as any).mockImplementation((locale: string) => {
          return locale === 'problematic' || locale in LOCALE_CONFIGS;
        });

        const problematicGenerator = new SampleContentGenerator(problematicMock as any);
        const result = await problematicGenerator.validateLocaleCompleteness('problematic');

        expect(result.isValid).toBe(false);
        expect(result.locale).toBe('problematic');
        expect(result.missingKeys.length + result.emptyKeys.length).toBeGreaterThan(0);
      });
    });

    describe('error handling', () => {
      it('should throw UnsupportedLocaleError for invalid locale', async () => {
        const unsupportedMock = createMockI18nSystemUnsupported();
        const unsupportedGenerator = new SampleContentGenerator(unsupportedMock as any);

        await expect(unsupportedGenerator.validateLocaleCompleteness('invalid-xx')).rejects.toThrow(
          UnsupportedLocaleError
        );
      });
    });

    describe('validation completeness', () => {
      it('should check all required sample content keys', async () => {
        await generator.validateLocaleCompleteness('en');

        // Verify each required key was checked
        EXPECTED_SAMPLE_KEYS.forEach(key => {
          expect(mockI18nSystem.hasTranslation).toHaveBeenCalledWith('en', key);
        });
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
        expect(metadata.language).toBe(locale);
        expect(chapters.length).toBe(4);
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
      expect(content.metadata.author).toBe(metadata.creator?.[0]);
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
      const missingMock = createMockI18nSystemWithMissing();
      const missingGenerator = new SampleContentGenerator(missingMock as any);

      try {
        await missingGenerator.generateLocalizedContent('fr');
        expect.fail('Expected TranslationMissingError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TranslationMissingError);
        const typedError = error as TranslationMissingError;
        expect(typedError.name).toBe('TranslationMissingError');
        expect(typedError.locale).toBe('fr');
        expect(Array.isArray(typedError.missingKeys)).toBe(true);
        expect(typedError.missingKeys.length).toBeGreaterThan(0);
      }
    });

    it('should create UnsupportedLocaleError with correct properties', async () => {
      const unsupportedMock = createMockI18nSystemUnsupported();
      const unsupportedGenerator = new SampleContentGenerator(unsupportedMock as any);

      try {
        await unsupportedGenerator.generateLocalizedContent('invalid-xx');
        expect.fail('Expected UnsupportedLocaleError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UnsupportedLocaleError);
        const typedError = error as UnsupportedLocaleError;
        expect(typedError.name).toBe('UnsupportedLocaleError');
        expect(typedError.locale).toBe('invalid-xx');
      }
    });

    it('should create InvalidContentError with correct properties', async () => {
      const missingMock = createMockI18nSystemWithMissing();
      const missingGenerator = new SampleContentGenerator(missingMock as any);

      try {
        await missingGenerator.generateLocalizedContent('es');
        expect.fail('Expected InvalidContentError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidContentError);
        const typedError = error as InvalidContentError;
        expect(typedError.name).toBe('InvalidContentError');
        expect(typedError.locale).toBe('es');
        expect(typedError.key).toBe('sample.book.title');
        expect(typedError.reason).toBe('Translation is empty');
      }
    });
  });
});
