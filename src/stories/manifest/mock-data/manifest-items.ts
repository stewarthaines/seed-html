/**
 * Mock manifest items for Storybook stories
 * 
 * Provides factory functions for generating realistic EPUB manifest data
 * for testing and demonstration purposes.
 */

import type { ManifestItem } from '../../../lib/manifest/types.js';

/**
 * Base manifest items for common use cases
 */
const baseManifestItems: ManifestItem[] = [
  {
    id: 'nav',
    href: 'OEBPS/nav.xhtml',
    mediaType: 'application/xhtml+xml',
    size: 15420,
    modified: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    properties: ['nav'],
    isInSpine: true,
    spineIndex: 0,
  },
  {
    id: 'chapter1',
    href: 'OEBPS/chapter1.xhtml',
    mediaType: 'application/xhtml+xml',
    size: 12456,
    modified: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    isInSpine: true,
    spineIndex: 1,
  },
  {
    id: 'chapter2',
    href: 'OEBPS/chapter2.xhtml',
    mediaType: 'application/xhtml+xml',
    size: 8934,
    modified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    isInSpine: true,
    spineIndex: 2,
  },
  {
    id: 'cover-image',
    href: 'OEBPS/images/cover.jpg',
    mediaType: 'image/jpeg',
    size: 245678,
    modified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    properties: ['cover-image'],
  },
  {
    id: 'stylesheet',
    href: 'OEBPS/styles/main.css',
    mediaType: 'text/css',
    size: 3456,
    modified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
  },
  {
    id: 'audio-clip',
    href: 'OEBPS/audio/pronunciation.mp3',
    mediaType: 'audio/mpeg',
    size: 156789,
    modified: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  },
  {
    id: 'video-intro',
    href: 'OEBPS/video/introduction.mp4',
    mediaType: 'video/mp4',
    size: 5248576,
    modified: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
  },
  {
    id: 'font-regular',
    href: 'OEBPS/fonts/source-serif-pro.woff2',
    mediaType: 'font/woff2',
    size: 78432,
    modified: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
  },
];

/**
 * Error items for testing validation and error states
 */
const errorManifestItems: ManifestItem[] = [
  {
    id: 'invalid-missing-href',
    href: '',
    mediaType: 'application/xhtml+xml',
    size: 0,
    modified: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    id: '',
    href: 'OEBPS/invalid-no-id.xhtml',
    mediaType: 'application/xhtml+xml',
    size: 1234,
    modified: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'invalid-media-type',
    href: 'OEBPS/unknown-type.xyz',
    mediaType: 'unknown/type',
    size: 5678,
    modified: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
];

/**
 * Factory function to create mock manifest items
 */
export function createMockManifestItems(options: {
  count?: number;
  includeErrors?: boolean;
  contentTypes?: ('text' | 'image' | 'audio' | 'video' | 'binary')[];
} = {}): ManifestItem[] {
  const {
    count = 6,
    includeErrors = false,
    contentTypes = ['text', 'image', 'audio', 'video', 'binary']
  } = options;

  let items: ManifestItem[] = [];

  // Filter by content types
  const filteredBaseItems = baseManifestItems.filter(item => {
    if (contentTypes.includes('text') && (
      item.mediaType.startsWith('text/') ||
      item.mediaType.includes('xml') ||
      item.mediaType.includes('css')
    )) {
      return true;
    }
    if (contentTypes.includes('image') && item.mediaType.startsWith('image/')) {
      return true;
    }
    if (contentTypes.includes('audio') && item.mediaType.startsWith('audio/')) {
      return true;
    }
    if (contentTypes.includes('video') && item.mediaType.startsWith('video/')) {
      return true;
    }
    if (contentTypes.includes('binary') && (
      item.mediaType.startsWith('font/') ||
      item.mediaType.startsWith('application/')
    )) {
      return true;
    }
    return false;
  });

  // Take requested number of items
  items = filteredBaseItems.slice(0, Math.min(count, filteredBaseItems.length));

  // Add error items if requested
  if (includeErrors) {
    items = [...items, ...errorManifestItems.slice(0, 2)];
  }

  return items;
}

/**
 * Create a single mock manifest item for testing
 */
export function createMockManifestItem(overrides: Partial<ManifestItem> = {}): ManifestItem {
  return {
    id: 'mock-item',
    href: 'OEBPS/mock-item.xhtml',
    mediaType: 'application/xhtml+xml',
    size: 1024,
    modified: new Date(),
    ...overrides,
  };
}

/**
 * Get mock manifest items by content type
 */
export function getMockItemsByContentType(contentType: 'text' | 'image' | 'audio' | 'video' | 'binary'): ManifestItem[] {
  return createMockManifestItems({ contentTypes: [contentType], count: 10 });
}

/**
 * Create manifest items with specific properties for advanced scenarios
 */
export function createAdvancedMockItems(): ManifestItem[] {
  return [
    {
      id: 'mathml-content',
      href: 'OEBPS/math/equations.xhtml',
      mediaType: 'application/xhtml+xml',
      size: 18567,
      modified: new Date(Date.now() - 1 * 60 * 60 * 1000),
      properties: ['mathml'],
      isInSpine: true,
      spineIndex: 3,
    },
    {
      id: 'interactive-svg',
      href: 'OEBPS/images/diagram.svg',
      mediaType: 'image/svg+xml',
      size: 34521,
      modified: new Date(Date.now() - 2 * 60 * 60 * 1000),
      properties: ['scripted'],
    },
    {
      id: 'remote-resources',
      href: 'OEBPS/content/web-links.xhtml',
      mediaType: 'application/xhtml+xml',
      size: 7834,
      modified: new Date(Date.now() - 4 * 60 * 60 * 1000),
      properties: ['remote-resources'],
      isInSpine: true,
      spineIndex: 4,
    },
  ];
}

/**
 * Helper to create items with validation errors for error state testing
 */
export function createValidationErrorItems(): ManifestItem[] {
  return errorManifestItems;
}