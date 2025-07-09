import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransformPipeline } from '../transform-pipeline.js';
import { TransformError } from '../transform-error.js';
import { MockFileStorage } from '../../test/mocks/file-storage.mock.js';
import { MockBlobUrlManager } from './mocks/blob-url-manager.mock.js';
import { SAMPLE_CHAPTER_METADATA } from './fixtures/create-test-data.js';

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

      const xhtml = transformPipeline.generateXHTMLDocument(
        content,
        SAMPLE_CHAPTER_METADATA.advanced
      );

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

      const xhtml = transformPipeline.generateXHTMLDocument(
        content,
        SAMPLE_CHAPTER_METADATA.multilingual
      );

      expect(xhtml).toContain('xml:lang="fr"');
      expect(xhtml).toContain('lang="fr"');
      expect(xhtml).toContain('<title>Chapitre 1: Introduction</title>');
    });

    it('should escape HTML in title', () => {
      const metadata = {
        title: 'Chapter 1: "Quotes" & <Tags>',
        language: 'en',
        stylesheets: [],
        scripts: [],
      };

      const xhtml = transformPipeline.generateXHTMLDocument('<p>Content</p>', metadata);

      expect(xhtml).toContain('<title>Chapter 1: &quot;Quotes&quot; &amp; &lt;Tags&gt;</title>');
    });

    it('should handle empty metadata arrays', () => {
      const metadata = {
        title: 'Simple Chapter',
        language: 'en',
        stylesheets: [],
        scripts: [],
      };

      const xhtml = transformPipeline.generateXHTMLDocument('<p>Content</p>', metadata);

      expect(xhtml).not.toContain('<link');
      expect(xhtml).not.toContain('<script');
      expect(xhtml).toContain('<title>Simple Chapter</title>');
    });
  });

  describe('transformText() - No Transform Configured', () => {
    it('should handle missing text transform script gracefully', async () => {
      const workspaceId = 'test-workspace';
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({}, null, 2),
      });

      const result = await transformPipeline.transformText('Hello World', workspaceId, 'chapter1');

      expect(result.success).toBe(true);
      expect(result.transformedText).toBe('<p>Hello World</p>');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty text input', async () => {
      const workspaceId = 'test-workspace';
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({}, null, 2),
      });

      const result = await transformPipeline.transformText('', workspaceId, 'chapter1');

      expect(result.success).toBe(true);
      expect(result.transformedText).toBe('');
    });
  });

  describe('transformDOM() - No Transform Configured', () => {
    it('should handle missing DOM transform scripts gracefully', async () => {
      const workspaceId = 'test-workspace';
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({}, null, 2),
      });

      const parser = new DOMParser();
      const testDoc = parser.parseFromString('<h1>Test</h1>', 'text/html');

      const result = await transformPipeline.transformDOM(testDoc, workspaceId, 'chapter1');

      expect(result).toBeDefined();
      expect(result.querySelector).toBeDefined();
      expect(result.querySelector('h1')?.textContent).toBe('Test');
    });
  });

  describe('executeTransformPipeline() - No Transform Configured', () => {
    it('should execute pipeline with no transforms configured', async () => {
      const workspaceId = 'test-workspace';
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({}, null, 2),
      });

      const result = await transformPipeline.executeTransformPipeline(
        'Hello World',
        workspaceId,
        'chapter1',
        SAMPLE_CHAPTER_METADATA.basic
      );

      expect(result.success).toBe(true);
      expect(result.xhtmlDocument).toBeDefined();
      expect(result.xhtmlDocument!.querySelector).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);

      // Should contain the escaped plain text
      const bodyContent = result.xhtmlDocument!.body.innerHTML;
      expect(bodyContent).toContain('<p>Hello World</p>');
    });
  });

  describe('Error Handling', () => {
    it('should handle settings loading errors', async () => {
      const workspaceId = 'test-workspace';
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': 'invalid json {',
      });

      const result = await transformPipeline.transformText('Hello World', workspaceId, 'chapter1');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TransformError);
      expect(result.error!.message).toContain('Invalid JSON');
    });

    it('should handle file storage errors', async () => {
      const workspaceId = 'test-workspace';
      mockFileStorage.setFailureMode('read');

      const result = await transformPipeline.transformText('Hello World', workspaceId, 'chapter1');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TransformError);
    });
  });

  describe('Performance', () => {
    it('should measure execution time', async () => {
      const workspaceId = 'test-workspace';
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({}, null, 2),
      });

      const startTime = Date.now();
      const result = await transformPipeline.executeTransformPipeline(
        'Test content',
        workspaceId,
        'chapter1',
        SAMPLE_CHAPTER_METADATA.basic
      );
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.executionTime).toBeLessThanOrEqual(endTime - startTime);
    });
  });
});
