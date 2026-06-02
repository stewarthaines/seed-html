<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import OutlineEditor from './OutlineEditor.svelte';
  import { createTextEditorStore } from '../../stores/index.js';
  import type { TextEditorStore } from '../../stores/index.js';
  import type {
    WorkspaceService,
    WorkspaceState,
  } from '../../services/workspace/workspace.service.js';
  import type { SpineService } from '../../services/spine/spine.service.js';
  import { OutlineGenerator } from '../../outline/outline-generator.js';
  import { TransformEngine } from '$lib/infrastructure/transform-engine';
  import { SpineTransformPipeline } from '$lib/transform/spine-transform-pipeline';
  import type { FileStorageAPI } from '$lib/storage';
  import type { BlobURLManager } from '$lib/blob-url';
  import type { ExtensionManager } from '$lib/extensions';
  import type { SettingsService } from '$lib/services/settings/settings.service';

  // Props interface using clean service architecture
  interface Props {
    workspace: WorkspaceState;
    workspaceService: WorkspaceService;
    spineService: SpineService;
    transformEngine: TransformEngine;
    fileStorage: FileStorageAPI;
    blobURLManager: BlobURLManager;
    extensionManager: ExtensionManager;
    settingsService: SettingsService;
    previewUpdate?: any;
    error?: any;
    destroyed?: any;
    ready?: any;
  }
  let {
    workspace,
    workspaceService,
    spineService,
    transformEngine,
    previewUpdate,
    error,
    fileStorage,
    extensionManager,
    blobURLManager,
    settingsService,
  }: Props = $props();

  // Create internal store for this outline editor instance with unique ID
  // Each component instance needs a unique ID to avoid conflicts in Storybook
  const editorId = `outline-nav-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const outlineStore: TextEditorStore = createTextEditorStore(editorId);

  const transformPipeline = new SpineTransformPipeline(
    workspace.id,
    fileStorage,
    extensionManager,
    blobURLManager,
    transformEngine,
    settingsService
  );

  // Component initialization state
  let isComponentReady = false;
  let initializationPromise: Promise<void> | null = null;

  // React to store changes for transform processing
  $effect(() => {
    if ($outlineStore.lastUpdated) {
      handleContentChange($outlineStore.isEmpty);
    }
  });

  async function handleContentChange(isEmpty: boolean) {
    try {
      if (isEmpty) {
        // Auto-generation mode: generate from spine items
        await generateFromSpine();
      } else {
        // Manual editing mode: process user content
        await processUserContent();
      }
    } catch (e) {
      error({
        message: e instanceof Error ? e.message : 'Unknown error occurred',
        stage: isEmpty ? 'generation' : 'transform',
      });
    }
  }

  async function generateFromSpine() {
    try {
      // Load spine items for the workspace
      const spineItems = await spineService.loadSpineItems(workspace);

      // Generate navigation from spine items (simplified - just use existing XHTML files)
      const navigationDoc = await OutlineGenerator.generateFromSpine(
        spineItems,
        workspaceService,
        workspace.id,
        workspace.pathInfo
      );

      previewUpdate({ xhtml: navigationDoc.xhtmlContent });

      const navPath = `${workspace.pathInfo.basePath}/nav.xhtml`;
      await workspaceService.writeFile(workspace.id, navPath, navigationDoc.xhtmlContent);
      const navSourcePath = 'SOURCE/text/nav.txt';
      await workspaceService.writeFile(workspace.id, navSourcePath, '');
    } catch (e) {
      console.error('Failed to generate navigation from spine:', e);
      // error({
      //   message: e instanceof Error ? e.message : 'Failed to generate navigation',
      //   stage: 'generation',
      // });
    }
  }

  async function processUserContent() {
    const content = outlineStore.getContent();

    // Skip manual editing if transformEngine is not available
    if (!transformPipeline) {
      console.warn('TransformPipeline not available - falling back to auto-generation');
      await generateFromSpine();
      return;
    }

    try {
      // Process user content through transform pipeline
      const navigationDoc = await OutlineGenerator.processUserContent(
        content,
        transformPipeline,
        workspace.id
      );

      previewUpdate({
        xhtml: navigationDoc.xhtmlContent,
        warnings: [], // Transform pipeline may add warnings in future
      });

      // store nav.txt source
      const navSourcePath = 'SOURCE/text/nav.txt';
      await workspaceService.writeFile(workspace.id, navSourcePath, content);

      const navPath = `${workspace.pathInfo.basePath}/nav.xhtml`;
      try {
        await workspaceService.removeManifestItem(workspace, navPath);
      } catch {
        // No existing nav item to remove — fine.
      }
      await workspaceService.writeFile(workspace.id, navPath, navigationDoc.xhtmlContent);
      try {
        await workspaceService.addManifestItem(workspace, {
          href: 'nav.xhtml',
          id: 'nav',
          properties: ['nav'],
        });
      } catch {
        // Nav item already present in the manifest — fine.
      }
    } catch (e) {
      console.error('Failed to process user content:', e);
    }
  }

  // Public API methods matching specification
  export async function loadNavigationContent(): Promise<void> {
    await waitForReady();
    try {
      // Try to load existing nav.txt from SOURCE/text/
      const navPath = 'SOURCE/text/nav.txt';
      const hasNavFile = await workspaceService.fileExists(workspace.id, navPath);

      if (hasNavFile) {
        const navBuffer = await workspaceService.readFile(workspace.id, navPath);
        const navContent = new TextDecoder().decode(navBuffer);
        outlineStore.updateContent(navContent);
      } else {
        // Start with empty content (triggers auto-generation)
        outlineStore.updateContent('');
      }
    } catch (e) {
      console.error('Failed to load navigation content:', e);
      // error({
      //   message: e instanceof Error ? e.message : 'Failed to load navigation content',
      //   stage: 'generation',
      // });
    }
  }

  export async function saveNavigationContent(): Promise<void> {
    await waitForReady();
    try {
      const content = outlineStore.getContent();

      // Save nav.txt source file
      const navSourcePath = 'SOURCE/text/nav.txt';
      await workspaceService.writeFile(workspace.id, navSourcePath, content);

      // Generate and save nav.xhtml
      let navigationDoc;
      if (content.trim() === '') {
        // Auto-generation mode
        const spineItems = await spineService.loadSpineItems(workspace);
        navigationDoc = await OutlineGenerator.generateFromSpine(
          spineItems,
          workspaceService,
          workspace.id,
          workspace.pathInfo
        );
      } else if (transformPipeline) {
        // User content mode (only if transformPipeline is available)
        navigationDoc = await OutlineGenerator.processUserContent(
          content,
          transformPipeline,
          workspace.id
        );
      } else {
        // Fallback to auto-generation if transformEngine not available
        console.warn(
          'TransformPipeline not available - using auto-generation instead of user content'
        );
        const spineItems = await spineService.loadSpineItems(workspace);
        navigationDoc = await OutlineGenerator.generateFromSpine(
          spineItems,
          workspaceService,
          workspace.id,
          workspace.pathInfo
        );
      }

      // Save nav.xhtml to OEBPS
      const navXHTMLPath = 'OEBPS/nav.xhtml';
      await workspaceService.writeFile(workspace.id, navXHTMLPath, navigationDoc.xhtmlContent);

      // Update OPF manifest with navigation metadata
      const navItem = workspace.opf.manifest.find(
        item => item.id === 'nav' || item.properties?.includes('nav')
      );

      if (!navItem) {
        // Add nav to manifest
        workspace = await workspaceService.addManifestItem(workspace, {
          id: 'nav',
          href: 'nav.xhtml',
          mediaType: 'application/xhtml+xml',
          properties: ['nav'],
        });
      } else if (navItem.href !== 'nav.xhtml') {
        // Update existing nav item to correct location
        workspace = await workspaceService.updateManifestItem(workspace, navItem.id, {
          href: 'nav.xhtml',
          mediaType: 'application/xhtml+xml',
          properties: ['nav'],
        });
      }
    } catch (e) {
      console.error('Failed to save navigation content:', e);
      // error({
      //   message: e instanceof Error ? e.message : 'Failed to save navigation content',
      //   stage: 'save',
      // });
    }
  }

  function handleEditorContentChanged(_detail: {
    editorId: string;
    timestamp: number;
    isEmpty: boolean;
  }) {
    // The reactive statement above handles the actual processing
    // This just receives the lightweight event from OutlineEditor
  }

  // References for screen reader announcements
  let politeAnnouncement: HTMLElement;
  let assertiveAnnouncement: HTMLElement;

  // Keyboard navigation support with Promise-based coordination
  async function handleKeyboardSave(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();

      try {
        await saveNavigationContent();

        // Announce success to screen readers
        if (politeAnnouncement) {
          politeAnnouncement.textContent = 'Navigation saved successfully';

          // Clear announcement after delay for better UX
          setTimeout(() => {
            politeAnnouncement.textContent = '';
          }, 3000);
        }
      } catch (error) {
        // Error is already dispatched by saveNavigationContent
        // Announce error to screen readers
        if (assertiveAnnouncement) {
          assertiveAnnouncement.textContent = `Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`;

          // Clear announcement after delay
          setTimeout(() => {
            assertiveAnnouncement.textContent = '';
          }, 5000);
        }
      }
    }
  }

  // Component lifecycle management
  onMount(async () => {
    if (!initializationPromise) {
      initializationPromise = initializeComponent();
    }
    await initializationPromise;
  });

  onDestroy(() => {
    isComponentReady = false;
    initializationPromise = null;

    // Clean up the text editor store
    outlineStore.destroy();

    // destroyed({ timestamp: Date.now() });
  });

  async function initializeComponent(): Promise<void> {
    try {
      // Mark component as ready
      isComponentReady = true;

      // Dispatch ready event
      // ready({ timestamp: Date.now() });

      // Load navigation content (triggers auto-generation if no nav.txt exists)
      await loadNavigationContent();

      // Don't save during initialization - reactive statement handles auto-generation
      // User can save manually when needed (Ctrl+Enter or save button)
    } catch (e) {
      console.error('Failed to initialize OutlineView:', e);
      // error({
      //   message: e instanceof Error ? e.message : 'Failed to initialize component',
      //   stage: 'generation',
      // });
    }
  }

  // Public method to check if component is ready
  export function isReady(): boolean {
    return isComponentReady;
  }

  // Public method to wait for component readiness
  export async function waitForReady(): Promise<void> {
    if (isComponentReady) return;
    if (initializationPromise) {
      await initializationPromise;
      return;
    }
    throw new Error('Component not mounted');
  }
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="outline-view"
  role="group"
  aria-label="Navigation editor"
  onkeydown={handleKeyboardSave}
>
  <!-- Screen reader announcements -->
  <div bind:this={politeAnnouncement} aria-live="polite" aria-atomic="true" class="sr-only"></div>
  <div
    bind:this={assertiveAnnouncement}
    aria-live="assertive"
    aria-atomic="true"
    class="sr-only"
  ></div>

  <OutlineEditor
    editorStore={outlineStore}
    placeholder="Navigation content will be auto-generated from your chapters..."
    onContentChanged={handleEditorContentChanged}
  />
</div>

<style>
  .outline-view {
    height: 100%;
    width: 100%;
  }

  /* Screen reader only content */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
