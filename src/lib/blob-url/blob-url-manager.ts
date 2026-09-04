/**
 * Blob URL Manager - Core Implementation
 *
 * Converts manifest items from storage into blob URLs and substitutes them
 * in XHTML content for preview iframe usage. Includes OPFS optimization
 * for zero-copy blob creation.
 *
 * Concurrency Note: This manager is designed for serial usage where blob URL
 * creation calls are made sequentially. Concurrent calls for the same resource
 * may result in duplicate blob URLs. The primary usage through XHTML processing
 * naturally serializes calls by iterating through DOM elements.
 */

import { getMimeType } from '../utils/mime-types.js';
import { convertXHTMLPathToManifestPath } from '../epub/path-utils.js';
import type { FileStorageAPI } from '../storage/index.js';
import type { BlobURLManagerConfig, BlobURLRegistry } from './types.js';
import { BlobURLError, BlobURLCapacityError, XHTMLProcessingError } from './types.js';
import { deferParserBlockingScripts } from './utils.js';

/** SVG <image xlink:href> lives in this namespace; attribute selectors can't name it. */
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/**
 * The element's xlink:href, or null. Guarded: the namespace methods are
 * universal in browsers, but the unit-test DOM lacks them on HTML elements.
 */
function xlinkHref(element: Element): string | null {
  if (typeof element.getAttributeNS !== 'function') return null;
  return element.getAttributeNS(XLINK_NS, 'href');
}

export class BlobURLManager {
  private activeWorkspaceId: string | null = null;
  private registry: BlobURLRegistry;
  private fileStorage: FileStorageAPI;
  private basePath: string;
  private supportsDirectBlobs: boolean;
  private onCapacityReached?: () => void;

  constructor(config: BlobURLManagerConfig) {
    this.fileStorage = config.fileStorage;
    this.basePath = config.basePath;
    this.onCapacityReached = config.onCapacityReached;

    // Initialize registry
    this.registry = {
      urls: new Map<string, string>(),
      created: new Map<string, Date>(),
      count: 0,
      maxCount: config.maxBlobURLs || 100,
    };

    // Cache backend capability detection
    this.supportsDirectBlobs = this.fileStorage.supportsDirectBlobURLs();
  }

  /**
   * Set the active workspace and clean up previous workspace blob URLs
   */
  setActiveWorkspace(workspaceId: string): void {
    if (this.activeWorkspaceId !== workspaceId) {
      this.cleanup(); // Clean up previous workspace URLs
      this.activeWorkspaceId = workspaceId;
    }
  }

  /**
   * Update the OPF base path used to resolve manifest hrefs to storage paths.
   * Imported EPUBs don't always live under "OEBPS/" (the path is whatever
   * container.xml points to), so callers set it from workspace.pathInfo.basePath.
   */
  setBasePath(basePath: string): void {
    this.basePath = basePath;
  }

  /**
   * Create blob URL for a file using optimal backend path
   *
   * Note: This method is designed for serial usage (one call at a time per resource).
   * Concurrent calls for the same resource may result in duplicate blob URLs and
   * multiple file fetches. In practice, calls are serialized through the XHTML
   * processing pipeline which loops through elements sequentially.
   */
  async createBlobURL(filePath: string): Promise<string> {
    // Check capacity before creating
    if (this.registry.count >= this.registry.maxCount) {
      this.onCapacityReached?.();
      throw new BlobURLCapacityError(this.registry.count, this.registry.maxCount);
    }

    // Check if already cached
    if (this.registry.urls.has(filePath)) {
      return this.registry.urls.get(filePath)!;
    }

    if (!this.activeWorkspaceId) {
      throw new BlobURLError('No active workspace set', 'NO_WORKSPACE');
    }

    // Resolve to full workspace path
    const resolvedPath = this.resolveManifestPath(filePath);

    try {
      let blobURL: string;

      // Check if this is a CSS file that needs font URL processing
      const isCSSFile = filePath.toLowerCase().endsWith('.css');

      if (this.supportsDirectBlobs && !isCSSFile) {
        // OPFS: Zero-copy approach (only for non-CSS files)
        const file = await this.fileStorage.getFile(this.activeWorkspaceId, resolvedPath);
        const mimeType = this.getMimeType(filePath);
        const correctedFile = new File([file], file.name, { type: mimeType });
        blobURL = URL.createObjectURL(correctedFile);
      } else {
        // IndexedDB approach OR CSS processing
        let content: ArrayBuffer;

        if (isCSSFile) {
          // CSS files: read as text, rewrite their url() references, then
          // convert back to ArrayBuffer
          const textContent = await this.fileStorage.readTextFile(
            this.activeWorkspaceId,
            resolvedPath
          );
          const processedCSS = await this.processCSSURLs(textContent);
          const uint8Array = new TextEncoder().encode(processedCSS);
          content = uint8Array.buffer as ArrayBuffer;
        } else {
          // Non-CSS files: read as binary
          content = await this.fileStorage.readFile(this.activeWorkspaceId, resolvedPath);
        }

        const mimeType = this.getMimeType(filePath);
        const blob = new Blob([content], { type: mimeType });
        blobURL = URL.createObjectURL(blob);
      }

      // Register for cleanup
      this.addToRegistry(filePath, blobURL);

      return blobURL;
    } catch (error) {
      throw new BlobURLError(
        `Failed to create blob URL for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        'CREATION_FAILED'
      );
    }
  }

  /**
   * Create blob URL from content (not tracked in registry)
   */
  createBlobFromContent(content: ArrayBuffer | string, mimeType: string): string {
    const blob = new Blob([content], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  /**
   * Process XHTML content and substitute relative URLs with blob URLs.
   *
   * Accepts either the serialized document or an already-parsed Document (the
   * render pipeline parses the chapter once and shares it — see
   * process/CHAPTER_SWITCH_PERFORMANCE.md). A passed Document is mutated in
   * place (asset URLs swapped for blob URLs) and serialized.
   */
  async processXHTMLForPreview(xhtmlContent: string | Document): Promise<string> {
    // Check capacity before processing
    if (this.isAtCapacity()) {
      this.onCapacityReached?.();
      throw new BlobURLCapacityError(this.getBlobURLCount(), this.registry.maxCount);
    }

    try {
      let doc: Document;
      if (typeof xhtmlContent === 'string') {
        // Parse XHTML with DOMParser
        const parser = new DOMParser();
        doc = parser.parseFromString(xhtmlContent, 'application/xhtml+xml');

        // Check for parsing errors
        if (doc.documentElement && doc.documentElement.tagName === 'parsererror') {
          throw new XHTMLProcessingError('Invalid XHTML content');
        }
      } else {
        doc = xhtmlContent;
      }

      // Find all asset references
      const assetElements = this.findAssetElements(doc);

      // Process each asset element sequentially
      // This serialized loop is the typical usage pattern for createBlobURL calls
      for (const element of assetElements) {
        await this.processAssetElement(element);
      }

      // Resources referenced from an inline `style` attribute, which the
      // attribute-based pass above cannot see.
      await this.processInlineStyleURLs(doc);

      // Preview documents are written into the iframe with document.write(); a
      // parser-blocking script there can strand the write before <body>.
      deferParserBlockingScripts(doc);

      // Serialize back to string
      const serializer = new XMLSerializer();
      return serializer.serializeToString(doc);
    } catch (error) {
      if (error instanceof BlobURLError) {
        throw error;
      }
      throw new XHTMLProcessingError(
        `XHTML processing failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Revoke a specific blob URL
   */
  revokeBlobURL(url: string): void {
    URL.revokeObjectURL(url);
    this.removeFromRegistry(url);
  }

  /**
   * Revoke blob URL by manifest href (invalidate cache for updated files)
   */
  revokeFileBlob(manifestHref: string): void {
    const blobURL = this.registry.urls.get(manifestHref);
    if (blobURL) {
      this.revokeBlobURL(blobURL); // Use existing method
    }
  }

  /**
   * Clean up all blob URLs for current workspace
   */
  cleanup(): void {
    // Revoke all blob URLs
    for (const blobURL of this.registry.urls.values()) {
      URL.revokeObjectURL(blobURL);
    }

    // Clear registry
    this.registry.urls.clear();
    this.registry.created.clear();
    this.registry.count = 0;
  }

  /**
   * Get MIME type for file extension
   */
  getMimeType(filePath: string): string {
    return getMimeType(filePath);
  }

  /**
   * Check if URL is a relative resource path
   */
  isResourcePath(href: string): boolean {
    return (
      !href.startsWith('http') &&
      !href.startsWith('data:') &&
      !href.startsWith('blob:') &&
      !href.startsWith('/') && // Absolute paths
      !href.startsWith('ftp:') &&
      !href.startsWith('mailto:') &&
      !href.startsWith('tel:') &&
      !href.startsWith('file:') &&
      !href.startsWith('about:') &&
      !href.startsWith('javascript:') &&
      !href.startsWith('//') && // Protocol-relative URLs
      href.trim().length > 0
    );
  }

  /**
   * Get current blob URL count
   */
  getBlobURLCount(): number {
    return this.registry.count;
  }

  /**
   * Check if at capacity
   */
  isAtCapacity(): boolean {
    return this.registry.count >= this.registry.maxCount;
  }

  /**
   * Resolve manifest item href to full workspace path
   */
  private resolveManifestPath(href: string): string {
    // Handle OPF in container root (empty basePath)
    if (!this.basePath) return href;

    // Standard case: basePath + href
    return `${this.basePath}/${href}`;
  }

  /**
   * Find all asset elements in XHTML document
   */
  private findAssetElements(doc: Document): Element[] {
    const elements: Element[] = [];

    // Asset selectors from types.ts
    const selectors = [
      'script[src]',
      'link[href]',
      'a[href]',
      'audio[src]',
      'video[src]',
      'video[poster]',
      'img[src]',
      'object[data]',
      'image[href]', // SVG
      '*[data-src]',
    ];

    for (const selector of selectors) {
      const found = doc.querySelectorAll(selector);
      elements.push(...Array.from(found));
    }

    // SVG <image xlink:href>: the form reading systems have always resolved,
    // and the one foliate-based readers rewrite (they skip a namespaced href
    // when a plain one is present, so content carries xlink:href alone). An
    // attribute selector cannot name the namespace here; filter by hand.
    for (const image of Array.from(doc.querySelectorAll('image'))) {
      if (!image.hasAttribute('href') && xlinkHref(image) !== null) {
        elements.push(image);
      }
    }

    return elements;
  }

  /**
   * Rewrite `url()` references inside inline `style` attributes.
   *
   * findAssetElements only matches attributes that hold a bare path — src,
   * href, data, poster — so a resource named from CSS is invisible to it. A
   * stylesheet's url() is already rewritten when the sheet is blobbed; without
   * this, the same declaration written inline is not, and the asset 404s. That
   * fails in the worst direction: the preview and the generated PDF show a gap
   * while real reading systems render it correctly, so the preview lies about
   * the package. A cropped region positioned with `background-image` is the
   * case that surfaced it.
   */
  private async processInlineStyleURLs(doc: Document): Promise<void> {
    for (const element of Array.from(doc.querySelectorAll('[style]'))) {
      const style = element.getAttribute('style');
      // Cheap guard: only pay the regex cost for styles that name a resource.
      if (!style || !style.includes('url(')) continue;
      const processed = await this.processCSSURLs(style);
      if (processed !== style) element.setAttribute('style', processed);
    }
  }

  /**
   * Process a single asset element
   */
  private async processAssetElement(element: Element): Promise<void> {
    // Determine attribute name. A namespaced xlink:href (SVG <image>) is read
    // and written through the namespace API; the attribute name is a label.
    let attr: string;
    let xlink = false;
    if (element.hasAttribute('src')) {
      attr = 'src';
    } else if (element.hasAttribute('href')) {
      attr = 'href';
    } else if (element.hasAttribute('data')) {
      attr = 'data';
    } else if (element.hasAttribute('poster')) {
      attr = 'poster';
    } else if (element.hasAttribute('data-src')) {
      attr = 'data-src';
    } else if (xlinkHref(element) !== null) {
      attr = 'xlink:href';
      xlink = true;
    } else {
      return; // No supported attribute found
    }

    const href = xlink ? xlinkHref(element) : element.getAttribute(attr);
    if (!href || !this.isResourcePath(href)) {
      return; // Skip non-relative URLs
    }

    try {
      // Check capacity before creating blob URL
      if (this.getBlobURLCount() >= this.registry.maxCount) {
        this.onCapacityReached?.();
        throw new BlobURLCapacityError(this.getBlobURLCount(), this.registry.maxCount);
      }

      // Convert XHTML-relative path to manifest path for registry lookup
      const manifestPath = convertXHTMLPathToManifestPath(href);
      const blobURL = await this.createBlobURL(manifestPath);
      if (xlink) element.setAttributeNS(XLINK_NS, 'xlink:href', blobURL);
      else element.setAttribute(attr, blobURL);
      // Keep the manifest href discoverable on the element (the blob URL erases
      // it): the preview's click-to-source uses it to find the source reference.
      // Display-only documents (preview iframe, print window) — never persisted.
      element.setAttribute('data-source-href', manifestPath);
    } catch (error) {
      this.handleMissingAsset(element, href, error as Error);
    }
  }

  /**
   * Handle missing or failed asset processing
   */
  private handleMissingAsset(element: Element, href: string, _error: Error): void {
    const tagName = element.tagName.toLowerCase();
    // Convert XHTML path to manifest path before resolving
    const manifestPath = convertXHTMLPathToManifestPath(href);
    const resolvedPath = this.resolveManifestPath(manifestPath);

    // Stamp the failure on the element so the preview can tell the author which
    // files are missing. A console warning reaches the developer, not the person
    // whose book has a broken reference. Display-only documents (preview iframe,
    // print window) — never persisted, same contract as data-source-href.
    //
    // Anchors are excluded, matching the no-special-handling branch below: a
    // chapter-to-chapter link (`recordings.xhtml`) is written relative to
    // OEBPS/Text/, so it never resolves against the manifest root and never
    // needs to — the reading system resolves it in the packaged book. Reporting
    // those as missing files would flag every internal link in the book.
    if (tagName !== 'a') element.setAttribute('data-seed-missing', manifestPath);

    // Visual assets get error icons
    if (['img', 'video', 'audio', 'object', 'image'].includes(tagName)) {
      console.warn(`Missing image: ${resolvedPath} (referenced by <${tagName}> element)`);

      // Set error icon and descriptive alt text
      if (!element.hasAttribute('href') && xlinkHref(element) !== null) {
        element.setAttributeNS(XLINK_NS, 'xlink:href', this.getErrorIconSVG());
      } else {
        const attr = element.hasAttribute('src')
          ? 'src'
          : element.hasAttribute('href')
            ? 'href'
            : 'data';
        element.setAttribute(attr, this.getErrorIconSVG());
      }
      element.setAttribute('alt', `Missing: ${href}`);
    }
    // Non-visual assets preserve original URL
    else if (['script', 'link'].includes(tagName)) {
      console.warn(`Missing asset: ${resolvedPath} (referenced by <${tagName}> element)`);
      // Leave original URL - will show 404
    }
    // Navigation elements get no special handling
  }

  /**
   * Get error icon SVG data URL
   */
  private getErrorIconSVG(): string {
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="24" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#f44336" stroke="#d32f2f"/>
        <text x="12" y="16" text-anchor="middle" fill="white" font-size="12">!</text>
      </svg>
    `)}`;
  }

  /**
   * Add blob URL to registry for cleanup tracking
   */
  private addToRegistry(filePath: string, blobURL: string): void {
    this.registry.urls.set(filePath, blobURL);
    this.registry.created.set(filePath, new Date());
    this.registry.count++;
  }

  /**
   * Remove blob URL from registry
   */
  private removeFromRegistry(blobURL: string): void {
    // Find and remove by blob URL value
    for (const [filePath, url] of this.registry.urls.entries()) {
      if (url === blobURL) {
        this.registry.urls.delete(filePath);
        this.registry.created.delete(filePath);
        this.registry.count--;
        break;
      }
    }
  }

  /**
   * Rewrite every workspace-relative `url()` in a chunk of CSS to a blob URL.
   *
   * Used for two kinds of CSS: the text of a stylesheet being blobbed, and the
   * value of an inline `style` attribute (see processInlineStyleURLs). Fonts
   * were the original case, but nothing here is font-specific — a
   * `background-image` resolves the same way.
   */
  private async processCSSURLs(cssContent: string): Promise<string> {
    // Regex to match url() patterns: url('path'), url("path"), url(path)
    const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
    let processedCSS = cssContent;
    const matches = Array.from(cssContent.matchAll(urlPattern));

    for (const match of matches) {
      const fullMatch = match[0]; // Complete url(...) expression
      const quote = match[1]; // Quote character (' or " or empty)
      const url = match[2]; // The actual URL

      // Skip if not a resource path (absolute URLs, data URLs, etc.)
      if (!this.isResourcePath(url)) {
        continue;
      }

      try {
        // Check capacity before creating blob URL
        if (this.getBlobURLCount() >= this.registry.maxCount) {
          this.onCapacityReached?.();
          throw new BlobURLCapacityError(this.getBlobURLCount(), this.registry.maxCount);
        }

        // Convert XHTML path to manifest path
        const manifestPath = convertXHTMLPathToManifestPath(url);

        // Create blob URL for the font file (recursive call but for non-CSS file)
        // createBlobURL() will handle path resolution internally
        const blobURL = await this.createBlobURL(manifestPath);

        // Replace the URL in CSS while preserving quotes and syntax
        const replacement = `url(${quote}${blobURL}${quote})`;
        processedCSS = processedCSS.replace(fullMatch, replacement);
      } catch (error) {
        // Log CSS URL processing errors but don't break the whole CSS
        console.warn(`Failed to process CSS url(${url}):`, error);
      }
    }

    return processedCSS;
  }

  /**
   * Get loaded extension libraries for transform context
   * Currently returns empty object - extension library loading not yet implemented
   */
  getLoadedGlobals(): Record<string, any> {
    return {};
  }
}
