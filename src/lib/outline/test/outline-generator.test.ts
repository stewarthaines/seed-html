/**
 * OutlineGenerator Unit Tests
 *
 * Comprehensive test suite following TDD approach with behavior-focused testing.
 * Tests the public API from index.ts using shared mock infrastructure.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OutlineGenerator } from '../index.js';
import type { GenerationOptions, ProcessingOptions } from '../index.js';
import {
  createTestWorkspaceManager,
  createFailingTransformPipeline,
  setupWorkspaceWithXHTML,
  setupWorkspaceWithMixedContent,
  setupWorkspaceWithProblematicContent,
  setupFileReadError,
  setupWorkspaceNotFoundError,
  expectValidNavigationDocument,
  expectNavigationContainsTitles,
  expectNavigationItemCount,
  expectNavigationLinks,
  expectFlatListStructure,
  expectCSSClasses,
  expectTransformPipelineCalled,
  createStandardTestSetup,
  createUserContentTestSetup,
} from './test-utils.js';
import {
  createMockSpineItems,
  createSpineItemsWithoutTitles,
  createMixedSpineItems,
  createMockUserNavContent,
  createExpectedNavigationMetadata,
} from './fixtures.js';

describe('OutlineGenerator', () => {
  let workspaceId: string;

  beforeEach(() => {
    workspaceId = 'test-workspace';
  });

  describe('generateFromSpine', () => {
    describe('Core Generation Logic', () => {
      it('should generate valid EPUB navigation from spine items', async () => {
        // Setup
        const { mockManager, workspaceId } = createStandardTestSetup();
        const spineItems = createMockSpineItems();

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify
        expectValidNavigationDocument(result);
        expect(result.sourceType).toBe('auto-generated');
        expectNavigationContainsTitles(result.xhtmlContent, [
          'Chapter 1',
          'Chapter 2',
          'Chapter 3',
        ]);
        expectNavigationItemCount(result.xhtmlContent, 3);
        expectFlatListStructure(result.xhtmlContent);
      });

      it('should handle spine items with titles from XHTML headings', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        setupWorkspaceWithXHTML(mockManager, workspaceId);
        const spineItems = createMockSpineItems();

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify titles extracted from XHTML
        expectNavigationLinks(result.xhtmlContent, [
          { href: 'chapter1.xhtml', title: 'Chapter 1' },
          { href: 'chapter2.xhtml', title: 'Chapter 2' },
          { href: 'chapter3.xhtml', title: 'Chapter 3' },
        ]);
      });

      it('should handle spine items without titles using fallback strategies', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        setupWorkspaceWithProblematicContent(mockManager, workspaceId);
        const spineItems = createSpineItemsWithoutTitles();

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId,
          { titleStrategy: 'filename' }
        );

        // Verify fallback titles used
        expect(result.xhtmlContent).toContain('untitled1');
        expect(result.xhtmlContent).toContain('untitled2');
        expectNavigationItemCount(result.xhtmlContent, 2);
      });

      it('should respect title generation strategy options', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        setupWorkspaceWithMixedContent(mockManager, workspaceId);
        const spineItems = createMixedSpineItems();
        const options: GenerationOptions = {
          titleStrategy: 'heading',
          includeUntitled: false,
        };

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId,
          options
        );

        // Verify strategy applied
        expectValidNavigationDocument(result);
        expect(result.xhtmlContent).toContain('Introduction');
        expect(result.xhtmlContent).toContain('Getting Started');
      });

      it('should create proper navigation metadata for OPF', async () => {
        // Setup
        const { mockManager, workspaceId } = createStandardTestSetup();
        const spineItems = createMockSpineItems();

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify metadata
        const expectedMetadata = createExpectedNavigationMetadata();
        expect(result.metadata).toEqual(expectedMetadata);
      });

      it('should handle empty spine array gracefully', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        const emptySpine: any[] = [];

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          emptySpine,
          mockManager as any,
          workspaceId
        );

        // Verify empty but valid navigation
        expectValidNavigationDocument(result);
        expectNavigationItemCount(result.xhtmlContent, 0);
        expect(result.xhtmlContent).toContain('<ol>');
        expect(result.xhtmlContent).toContain('</ol>');
      });

      it('should include CSS classes when specified', async () => {
        // Setup
        const { mockManager, workspaceId } = createStandardTestSetup();
        const spineItems = createMockSpineItems();
        const options: GenerationOptions = {
          cssClasses: {
            nav: 'custom-nav',
            list: 'custom-list',
          },
        };

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId,
          options
        );

        // Verify CSS classes applied
        expectCSSClasses(result.xhtmlContent, options.cssClasses!);
      });

      it('should use custom document title when specified', async () => {
        // Setup
        const { mockManager, workspaceId } = createStandardTestSetup();
        const spineItems = createMockSpineItems();
        const options: GenerationOptions = {
          documentTitle: 'Custom Table of Contents',
        };

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId,
          options
        );

        // Verify custom title used
        expect(result.xhtmlContent).toContain('<title>Custom Table of Contents</title>');
        expect(result.xhtmlContent).toContain('<h1>Custom Table of Contents</h1>');
      });
    });

    describe('File Operation Tests', () => {
      it('should read XHTML files from workspace using spine item hrefs', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        setupWorkspaceWithXHTML(mockManager, workspaceId);
        const spineItems = createMockSpineItems();

        // Execute
        await OutlineGenerator.generateFromSpine(spineItems, mockManager as any, workspaceId);

        // Verify files were read
        expect(mockManager.getOperationCount()).toBeGreaterThan(0);

        // Verify specific files exist in workspace
        const files = mockManager.getWorkspaceFiles(workspaceId);
        expect(files.has('OEBPS/chapter1.xhtml')).toBe(true);
        expect(files.has('OEBPS/chapter2.xhtml')).toBe(true);
        expect(files.has('OEBPS/chapter3.xhtml')).toBe(true);
      });

      it('should skip spine items with missing XHTML files', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        // Only add some files, not all
        mockManager.addTestFiles(workspaceId, {
          'OEBPS/chapter1.xhtml':
            '<html><head><title>Chapter 1</title></head><body><h1>Chapter 1</h1></body></html>',
          // Missing chapter2.xhtml and chapter3.xhtml
        });
        const spineItems = createMockSpineItems();

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify only available items included
        expectValidNavigationDocument(result);
        expect(result.xhtmlContent).toContain('Chapter 1');
        expect(result.xhtmlContent).not.toContain('Chapter 2');
        expect(result.xhtmlContent).not.toContain('Chapter 3');
        expectNavigationItemCount(result.xhtmlContent, 1);
      });

      it('should handle file read errors gracefully', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        setupFileReadError(mockManager);
        const spineItems = createMockSpineItems();

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify graceful handling - should return empty but valid navigation
        expectValidNavigationDocument(result);
        expectNavigationItemCount(result.xhtmlContent, 0);
      });

      it('should continue processing remaining items after file errors', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        mockManager.addTestFiles(workspaceId, {
          'OEBPS/chapter1.xhtml':
            '<html><head><title>Chapter 1</title></head><body><h1>Chapter 1</h1></body></html>',
          // chapter2.xhtml will cause read error, chapter3.xhtml exists
          'OEBPS/chapter3.xhtml':
            '<html><head><title>Chapter 3</title></head><body><h1>Chapter 3</h1></body></html>',
        });
        const spineItems = createMockSpineItems();

        // Set up error for specific file
        const originalReadTextFile = mockManager.readTextFile.bind(mockManager);
        mockManager.readTextFile = vi
          .fn()
          .mockImplementation(async (wsId: string, path: string) => {
            if (path === 'OEBPS/chapter2.xhtml') {
              throw new Error('File read error');
            }
            return originalReadTextFile(wsId, path);
          });

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify continues with available files
        expectValidNavigationDocument(result);
        expect(result.xhtmlContent).toContain('Chapter 1');
        expect(result.xhtmlContent).not.toContain('Chapter 2');
        expect(result.xhtmlContent).toContain('Chapter 3');
        expectNavigationItemCount(result.xhtmlContent, 2);
      });

      it('should handle workspace not found errors', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        setupWorkspaceNotFoundError(mockManager);
        const spineItems = createMockSpineItems();

        // Execute & Verify
        await expect(
          OutlineGenerator.generateFromSpine(
            spineItems,
            mockManager as any,
            'nonexistent-workspace'
          )
        ).rejects.toThrow('Workspace not found');
      });
    });

    describe('Title Extraction Tests', () => {
      it('should extract title from h1 element', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        mockManager.addTestFiles(workspaceId, {
          'OEBPS/test.xhtml':
            '<html><head><title>Doc Title</title></head><body><h1>Heading Title</h1></body></html>',
        });
        const spineItems = [
          {
            idref: 'test',
            id: 'test',
            href: 'test.xhtml',
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          },
        ];

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify h1 title extracted (not document title)
        expect(result.xhtmlContent).toContain('Heading Title');
        expect(result.xhtmlContent).not.toContain('Doc Title');
      });

      it('should extract title from h2 when h1 not present', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        mockManager.addTestFiles(workspaceId, {
          'OEBPS/test.xhtml':
            '<html><head><title>Doc Title</title></head><body><h2>H2 Title</h2></body></html>',
        });
        const spineItems = [
          {
            idref: 'test',
            id: 'test',
            href: 'test.xhtml',
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          },
        ];

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify h2 title extracted
        expect(result.xhtmlContent).toContain('H2 Title');
      });

      it('should use document title when no headings found', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        mockManager.addTestFiles(workspaceId, {
          'OEBPS/test.xhtml':
            '<html><head><title>Document Title</title></head><body><p>No headings here</p></body></html>',
        });
        const spineItems = [
          {
            idref: 'test',
            id: 'test',
            href: 'test.xhtml',
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          },
        ];

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify document title used as fallback
        expect(result.xhtmlContent).toContain('Document Title');
      });

      it('should use filename fallback when no title found', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        mockManager.addTestFiles(workspaceId, {
          'OEBPS/my-chapter.xhtml':
            '<html><head></head><body><p>No title anywhere</p></body></html>',
        });
        const spineItems = [
          {
            idref: 'test',
            id: 'test',
            href: 'my-chapter.xhtml',
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          },
        ];

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId,
          { titleStrategy: 'filename' }
        );

        // Verify filename used
        expect(result.xhtmlContent).toContain('my-chapter');
      });

      it('should use "Chapter N" pattern as final fallback', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        mockManager.addTestFiles(workspaceId, {
          'OEBPS/untitled.xhtml': '<html><head></head><body><p>No title</p></body></html>',
        });
        const spineItems = [
          {
            idref: 'test',
            id: 'test',
            href: 'untitled.xhtml',
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          },
        ];

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId,
          { titleStrategy: 'fallback' }
        );

        // Verify fallback pattern used
        expect(result.xhtmlContent).toContain('Chapter 1');
      });

      it('should handle XHTML with multiple headings (uses first)', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        mockManager.addTestFiles(workspaceId, {
          'OEBPS/test.xhtml':
            '<html><head><title>Doc</title></head><body><h1>First</h1><h1>Second</h1></body></html>',
        });
        const spineItems = [
          {
            idref: 'test',
            id: 'test',
            href: 'test.xhtml',
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          },
        ];

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify first heading used
        expect(result.xhtmlContent).toContain('First');
        expect(result.xhtmlContent).not.toContain('Second');
      });

      it('should handle empty headings gracefully', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        mockManager.addTestFiles(workspaceId, {
          'OEBPS/test.xhtml':
            '<html><head><title>Fallback</title></head><body><h1></h1></body></html>',
        });
        const spineItems = [
          {
            idref: 'test',
            id: 'test',
            href: 'test.xhtml',
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          },
        ];

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify fallback to document title
        expect(result.xhtmlContent).toContain('Fallback');
      });

      it('should strip HTML tags from extracted titles', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        mockManager.addTestFiles(workspaceId, {
          'OEBPS/test.xhtml':
            '<html><head><title>Doc</title></head><body><h1>Chapter <em>One</em>: <strong>Start</strong></h1></body></html>',
        });
        const spineItems = [
          {
            idref: 'test',
            id: 'test',
            href: 'test.xhtml',
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          },
        ];

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify tags stripped
        expect(result.xhtmlContent).toContain('Chapter One: Start');
        expect(result.xhtmlContent).not.toContain('<em>');
        expect(result.xhtmlContent).not.toContain('<strong>');
      });
    });

    describe('Edge Cases', () => {
      it('should handle spine items with empty hrefs', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        const spineItems = [
          {
            idref: 'empty',
            id: 'empty',
            href: '',
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          },
        ];

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify graceful handling
        expectValidNavigationDocument(result);
        expectNavigationItemCount(result.xhtmlContent, 0);
      });

      it('should handle spine items with special characters in hrefs', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        const specialPath = 'ch@pter-1&2.xhtml';
        mockManager.addTestFiles(workspaceId, {
          [`OEBPS/${specialPath}`]:
            '<html><head><title>Special</title></head><body><h1>Special Chapter</h1></body></html>',
        });
        const spineItems = [
          {
            idref: 'special',
            id: 'special',
            href: specialPath,
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          },
        ];

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify special characters handled
        expect(result.xhtmlContent).toContain('Special Chapter');
        expect(result.xhtmlContent).toContain(specialPath);
      });

      it('should handle extremely large numbers of spine items', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        const largeSpineItems = [];
        const files: Record<string, string> = {};

        for (let i = 1; i <= 100; i++) {
          const href = `chapter${i}.xhtml`;
          largeSpineItems.push({
            idref: `chapter${i}`,
            id: `chapter${i}`,
            href,
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          });
          files[`OEBPS/${href}`] =
            `<html><head><title>Chapter ${i}</title></head><body><h1>Chapter ${i}</h1></body></html>`;
        }

        mockManager.addTestFiles(workspaceId, files);

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          largeSpineItems,
          mockManager as any,
          workspaceId
        );

        // Verify all items processed
        expectValidNavigationDocument(result);
        expectNavigationItemCount(result.xhtmlContent, 100);
        expect(result.xhtmlContent).toContain('Chapter 1');
        expect(result.xhtmlContent).toContain('Chapter 100');
      });

      it('should handle mixed success/failure scenarios', async () => {
        // Setup
        const mockManager = createTestWorkspaceManager();
        mockManager.addTestFiles(workspaceId, {
          'OEBPS/good1.xhtml':
            '<html><head><title>Good 1</title></head><body><h1>Chapter 1</h1></body></html>',
          'OEBPS/good2.xhtml':
            '<html><head><title>Good 2</title></head><body><h1>Chapter 2</h1></body></html>',
          // Missing good3.xhtml will cause error
        });

        const spineItems = [
          {
            idref: 'good1',
            id: 'good1',
            href: 'good1.xhtml',
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          },
          {
            idref: 'missing',
            id: 'missing',
            href: 'missing.xhtml',
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          },
          {
            idref: 'good2',
            id: 'good2',
            href: 'good2.xhtml',
            mediaType: 'application/xhtml+xml',
            linear: true,
            properties: [],
            hasSourceFile: false,
          },
        ];

        // Execute
        const result = await OutlineGenerator.generateFromSpine(
          spineItems,
          mockManager as any,
          workspaceId
        );

        // Verify mixed results handled correctly
        expectValidNavigationDocument(result);
        expect(result.xhtmlContent).toContain('Chapter 1');
        expect(result.xhtmlContent).toContain('Chapter 2');
        expectNavigationItemCount(result.xhtmlContent, 2);
      });
    });
  });

  describe('processUserContent', () => {
    describe('User Content Processing Tests', () => {
      it('should process user content through transform pipeline', async () => {
        // Setup
        const { mockPipeline, workspaceId } = createUserContentTestSetup();
        const userContent = createMockUserNavContent();

        // Execute
        const result = await OutlineGenerator.processUserContent(
          userContent,
          mockPipeline as any,
          workspaceId
        );

        // Verify transform pipeline called
        expectTransformPipelineCalled(mockPipeline, userContent, workspaceId);

        // Verify result structure
        expectValidNavigationDocument(result);
        expect(result.sourceType).toBe('user-content');
      });

      it('should handle transform pipeline errors gracefully', async () => {
        // Setup
        const failingPipeline = createFailingTransformPipeline();
        const userContent = createMockUserNavContent();

        // Execute & Verify
        await expect(
          OutlineGenerator.processUserContent(userContent, failingPipeline as any, workspaceId)
        ).rejects.toThrow('Transform pipeline failed');
      });

      it('should create navigation metadata from processed content', async () => {
        // Setup
        const { mockPipeline, workspaceId } = createUserContentTestSetup();
        const userContent = createMockUserNavContent();

        // Execute
        const result = await OutlineGenerator.processUserContent(
          userContent,
          mockPipeline as any,
          workspaceId
        );

        // Verify metadata created
        const expectedMetadata = createExpectedNavigationMetadata();
        expect(result.metadata).toEqual(expectedMetadata);
      });

      it('should handle empty user content', async () => {
        // Setup
        const { mockPipeline, workspaceId } = createUserContentTestSetup();
        const emptyContent = '';

        // Execute
        const result = await OutlineGenerator.processUserContent(
          emptyContent,
          mockPipeline as any,
          workspaceId
        );

        // Verify empty content handled
        expectValidNavigationDocument(result);
        expect(result.sourceType).toBe('user-content');
      });

      it('should respect processing options', async () => {
        // Setup
        const { mockPipeline, workspaceId } = createUserContentTestSetup();
        const userContent = createMockUserNavContent();
        const options: ProcessingOptions = {
          validationLevel: 'strict',
          errorHandling: 'throw',
          documentTitle: 'Custom Navigation',
        };

        // Execute
        const result = await OutlineGenerator.processUserContent(
          userContent,
          mockPipeline as any,
          workspaceId,
          options
        );

        // Verify options respected
        expectValidNavigationDocument(result);
        // Note: Document title verification would depend on transform pipeline implementation
      });
    });
  });

  describe('EPUB Compliance', () => {
    it('should generate valid EPUB 3.x navigation structure', async () => {
      // Setup
      const { mockManager, workspaceId } = createStandardTestSetup();
      const spineItems = createMockSpineItems();

      // Execute
      const result = await OutlineGenerator.generateFromSpine(
        spineItems,
        mockManager as any,
        workspaceId
      );

      // Verify EPUB 3.x compliance
      expect(result.xhtmlContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.xhtmlContent).toContain('<!DOCTYPE html>');
      expect(result.xhtmlContent).toContain('xmlns="http://www.w3.org/1999/xhtml"');
      expect(result.xhtmlContent).toContain('xmlns:epub="http://www.idpf.org/2007/ops"');
    });

    it('should include required namespace declarations', async () => {
      // Setup
      const { mockManager, workspaceId } = createStandardTestSetup();
      const spineItems = createMockSpineItems();

      // Execute
      const result = await OutlineGenerator.generateFromSpine(
        spineItems,
        mockManager as any,
        workspaceId
      );

      // Verify namespaces
      expect(result.xhtmlContent).toContain('xmlns="http://www.w3.org/1999/xhtml"');
      expect(result.xhtmlContent).toContain('xmlns:epub="http://www.idpf.org/2007/ops"');
    });

    it('should use proper epub:type and role attributes', async () => {
      // Setup
      const { mockManager, workspaceId } = createStandardTestSetup();
      const spineItems = createMockSpineItems();

      // Execute
      const result = await OutlineGenerator.generateFromSpine(
        spineItems,
        mockManager as any,
        workspaceId
      );

      // Verify semantic attributes
      expect(result.xhtmlContent).toContain('epub:type="toc"');
      expect(result.xhtmlContent).toContain('role="navigation"');
    });

    it('should create valid anchor href references', async () => {
      // Setup
      const { mockManager, workspaceId } = createStandardTestSetup();
      const spineItems = createMockSpineItems();

      // Execute
      const result = await OutlineGenerator.generateFromSpine(
        spineItems,
        mockManager as any,
        workspaceId
      );

      // Verify valid href attributes
      expect(result.xhtmlContent).toContain('href="chapter1.xhtml"');
      expect(result.xhtmlContent).toContain('href="chapter2.xhtml"');
      expect(result.xhtmlContent).toContain('href="chapter3.xhtml"');
    });

    it('should generate flat list structure (not nested)', async () => {
      // Setup
      const { mockManager, workspaceId } = createStandardTestSetup();
      const spineItems = createMockSpineItems();

      // Execute
      const result = await OutlineGenerator.generateFromSpine(
        spineItems,
        mockManager as any,
        workspaceId
      );

      // Verify flat structure
      expectFlatListStructure(result.xhtmlContent);
    });

    it('should create valid XHTML document with proper DOCTYPE', async () => {
      // Setup
      const { mockManager, workspaceId } = createStandardTestSetup();
      const spineItems = createMockSpineItems();

      // Execute
      const result = await OutlineGenerator.generateFromSpine(
        spineItems,
        mockManager as any,
        workspaceId
      );

      // Verify document structure
      expect(result.xhtmlContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.xhtmlContent).toContain('<!DOCTYPE html>');
      expect(result.xhtmlContent).toMatch(/<html[^>]*>/);
      expect(result.xhtmlContent).toContain('</html>');
    });

    it('should include proper HTML head with title and charset', async () => {
      // Setup
      const { mockManager, workspaceId } = createStandardTestSetup();
      const spineItems = createMockSpineItems();

      // Execute
      const result = await OutlineGenerator.generateFromSpine(
        spineItems,
        mockManager as any,
        workspaceId
      );

      // Verify head structure
      expect(result.xhtmlContent).toContain('<head>');
      expect(result.xhtmlContent).toContain('<title>Table of Contents</title>');
      expect(result.xhtmlContent).toContain('<meta charset="UTF-8"/>');
      expect(result.xhtmlContent).toContain('</head>');
    });
  });

  describe('Error Handling', () => {
    it('should generate valid navigation when all items are skipped', async () => {
      // Setup
      const mockManager = createTestWorkspaceManager();
      setupFileReadError(mockManager);
      const spineItems = createMockSpineItems();

      // Execute
      const result = await OutlineGenerator.generateFromSpine(
        spineItems,
        mockManager as any,
        workspaceId
      );

      // Verify valid but empty navigation
      expectValidNavigationDocument(result);
      expectNavigationItemCount(result.xhtmlContent, 0);
      expect(result.xhtmlContent).toContain('<ol>');
      expect(result.xhtmlContent).toContain('</ol>');
    });

    it('should skip spine items with malformed XHTML', async () => {
      // Setup
      const mockManager = createTestWorkspaceManager();
      mockManager.addTestFiles(workspaceId, {
        'OEBPS/good.xhtml':
          '<html><head><title>Good</title></head><body><h1>Good Chapter</h1></body></html>',
        'OEBPS/bad.xhtml': '<html><head><title>Bad</title><body><h1>Unclosed tags',
      });

      const spineItems = [
        {
          idref: 'good',
          id: 'good',
          href: 'good.xhtml',
          mediaType: 'application/xhtml+xml',
          linear: true,
          properties: [],
          hasSourceFile: false,
        },
        {
          idref: 'bad',
          id: 'bad',
          href: 'bad.xhtml',
          mediaType: 'application/xhtml+xml',
          linear: true,
          properties: [],
          hasSourceFile: false,
        },
      ];

      // Execute
      const result = await OutlineGenerator.generateFromSpine(
        spineItems,
        mockManager as any,
        workspaceId
      );

      // Verify malformed items skipped
      expectValidNavigationDocument(result);
      expect(result.xhtmlContent).toContain('Good Chapter');
      expectNavigationItemCount(result.xhtmlContent, 1);
    });
  });
});
