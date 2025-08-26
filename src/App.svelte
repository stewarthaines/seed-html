<script lang="ts">
  import { onMount } from 'svelte';
  import LayoutManager from './lib/LayoutManager.svelte';
  import { navigationStore } from './lib/navigation';
  import type { ViewType } from './lib/navigation/types';
  import AboutView from './lib/navigation/views/AboutView.svelte';
  import ThirdPartyView from './lib/navigation/views/ThirdPartyView.svelte';
  import WorkspaceView from './lib/navigation/views/WorkspaceView.svelte';
  import MetadataEditor from './lib/components/metadata/MetadataEditor.svelte';
  import PlaceholderView from './lib/navigation/views/PlaceholderView.svelte';
  import SpineView from './lib/navigation/views/SpineView.svelte';
  import SettingsView from './lib/navigation/views/SettingsView.svelte';
  import SpineSidebar from './lib/components/SpineSidebar.svelte';
  import ManifestContainer from './lib/components/manifest/ManifestContainer.svelte';
  import ManifestPreview from './lib/components/manifest/ManifestPreview.svelte';
  import OutlineView from './lib/components/outline/OutlineView.svelte';
  import ContentPreview from './lib/components/preview/ContentPreview.svelte';
  import PreviewPane from './lib/components/spine/PreviewPane.svelte';
  import WorkspaceHeader from './lib/components/workspace/WorkspaceHeader.svelte';
  import { layoutStore } from './lib/stores/layout';
  import { t } from './lib/i18n';
  import { EnhancedAppState } from './lib/app-state-enhanced.svelte.js';
  import { FileStorageAPI } from './lib/storage/index.js';
  import { TransformExecutor } from './lib/transform/transform-executor.js';
  import { TransformEngine } from './lib/infrastructure/transform-engine.js';
  import { i18nService } from './lib/i18n/index.js';
  import { WorkspaceService } from './lib/services/workspace/workspace.service.js';
  import { SpineService } from './lib/services/spine/spine.service.js';
  import { MetadataService } from './lib/services/metadata/metadata.service.js';
  import { BlobURLManager } from './lib/blob-url/blob-url-manager.js';
import { ExtensionManager } from './lib/extensions/extension-manager.js';
  import { EPUBPackager } from './lib/epub/EPUBPackager.js';
  import { EPUBUnpacker } from './lib/epub/EPUBUnpacker.js';
  import { generateEPUBTimestamp } from './lib/epub/opf-utils.js';

  // Extension manager instance
  let extensionManager = $state<ExtensionManager>();

  const simpleThemeStore = {
    setTheme: () => {},
    useSystemPreference: () => {},
    getCurrentTheme: () => 'system',
  };

  const simpleI18nStore = {
    setLocale: () => {},
    getCurrentLocale: () => 'en',
  };

  // Create singleton FileStorageAPI and services with shared instance
  const fileStorage = FileStorageAPI.getInstance();
  const transformExecutor = new TransformExecutor();

  // Create services using shared FileStorageAPI
  const workspaceService = new WorkspaceService(fileStorage);
  const spineService = new SpineService(workspaceService);
  const metadataService = new MetadataService(workspaceService);
  const epubPackager = new EPUBPackager();
  const epubUnpacker = new EPUBUnpacker();

  // BlobURLManager will be created after FileStorageAPI is initialized
  let blobURLManager: BlobURLManager;

  // Transform engine initialization state
  let transformEngine: TransformEngine | null = null;
  let transformEngineReady = $state(false);
  let transformEngineError = $state<string | null>(null);

  // AppState created in proper Svelte context, initialized later
  let appState = $state<EnhancedAppState | null>(null);

  // Reactive getters for template access
  let currentView = $derived($navigationStore.currentView);
  let isExpanded = $derived($layoutStore.sidebar.isExpanded);
  let currentWorkspaceId = $derived(appState?.currentWorkspaceId);
  let selectedSpineItemId = $derived(appState?.selectedChapterId); // renamed in enhanced
  let initialized = $derived(appState?.initialized || false);
  let currentWorkspaceState = $derived(appState?.workspace);

  // Dynamic window title based on workspace
  let windowTitle = $derived.by(() => {
    const workspaceTitle = currentWorkspaceState?.opf?.metadata?.title;
    return workspaceTitle ? `${workspaceTitle}` : 'EDITME';
  });

  // Manifest item selection state
  let selectedManifestItem = $state<any>(null);
  let selectedManifestItemType = $state<'manifest' | 'source' | 'opf' | null>(null);

  // Navigation preview state
  let navigationPreviewContent = $state<string | null>(null);

  // Spine preview state
  let spinePreviewData = $state<{
    xhtmlContent: string;
    isTransforming: boolean;
    transformError: any;
    transformWarnings: string[];
    executionTime: number;
    spineItemId: string | null;
  }>({
    xhtmlContent: '',
    isTransforming: false,
    transformError: null,
    transformWarnings: [],
    executionTime: 0,
    spineItemId: null,
  });

  // Services are private in EnhancedAppState - workspace operations go through app state methods
  // No direct service access needed since EnhancedAppState handles service coordination

  // Handle manifest item selection
  const handleManifestItemSelect = (
    event: { item: any; type: 'manifest' | 'source' | 'opf' }
  ) => {
    selectedManifestItem = event.item;
    selectedManifestItemType = event.type;
  };

  // Handle metadata changes - refresh workspace list when author/title changes
  const handleMetadataChanged = async (event: CustomEvent<{ field: string; value: any }>) => {
    const { field } = event.detail;

    // Refresh workspace list for fields that affect workspace display
    if (field === 'creator' || field === 'title' || field === 'language') {
      // Trigger workspace list refresh by dispatching event to WorkspaceView
      // Since we don't have direct access to the loadWorkspaces function,
      // we'll emit a custom event that the WorkspaceView can listen for
      window.dispatchEvent(new CustomEvent('workspace-list-refresh'));
    }
  };

  // Handle navigation preview update
  const handleNavigationPreviewUpdate = (
    event: CustomEvent<{ xhtml: string; warnings?: string[] }>
  ) => {
    navigationPreviewContent = event.detail.xhtml;
  };

  // Handle spine preview update
  const handleSpinePreviewUpdate = (
    event: CustomEvent<{
      xhtmlContent: string;
      isTransforming: boolean;
      transformError: any;
      transformWarnings: string[];
      executionTime: number;
      spineItemId: string;
    }>
  ) => {
    spinePreviewData = {
      xhtmlContent: event.detail.xhtmlContent,
      isTransforming: event.detail.isTransforming,
      transformError: event.detail.transformError,
      transformWarnings: event.detail.transformWarnings,
      executionTime: event.detail.executionTime,
      spineItemId: event.detail.spineItemId,
    };
  };

  // Handle preview click for text selection in editor
  const handlePreviewClick = (detail: { text: string; documentPosition: number; elementType: string }) => {
    // Dispatch custom event to SpineView to handle text selection
    const spineViewElement = document.querySelector('[data-spine-view]');
    if (spineViewElement) {
      spineViewElement.dispatchEvent(
        new CustomEvent('preview-click', {
          detail,
          bubbles: true
        })
      );
    }
  };

  // Handle manifest item deletion
  const handleManifestItemDelete = async (event: CustomEvent<{ itemId: string }>) => {
    if (!currentWorkspaceState || !appState) return;

    const confirmed = confirm($t('Are you sure you want to delete this item?'));
    if (!confirmed) return;

    try {
      // Use workspaceService to remove the manifest item
      const updatedWorkspace = await workspaceService.removeManifestItem(
        currentWorkspaceState, 
        event.detail.itemId
      );
      
      // Update the workspace state in appState (same pattern as upload)
      appState.workspace = updatedWorkspace;
      
      // Clear selection if deleted item was selected
      if (selectedManifestItem && selectedManifestItem.id === event.detail.itemId) {
        selectedManifestItem = null;
        selectedManifestItemType = null;
      }
    } catch (error) {
      console.error('Failed to delete manifest item:', error);
      // Could add a toast notification here in the future
    }
  };

  // Handle EPUB import (unified handler for local files and remote URLs)
  const handleEpubImport = async (file?: File, sourceUrl?: string) => {
    if (!appState) {
      console.error('AppState not initialized');
      return;
    }

    try {
      let epubFile: File;

      if (file) {
        // Local file provided
        epubFile = file;
      } else if (sourceUrl) {
        // Remote URL provided - fetch the EPUB directly
        console.log(`Downloading EPUB from: ${sourceUrl}`);
        const response = await fetch(sourceUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to download EPUB: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        const filename = extractFilenameFromUrl(sourceUrl);
        epubFile = new File([blob], filename, { type: 'application/epub+zip' });
      } else {
        // No file or URL provided - show file picker
        epubFile = await showFilePickerForEpub();
      }

      // Generate unique workspace ID
      const workspaceId = 'workspace-' + crypto.randomUUID();

      console.log(`Importing EPUB: ${epubFile.name} to workspace: ${workspaceId}`);

      // Unpack EPUB to workspace
      const result = await epubUnpacker.unpackEPUB(epubFile, workspaceId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to unpack EPUB');
      }

      console.log(`✅ Successfully imported EPUB: ${result.extractedFiles?.length} files extracted`);

      // Load the new workspace
      await appState.loadWorkspace(workspaceId);

      // Navigate to first spine item if available
      const firstSpineItem = appState.workspace?.opf?.spine?.[0];
      if (firstSpineItem) {
        // Select first spine item
        appState.selectChapter(firstSpineItem.idref);
        // Navigate to spine view
        navigationStore.navigateTo('spine');
      } else {
        // Fallback to metadata view if no spine items
        navigationStore.navigateTo('metadata');
      }

      // Clear hash to clean up URL after successful import
      location.hash = '';

    } catch (error) {
      console.error('Failed to import EPUB:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to import EPUB: ${errorMessage}`);
    }
  };

  // Helper function to extract filename from URL
  const extractFilenameFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'imported-epub.epub';
      return filename.endsWith('.epub') ? filename : `${filename}.epub`;
    } catch {
      return 'imported-epub.epub';
    }
  };

  // Helper function to show file picker
  const showFilePickerForEpub = (): Promise<File> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.epub';

      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          resolve(file);
        } else {
          reject(new Error('No file selected'));
        }
      };

      input.oncancel = () => {
        reject(new Error('File selection cancelled'));
      };

      input.click();
    });
  };

  // Handle smart navigation to first spine item (reuses EPUB import logic)
  const handleSmartNavigation = (_workspaceId: string) => {
    if (!appState) return;

    // Navigate to first spine item if available (same logic as EPUB import)
    const firstSpineItem = appState.workspace?.opf?.spine?.[0];
    if (firstSpineItem) {
      // Select first spine item
      appState.selectChapter(firstSpineItem.idref);
      // Navigate to spine view
      navigationStore.navigateTo('spine');
    } else {
      // Fallback to metadata view if no spine items
      navigationStore.navigateTo('metadata');
    }
  };

  // Handle EPUB package request
  const handlePackageRequest = async (workspaceId: string) => {
    if (!currentWorkspaceState) return;

    try {
      // Update metadata.modifiedDate first
      const updatedWorkspace = await workspaceService.updateMetadata(currentWorkspaceState, {
        modifiedDate: generateEPUBTimestamp()
      });

      // Update the workspace state in appState
      if (appState) {
        appState.workspace = updatedWorkspace;
      }

      // Then package EPUB with progress tracking
      const result = await epubPackager.packageEPUB(workspaceId, {
        progressCallback: (progress) => {
          console.log(`Packaging progress: ${progress.phase} - ${progress.processedFiles}/${progress.totalFiles} files`);
        }
      });

      if (result.success && result.blob && result.filename) {
        // Immediately download the packaged EPUB
        epubPackager.downloadEPUB(result.blob, result.filename);
        
        console.log(`✅ Successfully packaged and downloaded: ${result.filename}`);
      } else {
        throw new Error(result.error || 'Unknown packaging error');
      }
    } catch (error) {
      console.error('Failed to package EPUB:', error);
      throw error; // Re-throw so SpineSidebar can handle UI feedback
    }
  };

  // Initialize app state
  onMount(() => {
    // Async initialization - transform engine first, then app state
    (async () => {
      try {
        // Initialize FileStorageAPI first
        await fileStorage.init();

        // Create extension manager after FileStorageAPI is initialized
        extensionManager = new ExtensionManager(fileStorage);

        // Create blob URL manager after FileStorageAPI is initialized
        blobURLManager = new BlobURLManager({
          fileStorage,
          basePath: 'OEBPS',
          maxBlobURLs: 100,
          onCapacityReached: () => {
            console.warn('Blob URL capacity reached - consider cleanup');
          },
        });

        // Initialize transform engine
        transformEngine = new TransformEngine(blobURLManager, extensionManager);
        await transformEngine.initialize();
        transformEngineReady = true;

        // Create AppState with transform engine
        appState = new EnhancedAppState(
          fileStorage,
          transformExecutor,
          i18nService,
          extensionManager,
          simpleThemeStore,
          simpleI18nStore,
          transformEngine
        );

        // Initialize app state (FileStorageAPI already initialized above)
        await appState.initialize();
      } catch (error) {
        console.error('Failed to initialize app:', error);
        transformEngineError = error instanceof Error ? error.message : 'Initialization failed';
      }
    })();

    // Listen for spine item selection events
    const handleSelectSpineItem = (event: Event) => {
      if (!appState) return;
      const customEvent = event as CustomEvent<{ itemId: string }>;
      appState.selectChapter(customEvent.detail.itemId);

      // Automatically navigate to spine view when a spine item is selected
      navigationStore.navigateTo('spine');
    };

    // Listen for spine item clear events
    const handleClearSpineSelection = () => {
      if (!appState) return;
      appState.selectChapter(null);
    };

    // Handle hashchange events for remote EPUB imports
    const handleHashChange = () => {
      const fragment = window.location.hash.slice(1); // Remove #
      
      if (fragment.startsWith('http')) {
        // URL-encoded EPUB URL in hash fragment
        try {
          const decodedUrl = decodeURIComponent(fragment);
          console.log(`Hash change detected: importing EPUB from ${decodedUrl}`);
          handleEpubImport(undefined, decodedUrl);
        } catch (error) {
          console.error('Failed to decode URL from hash:', error);
          alert('Invalid URL in hash fragment');
        }
      }
    };

    // Check hash on initial load
    if (window.location.hash) {
      handleHashChange();
    }

    window.addEventListener('select-spine-item', handleSelectSpineItem);
    window.addEventListener('clear-spine-selection', handleClearSpineSelection);
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('select-spine-item', handleSelectSpineItem);
      window.removeEventListener('clear-spine-selection', handleClearSpineSelection);
      window.removeEventListener('hashchange', handleHashChange);
      appState?.cleanup();
      transformEngine?.cleanup();
    };
  });
</script>

<svelte:head>
  <title>{windowTitle}</title>
</svelte:head>

{#if transformEngineError}
  <div class="error-state">
    <h2>Transform Engine Failed</h2>
    <p>{transformEngineError}</p>
    <p>Please refresh the page to try again.</p>
  </div>
{:else if !transformEngineReady}
  <div class="loading-state">
    <div class="spinner"></div>
    <p>Initializing transform engine...</p>
  </div>
{:else if !appState}
  <div class="loading-state">
    <div class="spinner"></div>
    <p>Initializing application...</p>
  </div>
{:else}
  <LayoutManager hasWorkspace={!!currentWorkspaceId}>
    <svelte:fragment slot="sidebar-spine">
      {#if !initialized}
        <div class="placeholder-content">
          <p>{$t('Loading project…')}</p>
        </div>
      {:else if !currentWorkspaceState}
        <div class="placeholder-content">
          <p>{$t('No project selected')}</p>
        </div>
      {:else if currentWorkspaceState}
        <SpineSidebar
          workspace={currentWorkspaceState}
          {spineService}
          selectedItemId={selectedSpineItemId}
          {isExpanded}
          onWorkspaceUpdate={updatedWorkspace => {
            if (appState) appState.workspace = updatedWorkspace;
          }}
          onPackageRequested={handlePackageRequest}
        />
      {:else}
        <div class="placeholder-content">
          <p>{$t('Loading project…')}</p>
        </div>
      {/if}
    </svelte:fragment>

    <svelte:fragment slot="left-header">
      {#if currentWorkspaceState && 
           currentView !== 'about' && 
           currentView !== 'workspace' && 
           currentView !== 'metadata' &&
           extensionManager}
        <WorkspaceHeader 
          workspace={currentWorkspaceState}
          {extensionManager}
        />
      {/if}
    </svelte:fragment>

    <svelte:fragment slot="left-content">
      <!-- Main content area - switches based on current view -->
      {#if currentView === 'about'}
        <AboutView />
      {:else if currentView === 'workspace' && initialized}
        <WorkspaceView
          onListWorkspaces={() => appState?.listWorkspaces() ?? Promise.resolve([])}
          onCreateWorkspace={data =>
            appState?.createWorkspace(data.title, data.language) ?? Promise.resolve('')}
          onDeleteWorkspace={id => appState?.deleteWorkspace(id) ?? Promise.resolve()}
          onLoadWorkspace={id => appState?.loadWorkspace(id) ?? Promise.resolve()}
          onEpubImportRequested={handleEpubImport}
          {currentWorkspaceId}
          onNavigationRequested={view => {
            navigationStore.navigateTo(view as ViewType);
          }}
          onSmartNavigationRequested={handleSmartNavigation}
          onWorkspaceOpened={() => {
            // Workspace opened
          }}
          onWorkspaceChanged={() => {
            // Workspace changed
          }}
        />
      {:else if currentView === 'metadata'}
        {#if initialized && currentWorkspaceState && appState}
          <MetadataEditor
            bind:workspace={appState.workspace}
            {metadataService}
            on:metadataChanged={handleMetadataChanged}
          />
        {:else}
          <PlaceholderView
            viewType="metadata"
            title={$t('EPUB Metadata')}
            description={$t('Configure publication metadata and details')}
            icon="📝"
          />
        {/if}
      {:else if currentView === 'manifest'}
        {#if initialized && currentWorkspaceState}
          <ManifestContainer
            workspace={currentWorkspaceState}
            {workspaceService}
            advancedMode={appState.isAdvancedMode}
            onItemSelect={handleManifestItemSelect}
          />
        {:else}
          <PlaceholderView
            viewType="manifest"
            title={$t('File Manifest')}
            description={$t('Manage EPUB files and resources')}
            icon="📋"
          />
        {/if}
      {:else if currentView === 'navigation'}
        {#if initialized && currentWorkspaceState}
          <OutlineView
            workspace={currentWorkspaceState}
            {workspaceService}
            {spineService}
            on:previewUpdate={handleNavigationPreviewUpdate}
          />
        {:else}
          <PlaceholderView
            viewType="navigation"
            title={$t('Table of Contents')}
            description={$t('Loading project…')}
            icon="📖"
          />
        {/if}
      {:else if currentView === 'spine'}
        {#if initialized && currentWorkspaceState && appState}
          <SpineView
            workspace={currentWorkspaceState}
            {workspaceService}
            {spineService}
            selectedItemId={selectedSpineItemId}
            transformEngine={appState.getTransformEngine()}
            contentService={appState.getContentService()}
            on:previewUpdate={handleSpinePreviewUpdate}
          />
        {:else}
          <PlaceholderView
            viewType="spine"
            title={$t('Spine Items')}
            description={$t('Loading project…')}
            icon="📚"
          />
        {/if}
      {:else if currentView === 'settings'}
        <SettingsView
          settingsService={appState.getSettingsService()}
          extensionManager={appState.getExtensionManager()}
          transformEngine={appState.getTransformEngine()}
          workspaceId={appState.currentWorkspaceId}
          onSettingsChanged={() => {
            // Reload workspace settings in AppState after they're changed in SettingsView
            if (appState?.currentWorkspaceId) {
              appState.loadWorkspaceSettings(appState.currentWorkspaceId);
            }
          }}
        />
      {:else}
        <div class="placeholder-content">
          <h3>{$t('Unknown View')}</h3>
          <p>{$t('View type')}: {currentView}</p>
        </div>
      {/if}
    </svelte:fragment>

    <svelte:fragment slot="right-content">
      {#if currentView === 'about'}
        <ThirdPartyView />
      {:else if currentView === 'manifest' && initialized && currentWorkspaceState}
        <ManifestPreview
          selectedItem={selectedManifestItem}
          selectedItemType={selectedManifestItemType}
          workspace={currentWorkspaceState}
          {workspaceService}
          on:itemDelete={handleManifestItemDelete}
        />
      {:else if currentView === 'navigation'}
        {#if navigationPreviewContent}
          <ContentPreview content={navigationPreviewContent} />
        {:else}
          <div class="placeholder-content">
            <h3>{$t('Navigation Preview')}</h3>
            <p>{$t('Generating navigation from chapters...')}</p>
          </div>
        {/if}
      {:else if currentView === 'spine'}
        {#if spinePreviewData.spineItemId}
          <PreviewPane
            xhtmlContent={spinePreviewData.xhtmlContent}
            isTransforming={spinePreviewData.isTransforming}
            transformError={spinePreviewData.transformError}
            transformWarnings={spinePreviewData.transformWarnings}
            executionTime={spinePreviewData.executionTime}
            spineItemId={spinePreviewData.spineItemId}
            onPreviewClick={handlePreviewClick}
          />
        {:else}
          <div class="placeholder-content">
            <h3>{$t('Spine Preview')}</h3>
            <p>{$t('Select a spine item to see the preview here')}</p>
          </div>
        {/if}
      {:else}
        <div class="placeholder-content">
          <h3>{$t('Preview Pane')}</h3>
          <p>{$t('Content preview will appear here based on the current view')}</p>
          <p class="current-view-info">{$t('Current view')}: <strong>{currentView}</strong></p>
        </div>
      {/if}
    </svelte:fragment>
  </LayoutManager>
{/if}

<style>
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
    padding: 2rem;
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
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-state {
    color: var(--color-error-text);
  }

  .error-state h2 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .error-state p {
    margin: 0.5rem 0;
    font-size: 1rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
  .placeholder-content {
    padding: 1rem;
    color: var(--color-text-secondary);
  }

  .placeholder-content h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .placeholder-content p {
    margin: 0;
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .current-view-info {
    margin-top: 1rem !important;
    padding: 0.5rem;
    background: var(--color-bg-secondary);
    border-radius: 4px;
    font-size: 0.75rem !important;
  }
</style>
