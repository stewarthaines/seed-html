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
import { manifestHrefToPath } from '../epub/path-utils.js';
import { isRtlLanguage } from '../epub/language-direction.js';
import { collectPageTargets, pageListMarkup } from './page-list.js';
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
interface NavigationMetadata {
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

  /**
   * The spine, for what a hand-written nav takes from the chapters: the
   * page-list, and the toc when `nav.txt` holds landmarks but no toc. Without
   * it the nav is built from `nav.txt` alone.
   */
  spine?: NavSpineContext;

  /**
   * Spine idref of the chapter where reading starts (the `start_reading`
   * setting). With `spine`, the nav gains a landmarks nav (toc and bodymatter)
   * unless `nav.txt` has a landmarks block of its own, which wins.
   */
  startReading?: string;
}

/** The spine and the storage to read its chapters from. */
export interface NavSpineContext {
  items: SpineItemWithSource[];
  workspaceService: WorkspaceService;
  pathInfo: WorkspacePathInfo;
}

/** The nav blocks found in a transformed `nav.txt`, as inner HTML. */
interface NavBlocks {
  toc: string | null;
  landmarks: string | null;
}

const NAV_BLOCK_TYPES = ['toc', 'landmarks', 'page-list'] as const;

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
    language?: string,
    options: { startReading?: string } = {}
  ): Promise<NavigationDocument> {
    // Default pathInfo if not provided
    // if (!pathInfo) {
    //   pathInfo = {
    //     rootfilePath: 'OEBPS/content.opf',
    //     basePath: 'OEBPS',
    //     opfFileName: 'content.opf',
    //   };
    // }

    const navItems = await this.tocItemsFromSpine(
      spineItems,
      workspaceService,
      workspaceId,
      pathInfo
    );
    const start = this.startEntry(spineItems, navItems, options.startReading);
    const landmarks = start ? this.landmarksMarkup(start) : '';
    const pageList = pageListMarkup(
      await collectPageTargets(spineItems, workspaceService, workspaceId, pathInfo?.basePath ?? '')
    );

    // Generate EPUB-compliant XHTML
    const xhtmlContent = this.generateNavigationXHTML(
      navItems,
      'Table of Contents',
      {},
      language,
      [landmarks, pageList].filter(Boolean).join('\n')
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
   * The toc entries for the spine: each linear chapter's first heading (or its
   * title), skipping non-linear and unreadable items.
   */
  private static async tocItemsFromSpine(
    spineItems: SpineItemWithSource[],
    workspaceService: WorkspaceService,
    workspaceId: string,
    pathInfo?: WorkspacePathInfo
  ): Promise<Array<{ href: string; title: string }>> {
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
        const fullFilePath = manifestHrefToPath(pathInfo?.basePath ?? '', spineItem.href);
        const xhtmlBuffer = await workspaceService.readFile(workspaceId, fullFilePath);
        const xhtmlContent = new TextDecoder().decode(xhtmlBuffer);

        const title = this.extractTitleFromXHTML(
          xhtmlContent,
          spineItem.href,
          chapterNumber,
          'heading'
        );
        navItems.push({ href: spineItem.href, title: title || `Chapter ${chapterNumber}` });
        chapterNumber++;
      } catch (error) {
        // If it's a workspace-level error (workspace not found), let it bubble up
        if (error instanceof Error && error.message.includes('Workspace not found')) {
          throw error;
        }
        // Skip spine items with missing or unreadable XHTML files
        continue;
      }
    }
    return navItems;
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

    // Transform user text through the text transform only, supplying the
    // workspace-scoped file-access context so it gets the same `ctx` as chapters.
    // DOM transforms are for chapters: a layout wrapper such as responsive's
    // div.sr-page inside <nav> is invalid (RSC-005).
    const result = await transformPipeline.executeTransform(
      navText,
      2000,
      'nav',
      opts.brokerContext,
      { textOnly: true }
    );

    if (result.success === false) {
      throw new Error(`nav.txt did not transform: ${result.error?.message ?? 'unknown error'}`);
    }

    const blocks = this.splitNavBlocks(result.html);
    let toc = blocks.toc;
    // The spine's toc entries: for a toc when nav.txt has none, and for the
    // start-reading landmark's label.
    const spineEntries =
      opts.spine && (toc === null || (opts.startReading && blocks.landmarks === null))
        ? await this.tocItemsFromSpine(
            opts.spine.items,
            opts.spine.workspaceService,
            workspaceId,
            opts.spine.pathInfo
          )
        : [];
    if (toc === null && opts.spine) toc = this.tocListMarkup(spineEntries, '    ');
    const pageList = opts.spine
      ? pageListMarkup(
          await collectPageTargets(
            opts.spine.items,
            opts.spine.workspaceService,
            workspaceId,
            opts.spine.pathInfo.basePath
          )
        )
      : '';

    const documentTitle =
      this.extractTitleFromXHTML(
        `<?xml version="1.0" encoding="UTF-8"?><html><body>${toc ?? ''}</body></html>`,
        'nav.xhtml',
        0,
        'heading'
      ) || opts.documentTitle;

    // A landmarks block in nav.txt wins over the start-reading choice.
    const start =
      blocks.landmarks === null && opts.spine
        ? this.startEntry(opts.spine.items, spineEntries, opts.startReading)
        : null;
    const navs = [
      `  <nav epub:type="toc" role="doc-toc"${this.tocIdAttr(toc ?? '')}>
    ${toc ?? ''}
  </nav>`,
      blocks.landmarks !== null
        ? `  <nav epub:type="landmarks" hidden="hidden">
    ${blocks.landmarks}
  </nav>`
        : start
          ? this.landmarksMarkup(start)
          : '',
      pageList,
    ].filter(Boolean);

    const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"${this.htmlLangDirAttrs(opts.language)}>
<head>
  <title>${this.escapeXML(documentTitle)}</title>
  <meta charset="UTF-8"/>
</head>
<body>
${navs.join('\n')}
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
   * Split transformed `nav.txt` into its nav blocks. A block is a top-level
   * `<nav epub:type="…">` (raw HTML, for authors who generate the nav with a
   * script) or a div whose class names the nav type (djot's `::: toc`). When
   * there are no blocks, the whole content is the toc, as before multi-nav.
   *
   * A page-list block is logged and left out: the page-list is always derived
   * from the chapters' print page markers. So is any content outside the
   * blocks, and every toc block after the first (a nav has one toc).
   */
  private static splitNavBlocks(html: string | undefined): NavBlocks {
    const doc = new DOMParser().parseFromString(
      `<!DOCTYPE html><html>${html ?? ''}</html>`,
      'text/html'
    );
    const body = doc.body;

    // Unwrap every <section> (djot's implicit sectioning), lifting its children into place.
    let section: Element | null;
    while ((section = body.querySelector('section'))) {
      section.replaceWith(...Array.from(section.childNodes));
    }

    const typeOf = (el: Element): (typeof NAV_BLOCK_TYPES)[number] | null => {
      const declared =
        el.tagName === 'NAV'
          ? (el.getAttribute('epub:type') ?? '').split(/\s+/)
          : el.tagName === 'DIV'
            ? Array.from(el.classList)
            : [];
      return NAV_BLOCK_TYPES.find(type => declared.includes(type)) ?? null;
    };
    const blocks = Array.from(body.children).filter(el => typeOf(el) !== null);
    if (blocks.length === 0) {
      this.normalizeNavList(body);
      return { toc: body.innerHTML, landmarks: null };
    }

    const found: NavBlocks = { toc: null, landmarks: null };
    for (const el of Array.from(body.children)) {
      const type = typeOf(el);
      if (type === 'page-list') {
        console.warn(
          "nav.txt: a page-list block is left out; the page-list comes from the chapters' page markers"
        );
      } else if (type === null) {
        console.warn(`nav.txt: <${el.tagName.toLowerCase()}> outside a nav block is left out`);
      } else if (found[type] !== null) {
        console.warn(`nav.txt: a second ${type} block is left out`);
      } else {
        this.normalizeNavList(el);
        if (type === 'landmarks') {
          el.querySelectorAll('a').forEach(a => {
            if (!a.getAttribute('epub:type')) {
              console.warn(`nav.txt: landmark "${a.textContent?.trim()}" has no epub:type`);
            }
          });
        }
        found[type] = el.innerHTML;
      }
    }
    return found;
  }

  /**
   * Coerce a nav block into the EPUB nav content model: an optional heading
   * followed by a single <ol> of <li>(a|span, ol?). The djot text transform emits
   * general HTML: <ul> lists and, for "loose" lists, <p>-wrapped <li> content. Every
   * <ul> becomes <ol>, and a block wrapper that opens an <li> — alone, or followed
   * only by its nested list (djot's loose nested lists, li > p + ol) — is lifted so
   * the link sits directly in the <li>. Content that can't be a nav list is left as is.
   */
  private static normalizeNavList(container: Element): void {
    const doc = container.ownerDocument;
    container.querySelectorAll('ul').forEach(ul => {
      const ol = doc.createElement('ol');
      for (const attr of Array.from(ul.attributes)) ol.setAttribute(attr.name, attr.value);
      while (ul.firstChild) ol.appendChild(ul.firstChild);
      ul.replaceWith(ol);
    });

    container.querySelectorAll('li').forEach(li => {
      const [first, ...rest] = Array.from(li.children);
      if (
        first &&
        (first.tagName === 'P' || first.tagName === 'DIV') &&
        rest.every(child => child.tagName === 'OL')
      ) {
        first.replaceWith(...Array.from(first.childNodes));
      }
    });
  }

  /**
   * The start-reading chapter as a landmark target: its href and its toc title
   * (or its stored title, or its id). Null when nothing is chosen, or when the
   * chosen chapter is no longer in the spine (logged).
   */
  private static startEntry(
    spineItems: SpineItemWithSource[],
    tocEntries: Array<{ href: string; title: string }>,
    startReading?: string
  ): { href: string; title: string } | null {
    if (!startReading) return null;
    const item = spineItems.find(i => i.idref === startReading);
    if (!item?.href) {
      console.warn(`Start reading: "${startReading}" is not in the spine; no landmarks written`);
      return null;
    }
    const title = tocEntries.find(e => e.href === item.href)?.title ?? item.title ?? item.id;
    return { href: item.href, title };
  }

  /**
   * The landmarks nav for a start-reading choice: where reading starts
   * (`bodymatter`), labelled with the chapter's title so the label is in the
   * book's language. No `toc` landmark: the toc lives in nav.xhtml, which is not
   * in the spine, and a landmark may only link to spine items (RSC-011).
   */
  private static landmarksMarkup(start: { href: string; title: string }): string {
    return `  <nav epub:type="landmarks" hidden="hidden">
    <ol>
      <li><a epub:type="bodymatter" href="${this.escapeXML(start.href)}">${this.escapeXML(start.title)}</a></li>
    </ol>
  </nav>`;
  }

  /** ` id="toc"`, so the toc can be linked to, unless the content already uses that id. */
  private static tocIdAttr(tocInner: string): string {
    const doc = new DOMParser().parseFromString(
      `<!DOCTYPE html><html>${tocInner}</html>`,
      'text/html'
    );
    return doc.getElementById('toc') ? '' : ' id="toc"';
  }

  /** A toc heading and list for spine-derived entries. */
  private static tocListMarkup(
    entries: Array<{ href: string; title: string }>,
    indent: string,
    documentTitle = 'Table of Contents',
    listClass = ''
  ): string {
    const items = entries
      .map(item => `${indent}  <li><a href="${item.href}">${this.escapeXML(item.title)}</a></li>`)
      .join('\n');
    return `<h1>${this.escapeXML(documentTitle)}</h1>
${indent}<ol${listClass}>
${items}
${indent}</ol>`;
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
    language?: string,
    extraNavs = ''
  ): string {
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
  <nav epub:type="toc" role="doc-toc" id="toc"${navClass}>
    ${this.tocListMarkup(navItems, '    ', documentTitle, listClass)}
  </nav>${extraNavs ? `\n${extraNavs}` : ''}
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
