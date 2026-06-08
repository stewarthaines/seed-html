<script lang="ts">
  import { onMount } from 'svelte';
  import { Package } from 'phosphor-svelte';
  import LayoutManager from './lib/LayoutManager.svelte';
  import { navigationStore } from './lib/navigation';
  import type { ViewType } from './lib/navigation/types';
  import AboutView from './lib/navigation/views/AboutView.svelte';
  import ThirdPartyView from './lib/navigation/views/ThirdPartyView.svelte';
  import WorkspaceView from './lib/navigation/views/WorkspaceView.svelte';
  import MetadataEditor from './lib/components/metadata/MetadataEditor.svelte';
  import SpineView from './lib/navigation/views/SpineView.svelte';
  import PublishView from './lib/navigation/views/PublishView.svelte';
  import SettingsView from './lib/navigation/views/SettingsView.svelte';
  import {
    loadPluginManifest,
    findActivePlugin,
    resolvePluginEntryUrl,
  } from './lib/plugins/plugin-registry';
  import type { PluginManifestEntry } from './lib/plugins/contract';
  import {
    loadExtensionCatalog,
    type ExtensionCatalogEntry,
  } from './lib/extensions/extension-catalog';
  import SpineSidebar from './lib/components/SpineSidebar.svelte';
  import ManifestContainer from './lib/components/manifest/ManifestContainer.svelte';
  import ManifestPreview from './lib/components/manifest/ManifestPreview.svelte';
  import OutlineView from './lib/components/outline/OutlineView.svelte';
  import ContentPreview from './lib/components/preview/ContentPreview.svelte';
  import OPFPreview from './lib/components/metadata/OPFPreview.svelte';
  import PreviewPane from './lib/components/spine/PreviewPane.svelte';
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
  import { PublishService } from './lib/services/publish/publish.service.js';
  import { BlobURLManager } from './lib/blob-url/blob-url-manager.js';
  import { ExtensionManager } from './lib/extensions/extension-manager.js';
  import { EPUBPackager } from './lib/epub/EPUBPackager.js';
  import { EPUBUnpacker } from './lib/epub/EPUBUnpacker.js';
  import { generateEPUBTimestamp } from './lib/epub/opf-utils.js';
  import { ensureGeneratedNav } from './lib/outline/nav-coherence.js';

  // Extension manager instance
  let extensionManager = $state<ExtensionManager>();

  const simpleThemeStore = {
    setTheme: () => {
      /* no-op placeholder store */
    },
    useSystemPreference: () => {
      /* no-op placeholder store */
    },
    getCurrentTheme: () => 'system',
  };

  const simpleI18nStore = {
    setLocale: () => {
      /* no-op placeholder store */
    },
    getCurrentLocale: () => 'en',
  };

  // Create singleton FileStorageAPI and services with shared instance
  const fileStorage = FileStorageAPI.getInstance();
  const transformExecutor = new TransformExecutor();

  // Create services using shared FileStorageAPI
  const workspaceService = new WorkspaceService(fileStorage);
  const spineService = new SpineService(workspaceService);
  const metadataService = new MetadataService(workspaceService);
  const publishService = new PublishService(fileStorage);
  const epubPackager = new EPUBPackager();
  const epubUnpacker = new EPUBUnpacker();

  // BlobURLManager will be created after FileStorageAPI is initialized
  let blobURLManager = $state<BlobURLManager>();

  // Transform engine initialization state
  let transformEngine: TransformEngine | null = null;
  let transformEngineReady = $state(false);
  let transformEngineError = $state<string | null>(null);

  // AppState created in proper Svelte context, initialized later
  let appState = $state<EnhancedAppState | null>(null);

  // HTTP-only plugin layer: available plugins (from plugins/manifest.json) and the
  // user's enabled set (global setting). The publish `view` surface uses its plugin
  // only when both available and enabled; otherwise the core Publish feature shows.
  const PUBLISH_PLUGIN_ID = 'publish-to-remote';
  let availablePlugins = $state<PluginManifestEntry[]>([]);
  let enabledPluginIds = $state<string[]>([]);
  // HTTP-delivered extensions catalog (extensions/manifest.json), importable per project.
  let availableExtensions = $state<ExtensionCatalogEntry[]>([]);
  let publishPluginUrl = $derived.by(() => {
    const entry = findActivePlugin(availablePlugins, enabledPluginIds, PUBLISH_PLUGIN_ID);
    return entry ? resolvePluginEntryUrl(entry) : null;
  });

  // Reactive getters for template access
  let currentView = $derived($navigationStore.currentView);
  // Single canonical page heading per view (visually hidden) for screen readers, so
  // every view satisfies "page should contain a level-one heading".
  let viewTitle = $derived(
    (
      {
        about: $t('About'),
        workspace: $t('Projects'),
        metadata: $t('Metadata'),
        manifest: $t('Manifest'),
        navigation: $t('Navigation'),
        spine: $t('Spine'),
        publish: $t('Publish'),
        settings: $t('Settings'),
      } as Record<string, string>
    )[currentView] ?? 'EDITME'
  );
  let isExpanded = $derived($layoutStore.sidebar.isExpanded);

  // Whether any packaged EPUBs exist in the OPFS /publish dir. Gates the Publish nav
  // item — it's keyed to artifacts, not projects (you can have published epubs with
  // no current project, or none despite having projects).
  let hasPublishedEpubs = $state(false);
  async function refreshHasPublishedEpubs(): Promise<void> {
    try {
      hasPublishedEpubs = (await publishService.listPublishedEpubs()).length > 0;
    } catch {
      hasPublishedEpubs = false;
    }
  }
  // Re-check on first run and whenever the view changes (covers deletes done in the
  // Publish view), plus right after a new epub is packaged.
  $effect(() => {
    void currentView;
    void refreshHasPublishedEpubs();
  });
  $effect(() => {
    const onPackaged = () => void refreshHasPublishedEpubs();
    window.addEventListener('epub-packaged', onPackaged);
    return () => window.removeEventListener('epub-packaged', onPackaged);
  });

  let currentWorkspaceId = $derived(appState?.currentWorkspaceId);
  let selectedSpineItemId = $derived(appState?.selectedChapterId); // renamed in enhanced
  let initialized = $derived(appState?.initialized || false);
  let currentWorkspaceState = $derived(appState?.workspace);

  // Metadata field focus tracking for OPF preview highlighting
  let focusedMetadataField = $state<keyof import('./lib/epub/opf-utils.js').EPUBMetadata | null>(
    null
  );
  let activeMetadataTabFields = $state<string[]>([]);

  // Granular reactive signals to prevent loading flicker during metadata updates
  let workspaceMetadata = $derived(currentWorkspaceState?.opf?.metadata);
  let workspaceTitle = $derived(workspaceMetadata?.title);

  // Dynamic window title based on workspace
  let windowTitle = $derived.by(() => {
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
  const handleManifestItemSelect = (event: { item: any; type: 'manifest' | 'source' | 'opf' }) => {
    selectedManifestItem = event.item;
    selectedManifestItemType = event.type;
  };

  // Handle metadata changes - refresh workspace list when author/title changes
  const handleMetadataChanged = async (detail: { field: string; value: any }) => {
    const { field } = detail;

    // Refresh workspace list for fields that affect workspace display
    if (field === 'creator' || field === 'title' || field === 'language') {
      // Trigger workspace list refresh by dispatching event to WorkspaceView
      // Since we don't have direct access to the loadWorkspaces function,
      // we'll emit a custom event that the WorkspaceView can listen for
      window.dispatchEvent(new CustomEvent('workspace-list-refresh'));
    }
  };

  // Handle metadata field focus for OPF preview highlighting
  const handleMetadataFieldFocus = (detail: {
    field: keyof import('./lib/epub/opf-utils.js').EPUBMetadata | null;
  }) => {
    focusedMetadataField = detail.field;
  };

  // Track the active metadata tab's fields (for soft group highlighting), and
  // drop a stale focused field when the tab changes.
  const handleMetadataTabFields = (detail: { fields: string[] }) => {
    activeMetadataTabFields = detail.fields;
    focusedMetadataField = null;
  };

  // Handle navigation preview update
  const handleNavigationPreviewUpdate = (event: { xhtml: string; warnings?: string[] }) => {
    navigationPreviewContent = event.xhtml;
  };

  // Handle navigation anchor clicks
  function handleNavigationClick(chapterId: string) {
    console.log('handleNavigationClick', chapterId);
    // Find manifest item by matching href
    const manifestItem = currentWorkspaceState?.opf?.manifest?.find(item =>
      item.href?.includes(`${chapterId}.xhtml`)
    );

    if (manifestItem) {
      // Use the exact same event flow as SpineSidebar
      const event = new CustomEvent('select-spine-item', {
        detail: { itemId: manifestItem.id },
        bubbles: true,
      });
      window.dispatchEvent(event);
    }
  }

  // Handle spine preview update
  const handleSpinePreviewUpdate = (detail: {
    xhtmlContent: string;
    isTransforming: boolean;
    transformError: any;
    transformWarnings: string[];
    executionTime: number;
    spineItemId: string | null;
  }) => {
    spinePreviewData = {
      xhtmlContent: detail.xhtmlContent,
      isTransforming: detail.isTransforming,
      transformError: detail.transformError,
      transformWarnings: detail.transformWarnings,
      executionTime: detail.executionTime,
      spineItemId: detail.spineItemId,
    };
  };

  // Handle preview click for text selection in editor
  const handlePreviewClick = (detail: {
    text: string;
    documentPosition: number;
    elementType: string;
  }) => {
    // Dispatch custom event to SpineView to handle text selection
    const spineViewElement = document.querySelector('[data-spine-view]');
    if (spineViewElement) {
      console.log('handlePreviewClick', detail);
      spineViewElement.dispatchEvent(
        new CustomEvent('preview-click', {
          detail,
          bubbles: true,
        })
      );
    }
  };

  // Handle manifest item deletion
  const handleManifestItemDelete = async (detail: { itemId: string }) => {
    if (!currentWorkspaceState || !appState) return;

    const confirmed = confirm($t('Are you sure you want to delete this item?'));
    if (!confirmed) return;

    try {
      // Use workspaceService to remove the manifest item
      const updatedWorkspace = await workspaceService.removeManifestItem(
        currentWorkspaceState,
        detail.itemId
      );

      // Update the workspace state in appState (same pattern as upload)
      appState.workspace = updatedWorkspace;

      // Clear selection if deleted item was selected
      if (selectedManifestItem && selectedManifestItem.id === detail.itemId) {
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

      console.log(
        `✅ Successfully imported EPUB: ${result.extractedFiles?.length} files extracted`
      );

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

      input.onchange = event => {
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

  // Handle EPUB package request
  const handlePackageRequest = async (workspaceId: string) => {
    if (!currentWorkspaceState) return;

    try {
      // Update metadata.modifiedDate first
      const updatedWorkspace = await workspaceService.updateMetadata(currentWorkspaceState, {
        modifiedDate: generateEPUBTimestamp(),
      });

      // Regenerate the auto-generated nav.xhtml from the current spine so the
      // packaged EPUB always ships a coherent nav (a manual nav.txt is left
      // untouched). Runs before packaging, which zips files straight from storage.
      const { workspace: navWorkspace } = await ensureGeneratedNav(
        updatedWorkspace,
        spineService,
        workspaceService
      );

      // Update the workspace state in appState
      if (appState) {
        appState.workspace = navWorkspace;
      }

      // Then package the EPUB.
      const result = await epubPackager.packageEPUB(workspaceId);

      if (result.success && result.blob && result.filename) {
        // Take the user to the Publish view to see the newly packaged epub.
        // (No-op if already there; its onMount load picks up the new file when
        // navigating in fresh.)
        navigationStore.navigateTo('publish');

        // Notify the Publish view (if already open) to refresh its list.
        window.dispatchEvent(new CustomEvent('epub-packaged'));
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
        // transformEngine.setDebugMode(true);

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

        // Discover plugins (HTTP only; no-op on file:// or when no manifest is
        // served) and read the user's enabled set.
        availablePlugins = await loadPluginManifest();
        enabledPluginIds = appState.getSettingsService().getEnabledPlugins();
        availableExtensions = await loadExtensionCatalog();

        // Check hash after appState is fully ready
        if (window.location.hash) {
          handleHashChange();
        }
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
    function handleHashChange() {
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
  <LayoutManager
    hasWorkspace={!!currentWorkspaceId}
    {hasPublishedEpubs}
    {enabledPluginIds}
    currentWorkspace={currentWorkspaceState}
    {workspaceTitle}
    {extensionManager}
  >
    {#snippet sidebarSpine()}
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
        />
      {:else}
        <div class="placeholder-content">
          <p>{$t('Loading project…')}</p>
        </div>
      {/if}
    {/snippet}

    {#snippet sidebarFooter()}
      {#if currentWorkspaceState}
        <div class="package-epub-section">
          <button
            class="package-epub-button"
            onclick={() => handlePackageRequest(currentWorkspaceState.id)}
            title={$t('Package EPUB')}
          >
            <Package size={18} aria-hidden="true" />
            <span class="package-label">{$t('Package EPUB')}</span>
          </button>
        </div>
      {/if}
    {/snippet}

    {#snippet leftContent()}
      <h1 class="sr-only">{viewTitle}</h1>
      <!-- Main content area - switches based on current view -->
      {#if currentView === 'about'}
        <AboutView />
      {:else if currentView === 'workspace' && initialized}
        <WorkspaceView
          onListWorkspaces={() => appState?.listWorkspaces() ?? Promise.resolve([])}
          onCreateWorkspace={data =>
            appState?.createWorkspace(data.title, data.language) ?? Promise.resolve('')}
          onDeleteWorkspace={id => appState?.deleteWorkspace(id) ?? Promise.resolve()}
          onDuplicateWorkspace={id => appState?.duplicateWorkspace(id) ?? Promise.resolve('')}
          onLoadWorkspace={id => appState?.loadWorkspace(id) ?? Promise.resolve()}
          onLoadWorkspaceDetails={id =>
            appState?.getWorkspaceRowDetails(id) ?? Promise.resolve({ fileCount: 0 })}
          onEpubImportRequested={handleEpubImport}
          {currentWorkspaceId}
          onNavigationRequested={view => {
            navigationStore.navigateTo(view as ViewType);
          }}
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
            advancedMode={appState.isAdvancedMode}
            onMetadataChanged={handleMetadataChanged}
            onFieldFocus={handleMetadataFieldFocus}
            onTabFieldsChange={handleMetadataTabFields}
          />
        {:else}
          <div class="view-loading">{$t('Loading project…')}</div>
        {/if}
      {:else if currentView === 'manifest'}
        {#if initialized && currentWorkspaceState && appState}
          <ManifestContainer
            workspace={currentWorkspaceState}
            {workspaceService}
            advancedMode={appState.isAdvancedMode}
            onItemSelect={handleManifestItemSelect}
            onWorkspaceUpdate={updatedWorkspace => {
              if (appState) appState.workspace = updatedWorkspace;
            }}
          />
        {:else}
          <div class="view-loading">{$t('Loading project…')}</div>
        {/if}
      {:else if currentView === 'navigation'}
        {#if initialized && currentWorkspaceState && appState && blobURLManager}
          <OutlineView
            workspace={currentWorkspaceState}
            {workspaceService}
            {spineService}
            transformEngine={appState.getTransformEngine()}
            settingsService={appState.getSettingsService()}
            extensionManager={appState.getExtensionManager()}
            {blobURLManager}
            {fileStorage}
            previewUpdate={handleNavigationPreviewUpdate}
          />
        {:else}
          <div class="view-loading">{$t('Loading project…')}</div>
        {/if}
      {:else if currentView === 'spine'}
        {#if initialized && currentWorkspaceState && appState}
          <SpineView
            workspace={currentWorkspaceState}
            {workspaceService}
            {spineService}
            selectedItemId={selectedSpineItemId ?? null}
            transformEngine={appState.getTransformEngine()}
            contentService={appState.getContentService()}
            audioClipService={appState.getAudioClipService()}
            onPreviewUpdate={handleSpinePreviewUpdate}
          />
        {:else}
          <div class="view-loading">{$t('Loading project…')}</div>
        {/if}
      {:else if currentView === 'publish'}
        <PublishView
          {publishService}
          pluginUrl={publishPluginUrl}
          projectId={currentWorkspaceId ?? 'publish'}
        />
      {:else if currentView === 'settings' && appState}
        <SettingsView
          settingsService={appState.getSettingsService()}
          extensionManager={appState.getExtensionManager()}
          transformEngine={appState.getTransformEngine()}
          workspaceId={appState.currentWorkspaceId}
          {availablePlugins}
          {enabledPluginIds}
          {availableExtensions}
          onTogglePlugin={(id, enabled) => {
            appState?.getSettingsService().setPluginEnabled(id, enabled);
            enabledPluginIds = appState?.getSettingsService().getEnabledPlugins() ?? [];
          }}
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
    {/snippet}

    {#snippet rightContent()}
      {#if currentView === 'about'}
        <ThirdPartyView />
      {:else if currentView === 'metadata' && initialized && currentWorkspaceState}
        <OPFPreview
          workspace={currentWorkspaceState}
          focusedField={focusedMetadataField}
          tabFields={activeMetadataTabFields}
          isAdvancedMode={appState?.isAdvancedMode ?? false}
        />
      {:else if currentView === 'manifest' && initialized && currentWorkspaceState}
        <ManifestPreview
          selectedItem={selectedManifestItem}
          selectedItemType={selectedManifestItemType}
          workspace={currentWorkspaceState}
          {workspaceService}
          onItemDelete={handleManifestItemDelete}
          onWorkspaceUpdate={updatedWorkspace => {
            if (appState) appState.workspace = updatedWorkspace;
          }}
        />
      {:else if currentView === 'navigation'}
        {#if navigationPreviewContent}
          <ContentPreview content={navigationPreviewContent} onNavigate={handleNavigationClick} />
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
            onPreviewClick={handlePreviewClick}
            onNavigate={handleNavigationClick}
            chapterId={spinePreviewData.spineItemId}
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
        </div>
      {/if}
    {/snippet}
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
    color: var(--color-text-primary);
  }

  .placeholder-content h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .placeholder-content p {
    margin: 0;
    font-size: 0.875rem;
  }

  .view-loading {
    padding: var(--space-4);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  /* Package EPUB button styling */
  .package-epub-section {
    padding: var(--space-3);
    border-top: 1px solid var(--color-border-default);
  }

  .package-epub-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-button-primary-bg);
    border-radius: var(--radius-sm);
    background-color: var(--color-button-primary-bg);
    color: white;
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    min-height: 36px;
  }

  /* Collapsed sidebar: show the package icon only (the label is illegible squeezed). */
  :global(.sidebar.collapsed) .package-epub-section {
    padding: var(--space-2);
  }

  :global(.sidebar.collapsed) .package-epub-button {
    padding: var(--space-2);
  }

  :global(.sidebar.collapsed) .package-epub-button .package-label {
    display: none;
  }

  .package-epub-button:hover:not(:disabled) {
    background-color: var(--color-button-primary-bg-hover);
    border-color: var(--color-button-primary-bg-hover);
  }

  /* Dark: a tonal treatment instead of the heavy primary fill — softer on the
     dark sidebar while still reading as the accent CTA. (Light is unchanged.) */
  :global([data-theme='dark']) .package-epub-button {
    background-color: var(--color-surface-elevated);
    border-color: var(--color-border-accent);
    color: var(--color-text-link);
  }

  :global([data-theme='dark']) .package-epub-button:hover:not(:disabled) {
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-focus);
    color: var(--color-text-link-hover);
  }

  .package-epub-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .package-epub-button:focus-visible {
    /* The ring is a similar blue to the button fill, so an inset ring blends
       in. Sit an actual outline a couple of pixels OUTSIDE the button, against
       the lighter sidebar, where it reads. */
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
    box-shadow: none;
  }
</style>
