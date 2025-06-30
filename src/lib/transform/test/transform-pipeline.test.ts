import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransformPipeline } from '../transform-pipeline.js';
import { TransformError } from '../transform-error.js';
import { MockFileStorage } from './mocks/file-storage.mock.js';
import { MockBlobUrlManager } from './mocks/blob-url-manager.mock.js';
import {
  createCompleteTransformWorkspace,
  createMinimalTransformWorkspace,
  createBrokenTransformWorkspace,
  createTimeoutTransformWorkspace,
  createNoSettingsWorkspace,
  createInvalidSettingsWorkspace,
  createMissingScriptsWorkspace,
  createTestDocument,
  validateTransformResult,
  SAMPLE_PLAIN_TEXT,
  SAMPLE_CHAPTER_METADATA,
  SAMPLE_TRANSFORM_CONTEXT,
  TEST_WORKSPACE_IDS
} from './fixtures/create-test-data.js';

describe('TransformPipeline', () => {
  let transformPipeline: TransformPipeline;
  let mockFileStorage: MockFileStorage;
  let mockBlobUrlManager: MockBlobUrlManager;

  beforeEach(() => {
    mockFileStorage = new MockFileStorage();
    mockBlobUrlManager = new MockBlobUrlManager();
    transformPipeline = new TransformPipeline(mockFileStorage as any, mockBlobUrlManager as any);
  });

  afterEach(() => {
    mockFileStorage.reset();
    mockBlobUrlManager.reset();
    vi.clearAllMocks();
  });

  describe('executeTransformPipeline()', () => {
    it('should execute complete pipeline with text and DOM transforms', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteTransformWorkspace());
      
      // Setup extension libraries
      await mockBlobUrlManager.simulateExtensionLibraryLoading(workspaceId, [
        { path: 'SOURCE/extensions/markdown-it/markdown-it.min.js', globalName: 'markdownit' }
      ]);

      const result = await transformPipeline.executeTransformPipeline(
        SAMPLE_PLAIN_TEXT.markdown,
        workspaceId,
        'chapter1',
        SAMPLE_CHAPTER_METADATA.basic
      );

      expect(result.success).toBe(true);
      expect(result.xhtmlDocument).toBeInstanceOf(Document);
      expect(result.executionTime).toBeGreaterThan(0);
      
      // Verify XHTML structure
      const xhtml = result.xhtmlDocument!.documentElement.outerHTML;
      expect(xhtml).toContain('<html xmlns="http://www.w3.org/1999/xhtml"');
      expect(xhtml).toContain('<title>Chapter 1: Introduction</title>');
      expect(xhtml).toContain('<h1>Chapter 1: Getting Started</h1>');
      expect(xhtml).toContain('id="chapter-1-getting-started"'); // Added by heading-ids.js
      expect(xhtml).toContain('class="custom-header"'); // Added by custom-styling.js
    });

    it('should handle text-only transform pipeline', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, createMinimalTransformWorkspace());
      
      await mockBlobUrlManager.simulateExtensionLibraryLoading(workspaceId, [
        { path: 'SOURCE/extensions/markdown-it/markdown-it.min.js', globalName: 'markdownit' }
      ]);

      const result = await transformPipeline.executeTransformPipeline(
        SAMPLE_PLAIN_TEXT.simple,
        workspaceId,
        'chapter1',
        SAMPLE_CHAPTER_METADATA.basic
      );

      expect(result.success).toBe(true);
      expect(result.xhtmlDocument).toBeInstanceOf(Document);
      
      const bodyContent = result.xhtmlDocument!.body.innerHTML;
      expect(bodyContent).toContain('<p>Hello World</p>');
    });

    it('should handle transform pipeline with :toc directive', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteTransformWorkspace());
      
      await mockBlobUrlManager.simulateExtensionLibraryLoading(workspaceId, [
        { path: 'SOURCE/extensions/markdown-it/markdown-it.min.js', globalName: 'markdownit' }
      ]);

      const result = await transformPipeline.executeTransformPipeline(
        SAMPLE_PLAIN_TEXT.markdownWithToc,
        workspaceId,
        'chapter1',
        SAMPLE_CHAPTER_METADATA.basic
      );

      expect(result.success).toBe(true);
      
      const bodyContent = result.xhtmlDocument!.body.innerHTML;
      expect(bodyContent).toContain('<h2>Table of Contents</h2>');
      expect(bodyContent).toContain('<a href="#chapter1">chapter1</a>'); // Generated from context
    });

    it('should fail on transform script errors', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.BROKEN;
      await mockFileStorage.addTestFiles(workspaceId, createBrokenTransformWorkspace());

      const result = await transformPipeline.executeTransformPipeline(
        SAMPLE_PLAIN_TEXT.simple,
        workspaceId,
        'chapter1',
        SAMPLE_CHAPTER_METADATA.basic
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TransformError);
      expect(result.error!.stage).toBe('text');
      expect(result.error!.toUserMessage()).toContain('Text Transform');
    });

    it('should handle missing settings gracefully', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.NO_SETTINGS;
      await mockFileStorage.addTestFiles(workspaceId, createNoSettingsWorkspace());

      const result = await transformPipeline.executeTransformPipeline(
        SAMPLE_PLAIN_TEXT.simple,
        workspaceId,
        'chapter1',
        SAMPLE_CHAPTER_METADATA.basic
      );

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('No transform pipeline settings found');
      
      // Should generate XHTML with original text
      const bodyContent = result.xhtmlDocument!.body.innerHTML;
      expect(bodyContent).toContain('Hello World');
    });

    it('should handle timeout scenarios', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.TIMEOUT;
      await mockFileStorage.addTestFiles(workspaceId, createTimeoutTransformWorkspace());

      const result = await transformPipeline.executeTransformPipeline(
        SAMPLE_PLAIN_TEXT.simple,
        workspaceId,
        'chapter1',
        SAMPLE_CHAPTER_METADATA.basic
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TransformError);
      expect(result.error!.message).toContain('timeout');
    });

    it('should generate proper XHTML with metadata', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, createMinimalTransformWorkspace());
      
      await mockBlobUrlManager.simulateExtensionLibraryLoading(workspaceId, [
        { path: 'SOURCE/extensions/markdown-it/markdown-it.min.js', globalName: 'markdownit' }
      ]);

      const result = await transformPipeline.executeTransformPipeline(
        '# Test Chapter',
        workspaceId,
        'chapter1',
        SAMPLE_CHAPTER_METADATA.advanced
      );

      expect(result.success).toBe(true);
      
      const xhtml = result.xhtmlDocument!.documentElement.outerHTML;
      expect(xhtml).toContain('xml:lang="en"');
      expect(xhtml).toContain('<title>Chapter 2: Advanced Topics</title>');
      expect(xhtml).toContain('href="../Styles/main.css"');
      expect(xhtml).toContain('href="../Styles/chapter.css"');
      expect(xhtml).toContain('src="../Scripts/reader.js"');
      expect(xhtml).toContain('<meta name="chapter" content="2" />');
    });
  });

  describe('transformText()', () => {
    it('should execute text transform with context', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, createMinimalTransformWorkspace());
      
      await mockBlobUrlManager.simulateExtensionLibraryLoading(workspaceId, [
        { path: 'SOURCE/extensions/markdown-it/markdown-it.min.js', globalName: 'markdownit' }
      ]);

      const result = await transformPipeline.transformText(
        SAMPLE_PLAIN_TEXT.markdown,
        workspaceId,
        'chapter1'
      );

      expect(result.success).toBe(true);
      expect(result.transformedText).toContain('<h1>Chapter 1: Getting Started</h1>');
      expect(result.transformedText).toContain('<strong>basics</strong>');
      expect(validateTransformResult(result)).toBe(true);
    });

    it('should provide manifest context for :toc directive', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteTransformWorkspace());
      
      await mockBlobUrlManager.simulateExtensionLibraryLoading(workspaceId, [
        { path: 'SOURCE/extensions/markdown-it/markdown-it.min.js', globalName: 'markdownit' }
      ]);

      // Mock manifest items for context
      vi.spyOn(transformPipeline as any, 'getManifestContext').mockResolvedValue(
        SAMPLE_TRANSFORM_CONTEXT.basic.manifestItems
      );

      const result = await transformPipeline.transformText(
        SAMPLE_PLAIN_TEXT.markdownWithToc,
        workspaceId,
        'chapter1'
      );

      expect(result.success).toBe(true);
      expect(result.transformedText).toContain('<h2>Table of Contents</h2>');
      expect(result.transformedText).toContain('<a href="#chapter1">chapter1</a>');
    });

    it('should handle missing text transform script', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MISSING_SCRIPTS;
      await mockFileStorage.addTestFiles(workspaceId, createMissingScriptsWorkspace());

      const result = await transformPipeline.transformText(
        SAMPLE_PLAIN_TEXT.simple,
        workspaceId,
        'chapter1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TransformError);
      expect(result.error!.stage).toBe('loading');
      expect(result.error!.scriptName).toBe('nonexistent-script.js');
    });

    it('should handle runtime errors in text transform', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.BROKEN;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({
          transform_pipeline: { text_transform: 'runtime-error.js' }
        }, null, 2),
        'SOURCE/scripts/runtime-error.js': `
function transformText(plainText, context) {
  return context.nonExistent.property.error;
}
        `.trim()
      });

      const result = await transformPipeline.transformText(
        SAMPLE_PLAIN_TEXT.simple,
        workspaceId,
        'chapter1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TransformError);
      expect(result.error!.stage).toBe('text');
      expect(result.error!.message).toContain('Cannot read');
    });

    it('should handle missing extension libraries', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({
          transform_pipeline: { text_transform: 'markdown-transform.js' }
        }, null, 2),
        'SOURCE/scripts/markdown-transform.js': `
function transformText(plainText, context) {
  if (typeof markdownit === 'undefined') {
    throw new Error('markdown-it library not available');
  }
  return markdownit().render(plainText);
}
        `.trim()
      });

      // Don't load the markdown-it library

      const result = await transformPipeline.transformText(
        SAMPLE_PLAIN_TEXT.simple,
        workspaceId,
        'chapter1'
      );

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('markdown-it library not available');
    });

    it('should handle empty or null input', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, createMinimalTransformWorkspace());
      
      await mockBlobUrlManager.simulateExtensionLibraryLoading(workspaceId, [
        { path: 'SOURCE/extensions/markdown-it/markdown-it.min.js', globalName: 'markdownit' }
      ]);

      const result = await transformPipeline.transformText(
        '',
        workspaceId,
        'chapter1'
      );

      expect(result.success).toBe(true);
      expect(result.transformedText).toBeDefined();
    });
  });

  describe('transformDOM()', () => {
    it('should execute single DOM transform', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({
          transform_pipeline: { dom_transforms: ['heading-ids.js'] }
        }, null, 2),
        'SOURCE/scripts/heading-ids.js': `
function transformDOM(document) {
  const headings = document.querySelectorAll('h1, h2, h3');
  headings.forEach((heading, index) => {
    if (!heading.id) {
      heading.id = 'heading-' + (index + 1);
    }
  });
  return document;
}
        `.trim()
      });

      const testDoc = createTestDocument('<h1>Test Heading</h1><h2>Another Heading</h2>');
      
      const result = await transformPipeline.transformDOM(testDoc, workspaceId, 'chapter1');

      expect(result).toBeInstanceOf(Document);
      expect(result.querySelector('h1')!.id).toBe('heading-1');
      expect(result.querySelector('h2')!.id).toBe('heading-2');
    });

    it('should execute multiple DOM transforms in sequence', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteTransformWorkspace());

      const testDoc = createTestDocument('<h1>Test</h1><p>Paragraph</p><a href="#">Link</a>');
      
      const result = await transformPipeline.transformDOM(testDoc, workspaceId, 'chapter1');

      expect(result).toBeInstanceOf(Document);
      
      // Should have ID from heading-ids.js
      expect(result.querySelector('h1')!.id).toBeTruthy();
      
      // Should have classes from custom-styling.js
      expect(result.querySelector('h1')!.classList.contains('custom-header')).toBe(true);
      expect(result.querySelector('p')!.classList.contains('content-paragraph')).toBe(true);
      expect(result.querySelector('a')!.classList.contains('content-link')).toBe(true);
    });

    it('should handle DOM transform runtime errors', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.BROKEN;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({
          transform_pipeline: { dom_transforms: ['broken-dom.js'] }
        }, null, 2),
        'SOURCE/scripts/broken-dom.js': `
function transformDOM(document) {
  document.nonExistent.method();
  return document;
}
        `.trim()
      });

      const testDoc = createTestDocument('<h1>Test</h1>');

      await expect(
        transformPipeline.transformDOM(testDoc, workspaceId, 'chapter1')
      ).rejects.toThrow(TransformError);
    });

    it('should not modify original document', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({
          transform_pipeline: { dom_transforms: ['add-class.js'] }
        }, null, 2),
        'SOURCE/scripts/add-class.js': `
function transformDOM(document) {
  document.body.classList.add('transformed');
  return document;
}
        `.trim()
      });

      const originalDoc = createTestDocument('<h1>Test</h1>');
      const originalBodyClass = originalDoc.body.className;
      
      const result = await transformPipeline.transformDOM(originalDoc, workspaceId, 'chapter1');

      // Original document should be unchanged
      expect(originalDoc.body.className).toBe(originalBodyClass);
      
      // Result document should be modified
      expect(result.body.classList.contains('transformed')).toBe(true);
    });

    it('should handle missing DOM transform scripts', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MISSING_SCRIPTS;
      await mockFileStorage.addTestFiles(workspaceId, createMissingScriptsWorkspace());

      const testDoc = createTestDocument('<h1>Test</h1>');

      await expect(
        transformPipeline.transformDOM(testDoc, workspaceId, 'chapter1')
      ).rejects.toThrow(TransformError);
    });

    it('should skip DOM transforms if none configured', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({
          transform_pipeline: { text_transform: 'markdown-transform.js' }
        }, null, 2)
      });

      const testDoc = createTestDocument('<h1>Test</h1>');
      const originalHtml = testDoc.documentElement.outerHTML;
      
      const result = await transformPipeline.transformDOM(testDoc, workspaceId, 'chapter1');

      expect(result.documentElement.outerHTML).toBe(originalHtml);
    });
  });

  describe('generateXHTMLDocument()', () => {
    it('should generate valid XHTML with basic metadata', () => {
      const content = '<h1>Test Chapter</h1><p>Content here.</p>';
      
      const xhtml = transformPipeline.generateXHTMLDocument(content, SAMPLE_CHAPTER_METADATA.basic);

      expect(xhtml).toContain('<?xml version="1.0" encoding="utf-8"?>');
      expect(xhtml).toContain('<!DOCTYPE html>');
      expect(xhtml).toContain('xmlns="http://www.w3.org/1999/xhtml"');
      expect(xhtml).toContain('xml:lang="en"');
      expect(xhtml).toContain('<title>Chapter 1: Introduction</title>');
      expect(xhtml).toContain('href="../Styles/stylesheet.css"');
      expect(xhtml).toContain('<h1>Test Chapter</h1>');
    });

    it('should generate XHTML with multiple stylesheets and scripts', () => {
      const content = '<h1>Advanced Chapter</h1>';
      
      const xhtml = transformPipeline.generateXHTMLDocument(content, SAMPLE_CHAPTER_METADATA.advanced);

      expect(xhtml).toContain('<title>Chapter 2: Advanced Topics</title>');
      expect(xhtml).toContain('href="../Styles/main.css"');
      expect(xhtml).toContain('href="../Styles/chapter.css"');
      expect(xhtml).toContain('href="../Styles/syntax-highlighting.css"');
      expect(xhtml).toContain('src="../Scripts/reader.js"');
      expect(xhtml).toContain('src="../Scripts/interactive.js"');
      expect(xhtml).toContain('<meta name="chapter" content="2" />');
    });

    it('should handle different languages correctly', () => {
      const content = '<h1>Chapitre de test</h1>';
      
      const xhtml = transformPipeline.generateXHTMLDocument(content, SAMPLE_CHAPTER_METADATA.multilingual);

      expect(xhtml).toContain('xml:lang="fr"');
      expect(xhtml).toContain('lang="fr"');
      expect(xhtml).toContain('<title>Chapitre 1: Introduction</title>');
    });

    it('should escape HTML in title', () => {
      const metadata = {
        title: 'Chapter 1: "Quotes" & <Tags>',
        language: 'en',
        stylesheets: [],
        scripts: []
      };
      
      const xhtml = transformPipeline.generateXHTMLDocument('<p>Content</p>', metadata);

      expect(xhtml).toContain('<title>Chapter 1: &quot;Quotes&quot; &amp; &lt;Tags&gt;</title>');
    });

    it('should handle empty metadata arrays', () => {
      const metadata = {
        title: 'Simple Chapter',
        language: 'en',
        stylesheets: [],
        scripts: []
      };
      
      const xhtml = transformPipeline.generateXHTMLDocument('<p>Content</p>', metadata);

      expect(xhtml).not.toContain('<link');
      expect(xhtml).not.toContain('<script');
      expect(xhtml).toContain('<title>Simple Chapter</title>');
    });
  });

  describe('Error Handling Integration', () => {
    it('should provide detailed error information', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.BROKEN;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({
          transform_pipeline: { text_transform: 'error-script.js' }
        }, null, 2),
        'SOURCE/scripts/error-script.js': `
function transformText(plainText, context) {
  throw new Error('Specific transform error');
}
        `.trim()
      });

      const result = await transformPipeline.transformText(
        SAMPLE_PLAIN_TEXT.simple,
        workspaceId,
        'chapter1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TransformError);
      
      const errorDetails = result.error!.getErrorDetails();
      expect(errorDetails.stage).toBe('text');
      expect(errorDetails.scriptName).toBe('error-script.js');
      expect(errorDetails.message).toContain('Specific transform error');
      expect(errorDetails.userMessage).toContain('Text Transform');
    });

    it('should handle workspace access errors', async () => {
      const workspaceId = 'nonexistent-workspace';

      const result = await transformPipeline.transformText(
        SAMPLE_PLAIN_TEXT.simple,
        workspaceId,
        'chapter1'
      );

      expect(result.success).toBe(false);
      expect(result.error!.stage).toBe('loading');
      expect(result.error!.message).toContain('not found');
    });

    it('should handle invalid settings JSON', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.INVALID_SETTINGS;
      await mockFileStorage.addTestFiles(workspaceId, createInvalidSettingsWorkspace());

      const result = await transformPipeline.transformText(
        SAMPLE_PLAIN_TEXT.simple,
        workspaceId,
        'chapter1'
      );

      expect(result.success).toBe(false);
      expect(result.error!.stage).toBe('loading');
      expect(result.error!.message).toContain('Invalid JSON');
    });
  });

  describe('Performance and Timeout Handling', () => {
    it('should measure execution time', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, createMinimalTransformWorkspace());
      
      await mockBlobUrlManager.simulateExtensionLibraryLoading(workspaceId, [
        { path: 'SOURCE/extensions/markdown-it/markdown-it.min.js', globalName: 'markdownit' }
      ]);

      const result = await transformPipeline.transformText(
        SAMPLE_PLAIN_TEXT.markdown,
        workspaceId,
        'chapter1'
      );

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeLessThan(2000); // Should be well under timeout
    });

    it('should handle large content efficiently', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.PERFORMANCE;
      await mockFileStorage.addTestFiles(workspaceId, createMinimalTransformWorkspace());
      
      await mockBlobUrlManager.simulateExtensionLibraryLoading(workspaceId, [
        { path: 'SOURCE/extensions/markdown-it/markdown-it.min.js', globalName: 'markdownit' }
      ]);

      const startTime = Date.now();
      const result = await transformPipeline.transformText(
        SAMPLE_PLAIN_TEXT.large,
        workspaceId,
        'chapter1'
      );
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
      expect(result.transformedText).toContain('Large content section');
      expect(result.transformedText).toContain('End of large document');
    });
  });
});