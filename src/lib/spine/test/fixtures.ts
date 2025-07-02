/**
 * Test Fixtures for SpineItemManager Tests
 * 
 * Provides comprehensive test data including sample OPF documents, manifest items,
 * spine items, and complete workspace scenarios for testing spine operations.
 */

import type { 
  ManifestItem, 
  SpineItem
} from '../../workspace/types.js';
import type { MockOPFDocument } from '../../test/mocks/workspace-manager.mock.js';
import type {
  SpineItemWithSource,
  ChapterCreationData,
  ChapterUpdateData,
  ChapterDeletionOptions,
  SpineValidationResult,
  SpineValidationError,
  SpineValidationWarning
} from '../types.js';

/**
 * Sample manifest items for testing
 */
export const SAMPLE_MANIFEST_ITEMS: Record<string, ManifestItem> = {
  chapter1: { id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' },
  chapter2: { id: 'chapter2', href: 'Text/chapter2.xhtml', mediaType: 'application/xhtml+xml' },
  chapter3: { id: 'chapter3', href: 'Text/chapter3.xhtml', mediaType: 'application/xhtml+xml' },
  prologue: { id: 'prologue', href: 'Text/prologue.xhtml', mediaType: 'application/xhtml+xml' },
  epilogue: { id: 'epilogue', href: 'Text/epilogue.xhtml', mediaType: 'application/xhtml+xml' },
  appendix: { id: 'appendix', href: 'Text/appendix.xhtml', mediaType: 'application/xhtml+xml' },
  toc: { id: 'toc', href: 'Text/toc.xhtml', mediaType: 'application/xhtml+xml' },
  cover: { id: 'cover', href: 'Text/cover.xhtml', mediaType: 'application/xhtml+xml' }
};

/**
 * Sample spine items for testing
 */
export const SAMPLE_SPINE_ITEMS: Record<string, SpineItem> = {
  chapter1: { idref: 'chapter1', linear: true },
  chapter2: { idref: 'chapter2', linear: true },
  chapter3: { idref: 'chapter3', linear: true },
  prologue: { idref: 'prologue', linear: true },
  epilogue: { idref: 'epilogue', linear: true },
  appendix: { idref: 'appendix', linear: false },
  toc: { idref: 'toc', linear: false, properties: ['nav'] },
  cover: { idref: 'cover', linear: false }
};

/**
 * Sample spine items with source file associations
 */
export const SAMPLE_SPINE_WITH_SOURCE: Record<string, SpineItemWithSource> = {
  chapter1: {
    ...SAMPLE_SPINE_ITEMS.chapter1,
    id: 'chapter1',
    href: 'Text/chapter1.xhtml',
    mediaType: 'application/xhtml+xml',
    hasSourceFile: true,
    sourcePath: 'SOURCE/text/chapter1.txt'
  },
  chapter2: {
    ...SAMPLE_SPINE_ITEMS.chapter2,
    id: 'chapter2',
    href: 'Text/chapter2.xhtml',
    mediaType: 'application/xhtml+xml',
    hasSourceFile: true,
    sourcePath: 'SOURCE/text/chapter2.txt'
  },
  chapter3: {
    ...SAMPLE_SPINE_ITEMS.chapter3,
    id: 'chapter3',
    href: 'Text/chapter3.xhtml',
    mediaType: 'application/xhtml+xml',
    hasSourceFile: false
  },
  prologue: {
    ...SAMPLE_SPINE_ITEMS.prologue,
    id: 'prologue',
    href: 'Text/prologue.xhtml',
    mediaType: 'application/xhtml+xml',
    hasSourceFile: true,
    sourcePath: 'SOURCE/text/prologue.txt'
  }
};

/**
 * Sample chapter creation data for testing
 */
export const SAMPLE_CHAPTER_DATA: Record<string, ChapterCreationData> = {
  basic: {
    title: 'Test Chapter',
    linear: true
  },
  
  customFilename: {
    title: 'Custom Chapter',
    fileName: 'custom-chapter.xhtml',
    linear: true
  },
  
  withProperties: {
    title: 'Special Chapter',
    linear: true,
    properties: ['page-spread-left']
  },
  
  nonLinear: {
    title: 'Appendix',
    linear: false
  },
  
  withSourceContent: {
    title: 'Chapter with Content',
    linear: true,
    sourceContent: '# Chapter with Content\n\nThis is custom source content.'
  },
  
  noSourceFile: {
    title: 'XHTML Only Chapter',
    linear: true,
    createSourceFile: false
  },
  
  withInsertIndex: {
    title: 'Inserted Chapter',
    linear: true,
    insertIndex: 1
  }
};

/**
 * Sample chapter update data for testing
 */
export const SAMPLE_CHAPTER_UPDATES: Record<string, ChapterUpdateData> = {
  linearFlag: {
    linear: false
  },
  
  properties: {
    properties: ['page-spread-right']
  },
  
  title: {
    title: 'Updated Chapter Title'
  },
  
  filename: {
    fileName: 'renamed-chapter.xhtml'
  },
  
  sourceContent: {
    sourceContent: '# Updated Content\n\nThis is updated source content.'
  },
  
  complete: {
    title: 'Completely Updated Chapter',
    fileName: 'completely-updated.xhtml',
    linear: false,
    properties: ['page-spread-left'],
    sourceContent: '# Completely Updated\n\nAll fields updated.'
  }
};

/**
 * Sample deletion options for testing
 */
export const SAMPLE_DELETION_OPTIONS: Record<string, ChapterDeletionOptions> = {
  deleteAll: {
    // Default behavior - delete everything
  },
  
  preserveXHTML: {
    preserveXHTML: true,
    preserveSourceFile: false
  },
  
  preserveSourceFile: {
    preserveXHTML: false,
    preserveSourceFile: true
  },
  
  preserveBoth: {
    preserveXHTML: true,
    preserveSourceFile: true
  },
  
  preserveManifest: {
    preserveXHTML: true,
    preserveSourceFile: true,
    preserveManifest: true
  }
};

/**
 * Sample OPF documents for testing different scenarios
 */
export const SAMPLE_OPF_DOCUMENTS: Record<string, MockOPFDocument> = {
  empty: {
    manifest: [],
    spine: [],
    metadata: {
      title: 'Empty EPUB',
      language: 'en',
      identifier: 'urn:uuid:empty-test',
      creator: 'Test Author',
      date: '2024-01-01'
    }
  },
  
  basic: {
    manifest: [
      SAMPLE_MANIFEST_ITEMS.chapter1,
      SAMPLE_MANIFEST_ITEMS.chapter2,
      SAMPLE_MANIFEST_ITEMS.chapter3
    ],
    spine: [
      SAMPLE_SPINE_ITEMS.chapter1,
      SAMPLE_SPINE_ITEMS.chapter2,
      SAMPLE_SPINE_ITEMS.chapter3
    ],
    metadata: {
      title: 'Basic EPUB',
      language: 'en',
      identifier: 'urn:uuid:basic-test',
      creator: 'Test Author',
      date: '2024-01-01'
    }
  },
  
  withNonLinear: {
    manifest: [
      SAMPLE_MANIFEST_ITEMS.prologue,
      SAMPLE_MANIFEST_ITEMS.chapter1,
      SAMPLE_MANIFEST_ITEMS.chapter2,
      SAMPLE_MANIFEST_ITEMS.epilogue,
      SAMPLE_MANIFEST_ITEMS.appendix
    ],
    spine: [
      SAMPLE_SPINE_ITEMS.prologue,
      SAMPLE_SPINE_ITEMS.chapter1,
      SAMPLE_SPINE_ITEMS.chapter2,
      SAMPLE_SPINE_ITEMS.epilogue,
      SAMPLE_SPINE_ITEMS.appendix
    ],
    metadata: {
      title: 'Mixed Linear EPUB',
      language: 'en',
      identifier: 'urn:uuid:mixed-test',
      creator: 'Test Author',
      date: '2024-01-01'
    }
  },
  
  withProperties: {
    manifest: [
      SAMPLE_MANIFEST_ITEMS.cover,
      SAMPLE_MANIFEST_ITEMS.toc,
      SAMPLE_MANIFEST_ITEMS.chapter1,
      SAMPLE_MANIFEST_ITEMS.chapter2
    ],
    spine: [
      SAMPLE_SPINE_ITEMS.cover,
      SAMPLE_SPINE_ITEMS.toc,
      SAMPLE_SPINE_ITEMS.chapter1,
      SAMPLE_SPINE_ITEMS.chapter2
    ],
    metadata: {
      title: 'EPUB with Properties',
      language: 'en',
      identifier: 'urn:uuid:properties-test',
      creator: 'Test Author',
      date: '2024-01-01'
    }
  }
};

/**
 * Invalid OPF documents for testing error scenarios
 */
export const INVALID_OPF_DOCUMENTS: Record<string, MockOPFDocument> = {
  missingManifestItems: {
    manifest: [
      SAMPLE_MANIFEST_ITEMS.chapter1
    ],
    spine: [
      SAMPLE_SPINE_ITEMS.chapter1,
      SAMPLE_SPINE_ITEMS.chapter2 // References non-existent manifest item
    ],
    metadata: {
      title: 'Invalid EPUB',
      language: 'en',
      identifier: 'urn:uuid:invalid-test',
      creator: 'Test Author',
      date: '2024-01-01'
    }
  },
  
  duplicateSpineItems: {
    manifest: [
      SAMPLE_MANIFEST_ITEMS.chapter1,
      SAMPLE_MANIFEST_ITEMS.chapter2
    ],
    spine: [
      SAMPLE_SPINE_ITEMS.chapter1,
      SAMPLE_SPINE_ITEMS.chapter2,
      SAMPLE_SPINE_ITEMS.chapter1 // Duplicate
    ],
    metadata: {
      title: 'Duplicate Spine EPUB',
      language: 'en',
      identifier: 'urn:uuid:duplicate-test',
      creator: 'Test Author',
      date: '2024-01-01'
    }
  },
  
  orphanedManifestItems: {
    manifest: [
      SAMPLE_MANIFEST_ITEMS.chapter1,
      SAMPLE_MANIFEST_ITEMS.chapter2,
      SAMPLE_MANIFEST_ITEMS.chapter3 // Not in spine
    ],
    spine: [
      SAMPLE_SPINE_ITEMS.chapter1,
      SAMPLE_SPINE_ITEMS.chapter2
    ],
    metadata: {
      title: 'Orphaned Manifest EPUB',
      language: 'en',
      identifier: 'urn:uuid:orphaned-test',
      creator: 'Test Author',
      date: '2024-01-01'
    }
  }
};

/**
 * Sample validation results for testing
 */
export const SAMPLE_VALIDATION_RESULTS: Record<string, SpineValidationResult> = {
  valid: {
    isValid: true,
    errors: [],
    warnings: [],
    summary: {
      totalItems: 3,
      linearItems: 3,
      nonLinearItems: 0,
      itemsWithSource: 2,
      orphanedSources: 0
    }
  },
  
  withErrors: {
    isValid: false,
    errors: [
      {
        code: 'MISSING_MANIFEST_ITEM',
        message: 'Spine item references missing manifest item: chapter2',
        chapterId: 'chapter2',
        severity: 'error'
      }
    ],
    warnings: [],
    summary: {
      totalItems: 2,
      linearItems: 2,
      nonLinearItems: 0,
      itemsWithSource: 1,
      orphanedSources: 0
    }
  },
  
  withWarnings: {
    isValid: true,
    errors: [],
    warnings: [
      {
        code: 'ORPHANED_TEXT_FILE',
        message: 'Text file not included in reading order: chapter3.xhtml',
        chapterId: 'chapter3',
        severity: 'warning'
      }
    ],
    summary: {
      totalItems: 2,
      linearItems: 2,
      nonLinearItems: 0,
      itemsWithSource: 2,
      orphanedSources: 1
    }
  }
};

/**
 * Sample workspace files for testing source file associations
 */
export const SAMPLE_WORKSPACE_FILES: Record<string, Record<string, string>> = {
  withSourceFiles: {
    'OEBPS/Text/chapter1.xhtml': '<?xml version="1.0"?><html><head><title>Chapter 1</title></head><body><h1>Chapter 1</h1></body></html>',
    'OEBPS/Text/chapter2.xhtml': '<?xml version="1.0"?><html><head><title>Chapter 2</title></head><body><h1>Chapter 2</h1></body></html>',
    'SOURCE/text/chapter1.txt': '# Chapter 1\n\nThis is the source content for chapter 1.',
    'SOURCE/text/chapter2.txt': '# Chapter 2\n\nThis is the source content for chapter 2.'
  },
  
  mixedSourceFiles: {
    'OEBPS/Text/chapter1.xhtml': '<?xml version="1.0"?><html><head><title>Chapter 1</title></head><body><h1>Chapter 1</h1></body></html>',
    'OEBPS/Text/chapter2.xhtml': '<?xml version="1.0"?><html><head><title>Chapter 2</title></head><body><h1>Chapter 2</h1></body></html>',
    'OEBPS/Text/chapter3.xhtml': '<?xml version="1.0"?><html><head><title>Chapter 3</title></head><body><h1>Chapter 3</h1></body></html>',
    'SOURCE/text/chapter1.txt': '# Chapter 1\n\nThis is the source content for chapter 1.',
    // chapter2 has no source file
    'SOURCE/text/chapter3.txt': '# Chapter 3\n\nThis is the source content for chapter 3.'
  },
  
  noSourceFiles: {
    'OEBPS/Text/chapter1.xhtml': '<?xml version="1.0"?><html><head><title>Chapter 1</title></head><body><h1>Chapter 1</h1></body></html>',
    'OEBPS/Text/chapter2.xhtml': '<?xml version="1.0"?><html><head><title>Chapter 2</title></head><body><h1>Chapter 2</h1></body></html>'
  }
};

/**
 * Edge case test data
 */
export const EDGE_CASE_DATA = {
  specialCharacterTitles: [
    'Chapter "One": The Beginning & End!',
    'Kapitel 一: Der Anfang 始まり',
    'Chapter with émoji 🎉 and symbols!',
    'Multiple --- dashes... and dots???',
    '   Leading and trailing spaces   ',
    'Very/Long\\Chapter*Title:With|Special<Characters>That?Should[Be]Sanitized{Properly}'
  ],
  
  longTitles: [
    'This is a very long chapter title that exceeds normal length expectations and should still work correctly without causing any issues in the system',
    'A'.repeat(500) // Very long title
  ],
  
  unicodeCharacters: [
    '🎭 Theater Chapter',
    '数学 Mathematics',
    'العربية Arabic',
    'עברית Hebrew',
    'ქართული Georgian'
  ],
  
  emptyAndNull: [
    '',
    '   ',
    '\n\t\r'
  ]
};

/**
 * Large-scale test data for performance testing
 */
export function createLargeSpineData(itemCount: number): {
  manifest: ManifestItem[];
  spine: SpineItem[];
} {
  const manifest: ManifestItem[] = [];
  const spine: SpineItem[] = [];
  
  for (let i = 1; i <= itemCount; i++) {
    const id = `chapter${i}`;
    manifest.push({
      id,
      href: `Text/${id}.xhtml`,
      mediaType: 'application/xhtml+xml'
    });
    spine.push({
      idref: id,
      linear: true
    });
  }
  
  return { manifest, spine };
}

/**
 * Helper function to create test OPF with custom data
 */
export function createTestOPF(overrides: Partial<MockOPFDocument> = {}): MockOPFDocument {
  return {
    manifest: [],
    spine: [],
    metadata: {
      title: 'Test EPUB',
      language: 'en',
      identifier: `urn:uuid:test-${Date.now()}`,
      creator: 'Test Author',
      date: new Date().toISOString().split('T')[0]
    },
    ...overrides
  };
}

/**
 * Helper function to create test workspace files
 */
export function createTestWorkspaceFiles(chapters: string[]): Record<string, string> {
  const files: Record<string, string> = {};
  
  for (const chapterId of chapters) {
    // XHTML file
    files[`OEBPS/Text/${chapterId}.xhtml`] = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${chapterId}</title>
</head>
<body>
  <h1>${chapterId}</h1>
  <p>Content for ${chapterId}</p>
</body>
</html>`;
    
    // Source file
    files[`SOURCE/text/${chapterId}.txt`] = `# ${chapterId}\n\nSource content for ${chapterId}.`;
  }
  
  return files;
}