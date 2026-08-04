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
  // Loaded transform scripts, keyed by the settings that selected them. The
  // settings file is still read on EVERY load (one storage read), so a changed
  // text_transform / dom_transforms list always misses the cache; only the
  // per-script file reads are skipped. Script CONTENT edits are invisible to
  // the key — the spine editor invalidates explicitly when it saves a
  // transform script (see invalidateScriptCache). Out-of-band writers
  // (plugins) are not covered; they'd need the same explicit call.
  private scriptCache: { key: string; scripts: TransformScripts } | null = null;

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
    // Script loading is storage work, not engine communication — label its
    // failures accordingly so debugging points at settings/SOURCE, not the
    // iframe engine.
    try {
      const scripts = await this.loadTransformScripts();
      await this.transformEngine.setTransformScripts(scripts);
    } catch (error) {
      return {
        success: false,
        error: {
          stage: 'scripts',
          message: String((error as any)?.message || error),
        },
      };
    }

    try {
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
    idref: string | undefined,
    brokerContext: Omit<TransformBrokerContext, 'workspaceId'>,
    timeout = 5000
  ): Promise<string> {
    // The context is required: substituting an empty basePath/manifest here
    // used to run generators against a fabricated empty project and insert
    // their (wrong) output at the caret with no error.
    const context: TransformBrokerContext = {
      workspaceId: this.workspaceId,
      ...brokerContext,
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
   * Drop the cached transform scripts so the next render re-reads them from
   * storage. Callers that change a transform script's CONTENT without touching
   * the settings (the spine editor's live script editing) must call this —
   * settings-list changes are caught by the per-load settings read instead.
   */
  invalidateScriptCache(): void {
    this.scriptCache = null;
  }

  /**
   * Load transform scripts from workspace settings. The settings are read from
   * storage on every call; the script files themselves are served from cache
   * while the configured pipeline (text_transform + dom_transforms) is
   * unchanged and the previous load was complete.
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

        const cacheKey = JSON.stringify([
          settings.text_transform ?? '',
          settings.dom_transforms ?? [],
        ]);
        if (this.scriptCache?.key === cacheKey) {
          return this.scriptCache.scripts;
        }

        // An unreadable script must not be cached: the next render retries
        // (the file may still be being written on a fresh unpack).
        let complete = true;

        // Basename of a configured script path, for attributing captured
        // console warnings to the script that emitted them.
        const basename = (path: string): string => path.split('/').pop() || path;

        if (settings.text_transform) {
          const content = await this.readScriptWithRetry(
            resolveTransformPath(settings.text_transform)
          );
          // Leave textTransform empty if unreadable; the engine passes the input
          // through unchanged rather than erroring.
          if (content !== null) {
            scripts.textTransform = content;
            scripts.textTransformName = basename(settings.text_transform);
          } else complete = false;
        }

        if (settings.dom_transforms && settings.dom_transforms.length > 0) {
          const domTransforms: string[] = [];
          const domTransformNames: string[] = [];
          for (const scriptName of settings.dom_transforms) {
            const content = await this.readScriptWithRetry(resolveTransformPath(scriptName));
            // Skip an unreadable DOM transform rather than queueing an empty one
            // (names stay index-aligned with the contents).
            if (content !== null) {
              domTransforms.push(content);
              domTransformNames.push(basename(scriptName));
            } else complete = false;
          }
          scripts.domTransforms = domTransforms;
          scripts.domTransformNames = domTransformNames;
        }

        if (complete) {
          this.scriptCache = { key: cacheKey, scripts };
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
