# ContentService Contract

**Date:** 2025-01-29  
**Status:** TDD Contract - Red Phase  
**Purpose:** Executable specification for ContentService implementation in the clean service architecture

## Contract Overview

The ContentService is the **content transformation and generation service** in the clean service architecture. It has **single responsibility** for transforming plain text to XHTML, generating navigation documents, and creating localized sample content. It **never calls other services** - all coordination happens through reactive state in AppState.

### Core Responsibilities (Single Service Boundary)

1. **Content Transformation**: Transform plain text source files to XHTML using transform pipeline
2. **Navigation Generation**: Create EPUB-compliant navigation documents from spine data
3. **Sample Content Generation**: Generate localized sample content for new workspaces
4. **Content Preview**: Generate content previews and metadata for UI consumption

### What This Service Does NOT Do

- **Workspace management**: Handled by WorkspaceService
- **Settings management**: Handled by SettingsService  
- **File storage operations**: Uses infrastructure only
- **Spine/manifest management**: Handled by WorkspaceService
- **Cross-service coordination**: Handled by AppState reactive layers

### Architecture Principle

**Services never call other services**. The ContentService only depends on infrastructure (TransformExecutor, I18nSystem) and returns pure content objects. All service coordination happens through AppState reactive effects.

## Interface Contract

### Core Interface

```typescript
interface ContentService {
  // Content transformation operations (pure functions)
  transformContent(sourceText: string, transformContext?: TransformContext): Promise<TransformResult>;
  previewContent(sourceText: string, transformContext?: TransformContext): Promise<ContentPreview>;
  
  // Navigation document generation (pure functions - no workspace access)
  generateNavigationFromContent(chapters: ChapterContent[]): NavigationDocument;
  processUserNavigation(navText: string): NavigationDocument;
  
  // Sample content generation (pure functions using i18n)
  generateLocalizedContent(locale: string): Promise<LocalizedSampleContent>;
  generateLocalizedMetadata(locale: string): Promise<EPUBMetadata>;
  generateLocalizedChapters(locale: string): Promise<DemoChapter[]>;
}
```

### Shared Type Dependencies

ContentService uses the following shared types defined in the [Shared Types Design](./SHARED_TYPES_DESIGN.md):

**From `src/lib/types/content.ts`:**
- `ChapterContent` - Pre-loaded chapter content for navigation generation
- `TransformContext` - Optional context for transform pipeline
- `TransformResult` - Content transformation output with warnings and metadata
- `ContentPreview` - Simplified preview without wordCount/readingTime complexity

**From `src/lib/types/navigation.ts`:**
- `NavigationDocument` - EPUB-compliant navigation document structure

**From `src/lib/types/localization.ts`:**
- `LocalizedSampleContent` - Sample content using existing EPUBMetadata and DemoChapter types

**From existing project types:**
- `EPUBMetadata` - Reused for metadata consistency
- `DemoChapter[]` - Reused for sample chapter content

## Behavioral Contracts (Test-First Specifications)

### Contract 1: Content Transformation

**Specification**: `transformContent()` must transform plain text to valid XHTML using the transform pipeline.

```typescript
describe('Contract: Content Transformation', () => {
  test('transformContent converts markdown to XHTML', async () => {
    const sourceText = '# Chapter 1\n\nHello **world**!';
    const workspaceId = 'test-workspace';
    
    const result = await service.transformContent(sourceText, workspaceId);
    
    // CONTRACT: MUST return valid XHTML
    expect(result.xhtml).toContain('<h1>Chapter 1</h1>');
    expect(result.xhtml).toContain('<strong>world</strong>');
    expect(result.warnings).toEqual([]);
    expect(result.transformTime).toBeGreaterThan(0);
  });
  
  test('transformContent handles transform errors gracefully', async () => {
    const invalidText = '```javascript\nunclosed code block';
    
    const result = await service.transformContent(invalidText, 'test-workspace');
    
    // CONTRACT: MUST handle errors gracefully
    expect(result.xhtml).toBeDefined();
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('code block');
  });
});
```

### Contract 2: Navigation Generation

**Specification**: `generateNavigationFromContent()` must create EPUB-compliant navigation XHTML from pre-loaded chapter content.

```typescript
describe('Contract: Navigation Generation', () => {
  test('generateNavigationFromContent creates valid EPUB navigation', () => {
    const chapters = [
      { 
        id: 'chapter1', 
        href: 'Text/chapter1.xhtml', 
        xhtmlContent: '<html><body><h1>Chapter 1: The Beginning</h1><p>Content...</p></body></html>',
        linear: true 
      },
      { 
        id: 'chapter2', 
        href: 'Text/chapter2.xhtml', 
        xhtmlContent: '<html><body><h1>Chapter 2: The Middle</h1><p>Content...</p></body></html>',
        linear: true 
      }
    ];
    
    const result = service.generateNavigationFromContent(chapters);
    
    // CONTRACT: MUST return EPUB-compliant navigation
    expect(result.xhtmlContent).toContain('epub:type="toc"');
    expect(result.xhtmlContent).toContain('role="navigation"');
    expect(result.xhtmlContent).toContain('<a href="Text/chapter1.xhtml">Chapter 1: The Beginning</a>');
    expect(result.xhtmlContent).toContain('<a href="Text/chapter2.xhtml">Chapter 2: The Middle</a>');
    expect(result.metadata.properties).toEqual(['nav']);
    expect(result.sourceType).toBe('auto-generated');
  });
  
  test('generateNavigationFromContent extracts titles from XHTML headings', () => {
    const chapters = [
      { 
        id: 'intro', 
        href: 'Text/intro.xhtml', 
        xhtmlContent: '<html><body><h2>Introduction to the Story</h2><p>Content...</p></body></html>',
        linear: true 
      }
    ];
    
    const result = service.generateNavigationFromContent(chapters);
    
    // CONTRACT: MUST extract title from first heading in XHTML
    expect(result.xhtmlContent).toContain('<a href="Text/intro.xhtml">Introduction to the Story</a>');
  });
  
  test('generateNavigationFromContent uses fallback titles for headingless content', () => {
    const chapters = [
      { 
        id: 'chapter1', 
        href: 'Text/chapter1.xhtml', 
        xhtmlContent: '<html><body><p>Content without heading...</p></body></html>',
        linear: true 
      }
    ];
    
    const result = service.generateNavigationFromContent(chapters);
    
    // CONTRACT: MUST use filename fallback when no heading found
    expect(result.xhtmlContent).toContain('<a href="Text/chapter1.xhtml">chapter1</a>');
  });
  
  test('generateNavigationFromContent handles empty chapters array', () => {
    const result = service.generateNavigationFromContent([]);
    
    // CONTRACT: MUST handle empty chapters gracefully
    expect(result.xhtmlContent).toContain('epub:type="toc"');
    expect(result.xhtmlContent).toContain('<ol></ol>'); // Empty list
    expect(result.metadata.id).toBe('nav');
  });
  
  test('generateNavigationFromContent skips non-linear chapters', () => {
    const chapters = [
      { 
        id: 'chapter1', 
        href: 'Text/chapter1.xhtml', 
        xhtmlContent: '<html><body><h1>Chapter 1</h1></body></html>',
        linear: true 
      },
      { 
        id: 'appendix', 
        href: 'Text/appendix.xhtml', 
        xhtmlContent: '<html><body><h1>Appendix</h1></body></html>',
        linear: false 
      }
    ];
    
    const result = service.generateNavigationFromContent(chapters);
    
    // CONTRACT: MUST only include linear chapters in navigation
    expect(result.xhtmlContent).toContain('Chapter 1');
    expect(result.xhtmlContent).not.toContain('Appendix');
  });
});
```

### Contract 3: Sample Content Generation

**Specification**: `generateLocalizedContent()` must create complete localized sample content.

```typescript
describe('Contract: Sample Content Generation', () => {
  test('generateLocalizedContent creates complete localized content', async () => {
    const result = await service.generateLocalizedContent('fr');
    
    // CONTRACT: MUST return complete localized content
    expect(result.locale).toBe('fr');
    expect(result.metadata.title).toBeDefined();
    expect(result.metadata.author).toBeDefined();
    expect(result.chapters.length).toBeGreaterThan(0);
    expect(result.chapters[0].content).toContain('# '); // Markdown content
    expect(result.isRTL).toBe(false); // French is LTR
  });
  
  test('generateLocalizedContent handles RTL languages', async () => {
    const result = await service.generateLocalizedContent('ar');
    
    // CONTRACT: MUST handle RTL languages correctly
    expect(result.locale).toBe('ar');
    expect(result.isRTL).toBe(true);
    expect(result.pageProgressionDirection).toBe('rtl');
  });
  
  test('generateLocalizedContent validates locale support', async () => {
    // CONTRACT: MUST reject unsupported locales
    await expect(
      service.generateLocalizedContent('invalid-locale')
    ).rejects.toThrow('UnsupportedLocaleError');
  });
});
```

### Contract 4: User Navigation Processing  

**Specification**: `processUserNavigation()` must process user-written navigation content into EPUB-compliant XHTML.

```typescript
describe('Contract: User Navigation Processing', () => {
  test('processUserNavigation transforms markdown to navigation XHTML', () => {
    const userNavText = `
# Table of Contents

- [Chapter 1: The Beginning](Text/chapter1.xhtml)
- [Chapter 2: The Middle](Text/chapter2.xhtml)
- [Chapter 3: The End](Text/chapter3.xhtml)
    `;
    
    const result = service.processUserNavigation(userNavText);
    
    // CONTRACT: MUST return EPUB-compliant navigation from user content
    expect(result.xhtmlContent).toContain('epub:type="toc"');
    expect(result.xhtmlContent).toContain('role="navigation"');
    expect(result.xhtmlContent).toContain('<a href="Text/chapter1.xhtml">Chapter 1: The Beginning</a>');
    expect(result.sourceType).toBe('user-content');
  });
  
  test('processUserNavigation handles plain text navigation', () => {
    const userNavText = `
Table of Contents

Chapter 1 - Text/chapter1.xhtml
Chapter 2 - Text/chapter2.xhtml
    `;
    
    const result = service.processUserNavigation(userNavText);
    
    // CONTRACT: MUST parse plain text navigation patterns
    expect(result.xhtmlContent).toContain('epub:type="toc"');
    expect(result.xhtmlContent).toContain('Chapter 1');
    expect(result.xhtmlContent).toContain('Chapter 2');
  });
  
  test('processUserNavigation handles empty navigation content', () => {
    const result = service.processUserNavigation('');
    
    // CONTRACT: MUST handle empty navigation gracefully
    expect(result.xhtmlContent).toContain('epub:type="toc"');
    expect(result.xhtmlContent).toContain('<ol></ol>');
    expect(result.metadata.id).toBe('nav');
  });
});
```

## Infrastructure Integration Contract

**Specification**: ContentService must properly use infrastructure components without calling other services.

```typescript
describe('Contract: Infrastructure Integration', () => {
  test('uses TransformExecutor for content transformation', async () => {
    const mockTransformExecutor = createMockTransformExecutor();
    const mockI18nSystem = createMockI18nSystem();
    const service = new ContentService(mockTransformExecutor, mockI18nSystem);
    
    await service.transformContent('# Test', { workspaceId: 'workspace-123' });
    
    // CONTRACT: MUST use TransformExecutor for transformations
    expect(mockTransformExecutor.transform).toHaveBeenCalledWith(
      '# Test',
      expect.objectContaining({ workspaceId: 'workspace-123' })
    );
  });
  
  test('uses I18nSystem for localized content generation', async () => {
    const mockTransformExecutor = createMockTransformExecutor();
    const mockI18nSystem = createMockI18nSystem();
    const service = new ContentService(mockTransformExecutor, mockI18nSystem);
    
    await service.generateLocalizedContent('fr');
    
    // CONTRACT: MUST use I18nSystem for translations
    expect(mockI18nSystem.translate).toHaveBeenCalledWith('sample.book.title');
    expect(mockI18nSystem.isLocaleSupported).toHaveBeenCalledWith('fr');
  });
  
  test('navigation generation requires no infrastructure', () => {
    const mockTransformExecutor = createMockTransformExecutor();
    const mockI18nSystem = createMockI18nSystem();
    const service = new ContentService(mockTransformExecutor, mockI18nSystem);
    
    const chapters = [
      { 
        id: 'chapter1', 
        href: 'Text/chapter1.xhtml', 
        xhtmlContent: '<html><body><h1>Test Chapter</h1></body></html>',
        linear: true 
      }
    ];
    
    const result = service.generateNavigationFromContent(chapters);
    
    // CONTRACT: Navigation generation must be pure - no infrastructure calls
    expect(mockTransformExecutor.transform).not.toHaveBeenCalled();
    expect(mockI18nSystem.translate).not.toHaveBeenCalled();
    expect(result.xhtmlContent).toContain('Test Chapter');
  });
});
```

## Error Handling Contract

**Specification**: All errors must be typed and recoverable.

```typescript
describe('Contract: Error Handling', () => {
  test('throws typed errors with context', async () => {
    try {
      await service.generateLocalizedContent('invalid-locale');
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedLocaleError);
      expect(error.locale).toBe('invalid-locale');
      expect(error.supportedLocales).toEqual(['en', 'fr', 'de', 'ar', 'he', 'ja', 'ka', 'zh-Hant']);
    }
  });
  
  test('provides error context for debugging', async () => {
    try {
      await service.transformContent(null as any, 'test-workspace');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.context).toEqual({
        operation: 'transformContent',
        sourceText: null,
        workspaceId: 'test-workspace'
      });
    }
  });
});
```

## Performance Contract

**Specification**: Operations must meet performance expectations.

```typescript
describe('Contract: Performance', () => {
  test('content transformation completes within acceptable time', async () => {
    const largeContent = '# Chapter\n\n' + 'Content paragraph. '.repeat(1000);
    
    const startTime = Date.now();
    const result = await service.transformContent(largeContent, 'test-workspace');
    const duration = Date.now() - startTime;
    
    // CONTRACT: MUST transform typical content within 500ms
    expect(duration).toBeLessThan(500);
    expect(result.transformTime).toBeLessThan(500);
  });
  
  test('navigation generation scales with spine size', async () => {
    const largeSpine = Array.from({ length: 100 }, (_, i) => ({
      idref: `chapter${i}`,
      title: `Chapter ${i}`,
      href: `Text/chapter${i}.xhtml`
    }));
    
    const startTime = Date.now();
    await service.generateNavigationFromSpine(largeSpine);
    const duration = Date.now() - startTime;
    
    // CONTRACT: MUST handle large spines efficiently
    expect(duration).toBeLessThan(1000); // 1 second for 100 chapters
  });
});
```

## Implementation Guidance

### Red Phase (Failing Tests)
1. **Copy all contract tests** into `src/lib/services/content/content.service.test.ts`
2. **Run tests** - they should all fail (Red phase)
3. **Create minimal class** that satisfies TypeScript compilation

### Green Phase (Make Tests Pass)
1. **Implement ContentService class** with infrastructure dependencies only
2. **Use TransformExecutor and I18nSystem** as dependencies
3. **Make each contract test pass** one at a time
4. **Focus on simplest implementation** that satisfies contracts

### Refactor Phase (Optimize)
1. **Extract common patterns** and utilities
2. **Optimize performance** while maintaining contract compliance
3. **Add error handling** and edge case coverage
4. **Ensure all contracts still pass**

## Success Criteria

- ✅ All contract tests pass
- ✅ No dependencies on other services (only infrastructure)
- ✅ Returns pure content objects for reactive consumption
- ✅ Handles all supported content types and locales
- ✅ Provides typed, recoverable errors
- ✅ Meets performance expectations
- ✅ Proper EPUB compliance for generated content

This contract serves as the **executable specification** for TDD implementation of ContentService in the clean service architecture.