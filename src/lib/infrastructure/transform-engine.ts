/**
 * Transform Engine - Infrastructure Layer
 *
 * Provides persistent iframe-based transform execution for the entire application.
 * Eliminates race conditions by maintaining a single iframe that persists across
 * component lifecycles and navigation changes.
 */

import type { TransformResult, TransformScripts, TransformError } from '../types/spine-editor.js';
import type { BlobURLManager } from '../blob-url/blob-url-manager.js';
import type { ExtensionManager } from '../extensions/extension-manager.js';
import type { ManifestItem } from '../epub/opf-utils.js';
import { FileStorageAPI } from '../storage/index.js';
import {
  resolveManifestStoragePath,
  manifestMediaType,
  resolveSourceReadPath,
  resolveSourceWritePath,
} from '../transform/transform-broker.js';

// Import iframe assets as raw text for blob URL creation
import editorCss from '../../assets/iframe/editor.css?raw';
import editorJs from '../../assets/iframe/editor.js?raw';

/**
 * Context the parent uses to broker file access for transform scripts. Built per
 * transform run from the active workspace; the parent never trusts the iframe to
 * name a workspace, so broker requests resolve against THIS object only.
 */
export interface TransformBrokerContext {
  workspaceId: string;
  basePath: string;
  manifest: ManifestItem[];
}

export class TransformEngine {
  private iframe: HTMLIFrameElement | null = null;
  private messageId = 0;
  private pendingMessages = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private blobURLManager: BlobURLManager;
  // File-access context for the current transform run. Broker requests from the
  // iframe are scoped against this; null means file access is unavailable.
  private brokerContext: TransformBrokerContext | null = null;

  constructor(
    blobURLManager: BlobURLManager,
    private extensionManager?: ExtensionManager
  ) {
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
   * Execute transform on plain text.
   *
   * `brokerContext` (when provided) enables the script-facing file-access API:
   * the manifest + base path are forwarded to the iframe for the `ctx` object,
   * and retained here so BROKER_REQUEST I/O is scoped to that workspace.
   */
  async executeTransform(
    plainText: string,
    timeout = 3000,
    idref?: string,
    brokerContext?: TransformBrokerContext
  ): Promise<TransformResult> {
    if (!this.iframe) {
      throw new Error('Transform engine not initialized');
    }

    this.brokerContext = brokerContext ?? null;
    // The script-facing half of ctx (data only; the iframe attaches the async
    // capability methods). Sending the manifest lets scripts enumerate items.
    const transformCtx = brokerContext
      ? { idref, basePath: brokerContext.basePath, manifest: brokerContext.manifest }
      : { idref, basePath: '', manifest: [] as ManifestItem[] };

    // The transform may now await brokered file I/O, so the message round-trip can
    // outlast the default 5s — give it the transform timeout plus headroom.
    const messageTimeout = Math.max(5000, timeout + 5000);
    try {
      return await this.sendMessage(
        'EXECUTE_TRANSFORM',
        { plainText, timeout, idref, transformCtx },
        messageTimeout
      );
    } finally {
      this.brokerContext = null;
    }
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
   * Set workspace extensions for transform execution
   */
  async setWorkspaceExtensions(workspaceId: string): Promise<void> {
    if (!this.extensionManager) {
      // No extension manager available, skip extension loading
      return;
    }

    try {
      const extensionScripts = await this.loadExtensionScripts(workspaceId);
      await this.sendMessage('SET_EXTENSION_SCRIPTS', extensionScripts);
    } catch (error) {
      console.error('Failed to load workspace extensions:', error);
      // Continue without extensions rather than breaking transforms
    }
  }

  /**
   * Load workspace extension scripts as blob URLs for iframe loading
   */
  private async loadExtensionScripts(
    workspaceId: string
  ): Promise<Array<{ name: string; blobUrl: string }>> {
    if (!this.extensionManager) {
      return [];
    }

    const extensions = await this.extensionManager.listWorkspaceExtensions(workspaceId);
    const scripts: Array<{ name: string; blobUrl: string }> = [];
    const fileStorage = FileStorageAPI.getInstance();

    for (const extension of extensions) {
      try {
        const prefix = `SOURCE/extensions/${extension.name}/`;
        const allJs = extension.files.filter(f => f.type === 'javascript').map(f => f.filename);

        // Only the 3rd-party LIB scripts load into the iframe as globals; the
        // DOM-transform scripts are executed by the pipeline, not loaded here.
        // Prefer the extension's manifest; otherwise exclude transform*-named .js.
        let libFilenames = allJs.filter(name => !/transform/i.test(name));
        try {
          const meta = JSON.parse(
            await fileStorage.readTextFile(workspaceId, `${prefix}extension.json`)
          );
          if (Array.isArray(meta?.scripts)) {
            // A scripts entry is a bare filename or { file, license? }; flatten to
            // filenames so an object-form lib (e.g. js-yaml) is still recognised.
            const declared = new Set(
              meta.scripts
                .map((s: unknown) =>
                  typeof s === 'string'
                    ? s
                    : s &&
                        typeof s === 'object' &&
                        typeof (s as { file?: unknown }).file === 'string'
                      ? (s as { file: string }).file
                      : null
                )
                .filter((f: string | null): f is string => f !== null)
            );
            libFilenames = allJs.filter(name => declared.has(name));
          }
        } catch {
          // No/!malformed manifest — keep the heuristic list above.
        }

        for (const filename of libFilenames) {
          const content = await fileStorage.readFile(workspaceId, `${prefix}${filename}`);
          const blob = new Blob([content], { type: 'application/javascript' });
          scripts.push({
            name: `${extension.name}/${filename}`,
            blobUrl: URL.createObjectURL(blob),
          });
        }
      } catch (error) {
        console.warn(`Failed to load extension ${extension.name}:`, error);
        // Continue with other extensions
      }
    }

    return scripts;
  }

  /**
   * Clean up resources (only on app shutdown)
   */
  cleanup(): void {
    // Clear all pending messages
    for (const pending of this.pendingMessages.values()) {
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
    iframe.style.visibility = 'hidden';
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0px';
    iframe.style.width = '800px';
    iframe.style.height = '600px';

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
  private async sendMessage(type: string, payload: any, timeoutMs = 5000): Promise<any> {
    const id = ++this.messageId;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id);
        reject(new Error(`Message timeout: ${type}`));
      }, timeoutMs);

      this.pendingMessages.set(id, {
        resolve: (result: any) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });

      // Send message to iframe
      if (this.iframe?.contentWindow) {
        this.iframe.contentWindow.postMessage(
          {
            type,
            payload,
            messageId: id,
          },
          '*'
        );
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

    if (type === 'BROKER_REQUEST') {
      void this.handleBrokerRequest(event.data);
      return;
    }

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
            message: String(error.message || error || 'Transform failed'),
            line: error.line,
            column: error.column,
            stack: error.stack,
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
   * Serve a file-access request from a transform script (the brokered capability
   * API). All I/O goes through the path-based FileStorageAPI and is scoped by
   * `transform-broker` helpers; the request's claimed workspace is ignored — only
   * `this.brokerContext` (set by executeTransform) is trusted.
   */
  private async handleBrokerRequest(message: {
    requestId?: number;
    op?: string;
    args?: { href?: string; path?: string; text?: string };
  }): Promise<void> {
    const { requestId, op, args = {} } = message;
    const respond = (ok: boolean, result?: unknown, error?: string) => {
      this.iframe?.contentWindow?.postMessage(
        { type: 'BROKER_RESPONSE', requestId, ok, result, error },
        '*'
      );
    };

    const ctx = this.brokerContext;
    if (!ctx) {
      respond(false, undefined, 'File access is unavailable for this transform');
      return;
    }

    try {
      const fileStorage = FileStorageAPI.getInstance();

      switch (op) {
        case 'readManifestText': {
          const path = resolveManifestStoragePath(ctx.manifest, ctx.basePath, args.href ?? '');
          if (!path) throw new Error(`Not a manifest item: ${args.href}`);
          respond(true, await fileStorage.readTextFile(ctx.workspaceId, path));
          return;
        }
        case 'readManifestDataURL': {
          const path = resolveManifestStoragePath(ctx.manifest, ctx.basePath, args.href ?? '');
          if (!path) throw new Error(`Not a manifest item: ${args.href}`);
          const bytes = await fileStorage.readFile(ctx.workspaceId, path);
          const mime = manifestMediaType(ctx.manifest, args.href ?? '');
          respond(true, await this.bytesToDataURL(bytes, mime));
          return;
        }
        case 'readSourceText': {
          const path = resolveSourceReadPath(args.path ?? '');
          if (!path) throw new Error(`Invalid SOURCE path: ${args.path}`);
          respond(true, await fileStorage.readTextFile(ctx.workspaceId, path));
          return;
        }
        case 'writeSourceText': {
          const path = resolveSourceWritePath(args.path ?? '');
          if (!path) throw new Error(`Writes are limited to SOURCE/data/: ${args.path}`);
          await fileStorage.writeTextFile(ctx.workspaceId, path, args.text ?? '');
          respond(true, path);
          return;
        }
        default:
          throw new Error(`Unknown broker op: ${op}`);
      }
    } catch (error) {
      respond(false, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  /** Encode bytes as a data: URL (parent context has FileReader; the sandbox doesn't). */
  private bytesToDataURL(bytes: ArrayBuffer, mime: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('Failed to encode data URL'));
      reader.readAsDataURL(new Blob([bytes], { type: mime || 'application/octet-stream' }));
    });
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
