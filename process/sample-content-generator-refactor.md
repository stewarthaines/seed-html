# SampleContentGenerator Refactor: Direct Catalog Injection

## Problem Analysis

### Initial Issue

The current `SampleContentGenerator` has test-specific code (`setMockLocale()`) in production and requires complex mocking.

### Runtime Issue Discovered

After implementing the refactor, we discovered a **timing issue** in the dev server:

```
❌ WorkspaceManager.createLocalizedEPUBWorkspace: Failed with error:
UnsupportedLocaleError: Unsupported locale: en
```

**Root Cause:** `WorkspaceManager` constructor calls `i18nService.getCatalogs()` immediately during app startup, but i18n catalogs are loaded asynchronously from storage. At construction time, `getCatalogs()` returns `{}` (empty object), so `SampleContentGenerator` has no catalogs available.

**Timeline:**

1. App starts → `WorkspaceManager` constructed → `SampleContentGenerator` gets empty catalogs `{}`
2. i18n system loads catalogs asynchronously (we see loading logs)
3. User clicks "Create New" → `SampleContentGenerator.isLocaleSupported('en')` → `'en' in {}` → `false`
4. Throws `UnsupportedLocaleError`

## Solution: Direct Catalog Injection + Just-In-Time Loading

### Architecture Decision

We keep the **direct catalog injection** approach for `SampleContentGenerator` (it's clean and testable), but solve the timing issue by **ensuring catalogs are loaded just-in-time** when creating workspaces.

### Two-Part Solution:

1. **SampleContentGenerator**: Simple constructor that accepts pre-loaded catalogs
2. **WorkspaceManager**: Ensures catalogs are loaded before creating `SampleContentGenerator` instances

### Minimal Constructor

```typescript
export class SampleContentGenerator {
  constructor(private catalogs: Record<string, TranslationCatalog>) {}
}
```

### Simple Translation Method

```typescript
private translate(locale: string, key: string): string {
  const catalog = this.catalogs[locale];
  return catalog?.messages[key] || key;
}
```

### Updated Content Generation

```typescript
async generateLocalizedContent(locale: string): Promise<LocalizedSampleContent> {
  // Simple validation - catalog must exist
  if (!this.catalogs[locale]) {
    throw new UnsupportedLocaleError(locale);
  }

  // Generate metadata directly
  const metadata = {
    title: this.translate(locale, 'sample.book.title'),
    description: this.translate(locale, 'sample.book.description'),
    author: this.translate(locale, 'sample.author.name'),
    publisher: this.translate(locale, 'sample.publisher.name'),
  };

  // Generate chapters directly
  const chapters = [
    {
      id: 'prologue',
      title: this.translate(locale, 'sample.prologue.title'),
      content: this.translate(locale, 'sample.prologue.content'),
      linear: true,
      mediaType: 'application/xhtml+xml',
    },
    // ... other chapters
  ];

  return {
    locale,
    metadata,
    chapters,
    isRTL: false, // Remove RTL complexity for now
    pageProgressionDirection: 'ltr',
  };
}
```

## Changes Required

### WorkspaceManager Integration (Just-In-Time Loading)

```typescript
// In WorkspaceManager.createLocalizedEPUBWorkspace()
async createLocalizedEPUBWorkspace(metadata: EPUBMetadata, locale: string) {
  // 1. Ensure catalogs are loaded before creating generator
  await this.ensureCatalogsLoaded();

  // 2. Create fresh SampleContentGenerator with loaded catalogs
  const catalogs = i18nService.getCatalogs();
  const contentGenerator = new SampleContentGenerator(catalogs);

  // 3. Proceed with content generation
  const content = await contentGenerator.generateLocalizedContent(locale);
  // ... rest of workspace creation
}

private async ensureCatalogsLoaded(): Promise<void> {
  if (!i18nService.isInitialized()) {
    await i18nService.init(); // Load catalogs if not already loaded
  }
}
```

### Constructor Usage Comparison

```typescript
// Before: Timing-dependent constructor injection
class WorkspaceManager {
  constructor() {
    this.contentGenerator = new SampleContentGenerator(i18nService.getCatalogs()); // ❌ Empty at startup!
  }
}

// After: Just-in-time creation
class WorkspaceManager {
  async createLocalizedEPUBWorkspace(metadata, locale) {
    await this.ensureCatalogsLoaded();
    const generator = new SampleContentGenerator(i18nService.getCatalogs()); // ✅ Loaded catalogs
    // ...
  }
}
```

### Test Simplification

```typescript
// Before: Complex mock system
const mockI18nSystem = createMockI18nSystem();
const generator = new SampleContentGenerator(mockI18nSystem as any);

// After: Simple catalog object
const generator = new SampleContentGenerator({
  en: { locale: 'en', messages: { 'sample.book.title': 'Introduction to EPUB' }, headers: {} },
  fr: { locale: 'fr', messages: { 'sample.book.title': 'Introduction à EPUB' }, headers: {} },
});
```

### Remove From Implementation

- `setMockLocale()` method
- `I18nSystem` interface dependency
- All locale switching logic
- RTL detection (for now)
- Fallback translation logic
- Parameter interpolation

## Benefits of This Architecture

### ✅ **Production Code Quality**

- No test-specific code in production
- Simple direct catalog access
- Clean separation of concerns
- Fixes failing French translation tests

### ✅ **Timing & Performance**

- Solves timing issues with async i18n loading
- Better app startup performance (catalogs loaded on-demand)
- No race conditions between app init and i18n loading
- Clear error handling point for catalog loading failures

### ✅ **User Experience**

- Fast app startup (no blocking i18n load)
- Expected loading state during workspace creation
- Graceful error handling for i18n failures
- Reliable workspace creation process

### ✅ **Testing & Maintenance**

- Easy to test with plain catalog objects
- No complex mock system needed
- Predictable test data and behavior
- Simple to extend with new locales

## Architecture Comparison

| Approach                          | Startup Time | Reliability         | Complexity | UX                     |
| --------------------------------- | ------------ | ------------------- | ---------- | ---------------------- |
| **Constructor Injection (old)**   | Fast         | ❌ Timing issues    | Low        | ❌ Random failures     |
| **Lazy Loading**                  | Fast         | ⚠️ On-demand delays | Medium     | ⚠️ Unexpected waits    |
| **Just-In-Time Loading (chosen)** | **Fast**     | **✅ Reliable**     | **Low**    | **✅ Expected delays** |

## Why Just-In-Time Loading Wins

1. **Natural Flow**: Workspace creation is already an async operation users expect to take time
2. **Clear Responsibility**: WorkspaceManager owns the "ensure catalogs loaded" concern
3. **Fail-Fast**: Any i18n loading issues are caught and handled during workspace creation
4. **Scalable**: Works for any number of locales and future i18n improvements
5. **Clean API**: SampleContentGenerator stays simple with direct catalog injection
