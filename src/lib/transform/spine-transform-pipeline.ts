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
import type { TransformEngine } from '../infrastructure/transform-engine.js';
import type { 
  TransformResult, 
  TransformScripts, 
  TransformError, 
  TransformRequest,
  EditorMessage,
  EditorResponse
} from '../types/spine-editor.js';

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
  async executeTransform(plainText: string, timeout = 3000): Promise<TransformResult> {
    try {
      // Load and set transform scripts in engine
      const scripts = await this.loadTransformScripts();
      await this.transformEngine.setTransformScripts(scripts);

      // Execute the transform using the engine
      return await this.transformEngine.executeTransform(plainText, timeout);
    } catch (error) {
      return {
        success: false,
        error: {
          stage: 'communication',
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Load transform scripts from workspace settings
   */
  async loadTransformScripts(): Promise<TransformScripts> {
    try {
      const scripts: TransformScripts = {
        textTransform: '',
        domTransforms: []
      };

      if (this.settingsService) {
        // Load settings and resolve transform scripts
        const settings = await this.settingsService.loadEPUBSettings(this.workspaceId);
        
        if (settings.text_transform) {
          try {
            scripts.textTransform = await this.fileStorage.readTextFile(
              this.workspaceId,
              `SOURCE/scripts/${settings.text_transform}`
            );
          } catch (error) {
            console.warn(`Failed to load text transform script: ${settings.text_transform}`);
          }
        }

        if (settings.dom_transforms && settings.dom_transforms.length > 0) {
          scripts.domTransforms = [];
          for (const scriptName of settings.dom_transforms) {
            try {
              const scriptContent = await this.fileStorage.readTextFile(
                this.workspaceId,
                `SOURCE/scripts/${scriptName}`
              );
              scripts.domTransforms.push(scriptContent);
            } catch (error) {
              console.warn(`Failed to load DOM transform script: ${scriptName}`);
            }
          }
        }
      }

      return scripts;
    } catch (error) {
      throw new Error(`Failed to load transform scripts: ${error instanceof Error ? error.message : String(error)}`);
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