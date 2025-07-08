/**
 * Test Utilities for Settings Manager
 * 
 * Mock helpers and testing utilities for Settings Manager test suite.
 */

import { vi, expect } from 'vitest';
import type { ExtensionManager } from '../../extensions/index.js';
import type { WorkspaceSettings, EPUBSettings } from '../index.js';

// ============================================================================
// Mock Creators
// ============================================================================

/**
 * Creates a mock FileStorageAPI for testing using Vitest mock functions
 */
export function createMockFileStorage() {
  return {
    // Core file operations
    readFile: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    writeFile: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    renameFile: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue([]),
    fileExists: vi.fn().mockResolvedValue(true),
    getFileInfo: vi.fn().mockResolvedValue({ size: 0, lastModified: new Date() }),
    
    // Text file utilities
    readTextFile: vi.fn().mockResolvedValue('{}'),
    writeTextFile: vi.fn().mockResolvedValue(undefined),
    
    // Workspace operations
    createWorkspace: vi.fn().mockResolvedValue('test-workspace'),
    deleteWorkspace: vi.fn().mockResolvedValue(undefined),
    listWorkspaces: vi.fn().mockResolvedValue([]),
    
    // System methods
    init: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
    destroy: vi.fn().mockReturnValue(undefined),
    getQuota: vi.fn().mockResolvedValue({ used: 0, available: 1000000 }),
    getBackendType: vi.fn().mockReturnValue('indexeddb'),
    estimateWorkspaceSize: vi.fn().mockResolvedValue(0),
    supportsDirectBlobURLs: vi.fn().mockReturnValue(false),
    getFile: vi.fn().mockResolvedValue(new File([], 'test.txt')),
    manager: undefined
  };
}

/**
 * Creates a mock ExtensionManager for testing
 */
export function createMockExtensionManager() {
  return {
    listWorkspaceExtensions: vi.fn().mockResolvedValue([])
  } satisfies Partial<ExtensionManager>;
}

// ============================================================================
// localStorage Mock Setup
// ============================================================================

/**
 * Sets up localStorage mock for testing
 */
export function setupLocalStorageMock() {
  const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  };

  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true
  });

  return mockLocalStorage;
}

// ============================================================================
// Integration Test Helpers
// ============================================================================

/**
 * Creates a temporary workspace ID for integration tests
 */
export async function createTempWorkspace(): Promise<string> {
  const workspaceId = `test-workspace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return workspaceId;
}

/**
 * Cleans up temporary workspace files
 */
export async function cleanupTempWorkspace(workspaceId: string): Promise<void> {
  // In real implementation, this would clean up temp files
  // For unit tests, this is mostly a no-op but maintains the interface
  console.debug(`Cleaning up workspace: ${workspaceId}`);
}

// ============================================================================
// Behavior Verification Helpers
// ============================================================================

/**
 * Verifies that workspace settings were saved correctly
 */
export function expectWorkspaceSettingsSaved(
  mockStorage: ReturnType<typeof createMockFileStorage>,
  workspaceId: string,
  settings: WorkspaceSettings
) {
  expect(mockStorage.writeTextFile).toHaveBeenCalledWith(
    workspaceId,
    '.workspace-metadata.json',
    expect.stringContaining('"settings":')
  );
  
  // Also verify settings are included
  const calls = mockStorage.writeTextFile.mock.calls;
  const lastCall = calls[calls.length - 1];
  if (lastCall && lastCall[2]) {
    const savedData = JSON.parse(lastCall[2]);
    expect(savedData.settings).toEqual(settings);
  }
}

/**
 * Verifies that EPUB settings were saved correctly
 */
export function expectEPUBSettingsSaved(
  mockStorage: ReturnType<typeof createMockFileStorage>,
  workspaceId: string,
  settings: EPUBSettings
) {
  expect(mockStorage.writeTextFile).toHaveBeenCalledWith(
    workspaceId,
    'SOURCE/settings.json',
    JSON.stringify(settings, null, 2)
  );
}

/**
 * Verifies that global settings were saved to localStorage
 */
export function expectGlobalSettingsSaved(
  mockLocalStorage: ReturnType<typeof setupLocalStorageMock>,
  settings: any
) {
  expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
    'editme_global_settings',
    JSON.stringify(settings)
  );
}

/**
 * Verifies that file existence was checked
 */
export function expectFileExistenceChecked(
  mockStorage: ReturnType<typeof createMockFileStorage>,
  workspaceId: string,
  path: string
) {
  expect(mockStorage.fileExists).toHaveBeenCalledWith(workspaceId, path);
}

/**
 * Verifies that files were listed from a directory
 */
export function expectFilesListed(
  mockStorage: ReturnType<typeof createMockFileStorage>,
  workspaceId: string,
  directory: string
) {
  expect(mockStorage.listFiles).toHaveBeenCalledWith(workspaceId, directory);
}

// ============================================================================
// Mock Return Value Helpers
// ============================================================================

/**
 * Sets up mock to return specific workspace settings
 */
export function mockWorkspaceSettingsReturn(
  mockStorage: ReturnType<typeof createMockFileStorage>,
  settings: WorkspaceSettings
) {
  const metadata = createWorkspaceMetadata(settings);
  mockStorage.readTextFile.mockResolvedValueOnce(JSON.stringify(metadata));
}

/**
 * Sets up mock to return specific EPUB settings
 */
export function mockEPUBSettingsReturn(
  mockStorage: ReturnType<typeof createMockFileStorage>,
  settings: EPUBSettings
) {
  mockStorage.readTextFile.mockResolvedValueOnce(JSON.stringify(settings));
}

/**
 * Sets up mock to simulate file not found error
 */
export function mockFileNotFound(
  mockStorage: ReturnType<typeof createMockFileStorage>
) {
  mockStorage.readTextFile.mockRejectedValueOnce(new Error('File not found'));
}

/**
 * Sets up mock to simulate corrupted JSON error
 */
export function mockCorruptedJSON(
  mockStorage: ReturnType<typeof createMockFileStorage>
) {
  mockStorage.readTextFile.mockResolvedValueOnce('invalid json content');
}

/**
 * Sets up mock to return specific files in a directory
 */
export function mockDirectoryListing(
  mockStorage: ReturnType<typeof createMockFileStorage>,
  files: string[]
) {
  mockStorage.listFiles.mockResolvedValueOnce(files);
}

/**
 * Sets up mock to return specific file existence results
 */
export function mockFileExistence(
  mockStorage: ReturnType<typeof createMockFileStorage>,
  exists: boolean
) {
  mockStorage.fileExists.mockResolvedValueOnce(exists);
}

// ============================================================================
// Error Simulation Helpers
// ============================================================================

/**
 * Simulates localStorage quota exceeded error
 */
export function simulateLocalStorageQuotaError(
  mockLocalStorage: ReturnType<typeof setupLocalStorageMock>
) {
  mockLocalStorage.setItem.mockImplementation(() => {
    throw new DOMException('QuotaExceededError', 'QuotaExceededError');
  });
}

/**
 * Simulates localStorage access denied error
 */
export function simulateLocalStorageAccessError(
  mockLocalStorage: ReturnType<typeof setupLocalStorageMock>
) {
  mockLocalStorage.getItem.mockImplementation(() => {
    throw new Error('Access denied');
  });
}

/**
 * Simulates file system write permission error
 */
export function simulateFileWriteError(
  mockStorage: ReturnType<typeof createMockFileStorage>
) {
  mockStorage.writeTextFile.mockRejectedValueOnce(new Error('Permission denied'));
}

/**
 * Simulates file system read permission error
 */
export function simulateFileReadError(
  mockStorage: ReturnType<typeof createMockFileStorage>
) {
  mockStorage.readTextFile.mockRejectedValueOnce(new Error('Permission denied'));
}

// ============================================================================
// Test Data Helpers
// ============================================================================

/**
 * Creates a minimal valid workspace metadata structure
 */
export function createWorkspaceMetadata(settings: WorkspaceSettings) {
  return {
    version: '1.0',
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    settings
  };
}

/**
 * Resets all mocks to their initial state
 */
export function resetAllMocks(
  mockStorage: ReturnType<typeof createMockFileStorage>,
  mockExtensionManager: ReturnType<typeof createMockExtensionManager>,
  mockLocalStorage: ReturnType<typeof setupLocalStorageMock>
) {
  vi.clearAllMocks();
  
  // Reset to default implementations
  mockStorage.readTextFile.mockResolvedValue('{}');
  mockStorage.writeTextFile.mockResolvedValue(undefined);
  mockStorage.listFiles.mockResolvedValue([]);
  mockStorage.fileExists.mockResolvedValue(true);
  
  mockExtensionManager.listWorkspaceExtensions.mockResolvedValue([]);
  
  mockLocalStorage.getItem.mockReturnValue(null);
  mockLocalStorage.setItem.mockImplementation(() => {});
}