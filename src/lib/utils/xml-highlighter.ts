/**
 * XML Highlighter Utility
 * 
 * Provides syntax highlighting for EPUB content.opf XML with focus on metadata fields.
 * Highlights metadata values and corresponding XML elements based on field focus state.
 */

import type { EPUBMetadata } from '../epub/opf-utils.js';

interface MetadataFieldMapping {
  field: keyof EPUBMetadata;
  xmlPattern: 'dublin-core' | 'meta-property';
  selector: string;
  displayName: string;
  isArray?: boolean;
}

const METADATA_MAPPINGS: MetadataFieldMapping[] = [
  // Required Dublin Core
  { field: 'title', xmlPattern: 'dublin-core', selector: 'dc:title', displayName: 'Title' },
  { field: 'language', xmlPattern: 'dublin-core', selector: 'dc:language', displayName: 'Language' },
  { field: 'identifier', xmlPattern: 'dublin-core', selector: 'dc:identifier', displayName: 'Identifier' },
  
  // Optional Dublin Core - Strings
  { field: 'publisher', xmlPattern: 'dublin-core', selector: 'dc:publisher', displayName: 'Publisher' },
  { field: 'date', xmlPattern: 'dublin-core', selector: 'dc:date', displayName: 'Date' },
  { field: 'description', xmlPattern: 'dublin-core', selector: 'dc:description', displayName: 'Description' },
  { field: 'rights', xmlPattern: 'dublin-core', selector: 'dc:rights', displayName: 'Rights' },
  { field: 'source', xmlPattern: 'dublin-core', selector: 'dc:source', displayName: 'Source' },
  { field: 'relation', xmlPattern: 'dublin-core', selector: 'dc:relation', displayName: 'Relation' },
  { field: 'coverage', xmlPattern: 'dublin-core', selector: 'dc:coverage', displayName: 'Coverage' },
  { field: 'type', xmlPattern: 'dublin-core', selector: 'dc:type', displayName: 'Type' },
  { field: 'format', xmlPattern: 'dublin-core', selector: 'dc:format', displayName: 'Format' },
  
  // Optional Dublin Core - Arrays
  { field: 'creator', xmlPattern: 'dublin-core', selector: 'dc:creator', displayName: 'Creator', isArray: true },
  { field: 'contributor', xmlPattern: 'dublin-core', selector: 'dc:contributor', displayName: 'Contributor', isArray: true },
  { field: 'subject', xmlPattern: 'dublin-core', selector: 'dc:subject', displayName: 'Subject', isArray: true },
  
  // EPUB 3 Meta Properties
  { field: 'renditionLayout', xmlPattern: 'meta-property', selector: 'meta[property="rendition:layout"]', displayName: 'Layout' },
  { field: 'renditionOrientation', xmlPattern: 'meta-property', selector: 'meta[property="rendition:orientation"]', displayName: 'Orientation' },
  { field: 'renditionSpread', xmlPattern: 'meta-property', selector: 'meta[property="rendition:spread"]', displayName: 'Spread' },
  // Note: pageProgressionDirection is handled as an attribute on spine element - skip for now
];

export interface HighlightingOptions {
  focusedField?: keyof EPUBMetadata | null;
  highlightValues?: boolean;
  highlightTags?: boolean;
  pageProgressionDirection?: string;
}

export interface HighlightResult {
  highlightedXML: string;
  fieldMappings: MetadataFieldMapping[];
}

/**
 * XML Highlighter for EPUB OPF content
 */
export class XMLHighlighter {
  private mappings: MetadataFieldMapping[];

  constructor() {
    this.mappings = METADATA_MAPPINGS;
  }

  /**
   * Highlight XML content with metadata field highlighting
   */
  highlightOPFContent(xmlContent: string, options: HighlightingOptions = {}): HighlightResult {
    const { focusedField, highlightValues = true, highlightTags = true, pageProgressionDirection } = options;

    try {
      // Format XML first, then escape and highlight
      const formattedXML = this.formatXML(xmlContent);
      let highlightedXML = this.escapeHTML(formattedXML);

      // Apply regex-based highlighting for each field mapping
      for (const mapping of this.mappings) {
        const isFocused = focusedField === mapping.field;
        highlightedXML = this.highlightFieldInXML(highlightedXML, mapping, isFocused, highlightValues, highlightTags);
      }

      // Apply structural element de-emphasis
      highlightedXML = this.addStructuralHighlighting(highlightedXML, pageProgressionDirection);

      return {
        highlightedXML: highlightedXML.trim(),
        fieldMappings: this.mappings
      };

    } catch (error) {
      console.warn('XML highlighting failed:', error);
      // Fallback to escaped original content
      return {
        highlightedXML: this.escapeHTML(xmlContent),
        fieldMappings: this.mappings
      };
    }
  }

  /**
   * Highlight a specific field in XML using regex patterns
   */
  private highlightFieldInXML(
    xml: string, 
    mapping: MetadataFieldMapping, 
    isFocused: boolean, 
    highlightValues: boolean, 
    highlightTags: boolean
  ): string {
    if (mapping.xmlPattern === 'dublin-core') {
      return this.highlightDublinCoreField(xml, mapping, isFocused, highlightValues, highlightTags);
    } else {
      return this.highlightMetaPropertyField(xml, mapping, isFocused, highlightValues, highlightTags);
    }
  }

  /**
   * Highlight Dublin Core fields like <dc:title>content</dc:title>
   */
  private highlightDublinCoreField(
    xml: string, 
    mapping: MetadataFieldMapping, 
    isFocused: boolean, 
    highlightValues: boolean, 
    highlightTags: boolean
  ): string {
    // Extract element name from selector (dc:title -> title)
    const elementName = mapping.selector.replace('dc:', '');
    
    // Pattern to match <dc:elementName [attributes]>content</dc:elementName>
    // Use [^<]* to match everything up to the next < character
    const pattern = new RegExp(`(&lt;dc:${elementName}[^<]*?&gt;)(.*?)(&lt;/dc:${elementName}&gt;)`, 'gi');
    
    return xml.replace(pattern, (match, openTag, content, closeTag) => {
      let result = '';
      
      // Highlight opening and closing tags if requested
      if (highlightTags) {
        const tagClass = isFocused ? 'metadata-tag-focused' : 'metadata-tag';
        result += `<span class="${tagClass}">${openTag}</span>`;
      } else {
        result += openTag;
      }
      
      // Highlight content/value if requested and not empty
      if (highlightValues && content.trim()) {
        const valueClass = isFocused ? 'metadata-value-focused' : 'metadata-value';
        result += `<span class="${valueClass}">${content}</span>`;
      } else {
        result += content;
      }
      
      // Highlight closing tag if requested
      if (highlightTags) {
        const tagClass = isFocused ? 'metadata-tag-focused' : 'metadata-tag';
        result += `<span class="${tagClass}">${closeTag}</span>`;
      } else {
        result += closeTag;
      }
      
      return result;
    });
  }

  /**
   * Highlight meta property fields like <meta property="dcterms:modified">content</meta>
   */
  private highlightMetaPropertyField(
    xml: string, 
    mapping: MetadataFieldMapping, 
    isFocused: boolean, 
    highlightValues: boolean, 
    highlightTags: boolean
  ): string {
    // Extract property value from selector
    const propertyMatch = mapping.selector.match(/property="([^"]+)"/);
    if (!propertyMatch) return xml;
    
    const propertyValue = propertyMatch[1];
    
    // Pattern to match <meta property="propertyValue">content</meta>
    const pattern = new RegExp(`(&lt;meta[^&]*?property=&quot;${propertyValue.replace(':', '\\:')}&quot;[^&]*?&gt;)(.*?)(&lt;/meta&gt;)`, 'gi');
    
    return xml.replace(pattern, (match, openTag, content, closeTag) => {
      let result = '';
      
      // Highlight opening and closing tags if requested
      if (highlightTags) {
        const tagClass = isFocused ? 'metadata-tag-focused' : 'metadata-tag';
        result += `<span class="${tagClass}">${openTag}</span>`;
      } else {
        result += openTag;
      }
      
      // Highlight content/value if requested and not empty
      if (highlightValues && content.trim()) {
        const valueClass = isFocused ? 'metadata-value-focused' : 'metadata-value';
        result += `<span class="${valueClass}">${content}</span>`;
      } else {
        result += content;
      }
      
      // Highlight closing tag if requested
      if (highlightTags) {
        const tagClass = isFocused ? 'metadata-tag-focused' : 'metadata-tag';
        result += `<span class="${tagClass}">${closeTag}</span>`;
      } else {
        result += closeTag;
      }
      
      return result;
    });
  }

  /**
   * Format XML for display (called before highlighting)
   */
  private formatXML(xml: string): string {
    // Remove XML declaration if present for cleaner display
    const cleanXML = xml.replace(/^<\?xml[^>]+\?>[\s\n]*/, '');
    
    // Basic indentation improvement
    return cleanXML
      .replace(/></g, '>\n<')
      .replace(/^\s*\n/gm, '')
      .trim();
  }

  /**
   * Escape HTML characters for safe display
   */
  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Add structural element highlighting for de-emphasis
   */
  private addStructuralHighlighting(xml: string, pageProgressionDirection?: string): string {
    let highlightedXML = xml;

    // De-emphasize package element (opening and closing tags)
    highlightedXML = highlightedXML.replace(
      /(&lt;package[^>]*?&gt;)/g,
      '<span class="structural-element">$1</span>'
    );
    highlightedXML = highlightedXML.replace(
      /(&lt;\/package&gt;)/g,
      '<span class="structural-element">$1</span>'
    );

    // De-emphasize entire manifest section
    highlightedXML = highlightedXML.replace(
      /(&lt;manifest&gt;[\s\S]*?&lt;\/manifest&gt;)/g,
      '<span class="structural-element">$1</span>'
    );

    // Conditionally de-emphasize spine section based on page progression
    const hasNonDefaultProgression = pageProgressionDirection && 
      pageProgressionDirection !== 'default' && 
      pageProgressionDirection !== '';
    
    if (!hasNonDefaultProgression) {
      highlightedXML = highlightedXML.replace(
        /(&lt;spine&gt;[\s\S]*?&lt;\/spine&gt;)/g,
        '<span class="structural-element">$1</span>'
      );
    }

    return highlightedXML;
  }

  /**
   * Get field mapping by field name
   */
  getFieldMapping(field: keyof EPUBMetadata): MetadataFieldMapping | undefined {
    return this.mappings.find(m => m.field === field);
  }

  /**
   * Get all available field mappings
   */
  getAllFieldMappings(): MetadataFieldMapping[] {
    return [...this.mappings];
  }
}

/**
 * Default instance for easy importing
 */
export const xmlHighlighter = new XMLHighlighter();