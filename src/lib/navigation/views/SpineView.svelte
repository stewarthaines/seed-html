<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { navigationStore } from '../navigation-store';
  import type {
    WorkspaceService,
    WorkspaceState,
  } from '../../services/workspace/workspace.service.js';
  import type { SpineService } from '../../services/spine/spine.service.js';
  import type { ContentService } from '../../services/content/content.service.js';
  import type { AudioClipService } from '../../audio/audio-clip.service.js';
  import type { SpineItemWithSource } from '../../spine/types';
  import EditorPane from '../../components/spine/EditorPane.svelte';
  // import PreviewPane from '../../components/spine/PreviewPane.svelte';
  import {
    createSpinePreviewManager,
    DEFAULT_PREVIEW_CONFIG,
  } from '../../transform/spine-preview-manager.js';
  import { writable } from 'svelte/store';
  import type {
    PreviewUpdateEvent,
    PreviewErrorEvent,
    CurrentContent,
    ContentType,
    TransformError,
  } from '../../types/spine-editor.js';
  import { BlobURLManager } from '../../blob-url/blob-url-manager.js';
  import { SettingsService } from '../../services/settings/settings.service.js';
  import { ExtensionManager } from '../../extensions/extension-manager.js';
  import { FileStorageAPI } from '../../storage/index.js';
  import type { TransformEngine } from '../../infrastructure/transform-engine.js';
  import { t } from '../../i18n';
  import { themeStore } from '../../stores/theme.js';
  import { i18nService } from '../../i18n/index.js';
  import {
    createTextEditorStore,
    clearAllTextEditorStores,
  } from '../../stores/text-editor-store.js';
  import type { TextEditorStore } from '../../stores/index.js';

  // Element reference for event binding
  let spineViewElement = $state<HTMLElement>();

  // Props using clean service architecture with Svelte 5 runes
  let {
    workspace = null as any,
    workspaceService = null as any,
    spineService = null as any,
    contentService,
    audioClipService = null,
    selectedItemId = null,
    transformEngine = null as any,
    onPreviewUpdate,
  }: {
    workspace: WorkspaceState;
    workspaceService: WorkspaceService;
    spineService: SpineService;
    contentService: ContentService;
    audioClipService: AudioClipService | null;
    selectedItemId: string | null;
    transformEngine: TransformEngine;
    onPreviewUpdate?: (detail: {
      xhtmlContent: string;
      isTransforming: boolean;
      transformError: TransformError | null;
      transformWarnings: string[];
      executionTime: number;
      spineItemId: string | null;
    }) => void;
  } = $props();

  // Component state - using $state() for reactivity in Svelte 5
  let selectedItem = $state<SpineItemWithSource | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let guardId: string;

  // Service dependencies for spine editor
  let fileStorage: FileStorageAPI;
  let extensionManager: ExtensionManager;
  let blobURLManager: BlobURLManager;
  let settingsService = $state<SettingsService>();
  let servicesInitialized = $state(false);

  // Spine editor state
  let previewManager = $state<any>(null);
  let currentContent: CurrentContent = {
    text: '',
  };

  // Available files for editor pane dropdowns
  let availableFiles: Array<{
    value: string;
    label: string;
    path: string;
    href: string;
    type: 'text' | 'css' | 'javascript' | 'transform';
  }> = [];

  // Pane-specific available files (filtered to prevent conflicts)
  let availableFiles1 = $state<
    Array<{
      value: string;
      label: string;
      path: string;
      href: string;
      type: 'text' | 'css' | 'javascript' | 'transform';
    }>
  >([]);
  let availableFiles2 = $state<
    Array<{
      value: string;
      label: string;
      path: string;
      href: string;
      type: 'text' | 'css' | 'javascript' | 'transform';
    }>
  >([]);

  // Track previous selectedItemId to prevent unnecessary reloads
  let previousSelectedItemId: string | null = null;

  // Loading guard to prevent concurrent spine item loads
  let isLoadingSpineItem = false;

  // Editor reference for preview click navigation
  let editorPaneRef = $state<any>(null);

  // Spine editor configuration interface for persistence (content never persisted)
  interface SpineEditorConfig {
    pane1: { fileType: string; selectedFile?: string } | null;
    pane2: { fileType: string; selectedFile?: string } | null;
    mode: 'single' | 'dual';
  }

  // Complete pane state tracking including UI state (content for non-text files only)
  let paneState = $state({
    mode: 'single' as 'single' | 'dual',
    pane1: {
      filePath: '',
      fileHref: '',
      fileType: '',
      contentType: null as ContentType | null,
      selectedFileValue: '', // For dropdown display
      content: '', // For non-text files only (CSS, JS)
    },
    pane2: {
      filePath: '',
      fileHref: '',
      fileType: '',
      contentType: null as ContentType | null,
      selectedFileValue: '', // For dropdown display
      content: '', // For CSS/JS files
    },
  });

  // Reactive stores for spine editor
  const previewContent = writable<string>('');
  const transformWarnings = writable<string[]>([]);
  const transformError = writable<TransformError | null>(null);
  const isTransforming = writable<boolean>(false);
  const executionTime = writable<number>(0);

  // Pane-specific error state for inline error display
  let pane1Error = $state<string | null>(null);
  let pane2Error = $state<string | null>(null);

  // File-backed content stores for any text-based file (text, CSS, JS, transform scripts)
  let fileContentStores = new Map<string, TextEditorStore>();

  // Simple reactive store variables - assigned imperatively in handleFileSelect
  let pane1Store = $state<TextEditorStore | null>(null);
  let pane2Store = $state<TextEditorStore | null>(null);

  // Workspace change tracking for store cleanup
  let previousWorkspaceId: string | null = null;

  // Workspace change detection - cleanup stores when workspace switches
  $effect(() => {
    if (workspace?.id && (previousWorkspaceId === null || workspace.id !== previousWorkspaceId)) {
      // Clean up local stores
      for (const store of fileContentStores.values()) {
        store.destroy();
      }
      fileContentStores.clear();
      pane1Store = null;
      pane2Store = null;

      // Clear global TextEditorStore registry to prevent ID collisions
      clearAllTextEditorStores();

      // Load workspace extensions into transform engine
      transformEngine.setWorkspaceExtensions(workspace.id).catch(error => {
        console.error('Failed to load workspace extensions:', error);
      });
    }

    // Update tracking
    previousWorkspaceId = workspace?.id || null;
  });

  // Store subscriptions will be handled after implementing direct assignment

  // ViewComponent interface implementation
  export function onViewEnter(_data?: any): void {
    // Initialize services and load selected item if available
    initializeServices();
    if (selectedItemId) {
      loadSelectedItem();
    }
  }

  export function onViewLeave(): void {
    // Clean up any state if needed
  }

  export function getViewData(): any {
    return {
      selectedItemId,
      selectedItem,
    };
  }

  export function setViewData(data: any): void {
    if (data.selectedItemId) {
      selectedItemId = data.selectedItemId;
      loadSelectedItem();
    }
  }

  export async function canLeave(): Promise<boolean> {
    // Allow leaving (spine editor handles auto-save)
    return true;
  }

  // Initialize service dependencies
  async function initializeServices() {
    if (servicesInitialized) return;

    try {
      // Get FileStorageAPI singleton
      fileStorage = FileStorageAPI.getInstance();

      // Initialize extension manager
      extensionManager = new ExtensionManager(fileStorage);

      // Initialize blob URL manager with config object
      blobURLManager = new BlobURLManager({
        fileStorage,
        basePath: 'OEBPS', // Standard EPUB content base path
        maxBlobURLs: 100,
        onCapacityReached: () => {
          console.warn('Blob URL capacity reached - consider cleanup');
        },
      });

      // Initialize settings service with real implementations
      settingsService = new SettingsService(fileStorage, extensionManager, themeStore, i18nService);

      servicesInitialized = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to initialize services';
      console.error('Failed to initialize spine editor services:', err);
    }
  }

  // Update pane-specific available files based on current selections
  function updatePaneSpecificFiles() {
    if (paneState.mode === 'single') {
      // Single pane mode - no conflicts possible, all files available to both panes
      availableFiles1 = availableFiles;
      availableFiles2 = availableFiles;
    } else {
      // Dual pane mode - prevent text content conflicts between visible panes
      const pane1HasText = paneState.pane1.fileType === 'text';
      const pane2HasText = paneState.pane2.fileType === 'text';

      // Filter available files for each pane to prevent conflicts
      availableFiles1 = availableFiles.filter(file => {
        if (file.type === 'text' && pane2HasText) {
          return false; // Hide text option from pane 1 if pane 2 has it
        }
        return true;
      });

      availableFiles2 = availableFiles.filter(file => {
        if (file.type === 'text' && pane1HasText) {
          return false; // Hide text option from pane 2 if pane 1 has it
        }
        return true;
      });
    }
  }

  // Load available files for editor panes
  async function loadAvailableFiles() {
    if (!selectedItemId || !servicesInitialized) return;

    try {
      // Always include text content for current spine item
      const files: Array<{
        value: string;
        label: string;
        path: string;
        href: string;
        type: 'text' | 'css' | 'javascript' | 'transform';
      }> = [
        {
          value: 'text',
          label: 'Text Content',
          path: `SOURCE/text/${selectedItemId}.txt`,
          href: `SOURCE/text/${selectedItemId}.txt`, // text files don't have manifest hrefs
          type: 'text',
        },
      ];

      // Add CSS and JavaScript files from the manifest. The manifest is the
      // source of truth (it's what gets injected into the rendered/preview
      // <head>), so a stylesheet renamed/relocated via the manifest editor still
      // appears here and the dropdown always matches the head. Resolve each
      // manifest href to its actual workspace path for content loading.
      const resolveManifestHref = (href: string) =>
        workspace.pathInfo.basePath ? `${workspace.pathInfo.basePath}/${href}` : href;

      for (const item of workspace.opf.manifest) {
        if (item.mediaType === 'text/css') {
          const fileName =
            item.href
              .split('/')
              .pop()
              ?.replace(/\.css$/, '') || item.href;
          files.push({
            value: `css-${fileName}`,
            label: `CSS: ${fileName}`,
            path: resolveManifestHref(item.href),
            href: item.href,
            type: 'css',
          });
        } else if (
          item.mediaType === 'text/javascript' ||
          item.mediaType === 'application/javascript'
        ) {
          const fileName = item.href.split('/').pop()?.replace(/\.js$/, '') || item.href;
          files.push({
            value: `js-${fileName}`,
            label: `JS: ${fileName}`,
            path: resolveManifestHref(item.href),
            href: item.href,
            type: 'javascript',
          });
        }
      }

      // Add transform scripts from SOURCE/scripts/ (if any exist)
      try {
        const transformFiles = await fileStorage.listFiles(workspace.id, 'SOURCE/scripts');
        for (const transformFile of transformFiles) {
          if (transformFile.endsWith('.js')) {
            const fileName = transformFile.split('/').pop()?.replace('.js', '') || transformFile;
            files.push({
              value: `transform-${fileName}`,
              label: `Transform: ${fileName}`,
              path: transformFile,
              href: transformFile, // transform files don't have manifest hrefs
              type: 'transform',
            });
          }
        }
      } catch {
        // No transform files yet, that's okay
      }

      availableFiles = files;

      // Update pane-specific files based on current selections
      updatePaneSpecificFiles();
    } catch (err) {
      console.error('Failed to load available files:', err);
      // Fallback to just text content
      availableFiles = [
        {
          value: 'text',
          label: 'Text Content',
          path: `SOURCE/text/${selectedItemId}.txt`,
          href: `SOURCE/text/${selectedItemId}.txt`, // text files don't have manifest hrefs
          type: 'text',
        },
      ];

      // Update pane-specific files for fallback case too
      updatePaneSpecificFiles();
    }
  }

  // File-backed text editor store functions
  /**
   * Create a file-backed store for any text-based file
   * Implements the pattern from text-editor-store-API.md
   */
  async function createFileBackedStore(
    manifestItem: {
      value: string;
      label: string;
      path: string;
      href: string;
      type: 'text' | 'css' | 'javascript' | 'transform';
    },
    workspaceId: string,
    workspaceService: WorkspaceService
  ): Promise<TextEditorStore> {
    const filePath = manifestItem.path;
    const editorId = `file-content-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}`;

    // Load initial content from file
    let initialContent = '';
    try {
      const buffer = await workspaceService.readFile(workspaceId, filePath);
      initialContent = new TextDecoder().decode(buffer);
    } catch {
      // File doesn't exist, start with empty content
    }

    const store = createTextEditorStore(editorId, initialContent);

    // Combined save and preview subscription - ensures sequential operations
    let debounceTimeout: ReturnType<typeof setTimeout>;
    store.subscribe(state => {
      if (!previewManager) return;

      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        try {
          // Step 1: Save file first (required for blob URL generation)
          await workspaceService.writeFile(workspaceId, manifestItem.path, state.content);

          // Step 2: Then update preview (reads from saved file)
          if (manifestItem.type === 'text') {
            previewManager.updateContent('text', state.content);
          } else if (['css', 'javascript', 'transform'].includes(manifestItem.type)) {
            if (manifestItem.href && blobURLManager) {
              blobURLManager.revokeFileBlob(manifestItem.href);
            }
            previewManager.forcePreviewUpdate();
          }
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, 300); // Single 300ms debounce for both save and preview
    });

    return store;
  }

  /**
   * Get existing store or create new one (lazy initialization)
   * Stores are cached for session-level performance
   */
  async function getOrCreateFileStore(
    manifestItem: {
      value: string;
      label: string;
      path: string;
      href: string;
      type: 'text' | 'css' | 'javascript' | 'transform';
    },
    workspaceId: string,
    workspaceService: WorkspaceService
  ): Promise<TextEditorStore | null> {
    try {
      const filePath = manifestItem.path;

      // Check if store already exists
      if (fileContentStores.has(filePath)) {
        return fileContentStores.get(filePath)!;
      }

      // Create new file-backed store
      const store = await createFileBackedStore(manifestItem, workspaceId, workspaceService);

      // Cache for session (check again in case of concurrent creation)
      if (!fileContentStores.has(filePath)) {
        fileContentStores.set(filePath, store);
        return store;
      } else {
        // Someone else created it, destroy ours and return theirs
        store.destroy();
        return fileContentStores.get(filePath)!;
      }
    } catch (error) {
      console.error(`Failed to get/create file store for ${manifestItem.path}:`, error);
      return null;
    }
  }

  // Initialize spine editor preview manager
  async function initializeSpineEditor() {
    if (!selectedItemId || !servicesInitialized) return;

    try {
      // Load available files for editor panes
      await loadAvailableFiles();

      // Validate spine item synchronization before proceeding
      if (!selectedItem || selectedItem.id !== selectedItemId) {
        console.warn('⚠️ Spine item synchronization issue:', {
          selectedItemId,
          selectedItemActualId: selectedItem?.id,
          selectedItem: selectedItem,
        });
        // Skip preview manager operation if spine item data is mismatched
        return;
      }

      // Create or reuse preview manager (workspace singleton pattern)
      if (!previewManager) {
        // First time creation - initialize workspace-scoped preview manager
        previewManager = createSpinePreviewManager(
          workspace.id,
          selectedItem.idref,
          fileStorage,
          extensionManager,
          blobURLManager,
          workspaceService,
          settingsService!,
          transformEngine,
          DEFAULT_PREVIEW_CONFIG,
          handlePreviewUpdate,
          handlePreviewError,
          selectedItem
        );

        // Initialize transform pipeline first
        await previewManager.initialize();

        // Load initial content and render
        await previewManager.loadInitialContent();
      } else {
        // Existing preview manager - switch spine context
        await previewManager.switchToSpineItem(selectedItem.idref, selectedItem);
      }

      // Update current content reference
      currentContent = previewManager.getCurrentContent();

      // Restore saved pane configuration or initialize with defaults
      await restoreOrInitializePaneContent();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to initialize spine editor';
      console.error('Failed to initialize spine editor:', err);
    }
  }

  // Restore saved pane configuration or initialize with defaults
  async function restoreOrInitializePaneContent() {
    if (availableFiles.length === 0) return;

    // Try to restore saved configuration from navigationStore
    const savedConfig = navigationStore.getViewData<SpineEditorConfig>('spine');

    if (savedConfig && (savedConfig.pane1 || savedConfig.pane2)) {
      // Restore saved pane configuration
      await restorePaneConfiguration(savedConfig);
    } else {
      // Default initialization - text content in pane 1
      const textFile = availableFiles.find(f => f.type === 'text');
      if (textFile) {
        const contentType = getContentType(textFile.type);
        paneState.mode = 'single';
        paneState.pane1 = {
          filePath: textFile.path,
          fileHref: textFile.href,
          fileType: textFile.type,
          contentType,
          selectedFileValue: textFile.value,
          content: '', // Empty for text files (handled by store)
        };

        // Remove conditional bypass - text store should handle content loading
        console.warn('restoreOrInitializePaneContent bypassed loadFileIntoPane for text content');

        // Persist the default configuration
        persistPaneConfiguration();
      }
    }

    // Force preview update after pane restoration to ensure new spine item content is shown
    if (previewManager) {
      await previewManager.forcePreviewUpdate();
    }
  }

  // Map file type to ContentType for preview manager
  function getContentType(fileType: string): ContentType | null {
    if (fileType === 'text') return 'text';
    // CSS/JS files are no longer handled by preview manager - they are auto-saved by SpineView
    return null;
  }

  // Determine if a file type is spine-specific (changes per spine item) or global (shared across spine items)
  function isSpineSpecificFile(fileType: string): boolean {
    return fileType === 'text'; // Only text content is spine-specific
    // CSS, JS, and transform files are global and shared across spine items
  }

  // Handle file selection in editor panes
  async function handleFileSelect(
    event: CustomEvent<{ pane: 1 | 2; filePath: string; fileType: string }>
  ) {
    const { pane, filePath, fileType } = event.detail;

    // Find the file in availableFiles to get the href and value
    const selectedFile = availableFiles.find(f => f.path === filePath);
    if (!selectedFile) {
      return;
    }

    const fileHref = selectedFile.href;
    const fileValue = selectedFile.value;

    // Clear existing content to prevent stale content display
    const paneKey = `pane${pane}` as keyof Pick<typeof paneState, 'pane1' | 'pane2'>;

    // Update pane state tracking with fresh state
    const contentType = getContentType(fileType);
    paneState[paneKey] = {
      filePath,
      fileHref,
      fileType,
      contentType,
      selectedFileValue: fileValue,
      content: '', // Will be loaded below for non-text files
    };

    // Clear any existing pane-specific error when switching files
    if (pane === 1) {
      pane1Error = null;
    } else {
      pane2Error = null;
    }

    // Switch to dual mode if pane 2 is being used
    if (pane === 2 && paneState.mode === 'single') {
      paneState.mode = 'dual';
    }

    // Persist pane configuration to navigationStore
    persistPaneConfiguration();

    // Get or create store for this file (stores are cached in fileContentStores map)
    const store = await getOrCreateFileStore(selectedFile, workspace.id, workspaceService);

    if (store) {
      // Directly assign store to the appropriate pane (imperative assignment)
      if (pane === 1) {
        pane1Store = store;
      } else {
        pane2Store = store;
      }
    } else {
      console.error('❌ Failed to create file store for:', filePath);
    }

    // Update pane-specific available files to reflect new selections
    updatePaneSpecificFiles();
  }

  /**
   * Validate JavaScript syntax before execution
   * Returns null if valid, error message if invalid
   *
   * Note: CSS validation is not supported due to browser limitations.
   * CSS parsers are designed for graceful error recovery rather than validation.
   */
  function validateJavaScriptSyntax(code: string): string | null {
    if (!code || code.trim() === '') {
      return null; // Empty content is valid
    }

    try {
      // Use Function constructor to validate syntax without executing
      new Function(code);
      return null; // Syntax is valid
    } catch (error) {
      if (error instanceof SyntaxError) {
        return `JavaScript syntax error: ${error.message}`;
      }
      return `JavaScript validation error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // Handle content changes from editor panes (for non-text files only)
  function handlePaneContentChange(event: CustomEvent<{ pane: 1 | 2; content: string }>) {
    const { pane, content } = event.detail;

    const paneKey = `pane${pane}` as keyof Pick<typeof paneState, 'pane1' | 'pane2'>;

    // Update pane state content for non-text files (CSS, JS)
    paneState[paneKey].content = content;

    // Get the content type for this pane
    const { contentType, filePath, fileHref, fileType } = paneState[paneKey];

    // Validate JavaScript syntax for JS and transform files
    if (
      (fileType.includes('javascript') || fileType.includes('js') || fileType === 'transform') &&
      content.trim()
    ) {
      const syntaxError = validateJavaScriptSyntax(content);
      if (syntaxError) {
        // Set pane-specific error for inline display
        if (pane === 1) {
          pane1Error = syntaxError;
        } else {
          pane2Error = syntaxError;
        }
        return; // Don't proceed with auto-save if syntax is invalid
      } else {
        // Clear pane error if syntax becomes valid
        if (pane === 1) {
          pane1Error = null;
        } else {
          pane2Error = null;
        }
      }
    } else {
      // Clear error for non-JavaScript files or empty content
      if (pane === 1) {
        pane1Error = null;
      } else {
        pane2Error = null;
      }
    }

    // Update preview manager if this is text content (only text content flows to preview)
    if (contentType && previewManager) {
      currentContent[contentType] = content;
      previewManager.updateContent(contentType, content);
    }

    // Auto-save all content to file system (debounced) - CSS/JS auto-save is the only path for those files
    if (filePath) {
      debounceAutoSave(filePath, fileHref, content);
    }
  }

  // Handle pane toggle with smart conflict resolution and auto-selection
  async function handlePaneToggle() {
    const newMode = paneState.mode === 'single' ? 'dual' : 'single';

    if (newMode === 'dual') {
      let defaultFile = null;

      // Check for text content conflicts when switching to dual mode
      if (paneState.pane1.fileType === 'text' && paneState.pane2.fileType === 'text') {
        // Conflict: keep text in pane 1, find alternative for pane 2
        defaultFile = availableFiles.find(f => f.type !== 'text');
        console.log(
          '🔄 Text conflict resolved: moving pane 2 from text to',
          defaultFile?.label || 'empty'
        );
      } else if (!paneState.pane2.selectedFileValue || paneState.pane2.selectedFileValue === '') {
        // No conflict, but pane 2 needs default selection - use first available file
        defaultFile = availableFiles[0];
      }

      // Apply default selection and create store if needed
      if (defaultFile) {
        paneState.pane2 = {
          selectedFileValue: defaultFile.value,
          filePath: defaultFile.path,
          fileType: defaultFile.type,
          fileHref: defaultFile.href,
          contentType: 'text',
          content: '',
        };

        // Create store for the default file
        try {
          const store = await getOrCreateFileStore(defaultFile, workspace.id, workspaceService);
          if (store) {
            pane2Store = store;
          }
        } catch (error) {
          console.error('Failed to create store for pane 2 default selection:', error);
        }
      }
    }

    paneState.mode = newMode;
    persistPaneConfiguration();
    updatePaneSpecificFiles();
  }

  // Debounced auto-save functionality
  let autoSaveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  function debounceAutoSave(filePath: string, fileHref: string, content: string) {
    // Clear existing timeout for this file
    const existingTimeout = autoSaveTimeouts.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout for auto-save
    const timeout = setTimeout(async () => {
      try {
        // CRITICAL: Validate that the file path is still valid for current spine item
        // This prevents race conditions where user switches spine items during debounce
        const isStillValid = validateAutoSaveStillValid(filePath, content);
        if (!isStillValid) {
          return;
        }

        await fileStorage.writeTextFile(workspace.id, filePath, content);

        // Invalidate blob URL cache using manifest href for CSS/JS files
        if (blobURLManager && (filePath.includes('/Styles/') || filePath.includes('/Scripts/'))) {
          blobURLManager.revokeFileBlob(fileHref);

          // Trigger preview update to pick up fresh blob URLs for updated CSS/JS
          if (previewManager) {
            previewManager.forcePreviewUpdate();
          }
        }
      } catch {
        // Auto-save failed, but continue
      } finally {
        autoSaveTimeouts.delete(filePath);
      }
    }, 500); // 500ms debounce

    autoSaveTimeouts.set(filePath, timeout);
  }

  // Validate that auto-save is still appropriate for current state
  function validateAutoSaveStillValid(filePath: string, content: string): boolean {
    // For text files, ensure the file path matches the current spine item
    if (filePath.includes('SOURCE/text/') && selectedItemId) {
      const expectedTextPath = `SOURCE/text/${selectedItemId}.txt`;
      if (filePath !== expectedTextPath) {
        return false;
      }

      // Additional validation: check if content is appropriate for current spine item
      if (content.includes('chapter') || content.includes('Chapter')) {
        const pathChapter = filePath.match(/chapter(\d+)/)?.[1];
        if (pathChapter) {
          const contentHasWrongChapter =
            content.toLowerCase().includes('chapter') &&
            !content.toLowerCase().includes(`chapter ${pathChapter}`) &&
            !content.toLowerCase().includes(`chapter${pathChapter}`);
          if (contentHasWrongChapter) {
            return false;
          }
        }
      }
    }

    return true;
  }

  // Persist current pane configuration to navigationStore (without content)
  function persistPaneConfiguration() {
    const config: SpineEditorConfig = {
      pane1: paneState.pane1.fileType
        ? {
            fileType: paneState.pane1.fileType,
            selectedFile: paneState.pane1.filePath,
            // Note: content is never persisted - always loaded fresh from disk
          }
        : null,
      pane2: paneState.pane2.fileType
        ? {
            fileType: paneState.pane2.fileType,
            selectedFile: paneState.pane2.filePath,
            // Note: content is never persisted - always loaded fresh from disk
          }
        : null,
      mode: paneState.mode,
    };

    navigationStore.setViewData('spine', config);
  }

  // Restore pane configuration from saved state
  async function restorePaneConfiguration(savedConfig: SpineEditorConfig) {
    // Restore editor mode
    paneState.mode = savedConfig.mode;

    // Restore pane 1 configuration
    if (savedConfig.pane1) {
      await restorePaneState(1, savedConfig.pane1);
    }

    // Restore pane 2 configuration
    if (savedConfig.pane2) {
      await restorePaneState(2, savedConfig.pane2);
    }
  }

  // Restore individual pane state
  async function restorePaneState(
    pane: 1 | 2,
    paneConfig: { fileType: string; selectedFile?: string; content?: string }
  ) {
    const { fileType, selectedFile } = paneConfig;

    // Find appropriate file for this pane
    let targetFile;

    if (fileType === 'text') {
      // Text files: always use current spine item's text file
      targetFile = availableFiles.find(f => f.type === 'text');
    } else if (selectedFile) {
      // Global files (CSS/JS/transform): try to find the same file
      targetFile = availableFiles.find(f => f.path === selectedFile);
      if (!targetFile) {
        // If exact file not found, find any file of the same type
        targetFile = availableFiles.find(f => f.type === fileType);
      }
    } else {
      // Fallback: find any file of the requested type
      targetFile = availableFiles.find(f => f.type === fileType);
    }

    if (targetFile) {
      // Update pane state
      const contentType = getContentType(targetFile.type);
      const paneKey = `pane${pane}` as keyof Pick<typeof paneState, 'pane1' | 'pane2'>;
      paneState[paneKey] = {
        filePath: targetFile.path,
        fileHref: targetFile.href,
        fileType: targetFile.type,
        contentType,
        selectedFileValue: targetFile.value,
        content: '', // Will be loaded below for non-text files
      };

      // Create store and assign to appropriate pane (same logic as handleFileSelect)
      const store = await getOrCreateFileStore(targetFile, workspace.id, workspaceService);

      if (store) {
        // Assign store to appropriate pane
        if (pane === 1) {
          pane1Store = store;
        } else {
          pane2Store = store;
        }
      } else {
        console.error('❌ Pane restoration failed - could not create store for:', targetFile.path);
      }
    }
  }

  // Handle preview updates
  function handlePreviewUpdate(event: PreviewUpdateEvent) {
    previewContent.set(event.xhtml);
    transformWarnings.set(event.warnings);
    transformError.set(null);
    isTransforming.set(false);
    executionTime.set(event.executionTime);

    // Notify parent component of preview data
    onPreviewUpdate?.({
      xhtmlContent: event.xhtml,
      isTransforming: false,
      transformError: null,
      transformWarnings: event.warnings,
      executionTime: event.executionTime,
      spineItemId: selectedItemId,
    });
  }

  // Handle preview errors
  function handlePreviewError(event: PreviewErrorEvent) {
    transformError.set(event.error);
    isTransforming.set(false);

    // Notify parent component of error state
    onPreviewUpdate?.({
      xhtmlContent: '',
      isTransforming: false,
      transformError: event.error,
      transformWarnings: [],
      executionTime: 0,
      spineItemId: selectedItemId,
    });
  }

  // Force immediate preview update
  async function forcePreviewUpdate() {
    if (!previewManager) return;

    isTransforming.set(true);
    try {
      await previewManager.forcePreviewUpdate();
    } catch (err) {
      handlePreviewError({
        error: {
          stage: 'manual-update',
          message: err instanceof Error ? err.message : 'Manual update failed',
        },
        stage: 'manual-update',
        timestamp: Date.now(),
      });
    }
  }

  // Handle preview click for text selection in editor
  export function handlePreviewClick(
    event: CustomEvent<{ text: string; documentPosition: number; elementType: string }>
  ) {
    console.log('handlePreviewClick', event.detail.text);
    if (editorPaneRef && typeof editorPaneRef.findAndSelectText === 'function') {
      editorPaneRef.findAndSelectText(event.detail);
    }
  }

  // Set up preview-click event listener using Svelte 5 runes
  $effect(() => {
    if (!spineViewElement) return;

    const handlePreviewClickEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        text: string;
        documentPosition: number;
        elementType: string;
      }>;
      handlePreviewClick(customEvent);
    };

    spineViewElement.addEventListener('preview-click', handlePreviewClickEvent);

    // Cleanup function
    return () => {
      if (spineViewElement) {
        spineViewElement.removeEventListener('preview-click', handlePreviewClickEvent);
      }
    };
  });

  // Race condition prevention
  let currentSpineItemLoadPromise: Promise<void> | null = null;

  // Load selected item data
  async function loadSelectedItem() {
    if (!selectedItemId || !spineService) return;

    // Guard against concurrent spine item loads
    if (isLoadingSpineItem) {
      return;
    }

    // Prevent race conditions - if another load is in progress, wait for it
    if (currentSpineItemLoadPromise) {
      try {
        await currentSpineItemLoadPromise;
      } catch {
        // Previous load failed, proceed
      }
    }

    // Set loading flag to prevent concurrent calls
    isLoadingSpineItem = true;

    // Create new load promise
    currentSpineItemLoadPromise = performSpineItemLoad();

    try {
      await currentSpineItemLoadPromise;
    } finally {
      currentSpineItemLoadPromise = null;
      isLoadingSpineItem = false;
    }
  }

  async function performSpineItemLoad() {
    isLoading = true;
    error = null;

    try {
      // Load spine items to find the selected one
      const spineItems = await spineService.loadSpineItems(workspace);
      const newSelectedItem = spineItems.find(item => item.id === selectedItemId) || null;

      // Check if this is a spine item switch (not initial load)
      const oldItemId = selectedItem?.id;
      const newItemId = newSelectedItem?.id;
      const isSpineItemSwitch = oldItemId && newItemId && oldItemId !== newItemId;

      // Update selected item reference
      selectedItem = newSelectedItem;

      if (selectedItem && servicesInitialized) {
        // File stores are now created on-demand when files are selected

        // Initialize services and preview as needed
        if (isSpineItemSwitch) {
          await handleSpineItemSwitch();
        } else {
          await initializeSpineEditor();
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load spine item';
    } finally {
      isLoading = false;
    }
  }

  // Handle spine item switching with preserved global file selections
  async function handleSpineItemSwitch() {
    try {
      // Update available files for new spine item
      await loadAvailableFiles();

      // Update only spine-specific content in panes while preserving global selections
      await updateSpineSpecificContent();

      // Use the same initialization logic that handles both creation and reuse
      await initializeSpineEditor();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to switch spine item';
    }
  }

  // Update only spine-specific content in panes (preserve global file selections)
  async function updateSpineSpecificContent() {
    // CRITICAL: Cancel all pending auto-saves to prevent race conditions
    for (const timeout of autoSaveTimeouts.values()) {
      clearTimeout(timeout);
    }
    autoSaveTimeouts.clear();

    // Update pane 1 if it contains spine-specific content
    if (paneState.pane1.fileType && isSpineSpecificFile(paneState.pane1.fileType)) {
      const newFilePath = `SOURCE/text/${selectedItemId}.txt`;

      // Auto-save current content before switching (CRITICAL for data integrity)
      // Auto-save is now handled by store subscriptions - no manual save needed
      /*
      if (oldContent && oldFilePath && oldFilePath !== newFilePath) {
        console.log('[SpineView] Pane 1 - Auto-saving current content before switch');
        try {
          await fileStorage.writeTextFile(workspace.id, oldFilePath, oldContent);
          console.log('[SpineView] Pane 1 - Current content saved successfully');
        } catch (err) {
          console.error('[SpineView] Pane 1 - CRITICAL: Failed to save current content before switch:', err);
          // Don't proceed with switch if we can't save current data
          throw new Error(`Failed to save current content for ${oldFilePath}: ${err}`);
        }
      }
      */

      // Update paths
      paneState.pane1.filePath = newFilePath;
      paneState.pane1.fileHref = newFilePath;

      // Content loading now handled by store switching - no manual file loading needed
      // await loadFileIntoPane(1, newFilePath, paneState.pane1.fileType);

      // console.log('[SpineView] Pane 1 - Content length after switch:', paneState.pane1.content.length);
    }

    // Update pane 2 if it contains spine-specific content
    if (paneState.pane2.fileType && isSpineSpecificFile(paneState.pane2.fileType)) {
      const newFilePath = `SOURCE/text/${selectedItemId}.txt`;

      // Auto-save is now handled by store subscriptions - no manual save needed
      /*
      if (oldContent && oldFilePath && oldFilePath !== newFilePath) {
        console.log('[SpineView] Pane 2 - Auto-saving current content before switch');
        try {
          await fileStorage.writeTextFile(workspace.id, oldFilePath, oldContent);
          console.log('[SpineView] Pane 2 - Current content saved successfully');
        } catch (err) {
          console.error('[SpineView] Pane 2 - CRITICAL: Failed to save current content before switch:', err);
          // Don't proceed with switch if we can't save current data
          throw new Error(`Failed to save current content for ${oldFilePath}: ${err}`);
        }
      }
      */

      // Update paths
      paneState.pane2.filePath = newFilePath;
      paneState.pane2.fileHref = newFilePath;

      // Content loading now handled by store switching - no manual file loading needed
      // await loadFileIntoPane(2, newFilePath, paneState.pane2.fileType);
    }

    // Data integrity verification removed
  }

  // Debug functions removed

  // Component lifecycle
  onMount(() => {
    // Register navigation guard
    guardId = navigationStore.addNavigationGuard(canLeave);

    // Call onViewEnter
    onViewEnter();
  });

  onDestroy(() => {
    // Clean up file content stores
    for (const store of fileContentStores.values()) {
      store.destroy(); // Remove from text-editor-store registry
    }
    fileContentStores.clear();

    // Store subscriptions are automatically cleaned up with store destruction

    // Clean up guard
    if (guardId) {
      navigationStore.removeNavigationGuard(guardId);
    }

    // Call onViewLeave
    onViewLeave();
  });

  // React to prop changes - only reload when selectedItemId actually changes
  $effect(() => {
    // Only react if selectedItemId actually changed
    if (selectedItemId !== previousSelectedItemId) {
      previousSelectedItemId = selectedItemId;

      if (workspace && spineService) {
        // Initialize services if needed
        if (!servicesInitialized) {
          initializeServices();
        }

        if (selectedItemId) {
          loadSelectedItem();
        } else {
          // Clear previous workspace data
          selectedItem = null;
          error = null;
          previewManager = null;
        }
      }
    }
  });
</script>

{#if isLoading}
  <div class="loading-state">
    <div class="spinner"></div>
    <p>{$t('Loading spine item...')}</p>
  </div>
{:else if error}
  <div class="error-state">
    <span class="error-icon">⚠️</span>
    <p>{error}</p>
  </div>
{:else if !selectedItemId}
  <div class="empty-state">
    <div class="empty-icon">📚</div>
    <h3>{$t('No spine item selected')}</h3>
    <p>{$t('Select a spine item from the sidebar to start editing')}</p>
  </div>
{:else if selectedItem && servicesInitialized && previewManager && settingsService}
  <!-- Editor Pane -->
  <div bind:this={spineViewElement} data-spine-view class="spine-editor-wrapper">
    <EditorPane
      bind:this={editorPaneRef}
      {availableFiles1}
      {availableFiles2}
      transformError={$transformError}
      transformWarnings={$transformWarnings}
      isTransforming={$isTransforming}
      executionTime={$executionTime}
      editorMode={paneState.mode}
      pane1SelectedFile={paneState.pane1.selectedFileValue}
      pane2SelectedFile={paneState.pane2.selectedFileValue}
      bind:pane1Error
      bind:pane2Error
      pane1FileStore={pane1Store}
      pane2FileStore={pane2Store}
      {contentService}
      onPaneToggle={() => handlePaneToggle()}
      onFileSelect={(pane, filePath, fileType) =>
        handleFileSelect({ detail: { pane, filePath, fileType } } as CustomEvent<{
          pane: 1 | 2;
          filePath: string;
          fileType: string;
        }>)}
      onContentChange={(pane, content) =>
        handlePaneContentChange({ detail: { pane, content } } as CustomEvent<{
          pane: 1 | 2;
          content: string;
        }>)}
      onForceUpdate={() => forcePreviewUpdate()}
      {workspace}
      {audioClipService}
      {workspaceService}
      {settingsService}
    />
  </div>
{:else}
  <div class="loading-state">
    <div class="spinner"></div>
    <p>{$t('Initializing editor...')}</p>
  </div>
{/if}

<style>
  /* Loading, error, and empty states */
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
    padding: var(--space-8);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border-default);
    border-top-color: var(--color-accent-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--space-4);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-icon {
    font-size: var(--text-2xl);
    margin-bottom: var(--space-3);
  }

  .error-state {
    color: var(--color-error-text);
  }

  .empty-icon {
    font-size: 3rem;
    opacity: 0.5;
    margin-bottom: var(--space-4);
  }

  .empty-state h3 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
  }

  .empty-state p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  /* Spine editor wrapper for event handling */
  .spine-editor-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
