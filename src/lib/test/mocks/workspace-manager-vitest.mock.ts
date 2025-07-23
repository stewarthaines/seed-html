/**
 * Vitest-Enhanced Workspace Manager Mock
 *
 * This file provides Vitest-specific mock utilities for WorkspaceManager testing.
 * Uses vi.fn() spies and advanced mocking capabilities.
 * 
 * For basic mocking without Vitest dependencies, use workspace-manager.mock.ts instead.
 *
 * Usage:
 * ```typescript
 * import { createMockWorkspaceManagerVi } from '../../../test/mocks/workspace-manager-vitest.mock.js';
 *
 * const mockWorkspace = createMockWorkspaceManagerVi();
 * mockWorkspace.readTextFile.mockResolvedValue('test content');
 * ```
 */

import { vi } from 'vitest';
import { MockWorkspaceManager, type MockOPFDocument } from './workspace-manager.mock.js';
import type { OPFDocument, ManifestItem, SpineItem } from '../../epub/opf-utils.js';

/**
 * Create mock WorkspaceManager with vi.fn() methods for advanced Vitest testing
 * 
 * This provides function spies and mock control for detailed test verification.
 * Use the base MockWorkspaceManager class for Storybook or general testing.
 */
export function createMockWorkspaceManagerVi() {
  const mock = new MockWorkspaceManager();

  return {
    getWorkspaceOPF: vi
      .fn()
      .mockImplementation((workspaceId: string) => mock.getWorkspaceOPF(workspaceId)),
    loadOPF: vi.fn().mockImplementation((workspaceId: string) => mock.loadOPF(workspaceId)),
    saveOPF: vi
      .fn()
      .mockImplementation((workspaceId: string, opf: MockOPFDocument) =>
        mock.saveOPF(workspaceId, opf)
      ),
    updateWorkspaceOPF: vi
      .fn()
      .mockImplementation((workspaceId: string, opf: OPFDocument) =>
        mock.updateWorkspaceOPF(workspaceId, opf)
      ),
    addManifestItem: vi
      .fn()
      .mockImplementation((workspaceId: string, item: ManifestItem) =>
        mock.addManifestItem(workspaceId, item)
      ),
    removeManifestItem: vi
      .fn()
      .mockImplementation((workspaceId: string, itemId: string) =>
        mock.removeManifestItem(workspaceId, itemId)
      ),
    addSpineItem: vi
      .fn()
      .mockImplementation((workspaceId: string, item: SpineItem, insertIndex?: number) =>
        mock.addSpineItem(workspaceId, item, insertIndex)
      ),
    removeSpineItem: vi
      .fn()
      .mockImplementation((workspaceId: string, itemIdref: string) =>
        mock.removeSpineItem(workspaceId, itemIdref)
      ),
    updateSpineOrder: vi
      .fn()
      .mockImplementation((workspaceId: string, orderedIdrefs: string[]) =>
        mock.updateSpineOrder(workspaceId, orderedIdrefs)
      ),
    writeFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string, content: string | ArrayBuffer) =>
        mock.writeFile(workspaceId, path, content)
      ),
    writeTextFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string, content: string) =>
        mock.writeTextFile(workspaceId, path, content)
      ),
    readFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string) => mock.readFile(workspaceId, path)),
    readTextFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string) =>
        mock.readTextFile(workspaceId, path)
      ),
    deleteFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string) =>
        mock.deleteFile(workspaceId, path)
      ),
    fileExists: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string) =>
        mock.fileExists(workspaceId, path)
      ),
    listSourceFiles: vi
      .fn()
      .mockImplementation((workspaceId: string) => mock.listSourceFiles(workspaceId)),
    getSourceFile: vi
      .fn()
      .mockImplementation((workspaceId: string, sourcePath: string) =>
        mock.getSourceFile(workspaceId, sourcePath)
      ),
    isAdvancedModeEnabled: vi
      .fn()
      .mockImplementation((workspaceId: string) => mock.isAdvancedModeEnabled(workspaceId)),
    exists: vi.fn().mockImplementation((workspaceId: string) => mock.exists(workspaceId)),

    // Expose mock instance for direct manipulation
    _mockInstance: mock,
  };
}