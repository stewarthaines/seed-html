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
import type { FileStorageAPI } from '../storage/index.js';
import type { BlobURLManagerConfig, BlobURLRegistry } from './types.js';
import { BlobURLError, BlobURLCapacityError, XHTMLProcessingError } from './types.js';

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

      if (this.supportsDirectBlobs) {
        // OPFS: Zero-copy approach
        const file = await this.fileStorage.getFile(this.activeWorkspaceId, resolvedPath);
        const mimeType = this.getMimeType(filePath);
        const correctedFile = new File([file], file.name, { type: mimeType });
        blobURL = URL.createObjectURL(correctedFile);
      } else {
        // IndexedDB: Traditional approach
        const content = await this.fileStorage.readFile(this.activeWorkspaceId, resolvedPath);
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
   * Process XHTML content and substitute relative URLs with blob URLs
   */
  async processXHTMLForPreview(xhtmlContent: string): Promise<string> {
    // Check capacity before processing
    if (this.isAtCapacity()) {
      this.onCapacityReached?.();
      throw new BlobURLCapacityError(this.getBlobURLCount(), this.registry.maxCount);
    }

    try {
      // Parse XHTML with DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(xhtmlContent, 'application/xhtml+xml');

      // Check for parsing errors
      if (doc.documentElement && doc.documentElement.tagName === 'parsererror') {
        throw new XHTMLProcessingError('Invalid XHTML content');
      }

      // Find all asset references
      const assetElements = this.findAssetElements(doc);

      // Process each asset element sequentially
      // This serialized loop is the typical usage pattern for createBlobURL calls
      for (const element of assetElements) {
        await this.processAssetElement(element);
      }

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

    return elements;
  }

  /**
   * Process a single asset element
   */
  private async processAssetElement(element: Element): Promise<void> {
    const _tagName = element.tagName.toLowerCase();

    // Determine attribute name
    let attr: string;
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
    } else {
      return; // No supported attribute found
    }

    const href = element.getAttribute(attr);
    if (!href || !this.isResourcePath(href)) {
      return; // Skip non-relative URLs
    }

    try {
      // Check capacity before creating blob URL
      if (this.getBlobURLCount() >= this.registry.maxCount) {
        this.onCapacityReached?.();
        throw new BlobURLCapacityError(this.getBlobURLCount(), this.registry.maxCount);
      }

      const blobURL = await this.createBlobURL(href);
      element.setAttribute(attr, blobURL);
    } catch (error) {
      this.handleMissingAsset(element, href, error);
    }
  }

  /**
   * Handle missing or failed asset processing
   */
  private handleMissingAsset(element: Element, href: string, _error: Error): void {
    const tagName = element.tagName.toLowerCase();
    const resolvedPath = this.resolveManifestPath(href);

    // Visual assets get error icons
    if (['img', 'video', 'audio', 'object', 'image'].includes(tagName)) {
      // eslint-disable-next-line no-console
      console.warn(`Missing image: ${resolvedPath} (referenced by <${tagName}> element)`);

      // Set error icon and descriptive alt text
      const attr = element.hasAttribute('src')
        ? 'src'
        : element.hasAttribute('href')
          ? 'href'
          : 'data';
      element.setAttribute(attr, this.getErrorIconSVG());
      element.setAttribute('alt', `Missing: ${href}`);
    }
    // Non-visual assets preserve original URL
    else if (['script', 'link'].includes(tagName)) {
      // eslint-disable-next-line no-console
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
}
