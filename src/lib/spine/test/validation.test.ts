/**
 * SpineItemManager Validation Tests
 *
 * Unit tests for spine consistency validation including spine-manifest consistency,
 * duplicate detection, orphaned file detection, and comprehensive validation reporting.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpineItemManager } from '../spine-item-manager.js';
import type { MockWorkspaceManager } from '../../test/mocks/workspace-manager.mock.js';
import { createTestWorkspaceManager, setupTestWorkspace } from './test-utils.js';
import { getSampleOPFDocuments, getInvalidOPFDocuments } from './fixtures.js';

describe('SpineItemManager Validation', () => {
  let spineManager: SpineItemManager;
  let mockWorkspaceManager: MockWorkspaceManager;
  const testWorkspaceId = 'test-workspace-123';

  beforeEach(() => {
    mockWorkspaceManager = createTestWorkspaceManager();
    spineManager = new SpineItemManager(mockWorkspaceManager as any);
  });

  afterEach(() => {
    mockWorkspaceManager.reset();
  });

  describe('validateSpineOrder()', () => {
    it('should validate correct spine', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'basic');

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.summary).toEqual(
        expect.objectContaining({
          totalItems: 3,
          linearItems: 3,
          nonLinearItems: 0,
        })
      );
    });

    it('should detect missing manifest items', async () => {
      mockWorkspaceManager.setWorkspaceOPF(
        testWorkspaceId,
        getInvalidOPFDocuments().missingManifestItems
      );

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          code: 'MISSING_MANIFEST_ITEM',
          message: expect.stringContaining('chapter2'),
          chapterId: 'chapter2',
          severity: 'error',
        })
      );
    });

    it('should detect duplicate spine items', async () => {
      mockWorkspaceManager.setWorkspaceOPF(
        testWorkspaceId,
        getInvalidOPFDocuments().duplicateSpineItems
      );

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          code: 'DUPLICATE_SPINE_ITEM',
          message: expect.stringContaining('chapter1'),
          chapterId: 'chapter1',
          severity: 'error',
        })
      );
    });

    it('should detect orphaned text files', async () => {
      mockWorkspaceManager.setWorkspaceOPF(
        testWorkspaceId,
        getInvalidOPFDocuments().orphanedManifestItems
      );

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.isValid).toBe(true); // Orphans are warnings, not errors
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toEqual(
        expect.objectContaining({
          code: 'ORPHANED_TEXT_FILE',
          message: expect.stringContaining('chapter3'),
          chapterId: 'chapter3',
          severity: 'warning',
        })
      );
    });

    it('should count linear vs non-linear items', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'withNonLinear');

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.isValid).toBe(true);
      expect(result.summary.totalItems).toBe(5);
      expect(result.summary.linearItems).toBe(4); // prologue, chapter1, chapter2, epilogue
      expect(result.summary.nonLinearItems).toBe(1); // appendix
    });

    it('should count items with source files', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, getSampleOPFDocuments().basic);

      // Add some source files
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'SOURCE/text/chapter1.txt': '# Chapter 1',
        'SOURCE/text/chapter2.txt': '# Chapter 2',
        // chapter3 has no source file
      });

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.summary.itemsWithSource).toBe(2);
    });

    it('should detect orphaned source files', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, getSampleOPFDocuments().basic);

      // Add source files including orphans
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'SOURCE/text/chapter1.txt': '# Chapter 1',
        'SOURCE/text/chapter2.txt': '# Chapter 2',
        'SOURCE/text/chapter3.txt': '# Chapter 3',
        'SOURCE/text/orphaned-chapter.txt': '# Orphaned Chapter',
      });

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.summary.orphanedSources).toBe(1); // orphaned-chapter.txt
    });

    it('should handle empty spine', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'empty');

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.summary).toEqual({
        totalItems: 0,
        linearItems: 0,
        nonLinearItems: 0,
        itemsWithSource: 0,
        orphanedSources: 0,
      });
    });

    it('should handle workspace not found', async () => {
      mockWorkspaceManager.setFailureMode('workspace-not-found');

      await expect(spineManager.validateSpineOrder('nonexistent-workspace')).rejects.toThrow(
        'Workspace not found'
      );
    });

    it('should handle corrupted OPF data', async () => {
      mockWorkspaceManager.setFailureMode('opf-read');

      await expect(spineManager.validateSpineOrder(testWorkspaceId)).rejects.toThrow(
        'Failed to read OPF document'
      );
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should handle multiple error types in one spine', async () => {
      // Create OPF with multiple issues
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' },
          { id: 'orphaned', href: 'Text/orphaned.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spine: [
          { idref: 'chapter1', linear: true },
          { idref: 'missing-chapter', linear: true }, // Missing from manifest
          { idref: 'chapter1', linear: true }, // Duplicate
        ],
        metadata: {
          title: 'Complex Issues EPUB',
          language: 'en',
          identifier: 'test-complex',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);

      // Should detect missing manifest item
      expect(result.errors.some(error => error.code === 'MISSING_MANIFEST_ITEM')).toBe(true);

      // Should detect duplicate spine item
      expect(result.errors.some(error => error.code === 'DUPLICATE_SPINE_ITEM')).toBe(true);

      // Should detect orphaned manifest item
      expect(result.warnings.some(warning => warning.code === 'ORPHANED_TEXT_FILE')).toBe(true);
    });

    it('should validate spine with properties correctly', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'withProperties');

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.isValid).toBe(true);
      expect(result.summary.totalItems).toBe(4);

      // Should handle items with properties correctly
      expect(result.summary.linearItems).toBe(2); // cover and toc should be non-linear
      expect(result.summary.nonLinearItems).toBe(2);
    });

    it('should handle non-XHTML manifest items', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' },
          { id: 'style', href: 'Styles/style.css', mediaType: 'text/css' },
          { id: 'image', href: 'Images/cover.jpg', mediaType: 'image/jpeg' },
        ],
        spine: [{ idref: 'chapter1', linear: true }],
        metadata: {
          title: 'Mixed Media EPUB',
          language: 'en',
          identifier: 'test-mixed',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.isValid).toBe(true);

      // Only XHTML files should be considered for orphan detection
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate large spine efficiently', async () => {
      // Create large spine
      const largeManifest = Array.from({ length: 1000 }, (_, i) => ({
        id: `chapter${i + 1}`,
        href: `Text/chapter${i + 1}.xhtml`,
        mediaType: 'application/xhtml+xml',
      }));

      const largeSpine = Array.from({ length: 1000 }, (_, i) => ({
        idref: `chapter${i + 1}`,
        linear: true,
      }));

      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: largeManifest,
        spine: largeSpine,
        metadata: {
          title: 'Large EPUB',
          language: 'en',
          identifier: 'test-large',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      const startTime = Date.now();
      const result = await spineManager.validateSpineOrder(testWorkspaceId);
      const duration = Date.now() - startTime;

      expect(result.isValid).toBe(true);
      expect(result.summary.totalItems).toBe(1000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Validation Result Structure', () => {
    it('should provide comprehensive summary information', async () => {
      await setupTestWorkspace(mockWorkspaceManager, testWorkspaceId, 'withNonLinear');

      // Add some source files
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'SOURCE/text/chapter1.txt': '# Chapter 1',
        'SOURCE/text/epilogue.txt': '# Epilogue',
        'SOURCE/text/orphaned.txt': '# Orphaned',
      });

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.summary).toEqual({
        totalItems: expect.any(Number),
        linearItems: expect.any(Number),
        nonLinearItems: expect.any(Number),
        itemsWithSource: expect.any(Number),
        orphanedSources: expect.any(Number),
      });

      // Verify counts make sense
      expect(result.summary.totalItems).toBeGreaterThan(0);
      expect(result.summary.linearItems + result.summary.nonLinearItems).toBe(
        result.summary.totalItems
      );
      expect(result.summary.itemsWithSource).toBeGreaterThanOrEqual(0);
      expect(result.summary.orphanedSources).toBeGreaterThanOrEqual(0);
    });

    it('should provide detailed error information', async () => {
      mockWorkspaceManager.setWorkspaceOPF(
        testWorkspaceId,
        getInvalidOPFDocuments().missingManifestItems
      );

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.errors[0]).toEqual({
        code: expect.any(String),
        message: expect.any(String),
        chapterId: expect.any(String),
        severity: 'error',
      });

      expect(result.errors[0].code).toBe('MISSING_MANIFEST_ITEM');
      expect(result.errors[0].message).toContain('chapter2');
      expect(result.errors[0].chapterId).toBe('chapter2');
    });

    it('should provide detailed warning information', async () => {
      mockWorkspaceManager.setWorkspaceOPF(
        testWorkspaceId,
        getInvalidOPFDocuments().orphanedManifestItems
      );

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.warnings[0]).toEqual({
        code: expect.any(String),
        message: expect.any(String),
        chapterId: expect.any(String),
        severity: 'warning',
      });

      expect(result.warnings[0].code).toBe('ORPHANED_TEXT_FILE');
      expect(result.warnings[0].severity).toBe('warning');
    });

    it('should handle validation without chapter IDs', async () => {
      // Create scenario where errors don't have specific chapter IDs
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [],
        spine: [],
        metadata: {
          title: 'Empty with Issues',
          language: '', // Invalid metadata
          identifier: '',
          creator: [''],
          date: '',
        },
      });

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      // Should still provide useful validation results
      expect(result).toEqual(
        expect.objectContaining({
          isValid: expect.any(Boolean),
          errors: expect.any(Array),
          warnings: expect.any(Array),
          summary: expect.any(Object),
        })
      );
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle malformed spine items', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spine: [
          { idref: '', linear: true } as any, // Empty idref
          { idref: null, linear: true } as any, // Null idref
          { linear: true } as any, // Missing idref
        ],
        metadata: {
          title: 'Malformed Spine',
          language: 'en',
          identifier: 'test-malformed',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle malformed manifest items', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: '', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' } as any, // Empty ID
          { href: 'Text/chapter2.xhtml', mediaType: 'application/xhtml+xml' } as any, // Missing ID
          { id: 'chapter3', mediaType: 'application/xhtml+xml' } as any, // Missing href
        ],
        spine: [{ idref: 'chapter1', linear: true }],
        metadata: {
          title: 'Malformed Manifest',
          language: 'en',
          identifier: 'test-malformed-manifest',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      // Should handle gracefully and report issues
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle circular references', async () => {
      // This is more theoretical, but test robustness
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spine: Array(100)
          .fill(0)
          .map(() => ({ idref: 'chapter1', linear: true })), // 100 references to same item
        metadata: {
          title: 'Circular References',
          language: 'en',
          identifier: 'test-circular',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.code === 'DUPLICATE_SPINE_ITEM')).toBe(true);
    });

    it('should handle very large error lists efficiently', async () => {
      // Create spine with many missing references
      const manyMissingSpine = Array.from({ length: 1000 }, (_, i) => ({
        idref: `missing-chapter${i}`,
        linear: true,
      }));

      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [],
        spine: manyMissingSpine,
        metadata: {
          title: 'Many Errors',
          language: 'en',
          identifier: 'test-many-errors',
          creator: ['Test'],
          date: '2024-01-01',
        },
      });

      const startTime = Date.now();
      const result = await spineManager.validateSpineOrder(testWorkspaceId);
      const duration = Date.now() - startTime;

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1000);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should provide meaningful error messages', async () => {
      mockWorkspaceManager.setWorkspaceOPF(
        testWorkspaceId,
        getInvalidOPFDocuments().missingManifestItems
      );

      const result = await spineManager.validateSpineOrder(testWorkspaceId);

      result.errors.forEach(error => {
        expect(error.message).toMatch(/^[A-Z]/); // Should start with capital letter
        expect(error.message.length).toBeGreaterThan(10); // Should be descriptive
        expect(error.message).not.toContain('undefined');
        expect(error.message).not.toContain('null');
      });

      result.warnings.forEach(warning => {
        expect(warning.message).toMatch(/^[A-Z]/);
        expect(warning.message.length).toBeGreaterThan(10);
        expect(warning.message).not.toContain('undefined');
        expect(warning.message).not.toContain('null');
      });
    });
  });
});
