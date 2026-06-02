/**
 * Vitest-Enhanced File Storage Mock
 *
 * This file provides Vitest-specific mock utilities for FileStorageAPI testing.
 * Uses vi.fn() spies and advanced mocking capabilities.
 *
 * For basic mocking without Vitest dependencies, use file-storage.mock.ts instead.
 *
 * Usage:
 * ```typescript
 * import { createVitestMockFileStorage } from '../../../test/mocks/file-storage-vitest.mock.js';
 *
 * const mockStorage = createVitestMockFileStorage();
 * mockStorage.readTextFile.mockResolvedValue('test content');
 * ```
 */

import { vi } from 'vitest';
import { MockFileStorage, type FailureMode } from './file-storage.mock.js';

/**
 * Create Vitest-based mock functions for FileStorageAPI
 *
 * Use this when you need .mockResolvedValue() and .mockRejectedValue() patterns
 * in your tests. This creates proper Vitest mock functions that can be controlled
 * with standard Jest/Vitest mock API.
 *
 * This function wraps the MockFileStorage class with Vitest spy functions
 * to provide both stateful behavior and Vitest mock API compatibility.
 */
export function createVitestMockFileStorage() {
  const mockStorage = new MockFileStorage();

  return {
    // Core workspace operations with Vitest spy wrappers
    createWorkspace: vi.fn().mockImplementation((id?: string) => mockStorage.createWorkspace(id)),
    deleteWorkspace: vi.fn().mockImplementation((id: string) => mockStorage.deleteWorkspace(id)),
    listWorkspaces: vi.fn().mockImplementation(() => mockStorage.listWorkspaces()),

    // File operations with Vitest spy wrappers
    writeTextFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string, content: string) =>
        mockStorage.writeTextFile(workspaceId, path, content)
      ),
    writeFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string, content: string | ArrayBuffer) =>
        mockStorage.writeFile(workspaceId, path, content)
      ),
    readTextFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string) =>
        mockStorage.readTextFile(workspaceId, path)
      ),
    readFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string) =>
        mockStorage.readFile(workspaceId, path)
      ),
    deleteFile: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string) =>
        mockStorage.deleteFile(workspaceId, path)
      ),
    fileExists: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string) =>
        mockStorage.fileExists(workspaceId, path)
      ),
    workspaceExists: vi
      .fn()
      .mockImplementation((workspaceId: string) => mockStorage.workspaceExists(workspaceId)),
    listFiles: vi
      .fn()
      .mockImplementation((workspaceId: string, directory?: string) =>
        mockStorage.listFiles(workspaceId, directory)
      ),
    getFileInfo: vi
      .fn()
      .mockImplementation((workspaceId: string, path: string) =>
        mockStorage.getFileInfo(workspaceId, path)
      ),

    // System methods
    getQuota: vi.fn().mockImplementation(() => mockStorage.getQuota()),
    init: vi.fn().mockImplementation(() => mockStorage.init()),
    isInitialized: vi.fn().mockImplementation(() => mockStorage.isInitialized()),

    // Test utility methods - direct access to underlying MockFileStorage
    addTestFiles: vi
      .fn()
      .mockImplementation((workspaceId: string, files: Record<string, string | ArrayBuffer>) =>
        mockStorage.addTestFiles(workspaceId, files)
      ),
    reset: vi.fn().mockImplementation(() => mockStorage.reset()),
    hasWorkspace: vi
      .fn()
      .mockImplementation((workspaceId: string) => mockStorage.hasWorkspace(workspaceId)),
    setFailureMode: vi
      .fn()
      .mockImplementation((mode: FailureMode | null) => mockStorage.setFailureMode(mode)),

    // Expose underlying MockFileStorage instance for advanced test scenarios
    _mockInstance: mockStorage,
  };
}
