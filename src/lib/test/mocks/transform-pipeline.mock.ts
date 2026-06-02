/**
 * Shared Mock Transform Pipeline for Testing
 *
 * Comprehensive mock implementation of TransformPipeline used across all feature modules.
 * Provides controllable simulation of text and DOM transformations with error injection,
 * state tracking, and comprehensive test utilities.
 *
 * Based on the shared mock pattern from workspace-manager.mock.ts, this provides consistent
 * testing capabilities for transformation pipeline operations.
 *
 * Usage:
 * ```typescript
 * import { MockTransformPipeline, createMockTransformPipeline } from '../../../test/mocks/transform-pipeline.mock.js';
 *
 * // For class-based mocking with full control
 * const mockPipeline = new MockTransformPipeline();
 * mockPipeline.setFailureMode('text-transform');
 *
 * // For simple function-based mocking
 * const mockPipeline = createMockTransformPipeline();
 * ```
 */

import type {
  TransformResult,
  PipelineResult,
  BlobUrlManager,
} from '../../transform/transform-pipeline.js';
import type { FileStorageAPI } from '../../storage/index.js';
import type { TransformManager } from '../../transform/transform-manager.js';
import type { TransformExecutor } from '../../transform/transform-executor.js';

export type TransformFailureMode =
  | 'text-transform'
  | 'dom-transform'
  | 'pipeline-execution'
  | 'template-generation'
  | 'context-creation'
  | 'script-loading';

/**
 * Comprehensive mock implementation of TransformPipeline
 *
 * Features:
 * - Rich markdown-like text transformation for demos
 * - Controllable error injection for testing failure scenarios
 * - Operation counting for test verification
 * - Rich helper methods for test setup and verification
 * - Full compatibility with TransformPipeline interface
 */
export class MockTransformPipeline {
  private failureMode: TransformFailureMode | null = null;
  private operationCount = 0;
  private transformHistory: Array<{
    text: string;
    workspaceId: string;
    itemId: string;
    timestamp: number;
  }> = [];

  // Required interface properties (minimal stubs)
  public readonly transformManager: TransformManager = {} as TransformManager;
  public readonly transformExecutor: TransformExecutor = {} as TransformExecutor;
  public readonly fileStorage: FileStorageAPI = {} as FileStorageAPI;
  public readonly blobUrlManager: BlobUrlManager = {
    getLoadedGlobals: () => ({}),
  };

  constructor() {
    this.reset();
  }

  /**
   * Reset mock to initial state
   * Clears failure modes, operation counters, and transform history
   */
  reset(): void {
    this.failureMode = null;
    this.operationCount = 0;
    this.transformHistory = [];
  }

  /**
   * Set failure mode for testing error scenarios
   * @param mode - Type of operation to fail, or null to disable failures
   */
  setFailureMode(mode: TransformFailureMode | null): void {
    this.failureMode = mode;
  }

  /**
   * Get total number of operations performed (for test verification)
   */
  getOperationCount(): number {
    return this.operationCount;
  }

  /**
   * Get transform history for verification
   */
  getTransformHistory(): Array<{
    text: string;
    workspaceId: string;
    itemId: string;
    timestamp: number;
  }> {
    return [...this.transformHistory];
  }

  /**
   * Execute text transformation step
   * Provides rich markdown-like transformation for demos and testing
   */
  async transformText(
    plainText: string,
    workspaceId: string,
    itemId: string
  ): Promise<TransformResult> {
    this.operationCount++;

    if (this.failureMode === 'text-transform') {
      return {
        success: false,
        error: new Error('Mock text transform failure') as any,
        executionTime: 50,
      };
    }

    // Record transform for verification
    this.transformHistory.push({
      text: plainText,
      workspaceId,
      itemId,
      timestamp: Date.now(),
    });

    // Rich markdown-like transformation for demo purposes
    let transformedText = plainText;

    if (transformedText.trim()) {
      transformedText = transformedText
        // Headers
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        // Bold and italic
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Code
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // Links - basic format [text](url)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        // Lists - simple bullet points
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
        // Paragraphs - convert double newlines to paragraph breaks
        .replace(/\n\n/g, '</p>\n<p>')
        // Wrap remaining content in paragraphs
        .replace(/^(?!<[h|ul|li|/])/gm, '<p>')
        .replace(/(?<!>)$/gm, '</p>')
        // Clean up empty paragraphs
        .replace(/<p><\/p>/g, '')
        // Clean up paragraph tags around headers and lists
        .replace(/<p>(<h[1-6]>)/g, '$1')
        .replace(/(<\/h[1-6]>)<\/p>/g, '$1')
        .replace(/<p>(<ul>)/g, '$1')
        .replace(/(<\/ul>)<\/p>/g, '$1');
    }

    return {
      success: true,
      transformedText,
      warnings: [],
      executionTime: 25,
    };
  }

  /**
   * Execute DOM transformation step
   */
  async transformDOM(document: Document, workspaceId: string, itemId: string): Promise<Document> {
    this.operationCount++;

    if (this.failureMode === 'dom-transform') {
      throw new Error('Mock DOM transform failure');
    }

    // Simple mock DOM transformation - just return the document
    return document;
  }

  /**
   * Execute complete transformation pipeline
   */
  async executeTransformPipeline(
    plainText: string,
    workspaceId: string,
    spineItemId: string,
    metadata: any
  ): Promise<PipelineResult> {
    this.operationCount++;

    if (this.failureMode === 'pipeline-execution') {
      return {
        success: false,
        error: new Error('Mock pipeline execution failure') as any,
        executionTime: 100,
      };
    }

    try {
      // Step 1: Transform text
      const textResult = await this.transformText(plainText, workspaceId, spineItemId);

      if (!textResult.success) {
        return {
          success: false,
          error: textResult.error,
          executionTime: 100,
        };
      }

      // Step 2: Create XHTML document
      const xhtmlContent = this.generateXHTMLDocument(textResult.transformedText || '', metadata);
      const parser = new DOMParser();
      const xhtmlDocument = parser.parseFromString(xhtmlContent, 'application/xhtml+xml');

      return {
        success: true,
        xhtmlDocument,
        warnings: textResult.warnings,
        executionTime: 100,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? (error as any) : (new Error('Unknown pipeline error') as any),
        executionTime: 100,
      };
    }
  }

  /**
   * Generate XHTML document from transformed content
   */
  private generateXHTMLDocument(bodyContent: string, metadata: any): string {
    if (this.failureMode === 'template-generation') {
      throw new Error('Mock template generation failure');
    }

    const title = metadata?.title || 'Untitled';

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${this.escapeXml(title)}</title>
  <meta charset="UTF-8"/>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Test utility methods

  /**
   * Set up mock to return specific transformed content
   * @param content - Content to return from transformText
   */
  setMockTransformResult(content: string): void {
    // Override transformText to return specific content
    const originalTransformText = this.transformText.bind(this);
    this.transformText = async (plainText: string, workspaceId: string, itemId: string) => {
      this.operationCount++;
      this.transformHistory.push({
        text: plainText,
        workspaceId,
        itemId,
        timestamp: Date.now(),
      });

      return {
        success: true,
        transformedText: content,
        warnings: [],
        executionTime: 25,
      };
    };
  }

  /**
   * Check if specific text was transformed
   * @param text - Text to check for in transform history
   */
  wasTextTransformed(text: string): boolean {
    return this.transformHistory.some(entry => entry.text.includes(text));
  }

  /**
   * Get transform count for specific workspace
   * @param workspaceId - Workspace to check
   */
  getTransformCountForWorkspace(workspaceId: string): number {
    return this.transformHistory.filter(entry => entry.workspaceId === workspaceId).length;
  }
}

/**
 * Factory function for creating fresh mock instances in tests
 *
 * Use this when you need a class-based mock with full control over state and error simulation.
 */
export function createMockTransformPipeline(): MockTransformPipeline {
  return new MockTransformPipeline();
}
