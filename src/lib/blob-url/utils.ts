/**
 * Blob URL Manager Utilities
 * 
 * Helper functions for URL classification, path resolution, and XHTML processing
 */

/**
 * Check if a URL is a relative resource path that should be processed
 */
export function isRelativeResourceURL(url: string): boolean {
  return !url.startsWith('http') && 
         !url.startsWith('data:') && 
         !url.startsWith('blob:') &&
         !url.startsWith('/') && // Absolute paths
         !url.startsWith('#') && // Fragment URLs
         !url.startsWith('mailto:') && // Email URLs
         url.trim().length > 0; // Non-empty
}

/**
 * Resolve manifest item href to full workspace path
 */
export function resolveManifestPath(href: string, basePath: string): string {
  // Handle OPF in container root (empty basePath)
  if (!basePath) return href;
  
  // Standard case: basePath + href
  // Examples: "OEBPS" + "images/cover.jpg" → "OEBPS/images/cover.jpg"
  return `${basePath}/${href}`;
}

/**
 * Extract file extension from path
 */
export function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  const lastSlash = filePath.lastIndexOf('/');
  
  // No extension or dot is part of directory name
  if (lastDot === -1 || lastDot < lastSlash) {
    return '';
  }
  
  return filePath.substring(lastDot + 1).toLowerCase();
}

/**
 * Check if element is a visual asset that should get error icons
 */
export function isVisualAssetElement(tagName: string): boolean {
  return ['img', 'video', 'audio', 'object', 'image'].includes(tagName.toLowerCase());
}

/**
 * Check if element is a non-visual asset that preserves original URL on error
 */
export function isNonVisualAssetElement(tagName: string): boolean {
  return ['script', 'link'].includes(tagName.toLowerCase());
}

/**
 * Check if element is a navigation element that gets no special error handling
 */
export function isNavigationElement(tagName: string): boolean {
  return ['a'].includes(tagName.toLowerCase());
}

/**
 * Get the appropriate attribute name for an asset element
 */
export function getAssetAttribute(element: Element): string | null {
  if (element.hasAttribute('src')) return 'src';
  if (element.hasAttribute('href')) return 'href';
  if (element.hasAttribute('data')) return 'data';
  if (element.hasAttribute('poster')) return 'poster';
  if (element.hasAttribute('data-src')) return 'data-src';
  return null;
}

/**
 * Create error icon SVG data URL for missing images
 */
export function createErrorIconSVG(): string {
  const svg = `
    <svg width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#f44336" stroke="#d32f2f"/>
      <text x="12" y="16" text-anchor="middle" fill="white" font-size="12">!</text>
    </svg>
  `;
  
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Asset element selectors for XHTML processing
 */
export const ASSET_SELECTORS = [
  'script[src]',         // JavaScript files
  'link[href]',          // Stylesheets, icons
  'a[href]',             // Navigation links
  'audio[src]',          // Audio files
  'video[src]',          // Video files
  'video[poster]',       // Video poster images
  'img[src]',            // Images
  'object[data]',        // Embedded objects
  'image[href]',         // SVG image elements
  '*[data-src]'          // Custom lazy-loading attributes
];

/**
 * Find all asset elements in a document
 */
export function findAssetElements(doc: Document): Element[] {
  const elements: Element[] = [];
  
  for (const selector of ASSET_SELECTORS) {
    const found = doc.querySelectorAll(selector);
    elements.push(...Array.from(found));
  }
  
  return elements;
}

/**
 * Parse XHTML content safely with error detection
 */
export function parseXHTML(xhtmlContent: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xhtmlContent, 'application/xhtml+xml');
  
  // Check for parsing errors
  const errorElement = doc.querySelector('parsererror');
  if (errorElement) {
    throw new Error('Invalid XHTML content: ' + errorElement.textContent);
  }
  
  return doc;
}

/**
 * Serialize document back to XHTML string
 */
export function serializeXHTML(doc: Document): string {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

/**
 * Validate XHTML content structure
 */
export function validateXHTML(xhtmlContent: string): { valid: boolean; error?: string } {
  try {
    parseXHTML(xhtmlContent);
    return { valid: true };
  } catch (_error) {
    return { 
      valid: false, 
      error: _error instanceof Error ? _error.message : 'Unknown parsing error'
    };
  }
}

/**
 * Extract all asset references from XHTML without processing
 */
export function extractAssetReferences(xhtmlContent: string): string[] {
  try {
    const doc = parseXHTML(xhtmlContent);
    const elements = findAssetElements(doc);
    const references: string[] = [];
    
    for (const element of elements) {
      const attr = getAssetAttribute(element);
      if (attr) {
        const href = element.getAttribute(attr);
        if (href && isRelativeResourceURL(href)) {
          references.push(href);
        }
      }
    }
    
    // Remove duplicates
    return [...new Set(references)];
  } catch (_error) {
    // Return empty array if parsing fails
    return [];
  }
}

/**
 * Count relative asset references in XHTML
 */
export function countAssetReferences(xhtmlContent: string): number {
  return extractAssetReferences(xhtmlContent).length;
}