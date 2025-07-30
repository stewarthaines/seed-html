/**
 * Test utilities for OutlineGenerator testing
 *
 * Provides setup helpers that use the shared WorkspaceManager mock
 * and behavior verification utilities for consistent testing.
 */

import { vi, expect } from 'vitest';
import { MockWorkspaceManager } from '../../test/mocks/workspace-manager.mock.js';
import type { TransformPipeline } from '../../transform/transform-pipeline.js';
import {
  createWorkspaceFiles,
  createMixedWorkspaceFiles,
  createProblematicWorkspaceFiles,
  expectValidEPUBStructure,
  expectValidNavigationMetadata,
} from './fixtures.js';

/**
 * Create test workspace manager using shared mock
 * Ensures clean state for each test
 */
export function createTestWorkspaceManager(): MockWorkspaceManager {
  const mock = new MockWorkspaceManager();
  mock.reset(); // Ensure clean state
  return mock;
}

/**
 * Create mock transform pipeline for user content processing tests
 */
export function createMockTransformPipeline() {
  return {
    transformText: vi.fn().mockResolvedValue({
      transformedContent: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Navigation</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <nav epub:type="toc" role="navigation">
    <h1>Navigation</h1>
    <ol>
      <li><a href="chapter1.xhtml">Chapter 1: The Beginning</a></li>
      <li><a href="chapter2.xhtml">Chapter 2: The Middle</a></li>
      <li><a href="chapter3.xhtml">Chapter 3: The End</a></li>
    </ol>
  </nav>
</body>
</html>`,
      errors: [],
    }),
  } satisfies Partial<TransformPipeline>;
}

/**
 * Create transform pipeline that simulates errors
 */
export function createFailingTransformPipeline() {
  return {
    transformText: vi.fn().mockRejectedValue(new Error('Transform pipeline failed')),
  } satisfies Partial<TransformPipeline>;
}

/**
 * Setup workspace manager with standard XHTML files for testing
 * Uses shared mock capabilities for consistent test data
 */
export function setupWorkspaceWithXHTML(
  mockManager: MockWorkspaceManager,
  workspaceId: string,
  files: Record<string, string> = createWorkspaceFiles()
) {
  mockManager.addTestFiles(workspaceId, files);
}

/**
 * Setup workspace with mixed heading structures for title extraction testing
 */
export function setupWorkspaceWithMixedContent(
  mockManager: MockWorkspaceManager,
  workspaceId: string
) {
  mockManager.addTestFiles(workspaceId, createMixedWorkspaceFiles());
}

/**
 * Setup workspace with problematic content for error testing
 */
export function setupWorkspaceWithProblematicContent(
  mockManager: MockWorkspaceManager,
  workspaceId: string
) {
  mockManager.addTestFiles(workspaceId, createProblematicWorkspaceFiles());
}

/**
 * Setup file read error scenarios using shared mock failure modes
 */
export function setupFileReadError(mockManager: MockWorkspaceManager) {
  mockManager.setFailureMode('file-read');
}

/**
 * Setup workspace not found error scenario
 */
export function setupWorkspaceNotFoundError(mockManager: MockWorkspaceManager) {
  mockManager.setFailureMode('workspace-not-found');
}

/**
 * Clear all failure modes to restore normal operation
 */
export function clearFailureModes(mockManager: MockWorkspaceManager) {
  mockManager.setFailureMode(null);
}

/**
 * Behavior verification helpers
 */

/**
 * Verify that a file was read from the workspace
 * Uses operation count to verify file access occurred
 */
export function expectFileRead(
  mockManager: MockWorkspaceManager,
  workspaceId: string,
  href: string
) {
  // Verify file was accessed through operation count
  expect(mockManager.getOperationCount()).toBeGreaterThan(0);

  // Additional verification that the file exists in mock
  const files = mockManager.getWorkspaceFiles(workspaceId);
  expect(files.has(href)).toBe(true);
}

/**
 * Verify multiple files were read during spine processing
 */
export function expectMultipleFilesRead(mockManager: MockWorkspaceManager, expectedCount: number) {
  // Each file read increments operation count
  expect(mockManager.getOperationCount()).toBeGreaterThanOrEqual(expectedCount);
}

/**
 * Verify navigation document structure is EPUB compliant
 */
export function expectValidNavigationDocument(navDoc: any) {
  // Verify document structure
  expect(navDoc).toHaveProperty('xhtmlContent');
  expect(navDoc).toHaveProperty('metadata');
  // expect(navDoc).toHaveProperty('generatedAt');
  // expect(navDoc).toHaveProperty('sourceType');

  // Verify content is valid EPUB structure
  expectValidEPUBStructure(navDoc.xhtmlContent);

  // Verify metadata is valid
  expectValidNavigationMetadata(navDoc.metadata);

  // Verify source type is valid
  // expect(['auto-generated', 'user-content']).toContain(navDoc.sourceType);

  // Verify timestamp is recent
  // expect(navDoc.generatedAt).toBeInstanceOf(Date);
  // const timeDiff = Math.abs(new Date().getTime() - navDoc.generatedAt.getTime());
  // expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
}

/**
 * Verify that specific titles are present in navigation XHTML
 */
export function expectNavigationContainsTitles(xhtml: string, expectedTitles: string[]) {
  for (const title of expectedTitles) {
    expect(xhtml).toContain(title);
  }
}

/**
 * Verify that navigation has correct number of list items
 */
export function expectNavigationItemCount(xhtml: string, expectedCount: number) {
  // Count <li> elements in the navigation
  const liMatches = xhtml.match(/<li>/g);
  const actualCount = liMatches ? liMatches.length : 0;
  expect(actualCount).toBe(expectedCount);
}

/**
 * Verify that navigation links have correct hrefs
 */
export function expectNavigationLinks(
  xhtml: string,
  expectedLinks: Array<{ href: string; title: string }>
) {
  for (const link of expectedLinks) {
    expect(xhtml).toContain(`<a href="${link.href}">${link.title}</a>`);
  }
}

/**
 * Verify flat list structure (not nested)
 */
export function expectFlatListStructure(xhtml: string) {
  // Should have only one <ol> element (no nested lists)
  const olMatches = xhtml.match(/<ol>/g);
  expect(olMatches).toHaveLength(1);

  // Should not contain nested <ul> or <ol> elements
  expect(xhtml).not.toMatch(/<li>.*<[ou]l>/);
}

/**
 * Verify that CSS classes are applied when specified
 */
export function expectCSSClasses(xhtml: string, expectedClasses: Record<string, string>) {
  for (const [element, className] of Object.entries(expectedClasses)) {
    if (element === 'nav') {
      expect(xhtml).toContain(`<nav epub:type="toc" role="navigation" class="${className}"`);
    } else if (element === 'list') {
      expect(xhtml).toContain(`<ol class="${className}">`);
    }
  }
}

/**
 * Verify that transform pipeline was called with correct parameters
 */
export function expectTransformPipelineCalled(
  mockPipeline: ReturnType<typeof createMockTransformPipeline>,
  expectedText: string,
  expectedWorkspaceId: string
) {
  expect(mockPipeline.transformText).toHaveBeenCalledWith(expectedText, expectedWorkspaceId, 'nav');
}

/**
 * Create test setup for standard spine processing scenarios
 */
export function createStandardTestSetup() {
  const mockManager = createTestWorkspaceManager();
  const workspaceId = 'test-workspace';

  setupWorkspaceWithXHTML(mockManager, workspaceId);

  return {
    mockManager,
    workspaceId,
  };
}

/**
 * Create test setup for user content processing scenarios
 */
export function createUserContentTestSetup() {
  const mockPipeline = createMockTransformPipeline();
  const workspaceId = 'test-workspace';

  return {
    mockPipeline,
    workspaceId,
  };
}

/**
 * Create test setup for error scenarios
 */
export function createErrorTestSetup() {
  const mockManager = createTestWorkspaceManager();
  const workspaceId = 'test-workspace';

  // Setup with problematic content
  setupWorkspaceWithProblematicContent(mockManager, workspaceId);

  return {
    mockManager,
    workspaceId,
  };
}

/**
 * Helper to wait for async operations in tests
 */
export async function waitForAsync() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Custom matcher for testing navigation document equality
 * Ignores timestamp differences for reliable testing
 */
export function expectNavigationDocumentMatch(actual: any, expected: Partial<any>) {
  expect(actual.xhtmlContent).toEqual(expected.xhtmlContent);
  expect(actual.metadata).toEqual(expected.metadata);
  expect(actual.sourceType).toEqual(expected.sourceType);

  // Don't compare exact timestamps, just verify it's recent
  if (expected.generatedAt) {
    expect(actual.generatedAt).toBeInstanceOf(Date);
  }
}
