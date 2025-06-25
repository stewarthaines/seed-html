import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EPUBUnpacker } from './EPUBUnpacker.js';
import type { ZipEntry } from '../zip/types.js';

// Mock the FileStorageAPI
vi.mock('../storage/index.js', () => ({
  FileStorageAPI: vi.fn(() => ({
    init: vi.fn(),
    isInitialized: vi.fn(() => true),
    createWorkspace: vi.fn(),
    writeFile: vi.fn(),
    destroy: vi.fn(),
  })),
}));

// Mock the ZIP library to avoid DecompressionStream issues in happy-dom
vi.mock('../zip/index.js', () => ({
  Zip: vi.fn(),
}));

// Helper to create mock ZIP entries
const createMockZipEntry = (
  fileName: string,
  content: string,
  compressionMethod = 0x00
): ZipEntry => ({
  signature: 'PK\\x03\\x04',
  version: 20,
  generalPurpose: 0,
  compressionMethod,
  lastModifiedTime: 0,
  lastModifiedDate: 0,
  crc: 0,
  compressedSize: content.length,
  uncompressedSize: content.length,
  fileNameLength: fileName.length,
  fileName,
  extraLength: 0,
  extra: '',
  startsAt: 0,
  extract: vi.fn().mockResolvedValue(new Blob([content], { type: 'text/plain' })),
});

// Helper to create mock ZIP instance
const createMockZip = (entries: ZipEntry[]) => ({
  entries,
});

describe('EPUBUnpacker', () => {
  let unpacker: EPUBUnpacker;
  let mockStorage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    unpacker = new EPUBUnpacker();
    mockStorage = (unpacker as any).fileStorage;
  });

  describe('validateEPUBStructure (with mocked ZIP)', () => {
    it('should validate a proper EPUB structure', async () => {
      // Mock a valid EPUB ZIP structure
      const mockEntries = [
        createMockZipEntry('mimetype', 'application/epub+zip'),
        createMockZipEntry(
          'META-INF/container.xml',
          '<?xml version="1.0"?>\\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\\n' +
            '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>\\n' +
            '</container>'
        ),
        createMockZipEntry(
          'OEBPS/content.opf',
          '<?xml version="1.0"?>\\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0">\\n' +
            '<metadata></metadata><manifest></manifest><spine></spine>\\n' +
            '</package>'
        ),
      ];

      const mockZip = createMockZip(mockEntries);

      const result = await unpacker.validateEPUBStructure(mockZip as any);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.rootfilePath).toBe('OEBPS/content.opf');
      expect(result.packageDirectory).toBe('OEBPS');
    });

    it('should detect invalid mimetype content', async () => {
      const mockEntries = [
        createMockZipEntry('mimetype', 'invalid/mimetype'),
        createMockZipEntry('META-INF/container.xml', '<container></container>'),
      ];

      const mockZip = createMockZip(mockEntries);
      const result = await unpacker.validateEPUBStructure(mockZip as any);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('Invalid mimetype content'))).toBe(true);
    });

    it('should detect missing container.xml', async () => {
      const mockEntries = [
        createMockZipEntry('mimetype', 'application/epub+zip'),
        // Missing META-INF/container.xml
      ];

      const mockZip = createMockZip(mockEntries);
      const result = await unpacker.validateEPUBStructure(mockZip as any);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('container.xml'))).toBe(true);
    });

    it('should detect missing mimetype file', async () => {
      const mockEntries = [
        // Missing mimetype file
        createMockZipEntry('META-INF/container.xml', '<container></container>'),
      ];

      const mockZip = createMockZip(mockEntries);
      const result = await unpacker.validateEPUBStructure(mockZip as any);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('Missing required mimetype file'))).toBe(
        true
      );
    });
  });

  describe('unpackEPUB (with mocked ZIP)', () => {
    it('should successfully unpack a valid EPUB', async () => {
      // Create a mock file
      const mockFile = new File(['mock epub data'], 'test.epub', { type: 'application/epub+zip' });

      // Mock valid EPUB structure
      const mockEntries = [
        createMockZipEntry('mimetype', 'application/epub+zip'),
        createMockZipEntry(
          'META-INF/container.xml',
          '<?xml version="1.0"?>\\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\\n' +
            '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>\\n' +
            '</container>'
        ),
        createMockZipEntry('OEBPS/content.opf', '<package></package>'),
        createMockZipEntry('OEBPS/chapter1.xhtml', '<html><body>Chapter 1</body></html>'),
      ];

      const mockZip = createMockZip(mockEntries);
      const { Zip } = await import('../zip/index.js');
      (Zip as any).mockReturnValue(mockZip);

      mockStorage.writeFile.mockResolvedValue(true);
      mockStorage.createWorkspace.mockResolvedValue(true);

      const result = await unpacker.unpackEPUB(mockFile, 'test-workspace');

      expect(result.success).toBe(true);
      expect(result.extractedFiles).toBeDefined();
      expect(result.extractedFiles!.length).toBeGreaterThan(0);
      expect(result.workspaceId).toBe('test-workspace');
    });

    it('should handle invalid EPUB structure', async () => {
      const mockFile = new File(['mock epub data'], 'test.epub', { type: 'application/epub+zip' });

      // Mock invalid EPUB structure (missing mimetype)
      const mockEntries = [createMockZipEntry('some-file.txt', 'content')];

      const mockZip = createMockZip(mockEntries);
      const { Zip } = await import('../zip/index.js');
      (Zip as any).mockReturnValue(mockZip);

      mockStorage.writeFile.mockResolvedValue(true);
      mockStorage.createWorkspace.mockResolvedValue(true);

      const result = await unpacker.unpackEPUB(mockFile, 'test-workspace');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid EPUB structure');
    });

    it('should initialize storage if not already initialized', async () => {
      const mockFile = new File(['mock epub data'], 'test.epub', { type: 'application/epub+zip' });

      // Mock valid EPUB structure
      const mockEntries = [
        createMockZipEntry('mimetype', 'application/epub+zip'),
        createMockZipEntry(
          'META-INF/container.xml',
          '<?xml version="1.0"?>\\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\\n' +
            '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>\\n' +
            '</container>'
        ),
        createMockZipEntry('OEBPS/content.opf', '<package></package>'),
      ];

      const mockZip = createMockZip(mockEntries);
      const { Zip } = await import('../zip/index.js');
      (Zip as any).mockReturnValue(mockZip);

      mockStorage.isInitialized.mockReturnValue(false);
      mockStorage.init.mockResolvedValue(true);
      mockStorage.writeFile.mockResolvedValue(true);
      mockStorage.createWorkspace.mockResolvedValue(true);

      await unpacker.unpackEPUB(mockFile, 'test-workspace');

      expect(mockStorage.init).toHaveBeenCalled();
    });
  });

  describe('analyzeEPUB (with mocked ZIP)', () => {
    it('should analyze EPUB without extracting', async () => {
      const mockFile = new File(['mock epub data'], 'test.epub', { type: 'application/epub+zip' });

      // Mock valid EPUB structure
      const mockEntries = [
        createMockZipEntry('mimetype', 'application/epub+zip'),
        createMockZipEntry(
          'META-INF/container.xml',
          '<?xml version="1.0"?>\\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\\n' +
            '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>\\n' +
            '</container>'
        ),
        createMockZipEntry('OEBPS/content.opf', '<package></package>'),
        createMockZipEntry('OEBPS/chapter1.xhtml', '<html><body>Chapter 1</body></html>'),
      ];

      const mockZip = createMockZip(mockEntries);
      const { Zip } = await import('../zip/index.js');
      (Zip as any).mockReturnValue(mockZip);

      const result = await unpacker.analyzeEPUB(mockFile);

      expect(result.isValid).toBe(true);
      expect(result.validation).toBeDefined();
      expect(result.fileCount).toBeGreaterThan(0);
      expect(result.fileList).toBeDefined();
      expect(result.totalSize).toBeGreaterThan(0);
      // Should not call storage methods for analysis
      expect(mockStorage.writeFile).not.toHaveBeenCalled();
    });

    it('should handle analysis errors', async () => {
      const mockFile = new File(['mock epub data'], 'test.epub', { type: 'application/epub+zip' });

      // Mock invalid EPUB structure
      const mockEntries = [
        createMockZipEntry('mimetype', 'invalid/mimetype'), // Invalid mimetype
      ];

      const mockZip = createMockZip(mockEntries);
      const { Zip } = await import('../zip/index.js');
      (Zip as any).mockReturnValue(mockZip);

      const result = await unpacker.analyzeEPUB(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });
  });
});
