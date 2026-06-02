/**
 * Test Fixtures for Text Editor Store Tests
 *
 * Provides test data, helper functions, and mock utilities for text editor store testing.
 * Follows TESTING.md patterns for creating focused, behavior-based test fixtures.
 */

import { vi } from 'vitest';

// ============================================================================
// Test Data Constants
// ============================================================================

/**
 * Valid editor ID patterns for testing
 */
export const VALID_EDITOR_IDS = [
  'outline-nav',
  'chapter-1-source',
  'chapter-2-source',
  'transform-text-js',
  'transform-dom-js',
  'spine-item-1',
  'metadata-editor',
  'settings-editor',
  'extension-config',
  'nav-document',
] as const;

/**
 * Sample content for testing different scenarios
 */
export const SAMPLE_CONTENT = {
  SHORT_TEXT: 'Hello, world!',
  MEDIUM_TEXT: `# Chapter 1: Introduction

This is a sample chapter with multiple lines of content.
It includes various formatting and text patterns.

## Section 1.1
Some more content here with **bold** and *italic* text.

- List item 1
- List item 2
- List item 3

The end.`,
  LARGE_TEXT:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(50) +
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '.repeat(30),
  EMPTY_STRING: '',
  WHITESPACE_ONLY: '   \n\t  \r\n  ',
  UNICODE_TEXT: '🎉 Unicode content with émojis and spëcial chars 中文 العربية',
  SPECIAL_CHARS: '<script>alert("test")</script>&lt;&gt;"\'',
  MULTILINE_TEXT: 'Line 1\nLine 2\nLine 3\n\nLine 5',
} as const;

/**
 * Edge case content patterns for comprehensive testing
 */
export const EDGE_CASE_CONTENT: Array<[string, string]> = [
  ['empty string', ''],
  ['single space', ' '],
  ['newline only', '\n'],
  ['tab only', '\t'],
  ['carriage return', '\r'],
  ['multiple whitespace', '   \n\t  \r\n  '],
  ['null character', '\0'],
  ['unicode emoji', '🎉🚀💯'],
  ['unicode text', '中文 العربية हिंदी'],
  ['html entities', '&lt;div&gt;&amp;nbsp;&lt;/div&gt;'],
  ['javascript code', 'function test() { return "hello"; }'],
  ['json content', '{"key": "value", "number": 42}'],
  ['xml content', '<?xml version="1.0"?><root><item>value</item></root>'],
  ['markdown content', '# Header\n\n**bold** and *italic* text'],
  ['very long line', 'x'.repeat(1000)],
  ['mixed line endings', 'line1\nline2\r\nline3\rline4'],
];

/**
 * Invalid inputs that should be ignored by updateContent()
 */
export const INVALID_INPUTS: Array<[string, any]> = [
  ['null', null],
  ['undefined', undefined],
  ['number', 42],
  ['boolean true', true],
  ['boolean false', false],
  ['object', { text: 'content' }],
  ['array', ['a', 'b', 'c']],
  ['function', () => 'content'],
  ['symbol', Symbol('test')],
  ['bigint', BigInt(123)],
  ['NaN', NaN],
  ['Infinity', Infinity],
  ['Date object', new Date()],
  ['RegExp object', /pattern/g],
  ['Error object', new Error('test')],
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates a unique editor ID for testing to avoid collisions
 */
export function createUniqueEditorId(prefix = 'test-editor'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates a timestamp matcher for testing lastUpdated values
 */
export function createTimestampMatcher(tolerance = 100) {
  const now = Date.now();
  return {
    isRecentTimestamp: (received: number): boolean => {
      const isNumber = typeof received === 'number';
      const isRecent = received >= now - tolerance && received <= now + tolerance;
      return isNumber && isRecent;
    },
  };
}

/**
 * Creates a mock subscriber function with type safety
 */
export function createMockSubscriber() {
  return vi.fn();
}

/**
 * Validates that a value matches the TextEditorState interface
 */
export function validateTextEditorState(state: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof state !== 'object' || state === null) {
    errors.push('State must be an object');
    return { isValid: false, errors };
  }

  if (typeof state.content !== 'string') {
    errors.push('content must be a string');
  }

  if (typeof state.isEmpty !== 'boolean') {
    errors.push('isEmpty must be a boolean');
  }

  if (typeof state.lastUpdated !== 'number') {
    errors.push('lastUpdated must be a number');
  } else if (state.lastUpdated <= 0) {
    errors.push('lastUpdated must be a positive number');
  }

  // Validate isEmpty derivation logic
  if (typeof state.content === 'string' && typeof state.isEmpty === 'boolean') {
    const expectedIsEmpty = state.content.trim() === '';
    if (state.isEmpty !== expectedIsEmpty) {
      errors.push(`isEmpty should be ${expectedIsEmpty} for content: "${state.content}"`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a test scenario for subscription timing tests
 */
export function createSubscriptionTestScenario() {
  const calls: Array<{ timestamp: number; content: string }> = [];

  const subscriber = vi.fn(state => {
    calls.push({
      timestamp: Date.now(),
      content: state.content,
    });
  });

  return {
    subscriber,
    calls,
    getCallTiming: () => calls.map(call => call.timestamp),
    getCallContent: () => calls.map(call => call.content),
  };
}

/**
 * Utility to test store isolation between multiple instances
 */
export function createStoreIsolationTest(storeCount = 3) {
  const stores: Array<{
    id: string;
    expectedContent: string;
    index: number;
  }> = [];
  const subscribers: Array<ReturnType<typeof vi.fn>> = [];
  const unsubscribers: Array<() => void> = [];

  for (let i = 0; i < storeCount; i++) {
    const editorId = createUniqueEditorId(`isolation-test-${i}`);
    // Note: Actual store creation will be done in the test
    stores.push({
      id: editorId,
      expectedContent: `Content ${i}`,
      index: i,
    });
  }

  return {
    stores,
    subscribers,
    unsubscribers,
    cleanup: () => {
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') {
          unsub();
        }
      });
    },
  };
}

/**
 * Performance test helper for rapid updates
 */
export function createPerformanceTestData(updateCount = 1000) {
  const updates = [];
  for (let i = 0; i < updateCount; i++) {
    updates.push(`Update ${i}: ${Math.random().toString(36).substr(2, 10)}`);
  }
  return updates;
}

/**
 * Error simulation helper for testing robustness
 */
export function createErrorScenarios() {
  const scenarios = [
    {
      name: 'Subscriber throws error',
      createBadSubscriber: () =>
        vi.fn(() => {
          throw new Error('Subscriber error');
        }),
    },
    {
      name: 'Subscriber modifies state',
      createBadSubscriber: () =>
        vi.fn(state => {
          // Attempt to modify the state object
          try {
            state.content = 'modified';
            state.isEmpty = !state.isEmpty;
          } catch (e) {
            // Ignore if state is immutable
          }
        }),
    },
  ];

  return scenarios;
}

// ============================================================================
// Mock Utilities
// ============================================================================

/**
 * Creates a simple mock for testing subscription behavior
 */
export function createSubscriptionMock() {
  const subscribers = new Set<(...args: unknown[]) => unknown>();

  return {
    subscribe: vi.fn(callback => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    }),
    notify: vi.fn(state => {
      subscribers.forEach(callback => callback(state));
    }),
    getSubscriberCount: () => subscribers.size,
    clear: () => subscribers.clear(),
  };
}

/**
 * Test helper to verify synchronous execution
 */
export function createSynchronousExecutionTest() {
  let executionOrder: string[] = [];

  return {
    reset: () => {
      executionOrder = [];
    },
    mark: (label: string) => {
      executionOrder.push(label);
    },
    getOrder: () => [...executionOrder],
    expectOrder: (expected: string[]) => {
      return executionOrder.join(',') === expected.join(',');
    },
  };
}

/**
 * Creates test data for boundary testing
 */
export const BOUNDARY_TEST_CASES = {
  contentLengths: [
    { name: 'empty', content: '' },
    { name: 'single char', content: 'a' },
    { name: 'small', content: 'hello'.repeat(10) },
    { name: 'medium', content: 'content'.repeat(100) },
    { name: 'large', content: 'text'.repeat(10000) },
  ],

  updateFrequencies: [
    { name: 'single update', count: 1 },
    { name: 'few updates', count: 10 },
    { name: 'many updates', count: 100 },
    { name: 'rapid updates', count: 1000 },
  ],

  subscriberCounts: [
    { name: 'no subscribers', count: 0 },
    { name: 'single subscriber', count: 1 },
    { name: 'few subscribers', count: 5 },
    { name: 'many subscribers', count: 50 },
  ],
} as const;
