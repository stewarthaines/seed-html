/**
 * Simple mock data for visual demonstration stories
 *
 * These are static data structures designed to show UI states
 * without requiring functional backend operations.
 */

// Simple spine item structure for UI display
export interface MockSpineItem {
  id: string;
  title: string;
  href: string;
  linear: boolean;
  hasSourceFile: boolean;
}

// Mock metadata for display
export interface MockMetadata {
  title: string;
  author: string;
  language: string;
  identifier: string;
  publishedDate: string;
  description: string;
}

// Mock workspace info
export interface MockWorkspace {
  id: string;
  name: string;
  metadata: MockMetadata;
  spineItems: MockSpineItem[];
  manifestItems: Array<{
    id: string;
    href: string;
    mediaType: string;
  }>;
}

// Sample spine items for demonstration
export const SAMPLE_SPINE_ITEMS: MockSpineItem[] = [
  {
    id: 'titlepage',
    title: 'Title Page',
    href: 'OEBPS/titlepage.xhtml',
    linear: true,
    hasSourceFile: false,
  },
  {
    id: 'chapter-001',
    title: 'Chapter 1: The Beginning',
    href: 'OEBPS/chapter-001.xhtml',
    linear: true,
    hasSourceFile: true,
  },
  {
    id: 'chapter-002',
    title: 'Chapter 2: The Journey',
    href: 'OEBPS/chapter-002.xhtml',
    linear: true,
    hasSourceFile: true,
  },
  {
    id: 'chapter-003',
    title: 'Chapter 3: The Discovery',
    href: 'OEBPS/chapter-003.xhtml',
    linear: true,
    hasSourceFile: true,
  },
  {
    id: 'appendix',
    title: 'Appendix A: Notes',
    href: 'OEBPS/appendix.xhtml',
    linear: false,
    hasSourceFile: true,
  },
];

// Sample metadata
export const SAMPLE_METADATA: MockMetadata = {
  title: 'The Digital Chronicles',
  author: 'Jane Author',
  language: 'en',
  identifier: 'urn:uuid:12345678-1234-5678-9012-123456789012',
  publishedDate: '2024-01-15',
  description:
    'A compelling tale of digital transformation and human resilience in the modern age.',
};

// Sample manifest items
export const SAMPLE_MANIFEST_ITEMS = [
  { id: 'titlepage', href: 'titlepage.xhtml', mediaType: 'application/xhtml+xml' },
  { id: 'chapter-001', href: 'chapter-001.xhtml', mediaType: 'application/xhtml+xml' },
  { id: 'chapter-002', href: 'chapter-002.xhtml', mediaType: 'application/xhtml+xml' },
  { id: 'chapter-003', href: 'chapter-003.xhtml', mediaType: 'application/xhtml+xml' },
  { id: 'appendix', href: 'appendix.xhtml', mediaType: 'application/xhtml+xml' },
  { id: 'stylesheet', href: 'styles/main.css', mediaType: 'text/css' },
  { id: 'cover-image', href: 'images/cover.jpg', mediaType: 'image/jpeg' },
];

// Complete sample workspace
export const SAMPLE_WORKSPACE: MockWorkspace = {
  id: 'demo-workspace',
  name: 'Sample EPUB Project',
  metadata: SAMPLE_METADATA,
  spineItems: SAMPLE_SPINE_ITEMS,
  manifestItems: SAMPLE_MANIFEST_ITEMS,
};

// Different scenarios for various stories
export const VISUAL_SCENARIOS = {
  // Basic workspace with content
  withContent: {
    ...SAMPLE_WORKSPACE,
    name: 'Book with Content',
  },

  // Empty workspace
  empty: {
    id: 'empty-workspace',
    name: 'New Project',
    metadata: {
      title: 'Untitled',
      author: '',
      language: 'en',
      identifier: '',
      publishedDate: '',
      description: '',
    },
    spineItems: [],
    manifestItems: [],
  },

  // Large book with many chapters
  largeBook: {
    id: 'large-book',
    name: 'Epic Novel Series',
    metadata: {
      title: 'The Complete Epic Series: Volume 1',
      author: 'Epic Writer',
      language: 'en',
      identifier: 'urn:uuid:87654321-4321-8765-2109-876543210987',
      publishedDate: '2024-06-01',
      description:
        'The first volume of an expansive fantasy epic spanning multiple worlds and generations.',
    },
    spineItems: Array.from({ length: 25 }, (_, i) => ({
      id: `chapter-${String(i + 1).padStart(3, '0')}`,
      title: `Chapter ${i + 1}: ${['The Quest Begins', 'Ancient Mysteries', 'The Dark Forest', 'City of Gold', 'Mountain Pass', 'River Crossing', 'The Oracle', 'Battle Lines', 'Hidden Truths', 'The Prophecy'][i % 10]}`,
      href: `OEBPS/chapter-${String(i + 1).padStart(3, '0')}.xhtml`,
      linear: true,
      hasSourceFile: Math.random() > 0.1, // 90% have source files
    })),
    manifestItems: [
      // Generate manifest items for all 25 chapters
      ...Array.from({ length: 25 }, (_, i) => ({
        id: `chapter-${String(i + 1).padStart(3, '0')}`,
        href: `chapter-${String(i + 1).padStart(3, '0')}.xhtml`,
        mediaType: 'application/xhtml+xml',
      })),
      // Add standard assets
      { id: 'stylesheet', href: 'styles/main.css', mediaType: 'text/css' },
      { id: 'cover-image', href: 'images/cover.jpg', mediaType: 'image/jpeg' },
    ],
  },
} as const;

export type VisualScenario = keyof typeof VISUAL_SCENARIOS;

/**
 * Get mock data for a specific visual scenario
 */
export function getVisualScenario(scenario: VisualScenario): MockWorkspace {
  return VISUAL_SCENARIOS[scenario];
}

/**
 * Create a mock workspace manager that returns static data
 * This bypasses all file system operations for pure visual demonstration
 */
export function createVisualMockWorkspaceManager(scenario: VisualScenario = 'withContent') {
  const mockData = getVisualScenario(scenario);

  return {
    // Mock implementation that returns our static data
    async init() {
      return Promise.resolve();
    },

    async listWorkspacesWithMetadata() {
      return Promise.resolve([
        {
          id: mockData.id,
          name: mockData.name,
          lastModified: new Date().toISOString(),
          metadata: mockData.metadata,
        },
      ]);
    },

    async getWorkspaceMetadata(workspaceId: string) {
      return Promise.resolve(mockData.metadata);
    },

    // OPF/EPUB content methods
    async getOPFContent() {
      return Promise.resolve(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${mockData.metadata.title}</dc:title>
    <dc:creator>${mockData.metadata.author}</dc:creator>
    <dc:language>${mockData.metadata.language}</dc:language>
    <dc:identifier id="BookId">${mockData.metadata.identifier}</dc:identifier>
  </metadata>
  <manifest>
    ${mockData.manifestItems
      .map(item => `<item id="${item.id}" href="${item.href}" media-type="${item.mediaType}"/>`)
      .join('\n    ')}
  </manifest>
  <spine>
    ${mockData.spineItems
      .map(item => `<itemref idref="${item.id}"${item.linear ? '' : ' linear="no"'}/>`)
      .join('\n    ')}
  </spine>
</package>`);
    },

    async getWorkspaceOPF(workspaceId: string) {
      // Return mock OPF structure expected by SpineItemManager
      return Promise.resolve({
        metadata: mockData.metadata,
        manifest: mockData.manifestItems,
        spine: mockData.spineItems.map(item => ({
          idref: item.id,
          linear: item.linear,
        })),
      });
    },

    // File system methods (mock implementations)
    async fileExists(workspaceId: string, filePath: string) {
      // Mock file existence based on our sample data
      if (filePath.startsWith('SOURCE/text/')) {
        const itemId = filePath.replace('SOURCE/text/', '').replace('.txt', '');
        const item = mockData.spineItems.find(i => i.id === itemId);
        return Promise.resolve(item?.hasSourceFile || false);
      }
      return Promise.resolve(true); // Assume other files exist
    },

    async readTextFile(workspaceId: string, filePath: string) {
      // Return mock content for demonstration
      if (filePath.startsWith('SOURCE/text/')) {
        return Promise.resolve('Sample source text content for demonstration purposes.');
      }
      return Promise.resolve('<html><body>Mock XHTML content</body></html>');
    },

    async writeTextFile(workspaceId: string, filePath: string, content: string) {
      // Mock write operation - just resolve
      return Promise.resolve();
    },

    async deleteFile(workspaceId: string, filePath: string) {
      // Mock delete operation - just resolve
      return Promise.resolve();
    },

    // OPF manipulation methods (mock implementations)
    async addManifestItem(workspaceId: string, item: any) {
      // Mock manifest item addition
      return Promise.resolve();
    },

    async addSpineItem(workspaceId: string, item: any, index?: number) {
      // Mock spine item addition
      return Promise.resolve();
    },

    async updateSpineItem(workspaceId: string, itemId: string, updates: any) {
      // Mock spine item update
      return Promise.resolve();
    },

    async removeSpineItem(workspaceId: string, itemId: string) {
      // Mock spine item removal
      return Promise.resolve();
    },

    async reorderSpineItems(workspaceId: string, fromIndex: number, toIndex: number) {
      // Mock spine reordering
      return Promise.resolve();
    },
  };
}
