/**
 * Sample Extension Data for Extension Manager Demo
 * 
 * Realistic JavaScript library content and metadata for demonstration purposes.
 * These samples represent popular libraries commonly used in EPUB projects.
 */

export interface SampleExtension {
  name: string;
  files: Record<string, string>;
  description: string;
  category: string;
  totalSize: number;
}

/**
 * Create realistic minified JavaScript content
 */
function createMinifiedJs(libraryName: string, version: string, sizeKB: number): string {
  const header = `/*! ${libraryName} v${version} | (c) JS Foundation | MIT License */`;
  const minifiedCode = 'function(){var a,b,c;'.repeat(Math.floor(sizeKB * 20));
  return header + '\n' + minifiedCode + '})();';
}

/**
 * Popular JavaScript Libraries
 */
export const SAMPLE_EXTENSIONS: Record<string, SampleExtension> = {
  // Utility Libraries
  LODASH: {
    name: 'lodash',
    files: {
      'lodash.min.js': createMinifiedJs('Lodash.js', '4.17.21', 70)
    },
    description: 'A modern JavaScript utility library delivering modularity, performance & extras.',
    category: 'Utilities',
    totalSize: 71680
  },

  // Text Processing
  MARKDOWN_IT: {
    name: 'markdown-it',
    files: {
      'markdown-it.min.js': createMinifiedJs('markdown-it', '13.0.1', 312),
      'LICENSE.txt': 'MIT License\n\nCopyright (c) 2014 Vitaly Puzrin, Alex Kocharin.'
    },
    description: 'Markdown parser done right. Fast and easy to extend.',
    category: 'Text Processing',
    totalSize: 319488
  },

  MARKED: {
    name: 'marked',
    files: {
      'marked.min.js': createMinifiedJs('marked', '4.3.0', 45)
    },
    description: 'A markdown parser and compiler. Built for speed.',
    category: 'Text Processing',
    totalSize: 46080
  },

  // Syntax Highlighting
  HIGHLIGHT_JS: {
    name: 'highlight',
    files: {
      'highlight.min.js': createMinifiedJs('highlight.js', '11.7.0', 190)
    },
    description: 'Syntax highlighting for the Web.',
    category: 'Syntax Highlighting',
    totalSize: 194560
  },

  HIGHLIGHT_COMPLETE: {
    name: 'highlight-complete',
    files: {
      'highlight.min.js': createMinifiedJs('highlight.js', '11.7.0', 190),
      'javascript.min.js': createMinifiedJs('highlight.js JavaScript', '11.7.0', 8),
      'python.min.js': createMinifiedJs('highlight.js Python', '11.7.0', 12),
      'LICENSE.txt': 'BSD 3-Clause License\n\nCopyright (c) 2006, Ivan Sagalaev.'
    },
    description: 'Complete highlight.js package with language support.',
    category: 'Syntax Highlighting',
    totalSize: 215040
  },

  PRISM: {
    name: 'prism',
    files: {
      'prism-core.min.js': createMinifiedJs('Prism', '1.29.0', 12),
      'prism-javascript.js': '// JavaScript language support for Prism\nPrism.languages.javascript = {/* ... */};'
    },
    description: 'Lightweight, robust, elegant syntax highlighting.',
    category: 'Syntax Highlighting',
    totalSize: 13312
  },

  // Data Visualization
  D3: {
    name: 'd3',
    files: {
      'd3.min.js': createMinifiedJs('D3.js', '7.8.2', 280)
    },
    description: 'Data-Driven Documents. Bring data to life with SVG, Canvas and HTML.',
    category: 'Data Visualization',
    totalSize: 286720
  },

  CHART_JS: {
    name: 'chart-js',
    files: {
      'chart.min.js': createMinifiedJs('Chart.js', '4.2.1', 165)
    },
    description: 'Simple yet flexible JavaScript charting for designers & developers.',
    category: 'Data Visualization', 
    totalSize: 168960
  },

  // Math Rendering
  KATEX: {
    name: 'katex',
    files: {
      'katex.min.js': createMinifiedJs('KaTeX', '0.16.4', 320),
      'katex.min.css': '/* KaTeX CSS styles for math rendering */.katex{font:1.21em KaTeX_Main,Times New Roman,serif}',
      'LICENSE.txt': 'MIT License\n\nCopyright (c) 2013-2020 Khan Academy.'
    },
    description: 'Fast math typesetting for the web.',
    category: 'Math',
    totalSize: 327680
  },

  MATHJAX: {
    name: 'mathjax',
    files: {
      'mathjax.min.js': createMinifiedJs('MathJax', '3.2.2', 280)
    },
    description: 'Beautiful and accessible math in all browsers.',
    category: 'Math',
    totalSize: 286720
  },

  // Music Notation
  ABCJS: {
    name: 'abcjs',
    files: {
      'abcjs-basic.min.js': createMinifiedJs('abcjs', '6.2.2', 145)
    },
    description: 'JavaScript library for rendering ABC music notation.',
    category: 'Music Notation',
    totalSize: 148480
  },

  ABCJS_COMPLETE: {
    name: 'abcjs-complete',
    files: {
      'abcjs-basic.min.js': createMinifiedJs('abcjs', '6.2.2', 145),
      'abcjs-plugin.js': '// Extended functionality for abcjs\nabcjs.renderAbc = function() {/* ... */};',
      'LICENSE.txt': 'MIT License\n\nCopyright (c) 2009-2023 Paul Rosen.'
    },
    description: 'Complete ABC.js package with plugins and extensions.',
    category: 'Music Notation',
    totalSize: 151552
  },

  VEXFLOW: {
    name: 'vexflow',
    files: {
      'vexflow.min.js': createMinifiedJs('VexFlow', '4.0.3', 420)
    },
    description: 'JavaScript library for rendering music notation and guitar tablature.',
    category: 'Music Notation',
    totalSize: 430080
  },

  // UI Frameworks
  JQUERY: {
    name: 'jquery',
    files: {
      'jquery.min.js': createMinifiedJs('jQuery', '3.6.4', 85)
    },
    description: 'Fast, small, and feature-rich JavaScript library.',
    category: 'UI Framework',
    totalSize: 87040
  },

  VUE: {
    name: 'vue',
    files: {
      'vue.min.js': createMinifiedJs('Vue.js', '3.2.47', 120)
    },
    description: 'The Progressive JavaScript Framework.',
    category: 'UI Framework',
    totalSize: 122880
  },

  // Testing and Development
  MONACO_EDITOR: {
    name: 'monaco-editor',
    files: {
      'monaco-editor.min.js': createMinifiedJs('Monaco Editor', '0.36.1', 650),
      'editor.worker.js': createMinifiedJs('Monaco Editor Worker', '0.36.1', 180),
      'LICENSE.txt': 'MIT License\n\nCopyright (c) Microsoft Corporation.'
    },
    description: 'Browser-based code editor that powers VS Code.',
    category: 'Development',
    totalSize: 851968
  }
};

/**
 * Extensions grouped by category for easy browsing
 */
export const EXTENSIONS_BY_CATEGORY = {
  'Utilities': [SAMPLE_EXTENSIONS.LODASH],
  'Text Processing': [SAMPLE_EXTENSIONS.MARKDOWN_IT, SAMPLE_EXTENSIONS.MARKED],
  'Syntax Highlighting': [SAMPLE_EXTENSIONS.HIGHLIGHT_JS, SAMPLE_EXTENSIONS.HIGHLIGHT_COMPLETE, SAMPLE_EXTENSIONS.PRISM],
  'Data Visualization': [SAMPLE_EXTENSIONS.D3, SAMPLE_EXTENSIONS.CHART_JS],
  'Math': [SAMPLE_EXTENSIONS.KATEX, SAMPLE_EXTENSIONS.MATHJAX],
  'Music Notation': [SAMPLE_EXTENSIONS.ABCJS, SAMPLE_EXTENSIONS.ABCJS_COMPLETE, SAMPLE_EXTENSIONS.VEXFLOW],
  'UI Framework': [SAMPLE_EXTENSIONS.JQUERY, SAMPLE_EXTENSIONS.VUE],
  'Development': [SAMPLE_EXTENSIONS.MONACO_EDITOR]
};

/**
 * Get popular extensions for cache pre-population
 */
export function getPopularExtensions(): SampleExtension[] {
  return [
    SAMPLE_EXTENSIONS.LODASH,
    SAMPLE_EXTENSIONS.JQUERY,
    SAMPLE_EXTENSIONS.D3,
    SAMPLE_EXTENSIONS.HIGHLIGHT_JS,
    SAMPLE_EXTENSIONS.MARKDOWN_IT
  ];
}

/**
 * Create a File object from sample extension data
 */
export function createSampleFile(extension: SampleExtension, filename: string): File {
  const content = extension.files[filename];
  if (!content) {
    throw new Error(`File ${filename} not found in extension ${extension.name}`);
  }

  const blob = new Blob([content], { 
    type: filename.endsWith('.js') ? 'text/javascript' : 'text/plain' 
  });
  
  return new File([blob], filename, {
    type: blob.type,
    lastModified: Date.now()
  });
}

/**
 * Create multiple File objects for multi-file extensions
 */
export function createSampleFiles(extension: SampleExtension): File[] {
  return Object.keys(extension.files).map(filename => 
    createSampleFile(extension, filename)
  );
}

/**
 * Version conflict scenarios for testing
 */
export const VERSION_CONFLICTS = {
  MARKDOWN_IT_OLD: {
    name: 'markdown-it',
    files: {
      'markdown-it.min.js': createMinifiedJs('markdown-it', '12.3.2', 298) // Older version
    },
    description: 'Older version of markdown-it (conflict scenario)',
    category: 'Text Processing',
    totalSize: 305152
  },
  
  LODASH_CUSTOM: {
    name: 'lodash',
    files: {
      'lodash.min.js': createMinifiedJs('Lodash.js Custom Build', '4.17.21', 45), // Custom build
      'custom-methods.js': '// Custom lodash methods\n_.customMethod = function() {};'
    },
    description: 'Custom lodash build (conflict scenario)',
    category: 'Utilities',
    totalSize: 47104
  }
};

/**
 * Large extension for performance testing
 */
export function createLargeExtensionSample(): SampleExtension {
  return {
    name: 'large-library',
    files: {
      'large-library.min.js': createMinifiedJs('Large Library', '1.0.0', 2048), // 2MB
      'documentation.md': '# Large Library\n' + 'Documentation content. '.repeat(1000),
      'LICENSE.txt': 'MIT License\n\nCopyright (c) 2023 Demo Corporation.'
    },
    description: 'Large extension for performance testing',
    category: 'Development',
    totalSize: 2097152
  };
}