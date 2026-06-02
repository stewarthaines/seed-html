/**
 * Vitest-Enhanced Transform Pipeline Mock
 *
 * This file provides Vitest-specific mock utilities for TransformPipeline testing.
 * Uses vi.fn() spies and advanced mocking capabilities.
 *
 * For basic mocking without Vitest dependencies, use transform-pipeline.mock.ts instead.
 *
 * Usage:
 * ```typescript
 * import { createMockTransformPipelineVi } from '../../../test/mocks/transform-pipeline-vitest.mock.js';
 *
 * const mockPipeline = createMockTransformPipelineVi();
 * mockPipeline.transformText.mockResolvedValue({ success: true, transformedText: 'test' });
 * ```
 */

import { vi } from 'vitest';
import { MockTransformPipeline } from './transform-pipeline.mock.js';

/**
 * Create mock TransformPipeline with vi.fn() methods for advanced Vitest testing
 *
 * This provides function spies and mock control for detailed test verification.
 * Use the base MockTransformPipeline class for Storybook or general testing.
 */
export function createMockTransformPipelineVi() {
  const mock = new MockTransformPipeline();

  return {
    transformText: vi
      .fn()
      .mockImplementation((plainText: string, workspaceId: string, itemId: string) =>
        mock.transformText(plainText, workspaceId, itemId)
      ),
    transformDOM: vi
      .fn()
      .mockImplementation((document: Document, workspaceId: string, itemId: string) =>
        mock.transformDOM(document, workspaceId, itemId)
      ),
    executeTransformPipeline: vi
      .fn()
      .mockImplementation(
        (plainText: string, workspaceId: string, spineItemId: string, metadata: any) =>
          mock.executeTransformPipeline(plainText, workspaceId, spineItemId, metadata)
      ),

    // Required interface properties
    transformManager: mock.transformManager,
    transformExecutor: mock.transformExecutor,
    fileStorage: mock.fileStorage,
    blobUrlManager: mock.blobUrlManager,

    // Expose mock instance for direct manipulation
    _mockInstance: mock,
  };
}
