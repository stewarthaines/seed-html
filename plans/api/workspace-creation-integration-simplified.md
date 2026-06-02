# Simplified Workspace Creation Integration Plan

## Overview

This document outlines a practical approach to enhance the existing "Create New" button functionality by integrating existing components to create complete, functional EPUB workspaces with localized sample content. This plan focuses on minimal additions to existing code while maximizing user value.

### Goals

- Enhance WorkspaceManager with one new method for complete workspace creation
- Integrate existing SampleContentGenerator with workspace creation
- Use static universal assets (CSS + transform scripts) via `?raw` imports
- Create functional sample EPUBs that users can immediately preview and edit
- Maintain existing component architecture without major refactoring

## Current State Analysis

### Existing Components

#### WorkspaceManager

**Current Capabilities:**

- Creates basic EPUB structure (mimetype, container.xml, content.opf)
- Creates directory structure (OEBPS/Text, OEBPS/Styles, etc.)
- Integrates with SourceManager for SOURCE/ directory creation
- Generates workspace IDs and manages workspace metadata

**Missing for Complete Workspace Creation:**

- Sample content generation and integration
- XHTML file creation from sample content
- CSS and transform script installation
- Navigation document generation
- Populated manifest and spine

#### SampleContentGenerator

**Current Capabilities:**

- Generates localized sample content for all supported languages
- Creates appropriate metadata for different locales
- Handles RTL languages and complex scripts
- Produces ready-to-use markdown content

**Current Integration Status:**

- Exists but not integrated with workspace creation
- Used in some Storybook demos but not in actual workflows

#### Universal Assets

**New Static Files (just created):**

- `src/assets/universal/page.css` - Universal CSS with logical properties
- `src/assets/universal/transformText.js` - Markdown to HTML converter
- `src/assets/universal/transformDom.js` - DOM processing for navigation IDs

**Integration Approach:**

- Import via Svelte's `?raw` imports (no service layer needed)
- Include directly in EPUB during workspace creation

#### Transform Pipeline

**Current Capabilities:**

- TransformExecutor for running text and DOM transforms
- XHTML template generation with `generateXHTMLDocument()`
- Error handling and validation

**Current Integration Status:**

- Available but not used during initial workspace creation

## Minimal Integration Plan

### 1. Enhanced WorkspaceManager Method

Add one new method to WorkspaceManager:

```typescript
/**
 * Create complete EPUB workspace with localized sample content
 */
async createLocalizedEPUBWorkspace(
  metadata: Partial<EPUBMetadata>,
  locale: string
): Promise<string>
```

**Implementation Strategy:**

1. Start with existing `createEPUBWorkspace()` method
2. Add sample content generation using SampleContentGenerator
3. Transform sample content to XHTML using existing transform pipeline
4. Install universal assets using `?raw` imports
5. Create navigation document with localized "Table of Contents"
6. Populate manifest and spine with generated content

### 2. Asset Integration via Raw Imports

```typescript
// At the top of enhanced WorkspaceManager
import pageCSS from '../assets/universal/page.css?raw';
import transformTextJS from '../assets/universal/transformText.js?raw';
import transformDomJS from '../assets/universal/transformDom.js?raw';
import { translate } from '$lib/i18n';
import { documentDirection } from '$lib/i18n';
import { get } from 'svelte/store';
```

**Installation Points:**

- `OEBPS/Styles/page.css` - Universal CSS
- `SOURCE/scripts/transformText.js` - Text transform script
- `SOURCE/scripts/transformDom.js` - DOM transform script

### 3. Sample Content Integration Flow

```
1. Generate localized content (SampleContentGenerator)
2. Create SOURCE/text/ files (plain text)
3. Transform to HTML (existing TransformExecutor)
4. Apply DOM transforms (existing TransformExecutor)
5. Wrap in XHTML templates (existing generateXHTMLDocument)
6. Create OEBPS/Text/ files (XHTML)
7. Update manifest and spine
```

### 4. Navigation Document Generation

Create simple localized nav.xhtml using proper i18n system:

```typescript
private generateNavigationDocument(locale: string, chapterIds: string[]): string {
  const tocTitle = translate('navigation.tableOfContents');
  const isRTL = get(documentDirection) === 'rtl';
  // ... generate EPUB 3.0 compliant navigation
}
```

**Localization Points:**

- "Table of Contents" title using i18n translation keys
- RTL text direction using existing documentDirection store
- Chapter titles using catalog-based translations

## Implementation Details

### Required WorkspaceManager Enhancements

#### 1. Main Enhanced Creation Method

```typescript
async createLocalizedEPUBWorkspace(
  metadata: Partial<EPUBMetadata> = {},
  locale: string = 'en'
): Promise<string> {
  // 1. Create basic EPUB structure
  const workspaceId = await this.createEPUBWorkspace(metadata);

  // 2. Generate localized sample content
  const contentGenerator = new SampleContentGenerator();
  const sampleContent = await contentGenerator.generateLocalizedContent(locale);

  // 3. Install universal assets
  await this.installUniversalAssets(workspaceId);

  // 4. Create sample text files and XHTML files
  await this.createSampleContent(workspaceId, sampleContent, locale);

  // 5. Create navigation document
  await this.createNavigationDocument(workspaceId, locale, Object.keys(sampleContent));

  // 6. Update manifest and spine
  await this.populateManifestAndSpine(workspaceId, Object.keys(sampleContent));

  return workspaceId;
}
```

#### 2. Asset Installation Helper

```typescript
private async installUniversalAssets(workspaceId: string): Promise<void> {
  // Install CSS
  await this.storage.writeTextFile(workspaceId, 'OEBPS/Styles/page.css', pageCSS);

  // Install transform scripts
  await this.storage.writeTextFile(workspaceId, 'SOURCE/scripts/transformText.js', transformTextJS);
  await this.storage.writeTextFile(workspaceId, 'SOURCE/scripts/transformDom.js', transformDomJS);

  // Create basic settings.json
  const basicSettings = {
    version: '1.0.0',
    transforms: {
      text: { script: 'transformText.js', enabled: true },
      dom: { script: 'transformDom.js', enabled: true }
    }
  };
  await this.storage.writeTextFile(
    workspaceId,
    'SOURCE/settings.json',
    JSON.stringify(basicSettings, null, 2)
  );
}
```

#### 3. Sample Content Creation

```typescript
private async createSampleContent(
  workspaceId: string,
  sampleContent: Record<string, string>,
  locale: string
): Promise<void> {
  const transformExecutor = new TransformExecutor();

  for (const [filename, content] of Object.entries(sampleContent)) {
    // Create SOURCE text file
    await this.storage.writeTextFile(workspaceId, `SOURCE/text/${filename}`, content);

    // Transform to XHTML
    const transformedText = await transformExecutor.executeTextTransform(
      transformTextJS,
      'transformText.js',
      content,
      { locale }
    );

    const htmlDoc = new DOMParser().parseFromString(transformedText, 'text/html');
    const transformedDOM = await transformExecutor.executeDOMTransform(
      transformDomJS,
      'transformDom.js',
      htmlDoc
    );

    const chapterId = filename.replace('.txt', '');
    const chapterTitle = this.getChapterTitle(filename);

    const xhtmlContent = generateXHTMLDocument(
      transformedDOM.documentElement.innerHTML,
      {
        title: chapterTitle,
        language: locale,
        stylesheets: ['../Styles/page.css']
      }
    );

    // Create OEBPS XHTML file
    await this.storage.writeTextFile(
      workspaceId,
      `OEBPS/Text/${chapterId}.xhtml`,
      xhtmlContent
    );
  }
}
```

#### 4. Navigation Document Creation

```typescript
private createNavigationDocument(
  workspaceId: string,
  locale: string,
  chapterFiles: string[]
): Promise<void> {
  const tocTitle = translate('navigation.tableOfContents');
  const isRTL = get(documentDirection) === 'rtl';

  const tocEntries = chapterFiles.map(filename => {
    const chapterId = filename.replace('.txt', '');
    const chapterTitle = this.getChapterTitle(filename);
    return `<li><a href="${chapterId}.xhtml">${chapterTitle}</a></li>`;
  }).join('\n      ');

  const navContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"
      lang="${locale}"${isRTL ? ' dir="rtl"' : ''}>
<head>
  <meta charset="UTF-8"/>
  <title>${translate('navigation.title')}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${tocTitle}</h1>
    <ol>
      ${tocEntries}
    </ol>
  </nav>
</body>
</html>`;

  return this.storage.writeTextFile(workspaceId, 'OEBPS/Text/nav.xhtml', navContent);
}
```

#### 5. Localization Helpers Using i18n System

```typescript
private getChapterTitle(filename: string): string {
  // Map filename to localized chapter title using translation keys
  const chapterKeyMap = {
    'prologue.txt': 'content.prologue',
    'chapter1.txt': 'content.chapter1',
    'appendix.txt': 'content.appendix'
  };

  const translationKey = chapterKeyMap[filename];
  return translationKey ? translate(translationKey) : filename;
}
```

## Integration Points

### With Existing UI (Create New Button)

```typescript
// In workspace creation UI component
import { getCurrentLocale } from '$lib/i18n';

async handleCreateNew() {
  try {
    const locale = getCurrentLocale();
    const workspaceId = await this.workspaceManager.createLocalizedEPUBWorkspace({}, locale);

    // Navigate to first spine item for immediate preview
    await this.navigationRouter.navigate(`/workspace/${workspaceId}/text/prologue`);

    // Show success notification
    this.showSuccessNotification(workspaceId, locale);
  } catch (error) {
    this.showErrorNotification(error);
  }
}
```

### With Existing Components

- **SampleContentGenerator**: Direct integration via existing API
- **TransformExecutor**: Use existing transform pipeline
- **NavigationRouter**: Post-creation navigation to content
- **I18n System**: Locale detection and RTL handling via proper translation keys
- **SourceManager**: Continues to handle SOURCE/ structure via existing integration

## Required Translation Keys

The following translation keys need to be added to all language catalogs (`src/lib/i18n/locales/*.json`):

### Navigation Keys

```json
{
  "navigation.title": "Navigation",
  "navigation.tableOfContents": "Table of Contents"
}
```

### Content Keys

```json
{
  "content.prologue": "Prologue",
  "content.chapter1": "Chapter 1",
  "content.appendix": "Appendix"
}
```

### Workspace Creation Keys

```json
{
  "workspace.creation.success": "Workspace created successfully",
  "workspace.creation.error": "Failed to create workspace"
}
```

These keys should follow the established naming conventions from the i18n README and be translated appropriately for each supported language (en, de, ar, he, ja, ka, zh-TW).

## Testing Strategy

### Unit Tests

- Test `createLocalizedEPUBWorkspace()` for each supported locale
- Verify asset installation and file creation
- Test navigation document generation with RTL handling
- Validate manifest and spine population

### Integration Tests

- End-to-end workspace creation flow
- Verify sample content transforms correctly
- Test immediate workspace usability after creation
- Validate EPUB structure compliance

### User Experience Tests

- Test "Create New" button with loading states
- Verify navigation after creation
- Test workspace accessibility immediately after creation

## Benefits of This Approach

### Minimal Code Changes

- One new method in WorkspaceManager
- Direct integration with existing components
- No new service layer or complex architecture

### Maximum User Value

- Complete, functional EPUB workspaces
- Immediate content to preview and edit
- Localized content in user's language
- Professional EPUB structure

### Future-Proof Foundation

- Sets up integration patterns for future enhancements
- Maintains existing component boundaries
- Easy to extend with templates or custom content options

## Next Steps

1. **Implement Enhanced WorkspaceManager Method**: Add `createLocalizedEPUBWorkspace()`
2. **Update UI Integration**: Modify "Create New" button to use enhanced method
3. **Add Comprehensive Testing**: Ensure all locales work correctly
4. **Documentation Updates**: Update API docs and user guides
5. **User Testing**: Validate improved workspace creation experience

This simplified approach provides immediate value while maintaining the existing architecture and setting up for future enhancements.
