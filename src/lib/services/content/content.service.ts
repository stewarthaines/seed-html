/**
 * ContentService - Clean Service Architecture Implementation
 *
 * Handles content transformation, navigation generation, and sample content creation
 * following the clean service architecture with single responsibility principle.
 */

import type { ChapterContent, SampleContentData } from '../workspace/workspace.service.js';
import type { TransformExecutor, TransformContext } from '../../transform/transform-executor.js';
import type { TranslationFunction } from '../../i18n/types.js';
import type { EPUBMetadata } from '../../epub/opf-utils.js';
import { generateEPUBTimestamp } from '../../epub/opf-utils.js';
import { JavaScriptValidator } from '../../validation/javascript-validator.js';
import { SampleContentGenerator } from '../../content/sample-content-generator.js';
import pageCSS from '../../../assets/universal/page.css?raw';
import transformTextJS from '../../../assets/universal/transformText.js?raw';
import transformDomJS from '../../../assets/universal/transformDom.js?raw';

// Service-specific types
export interface TransformResult {
  xhtml: string;
  warnings: string[];
  transformTime: number;
}

export interface ContentPreview {
  previewHtml: string;
  warnings: string[];
}

export interface NavigationDocument {
  xhtmlContent: string;
  metadata: {
    id: string;
    href: string;
    mediaType: string;
    properties: string[];
    linear: boolean;
  };
}

export interface DemoChapter {
  id: string;
  title: string;
  content: string;
  linear: boolean;
  mediaType: string;
}

export interface LocalizedSampleContent {
  locale: string;
  metadata: EPUBMetadata;
  chapters: DemoChapter[];
  isRTL: boolean;
  pageProgressionDirection?: 'rtl' | 'ltr';
}

// Service error types
export class ContentServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'ContentServiceError';
  }
}

export class UnsupportedLocaleError extends ContentServiceError {
  constructor(locale: string) {
    super(`Unsupported locale: ${locale}`, 'UNSUPPORTED_LOCALE');
    this.name = 'UnsupportedLocaleError';
  }
}

/**
 * ContentService - Single responsibility for content transformation and generation
 */
export class ContentService {
  // Supported locales for sample content
  private static readonly SUPPORTED_LOCALES = new Set([
    'en',
    'es',
    'fr',
    'de',
    'it',
    'pt',
    'nl',
    'sv',
    'da',
    'no',
    'fi',
    'ru',
    'pl',
    'cs',
    'hu',
    'ro',
    'bg',
    'hr',
    'sk',
    'sl',
    'et',
    'lv',
    'lt',
    'el',
    'tr',
    'ar',
    'he',
    'fa',
    'ur',
    'hi',
    'bn',
    'ta',
    'te',
    'ml',
    'kn',
    'gu',
    'pa',
    'or',
    'as',
    'ne',
    'si',
    'my',
    'km',
    'lo',
    'vi',
    'th',
    'id',
    'ms',
    'tl',
    'zh',
    'ja',
    'ko',
  ]);

  // RTL languages
  private static readonly RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur']);

  constructor(
    private transformExecutor: TransformExecutor,
    private i18nSystem: {
      translate: TranslationFunction;
      getCatalogs: () => any;
      isInitialized: () => boolean;
      getCurrentLocale: () => string;
    }
  ) {}

  /**
   * Generate complete sample content data structure (PURE FUNCTION - NO FILE I/O)
   */
  async generateSampleContentData(locale: string = 'en'): Promise<SampleContentData> {
    try {
      // Generate localized content
      const sampleContent = await this.generateLocalizedContent(locale);
      const { chapters, isRTL } = sampleContent;

      // Transform text to XHTML for each chapter
      const transformedChapters = [];
      for (const chapter of chapters) {
        const transformedContent = await this.transformContent(chapter.content);

        // Generate complete XHTML document
        const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${locale}"${isRTL ? ' dir="rtl"' : ''}>
<head>
  <title>${chapter.title}</title>
  <link rel="stylesheet" type="text/css" href="../Styles/page.css"/>
</head>
<body>
  ${transformedContent.xhtml}
</body>
</html>`;

        transformedChapters.push({
          id: chapter.id,
          title: chapter.title,
          fileName: `${chapter.id}.txt`,
          content: chapter.content,
          xhtmlContent,
        });
      }

      // Generate navigation document content
      const navContent = this.generateNavigationContent(chapters, locale, isRTL);

      // Create asset files
      const assets = [
        {
          path: 'OEBPS/Styles/page.css',
          content: pageCSS,
        },
        {
          path: 'SOURCE/scripts/transformText.js',
          content: transformTextJS,
        },
        {
          path: 'SOURCE/scripts/transformDom.js',
          content: transformDomJS,
        },
        {
          path: 'SOURCE/settings.json',
          content: JSON.stringify(
            {
              version: '1.0.0',
              text_transform: 'SOURCE/scripts/transformText.js',
              dom_transforms: ['SOURCE/scripts/transformDom.js'],
            },
            null,
            2
          ),
        },
        {
          path: 'OEBPS/nav.xhtml',
          content: navContent,
        },
      ];

      // Generate manifest updates
      const manifestUpdates = [
        {
          id: 'page-css',
          href: 'Styles/page.css',
          mediaType: 'text/css',
        },
        {
          id: 'nav',
          href: 'nav.xhtml',
          mediaType: 'application/xhtml+xml',
          properties: ['nav'],
        },
        ...chapters.map(chapter => ({
          id: chapter.id,
          href: `Text/${chapter.id}.xhtml`,
          mediaType: 'application/xhtml+xml',
        })),
      ];

      // Generate spine updates
      const spineUpdates = chapters.map(chapter => ({ idref: chapter.id }));

      return {
        chapters: transformedChapters,
        assets,
        manifestUpdates,
        spineUpdates,
      };
    } catch (error) {
      throw new ContentServiceError(
        `Failed to generate sample content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SAMPLE_CONTENT_ERROR'
      );
    }
  }

  /**
   * Generate navigation document content (PURE FUNCTION)
   */
  private generateNavigationContent(
    chapters: DemoChapter[],
    locale: string,
    isRTL: boolean
  ): string {
    const navTitle = this.i18nSystem.translate('navigation.title') || 'Navigation';
    const tocTitle = this.i18nSystem.translate('navigation.tableOfContents') || 'Table of Contents';

    const chapterLinks = chapters
      .map(chapter => {
        const chapterTitle = this.i18nSystem.translate(`content.${chapter.id}`) || chapter.title;
        return `      <li><a href="${chapter.id}.xhtml">${this.escapeHtml(chapterTitle)}</a></li>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${locale}" lang="${locale}"${isRTL ? ' dir="rtl"' : ''}>
<head>
  <title>${this.escapeHtml(navTitle)}</title>
</head>
<body>
  <nav epub:type="toc" id="doc-toc">
    <h1>${this.escapeHtml(tocTitle)}</h1>
    <ol>
${chapterLinks}
    </ol>
  </nav>
</body>
</html>`;
  }

  /**
   * Transform plain text content to XHTML using transform pipeline
   */
  async transformContent(
    sourceText: string,
    context?: TransformContext,
    idref?: string
  ): Promise<TransformResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      const contextWithIdref = { ...context, idref };
      const xhtml = await this.transformExecutor.executeTextTransform(
        transformTextJS,
        'transformText.js',
        sourceText,
        contextWithIdref,
        { timeoutMs: 5000 }
      );

      const transformTime = Date.now() - startTime;

      return {
        xhtml,
        warnings,
        transformTime,
      };
    } catch (error) {
      const transformTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown transform error';

      // Return graceful fallback with warnings
      return {
        xhtml: `<p>${this.escapeHtml(sourceText)}</p>`,
        warnings: [errorMessage],
        transformTime,
      };
    }
  }

  /**
   * Generate content preview (simplified version of transformContent)
   */
  async previewContent(sourceText: string, context?: TransformContext): Promise<ContentPreview> {
    const result = await this.transformContent(sourceText, context);

    return {
      previewHtml: result.xhtml,
      warnings: result.warnings,
    };
  }

  /**
   * Generate EPUB-compliant navigation from pre-loaded chapter content
   */
  generateNavigationFromContent(chapters: ChapterContent[]): NavigationDocument {
    // Filter to only linear chapters
    const linearChapters = chapters.filter(chapter => chapter.linear);

    // Generate navigation entries
    const navEntries = linearChapters
      .map(chapter => {
        const title = this.extractTitleFromXHTML(chapter.xhtmlContent) || chapter.id;
        return `    <li><a href="${chapter.href}">${this.escapeHtml(title)}</a></li>`;
      })
      .join('\n');

    // Generate complete navigation XHTML
    const navTitle = this.i18nSystem.translate('navigation.tableOfContents');
    const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head>
  <title>${this.escapeHtml(navTitle)}</title>
</head>
<body>
  <nav epub:type="toc" role="doc-toc">
    <h1>${this.escapeHtml(navTitle)}</h1>
    <ol>
${navEntries}
    </ol>
  </nav>
</body>
</html>`;

    return {
      xhtmlContent,
      metadata: {
        id: 'nav',
        href: 'nav.xhtml',
        mediaType: 'application/xhtml+xml',
        properties: ['nav'],
        linear: false,
      },
    };
  }

  /**
   * Process user-written navigation content into EPUB-compliant XHTML
   */
  processUserNavigation(navText: string): NavigationDocument {
    const navTitle = this.i18nSystem.translate('navigation.tableOfContents');

    if (!navText.trim()) {
      // Handle empty navigation
      const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head>
  <title>${this.escapeHtml(navTitle)}</title>
</head>
<body>
  <nav epub:type="toc" role="doc-toc">
    <h1>${this.escapeHtml(navTitle)}</h1>
    <ol></ol>
  </nav>
</body>
</html>`;

      return {
        xhtmlContent,
        metadata: {
          id: 'nav',
          href: 'nav.xhtml',
          mediaType: 'application/xhtml+xml',
          properties: ['nav'],
          linear: false,
        },
      };
    }

    // Parse navigation entries from user text
    const navEntries = this.parseNavigationEntries(navText);
    const navEntriesHtml = navEntries
      .map(entry => `    <li><a href="${entry.href}">${this.escapeHtml(entry.title)}</a></li>`)
      .join('\n');

    const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head>
  <title>${this.escapeHtml(navTitle)}</title>
</head>
<body>
  <nav epub:type="toc" role="doc-toc">
    <h1>${this.escapeHtml(navTitle)}</h1>
    <ol>
${navEntriesHtml}
    </ol>
  </nav>
</body>
</html>`;

    return {
      xhtmlContent,
      metadata: {
        id: 'nav',
        href: 'nav.xhtml',
        mediaType: 'application/xhtml+xml',
        properties: ['nav'],
        linear: false,
      },
    };
  }

  /**
   * Generate complete localized sample content
   */
  async generateLocalizedContent(locale: string): Promise<LocalizedSampleContent> {
    if (!ContentService.SUPPORTED_LOCALES.has(locale)) {
      throw new UnsupportedLocaleError(locale);
    }

    const isRTL = ContentService.RTL_LOCALES.has(locale);

    // Generate localized metadata
    const metadata = await this.generateLocalizedMetadata(locale);

    // Generate localized chapters
    const chapters = await this.generateLocalizedChapters(locale);

    return {
      locale,
      metadata,
      chapters,
      isRTL,
      pageProgressionDirection: isRTL ? 'rtl' : 'ltr',
    };
  }

  /**
   * Generate localized metadata
   */
  async generateLocalizedMetadata(locale: string): Promise<EPUBMetadata> {
    const sampleTitle = this.i18nSystem.translate('sample.title');
    const sampleAuthor = this.i18nSystem.translate('sample.author');
    const sampleDescription = this.i18nSystem.translate('sample.description');

    return {
      title: sampleTitle || 'Sample Book',
      language: [locale],
      identifier: `urn:uuid:sample-${Date.now()}`,
      creator: [{ name: sampleAuthor || 'Sample Author', roles: [] }],
      description: sampleDescription || 'A sample book for demonstration purposes',
      modifiedDate: generateEPUBTimestamp(),
    };
  }

  /**
   * Generate localized chapter content
   */
  async generateLocalizedChapters(locale: string): Promise<DemoChapter[]> {
    // Delegate to the more comprehensive SampleContentGenerator
    const catalogs = this.i18nSystem.getCatalogs();
    const generator = new SampleContentGenerator(catalogs);
    return generator.generateLocalizedChapters(locale);
  }

  // Private helper methods

  private extractTitleFromXHTML(xhtmlContent: string): string | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xhtmlContent, 'text/xml');

      // Look for headings in order of preference
      const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      for (const heading of headings) {
        const element = doc.querySelector(heading);
        if (element && element.textContent?.trim()) {
          return element.textContent.trim();
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private parseNavigationEntries(navText: string): Array<{ title: string; href: string }> {
    const entries: Array<{ title: string; href: string }> = [];
    const lines = navText.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and headers
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Try to parse markdown-style links: [Title](href)
      const markdownMatch = trimmedLine.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (markdownMatch) {
        entries.push({
          title: markdownMatch[1],
          href: markdownMatch[2],
        });
        continue;
      }

      // Try to parse plain text: "Title - href"
      const plainMatch = trimmedLine.match(/^(.+?)\s*-\s*(.+)$/);
      if (plainMatch) {
        entries.push({
          title: plainMatch[1].trim(),
          href: plainMatch[2].trim(),
        });
        continue;
      }

      // Try to parse list items: "- Title"
      const listMatch = trimmedLine.match(/^-\s*(.+)$/);
      if (listMatch) {
        // If it's just a list item without href, use the title as href
        const title = listMatch[1].trim();
        entries.push({
          title,
          href: `Text/${title.toLowerCase().replace(/\s+/g, '_')}.xhtml`,
        });
      }
    }

    return entries;
  }

  private generateSampleChapterContent(_locale: string, chapterNumber: number): string {
    // Generate basic sample content in markdown format
    const chapterTitle = `# ${this.i18nSystem.translate(`content.chapter${chapterNumber}`) || `Chapter ${chapterNumber}`}`;

    // Simple sample content that works for any locale
    const content = `
${chapterTitle}

This is sample content for demonstration purposes.

## Section 1

Here is some **bold text** and *italic text*.

## Section 2

Here is more sample content with additional paragraphs to demonstrate the transformation process.

This concludes the sample chapter.
    `;

    return content.trim();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Validate file content based on file type
   * For JavaScript files, validates both syntax and runtime errors (ReferenceError, TypeError)
   *
   * @param content - File content to validate
   * @param fileType - File type identifier
   * @returns null if valid, error message if invalid
   */
  validateFileContent(content: string, fileType: string): string | null {
    if (JavaScriptValidator.shouldValidate(fileType)) {
      return JavaScriptValidator.validateSyntax(content);
    }

    // Future: Add validation for other file types (CSS, JSON, etc.)
    return null; // Non-validated file types are always valid
  }
}
