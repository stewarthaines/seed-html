import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EPUBUnpacker } from './EPUBUnpacker.js';

// Mock the ZIP library
vi.mock('../zip/index.js', () => ({
	Zip: vi.fn()
}));

// Mock the FileStorageAPI
vi.mock('../storage/index.js', () => ({
	FileStorageAPI: vi.fn(() => ({
		init: vi.fn(),
		isInitialized: vi.fn(() => true),
		createWorkspace: vi.fn(),
		writeFile: vi.fn(),
		destroy: vi.fn()
	}))
}));

// Mock DOMParser
global.DOMParser = class MockDOMParser {
	parseFromString(str: string, type: string) {
		const mockDoc = {
			querySelector: vi.fn(),
			querySelectorAll: vi.fn()
		};

		// Mock container.xml parsing
		if (str.includes('<rootfile')) {
			if (str.includes('full-path="OEBPS/content.opf"')) {
				mockDoc.querySelector.mockImplementation((selector: string) => {
					if (selector === 'parsererror') return null;
					if (selector === 'rootfile') {
						return {
							getAttribute: (attr: string) => attr === 'full-path' ? 'OEBPS/content.opf' : null
						};
					}
					return null;
				});
			} else if (str.includes('full-path="package/book.opf"')) {
				mockDoc.querySelector.mockImplementation((selector: string) => {
					if (selector === 'parsererror') return null;
					if (selector === 'rootfile') {
						return {
							getAttribute: (attr: string) => attr === 'full-path' ? 'package/book.opf' : null
						};
					}
					return null;
				});
			}
		}

		// Mock OPF parsing
		if (str.includes('<package')) {
			if (str.includes('version="3.0"')) {
				mockDoc.querySelector.mockImplementation((selector: string) => {
					if (selector === 'parsererror') return null;
					if (selector === 'package') {
						return {
							getAttribute: (attr: string) => attr === 'version' ? '3.0' : null
						};
					}
					return null;
				});
			} else if (str.includes('version="2.0"')) {
				mockDoc.querySelector.mockImplementation((selector: string) => {
					if (selector === 'parsererror') return null;
					if (selector === 'package') {
						return {
							getAttribute: (attr: string) => attr === 'version' ? '2.0' : null
						};
					}
					return null;
				});
			}
		}

		// Mock invalid XML
		if (str.includes('<invalid>')) {
			mockDoc.querySelector.mockImplementation((selector: string) => {
				if (selector === 'parsererror') return { textContent: 'Parse error' };
				return null;
			});
		}

		return mockDoc;
	}
};

describe('EPUBUnpacker', () => {
	let unpacker: EPUBUnpacker;
	let mockZip: any;
	let mockFileStorage: any;

	beforeEach(async () => {
		vi.clearAllMocks();
		unpacker = new EPUBUnpacker();
		
		// Setup mock ZIP instance
		mockZip = {
			entries: []
		};
		
		const { Zip } = await import('../zip/index.js');
		vi.mocked(Zip).mockReturnValue(mockZip);

		// Get the mock FileStorageAPI instance
		mockFileStorage = (unpacker as any).fileStorage;
	});

	describe('validateEPUBStructure', () => {
		it('should validate a proper EPUB structure', async () => {
			mockZip.entries = [
				{ 
					fileName: 'mimetype',
					extract: vi.fn().mockResolvedValue(new Blob(['application/epub+zip'], { type: 'text/plain' }))
				},
				{ 
					fileName: 'META-INF/container.xml',
					extract: vi.fn().mockResolvedValue(new Blob([
						'<?xml version="1.0" encoding="UTF-8"?>' +
						'<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">' +
						'<rootfiles>' +
						'<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>' +
						'</rootfiles>' +
						'</container>'
					], { type: 'application/xml' }))
				},
				{ 
					fileName: 'OEBPS/content.opf',
					extract: vi.fn().mockResolvedValue(new Blob([
						'<?xml version="1.0" encoding="UTF-8"?>' +
						'<package xmlns="http://www.idpf.org/2007/opf" version="3.0">' +
						'</package>'
					], { type: 'application/xml' }))
				}
			];

			const result = await unpacker.validateEPUBStructure(mockZip);

			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.rootfilePath).toBe('OEBPS/content.opf');
			expect(result.packageDirectory).toBe('OEBPS');
			expect(result.detectedVersion).toBe('EPUB 3.0');
		});

		it('should detect missing mimetype file', async () => {
			mockZip.entries = [
				{ fileName: 'META-INF/container.xml' },
				{ fileName: 'OEBPS/content.opf' }
			];

			const result = await unpacker.validateEPUBStructure(mockZip);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Missing required mimetype file');
		});

		it('should detect missing container.xml', async () => {
			mockZip.entries = [
				{ 
					fileName: 'mimetype',
					extract: vi.fn().mockResolvedValue(new Blob(['application/epub+zip']))
				},
				{ fileName: 'OEBPS/content.opf' }
			];

			const result = await unpacker.validateEPUBStructure(mockZip);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Missing required META-INF/container.xml file');
		});

		it('should validate incorrect mimetype content', async () => {
			mockZip.entries = [
				{ 
					fileName: 'mimetype',
					extract: vi.fn().mockResolvedValue(new Blob(['application/zip']))
				},
				{ 
					fileName: 'META-INF/container.xml',
					extract: vi.fn().mockResolvedValue(new Blob([
						'<?xml version="1.0"?>' +
						'<container>' +
						'<rootfiles>' +
						'<rootfile full-path="OEBPS/content.opf"/>' +
						'</rootfiles>' +
						'</container>'
					]))
				},
				{ fileName: 'OEBPS/content.opf' }
			];

			const result = await unpacker.validateEPUBStructure(mockZip);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Invalid mimetype content: "application/zip" (expected "application/epub+zip")');
		});

		it('should handle custom package directory structure', async () => {
			mockZip.entries = [
				{ 
					fileName: 'mimetype',
					extract: vi.fn().mockResolvedValue(new Blob(['application/epub+zip']))
				},
				{ 
					fileName: 'META-INF/container.xml',
					extract: vi.fn().mockResolvedValue(new Blob([
						'<?xml version="1.0"?>' +
						'<container>' +
						'<rootfiles>' +
						'<rootfile full-path="package/book.opf"/>' +
						'</rootfiles>' +
						'</container>'
					]))
				},
				{ 
					fileName: 'package/book.opf',
					extract: vi.fn().mockResolvedValue(new Blob([
						'<?xml version="1.0"?>' +
						'<package version="2.0">' +
						'</package>'
					]))
				}
			];

			const result = await unpacker.validateEPUBStructure(mockZip);

			expect(result.isValid).toBe(true);
			expect(result.rootfilePath).toBe('package/book.opf');
			expect(result.packageDirectory).toBe('package');
			expect(result.detectedVersion).toBe('EPUB 2.0');
		});

		it('should detect directory traversal attacks', async () => {
			mockZip.entries = [
				{ fileName: '../../../etc/passwd' },
				{ fileName: 'OEBPS/../../../secret.txt' }
			];

			const result = await unpacker.validateEPUBStructure(mockZip);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Invalid file path with directory traversal: ../../../etc/passwd');
			expect(result.errors).toContain('Invalid file path with directory traversal: OEBPS/../../../secret.txt');
		});

		it('should warn about absolute paths', async () => {
			mockZip.entries = [
				{ 
					fileName: 'mimetype',
					extract: vi.fn().mockResolvedValue(new Blob(['application/epub+zip']))
				},
				{ fileName: '/absolute/path.html' }
			];

			const result = await unpacker.validateEPUBStructure(mockZip);

			expect(result.warnings).toContain('Absolute path found: /absolute/path.html');
		});

		it('should handle XML parsing errors', async () => {
			mockZip.entries = [
				{ 
					fileName: 'mimetype',
					extract: vi.fn().mockResolvedValue(new Blob(['application/epub+zip']))
				},
				{ 
					fileName: 'META-INF/container.xml',
					extract: vi.fn().mockResolvedValue(new Blob(['<invalid>xml</invalid>']))
				}
			];

			const result = await unpacker.validateEPUBStructure(mockZip);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Invalid XML in container.xml');
		});
	});

	describe('extractToWorkspace', () => {
		it('should successfully extract all files', async () => {
			const workspaceId = 'test-workspace';
			mockZip.entries = [
				{
					fileName: 'mimetype',
					extract: vi.fn().mockResolvedValue(new Blob(['application/epub+zip']))
				},
				{
					fileName: 'OEBPS/content.opf',
					extract: vi.fn().mockResolvedValue(new Blob(['<package></package>']))
				},
				{
					fileName: 'OEBPS/chapter1.xhtml',
					extract: vi.fn().mockResolvedValue(new Blob(['<html></html>']))
				}
			];

			const result = await unpacker.extractToWorkspace(mockZip, workspaceId);

			expect(result.success).toBe(true);
			expect(result.extractedFiles).toHaveLength(3);
			expect(result.extractedFiles).toContain('mimetype');
			expect(result.extractedFiles).toContain('OEBPS/content.opf');
			expect(result.extractedFiles).toContain('OEBPS/chapter1.xhtml');
			expect(result.skippedFiles).toHaveLength(0);
			expect(result.errors).toHaveLength(0);

			expect(mockFileStorage.createWorkspace).toHaveBeenCalledWith(workspaceId);
			expect(mockFileStorage.writeFile).toHaveBeenCalledTimes(3);
		});

		it('should skip directory entries', async () => {
			const workspaceId = 'test-workspace';
			mockZip.entries = [
				{
					fileName: 'OEBPS/',
					extract: vi.fn()
				},
				{
					fileName: 'OEBPS/content.opf',
					extract: vi.fn().mockResolvedValue(new Blob(['<package></package>']))
				}
			];

			const result = await unpacker.extractToWorkspace(mockZip, workspaceId);

			expect(result.success).toBe(true);
			expect(result.extractedFiles).toHaveLength(1);
			expect(result.extractedFiles).toContain('OEBPS/content.opf');
			expect(mockFileStorage.writeFile).toHaveBeenCalledTimes(1);
		});

		it('should handle extraction errors gracefully', async () => {
			const workspaceId = 'test-workspace';
			mockZip.entries = [
				{
					fileName: 'good-file.txt',
					extract: vi.fn().mockResolvedValue(new Blob(['content']))
				},
				{
					fileName: 'bad-file.txt',
					extract: vi.fn().mockRejectedValue(new Error('Extraction failed'))
				}
			];

			const result = await unpacker.extractToWorkspace(mockZip, workspaceId);

			expect(result.success).toBe(false);
			expect(result.extractedFiles).toContain('good-file.txt');
			expect(result.skippedFiles).toContain('bad-file.txt');
			expect(result.errors).toContain('Failed to extract bad-file.txt: Extraction failed');
		});

		it('should handle storage write errors', async () => {
			const workspaceId = 'test-workspace';
			mockZip.entries = [
				{
					fileName: 'test-file.txt',
					extract: vi.fn().mockResolvedValue(new Blob(['content']))
				}
			];

			mockFileStorage.writeFile.mockRejectedValue(new Error('Storage full'));

			const result = await unpacker.extractToWorkspace(mockZip, workspaceId);

			expect(result.success).toBe(false);
			expect(result.skippedFiles).toContain('test-file.txt');
			expect(result.errors).toContain('Failed to extract test-file.txt: Storage full');
		});
	});

	describe('unpackEPUB', () => {
		it('should successfully unpack a valid EPUB', async () => {
			const mockFile = new File(['mock-epub-content'], 'test.epub', { type: 'application/epub+zip' });
			const workspaceId = 'test-workspace';

			// Mock File.arrayBuffer()
			vi.spyOn(mockFile, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(100));

			// Setup valid EPUB structure
			mockZip.entries = [
				{ 
					fileName: 'mimetype',
					extract: vi.fn().mockResolvedValue(new Blob(['application/epub+zip']))
				},
				{ 
					fileName: 'META-INF/container.xml',
					extract: vi.fn().mockResolvedValue(new Blob([
						'<?xml version="1.0"?>' +
						'<container>' +
						'<rootfiles>' +
						'<rootfile full-path="OEBPS/content.opf"/>' +
						'</rootfiles>' +
						'</container>'
					]))
				},
				{ 
					fileName: 'OEBPS/content.opf',
					extract: vi.fn().mockResolvedValue(new Blob([
						'<?xml version="1.0"?>' +
						'<package version="3.0">' +
						'</package>'
					]))
				}
			];

			const result = await unpacker.unpackEPUB(mockFile, workspaceId);

			expect(result.success).toBe(true);
			expect(result.workspaceId).toBe(workspaceId);
			expect(result.extractedFiles).toHaveLength(3);
			expect(result.processedFiles).toBe(3);
		});

		it('should handle invalid EPUB structure', async () => {
			const mockFile = new File(['invalid-content'], 'test.epub', { type: 'application/epub+zip' });
			const workspaceId = 'test-workspace';

			vi.spyOn(mockFile, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(100));

			// Setup invalid EPUB structure (missing mimetype)
			mockZip.entries = [
				{ fileName: 'OEBPS/content.opf' }
			];

			const result = await unpacker.unpackEPUB(mockFile, workspaceId);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Invalid EPUB structure');
			expect(result.error).toContain('Missing required mimetype file');
		});

		it('should initialize storage if not already initialized', async () => {
			const mockFile = new File(['content'], 'test.epub');
			const workspaceId = 'test-workspace';

			mockFileStorage.isInitialized.mockReturnValue(false);
			vi.spyOn(mockFile, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(100));

			// Setup minimal valid EPUB
			mockZip.entries = [
				{ 
					fileName: 'mimetype',
					extract: vi.fn().mockResolvedValue(new Blob(['application/epub+zip']))
				},
				{ 
					fileName: 'META-INF/container.xml',
					extract: vi.fn().mockResolvedValue(new Blob([
						'<container><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>'
					]))
				},
				{ 
					fileName: 'content.opf',
					extract: vi.fn().mockResolvedValue(new Blob(['<package></package>']))
				}
			];

			await unpacker.unpackEPUB(mockFile, workspaceId);

			expect(mockFileStorage.init).toHaveBeenCalled();
		});
	});

	describe('analyzeEPUB', () => {
		it('should analyze EPUB without extracting', async () => {
			const mockFile = new File(['mock-content'], 'test.epub');
			
			vi.spyOn(mockFile, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(1000));

			mockZip.entries = [
				{ 
					fileName: 'mimetype',
					uncompressedSize: 20,
					extract: vi.fn().mockResolvedValue(new Blob(['application/epub+zip']))
				},
				{ 
					fileName: 'META-INF/container.xml',
					uncompressedSize: 200,
					extract: vi.fn().mockResolvedValue(new Blob([
						'<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'
					]))
				},
				{ 
					fileName: 'OEBPS/content.opf',
					uncompressedSize: 500,
					extract: vi.fn().mockResolvedValue(new Blob(['<package></package>']))
				},
				{ 
					fileName: 'OEBPS/',
					uncompressedSize: 0
				}
			];

			const result = await unpacker.analyzeEPUB(mockFile);

			expect(result.isValid).toBe(true);
			expect(result.fileCount).toBe(3); // Excluding directory entries
			expect(result.totalSize).toBe(720); // Sum of uncompressed sizes
			expect(result.fileList).toEqual([
				'META-INF/container.xml',
				'OEBPS/content.opf',
				'mimetype'
			]);
		});

		it('should handle analysis errors', async () => {
			const mockFile = new File(['content'], 'test.epub');
			
			vi.spyOn(mockFile, 'arrayBuffer').mockRejectedValue(new Error('File read error'));

			const result = await unpacker.analyzeEPUB(mockFile);

			expect(result.isValid).toBe(false);
			expect(result.fileCount).toBe(0);
			expect(result.totalSize).toBe(0);
			expect(result.validation.errors).toContain('File read error');
		});
	});
});