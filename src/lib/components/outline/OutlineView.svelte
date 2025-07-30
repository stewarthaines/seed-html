<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import OutlineEditor from './OutlineEditor.svelte';
  import { createTextEditorStore } from '../../stores/index.js';
  import type { TextEditorStore } from '../../stores/index.js';
  import type { WorkspaceService, WorkspaceState } from '../../services/workspace/workspace.service.js';
  import type { SpineService } from '../../services/spine/spine.service.js';
  import type { TransformPipeline } from '../../transform/transform-pipeline.js';
  import { OutlineGenerator } from '../../outline/outline-generator.js';

  // Props interface using clean service architecture
  export let workspace: WorkspaceState;
  export let workspaceService: WorkspaceService;
  export let spineService: SpineService;
  export let transformPipeline: TransformPipeline;

  // Event dispatcher with typed events
  const dispatch = createEventDispatcher<{
    previewUpdate: {
      xhtml: string;
      warnings?: string[];
    };
    error: {
      message: string;
      stage: 'generation' | 'transform' | 'save';
    };
    ready: {
      timestamp: number;
    };
    destroyed: {
      timestamp: number;
    };
  }>();

  // Create internal store for this outline editor instance with unique ID
  // Each component instance needs a unique ID to avoid conflicts in Storybook
  const editorId = `outline-nav-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const outlineStore: TextEditorStore = createTextEditorStore(editorId);

  // Component initialization state
  let isComponentReady = false;
  let initializationPromise: Promise<void> | null = null;

  // React to store changes for transform processing
  $: if ($outlineStore.lastUpdated) {
    handleContentChange($outlineStore.isEmpty);
  }

  async function handleContentChange(isEmpty: boolean) {
    try {
      if (isEmpty) {
        // Auto-generation mode: generate from spine items
        await generateFromSpine();
      } else {
        // Manual editing mode: process user content
        await processUserContent();
      }
    } catch (error) {
      dispatch('error', {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        stage: isEmpty ? 'generation' : 'transform'
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
      
      dispatch('previewUpdate', { xhtml: navigationDoc.xhtmlContent });
    } catch (error) {
      console.error('Failed to generate navigation from spine:', error);
      dispatch('error', {
        message: error instanceof Error ? error.message : 'Failed to generate navigation',
        stage: 'generation'
      });
    }
  }

  async function processUserContent() {
    const content = outlineStore.getContent();
    
    try {
      // Process user content through transform pipeline
      const navigationDoc = await OutlineGenerator.processUserContent(
        content,
        transformPipeline,
        workspace.id
      );
      
      dispatch('previewUpdate', { 
        xhtml: navigationDoc.xhtmlContent,
        warnings: [] // Transform pipeline may add warnings in future
      });
    } catch (error) {
      console.error('Failed to process user content:', error);
      dispatch('error', {
        message: error instanceof Error ? error.message : 'Failed to process navigation content',
        stage: 'transform'
      });
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
    } catch (error) {
      console.error('Failed to load navigation content:', error);
      dispatch('error', {
        message: error instanceof Error ? error.message : 'Failed to load navigation content',
        stage: 'generation'
      });
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
      } else {
        // User content mode
        navigationDoc = await OutlineGenerator.processUserContent(
          content,
          transformPipeline,
          workspace.id
        );
      }
      
      // Save nav.xhtml to OEBPS
      const navXHTMLPath = 'OEBPS/nav.xhtml';
      await workspaceService.writeFile(workspace.id, navXHTMLPath, navigationDoc.xhtmlContent);
      
      // TODO: Update OPF manifest with navigation metadata
      // This would require OPF manager integration
      
    } catch (error) {
      console.error('Failed to save navigation content:', error);
      dispatch('error', {
        message: error instanceof Error ? error.message : 'Failed to save navigation content',
        stage: 'save'
      });
    }
  }

  function handleEditorContentChanged(event: CustomEvent) {
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
    
    dispatch('destroyed', { timestamp: Date.now() });
  });

  async function initializeComponent(): Promise<void> {
    try {
      // Mark component as ready
      isComponentReady = true;
      
      // Dispatch ready event
      dispatch('ready', { timestamp: Date.now() });
      
      // Load navigation content (triggers auto-generation if no nav.txt exists)
      await loadNavigationContent();
    } catch (error) {
      console.error('Failed to initialize OutlineView:', error);
      dispatch('error', {
        message: error instanceof Error ? error.message : 'Failed to initialize component',
        stage: 'generation'
      });
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
<div class="outline-view" role="group" aria-label="Navigation editor" on:keydown={handleKeyboardSave}>
  <!-- Screen reader announcements -->
  <div bind:this={politeAnnouncement} aria-live="polite" aria-atomic="true" class="sr-only"></div>
  <div bind:this={assertiveAnnouncement} aria-live="assertive" aria-atomic="true" class="sr-only"></div>
  
  <OutlineEditor 
    editorStore={outlineStore}
    placeholder="Navigation content will be auto-generated from your chapters..."
    on:contentChanged={handleEditorContentChanged}
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