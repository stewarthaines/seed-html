<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { t } from '../../i18n';
  import OutlineEditor from './OutlineEditor.svelte';
  import PaneHeader from '$lib/components/layout/PaneHeader.svelte';
  import { createTextEditorStore } from '../../stores/index.js';
  import type { TextEditorStore } from '../../stores/index.js';
  import type {
    WorkspaceService,
    WorkspaceState,
  } from '../../services/workspace/workspace.service.js';
  import type { SpineService } from '../../services/spine/spine.service.js';
  import { OutlineGenerator } from '../../outline/outline-generator.js';
  import { primaryLanguage } from '../../epub/opf-utils.js';
  import { ensureGeneratedNav } from '../../outline/nav-coherence.js';
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
    /** Read-only EPUB: preview the existing nav.xhtml; never regenerate or save. */
    readOnly?: boolean;
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
    readOnly = false,
  }: Props = $props();

  // Create internal store for this outline editor instance with unique ID
  // Each component instance needs a unique ID to avoid conflicts in Storybook
  const editorId = `outline-nav-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const outlineStore: TextEditorStore = createTextEditorStore(editorId);

  const transformPipeline = untrack(
    () =>
      new SpineTransformPipeline(
        workspace.id,
        fileStorage,
        extensionManager,
        blobURLManager,
        transformEngine,
        settingsService
      )
  );

  // The book's primary language — stamped onto the generated nav.xhtml (an XHTML
  // content document) as xml:lang/lang, plus dir="rtl" for RTL languages.
  const bookLanguage = $derived(primaryLanguage(workspace?.opf?.metadata));

  // Component initialization state
  let isComponentReady = false;
  let initializationPromise: Promise<void> | null = null;
  // Gates the reactive handler below: stays false until the saved nav.txt has been
  // loaded, so the *initial empty* store doesn't trigger generateFromSpine() — which
  // writes nav.txt='' and would clobber saved custom navigation on every re-mount.
  let contentLoaded = $state(false);

  // React to store changes for transform processing (only once content is loaded).
  $effect(() => {
    if (contentLoaded && $outlineStore.lastUpdated) {
      handleContentChange($outlineStore.isEmpty);
    }
  });

  async function handleContentChange(isEmpty: boolean) {
    // A read-only EPUB must never regenerate/overwrite its nav.
    if (readOnly) return;
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
      // Mark auto mode (empty nav.txt), then regenerate + register via the
      // shared helper so the in-view nav matches what packaging produces.
      const navSourcePath = 'SOURCE/text/nav.txt';
      await workspaceService.writeFile(workspace.id, navSourcePath, '');

      const result = await ensureGeneratedNav(workspace, spineService, workspaceService);
      workspace = result.workspace;

      if (result.xhtml !== null) {
        previewUpdate({ xhtml: result.xhtml });
      }
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
      // Supply the same brokered file-access context the chapter editor uses (manifest
      // + base path) so nav transforms can use `ctx`. Build it from a freshly loaded
      // workspace (plain objects), exactly like spine-preview-manager — the reactive
      // `workspace` prop's manifest is a Svelte proxy that can't be structured-cloned
      // to the transform iframe (DataCloneError).
      let brokerContext;
      try {
        const ws = await workspaceService.loadWorkspace(workspace.id);
        brokerContext = { basePath: ws.pathInfo.basePath, manifest: ws.opf.manifest };
      } catch {
        brokerContext = undefined;
      }
      const navigationDoc = await OutlineGenerator.processUserContent(
        content,
        transformPipeline,
        workspace.id,
        { brokerContext, language: bookLanguage }
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
    if (readOnly) return;
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
          workspace.pathInfo,
          bookLanguage
        );
      } else if (transformPipeline) {
        // User content mode (only if transformPipeline is available)
        navigationDoc = await OutlineGenerator.processUserContent(
          content,
          transformPipeline,
          workspace.id,
          { language: bookLanguage }
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
          workspace.pathInfo,
          bookLanguage
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

      if (readOnly) {
        // Read-only EPUB: preview the existing nav, never auto-generate or save.
        await previewExistingNav();
      } else {
        // Ensure the transform iframe has this project's extension libs (e.g. djot)
        // loaded before any nav transform runs — the nav editor uses the same pipeline
        // as chapters but isn't guaranteed the spine view ran first (else "djot is not
        // defined" when Navigation is opened first after a reload).
        try {
          await transformEngine.setWorkspaceExtensions(workspace.id);
        } catch (e) {
          console.warn('Failed to load extensions for navigation transform:', e);
        }
        // Load the saved nav source, THEN open the reactive gate so the first render
        // reflects the loaded content (custom → transform; empty → auto-generate).
        await loadNavigationContent();
        contentLoaded = true;
      }

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

  // Read-only EPUB: show the existing nav.xhtml in the preview without
  // regenerating it or writing anything.
  async function previewExistingNav(): Promise<void> {
    try {
      const navItem =
        workspace.opf.manifest.find(m => m.properties?.includes('nav')) ??
        workspace.opf.manifest.find(m => m.href.endsWith('nav.xhtml'));
      if (!navItem) return;

      const basePath = workspace.pathInfo.basePath;
      const path =
        !basePath || navItem.href.startsWith(basePath + '/')
          ? navItem.href
          : `${basePath}/${navItem.href}`;

      const buffer = await workspaceService.readFile(workspace.id, path);
      let xhtml = new TextDecoder().decode(buffer);
      try {
        // Resolve refs against this EPUB's actual OPF directory (not the default "OEBPS/").
        blobURLManager.setBasePath(basePath);
        blobURLManager.setActiveWorkspace(workspace.id);
        xhtml = await blobURLManager.processXHTMLForPreview(xhtml);
      } catch {
        // Asset rewriting failed — fall back to the raw nav markup.
      }
      previewUpdate?.({ xhtml });
    } catch (e) {
      console.error('Failed to preview existing navigation:', e);
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

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="outline-view"
  role="group"
  aria-label={$t('Navigation editor')}
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

  <!-- File picker, mirroring the spine editor — surfaces the editable nav source and
       encourages custom navigation content. One entry for now. -->
  <PaneHeader>
    <select class="file-selector" aria-label={$t('Select navigation file')} disabled={readOnly}>
      <option value="nav">{$t('Navigation Content')}</option>
    </select>
  </PaneHeader>

  <div class="outline-body">
    {#if readOnly}
      <div class="readonly-notice">
        <div class="readonly-icon" aria-hidden="true">🔒</div>
        <h3>{$t('Read-only navigation')}</h3>
        <p>
          {$t(
            "This EPUB wasn't created in the Simple EPUB Editor — its navigation is shown for viewing only."
          )}
        </p>
      </div>
    {:else}
      <OutlineEditor
        editorStore={outlineStore}
        placeholder={$t('Navigation content will be auto-generated from your chapters...')}
        onContentChanged={handleEditorContentChanged}
      />
    {/if}
  </div>
</div>

<style>
  .outline-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }

  .outline-body {
    flex: 1;
    min-height: 0;
  }

  /* Matches the spine editor's file picker. */
  .file-selector {
    flex: 1 1 7rem;
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .readonly-notice {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: var(--space-8);
    color: var(--color-text-primary);
  }

  .readonly-icon {
    font-size: 2.5rem;
    opacity: 0.6;
    margin-bottom: var(--space-4);
  }

  .readonly-notice h3 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
  }

  .readonly-notice p {
    margin: 0;
    max-width: 28rem;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
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
