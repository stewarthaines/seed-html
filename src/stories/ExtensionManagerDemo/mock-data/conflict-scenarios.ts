/**
 * Conflict Scenarios for Extension Manager Demo
 * 
 * Test data for demonstrating cache conflicts, version mismatches,
 * and other edge cases in extension management.
 */

import { SAMPLE_EXTENSIONS, type SampleExtension } from './sample-extensions.js';

export interface ConflictScenario {
  name: string;
  description: string;
  cacheExtension: SampleExtension;
  workspaceExtension: SampleExtension;
  conflictType: 'version' | 'content' | 'files';
  expectedBehavior: string;
}

/**
 * Different types of conflicts that can occur
 */
export const CONFLICT_SCENARIOS: Record<string, ConflictScenario> = {
  VERSION_MISMATCH: {
    name: 'Version Mismatch',
    description: 'Same extension, different versions',
    cacheExtension: SAMPLE_EXTENSIONS.MARKDOWN_IT,
    workspaceExtension: {
      name: 'markdown-it',
      files: {
        'markdown-it.min.js': '/*! markdown-it v12.3.2 */ function(){var a,b;'.repeat(250) + '})();'
      },
      description: 'Older version of markdown-it',
      category: 'Text Processing',
      totalSize: 298000
    },
    conflictType: 'version',
    expectedBehavior: 'Show version conflict warning, allow user to choose which version to keep'
  },

  CONTENT_MODIFIED: {
    name: 'Modified Content',
    description: 'Same extension name and version, but modified content',
    cacheExtension: SAMPLE_EXTENSIONS.LODASH,
    workspaceExtension: {
      name: 'lodash',
      files: {
        'lodash.min.js': '/*! Lodash.js v4.17.21 CUSTOM BUILD */ function(){var custom;'.repeat(400) + '})();'
      },
      description: 'Custom modified lodash build',
      category: 'Utilities', 
      totalSize: 65536
    },
    conflictType: 'content',
    expectedBehavior: 'Detect content difference, show file comparison, prevent automatic caching'
  },

  FILE_COUNT_DIFFERENCE: {
    name: 'File Count Difference',
    description: 'Same extension but different number of files',
    cacheExtension: SAMPLE_EXTENSIONS.HIGHLIGHT_JS,
    workspaceExtension: {
      name: 'highlight',
      files: {
        'highlight.min.js': SAMPLE_EXTENSIONS.HIGHLIGHT_JS.files['highlight.min.js'],
        'languages/javascript.js': '// Additional language support\nhljs.registerLanguage("javascript", function() {});',
        'languages/python.js': '// Python language support\nhljs.registerLanguage("python", function() {});',
        'LICENSE.txt': 'BSD 3-Clause License\n\nCopyright (c) 2006, Ivan Sagalaev.'
      },
      description: 'Highlight.js with additional language files',
      category: 'Syntax Highlighting',
      totalSize: 210000
    },
    conflictType: 'files',
    expectedBehavior: 'Show file difference, allow user to merge or replace'
  },

  PARTIAL_OVERLAP: {
    name: 'Partial File Overlap',
    description: 'Some files match, others differ',
    cacheExtension: SAMPLE_EXTENSIONS.ABCJS_COMPLETE,
    workspaceExtension: {
      name: 'abcjs-complete',
      files: {
        'abcjs-basic.min.js': SAMPLE_EXTENSIONS.ABCJS_COMPLETE.files['abcjs-basic.min.js'], // Same
        'abcjs-plugin.js': '// Different plugin implementation\nabcjs.customRender = function() {};',
        'custom-styles.css': '/* Additional CSS styles for ABC rendering */.abc-notation { color: blue; }',
        'LICENSE.txt': SAMPLE_EXTENSIONS.ABCJS_COMPLETE.files['LICENSE.txt'] // Same
      },
      description: 'ABC.js with custom plugin and styles',
      category: 'Music Notation',
      totalSize: 156000
    },
    conflictType: 'files',
    expectedBehavior: 'Show which files match and which differ, allow selective merge'
  }
};

/**
 * Create workspace with conflicting extensions for testing
 */
export function createConflictingWorkspace(scenarios: ConflictScenario[]): Record<string, string> {
  const workspaceFiles: Record<string, string> = {};
  
  for (const scenario of scenarios) {
    const extensionName = scenario.workspaceExtension.name;
    
    for (const [filename, content] of Object.entries(scenario.workspaceExtension.files)) {
      const filePath = `SOURCE/extensions/${extensionName}/${filename}`;
      workspaceFiles[filePath] = content;
    }
  }
  
  return workspaceFiles;
}

/**
 * Create cache with extensions that will conflict
 */
export function createConflictingCache(scenarios: ConflictScenario[]): Record<string, string> {
  const cacheFiles: Record<string, string> = {};
  
  for (const scenario of scenarios) {
    const extensionName = scenario.cacheExtension.name;
    
    for (const [filename, content] of Object.entries(scenario.cacheExtension.files)) {
      const filePath = `${extensionName}/${filename}`;
      cacheFiles[filePath] = content;
    }
  }
  
  return cacheFiles;
}

/**
 * Conflict resolution strategies
 */
export enum ConflictResolution {
  KEEP_CACHE = 'keep-cache',
  KEEP_WORKSPACE = 'keep-workspace', 
  MERGE_FILES = 'merge-files',
  RENAME_EXTENSION = 'rename-extension',
  SKIP_CACHING = 'skip-caching'
}

/**
 * Get suggested resolution for conflict type
 */
export function getSuggestedResolution(conflictType: ConflictScenario['conflictType']): ConflictResolution[] {
  switch (conflictType) {
    case 'version':
      return [ConflictResolution.KEEP_CACHE, ConflictResolution.KEEP_WORKSPACE, ConflictResolution.RENAME_EXTENSION];
    case 'content':
      return [ConflictResolution.KEEP_WORKSPACE, ConflictResolution.SKIP_CACHING, ConflictResolution.RENAME_EXTENSION];
    case 'files':
      return [ConflictResolution.MERGE_FILES, ConflictResolution.KEEP_WORKSPACE, ConflictResolution.KEEP_CACHE];
    default:
      return [ConflictResolution.SKIP_CACHING];
  }
}

/**
 * Performance test scenarios
 */
export const PERFORMANCE_SCENARIOS = {
  MANY_SMALL_EXTENSIONS: {
    name: 'Many Small Extensions',
    description: 'Workspace with 50+ small JavaScript libraries',
    count: 50,
    avgSize: 15000 // 15KB each
  },
  
  FEW_LARGE_EXTENSIONS: {
    name: 'Few Large Extensions',
    description: 'Workspace with 5 large JavaScript libraries',
    count: 5,
    avgSize: 500000 // 500KB each
  },
  
  MIXED_SIZES: {
    name: 'Mixed Extension Sizes',
    description: 'Realistic mix of small, medium, and large extensions',
    count: 25,
    avgSize: 150000 // 150KB average
  }
};

/**
 * Generate performance test extensions
 */
export function generatePerformanceExtensions(scenario: typeof PERFORMANCE_SCENARIOS.MANY_SMALL_EXTENSIONS): Record<string, string> {
  const workspaceFiles: Record<string, string> = {};
  
  for (let i = 0; i < scenario.count; i++) {
    const extensionName = `perf-lib-${i.toString().padStart(3, '0')}`;
    const jsContent = `/*! Performance Test Library ${i} */\nfunction perfLib${i}() {\n`.repeat(scenario.avgSize / 100) + '})();';
    
    workspaceFiles[`SOURCE/extensions/${extensionName}/${extensionName}.min.js`] = jsContent;
    workspaceFiles[`SOURCE/extensions/${extensionName}/LICENSE.txt`] = `MIT License\n\nPerformance Test Library ${i}`;
  }
  
  return workspaceFiles;
}

/**
 * Error scenarios for testing error handling
 */
export const ERROR_SCENARIOS = {
  CORRUPTED_EXTENSION: {
    name: 'Corrupted Extension',
    description: 'Extension directory with missing or invalid files',
    files: {
      'SOURCE/extensions/corrupted/': '', // Empty directory
      'SOURCE/extensions/incomplete/partial.js': 'incomplete file content'
    }
  },
  
  INVALID_FILENAMES: {
    name: 'Invalid Filenames',
    description: 'Extensions with dangerous or invalid filenames',
    files: {
      'SOURCE/extensions/dangerous/../../../etc/passwd.js': 'malicious content',
      'SOURCE/extensions/invalid/file<>:|?.js': 'invalid chars in filename'
    }
  },
  
  PERMISSION_DENIED: {
    name: 'Permission Denied',
    description: 'Simulate storage permission errors',
    simulateError: 'PermissionDenied'
  }
};