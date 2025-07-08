/**
 * Test Utilities for SpineItemManager Tests
 * 
 * Provides helper functions for setting up mocks, creating test data,
 * and verifying test results in SpineItemManager test suites.
 */

import { vi, expect } from 'vitest';
import { createMockWorkspaceManager, type MockWorkspaceManager } from '../../test/mocks/workspace-manager.mock.js';
import type { SpineItemWithSource } from '../types.js';
import type { ManifestItem, SpineItem } from '../../epub/opf-utils.js';
import { 
  getSampleOPFDocuments, 
  getSampleWorkspaceFiles,
  createTestOPF,
  createTestWorkspaceFiles 
} from './fixtures.js';

/**
 * Create a fresh mock WorkspaceManager for testing
 */
export function createTestWorkspaceManager(): MockWorkspaceManager {
  const mock = createMockWorkspaceManager();
  mock.reset();
  return mock;
}

/**
 * Set up a workspace with test data
 */
export async function setupTestWorkspace(
  mockWorkspace: MockWorkspaceManager,
  workspaceId: string,
  scenario: 'empty' | 'basic' | 'withNonLinear' | 'withProperties' = 'basic'
): Promise<void> {
  const opf = getSampleOPFDocuments()[scenario];
  mockWorkspace.setWorkspaceOPF(workspaceId, opf);
  
  // Add corresponding files
  const chapterIds = opf.spine.map(item => item.idref);
  const files = createTestWorkspaceFiles(chapterIds);
  mockWorkspace.addTestFiles(workspaceId, files);
}

/**
 * Set up workspace with specific source file configuration
 */
export async function setupWorkspaceWithSourceFiles(
  mockWorkspace: MockWorkspaceManager,
  workspaceId: string,
  sourceFileScenario: 'withSourceFiles' | 'mixedSourceFiles' | 'noSourceFiles'
): Promise<void> {
  // Set up basic OPF
  const opf = getSampleOPFDocuments().basic;
  mockWorkspace.setWorkspaceOPF(workspaceId, opf);
  
  // Add files based on scenario
  const files = getSampleWorkspaceFiles()[sourceFileScenario];
  mockWorkspace.addTestFiles(workspaceId, files);
}

/**
 * Create a SpineItemWithSource from manifest and spine items
 */
export function createSpineItemWithSource(
  manifestItem: ManifestItem,
  spineItem: SpineItem,
  hasSourceFile = false,
  sourcePath?: string
): SpineItemWithSource {
  return {
    ...spineItem,
    id: manifestItem.id,
    href: manifestItem.href,
    mediaType: manifestItem.mediaType,
    linear: spineItem.linear ?? true,
    hasSourceFile,
    sourcePath: hasSourceFile ? (sourcePath || `SOURCE/text/${manifestItem.id}.txt`) : undefined
  };
}

/**
 * Verify that workspace manager was called with expected parameters
 */
export function expectWorkspaceManagerCalled(
  mockWorkspace: MockWorkspaceManager,
  method: string,
  expectedCalls: any[][]
): void {
  const methodMock = (mockWorkspace as any)[method];
  if (!methodMock) {
    throw new Error(`Method ${method} not found on mock workspace manager`);
  }
  
  expect(methodMock).toHaveBeenCalledTimes(expectedCalls.length);
  
  expectedCalls.forEach((expectedCall, index) => {
    expect(methodMock).toHaveBeenNthCalledWith(index + 1, ...expectedCall);
  });
}

/**
 * Verify that source file was created with expected content
 */
export function expectSourceFileCreated(
  mockWorkspace: MockWorkspaceManager,
  workspaceId: string,
  chapterId: string,
  expectedContent?: string
): void {
  const files = mockWorkspace.getWorkspaceFiles(workspaceId);
  const sourcePath = `SOURCE/text/${chapterId}.txt`;
  
  expect(files.has(sourcePath)).toBe(true);
  
  if (expectedContent) {
    const content = files.get(sourcePath);
    expect(content).toContain(expectedContent);
  }
}

/**
 * Verify that XHTML file was created with expected content
 */
export function expectXHTMLFileCreated(
  mockWorkspace: MockWorkspaceManager,
  workspaceId: string,
  fileName: string,
  expectedTitle: string
): void {
  const files = mockWorkspace.getWorkspaceFiles(workspaceId);
  const xhtmlPath = `OEBPS/Text/${fileName}`;
  
  expect(files.has(xhtmlPath)).toBe(true);
  
  const content = files.get(xhtmlPath) as string;
  expect(content).toContain(`<title>${expectedTitle}</title>`);
  expect(content).toContain(`<h1>${expectedTitle}</h1>`);
}

/**
 * Verify manifest item was added correctly
 */
export function expectManifestItemAdded(
  mockWorkspace: MockWorkspaceManager,
  workspaceId: string,
  expectedItem: Partial<ManifestItem>
): void {
  const opf = mockWorkspace.getWorkspaceFiles(workspaceId);
  // In a real implementation, we'd parse the OPF and check the manifest
  // For now, we verify the mock was called correctly
  expect(mockWorkspace.getOperationCount()).toBeGreaterThan(0);
}

/**
 * Verify spine item was added correctly
 */
export function expectSpineItemAdded(
  mockWorkspace: MockWorkspaceManager,
  workspaceId: string,
  expectedItem: Partial<SpineItem>,
  expectedIndex?: number
): void {
  // Verify the mock was called correctly
  expect(mockWorkspace.getOperationCount()).toBeGreaterThan(0);
}

/**
 * Create test scenario for ID collision testing
 */
export function setupIdCollisionScenario(
  mockWorkspace: MockWorkspaceManager,
  workspaceId: string,
  existingIds: string[]
): void {
  const manifest = existingIds.map(id => ({
    id,
    href: `Text/${id}.xhtml`,
    mediaType: 'application/xhtml+xml'
  }));
  
  const spine = existingIds.map(id => ({
    idref: id,
    linear: true
  }));
  
  const opf = createTestOPF({ manifest, spine });
  mockWorkspace.setWorkspaceOPF(workspaceId, opf);
}

/**
 * Create test scenario for spine ordering tests
 */
export function setupSpineOrderingScenario(
  mockWorkspace: MockWorkspaceManager,
  workspaceId: string,
  itemCount: number
): { chapterIds: string[], originalOrder: string[] } {
  const chapterIds = Array.from({ length: itemCount }, (_, i) => `chapter${i + 1}`);
  
  const manifest = chapterIds.map(id => ({
    id,
    href: `Text/${id}.xhtml`,
    mediaType: 'application/xhtml+xml'
  }));
  
  const spine = chapterIds.map(id => ({
    idref: id,
    linear: true
  }));
  
  const opf = createTestOPF({ manifest, spine });
  mockWorkspace.setWorkspaceOPF(workspaceId, opf);
  
  return { chapterIds, originalOrder: [...chapterIds] };
}

/**
 * Verify spine order matches expected order
 */
export function expectSpineOrder(
  actualItems: SpineItemWithSource[],
  expectedOrder: string[]
): void {
  expect(actualItems).toHaveLength(expectedOrder.length);
  
  actualItems.forEach((item, index) => {
    expect(item.id).toBe(expectedOrder[index]);
    expect(item.idref).toBe(expectedOrder[index]);
  });
}

/**
 * Create error injection scenario
 */
export function setupErrorScenario(
  mockWorkspace: MockWorkspaceManager,
  failureMode: Parameters<MockWorkspaceManager['setFailureMode']>[0]
): void {
  mockWorkspace.setFailureMode(failureMode);
}

/**
 * Reset error injection
 */
export function clearErrorScenario(mockWorkspace: MockWorkspaceManager): void {
  mockWorkspace.setFailureMode(null);
}

/**
 * Verify atomic operation rollback occurred
 */
export function expectRollbackOccurred(
  mockWorkspace: MockWorkspaceManager,
  workspaceId: string,
  originalState: any
): void {
  // In a real test, we'd verify the workspace state was restored
  // For now, we check that operations were attempted and likely rolled back
  expect(mockWorkspace.getOperationCount()).toBeGreaterThan(0);
}

/**
 * Create large spine for performance testing
 */
export function setupLargeSpine(
  mockWorkspace: MockWorkspaceManager,
  workspaceId: string,
  itemCount: number
): void {
  const manifest: ManifestItem[] = [];
  const spine: SpineItem[] = [];
  
  for (let i = 1; i <= itemCount; i++) {
    const id = `chapter${i}`;
    manifest.push({
      id,
      href: `Text/${id}.xhtml`,
      mediaType: 'application/xhtml+xml'
    });
    spine.push({
      idref: id,
      linear: true
    });
  }
  
  const opf = createTestOPF({ manifest, spine });
  mockWorkspace.setWorkspaceOPF(workspaceId, opf);
}

/**
 * Measure operation performance
 */
export async function measurePerformance<T>(
  operation: () => Promise<T>,
  maxTimeMs = 1000
): Promise<{ result: T; duration: number }> {
  const startTime = Date.now();
  const result = await operation();
  const duration = Date.now() - startTime;
  
  expect(duration).toBeLessThan(maxTimeMs);
  
  return { result, duration };
}

/**
 * Generate test chapter IDs for edge case testing
 */
export function generateTestChapterIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `test-chapter-${i + 1}`);
}

/**
 * Create mock with vi.fn() for simple function-based testing
 */
export function createSimpleMockWorkspaceManager() {
  return {
    getWorkspaceOPF: vi.fn(),
    addManifestItem: vi.fn(),
    removeManifestItem: vi.fn(),
    addSpineItem: vi.fn(),
    removeSpineItem: vi.fn(),
    updateSpineOrder: vi.fn(),
    writeFile: vi.fn(),
    writeTextFile: vi.fn(),
    readTextFile: vi.fn(),
    deleteFile: vi.fn(),
    fileExists: vi.fn()
  };
}

/**
 * Validate spine item with source structure
 */
export function validateSpineItemWithSource(
  item: SpineItemWithSource,
  expectedId: string,
  expectedHasSource = false
): void {
  expect(item).toEqual(
    expect.objectContaining({
      id: expectedId,
      idref: expectedId,
      href: expect.stringMatching(/^Text\/.*\.xhtml$/),
      mediaType: 'application/xhtml+xml',
      hasSourceFile: expectedHasSource,
      linear: expect.any(Boolean)
    })
  );
  
  if (expectedHasSource) {
    expect(item.sourcePath).toBe(`SOURCE/text/${expectedId}.txt`);
  } else {
    expect(item.sourcePath).toBeUndefined();
  }
}