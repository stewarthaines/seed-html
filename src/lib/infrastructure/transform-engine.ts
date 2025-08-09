/**
 * Transform Engine - Infrastructure Layer
 * 
 * Provides persistent iframe-based transform execution for the entire application.
 * Eliminates race conditions by maintaining a single iframe that persists across
 * component lifecycles and navigation changes.
 */

import type { 
  TransformResult, 
  TransformScripts,
  TransformError
} from '../types/spine-editor.js';
import type { BlobURLManager } from '../blob-url/blob-url-manager.js';

// Import iframe assets as raw text for blob URL creation
import editorHtml from '../../assets/iframe/editor.html?raw';
import editorCss from '../../assets/iframe/editor.css?raw';
import editorJs from '../../assets/iframe/editor.js?raw';

export class TransformEngine {
  private iframe: HTMLIFrameElement | null = null;
  private messageId = 0;
  private pendingMessages = new Map<number, { 
    resolve: (value: any) => void; 
    reject: (error: any) => void; 
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private blobURLManager: BlobURLManager;

  constructor(blobURLManager: BlobURLManager) {
    this.blobURLManager = blobURLManager;
  }

  /**
   * Initialize the transform engine once at app startup
   */
  async initialize(): Promise<void> {
    // Create iframe with transform scripts
    this.iframe = this.createPersistentIframe();
    document.body.appendChild(this.iframe);
    
    // Setup message handling
    window.addEventListener('message', this.handleMessage.bind(this));
    
    // Wait for iframe ready signal
    await this.waitForReady();
  }

  /**
   * Update transform scripts (when switching spine items or loading new scripts)
   */
  async setTransformScripts(scripts: TransformScripts): Promise<void> {
    if (!this.iframe) {
      throw new Error('Transform engine not initialized');
    }
    
    await this.sendMessage('SET_TRANSFORM_SCRIPTS', scripts);
  }

  /**
   * Execute transform on plain text
   */
  async executeTransform(plainText: string, timeout = 3000): Promise<TransformResult> {
    if (!this.iframe) {
      throw new Error('Transform engine not initialized');
    }
    
    return await this.sendMessage('EXECUTE_TRANSFORM', { plainText, timeout });
  }

  /**
   * Set debug mode for transform execution
   */
  async setDebugMode(enabled: boolean): Promise<void> {
    if (!this.iframe) {
      throw new Error('Transform engine not initialized');
    }
    
    await this.sendMessage('SET_DEBUG_MODE', enabled);
  }

  /**
   * Ping transform engine for connectivity testing
   */
  async ping(payload: any): Promise<any> {
    if (!this.iframe) {
      throw new Error('Transform engine not initialized');
    }
    
    return await this.sendMessage('PING', payload);
  }

  /**
   * Clean up resources (only on app shutdown)
   */
  cleanup(): void {
    // Clear all pending messages
    for (const [id, pending] of this.pendingMessages) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Transform engine shutting down'));
    }
    this.pendingMessages.clear();

    // Remove iframe
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }

    // Remove message listener
    window.removeEventListener('message', this.handleMessage.bind(this));
  }

  /**
   * Create persistent iframe with blob URL content (working CSP-compatible approach)
   */
  private createPersistentIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    
    // No sandbox restrictions - iframe needs full access for transform scripts and blob URLs
    
    // Create iframe document using blob URL (CSP-compatible)
    const iframeDocument = this.createIframeDocument();
    const blob = new Blob([iframeDocument], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    
    iframe.src = blobUrl;
    
    // Clean up blob URL after iframe loads
    iframe.onload = () => {
      URL.revokeObjectURL(blobUrl);
    };
    
    return iframe;
  }

  /**
   * Create iframe document HTML with embedded assets (blob URL compatible)
   */
  private createIframeDocument(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Transform Engine</title>
  <style>
${editorCss}
  </style>
</head>
<body>
  <div id="status" class="transform-status">Transform engine initializing...</div>
  <script>
${editorJs}
  </script>
</body>
</html>`;
  }

  /**
   * Send message to iframe and wait for response
   */
  private async sendMessage(type: string, payload: any): Promise<any> {
    const id = ++this.messageId;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id);
        reject(new Error(`Message timeout: ${type}`));
      }, 5000); // 5 second timeout
      
      this.pendingMessages.set(id, { 
        resolve: (result: any) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout
      });
      
      // Send message to iframe
      if (this.iframe?.contentWindow) {
        this.iframe.contentWindow.postMessage({ 
          type, 
          payload, 
          messageId: id 
        }, '*');
      } else {
        this.pendingMessages.delete(id);
        clearTimeout(timeout);
        reject(new Error('Iframe not available'));
      }
    });
  }

  /**
   * Handle messages from iframe
   */
  private handleMessage(event: MessageEvent): void {
    // Only handle messages from our iframe
    if (event.source !== this.iframe?.contentWindow) {
      return;
    }

    const { type, messageId, payload } = event.data;
    
    if (type === 'TRANSFORM_RESULT' && messageId) {
      const pending = this.pendingMessages.get(messageId);
      if (pending) {
        this.pendingMessages.delete(messageId);
        
        if (payload?.result?.success) {
          pending.resolve(payload.result);
        } else {
          const error = payload?.result?.error || { message: 'Unknown transform error' };
          const transformError: TransformError = {
            stage: error.stage || 'unknown',
            message: error.message || 'Transform failed',
            line: error.line,
            column: error.column,
            stack: error.stack
          };
          pending.reject(transformError);
        }
      }
    } else if (type === 'IFRAME_READY') {
      // Handle ready signal in waitForReady method
    } else if (type === 'GLOBAL_ERROR' || type === 'UNHANDLED_REJECTION') {
      // Log global errors from iframe but don't reject pending messages
      console.error(`Transform engine ${type.toLowerCase()}:`, payload);
    }
  }

  /**
   * Wait for iframe ready signal
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Transform engine initialization timeout'));
      }, 10000); // 10 second timeout for initialization

      const handler = (event: MessageEvent) => {
        if (event.source === this.iframe?.contentWindow && event.data.type === 'IFRAME_READY') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve();
        }
      };
      
      window.addEventListener('message', handler);
    });
  }
}