/**
 * Test utilities for Translation Content System
 *
 * Provides mock objects and helper functions following existing project patterns
 * for testing the SampleContentGenerator in isolation.
 */

import { expect } from 'vitest';

/**
 * Create EPUBMetadata type mock for testing (based on EPUB spec)
 */
export function createMockEPUBMetadata() {
  return {
    title: 'Mock EPUB Title',
    language: 'en',
    identifier: 'mock-epub-123',
    creator: ['Mock Author'],
    publisher: 'Mock Publisher',
    description: 'Mock EPUB description',
    pageProgressionDirection: 'ltr' as const,
  };
}

/**
 * Assertion helpers for complex object matching
 */
export function expectLocalizedContent(
  actual: any,
  locale: string,
  expectedChapterCount: number = 1
): void {
  expect(actual).toEqual({
    locale,
    metadata: expect.objectContaining({
      title: expect.any(String),
      description: expect.any(String),
      author: expect.any(String),
      publisher: expect.any(String),
    }),
    chapters: expect.arrayContaining([
      expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
        content: expect.any(String),
        linear: expect.any(Boolean),
      }),
    ]),
    isRTL: expect.any(Boolean),
    pageProgressionDirection: expect.stringMatching(/^(ltr|rtl)$/),
  });

  expect(actual.chapters).toHaveLength(expectedChapterCount);
}

/**
 * Assertion helpers for DemoChapter arrays
 */
export function expectDemoChapters(actual: any[], expectedCount: number = 1): void {
  expect(actual).toHaveLength(expectedCount);

  actual.forEach(chapter => {
    expect(chapter).toEqual({
      id: expect.any(String),
      title: expect.any(String),
      content: expect.any(String),
      linear: expect.any(Boolean),
      mediaType: 'application/xhtml+xml',
    });
  });
}

/**
 * Assertion helpers for EPUB metadata
 */
export function expectEPUBMetadata(actual: any, locale: string): void {
  expect(actual).toEqual({
    title: expect.any(String),
    language: [locale],
    identifier: expect.stringMatching(/^sample-content-[a-z-]+-\d+$/),
    creator: expect.arrayContaining([expect.objectContaining({ name: expect.any(String) })]),
    publisher: expect.any(String),
    description: expect.any(String),
    pageProgressionDirection: expect.stringMatching(/^(ltr|rtl)$/),
  });
}

/**
 * Assertion helpers for validation results
 */
export function expectValidationResult(
  actual: any,
  locale: string,
  isValid: boolean,
  missingKeys: string[] = [],
  emptyKeys: string[] = []
): void {
  expect(actual).toEqual({
    isValid,
    missingKeys: expect.arrayContaining(missingKeys),
    emptyKeys: expect.arrayContaining(emptyKeys),
    locale,
  });

  if (missingKeys.length > 0) {
    expect(actual.missingKeys).toHaveLength(missingKeys.length);
  }

  if (emptyKeys.length > 0) {
    expect(actual.emptyKeys).toHaveLength(emptyKeys.length);
  }
}

/**
 * Expected sample content keys for validation testing
 */
export const EXPECTED_SAMPLE_KEYS = [
  'sample.book.title',
  'sample.book.description',
  'sample.author.name',
  'sample.publisher.name',
  'sample.prologue.title',
  'sample.prologue.content',
  'sample.chapter1.title',
  'sample.chapter1.content',
  'sample.chapter2.title',
  'sample.chapter2.content',
  'sample.appendix.title',
  'sample.appendix.content',
] as const;

/**
 * Available test locales
 */
export const TEST_LOCALES = ['en', 'de', 'ar'] as const;

/**
 * Helper to create test workspace ID
 */
export function createTestWorkspaceId(): string {
  return `test-workspace-${Date.now()}`;
}
