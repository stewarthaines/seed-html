# Global Transform Service Architecture

## Problem Statement

The spine editor's transform pipeline currently suffers from race conditions due to iframe lifecycle management being tied to individual SpineView components:

- **Error**: `Failed to load transform scripts: Message timeout: SET_TRANSFORM_SCRIPTS`
- **Root Cause**: Messages sent to iframe that isn't fully loaded or has been destroyed during navigation
- **Impact**: Core functionality failure - transforms are essential for the app

## Solution: App-Level Transform Infrastructure

Move the transform iframe from component lifecycle to application-level infrastructure that persists for the entire session.

```
Current Architecture:
App.svelte
└── SpineView (creates iframe per navigation)
    └── SpineTransformPipeline (iframe lifecycle = component lifecycle)
        └── [iframe destroyed/recreated on every spine item switch]

Proposed Architecture:
App.svelte
├── TransformEngine (infrastructure - owns persistent iframe)
└── SpineView
    └── SpineTransformPipeline (uses infrastructure)
        └── [iframe persists, only scripts change]
```

## Technical Implementation

### 1. Transform Engine (Infrastructure Layer)

```typescript
// src/lib/infrastructure/transform-engine.ts
export class TransformEngine {
  private iframe: HTMLIFrameElement | null = null;
  private messageId = 0;
  private pendingMessages = new Map<number, { resolve: Function; reject: Function }>();
  
  /**
   * Initialize the transform engine once at app startup
   */
  async initialize(): Promise<void> {
    // Create iframe with transform scripts
    this.iframe = this.createIframe();
    document.body.appendChild(this.iframe);
    
    // Setup message handling
    window.addEventListener('message', this.handleMessage.bind(this));
    
    // Wait for iframe ready signal
    await this.waitForReady();
  }
  
  /**
   * Update transform scripts (when switching spine items)
   */
  async setTransformScripts(scripts: TransformScripts): Promise<void> {
    if (!this.iframe) throw new Error('Transform engine not initialized');
    
    await this.sendMessage('SET_TRANSFORM_SCRIPTS', scripts);
  }
  
  /**
   * Execute transform on text
   */
  async executeTransform(plainText: string, timeout = 3000): Promise<TransformResult> {
    if (!this.iframe) throw new Error('Transform engine not initialized');
    
    return await this.sendMessage('EXECUTE_TRANSFORM', { plainText, timeout });
  }
  
  /**
   * Clean up resources (only on app shutdown)
   */
  cleanup(): void {
    this.iframe?.remove();
    this.iframe = null;
    this.pendingMessages.clear();
  }
  
  private createIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.sandbox.add('allow-scripts');
    
    // Get blob URL for editor.js from BlobURLManager
    const editorScriptUrl = BlobURLManager.getInstance().getStaticAssetURL('assets/iframe/editor.js');
    
    // Create iframe HTML
    const iframeHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Transform Engine</title>
</head>
<body>
  <script src="${editorScriptUrl}"></script>
</body>
</html>`;
    
    iframe.srcdoc = iframeHtml;
    return iframe;
  }
  
  private async sendMessage(type: string, payload: any): Promise<any> {
    const id = ++this.messageId;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id);
        reject(new Error(`Message timeout: ${type}`));
      }, 5000);
      
      this.pendingMessages.set(id, { 
        resolve: (result: any) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject 
      });
      
      this.iframe!.contentWindow!.postMessage({ type, payload, messageId: id }, '*');
    });
  }
  
  private handleMessage(event: MessageEvent): void {
    const { type, messageId, payload } = event.data;
    
    if (type === 'TRANSFORM_RESULT' && messageId) {
      const pending = this.pendingMessages.get(messageId);
      if (pending) {
        this.pendingMessages.delete(messageId);
        if (payload.result.success) {
          pending.resolve(payload.result);
        } else {
          pending.reject(new Error(payload.result.error.message));
        }
      }
    }
  }
  
  private waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'IFRAME_READY') {
          window.removeEventListener('message', handler);
          resolve();
        }
      };
      window.addEventListener('message', handler);
    });
  }
}
```

### 2. App.svelte Integration

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { TransformEngine } from './lib/infrastructure/transform-engine.js';
  
  let transformEngine: TransformEngine | null = null;
  let engineReady = false;
  
  onMount(async () => {
    try {
      // Initialize transform engine once at app startup
      transformEngine = new TransformEngine();
      await transformEngine.initialize();
      engineReady = true;
    } catch (error) {
      console.error('Failed to initialize transform engine:', error);
    }
  });
  
  onDestroy(() => {
    // Clean up only on app shutdown
    transformEngine?.cleanup();
  });
</script>

<!-- Pass engine to AppState during initialization -->
{#if engineReady && fileStorageReady}
  <!-- AppState gets the engine and creates services that need it -->
  <EnhancedAppState {transformEngine} ... />
{/if}
```

### 3. Updated SpineTransformPipeline

```typescript
// spine-transform-pipeline.ts - Updated to use transform engine
export class SpineTransformPipeline {
  constructor(
    private workspaceId: string,
    private fileStorage: FileStorageAPI,
    private extensionManager: ExtensionManager,
    private blobURLManager: BlobURLManager,
    private settingsService: SettingsService,
    private transformEngine: TransformEngine  // Use engine instead of creating iframe
  ) {}

  async loadTransformScripts(): Promise<TransformScripts> {
    // Load scripts from workspace
    const scripts = await this.loadScriptsFromWorkspace();
    
    // Update engine with new scripts
    await this.transformEngine.setTransformScripts(scripts);
    
    return scripts;
  }

  async executeTransform(plainText: string, timeout?: number): Promise<TransformResult> {
    // Use engine instead of local iframe
    return await this.transformEngine.executeTransform(plainText, timeout);
  }

  cleanup(): void {
    // No iframe to clean up - engine persists
  }
}

### 4. Enhanced AppState Integration

```typescript
// app-state-enhanced.svelte.ts
export class EnhancedAppState {
  // Add transform engine to constructor
  constructor(
    fileStorageAPI: FileStorageAPI,
    transformEngine: TransformEngine,  // New infrastructure dependency
    // ... other dependencies
  ) {
    // Store engine reference for service creation
    this.transformEngine = transformEngine;
    // ... initialize services
  }
  
  // Pass engine to components that need transforms
  getTransformEngine(): TransformEngine {
    return this.transformEngine;
  }
}
```

## Implementation Steps

### 1. Create Transform Engine (Infrastructure)
```bash
src/lib/infrastructure/
└── transform-engine.ts  # New infrastructure component
```

- Simple iframe lifecycle management
- Message passing with timeout protection
- No complex state management or queuing

### 2. Update App.svelte
- Initialize TransformEngine on mount
- Pass to EnhancedAppState constructor
- Handle initialization errors gracefully

### 3. Refactor Transform Pipeline
- Accept TransformEngine in constructor
- Remove iframe creation/management code
- Update loadTransformScripts() to use engine
- Update executeTransform() to use engine

### 4. Update Component Chain
- EnhancedAppState provides engine to SpineView
- SpineView passes engine to SpinePreviewManager
- SpinePreviewManager passes engine to SpineTransformPipeline

### 5. Testing
- Verify race conditions are eliminated
- Test rapid spine item switching
- Confirm performance improvements

## Key Benefits

1. **Eliminates Race Conditions**: Messages always have a ready iframe
2. **Faster Navigation**: No iframe creation overhead on spine item switches
3. **Simpler Architecture**: Infrastructure handles complexity, components stay simple
4. **Better Performance**: Single iframe instance vs constant recreation

## Why This Works

The core issue is timing - messages sent to iframes that aren't ready or have been destroyed. By moving the iframe to app-level infrastructure:

- Iframe is created once and lives for entire session
- Scripts are updated when switching items (fast operation)
- No component lifecycle dependencies
- No complex recovery needed - if iframe fails, app needs restart

## What We're NOT Doing

- No message queuing (iframe is always ready after init)
- No complex configuration caching (just update scripts)
- No concurrency handling (JS is single-threaded)
- No recovery mechanisms (simpler is better)
- No performance monitoring (not needed for this fix)

## Summary

This simplified architecture solves the race condition problem by ensuring the transform iframe is always available. Instead of creating and destroying iframes with component lifecycles, we create one iframe at app startup that persists throughout the session.

The implementation is straightforward:
1. Create infrastructure component that owns the iframe
2. Initialize it once at app startup
3. Update transform scripts when switching spine items
4. Components use the infrastructure instead of managing their own iframes

This eliminates the timeout errors and provides better performance without adding unnecessary complexity.