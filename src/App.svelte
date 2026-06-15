<script lang="ts">
  import { onMount } from 'svelte';
  import { Package, FilePdf } from 'phosphor-svelte';
  import LayoutManager from './lib/LayoutManager.svelte';
  import { navigationStore } from './lib/navigation';
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
  import { t, currentLocale } from './lib/i18n';
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
  import { createSpinePreviewManager } from './lib/transform/spine-preview-manager.js';
  import { addTransform } from './lib/settings/dom-transforms.js';
  import CreateProjectDialog, {
    type CreateProjectData,
  } from './lib/components/workspace/CreateProjectDialog.svelte';
  import {
    generateCoverSvg,
    generateCoverPng,
    type CoverMode,
  } from './lib/epub/cover-generator.js';
  import { exportPdf } from './lib/pdf/pdf-export.js';
  import { writePublishSidecar } from './lib/services/publish/publish-sidecar.js';

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
    )[currentView] ?? 'SEED.html'
  );
  let isExpanded = $derived($layoutStore.sidebar.isExpanded);

  // Whether any packaged EPUBs exist in the OPFS /publish dir. Gates the Publish nav

  let currentWorkspaceId = $derived(appState?.currentWorkspaceId);
  let selectedSpineItemId = $derived(appState?.selectedChapterId); // renamed in enhanced
  let initialized = $derived(appState?.initialized || false);
  let currentWorkspaceState = $derived(appState?.workspace);
  // A regular EPUB (no SOURCE/) opens read-only: viewable, every editor disabled.
  let isReadOnly = $derived(appState?.readOnly ?? false);

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
    return workspaceTitle ? `${workspaceTitle}` : 'SEED.html';
  });

  // Manifest item selection state
  let selectedManifestItem = $state<any>(null);
  let selectedManifestItemType = $state<'manifest' | 'source' | 'opf' | null>(null);
  // Bumped to make the manifest table reload its SOURCE file list after a
  // SOURCE/data/ file is deleted (such deletes don't change content.opf).
  let manifestRefreshToken = $state(0);

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
    if (!currentWorkspaceState || !appState || isReadOnly) return;

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

  // Delete a transform-created SOURCE/data/ file. Unlike manifest items these
  // aren't in content.opf, so we delete the file directly and nudge the table to
  // reload its SOURCE list (its workspace reference is unchanged).
  const handleSourceFileDelete = async (detail: { path: string }) => {
    if (!currentWorkspaceState || isReadOnly) return;

    const name = detail.path.split('/').pop() || detail.path;
    if (!confirm($t('Delete {name}? This cannot be undone.', { name }))) return;

    try {
      await workspaceService.deleteSourceFile(currentWorkspaceState, detail.path);

      if (
        selectedManifestItemType === 'source' &&
        selectedManifestItem &&
        selectedManifestItem.path === detail.path
      ) {
        selectedManifestItem = null;
        selectedManifestItemType = null;
      }
      manifestRefreshToken += 1;
    } catch (error) {
      console.error('Failed to delete SOURCE file:', error);
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
        const picked = await showFilePickerForEpub();
        // Cancelling the dialog is a normal user action, not an error — quietly
        // do nothing.
        if (!picked) return;
        epubFile = picked;
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

  // Show the native file picker; resolves the chosen file, or null when the user
  // cancels / selects nothing (a no-op, not an error).
  const showFilePickerForEpub = (): Promise<File | null> => {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.epub';

      input.onchange = event => {
        resolve((event.target as HTMLInputElement).files?.[0] ?? null);
      };

      input.oncancel = () => resolve(null);

      input.click();
    });
  };

  // After a catalog extension is imported, register any EPUB assets it brought
  // (e.g. a CSS theme written to OEBPS/) in the OPF manifest, then re-link them
  // into existing chapters. Idempotent: an asset already in the manifest is skipped.
  const handleExtensionAssets = async (
    assets: Array<{ target: string; media?: string }>
  ): Promise<void> => {
    if (!appState || !currentWorkspaceState) return;

    let workspace = currentWorkspaceState;
    let addedStylesheet = false;
    for (const asset of assets) {
      if (workspace.opf.manifest.some(item => item.href === asset.target)) continue;
      workspace = await workspaceService.addManifestItem(workspace, {
        href: asset.target,
        mediaType: asset.media,
      });
      const isCss =
        (asset.media ?? '').startsWith('text/css') || asset.target.toLowerCase().endsWith('.css');
      if (isCss) addedStylesheet = true;
    }

    appState.workspace = workspace;

    // A new stylesheet only reaches existing chapters once their stored XHTML is
    // regenerated (the packager zips stored files as-is).
    if (addedStylesheet) {
      await regenerateAllChapters(workspace.id);
    }
  };

  // Regenerate every editor-authored chapter's stored XHTML so manifest changes
  // (notably a newly added stylesheet) are linked into each chapter's <head>.
  // Reuses the spine preview render+save path. Only chapters that have a text
  // source are touched, so hand-authored XHTML without a SOURCE/text/*.txt is
  // never overwritten with an empty render.
  async function regenerateAllChapters(workspaceId: string): Promise<void> {
    if (!transformEngine || !extensionManager) return;

    const workspace = await workspaceService.loadWorkspace(workspaceId);
    const spine = workspace.opf.spine ?? [];
    if (spine.length === 0) return;

    const settingsService = appState!.getSettingsService();
    // A throwaway blob manager so the regeneration pass never revokes the
    // app-level manager's live preview URLs on cleanup.
    const scratchBlobs = new BlobURLManager({
      fileStorage,
      basePath: 'OEBPS',
      maxBlobURLs: 100,
      onCapacityReached: () => {
        /* scratch pass — capacity pressure is irrelevant, URLs are discarded */
      },
    });

    const manager = createSpinePreviewManager(
      workspaceId,
      spine[0].idref,
      fileStorage,
      extensionManager,
      scratchBlobs,
      workspaceService,
      settingsService,
      transformEngine,
      { autoSave: false, persistToManifest: true },
      () => {
        /* preview output unused — this pass only persists regenerated XHTML */
      },
      () => {
        /* render errors are non-fatal here; a bad chapter just isn't relinked */
      }
    );

    try {
      await manager.initialize();
      for (const item of spine) {
        const hasText = await fileStorage.fileExists(workspaceId, `SOURCE/text/${item.idref}.txt`);
        if (!hasText) continue;
        // switchToSpineItem (re)loads the chapter's text; force a synchronous
        // render that persists the regenerated XHTML to the manifest.
        await manager.switchToSpineItem(item.idref);
        await manager.forcePreviewUpdate();
      }
    } finally {
      manager.cleanup();
    }
  }

  // The new-project dialog is owned here so any view can open it (the Projects
  // pane's "Create New" and the About page's "Create an EPUB Now" both do).
  let showCreateDialog = $state(false);
  // Only text-format extensions (markup languages) are offered in the dialog.
  const textFormats = $derived(availableExtensions.filter(e => e.textTransforms.length > 0));
  const openCreateDialog = () => {
    showCreateDialog = true;
  };

  // Create a project from the new-project dialog: provision it, set the author,
  // install the chosen text-format extension, then open the first chapter — so a
  // new author lands directly in a working chapter rendered through their format.
  const handleCreateProject = async (data: CreateProjectData): Promise<void> => {
    if (!appState) return;

    const workspaceId = await appState.createWorkspace(data.title, data.language);
    // Reload so the workspace id is persisted (restored on reload) and state is clean.
    await appState.loadWorkspace(workspaceId);

    if (data.author && appState.workspace) {
      appState.workspace = await workspaceService.updateMetadata(appState.workspace, {
        creator: [{ name: data.author, roles: [] }],
      });
    }

    if (data.generateCover && appState.workspace) {
      const svg = generateCoverSvg(data.title, data.author, data.hue);
      // SVG — plain manifest item for vector-quality use (no cover-image property)
      await fileStorage.writeTextFile(workspaceId, 'OEBPS/Images/cover.svg', svg);
      appState.workspace = await workspaceService.addManifestItem(appState.workspace, {
        id: 'cover-svg',
        href: 'Images/cover.svg',
        mediaType: 'image/svg+xml',
      });
      // PNG — rasterised thumbnail set as the EPUB cover-image
      const pngBuffer = await generateCoverPng(svg);
      await fileStorage.writeFile(workspaceId, 'OEBPS/Images/cover.png', pngBuffer);
      appState.workspace = await workspaceService.addManifestItem(appState.workspace, {
        id: 'cover-image',
        href: 'Images/cover.png',
        mediaType: 'image/png',
        properties: ['cover-image'],
      });
    }

    if (data.extension) {
      await installCatalogExtension(workspaceId, data.extension);
    }

    // Open the first chapter in the spine editor (mirrors the EPUB-import tail).
    const firstSpineItem = appState.workspace?.opf?.spine?.[0];

    // Seed that first chapter with the chosen text-format extension's sample
    // chapter, so the new project shows the format in action. The editor renders
    // it through the adopted text transform when it loads below.
    if (data.extension?.chapter && firstSpineItem && extensionManager) {
      const text = await extensionManager.getExtensionChapterText(data.extension);
      if (text != null) {
        await fileStorage.writeTextFile(
          workspaceId,
          `SOURCE/text/${firstSpineItem.idref}.txt`,
          text
        );
      }
    }

    if (firstSpineItem) {
      appState.selectChapter(firstSpineItem.idref);
      navigationStore.navigateTo('spine');
    } else {
      navigationStore.navigateTo('metadata');
    }
  };

  // Generate a cover from the metadata view: make a fresh SVG + PNG from the
  // current title/author and add them as NEW manifest items (existing files are
  // never overwritten — collision-resolved to a shared cover/cover-1/... stem).
  // The new PNG becomes the cover-image; the property is moved off any prior
  // holder so exactly one cover remains.
  const handleGenerateCover = async (hue?: number, mode?: CoverMode): Promise<void> => {
    if (!appState?.workspace || isReadOnly) return;
    const ws0 = appState.workspace;
    const meta = ws0.opf.metadata;
    const title = meta.title ?? '';
    const author = meta.creator?.[0]?.name ?? '';
    const base = ws0.pathInfo.basePath; // e.g. "OEBPS"

    const svg = generateCoverSvg(title, author, hue, mode);
    const pngBuffer = await generateCoverPng(svg);

    // If a PNG cover-image already exists (one we generated), UPDATE it in place
    // — overwrite the same files and keep the manifest items, so repeated tweaks
    // don't accumulate cover-1/cover-2 entries. Otherwise CREATE a fresh pair.
    const existing = ws0.opf.manifest.find(
      m => m.properties?.includes('cover-image') && m.mediaType === 'image/png'
    );

    if (existing) {
      await fileStorage.writeFile(ws0.id, `${base}/${existing.href}`, pngBuffer);
      // The sibling SVG shares the stem (cover.png → cover.svg); update it too.
      const svgHref = existing.href.replace(/\.[^.]+$/, '.svg');
      if (ws0.opf.manifest.some(m => m.href === svgHref)) {
        await fileStorage.writeTextFile(ws0.id, `${base}/${svgHref}`, svg);
      }
      // Bump modifiedDate so the OPF is rewritten — refreshes the row-details
      // cache (projects thumbnail) and re-triggers the cover preview effect.
      appState.workspace = await workspaceService.updateMetadata(ws0, {
        modifiedDate: generateEPUBTimestamp(),
      });
      return;
    }

    // CREATE: a non-colliding shared stem so the .svg/.png pair always matches.
    const taken = new Set(ws0.opf.manifest.map(m => m.href.toLowerCase()));
    let stem = 'cover';
    let n = 0;
    while (taken.has(`images/${stem}.svg`) || taken.has(`images/${stem}.png`)) {
      stem = `cover-${++n}`;
    }
    const svgHref = `Images/${stem}.svg`;
    const pngHref = `Images/${stem}.png`;

    // Strip cover-image from any current (non-PNG) holder; the new PNG takes over.
    let ws = ws0;
    for (const item of ws.opf.manifest) {
      if (item.properties?.includes('cover-image')) {
        ws = await workspaceService.updateManifestItem(ws, item.id, {
          properties: item.properties.filter(p => p !== 'cover-image'),
        });
      }
    }
    // Write + add the SVG (plain image), then the PNG (cover-image). Omit `id`
    // so addManifestItem auto-resolves a unique manifest id.
    await fileStorage.writeTextFile(ws.id, `${base}/${svgHref}`, svg);
    ws = await workspaceService.addManifestItem(ws, {
      href: svgHref,
      mediaType: 'image/svg+xml',
    });
    await fileStorage.writeFile(ws.id, `${base}/${pngHref}`, pngBuffer);
    ws = await workspaceService.addManifestItem(ws, {
      href: pngHref,
      mediaType: 'image/png',
      properties: ['cover-image'],
    });
    appState.workspace = ws;
  };

  // Install a catalog extension into a project (the orchestration mirrored from
  // SettingsView): copy files, load libs, then adopt its text transform / append
  // its DOM transforms, and register any EPUB assets. Used by the create flow.
  async function installCatalogExtension(
    workspaceId: string,
    entry: ExtensionCatalogEntry
  ): Promise<void> {
    if (!transformEngine || !extensionManager || !appState) return;

    const assets = await extensionManager.importCatalogExtension(workspaceId, entry);
    await transformEngine.setWorkspaceExtensions(workspaceId);

    const settingsService = appState.getSettingsService();
    const epub = await settingsService.loadEPUBSettings(workspaceId);
    let next = epub;
    for (const file of entry.domTransforms) {
      next = {
        ...next,
        dom_transforms: addTransform(next.dom_transforms, `SOURCE/extensions/${entry.id}/${file}`),
      };
    }
    if (entry.textTransforms.length > 0) {
      next = {
        ...next,
        text_transform: `SOURCE/extensions/${entry.id}/${entry.textTransforms[0]}`,
      };
    }
    if (next !== epub) {
      await settingsService.saveEPUBSettings(workspaceId, next);
      await appState.loadEPUBSettings(workspaceId);
    }

    // Register any EPUB assets (e.g. a CSS theme) after settings, so a regenerate
    // uses the adopted transform. Text formats rarely carry assets.
    if (assets.length > 0) {
      await handleExtensionAssets(assets);
    }
  }

  // Handle EPUB package request
  // PDF export is an HTTP-only feature (the vendored Paged.js polyfill is fetched
  // from the app origin; file:// can't load it), mirroring the axe-core a11y check.
  const canGeneratePdf = typeof location !== 'undefined' && location.protocol !== 'file:';
  let pdfGenerating = $state(false);

  // Build a paginated PDF from the chapters and open the browser's Save-as-PDF
  // dialog. Read-only safe (it only reads chapters), so it works on imported EPUBs.
  const handleGeneratePdf = async () => {
    if (!currentWorkspaceState || pdfGenerating) return;
    pdfGenerating = true;
    try {
      await exportPdf(
        currentWorkspaceState,
        fileStorage,
        workspaceService,
        appState?.epubSettings?.print
      );
    } catch (error) {
      console.error('PDF export failed:', error);
      if (appState) {
        appState.errorMessage = `PDF export failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    } finally {
      pdfGenerating = false;
    }
  };

  const handlePackageRequest = async (workspaceId: string) => {
    if (!currentWorkspaceState || isReadOnly) return;

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
        // Write a publish sidecar (metadata JSON + cover thumbnail) next to the
        // packaged epub so the publish plugin can build rich OPDS entries.
        // Best-effort: never let a sidecar failure break packaging.
        try {
          const cover = (await workspaceService.getWorkspaceRowDetails(workspaceId)).coverImageData;
          await writePublishSidecar(fileStorage, cover, navWorkspace.opf.metadata, result.filename);
        } catch (sidecarError) {
          console.warn('Failed to write publish sidecar:', sidecarError);
        }

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
    <h2>{$t('Transform Engine Failed')}</h2>
    <p>{transformEngineError}</p>
    <p>{$t('Please refresh the page to try again.')}</p>
  </div>
{:else if !transformEngineReady}
  <div class="loading-state">
    <div class="spinner"></div>
    <p>{$t('Initializing transform engine...')}</p>
  </div>
{:else if !appState}
  <div class="loading-state">
    <div class="spinner"></div>
    <p>{$t('Initializing application...')}</p>
  </div>
{:else}
  <LayoutManager
    hasWorkspace={!!currentWorkspaceId}
    readOnly={isReadOnly}
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
          readOnly={isReadOnly}
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
            disabled={isReadOnly}
            title={isReadOnly
              ? $t("This EPUB wasn't created in the Simple EPUB Editor, so it can't be repackaged.")
              : $t('Package EPUB')}
          >
            <Package size={18} aria-hidden="true" />
            <span class="package-label">{$t('EPUB')}</span>
          </button>
          {#if canGeneratePdf}
            <button
              class="package-epub-button pdf-button"
              onclick={handleGeneratePdf}
              disabled={pdfGenerating}
              title={$t('Save the book as a PDF')}
            >
              <FilePdf size={18} aria-hidden="true" />
              <span class="package-label">{pdfGenerating ? $t('Preparing…') : $t('PDF')}</span>
            </button>
          {/if}
        </div>
      {/if}
    {/snippet}

    {#snippet leftContent()}
      <h1 class="sr-only">{viewTitle}</h1>
      {#if isReadOnly && currentView !== 'workspace' && currentView !== 'about'}
        <div class="readonly-banner" role="status">
          {$t(
            "Read-only — this EPUB wasn't created in the Simple EPUB Editor, so it can't be edited."
          )}
        </div>
      {/if}
      <!-- Main content area - switches based on current view -->
      {#if currentView === 'about'}
        <AboutView onCreateEpub={openCreateDialog} />
      {:else if currentView === 'workspace' && initialized}
        <WorkspaceView
          onListWorkspaces={() => appState?.listWorkspaces() ?? Promise.resolve([])}
          onCreateNewRequested={openCreateDialog}
          onDeleteWorkspace={id => appState?.deleteWorkspace(id) ?? Promise.resolve()}
          onDuplicateWorkspace={(id, title) =>
            appState?.duplicateWorkspace(id, title) ?? Promise.resolve('')}
          onLoadWorkspace={id => appState?.loadWorkspace(id) ?? Promise.resolve()}
          onLoadWorkspaceDetails={id =>
            appState?.getWorkspaceRowDetails(id) ??
            Promise.resolve({ fileCount: 0, readOnly: false })}
          onEpubImportRequested={handleEpubImport}
          {currentWorkspaceId}
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
            readOnly={isReadOnly}
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
            readOnly={isReadOnly}
            refreshToken={manifestRefreshToken}
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
            readOnly={isReadOnly}
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
            readOnly={isReadOnly}
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
          activeIdentifier={currentWorkspaceState?.opf?.metadata?.identifier}
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
          readOnly={isReadOnly}
          onExtensionAssets={handleExtensionAssets}
          onTogglePlugin={(id, enabled) => {
            appState?.getSettingsService().setPluginEnabled(id, enabled);
            enabledPluginIds = appState?.getSettingsService().getEnabledPlugins() ?? [];
          }}
          onSettingsChanged={() => {
            // Reload workspace + EPUB settings in AppState after they're changed in
            // SettingsView, so the print preview and PDF export see new print settings.
            if (appState?.currentWorkspaceId) {
              appState.loadWorkspaceSettings(appState.currentWorkspaceId);
              appState.loadEPUBSettings(appState.currentWorkspaceId);
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
          readOnly={isReadOnly}
          {workspaceService}
          onGenerateCover={handleGenerateCover}
        />
      {:else if currentView === 'manifest' && initialized && currentWorkspaceState}
        <ManifestPreview
          selectedItem={selectedManifestItem}
          selectedItemType={selectedManifestItemType}
          workspace={currentWorkspaceState}
          {workspaceService}
          readOnly={isReadOnly}
          onItemDelete={handleManifestItemDelete}
          onSourceDelete={handleSourceFileDelete}
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
            printSettings={appState?.epubSettings?.print}
            projectIdentifier={currentWorkspaceState?.opf?.metadata?.identifier}
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

  {#if showCreateDialog}
    <CreateProjectDialog
      {textFormats}
      defaultLanguage={$currentLocale}
      onCreate={async data => {
        await handleCreateProject(data);
        showCreateDialog = false;
      }}
      onClose={() => (showCreateDialog = false)}
    />
  {/if}
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

  /* Read-only EPUB notice shown above the view content. */
  .readonly-banner {
    position: sticky;
    top: 0;
    z-index: 5;
    padding: var(--space-2) var(--space-4);
    background-color: var(--color-warning-surface, var(--color-bg-tertiary));
    color: var(--color-warning, var(--color-text-primary));
    border-bottom: 1px solid var(--color-warning, var(--color-border-default));
    font-size: var(--text-sm);
    text-align: center;
  }

  /* Package EPUB button styling */
  .package-epub-section {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3);
    border-top: 1px solid var(--color-border-default);
  }

  .package-epub-button {
    flex: 1;
    min-width: 0;
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

  /* PDF is the secondary action next to the primary "Package EPUB" CTA. */
  .pdf-button,
  :global([data-theme='dark']) .pdf-button {
    background-color: transparent;
    border-color: var(--color-border-default);
    color: var(--color-text-secondary);
  }

  .pdf-button:hover:not(:disabled),
  :global([data-theme='dark']) .pdf-button:hover:not(:disabled) {
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-hover);
    color: var(--color-text-primary);
  }

  /* Collapsed sidebar is too narrow for two side-by-side buttons — stack them. */
  :global(.sidebar.collapsed) .package-epub-section {
    flex-direction: column;
  }
</style>
