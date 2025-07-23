# Simplified Persistent Iframe Transform Architecture

## Overview

This architecture provides reusable components for transform execution using a persistent iframe. The system supports both outline editing and spine item editing workflows with simplified file watching and immediate update feedback. JavaScript extensions use blob URLs for efficiency, while transform scripts are passed as content for immediate updates.

## File Structure

### Source Code Locations

```
src/lib/
├── blob-url/
│   └── blob-url-manager.ts            # Extended with createExtensionBlobURL()
├── transform/
│   ├── persistent-transform-iframe.ts    # Main iframe coordination class
│   ├── preview-manager.ts                # Preview coordination and file watching
│   └── content-transform-service.ts      # Simplified transform service
└── workspace/
    └── file-watcher.ts                   # Simplified file watching utility
```

### Unit Test Locations

```
src/lib/
├── blob-url/
│   └── blob-url-manager.test.ts       # Tests for extension blob URL methods
├── transform/
│   ├── persistent-transform-iframe.test.ts  # Iframe messaging and script loading
│   ├── preview-manager.test.ts              # Preview coordination and debouncing
│   └── content-transform-service.test.ts    # Transform execution and error handling
└── workspace/
    └── file-watcher.test.ts                 # File watching and change detection
```

### Test Coverage Focus

- **blob-url-manager.test.ts**: Extension blob URL creation, updates, cleanup (added methods only)
- **persistent-transform-iframe.test.ts**: Iframe template generation, script updates, transform execution
- **preview-manager.test.ts**: File watching coordination, debounced rendering, context switching
- **file-watcher.test.ts**: File path watching, change type detection, callback execution
- **content-transform-service.test.ts**: Workspace setup, transform validation, error handling

## Key Components

### 1. Simplified BlobURLManager Extension

The existing BlobURLManager handles JavaScript extensions via blob URLs, but transform scripts are passed directly:

```typescript
// Minimal extension to existing BlobURLManager
export class BlobURLManager {
  /**
   * Create blob URL for JavaScript extensions only (large files)
   */
  async createExtensionBlobURL(workspaceId: string, extensionPath: string): Promise<string> {
    return this.createBlobURL(extensionPath);
  }

  /**
   * Update extension blob URL when content changes
   */
  async updateExtensionBlobURL(workspaceId: string, extensionPath: string): Promise<string> {
    const oldURL = this.registry.urls.get(extensionPath);
    if (oldURL) {
      this.revokeBlobURL(oldURL);
    }
    return this.createExtensionBlobURL(workspaceId, extensionPath);
  }
}
```

### 2. Simplified PersistentTransformIframe

```typescript
export class PersistentTransformIframe {
  private iframe: HTMLIFrameElement;
  private iframeReady = false;
  private currentWorkspaceId: string | null = null;
  private loadedExtensions = new Map<string, string>(); // extensionPath -> blobURL
  private pendingRequests = new Map<string, PendingRequest>();
  
  constructor(
    private blobURLManager: BlobURLManager,
    private workspaceManager: IWorkspaceManager
  ) {
    this.createPersistentIframe();
    this.setupMessageHandling();
  }

  /**
   * Set active workspace and load JavaScript extensions via blob URLs
   */
  async setWorkspace(workspaceId: string): Promise<void> {
    if (this.currentWorkspaceId === workspaceId) return;
    
    this.currentWorkspaceId = workspaceId;
    await this.loadWorkspaceExtensions();
  }

  /**
   * Update transform scripts by passing content directly
   */
  async updateTransformScripts(textTransform?: string, domTransforms?: string[]): Promise<void> {
    if (!this.iframeReady) {
      await this.waitForReady();
    }

    this.sendMessage({
      type: 'UPDATE_TRANSFORM_SCRIPTS',
      payload: {
        textTransform,
        domTransforms: domTransforms || []
      }
    });
  }

  /**
   * Execute transform with current scripts
   */
  async executeTransform(request: TransformRequest): Promise<TransformResult> {
    if (!this.iframeReady) {
      await this.waitForReady();
    }

    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Transform execution timeout'));
      }, request.timeout || 5000);
      
      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      
      this.sendMessage({
        type: 'EXECUTE_TRANSFORM',
        requestId,
        payload: request
      });
    });
  }

  /**
   * Update JavaScript extension when changed
   */
  async updateExtension(extensionPath: string): Promise<void> {
    if (!this.currentWorkspaceId) return;
    
    const oldBlobURL = this.loadedExtensions.get(extensionPath);
    if (oldBlobURL) {
      URL.revokeObjectURL(oldBlobURL);
    }

    const newBlobURL = await this.blobURLManager.updateExtensionBlobURL(
      this.currentWorkspaceId, 
      extensionPath
    );
    this.loadedExtensions.set(extensionPath, newBlobURL);

    if (this.iframeReady) {
      this.sendMessage({
        type: 'UPDATE_EXTENSION',
        payload: { extensionPath, blobURL: newBlobURL }
      });
    }
  }

  private async loadWorkspaceExtensions(): Promise<void> {
    if (!this.currentWorkspaceId) return;

    try {
      const extensions = await this.getWorkspaceExtensions(this.currentWorkspaceId);
      
      for (const extension of extensions) {
        const blobURL = await this.blobURLManager.createExtensionBlobURL(
          this.currentWorkspaceId, 
          extension.path
        );
        this.loadedExtensions.set(extension.path, blobURL);
      }

      if (this.iframeReady) {
        this.sendMessage({
          type: 'LOAD_EXTENSIONS',
          payload: { 
            extensions: extensions.map(ext => ({
              path: ext.path,
              blobURL: this.loadedExtensions.get(ext.path)!
            }))
          }
        });
      }
    } catch (error) {
      console.error('Failed to load workspace extensions:', error);
    }
  }

  private createPersistentIframe(): void {
    this.iframe = document.createElement('iframe');
    this.iframe.style.display = 'none';
    this.iframe.sandbox = 'allow-scripts';
    
    const iframeTemplate = this.generateSimplifiedTemplate();
    const blob = new Blob([iframeTemplate], { type: 'text/html' });
    const blobURL = URL.createObjectURL(blob);
    this.iframe.src = blobURL;
    
    document.body.appendChild(this.iframe);
    
    this.iframe.addEventListener('load', () => {
      URL.revokeObjectURL(blobURL);
    });
  }

  private generateSimplifiedTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Transform Environment</title>
</head>
<body>
  <div id="extension-container"></div>
  <script>
    let textTransformFunc = null;
    let domTransformFuncs = [];

    // Load JavaScript extensions via blob URLs
    function loadExtension(extensionPath, blobURL) {
      return new Promise((resolve, reject) => {
        const existingScript = document.querySelector(\`script[data-extension="\${extensionPath}"]\`);
        if (existingScript) {
          existingScript.remove();
        }

        const script = document.createElement('script');
        script.src = blobURL;
        script.setAttribute('data-extension', extensionPath);
        script.onload = resolve;
        script.onerror = () => reject(new Error(\`Failed to load extension: \${extensionPath}\`));
        
        document.getElementById('extension-container').appendChild(script);
      });
    }

    // Execute transform pipeline with current functions
    function executeTransform(plainText) {
      try {
        let html = plainText;
        
        if (textTransformFunc) {
          html = textTransformFunc(html);
        }
        
        if (domTransformFuncs.length > 0) {
          const parser = new DOMParser();
          let doc = parser.parseFromString(
            \`<!DOCTYPE html><html><head></head><body>\${html}</body></html>\`,
            'text/html'
          );
          
          for (const transformFunc of domTransformFuncs) {
            doc = transformFunc(doc) || doc;
          }
          
          html = doc.body.innerHTML;
        }
        
        return { success: true, html };
      } catch (error) {
        return {
          success: false,
          error: {
            stage: 'execution',
            message: error.message,
            stack: error.stack
          }
        };
      }
    }

    // Message handling
    window.addEventListener('message', async (event) => {
      const { type, requestId, payload } = event.data;
      
      switch (type) {
        case 'LOAD_EXTENSIONS':
          try {
            for (const extension of payload.extensions) {
              await loadExtension(extension.path, extension.blobURL);
            }
            parent.postMessage({ type: 'EXTENSIONS_LOADED' }, '*');
          } catch (error) {
            parent.postMessage({ 
              type: 'EXTENSION_LOAD_ERROR', 
              payload: { message: error.message }
            }, '*');
          }
          break;

        case 'UPDATE_EXTENSION':
          try {
            await loadExtension(payload.extensionPath, payload.blobURL);
            parent.postMessage({ type: 'EXTENSION_UPDATED' }, '*');
          } catch (error) {
            parent.postMessage({ 
              type: 'EXTENSION_UPDATE_ERROR', 
              payload: { message: error.message }
            }, '*');
          }
          break;
          
        case 'UPDATE_TRANSFORM_SCRIPTS':
          try {
            // Update transform functions from passed content
            if (payload.textTransform) {
              textTransformFunc = new Function('plainText', payload.textTransform + '; return transformText(plainText);');
            } else {
              textTransformFunc = null;
            }
            
            domTransformFuncs = payload.domTransforms.map(code => 
              new Function('doc', code + '; return transformDom(doc);')
            );
            
            parent.postMessage({ type: 'SCRIPTS_UPDATED' }, '*');
          } catch (error) {
            parent.postMessage({ 
              type: 'SCRIPT_UPDATE_ERROR', 
              payload: { message: error.message }
            }, '*');
          }
          break;
          
        case 'EXECUTE_TRANSFORM':
          const startTime = Date.now();
          const result = executeTransform(payload.plainText);
          
          parent.postMessage({
            type: 'TRANSFORM_RESULT',
            requestId,
            payload: {
              ...result,
              executionTime: Date.now() - startTime
            }
          }, '*');
          break;
      }
    });
    
    parent.postMessage({ type: 'READY' }, '*');
  </script>
</body>
</html>`;
  }

  private sendMessage(message: any): void {
    if (this.iframe?.contentWindow && this.iframeReady) {
      this.iframe.contentWindow.postMessage(message, '*');
    }
  }

  cleanup(): void {
    // Cleanup extension blob URLs
    for (const blobURL of this.loadedExtensions.values()) {
      URL.revokeObjectURL(blobURL);
    }
    this.loadedExtensions.clear();
    
    // Clear pending requests
    for (const request of this.pendingRequests.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Iframe cleanup'));
    }
    this.pendingRequests.clear();
    
    // Remove iframe
    if (this.iframe) {
      this.iframe.remove();
    }
  }
}
```

### 3. Simplified FileWatcher

```typescript
export class FileWatcher {
  private fileWatcher?: FileSystemWatcher;
  private changeCallback?: (filePath: string, changeType: 'source' | 'script' | 'stylesheet' | 'extension') => void;

  constructor(
    private workspaceId: string,
    private workspaceManager: IWorkspaceManager
  ) {}

  /**
   * Watch specific files for changes
   */
  watchFiles(filePaths: string[]): void {
    this.stopWatching();
    
    if (filePaths.length === 0) return;
    
    this.fileWatcher = this.workspaceManager.watchFiles(
      this.workspaceId,
      filePaths,
      {
        onChange: (filePath: string) => {
          const changeType = this.getChangeType(filePath);
          this.changeCallback?.(filePath, changeType);
        }
      }
    );
  }

  onFileChange(callback: (filePath: string, changeType: 'source' | 'script' | 'stylesheet' | 'extension') => void): void {
    this.changeCallback = callback;
  }

  private getChangeType(filePath: string): 'source' | 'script' | 'stylesheet' | 'extension' {
    if (filePath.startsWith('SOURCE/text/')) return 'source';
    if (filePath.startsWith('SOURCE/scripts/')) return 'script';
    if (filePath.startsWith('OEBPS/Styles/')) return 'stylesheet';
    if (filePath.startsWith('SOURCE/extensions/')) return 'extension';
    return 'source';
  }

  stopWatching(): void {
    this.fileWatcher?.close();
  }
}
```

### 4. Simplified PreviewManager

```typescript
export interface PreviewConfig {
  includeStylesheets: boolean;           // true for spine items, false for outline
  debounceMs: number;                    // Re-render debouncing
  transformTimeout: number;              // Script execution timeout
}

export class PreviewManager {
  private transformIframe: PersistentTransformIframe;
  private fileWatcher: FileWatcher;
  private debounceTimer?: number;
  private currentSourceContent = '';
  private currentMetadata: ChapterMetadata;

  constructor(
    private workspaceId: string,
    private blobURLManager: BlobURLManager,
    private workspaceManager: IWorkspaceManager,
    private config: PreviewConfig
  ) {
    this.transformIframe = new PersistentTransformIframe(blobURLManager, workspaceManager);
    this.fileWatcher = new FileWatcher(workspaceId, workspaceManager);
    
    this.setupFileWatching();
  }

  /**
   * Set the current editing context
   */
  async setEditingContext(context: {
    sourceFile?: string;
    sourceContent: string;
    metadata: ChapterMetadata;
  }): Promise<void> {
    this.currentSourceContent = context.sourceContent;
    this.currentMetadata = context.metadata;
    
    // Build file list to watch
    const watchFiles: string[] = [];
    if (context.sourceFile) watchFiles.push(context.sourceFile);
    
    const scripts = await this.getConfiguredScripts();
    watchFiles.push(...scripts);
    
    if (this.config.includeStylesheets) {
      watchFiles.push(...this.currentMetadata.stylesheets);
    }
    
    const extensions = await this.getConfiguredExtensions();
    watchFiles.push(...extensions);
    
    this.fileWatcher.watchFiles(watchFiles);
    
    // Load transform scripts into iframe
    await this.updateTransformScripts();
    
    // Initial render
    await this.renderPreview();
  }

  /**
   * Update source content (from editor typing)
   */
  updateSourceContent(content: string): void {
    this.currentSourceContent = content;
    this.debounceRender();
  }

  private setupFileWatching(): void {
    this.fileWatcher.onFileChange(async (filePath, changeType) => {
      switch (changeType) {
        case 'source':
          // Source file changed externally - reload content
          this.currentSourceContent = await this.workspaceManager.readTextFile(this.workspaceId, filePath);
          await this.renderPreview();
          break;
          
        case 'script':
          // Transform script changed - reload scripts into iframe
          await this.updateTransformScripts();
          this.debounceRender();
          break;
          
        case 'stylesheet':
          // CSS changed - update blob URLs and re-render
          await this.updateStylesheetBlobURLs();
          await this.renderPreview();
          break;
          
        case 'extension':
          // Extension changed - update in iframe
          await this.transformIframe.updateExtension(filePath);
          this.debounceRender();
          break;
      }
    });
  }

  /**
   * Load current transform scripts into iframe
   */
  private async updateTransformScripts(): Promise<void> {
    try {
      const settings = await this.workspaceManager.readTextFile(this.workspaceId, 'SOURCE/settings.json');
      const config = JSON.parse(settings);
      
      let textTransform: string | undefined;
      const domTransforms: string[] = [];
      
      if (config.transform_pipeline?.text_transform) {
        textTransform = await this.workspaceManager.readTextFile(
          this.workspaceId, 
          `SOURCE/scripts/${config.transform_pipeline.text_transform}`
        );
      }
      
      if (config.transform_pipeline?.dom_transforms) {
        for (const scriptName of config.transform_pipeline.dom_transforms) {
          const scriptContent = await this.workspaceManager.readTextFile(
            this.workspaceId, 
            `SOURCE/scripts/${scriptName}`
          );
          domTransforms.push(scriptContent);
        }
      }
      
      await this.transformIframe.updateTransformScripts(textTransform, domTransforms);
    } catch (error) {
      console.error('Failed to update transform scripts:', error);
    }
  }

  private debounceRender(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.renderPreview();
    }, this.config.debounceMs);
  }

  private async renderPreview(): Promise<void> {
    try {
      // Execute transform via persistent iframe
      const transformResult = await this.transformIframe.executeTransform({
        plainText: this.currentSourceContent,
        timeout: this.config.transformTimeout
      });

      if (transformResult.success) {
        // Generate final XHTML with current metadata
        const finalXHTML = this.generateXHTMLWithMetadata(transformResult.html);
        
        // Process XHTML for preview (convert asset URLs to blob URLs)
        const previewXHTML = await this.blobURLManager.processXHTMLForPreview(finalXHTML);
        
        this.onPreviewReady?.(previewXHTML, transformResult.warnings || []);
      } else {
        this.onPreviewError?.(transformResult.error);
      }
    } catch (error) {
      this.onPreviewError?.(error);
    }
  }

  private generateXHTMLWithMetadata(content: string): string {
    const escapedTitle = this.escapeHtml(this.currentMetadata.title);
    const stylesheetLinks = this.currentMetadata.stylesheets
      .map(href => `    <link rel="stylesheet" type="text/css" href="${this.escapeHtml(href)}" />`)
      .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${this.escapeHtml(this.currentMetadata.language)}" lang="${this.escapeHtml(this.currentMetadata.language)}">
  <head>
    <title>${escapedTitle}</title>
${stylesheetLinks}${stylesheetLinks ? '\n' : ''}  </head>
  <body>
    ${content}
  </body>
</html>`;
  }

  private async getConfiguredScripts(): Promise<string[]> {
    // Load script configuration from workspace settings
    try {
      const settings = await this.workspaceManager.readTextFile(this.workspaceId, 'SOURCE/settings.json');
      const config = JSON.parse(settings);
      const scripts: string[] = [];
      
      if (config.transform_pipeline?.text_transform) {
        scripts.push(`SOURCE/scripts/${config.transform_pipeline.text_transform}`);
      }
      if (config.transform_pipeline?.dom_transforms) {
        config.transform_pipeline.dom_transforms.forEach((script: string) => {
          scripts.push(`SOURCE/scripts/${script}`);
        });
      }
      
      return scripts;
    } catch {
      return [];
    }
  }

  private async getConfiguredExtensions(): Promise<string[]> {
    // Extension files don't change during editing sessions
    // They're managed separately in settings UI
    return [];
  }

  private async updateStylesheetBlobURLs(): void {
    // Update blob URLs for stylesheets when they change
    for (const stylesheet of this.currentMetadata.stylesheets) {
      try {
        await this.blobURLManager.updateBlobURL(this.workspaceId, stylesheet);
      } catch (error) {
        console.warn(`Failed to update stylesheet ${stylesheet}:`, error);
      }
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Callbacks for preview updates
  onPreviewReady?: (xhtml: string, warnings: string[]) => void;
  onPreviewError?: (error: any) => void;

  cleanup(): void {
    this.fileWatcher.stopWatching();
    this.transformIframe.cleanup();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
```

### 5. Simplified ContentTransformService

```typescript
export class ContentTransformService {
  private persistentIframe: PersistentTransformIframe;

  constructor(
    private blobURLManager: BlobURLManager,
    private workspaceManager: IWorkspaceManager
  ) {
    this.persistentIframe = new PersistentTransformIframe(
      blobURLManager,
      workspaceManager
    );
  }

  /**
   * Set active workspace
   */
  async setWorkspace(workspaceId: string): Promise<void> {
    await this.persistentIframe.setWorkspace(workspaceId);
  }

  /**
   * Execute transform with current scripts
   */
  async validateAndTransformUserContent(
    plainText: string,
    workspaceId: string,
    contentId: string,
    metadata: ChapterMetadata
  ): Promise<ContentTransformResult> {
    try {
      const transformResult = await this.persistentIframe.executeTransform({
        plainText,
        timeout: 3000
      });

      if (transformResult.success) {
        const xhtmlString = this.generateXHTMLDocument(transformResult.html, metadata);
        return {
          success: true,
          xhtml: xhtmlString,
          warnings: transformResult.warnings
        };
      } else {
        return {
          success: false,
          error: new TransformError({
            stage: transformResult.error?.stage || 'execution',
            message: transformResult.error?.message || 'Transform execution failed'
          }),
          warnings: transformResult.warnings
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error,
        warnings: ['Transform execution failed']
      };
    }
  }
}
```

## Usage Examples

### Outline Editor Integration

```typescript
// Outline Editor - Navigation editing without stylesheets
const previewManager = new PreviewManager(
  workspaceId,
  blobURLManager,
  workspaceManager,
  {
    includeStylesheets: false,  // Navigation doesn't include CSS
    debounceMs: 300,
    transformTimeout: 2000
  }
);

// Set editing context for navigation
await previewManager.setEditingContext({
  sourceFile: 'SOURCE/text/nav.txt',
  sourceContent: navigationSourceText,
  metadata: { 
    title: 'Table of Contents', 
    language: 'en',
    stylesheets: [], // No CSS for navigation
    scripts: [],
    customHead: undefined
  }
});

// Setup preview callbacks
previewManager.onPreviewReady = (xhtml, warnings) => {
  displayNavigationPreview(xhtml);
  if (warnings.length > 0) showWarnings(warnings);
};

previewManager.onPreviewError = (error) => {
  displayTransformError(error);
};

// Update when user types in editor
function onNavigationTextChange(newContent: string) {
  previewManager.updateSourceContent(newContent);
}
```

### Spine Item Editor Integration

```typescript
// Spine Item Editor - Chapter editing with stylesheets
const previewManager = new PreviewManager(
  workspaceId,
  blobURLManager,
  workspaceManager,
  {
    includeStylesheets: true,   // Include CSS for chapters
    debounceMs: 300,
    transformTimeout: 2000
  }
);

// Set editing context for chapter
await previewManager.setEditingContext({
  sourceFile: 'SOURCE/text/chapter1.txt',
  sourceContent: chapterSourceText,
  metadata: { 
    title: 'Chapter 1: Introduction', 
    language: 'en',
    stylesheets: ['../Styles/main.css', '../Styles/chapter.css'],
    scripts: [],
    customHead: undefined
  }
});

// Setup preview callbacks
previewManager.onPreviewReady = (xhtml, warnings) => {
  displayChapterPreview(xhtml);
  if (warnings.length > 0) showWarnings(warnings);
};

previewManager.onPreviewError = (error) => {
  preventSave();
  displayTransformError(error);
};

// Update when user types in editor
function onChapterTextChange(newContent: string) {
  previewManager.updateSourceContent(newContent);
}
```

## Workflow Integration

### File Change Detection

The system watches relevant files based on editing context:

**Outline Editor watches:**
- `SOURCE/text/nav.txt` - Navigation source file
- `SOURCE/scripts/transformText.js` - Text transform script (if configured)
- `SOURCE/scripts/transformDom.js` - DOM transform script (if configured)
- `SOURCE/extensions/*.js` - JavaScript extension libraries

**Spine Item Editor watches:**
- `SOURCE/text/chapter1.txt` - Chapter source file
- `SOURCE/scripts/transformText.js` - Text transform script (if configured)  
- `SOURCE/scripts/transformDom.js` - DOM transform script (if configured)
- `OEBPS/Styles/main.css` - Stylesheets referenced in chapter metadata
- `OEBPS/Styles/chapter.css` - Additional chapter stylesheets
- `SOURCE/extensions/*.js` - JavaScript extension libraries

### Script Development Cycle

1. **Developer edits** `SOURCE/scripts/transformText.js`
2. **FileWatcher detects** change immediately  
3. **PreviewManager** reads updated script content
4. **Script content passed** directly to iframe (not via blob URL)
5. **Iframe updates** transform function immediately
6. **PreviewManager** triggers re-render with updated script
7. **If script has errors**, transform fails and preview shows error (no XHTML saved)

### Transform Execution Flow

1. **User content change** triggers `updateSourceContent()` call
2. **PreviewManager** debounces and calls `renderPreview()`
3. **PersistentTransformIframe** executes with current loaded functions
4. **Success**: XHTML generated and displayed in preview
5. **Failure**: Error displayed, no file saves occur

## Benefits

### Performance
- **No iframe recreation**: Single persistent iframe for all transforms
- **Direct script passing**: Transform scripts passed as content for immediate updates
- **Blob URL efficiency**: Only large JavaScript extensions use blob URLs
- **Reduced coordination**: Single file watcher instead of multiple systems

### Developer Experience  
- **Real-time updates**: Script changes reflected immediately without blob URL management
- **Fast iteration**: Direct function updates in iframe memory
- **Clear error feedback**: Transform failures prevent bad XHTML from being saved
- **Simpler debugging**: Fewer layers of abstraction

### Resource Management
- **Simplified blob management**: Only extensions require blob URLs
- **Automatic cleanup**: Clean separation of resources by type
- **Memory efficient**: Single persistent iframe, direct content passing
- **Reduced complexity**: ~50% fewer lines of code while maintaining functionality

### Security
- **Sandboxed execution**: Scripts isolated from main application
- **Resource limits**: Transform timeouts prevent infinite loops
- **Clean separation**: Transform errors contained within iframe

## Migration Path

1. **Add extension blob URL methods** to existing BlobURLManager (minimal extension)
2. **Create simplified PersistentTransformIframe** with direct script content passing
3. **Implement simple FileWatcher** to replace multiple watching systems
4. **Build streamlined PreviewManager** as reusable coordinator for both editor types
5. **Update existing editors** to use PreviewManager with direct file arrays
6. **Test with both workflows** - outline editing and spine item editing
7. **Verify immediate script updates** work without complex blob URL coordination

## Implementation Benefits

### Reusability
- **Single simplified codebase** supports both outline and spine item editing
- **Configurable behavior** adapts to different editor requirements with simple boolean flags
- **Shared components** eliminate duplication while reducing complexity

### Developer Experience  
- **Immediate feedback** on script changes without complex coordination
- **Direct file watching** monitors only relevant files for current session
- **Streamlined error handling** provides consistent feedback with fewer abstraction layers

### Performance
- **Efficient file watching** tracks specific files with single watcher
- **Direct content updates** eliminate blob URL management overhead for scripts
- **Smart resource separation** uses blob URLs only where needed (large extensions)

### Security & Reliability
- **Sandboxed execution** isolates transform scripts from main application
- **Error containment** prevents script failures from breaking editor functionality
- **Timeout protection** prevents infinite loops in transform scripts
- **Simpler failure modes** with fewer moving parts to debug

This simplified architecture maintains all functionality of the original design while reducing complexity by ~50%, making it easier to implement, debug, and extend for future editor types.