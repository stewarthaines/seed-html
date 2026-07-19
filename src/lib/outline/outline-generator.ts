/**
 * OutlineGenerator - EPUB Navigation Generation Utility
 *
 * Generates EPUB-compliant navigation documents from spine items
 * and processes user-written navigation content through transform pipeline.
 */

import type { SpineItemWithSource } from '../spine/types';
import type {
  WorkspaceService,
  WorkspacePathInfo,
} from '../services/workspace/workspace.service.js';
import type { SpineTransformPipeline } from '$lib/transform/spine-transform-pipeline';
import type { ManifestItem } from '../epub/opf-utils.js';
import { isRtlLanguage } from '../epub/language-direction.js';
// import type { TransformEngine } from '$lib/infrastructure/transform-engine';

// Type definitions for public API

/**
 * Complete navigation document with XHTML content and metadata
 */
export interface NavigationDocument {
  /** Complete EPUB navigation XHTML content */
  xhtmlContent: string;

  /** Navigation metadata for OPF manifest */
  metadata: NavigationMetadata;
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

  /**
   * The book's primary language (dc:language). The nav document is an XHTML content
   * document, so it carries xml:lang/lang and `dir="rtl"` for RTL languages.
   */
  language?: string;

  /**
   * Brokered file-access context for the transform scripts (the project's base path +
   * manifest), so nav transforms get the same `ctx` access as chapter transforms.
   */
  brokerContext?: { basePath: string; manifest: ManifestItem[]; language?: string };
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
    workspaceService: WorkspaceService,
    workspaceId: string,
    pathInfo?: WorkspacePathInfo,
    language?: string
  ): Promise<NavigationDocument> {
    // Default pathInfo if not provided
    // if (!pathInfo) {
    //   pathInfo = {
    //     rootfilePath: 'OEBPS/content.opf',
    //     basePath: 'OEBPS',
    //     opfFileName: 'content.opf',
    //   };
    // }

    // Use fixed options for the current architecture
    const opts = {
      includeUntitled: true,
      titleStrategy: 'heading' as const,
      documentTitle: 'Table of Contents',
      cssClasses: {},
    };

    // Generate navigation items from spine items
    const navItems: Array<{ href: string; title: string }> = [];
    let chapterNumber = 1;

    for (const spineItem of spineItems) {
      // Skip non-linear items (spine linear="no") — auxiliary content such as covers
      // or pop-up footnotes that sits outside the reading order, so it doesn't belong
      // in the generated table of contents.
      if (spineItem.linear === false) {
        continue;
      }

      // Skip items with empty hrefs
      if (!spineItem.href) {
        continue;
      }

      try {
        // Construct full file path using workspace basePath
        const fullFilePath = `${pathInfo?.basePath}/${spineItem.href}`;
        const xhtmlBuffer = await workspaceService.readFile(workspaceId, fullFilePath);
        const xhtmlContent = new TextDecoder().decode(xhtmlBuffer);

        // Extract title from XHTML content
        const title = this.extractTitleFromXHTML(
          xhtmlContent,
          spineItem.href,
          chapterNumber,
          'heading'
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
      opts.cssClasses,
      language
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
    transformPipeline: SpineTransformPipeline,
    workspaceId: string,
    options?: ProcessingOptions
  ): Promise<NavigationDocument> {
    const opts = {
      validationLevel: 'strict' as const,
      // errorHandling: 'throw' as const,
      documentTitle: 'Navigation',
      ...options,
    };

    // Transform user text through transform pipeline, supplying the workspace-scoped
    // file-access context so nav transforms get the same `ctx` as chapter transforms.
    const result = await transformPipeline.executeTransform(
      navText,
      2000,
      'nav',
      opts.brokerContext
    );

    // Coerce the transformed HTML into what an EPUB toc nav allows (heading? + <ol>).
    let xhtmlContent = this.normalizeNavContent(result.html);
    const documentTitle =
      this.extractTitleFromXHTML(
        `<?xml version="1.0" encoding="UTF-8"?><html><body>${xhtmlContent}</body></html>`,
        'nav.xhtml',
        0,
        'heading'
      ) || opts.documentTitle;

    xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"${this.htmlLangDirAttrs(opts.language)}>
<head>
  <title>${this.escapeXML(documentTitle)}</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <nav epub:type="toc" role="doc-toc">
    ${xhtmlContent}
  </nav>
</body>
</html>`;

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
    };
  }

  /**
   * Coerce transformed content into the EPUB toc-nav content model: an optional
   * heading followed by a single <ol> of <li>(a|span, ol?). The djot text transform
   * emits general HTML that's illegal inside <nav epub:type="toc">: headings wrapped
   * in <section> (djot's implicit sectioning), <ul> lists, and — for "loose" lists —
   * <p>-wrapped <li> content. We unwrap the sections, turn every <ul> into <ol>, and
   * lift a lone block wrapper out of each <li> so the link sits directly in it. The
   * common "heading + nested link list" pattern becomes valid; genuinely non-toc
   * content (paragraphs, images, multiple lists) can't be a valid toc and is left as-is.
   */
  private static normalizeNavContent(html: string | undefined): string {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(`<!DOCTYPE html><html>${html}</html>`, 'text/html');
    const body = doc.body;

    // 1. Unwrap every <section>, lifting its children into place (handles nesting).
    let section: Element | null;
    while ((section = body.querySelector('section'))) {
      section.replaceWith(...Array.from(section.childNodes));
    }

    // 2. Convert every <ul> to <ol> (toc lists must be ordered), preserving children.
    body.querySelectorAll('ul').forEach(ul => {
      const ol = doc.createElement('ol');
      for (const attr of Array.from(ul.attributes)) ol.setAttribute(attr.name, attr.value);
      while (ul.firstChild) ol.appendChild(ul.firstChild);
      ul.replaceWith(ol);
    });

    // 3. A toc <li> only allows (a|span, ol?). Loose lists wrap the item in a block
    //    (<li><p><a/></p></li>) — lift a sole <p>/<div> child's contents into the <li>.
    body.querySelectorAll('li').forEach(li => {
      const children = Array.from(li.children);
      if (children.length === 1 && (children[0].tagName === 'P' || children[0].tagName === 'DIV')) {
        children[0].replaceWith(...Array.from(children[0].childNodes));
      }
    });

    return body.innerHTML;
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
  /**
   * The `xml:lang`/`lang` (and `dir="rtl"` for RTL) attributes for the nav `<html>`,
   * derived from the book's language. The navigation document is an XHTML content
   * document, so it follows the same language/direction rules as the chapters.
   */
  private static htmlLangDirAttrs(language?: string): string {
    const lang = (language ?? '').trim();
    if (!lang) return '';
    const esc = this.escapeXML(lang);
    return ` xml:lang="${esc}" lang="${esc}"${isRtlLanguage(lang) ? ' dir="rtl"' : ''}`;
  }

  private static generateNavigationXHTML(
    navItems: Array<{ href: string; title: string }>,
    documentTitle: string = 'Table of Contents',
    cssClasses: Record<string, string> = {},
    language?: string
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
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"${this.htmlLangDirAttrs(language)}>
<head>
  <title>${this.escapeXML(documentTitle)}</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <nav epub:type="toc" role="doc-toc"${navClass}>
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
