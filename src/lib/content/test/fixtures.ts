/**
 * Test fixtures for Translation Content System
 *
 * Provides realistic sample data for testing localized content generation
 * following the existing project patterns and TDD approach.
 */

import type { TranslationCatalog } from '../../i18n/types.js';
import type { ValidationResult, SampleContentKey } from '../types.js';
import { SAMPLE_MSGIDS } from '../types.js';

/**
 * Mock translation catalogs with sample content keys
 */
export const mockSampleContentCatalogs = {
  en: {
    locale: 'en',
    messages: {
      // Book metadata
      [SAMPLE_MSGIDS.bookTitle]: 'Introduction to EPUB',
      [SAMPLE_MSGIDS.bookDescription]:
        'A comprehensive guide to creating and editing EPUB files with Active EPUB technology.',
      [SAMPLE_MSGIDS.authorName]: 'EDITME Editorial Team',
      [SAMPLE_MSGIDS.publisherName]: 'EDITME Publishing',

      // Chapter content
      [SAMPLE_MSGIDS.chapter1Title]: 'Getting Started',
      [SAMPLE_MSGIDS.chapter1Content]: `# This is a Heading 1

A heading 1 (H1) is the main title of a document, created with a single hash mark.

## This is a Heading 2

A heading 2 (H2) is a section heading, created with two hash marks.

**This text is bold** - Bold text adds strong emphasis and is created by wrapping text in double asterisks.

*This text is emphasized* - Emphasized text (usually italic) adds mild emphasis and is created by wrapping text in single asterisks.`,
    },
    headers: {
      Language: 'en',
      'Content-Type': 'text/plain; charset=UTF-8',
    },
  } satisfies TranslationCatalog,

  de: {
    locale: 'de',
    messages: {
      // Book metadata
      [SAMPLE_MSGIDS.bookTitle]: 'Einführung in EPUB',
      [SAMPLE_MSGIDS.bookDescription]:
        'Ein umfassender Leitfaden zur Erstellung und Bearbeitung von EPUB-Dateien mit Active EPUB-Technologie.',
      [SAMPLE_MSGIDS.authorName]: 'EDITME Redaktionsteam',
      [SAMPLE_MSGIDS.publisherName]: 'EDITME Verlag',

      // Chapter content
      [SAMPLE_MSGIDS.chapter1Title]: 'Erste Schritte',
      [SAMPLE_MSGIDS.chapter1Content]: `# Das ist eine Überschrift 1

Eine Überschrift 1 (H1) ist der Haupttitel eines Dokuments, erstellt mit einem einzigen Rautezeichen.

## Das ist eine Überschrift 2

Eine Überschrift 2 (H2) ist eine Abschnittsüberschrift, erstellt mit zwei Rautezeichen.

**Dieser Text ist fett** - Fetter Text fügt starke Betonung hinzu und wird erstellt, indem Text in doppelte Sternchen eingeschlossen wird.

*Dieser Text ist hervorgehoben* - Hervorgehobener Text (normalerweise kursiv) fügt leichte Betonung hinzu und wird erstellt, indem Text in einfache Sternchen eingeschlossen wird.`,
    },
    headers: {
      Language: 'de',
      'Content-Type': 'text/plain; charset=UTF-8',
    },
  } satisfies TranslationCatalog,

  ar: {
    locale: 'ar',
    messages: {
      // Book metadata
      [SAMPLE_MSGIDS.bookTitle]: 'مقدمة إلى EPUB',
      [SAMPLE_MSGIDS.bookDescription]:
        'دليل شامل لإنشاء وتحرير ملفات EPUB باستخدام تقنية Active EPUB.',
      [SAMPLE_MSGIDS.authorName]: 'فريق تحرير EDITME',
      [SAMPLE_MSGIDS.publisherName]: 'دار نشر EDITME',

      // Chapter content
      [SAMPLE_MSGIDS.chapter1Title]: 'البداية',
      [SAMPLE_MSGIDS.chapter1Content]: `# هذا عنوان 1

العنوان 1 (H1) هو العنوان الرئيسي للوثيقة، يُنشأ بعلامة مربع واحدة.

## هذا عنوان 2

العنوان 2 (H2) هو عنوان قسم، يُنشأ بعلامتي مربع.

**هذا النص غامق** - النص الغامق يضيف تأكيداً قوياً ويُنشأ بوضع النص بين نجمتين مزدوجتين.

*هذا النص مؤكد* - النص المؤكد (عادة مائل) يضيف تأكيداً خفيفاً ويُنشأ بوضع النص بين نجمتين مفردتين.`,
    },
    headers: {
      Language: 'ar',
      'Content-Type': 'text/plain; charset=UTF-8',
    },
  } satisfies TranslationCatalog,
};

/**
 * Expected content patterns for validation (without using expect functions)
 */
export const expectedContentPatterns = {
  en: {
    metadata: {
      title: 'Introduction to EPUB',
      description:
        'A comprehensive guide to creating and editing EPUB files with Active EPUB technology.',
      author: 'EDITME Editorial Team',
      publisher: 'EDITME Publishing',
    },
    chapters: {
      chapter1: {
        title: 'Getting Started',
        contentPattern: '# This is a Heading 1',
      },
    },
  },

  de: {
    metadata: {
      title: 'Einführung in EPUB',
      description:
        'Ein umfassender Leitfaden zur Erstellung und Bearbeitung von EPUB-Dateien mit Active EPUB-Technologie.',
      author: 'EDITME Redaktionsteam',
      publisher: 'EDITME Verlag',
    },
    chapters: {
      chapter1: {
        title: 'Erste Schritte',
        contentPattern: '# Das ist eine Überschrift 1',
      },
    },
  },

  ar: {
    metadata: {
      title: 'مقدمة إلى EPUB',
      description: 'دليل شامل لإنشاء وتحرير ملفات EPUB باستخدام تقنية Active EPUB.',
      author: 'فريق تحرير EDITME',
      publisher: 'دار نشر EDITME',
    },
    chapters: {
      chapter1: {
        title: 'البداية',
        contentPattern: '# هذا عنوان 1',
      },
    },
  },
};

/**
 * Validation test cases
 */
export const validationTestCases = {
  valid: {
    en: {
      isValid: true,
      missingKeys: [],
      emptyKeys: [],
      locale: 'en',
    } satisfies ValidationResult,

    de: {
      isValid: true,
      missingKeys: [],
      emptyKeys: [],
      locale: 'de',
    } satisfies ValidationResult,

    ar: {
      isValid: true,
      missingKeys: [],
      emptyKeys: [],
      locale: 'ar',
    } satisfies ValidationResult,
  },

  missing: {
    incompleteFrench: {
      isValid: false,
      missingKeys: [SAMPLE_MSGIDS.chapter1Title, SAMPLE_MSGIDS.chapter1Content],
      emptyKeys: [],
      locale: 'fr',
    } satisfies ValidationResult,
  },

  empty: {
    emptyContent: {
      isValid: false,
      missingKeys: [],
      emptyKeys: [SAMPLE_MSGIDS.bookTitle],
      locale: 'es',
    } satisfies ValidationResult,
  },
};

/**
 * Error test scenarios
 */
export const errorScenarios = {
  unsupportedLocale: {
    locale: 'invalid-xx',
    expectedError: 'UnsupportedLocaleError',
    expectedMessage: 'Unsupported locale: invalid-xx',
  },

  missingTranslations: {
    locale: 'fr',
    missingKeys: [SAMPLE_MSGIDS.chapter1Title, SAMPLE_MSGIDS.chapter1Content],
    expectedError: 'TranslationMissingError',
    expectedMessage: `Missing translation keys for locale fr: ${SAMPLE_MSGIDS.chapter1Title}, ${SAMPLE_MSGIDS.chapter1Content}`,
  },

  invalidContent: {
    locale: 'es',
    key: SAMPLE_MSGIDS.bookTitle,
    reason: 'Translation is empty',
    expectedError: 'InvalidContentError',
    expectedMessage: `Invalid content for es.${SAMPLE_MSGIDS.bookTitle}: Translation is empty`,
  },
};

/**
 * Mock catalogs with missing content for error testing
 */
export const incompleteCatalogs = {
  fr: {
    locale: 'fr',
    messages: {
      // Only partial content
      [SAMPLE_MSGIDS.bookTitle]: 'Introduction à EPUB',
      [SAMPLE_MSGIDS.bookDescription]: 'Un guide complet pour créer et éditer des fichiers EPUB.',
      [SAMPLE_MSGIDS.authorName]: 'Équipe éditoriale EDITME',
      [SAMPLE_MSGIDS.publisherName]: 'Éditions EDITME',
      // Missing: chapter1 content
    },
    headers: {
      Language: 'fr',
      'Content-Type': 'text/plain; charset=UTF-8',
    },
  } satisfies TranslationCatalog,

  es: {
    locale: 'es',
    messages: {
      [SAMPLE_MSGIDS.bookTitle]: '', // Empty content
      [SAMPLE_MSGIDS.bookDescription]: 'Una guía completa para crear y editar archivos EPUB.',
      [SAMPLE_MSGIDS.authorName]: 'Equipo Editorial EDITME',
      [SAMPLE_MSGIDS.publisherName]: 'Editorial EDITME',
      [SAMPLE_MSGIDS.chapter1Title]: 'Comenzando',
      [SAMPLE_MSGIDS.chapter1Content]: 'Este capítulo te guiará a través de los conceptos básicos.',
    },
    headers: {
      Language: 'es',
      'Content-Type': 'text/plain; charset=UTF-8',
    },
  } satisfies TranslationCatalog,
};

/**
 * List of all required sample content keys
 */
export const requiredSampleContentKeys: SampleContentKey[] = [
  SAMPLE_MSGIDS.bookTitle,
  SAMPLE_MSGIDS.bookDescription,
  SAMPLE_MSGIDS.authorName,
  SAMPLE_MSGIDS.publisherName,
  SAMPLE_MSGIDS.chapter1Title,
  SAMPLE_MSGIDS.chapter1Content,
];

/**
 * Available locales list for testing
 */
export const expectedAvailableLocales = ['en', 'de', 'ar'];

/**
 * Factory function to create fresh test data (prevents test pollution)
 */
export function createTestCatalogs() {
  return JSON.parse(JSON.stringify(mockSampleContentCatalogs));
}

/**
 * Factory function to create incomplete catalogs for error testing
 */
export function createIncompleteCatalogs() {
  return JSON.parse(JSON.stringify(incompleteCatalogs));
}
