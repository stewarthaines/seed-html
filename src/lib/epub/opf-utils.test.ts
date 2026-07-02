import { describe, it, expect } from 'vitest';
import {
  OPFUtils,
  toCreator,
  normalizeCreators,
  creatorName,
  creatorNames,
  parseCreatorList,
  primaryLanguage,
  toEpubSafeFilename,
  toEpubSafeHref,
  ensureUniqueHref,
} from './opf-utils.js';
import type { OPFDocument } from './opf-utils.js';

// Injected by the vitest define (mirrors the vite build); see vitest.config.unit.ts.
declare const __VERSION__: string;

// Minimal Element-like stub for parseCreatorList (avoids happy-dom namespace issues).
function el(textContent: string, id?: string): Element {
  return {
    textContent,
    getAttribute: (attr: string) => (attr === 'id' ? (id ?? null) : null),
  } as unknown as Element;
}

describe('parseCreatorList', () => {
  it('attaches roles to a creator by id refinement', () => {
    const lookup = (rid: string) => (rid === 'c1' ? ['aut'] : []);
    const result = parseCreatorList([el('Lewis Carroll', 'c1')], lookup);
    expect(result).toEqual([{ name: 'Lewis Carroll', roles: ['aut'], id: 'c1' }]);
  });

  it('supports multiple roles for one creator (Example 92)', () => {
    const lookup = (rid: string) => (rid === 'c1' ? ['aut', 'ill'] : []);
    const result = parseCreatorList([el('Maurice Sendak', 'c1')], lookup);
    expect(result[0].roles).toEqual(['aut', 'ill']);
  });

  it('returns empty roles for a creator with no id', () => {
    const result = parseCreatorList([el('No Id')], () => ['aut']);
    expect(result).toEqual([{ name: 'No Id', roles: [], id: undefined }]);
  });

  it('skips entries with empty names', () => {
    const result = parseCreatorList([el('   '), el('Real', 'c1')], () => []);
    expect(result.map(c => c.name)).toEqual(['Real']);
  });
});

describe('creator helpers', () => {
  it('toCreator wraps a bare string', () => {
    expect(toCreator('Lewis Carroll')).toEqual({ name: 'Lewis Carroll', roles: [] });
  });

  it('toCreator passes a Creator through, defaulting roles', () => {
    expect(toCreator({ name: 'A', roles: ['aut'] })).toEqual({ name: 'A', roles: ['aut'] });
    expect(toCreator({ name: 'B' } as any)).toEqual({ name: 'B', roles: [] });
  });

  it('normalizeCreators maps mixed strings and objects', () => {
    expect(normalizeCreators(['A', { name: 'B', roles: ['edt'] }])).toEqual([
      { name: 'A', roles: [] },
      { name: 'B', roles: ['edt'] },
    ]);
    expect(normalizeCreators(undefined)).toEqual([]);
  });

  it('creatorName / creatorNames extract display names', () => {
    expect(creatorName({ name: 'A', roles: [] })).toBe('A');
    expect(creatorName('B')).toBe('B');
    expect(creatorName(undefined)).toBe('');
    expect(creatorNames([{ name: 'A', roles: [] }, 'B'])).toEqual(['A', 'B']);
  });
});

// Diagnostic helper functions for XML validation testing

/**
 * Validates XML is well-formed using real DOMParser and provides detailed error context
 * @param xml - XML string to validate
 * @param context - Context description for error reporting
 * @returns Parsed document if valid
 * @throws Error with detailed context if invalid
 */
function expectValidXML(xml: string, context: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const parseError = doc.querySelector('parsererror');

  if (parseError) {
    throw new Error(
      `${context}: XML parsing failed\n${parseError.textContent}\n\nGenerated XML:\n${xml}`
    );
  }

  return doc;
}

/**
 * Debug XML generation step by step to isolate failures
 * Tests each OPF section individually to identify exact failure points
 * @param opfDocument - OPF document to debug
 */
function debugXMLGeneration(opfDocument: OPFDocument): void {
  // Test complete document generation
  const completeXML = OPFUtils.generateOPFXML(opfDocument);
  expectValidXML(completeXML, 'Complete OPF document');

  // Additional section-by-section validation could be added here
  // if internal generation methods were exposed
}

/**
 * Factory function to create test OPF document with valid structure
 * @returns Fresh OPF document for testing
 */
function createTestOPFDocument(): OPFDocument {
  return {
    version: '3.0',
    metadata: {
      title: 'Test EPUB',
      creator: [{ name: 'Test Author', roles: [] }],
      language: ['en'],
      identifier: 'test-123',
    },
    manifest: [
      {
        id: 'chapter1',
        href: 'chapter1.xhtml',
        mediaType: 'application/xhtml+xml',
      },
    ],
    spine: [
      {
        idref: 'chapter1',
        linear: true,
      },
    ],
  };
}

describe('primaryLanguage', () => {
  it('returns the first language tag', () => {
    expect(primaryLanguage({ language: ['en', 'fr'] })).toBe('en');
  });

  it('tolerates legacy single-string data and empties', () => {
    expect(primaryLanguage({ language: 'de' as any })).toBe('de');
    expect(primaryLanguage({ language: [] })).toBe('');
    expect(primaryLanguage(undefined)).toBe('');
  });
});

describe('generateOPFXML - languages', () => {
  function docWithLang(language: string[]): OPFDocument {
    const base = createTestOPFDocument();
    return { ...base, metadata: { ...base.metadata, language } };
  }

  it('emits one dc:language per tag', () => {
    const xml = OPFUtils.generateOPFXML(docWithLang(['en', 'fr', 'gsw']));
    expect(xml).toContain('<dc:language>en</dc:language>');
    expect(xml).toContain('<dc:language>fr</dc:language>');
    expect(xml).toContain('<dc:language>gsw</dc:language>');
  });

  it('marks an RTL-language book on the package and defaults the spine to rtl', () => {
    const xml = OPFUtils.generateOPFXML(docWithLang(['ar']));
    expect(xml).toContain(' dir="rtl"'); // on <package>
    expect(xml).toContain('<spine page-progression-direction="rtl">');
  });

  it('leaves an LTR book without dir / spine direction', () => {
    const xml = OPFUtils.generateOPFXML(docWithLang(['en']));
    expect(xml).not.toContain('dir="rtl"');
    expect(xml).toContain('<spine>');
  });

  it('honours an explicit page-progression-direction over the language default', () => {
    const base = docWithLang(['ar']);
    const doc = {
      ...base,
      metadata: { ...base.metadata, pageProgressionDirection: 'ltr' },
    };
    const xml = OPFUtils.generateOPFXML(doc);
    expect(xml).toContain('<spine page-progression-direction="ltr">');
    // The package still reflects the RTL language for metadata display.
    expect(xml).toContain(' dir="rtl"');
  });
});

describe('generateOPFXML - creator roles', () => {
  function docWith(metadata: Partial<OPFDocument['metadata']>): OPFDocument {
    const base = createTestOPFDocument();
    return { ...base, metadata: { ...base.metadata, ...metadata } as OPFDocument['metadata'] };
  }

  it('emits an id and a meta refines role per creator role', () => {
    const xml = OPFUtils.generateOPFXML(
      docWith({ creator: [{ name: 'Lewis Carroll', roles: ['aut'] }] })
    );
    expect(xml).toContain('<dc:creator id="creator1">Lewis Carroll</dc:creator>');
    expect(xml).toContain(
      '<meta refines="#creator1" property="role" scheme="marc:relators">aut</meta>'
    );
  });

  it('emits a file-as refinement for a creator', () => {
    const xml = OPFUtils.generateOPFXML(
      docWith({
        creator: [{ name: 'J. R. R. Tolkien', roles: ['aut'], fileAs: 'Tolkien, J. R. R.' }],
      })
    );
    expect(xml).toContain('<dc:creator id="creator1">J. R. R. Tolkien</dc:creator>');
    expect(xml).toContain('<meta refines="#creator1" property="file-as">Tolkien, J. R. R.</meta>');
  });

  it('emits multiple role metas for a multi-role creator (Example 92)', () => {
    const xml = OPFUtils.generateOPFXML(
      docWith({ creator: [{ name: 'Maurice Sendak', roles: ['aut', 'ill'] }] })
    );
    expect(xml).toContain(
      '<meta refines="#creator1" property="role" scheme="marc:relators">aut</meta>'
    );
    expect(xml).toContain(
      '<meta refines="#creator1" property="role" scheme="marc:relators">ill</meta>'
    );
  });

  it('assigns sequential ids across creators and contributors', () => {
    const xml = OPFUtils.generateOPFXML(
      docWith({
        creator: [{ name: 'A', roles: ['aut'] }],
        contributor: [{ name: 'B', roles: ['edt'] }],
      })
    );
    expect(xml).toContain('<dc:creator id="creator1">A</dc:creator>');
    expect(xml).toContain('<dc:contributor id="creator2">B</dc:contributor>');
    expect(xml).toContain(
      '<meta refines="#creator2" property="role" scheme="marc:relators">edt</meta>'
    );
  });

  it('emits an id but no meta when a creator has no roles', () => {
    const xml = OPFUtils.generateOPFXML(docWith({ creator: [{ name: 'No Role', roles: [] }] }));
    expect(xml).toContain('<dc:creator id="creator1">No Role</dc:creator>');
    expect(xml).not.toContain('refines="#creator1"');
  });

  it('escapes special characters in names and roles', () => {
    const xml = OPFUtils.generateOPFXML(
      docWith({ creator: [{ name: 'Tom & Jerry', roles: ['aut'] }] })
    );
    expect(xml).toContain('<dc:creator id="creator1">Tom &amp; Jerry</dc:creator>');
  });

  it('always emits a machine-readable generator meta with the app version', () => {
    // __VERSION__ is injected by the vitest define (mirrors the vite build).
    const xml = OPFUtils.generateOPFXML(docWith({}));
    expect(xml).toContain(`<meta name="generator" content="SEED.html ${__VERSION__}"/>`);
  });
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
    // Skip: requires getElementsByTagNameNS which doesn't work correctly in happy-dom
    // XML namespace parsing has incomplete support for complex namespace scenarios
    // This functionality is tested in browser environment via Storybook
    it.skip('should parse required metadata fields', () => {
      const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="uuid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="uuid">test-book-123</dc:identifier>
  </metadata>
</package>`;

      const parser = new DOMParser();
      const doc = parser.parseFromString(opfContent, 'application/xml');
      const metadata = OPFUtils.parseOPFMetadata(doc);
      expect(metadata.title).toBe('Test Book');
      expect(metadata.language).toBe('en');
      expect(metadata.identifier).toBe('test-book-123');
    });

    // Skip: requires getElementsByTagNameNS which doesn't work correctly in happy-dom
    // XML namespace parsing has incomplete support for complex namespace scenarios
    // This functionality is tested in browser environment via Storybook
    it.skip('should parse optional metadata fields', () => {
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

      const parser = new DOMParser();
      const doc = parser.parseFromString(opfContent, 'application/xml');
      const metadata = OPFUtils.parseOPFMetadata(doc);
      expect(metadata.creator).toEqual(['Test Author']);
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

      const parser = new DOMParser();
      const doc = parser.parseFromString(opfContent, 'application/xml');
      expect(() => OPFUtils.parseOPFMetadata(doc)).toThrow(
        'Missing required dc:title in OPF metadata'
      );
    });
  });

  describe('parseOPFMetadataFromString', () => {
    it('parses an OPF string and surfaces missing-required errors (delegates to parseOPFMetadata)', () => {
      const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="uuid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:language>en</dc:language>
    <dc:identifier id="uuid">test-book-123</dc:identifier>
  </metadata>
</package>`;

      expect(() => OPFUtils.parseOPFMetadataFromString(opfContent)).toThrow(
        'Missing required dc:title in OPF metadata'
      );
    });

    // Skip: positive metadata extraction relies on getElementsByTagNameNS, which
    // does not work correctly in happy-dom (see parseOPFMetadata skips above).
    // Verified in the browser via Storybook.
    it.skip('extracts title/language/creator from a valid OPF string', () => {
      const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="uuid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="uuid">test-book-123</dc:identifier>
    <dc:creator>Test Author</dc:creator>
  </metadata>
</package>`;

      const metadata = OPFUtils.parseOPFMetadataFromString(opfContent);
      expect(metadata.title).toBe('Test Book');
      expect(metadata.language).toBe('en');
      expect(metadata.creator).toEqual(['Test Author']);
    });
  });

  describe('parseOPFDocument', () => {
    // Skip: requires getElementsByTagNameNS which doesn't work correctly in happy-dom
    // XML namespace parsing has incomplete support for complex namespace scenarios
    // This functionality is tested in browser environment via Storybook
    it.skip('should parse complete OPF document', () => {
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

  describe('generateOPFXML - XML Validation Tests', () => {
    describe('XML Well-formedness Validation', () => {
      it('should generate valid XML that can be parsed', () => {
        const opfDocument = createTestOPFDocument();
        const xml = OPFUtils.generateOPFXML(opfDocument);

        // Parse with real DOMParser from happy-dom
        const doc = expectValidXML(xml, 'Basic OPF generation');

        // Validate structure exists
        expect(doc.querySelector('package')).toBeTruthy();
        expect(doc.querySelector('metadata')).toBeTruthy();
        expect(doc.querySelector('manifest')).toBeTruthy();
        expect(doc.querySelector('spine')).toBeTruthy();
      });

      it('should generate properly structured XML elements', () => {
        const opfDocument = createTestOPFDocument();
        const xml = OPFUtils.generateOPFXML(opfDocument);
        const doc = expectValidXML(xml, 'XML structure validation');

        const packageEl = doc.querySelector('package');
        expect(packageEl?.getAttribute('version')).toBe('3.0');
        expect(packageEl?.getAttribute('unique-identifier')).toBeTruthy();

        const spineItems = doc.querySelectorAll('spine itemref');
        expect(spineItems).toHaveLength(1);
        expect(spineItems[0]?.getAttribute('idref')).toBe('chapter1');
      });
    });

    describe('EPUB 3.0 Specification Compliance', () => {
      it('should generate EPUB 3.0 compliant OPF structure', () => {
        const opfDocument = createTestOPFDocument();
        const xml = OPFUtils.generateOPFXML(opfDocument);
        const doc = expectValidXML(xml, 'EPUB 3.0 compliance');

        // Validate required EPUB elements
        const packageEl = doc.querySelector('package');
        expect(packageEl?.getAttribute('version')).toBe('3.0');
        expect(packageEl?.getAttribute('xmlns')).toBe('http://www.idpf.org/2007/opf');

        // Validate required Dublin Core namespace (note: limited by happy-dom)
        const metadata = doc.querySelector('metadata');
        expect(metadata?.getAttribute('xmlns:dc')).toBe('http://purl.org/dc/elements/1.1/');

        // Validate required structural elements
        expect(doc.querySelector('metadata')).toBeTruthy();
        expect(doc.querySelector('manifest')).toBeTruthy();
        expect(doc.querySelector('spine')).toBeTruthy();
      });
    });

    describe('Character Encoding and Special Character Testing', () => {
      it('should handle Unicode and special characters correctly', () => {
        const opfDocument = {
          version: '3.0',
          metadata: {
            title: 'كتاب عربي', // Arabic title
            creator: [{ name: '作者名前', roles: [] }, { name: 'שם המחבר', roles: [] }], // Japanese and Hebrew
            description: 'Book with <em>HTML</em> & "quotes" content',
            language: ['en'],
            identifier: 'test-unicode-123',
          },
          manifest: [
            { id: 'chapter-א', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' },
          ],
          spine: [{ idref: 'chapter-א', linear: true }],
        };

        const xml = OPFUtils.generateOPFXML(opfDocument);
        expectValidXML(xml, 'Unicode character test');

        // Validate special characters are properly escaped
        expect(xml).toContain('&lt;em&gt;');
        expect(xml).toContain('&quot;quotes&quot;');
        expect(xml).toContain('&amp;');

        // Validate Unicode content is preserved
        expect(xml).toContain('كتاب عربي');
        expect(xml).toContain('作者名前');
        expect(xml).toContain('שם המחבר');
      });

      it('should properly escape special characters in XML', () => {
        const opfDocument = {
          version: '3.0',
          metadata: {
            title: 'Book & Title <Test>',
            language: ['en'],
            identifier: 'test-escape-123',
          },
          manifest: [],
          spine: [],
        };

        const xml = OPFUtils.generateOPFXML(opfDocument);
        expectValidXML(xml, 'XML character escaping');

        expect(xml).toContain('<dc:title>Book &amp; Title &lt;Test&gt;</dc:title>');
      });
    });

    describe('Type Safety Validation', () => {
      it('should maintain type safety between OPF object and XML', () => {
        const originalOPF = createTestOPFDocument();
        const xml = OPFUtils.generateOPFXML(originalOPF);

        // Validate XML is well-formed
        const doc = expectValidXML(xml, 'Type safety test');

        // Test that essential data is preserved in XML structure
        expect(doc.querySelector('spine')?.children).toHaveLength(originalOPF.spine.length);
        expect(doc.querySelector('manifest')?.children).toHaveLength(originalOPF.manifest.length);

        // Validate spine items match original
        const spineItems = Array.from(doc.querySelectorAll('spine itemref'));
        spineItems.forEach((item, index) => {
          expect(item.getAttribute('idref')).toBe(originalOPF.spine[index]?.idref);
        });
      });
    });

    describe('Edge Case Testing', () => {
      it('should handle multiple spine items correctly', () => {
        const opfDocument = {
          version: '3.0',
          metadata: {
            title: 'Multi-Chapter Book',
            language: ['en'],
            identifier: 'test-multi-123',
          },
          manifest: [
            { id: 'chapter1', href: 'ch1.xhtml', mediaType: 'application/xhtml+xml' },
            { id: 'chapter2', href: 'ch2.xhtml', mediaType: 'application/xhtml+xml' },
            { id: 'appendix', href: 'app.xhtml', mediaType: 'application/xhtml+xml' },
          ],
          spine: [
            { idref: 'chapter1', linear: true },
            { idref: 'chapter2', linear: true },
            { idref: 'appendix', linear: false },
          ],
        };

        const xml = OPFUtils.generateOPFXML(opfDocument);
        const doc = expectValidXML(xml, 'Multiple spine items');

        const spineItems = doc.querySelectorAll('spine itemref');
        expect(spineItems).toHaveLength(3);

        // Check linear attribute handling
        expect(spineItems[0]?.getAttribute('idref')).toBe('chapter1');
        expect(spineItems[1]?.getAttribute('idref')).toBe('chapter2');
        expect(spineItems[2]?.getAttribute('idref')).toBe('appendix');
        expect(spineItems[2]?.getAttribute('linear')).toBe('no');
      });

      it('should handle special characters in spine item IDs', () => {
        const opfDocument = {
          version: '3.0',
          metadata: {
            title: 'Special ID Book',
            language: ['en'],
            identifier: 'test-special-123',
          },
          manifest: [{ id: 'chapter-1&2', href: 'ch12.xhtml', mediaType: 'application/xhtml+xml' }],
          spine: [{ idref: 'chapter-1&2', linear: true }],
        };

        const xml = OPFUtils.generateOPFXML(opfDocument);
        expectValidXML(xml, 'Special characters in IDs');

        // Should properly escape the ID in attributes
        expect(xml).toContain('idref="chapter-1&amp;2"');
      });
    });

    describe('Systematic Debugging', () => {
      it('should debug XML generation step by step', () => {
        const opfDocument = {
          version: '3.0',
          metadata: {
            title: 'Debug Test Book',
            language: ['en'],
            identifier: 'debug-123',
          },
          manifest: [
            { id: 'chapter1', href: 'ch1.xhtml', mediaType: 'application/xhtml+xml' },
            { id: 'chapter2', href: 'ch2.xhtml', mediaType: 'application/xhtml+xml' },
          ],
          spine: [
            { idref: 'chapter1', linear: true },
            { idref: 'chapter2', linear: true },
          ],
        };

        // Use diagnostic helper to test generation
        debugXMLGeneration(opfDocument);

        // Test complete document generation
        const xml = OPFUtils.generateOPFXML(opfDocument);
        expectValidXML(xml, 'Complete OPF document');

        // Validate specific problem area from error message
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const chapter2Ref = doc.querySelector('itemref[idref="chapter2"]');
        expect(chapter2Ref).toBeTruthy();
        expect(chapter2Ref?.tagName).toBe('itemref'); // Ensure proper tag structure
      });
    });

    describe('Regression Test for Workspace Creation Failure', () => {
      it('should generate valid XML for workspace creation scenario', () => {
        // Reproduce the exact OPF structure that's failing
        const opfDocument = {
          version: '3.0',
          metadata: {
            title: 'Untitled Book Project',
            language: ['en'],
            identifier: 'test-workspace-id',
          },
          manifest: [
            { id: 'chapter1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' },
            { id: 'chapter2', href: 'chapter2.xhtml', mediaType: 'application/xhtml+xml' },
          ],
          spine: [
            { idref: 'chapter1', linear: true },
            { idref: 'chapter2', linear: true },
          ],
        };

        const xml = OPFUtils.generateOPFXML(opfDocument);
        const doc = expectValidXML(xml, 'Workspace creation scenario');

        // This should not throw a parse error
        expect(doc.querySelector('parsererror')).toBeNull();

        // Validate the specific structure that's failing
        const chapter2Ref = doc.querySelector('itemref[idref="chapter2"]');
        expect(chapter2Ref).toBeTruthy();
        expect(chapter2Ref?.getAttribute('idref')).toBe('chapter2');

        // Ensure the problematic pattern from error message doesn't exist
        // Error: "</package> idref="chapter2" />"
        expect(xml).not.toContain('</package> idref="chapter2"');
      });
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

      expect(() => OPFUtils.parseRootfilePath(containerContent)).toThrow(
        'Could not find rootfile path in container.xml'
      );
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
        {
          id: 'chapter1',
          href: 'ch1.xhtml',
          mediaType: 'application/xhtml+xml',
        },
        {
          id: 'chapter2',
          href: 'ch2.xhtml',
          mediaType: 'application/xhtml+xml',
        },
      ];
      const spine = [
        { idref: 'chapter1', linear: true },
        { idref: 'chapter2', linear: true },
      ];

      const errors = OPFUtils.validateManifestSpineConsistency(manifest, spine);
      expect(errors).toHaveLength(0);
    });

    it('should detect spine items missing from manifest', () => {
      const manifest = [
        {
          id: 'chapter1',
          href: 'ch1.xhtml',
          mediaType: 'application/xhtml+xml',
        },
      ];
      const spine = [
        { idref: 'chapter1', linear: true },
        { idref: 'chapter2', linear: true },
      ];

      const errors = OPFUtils.validateManifestSpineConsistency(manifest, spine);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('chapter2');
    });
  });

  describe('Title metadata', () => {
    it('emits a plain dc:title (no id/refines) for a single simple title', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.title = 'A Simple Book';
      testDoc.metadata.titleFileAs = undefined;
      testDoc.metadata.additionalTitles = undefined;

      const xml = OPFUtils.generateOPFXML(testDoc);

      expect(xml).toContain('<dc:title>A Simple Book</dc:title>');
      expect(xml).not.toContain('property="title-type"');
    });

    it('emits a file-as refinement for the primary title', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.title = 'The Hobbit';
      testDoc.metadata.titleFileAs = 'Hobbit, The';

      const xml = OPFUtils.generateOPFXML(testDoc);
      expectValidXML(xml, 'OPF with title file-as');

      expect(xml).toMatch(/<dc:title id="title1">The Hobbit<\/dc:title>/);
      expect(xml).toContain('<meta refines="#title1" property="file-as">Hobbit, The</meta>');
    });

    it('marks the primary title-type="main" and emits typed additional titles', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.title = 'Main Title';
      testDoc.metadata.additionalTitles = [{ value: 'A Subtitle', type: 'subtitle' }];

      const xml = OPFUtils.generateOPFXML(testDoc);
      expectValidXML(xml, 'OPF with subtitle');

      expect(xml).toContain('<meta refines="#title1" property="title-type">main</meta>');
      expect(xml).toMatch(/<dc:title id="title2">A Subtitle<\/dc:title>/);
      expect(xml).toContain('<meta refines="#title2" property="title-type">subtitle</meta>');
    });
  });

  describe('Identifier metadata', () => {
    it('emits an identifier-type refinement for the unique identifier', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.identifier = 'urn:isbn:9780000000001';
      testDoc.metadata.identifierType = '15';

      const xml = OPFUtils.generateOPFXML(testDoc);
      expectValidXML(xml, 'OPF with identifier-type');

      expect(xml).toMatch(
        /<meta refines="#[^"]+" property="identifier-type" scheme="onix:codelist5">15<\/meta>/
      );
    });

    it('emits additional identifiers with ids and their own types', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.identifier = 'urn:uuid:12345';
      testDoc.metadata.additionalIdentifiers = [{ value: 'urn:isbn:9780000000001', type: '15' }];

      const xml = OPFUtils.generateOPFXML(testDoc);
      expectValidXML(xml, 'OPF with additional identifier');

      expect(xml).toContain(
        '<dc:identifier id="identifier1">urn:isbn:9780000000001</dc:identifier>'
      );
      expect(xml).toContain(
        '<meta refines="#identifier1" property="identifier-type" scheme="onix:codelist5">15</meta>'
      );
    });

    it('emits an untyped additional identifier without an id', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.identifier = 'urn:uuid:12345';
      testDoc.metadata.additionalIdentifiers = [{ value: 'urn:isbn:9780000000001' }];

      const xml = OPFUtils.generateOPFXML(testDoc);
      expectValidXML(xml, 'OPF with untyped additional identifier');

      expect(xml).toContain('<dc:identifier>urn:isbn:9780000000001</dc:identifier>');
      expect(xml).not.toContain('property="identifier-type"');
    });
  });

  describe('Subject metadata', () => {
    it('emits a plain dc:subject (no id/refines) for a keyword without a scheme', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.subject = ['Fiction'];

      const xml = OPFUtils.generateOPFXML(testDoc);

      expect(xml).toContain('<dc:subject>Fiction</dc:subject>');
      expect(xml).not.toContain('property="authority"');
    });

    it('emits authority + term refinements when both are present', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.subject = [
        { value: 'Science Fiction', authority: 'BISAC', term: 'FIC028000' },
      ];

      const xml = OPFUtils.generateOPFXML(testDoc);
      expectValidXML(xml, 'OPF with coded subject');

      expect(xml).toContain('<dc:subject id="subject1">Science Fiction</dc:subject>');
      expect(xml).toContain('<meta refines="#subject1" property="authority">BISAC</meta>');
      expect(xml).toContain('<meta refines="#subject1" property="term">FIC028000</meta>');
    });

    it('omits the scheme when only one of authority/term is set (spec: both or neither)', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.subject = [{ value: 'Fiction', term: 'FIC028000' }];

      const xml = OPFUtils.generateOPFXML(testDoc);

      expect(xml).toContain('<dc:subject>Fiction</dc:subject>');
      expect(xml).not.toContain('property="term"');
      expect(xml).not.toContain('property="authority"');
    });
  });

  describe('Collections (belongs-to-collection)', () => {
    it('emits each collection with collection-type and group-position refinements', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.collections = [
        { name: 'The Chronicles', type: 'series', position: '2' },
        { name: '2024 Box Set', type: 'set' },
      ];

      const xml = OPFUtils.generateOPFXML(testDoc);
      expectValidXML(xml, 'OPF with collections');

      expect(xml).toContain(
        '<meta property="belongs-to-collection" id="collection1">The Chronicles</meta>'
      );
      expect(xml).toContain(
        '<meta refines="#collection1" property="collection-type">series</meta>'
      );
      expect(xml).toContain('<meta refines="#collection1" property="group-position">2</meta>');
      expect(xml).toContain(
        '<meta property="belongs-to-collection" id="collection2">2024 Box Set</meta>'
      );
      expect(xml).toContain('<meta refines="#collection2" property="collection-type">set</meta>');
      expect(xml).not.toContain('refines="#collection2" property="group-position"');
    });

    it('emits nothing when no collections are declared', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.collections = undefined;

      const xml = OPFUtils.generateOPFXML(testDoc);

      expect(xml).not.toContain('belongs-to-collection');
    });
  });

  describe('Apple Books vendor metadata', () => {
    it('emits ibooks:specified-fonts only when enabled', () => {
      const testDoc = createTestOPFDocument();

      testDoc.metadata.ibooksSpecifiedFonts = true;
      expect(OPFUtils.generateOPFXML(testDoc)).toContain(
        '<meta property="ibooks:specified-fonts">true</meta>'
      );

      testDoc.metadata.ibooksSpecifiedFonts = false;
      expect(OPFUtils.generateOPFXML(testDoc)).not.toContain('ibooks:specified-fonts');

      testDoc.metadata.ibooksSpecifiedFonts = undefined;
      expect(OPFUtils.generateOPFXML(testDoc)).not.toContain('ibooks:specified-fonts');
    });
  });

  describe('Accessibility metadata', () => {
    it('emits only declared accessibility metadata (no fabricated claims)', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.accessMode = undefined;
      testDoc.metadata.accessibilityFeature = undefined;
      testDoc.metadata.accessibilityHazard = undefined;
      testDoc.metadata.accessibilitySummary = undefined;
      testDoc.metadata.accessibilityConformance = undefined;

      const xml = OPFUtils.generateOPFXML(testDoc);

      expect(xml).not.toContain('schema:accessMode');
      expect(xml).not.toContain('schema:accessibilityFeature');
      expect(xml).not.toContain('dcterms:conformsTo');
    });

    it('emits the declared Schema.org and EPUB Accessibility 1.1 metadata', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.accessMode = ['textual', 'visual'];
      testDoc.metadata.accessModeSufficient = ['textual', 'textual,visual'];
      testDoc.metadata.accessibilityFeature = ['structuralNavigation', 'alternativeText'];
      testDoc.metadata.accessibilityHazard = ['noFlashingHazard'];
      testDoc.metadata.accessibilitySummary = 'Fully navigable with alt text.';
      testDoc.metadata.accessibilityConformance = 'EPUB Accessibility 1.1 - WCAG 2.1 Level AA';
      testDoc.metadata.accessibilityCertifiedBy = 'Acme Publishing';
      testDoc.metadata.accessibilityCertifierReport = 'https://example.com/report';

      const xml = OPFUtils.generateOPFXML(testDoc);
      expectValidXML(xml, 'OPF with accessibility metadata');

      expect(xml).toContain('<meta property="schema:accessMode">textual</meta>');
      expect(xml).toContain('<meta property="schema:accessMode">visual</meta>');
      expect(xml).toContain('<meta property="schema:accessModeSufficient">textual,visual</meta>');
      expect(xml).toContain(
        '<meta property="schema:accessibilityFeature">structuralNavigation</meta>'
      );
      expect(xml).toContain('<meta property="schema:accessibilityHazard">noFlashingHazard</meta>');
      expect(xml).toContain(
        '<meta property="schema:accessibilitySummary">Fully navigable with alt text.</meta>'
      );
      expect(xml).toContain(
        '<meta property="dcterms:conformsTo">EPUB Accessibility 1.1 - WCAG 2.1 Level AA</meta>'
      );
      expect(xml).toContain('<meta property="a11y:certifiedBy">Acme Publishing</meta>');
      expect(xml).toContain('<link rel="a11y:certifierReport" href="https://example.com/report"/>');
    });
  });

  describe('Rendition Properties', () => {
    it('should include rendition properties in generated OPF when non-default', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.renditionLayout = 'pre-paginated';
      testDoc.metadata.renditionOrientation = 'landscape';
      testDoc.metadata.renditionSpread = 'none';
      testDoc.metadata.renditionViewport = 'width=1200, height=600';
      testDoc.metadata.renditionFlow = 'scrolled-doc';
      testDoc.metadata.pageProgressionDirection = 'rtl';

      const xml = OPFUtils.generateOPFXML(testDoc);
      expectValidXML(xml, 'OPF with rendition properties');

      expect(xml).toContain('prefix="rendition: http://www.idpf.org/vocab/rendition/#');
      expect(xml).toContain('<meta property="rendition:layout">pre-paginated</meta>');
      expect(xml).toContain('<meta property="rendition:orientation">landscape</meta>');
      expect(xml).toContain('<meta property="rendition:spread">none</meta>');
      expect(xml).toContain('<meta property="rendition:viewport">width=1200, height=600</meta>');
      expect(xml).toContain('<meta property="rendition:flow">scrolled-doc</meta>');
      expect(xml).toContain('<spine page-progression-direction="rtl">');
    });

    it('should omit rendition properties when they are default values', () => {
      const testDoc = createTestOPFDocument();
      testDoc.metadata.renditionLayout = 'reflowable';
      testDoc.metadata.renditionOrientation = 'auto';
      testDoc.metadata.renditionSpread = 'auto';
      testDoc.metadata.renditionFlow = 'auto';
      testDoc.metadata.pageProgressionDirection = 'default';

      const xml = OPFUtils.generateOPFXML(testDoc);

      expect(xml).not.toContain('rendition:layout');
      expect(xml).not.toContain('rendition:orientation');
      expect(xml).not.toContain('rendition:spread');
      expect(xml).not.toContain('rendition:viewport');
      expect(xml).not.toContain('rendition:flow');
      expect(xml).not.toContain('page-progression-direction');
      expect(xml).toContain('<spine>');
    });

    it('omits rendition:viewport for reflowable layout even when a value is set', () => {
      // A viewport left over from a pre-paginated session must not leak into the
      // OPF once the layout is reflowable (rendition:viewport is fixed-layout only).
      const testDoc = createTestOPFDocument();
      testDoc.metadata.renditionLayout = 'reflowable';
      testDoc.metadata.renditionViewport = 'width=1200, height=1600';

      const xml = OPFUtils.generateOPFXML(testDoc);

      expect(xml).not.toContain('rendition:viewport');
    });

    // Note: Parsing tests require getElementsByTagNameNS which doesn't work in happy-dom
    // Round-trip parsing functionality is tested in browser environment via Storybook
  });
});

describe('toEpubSafeFilename', () => {
  it('replaces spaces and special characters with hyphens', () => {
    expect(toEpubSafeFilename('My Image (1).JPG')).toBe('My-Image-1.jpg');
    expect(toEpubSafeFilename('a#b%c?d*e.png')).toBe('a-b-c-d-e.png');
  });

  it('folds accents and lowercases the extension', () => {
    expect(toEpubSafeFilename('café.PNG')).toBe('cafe.png');
    expect(toEpubSafeFilename('résumé.txt')).toBe('resume.txt');
  });

  it('trims leading dots and falls back to "asset" when empty', () => {
    expect(toEpubSafeFilename('.hidden')).toBe('hidden');
    expect(toEpubSafeFilename('中文.png')).toBe('asset.png');
    expect(toEpubSafeFilename('***')).toBe('asset');
  });

  it('preserves underscores and hyphens, and caps base length at 80', () => {
    expect(toEpubSafeFilename('a_b-c.png')).toBe('a_b-c.png');
    expect(toEpubSafeFilename('x'.repeat(120) + '.png')).toBe('x'.repeat(80) + '.png');
  });

  it('is idempotent on an already-safe name', () => {
    const safe = 'My-Image-1.jpg';
    expect(toEpubSafeFilename(safe)).toBe(safe);
  });
});

describe('toEpubSafeHref', () => {
  it('sanitizes each path segment and preserves the directory structure', () => {
    expect(toEpubSafeHref('Images/My File.jpg')).toBe('Images/My-File.jpg');
  });

  it('drops empty/traversal segments', () => {
    expect(toEpubSafeHref('Images/../My File.jpg')).toBe('Images/asset/My-File.jpg');
    expect(toEpubSafeHref('/Images//cover.png')).toBe('Images/cover.png');
  });
});

describe('ensureUniqueHref', () => {
  it('returns the href unchanged when no collision', () => {
    expect(ensureUniqueHref('Images/cover.png', ['Images/other.png'])).toBe('Images/cover.png');
  });

  it('inserts a numeric suffix before the extension on a case-insensitive collision', () => {
    expect(ensureUniqueHref('Images/cover.png', ['Images/COVER.png'])).toBe('Images/cover-1.png');
    expect(ensureUniqueHref('Images/cover.png', ['Images/cover.png', 'Images/cover-1.png'])).toBe(
      'Images/cover-2.png'
    );
  });
});
