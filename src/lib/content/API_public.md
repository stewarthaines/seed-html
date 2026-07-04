# Translation Content System Public API

## Overview

Public interface for the Translation Content System - generates localized sample EPUB content from translation catalogs for the enhanced "Create New" workspace feature, providing scalable locale support through translation-only additions.

## Constructor

```typescript
constructor(i18nSystem: I18nSystem)
```

**Input:**

- `i18nSystem: I18nSystem` - Internationalization system providing translation and locale services

**Side Effects:** Initializes internal i18n system reference for localized content generation

**Usage:**

```typescript
import { i18nService } from '$lib/i18n';
import { SampleContentGenerator } from '$lib/content';

// Standard usage with unified i18n service
const contentGenerator = new SampleContentGenerator(i18nService);

// Usage with custom i18n implementation (for testing)
const mockI18n = {
  translate: (key: string, params?: Record<string, any>) => key,
  getCurrentLocale: () => 'en',
  getAvailableLocales: () => [],
  hasTranslation: (locale: string, key: string) => true,
  isLocaleSupported: (locale: string) => true,
  isRTL: (locale: string) => false,
};
const testGenerator = new SampleContentGenerator(mockI18n);
```

**I18nSystem Interface:**

```typescript
interface I18nSystem {
  translate: (key: string, params?: Record<string, any>) => string;
  getCurrentLocale: () => string;
  getAvailableLocales: () => any[];
  hasTranslation: (locale: string, key: string) => boolean;
  isLocaleSupported: (locale: string) => boolean;
  isRTL: (locale: string) => boolean;
}
```

## Core Content Generation

### generateLocalizedContent()

```typescript
generateLocalizedContent(locale: string): Promise<LocalizedSampleContent>
```

Generate complete localized sample content for the specified locale from translation keys.

### generateLocalizedMetadata()

```typescript
generateLocalizedMetadata(locale: string): Promise<EPUBMetadata>
```

Generate EPUB metadata for the specified locale using translation keys.

### generateLocalizedChapters()

```typescript
generateLocalizedChapters(locale: string): Promise<DemoChapter[]>
```

Generate chapter content for the specified locale using translation keys.

## Locale Management

### getAvailableLocales()

```typescript
getAvailableLocales(): Promise<string[]>
```

Get locales that have complete sample content translations available.

### validateLocaleCompleteness()

```typescript
validateLocaleCompleteness(locale: string): Promise<ValidationResult>
```

Validate that all required translation keys exist for a locale.

## Public Type Definitions

### LocalizedSampleContent

```typescript
interface LocalizedSampleContent {
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
```

### DemoChapter

```typescript
interface DemoChapter {
  id: string;
  title: string;
  content: string;
  linear: boolean;
  mediaType: string;
}
```

### ValidationResult

```typescript
interface ValidationResult {
  isValid: boolean;
  missingKeys: string[];
  emptyKeys: string[];
  locale: string;
}
```

### SampleContentKey

```typescript
type SampleContentKey =
  | 'sample.book.title'
  | 'sample.book.description'
  | 'sample.author.name'
  | 'sample.publisher.name'
  | 'sample.prologue.title'
  | 'sample.prologue.content'
  | 'sample.chapter1.title'
  | 'sample.chapter1.content'
  | 'sample.chapter2.title'
  | 'sample.chapter2.content'
  | 'sample.appendix.title'
  | 'sample.appendix.content';
```

## Usage Examples

### Basic Content Generation

```typescript
import { SampleContentGenerator } from '$lib/content';
import { I18nSystem } from '$lib/i18n';

const i18nSystem = new I18nSystem();
await i18nSystem.init();
const contentGenerator = new SampleContentGenerator(i18nSystem);

// Generate complete localized content
const content = await contentGenerator.generateLocalizedContent('fr');

console.log(`Generated content for: ${content.locale}`);
console.log(`Book title: ${content.metadata.title}`);
console.log(`Chapter count: ${content.chapters.length}`);
console.log(`Text direction: ${content.isRTL ? 'RTL' : 'LTR'}`);

// Access individual chapters
content.chapters.forEach(chapter => {
  console.log(`${chapter.id}: ${chapter.title}`);
});
```

### Metadata Generation

```typescript
// Generate EPUB metadata for specific locale
const metadata = await contentGenerator.generateLocalizedMetadata('ar');

console.log(`Title: ${metadata.title}`);
console.log(`Language: ${metadata.language}`);
console.log(`Author: ${metadata.creator.join(', ')}`);
console.log(`Page progression: ${metadata.pageProgressionDirection || 'ltr'}`);
```

### Chapter Generation

```typescript
// Generate just the chapters for a locale
const chapters = await contentGenerator.generateLocalizedChapters('ja');

chapters.forEach(chapter => {
  console.log(`Chapter: ${chapter.title}`);
  console.log(`Content length: ${chapter.content.length} characters`);
  console.log(`Media type: ${chapter.mediaType}`);
});
```

### Locale Validation

```typescript
// Check which locales have complete translations
const availableLocales = await contentGenerator.getAvailableLocales();
console.log(`Available locales: ${availableLocales.join(', ')}`);

// Validate specific locale completeness
const validation = await contentGenerator.validateLocaleCompleteness('de');

if (!validation.isValid) {
  console.error(`Missing keys for German: ${validation.missingKeys.join(', ')}`);
  console.error(`Empty keys for German: ${validation.emptyKeys.join(', ')}`);
} else {
  console.log('German translations are complete');
}
```

### Integration with Workspace Creation

```typescript
// e.g. in the app's create-project flow (EnhancedAppState.createWorkspace)
const locale = this.i18nSystem.getCurrentLocale();
const sampleContent = await this.contentGenerator.generateLocalizedContent(locale);

// Use generated metadata for EPUB
const epubMetadata = await this.contentGenerator.generateLocalizedMetadata(locale);

// Create SOURCE text files from chapters
for (const chapter of sampleContent.chapters) {
  await this.storage.writeTextFile(workspaceId, `SOURCE/text/${chapter.id}.txt`, chapter.content);
}
```

## Error Handling

All methods may throw specific error types:

- `TranslationMissingError` - Required translation keys are missing
- `UnsupportedLocaleError` - Locale not configured in system
- `InvalidContentError` - Translation content is invalid or corrupted

```typescript
try {
  const content = await contentGenerator.generateLocalizedContent('fr');
} catch (error) {
  if (error instanceof TranslationMissingError) {
    console.error('Missing French translations:', error.missingKeys);
    // Fall back to English
    const fallback = await contentGenerator.generateLocalizedContent('en');
    return fallback;
  } else if (error instanceof UnsupportedLocaleError) {
    console.error('Unsupported locale:', error.locale);
    // Use default locale
    return await contentGenerator.generateLocalizedContent('en');
  } else {
    throw error;
  }
}
```

## Translation Key Schema

The system uses a hierarchical translation key structure: `sample.{section}.{element}`

### Required Translation Keys

All locales must provide translations for these keys:

- `sample.book.title` - Book title
- `sample.book.description` - Book description
- `sample.author.name` - Author name
- `sample.publisher.name` - Publisher name
- `sample.prologue.title` - Prologue title
- `sample.prologue.content` - Prologue content (markdown)
- `sample.chapter1.title` - Chapter 1 title
- `sample.chapter1.content` - Chapter 1 content (markdown)
- `sample.chapter2.title` - Chapter 2 title
- `sample.chapter2.content` - Chapter 2 content (markdown)
- `sample.appendix.title` - Appendix title
- `sample.appendix.content` - Appendix content (markdown)

### Content Requirements

Each content key must provide:

- **Educational Value** - Explains EPUB and Active EPUB concepts
- **Progressive Complexity** - Builds from basic to advanced features
- **Formatting Examples** - Demonstrates markdown-style formatting
- **Technical Accuracy** - Correctly describes Active EPUB functionality

## Supported Locales

The Translation Content System supports all locales available in the i18n system:

- **English** (`en`) - Left-to-right, Latin script
- **German** (`de`) - Left-to-right, Latin script
- **Arabic** (`ar`) - Right-to-left, Arabic script
- **Hebrew** (`he`) - Right-to-left, Hebrew script
- **Japanese** (`ja`) - Left-to-right, Japanese scripts
- **Georgian** (`ka`) - Left-to-right, Georgian script
- **Chinese Traditional** (`zh-Hant`) - Left-to-right, Traditional Chinese

Each locale includes culturally appropriate content with proper formatting for the target script and reading direction.

## Integration Points

### With I18n System

The generator integrates with the existing i18n infrastructure for translation lookup and locale detection.

### With workspace creation

Used to generate localized sample content during workspace creation, providing both EPUB metadata and chapter content.

### With Universal Asset Generator

Coordinates with asset generation to ensure consistent locale handling across the workspace creation process.
