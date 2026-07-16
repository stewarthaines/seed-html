/**
 * OPF and EPUB XML Utilities
 *
 * Shared utilities for parsing and generating EPUB content.opf files and related XML.
 * Extracted from EPUBPackager and EPUBUnpacker for reuse by WorkspaceManager.
 */

/// <reference lib="dom" />

import { isRtlLanguage } from './language-direction.js';

// Injected at build time from package.json (vite define); see vite.config.ts.
declare const __VERSION__: string;

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
 * Default template for the packaged .epub filename. Supports the placeholders
 * `<title>`, `<author>` (first creator) and `<date>` (dc:date → YYYY-MM-DD,
 * falling back to the packaging date). Stored per-EPUB in SOURCE/settings.json.
 *
 * Hyphen-joined with no spaces: the packaged file's name becomes a URL path
 * segment when published to a remote, and space-free names survive OPDS
 * clients that mis-handle percent-encoding (token values are slugged the same
 * way — see EPUBPackager.sanitizeFilename).
 */
export const DEFAULT_FILENAME_TEMPLATE = '<title>-<author>-<date>';

/**
 * A creator or contributor with optional MARC relator roles.
 * `id` is the OPF id used by role refinements (`<meta refines="#id">`); it is
 * read on parse and re-minted on generate.
 */
export interface Creator {
  name: string;
  roles: string[];
  /** file-as (sort form), e.g. "Tolkien, J. R. R." */
  fileAs?: string;
  id?: string;
}

/** EPUB title-type vocabulary (refines a dc:title). */
export type TitleType = 'main' | 'subtitle' | 'short' | 'collection' | 'edition' | 'expanded';

/**
 * A dc:title beyond the primary one (subtitle, collection, edition, …). The
 * primary title stays on EPUBMetadata.title as a plain string; these carry the
 * title-type and file-as refinements the spec allows.
 */
export interface TitleEntry {
  value: string;
  type?: TitleType;
  fileAs?: string;
  id?: string;
}

/**
 * A dc:identifier beyond the package's unique identifier (which stays on
 * EPUBMetadata.identifier). `type` is an ONIX Code List 5 product-identifier
 * code, e.g. "15" for ISBN-13.
 */
export interface IdentifierEntry {
  value: string;
  type?: string;
  id?: string;
}

/**
 * A dc:subject. `authority` names a subject scheme (e.g. "BISAC", "thema") and
 * `term` is the code within it; per the spec the two must appear together. A
 * plain keyword subject has neither.
 */
export interface SubjectEntry {
  value: string;
  authority?: string;
  term?: string;
}

/**
 * A collection this publication belongs to (belongs-to-collection). `type` is
 * the collection-type (typically "series" or "set") and `position` is the
 * group-position within that collection.
 */
export interface CollectionEntry {
  name: string;
  type?: string;
  position?: string;
  id?: string;
}

/** Normalize a creator value, tolerating legacy bare-string data. */
export function toCreator(value: Creator | string): Creator {
  if (typeof value === 'string') return { name: value, roles: [] };
  return { name: value.name, roles: value.roles ?? [], fileAs: value.fileAs, id: value.id };
}

/** Normalize a list of creator values (tolerating legacy strings). */
export function normalizeCreators(list?: (Creator | string)[]): Creator[] {
  return (list ?? []).map(toCreator);
}

/** Normalize a subject value, tolerating legacy bare-string data. */
export function toSubject(value: string | SubjectEntry): SubjectEntry {
  return typeof value === 'string' ? { value } : value;
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
  refinesLookup: (id: string) => string[],
  fileAsLookup?: (id: string) => string | undefined
): Creator[] {
  return Array.from(elements)
    .map(el => {
      const name = el.textContent?.trim() ?? '';
      const id = el.getAttribute('id') || undefined;
      const roles = id ? refinesLookup(id) : [];
      const fileAs = id ? fileAsLookup?.(id) : undefined;
      return { name, roles, fileAs: fileAs || undefined, id };
    })
    .filter(c => c.name.length > 0);
}

// The two OPF <meta> syntaxes a custom entry can use: EPUB 3
// `<meta property="k">v</meta>` or EPUB 2 `<meta name="k" content="v"/>`.
export type CustomMetaSyntax = 'property' | 'name';

/** One standalone <metadata> meta element the app has no first-class field for. */
export interface CustomMetaEntry {
  syntax: CustomMetaSyntax;
  key: string; // e.g. "calibre:series", "ibooks:specified-fonts", "cover"
  value: string;
}

export interface EPUBMetadata {
  // Required Dublin Core elements
  title: string; // primary (main) title
  // file-as (sort form) refinement for the primary title
  titleFileAs?: string;
  // Additional titles beyond the primary one (subtitle, collection, edition, …)
  additionalTitles?: TitleEntry[];
  language: string[]; // BCP 47 tags; at least one required
  identifier: string; // the package unique identifier
  // ONIX Code List 5 type for the unique identifier (e.g. "15" = ISBN-13)
  identifierType?: string;
  // Additional identifiers beyond the unique one (e.g. an ISBN alongside a UUID)
  additionalIdentifiers?: IdentifierEntry[];

  // Optional Dublin Core elements
  creator?: Creator[];
  contributor?: Creator[];
  publisher?: string;
  date?: string;
  description?: string;
  subject?: (string | SubjectEntry)[];
  rights?: string;
  source?: string;
  relation?: string;
  coverage?: string;
  type?: string;
  format?: string;
  // Collections this publication belongs to (belongs-to-collection)
  collections?: CollectionEntry[];

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
  // Reflowable flow behaviour (rendition:flow): auto | paginated |
  // scrolled-continuous | scrolled-doc.
  renditionFlow?: string;

  // EPUB 3 accessibility metadata (Schema.org + EPUB Accessibility 1.1)
  accessMode?: string[];
  accessModeSufficient?: string[]; // each value is a comma-separated set
  accessibilityFeature?: string[];
  accessibilityHazard?: string[];
  accessibilityControl?: string[];
  accessibilityAPI?: string[];
  accessibilitySummary?: string;
  // dcterms:conformsTo, e.g. "EPUB Accessibility 1.1 - WCAG 2.1 Level AA"
  accessibilityConformance?: string;
  // EPUB Accessibility 1.1 certification (a11y: vocabulary)
  accessibilityCertifiedBy?: string;
  accessibilityCertifierCredential?: string;
  accessibilityCertifierReport?: string; // URL; emitted as <link rel>

  // Standalone <meta> elements with no first-class field above, preserved in
  // document order across saves (the serializer rebuilds <metadata> from this
  // model, so anything not captured here would be silently dropped).
  customMeta?: CustomMetaEntry[];
  // prefix → URI declarations (from package@prefix) that customMeta keys need.
  customMetaPrefixes?: Record<string, string>;
}

// Type mapping for strict field access
export interface MetadataFieldTypes {
  // Creator fields (name + roles)
  creator: Creator[];
  contributor: Creator[];
  // Array fields
  language: string[];
  subject: (string | SubjectEntry)[];
  accessMode: string[];
  accessModeSufficient: string[];
  accessibilityFeature: string[];
  accessibilityHazard: string[];
  accessibilityControl: string[];
  accessibilityAPI: string[];

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
  renditionFlow: string;
  accessibilitySummary: string;
  accessibilityConformance: string;
  accessibilityCertifiedBy: string;
  accessibilityCertifierCredential: string;
  accessibilityCertifierReport: string;
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

// Meta properties the parser maps to first-class EPUBMetadata fields (and the
// generator re-emits itself). Anything else is captured into customMeta.
export const KNOWN_META_PROPERTIES: ReadonlySet<string> = new Set([
  'dcterms:modified',
  'rendition:layout',
  'rendition:orientation',
  'rendition:spread',
  'rendition:viewport',
  'rendition:flow',
  'belongs-to-collection',
  'schema:accessMode',
  'schema:accessModeSufficient',
  'schema:accessibilityFeature',
  'schema:accessibilityHazard',
  'schema:accessibilityControl',
  'schema:accessibilityAPI',
  'schema:accessibilitySummary',
  'dcterms:conformsTo',
  'a11y:certifiedBy',
  'a11y:certifierCredential',
]);

// EPUB 2 meta names the generator owns (derived values, regenerated on every
// serialize). Anything else is captured into customMeta.
export const KNOWN_META_NAMES: ReadonlySet<string> = new Set(['generator']);

// Prefixes usable in package metadata without a declaration (EPUB 3.3 reserved
// set, plus the legacy msv/prism entries epubcheck still accepts). ibooks and
// rendition are included because the generated package always declares them.
export const RESERVED_PREFIXES: ReadonlySet<string> = new Set([
  'a11y',
  'dcterms',
  'ibooks',
  'marc',
  'media',
  'msv',
  'onix',
  'prism',
  'rendition',
  'schema',
]);

/**
 * Parse a package `prefix` attribute ("foo: http://x# bar: http://y#") into a
 * prefix → URI map. Malformed pairs (no whitespace after the colon) are skipped.
 */
export function parsePrefixAttribute(attr: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!attr) return result;
  const pair = /(\S+):\s+(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pair.exec(attr)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}

/** Format a prefix → URI map back into package `prefix` attribute syntax. */
export function formatPrefixAttribute(prefixes: Record<string, string>): string {
  return Object.entries(prefixes)
    .map(([prefix, uri]) => `${prefix}: ${uri}`)
    .join(' ');
}

/** The value of the first customMeta entry matching key + syntax, if any. */
export function getCustomMetaValue(
  list: CustomMetaEntry[] | undefined,
  key: string,
  syntax: CustomMetaSyntax
): string | undefined {
  return list?.find(e => e.syntax === syntax && e.key === key)?.value;
}

/**
 * Set (or, with an empty value, remove) the first customMeta entry matching
 * key + syntax, returning a new list. Duplicate keys beyond the first are
 * preserved untouched — the app edits one value, never collapses duplicates.
 */
export function setCustomMetaValue(
  list: CustomMetaEntry[] | undefined,
  key: string,
  syntax: CustomMetaSyntax,
  value: string
): CustomMetaEntry[] {
  const entries = list ? [...list] : [];
  const index = entries.findIndex(e => e.syntax === syntax && e.key === key);
  const trimmed = value.trim();
  if (!trimmed) {
    if (index !== -1) entries.splice(index, 1);
    return entries;
  }
  if (index === -1) {
    entries.push({ syntax, key, value: trimmed });
  } else {
    entries[index] = { ...entries[index], value: trimmed };
  }
  return entries;
}

/**
 * Capture every standalone (non-refining) <meta> that has no first-class
 * EPUBMetadata field — in document order — plus the package@prefix
 * declarations its property keys need (reserved prefixes are never stored).
 * parseOPFMetadata folds the result into its return value; exported separately
 * so the capture logic is unit-testable without namespaced dc:* fixtures
 * (which happy-dom cannot parse).
 */
export function extractCustomMeta(doc: Document): {
  customMeta?: CustomMetaEntry[];
  customMetaPrefixes?: Record<string, string>;
} {
  const customMeta: CustomMetaEntry[] = [];
  doc.querySelectorAll('metadata > meta').forEach(meta => {
    if (meta.getAttribute('refines')) return;
    const property = meta.getAttribute('property');
    if (property) {
      if (KNOWN_META_PROPERTIES.has(property)) return;
      const value = meta.textContent?.trim();
      if (value) customMeta.push({ syntax: 'property', key: property, value });
      return;
    }
    const name = meta.getAttribute('name');
    if (name && !KNOWN_META_NAMES.has(name)) {
      const content = meta.getAttribute('content')?.trim();
      if (content) customMeta.push({ syntax: 'name', key: name, value: content });
    }
  });

  const declaredPrefixes = parsePrefixAttribute(
    doc.querySelector('package')?.getAttribute('prefix') ?? null
  );
  const customMetaPrefixes: Record<string, string> = {};
  for (const entry of customMeta) {
    if (entry.syntax !== 'property' || !entry.key.includes(':')) continue;
    const prefix = entry.key.split(':')[0];
    if (RESERVED_PREFIXES.has(prefix) || !declaredPrefixes[prefix]) continue;
    customMetaPrefixes[prefix] = declaredPrefixes[prefix];
  }

  return {
    customMeta: customMeta.length > 0 ? customMeta : undefined,
    customMetaPrefixes: Object.keys(customMetaPrefixes).length > 0 ? customMetaPrefixes : undefined,
  };
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

    // Build a general refines index (id -> list of {property, value}) from every
    // `<meta refines>` element, then read specific refinements off it by id.
    const refinementsById = new Map<string, { property: string; value: string }[]>();
    doc.querySelectorAll('meta[refines]').forEach(meta => {
      const refines = meta.getAttribute('refines');
      const property = meta.getAttribute('property');
      const value = meta.textContent?.trim();
      if (!refines || !property || !value) return;
      const id = refines.replace(/^#/, '');
      const existing = refinementsById.get(id) ?? [];
      existing.push({ property, value });
      refinementsById.set(id, existing);
    });
    const refineValue = (id: string | null | undefined, property: string): string | undefined =>
      id ? refinementsById.get(id)?.find(r => r.property === property)?.value : undefined;
    const roleLookup = (id: string) =>
      (refinementsById.get(id) ?? []).filter(r => r.property === 'role').map(r => r.value);

    // Parse all dc:title elements, separating the primary (title-type="main", or
    // the first when none is typed) from any additional titles.
    const parsedTitles = Array.from(titleElements)
      .map(el => {
        const id = el.getAttribute('id');
        return {
          value: el.textContent?.trim() ?? '',
          type: refineValue(id, 'title-type') as TitleType | undefined,
          fileAs: refineValue(id, 'file-as'),
        };
      })
      .filter(t => t.value);
    const mainTitleIndex = Math.max(
      0,
      parsedTitles.findIndex(t => t.type === 'main')
    );
    const primaryTitle = parsedTitles[mainTitleIndex] ?? { value: '', fileAs: undefined };
    const extraTitles: TitleEntry[] = parsedTitles
      .filter((_, i) => i !== mainTitleIndex)
      .map(t => ({ value: t.value, type: t.type, fileAs: t.fileAs }));

    // The primary identifier is the one referenced by package@unique-identifier
    // (falling back to the first); any others are additional identifiers.
    const uniqueIdRef = doc.querySelector('package')?.getAttribute('unique-identifier');
    const identifierEls = Array.from(identifierElements);
    const primaryIdIndex = Math.max(
      0,
      identifierEls.findIndex(el => el.getAttribute('id') === uniqueIdRef)
    );
    const primaryIdEl = identifierEls[primaryIdIndex];
    const extraIdentifiers: IdentifierEntry[] = identifierEls
      .filter((_, i) => i !== primaryIdIndex)
      .map(el => ({
        value: el.textContent?.trim() ?? '',
        type: refineValue(el.getAttribute('id'), 'identifier-type'),
      }))
      .filter(e => e.value);

    const fileAsLookup = (id: string) => refineValue(id, 'file-as');
    const creators = parseCreatorList(creatorElements, roleLookup, fileAsLookup);
    const contributors = parseCreatorList(contributorElements, roleLookup, fileAsLookup);
    const subjects: SubjectEntry[] = Array.from(subjectElements)
      .map(el => {
        const id = el.getAttribute('id');
        return {
          value: el.textContent?.trim() ?? '',
          authority: refineValue(id, 'authority'),
          term: refineValue(id, 'term'),
        };
      })
      .filter(s => s.value);

    // Parse rendition properties
    const layoutMeta = doc.querySelector('meta[property="rendition:layout"]');
    const orientationMeta = doc.querySelector('meta[property="rendition:orientation"]');
    const spreadMeta = doc.querySelector('meta[property="rendition:spread"]');
    const viewportMeta = doc.querySelector('meta[property="rendition:viewport"]');
    const flowMeta = doc.querySelector('meta[property="rendition:flow"]');

    // Parse spine page-progression-direction
    const spineElement = doc.querySelector('spine');
    const pageProgression = spineElement?.getAttribute('page-progression-direction');

    // Accessibility metadata (Schema.org + EPUB Accessibility 1.1).
    const a11yValues = (property: string) =>
      Array.from(doc.querySelectorAll(`meta[property="${property}"]`))
        .map(el => el.textContent?.trim())
        .filter(Boolean) as string[];
    const a11yValue = (property: string) => a11yValues(property)[0];
    const accessMode = a11yValues('schema:accessMode');
    const accessModeSufficient = a11yValues('schema:accessModeSufficient');
    const accessibilityFeature = a11yValues('schema:accessibilityFeature');
    const accessibilityHazard = a11yValues('schema:accessibilityHazard');
    const accessibilityControl = a11yValues('schema:accessibilityControl');
    const accessibilityAPI = a11yValues('schema:accessibilityAPI');
    const certifierReport = doc
      .querySelector('link[rel="a11y:certifierReport"]')
      ?.getAttribute('href')
      ?.trim();

    const collections: CollectionEntry[] = Array.from(
      doc.querySelectorAll('meta[property="belongs-to-collection"]')
    )
      .map(el => {
        const id = el.getAttribute('id');
        return {
          name: el.textContent?.trim() ?? '',
          type: refineValue(id, 'collection-type'),
          position: refineValue(id, 'group-position'),
        };
      })
      .filter(c => c.name);

    // Standalone metas with no first-class field, preserved for round-trip.
    const custom = extractCustomMeta(doc);

    return {
      title: primaryTitle.value || titleElements[0].textContent!.trim(),
      titleFileAs: primaryTitle.fileAs || undefined,
      additionalTitles: extraTitles.length > 0 ? extraTitles : undefined,
      language: Array.from(languageElements)
        .map(el => el.textContent?.trim())
        .filter(Boolean) as string[],
      identifier: (primaryIdEl ?? identifierElements[0]).textContent!.trim(),
      identifierType: refineValue(primaryIdEl?.getAttribute('id'), 'identifier-type') || undefined,
      additionalIdentifiers: extraIdentifiers.length > 0 ? extraIdentifiers : undefined,
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
      collections: collections.length > 0 ? collections : undefined,
      modifiedDate:
        modifiedElements.length > 0 ? modifiedElements[0].textContent?.trim() : undefined,
      renditionLayout: layoutMeta?.textContent?.trim() || undefined,
      renditionOrientation: orientationMeta?.textContent?.trim() || undefined,
      renditionSpread: spreadMeta?.textContent?.trim() || undefined,
      renditionViewport: viewportMeta?.textContent?.trim() || undefined,
      renditionFlow: flowMeta?.textContent?.trim() || undefined,
      pageProgressionDirection: pageProgression || undefined,
      accessMode: accessMode.length > 0 ? accessMode : undefined,
      accessModeSufficient: accessModeSufficient.length > 0 ? accessModeSufficient : undefined,
      accessibilityFeature: accessibilityFeature.length > 0 ? accessibilityFeature : undefined,
      accessibilityHazard: accessibilityHazard.length > 0 ? accessibilityHazard : undefined,
      accessibilityControl: accessibilityControl.length > 0 ? accessibilityControl : undefined,
      accessibilityAPI: accessibilityAPI.length > 0 ? accessibilityAPI : undefined,
      accessibilitySummary: a11yValue('schema:accessibilitySummary'),
      accessibilityConformance: a11yValue('dcterms:conformsTo'),
      accessibilityCertifiedBy: a11yValue('a11y:certifiedBy'),
      accessibilityCertifierCredential: a11yValue('a11y:certifierCredential'),
      accessibilityCertifierReport: certifierReport,
      customMeta: custom.customMeta,
      customMetaPrefixes: custom.customMetaPrefixes,
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

    // Right-to-left books: mark the package's base direction (affects metadata
    // display) and default the spine's page progression to rtl below.
    const bookIsRtl = isRtlLanguage(languageTags[0]);

    // A single `<meta refines>` line. The shared shape behind every property
    // refinement we emit (title-type, file-as, role, …).
    const refinementMeta = (id: string, property: string, value: string, scheme?: string) =>
      `\n    <meta refines="#${id}" property="${property}"${scheme ? ` scheme="${scheme}"` : ''}>${escapeXML(value)}</meta>`;

    // Build the title block: the primary title plus any additional titles. A
    // title only gets an id + refinements when it needs them (a title-type or
    // file-as); the primary is marked title-type="main" only when other titles
    // are present, so a lone simple title stays `<dc:title>X</dc:title>`.
    const additionalTitles = metadata.additionalTitles?.filter(t => t.value?.trim()) ?? [];
    const titleEntries: { value: string; type?: string; fileAs?: string }[] = [
      {
        value: metadata.title,
        type: additionalTitles.length > 0 ? 'main' : undefined,
        fileAs: metadata.titleFileAs,
      },
      ...additionalTitles.map(t => ({ value: t.value, type: t.type, fileAs: t.fileAs })),
    ];
    let titleIdCounter = 0;
    const titleLines: string[] = [];
    titleEntries
      .filter(t => t.value?.trim())
      .forEach(t => {
        if (!t.type && !t.fileAs) {
          titleLines.push(`<dc:title>${escapeXML(t.value)}</dc:title>`);
          return;
        }
        const id = `title${++titleIdCounter}`;
        titleLines.push(`<dc:title id="${id}">${escapeXML(t.value)}</dc:title>`);
        if (t.type) titleLines.push(refinementMeta(id, 'title-type', t.type).trimStart());
        if (t.fileAs) titleLines.push(refinementMeta(id, 'file-as', t.fileAs).trimStart());
      });
    const titleXML = titleLines.join('\n    ');

    // Base prefix declarations are fixed; declarations captured for customMeta
    // keys are appended (reserved prefixes never need declaring).
    let prefixAttr =
      'rendition: http://www.idpf.org/vocab/rendition/# ibooks: http://vocabulary.itunes.apple.com/rdf/ibooks/vocabulary-extensions-1.0/';
    const extraPrefixes = Object.fromEntries(
      Object.entries(metadata.customMetaPrefixes ?? {}).filter(
        ([prefix]) => !RESERVED_PREFIXES.has(prefix)
      )
    );
    if (Object.keys(extraPrefixes).length > 0) {
      prefixAttr += ` ${escapeXML(formatPrefixAttribute(extraPrefixes))}`;
    }

    let xml = `<?xml version="1.0" encoding="utf-8"?>
<package version="${version}" xmlns="http://www.idpf.org/2007/opf" unique-identifier="${uniqueId}" prefix="${prefixAttr}" xml:lang="en"${bookIsRtl ? ' dir="rtl"' : ''}>
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:ibooks="http://vocabulary.itunes.apple.com/rdf/ibooks/vocabularies/2012/01/ibooks-specific">
    ${titleXML}
    ${languageXML}
    <dc:identifier id="${uniqueId}">${escapeXML(metadata.identifier)}</dc:identifier>`;

    // Identifier-type for the unique identifier, then any additional identifiers
    // (e.g. an ISBN alongside the UUID), each with its own id + identifier-type.
    if (metadata.identifierType) {
      xml += refinementMeta(uniqueId, 'identifier-type', metadata.identifierType, 'onix:codelist5');
    }
    let identifierIdCounter = 0;
    for (const entry of metadata.additionalIdentifiers ?? []) {
      if (!entry.value?.trim()) continue;
      // Only mint an id when there is an identifier-type to refine; an untyped
      // identifier needs no id (mirrors the title generation above).
      if (!entry.type) {
        xml += `\n    <dc:identifier>${escapeXML(entry.value)}</dc:identifier>`;
        continue;
      }
      const id = `identifier${++identifierIdCounter}`;
      xml += `\n    <dc:identifier id="${id}">${escapeXML(entry.value)}</dc:identifier>`;
      xml += refinementMeta(id, 'identifier-type', entry.type, 'onix:codelist5');
    }

    // Add optional metadata. Creators/contributors emit an id plus a
    // `<meta refines property="role">` per MARC relator role (EPUB 3).
    let creatorIdCounter = 0;
    const emitCreator = (value: Creator | string, tag: 'dc:creator' | 'dc:contributor') => {
      const creator = toCreator(value);
      const id = `creator${++creatorIdCounter}`;
      xml += `\n    <${tag} id="${id}">${escapeXML(creator.name)}</${tag}>`;
      for (const role of creator.roles) {
        xml += refinementMeta(id, 'role', role, 'marc:relators');
      }
      if (creator.fileAs) {
        xml += refinementMeta(id, 'file-as', creator.fileAs);
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
      let subjectIdCounter = 0;
      metadata.subject.forEach(raw => {
        const subj = toSubject(raw);
        if (!subj.value?.trim()) return;
        // authority and term must appear together; only refine when both exist.
        const hasScheme = !!subj.authority?.trim() && !!subj.term?.trim();
        if (!hasScheme) {
          xml += `\n    <dc:subject>${escapeXML(subj.value)}</dc:subject>`;
          return;
        }
        const id = `subject${++subjectIdCounter}`;
        xml += `\n    <dc:subject id="${id}">${escapeXML(subj.value)}</dc:subject>`;
        xml += refinementMeta(id, 'authority', subj.authority!.trim());
        xml += refinementMeta(id, 'term', subj.term!.trim());
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

    // Collections (belongs-to-collection) with collection-type / group-position
    // refinements. Each named collection gets an id when present.
    let collectionIdCounter = 0;
    for (const collection of metadata.collections ?? []) {
      if (!collection.name?.trim()) continue;
      const id = `collection${++collectionIdCounter}`;
      xml += `\n    <meta property="belongs-to-collection" id="${id}">${escapeXML(collection.name.trim())}</meta>`;
      if (collection.type?.trim()) {
        xml += refinementMeta(id, 'collection-type', collection.type.trim());
      }
      if (collection.position?.trim()) {
        xml += refinementMeta(id, 'group-position', collection.position.trim());
      }
    }

    if (metadata.modifiedDate) {
      xml += `\n    <meta property="dcterms:modified">${escapeXML(metadata.modifiedDate)}</meta>`;
    }

    // Machine-readable record of the software that last wrote this file. Regenerated
    // on every serialize, so it always reflects the SEED version that last modified
    // the book (pairs with dcterms:modified). Distinct from the human-editable
    // "book producer" dc:contributor, which records the creating version.
    xml += `\n    <meta name="generator" content="${escapeXML(`SEED.html ${__VERSION__}`)}"/>`;

    // EPUB 2 legacy cover marker, alongside the manifest item's cover-image
    // property. Google Play Books (and older Kindle/library tooling) key on
    // this meta rather than the EPUB 3 property; legal optional metadata in
    // EPUB 3 and epubcheck-clean. An explicit customMeta value wins; the
    // derived value is only the default (emitted by the customMeta loop below
    // when explicit).
    const coverItem = manifest.find(item => item.properties?.includes('cover-image'));
    if (coverItem && !getCustomMetaValue(metadata.customMeta, 'cover', 'name')) {
      xml += `\n    <meta name="cover" content="${escapeXML(coverItem.id)}"/>`;
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

    // rendition:viewport only applies to fixed-layout content; a value left over
    // from a pre-paginated session must not be emitted once the layout is
    // reflowable (where it is inert and deprecated).
    if (metadata.renditionViewport && metadata.renditionLayout === 'pre-paginated') {
      xml += `\n    <meta property="rendition:viewport">${escapeXML(metadata.renditionViewport)}</meta>`;
    }

    if (metadata.renditionFlow && metadata.renditionFlow !== 'auto') {
      xml += `\n    <meta property="rendition:flow">${escapeXML(metadata.renditionFlow)}</meta>`;
    }

    // Accessibility metadata (Schema.org discovery + EPUB Accessibility 1.1).
    // Emit only what the author has declared — never fabricate conformance,
    // feature, or hazard claims. schema:/dcterms:/a11y: are reserved prefixes.
    const a11yMetas = (property: string, values?: string[]) => {
      for (const value of values ?? []) {
        if (value?.trim()) {
          xml += `\n    <meta property="${property}">${escapeXML(value.trim())}</meta>`;
        }
      }
    };
    a11yMetas('schema:accessMode', metadata.accessMode);
    a11yMetas('schema:accessModeSufficient', metadata.accessModeSufficient);
    a11yMetas('schema:accessibilityFeature', metadata.accessibilityFeature);
    a11yMetas('schema:accessibilityHazard', metadata.accessibilityHazard);
    a11yMetas('schema:accessibilityControl', metadata.accessibilityControl);
    a11yMetas('schema:accessibilityAPI', metadata.accessibilityAPI);
    if (metadata.accessibilitySummary?.trim()) {
      xml += `\n    <meta property="schema:accessibilitySummary">${escapeXML(metadata.accessibilitySummary.trim())}</meta>`;
    }
    if (metadata.accessibilityConformance?.trim()) {
      xml += `\n    <meta property="dcterms:conformsTo">${escapeXML(metadata.accessibilityConformance.trim())}</meta>`;
    }
    if (metadata.accessibilityCertifiedBy?.trim()) {
      xml += `\n    <meta property="a11y:certifiedBy">${escapeXML(metadata.accessibilityCertifiedBy.trim())}</meta>`;
    }
    if (metadata.accessibilityCertifierCredential?.trim()) {
      xml += `\n    <meta property="a11y:certifierCredential">${escapeXML(metadata.accessibilityCertifierCredential.trim())}</meta>`;
    }
    if (metadata.accessibilityCertifierReport?.trim()) {
      xml += `\n    <link rel="a11y:certifierReport" href="${escapeXML(metadata.accessibilityCertifierReport.trim())}"/>`;
    }

    // Custom metadata (captured at parse time or catalog-edited), re-emitted so
    // vendor metadata survives this from-scratch rebuild. Keys the generator
    // already writes itself are skipped to prevent double emission.
    for (const entry of metadata.customMeta ?? []) {
      const key = entry.key.trim();
      const value = entry.value.trim();
      if (!key || !value) continue;
      if (entry.syntax === 'property') {
        if (KNOWN_META_PROPERTIES.has(key)) continue;
        xml += `\n    <meta property="${escapeXML(key)}">${escapeXML(value)}</meta>`;
      } else {
        if (KNOWN_META_NAMES.has(key)) continue;
        xml += `\n    <meta name="${escapeXML(key)}" content="${escapeXML(value)}"/>`;
      }
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

    xml += `\n  </manifest>`;

    // Spine page-progression-direction: honour an explicit choice from Metadata;
    // otherwise default to rtl for right-to-left-language books (and omit it
    // entirely for ltr/unset, letting the reading system decide).
    const explicitPpd =
      metadata.pageProgressionDirection && metadata.pageProgressionDirection !== 'default'
        ? metadata.pageProgressionDirection
        : '';
    const pageProgression = explicitPpd || (bookIsRtl ? 'rtl' : '');
    if (pageProgression) {
      xml += `\n  <spine page-progression-direction="${escapeXML(pageProgression)}">`;
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

const EPUB_DIRECTORY_MAP: DirectoryMapping = {
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
  return directory + toEpubSafeFilename(filename);
}

/**
 * Make a single filename EPUB/OCF-safe. The OCF spec recommends restricting names
 * to `A-Za-z0-9-_.`; epubcheck warns on spaces (PKG-009/010) and non-ASCII chars
 * (PKG-012). This folds accents (café → cafe), replaces any other character with
 * `-`, trims, caps length, and lowercases the extension. Idempotent; falls back to
 * `asset` when the base would be empty.
 */
export function toEpubSafeFilename(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const hasExt = lastDot > 0; // leading-dot names have no extension
  const rawBase = hasExt ? name.slice(0, lastDot) : name;
  const rawExt = hasExt ? name.slice(lastDot + 1) : '';

  const base =
    rawBase
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics (NFKD decomposed above)
      .replace(/[^A-Za-z0-9_-]+/g, '-') // anything else → hyphen
      .replace(/-+/g, '-') // collapse
      .replace(/^[-.]+|[-.]+$/g, '') // trim leading/trailing - and .
      .slice(0, 80) || 'asset';

  const ext = rawExt
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '')
    .toLowerCase();

  return ext ? `${base}.${ext}` : base;
}

/**
 * Make an EPUB href/path safe segment-by-segment (cleans a full path typed into the
 * manifest editor while preserving its directory structure). Empty segments — e.g.
 * from `..` or stray slashes — are dropped, neutralising path traversal.
 */
export function toEpubSafeHref(path: string): string {
  return path
    .split('/')
    .filter(segment => segment !== '')
    .map(toEpubSafeFilename)
    .join('/');
}

/**
 * Return `href` unchanged if no existing href matches it case-insensitively (OCF
 * forbids paths differing only in case); otherwise insert `-1`, `-2`, … before the
 * extension until unique.
 */
export function ensureUniqueHref(href: string, existingHrefs: string[]): string {
  const taken = new Set(existingHrefs.map(h => h.toLowerCase()));
  if (!taken.has(href.toLowerCase())) return href;

  const slash = href.lastIndexOf('/');
  const dot = href.lastIndexOf('.');
  const hasExt = dot > slash + 1; // dot is inside the filename, not a leading dot
  const base = hasExt ? href.slice(0, dot) : href;
  const ext = hasExt ? href.slice(dot) : ''; // includes the leading dot

  let n = 1;
  while (taken.has(`${base}-${n}${ext}`.toLowerCase())) n += 1;
  return `${base}-${n}${ext}`;
}
