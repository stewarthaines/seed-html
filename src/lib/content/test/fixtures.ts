/**
 * Test fixtures for Translation Content System
 *
 * Provides realistic sample data for testing localized content generation
 * following the existing project patterns and TDD approach.
 */

import type { TranslationCatalog } from '../../i18n/types.js';
import type { ValidationResult, SampleContentKey } from '../types.js';

/**
 * Mock translation catalogs with sample content keys
 */
export const mockSampleContentCatalogs = {
  en: {
    locale: 'en',
    messages: {
      // Book metadata
      'sample.book.title': 'Introduction to EPUB',
      'sample.book.description':
        'A comprehensive guide to creating and editing EPUB files with Active EPUB technology.',
      'sample.author.name': 'EDITME Editorial Team',
      'sample.publisher.name': 'EDITME Publishing',

      // Chapter content
      'sample.chapter1.title': 'Getting Started',
      'sample.chapter1.content': `# This is a Heading 1

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
      'sample.book.title': 'Einführung in EPUB',
      'sample.book.description':
        'Ein umfassender Leitfaden zur Erstellung und Bearbeitung von EPUB-Dateien mit Active EPUB-Technologie.',
      'sample.author.name': 'EDITME Redaktionsteam',
      'sample.publisher.name': 'EDITME Verlag',

      // Chapter content
      'sample.chapter1.title': 'Erste Schritte',
      'sample.chapter1.content': `# Das ist eine Überschrift 1

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
      'sample.book.title': 'مقدمة إلى EPUB',
      'sample.book.description': 'دليل شامل لإنشاء وتحرير ملفات EPUB باستخدام تقنية Active EPUB.',
      'sample.author.name': 'فريق تحرير EDITME',
      'sample.publisher.name': 'دار نشر EDITME',

      // Chapter content
      'sample.chapter1.title': 'البداية',
      'sample.chapter1.content': `# هذا عنوان 1

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
      missingKeys: ['sample.chapter1.title', 'sample.chapter1.content'],
      emptyKeys: [],
      locale: 'fr',
    } satisfies ValidationResult,
  },

  empty: {
    emptyContent: {
      isValid: false,
      missingKeys: [],
      emptyKeys: ['sample.book.title'],
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
    missingKeys: ['sample.chapter1.title', 'sample.chapter1.content'],
    expectedError: 'TranslationMissingError',
    expectedMessage:
      'Missing translation keys for locale fr: sample.chapter1.title, sample.chapter1.content',
  },

  invalidContent: {
    locale: 'es',
    key: 'sample.book.title',
    reason: 'Translation is empty',
    expectedError: 'InvalidContentError',
    expectedMessage: 'Invalid content for es.sample.book.title: Translation is empty',
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
      'sample.book.title': 'Introduction à EPUB',
      'sample.book.description': 'Un guide complet pour créer et éditer des fichiers EPUB.',
      'sample.author.name': 'Équipe éditoriale EDITME',
      'sample.publisher.name': 'Éditions EDITME',
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
      'sample.book.title': '', // Empty content
      'sample.book.description': 'Una guía completa para crear y editar archivos EPUB.',
      'sample.author.name': 'Equipo Editorial EDITME',
      'sample.publisher.name': 'Editorial EDITME',
      'sample.chapter1.title': 'Comenzando',
      'sample.chapter1.content': 'Este capítulo te guiará a través de los conceptos básicos.',
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
  'sample.book.title',
  'sample.book.description',
  'sample.author.name',
  'sample.publisher.name',
  'sample.chapter1.title',
  'sample.chapter1.content',
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
