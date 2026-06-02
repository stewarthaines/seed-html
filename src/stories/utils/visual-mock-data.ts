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

/**
 * Create a mock manifest manager for visual stories
 * This provides all the IManifestManager methods expected by ManifestContainer
 */
export function createVisualMockManifestManager(scenario: VisualScenario = 'withContent') {
  const mockData = getVisualScenario(scenario);

  // Convert our mock data to manifest items format
  const manifestItems = mockData.manifestItems.map(item => ({
    id: item.id,
    href: item.href,
    mediaType: item.mediaType,
    size: Math.floor(Math.random() * 50000) + 1000,
    modified: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    properties: item.id === 'cover-image' ? ['cover-image'] : undefined,
    isInSpine: mockData.spineItems.some(s => s.id === item.id),
    spineIndex: mockData.spineItems.findIndex(s => s.id === item.id),
  }));

  return {
    // Core data operations
    async loadManifest(workspaceId: string) {
      return Promise.resolve(manifestItems);
    },

    async getManifestItem(workspaceId: string, itemId: string) {
      const item = manifestItems.find(i => i.id === itemId);
      if (!item) throw new Error(`Item ${itemId} not found`);
      return Promise.resolve(item);
    },

    async updateManifestItem(workspaceId: string, itemId: string, updates: any) {
      return Promise.resolve();
    },

    async deleteManifestItem(workspaceId: string, itemId: string) {
      return Promise.resolve();
    },

    // Content operations
    async getItemContent(workspaceId: string, itemId: string) {
      if (itemId.includes('chapter')) {
        return Promise.resolve(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter Content</title>
</head>
<body>
  <h1>Sample Chapter</h1>
  <p>This is sample content for demonstration purposes.</p>
</body>
</html>`);
      }
      return Promise.resolve('Sample content');
    },

    async setItemContent(workspaceId: string, itemId: string, content: any) {
      return Promise.resolve();
    },

    async getContentPreview(workspaceId: string, itemId: string) {
      return Promise.resolve({
        type: 'text',
        content: 'Sample preview content',
        metadata: { size: 1234, lastModified: new Date() },
      });
    },

    // Item creation operations
    async createTextItem(workspaceId: string, itemData: any) {
      return Promise.resolve({
        id: itemData.id || 'new-item',
        href: itemData.fileName || 'new-file.txt',
        mediaType: itemData.mediaType || 'text/plain',
        size: 0,
        modified: new Date(),
      });
    },

    async createFileItem(workspaceId: string, file: File) {
      return Promise.resolve({
        id: file.name.replace(/\./g, '-'),
        href: file.name,
        mediaType: file.type || 'application/octet-stream',
        size: file.size,
        modified: new Date(),
      });
    },

    async importFileItem(workspaceId: string, filePath: string, content: ArrayBuffer) {
      return Promise.resolve({
        id: filePath.replace(/\./g, '-'),
        href: filePath,
        mediaType: 'application/octet-stream',
        size: content.byteLength,
        modified: new Date(),
      });
    },

    // Manifest structure operations
    async reorderManifestItems(workspaceId: string, itemIds: string[]) {
      return Promise.resolve();
    },

    async getManifestOrder(workspaceId: string) {
      return Promise.resolve(manifestItems.map(i => i.id));
    },

    async validateManifest(workspaceId: string) {
      // Return some mock validation errors for items that have warnings in UI
      return Promise.resolve([
        {
          severity: 'warning',
          message: 'Missing source file',
          itemId: 'titlepage',
          type: 'missing-source',
        },
        {
          severity: 'warning',
          message: 'Non-linear item in spine',
          itemId: 'appendix',
          type: 'spine-validation',
        },
      ]);
    },

    // Advanced mode operations
    async listSourceItems(workspaceId: string) {
      return Promise.resolve([
        {
          path: 'SOURCE/text/chapter-001.txt',
          type: 'text',
          size: 1234,
          modified: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
        {
          path: 'SOURCE/text/chapter-002.txt',
          type: 'text',
          size: 2345,
          modified: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
      ]);
    },

    async getSourceItemContent(workspaceId: string, sourcePath: string) {
      return Promise.resolve(
        '# Sample Source Content\n\nThis is plain text content that would be transformed to XHTML.'
      );
    },

    async isAdvancedModeEnabled(workspaceId: string) {
      return Promise.resolve(true);
    },

    // Utility operations
    generateItemId(fileName: string) {
      return fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-');
    },

    detectMediaType(fileName: string, content?: ArrayBuffer) {
      if (fileName.endsWith('.xhtml') || fileName.endsWith('.html')) return 'application/xhtml+xml';
      if (fileName.endsWith('.css')) return 'text/css';
      if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
      if (fileName.endsWith('.png')) return 'image/png';
      if (fileName.endsWith('.mp3')) return 'audio/mpeg';
      if (fileName.endsWith('.mp4')) return 'video/mp4';
      return 'application/octet-stream';
    },

    getMediaTypeCategories() {
      return {
        text: ['application/xhtml+xml', 'text/html', 'text/css', 'text/plain'],
        image: ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'],
        audio: ['audio/mpeg', 'audio/ogg', 'audio/wav'],
        video: ['video/mp4', 'video/ogg', 'video/webm'],
        binary: ['application/octet-stream', 'application/pdf'],
      };
    },

    // Cache management
    clearCache(workspaceId?: string) {
      // Mock implementation - do nothing
    },

    async preloadManifest(workspaceId: string) {
      return Promise.resolve();
    },

    clearContentCache(workspaceId: string, itemId?: string) {
      // Mock implementation - do nothing
    },
  };
}

/**
 * Create a mock metadata manager for visual stories
 * This provides all the MetadataManager methods expected by MetadataEditor
 */
export function createVisualMockMetadataManager(scenario: VisualScenario = 'withContent') {
  const mockData = getVisualScenario(scenario);

  // Rich metadata based on scenario
  const getMetadata = () => {
    if (scenario === 'empty') {
      return {
        title: '',
        language: 'en',
        identifier: '',
        creator: [],
        description: '',
        publisher: '',
        date: '',
        rights: '',
        subject: [],
        contributor: [],
        type: '',
        source: '',
        relation: '',
        coverage: '',
        format: '',
      };
    }

    // Rich metadata for withContent and largeBook scenarios
    return {
      title: mockData.metadata.title,
      language: mockData.metadata.language,
      identifier: mockData.metadata.identifier,
      creator: [mockData.metadata.author, 'Co-Author Name'],
      description: mockData.metadata.description,
      publisher: 'Digital Publishing House',
      date: mockData.metadata.publishedDate,
      rights: 'Copyright © 2024 Digital Publishing House. All rights reserved.',
      subject: [
        'Technology',
        'Digital Transformation',
        'Fiction',
        'Contemporary Literature',
        'Human-Computer Interaction',
      ],
      contributor: ['Jane Editor (Editor)', 'Bob Illustrator (Illustrator)'],
      type: 'fiction',
      source: 'Original digital manuscript',
      relation: 'Part of the Digital Chronicles series',
      coverage: 'Global, 21st century',
      format: 'EPUB 3.0',
    };
  };

  const metadata = getMetadata();

  return {
    // Core metadata operations
    async loadMetadata(workspaceId: string) {
      return Promise.resolve(metadata);
    },

    async getMetadata(workspaceId: string) {
      return Promise.resolve(metadata);
    },

    async updateMetadata(workspaceId: string, updates: any) {
      // Mock update - merge changes
      Object.assign(metadata, updates);
      return Promise.resolve();
    },

    validateMetadata(metadata: any) {
      const errors = [];

      // Mock validation errors for demonstration
      if (!metadata.title?.trim()) {
        errors.push({
          field: 'title',
          severity: 'error' as const,
          message: 'Title is required',
          code: 'REQUIRED_FIELD',
        });
      }

      if (!metadata.identifier?.trim()) {
        errors.push({
          field: 'identifier',
          severity: 'error' as const,
          message: 'Identifier is required',
          code: 'REQUIRED_FIELD',
        });
      }

      if (metadata.language && !metadata.language.match(/^[a-z]{2}(-[A-Z]{2})?$/)) {
        errors.push({
          field: 'language',
          severity: 'warning' as const,
          message: 'Language should follow BCP 47 format (e.g., en, en-US)',
          code: 'INVALID_FORMAT',
        });
      }

      return errors;
    },

    // Array field operations
    async addArrayItem(workspaceId: string, field: string, value: string) {
      if (Array.isArray(metadata[field])) {
        metadata[field].push(value);
      }
      return Promise.resolve();
    },

    async removeArrayItem(workspaceId: string, field: string, index: number) {
      if (Array.isArray(metadata[field]) && index >= 0 && index < metadata[field].length) {
        metadata[field].splice(index, 1);
      }
      return Promise.resolve();
    },

    async updateArrayItem(workspaceId: string, field: string, index: number, value: string) {
      if (Array.isArray(metadata[field]) && index >= 0 && index < metadata[field].length) {
        metadata[field][index] = value;
      }
      return Promise.resolve();
    },

    // Utility operations
    async getLanguageOptions() {
      return Promise.resolve([
        { code: 'en', name: 'English' },
        { code: 'en-US', name: 'English (United States)' },
        { code: 'en-GB', name: 'English (United Kingdom)' },
        { code: 'es', name: 'Spanish' },
        { code: 'es-ES', name: 'Spanish (Spain)' },
        { code: 'es-MX', name: 'Spanish (Mexico)' },
        { code: 'fr', name: 'French' },
        { code: 'fr-FR', name: 'French (France)' },
        { code: 'fr-CA', name: 'French (Canada)' },
        { code: 'de', name: 'German' },
        { code: 'de-DE', name: 'German (Germany)' },
        { code: 'de-AT', name: 'German (Austria)' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'pt-BR', name: 'Portuguese (Brazil)' },
        { code: 'pt-PT', name: 'Portuguese (Portugal)' },
        { code: 'zh', name: 'Chinese' },
        { code: 'zh-CN', name: 'Chinese (Simplified)' },
        { code: 'zh-TW', name: 'Chinese (Traditional)' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' },
        { code: 'ar', name: 'Arabic' },
        { code: 'he', name: 'Hebrew' },
      ]);
    },

    async generateIdentifier() {
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
      return Promise.resolve(`urn:uuid:${uuid}`);
    },

    async getMetadataHistory(workspaceId: string) {
      return Promise.resolve([
        {
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          field: 'title',
          oldValue: 'The Digital Chronicles (Draft)',
          newValue: metadata.title,
          action: 'update',
        },
        {
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
          field: 'description',
          oldValue: '',
          newValue: metadata.description,
          action: 'update',
        },
      ]);
    },

    // Export/import operations
    async exportMetadata(workspaceId: string, format: 'json' | 'xml' = 'json') {
      if (format === 'xml') {
        return Promise.resolve(`<?xml version="1.0" encoding="UTF-8"?>
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>${metadata.title}</dc:title>
  <dc:creator>${Array.isArray(metadata.creator) ? metadata.creator.join(', ') : metadata.creator}</dc:creator>
  <dc:language>${metadata.language}</dc:language>
  <dc:identifier>${metadata.identifier}</dc:identifier>
  <dc:description>${metadata.description}</dc:description>
  <dc:publisher>${metadata.publisher}</dc:publisher>
  <dc:date>${metadata.date}</dc:date>
  <dc:rights>${metadata.rights}</dc:rights>
</metadata>`);
      }
      return Promise.resolve(JSON.stringify(metadata, null, 2));
    },

    async importMetadata(workspaceId: string, data: string, format: 'json' | 'xml' = 'json') {
      if (format === 'json') {
        const imported = JSON.parse(data);
        Object.assign(metadata, imported);
      }
      return Promise.resolve();
    },

    // Cache and performance
    clearCache(workspaceId?: string) {
      // Mock implementation - do nothing
    },

    async preloadMetadata(workspaceId: string) {
      return Promise.resolve();
    },
  };
}
