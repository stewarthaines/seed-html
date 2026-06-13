/**
 * Spine Item Transform Pipeline
 *
 * Enhanced transform pipeline using global transform engine for real-time
 * spine item editing. Uses persistent app-level iframe for sandboxed transform
 * execution with message-based communication.
 */

import type { FileStorageAPI } from '../storage/index.js';
import type { ExtensionManager } from '../extensions/extension-manager.js';
import type { SettingsService } from '../services/settings/settings.service.js';
import type { BlobURLManager } from '../blob-url/blob-url-manager.js';
import type { TransformEngine, TransformBrokerContext } from '../infrastructure/transform-engine.js';
import type { TransformResult, TransformScripts } from '../types/spine-editor.js';
import { resolveTransformPath } from '../settings/dom-transforms.js';

/**
 * Spine-specific transform pipeline using global transform engine
 */
export class SpineTransformPipeline {
  constructor(
    private workspaceId: string,
    private fileStorage: FileStorageAPI,
    private extensionManager: ExtensionManager,
    private blobURLManager: BlobURLManager,
    private transformEngine: TransformEngine,
    private settingsService?: SettingsService
  ) {
    // No iframe initialization needed - engine is managed at app level
  }

  /**
   * Execute transform pipeline with text input
   */
  async executeTransform(
    plainText: string,
    timeout = 3000,
    idref?: string,
    brokerContext?: Omit<TransformBrokerContext, 'workspaceId'>
  ): Promise<TransformResult> {
    try {
      // Load and set transform scripts in engine
      const scripts = await this.loadTransformScripts();
      await this.transformEngine.setTransformScripts(scripts);

      // Execute the transform using the engine, supplying the workspace-scoped
      // file-access context (if the caller provided manifest/basePath).
      const context: TransformBrokerContext | undefined = brokerContext
        ? { workspaceId: this.workspaceId, ...brokerContext }
        : undefined;
      return await this.transformEngine.executeTransform(plainText, timeout, idref, context);
    } catch (error) {
      return {
        success: false,
        error: {
          stage: 'communication',
          message: String((error as any)?.message || error),
        },
      };
    }
  }

  /**
   * Read a transform script, retrying briefly. On a freshly downloaded/unpacked
   * EPUB the first preview can run before SOURCE/scripts has finished being
   * written; a short bounded retry lets the file appear instead of rendering
   * with an empty transform. Returns null if it never becomes readable.
   */
  private async readScriptWithRetry(path: string): Promise<string | null> {
    const attempts = 5;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await this.fileStorage.readTextFile(this.workspaceId, path);
      } catch {
        if (attempt < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    console.warn(`Transform script not available after ${attempts} attempts: ${path}`);
    return null;
  }

  /**
   * Load transform scripts from workspace settings
   */
  async loadTransformScripts(): Promise<TransformScripts> {
    try {
      const scripts: TransformScripts = {
        textTransform: '',
        domTransforms: [],
      };

      if (this.settingsService) {
        // Load settings and resolve transform scripts
        const settings = await this.settingsService.loadEPUBSettings(this.workspaceId);

        if (settings.text_transform) {
          const content = await this.readScriptWithRetry(
            resolveTransformPath(settings.text_transform)
          );
          // Leave textTransform empty if unreadable; the engine passes the input
          // through unchanged rather than erroring.
          if (content !== null) scripts.textTransform = content;
        }

        if (settings.dom_transforms && settings.dom_transforms.length > 0) {
          const domTransforms: string[] = [];
          for (const scriptName of settings.dom_transforms) {
            const content = await this.readScriptWithRetry(resolveTransformPath(scriptName));
            // Skip an unreadable DOM transform rather than queueing an empty one.
            if (content !== null) domTransforms.push(content);
          }
          scripts.domTransforms = domTransforms;
        }
      }

      return scripts;
    } catch (error) {
      throw new Error(
        `Failed to load transform scripts: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Set debug mode in transform engine
   */
  async setDebugMode(enabled: boolean): Promise<void> {
    try {
      await this.transformEngine.setDebugMode(enabled);
    } catch (error) {
      console.warn('Failed to set debug mode:', error);
    }
  }

  /**
   * Ping the transform engine to test connectivity
   */
  async ping(data: any = {}): Promise<any> {
    return await this.transformEngine.ping({ data });
  }

  /**
   * Clean up resources (no iframe to clean up)
   */
  cleanup(): void {
    // No iframe to clean up - engine is managed at app level
  }
}

/**
 * Factory function to create spine transform pipeline
 */
export function createSpineTransformPipeline(
  workspaceId: string,
  fileStorage: FileStorageAPI,
  extensionManager: ExtensionManager,
  blobURLManager: BlobURLManager,
  transformEngine: TransformEngine,
  settingsService?: SettingsService
): SpineTransformPipeline {
  return new SpineTransformPipeline(
    workspaceId,
    fileStorage,
    extensionManager,
    blobURLManager,
    transformEngine,
    settingsService
  );
}

/**
 * Enhanced transform result with additional spine-specific data
 */
export interface SpineTransformResult extends TransformResult {
  spineItemId?: string;
  generatedXHTML?: string;
  assetReferences?: string[];
  blobUrls?: string[];
}

/**
 * Transform pipeline with spine-specific enhancements
 */
export interface ISpineTransformPipeline {
  executeTransform(plainText: string, timeout?: number): Promise<TransformResult>;
  loadTransformScripts(): Promise<TransformScripts>;
  setDebugMode(enabled: boolean): Promise<void>;
  ping(data?: any): Promise<any>;
  cleanup(): void;
}
