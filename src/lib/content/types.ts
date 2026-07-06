/**
 * Translation Content System Type Definitions
 *
 * Type definitions for localized sample EPUB content generation
 * based on translation catalogs and the existing i18n infrastructure.
 */

import { _ } from '$lib/i18n/msgid.js';

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
 * Sample content msgids: the English text doubles as the catalog key, matching the
 * natural-English-msgid convention used everywhere else. Translations are looked up
 * by these exact strings; an empty/missing msgstr falls back to the msgid itself.
 */
export const SAMPLE_MSGIDS = {
  bookTitle: _('Sample EPUB Book'),
  bookDescription: _(
    'This is a sample EPUB book created for demonstration purposes. It showcases the basic structure and content of an EPUB publication.'
  ),
  authorName: _('Sample Author'),
  publisherName: _('Sample Publisher'),
  chapter1Title: _('Chapter 1: Getting Started'),
  chapter1Content: _(
    "# Achievement *Unlocked!*\n\nThis is a minimal sample EPUB created in the Simple EPUB Editor app - **SEED.html**.\n\nThis sample project provides only a subset of markdown format options (headings, bold and italic).\n\n## Markdown Subset\n\n**This is strong**  and is created by wrapping text in double asterisks.\n\n*This is emphasized* and is created by wrapping text in single asterisks.\n\nYou can write also xhtml directly in <em><strong>this</strong> EPUB</em> but doing this is kind of missing the point of the SEED.html app.\n\n## A Better Way\n\nFor richer formatting options there are third party javascript extensions that are not currently present in this project.\n\nFor real writing projects the best way to start is to choose a sample EPUB that's pre-configured for generating semantic, accessible xhtml from *plain text source*.\n"
  ),
} as const;

/**
 * A sample content translation lookup key (one of the SAMPLE_MSGIDS values)
 */
export type SampleContentKey = (typeof SAMPLE_MSGIDS)[keyof typeof SAMPLE_MSGIDS];

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
