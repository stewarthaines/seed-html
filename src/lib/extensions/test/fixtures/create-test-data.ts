/**
 * Test data generators and constants for Extension Manager testing
 *
 * Provides consistent, reproducible test data for various extension
 * scenarios and testing conditions.
 */

export const TEST_WORKSPACE_IDS = {
  EMPTY: 'workspace-empty',
  MINIMAL: 'workspace-minimal',
  COMPLETE: 'workspace-complete',
  LARGE: 'workspace-large',
  CONFLICTED: 'workspace-conflicted',
  CORRUPTED: 'workspace-corrupted',
  CACHE_TEST: 'extensions-cache',
} as const;

// Sample extension files for testing
export const SAMPLE_EXTENSIONS = {
  MARKDOWN_IT: {
    name: 'markdown-it',
    files: {
      'markdown-it.min.js': `// Markdown-it library v13.0.1
(function(global) {
  'use strict';
  function MarkdownIt() {
    this.render = function(text) {
      return text.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
    };
  }
  global.markdownit = function() { return new MarkdownIt(); };
})(typeof window !== 'undefined' ? window : global);`,
      'LICENSE.txt': `MIT License

Copyright (c) 2014 Vitaly Puzrin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
    },
  },

  HIGHLIGHT_JS: {
    name: 'highlight',
    files: {
      'highlight.min.js': `// Highlight.js v11.7.0
(function() {
  'use strict';
  var hljs = {
    highlight: function(code, language) {
      return { value: '<span class="hljs-keyword">' + code + '</span>' };
    },
    highlightAuto: function(code) {
      return this.highlight(code, 'auto');
    }
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = hljs;
  } else {
    window.hljs = hljs;
  }
})();`,
    },
  },

  PRISM_JS: {
    name: 'prism',
    files: {
      'prism.min.js': `// Prism.js syntax highlighter
window.Prism = {
  highlight: function(text, grammar) {
    return text.replace(/function/g, '<span class="token keyword">function</span>');
  }
};`,
      'prism-javascript.js': `// JavaScript language support for Prism
Prism.languages.javascript = {
  'keyword': /\\b(?:function|var|let|const)\\b/,
  'string': /(["'])(?:\\\\[\\s\\S]|(?!\\1)[^\\\\\\r\\n])*\\1/
};`,
      LICENSE: `MIT License - Prism.js`,
    },
  },

  ABCJS: {
    name: 'abcjs',
    files: {
      'abcjs-basic.min.js': `// ABC notation renderer
window.ABCJS = {
  renderAbc: function(element, notation) {
    element.innerHTML = '<svg>' + notation + '</svg>';
  }
};`,
    },
  },

  CUSTOM_LIBRARY: {
    name: 'custom-library',
    files: {
      'Custom Library.js': `// Custom library with spaces in name
window.CustomLibrary = {
  version: '1.0.0',
  init: function() { console.log('Custom library initialized'); }
};`,
    },
  },
} as const;

// Binary data for testing
export function createBinaryExtension(): ArrayBuffer {
  const size = 1024; // 1KB binary file
  const buffer = new ArrayBuffer(size);
  const view = new Uint8Array(buffer);

  // Fill with pseudo-random binary data
  for (let i = 0; i < size; i++) {
    view[i] = (i * 37 + 127) % 256;
  }

  return buffer;
}

// Large extension for performance testing
export function createLargeExtension(): Record<string, string | ArrayBuffer> {
  const largeCode =
    '// Large JavaScript library\n' +
    'var data = ' +
    JSON.stringify(Array(10000).fill('test data')) +
    ';\n' +
    'function processData() {\n' +
    '  return data.map(function(item, index) {\n' +
    '    return item + index;\n' +
    '  });\n' +
    '}\n'.repeat(1000);

  return {
    'large-library.min.js': largeCode,
    'large-plugin.js': largeCode.slice(0, largeCode.length / 2),
    'binary-data.bin': createBinaryExtension(),
    'LICENSE.txt': 'MIT License for large library',
  };
}

// Workspace with multiple extensions
export function createCompleteWorkspace(): Record<string, string | ArrayBuffer> {
  const files: Record<string, string | ArrayBuffer> = {};

  // Add multiple extensions
  for (const [key, extension] of Object.entries(SAMPLE_EXTENSIONS)) {
    for (const [filename, content] of Object.entries(extension.files)) {
      files[`SOURCE/extensions/${extension.name}/${filename}`] = content;
    }
  }

  return files;
}

// Workspace with conflicting extension names
export function createConflictedWorkspace(): Record<string, string | ArrayBuffer> {
  return {
    // markdown-it with DIFFERENT content than what's in cache (creates conflict)
    'SOURCE/extensions/markdown-it/markdown-it.min.js': `// MODIFIED version of markdown-it
(function() { 
  window.markdownit = function() { 
    return { render: function(text) { return '<p>MODIFIED: ' + text + '</p>'; } }; 
  }; 
})();`,
    'SOURCE/extensions/markdown-it/LICENSE.txt': 'MODIFIED license text',

    // Another extension that should cache successfully
    'SOURCE/extensions/prism/prism.min.js': SAMPLE_EXTENSIONS.PRISM_JS.files['prism.min.js'],

    // Different extension with different name
    'SOURCE/extensions/markdown-it-v2/markdown-it.min.js': `// Different version of markdown-it
(function() { 
  window.markdownit = function() { 
    return { render: function(text) { return '<p>' + text + '</p>'; } }; 
  }; 
})();`,
    'SOURCE/extensions/markdown-it-v2/LICENSE.txt': 'Different license text',
  };
}

// Cache with pre-populated extensions
export function createPopulatedCache(): Record<string, string | ArrayBuffer> {
  const files: Record<string, string | ArrayBuffer> = {};

  // Add some extensions to cache
  const cachedExtensions = [
    SAMPLE_EXTENSIONS.MARKDOWN_IT,
    SAMPLE_EXTENSIONS.HIGHLIGHT_JS,
    SAMPLE_EXTENSIONS.PRISM_JS,
  ];

  for (const extension of cachedExtensions) {
    for (const [filename, content] of Object.entries(extension.files)) {
      files[`${extension.name}/${filename}`] = content;
    }
  }

  return files;
}

// Empty workspace structure
export function createEmptyWorkspace(): Record<string, string> {
  return {};
}

// Minimal workspace with one extension
export function createMinimalWorkspace(): Record<string, string> {
  return {
    'SOURCE/extensions/markdown-it/markdown-it.min.js':
      SAMPLE_EXTENSIONS.MARKDOWN_IT.files['markdown-it.min.js'],
  };
}

// Workspace with corrupted extension structure
export function createCorruptedWorkspace(): Record<string, string | ArrayBuffer> {
  return {
    // Extension with no JS files
    'SOURCE/extensions/empty-extension/LICENSE.txt': 'License only, no JS',

    // Extension with invalid filenames
    'SOURCE/extensions/invalid-extension/': '', // Directory entry (invalid)
    'SOURCE/extensions/invalid-extension/..hidden': 'Hidden file',

    // Extension with mixed valid/invalid files
    'SOURCE/extensions/mixed-extension/valid.js': 'function valid() {}',
    'SOURCE/extensions/mixed-extension/invalid.exe': 'Binary executable',
    'SOURCE/extensions/mixed-extension/LICENSE.txt': 'Valid license',
  };
}

// Test filename patterns for name detection
export const FILENAME_PATTERNS = [
  // Standard patterns
  { input: 'markdown-it.min.js', expected: 'markdown-it' },
  { input: 'highlight.js', expected: 'highlight' },
  { input: 'prism-core.min.js', expected: 'prism-core' },

  // Version numbers
  { input: 'lodash-4.17.21.min.js', expected: 'lodash' },
  { input: 'jquery-3.6.0.js', expected: 'jquery' },
  { input: 'react-18.2.0.production.min.js', expected: 'react' },

  // Special characters
  { input: 'Custom Library.js', expected: 'custom-library' },
  { input: 'MY_EXTENSION.min.js', expected: 'my-extension' },
  { input: 'some.special.extension.js', expected: 'some-special-extension' },

  // Edge cases
  { input: 'a.js', expected: 'a' },
  { input: '123-numeric.js', expected: '123-numeric' },
  { input: 'extension-with-many-dashes.min.js', expected: 'extension-with-many-dashes' },

  // Complex patterns
  { input: 'abc-notation-1.2.3-beta.min.js', expected: 'abc-notation' },
  { input: 'library@1.0.0.js', expected: 'library' },
  { input: 'package+name.js', expected: 'package-name' },
] as const;

// File validation test cases
export const FILE_VALIDATION_CASES = [
  // Valid JavaScript files
  { name: 'valid.js', type: 'text/javascript', valid: true, fileType: 'javascript' },
  { name: 'valid.min.js', type: 'text/javascript', valid: true, fileType: 'javascript' },
  { name: 'script.mjs', type: 'text/javascript', valid: false, fileType: 'unknown' }, // .mjs not supported

  // Valid license files
  { name: 'LICENSE', type: 'text/plain', valid: true, fileType: 'license' },
  { name: 'LICENSE.txt', type: 'text/plain', valid: true, fileType: 'license' },
  { name: 'LICENSE.md', type: 'text/markdown', valid: false, fileType: 'unknown' }, // .md not supported

  // Invalid files
  { name: 'style.css', type: 'text/css', valid: false, fileType: 'unknown' },
  { name: 'image.png', type: 'image/png', valid: false, fileType: 'unknown' },
  { name: 'document.pdf', type: 'application/pdf', valid: false, fileType: 'unknown' },
  { name: 'executable.exe', type: 'application/octet-stream', valid: false, fileType: 'unknown' },

  // Edge cases
  { name: '', type: 'text/plain', valid: false, fileType: 'unknown' }, // Empty name
  { name: '.js', type: 'text/javascript', valid: false, fileType: 'unknown' }, // Name starts with dot
  { name: 'no-extension', type: 'text/plain', valid: false, fileType: 'unknown' }, // No extension
] as const;

// Helper function to create File objects for testing
export function createMockFile(
  name: string,
  content: string | ArrayBuffer,
  type = 'text/javascript'
): File {
  const blob =
    typeof content === 'string' ? new Blob([content], { type }) : new Blob([content], { type });

  const file = new File([blob], name, { type });
  return file;
}

// Helper function to validate file content equality
export function validateFileContent(
  actual: string | ArrayBuffer,
  expected: string | ArrayBuffer
): boolean {
  if (typeof actual !== typeof expected) return false;

  if (typeof actual === 'string') {
    return actual === expected;
  }

  // Compare ArrayBuffers
  const actualView = new Uint8Array(actual);
  const expectedView = new Uint8Array(expected as ArrayBuffer);

  if (actualView.length !== expectedView.length) return false;

  for (let i = 0; i < actualView.length; i++) {
    if (actualView[i] !== expectedView[i]) return false;
  }

  return true;
}

// Performance test constants
export const PERFORMANCE_LIMITS = {
  MAX_EXTENSION_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_EXTENSIONS_PER_WORKSPACE: 100,
  MAX_CACHE_SIZE: 100 * 1024 * 1024, // 100MB
  OPERATION_TIMEOUT: 5000, // 5 seconds
  BATCH_OPERATION_TIMEOUT: 30000, // 30 seconds
} as const;
