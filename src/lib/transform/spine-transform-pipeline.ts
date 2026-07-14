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
import type {
  TransformEngine,
  TransformBrokerContext,
} from '../infrastructure/transform-engine.js';
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
   * Run a generator on demand and return the produced source text. The generator is
   * a project-wide producer: it reads via the brokered ctx (manifest + SOURCE) and an
   * `options` object, and returns text to insert at the editor caret. `idref` tells it
   * which chapter it was invoked in. Extension globals (e.g. djot) are already loaded
   * in the engine from the workspace switch, so no transform scripts are set here.
   */
  async executeGenerator(
    script: string,
    options: Record<string, unknown>,
    idref?: string,
    brokerContext?: Omit<TransformBrokerContext, 'workspaceId'>,
    timeout = 5000
  ): Promise<string> {
    const context: TransformBrokerContext = {
      workspaceId: this.workspaceId,
      basePath: brokerContext?.basePath ?? '',
      manifest: brokerContext?.manifest ?? [],
    };
    const result = await this.transformEngine.executeGenerator(
      script,
      options,
      context,
      idref,
      timeout
    );
    return result.text;
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
   * Clean up resources (no iframe to clean up)
   */
  cleanup(): void {
    // No iframe to clean up - engine is managed at app level
  }
}
