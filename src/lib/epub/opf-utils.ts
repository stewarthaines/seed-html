/**
 * OPF and EPUB XML Utilities
 * 
 * Shared utilities for parsing and generating EPUB content.opf files and related XML.
 * Extracted from EPUBPackager and EPUBUnpacker for reuse by WorkspaceManager.
 */

export interface EPUBMetadata {
	title: string;
	author?: string;
	language: string;
	identifier: string;
	publisher?: string;
	date?: string;
}

export interface ContainerInfo {
	rootfilePath?: string;
	error?: string;
}

export interface XMLValidationResult {
	isValid: boolean;
	error?: string;
}

export interface OPFDocument {
	metadata: EPUBMetadata;
	manifest: ManifestItem[];
	spine: SpineItem[];
	guide?: GuideItem[];
	version: string;
}

export interface ManifestItem {
	id: string;
	href: string;
	mediaType: string;
	properties?: string[];
	fallback?: string;
}

export interface SpineItem {
	idref: string;
	linear?: boolean;
	properties?: string[];
}

export interface GuideItem {
	type: string;
	title?: string;
	href: string;
}

/**
 * Utility class for OPF and EPUB XML operations
 */
export class OPFUtils {
	/**
	 * Parses container.xml to extract rootfile path using DOMParser
	 */
	static parseContainerXml(containerXml: string): ContainerInfo {
		try {
			if (!globalThis.DOMParser) {
				return { error: 'DOMParser not available' };
			}
			
			const parser = new DOMParser();
			const doc = parser.parseFromString(containerXml, 'application/xml');
			
			// Check for XML parsing errors
			const parserError = doc.querySelector('parsererror');
			if (parserError) {
				return { error: 'Invalid XML in container.xml' };
			}

			// Find the rootfile element and extract full-path attribute
			const rootfileElement = doc.querySelector('rootfile');
			if (!rootfileElement) {
				return { error: 'No rootfile element found in container.xml' };
			}

			const rootfilePath = rootfileElement.getAttribute('full-path');
			if (!rootfilePath) {
				return { error: 'No full-path attribute found in rootfile element' };
			}

			// Validate that it's an OPF file
			if (!rootfilePath.endsWith('.opf')) {
				return { error: `Rootfile does not appear to be an OPF file: ${rootfilePath}` };
			}

			return { rootfilePath };
		} catch (err) {
			return { error: `Failed to parse container.xml: ${err instanceof Error ? err.message : 'Unknown error'}` };
		}
	}

	/**
	 * Validates XML content using DOMParser
	 */
	static validateXML(xmlContent: string): XMLValidationResult {
		try {
			if (!globalThis.DOMParser) {
				return { isValid: false, error: 'DOMParser not available' };
			}
			
			const parser = new DOMParser();
			const doc = parser.parseFromString(xmlContent, 'application/xml');
			
			// Check for XML parsing errors
			const parserError = doc.querySelector('parsererror');
			if (parserError) {
				const errorText = parserError.textContent || 'Unknown XML parsing error';
				return { isValid: false, error: errorText };
			}
			
			return { isValid: true };
		} catch (error) {
			return { isValid: false, error: error instanceof Error ? error.message : 'XML validation failed' };
		}
	}

	/**
	 * Parses OPF content to extract metadata using regex (for compatibility)
	 */
	static parseOPFMetadata(opfContent: string): EPUBMetadata {
		// Extract required metadata fields
		const titleMatch = opfContent.match(/<dc:title[^>]*>(.*?)<\/dc:title>/i);
		const languageMatch = opfContent.match(/<dc:language[^>]*>(.*?)<\/dc:language>/i);
		const identifierMatch = opfContent.match(/<dc:identifier[^>]*>(.*?)<\/dc:identifier>/i);

		// Check for required fields
		if (!titleMatch) {
			throw new Error('Missing required dc:title in OPF metadata');
		}
		if (!languageMatch) {
			throw new Error('Missing required dc:language in OPF metadata');
		}
		if (!identifierMatch) {
			throw new Error('Missing required dc:identifier in OPF metadata');
		}

		// Extract optional fields
		const authorMatch = opfContent.match(/<dc:creator[^>]*>(.*?)<\/dc:creator>/i);
		const publisherMatch = opfContent.match(/<dc:publisher[^>]*>(.*?)<\/dc:publisher>/i);
		const dateMatch = opfContent.match(/<dc:date[^>]*>(.*?)<\/dc:date>/i);

		return {
			title: titleMatch[1].trim(),
			author: authorMatch?.[1]?.trim(),
			language: languageMatch[1].trim(),
			identifier: identifierMatch[1].trim(),
			publisher: publisherMatch?.[1]?.trim(),
			date: dateMatch?.[1]?.trim()
		};
	}

	/**
	 * Parses complete OPF document structure using DOMParser
	 */
	static parseOPFDocument(opfContent: string): OPFDocument {
		const validation = this.validateXML(opfContent);
		if (!validation.isValid) {
			throw new Error(`Invalid OPF XML: ${validation.error}`);
		}

		const parser = new DOMParser();
		const doc = parser.parseFromString(opfContent, 'application/xml');
		
		// Extract version
		const packageElement = doc.querySelector('package');
		const version = packageElement?.getAttribute('version') || '2.0';

		// Parse metadata
		const metadata = this.parseOPFMetadata(opfContent);

		// Parse manifest
		const manifest: ManifestItem[] = [];
		const manifestElements = doc.querySelectorAll('manifest item');
		manifestElements.forEach(item => {
			const id = item.getAttribute('id');
			const href = item.getAttribute('href');
			const mediaType = item.getAttribute('media-type');
			
			if (id && href && mediaType) {
				const properties = item.getAttribute('properties');
				const fallback = item.getAttribute('fallback');
				
				manifest.push({
					id,
					href,
					mediaType,
					properties: properties ? properties.split(' ') : undefined,
					fallback: fallback || undefined
				});
			}
		});

		// Parse spine
		const spine: SpineItem[] = [];
		const spineElements = doc.querySelectorAll('spine itemref');
		spineElements.forEach(itemref => {
			const idref = itemref.getAttribute('idref');
			if (idref) {
				const linear = itemref.getAttribute('linear');
				const properties = itemref.getAttribute('properties');
				
				spine.push({
					idref,
					linear: linear === 'no' ? false : true,
					properties: properties ? properties.split(' ') : undefined
				});
			}
		});

		// Parse guide (EPUB 2.0 only)
		const guide: GuideItem[] = [];
		const guideElements = doc.querySelectorAll('guide reference');
		guideElements.forEach(reference => {
			const type = reference.getAttribute('type');
			const href = reference.getAttribute('href');
			
			if (type && href) {
				const title = reference.getAttribute('title');
				guide.push({
					type,
					href,
					title: title || undefined
				});
			}
		});

		return {
			metadata,
			manifest,
			spine,
			guide: guide.length > 0 ? guide : undefined,
			version
		};
	}

	/**
	 * Generates OPF XML content from OPFDocument structure
	 */
	static generateOPFXML(opfDocument: OPFDocument): string {
		const { metadata, manifest, spine, guide, version } = opfDocument;
		
		// Escape XML content
		const escapeXML = (str: string): string => {
			return str.replace(/[<>&'"]/g, (char) => {
				switch (char) {
					case '<': return '&lt;';
					case '>': return '&gt;';
					case '&': return '&amp;';
					case '"': return '&quot;';
					case "'": return '&apos;';
					default: return char;
				}
			});
		};

		// Generate unique identifier
		const uniqueId = manifest.find(item => item.id === 'uuid')?.id || 'uuid';

		let xml = `<?xml version="1.0" encoding="utf-8"?>
<package version="${version}" xmlns="http://www.idpf.org/2007/opf" unique-identifier="${uniqueId}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXML(metadata.title)}</dc:title>
    <dc:language>${escapeXML(metadata.language)}</dc:language>
    <dc:identifier id="${uniqueId}">${escapeXML(metadata.identifier)}</dc:identifier>`;

		// Add optional metadata
		if (metadata.author) {
			xml += `\n    <dc:creator>${escapeXML(metadata.author)}</dc:creator>`;
		}
		if (metadata.publisher) {
			xml += `\n    <dc:publisher>${escapeXML(metadata.publisher)}</dc:publisher>`;
		}
		if (metadata.date) {
			xml += `\n    <dc:date>${escapeXML(metadata.date)}</dc:date>`;
		}

		xml += `\n  </metadata>
  <manifest>`;

		// Add manifest items
		manifest.forEach(item => {
			xml += `\n    <item id="${escapeXML(item.id)}" href="${escapeXML(item.href)}" media-type="${escapeXML(item.mediaType)}"`;
			if (item.properties && item.properties.length > 0) {
				xml += ` properties="${escapeXML(item.properties.join(' '))}"`;
			}
			if (item.fallback) {
				xml += ` fallback="${escapeXML(item.fallback)}"`;
			}
			xml += ' />';
		});

		xml += `\n  </manifest>
  <spine>`;

		// Add spine items
		spine.forEach(item => {
			xml += `\n    <itemref idref="${escapeXML(item.idref)}"`;
			if (item.linear === false) {
				xml += ' linear="no"';
			}
			if (item.properties && item.properties.length > 0) {
				xml += ` properties="${escapeXML(item.properties.join(' '))}"`;
			}
			xml += ' />';
		});

		xml += `\n  </spine>`;

		// Add guide if present (EPUB 2.0)
		if (guide && guide.length > 0) {
			xml += `\n  <guide>`;
			guide.forEach(ref => {
				xml += `\n    <reference type="${escapeXML(ref.type)}" href="${escapeXML(ref.href)}"`;
				if (ref.title) {
					xml += ` title="${escapeXML(ref.title)}"`;
				}
				xml += ' />';
			});
			xml += `\n  </guide>`;
		}

		xml += `\n</package>`;

		return xml;
	}

	/**
	 * Detects EPUB version from OPF content using DOMParser
	 */
	static detectEPUBVersion(opfContent: string): string | undefined {
		try {
			if (!globalThis.DOMParser) {
				return undefined;
			}
			const parser = new DOMParser();
			const doc = parser.parseFromString(opfContent, 'application/xml');
			
			// Check for XML parsing errors
			const parserError = doc.querySelector('parsererror');
			if (parserError) {
				return undefined;
			}

			// Look for version attribute in package element
			const packageElement = doc.querySelector('package');
			if (packageElement) {
				const version = packageElement.getAttribute('version');
				if (version) {
					if (version.startsWith('2.')) {
						return 'EPUB 2.0';
					} else if (version.startsWith('3.')) {
						return 'EPUB 3.0';
					} else {
						return `EPUB ${version}`;
					}
				}
			}

			// Fallback: look for EPUB 3 specific elements
			if (doc.querySelector('[properties]') || doc.querySelector('[epub\\:type]')) {
				return 'EPUB 3.0';
			}

			// Default assumption
			return 'EPUB 2.0';
		} catch {
			return undefined;
		}
	}

	/**
	 * Parses rootfile path from container.xml content using regex (lightweight)
	 */
	static parseRootfilePath(containerContent: string): string {
		const rootfileMatch = containerContent.match(/<rootfile[^>]+full-path\s*=\s*["']([^"']+)["'][^>]*>/i);
		if (!rootfileMatch) {
			throw new Error('Could not find rootfile path in container.xml');
		}
		return rootfileMatch[1];
	}

	/**
	 * Generates a basic container.xml file
	 */
	static generateContainerXML(rootfilePath: string = 'OEBPS/content.opf'): string {
		return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${rootfilePath}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
	}

	/**
	 * Validates that manifest and spine are consistent
	 */
	static validateManifestSpineConsistency(manifest: ManifestItem[], spine: SpineItem[]): string[] {
		const errors: string[] = [];
		const manifestIds = new Set(manifest.map(item => item.id));

		// Check that all spine items reference existing manifest items
		spine.forEach((spineItem, index) => {
			if (!manifestIds.has(spineItem.idref)) {
				errors.push(`Spine item ${index} references non-existent manifest item: ${spineItem.idref}`);
			}
		});

		return errors;
	}
}