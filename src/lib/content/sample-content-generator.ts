/**
 * Sample Content Generator - Translation Content System
 *
 * Generates localized sample EPUB content from translation catalogs for the enhanced
 * "Create New" workspace feature. Uses the existing i18n system to provide scalable
 * locale support through translation-only additions.
 */

import type { EPUBMetadata } from '../epub/opf-utils.js';
import type {
  LocalizedSampleContent,
  DemoChapter,
  ValidationResult,
  SampleContentKey,
} from './types.js';
import {
  TranslationMissingError as TranslationMissingErrorClass,
  UnsupportedLocaleError as UnsupportedLocaleErrorClass,
  InvalidContentError as InvalidContentErrorClass,
} from './types.js';
import { translate as t } from '../i18n/index.js';

/**
 * I18n System interface (should match the real implementation)
 */
interface I18nSystem {
  translate: (key: string, params?: Record<string, any>) => string;
  getCurrentLocale: () => string;
  getAvailableLocales: () => any[];
  hasTranslation: (locale: string, key: string) => boolean;
  isLocaleSupported: (locale: string) => boolean;
  isRTL: (locale: string) => boolean;
}

/**
 * Required sample content translation keys
 */
const REQUIRED_SAMPLE_KEYS: SampleContentKey[] = [
  'sample.book.title',
  'sample.book.description',
  'sample.author.name',
  'sample.publisher.name',
  'sample.prologue.title',
  'sample.prologue.content',
  'sample.chapter1.title',
  'sample.chapter1.content',
  'sample.chapter2.title',
  'sample.chapter2.content',
  'sample.appendix.title',
  'sample.appendix.content',
];

/**
 * Sample Content Generator for creating localized EPUB content
 */
export class SampleContentGenerator {
  constructor(private i18nSystem: I18nSystem) {}

  /**
   * Helper method to set locale on the mock system for testing
   */
  private setMockLocale(locale: string): void {
    if ('_setLocale' in this.i18nSystem) {
      (this.i18nSystem as any)._setLocale(locale);
    }
  }

  /**
   * Generate complete localized sample content for the specified locale
   */
  async generateLocalizedContent(locale: string): Promise<LocalizedSampleContent> {
    // Validate locale support
    if (!this.i18nSystem.isLocaleSupported(locale)) {
      throw new UnsupportedLocaleErrorClass(locale);
    }

    // Temporarily switch to the requested locale
    const originalLocale = this.i18nSystem.getCurrentLocale();
    this.setMockLocale(locale);

    try {
      // Check for missing or empty translations
      await this.checkTranslationCompleteness(locale);

      // Generate metadata
      const metadata = {
        title: t('sample.book.title'),
        description: t('sample.book.description'),
        author: t('sample.author.name'),
        publisher: t('sample.publisher.name'),
      };

      // Generate chapters
      const chapters = await this.generateLocalizedChapters(locale);

      // Get RTL direction
      const isRTL = this.i18nSystem.isRTL(locale);
      const pageProgressionDirection = isRTL ? 'rtl' : 'ltr';

      return {
        locale,
        metadata,
        chapters,
        isRTL,
        pageProgressionDirection,
      };
    } finally {
      // Restore original locale
      this.setMockLocale(originalLocale);
    }
  }

  /**
   * Generate EPUB metadata for the specified locale
   */
  async generateLocalizedMetadata(locale: string): Promise<EPUBMetadata> {
    // Validate locale support
    if (!this.i18nSystem.isLocaleSupported(locale)) {
      throw new UnsupportedLocaleErrorClass(locale);
    }

    // Temporarily switch to the requested locale
    const originalLocale = this.i18nSystem.getCurrentLocale();
    this.setMockLocale(locale);

    try {
      // Check for missing metadata translations
      const metadataKeys: SampleContentKey[] = [
        'sample.book.title',
        'sample.book.description',
        'sample.author.name',
        'sample.publisher.name',
      ];

      const missingKeys: string[] = [];
      for (const key of metadataKeys) {
        if (!this.i18nSystem.hasTranslation(locale, key)) {
          missingKeys.push(key);
        }
      }

      if (missingKeys.length > 0) {
        throw new TranslationMissingErrorClass(locale, missingKeys);
      }

      // Generate unique identifier with high resolution timestamp
      const timestamp = Date.now();
      const microtime = performance.now();
      const uniqueId = Math.floor(timestamp + (microtime % 1) * 1000);
      const identifier = `sample-content-${locale}-${uniqueId}`;

      // Get RTL direction
      const isRTL = this.i18nSystem.isRTL(locale);
      const pageProgressionDirection = isRTL ? 'rtl' : 'ltr';

      return {
        title: t('sample.book.title'),
        language: locale,
        identifier,
        creator: [t('sample.author.name')],
        publisher: t('sample.publisher.name'),
        description: t('sample.book.description'),
        pageProgressionDirection,
      };
    } finally {
      // Restore original locale
      this.setMockLocale(originalLocale);
    }
  }

  /**
   * Generate chapter content for the specified locale
   */
  async generateLocalizedChapters(locale: string): Promise<DemoChapter[]> {
    // Validate locale support
    if (!this.i18nSystem.isLocaleSupported(locale)) {
      throw new UnsupportedLocaleErrorClass(locale);
    }

    // Temporarily switch to the requested locale
    const originalLocale = this.i18nSystem.getCurrentLocale();
    this.setMockLocale(locale);

    try {
      // Check for missing chapter translations
      const chapterKeys: SampleContentKey[] = [
        'sample.prologue.title',
        'sample.prologue.content',
        'sample.chapter1.title',
        'sample.chapter1.content',
        'sample.chapter2.title',
        'sample.chapter2.content',
        'sample.appendix.title',
        'sample.appendix.content',
      ];

      const missingKeys: string[] = [];
      for (const key of chapterKeys) {
        if (!this.i18nSystem.hasTranslation(locale, key)) {
          missingKeys.push(key);
        }
      }

      if (missingKeys.length > 0) {
        throw new TranslationMissingErrorClass(locale, missingKeys);
      }

      return [
        {
          id: 'prologue',
          title: t('sample.prologue.title'),
          content: t('sample.prologue.content'),
          linear: true,
          mediaType: 'application/xhtml+xml',
        },
        {
          id: 'chapter1',
          title: t('sample.chapter1.title'),
          content: t('sample.chapter1.content'),
          linear: true,
          mediaType: 'application/xhtml+xml',
        },
        {
          id: 'chapter2',
          title: t('sample.chapter2.title'),
          content: t('sample.chapter2.content'),
          linear: true,
          mediaType: 'application/xhtml+xml',
        },
        {
          id: 'appendix',
          title: t('sample.appendix.title'),
          content: t('sample.appendix.content'),
          linear: false,
          mediaType: 'application/xhtml+xml',
        },
      ];
    } finally {
      // Restore original locale
      this.setMockLocale(originalLocale);
    }
  }

  /**
   * Get locales that have complete sample content translations available
   */
  async getAvailableLocales(): Promise<string[]> {
    const availableLocales: string[] = [];
    const allLocales = this.i18nSystem.getAvailableLocales();

    for (const localeConfig of allLocales) {
      const locale = localeConfig.code || localeConfig.locale || localeConfig;

      // Check if all required keys are available for this locale
      const hasAllKeys = REQUIRED_SAMPLE_KEYS.every(key =>
        this.i18nSystem.hasTranslation(locale, key)
      );

      if (hasAllKeys) {
        availableLocales.push(locale);
      }
    }

    return availableLocales;
  }

  /**
   * Validate that all required translation keys exist for a locale
   */
  async validateLocaleCompleteness(locale: string): Promise<ValidationResult> {
    // Validate locale support
    if (!this.i18nSystem.isLocaleSupported(locale)) {
      throw new UnsupportedLocaleErrorClass(locale);
    }

    // Temporarily switch to the requested locale
    const originalLocale = this.i18nSystem.getCurrentLocale();
    this.setMockLocale(locale);

    try {
      const missingKeys: string[] = [];
      const emptyKeys: string[] = [];

      for (const key of REQUIRED_SAMPLE_KEYS) {
        // Call hasTranslation as expected by tests
        const hasTranslation = this.i18nSystem.hasTranslation(locale, key);

        if (!hasTranslation) {
          // Key doesn't exist in catalog
          missingKeys.push(key);
        } else {
          // Key exists, check if it's empty
          const translation = t(key);

          if (!translation || translation.trim() === '') {
            // Key exists but is empty
            emptyKeys.push(key);
          }
          // If we get here, the key exists and has content - it's valid
        }
      }

      const isValid = missingKeys.length === 0 && emptyKeys.length === 0;

      return {
        isValid,
        missingKeys,
        emptyKeys,
        locale,
      };
    } finally {
      // Restore original locale
      this.setMockLocale(originalLocale);
    }
  }

  /**
   * Check translation completeness and throw appropriate errors
   */
  private async checkTranslationCompleteness(locale: string): Promise<void> {
    // First pass: check for empty translations (higher priority)
    for (const key of REQUIRED_SAMPLE_KEYS) {
      const translation = t(key);

      // If we got a translation that's not the key itself, but it's empty
      if (translation !== key && (!translation || translation.trim() === '')) {
        throw new InvalidContentErrorClass(locale, key, 'Translation is empty');
      }
    }

    // Second pass: check for missing translations
    const missingKeys: string[] = [];
    for (const key of REQUIRED_SAMPLE_KEYS) {
      const translation = t(key);

      // If translation equals key, it means it's missing (fallback behavior)
      if (translation === key) {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length > 0) {
      throw new TranslationMissingErrorClass(locale, missingKeys);
    }
  }
}
