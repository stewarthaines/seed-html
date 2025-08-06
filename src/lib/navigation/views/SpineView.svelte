<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { navigationStore } from '../navigation-store';
  import type {
    WorkspaceService,
    WorkspaceState,
  } from '../../services/workspace/workspace.service.js';
  import type { SpineService } from '../../services/spine/spine.service.js';
  import type { SpineItemWithSource } from '../../spine/types';
  import EditorPane from '../../components/spine/EditorPane.svelte';
  import PreviewPane from '../../components/spine/PreviewPane.svelte';
  import { createSpinePreviewManager, DEFAULT_PREVIEW_CONFIG } from '../../transform/spine-preview-manager.js';
  import { writable } from 'svelte/store';
  import { createEventDispatcher } from 'svelte';
  import type { 
    PreviewUpdateEvent, 
    PreviewErrorEvent, 
    CurrentContent,
    ContentType,
    TransformError
  } from '../../types/spine-editor.js';
  import { BlobURLManager } from '../../blob-url/blob-url-manager.js';
  import { SettingsService } from '../../services/settings/settings.service.js';
  import { ExtensionManager } from '../../extensions/extension-manager.js';
  import { FileStorageAPI } from '../../storage/index.js';
  import type { TransformEngine } from '../../infrastructure/transform-engine.js';
  import { t } from '../../i18n';
  import { themeStore } from '../../stores/theme.js';
  import { i18nService } from '../../i18n/index.js';

  // Props using clean service architecture
  export let workspace: WorkspaceState;
  export let workspaceService: WorkspaceService;
  export let spineService: SpineService;
  export let selectedItemId: string | null = null;
  export let transformEngine: TransformEngine;

  // Component state
  let selectedItem: SpineItemWithSource | null = null;
  let isLoading = false;
  let error: string | null = null;
  let guardId: string;
  
  // Service dependencies for spine editor
  let fileStorage: FileStorageAPI;
  let extensionManager: ExtensionManager;
  let blobURLManager: BlobURLManager;
  let settingsService: SettingsService;
  let servicesInitialized = false;

  // Spine editor state
  let previewManager: any = null;
  let currentContent: CurrentContent = {
    text: ''
  };
  
  // Available files for editor pane dropdowns
  let availableFiles: Array<{ value: string; label: string; path: string; href: string; type: 'text' | 'css' | 'javascript' | 'transform' }> = [];

  // Track previous selectedItemId to prevent unnecessary reloads
  let previousSelectedItemId: string | null = null;
  
  // Loading guard to prevent concurrent spine item loads
  let isLoadingSpineItem = false;
  
  // Spine editor configuration interface for persistence (content never persisted)
  interface SpineEditorConfig {
    pane1: { fileType: string; selectedFile?: string; content?: string } | null;
    pane2: { fileType: string; selectedFile?: string; content?: string } | null;
    mode: 'single' | 'dual';
  }

  // Complete pane state tracking including UI state
  let paneState = {
    mode: 'single' as 'single' | 'dual',
    pane1: { 
      filePath: '', 
      fileHref: '', 
      fileType: '', 
      contentType: null as ContentType | null,
      selectedFileValue: '', // For dropdown display 
      content: ''
    },
    pane2: { 
      filePath: '', 
      fileHref: '', 
      fileType: '', 
      contentType: null as ContentType | null,
      selectedFileValue: '', // For dropdown display
      content: ''
    }
  };

  // Reactive stores for spine editor
  const previewContent = writable<string>('');
  const transformWarnings = writable<string[]>([]);
  const transformError = writable<TransformError | null>(null);
  const isTransforming = writable<boolean>(false);
  const executionTime = writable<number>(0);

  // Event dispatcher to notify parent of preview data changes
  const dispatch = createEventDispatcher();

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
        }
      });
      
      // Initialize settings service with real implementations
      settingsService = new SettingsService(fileStorage, extensionManager, themeStore, i18nService);
      
      servicesInitialized = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to initialize services';
      console.error('Failed to initialize spine editor services:', err);
    }
  }

  // Load available files for editor panes
  async function loadAvailableFiles() {
    if (!selectedItemId || !servicesInitialized) return;
    
    try {
      // Always include text content for current spine item
      const files: Array<{ value: string; label: string; path: string; href: string; type: 'text' | 'css' | 'javascript' | 'transform' }> = [
        {
          value: 'text',
          label: 'Text Content',
          path: `SOURCE/text/${selectedItemId}.txt`,
          href: `SOURCE/text/${selectedItemId}.txt`, // text files don't have manifest hrefs
          type: 'text'
        }
      ];
      
      // Add CSS files from manifest (if any exist)
      try {
        const cssFiles = await fileStorage.listFiles(workspace.id, 'OEBPS/Styles');
        for (const cssFile of cssFiles) {
          if (cssFile.endsWith('.css')) {
            const fileName = cssFile.split('/').pop()?.replace('.css', '') || cssFile;
            // Convert workspace path to manifest href: OEBPS/Styles/page.css -> Styles/page.css
            const manifestHref = cssFile.startsWith('OEBPS/') ? cssFile.substring(6) : cssFile;
            files.push({
              value: `css-${fileName}`,
              label: `CSS: ${fileName}`,
              path: cssFile,
              href: manifestHref,
              type: 'css'
            });
          }
        }
      } catch (err) {
        // No CSS files yet, that's okay
      }
      
      // Add JavaScript files from manifest (if any exist)
      try {
        const jsFiles = await fileStorage.listFiles(workspace.id, 'OEBPS/Scripts');
        for (const jsFile of jsFiles) {
          if (jsFile.endsWith('.js')) {
            const fileName = jsFile.split('/').pop()?.replace('.js', '') || jsFile;
            // Convert workspace path to manifest href: OEBPS/Scripts/responsive.js -> Scripts/responsive.js
            const manifestHref = jsFile.startsWith('OEBPS/') ? jsFile.substring(6) : jsFile;
            files.push({
              value: `js-${fileName}`,
              label: `JS: ${fileName}`,
              path: jsFile,
              href: manifestHref,
              type: 'javascript'
            });
          }
        }
      } catch (err) {
        // No JS files yet, that's okay
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
              type: 'transform'
            });
          }
        }
      } catch (err) {
        // No transform files yet, that's okay
      }
      
      availableFiles = files;
    } catch (err) {
      console.error('Failed to load available files:', err);
      // Fallback to just text content
      availableFiles = [
        {
          value: 'text',
          label: 'Text Content',
          path: `SOURCE/text/${selectedItemId}.txt`,
          href: `SOURCE/text/${selectedItemId}.txt`, // text files don't have manifest hrefs
          type: 'text'
        }
      ];
    }
  }

  // Initialize spine editor preview manager
  async function initializeSpineEditor() {
    if (!selectedItemId || !servicesInitialized) return;
    
    // Clear existing preview manager when switching spine items
    if (previewManager) {
      previewManager = null;
    }

    try {
      // Load available files for editor panes
      await loadAvailableFiles();
      
      // Initialize preview manager
      previewManager = createSpinePreviewManager(
        workspace.id,
        selectedItemId,
        fileStorage,
        extensionManager,
        blobURLManager,
        workspaceService,
        settingsService,
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
      currentContent = previewManager.getCurrentContent();

      
      // Restore saved pane configuration or initialize with defaults
      await restoreOrInitializePaneContent();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to initialize spine editor';
      console.error('Failed to initialize spine editor:', err);
    }
  }

  // Handle content changes from editor (text only - CSS/JS handled by auto-save)
  function handleContentChange(type: ContentType, content: string) {
    currentContent[type] = content;
    if (previewManager) {
      previewManager.updateContent(type, content);
    }
  }
  
  // Restore saved pane configuration or initialize with defaults
  async function restoreOrInitializePaneContent() {
    console.log('[SpineView] restoreOrInitializePaneContent called, availableFiles:', availableFiles.length);
    if (availableFiles.length === 0) return;
    
    // Try to restore saved configuration from navigationStore
    const savedConfig = navigationStore.getViewData<SpineEditorConfig>('spine');
    console.log('[SpineView] Saved config from navigationStore:', savedConfig);
    
    if (savedConfig && (savedConfig.pane1 || savedConfig.pane2)) {
      console.log('[SpineView] Restoring saved pane configuration:', savedConfig);
      // Restore saved pane configuration
      await restorePaneConfiguration(savedConfig);
    } else {
      console.log('[SpineView] No saved config, using default initialization');
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
          content: ''
        };
        
        // Load content into pane 1
        await loadFileIntoPane(1, textFile.path, textFile.type);
        
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
  function handleFileSelect(event: CustomEvent<{ pane: 1 | 2; filePath: string; fileType: string }>) {
    const { pane, filePath, fileType } = event.detail;
    console.log('[SpineView] handleFileSelect called:', { pane, filePath, fileType });
    
    // Find the file in availableFiles to get the href and value
    const selectedFile = availableFiles.find(f => f.path === filePath);
    if (!selectedFile) {
      console.error('[SpineView] File not found in availableFiles:', filePath);
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
      content: '' // Clear content to prevent mismatch during loading
    };
    
    // Switch to dual mode if pane 2 is being used
    if (pane === 2 && paneState.mode === 'single') {
      paneState.mode = 'dual';
    }
    
    console.log('[SpineView] Updated pane state for file selection:', paneState);
    
    // Persist pane configuration to navigationStore
    persistPaneConfiguration();
    
    // Load file content into the selected pane
    loadFileIntoPane(pane, filePath, fileType);
  }
  
  // Handle content changes from editor panes
  function handlePaneContentChange(event: CustomEvent<{ pane: 1 | 2; content: string }>) {
    const { pane, content } = event.detail;
    
    // Update pane state content
    const paneKey = `pane${pane}` as keyof Pick<typeof paneState, 'pane1' | 'pane2'>;
    paneState[paneKey].content = content;
    
    // Get the content type for this pane
    const { contentType, filePath, fileHref } = paneState[paneKey];
    
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
  
  // Handle pane toggle
  function handlePaneToggle() {
    paneState.mode = paneState.mode === 'single' ? 'dual' : 'single';
    persistPaneConfiguration();
    console.log('[SpineView] Pane mode toggled to:', paneState.mode);
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
          console.warn(`[SpineView] Auto-save canceled - file path no longer valid: ${filePath}`);
          return;
        }
        
        await fileStorage.writeTextFile(workspace.id, filePath, content);
        console.log(`Auto-saved: ${filePath}`);
        
        // Invalidate blob URL cache using manifest href for CSS/JS files
        if (blobURLManager && (filePath.includes('/Styles/') || filePath.includes('/Scripts/'))) {
          blobURLManager.revokeFileBlob(fileHref);
          
          // Trigger preview update to pick up fresh blob URLs for updated CSS/JS
          if (previewManager) {
            previewManager.forcePreviewUpdate();
          }
        }
      } catch (err) {
        console.error(`Failed to auto-save ${filePath}:`, err);
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
        console.warn(`[SpineView] Auto-save validation failed: Expected ${expectedTextPath}, got ${filePath}`);
        return false;
      }
      
      // Additional validation: check if content is appropriate for current spine item
      if (content.includes('chapter') || content.includes('Chapter')) {
        const pathChapter = filePath.match(/chapter(\d+)/)?.[1];
        if (pathChapter) {
          const contentHasWrongChapter = content.toLowerCase().includes('chapter') && 
                                        !content.toLowerCase().includes(`chapter ${pathChapter}`) &&
                                        !content.toLowerCase().includes(`chapter${pathChapter}`);
          if (contentHasWrongChapter) {
            console.warn(`[SpineView] Auto-save validation failed: Content doesn't match chapter ${pathChapter} for file ${filePath}`);
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
      pane1: paneState.pane1.fileType ? {
        fileType: paneState.pane1.fileType,
        selectedFile: paneState.pane1.filePath
        // Note: content is never persisted - always loaded fresh from disk
      } : null,
      pane2: paneState.pane2.fileType ? {
        fileType: paneState.pane2.fileType,
        selectedFile: paneState.pane2.filePath
        // Note: content is never persisted - always loaded fresh from disk
      } : null,
      mode: paneState.mode
    };
    
    console.log('[SpineView] Persisting pane configuration (no content):', config);
    navigationStore.setViewData('spine', config);
    console.log('[SpineView] Configuration persisted to navigationStore');
  }
  
  // Restore pane configuration from saved state
  async function restorePaneConfiguration(savedConfig: SpineEditorConfig) {
    console.log('[SpineView] restorePaneConfiguration called with:', savedConfig);
    
    // Restore editor mode
    paneState.mode = savedConfig.mode;
    
    // Restore pane 1 configuration
    if (savedConfig.pane1) {
      console.log('[SpineView] Restoring pane 1:', savedConfig.pane1);
      await restorePaneState(1, savedConfig.pane1);
    }
    
    // Restore pane 2 configuration
    if (savedConfig.pane2) {
      console.log('[SpineView] Restoring pane 2:', savedConfig.pane2);
      await restorePaneState(2, savedConfig.pane2);
    }
  }
  
  // Restore individual pane state
  async function restorePaneState(pane: 1 | 2, paneConfig: { fileType: string; selectedFile?: string; content?: string }) {
    const { fileType, selectedFile, content } = paneConfig;
    console.log('[SpineView] restorePaneState for pane', pane, ':', { fileType, selectedFile, content: content?.length });
    
    // Find appropriate file for this pane
    let targetFile;
    
    if (fileType === 'text') {
      // Text files: always use current spine item's text file
      targetFile = availableFiles.find(f => f.type === 'text');
      console.log('[SpineView] Looking for text file, found:', targetFile);
    } else if (selectedFile) {
      // Global files (CSS/JS/transform): try to find the same file
      targetFile = availableFiles.find(f => f.path === selectedFile);
      console.log('[SpineView] Looking for exact file:', selectedFile, 'found:', targetFile);
      if (!targetFile) {
        // If exact file not found, find any file of the same type
        targetFile = availableFiles.find(f => f.type === fileType);
        console.log('[SpineView] Exact file not found, looking for type:', fileType, 'found:', targetFile);
      }
    } else {
      // Fallback: find any file of the requested type
      targetFile = availableFiles.find(f => f.type === fileType);
      console.log('[SpineView] Fallback: looking for type:', fileType, 'found:', targetFile);
    }
    
    if (targetFile) {
      console.log('[SpineView] Restoring pane', pane, 'with file:', targetFile);
      // Update pane state
      const contentType = getContentType(targetFile.type);
      const paneKey = `pane${pane}` as keyof Pick<typeof paneState, 'pane1' | 'pane2'>;
      paneState[paneKey] = {
        filePath: targetFile.path,
        fileHref: targetFile.href,
        fileType: targetFile.type,
        contentType,
        selectedFileValue: targetFile.value,
        content: '' // Always start empty - content loaded from disk below
      };
      
      // Always load content from file - never use saved content to prevent cross-contamination
      await loadFileIntoPane(pane, targetFile.path, targetFile.type);
      console.log('[SpineView] Content loaded fresh from disk for:', targetFile.path);
    } else {
      console.log('[SpineView] No target file found for pane', pane, 'config:', paneConfig);
    }
  }
  
  
  // Load file content into a specific pane with validation
  async function loadFileIntoPane(pane: 1 | 2, filePath: string, fileType: string) {
    if (!fileStorage || !workspace?.id) return;
    
    console.log(`[SpineView] === LOADING FILE INTO PANE ${pane} ===`);
    console.log(`[SpineView] File path:`, filePath);
    console.log(`[SpineView] File type:`, fileType);
    console.log(`[SpineView] Workspace ID:`, workspace.id);
    
    const paneKey = `pane${pane}` as keyof Pick<typeof paneState, 'pane1' | 'pane2'>;
    const oldContent = paneState[paneKey].content;
    
    console.log(`[SpineView] Previous content length in pane ${pane}:`, oldContent.length);
    
    try {
      const content = await fileStorage.readTextFile(workspace.id, filePath);
      
      console.log(`[SpineView] Successfully read file:`, filePath);
      console.log(`[SpineView] New content length:`, content.length);
      console.log(`[SpineView] Content preview:`, content.substring(0, 200) + (content.length > 200 ? '...' : ''));
      
      // Validate that we're not accidentally loading the wrong file's content
      if (fileType === 'text' && filePath.includes('chapter') && content.length > 0) {
        const expectedChapter = filePath.match(/chapter(\d+)/)?.[1];
        const contentMightBeWrongChapter = content.toLowerCase().includes('chapter') && 
                                          expectedChapter && 
                                          !content.toLowerCase().includes(`chapter ${expectedChapter}`) &&
                                          !content.toLowerCase().includes(`chapter${expectedChapter}`);
        
        if (contentMightBeWrongChapter) {
          console.warn(`[SpineView] POTENTIAL DATA CORRUPTION: Loading ${filePath} but content doesn't mention expected chapter ${expectedChapter}`);
          console.warn(`[SpineView] Content start:`, content.substring(0, 300));
        }
      }
      
      // Update pane state content
      paneState[paneKey].content = content;
      
      // Validate that file type matches expected content (debugging aid)
      validateContentTypeMatch(fileType, content, filePath);
      
      // Update preview manager for text content only (CSS/JS are handled by auto-save)
      const contentType = getContentType(fileType);
      if (contentType && previewManager) {
        console.log(`[SpineView] Updating preview manager with ${contentType} content (${content.length} chars)`);
        currentContent[contentType] = content;
        previewManager.updateContent(contentType, content);
      }
      
      console.log(`[SpineView] Successfully loaded content into pane ${pane}`);
    } catch (err) {
      console.warn(`[SpineView] File ${filePath} doesn't exist, creating empty content`);
      console.warn(`[SpineView] Error:`, err);
      
      // If file doesn't exist, create empty content
      paneState[paneKey].content = '';
      
      // For text files, create with default content to help identify the chapter
      if (fileType === 'text' && filePath.includes('chapter')) {
        const chapterNum = filePath.match(/chapter(\d+)/)?.[1] || 'X';
        const defaultContent = `# Chapter ${chapterNum}\n\nThis is sample content for chapter ${chapterNum}.`;
        paneState[paneKey].content = defaultContent;
        
        // Auto-save the default content
        try {
          await fileStorage.writeTextFile(workspace.id, filePath, defaultContent);
          console.log(`[SpineView] Created default content for ${filePath}`);
        } catch (saveErr) {
          console.warn(`[SpineView] Failed to save default content:`, saveErr);
        }
      }
    }
    
    console.log(`[SpineView] === PANE ${pane} LOAD COMPLETE ===`);
  }

  // Validate that file content matches expected file type (debugging aid)
  function validateContentTypeMatch(fileType: string, content: string, filePath: string): void {
    if (!content) return; // Empty content is always valid
    
    const lowerContent = content.toLowerCase().trim();
    
    if (fileType === 'css' && !lowerContent.includes('{') && !lowerContent.includes('color') && !lowerContent.includes('@')) {
      console.warn(`[SpineView] File type mismatch: Expected CSS but content doesn't look like CSS`, { filePath, fileType, contentPreview: content.substring(0, 100) });
    }
    
    if (fileType === 'javascript' && !lowerContent.includes('function') && !lowerContent.includes('var') && !lowerContent.includes('const') && !lowerContent.includes('let')) {
      console.warn(`[SpineView] File type mismatch: Expected JavaScript but content doesn't look like JS`, { filePath, fileType, contentPreview: content.substring(0, 100) });
    }
    
    if (fileType === 'text' && (lowerContent.includes('function(') || lowerContent.includes('margin:') || lowerContent.includes('color:'))) {
      console.warn(`[SpineView] File type mismatch: Expected text but content looks like code`, { filePath, fileType, contentPreview: content.substring(0, 100) });
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
    dispatch('previewUpdate', {
      xhtmlContent: event.xhtml,
      isTransforming: false,
      transformError: null,
      transformWarnings: event.warnings,
      executionTime: event.executionTime,
      spineItemId: selectedItemId
    });
  }

  // Handle preview errors
  function handlePreviewError(event: PreviewErrorEvent) {
    transformError.set(event.error);
    isTransforming.set(false);
    console.error('Transform error in preview:', event.error);
    
    // Notify parent component of error state
    dispatch('previewUpdate', {
      xhtmlContent: '',
      isTransforming: false,
      transformError: event.error,
      transformWarnings: [],
      executionTime: 0,
      spineItemId: selectedItemId
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
          message: err instanceof Error ? err.message : 'Manual update failed'
        },
        stage: 'manual-update',
        timestamp: Date.now()
      });
    }
  }

  // Race condition prevention
  let currentSpineItemLoadPromise: Promise<void> | null = null;

  // Load selected item data
  async function loadSelectedItem() {
    if (!selectedItemId || !spineService) return;

    // Guard against concurrent spine item loads
    if (isLoadingSpineItem) {
      console.log(`[SpineView] Load already in progress for ${selectedItemId}, skipping`);
      return;
    }

    console.log('[SpineView] === SPINE ITEM LOAD REQUESTED ===');
    console.log('[SpineView] Requested spine item:', selectedItemId);
    console.log('[SpineView] Current selected item:', selectedItem?.id);
    console.log('[SpineView] Services initialized:', servicesInitialized);

    // Prevent race conditions - if another load is in progress, wait for it
    if (currentSpineItemLoadPromise) {
      console.log('[SpineView] Another spine item load in progress, waiting...');
      try {
        await currentSpineItemLoadPromise;
      } catch (err) {
        console.warn('[SpineView] Previous spine item load failed, proceeding with new load');
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
      console.log('[SpineView] Loading spine items from service...');
      
      // Load spine items to find the selected one
      const spineItems = await spineService.loadSpineItems(workspace);
      const newSelectedItem = spineItems.find(item => item.id === selectedItemId) || null;
      
      console.log('[SpineView] Found spine item:', newSelectedItem?.id);
      
      // Check if this is a spine item switch (not initial load)
      const oldItemId = selectedItem?.id;
      const newItemId = newSelectedItem?.id;
      const isSpineItemSwitch = oldItemId && newItemId && oldItemId !== newItemId;
      
      console.log('[SpineView] Switch analysis:');
      console.log('[SpineView] - Old item ID:', oldItemId);
      console.log('[SpineView] - New item ID:', newItemId);
      console.log('[SpineView] - Is spine item switch:', isSpineItemSwitch);
      console.log('[SpineView] - Is initial load:', !isSpineItemSwitch);
      
      // Update selected item reference
      selectedItem = newSelectedItem;
      
      if (selectedItem && servicesInitialized) {
        if (isSpineItemSwitch) {
          console.log('[SpineView] Performing smart spine item switch...');
          dumpCurrentState('before-spine-switch');
          await handleSpineItemSwitch();
          dumpCurrentState('after-spine-switch');
        } else {
          console.log('[SpineView] Performing full editor initialization...');
          dumpCurrentState('before-initialization');
          await initializeSpineEditor();
          dumpCurrentState('after-initialization');
        }
      } else {
        console.log('[SpineView] Skipping editor initialization - item or services not ready');
      }
    } catch (err) {
      console.error('[SpineView] Spine item load failed:', err);
      error = err instanceof Error ? err.message : 'Failed to load spine item';
    } finally {
      isLoading = false;
      console.log('[SpineView] === SPINE ITEM LOAD COMPLETE ===');
    }
  }

  // Handle spine item switching with preserved global file selections
  async function handleSpineItemSwitch() {
    console.log('[SpineView] Handling spine item switch to:', selectedItemId);
    
    try {
      // Update available files for new spine item
      await loadAvailableFiles();
      
      // Update only spine-specific content in panes while preserving global selections
      await updateSpineSpecificContent();
      
      // Update preview manager with new spine item context
      if (previewManager) {
        await previewManager.updateSpineItemContext?.(selectedItemId);
        await previewManager.forcePreviewUpdate();
      }
    } catch (err) {
      console.error('[SpineView] Failed to handle spine item switch:', err);
      error = err instanceof Error ? err.message : 'Failed to switch spine item';
    }
  }

  // Update only spine-specific content in panes (preserve global file selections)
  async function updateSpineSpecificContent() {
    console.log('[SpineView] === UPDATING SPINE-SPECIFIC CONTENT ===');
    console.log('[SpineView] Target spine item:', selectedItemId);
    console.log('[SpineView] Current pane state before update:', JSON.parse(JSON.stringify(paneState)));
    
    // CRITICAL: Cancel all pending auto-saves to prevent race conditions
    console.log('[SpineView] Canceling all pending auto-saves to prevent race conditions');
    for (const [filePath, timeout] of autoSaveTimeouts) {
      clearTimeout(timeout);
      console.log('[SpineView] Canceled auto-save for:', filePath);
    }
    autoSaveTimeouts.clear();
    
    // Save current state for data integrity verification
    const oldPaneState = JSON.parse(JSON.stringify(paneState));
    
    // Update pane 1 if it contains spine-specific content
    if (paneState.pane1.fileType && isSpineSpecificFile(paneState.pane1.fileType)) {
      const oldFilePath = paneState.pane1.filePath;
      const oldContent = paneState.pane1.content;
      const newFilePath = `SOURCE/text/${selectedItemId}.txt`;
      
      console.log('[SpineView] Pane 1 - Spine-specific file detected');
      console.log('[SpineView] Pane 1 - Old path:', oldFilePath);
      console.log('[SpineView] Pane 1 - New path:', newFilePath);
      console.log('[SpineView] Pane 1 - Content length before switch:', oldContent.length);
      
      // Auto-save current content before switching (CRITICAL for data integrity)
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
      
      // Update paths
      paneState.pane1.filePath = newFilePath;
      paneState.pane1.fileHref = newFilePath;
      
      // Load new content
      await loadFileIntoPane(1, newFilePath, paneState.pane1.fileType);
      
      console.log('[SpineView] Pane 1 - Content length after switch:', paneState.pane1.content.length);
    } else {
      console.log('[SpineView] Pane 1 - Global file, no change needed:', paneState.pane1.fileType);
    }
    
    // Update pane 2 if it contains spine-specific content  
    if (paneState.pane2.fileType && isSpineSpecificFile(paneState.pane2.fileType)) {
      const oldFilePath = paneState.pane2.filePath;
      const oldContent = paneState.pane2.content;
      const newFilePath = `SOURCE/text/${selectedItemId}.txt`;
      
      console.log('[SpineView] Pane 2 - Spine-specific file detected');
      console.log('[SpineView] Pane 2 - Old path:', oldFilePath);
      console.log('[SpineView] Pane 2 - New path:', newFilePath);
      console.log('[SpineView] Pane 2 - Content length before switch:', oldContent.length);
      
      // Auto-save current content before switching (CRITICAL for data integrity)
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
      
      // Update paths
      paneState.pane2.filePath = newFilePath;
      paneState.pane2.fileHref = newFilePath;
      
      // Load new content
      await loadFileIntoPane(2, newFilePath, paneState.pane2.fileType);
      
      console.log('[SpineView] Pane 2 - Content length after switch:', paneState.pane2.content.length);
    } else {
      console.log('[SpineView] Pane 2 - Global file, no change needed:', paneState.pane2.fileType);
    }
    
    console.log('[SpineView] Final pane state after update:', JSON.parse(JSON.stringify(paneState)));
    console.log('[SpineView] === SPINE-SPECIFIC CONTENT UPDATE COMPLETE ===');
    
    // Verify data integrity
    verifySpineItemContentIntegrity(oldPaneState);
  }

  // Verify that the spine item switch didn't corrupt data
  function verifySpineItemContentIntegrity(oldPaneState: any) {
    console.log('[SpineView] === DATA INTEGRITY VERIFICATION ===');
    
    // Check that text content paths match the selected spine item
    if (paneState.pane1.fileType === 'text') {
      const expectedPath = `SOURCE/text/${selectedItemId}.txt`;
      if (paneState.pane1.filePath !== expectedPath) {
        console.error('[SpineView] INTEGRITY ERROR: Pane 1 text path mismatch!');
        console.error('[SpineView] Expected:', expectedPath);
        console.error('[SpineView] Actual:', paneState.pane1.filePath);
      }
    }
    
    if (paneState.pane2.fileType === 'text') {
      const expectedPath = `SOURCE/text/${selectedItemId}.txt`;
      if (paneState.pane2.filePath !== expectedPath) {
        console.error('[SpineView] INTEGRITY ERROR: Pane 2 text path mismatch!');
        console.error('[SpineView] Expected:', expectedPath);
        console.error('[SpineView] Actual:', paneState.pane2.filePath);
      }
    }
    
    // Check that global file selections were preserved
    const globalPanes = [
      { name: 'pane1', old: oldPaneState.pane1, new: paneState.pane1 },
      { name: 'pane2', old: oldPaneState.pane2, new: paneState.pane2 }
    ];
    
    for (const pane of globalPanes) {
      if (pane.old.fileType && !isSpineSpecificFile(pane.old.fileType)) {
        if (pane.old.filePath !== pane.new.filePath) {
          console.error(`[SpineView] INTEGRITY ERROR: ${pane.name} global file path changed unexpectedly!`);
          console.error(`[SpineView] Old path:`, pane.old.filePath);
          console.error(`[SpineView] New path:`, pane.new.filePath);
        }
        if (pane.old.selectedFileValue !== pane.new.selectedFileValue) {
          console.error(`[SpineView] INTEGRITY ERROR: ${pane.name} global file selection changed unexpectedly!`);
          console.error(`[SpineView] Old selection:`, pane.old.selectedFileValue);
          console.error(`[SpineView] New selection:`, pane.new.selectedFileValue);
        }
      }
    }
    
    console.log('[SpineView] === DATA INTEGRITY VERIFICATION COMPLETE ===');
  }

  // Comprehensive state dump for debugging
  function dumpCurrentState(context: string) {
    console.log(`[SpineView] === STATE DUMP (${context}) ===`);
    console.log('[SpineView] Context:', context);
    console.log('[SpineView] Selected spine item ID:', selectedItemId);
    console.log('[SpineView] Selected item object:', selectedItem);
    console.log('[SpineView] Workspace ID:', workspace?.id);
    console.log('[SpineView] Services initialized:', servicesInitialized);
    console.log('[SpineView] Loading state:', isLoading);
    console.log('[SpineView] Error state:', error);
    console.log('[SpineView] Preview manager exists:', !!previewManager);
    console.log('[SpineView] Available files:', availableFiles.map(f => ({ value: f.value, path: f.path, type: f.type })));
    console.log('[SpineView] Pane state:', JSON.parse(JSON.stringify(paneState)));
    console.log('[SpineView] Current content:', JSON.parse(JSON.stringify(currentContent)));
    
    // Check if panes have consistent state
    if (paneState.pane1.fileType === 'text' && selectedItemId && paneState.pane1.filePath) {
      const expectedPath = `SOURCE/text/${selectedItemId}.txt`;
      const pathMatches = paneState.pane1.filePath === expectedPath;
      console.log('[SpineView] Pane 1 text path consistency:', pathMatches);
      if (!pathMatches) {
        console.error('[SpineView] Pane 1 path mismatch - Expected:', expectedPath, 'Actual:', paneState.pane1.filePath);
      }
    }
    
    if (paneState.pane2.fileType === 'text' && selectedItemId && paneState.pane2.filePath) {
      const expectedPath = `SOURCE/text/${selectedItemId}.txt`;
      const pathMatches = paneState.pane2.filePath === expectedPath;
      console.log('[SpineView] Pane 2 text path consistency:', pathMatches);
      if (!pathMatches) {
        console.error('[SpineView] Pane 2 path mismatch - Expected:', expectedPath, 'Actual:', paneState.pane2.filePath);
      }
    }
    
    console.log(`[SpineView] === STATE DUMP COMPLETE (${context}) ===`);
  }

  // Add global debugging function for manual testing
  if (typeof window !== 'undefined') {
    (window as any).dumpSpineViewState = dumpCurrentState;
    (window as any).fixCorruptedChapterFiles = fixCorruptedChapterFiles;
  }

  // Emergency data recovery function for corrupted chapter files
  async function fixCorruptedChapterFiles() {
    if (!fileStorage || !workspace?.id) {
      console.error('[SpineView] Cannot fix files - no storage or workspace');
      return;
    }

    console.log('[SpineView] === EMERGENCY DATA RECOVERY ===');
    
    try {
      // Create correct default content for each chapter
      const chapter1Content = `# Chapter 1

This is sample content for demonstration purposes.

## Section 1

Here is some **bold text** and *italic text*.

## Section 2

Here is more sample content with additional paragraphs to demonstrate the transformation process.

This concludes the sample chapter.`;

      const chapter2Content = `# Chapter 2

This is sample content for demonstration purposes.

## Section 1

Here is some **bold text** and *italic text*.

## Section 2

Here is more sample content with additional paragraphs to demonstrate the transformation process.

This concludes the sample chapter.`;

      // Write correct content to each file
      await fileStorage.writeTextFile(workspace.id, 'SOURCE/text/chapter1.txt', chapter1Content);
      console.log('[SpineView] Fixed chapter1.txt with correct content');
      
      await fileStorage.writeTextFile(workspace.id, 'SOURCE/text/chapter2.txt', chapter2Content);
      console.log('[SpineView] Fixed chapter2.txt with correct content');
      
      // Verify the fix worked
      const verifyChapter1 = await fileStorage.readTextFile(workspace.id, 'SOURCE/text/chapter1.txt');
      const verifyChapter2 = await fileStorage.readTextFile(workspace.id, 'SOURCE/text/chapter2.txt');
      
      console.log('[SpineView] Verification - chapter1.txt starts with:', verifyChapter1.substring(0, 50));
      console.log('[SpineView] Verification - chapter2.txt starts with:', verifyChapter2.substring(0, 50));
      
      console.log('[SpineView] === DATA RECOVERY COMPLETE ===');
      console.log('[SpineView] Please refresh the page or switch chapters to see the fix');
      
    } catch (err) {
      console.error('[SpineView] Data recovery failed:', err);
    }
  }

  // Component lifecycle
  onMount(() => {
    // Register navigation guard
    guardId = navigationStore.addNavigationGuard(canLeave);

    // Call onViewEnter
    onViewEnter();
  });

  onDestroy(() => {
    // Clean up guard
    if (guardId) {
      navigationStore.removeNavigationGuard(guardId);
    }

    // Call onViewLeave
    onViewLeave();
  });

  // React to prop changes - only reload when selectedItemId actually changes
  $: {
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
  }
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
{:else if selectedItem && servicesInitialized && previewManager}
  <!-- Editor Pane -->
  <EditorPane
    {availableFiles}
    transformError={$transformError}
    transformWarnings={$transformWarnings}
    isTransforming={$isTransforming}
    executionTime={$executionTime}
    editorMode={paneState.mode}
    pane1SelectedFile={paneState.pane1.selectedFileValue}
    pane2SelectedFile={paneState.pane2.selectedFileValue}
    pane1Content={paneState.pane1.content}
    pane2Content={paneState.pane2.content}
    on:paneToggle={handlePaneToggle}
    on:fileSelect={handleFileSelect}
    on:contentChange={handlePaneContentChange}
    on:forceUpdate={forcePreviewUpdate}
  />
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

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
