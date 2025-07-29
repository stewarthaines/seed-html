/**
 * Test fixtures for OutlineGenerator testing
 * 
 * Provides factory functions for creating consistent test data including
 * mock spine items, XHTML content, and expected navigation structures.
 * Uses factory pattern to prevent test pollution.
 */

import type { SpineItemWithSource } from '../../spine/types.js';
import type { NavigationDocument, NavigationMetadata, GenerationOptions, ProcessingOptions } from '../index.js';

/**
 * Create mock spine items with various configurations
 */
export function createMockSpineItems(): SpineItemWithSource[] {
  return [
    {
      idref: 'chapter1',
      id: 'chapter1',
      href: 'chapter1.xhtml',
      mediaType: 'application/xhtml+xml',
      linear: true,
      properties: [],
      hasSourceFile: true,
    },
    {
      idref: 'chapter2',
      id: 'chapter2', 
      href: 'chapter2.xhtml',
      mediaType: 'application/xhtml+xml',
      linear: true,
      properties: [],
      hasSourceFile: true,
    },
    {
      idref: 'chapter3',
      id: 'chapter3',
      href: 'chapter3.xhtml', 
      mediaType: 'application/xhtml+xml',
      linear: true,
      properties: [],
      hasSourceFile: true,
    },
  ];
}

/**
 * Create spine items without titles (for fallback testing)
 */
export function createSpineItemsWithoutTitles(): SpineItemWithSource[] {
  return [
    {
      idref: 'untitled1',
      id: 'untitled1',
      href: 'untitled1.xhtml',
      mediaType: 'application/xhtml+xml', 
      linear: true,
      properties: [],
      hasSourceFile: false,
    },
    {
      idref: 'untitled2',
      id: 'untitled2',
      href: 'untitled2.xhtml',
      mediaType: 'application/xhtml+xml',
      linear: true, 
      properties: [],
      hasSourceFile: false,
    },
  ];
}

/**
 * Create spine items with mixed configurations
 */
export function createMixedSpineItems(): SpineItemWithSource[] {
  return [
    {
      idref: 'intro',
      id: 'intro',
      href: 'introduction.xhtml',
      mediaType: 'application/xhtml+xml',
      linear: true,
      properties: [],
      hasSourceFile: true,
    },
    {
      idref: 'ch1',
      id: 'ch1',
      href: 'chapter-001.xhtml', 
      mediaType: 'application/xhtml+xml',
      linear: true,
      properties: [],
      hasSourceFile: false,
    },
    {
      idref: 'appendix',
      id: 'appendix',
      href: 'appendix.xhtml',
      mediaType: 'application/xhtml+xml', 
      linear: false,
      properties: [],
      hasSourceFile: true,
    },
  ];
}

/**
 * Create well-formed XHTML content with heading
 */
export function createMockXHTMLContent(title: string = 'Default Title'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${title}</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <h1>${title}</h1>
  <p>Chapter content goes here...</p>
</body>
</html>`;
}

/**
 * Create XHTML content with H2 heading (for title extraction testing)
 */
export function createXHTMLWithH2(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Document Title</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <h2>${title}</h2>
  <p>Content with H2 heading...</p>
</body>
</html>`;
}

/**
 * Create XHTML content without any headings (for fallback testing)
 */
export function createXHTMLWithoutHeadings(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>No Headings Document</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <p>This document has no headings at all.</p>
  <p>Just plain paragraphs.</p>
</body>
</html>`;
}

/**
 * Create XHTML content with empty headings
 */
export function createXHTMLWithEmptyHeading(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Empty Heading</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <h1></h1>
  <p>Content with empty heading...</p>
</body>
</html>`;
}

/**
 * Create XHTML content with HTML tags in title (for stripping test)
 */
export function createXHTMLWithTagsInTitle(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Tagged Title</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <h1>Chapter <em>One</em>: <strong>The Beginning</strong></h1>
  <p>Content with tagged title...</p>
</body>
</html>`;
}

/**
 * Create malformed XHTML for error testing
 */
export function createMalformedXHTML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Broken</title></head>
<body>
  <h1>Title
  <p>Unclosed tags...
  <div class="broken
</html>`;
}

/**
 * Create expected navigation XHTML structure
 */
export function createExpectedNavigationXHTML(items: Array<{href: string, title: string}>): string {
  const listItems = items.map(item => 
    `      <li><a href="${item.href}">${item.title}</a></li>`
  ).join('\n');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Table of Contents</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <nav epub:type="toc" role="navigation">
    <h1>Table of Contents</h1>
    <ol>
${listItems}
    </ol>
  </nav>
</body>
</html>`;
}

/**
 * Create expected navigation metadata
 */
export function createExpectedNavigationMetadata(): NavigationMetadata {
  return {
    id: 'nav',
    href: 'nav.xhtml',
    mediaType: 'application/xhtml+xml',
    properties: ['nav'],
    linear: false,
  };
}

/**
 * Create mock generation options
 */
export function createMockGenerationOptions(): GenerationOptions {
  return {
    includeUntitled: true,
    titleStrategy: 'heading',
    documentTitle: 'Table of Contents',
    cssClasses: {
      nav: 'epub-nav',
      list: 'toc-list',
    },
  };
}

/**
 * Create mock processing options
 */
export function createMockProcessingOptions(): ProcessingOptions {
  return {
    validationLevel: 'strict',
    errorHandling: 'throw',
    documentTitle: 'Navigation',
  };
}

/**
 * Create mock user navigation content (plain text)
 */
export function createMockUserNavContent(): string {
  return `
Chapter 1: The Beginning
Chapter 2: The Middle
Chapter 3: The End
`;
}

/**
 * Create mock transformed navigation content (XHTML result)
 */
export function createMockTransformedNavContent(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Navigation</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <nav epub:type="toc" role="navigation">
    <h1>Navigation</h1>
    <ol>
      <li><a href="chapter1.xhtml">Chapter 1: The Beginning</a></li>
      <li><a href="chapter2.xhtml">Chapter 2: The Middle</a></li>
      <li><a href="chapter3.xhtml">Chapter 3: The End</a></li>
    </ol>
  </nav>
</body>
</html>`;
}

/**
 * Create expected NavigationDocument for auto-generation
 */
export function createExpectedAutoGeneratedNavDocument(): NavigationDocument {
  return {
    xhtmlContent: createExpectedNavigationXHTML([
      { href: 'chapter1.xhtml', title: 'Chapter 1' },
      { href: 'chapter2.xhtml', title: 'Chapter 2' },
      { href: 'chapter3.xhtml', title: 'Chapter 3' },
    ]),
    metadata: createExpectedNavigationMetadata(),
    generatedAt: new Date(),
    sourceType: 'auto-generated',
  };
}

/**
 * Create expected NavigationDocument for user content
 */
export function createExpectedUserContentNavDocument(): NavigationDocument {
  return {
    xhtmlContent: createMockTransformedNavContent(),
    metadata: createExpectedNavigationMetadata(),
    generatedAt: new Date(),
    sourceType: 'user-content',
  };
}

/**
 * Create workspace file structure for testing
 */
export function createWorkspaceFiles(): Record<string, string> {
  return {
    'OEBPS/chapter1.xhtml': createMockXHTMLContent('Chapter 1'),
    'OEBPS/chapter2.xhtml': createMockXHTMLContent('Chapter 2'),
    'OEBPS/chapter3.xhtml': createMockXHTMLContent('Chapter 3'),
  };
}

/**
 * Create workspace files with mixed heading structures
 */
export function createMixedWorkspaceFiles(): Record<string, string> {
  return {
    'OEBPS/introduction.xhtml': createMockXHTMLContent('Introduction'),
    'OEBPS/chapter-001.xhtml': createXHTMLWithH2('Getting Started'),
    'OEBPS/appendix.xhtml': createXHTMLWithoutHeadings(),
  };
}

/**
 * Create workspace files with problematic content
 */
export function createProblematicWorkspaceFiles(): Record<string, string> {
  return {
    'OEBPS/untitled1.xhtml': createXHTMLWithEmptyHeading(),
    'OEBPS/untitled2.xhtml': createXHTMLWithTagsInTitle(),
    'OEBPS/broken.xhtml': createMalformedXHTML(),
  };
}

/**
 * Validation helpers for test assertions
 */
export function expectValidEPUBStructure(xhtml: string): void {
  // These are helper functions that tests can use for common validations
  if (!xhtml.includes('<?xml version="1.0" encoding="UTF-8"?>')) {
    throw new Error('Missing XML declaration');
  }
  if (!xhtml.includes('<!DOCTYPE html>')) {
    throw new Error('Missing DOCTYPE');
  }
  if (!xhtml.includes('xmlns="http://www.w3.org/1999/xhtml"')) {
    throw new Error('Missing XHTML namespace');
  }
  if (!xhtml.includes('xmlns:epub="http://www.idpf.org/2007/ops"')) {
    throw new Error('Missing EPUB namespace');
  }
  if (!xhtml.includes('epub:type="toc"')) {
    throw new Error('Missing epub:type="toc"');
  }
  if (!xhtml.includes('role="navigation"')) {
    throw new Error('Missing role="navigation"');
  }
}

export function expectValidNavigationMetadata(metadata: NavigationMetadata): void {
  if (metadata.id !== 'nav') {
    throw new Error(`Expected metadata.id to be 'nav', got '${metadata.id}'`);
  }
  if (metadata.href !== 'nav.xhtml') {
    throw new Error(`Expected metadata.href to be 'nav.xhtml', got '${metadata.href}'`);
  }
  if (metadata.mediaType !== 'application/xhtml+xml') {
    throw new Error(`Expected mediaType to be 'application/xhtml+xml', got '${metadata.mediaType}'`);
  }
  if (!Array.isArray(metadata.properties) || !metadata.properties.includes('nav')) {
    throw new Error('Expected properties to include "nav"');
  }
  if (metadata.linear !== false) {
    throw new Error(`Expected linear to be false, got ${metadata.linear}`);
  }
}