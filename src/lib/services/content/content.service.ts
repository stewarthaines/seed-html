/**
 * ContentService - Clean Service Architecture Implementation
 * 
 * Handles content transformation, navigation generation, and sample content creation
 * following the clean service architecture with single responsibility principle.
 */

import type { WorkspaceState } from '../workspace/workspace.service.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { TransformExecutor, TransformContext } from '../../transform/transform-executor.js';
import type { TranslationFunction } from '../../i18n/types.js';
import type { EPUBMetadata } from '../../epub/opf-utils.js';
import { SampleContentGenerator } from '../../content/sample-content-generator.js';
import { i18nService } from '../../i18n/index.js';
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

export interface ChapterContent {
  id: string;
  href: string;
  xhtmlContent: string;
  linear: boolean;
}

export interface NavigationDocument {
  xhtmlContent: string;
  metadata: {
    id: string;
    properties: string[];
  };
  sourceType: 'auto-generated' | 'user-content';
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
  constructor(message: string, public code: string) {
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
    'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'da', 'no', 'fi', 'ru', 'pl', 'cs', 'hu', 'ro', 'bg',
    'hr', 'sk', 'sl', 'et', 'lv', 'lt', 'el', 'tr', 'ar', 'he', 'fa', 'ur', 'hi', 'bn', 'ta', 'te', 'ml',
    'kn', 'gu', 'pa', 'or', 'as', 'ne', 'si', 'my', 'km', 'lo', 'vi', 'th', 'id', 'ms', 'tl', 'zh', 'ja', 'ko'
  ]);

  // RTL languages
  private static readonly RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur']);

  constructor(
    private transformExecutor: TransformExecutor,
    private i18nSystem: { translate: TranslationFunction; getCatalogs: () => any; isInitialized: () => boolean; getCurrentLocale: () => string },
    private workspaceService?: WorkspaceService
  ) {}

  /**
   * Add localized sample content to a workspace (NEW SERVICE INTEGRATION METHOD)
   */
  async addLocalizedSampleContent(workspace: WorkspaceState, locale: string = 'en'): Promise<WorkspaceState> {
    if (!this.workspaceService) {
      throw new ContentServiceError('WorkspaceService not provided to ContentService', 'MISSING_WORKSPACE_SERVICE');
    }

    try {
      // Step 1: Install universal assets
      let updatedWorkspace = await this.installUniversalAssets(workspace);

      // Step 2: Generate and install sample content using existing method
      const sampleContent = await this.generateLocalizedContent(locale);
      updatedWorkspace = await this.createSampleContentFiles(updatedWorkspace, sampleContent);

      return updatedWorkspace;
    } catch (error) {
      throw new ContentServiceError(
        `Failed to add localized sample content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SAMPLE_CONTENT_ERROR'
      );
    }
  }

  /**
   * Install universal CSS and transform scripts
   */
  private async installUniversalAssets(workspace: WorkspaceState): Promise<WorkspaceState> {
    if (!this.workspaceService) {
      throw new ContentServiceError('WorkspaceService not provided', 'MISSING_WORKSPACE_SERVICE');
    }

    // Install universal CSS
    await this.workspaceService.writeFile(workspace.id, 'OEBPS/Styles/page.css', pageCSS);

    // Install transform scripts
    await this.workspaceService.writeFile(workspace.id, 'SOURCE/scripts/transformText.js', transformTextJS);
    await this.workspaceService.writeFile(workspace.id, 'SOURCE/scripts/transformDom.js', transformDomJS);

    // Create settings.json with transform configuration
    const settings = {
      version: '1.0.0',
      transforms: {
        text: {
          script: 'transformText.js',
          enabled: true,
        },
        dom: {
          script: 'transformDom.js',
          enabled: true,
        },
      },
    };

    await this.workspaceService.writeFile(
      workspace.id,
      'SOURCE/settings.json',
      JSON.stringify(settings, null, 2)
    );

    return workspace;
  }

  /**
   * Create sample content files in workspace
   */
  private async createSampleContentFiles(workspace: WorkspaceState, sampleContent: LocalizedSampleContent): Promise<WorkspaceState> {
    if (!this.workspaceService) {
      throw new ContentServiceError('WorkspaceService not provided', 'MISSING_WORKSPACE_SERVICE');
    }

    const { chapters, locale, isRTL } = sampleContent;

    // Create SOURCE text files
    for (const chapter of chapters) {
      await this.workspaceService.writeFile(
        workspace.id,
        `SOURCE/text/${chapter.id}.txt`,
        chapter.content
      );
    }

    // Transform text to XHTML and create OEBPS files
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

      await this.workspaceService.writeFile(
        workspace.id,
        `OEBPS/Text/${chapter.id}.xhtml`,
        xhtmlContent
      );
    }

    // Create navigation document
    await this.createNavigationDocument(workspace, chapters, locale, isRTL);

    // Update manifest and spine
    let updatedWorkspace = await this.updateManifestAndSpine(workspace, chapters);

    return updatedWorkspace;
  }

  /**
   * Create localized navigation document
   */
  private async createNavigationDocument(
    workspace: WorkspaceState,
    chapters: DemoChapter[],
    locale: string,
    isRTL: boolean
  ): Promise<void> {
    if (!this.workspaceService) {
      throw new ContentServiceError('WorkspaceService not provided', 'MISSING_WORKSPACE_SERVICE');
    }

    const navTitle = this.i18nSystem.translate('navigation.title') || 'Navigation';
    const tocTitle = this.i18nSystem.translate('navigation.tableOfContents') || 'Table of Contents';

    const chapterLinks = chapters
      .map(chapter => {
        const chapterTitle = this.i18nSystem.translate(`content.${chapter.id}`) || chapter.title;
        return `      <li><a href="${chapter.id}.xhtml">${this.escapeHtml(chapterTitle)}</a></li>`;
      })
      .join('\n');

    const navContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${locale}"${isRTL ? ' dir="rtl"' : ''}>
<head>
  <title>${this.escapeHtml(navTitle)}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${this.escapeHtml(tocTitle)}</h1>
    <ol>
${chapterLinks}
    </ol>
  </nav>
</body>
</html>`;

    await this.workspaceService.writeFile(workspace.id, 'OEBPS/Text/nav.xhtml', navContent);
  }

  /**
   * Update manifest and spine with generated content
   */
  private async updateManifestAndSpine(workspace: WorkspaceState, chapters: DemoChapter[]): Promise<WorkspaceState> {
    if (!this.workspaceService) {
      throw new ContentServiceError('WorkspaceService not provided', 'MISSING_WORKSPACE_SERVICE');
    }

    // Add CSS to manifest
    let updatedWorkspace = await this.workspaceService.addManifestItem(workspace, {
      id: 'page-css',
      href: 'Styles/page.css',
      mediaType: 'text/css',
    });

    // Add navigation document to manifest
    updatedWorkspace = await this.workspaceService.addManifestItem(updatedWorkspace, {
      id: 'nav',
      href: 'Text/nav.xhtml',
      mediaType: 'application/xhtml+xml',
      properties: ['nav'],
    });

    // Add chapters to manifest
    for (const chapter of chapters) {
      updatedWorkspace = await this.workspaceService.addManifestItem(updatedWorkspace, {
        id: chapter.id,
        href: `Text/${chapter.id}.xhtml`,
        mediaType: 'application/xhtml+xml',
      });
    }

    // Update spine order
    const spineItems = chapters.map(chapter => chapter.id);
    updatedWorkspace = await this.workspaceService.updateSpineOrder(updatedWorkspace, spineItems);

    return updatedWorkspace;
  }

  /**
   * Transform plain text content to XHTML using transform pipeline
   */
  async transformContent(sourceText: string, context?: TransformContext): Promise<TransformResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      const xhtml = await this.transformExecutor.executeTextTransform(
        transformTextJS,
        'transformText.js',
        sourceText,
        context || {},
        { timeoutMs: 5000 }
      );

      const transformTime = Date.now() - startTime;

      return {
        xhtml,
        warnings,
        transformTime
      };
    } catch (error) {
      const transformTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown transform error';
      
      // Return graceful fallback with warnings
      return {
        xhtml: `<p>${this.escapeHtml(sourceText)}</p>`,
        warnings: [errorMessage],
        transformTime
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
      warnings: result.warnings
    };
  }

  /**
   * Generate EPUB-compliant navigation from pre-loaded chapter content
   */
  generateNavigationFromContent(chapters: ChapterContent[]): NavigationDocument {
    // Filter to only linear chapters
    const linearChapters = chapters.filter(chapter => chapter.linear);

    // Generate navigation entries
    const navEntries = linearChapters.map(chapter => {
      const title = this.extractTitleFromXHTML(chapter.xhtmlContent) || chapter.id;
      return `    <li><a href="${chapter.href}">${this.escapeHtml(title)}</a></li>`;
    }).join('\n');

    // Generate complete navigation XHTML
    const navTitle = this.i18nSystem.translate('navigation.tableOfContents');
    const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${this.escapeHtml(navTitle)}</title>
</head>
<body>
  <nav epub:type="toc" role="navigation">
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
        properties: ['nav']
      },
      sourceType: 'auto-generated'
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
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${this.escapeHtml(navTitle)}</title>
</head>
<body>
  <nav epub:type="toc" role="navigation">
    <h1>${this.escapeHtml(navTitle)}</h1>
    <ol></ol>
  </nav>
</body>
</html>`;

      return {
        xhtmlContent,
        metadata: {
          id: 'nav',
          properties: ['nav']
        },
        sourceType: 'user-content'
      };
    }

    // Parse navigation entries from user text
    const navEntries = this.parseNavigationEntries(navText);
    const navEntriesHtml = navEntries.map(entry => 
      `    <li><a href="${entry.href}">${this.escapeHtml(entry.title)}</a></li>`
    ).join('\n');

    const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${this.escapeHtml(navTitle)}</title>
</head>
<body>
  <nav epub:type="toc" role="navigation">
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
        properties: ['nav']
      },
      sourceType: 'user-content'
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
      pageProgressionDirection: isRTL ? 'rtl' : 'ltr'
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
      language: locale,
      identifier: `urn:uuid:sample-${Date.now()}`,
      creator: [sampleAuthor || 'Sample Author'],
      description: sampleDescription || 'A sample book for demonstration purposes',
      modifiedDate: new Date().toISOString()
    };
  }

  /**
   * Generate localized chapter content
   */
  async generateLocalizedChapters(locale: string): Promise<DemoChapter[]> {
    // Generate sample chapters based on locale
    const chapters: DemoChapter[] = [
      {
        id: 'chapter1',
        title: this.i18nSystem.translate('content.chapter1') || 'Chapter 1',
        content: this.generateSampleChapterContent(locale, 1),
        linear: true,
        mediaType: 'application/xhtml+xml'
      },
      {
        id: 'chapter2',
        title: this.i18nSystem.translate('content.chapter2') || 'Chapter 2',
        content: this.generateSampleChapterContent(locale, 2),
        linear: true,
        mediaType: 'application/xhtml+xml'
      }
    ];

    return chapters;
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
          href: markdownMatch[2]
        });
        continue;
      }

      // Try to parse plain text: "Title - href"
      const plainMatch = trimmedLine.match(/^(.+?)\s*-\s*(.+)$/);
      if (plainMatch) {
        entries.push({
          title: plainMatch[1].trim(),
          href: plainMatch[2].trim()
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
          href: `Text/${title.toLowerCase().replace(/\s+/g, '_')}.xhtml`
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
}