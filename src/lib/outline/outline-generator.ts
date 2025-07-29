/**
 * OutlineGenerator - EPUB Navigation Generation Utility
 *
 * Generates EPUB-compliant navigation documents from spine items
 * and processes user-written navigation content through transform pipeline.
 */

import type { SpineItemWithSource } from '../spine/types';
import type { IWorkspaceManager } from '../workspace/types';
import type { TransformPipeline } from '../transform/transform-pipeline';

// Type definitions for public API

/**
 * Complete navigation document with XHTML content and metadata
 */
export interface NavigationDocument {
  /** Complete EPUB navigation XHTML content */
  xhtmlContent: string;

  /** Navigation metadata for OPF manifest */
  metadata: NavigationMetadata;

  /** Generation timestamp */
  generatedAt: Date;

  /** Source type: 'auto-generated' | 'user-content' */
  sourceType: 'auto-generated' | 'user-content';
}

/**
 * Navigation metadata for OPF manifest registration
 */
export interface NavigationMetadata {
  /** Manifest item ID (typically 'nav') */
  id: string;

  /** File path relative to OEBPS (typically 'nav.xhtml') */
  href: string;

  /** Media type (always 'application/xhtml+xml') */
  mediaType: string;

  /** EPUB properties (always ['nav']) */
  properties: string[];

  /** Spine inclusion flag (typically false for navigation) */
  linear: boolean;
}

/**
 * Configuration options for automatic generation from spine items
 */
export interface GenerationOptions {
  /** Include spine items without titles */
  includeUntitled?: boolean;

  /** Custom title generation strategy */
  titleStrategy?: 'filename' | 'heading' | 'fallback';

  /** Navigation document title */
  documentTitle?: string;

  /** Additional CSS classes for styling */
  cssClasses?: Record<string, string>;
}

/**
 * Configuration options for user content processing
 */
export interface ProcessingOptions {
  /** Validation strictness level */
  validationLevel?: 'strict' | 'lenient';

  /** Error handling strategy */
  errorHandling?: 'throw' | 'fallback';

  /** Navigation document title */
  documentTitle?: string;
}

/**
 * OutlineGenerator utility class for EPUB navigation generation
 */
export class OutlineGenerator {
  /**
   * Generate complete EPUB navigation from spine items
   *
   * @param spineItems Array of spine items with source file information
   * @param workspaceManager Workspace manager instance for file access
   * @param workspaceId Workspace identifier for file operations
   * @param options Optional configuration for generation behavior
   * @returns Promise resolving to complete navigation document
   */
  static async generateFromSpine(
    spineItems: SpineItemWithSource[],
    workspaceManager: IWorkspaceManager,
    workspaceId: string,
    options?: GenerationOptions
  ): Promise<NavigationDocument> {
    const opts = {
      includeUntitled: true,
      titleStrategy: 'heading' as const,
      documentTitle: 'Table of Contents',
      cssClasses: {},
      ...options,
    };

    // Get workspace basePath to correctly construct file paths
    const pathInfo = await workspaceManager.getWorkspacePathInfo(workspaceId);

    // Generate navigation items from spine items
    const navItems: Array<{ href: string; title: string }> = [];
    let chapterNumber = 1;

    for (const spineItem of spineItems) {
      // Skip items with empty hrefs
      if (!spineItem.href) {
        continue;
      }

      try {
        // Construct full file path using workspace basePath
        const fullFilePath = `${pathInfo.basePath}/${spineItem.href}`;
        const xhtmlContent = await workspaceManager.readTextFile(workspaceId, fullFilePath);

        // Extract title from XHTML content
        const title = this.extractTitleFromXHTML(
          xhtmlContent,
          spineItem.href,
          chapterNumber,
          opts.titleStrategy
        );

        // Only add if we can extract title or includeUntitled is true
        if (title || opts.includeUntitled) {
          const navItem = {
            href: spineItem.href,
            title: title || `Chapter ${chapterNumber}`,
          };
          navItems.push(navItem);
        }

        chapterNumber++;
      } catch (error) {
        // If it's a workspace-level error (workspace not found), let it bubble up
        if (error instanceof Error && error.message.includes('Workspace not found')) {
          throw error;
        }
        // Skip spine items with missing or unreadable XHTML files
        // Continue processing remaining items
        continue;
      }
    }

    // Generate EPUB-compliant XHTML
    const xhtmlContent = this.generateNavigationXHTML(
      navItems,
      opts.documentTitle,
      opts.cssClasses
    );

    // Create navigation metadata
    const metadata: NavigationMetadata = {
      id: 'nav',
      href: 'nav.xhtml',
      mediaType: 'application/xhtml+xml',
      properties: ['nav'],
      linear: false,
    };

    return {
      xhtmlContent,
      metadata,
      generatedAt: new Date(),
      sourceType: 'auto-generated',
    };
  }

  /**
   * Process user-written navigation content through transform pipeline
   *
   * @param navText User-written navigation content (plain text)
   * @param transformPipeline Transform pipeline instance for content processing
   * @param workspaceId Workspace identifier for context
   * @param options Optional configuration for processing behavior
   * @returns Promise resolving to processed navigation document
   */
  static async processUserContent(
    navText: string,
    transformPipeline: TransformPipeline,
    workspaceId: string,
    options?: ProcessingOptions
  ): Promise<NavigationDocument> {
    const opts = {
      validationLevel: 'strict' as const,
      errorHandling: 'throw' as const,
      documentTitle: 'Navigation',
      ...options,
    };

    try {
      // Transform user text through transform pipeline
      const result = await transformPipeline.transformText(navText, workspaceId, 'nav');

      // Use transformed content as navigation XHTML
      let xhtmlContent = result.transformedText || '';

      // If transformed content is empty or doesn't have EPUB structure, generate proper structure
      if (!xhtmlContent || !xhtmlContent.includes('<?xml version="1.0" encoding="UTF-8"?>')) {
        xhtmlContent = this.generateNavigationXHTML([], opts.documentTitle);
      }

      // Create navigation metadata
      const metadata: NavigationMetadata = {
        id: 'nav',
        href: 'nav.xhtml',
        mediaType: 'application/xhtml+xml',
        properties: ['nav'],
        linear: false,
      };

      return {
        xhtmlContent,
        metadata,
        generatedAt: new Date(),
        sourceType: 'user-content',
      };
    } catch (error) {
      if (opts.errorHandling === 'throw') {
        throw error;
      }

      // Fallback - generate empty navigation
      const xhtmlContent = this.generateNavigationXHTML([], opts.documentTitle);
      const metadata: NavigationMetadata = {
        id: 'nav',
        href: 'nav.xhtml',
        mediaType: 'application/xhtml+xml',
        properties: ['nav'],
        linear: false,
      };

      return {
        xhtmlContent,
        metadata,
        generatedAt: new Date(),
        sourceType: 'user-content',
      };
    }
  }

  /**
   * Extract title from XHTML content using DOM parsing
   */
  private static extractTitleFromXHTML(
    xhtmlContent: string,
    href: string,
    chapterNumber: number,
    titleStrategy: 'filename' | 'heading' | 'fallback'
  ): string | null {
    // Parse XHTML content using DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(xhtmlContent, 'application/xml');

    // Check for parsing errors - if malformed, throw error to skip item
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Malformed XHTML');
    }

    // Additional check for malformed content by looking for basic structure
    const htmlElement = doc.querySelector('html');
    if (!htmlElement) {
      throw new Error('Invalid XHTML structure');
    }

    // Try to extract title from headings (H1, H2, H3, etc.)
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (const heading of headings) {
      const titleText = heading.textContent?.trim();
      if (titleText) {
        // Strip HTML tags from title and return plain text
        return titleText;
      }
    }

    // Fallback to document title if no headings found
    const titleElement = doc.querySelector('title');
    const docTitle = titleElement?.textContent?.trim();
    if (docTitle) {
      return docTitle;
    }

    // Use fallback strategy
    return this.getFallbackTitle(href, chapterNumber, titleStrategy);
  }

  /**
   * Get fallback title when extraction fails
   */
  private static getFallbackTitle(
    href: string,
    chapterNumber: number,
    titleStrategy: 'filename' | 'heading' | 'fallback'
  ): string | null {
    if (titleStrategy === 'filename') {
      // Extract filename without extension
      const filename = href.split('/').pop() || '';
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      return nameWithoutExt || null;
    }

    if (titleStrategy === 'fallback') {
      return `Chapter ${chapterNumber}`;
    }

    // For 'heading' strategy, return null if no heading found
    return null;
  }

  /**
   * Generate EPUB-compliant navigation XHTML
   */
  private static generateNavigationXHTML(
    navItems: Array<{ href: string; title: string }>,
    documentTitle: string = 'Table of Contents',
    cssClasses: Record<string, string> = {}
  ): string {
    // Generate list items
    const listItems = navItems
      .map(item => `      <li><a href="${item.href}">${this.escapeXML(item.title)}</a></li>`)
      .join('\n');

    // Apply CSS classes if specified
    const navClass = cssClasses.nav ? ` class="${cssClasses.nav}"` : '';
    const listClass = cssClasses.list ? ` class="${cssClasses.list}"` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${this.escapeXML(documentTitle)}</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <nav epub:type="toc" role="navigation"${navClass}>
    <h1>${this.escapeXML(documentTitle)}</h1>
    <ol${listClass}>
${listItems}
    </ol>
  </nav>
</body>
</html>`;
  }

  /**
   * Escape XML special characters
   */
  private static escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
