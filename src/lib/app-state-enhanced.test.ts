/**
 * Enhanced AppState Tests - Reactive Coordination Testing
 * 
 * Tests the reactive state coordination using Svelte 5 runes
 * and service integration patterns.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { EnhancedAppState } from './app-state-enhanced.svelte.js';
import type { FileStorageAPI } from './storage/index.js';

// Mock dependencies
function createMockFileStorage(): jest.Mocked<FileStorageAPI> {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(false), // Start as not initialized
    readJSONFile: vi.fn(),
    writeJSONFile: vi.fn(),
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
    listFiles: vi.fn().mockResolvedValue([]),
    fileExists: vi.fn().mockResolvedValue(true),
  } as any;
}

function createMockTransformExecutor() {
  return {
    transformText: vi.fn().mockResolvedValue({ result: 'transformed text', timeMs: 100 }),
    transformDom: vi.fn().mockResolvedValue({ result: 'transformed dom', timeMs: 50 })
  };
}

function createMockI18nSystem() {
  return {
    t: vi.fn().mockImplementation((key: string, params?: any) => {
      if (key === 'Hello {name}' && params?.name) return `Hello ${params.name}`;
      return key;
    }),
    getCurrentLocale: vi.fn().mockReturnValue('en')
  };
}

function createMockExtensionManager() {
  return {
    getAvailableTransforms: vi.fn().mockResolvedValue([
      { path: 'SOURCE/scripts/transform.js', extensionName: 'Default', fileName: 'transform.js' }
    ])
  };
}

function createMockThemeStore() {
  return {
    setTheme: vi.fn(),
    useSystemPreference: vi.fn(),
    getCurrentTheme: vi.fn().mockReturnValue('system')
  };
}

function createMockI18nStore() {
  return {
    setLocale: vi.fn(),
    getCurrentLocale: vi.fn().mockReturnValue('en')
  };
}

// Mock the services
vi.mock('./services/workspace/workspace.service.js', () => ({
  WorkspaceService: vi.fn().mockImplementation(() => ({
    createWorkspace: vi.fn().mockResolvedValue({
      id: 'workspace-123',
      opf: {
        metadata: {
          title: 'Test Book',
          language: 'en',
          identifier: 'test-123'
        },
        manifest: [
          { id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' }
        ],
        spine: [
          { idref: 'chapter1', linear: true }
        ]
      },
      pathInfo: { basePath: 'OEBPS', rootfilePath: 'OEBPS/content.opf' }
    }),
    loadWorkspace: vi.fn().mockResolvedValue({
      id: 'workspace-123',
      opf: {
        metadata: {
          title: 'Test Book',
          language: 'en',
          identifier: 'test-123'
        },
        manifest: [
          { id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' }
        ],
        spine: [
          { idref: 'chapter1', linear: true }
        ]
      },
      pathInfo: { basePath: 'OEBPS', rootfilePath: 'OEBPS/content.opf' }
    }),
    saveWorkspace: vi.fn().mockResolvedValue(undefined),
    deleteWorkspace: vi.fn().mockResolvedValue(undefined),
    populateWithContent: vi.fn().mockResolvedValue({
      id: 'workspace-123',
      opf: {
        metadata: {
          title: 'Test Book',
          language: 'en',
          identifier: 'test-123'
        },
        manifest: [
          { id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' }
        ],
        spine: [
          { idref: 'chapter1', linear: true }
        ]
      },
      pathInfo: { basePath: 'OEBPS', rootfilePath: 'OEBPS/content.opf' }
    })
  }))
}));

vi.mock('./services/content/content.service.js', () => ({
  ContentService: vi.fn().mockImplementation(() => ({
    generateSampleContentData: vi.fn().mockResolvedValue({
      chapters: [
        {
          id: 'chapter1',
          title: 'Chapter 1',
          fileName: 'chapter1.txt',
          content: '# Chapter 1\n\nThis is sample content.',
          xhtmlContent: '<h1>Chapter 1</h1><p>This is sample content.</p>'
        }
      ],
      assets: [
        { path: 'OEBPS/Styles/page.css', content: 'body { margin: 0; }' }
      ],
      manifestUpdates: [
        { id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' }
      ],
      spineUpdates: [
        { idref: 'chapter1' }
      ]
    }),
    generateLocalizedContent: vi.fn().mockResolvedValue({
      metadata: {
        title: 'Sample Book',
        language: 'en',
        creator: ['Sample Author']
      },
      chapters: [
        { filename: 'chapter1.xhtml', title: 'Chapter 1', content: '<h1>Chapter 1</h1>' }
      ]
    })
  }))
}));

vi.mock('./services/settings/settings.service.js', () => ({
  SettingsService: vi.fn().mockImplementation(() => ({
    loadGlobalSettings: vi.fn().mockReturnValue({
      theme: 'system',
      locale: 'en',
      editor_font_size: 14
    }),
    saveGlobalSettings: vi.fn(),
    getDefaultGlobalSettings: vi.fn().mockReturnValue({
      theme: 'system',
      locale: 'en',
      editor_font_size: 14
    }),
    loadWorkspaceSettings: vi.fn().mockResolvedValue({
      bust_cache: false,
      draft_id: 0,
      editor: { preview_delay_ms: 500, advanced_mode: false }
    }),
    saveWorkspaceSettings: vi.fn().mockResolvedValue(undefined),
    getDefaultWorkspaceSettings: vi.fn().mockReturnValue({
      bust_cache: false,
      draft_id: 0,
      editor: { preview_delay_ms: 500, advanced_mode: false }
    }),
    loadEPUBSettings: vi.fn().mockResolvedValue({
      text_transform: 'SOURCE/scripts/transformText.js',
      dom_transforms: ['SOURCE/scripts/transformDom.js'],
      spine_basename: 'chapter'
    }),
    saveEPUBSettings: vi.fn().mockResolvedValue(undefined),
    getDefaultEPUBSettings: vi.fn().mockReturnValue({
      text_transform: 'SOURCE/scripts/transformText.js',
      dom_transforms: ['SOURCE/scripts/transformDom.js'],
      spine_basename: 'chapter'
    }),
    incrementDraftId: vi.fn().mockResolvedValue(1),
    generateDraftTitle: vi.fn().mockImplementation((base: string, id: number) => `${base} (Draft ${id})`),
    extractDraftInfo: vi.fn().mockImplementation((title: string) => ({ baseTitle: title, draftId: null }))
  }))
}));

vi.mock('./services/epub/epub-processor.service.js', () => ({
  EPUBProcessor: vi.fn().mockImplementation(() => ({
    packageEPUB: vi.fn().mockResolvedValue({
      success: true,
      blob: new Blob(['mock epub'], { type: 'application/epub+zip' }),
      filename: 'test.epub',
      fileCount: 3,
      totalSize: 1024,
      compressedSize: 512
    }),
    unpackEPUB: vi.fn().mockResolvedValue({
      success: true,
      workspaceId: 'unpacked-workspace-123',
      extractedFiles: ['mimetype', 'META-INF/container.xml', 'OEBPS/content.opf'],
      totalSize: 2048,
      processedFiles: 3
    })
  }))
}));

describe('EnhancedAppState Integration Tests', () => {
  let appState: EnhancedAppState;
  let mockFileStorage: jest.Mocked<FileStorageAPI>;
  let mockTransformExecutor: any;
  let mockI18nSystem: any;
  let mockExtensionManager: any;
  let mockThemeStore: any;
  let mockI18nStore: any;
  let mockTransformEngine: any;

  beforeEach(() => {
    mockFileStorage = createMockFileStorage();
    mockTransformExecutor = createMockTransformExecutor();
    mockI18nSystem = createMockI18nSystem();
    mockExtensionManager = createMockExtensionManager();
    mockThemeStore = createMockThemeStore();
    mockI18nStore = createMockI18nStore();
    mockTransformEngine = {
      initialize: vi.fn(),
      setTransformScripts: vi.fn(),
      executeTransform: vi.fn(),
      setDebugMode: vi.fn(),
      ping: vi.fn(),
      cleanup: vi.fn()
    };

    appState = new EnhancedAppState(
      mockFileStorage,
      mockTransformExecutor,
      mockI18nSystem,
      mockExtensionManager,
      mockThemeStore,
      mockI18nStore,
      mockTransformEngine,
      true // Skip reactive effects in tests
    );
  });

  describe('Initialization', () => {
    test('initializes with default state', () => {
      expect(appState.workspace).toBeNull();
      expect(appState.selectedChapterId).toBeNull();
      expect(appState.initialized).toBe(false);
      expect(appState.isLoading).toBe(false);
    });

    test('loads global settings on construction', () => {
      expect(appState.globalSettings).toEqual({
        theme: 'system',
        locale: 'en',
        editor_font_size: 14
      });
    });

    test('initialize() sets up FileStorageAPI', async () => {
      await appState.initialize();

      expect(mockFileStorage.init).toHaveBeenCalled();
      expect(appState.initialized).toBe(true);
    });
  });

  describe('Workspace Operations', () => {
    test('createWorkspace() creates and loads workspace', async () => {
      const workspaceId = await appState.createWorkspace('Test Book', 'en');

      expect(workspaceId).toBe('workspace-123');
      expect(appState.workspace).not.toBeNull();
      expect(appState.workspace?.opf.metadata.title).toBe('Test Book');
    });

    test('loadWorkspace() updates workspace state', async () => {
      await appState.loadWorkspace('workspace-123');

      expect(appState.workspace).not.toBeNull();
      expect(appState.workspace?.id).toBe('workspace-123');
      expect(appState.workspace?.opf.metadata.title).toBe('Test Book');
    });

    test('deleteWorkspace() clears current workspace if deleted', async () => {
      // First load a workspace
      await appState.loadWorkspace('workspace-123');
      expect(appState.workspace).not.toBeNull();

      // Then delete it
      await appState.deleteWorkspace('workspace-123');
      expect(appState.workspace).toBeNull();
    });
  });

  describe('Computed Properties', () => {
    beforeEach(async () => {
      await appState.loadWorkspace('workspace-123');
    });

    test('hasWorkspace returns correct value', () => {
      expect(appState.hasWorkspace).toBe(true);
      
      appState.workspace = null;
      expect(appState.hasWorkspace).toBe(false);
    });

    test('workspaceInfo returns workspace information', () => {
      const info = appState.workspaceInfo;
      
      expect(info).not.toBeNull();
      expect(info?.id).toBe('workspace-123');
      expect(info?.title).toBe('Test Book');
      expect(info?.language).toBe('en');
    });

    test('navigationItems returns spine-based navigation', () => {
      const items = appState.navigationItems;
      
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({
        id: 'chapter1',
        title: 'chapter1',
        href: 'Text/chapter1.xhtml',
        order: 0
      });
    });

    test('availableChapters returns XHTML manifest items', () => {
      const chapters = appState.availableChapters;
      
      expect(chapters).toHaveLength(1);
      expect(chapters[0]).toEqual({
        id: 'chapter1',
        title: 'chapter1',
        href: 'Text/chapter1.xhtml'
      });
    });
  });

  describe('Selection State', () => {
    beforeEach(async () => {
      await appState.loadWorkspace('workspace-123');
    });

    test('selectChapter() updates selected chapter', () => {
      appState.selectChapter('chapter1');
      expect(appState.selectedChapterId).toBe('chapter1');

      appState.selectChapter(null);
      expect(appState.selectedChapterId).toBeNull();
    });

    test('selectManifestItem() updates selected manifest item', () => {
      appState.selectManifestItem('chapter1');
      expect(appState.selectedManifestItemId).toBe('chapter1');

      appState.selectManifestItem(null);
      expect(appState.selectedManifestItemId).toBeNull();
    });

    test('selectedChapter returns chapter content info', () => {
      appState.selectChapter('chapter1');
      const chapter = appState.selectedChapter;
      
      expect(chapter).not.toBeNull();
      expect(chapter?.id).toBe('chapter1');
      expect(chapter?.href).toBe('Text/chapter1.xhtml');
      expect(chapter?.mediaType).toBe('application/xhtml+xml');
    });
  });

  describe('Settings Management', () => {
    test('updateGlobalSettings() updates and saves settings', () => {
      appState.updateGlobalSettings({ theme: 'dark', editor_font_size: 16 });

      expect(appState.globalSettings?.theme).toBe('dark');
      expect(appState.globalSettings?.editor_font_size).toBe(16);
    });

    test('currentTheme computed property', () => {
      expect(appState.currentTheme).toBe('system');
      
      appState.updateGlobalSettings({ theme: 'dark' });
      expect(appState.currentTheme).toBe('dark');
    });

    test('currentLocale computed property', () => {
      expect(appState.currentLocale).toBe('en');
      
      appState.updateGlobalSettings({ locale: 'fr' });
      expect(appState.currentLocale).toBe('fr');
    });

    test('workspace settings load when workspace changes', async () => {
      await appState.loadWorkspace('workspace-123');

      // Since reactive effects are skipped in tests, manually trigger settings loading
      await appState.loadWorkspaceSettings('workspace-123');
      await appState.loadEPUBSettings('workspace-123');

      expect(appState.workspaceSettings).not.toBeNull();
      expect(appState.epubSettings).not.toBeNull();
    });
  });

  describe('Draft Mode', () => {
    beforeEach(async () => {
      await appState.loadWorkspace('workspace-123');
      // Since reactive effects are skipped in tests, manually load settings
      await appState.loadWorkspaceSettings('workspace-123');
      await appState.loadEPUBSettings('workspace-123');
    });

    test('isDraftMode computed property', () => {
      expect(appState.isDraftMode).toBe(false);
      
      if (appState.workspaceSettings) {
        appState.workspaceSettings.draft_id = 1;
      }
      expect(appState.isDraftMode).toBe(true);
    });

    test('incrementDraftId() updates draft state', async () => {
      await appState.incrementDraftId();

      expect(appState.workspaceSettings?.draft_id).toBe(1);
      expect(appState.workspace?.opf.metadata.title).toContain('(Draft 1)');
    });
  });

  describe('EPUB Operations', () => {
    beforeEach(async () => {
      await appState.loadWorkspace('workspace-123');
    });

    test('packageEPUB() creates EPUB blob', async () => {
      const blob = await appState.packageEPUB();

      expect(blob).not.toBeNull();
      expect(blob?.type).toBe('application/epub+zip');
    });

    test('unpackEPUB() loads workspace from file', async () => {
      const mockFile = new File(['mock epub content'], 'test.epub', { 
        type: 'application/epub+zip' 
      });

      const workspaceId = await appState.unpackEPUB(mockFile);

      expect(workspaceId).toBe('unpacked-workspace-123');
      expect(appState.workspace?.id).toBe('workspace-123'); // Loads the unpacked workspace
    });
  });

  describe('Error Handling', () => {
    test('handles initialization errors', async () => {
      // Create fresh file storage mock that will fail
      const failingFileStorage = createMockFileStorage();
      failingFileStorage.init.mockRejectedValue(new Error('Storage error'));

      // Create new appState instance with failing storage
      const failingAppState = new EnhancedAppState(
        failingFileStorage,
        mockTransformExecutor,
        mockI18nSystem,
        mockExtensionManager,
        mockThemeStore,
        mockI18nStore,
        mockTransformEngine,
        true // Skip reactive effects
      );

      await expect(failingAppState.initialize()).rejects.toThrow('Storage error');
      expect(failingAppState.errorMessage).toContain('Failed to initialize');
    });

    test('handles workspace loading errors', async () => {
      // Create a fresh mock service that fails for this test only
      const failingWorkspaceService = {
        createWorkspace: vi.fn(),
        loadWorkspace: vi.fn().mockRejectedValue(new Error('Workspace not found')),
        saveWorkspace: vi.fn(),
        deleteWorkspace: vi.fn()
      };

      // Create new instance with failing service
      const failingAppState = new EnhancedAppState(
        mockFileStorage,
        mockTransformExecutor,
        mockI18nSystem,
        mockExtensionManager,
        mockThemeStore,
        mockI18nStore,
        mockTransformEngine,
        true // Skip reactive effects
      );

      // Replace the workspaceService with our failing one
      (failingAppState as any).workspaceService = failingWorkspaceService;

      await expect(failingAppState.loadWorkspace('invalid-id')).rejects.toThrow('Workspace not found');
      expect(failingAppState.errorMessage).toContain('Failed to load workspace');
    });
  });

  describe('Cleanup', () => {
    test('cleanup() resets all state', async () => {
      // Set up some state
      await appState.loadWorkspace('workspace-123');
      await appState.loadWorkspaceSettings('workspace-123');
      await appState.loadEPUBSettings('workspace-123');
      appState.selectChapter('chapter1');
      appState.selectManifestItem('chapter1');

      // Clean up
      appState.cleanup();

      expect(appState.workspace).toBeNull();
      expect(appState.selectedChapterId).toBeNull();
      expect(appState.selectedManifestItemId).toBeNull();
      expect(appState.initialized).toBe(false);
      expect(appState.isLoading).toBe(false);
      expect(appState.errorMessage).toBeNull();
    });
  });
});