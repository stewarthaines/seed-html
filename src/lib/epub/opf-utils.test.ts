import { describe, it, expect, beforeAll } from 'vitest';
import { OPFUtils } from './opf-utils.js';

// Mock DOMParser for Node.js environment
beforeAll(() => {
	if (!globalThis.DOMParser) {
		// @ts-expect-error - Mock DOMParser for testing
		globalThis.DOMParser = class MockDOMParser {
			parseFromString(xmlStr: string, contentType: string) {
				// Simple mock that handles basic XML parsing for our tests
				if (xmlStr.includes('</unclosed>')) {
					// Simulate parsing error
					return {
						querySelector: (selector: string) => {
							if (selector === 'parsererror') {
								return { textContent: 'Mismatched tag' };
							}
							return null;
						}
					};
				}
				
				// Mock successful parsing
				return {
					querySelector: (selector: string) => {
						if (selector === 'parsererror') return null;
						if (selector === 'rootfile') {
							if (xmlStr.includes('full-path="OEBPS/content.opf"')) {
								return { getAttribute: (attr: string) => attr === 'full-path' ? 'OEBPS/content.opf' : null };
							}
							if (xmlStr.includes('full-path="OEBPS/content.xml"')) {
								return { getAttribute: (attr: string) => attr === 'full-path' ? 'OEBPS/content.xml' : null };
							}
							if (xmlStr.includes('<rootfile media-type=')) {
								return { getAttribute: (attr: string) => null }; // No full-path
							}
							return null; // No rootfile found
						}
						if (selector === 'package') {
							if (xmlStr.includes('version="3.0"')) {
								return { getAttribute: (attr: string) => attr === 'version' ? '3.0' : null };
							}
							if (xmlStr.includes('version="2.0"')) {
								return { getAttribute: (attr: string) => attr === 'version' ? '2.0' : null };
							}
						}
						if (selector === '[properties]') {
							return xmlStr.includes('properties=') ? {} : null;
						}
						return null;
					},
					querySelectorAll: (selector: string) => {
						if (selector === 'manifest item') {
							if (xmlStr.includes('id="toc"') && xmlStr.includes('id="chapter1"')) {
								return [
									{ getAttribute: (attr: string) => {
										if (attr === 'id') return 'toc';
										if (attr === 'href') return 'toc.xhtml';
										if (attr === 'media-type') return 'application/xhtml+xml';
										if (attr === 'properties') return 'nav';
										return null;
									}},
									{ getAttribute: (attr: string) => {
										if (attr === 'id') return 'chapter1';
										if (attr === 'href') return 'chapter1.xhtml';
										if (attr === 'media-type') return 'application/xhtml+xml';
										return null;
									}}
								];
							}
						}
						if (selector === 'spine itemref') {
							if (xmlStr.includes('idref="chapter1"')) {
								return [
									{ getAttribute: (attr: string) => {
										if (attr === 'idref') return 'chapter1';
										return null;
									}}
								];
							}
						}
						return [];
					}
				};
			}
		};
	}
});

describe('OPFUtils', () => {
	describe('parseContainerXml', () => {
		it('should parse valid container.xml', () => {
			const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

			const result = OPFUtils.parseContainerXml(containerXml);
			expect(result.rootfilePath).toBe('OEBPS/content.opf');
			expect(result.error).toBeUndefined();
		});

		it('should handle missing rootfile element', () => {
			const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
  </rootfiles>
</container>`;

			const result = OPFUtils.parseContainerXml(containerXml);
			expect(result.error).toBe('No rootfile element found in container.xml');
		});

		it('should handle missing full-path attribute', () => {
			const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

			const result = OPFUtils.parseContainerXml(containerXml);
			expect(result.error).toBe('No full-path attribute found in rootfile element');
		});

		it('should validate OPF file extension', () => {
			const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.xml" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

			const result = OPFUtils.parseContainerXml(containerXml);
			expect(result.error).toBe('Rootfile does not appear to be an OPF file: OEBPS/content.xml');
		});
	});

	describe('validateXML', () => {
		it('should validate correct XML', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <element>content</element>
</root>`;

			const result = OPFUtils.validateXML(xml);
			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should detect invalid XML', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <element>content</unclosed>
</root>`;

			const result = OPFUtils.validateXML(xml);
			expect(result.isValid).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe('parseOPFMetadata', () => {
		it('should parse required metadata fields', () => {
			const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="uuid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="uuid">test-book-123</dc:identifier>
  </metadata>
</package>`;

			const metadata = OPFUtils.parseOPFMetadata(opfContent);
			expect(metadata.title).toBe('Test Book');
			expect(metadata.language).toBe('en');
			expect(metadata.identifier).toBe('test-book-123');
		});

		it('should parse optional metadata fields', () => {
			const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="uuid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="uuid">test-book-123</dc:identifier>
    <dc:creator>Test Author</dc:creator>
    <dc:publisher>Test Publisher</dc:publisher>
    <dc:date>2023-01-01</dc:date>
  </metadata>
</package>`;

			const metadata = OPFUtils.parseOPFMetadata(opfContent);
			expect(metadata.author).toBe('Test Author');
			expect(metadata.publisher).toBe('Test Publisher');
			expect(metadata.date).toBe('2023-01-01');
		});

		it('should throw error for missing required fields', () => {
			const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="uuid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:language>en</dc:language>
    <dc:identifier id="uuid">test-book-123</dc:identifier>
  </metadata>
</package>`;

			expect(() => OPFUtils.parseOPFMetadata(opfContent)).toThrow('Missing required dc:title in OPF metadata');
		});
	});

	describe('parseOPFDocument', () => {
		it('should parse complete OPF document', () => {
			const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="uuid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="uuid">test-book-123</dc:identifier>
  </metadata>
  <manifest>
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`;

			const opfDoc = OPFUtils.parseOPFDocument(opfContent);
			expect(opfDoc.version).toBe('3.0');
			expect(opfDoc.metadata.title).toBe('Test Book');
			expect(opfDoc.manifest).toHaveLength(2);
			expect(opfDoc.spine).toHaveLength(1);
			expect(opfDoc.manifest[0].properties).toEqual(['nav']);
		});
	});

	describe('generateOPFXML', () => {
		it('should generate valid OPF XML', () => {
			const opfDocument = {
				version: '3.0',
				metadata: {
					title: 'Test Book',
					language: 'en',
					identifier: 'test-book-123',
					author: 'Test Author'
				},
				manifest: [
					{
						id: 'chapter1',
						href: 'chapter1.xhtml',
						mediaType: 'application/xhtml+xml'
					}
				],
				spine: [
					{
						idref: 'chapter1',
						linear: true
					}
				]
			};

			const xml = OPFUtils.generateOPFXML(opfDocument);
			expect(xml).toContain('<dc:title>Test Book</dc:title>');
			expect(xml).toContain('<dc:creator>Test Author</dc:creator>');
			expect(xml).toContain('<item id="chapter1"');
			expect(xml).toContain('<itemref idref="chapter1"');
		});

		it('should escape XML characters', () => {
			const opfDocument = {
				version: '3.0',
				metadata: {
					title: 'Book & Title <Test>',
					language: 'en',
					identifier: 'test-book-123'
				},
				manifest: [],
				spine: []
			};

			const xml = OPFUtils.generateOPFXML(opfDocument);
			expect(xml).toContain('<dc:title>Book &amp; Title &lt;Test&gt;</dc:title>');
		});
	});

	describe('detectEPUBVersion', () => {
		it('should detect EPUB 3.0', () => {
			const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
</package>`;

			const version = OPFUtils.detectEPUBVersion(opfContent);
			expect(version).toBe('EPUB 3.0');
		});

		it('should detect EPUB 2.0', () => {
			const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf">
</package>`;

			const version = OPFUtils.detectEPUBVersion(opfContent);
			expect(version).toBe('EPUB 2.0');
		});

		it('should detect EPUB 3.0 from properties', () => {
			const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf">
  <manifest>
    <item properties="nav"/>
  </manifest>
</package>`;

			const version = OPFUtils.detectEPUBVersion(opfContent);
			expect(version).toBe('EPUB 3.0');
		});
	});

	describe('parseRootfilePath', () => {
		it('should extract rootfile path using regex', () => {
			const containerContent = `<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>`;

			const path = OPFUtils.parseRootfilePath(containerContent);
			expect(path).toBe('OEBPS/content.opf');
		});

		it('should handle different quote styles', () => {
			const containerContent = `<rootfile full-path='OEBPS/content.opf' media-type="application/oebps-package+xml"/>`;

			const path = OPFUtils.parseRootfilePath(containerContent);
			expect(path).toBe('OEBPS/content.opf');
		});

		it('should throw error if no rootfile found', () => {
			const containerContent = `<container><rootfiles></rootfiles></container>`;

			expect(() => OPFUtils.parseRootfilePath(containerContent)).toThrow('Could not find rootfile path in container.xml');
		});
	});

	describe('generateContainerXML', () => {
		it('should generate valid container.xml', () => {
			const xml = OPFUtils.generateContainerXML();
			expect(xml).toContain('OEBPS/content.opf');
			expect(xml).toContain('application/oebps-package+xml');
		});

		it('should accept custom rootfile path', () => {
			const xml = OPFUtils.generateContainerXML('content/package.opf');
			expect(xml).toContain('content/package.opf');
		});
	});

	describe('validateManifestSpineConsistency', () => {
		it('should validate consistent manifest and spine', () => {
			const manifest = [
				{ id: 'chapter1', href: 'ch1.xhtml', mediaType: 'application/xhtml+xml' },
				{ id: 'chapter2', href: 'ch2.xhtml', mediaType: 'application/xhtml+xml' }
			];
			const spine = [
				{ idref: 'chapter1', linear: true },
				{ idref: 'chapter2', linear: true }
			];

			const errors = OPFUtils.validateManifestSpineConsistency(manifest, spine);
			expect(errors).toHaveLength(0);
		});

		it('should detect spine items missing from manifest', () => {
			const manifest = [
				{ id: 'chapter1', href: 'ch1.xhtml', mediaType: 'application/xhtml+xml' }
			];
			const spine = [
				{ idref: 'chapter1', linear: true },
				{ idref: 'chapter2', linear: true }
			];

			const errors = OPFUtils.validateManifestSpineConsistency(manifest, spine);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain('chapter2');
		});
	});
});