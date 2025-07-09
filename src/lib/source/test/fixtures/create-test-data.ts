import { describe, it, expect, vi } from 'vitest';

/**
 * Test data generation utilities for SOURCE.zip unit tests
 * Provides standardized test fixtures and data creation helpers
 */

/**
 * Default settings.json content for testing
 */
export const DEFAULT_SETTINGS = {
  is_draft: false,
  draft_id: 1,
  text_transform: 'markdown-transform.js',
  dom_transforms: ['custom-dom.js'],
  version: '1.0.0',
};

/**
 * Sample text file contents for testing
 */
export const SAMPLE_TEXT_FILES = {
  'chapter1.txt':
    '# Chapter 1\n\nThis is the first chapter of our story.\n\nIt begins with a simple sentence.',
  'chapter2.txt':
    '# Chapter 2\n\nThe story continues in the second chapter.\n\n## Section 2.1\n\nWith multiple sections.',
  'appendix.txt': '# Appendix\n\nAdditional information and references.',
  'empty.txt': '',
  'large.txt': 'Large content\n'.repeat(1000) + 'END',
};

/**
 * Sample script file contents for testing
 */
export const SAMPLE_SCRIPT_FILES = {
  'markdown-transform.js': `
function transformText(text) {
  // Convert markdown-style headers
  return text.replace(/^# (.+)$/gm, '<h1>$1</h1>');
}

module.exports = { transformText };
`.trim(),
  'custom-dom.js': `
function transformDOM(dom) {
  // Add custom CSS classes
  const headers = dom.querySelectorAll('h1, h2, h3');
  headers.forEach(h => h.classList.add('custom-header'));
  return dom;
}

module.exports = { transformDOM };
`.trim(),
  'utils.js': `
const utilities = {
  slugify: (text) => text.toLowerCase().replace(/\\s+/g, '-'),
  sanitize: (html) => html.replace(/<script[^>]*>.*?<\\/script>/gi, '')
};

module.exports = utilities;
`.trim(),
};

/**
 * Sample extension file contents for testing
 */
export const SAMPLE_EXTENSION_FILES = {
  'markdown-it/package.json': JSON.stringify(
    {
      name: 'markdown-it',
      version: '1.0.0',
      main: 'index.js',
      description: 'Markdown parser extension',
    },
    null,
    2
  ),
  'markdown-it/index.js': `
const MarkdownIt = require('markdown-it');

module.exports = function(options = {}) {
  return new MarkdownIt({
    html: true,
    breaks: options.breaks || false,
    linkify: options.linkify || true
  });
};
`.trim(),
  'highlight/package.json': JSON.stringify(
    {
      name: 'highlight-js',
      version: '2.0.0',
      main: 'highlight.js',
    },
    null,
    2
  ),
  'highlight/highlight.js': `
function highlightCode(code, language = 'javascript') {
  return \`<pre class="highlight \${language}"><code>\${code}</code></pre>\`;
}

module.exports = { highlightCode };
`.trim(),
};

/**
 * Create a complete SOURCE/ directory structure for testing
 */
export function createCompleteSourceStructure(): Record<string, string | ArrayBuffer> {
  const files: Record<string, string | ArrayBuffer> = {};

  // Add settings.json
  files['SOURCE/settings.json'] = JSON.stringify(DEFAULT_SETTINGS, null, 2);

  // Add text files
  for (const [filename, content] of Object.entries(SAMPLE_TEXT_FILES)) {
    files[`SOURCE/text/${filename}`] = content;
  }

  // Add script files
  for (const [filename, content] of Object.entries(SAMPLE_SCRIPT_FILES)) {
    files[`SOURCE/scripts/${filename}`] = content;
  }

  // Add extension files
  for (const [filename, content] of Object.entries(SAMPLE_EXTENSION_FILES)) {
    files[`SOURCE/extensions/${filename}`] = content;
  }

  // Add .gitkeep files for empty directories
  files['SOURCE/text/.gitkeep'] = '';
  files['SOURCE/scripts/.gitkeep'] = '';
  files['SOURCE/extensions/.gitkeep'] = '';

  return files;
}

/**
 * Create a minimal SOURCE/ directory structure for testing
 */
export function createMinimalSourceStructure(): Record<string, string> {
  return {
    'SOURCE/settings.json': JSON.stringify(DEFAULT_SETTINGS, null, 2),
    'SOURCE/text/chapter1.txt': SAMPLE_TEXT_FILES['chapter1.txt'],
    'SOURCE/scripts/markdown-transform.js': SAMPLE_SCRIPT_FILES['markdown-transform.js'],
    'SOURCE/extensions/markdown-it/package.json':
      SAMPLE_EXTENSION_FILES['markdown-it/package.json'],
    'SOURCE/text/.gitkeep': '',
    'SOURCE/scripts/.gitkeep': '',
    'SOURCE/extensions/.gitkeep': '',
  };
}

/**
 * Create an empty SOURCE/ directory structure (only .gitkeep files)
 */
export function createEmptySourceStructure(): Record<string, string> {
  return {
    'SOURCE/settings.json': JSON.stringify(DEFAULT_SETTINGS, null, 2),
    'SOURCE/text/.gitkeep': '',
    'SOURCE/scripts/.gitkeep': '',
    'SOURCE/extensions/.gitkeep': '',
  };
}

/**
 * Create invalid SOURCE/ structure for error testing
 */
export function createInvalidSourceStructure(): Record<string, string> {
  return {
    // Missing settings.json
    'SOURCE/text/chapter1.txt': SAMPLE_TEXT_FILES['chapter1.txt'],
    'SOURCE/invalid-file.exe': 'INVALID BINARY CONTENT',
    'SOURCE/../traversal-attempt.txt': 'SECURITY TEST',
    'SOURCE/scripts/broken-script.js': 'function broken() { // missing closing brace',
  };
}

/**
 * Create large SOURCE/ structure for performance testing
 */
export function createLargeSourceStructure(): Record<string, string | ArrayBuffer> {
  const files: Record<string, string | ArrayBuffer> = {};

  // Add settings.json
  files['SOURCE/settings.json'] = JSON.stringify(DEFAULT_SETTINGS, null, 2);

  // Add many text files
  for (let i = 1; i <= 100; i++) {
    files[`SOURCE/text/chapter${i}.txt`] =
      `# Chapter ${i}\n\n${'Content for chapter ' + i + '.\n'.repeat(50)}`;
  }

  // Add many script files
  for (let i = 1; i <= 20; i++) {
    files[`SOURCE/scripts/transform${i}.js`] = `
function transform${i}(input) {
  return input.replace(/pattern${i}/g, 'replacement${i}');
}
module.exports = { transform${i} };
`.trim();
  }

  // Add several extensions
  for (let i = 1; i <= 10; i++) {
    files[`SOURCE/extensions/ext${i}/package.json`] = JSON.stringify(
      {
        name: `extension-${i}`,
        version: '1.0.0',
        main: 'index.js',
      },
      null,
      2
    );
    files[`SOURCE/extensions/ext${i}/index.js`] =
      `module.exports = function ext${i}() { return 'Extension ${i}'; };`;
  }

  // Add large binary file (simulated)
  const largeBuffer = new ArrayBuffer(1024 * 1024); // 1MB
  const view = new Uint8Array(largeBuffer);
  for (let i = 0; i < view.length; i++) {
    view[i] = i % 256;
  }
  files['SOURCE/extensions/binary-data/data.bin'] = largeBuffer;

  return files;
}

/**
 * Create corrupted settings.json for validation testing
 */
export function createCorruptedSettings(): Record<string, string> {
  return {
    'SOURCE/settings.json': '{ "is_draft": true, "invalid": json }', // Invalid JSON
    'SOURCE/text/chapter1.txt': SAMPLE_TEXT_FILES['chapter1.txt'],
  };
}

/**
 * Get binary file content for testing
 */
export function getBinaryTestData(): ArrayBuffer {
  const buffer = new ArrayBuffer(1024);
  const view = new Uint8Array(buffer);

  // Create a simple binary pattern
  for (let i = 0; i < view.length; i++) {
    view[i] = (i * 17) % 256; // Simple pattern to verify integrity
  }

  return buffer;
}

/**
 * Create test data with specific file types for classification testing
 */
export function createFileTypeTestData(): Record<string, string> {
  return {
    // Settings file
    'SOURCE/settings.json': JSON.stringify(DEFAULT_SETTINGS, null, 2),

    // Text files
    'SOURCE/text/story.txt': 'A simple story',
    'SOURCE/text/notes.md': '# Notes\n\nSome markdown notes',
    'SOURCE/text/data.csv': 'name,age\nJohn,30\nJane,25',

    // Script files
    'SOURCE/scripts/transform.js': 'function transform() {}',
    'SOURCE/scripts/helper.ts': 'export function helper() {}',
    'SOURCE/scripts/build.py': 'def build(): pass',

    // Extension files
    'SOURCE/extensions/plugin/package.json': '{"name": "plugin"}',
    'SOURCE/extensions/plugin/index.js': 'module.exports = {};',
    'SOURCE/extensions/theme/style.css': '.theme { color: red; }',

    // Other files
    'SOURCE/README.md': '# README',
    'SOURCE/config.yaml': 'key: value',
    'SOURCE/data.xml': '<root></root>',
  };
}

/**
 * Create workspace structure with non-SOURCE files for integration testing
 */
export function createWorkspaceWithEPUBFiles(): Record<string, string> {
  return {
    // EPUB structure files
    'OEBPS/content.opf': '<?xml version="1.0"?><package></package>',
    'OEBPS/EDITME.html': '<html><body>EDITME Editor</body></html>',
    'OEBPS/Text/chapter1.xhtml': '<html><body><h1>Chapter 1</h1></body></html>',
    'OEBPS/Styles/stylesheet.css': 'body { font-family: serif; }',
    'OEBPS/Images/cover.jpg': 'FAKE_JPEG_DATA',
    mimetype: 'application/epub+zip',
    'META-INF/container.xml': '<?xml version="1.0"?><container></container>',

    // SOURCE files that should be bundled
    ...createMinimalSourceStructure(),
  };
}

/**
 * Create expected SOURCE.zip file list for validation
 */
export function getExpectedSourceZipFiles(): string[] {
  return [
    'SOURCE/settings.json',
    'SOURCE/text/.gitkeep',
    'SOURCE/text/chapter1.txt',
    'SOURCE/text/chapter2.txt',
    'SOURCE/text/appendix.txt',
    'SOURCE/text/empty.txt',
    'SOURCE/text/large.txt',
    'SOURCE/scripts/.gitkeep',
    'SOURCE/scripts/markdown-transform.js',
    'SOURCE/scripts/custom-dom.js',
    'SOURCE/scripts/utils.js',
    'SOURCE/extensions/.gitkeep',
    'SOURCE/extensions/markdown-it/package.json',
    'SOURCE/extensions/markdown-it/index.js',
    'SOURCE/extensions/highlight/package.json',
    'SOURCE/extensions/highlight/highlight.js',
  ].sort();
}

/**
 * Validate file content matches expected data
 */
export function validateFileContent(
  actualContent: ArrayBuffer,
  expectedContent: string | ArrayBuffer
): boolean {
  if (typeof expectedContent === 'string') {
    const actualText = new TextDecoder().decode(actualContent);
    return actualText === expectedContent;
  } else {
    if (actualContent.byteLength !== expectedContent.byteLength) {
      return false;
    }
    const actualView = new Uint8Array(actualContent);
    const expectedView = new Uint8Array(expectedContent);
    return actualView.every((byte, index) => byte === expectedView[index]);
  }
}

/**
 * Get test workspace IDs for consistent testing
 */
export const TEST_WORKSPACE_IDS = {
  COMPLETE: 'test-workspace-complete',
  MINIMAL: 'test-workspace-minimal',
  EMPTY: 'test-workspace-empty',
  INVALID: 'test-workspace-invalid',
  LARGE: 'test-workspace-large',
  CORRUPTED: 'test-workspace-corrupted',
  MIXED: 'test-workspace-mixed',
} as const;
