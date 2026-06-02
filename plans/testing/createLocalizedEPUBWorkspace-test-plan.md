# TDD Test Plan: createLocalizedEPUBWorkspace()

## Overview

This document outlines the Test-Driven Development (TDD) test plan for the new `createLocalizedEPUBWorkspace()` method in WorkspaceManager. The plan focuses on testing main functional differences and critical integration points rather than exhaustive locale coverage.

## Test Strategy

### Scope

- **Focus**: Core functionality and key localization differences
- **Approach**: TDD with focused test cases covering essential behaviors
- **Locales**: Strategic selection (English LTR, Arabic RTL, Japanese complex script)
- **Integration**: Mock dependencies for isolated unit testing

### Test File Location

- `src/lib/workspace/test/workspace-manager-localized.test.ts`

## Core Test Categories

### 1. Basic Functionality Tests

#### Test: Creates workspace with valid parameters

```typescript
test('should create workspace with valid metadata and locale', async () => {
  const metadata = { title: 'Test EPUB', creator: ['Test Author'] };
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace(metadata, 'en');

  expect(workspaceId).toBeTruthy();
  expect(workspaceId).toMatch(/^workspace-\w+$/);
});
```

#### Test: Uses existing createEPUBWorkspace as foundation

```typescript
test('should call existing createEPUBWorkspace method', async () => {
  const createEPUBSpy = jest.spyOn(workspaceManager, 'createEPUBWorkspace');

  await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  expect(createEPUBSpy).toHaveBeenCalledWith({});
});
```

#### Test: Handles default parameters

```typescript
test('should handle default empty metadata and locale', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace();

  expect(workspaceId).toBeTruthy();
  // Should default to 'en' locale
});
```

### 2. Asset Installation Tests

#### Test: Installs universal CSS

```typescript
test('should install page.css in OEBPS/Styles/', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  const cssContent = await storage.readTextFile(workspaceId, 'OEBPS/Styles/page.css');
  expect(cssContent).toContain('/* Universal CSS for all locales');
  expect(cssContent).toContain('margin-inline');
  expect(cssContent).toContain('@supports');
});
```

#### Test: Installs transform scripts

```typescript
test('should install transform scripts in SOURCE/scripts/', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  const textScript = await storage.readTextFile(workspaceId, 'SOURCE/scripts/transformText.js');
  const domScript = await storage.readTextFile(workspaceId, 'SOURCE/scripts/transformDom.js');

  expect(textScript).toContain('function transformText');
  expect(domScript).toContain('function transformDOM');
});
```

#### Test: Creates basic settings.json

```typescript
test('should create settings.json with transform configuration', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  const settingsContent = await storage.readTextFile(workspaceId, 'SOURCE/settings.json');
  const settings = JSON.parse(settingsContent);

  expect(settings.version).toBe('1.0.0');
  expect(settings.transforms.text.script).toBe('transformText.js');
  expect(settings.transforms.text.enabled).toBe(true);
  expect(settings.transforms.dom.script).toBe('transformDom.js');
  expect(settings.transforms.dom.enabled).toBe(true);
});
```

### 3. Sample Content Generation Tests

#### Test: Integrates with SampleContentGenerator

```typescript
test('should generate sample content using SampleContentGenerator', async () => {
  const mockContent = {
    'prologue.txt': '# Prologue\n\nThis is the beginning...',
    'chapter1.txt': '# Chapter 1\n\nThe story starts...',
  };
  mockSampleContentGenerator.generateLocalizedContent.mockResolvedValue(mockContent);

  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  expect(mockSampleContentGenerator.generateLocalizedContent).toHaveBeenCalledWith('en');
});
```

#### Test: Creates SOURCE text files

```typescript
test('should create SOURCE text files from generated content', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  const prologueContent = await storage.readTextFile(workspaceId, 'SOURCE/text/prologue.txt');
  const chapter1Content = await storage.readTextFile(workspaceId, 'SOURCE/text/chapter1.txt');

  expect(prologueContent).toBeTruthy();
  expect(chapter1Content).toBeTruthy();
});
```

#### Test: Creates OEBPS XHTML files

```typescript
test('should transform text to XHTML and create OEBPS files', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  const prologueXHTML = await storage.readTextFile(workspaceId, 'OEBPS/Text/prologue.xhtml');
  const chapter1XHTML = await storage.readTextFile(workspaceId, 'OEBPS/Text/chapter1.xhtml');

  expect(prologueXHTML).toContain('<?xml version="1.0"');
  expect(prologueXHTML).toContain('<html xmlns="http://www.w3.org/1999/xhtml"');
  expect(prologueXHTML).toContain('<h1>');

  expect(chapter1XHTML).toContain('<?xml version="1.0"');
  expect(chapter1XHTML).toContain('<html xmlns="http://www.w3.org/1999/xhtml"');
});
```

#### Test: Updates manifest and spine

```typescript
test('should update manifest and spine with generated content', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  const opfContent = await storage.readTextFile(workspaceId, 'OEBPS/content.opf');

  expect(opfContent).toContain('id="prologue"');
  expect(opfContent).toContain('id="chapter1"');
  expect(opfContent).toContain('href="Text/prologue.xhtml"');
  expect(opfContent).toContain('href="Text/chapter1.xhtml"');
  expect(opfContent).toContain('<itemref idref="prologue"');
  expect(opfContent).toContain('<itemref idref="chapter1"');
});
```

### 4. Localization-Specific Tests

#### Test: English (LTR baseline)

```typescript
test('should create proper LTR structure for English locale', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  const navContent = await storage.readTextFile(workspaceId, 'OEBPS/Text/nav.xhtml');

  expect(navContent).toContain('lang="en"');
  expect(navContent).not.toContain('dir="rtl"');
  expect(navContent).toContain(mockTranslate('navigation.tableOfContents'));
});
```

#### Test: Arabic (RTL)

```typescript
test('should create proper RTL structure for Arabic locale', async () => {
  mockDocumentDirection.mockReturnValue('rtl');

  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'ar');

  const navContent = await storage.readTextFile(workspaceId, 'OEBPS/Text/nav.xhtml');

  expect(navContent).toContain('lang="ar"');
  expect(navContent).toContain('dir="rtl"');
  expect(navContent).toContain(mockTranslate('navigation.tableOfContents'));
});
```

#### Test: Japanese (complex script)

```typescript
test('should handle complex script locale (Japanese)', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'ja');

  const navContent = await storage.readTextFile(workspaceId, 'OEBPS/Text/nav.xhtml');
  const chapter1Content = await storage.readTextFile(workspaceId, 'OEBPS/Text/chapter1.xhtml');

  expect(navContent).toContain('lang="ja"');
  expect(navContent).not.toContain('dir="rtl"');
  expect(chapter1Content).toContain('lang="ja"');
});
```

### 5. Navigation Document Tests

#### Test: Creates navigation document with proper structure

```typescript
test('should create nav.xhtml with EPUB 3.0 structure', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  const navContent = await storage.readTextFile(workspaceId, 'OEBPS/Text/nav.xhtml');

  expect(navContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  expect(navContent).toContain('<!DOCTYPE html>');
  expect(navContent).toContain('xmlns="http://www.w3.org/1999/xhtml"');
  expect(navContent).toContain('xmlns:epub="http://www.idpf.org/2007/ops"');
  expect(navContent).toContain('<nav epub:type="toc"');
});
```

#### Test: Uses localized navigation titles

```typescript
test('should use localized titles in navigation document', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  const navContent = await storage.readTextFile(workspaceId, 'OEBPS/Text/nav.xhtml');

  expect(mockTranslate).toHaveBeenCalledWith('navigation.title');
  expect(mockTranslate).toHaveBeenCalledWith('navigation.tableOfContents');
  expect(mockTranslate).toHaveBeenCalledWith('content.prologue');
  expect(mockTranslate).toHaveBeenCalledWith('content.chapter1');

  expect(navContent).toContain(mockTranslate('navigation.title'));
  expect(navContent).toContain(mockTranslate('navigation.tableOfContents'));
});
```

#### Test: Does not include CSS stylesheet

```typescript
test('should not include CSS stylesheet in navigation document', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  const navContent = await storage.readTextFile(workspaceId, 'OEBPS/Text/nav.xhtml');

  expect(navContent).not.toContain('<link rel="stylesheet"');
  expect(navContent).not.toContain('page.css');
});
```

#### Test: Includes chapter links with proper structure

```typescript
test('should include chapter links in navigation TOC', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  const navContent = await storage.readTextFile(workspaceId, 'OEBPS/Text/nav.xhtml');

  expect(navContent).toContain('<a href="prologue.xhtml">');
  expect(navContent).toContain('<a href="chapter1.xhtml">');
  expect(navContent).toContain('<ol>');
  expect(navContent).toContain('</ol>');
});
```

### 6. Integration Tests

#### Test: Transform pipeline integration

```typescript
test('should use existing transform pipeline correctly', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  expect(mockTransformExecutor.executeTextTransform).toHaveBeenCalledWith(
    expect.stringContaining('function transformText'),
    'transformText.js',
    expect.any(String),
    { locale: 'en' }
  );

  expect(mockTransformExecutor.executeDOMTransform).toHaveBeenCalledWith(
    expect.stringContaining('function transformDOM'),
    'transformDom.js',
    expect.any(Object)
  );
});
```

#### Test: SourceManager integration

```typescript
test('should integrate with existing SourceManager', async () => {
  const initStructureSpy = jest.spyOn(mockSourceManager, 'initializeSourceStructure');

  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  expect(initStructureSpy).toHaveBeenCalledWith(workspaceId);
});
```

#### Test: i18n system integration

```typescript
test('should integrate with i18n system properly', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'de');

  expect(mockTranslate).toHaveBeenCalledWith('navigation.title');
  expect(mockTranslate).toHaveBeenCalledWith('navigation.tableOfContents');
  expect(mockTranslate).toHaveBeenCalledWith('content.prologue');

  expect(mockDocumentDirection.get).toHaveBeenCalled();
});
```

### 7. Error Handling Tests

#### Test: SampleContentGenerator failure

```typescript
test('should handle SampleContentGenerator failure gracefully', async () => {
  mockSampleContentGenerator.generateLocalizedContent.mockRejectedValue(
    new Error('Content generation failed')
  );

  await expect(workspaceManager.createLocalizedEPUBWorkspace({}, 'en')).rejects.toThrow(
    'Content generation failed'
  );

  // Verify cleanup was attempted
  expect(mockStorage.deleteWorkspace).toHaveBeenCalled();
});
```

#### Test: Transform pipeline failure

```typescript
test('should handle transform pipeline failure', async () => {
  mockTransformExecutor.executeTextTransform.mockRejectedValue(new Error('Transform failed'));

  await expect(workspaceManager.createLocalizedEPUBWorkspace({}, 'en')).rejects.toThrow(
    'Transform failed'
  );
});
```

#### Test: File system write failure

```typescript
test('should handle file system write failures', async () => {
  mockStorage.writeTextFile.mockRejectedValue(new Error('Write failed'));

  await expect(workspaceManager.createLocalizedEPUBWorkspace({}, 'en')).rejects.toThrow(
    'Write failed'
  );
});
```

#### Test: Cleanup on partial failure

```typescript
test('should cleanup workspace on partial failure', async () => {
  // Mock failure after workspace is created but before completion
  mockStorage.writeTextFile
    .mockResolvedValueOnce() // First write succeeds
    .mockRejectedValue(new Error('Subsequent write failed')); // Later writes fail

  const deleteWorkspaceSpy = jest.spyOn(workspaceManager, 'deleteWorkspace');

  await expect(workspaceManager.createLocalizedEPUBWorkspace({}, 'en')).rejects.toThrow();

  expect(deleteWorkspaceSpy).toHaveBeenCalled();
});
```

## Mock Strategy

### Dependencies to Mock

#### SampleContentGenerator

```typescript
const mockSampleContentGenerator = {
  generateLocalizedContent: jest.fn().mockResolvedValue({
    'prologue.txt': '# Prologue\n\nThis is the beginning...',
    'chapter1.txt': '# Chapter 1\n\nThe story starts...',
    'appendix.txt': '# Appendix\n\nAdditional information...',
  }),
};
```

#### TransformExecutor

```typescript
const mockTransformExecutor = {
  executeTextTransform: jest.fn().mockResolvedValue('<h1>Transformed HTML</h1>'),
  executeDOMTransform: jest.fn().mockResolvedValue({
    documentElement: {
      innerHTML: '<h1 id="transformed">Transformed HTML</h1>',
    },
  }),
};
```

#### i18n System

```typescript
const mockTranslate = jest.fn().mockImplementation(key => {
  const translations = {
    'navigation.title': 'Navigation',
    'navigation.tableOfContents': 'Table of Contents',
    'content.prologue': 'Prologue',
    'content.chapter1': 'Chapter 1',
    'content.appendix': 'Appendix',
  };
  return translations[key] || key;
});

const mockDocumentDirection = {
  get: jest.fn().mockReturnValue('ltr'),
};
```

#### Storage

```typescript
const mockStorage = {
  writeTextFile: jest.fn().mockResolvedValue(),
  readTextFile: jest.fn().mockResolvedValue(''),
  createDirectory: jest.fn().mockResolvedValue(),
  deleteWorkspace: jest.fn().mockResolvedValue(),
};
```

## File Structure Validation Tests

#### Test: All expected directories created

```typescript
test('should create all expected directory structure', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  const expectedDirectories = ['OEBPS/Text', 'OEBPS/Styles', 'SOURCE/text', 'SOURCE/scripts'];

  for (const dir of expectedDirectories) {
    expect(mockStorage.createDirectory).toHaveBeenCalledWith(workspaceId, dir);
  }
});
```

#### Test: All expected files present

```typescript
test('should create all expected files with correct paths', async () => {
  const workspaceId = await workspaceManager.createLocalizedEPUBWorkspace({}, 'en');

  const expectedFiles = [
    'mimetype',
    'META-INF/container.xml',
    'OEBPS/content.opf',
    'OEBPS/Styles/page.css',
    'OEBPS/Text/nav.xhtml',
    'OEBPS/Text/prologue.xhtml',
    'OEBPS/Text/chapter1.xhtml',
    'SOURCE/text/prologue.txt',
    'SOURCE/text/chapter1.txt',
    'SOURCE/scripts/transformText.js',
    'SOURCE/scripts/transformDom.js',
    'SOURCE/settings.json',
  ];

  for (const file of expectedFiles) {
    expect(mockStorage.writeTextFile).toHaveBeenCalledWith(workspaceId, file, expect.any(String));
  }
});
```

## Test Setup and Teardown

### Setup

```typescript
beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks();

  // Setup default mock returns
  mockSampleContentGenerator.generateLocalizedContent.mockResolvedValue(mockSampleContent);
  mockTransformExecutor.executeTextTransform.mockResolvedValue('<h1>Test</h1>');
  mockTransformExecutor.executeDOMTransform.mockResolvedValue(mockDOM);
  mockTranslate.mockImplementation(getDefaultTranslation);
  mockDocumentDirection.get.mockReturnValue('ltr');

  // Create fresh instance with mocked dependencies
  workspaceManager = new WorkspaceManager(
    mockStorage,
    mockSampleContentGenerator,
    mockTransformExecutor,
    mockSourceManager
  );
});
```

### Teardown

```typescript
afterEach(() => {
  jest.restoreAllMocks();
});
```

## Test Execution Strategy

### TDD Workflow

1. **Write failing test** for specific behavior
2. **Implement minimal code** to make test pass
3. **Refactor** while keeping tests green
4. **Repeat** for each behavior

### Test Categories Priority

1. **Basic functionality** (core workspace creation)
2. **Asset installation** (universal assets integration)
3. **Sample content flow** (generation → transformation → files)
4. **Localization differences** (LTR/RTL, translation keys)
5. **Error handling** (graceful failures and cleanup)
6. **Integration points** (existing component integration)

This focused test plan ensures comprehensive coverage of the essential functionality while maintaining the TDD approach and avoiding exhaustive locale testing that would be better suited for integration tests.
