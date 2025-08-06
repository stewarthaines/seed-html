# Pragmatic Spine Item Editor Architecture

## Overview

This architecture provides a simple, spike-inspired approach to spine item editing with real-time XHTML preview. The system supports editing multiple file types (text content, CSS, JavaScript, transform scripts) with immediate visual feedback in a persistent iframe. The design prioritizes simplicity and developer experience over theoretical scalability.

**Core Principle**: Text content → Transform Text → Transform DOM → Auto-save Assets → Save XHTML to Manifest → Blob URL Processing → XHTML preview, with all edits feeding into a unified real-time preview and generating the actual spine item content.

**Single-File Build Constraint**: Since EDITME.html runs as a single file in the browser, workspace assets (CSS, JavaScript, images) are stored in OPFS/IndexedDB and cannot be accessed via normal file paths by the preview iframe. The BlobURLManager converts these file references to blob URLs that the iframe can access.

## Editor Layout

### Basic Mode: Single Editor Pane
- **Single editor pane** with dropdown to select file type:
  - Text content (SOURCE/text/chapter1.txt)
  - CSS stylesheets (OEBPS/Styles/*.css)
  - JavaScript files (OEBPS/Scripts/*.js)
  - Transform scripts (SOURCE/scripts/*.js)
- **Unified preview pane** showing final XHTML with all changes applied
- **Real-time updates** with 300ms debounce for all file types

### Enhanced Mode: Dual Editor Panes
- **Toggle button** in pane header to switch between 1 or 2 editors
- **Two stacked editor panes**, each with own file dropdown
- **Common use cases**:
  - Edit text content + CSS simultaneously
  - Edit text content + transform script simultaneously
  - Edit CSS + JavaScript simultaneously
- **Single preview pane** that reflects changes from both editors

## File Structure

### Source Code Locations

```
src/lib/
├── components/
│   └── spine-editor/
│       ├── SpineItemEditor.svelte           # Main editor component
│       ├── EditorPane.svelte                # Individual editor pane
│       └── PreviewPane.svelte               # XHTML preview pane
├── services/
│   ├── content/
│   │   └── content.service.ts               # File operations
│   └── workspace/
│       └── workspace.service.ts             # Workspace integration
├── transform/
│   ├── transform-pipeline.ts               # Simple transform execution
│   └── preview-manager.ts                  # Real-time preview coordination
└── extensions/
    └── extension-manager.ts                 # JavaScript extension loading
```

## Core Architecture

### 1. Simple Transform Pipeline

```typescript
export class TransformPipeline {
  private iframe: HTMLIFrameElement;
  private extensions = new Map<string, string>(); // extension path -> blob URL
  
  constructor(
    private workspaceId: string,
    private fileStorage: FileStorageAPI,
    private extensionManager: ExtensionManager
  ) {
    this.createPersistentIframe();
  }

  // Execute the transform pipeline: text → transform text → transform DOM
  async executeTransform(plainText: string): Promise<TransformResult> {
    const transformScripts = await this.loadTransformScripts();
    
    const result = await this.sendToIframe({
      type: 'EXECUTE_TRANSFORM',
      payload: {
        plainText,
        textTransform: transformScripts.textTransform,
        domTransforms: transformScripts.domTransforms
      }
    });
    
    return result;
  }

  // Load transform scripts from workspace
  private async loadTransformScripts(): Promise<TransformScripts> {
    const settings = await this.loadSettings();
    const scripts: TransformScripts = {};
    
    // Load text transform script (0 or 1)
    if (settings.transform_pipeline?.text_transform) {
      scripts.textTransform = await this.fileStorage.readTextFile(
        this.workspaceId,
        `SOURCE/scripts/${settings.transform_pipeline.text_transform}`
      );
    }
    
    // Load DOM transform scripts (0 or many, in sequence)
    if (settings.transform_pipeline?.dom_transforms) {
      scripts.domTransforms = [];
      for (const scriptName of settings.transform_pipeline.dom_transforms) {
        const scriptContent = await this.fileStorage.readTextFile(
          this.workspaceId,
          `SOURCE/scripts/${scriptName}`
        );
        scripts.domTransforms.push(scriptContent);
      }
    }
    
    return scripts;
  }

  // Simple iframe communication (like the spike)
  private sendToIframe(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const messageId = crypto.randomUUID();
      const handler = (event: MessageEvent) => {
        if (event.data.messageId === messageId) {
          window.removeEventListener('message', handler);
          resolve(event.data.result);
        }
      };
      
      window.addEventListener('message', handler);
      this.iframe.contentWindow?.postMessage({ ...message, messageId }, '*');
      
      // Simple timeout
      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Transform timeout'));
      }, 3000);
    });
  }
}
```

### 2. Real-Time Preview Manager

```typescript
export class PreviewManager {
  private transformPipeline: TransformPipeline;
  private debounceTimer?: number;
  private currentContent = {
    text: '',
    css: '',
    javascript: '',
    metadata: {} as ChapterMetadata
  };

  constructor(
    private workspaceId: string,
    private spineItemId: string,
    private fileStorage: FileStorageAPI,
    private extensionManager: ExtensionManager,
    private blobURLManager: BlobURLManager,
    private workspaceService: WorkspaceService,
    private onPreviewUpdate: (xhtml: string) => void,
    private onError: (error: TransformError) => void
  ) {
    this.transformPipeline = new TransformPipeline(workspaceId, fileStorage, extensionManager);
    this.blobURLManager.setActiveWorkspace(workspaceId);
  }

  // Update content from editor (text, CSS, or JavaScript)
  updateContent(type: 'text' | 'css' | 'javascript', content: string): void {
    this.currentContent[type] = content;
    this.debounceRender();
  }

  // Debounced rendering (like the spike)
  private debounceRender(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.renderPreview();
    }, 300); // Same as spike
  }

  private async renderPreview(): Promise<void> {
    try {
      // Auto-save modified content to storage before preview
      await this.autoSaveChangedContent();

      // Execute transform pipeline
      const transformResult = await this.transformPipeline.executeTransform(
        this.currentContent.text
      );

      if (transformResult.success) {
        // Generate final XHTML document
        const xhtml = this.generateXHTML(
          transformResult.html,
          this.currentContent.css,
          this.currentContent.javascript,
          this.currentContent.metadata
        );
        
        // Save XHTML as spine item content to manifest
        await this.saveXHTMLToManifest(xhtml);
        
        // Process XHTML for blob URL substitution (preview only)
        const processedXHTML = await this.blobURLManager.processXHTMLForPreview(xhtml);
        
        this.onPreviewUpdate(processedXHTML);
      } else {
        this.onError(transformResult.error);
      }
    } catch (error) {
      this.onError(error);
    }
  }

  // Auto-save changed content to storage for blob URL processing
  private async autoSaveChangedContent(): Promise<void> {
    try {
      // Save CSS file if changed
      if (this.currentContent.css) {
        await this.fileStorage.writeTextFile(
          this.workspaceId,
          `OEBPS/Styles/${this.spineItemId}.css`,
          this.currentContent.css
        );
      }

      // Save JavaScript file if changed
      if (this.currentContent.javascript) {
        await this.fileStorage.writeTextFile(
          this.workspaceId,
          `OEBPS/Scripts/${this.spineItemId}.js`,
          this.currentContent.javascript
        );
      }

      // Save text content file if changed
      if (this.currentContent.text) {
        await this.fileStorage.writeTextFile(
          this.workspaceId,
          `SOURCE/text/${this.spineItemId}.txt`,
          this.currentContent.text
        );
      }
    } catch (error) {
      // Log auto-save errors but don't block preview generation
      console.warn('Auto-save failed:', error);
    }
  }

  // Save generated XHTML as spine item content to manifest
  private async saveXHTMLToManifest(xhtml: string): Promise<void> {
    try {
      // Save XHTML as the spine item's content in the EPUB structure
      const spineItemPath = `OEBPS/Text/${this.spineItemId}.xhtml`;
      await this.workspaceService.writeFile(
        this.workspaceId,
        spineItemPath,
        xhtml
      );
    } catch (error) {
      // Log manifest save errors but don't block preview
      console.warn('Failed to save XHTML to manifest:', error);
    }
  }

  // Generate complete XHTML document (like the spike)
  private generateXHTML(
    transformedContent: string, 
    css: string, 
    javascript: string, 
    metadata: ChapterMetadata
  ): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${metadata.language}" lang="${metadata.language}">
<head>
  <title>${this.escapeHtml(metadata.title)}</title>
  ${metadata.stylesheets.map(href => `<link rel="stylesheet" type="text/css" href="${href}" />`).join('\n  ')}
  ${css ? `<style>${css}</style>` : ''}
  ${javascript ? `<script>${javascript}</script>` : ''}
</head>
<body>
  ${transformedContent}
</body>
</html>`;
  }


  // Cleanup resources when editor is closed
  cleanup(): void {
    this.blobURLManager.cleanup();
    this.transformPipeline.cleanup?.();
  }
}
```
```

### 3. Spine Item Editor Component

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { ChapterMetadata } from '$lib/types';
  
  export let workspaceId: string;
  export let spineItemId: string;
  export let metadata: ChapterMetadata;
  export let fileStorage: FileStorageAPI;
  export let extensionManager: ExtensionManager;
  export let blobURLManager: BlobURLManager;
  export let workspaceService: WorkspaceService;

  // Editor state
  let editorMode: 'single' | 'dual' = 'single';
  let pane1File = 'text';
  let pane2File = 'css';
  let pane1Content = '';
  let pane2Content = '';
  let previewHtml = '';
  let errors: TransformError[] = [];

  // Available files for dropdowns
  $: availableFiles = [
    { value: 'text', label: 'Text Content', path: `SOURCE/text/${spineItemId}.txt` },
    { value: 'css', label: 'Stylesheet', path: `OEBPS/Styles/${spineItemId}.css` },
    { value: 'js', label: 'JavaScript', path: `OEBPS/Scripts/${spineItemId}.js` },
    { value: 'transform-text', label: 'Transform Text Script', path: 'SOURCE/scripts/transformText.js' },
    { value: 'transform-dom', label: 'Transform DOM Script', path: 'SOURCE/scripts/transformDom.js' }
  ];

  let previewManager: PreviewManager;

  onMount(async () => {
    // Initialize preview manager
    previewManager = new PreviewManager(
      workspaceId,
      spineItemId,
      fileStorage,
      extensionManager,
      blobURLManager,
      workspaceService,
      (xhtml) => { previewHtml = xhtml; errors = []; },
      (error) => { errors = [error]; }
    );

    // Load initial content
    await loadContent();
  });

  async function loadContent(): Promise<void> {
    try {
      const textContent = await fileStorage.readTextFile(workspaceId, `SOURCE/text/${spineItemId}.txt`);
      const cssContent = await fileStorage.readTextFile(workspaceId, `OEBPS/Styles/${spineItemId}.css`);
      const jsContent = await fileStorage.readTextFile(workspaceId, `OEBPS/Scripts/${spineItemId}.js`);
      
      pane1Content = textContent;
      pane2Content = cssContent;
      
      // Update preview manager
      previewManager.updateContent('text', textContent);
      previewManager.updateContent('css', cssContent);
      previewManager.updateContent('javascript', jsContent);
    } catch (error) {
      errors = [error];
    }
  }

  // Handle content changes
  function handleContentChange(paneIndex: 1 | 2, content: string): void {
    const fileType = paneIndex === 1 ? pane1File : pane2File;
    const contentType = getContentType(fileType);
    
    if (contentType) {
      previewManager.updateContent(contentType, content);
    }
    
    // Auto-save
    debounceAutoSave(paneIndex, content);
  }

  function getContentType(fileType: string): 'text' | 'css' | 'javascript' | null {
    if (fileType === 'text') return 'text';
    if (fileType === 'css') return 'css';
    if (fileType === 'js') return 'javascript';
    return null; // Transform scripts don't go through preview manager content
  }

  // Toggle between single and dual pane
  function togglePaneMode(): void {
    editorMode = editorMode === 'single' ? 'dual' : 'single';
  }

  onDestroy(() => {
    previewManager?.cleanup();
  });
</script>

<div class="spine-editor">
  <div class="editor-section" class:dual-pane={editorMode === 'dual'}>
    <!-- Pane Header -->
    <div class="pane-header">
      <button on:click={togglePaneMode} class="pane-toggle">
        {editorMode === 'single' ? '+ Add Pane' : '- Single Pane'}
      </button>
    </div>

    <!-- Editor Panes -->
    <div class="editor-panes">
      <!-- Pane 1 -->
      <div class="editor-pane">
        <div class="pane-controls">
          <select bind:value={pane1File} on:change={() => loadFileInPane(1)}>
            {#each availableFiles as file}
              <option value={file.value}>{file.label}</option>
            {/each}
          </select>
        </div>
        <textarea
          bind:value={pane1Content}
          on:input={e => handleContentChange(1, e.target.value)}
          class="code-editor"
          placeholder="Enter content..."
        ></textarea>
      </div>

      <!-- Pane 2 (dual mode only) -->
      {#if editorMode === 'dual'}
        <div class="editor-pane">
          <div class="pane-controls">
            <select bind:value={pane2File} on:change={() => loadFileInPane(2)}>
              {#each availableFiles as file}
                <option value={file.value}>{file.label}</option>
              {/each}
            </select>
          </div>
          <textarea
            bind:value={pane2Content}
            on:input={e => handleContentChange(2, e.target.value)}
            class="code-editor"
            placeholder="Enter content..."
          ></textarea>
        </div>
      {/if}
    </div>
  </div>

  <!-- Preview Section -->
  <div class="preview-section">
    <div class="preview-header">
      <h3>Preview</h3>
    </div>
    
    {#if errors.length > 0}
      <div class="error-panel">
        {#each errors as error}
          <div class="error-item">
            <strong>{error.stage} error:</strong> {error.message}
            {#if error.line}(line {error.line}){/if}
          </div>
        {/each}
      </div>
    {/if}
    
    <div class="preview-content">
      <iframe 
        srcdoc={previewHtml}
        title="Preview"
        class="preview-iframe"
      ></iframe>
    </div>
  </div>
</div>

<style>
  .spine-editor {
    display: flex;
    height: 100%;
    background: white;
  }

  .editor-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #dee2e6;
  }

  .editor-section.dual-pane .editor-panes {
    flex-direction: column;
  }

  .pane-header {
    padding: 10px 15px;
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
  }

  .pane-toggle {
    background: #007bff;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
  }

  .editor-panes {
    flex: 1;
    display: flex;
  }

  .editor-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #dee2e6;
  }

  .editor-pane:last-child {
    border-right: none;
  }

  .pane-controls {
    padding: 8px 12px;
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
  }

  .pane-controls select {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
  }

  .code-editor {
    flex: 1;
    padding: 15px;
    border: none;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 14px;
    line-height: 1.5;
    resize: none;
    outline: none;
  }

  .preview-section {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .preview-header {
    padding: 10px 15px;
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
  }

  .preview-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .error-panel {
    background: #f8d7da;
    border-bottom: 1px solid #f5c6cb;
    padding: 10px 15px;
    color: #721c24;
    font-size: 13px;
  }

  .error-item {
    margin-bottom: 5px;
  }

  .preview-content {
    flex: 1;
  }

  .preview-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>
```

## Key Design Principles

### 1. Simplicity Over Complexity
- **Direct approach**: No abstract interfaces or complex dependency injection
- **Minimal layers**: Transform pipeline → Preview manager → Editor component
- **Simple communication**: Basic iframe postMessage (like the spike)

### 2. Real-Time Feedback
- **300ms debounce** for all content changes (matching spike performance)
- **Immediate preview updates** for text, CSS, JavaScript, and transform script changes
- **Clear error display** when transforms fail (like spike error panel)

### 3. Unified Preview Model
- **Single XHTML output** that combines all file types
- **All edits feed into same preview** regardless of which pane they come from
- **Complete document preview** including CSS styles and JavaScript functionality

### 4. Progressive Enhancement
- **Start with single pane** for basic editing
- **Add dual pane** for advanced workflows
- **No mode complexity** - each pane simply shows a different file

## Transform Pipeline Integration

### Extension Loading
```typescript
// Extensions loaded via ExtensionManager
const extensions = await extensionManager.listWorkspaceExtensions(workspaceId);
for (const extension of extensions) {
  const blobURL = await blobURLManager.createBlobURL(extension.path);
  await loadExtensionInIframe(blobURL);
}
```

### Transform Execution (Simple, Like Spike)
```typescript
// Execute in iframe (same pattern as spike)
const result = executeTransform(plainText);

// Text transform
if (textTransformScript) {
  html = new Function('plainText', textTransformScript + '; return transformText(plainText);')(html);
}

// DOM transforms (in sequence)
for (const domTransformScript of domTransformScripts) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const transformedDoc = new Function('document', domTransformScript + '; return transformDom(document);')(doc);
  html = transformedDoc.body.innerHTML;
}
```

## BlobURL Workflow Integration

### Single-File Build Constraint

Since EDITME.html runs as a single file, workspace assets cannot be accessed via normal file paths. The workflow addresses this:

1. **User edits content** → Auto-save to FileStorageAPI (OPFS/IndexedDB)
2. **Transform pipeline executes** → Generates XHTML with relative asset references
3. **XHTML saved to manifest** → Becomes the spine item's actual content in EPUB structure
4. **BlobURLManager processes XHTML** → Converts asset references to blob URLs for preview
5. **Preview iframe receives processed XHTML** → Can access assets via blob URLs

This seamless integration ensures the editor works correctly regardless of how it's deployed (web app, standalone file, or embedded in EPUB).

## Benefits of This Approach

### ✅ **Maintains Spike Simplicity**
- Same mental model as the working spike
- Direct iframe communication without complex protocols
- Simple debounced updates and error handling

### ✅ **Adds Production Features**
- Multi-file editing with intuitive dropdown selection
- Service layer integration (WorkspaceService, FileStorageAPI)
- Extension loading through ExtensionManager
- File watching for external changes
- Seamless blob URL management for single-file deployment

### ✅ **Optimal User Experience**
- Real-time preview for all file types
- Dual-pane editing for complex workflows
- Clear error feedback without interrupting flow
- Fast, responsive editing with 300ms debounce
- Assets work correctly in preview regardless of deployment method

### ✅ **Maintainable Architecture**
- ~90% as simple as the spike
- Easy to understand and debug
- No over-engineering or enterprise patterns
- Straightforward testing and validation
- Elegant handling of single-file build constraints

This architecture successfully bridges the gap between the elegant spike and production requirements, delivering a spine item editor that developers can actually build and users will enjoy using.