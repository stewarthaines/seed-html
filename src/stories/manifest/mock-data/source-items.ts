/**
 * Mock SOURCE directory items for advanced mode demonstrations
 * 
 * Provides factory functions for generating realistic SOURCE/ directory
 * items that represent the editable source files in advanced mode.
 */

import type { SourceItem } from '../../../lib/manifest/types.js';

/**
 * Base SOURCE directory items
 */
const baseSourceItems: SourceItem[] = [
  {
    path: 'SOURCE/text/chapter1.txt',
    name: 'chapter1.txt',
    type: 'file',
    size: 8934,
    modified: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    mediaType: 'text/plain',
  },
  {
    path: 'SOURCE/text/chapter2.txt',
    name: 'chapter2.txt',
    type: 'file',
    size: 6789,
    modified: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    mediaType: 'text/plain',
  },
  {
    path: 'SOURCE/text/nav.txt',
    name: 'nav.txt',
    type: 'file',
    size: 2456,
    modified: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    mediaType: 'text/plain',
  },
  {
    path: 'SOURCE/transforms/custom.js',
    name: 'custom.js',
    type: 'file',
    size: 2345,
    modified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    mediaType: 'application/javascript',
  },
  {
    path: 'SOURCE/transforms/styles.js',
    name: 'styles.js',
    type: 'file',
    size: 1876,
    modified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    mediaType: 'application/javascript',
  },
  {
    path: 'SOURCE/assets/cover-source.jpg',
    name: 'cover-source.jpg',
    type: 'file',
    size: 267890,
    modified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    mediaType: 'image/jpeg',
  },
  {
    path: 'SOURCE/config/epub-metadata.json',
    name: 'epub-metadata.json',
    type: 'file',
    size: 1423,
    modified: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    mediaType: 'application/json',
  },
  {
    path: 'SOURCE/text',
    name: 'text',
    type: 'directory',
    modified: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    path: 'SOURCE/transforms',
    name: 'transforms',
    type: 'directory',
    modified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    path: 'SOURCE/assets',
    name: 'assets',
    type: 'directory',
    modified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    path: 'SOURCE/config',
    name: 'config',
    type: 'directory',
    modified: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
];

/**
 * Factory function to create mock SOURCE items
 */
export function createMockSourceItems(options: {
  includeDirectories?: boolean;
  fileTypes?: ('text' | 'javascript' | 'image' | 'config')[];
  count?: number;
} = {}): SourceItem[] {
  const {
    includeDirectories = true,
    fileTypes = ['text', 'javascript', 'image', 'config'],
    count = 10
  } = options;

  let items: SourceItem[] = [];

  // Filter by file types
  const filteredItems = baseSourceItems.filter(item => {
    if (item.type === 'directory') {
      return includeDirectories;
    }

    // Check file type based on path and media type
    if (fileTypes.includes('text') && (
      item.path.includes('/text/') ||
      item.mediaType === 'text/plain'
    )) {
      return true;
    }
    if (fileTypes.includes('javascript') && item.mediaType === 'application/javascript') {
      return true;
    }
    if (fileTypes.includes('image') && item.mediaType?.startsWith('image/')) {
      return true;
    }
    if (fileTypes.includes('config') && (
      item.mediaType === 'application/json' ||
      item.path.includes('/config/')
    )) {
      return true;
    }

    return false;
  });

  items = filteredItems.slice(0, Math.min(count, filteredItems.length));

  return items;
}

/**
 * Create a single mock SOURCE item
 */
export function createMockSourceItem(overrides: Partial<SourceItem> = {}): SourceItem {
  return {
    path: 'SOURCE/mock/test.txt',
    name: 'test.txt',
    type: 'file',
    size: 512,
    modified: new Date(),
    mediaType: 'text/plain',
    ...overrides,
  };
}

/**
 * Get SOURCE items by type (files only or directories only)
 */
export function getSourceItemsByType(type: 'file' | 'directory'): SourceItem[] {
  return baseSourceItems.filter(item => item.type === type);
}

/**
 * Create minimal SOURCE structure for basic demonstrations
 */
export function createMinimalSourceItems(): SourceItem[] {
  return [
    {
      path: 'SOURCE/text/content.txt',
      name: 'content.txt',
      type: 'file',
      size: 5432,
      modified: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      mediaType: 'text/plain',
    },
    {
      path: 'SOURCE/transforms/basic.js',
      name: 'basic.js',
      type: 'file',
      size: 1234,
      modified: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      mediaType: 'application/javascript',
    },
  ];
}

/**
 * Create expanded SOURCE structure for comprehensive demonstrations
 */
export function createExpandedSourceItems(): SourceItem[] {
  return [
    ...baseSourceItems,
    // Additional items for comprehensive testing
    {
      path: 'SOURCE/extensions/custom-extension.zip',
      name: 'custom-extension.zip',
      type: 'file',
      size: 45672,
      modified: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      mediaType: 'application/zip',
    },
    {
      path: 'SOURCE/scripts/build.sh',
      name: 'build.sh',
      type: 'file',
      size: 1876,
      modified: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
      mediaType: 'application/x-sh',
    },
    {
      path: 'SOURCE/docs/README.md',
      name: 'README.md',
      type: 'file',
      size: 3456,
      modified: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      mediaType: 'text/markdown',
    },
  ];
}