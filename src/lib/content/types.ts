/**
 * Translation Content System Type Definitions
 *
 * Type definitions for localized sample EPUB content generation
 * based on translation catalogs and the existing i18n infrastructure.
 */

export interface LocalizedSampleContent {
  /** Locale code (e.g., 'en', 'fr', 'ar') */
  locale: string;

  /** Book metadata in the target locale */
  metadata: {
    title: string;
    description: string;
    author: string;
    publisher: string;
  };

  /** Chapter content in the target locale */
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    linear: boolean;
  }>;

  /** Whether this locale uses RTL text direction */
  isRTL: boolean;

  /** EPUB page progression direction for RTL languages */
  pageProgressionDirection?: 'rtl' | 'ltr';
}

export interface DemoChapter {
  id: string;
  title: string;
  content: string;
  linear: boolean;
  mediaType: string;
}

export interface ValidationResult {
  isValid: boolean;
  missingKeys: string[];
  emptyKeys: string[];
  locale: string;
}

/**
 * Strongly-typed sample content keys for translation lookup
 */
export type SampleContentKey =
  | 'sample.book.title'
  | 'sample.book.description'
  | 'sample.author.name'
  | 'sample.publisher.name'
  | 'sample.chapter1.title'
  | 'sample.chapter1.content';

/**
 * Error Classes
 */

export class TranslationMissingError extends Error {
  constructor(
    public readonly locale: string,
    public readonly missingKeys: string[]
  ) {
    super(`Missing translation keys for locale ${locale}: ${missingKeys.join(', ')}`);
    this.name = 'TranslationMissingError';
  }
}

export class UnsupportedLocaleError extends Error {
  constructor(public readonly locale: string) {
    super(`Unsupported locale: ${locale}`);
    this.name = 'UnsupportedLocaleError';
  }
}

export class InvalidContentError extends Error {
  constructor(
    public readonly locale: string,
    public readonly key: string,
    public readonly reason: string
  ) {
    super(`Invalid content for ${locale}.${key}: ${reason}`);
    this.name = 'InvalidContentError';
  }
}
