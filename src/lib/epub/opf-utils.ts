/**
 * OPF and EPUB XML Utilities
 *
 * Shared utilities for parsing and generating EPUB content.opf files and related XML.
 * Extracted from EPUBPackager and EPUBUnpacker for reuse by WorkspaceManager.
 */

/// <reference lib="dom" />

/**
 * Generate EPUB-compliant timestamp without decimal seconds
 *
 * EPUB validation requires dcterms:modified format without decimal seconds
 * @returns ISO 8601 timestamp without milliseconds (e.g., "2023-12-07T14:30:45Z")
 */
export function generateEPUBTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * A creator or contributor with optional MARC relator roles.
 * `id` is the OPF id used by role refinements (`<meta refines="#id">`); it is
 * read on parse and re-minted on generate.
 */
export interface Creator {
  name: string;
  roles: string[];
  id?: string;
}

/** Normalize a creator value, tolerating legacy bare-string data. */
export function toCreator(value: Creator | string): Creator {
  if (typeof value === 'string') return { name: value, roles: [] };
  return { name: value.name, roles: value.roles ?? [], id: value.id };
}

/** Normalize a list of creator values (tolerating legacy strings). */
export function normalizeCreators(list?: (Creator | string)[]): Creator[] {
  return (list ?? []).map(toCreator);
}

/** Display name for a single creator value (tolerant of legacy strings). */
export function creatorName(value?: Creator | string): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.name;
}

/** Display names for a list of creator values (tolerant of legacy strings). */
export function creatorNames(list?: (Creator | string)[]): string[] {
  return (list ?? []).map(creatorName).filter(Boolean);
}

/**
 * The primary (first) dc:language tag — the one most readers want (display,
 * xml:lang, locale). Tolerant of legacy single-string data.
 */
export function primaryLanguage(meta?: { language?: string[] | string }): string {
  const lang = meta?.language;
  if (!lang) return '';
  return typeof lang === 'string' ? lang : (lang[0] ?? '');
}

/**
 * Build Creator[] from dc:creator/dc:contributor elements, attaching MARC roles
 * via a refines lookup (id -> role codes). Pure and DOM-namespace-free so it can
 * be unit-tested without happy-dom's unreliable getElementsByTagNameNS.
 */
export function parseCreatorList(
  elements: ArrayLike<Element>,
  refinesLookup: (id: string) => string[]
): Creator[] {
  return Array.from(elements)
    .map(el => {
      const name = el.textContent?.trim() ?? '';
      const id = el.getAttribute('id') || undefined;
      const roles = id ? refinesLookup(id) : [];
      return { name, roles, id };
    })
    .filter(c => c.name.length > 0);
}

export interface EPUBMetadata {
  // Required Dublin Core elements
  title: string;
  language: string[]; // BCP 47 tags; at least one required
  identifier: string;

  // Optional Dublin Core elements
  creator?: Creator[];
  contributor?: Creator[];
  publisher?: string;
  date?: string;
  description?: string;
  subject?: string[];
  rights?: string;
  source?: string;
  relation?: string;
  coverage?: string;
  type?: string;
  format?: string;

  // EPUB-specific metadata
  modifiedDate?: string;
  epubVersion?: string;

  // EPUB 3 rendition metadata
  renditionLayout?: string;
  pageProgressionDirection?: string;
  renditionOrientation?: string;
  renditionSpread?: string;
  // Package-level fixed-layout viewport, e.g. "width=1200, height=600"
  // (EPUB 3.0 rendition:viewport; one per publication in our model).
  renditionViewport?: string;

  // EPUB 3 accessibility metadata
  accessMode?: string[];
  accessModeSufficient?: string[];
  accessibilityFeature?: string[];
  accessibilityHazard?: string[];
  accessibilitySummary?: string;
}

// Type mapping for strict field access
export interface MetadataFieldTypes {
  // Creator fields (name + roles)
  creator: Creator[];
  contributor: Creator[];
  // Array fields
  language: string[];
  subject: string[];
  accessMode: string[];
  accessModeSufficient: string[];
  accessibilityFeature: string[];
  accessibilityHazard: string[];

  // Required string fields
  title: string;
  identifier: string;

  // Optional string fields
  publisher: string;
  date: string;
  description: string;
  rights: string;
  source: string;
  relation: string;
  coverage: string;
  type: string;
  format: string;
  modifiedDate: string;
  epubVersion: string;
  renditionLayout: string;
  pageProgressionDirection: string;
  renditionOrientation: string;
  renditionSpread: string;
  renditionViewport: string;
  accessibilitySummary: string;
}

// Extract field type categories
export type ArrayMetadataFields = {
  [K in keyof MetadataFieldTypes]: MetadataFieldTypes[K] extends string[] ? K : never;
}[keyof MetadataFieldTypes];

export type StringMetadataFields = {
  [K in keyof MetadataFieldTypes]: MetadataFieldTypes[K] extends string ? K : never;
}[keyof MetadataFieldTypes];

// Creator/contributor are index-addressable arrays (of Creator) and so are still
// editable via the add/remove array UI, even though they are not string[].
export type CreatorMetadataFields = 'creator' | 'contributor';

// Fields that the add/remove array UI can operate on.
export type EditableArrayField = ArrayMetadataFields | CreatorMetadataFields;

export type RequiredMetadataFields = 'title' | 'language' | 'identifier';

export type OptionalMetadataFields = Exclude<StringMetadataFields, RequiredMetadataFields>;

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
  version?: string;
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
      return {
        error: `Failed to parse container.xml: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
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
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'XML validation failed',
      };
    }
  }

  /**
   * Parses OPF Document to extract metadata using namespace-aware DOM methods
   */
  static parseOPFMetadata(doc: Document): EPUBMetadata {
    const DC_NS = 'http://purl.org/dc/elements/1.1/';

    // Extract required metadata fields using namespace-aware methods with fallback
    let titleElements: HTMLCollectionOf<Element> | NodeListOf<Element> = doc.getElementsByTagNameNS(
      DC_NS,
      'title'
    );
    if (titleElements.length === 0) {
      titleElements = doc.querySelectorAll('dc\\:title, title');
    }

    let languageElements: HTMLCollectionOf<Element> | NodeListOf<Element> =
      doc.getElementsByTagNameNS(DC_NS, 'language');
    if (languageElements.length === 0) {
      languageElements = doc.querySelectorAll('dc\\:language, language');
    }

    let identifierElements: HTMLCollectionOf<Element> | NodeListOf<Element> =
      doc.getElementsByTagNameNS(DC_NS, 'identifier');
    if (identifierElements.length === 0) {
      identifierElements = doc.querySelectorAll('dc\\:identifier, identifier');
    }

    // Check for required fields
    if (titleElements.length === 0 || !titleElements[0].textContent?.trim()) {
      throw new Error('Missing required dc:title in OPF metadata');
    }
    if (languageElements.length === 0 || !languageElements[0].textContent?.trim()) {
      throw new Error('Missing required dc:language in OPF metadata');
    }
    if (identifierElements.length === 0 || !identifierElements[0].textContent?.trim()) {
      throw new Error('Missing required dc:identifier in OPF metadata');
    }

    // Extract optional fields with fallback for namespace parsing issues
    let creatorElements: HTMLCollectionOf<Element> | NodeListOf<Element> =
      doc.getElementsByTagNameNS(DC_NS, 'creator');
    if (creatorElements.length === 0) {
      creatorElements = doc.querySelectorAll('dc\\:creator, creator');
    }

    let contributorElements: HTMLCollectionOf<Element> | NodeListOf<Element> =
      doc.getElementsByTagNameNS(DC_NS, 'contributor');
    if (contributorElements.length === 0) {
      contributorElements = doc.querySelectorAll('dc\\:contributor, contributor');
    }

    let subjectElements: HTMLCollectionOf<Element> | NodeListOf<Element> =
      doc.getElementsByTagNameNS(DC_NS, 'subject');
    if (subjectElements.length === 0) {
      subjectElements = doc.querySelectorAll('dc\\:subject, subject');
    }

    const publisherElements = doc.getElementsByTagNameNS(DC_NS, 'publisher');
    const dateElements = doc.getElementsByTagNameNS(DC_NS, 'date');
    const descriptionElements = doc.getElementsByTagNameNS(DC_NS, 'description');
    const rightsElements = doc.getElementsByTagNameNS(DC_NS, 'rights');
    const sourceElements = doc.getElementsByTagNameNS(DC_NS, 'source');
    const relationElements = doc.getElementsByTagNameNS(DC_NS, 'relation');
    const coverageElements = doc.getElementsByTagNameNS(DC_NS, 'coverage');
    const typeElements = doc.getElementsByTagNameNS(DC_NS, 'type');
    const formatElements = doc.getElementsByTagNameNS(DC_NS, 'format');

    // Parse dcterms:modified meta element (EPUB 3 specific)
    const modifiedElements = doc.querySelectorAll('meta[property="dcterms:modified"]');

    // Build a refines -> role-codes index from `<meta property="role">` elements,
    // then attach roles to each creator/contributor by id.
    const roleRefines = new Map<string, string[]>();
    doc.querySelectorAll('meta[property="role"]').forEach(meta => {
      const refines = meta.getAttribute('refines');
      const code = meta.textContent?.trim();
      if (!refines || !code) return;
      const id = refines.replace(/^#/, '');
      const existing = roleRefines.get(id) ?? [];
      existing.push(code);
      roleRefines.set(id, existing);
    });
    const roleLookup = (id: string) => roleRefines.get(id) ?? [];

    const creators = parseCreatorList(creatorElements, roleLookup);
    const contributors = parseCreatorList(contributorElements, roleLookup);
    const subjects = Array.from(subjectElements)
      .map(el => el.textContent?.trim())
      .filter(Boolean) as string[];

    // Parse rendition properties
    const layoutMeta = doc.querySelector('meta[property="rendition:layout"]');
    const orientationMeta = doc.querySelector('meta[property="rendition:orientation"]');
    const spreadMeta = doc.querySelector('meta[property="rendition:spread"]');
    const viewportMeta = doc.querySelector('meta[property="rendition:viewport"]');

    // Parse spine page-progression-direction
    const spineElement = doc.querySelector('spine');
    const pageProgression = spineElement?.getAttribute('page-progression-direction');

    return {
      title: titleElements[0].textContent!.trim(),
      language: Array.from(languageElements)
        .map(el => el.textContent?.trim())
        .filter(Boolean) as string[],
      identifier: identifierElements[0].textContent!.trim(),
      creator: creators.length > 0 ? creators : undefined,
      contributor: contributors.length > 0 ? contributors : undefined,
      publisher:
        publisherElements.length > 0 ? publisherElements[0].textContent?.trim() : undefined,
      date: dateElements.length > 0 ? dateElements[0].textContent?.trim() : undefined,
      description:
        descriptionElements.length > 0 ? descriptionElements[0].textContent?.trim() : undefined,
      subject: subjects.length > 0 ? subjects : undefined,
      rights: rightsElements.length > 0 ? rightsElements[0].textContent?.trim() : undefined,
      source: sourceElements.length > 0 ? sourceElements[0].textContent?.trim() : undefined,
      relation: relationElements.length > 0 ? relationElements[0].textContent?.trim() : undefined,
      coverage: coverageElements.length > 0 ? coverageElements[0].textContent?.trim() : undefined,
      type: typeElements.length > 0 ? typeElements[0].textContent?.trim() : undefined,
      format: formatElements.length > 0 ? formatElements[0].textContent?.trim() : undefined,
      modifiedDate:
        modifiedElements.length > 0 ? modifiedElements[0].textContent?.trim() : undefined,
      renditionLayout: layoutMeta?.textContent?.trim() || undefined,
      renditionOrientation: orientationMeta?.textContent?.trim() || undefined,
      renditionSpread: spreadMeta?.textContent?.trim() || undefined,
      renditionViewport: viewportMeta?.textContent?.trim() || undefined,
      pageProgressionDirection: pageProgression || undefined,
    };
  }

  /**
   * Parse only the metadata block from an OPF string, skipping the manifest,
   * spine, and guide. Cheaper than parseOPFDocument for list views that only
   * need title/author/language.
   */
  static parseOPFMetadataFromString(opfContent: string): EPUBMetadata {
    const doc = new DOMParser().parseFromString(opfContent, 'application/xml');
    return this.parseOPFMetadata(doc);
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
    const metadata = this.parseOPFMetadata(doc);

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
          fallback: fallback || undefined,
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
          properties: properties ? properties.split(' ') : undefined,
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
          title: title || undefined,
        });
      }
    });

    return {
      metadata,
      manifest,
      spine,
      guide: guide.length > 0 ? guide : undefined,
      version,
    };
  }

  /**
   * Generates OPF XML content from OPFDocument structure
   */
  static generateOPFXML(opfDocument: OPFDocument): string {
    const { metadata, manifest, spine, guide, version } = opfDocument;

    // Escape XML content
    const escapeXML = (str: string): string => {
      return str.replace(/[<>&'"]/g, char => {
        switch (char) {
          case '<':
            return '&lt;';
          case '>':
            return '&gt;';
          case '&':
            return '&amp;';
          case '"':
            return '&quot;';
          case "'":
            return '&apos;';
          default:
            return char;
        }
      });
    };

    // Generate unique identifier
    const uniqueId = manifest.find(item => item.id === 'uuid')?.id || 'uuid';

    // dc:language is multi-valued; tolerate legacy single-string data.
    const languageTags = (
      Array.isArray(metadata.language)
        ? metadata.language
        : metadata.language
          ? [metadata.language as string]
          : []
    ).filter(Boolean);
    const languageXML = languageTags
      .map(tag => `<dc:language>${escapeXML(tag)}</dc:language>`)
      .join('\n    ');

    let xml = `<?xml version="1.0" encoding="utf-8"?>
<package version="${version}" xmlns="http://www.idpf.org/2007/opf" unique-identifier="${uniqueId}" prefix="rendition: http://www.idpf.org/vocab/rendition/# ibooks: http://vocabulary.itunes.apple.com/rdf/ibooks/vocabulary-extensions-1.0/" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:ibooks="http://vocabulary.itunes.apple.com/rdf/ibooks/vocabularies/2012/01/ibooks-specific">
    <dc:title>${escapeXML(metadata.title)}</dc:title>
    ${languageXML}
    <dc:identifier id="${uniqueId}">${escapeXML(metadata.identifier)}</dc:identifier>`;

    // Add optional metadata. Creators/contributors emit an id plus a
    // `<meta refines property="role">` per MARC relator role (EPUB 3).
    let creatorIdCounter = 0;
    const emitCreator = (value: Creator | string, tag: 'dc:creator' | 'dc:contributor') => {
      const creator = toCreator(value);
      const id = `creator${++creatorIdCounter}`;
      xml += `\n    <${tag} id="${id}">${escapeXML(creator.name)}</${tag}>`;
      for (const role of creator.roles) {
        xml += `\n    <meta refines="#${id}" property="role" scheme="marc:relators">${escapeXML(role)}</meta>`;
      }
    };
    if (metadata.creator && metadata.creator.length > 0) {
      metadata.creator.forEach(creator => emitCreator(creator, 'dc:creator'));
    }
    if (metadata.contributor && metadata.contributor.length > 0) {
      metadata.contributor.forEach(contributor => emitCreator(contributor, 'dc:contributor'));
    }
    if (metadata.publisher) {
      xml += `\n    <dc:publisher>${escapeXML(metadata.publisher)}</dc:publisher>`;
    }
    if (metadata.date) {
      xml += `\n    <dc:date>${escapeXML(metadata.date)}</dc:date>`;
    }
    if (metadata.description) {
      xml += `\n    <dc:description>${escapeXML(metadata.description)}</dc:description>`;
    }
    if (metadata.subject && metadata.subject.length > 0) {
      metadata.subject.forEach(subject => {
        xml += `\n    <dc:subject>${escapeXML(subject)}</dc:subject>`;
      });
    }
    if (metadata.rights) {
      xml += `\n    <dc:rights>${escapeXML(metadata.rights)}</dc:rights>`;
    }
    if (metadata.source) {
      xml += `\n    <dc:source>${escapeXML(metadata.source)}</dc:source>`;
    }
    if (metadata.relation) {
      xml += `\n    <dc:relation>${escapeXML(metadata.relation)}</dc:relation>`;
    }
    if (metadata.coverage) {
      xml += `\n    <dc:coverage>${escapeXML(metadata.coverage)}</dc:coverage>`;
    }
    if (metadata.type) {
      xml += `\n    <dc:type>${escapeXML(metadata.type)}</dc:type>`;
    }
    if (metadata.format) {
      xml += `\n    <dc:format>${escapeXML(metadata.format)}</dc:format>`;
    }

    if (metadata.modifiedDate) {
      xml += `\n    <meta property="dcterms:modified">${escapeXML(metadata.modifiedDate)}</meta>`;
    }

    // Add rendition properties only when they differ from defaults
    if (metadata.renditionLayout && metadata.renditionLayout !== 'reflowable') {
      xml += `\n    <meta property="rendition:layout">${escapeXML(metadata.renditionLayout)}</meta>`;
    }

    if (metadata.renditionOrientation && metadata.renditionOrientation !== 'auto') {
      xml += `\n    <meta property="rendition:orientation">${escapeXML(metadata.renditionOrientation)}</meta>`;
    }

    if (metadata.renditionSpread && metadata.renditionSpread !== 'auto') {
      xml += `\n    <meta property="rendition:spread">${escapeXML(metadata.renditionSpread)}</meta>`;
    }

    if (metadata.renditionViewport) {
      xml += `\n    <meta property="rendition:viewport">${escapeXML(metadata.renditionViewport)}</meta>`;
    }

    xml += '\n    <meta property="ibooks:specified-fonts">true</meta>';

    xml += `
    <meta property="schema:accessMode">textual</meta>
    <meta property="schema:accessibilityFeature">alternativeText</meta>
    <meta property="schema:accessibilityHazard">noFlashingHazard</meta>
    <meta property="schema:accessibilityHazard">noSoundHazard</meta>
    <meta property="schema:accessModeSufficient">textual,visual</meta>
    <meta property="schema:accessibilitySummary">This publication has been validated to meet the minimum conformance requirements for EPUB Accessibility 1.1.</meta>
    <meta property="dcterms:conformsTo">http://www.w3.org/standards/wcag/2.0/a</meta>
    <meta property="dcterms:conformsTo">http://www.idpf.org/epub/a11y/accessibility-20170829.html#wcag-a</meta>
    `;

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

    xml += `\n  </manifest>`;

    // Add spine with optional page-progression-direction
    if (metadata.pageProgressionDirection && metadata.pageProgressionDirection !== 'default') {
      xml += `\n  <spine page-progression-direction="${escapeXML(metadata.pageProgressionDirection)}">`;
    } else {
      xml += `\n  <spine>`;
    }

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
    const rootfileMatch = containerContent.match(
      /<rootfile[^>]+full-path\s*=\s*["']([^"']+)["'][^>]*>/i
    );
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
        errors.push(
          `Spine item ${index} references non-existent manifest item: ${spineItem.idref}`
        );
      }
    });

    return errors;
  }
}

// Type-safe helper functions for metadata field access
/**
 * EPUB Directory Mapping for Media Types
 * Maps MIME types to their appropriate EPUB directory structure
 */
export interface DirectoryMapping {
  [mediaType: string]: string;
}

export const EPUB_DIRECTORY_MAP: DirectoryMapping = {
  // Text content
  'application/xhtml+xml': 'Text/',
  'text/html': 'Text/',

  // Stylesheets
  'text/css': 'Styles/',

  // Scripts
  'text/javascript': 'Scripts/',
  'application/javascript': 'Scripts/',

  // Images
  'image/jpeg': 'Images/',
  'image/png': 'Images/',
  'image/gif': 'Images/',
  'image/svg+xml': 'Images/',
  'image/webp': 'Images/',

  // Audio
  'audio/mpeg': 'Audio/',
  'audio/ogg': 'Audio/',
  'audio/wav': 'Audio/',
  'audio/mp4': 'Audio/',

  // Video
  'video/mp4': 'Video/',
  'video/webm': 'Video/',
  'video/ogg': 'Video/',

  // Fonts
  'font/ttf': 'Fonts/',
  'font/otf': 'Fonts/',
  'font/woff': 'Fonts/',
  'font/woff2': 'Fonts/',
  'application/font-woff': 'Fonts/',

  // Documents
  'application/pdf': 'Misc/',
  'text/plain': 'Text/',
};

/**
 * Get the appropriate EPUB directory for a given media type
 * @param mediaType - MIME type of the file
 * @returns Directory path with trailing slash
 */
export function getDirectoryFromMediaType(mediaType: string): string {
  // Normalize media type (remove charset, etc.)
  const normalizedType = mediaType.split(';')[0].trim().toLowerCase();

  // Return mapped directory or default (root relative to OPF)
  return EPUB_DIRECTORY_MAP[normalizedType] || '';
}

/**
 * Generate full EPUB manifest href from filename and media type
 * @param filename - Name of the file
 * @param mediaType - MIME type of the file
 * @returns Manifest href relative to OPF file (e.g., "Scripts/app.js")
 * @note This is for manifest hrefs, not file system paths
 */
export function generateEPUBPath(filename: string, mediaType: string): string {
  const directory = getDirectoryFromMediaType(mediaType);
  return directory + filename;
}

/**
 * Extract directory from existing EPUB path
 * @param path - Full EPUB path
 * @returns Directory portion with trailing slash
 */
export function extractDirectoryFromPath(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) return '';
  return path.substring(0, lastSlash + 1);
}

/**
 * Validate if a path follows EPUB directory conventions
 * @param path - Full EPUB path to validate
 * @param mediaType - Expected media type
 * @returns True if path is in correct directory for media type
 */
export function validateEPUBPath(path: string, mediaType: string): boolean {
  const expectedDirectory = getDirectoryFromMediaType(mediaType);
  return path.startsWith(expectedDirectory);
}

export class MetadataUtils {
  /**
   * Safely get an array field from metadata
   */
  static getArrayField<T extends ArrayMetadataFields>(metadata: EPUBMetadata, field: T): string[] {
    const value = metadata[field];
    return Array.isArray(value) ? value : [];
  }

  /**
   * Safely get a string field from metadata
   */
  static getStringField<T extends StringMetadataFields>(
    metadata: EPUBMetadata,
    field: T
  ): string | undefined {
    const value = metadata[field];
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * Safely get a required string field from metadata
   */
  static getRequiredStringField<T extends RequiredMetadataFields>(
    metadata: EPUBMetadata,
    field: T
  ): string {
    const value = metadata[field];
    return typeof value === 'string' ? value : '';
  }

  /**
   * Type guard to check if a field is an array field
   */
  static isArrayField(field: string): field is ArrayMetadataFields {
    return [
      'creator',
      'contributor',
      'subject',
      'accessMode',
      'accessModeSufficient',
      'accessibilityFeature',
      'accessibilityHazard',
    ].includes(field);
  }

  /**
   * Type guard to check if a field is a string field
   */
  static isStringField(field: string): field is StringMetadataFields {
    return [
      'title',
      'language',
      'identifier',
      'publisher',
      'date',
      'description',
      'rights',
      'source',
      'relation',
      'coverage',
      'type',
      'format',
      'modifiedDate',
      'epubVersion',
      'renditionLayout',
      'pageProgressionDirection',
      'renditionOrientation',
      'renditionSpread',
      'accessibilitySummary',
    ].includes(field);
  }

  /**
   * Safely update an array field in metadata
   */
  static updateArrayField<T extends ArrayMetadataFields>(
    metadata: EPUBMetadata,
    field: T,
    updater: (current: string[]) => string[]
  ): EPUBMetadata {
    const currentArray = MetadataUtils.getArrayField(metadata, field);
    const newArray = updater(currentArray);
    return {
      ...metadata,
      [field]: newArray,
    };
  }

  /**
   * Safely update a string field in metadata
   */
  static updateStringField<T extends StringMetadataFields>(
    metadata: EPUBMetadata,
    field: T,
    value: string | undefined
  ): EPUBMetadata {
    return {
      ...metadata,
      [field]: value,
    };
  }
}
