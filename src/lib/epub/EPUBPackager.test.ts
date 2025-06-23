/**
 * EPUB Packaging Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EPUBPackager } from './EPUBPackager.js';
import type { WorkspaceFile, PackageOptions, EPUBMetadata } from './EPUBPackager.js';

// Mock the ZIP and storage modules
vi.mock('../zip/index.js', () => ({
	ZipWriter: vi.fn(() => ({
		addFile: vi.fn(),
		buildBlob: vi.fn(() => Promise.resolve(new Blob(['mock-zip'], { type: 'application/zip' })))
	})),
	downloadBlob: vi.fn()
}));

vi.mock('../storage/index.js', () => ({
	FileStorageAPI: vi.fn(() => ({
		init: vi.fn(),
		isInitialized: vi.fn(() => true),
		listFiles: vi.fn(),
		readFile: vi.fn()
	}))
}));

describe('EPUBPackager', () => {
	let packager: EPUBPackager;
	let mockStorage: any;
	let mockZipWriter: any;

	beforeEach(async () => {
		// Reset all mocks
		vi.clearAllMocks();
		
		packager = new EPUBPackager();
		mockStorage = (packager as any).fileStorage;
		
		// Get the mocked ZipWriter class
		const { ZipWriter } = await import('../zip/index.js');
		mockZipWriter = new ZipWriter();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('packageEPUB', () => {
		const mockWorkspaceId = 'test-workspace';
		
		const mockValidFiles: WorkspaceFile[] = [
			{
				path: 'mimetype',
				content: new TextEncoder().encode('application/epub+zip').buffer,
				size: 20,
				mimeType: 'application/epub+zip'
			},
			{
				path: 'META-INF/container.xml',
				content: new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
	<rootfiles>
		<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
	</rootfiles>
</container>`).buffer,
				size: 200,
				mimeType: 'application/xml'
			},
			{
				path: 'OEBPS/content.opf',
				content: new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
	<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
		<dc:title>Test Book</dc:title>
		<dc:creator>Test Author</dc:creator>
		<dc:language>en</dc:language>
		<dc:identifier id="uid">test-book-123</dc:identifier>
		<dc:publisher>Test Publisher</dc:publisher>
		<dc:date>2024-01-01</dc:date>
	</metadata>
</package>`).buffer,
				size: 400,
				mimeType: 'application/oebps-package+xml'
			}
		];

		beforeEach(() => {
			// Setup default mock behavior
			mockStorage.listFiles.mockResolvedValue(mockValidFiles.map(f => f.path));
			mockValidFiles.forEach(file => {
				mockStorage.readFile.mockResolvedValueOnce(file.content);
			});
		});

		it('should successfully package a valid EPUB workspace', async () => {
			const result = await packager.packageEPUB(mockWorkspaceId);

			expect(result.success).toBe(true);
			expect(result.blob).toBeInstanceOf(Blob);
			expect(result.filename).toBe('Test Book - Test Author - 2025-06-23.epub');
			expect(result.fileCount).toBe(3);
			expect(result.totalSize).toBe(708);
			expect(result.processingTime).toBeGreaterThan(0);
		});

		it('should handle empty workspace', async () => {
			mockStorage.listFiles.mockResolvedValue([]);

			const result = await packager.packageEPUB(mockWorkspaceId);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Workspace is empty');
		});

		it('should handle missing container.xml', async () => {
			const filesWithoutContainer = mockValidFiles.filter(f => f.path !== 'META-INF/container.xml');
			mockStorage.listFiles.mockResolvedValue(filesWithoutContainer.map(f => f.path));
			filesWithoutContainer.forEach(file => {
				mockStorage.readFile.mockResolvedValueOnce(file.content);
			});

			const result = await packager.packageEPUB(mockWorkspaceId);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Missing META-INF/container.xml file - invalid EPUB structure');
		});

		it('should handle missing OPF file', async () => {
			const filesWithoutOPF = mockValidFiles.filter(f => f.path !== 'OEBPS/content.opf');
			mockStorage.listFiles.mockResolvedValue(filesWithoutOPF.map(f => f.path));
			filesWithoutOPF.forEach(file => {
				mockStorage.readFile.mockResolvedValueOnce(file.content);
			});

			const result = await packager.packageEPUB(mockWorkspaceId);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Missing OPF file at path: OEBPS/content.opf');
		});

		it('should call progress callback during packaging', async () => {
			const progressCallback = vi.fn();
			const options: PackageOptions = { progressCallback };

			await packager.packageEPUB(mockWorkspaceId, options);

			expect(progressCallback).toHaveBeenCalledWith(
				expect.objectContaining({ phase: 'compressing' })
			);
			expect(progressCallback).toHaveBeenCalledWith(
				expect.objectContaining({ phase: 'writing' })
			);
			expect(progressCallback).toHaveBeenCalledWith(
				expect.objectContaining({ phase: 'complete' })
			);
		});

		it('should handle storage initialization', async () => {
			mockStorage.isInitialized.mockReturnValue(false);
			mockStorage.init.mockResolvedValue(undefined);

			const result = await packager.packageEPUB(mockWorkspaceId);

			expect(mockStorage.init).toHaveBeenCalled();
			expect(result.success).toBe(true);
		});
	});

	describe('optimizeCompression', () => {
		it('should not compress mimetype file', () => {
			const result = packager.optimizeCompression('mimetype', new ArrayBuffer(0));
			expect(result.method).toBe(0x00);
			expect(result.reason).toBe('EPUB compliance requirement');
		});

		it('should not compress already compressed formats', () => {
			const formats = ['jpg', 'jpeg', 'png', 'gif', 'mp3', 'mp4', 'webp', 'zip'];
			
			formats.forEach(ext => {
				const result = packager.optimizeCompression(`test.${ext}`, new ArrayBuffer(0));
				expect(result.method).toBe(0x00);
				expect(result.reason).toBe('Already compressed format');
			});
		});

		it('should compress text-based formats', () => {
			const formats = ['html', 'xhtml', 'xml', 'css', 'js', 'txt', 'opf', 'ncx'];
			
			formats.forEach(ext => {
				const result = packager.optimizeCompression(`test.${ext}`, new ArrayBuffer(0));
				expect(result.method).toBe(0x08);
				expect(result.reason).toBe('Text-based content compresses well');
			});
		});

		it('should compress unknown formats by default', () => {
			const result = packager.optimizeCompression('test.unknown', new ArrayBuffer(0));
			expect(result.method).toBe(0x08);
			expect(result.reason).toBe('Default compression');
		});
	});

	describe('generateFilename', () => {
		it('should generate filename with title, author, and date', () => {
			const metadata: EPUBMetadata = {
				title: 'Test Book',
				author: 'Test Author',
				language: 'en',
				identifier: 'test-123'
			};

			const filename = packager.generateFilename(metadata);
			expect(filename).toMatch(/^Test Book - Test Author - \d{4}-\d{2}-\d{2}\.epub$/);
		});

		it('should generate filename without author', () => {
			const metadata: EPUBMetadata = {
				title: 'Test Book',
				language: 'en',
				identifier: 'test-123'
			};

			const filename = packager.generateFilename(metadata);
			expect(filename).toMatch(/^Test Book - \d{4}-\d{2}-\d{2}\.epub$/);
		});

		it('should sanitize invalid characters', () => {
			const metadata: EPUBMetadata = {
				title: 'Test<>Book:|?*',
				author: 'Test/\\Author',
				language: 'en',
				identifier: 'test-123'
			};

			const filename = packager.generateFilename(metadata);
			expect(filename).toMatch(/^TestBook - TestAuthor - \d{4}-\d{2}-\d{2}\.epub$/);
		});
	});

	// Note: parseRootfilePath tests moved to opf-utils.test.ts
	// This method is now a static method on OPFUtils class

	// Note: parseOPFMetadata tests moved to opf-utils.test.ts
	// This method is now a static method on OPFUtils class

	describe('downloadEPUB', () => {
		it('should call downloadBlob utility', async () => {
			const { downloadBlob } = await import('../zip/index.js');
			const blob = new Blob(['test'], { type: 'application/epub+zip' });
			const filename = 'test.epub';

			packager.downloadEPUB(blob, filename);

			expect(downloadBlob).toHaveBeenCalledWith(blob, filename);
		});
	});
});