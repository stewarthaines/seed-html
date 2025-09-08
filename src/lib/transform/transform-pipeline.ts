/**
 * Transform Pipeline Implementation
 *
 * Core transformation pipeline that executes text and DOM transforms
 * to convert plain text sources into XHTML spine items.
 */

import type { FileStorageAPI } from '../storage/index.js';
import { TransformManager } from './transform-manager.js';
import { TransformExecutor, type TransformContext } from './transform-executor.js';
import { TransformError } from './transform-error.js';
import { generateXHTMLDocument, type ChapterMetadata } from './xhtml-template.js';

export interface TransformResult {
  success: boolean;
  transformedText?: string;
  xhtmlDocument?: Document;
  warnings?: string[];
  error?: TransformError;
  executionTime?: number;
}

export interface PipelineResult {
  success: boolean;
  xhtmlDocument?: Document;
  warnings?: string[];
  error?: TransformError;
  executionTime?: number;
}

export interface BlobUrlManager {
  getLoadedGlobals(): Record<string, any>;
}

/**
 * Main transform pipeline for converting plain text to XHTML
 */
export class TransformPipeline {
  private transformManager: TransformManager;
  private transformExecutor: TransformExecutor;

  constructor(
    private fileStorage: FileStorageAPI,
    private blobUrlManager: BlobUrlManager
  ) {
    this.transformManager = new TransformManager(fileStorage);
    this.transformExecutor = new TransformExecutor();
  }

  /**
   * Execute complete transformation pipeline
   */
  async executeTransformPipeline(
    plainText: string,
    workspaceId: string,
    p0: number,
    spineItemId: string,
    p1: {},
    metadata: ChapterMetadata
  ): Promise<PipelineResult> {
    const startTime = Date.now();

    try {
      // Step 1: Execute text transformation
      const textResult = await this.transformText(plainText, workspaceId, spineItemId);

      if (!textResult.success) {
        return {
          success: false,
          error: textResult.error,
          executionTime: Date.now() - startTime,
        };
      }

      // Step 2: Parse HTML to DOM
      const parser = new DOMParser();
      const document = parser.parseFromString(
        `<div>${textResult.transformedText}</div>`,
        'text/html'
      );

      // Step 3: Execute DOM transformations
      const transformedDocument = await this.transformDOM(document, workspaceId, spineItemId);

      // Step 4: Generate final XHTML document
      const bodyContent =
        transformedDocument.querySelector('div')?.innerHTML || transformedDocument.body.innerHTML;
      const xhtmlString = this.generateXHTMLDocument(bodyContent, metadata);

      // Parse XHTML to Document object
      const xhtmlDocument = parser.parseFromString(xhtmlString, 'application/xhtml+xml');

      return {
        success: true,
        xhtmlDocument,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof TransformError) {
        return {
          success: false,
          error,
          executionTime: Date.now() - startTime,
        };
      }

      return {
        success: false,
        error: new TransformError({
          stage: 'template',
          message: error instanceof Error ? error.message : 'Unknown pipeline error',
        }),
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute text transformation step
   */
  async transformText(
    plainText: string,
    workspaceId: string,
    _spineItemId: string
  ): Promise<TransformResult> {
    const startTime = Date.now();

    try {
      // Load transform scripts
      const scripts = await this.transformManager.loadTransformScripts(workspaceId);

      if (!scripts.textTransform) {
        // No text transform configured - return plain text wrapped in paragraph
        const wrappedText = plainText ? `<p>${this.escapeHtml(plainText)}</p>` : '';

        return {
          success: true,
          transformedText: wrappedText,
          executionTime: Date.now() - startTime,
        };
      }

      // Get loaded extension libraries
      const extensionLibraries = this.blobUrlManager.getLoadedGlobals();

      // Create transform context
      const context: TransformContext = {
        manifestItems: {}, // Would be populated with actual manifest items in real usage
      };

      // Execute text transform
      const transformedText = await this.transformExecutor.executeTextTransform(
        scripts.textTransform.content,
        scripts.textTransform.filename,
        plainText,
        context,
        {
          timeoutMs: scripts.settings.transform_pipeline?.timeout_ms || 2000,
          globals: extensionLibraries,
        }
      );

      return {
        success: true,
        transformedText,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof TransformError) {
        return {
          success: false,
          error,
          executionTime: Date.now() - startTime,
        };
      }

      return {
        success: false,
        error: new TransformError({
          stage: 'text',
          message: error instanceof Error ? error.message : 'Unknown text transform error',
        }),
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute DOM transformation step
   */
  async transformDOM(
    document: Document,
    workspaceId: string,
    _spineItemId: string
  ): Promise<Document> {
    try {
      // Load transform scripts
      const scripts = await this.transformManager.loadTransformScripts(workspaceId);

      if (scripts.domTransforms.length === 0) {
        // No DOM transforms configured - return cloned document
        return document.cloneNode(true) as Document;
      }

      // Get loaded extension libraries
      const extensionLibraries = this.blobUrlManager.getLoadedGlobals();

      let currentDocument = document;

      // Execute DOM transforms sequentially
      for (const script of scripts.domTransforms) {
        currentDocument = await this.transformExecutor.executeDOMTransform(
          script.content,
          script.filename,
          currentDocument,
          {},
          {
            timeoutMs: scripts.settings.transform_pipeline?.timeout_ms || 2000,
            globals: extensionLibraries,
          }
        );
      }

      return currentDocument;
    } catch (error) {
      if (error instanceof TransformError) {
        throw error;
      }

      throw new TransformError({
        stage: 'dom',
        message: error instanceof Error ? error.message : 'Unknown DOM transform error',
      });
    }
  }

  /**
   * Generate XHTML document with metadata
   */
  generateXHTMLDocument(content: string, metadata: ChapterMetadata): string {
    return generateXHTMLDocument(content, metadata);
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
