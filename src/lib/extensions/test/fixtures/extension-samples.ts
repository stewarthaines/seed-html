/**
 * Sample extension files and complete extension definitions
 * for comprehensive testing scenarios.
 */

export interface SampleExtension {
  name: string;
  files: Record<string, string>;
  expectedSize: number;
  description: string;
}

// Real-world inspired extension samples
export const EXTENSION_SAMPLES: Record<string, SampleExtension> = {
  // Popular JavaScript libraries
  LODASH: {
    name: 'lodash',
    files: {
      'lodash.min.js': `/*!
 * Lodash.js 4.17.21 <https://lodash.com/>
 * Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
 * Released under MIT license <https://lodash.com/license>
 */
(function(){function n(n,t,r){switch(r.length){case 0:return n.call(t);case 1:return n.call(t,r[0])}}
var t=function(){return new Date};
if(typeof window!=="undefined")window._=t();
else if(typeof global!=="undefined")global._=t();
})();`,
      'LICENSE.txt': `MIT License

Copyright OpenJS Foundation and other contributors <https://openjsf.org/>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction.`,
    },
    expectedSize: 1234,
    description: 'Popular utility library',
  },

  D3: {
    name: 'd3',
    files: {
      'd3.min.js': `// D3.js v7.8.2
(function(global){
  var d3 = {
    version: "7.8.2",
    select: function(selector) {
      return {
        append: function(tag) { return this; },
        attr: function(name, value) { return this; },
        style: function(name, value) { return this; }
      };
    },
    selectAll: function(selector) {
      return this.select(selector);
    }
  };
  global.d3 = d3;
})(typeof window !== "undefined" ? window : this);`,
      LICENSE: `BSD 3-Clause License

Copyright 2010-2023 Mike Bostock. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice.`,
    },
    expectedSize: 856,
    description: 'Data visualization library',
  },

  // Music notation libraries
  ABCJS_COMPLETE: {
    name: 'abcjs',
    files: {
      'abcjs-basic.min.js': `// abcjs v6.2.3 - ABC Music Notation
window.ABCJS = {
  renderAbc: function(element, abcString, options) {
    if (!element) throw new Error("Element required");
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "400");
    svg.setAttribute("height", "200");
    element.appendChild(svg);
    return [{ svg: svg }];
  },
  TimingCallbacks: function() {
    return {
      start: function() {},
      stop: function() {},
      pause: function() {}
    };
  }
};`,
      'abcjs-plugin.js': `// ABC.js plugin for extended functionality
ABCJS.plugin = {
  transpose: function(abc, semitones) {
    return abc; // Simplified implementation
  },
  exportMIDI: function(abc) {
    return new Blob(["MIDI data"], { type: "audio/midi" });
  }
};`,
      'LICENSE.txt': `MIT License

Copyright (c) 2010-2023 Paul Rosen and Gregory Dyke

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files.`,
    },
    expectedSize: 1456,
    description: 'ABC music notation renderer with plugins',
  },

  // Markdown processing
  MARKED: {
    name: 'marked',
    files: {
      'marked.min.js': `/*!
 * marked v4.3.0 - a markdown parser
 * Copyright (c) 2011-2023, Christopher Jeffrey. (MIT Licensed)
 */
(function(){
  function marked(src, options) {
    return src.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
             .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
             .replace(/^# (.*$)/gim, '<h1>$1</h1>')
             .replace(/^## (.*$)/gim, '<h2>$1</h2>');
  }
  marked.parse = marked;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = marked;
  } else {
    window.marked = marked;
  }
})();`,
    },
    expectedSize: 567,
    description: 'Fast markdown parser',
  },

  // Math rendering
  KATEX: {
    name: 'katex',
    files: {
      'katex.min.js': `// KaTeX v0.16.4
window.katex = {
  render: function(expression, element, options) {
    if (!element) throw new Error("No element provided");
    element.innerHTML = '<span class="katex">' + expression + '</span>';
  },
  renderToString: function(expression, options) {
    return '<span class="katex">' + expression + '</span>';
  }
};`,
      LICENSE: `MIT License

Copyright (c) 2013-2020 Khan Academy and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files.`,
    },
    expectedSize: 445,
    description: 'Math rendering library',
  },

  // Code highlighting
  HIGHLIGHT_COMPLETE: {
    name: 'highlight',
    files: {
      'highlight.min.js': `/*!
  Highlight.js v11.8.0 (git: 0a58323976)
  (c) 2006-2023 Josh Goebel <hello@joshgoebel.com> and other contributors
  License: BSD-3-Clause
 */
(function(){
  var hljs = {
    highlight: function(code, language) {
      var keywords = ['function', 'var', 'let', 'const', 'if', 'else', 'for', 'while'];
      var result = code;
      keywords.forEach(function(keyword) {
        var regex = new RegExp('\\\\b' + keyword + '\\\\b', 'g');
        result = result.replace(regex, '<span class="hljs-keyword">' + keyword + '</span>');
      });
      return { value: result, language: language };
    },
    highlightAuto: function(code) {
      return this.highlight(code, 'auto');
    },
    highlightAll: function() {
      var blocks = document.querySelectorAll('pre code');
      blocks.forEach(function(block) {
        var result = hljs.highlight(block.textContent, 'javascript');
        block.innerHTML = result.value;
      });
    }
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = hljs;
  } else {
    window.hljs = hljs;
  }
})();`,
      'languages/javascript.min.js': `// JavaScript language definition for Highlight.js
hljs.registerLanguage('javascript', function(hljs) {
  return {
    aliases: ['js', 'jsx'],
    keywords: {
      keyword: 'function var let const if else for while do break continue return',
      literal: 'true false null undefined',
      built_in: 'Array Object String Number Boolean Date Math RegExp'
    },
    contains: [
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE
    ]
  };
});`,
      LICENSE: `BSD 3-Clause License

Copyright (c) 2006, Ivan Sagalaev. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:`,
    },
    expectedSize: 2234,
    description: 'Syntax highlighting with language packs',
  },
};

// Extensions with version numbers in filenames (for name detection testing)
export const VERSIONED_EXTENSIONS = [
  {
    filename: 'jquery-3.6.0.min.js',
    expectedName: 'jquery',
    content: '// jQuery v3.6.0\n(function(){window.jQuery = window.$ = {};})();',
  },
  {
    filename: 'lodash-4.17.21.min.js',
    expectedName: 'lodash',
    content: '// Lodash v4.17.21\nwindow._ = {};',
  },
  {
    filename: 'react-18.2.0.production.min.js',
    expectedName: 'react',
    content: '// React v18.2.0\nwindow.React = {};',
  },
  {
    filename: 'vue-3.3.4.global.min.js',
    expectedName: 'vue',
    content: '// Vue.js v3.3.4\nwindow.Vue = {};',
  },
];

// Extensions with special characters (for normalization testing)
export const SPECIAL_CHAR_EXTENSIONS = [
  {
    filename: 'My Custom Library.js',
    expectedName: 'my-custom-library',
    content: '// Custom library with spaces',
  },
  {
    filename: 'library@scope.js',
    expectedName: 'library-scope',
    content: '// Scoped package name',
  },
  {
    filename: 'package+name.min.js',
    expectedName: 'package-name',
    content: '// Package with plus sign',
  },
  {
    filename: 'extension_with_underscores.js',
    expectedName: 'extension-with-underscores',
    content: '// Underscores to hyphens',
  },
];

// Large extensions for performance testing
export function createLargeExtensionSample(): SampleExtension {
  const largeCode = Array(1000)
    .fill(
      `
    function performComplexOperation(data) {
      return data.map(function(item, index) {
        return {
          id: index,
          value: item.value * Math.random(),
          processed: new Date().toISOString()
        };
      });
    }
  `
    )
    .join('\n');

  return {
    name: 'large-library',
    files: {
      'large-library.min.js': `// Large JavaScript library\n${largeCode}`,
      'large-library-utils.js': `// Utility functions\n${largeCode.slice(0, largeCode.length / 2)}`,
      'LICENSE.txt': 'MIT License for large library with extensive text content.\n'.repeat(100),
    },
    expectedSize: largeCode.length * 1.5,
    description: 'Large library for performance testing',
  };
}

// Extensions for conflict testing
export const CONFLICTING_EXTENSIONS = {
  MARKDOWN_V1: {
    name: 'markdown-it',
    files: {
      'markdown-it.min.js': `// Markdown-it v12.0.0
window.markdownit = function() {
  return { render: function(text) { return '<p>' + text + '</p>'; } };
};`,
      'LICENSE.txt': 'MIT License v1',
    },
  },
  MARKDOWN_V2: {
    name: 'markdown-it',
    files: {
      'markdown-it.min.js': `// Markdown-it v13.0.1 (different content)
window.markdownit = function() {
  return { render: function(text) { return '<div>' + text + '</div>'; } };
};`,
      'LICENSE.txt': 'MIT License v2',
    },
  },
};

// Malformed extensions for security testing
export const MALFORMED_EXTENSIONS = [
  {
    name: '../../../evil',
    files: { 'evil.js': 'console.log("Path traversal attempt");' },
    expectedError: 'Invalid extension name',
  },
  {
    name: 'extension',
    files: { '../evil.js': 'console.log("Relative path in filename");' },
    expectedError: 'Invalid file path',
  },
  {
    name: 'con', // Reserved Windows filename
    files: { 'con.js': 'console.log("Reserved filename");' },
    expectedError: 'Invalid extension name',
  },
];

// Helper function to get extension by name
export function getExtensionSample(name: string): SampleExtension | undefined {
  return EXTENSION_SAMPLES[name.toUpperCase()];
}

// Helper function to create extension file structure for workspace
export function createExtensionFiles(
  extension: SampleExtension,
  workspaceId: string
): Record<string, string> {
  const files: Record<string, string> = {};

  for (const [filename, content] of Object.entries(extension.files)) {
    files[`SOURCE/extensions/${extension.name}/${filename}`] = content;
  }

  return files;
}

// Helper function to create cache file structure
export function createCacheFiles(extension: SampleExtension): Record<string, string> {
  const files: Record<string, string> = {};

  for (const [filename, content] of Object.entries(extension.files)) {
    files[`${extension.name}/${filename}`] = content;
  }

  return files;
}
