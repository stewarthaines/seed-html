/**
 * Test data generation utilities for Transform Pipeline unit tests
 * Provides standardized test fixtures and data creation helpers
 */

/**
 * Default transform pipeline settings for testing
 */
export const DEFAULT_TRANSFORM_SETTINGS = {
  transform_pipeline: {
    text_transform: 'markdown-transform.js',
    dom_transforms: ['heading-ids.js', 'custom-styling.js'],
  },
};

/**
 * Alternative transform settings for testing
 */
export const ALTERNATIVE_TRANSFORM_SETTINGS = {
  transform_pipeline: {
    text_transform: 'asciidoc-transform.js',
    dom_transforms: ['toc-generator.js', 'footnote-processor.js', 'image-optimizer.js'],
  },
};

/**
 * Sample transform scripts for testing
 */
export const SAMPLE_TRANSFORM_SCRIPTS = {
  'markdown-transform.js': `
function transformText(plainText, context) {
  if (typeof markdownit === 'undefined') {
    throw new Error('markdown-it library not available');
  }
  
  const md = markdownit({
    html: true,
    xhtmlOut: true,
    breaks: false,
    linkify: true
  });
  
  // Handle :toc directive
  if (context.manifestItems) {
    plainText = plainText.replace(
      /:toc\\[([^\\]]+)\\]\\{src="([^"]+)"\\}/g,
      (match, title, pattern) => {
        const items = Object.keys(context.manifestItems)
          .filter(id => id.match(new RegExp(pattern)))
          .map(id => \`<li><a href="#\${id}">\${id}</a></li>\`)
          .join('');
        return \`<h2>\${title}</h2><ul>\${items}</ul>\`;
      }
    );
  }
  
  return md.render(plainText);
}
`.trim(),

  'asciidoc-transform.js': `
function transformText(plainText, context) {
  // Simple AsciiDoc-style transform
  let html = plainText
    .replace(/^= (.+)$/gm, '<h1>$1</h1>')
    .replace(/^== (.+)$/gm, '<h2>$1</h2>')
    .replace(/^=== (.+)$/gm, '<h3>$1</h3>')
    .replace(/\\*(.+?)\\*/g, '<strong>$1</strong>')
    .replace(/\\n\\n/g, '</p><p>')
    .replace(/^(?!<)(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\\/p>/g, '');
  
  return html;
}
`.trim(),

  'heading-ids.js': `
function transformDOM(document) {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  
  headings.forEach((heading, index) => {
    if (!heading.id) {
      const text = heading.textContent || '';
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\\s-]/g, '')
        .replace(/\\s+/g, '-')
        .replace(/^-|-$/g, '') || \`heading-\${index + 1}\`;
      
      heading.id = id;
    }
  });
  
  return document;
}
`.trim(),

  'custom-styling.js': `
function transformDOM(document) {
  // Add custom CSS classes
  const headings = document.querySelectorAll('h1, h2, h3');
  headings.forEach(h => h.classList.add('custom-header'));
  
  const paragraphs = document.querySelectorAll('p');
  paragraphs.forEach(p => p.classList.add('content-paragraph'));
  
  const links = document.querySelectorAll('a');
  links.forEach(a => a.classList.add('content-link'));
  
  return document;
}
`.trim(),

  'toc-generator.js': `
function transformDOM(document) {
  const headings = document.querySelectorAll('h2, h3, h4');
  if (headings.length === 0) return document;
  
  const toc = document.createElement('nav');
  toc.className = 'table-of-contents';
  toc.innerHTML = '<h2>Table of Contents</h2>';
  
  const list = document.createElement('ul');
  headings.forEach(heading => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = \`#\${heading.id || 'heading'}\`;
    a.textContent = heading.textContent;
    li.appendChild(a);
    list.appendChild(li);
  });
  
  toc.appendChild(list);
  document.body.insertBefore(toc, document.body.firstChild);
  
  return document;
}
`.trim(),

  'footnote-processor.js': `
function transformDOM(document) {
  const footnoteRefs = document.querySelectorAll('.footnote-ref');
  const footnotes = document.createElement('section');
  footnotes.className = 'footnotes';
  footnotes.innerHTML = '<h2>Footnotes</h2><ol></ol>';
  
  footnoteRefs.forEach((ref, index) => {
    const id = \`fn\${index + 1}\`;
    ref.id = \`fnref\${index + 1}\`;
    ref.innerHTML = \`<a href="#\${id}">\${index + 1}</a>\`;
    
    const li = document.createElement('li');
    li.id = id;
    li.innerHTML = \`\${ref.title || 'Footnote'} <a href="#fnref\${index + 1}">↩</a>\`;
    footnotes.querySelector('ol').appendChild(li);
  });
  
  if (footnoteRefs.length > 0) {
    document.body.appendChild(footnotes);
  }
  
  return document;
}
`.trim(),

  'broken-syntax.js': `
function transformText(plainText, context) {
  // Missing closing brace - syntax error
  if (plainText.includes('test')) {
    return plainText.toUpperCase();
  // Missing }
}
`.trim(),

  'runtime-error.js': `
function transformText(plainText, context) {
  // Runtime error - accessing undefined property
  return context.nonExistent.property.that.does.not.exist;
}
`.trim(),

  'timeout-script.js': `
function transformText(plainText, context) {
  // Infinite loop to test timeout
  while (true) {
    // This will timeout
  }
  return plainText;
}
`.trim(),

  'both-functions.js': `
function transformText(plainText, context) {
  return '<p>' + plainText.replace(/\\n/g, '</p><p>') + '</p>';
}

function transformDOM(document) {
  const paragraphs = document.querySelectorAll('p');
  paragraphs.forEach(p => p.style.marginBottom = '1em');
  return document;
}
`.trim(),
};

/**
 * Sample extension libraries for testing
 */
export const SAMPLE_EXTENSION_LIBRARIES = {
  'markdown-it/markdown-it.min.js': `
// Mock markdown-it library
window.markdownit = function(options) {
  return {
    render: function(text) {
      return text.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    }
  };
};
`.trim(),

  'abcjs/abcjs-basic.min.js': `
// Mock ABCJS library
window.ABCJS = {
  renderAbc: function(elementId, abcString, options) {
    return '<div class="abcjs-music">' + abcString + '</div>';
  }
};
`.trim(),

  'prism/prism.min.js': `
// Mock Prism syntax highlighter
window.Prism = {
  highlight: function(code, grammar, language) {
    return '<span class="token">' + code + '</span>';
  },
  languages: {
    javascript: {},
    css: {},
    html: {}
  }
};
`.trim(),
};

/**
 * Chapter metadata for XHTML generation testing
 */
export const SAMPLE_CHAPTER_METADATA = {
  basic: {
    title: 'Chapter 1: Introduction',
    language: 'en',
    stylesheets: ['../Styles/stylesheet.css'],
    scripts: [],
  },

  advanced: {
    title: 'Chapter 2: Advanced Topics',
    language: 'en',
    stylesheets: [
      '../Styles/main.css',
      '../Styles/chapter.css',
      '../Styles/syntax-highlighting.css',
    ],
    scripts: ['../Scripts/reader.js', '../Scripts/interactive.js'],
    customHead: '<meta name="chapter" content="2" />',
  },

  multilingual: {
    title: 'Chapitre 1: Introduction',
    language: 'fr',
    stylesheets: ['../Styles/french.css'],
    scripts: [],
  },
};

/**
 * Sample plain text content for transformation testing
 */
export const SAMPLE_PLAIN_TEXT = {
  markdown: `# Chapter 1: Getting Started

This is the first chapter of our book. It covers the **basics** of the topic.

## Section 1.1: Overview

Here we provide an *overview* of what you'll learn:

- Basic concepts
- Key principles  
- Practical examples

## Section 1.2: Prerequisites

Before starting, you should have:

1. Basic understanding of the topic
2. Required software installed
3. Sample files downloaded`,

  markdownWithToc: `# User Guide

:toc[Table of Contents]{src="chapter*, appendix*"}

## Getting Started

This guide will help you get started with the software.

## Advanced Features

Learn about advanced functionality here.`,

  asciidoc: `= User Manual
Author Name
v1.0, 2023

== Introduction

This is the introduction to our user manual.

=== Purpose

The purpose of this manual is to provide comprehensive documentation.

=== Audience

This manual is intended for:

* End users
* System administrators
* Developers`,

  simple: `Hello World

This is a simple test document with minimal formatting.

Just plain text paragraphs.`,

  empty: '',

  large: 'Large content section.\n'.repeat(1000) + 'End of large document.',
};

/**
 * Expected HTML outputs for validation
 */
export const EXPECTED_HTML_OUTPUTS = {
  markdownBasic: `<h1>Chapter 1: Getting Started</h1>
<p>This is the first chapter of our book. It covers the <strong>basics</strong> of the topic.</p>
<h2>Section 1.1: Overview</h2>
<p>Here we provide an <em>overview</em> of what you'll learn:</p>
<ul>
<li>Basic concepts</li>
<li>Key principles</li>
<li>Practical examples</li>
</ul>
<h2>Section 1.2: Prerequisites</h2>
<p>Before starting, you should have:</p>
<ol>
<li>Basic understanding of the topic</li>
<li>Required software installed</li>
<li>Sample files downloaded</li>
</ol>`,

  asciidocBasic: `<h1>User Manual</h1>
<p>Author Name
v1.0, 2023</p>
<h2>Introduction</h2>
<p>This is the introduction to our user manual.</p>
<h3>Purpose</h3>
<p>The purpose of this manual is to provide comprehensive documentation.</p>
<h3>Audience</h3>
<p>This manual is intended for:</p>
<p>* End users
* System administrators
* Developers</p>`,
};

/**
 * Transform context data for testing
 */
export const SAMPLE_TRANSFORM_CONTEXT = {
  basic: {
    workspaceId: 'test-workspace',
    spineItemId: 'chapter1',
    manifestItems: {
      chapter1: 'blob:chapter1-url',
      chapter2: 'blob:chapter2-url',
      appendix1: 'blob:appendix1-url',
    },
  },

  noManifest: {
    workspaceId: 'test-workspace',
    spineItemId: 'chapter1',
  },

  largeManifest: {
    workspaceId: 'test-workspace',
    spineItemId: 'chapter1',
    manifestItems: Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`item${i}`, `blob:item${i}-url`])
    ),
  },
};

/**
 * Create complete workspace with transform scripts and settings
 */
export function createCompleteTransformWorkspace(): Record<string, string> {
  return {
    // Settings
    'SOURCE/settings.json': JSON.stringify(DEFAULT_TRANSFORM_SETTINGS, null, 2),

    // Transform scripts
    'SOURCE/scripts/markdown-transform.js': SAMPLE_TRANSFORM_SCRIPTS['markdown-transform.js'],
    'SOURCE/scripts/heading-ids.js': SAMPLE_TRANSFORM_SCRIPTS['heading-ids.js'],
    'SOURCE/scripts/custom-styling.js': SAMPLE_TRANSFORM_SCRIPTS['custom-styling.js'],

    // Extension libraries
    'SOURCE/extensions/markdown-it/markdown-it.min.js':
      SAMPLE_EXTENSION_LIBRARIES['markdown-it/markdown-it.min.js'],
    'SOURCE/extensions/abcjs/abcjs-basic.min.js':
      SAMPLE_EXTENSION_LIBRARIES['abcjs/abcjs-basic.min.js'],

    // Source text files
    'SOURCE/text/chapter1.txt': SAMPLE_PLAIN_TEXT.markdown,
    'SOURCE/text/chapter2.txt': SAMPLE_PLAIN_TEXT.asciidoc,
  };
}

/**
 * Create minimal workspace for basic testing
 */
export function createMinimalTransformWorkspace(): Record<string, string> {
  return {
    'SOURCE/settings.json': JSON.stringify(
      {
        transform_pipeline: {
          text_transform: 'markdown-transform.js',
        },
      },
      null,
      2
    ),
    'SOURCE/scripts/markdown-transform.js': SAMPLE_TRANSFORM_SCRIPTS['markdown-transform.js'],
    'SOURCE/extensions/markdown-it/markdown-it.min.js':
      SAMPLE_EXTENSION_LIBRARIES['markdown-it/markdown-it.min.js'],
  };
}

/**
 * Create workspace with broken scripts for error testing
 */
export function createBrokenTransformWorkspace(): Record<string, string> {
  return {
    'SOURCE/settings.json': JSON.stringify(
      {
        transform_pipeline: {
          text_transform: 'broken-syntax.js',
          dom_transforms: ['runtime-error.js'],
        },
      },
      null,
      2
    ),
    'SOURCE/scripts/broken-syntax.js': SAMPLE_TRANSFORM_SCRIPTS['broken-syntax.js'],
    'SOURCE/scripts/runtime-error.js': SAMPLE_TRANSFORM_SCRIPTS['runtime-error.js'],
  };
}

/**
 * Create workspace for timeout testing
 */
export function createTimeoutTransformWorkspace(): Record<string, string> {
  return {
    'SOURCE/settings.json': JSON.stringify(
      {
        transform_pipeline: {
          text_transform: 'timeout-script.js',
        },
      },
      null,
      2
    ),
    'SOURCE/scripts/timeout-script.js': SAMPLE_TRANSFORM_SCRIPTS['timeout-script.js'],
  };
}

/**
 * Create workspace with no settings file
 */
export function createNoSettingsWorkspace(): Record<string, string> {
  return {
    'SOURCE/scripts/markdown-transform.js': SAMPLE_TRANSFORM_SCRIPTS['markdown-transform.js'],
  };
}

/**
 * Create workspace with invalid settings
 */
export function createInvalidSettingsWorkspace(): Record<string, string> {
  return {
    'SOURCE/settings.json': '{ "transform_pipeline": { "invalid": json } }', // Invalid JSON
    'SOURCE/scripts/markdown-transform.js': SAMPLE_TRANSFORM_SCRIPTS['markdown-transform.js'],
  };
}

/**
 * Create workspace with missing scripts
 */
export function createMissingScriptsWorkspace(): Record<string, string> {
  return {
    'SOURCE/settings.json': JSON.stringify(
      {
        transform_pipeline: {
          text_transform: 'nonexistent-script.js',
          dom_transforms: ['another-missing.js'],
        },
      },
      null,
      2
    ),
  };
}

/**
 * Create DOM document for testing
 */
export function createTestDocument(htmlContent: string): Document {
  const parser = new DOMParser();
  const fullHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test Document</title></head>
<body>${htmlContent}</body>
</html>`;
  return parser.parseFromString(fullHtml, 'application/xhtml+xml');
}

/**
 * Validate transform result structure
 */
export function validateTransformResult(result: any): boolean {
  return (
    typeof result === 'object' &&
    typeof result.success === 'boolean' &&
    (result.success
      ? typeof result.transformedText === 'string' || result.xhtmlDocument instanceof Document
      : result.error !== undefined)
  );
}

/**
 * Test workspace IDs for consistent testing
 */
export const TEST_WORKSPACE_IDS = {
  COMPLETE: 'test-workspace-complete',
  MINIMAL: 'test-workspace-minimal',
  BROKEN: 'test-workspace-broken',
  TIMEOUT: 'test-workspace-timeout',
  NO_SETTINGS: 'test-workspace-no-settings',
  INVALID_SETTINGS: 'test-workspace-invalid-settings',
  MISSING_SCRIPTS: 'test-workspace-missing-scripts',
  PERFORMANCE: 'test-workspace-performance',
} as const;
