/**
 * Sample Content Generator - Translation Content System
 *
 * Generates localized sample EPUB content from translation catalogs for the enhanced
 * "Create New" workspace feature. Uses the existing i18n system to provide scalable
 * locale support through translation-only additions.
 */

import type { EPUBMetadata } from '../epub/opf-utils.js';
import type { TranslationCatalog } from '../i18n/types.js';
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


/**
 * Required sample content translation keys
 */
const REQUIRED_SAMPLE_KEYS: SampleContentKey[] = [
  'sample.book.title',
  'sample.book.description',
  'sample.author.name',
  'sample.publisher.name',
  'sample.chapter1.title',
  'sample.chapter1.content',
];

/**
 * Sample Content Generator for creating localized EPUB content
 */
export class SampleContentGenerator {
  constructor(private catalogs: Record<string, TranslationCatalog>) {}


  /**
   * Simple translation method using direct catalog lookup
   */
  private translate(locale: string, key: string): string {
    const catalog = this.catalogs[locale];
    return catalog?.messages[key] || key;
  }

  /**
   * Check if a locale has all required translation keys
   */
  private isLocaleSupported(locale: string): boolean {
    return locale in this.catalogs;
  }

  /**
   * Check if a locale is RTL based on common RTL locales
   */
  private isRTL(locale: string): boolean {
    const rtlLocales = ['ar', 'he', 'fa', 'ur'];
    return rtlLocales.includes(locale);
  }

  /**
   * Check if a translation key exists for a locale
   */
  private hasTranslation(locale: string, key: string): boolean {
    const catalog = this.catalogs[locale];
    if (!catalog) return false;
    
    const translation = catalog.messages[key];
    return translation !== undefined && translation.trim() !== '';
  }

  /**
   * Generate complete localized sample content for the specified locale
   */
  async generateLocalizedContent(locale: string): Promise<LocalizedSampleContent> {
    // Validate locale support
    if (!this.isLocaleSupported(locale)) {
      throw new UnsupportedLocaleErrorClass(locale);
    }

    // Check for missing or empty translations
    await this.checkTranslationCompleteness(locale);

    // Generate metadata
    const metadata = {
      title: this.translate(locale, 'sample.book.title'),
      description: this.translate(locale, 'sample.book.description'),
      author: this.translate(locale, 'sample.author.name'),
      publisher: this.translate(locale, 'sample.publisher.name'),
    };

    // Generate chapters
    const chapters = await this.generateLocalizedChapters(locale);

    // Get RTL direction
    const isRTL = this.isRTL(locale);
    const pageProgressionDirection = isRTL ? 'rtl' : 'ltr';

    return {
      locale,
      metadata,
      chapters,
      isRTL,
      pageProgressionDirection,
    };
  }

  /**
   * Generate EPUB metadata for the specified locale
   */
  async generateLocalizedMetadata(locale: string): Promise<EPUBMetadata> {
    // Validate locale support
    if (!this.isLocaleSupported(locale)) {
      throw new UnsupportedLocaleErrorClass(locale);
    }

    // Check for missing metadata translations
    const metadataKeys: SampleContentKey[] = [
      'sample.book.title',
      'sample.book.description',
      'sample.author.name',
      'sample.publisher.name',
    ];

    const missingKeys: string[] = [];
    for (const key of metadataKeys) {
      if (!this.hasTranslation(locale, key)) {
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
    const isRTL = this.isRTL(locale);
    const pageProgressionDirection = isRTL ? 'rtl' : 'ltr';

    return {
      title: this.translate(locale, 'sample.book.title'),
      language: locale,
      identifier,
      creator: [{ name: this.translate(locale, 'sample.author.name'), roles: [] }],
      publisher: this.translate(locale, 'sample.publisher.name'),
      description: this.translate(locale, 'sample.book.description'),
      pageProgressionDirection,
    };
  }

  /**
   * Generate chapter content for the specified locale
   */
  async generateLocalizedChapters(locale: string): Promise<DemoChapter[]> {
    // Validate locale support
    if (!this.isLocaleSupported(locale)) {
      throw new UnsupportedLocaleErrorClass(locale);
    }

    // Check for missing chapter translations
    const chapterKeys: SampleContentKey[] = [
      'sample.chapter1.title',
      'sample.chapter1.content',
    ];

    const missingKeys: string[] = [];
    for (const key of chapterKeys) {
      if (!this.hasTranslation(locale, key)) {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length > 0) {
      throw new TranslationMissingErrorClass(locale, missingKeys);
    }

    return [
      {
        id: 'chapter1',
        title: this.translate(locale, 'sample.chapter1.title'),
        content: this.translate(locale, 'sample.chapter1.content'),
        linear: true,
        mediaType: 'application/xhtml+xml',
      },
    ];
  }

  /**
   * Get locales that have complete sample content translations available
   */
  async getAvailableLocales(): Promise<string[]> {
    const availableLocales: string[] = [];
    const allLocales = Object.keys(this.catalogs);

    for (const locale of allLocales) {
      // Check if all required keys are available for this locale
      const hasAllKeys = REQUIRED_SAMPLE_KEYS.every(key =>
        this.hasTranslation(locale, key)
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
    if (!this.isLocaleSupported(locale)) {
      throw new UnsupportedLocaleErrorClass(locale);
    }

    const missingKeys: string[] = [];
    const emptyKeys: string[] = [];
    const catalog = this.catalogs[locale];

    for (const key of REQUIRED_SAMPLE_KEYS) {
      if (!catalog || !(key in catalog.messages)) {
        // Key doesn't exist in catalog
        missingKeys.push(key);
      } else {
        // Key exists, check if it's empty
        const translation = catalog.messages[key];
        
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
  }

  /**
   * Check translation completeness and throw appropriate errors
   */
  private async checkTranslationCompleteness(locale: string): Promise<void> {
    const catalog = this.catalogs[locale];
    if (!catalog) {
      throw new UnsupportedLocaleErrorClass(locale);
    }

    // First pass: check for empty translations (higher priority)
    for (const key of REQUIRED_SAMPLE_KEYS) {
      if (key in catalog.messages) {
        const translation = catalog.messages[key];
        if (!translation || translation.trim() === '') {
          throw new InvalidContentErrorClass(locale, key, 'Translation is empty');
        }
      }
    }

    // Second pass: check for missing translations
    const missingKeys: string[] = [];
    for (const key of REQUIRED_SAMPLE_KEYS) {
      if (!(key in catalog.messages)) {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length > 0) {
      throw new TranslationMissingErrorClass(locale, missingKeys);
    }
  }
}
