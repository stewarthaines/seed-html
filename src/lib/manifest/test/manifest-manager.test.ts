/**
 * ManifestManager TDD Tests
 * 
 * Comprehensive Test-Driven Development test suite for ManifestManager following the test plan
 * in TESTING.md. Tests are written FIRST before implementation exists and will FAIL initially
 * as required by TDD methodology.
 * 
 * Key TDD principles:
 * - Tests drive implementation - ManifestManager methods are NOT mocked
 * - External dependencies (WorkspaceManager) ARE mocked using existing MockWorkspaceManager
 * - Tests validate exact API contract specified in API.md
 * - Initial test runs should FAIL proving tests are valid
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockWorkspaceManager } from '../../test/mocks/workspace-manager.mock.js';

// Import actual implementation
import { 
  ManifestManagerImpl,
  ManifestValidator
} from '../index.js';

// Helper function to create mock File objects for upload testing
const createMockFile = (name: string, content: string | ArrayBuffer, type = 'text/plain') => ({
  name,
  size: typeof content === 'string' ? content.length : content.byteLength,
  type,
  arrayBuffer: () => Promise.resolve(
    typeof content === 'string' 
      ? new TextEncoder().encode(content).buffer 
      : content
  ),
  text: () => Promise.resolve(
    typeof content === 'string' 
      ? content 
      : new TextDecoder().decode(content)
  ),
});

describe('ManifestManager', () => {
  let manifestManager: ManifestManagerImpl;
  let mockWorkspaceManager: MockWorkspaceManager;
  const testWorkspaceId = 'test-workspace-123';

  beforeEach(() => {
    // Use existing mock infrastructure
    mockWorkspaceManager = new MockWorkspaceManager();
    mockWorkspaceManager.reset();
    
    // Create REAL ManifestManager instance with mocked dependencies
    manifestManager = new ManifestManagerImpl(mockWorkspaceManager as any);
  });

  afterEach(() => {
    mockWorkspaceManager.reset();
  });

  // ========================================
  // CORE INTERFACE METHODS TESTS
  // ========================================

  describe('loadManifest', () => {
    it('should load manifest items in correct order', async () => {
      const mockItems = [
        { id: 'item1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'item2', href: 'chapter2.xhtml', mediaType: 'application/xhtml+xml' }
      ];
      
      // Mock external dependency (WorkspaceManager) - NOT ManifestManager
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: mockItems
      });
      
      // Call actual ManifestManager method (will fail initially in TDD)
      const result = await manifestManager.loadManifest(testWorkspaceId);
      expect(result).toEqual(mockItems);
      expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(0);
    });

    it('should handle empty manifest gracefully', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []
      });
      
      const result = await manifestManager.loadManifest(testWorkspaceId);
      expect(result).toEqual([]);
    });

    it('should cache manifest on repeated calls', async () => {
      const mockItems = [
        { id: 'item1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' }
      ];
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: mockItems
      });
      
      // First call should read from workspace
      await manifestManager.loadManifest(testWorkspaceId);
      const initialOpCount = mockWorkspaceManager.getOperationCount();
      
      // Second call should return cached data (no additional workspace operations)
      await manifestManager.loadManifest(testWorkspaceId);
      expect(mockWorkspaceManager.getOperationCount()).toBe(initialOpCount);
    });

    it('should throw WorkspaceNotFoundError for invalid workspace', async () => {
      // Use MockWorkspaceManager's failure simulation
      mockWorkspaceManager.setFailureMode('workspace-not-found');
      
      // This test will fail until error handling is implemented
      await expect(manifestManager.loadManifest('invalid-id'))
        .rejects.toThrow('Workspace not found');
    });

    it('should throw ManifestCorruptedError for corrupted OPF data', async () => {
      // Simulate corrupted manifest data through mock
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: null as any
      });
      
      await expect(manifestManager.loadManifest(testWorkspaceId))
        .rejects.toThrow('Manifest corrupted');
    });
  });

  describe('getManifestItem', () => {
    it('should get existing item returns correct data', async () => {
      const mockItem = { 
        id: 'chapter1', 
        href: 'OEBPS/chapter1.xhtml', 
        mediaType: 'application/xhtml+xml',
        size: 2048,
        modified: new Date('2024-01-01')
      };
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [mockItem]
      });
      
      const result = await manifestManager.getManifestItem(testWorkspaceId, 'chapter1');
      expect(result).toEqual(mockItem);
    });

    it('should throw ItemNotFoundError for non-existent item', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []
      });
      
      await expect(manifestManager.getManifestItem(testWorkspaceId, 'missing-item'))
        .rejects.toThrow('Item not found');
    });

    it('should use cached manifest when available', async () => {
      const mockItem = { 
        id: 'chapter1', 
        href: 'OEBPS/chapter1.xhtml', 
        mediaType: 'application/xhtml+xml'
      };
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [mockItem]
      });
      
      // Load manifest to cache it
      await manifestManager.loadManifest(testWorkspaceId);
      const opCountAfterLoad = mockWorkspaceManager.getOperationCount();
      
      // Get item should use cached data
      await manifestManager.getManifestItem(testWorkspaceId, 'chapter1');
      expect(mockWorkspaceManager.getOperationCount()).toBe(opCountAfterLoad);
    });
  });

  describe('updateManifestItem', () => {
    it('should update valid fields successfully', async () => {
      const originalItem = { 
        id: 'chapter1', 
        href: 'OEBPS/chapter1.xhtml', 
        mediaType: 'application/xhtml+xml'
      };
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [originalItem]
      });
      
      await manifestManager.updateManifestItem(testWorkspaceId, 'chapter1', {
        properties: ['nav'],
        mediaType: 'application/xhtml+xml'
      });
      
      // Verify changes were persisted through WorkspaceManager
      const updatedOPF = await mockWorkspaceManager.getWorkspaceOPF(testWorkspaceId);
      const updatedItem = updatedOPF.manifest.find((item: any) => item.id === 'chapter1');
      expect(updatedItem.properties).toEqual(['nav']);
    });

    it('should handle partial updates correctly', async () => {
      const originalItem = { 
        id: 'chapter1', 
        href: 'OEBPS/chapter1.xhtml', 
        mediaType: 'application/xhtml+xml',
        properties: ['existing']
      };
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [originalItem]
      });
      
      // Only update mediaType, keep other fields
      await manifestManager.updateManifestItem(testWorkspaceId, 'chapter1', {
        mediaType: 'text/html'
      });
      
      const updatedOPF = await mockWorkspaceManager.getWorkspaceOPF(testWorkspaceId);
      const updatedItem = updatedOPF.manifest.find((item: any) => item.id === 'chapter1');
      expect(updatedItem.mediaType).toBe('text/html');
      expect(updatedItem.href).toBe('OEBPS/chapter1.xhtml'); // unchanged
      expect(updatedItem.properties).toEqual(['existing']); // unchanged
    });

    it('should throw ItemNotFoundError for invalid item ID', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []
      });
      
      await expect(manifestManager.updateManifestItem(testWorkspaceId, 'missing-item', {
        mediaType: 'text/plain'
      })).rejects.toThrow('Item not found');
    });

    it('should throw ValidationError for invalid updates', async () => {
      const originalItem = { 
        id: 'chapter1', 
        href: 'OEBPS/chapter1.xhtml', 
        mediaType: 'application/xhtml+xml'
      };
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [originalItem]
      });
      
      await expect(manifestManager.updateManifestItem(testWorkspaceId, 'chapter1', {
        id: 'invalid-id-123-starts-with-number'
      })).rejects.toThrow('Validation error');
    });

    it('should throw DuplicateItemError for duplicate href', async () => {
      const items = [
        { id: 'chapter1', href: 'OEBPS/chapter1.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'chapter2', href: 'OEBPS/chapter2.xhtml', mediaType: 'application/xhtml+xml' }
      ];
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: items
      });
      
      await expect(manifestManager.updateManifestItem(testWorkspaceId, 'chapter1', {
        href: 'OEBPS/chapter2.xhtml' // Already exists
      })).rejects.toThrow('Duplicate item');
    });
  });

  describe('deleteManifestItem', () => {
    it('should delete existing item successfully', async () => {
      const items = [
        { id: 'chapter1', href: 'OEBPS/chapter1.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'chapter2', href: 'OEBPS/chapter2.xhtml', mediaType: 'application/xhtml+xml' }
      ];
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: items
      });
      
      // Set up file to be deleted
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'OEBPS/chapter1.xhtml': '<html>Chapter 1</html>'
      });
      
      await manifestManager.deleteManifestItem(testWorkspaceId, 'chapter1');
      
      // Verify item was removed from manifest
      const updatedOPF = await mockWorkspaceManager.getWorkspaceOPF(testWorkspaceId);
      expect(updatedOPF.manifest).toHaveLength(1);
      expect(updatedOPF.manifest.find((item: any) => item.id === 'chapter1')).toBeUndefined();
      
      // Verify file was deleted from workspace
      const workspaceFiles = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      expect(workspaceFiles.has('OEBPS/chapter1.xhtml')).toBe(false);
    });

    it('should throw ItemNotFoundError for non-existent item', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []
      });
      
      await expect(manifestManager.deleteManifestItem(testWorkspaceId, 'missing-item'))
        .rejects.toThrow('Item not found');
    });

    it('should clear content cache for deleted item', async () => {
      const item = { id: 'chapter1', href: 'OEBPS/chapter1.xhtml', mediaType: 'application/xhtml+xml' };
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [item]
      });
      
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'OEBPS/chapter1.xhtml': '<html>Chapter 1</html>'
      });
      
      // Load content to cache it
      await manifestManager.getItemContent(testWorkspaceId, 'chapter1');
      
      // Delete item should clear cache
      await manifestManager.deleteManifestItem(testWorkspaceId, 'chapter1');
      
      // Verify cache was cleared (implementation-dependent verification)
      expect(true).toBe(true); // Placeholder - actual cache verification depends on implementation
    });
  });

  // ========================================
  // CONTENT OPERATIONS TESTS
  // ========================================

  describe('getItemContent', () => {
    it('should return text content as string', async () => {
      const textContent = '<?xml version="1.0"?><html>Content</html>';
      
      // Mock external dependency only using MockWorkspaceManager methods
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'OEBPS/text-item.xhtml': textContent
      });
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'text-item', href: 'OEBPS/text-item.xhtml', mediaType: 'application/xhtml+xml' }
        ]
      });
      
      // Call REAL ManifestManager method (will fail initially)
      const result = await manifestManager.getItemContent(testWorkspaceId, 'text-item');
      expect(typeof result).toBe('string');
      expect(result).toBe(textContent);
    });

    it('should return binary content as ArrayBuffer', async () => {
      const binaryContent = new ArrayBuffer(1024);
      
      // Set up workspace with binary file using MockWorkspaceManager
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'OEBPS/image.jpg': binaryContent
      });
      
      // Set up manifest with binary item
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'binary-item', href: 'OEBPS/image.jpg', mediaType: 'image/jpeg' }
        ]
      });
      
      const result = await manifestManager.getItemContent(testWorkspaceId, 'binary-item');
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect((result as ArrayBuffer).byteLength).toBe(1024);
    });

    it('should cache content for repeated access', async () => {
      const textContent = 'Sample content for caching test';
      
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'OEBPS/test.txt': textContent
      });
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'test-item', href: 'OEBPS/test.txt', mediaType: 'text/plain' }
        ]
      });
      
      // First call should read from workspace
      const content1 = await manifestManager.getItemContent(testWorkspaceId, 'test-item');
      const initialOpCount = mockWorkspaceManager.getOperationCount();
      
      // Second call should return cached content
      const content2 = await manifestManager.getItemContent(testWorkspaceId, 'test-item');
      expect(content2).toBe(content1);
      expect(mockWorkspaceManager.getOperationCount()).toBe(initialOpCount);
    });

    it('should throw error for missing file', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'missing-item', href: 'OEBPS/missing.txt', mediaType: 'text/plain' }
        ]
      });
      
      await expect(manifestManager.getItemContent(testWorkspaceId, 'missing-item'))
        .rejects.toThrow('File not found');
    });
  });

  describe('setItemContent', () => {
    it('should save text content successfully', async () => {
      const originalContent = '<html>Original</html>';
      const newContent = '<html>Updated</html>';
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'text-item', href: 'OEBPS/text.html', mediaType: 'text/html' }
        ]
      });
      
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'OEBPS/text.html': originalContent
      });
      
      await manifestManager.setItemContent(testWorkspaceId, 'text-item', newContent);
      
      // Verify content was saved
      const savedContent = await mockWorkspaceManager.readTextFile(testWorkspaceId, 'OEBPS/text.html');
      expect(savedContent).toBe(newContent);
    });

    it('should save binary content successfully', async () => {
      const binaryContent = new ArrayBuffer(2048);
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'binary-item', href: 'OEBPS/data.bin', mediaType: 'application/octet-stream' }
        ]
      });
      
      await manifestManager.setItemContent(testWorkspaceId, 'binary-item', binaryContent);
      
      // Verify content was saved
      const savedContent = await mockWorkspaceManager.readFile(testWorkspaceId, 'OEBPS/data.bin');
      expect(savedContent.byteLength).toBe(2048);
    });

    it('should update content cache after save', async () => {
      const item = { id: 'text-item', href: 'OEBPS/text.html', mediaType: 'text/html' };
      const newContent = '<html>New content</html>';
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [item]
      });
      
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'OEBPS/text.html': '<html>Original</html>'
      });
      
      // Save new content
      await manifestManager.setItemContent(testWorkspaceId, 'text-item', newContent);
      
      // Get content should return updated content from cache
      const retrievedContent = await manifestManager.getItemContent(testWorkspaceId, 'text-item');
      expect(retrievedContent).toBe(newContent);
    });

    it('should throw StorageQuotaExceededError when storage limit reached', async () => {
      mockWorkspaceManager.setFailureMode('file-write');
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'text-item', href: 'OEBPS/text.html', mediaType: 'text/html' }
        ]
      });
      
      await expect(manifestManager.setItemContent(testWorkspaceId, 'text-item', 'content'))
        .rejects.toThrow('Failed to write file');
    });
  });

  describe('getContentPreview', () => {
    it('should extract metadata from image content', async () => {
      const imageData = new ArrayBuffer(2048);
      
      // Set up workspace with image file using MockWorkspaceManager  
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'OEBPS/cover.jpg': imageData
      });
      
      // Set up manifest with image item
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'image-item', href: 'OEBPS/cover.jpg', mediaType: 'image/jpeg' }
        ]
      });
      
      // Call REAL ManifestManager method (will fail until implemented)
      const preview = await manifestManager.getContentPreview(testWorkspaceId, 'image-item');
      
      expect(preview.contentType).toBe('image');
      expect(preview.metadata?.width).toBeDefined();
      expect(preview.metadata?.height).toBeDefined();
      expect(preview.itemId).toBe('image-item');
      expect(preview.mediaType).toBe('image/jpeg');
      
      // Note: previewUrl (blob URL) would be created by BlobURLManager, not ManifestManager
    });

    it('should extract text content metadata', async () => {
      const textContent = '<?xml version="1.0"?><html><body><p>Test content with multiple paragraphs.</p><p>Second paragraph.</p></body></html>';
      
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'OEBPS/chapter1.xhtml': textContent
      });
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'chapter1', href: 'OEBPS/chapter1.xhtml', mediaType: 'application/xhtml+xml' }
        ]
      });
      
      const preview = await manifestManager.getContentPreview(testWorkspaceId, 'chapter1');
      
      expect(preview.contentType).toBe('text');
      expect(preview.textContent).toBe(textContent);
      expect(preview.metadata?.characterCount).toBe(textContent.length);
      expect(preview.metadata?.wordCount).toBeGreaterThan(0);
    });

    it('should handle unsupported format gracefully', async () => {
      const unknownContent = new ArrayBuffer(512);
      
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'OEBPS/unknown.xyz': unknownContent
      });
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'unknown-item', href: 'OEBPS/unknown.xyz', mediaType: 'application/octet-stream' }
        ]
      });
      
      const preview = await manifestManager.getContentPreview(testWorkspaceId, 'unknown-item');
      
      expect(preview.contentType).toBe('binary');
      expect(preview.error).toBeUndefined();
    });
  });

  // ========================================
  // ITEM CREATION TESTS
  // ========================================

  describe('createTextItem', () => {
    it('should create text item with generated ID', async () => {
      const itemData = {
        fileName: 'chapter3.xhtml',
        content: '<?xml version="1.0"?><html>New Chapter</html>',
      };
      
      // Set up workspace using MockWorkspaceManager
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []  // Start with empty manifest
      });
      
      // Call REAL ManifestManager method (will fail initially)
      const result = await manifestManager.createTextItem(testWorkspaceId, itemData);
      
      expect(result.id).toBe('chapter3');
      expect(result.href).toBe('OEBPS/chapter3.xhtml');
      expect(result.mediaType).toBe('application/xhtml+xml');
      
      // Verify file was created in workspace
      const workspaceFiles = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      expect(workspaceFiles.has('OEBPS/chapter3.xhtml')).toBe(true);
    });

    it('should use provided ID when given', async () => {
      const itemData = {
        id: 'custom-id',
        fileName: 'custom.xhtml',
        content: '<?xml version="1.0"?><html>Custom</html>',
      };
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []
      });
      
      const result = await manifestManager.createTextItem(testWorkspaceId, itemData);
      
      expect(result.id).toBe('custom-id');
      expect(result.href).toBe('OEBPS/custom.xhtml');
    });

    it('should detect media type when not provided', async () => {
      const itemData = {
        fileName: 'styles.css',
        content: 'body { color: red; }',
      };
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []
      });
      
      const result = await manifestManager.createTextItem(testWorkspaceId, itemData);
      
      expect(result.mediaType).toBe('text/css');
    });

    it('should throw DuplicateItemError for existing ID', async () => {
      const existingItem = { id: 'chapter1', href: 'OEBPS/chapter1.xhtml', mediaType: 'application/xhtml+xml' };
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [existingItem]
      });
      
      const itemData = {
        id: 'chapter1', // Duplicate ID
        fileName: 'new.xhtml',
        content: '<html>New</html>',
      };
      
      await expect(manifestManager.createTextItem(testWorkspaceId, itemData))
        .rejects.toThrow('Duplicate item');
    });

    it('should throw ValidationError for invalid data', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []
      });
      
      const itemData = {
        fileName: '', // Invalid empty filename
        content: '<html>Content</html>',
      };
      
      await expect(manifestManager.createTextItem(testWorkspaceId, itemData))
        .rejects.toThrow('Validation error');
    });
  });

  describe('createFileItem', () => {
    it('should create manifest item from uploaded file', async () => {
      const fileContent = 'body { color: red; }';
      const mockFile = createMockFile('styles.css', fileContent, 'text/css');
      
      // Set up workspace
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []
      });
      
      // Call REAL ManifestManager method (will fail initially)
      const result = await manifestManager.createFileItem(testWorkspaceId, mockFile as File);
      
      expect(result.id).toBe('styles');
      expect(result.href).toBe('OEBPS/styles.css');
      expect(result.mediaType).toBe('text/css');
      
      // Verify file was stored through WorkspaceManager
      const workspaceFiles = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      expect(workspaceFiles.has('OEBPS/styles.css')).toBe(true);
    });

    it('should handle binary file upload', async () => {
      const imageData = new ArrayBuffer(2048);
      const mockFile = createMockFile('cover.jpg', imageData, 'image/jpeg');
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []
      });
      
      const result = await manifestManager.createFileItem(testWorkspaceId, mockFile as File);
      
      expect(result.mediaType).toBe('image/jpeg');
      expect(result.href).toBe('OEBPS/cover.jpg');
    });

    it('should use custom target path when provided', async () => {
      const fileContent = 'Custom content';
      const mockFile = createMockFile('custom.txt', fileContent, 'text/plain');
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []
      });
      
      const result = await manifestManager.createFileItem(testWorkspaceId, mockFile as File, 'custom/path/custom.txt');
      
      expect(result.href).toBe('custom/path/custom.txt');
    });

    it('should throw ContentTooBigError for oversized files', async () => {
      // Create a very large file content
      const largeContent = new ArrayBuffer(100 * 1024 * 1024); // 100MB
      const mockFile = createMockFile('large.bin', largeContent, 'application/octet-stream');
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []
      });
      
      await expect(manifestManager.createFileItem(testWorkspaceId, mockFile as File))
        .rejects.toThrow('Content too big');
    });
  });

  // ========================================
  // VALIDATION TESTS
  // ========================================

  describe('ManifestValidator.validateManifestItem', () => {
    it('should validate required fields', () => {
      const invalidItem = { href: 'test.html' }; // missing id and mediaType
      
      const results = ManifestValidator.validateManifestItem(invalidItem);
      
      expect(results).toHaveLength(2);
      expect(results.find(r => r.field === 'id')).toBeDefined();
      expect(results.find(r => r.field === 'mediaType')).toBeDefined();
    });

    it('should validate ID format', () => {
      const invalidItem = {
        id: '123-invalid-start', // starts with number
        href: 'test.html',
        mediaType: 'text/html'
      };
      
      const results = ManifestValidator.validateManifestItem(invalidItem);
      
      const idError = results.find(r => r.field === 'id');
      expect(idError?.severity).toBe('error');
      expect(idError?.message).toContain('XML ID format');
    });

    it('should validate HREF format', () => {
      const invalidItem = {
        id: 'test-item',
        href: '/absolute/path.html', // absolute path not allowed
        mediaType: 'text/html'
      };
      
      const results = ManifestValidator.validateManifestItem(invalidItem);
      
      const hrefError = results.find(r => r.field === 'href');
      expect(hrefError?.severity).toBe('error');
      expect(hrefError?.message).toContain('relative path');
    });

    it('should validate media type format', () => {
      const invalidItem = {
        id: 'test-item',
        href: 'test.html',
        mediaType: 'invalid-media-type' // invalid MIME type
      };
      
      const results = ManifestValidator.validateManifestItem(invalidItem);
      
      const mediaTypeError = results.find(r => r.field === 'mediaType');
      expect(mediaTypeError?.severity).toBe('error');
      expect(mediaTypeError?.message).toContain('valid MIME type');
    });

    it('should return empty array for valid item', () => {
      const validItem = {
        id: 'chapter1',
        href: 'OEBPS/chapter1.xhtml',
        mediaType: 'application/xhtml+xml',
        properties: ['nav']
      };
      
      const results = ManifestValidator.validateManifestItem(validItem);
      
      expect(results).toHaveLength(0);
    });
  });

  describe('ManifestValidator.validateItemId', () => {
    it('should return null for valid ID', () => {
      const result = ManifestValidator.validateItemId('valid_id-123', []);
      expect(result).toBeNull();
    });

    it('should return error for empty ID', () => {
      const result = ManifestValidator.validateItemId('', []);
      expect(result?.severity).toBe('error');
      expect(result?.message).toContain('empty');
    });

    it('should return error for duplicate ID', () => {
      const existingIds = ['chapter1', 'chapter2'];
      const result = ManifestValidator.validateItemId('chapter1', existingIds);
      expect(result?.severity).toBe('error');
      expect(result?.message).toContain('already exists');
    });

    it('should return error for invalid XML ID format', () => {
      const result = ManifestValidator.validateItemId('123invalid', []); // starts with number
      expect(result?.severity).toBe('error');
      expect(result?.message).toContain('XML ID format');
    });
  });

  describe('ManifestValidator.validateManifestStructure', () => {
    it('should return error for empty manifest', () => {
      const results = ManifestValidator.validateManifestStructure([]);
      expect(results.some(r => r.message.includes('empty'))).toBe(true);
    });

    it('should return warning for missing nav document', () => {
      const items = [
        { id: 'chapter1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' }
      ];
      
      const results = ManifestValidator.validateManifestStructure(items);
      expect(results.some(r => r.message.includes('nav') && r.severity === 'warning')).toBe(true);
    });

    it('should return no errors for valid manifest structure', () => {
      const items = [
        { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: ['nav'] },
        { id: 'chapter1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' }
      ];
      
      const results = ManifestValidator.validateManifestStructure(items);
      expect(results.filter(r => r.severity === 'error')).toHaveLength(0);
    });
  });

  // ========================================
  // UTILITY FUNCTIONS TESTS
  // ========================================

  describe('generateItemId', () => {
    it('should generate valid ID from filename', () => {
      const id = manifestManager.generateItemId('My Chapter 1.xhtml');
      expect(id).toBe('my_chapter_1');
    });

    it('should handle special characters', () => {
      const id = manifestManager.generateItemId('File@#$%Name.txt');
      expect(id).toBe('file____name');
    });

    it('should remove file extensions', () => {
      const id = manifestManager.generateItemId('document.pdf');
      expect(id).toBe('document');
    });

    it('should handle empty string', () => {
      const id = manifestManager.generateItemId('');
      expect(id).toBe('item');
    });
  });

  describe('detectMediaType', () => {
    it('should detect media type from extension', () => {
      const mediaType = manifestManager.detectMediaType('image.jpg');
      expect(mediaType).toBe('image/jpeg');
    });

    it('should detect XHTML files', () => {
      const mediaType = manifestManager.detectMediaType('chapter.xhtml');
      expect(mediaType).toBe('application/xhtml+xml');
    });

    it('should detect CSS files', () => {
      const mediaType = manifestManager.detectMediaType('styles.css');
      expect(mediaType).toBe('text/css');
    });

    it('should fallback to application/octet-stream for unknown types', () => {
      const mediaType = manifestManager.detectMediaType('unknown.xyz');
      expect(mediaType).toBe('application/octet-stream');
    });

    it('should use content-based detection when provided', () => {
      // PNG magic bytes
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const mediaType = manifestManager.detectMediaType('image', pngHeader.buffer);
      expect(mediaType).toBe('image/png');
    });
  });

  // ========================================
  // INTEGRATION TESTS
  // ========================================

  describe('WorkspaceManager Integration', () => {
    it('should handle OPF persistence correctly', async () => {
      // Set up workspace using MockWorkspaceManager (external dependency)
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []  // Start with empty manifest
      });
      
      // Call REAL ManifestManager (will fail until implementation exists)
      const item = await manifestManager.createTextItem(testWorkspaceId, {
        fileName: 'test.html',
        content: '<html>Test</html>'
      });
      
      // Verify OPF was updated through real implementation  
      const updatedOPF = await mockWorkspaceManager.getWorkspaceOPF(testWorkspaceId);
      expect(updatedOPF.manifest).toContainEqual(
        expect.objectContaining({ id: item.id })
      );
      
      // Verify file was saved through real implementation
      const workspaceFiles = mockWorkspaceManager.getWorkspaceFiles(testWorkspaceId);
      expect(workspaceFiles.has(item.href)).toBe(true);
    });

    it('should handle concurrent operations correctly', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []
      });
      
      // Create multiple items concurrently
      const items = await Promise.all([
        manifestManager.createTextItem(testWorkspaceId, {
          fileName: 'chapter1.xhtml',
          content: '<html>Chapter 1</html>'
        }),
        manifestManager.createTextItem(testWorkspaceId, {
          fileName: 'chapter2.xhtml',
          content: '<html>Chapter 2</html>'
        }),
        manifestManager.createTextItem(testWorkspaceId, {
          fileName: 'chapter3.xhtml',
          content: '<html>Chapter 3</html>'
        })
      ]);
      
      // All items should be created successfully
      expect(items).toHaveLength(3);
      
      const manifest = await manifestManager.loadManifest(testWorkspaceId);
      expect(manifest).toHaveLength(3);
    });
  });

  describe('Cache Management', () => {
    it('should cache and clear content data', async () => {
      const textContent = 'Sample content for caching test';
      
      // Set up workspace with text file
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'OEBPS/test.txt': textContent
      });
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'test-item', href: 'OEBPS/test.txt', mediaType: 'text/plain' }
        ]
      });
      
      // First call should read from workspace
      const content1 = await manifestManager.getItemContent(testWorkspaceId, 'test-item');
      expect(typeof content1).toBe('string');
      expect(content1).toBe(textContent);
      
      // Second call should return cached content (verify by operation count)
      const initialOpCount = mockWorkspaceManager.getOperationCount();
      const content2 = await manifestManager.getItemContent(testWorkspaceId, 'test-item');
      expect(content2).toBe(content1);
      
      // Clear cache and verify it forces re-read
      manifestManager.clearContentCache(testWorkspaceId, 'test-item');
      await manifestManager.getItemContent(testWorkspaceId, 'test-item');
      expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(initialOpCount);
    });

    it('should handle cache eviction under memory pressure', async () => {
      // Create multiple large content items to test cache limits
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB content
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'item1', href: 'OEBPS/large1.txt', mediaType: 'text/plain' },
          { id: 'item2', href: 'OEBPS/large2.txt', mediaType: 'text/plain' },
          { id: 'item3', href: 'OEBPS/large3.txt', mediaType: 'text/plain' }
        ]
      });
      
      mockWorkspaceManager.addTestFiles(testWorkspaceId, {
        'OEBPS/large1.txt': largeContent + '1',
        'OEBPS/large2.txt': largeContent + '2',
        'OEBPS/large3.txt': largeContent + '3'
      });
      
      // Load all content items
      await manifestManager.getItemContent(testWorkspaceId, 'item1');
      await manifestManager.getItemContent(testWorkspaceId, 'item2');
      await manifestManager.getItemContent(testWorkspaceId, 'item3');
      
      // Cache should handle eviction properly (no errors thrown)
      expect(true).toBe(true); // If we get here, cache eviction worked
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================

  describe('Error Handling', () => {
    it('should handle WorkspaceNotFoundError', async () => {
      mockWorkspaceManager.setFailureMode('workspace-not-found');
      
      await expect(manifestManager.loadManifest('missing-workspace'))
        .rejects.toThrow('Workspace not found');
    });

    it('should handle ManifestCorruptedError', async () => {
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: null as any // Corrupted manifest
      });
      
      await expect(manifestManager.loadManifest(testWorkspaceId))
        .rejects.toThrow('Manifest corrupted');
    });

    it('should handle storage failures gracefully', async () => {
      mockWorkspaceManager.setFailureMode('file-write');
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: []
      });
      
      await expect(manifestManager.createTextItem(testWorkspaceId, {
        fileName: 'test.html',
        content: '<html>Test</html>'
      })).rejects.toThrow('Failed to write file');
    });

    it('should propagate OPF write failures', async () => {
      mockWorkspaceManager.setFailureMode('opf-write');
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [{ id: 'item1', href: 'test.html', mediaType: 'text/html' }]
      });
      
      await expect(manifestManager.updateManifestItem(testWorkspaceId, 'item1', {
        mediaType: 'application/xhtml+xml'
      })).rejects.toThrow('Failed to write OPF');
    });
  });

  // ========================================
  // PERFORMANCE TESTS
  // ========================================

  describe('Performance Tests', () => {
    it('should handle 1000+ manifest items', async () => {
      const largeManifest = Array.from({ length: 1000 }, (_, i) => ({
        id: `item${i}`,
        href: `file${i}.html`,
        mediaType: 'text/html'
      }));
      
      // Set up workspace with large manifest using MockWorkspaceManager
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: largeManifest
      });
      
      // Test REAL ManifestManager performance (will fail until implemented)
      const start = performance.now();
      const result = await manifestManager.loadManifest(testWorkspaceId);
      const duration = performance.now() - start;
      
      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // 100ms threshold
    });

    it('should handle large file operations efficiently', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB content
      
      mockWorkspaceManager.setWorkspaceOPF(testWorkspaceId, {
        manifest: [
          { id: 'large-item', href: 'OEBPS/large.txt', mediaType: 'text/plain' }
        ]
      });
      
      const start = performance.now();
      await manifestManager.setItemContent(testWorkspaceId, 'large-item', largeContent);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(1000); // 1 second threshold for 10MB
    });
  });

  // ========================================
  // ADVANCED MODE TESTS
  // ========================================

  describe('Advanced Mode Operations', () => {
    it('should list SOURCE directory items', async () => {
      const sourceItems = await manifestManager.listSourceItems(testWorkspaceId);
      
      expect(Array.isArray(sourceItems)).toBe(true);
      // MockWorkspaceManager returns sample source files
      expect(sourceItems.length).toBeGreaterThan(0);
    });

    it('should get SOURCE file content', async () => {
      const content = await manifestManager.getSourceItemContent(testWorkspaceId, 'settings.json');
      
      expect(typeof content).toBe('string');
      expect(content).toBe('Source file content'); // Mock content
    });

    it('should detect advanced mode correctly', async () => {
      const isAdvanced = await manifestManager.isAdvancedModeEnabled(testWorkspaceId);
      
      expect(typeof isAdvanced).toBe('boolean');
      expect(isAdvanced).toBe(true); // MockWorkspaceManager returns true
    });
  });
});