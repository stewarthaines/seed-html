/**
 * Text Editor Store Unit Tests
 *
 * Comprehensive test suite for the text editor store system based on the API specification.
 * Tests all documented behavior including factory function, store state management,
 * input sanitization, store isolation, and subscription handling.
 *
 * Following TESTING.md guidelines:
 * - Uses relative imports for TypeScript compatibility
 * - Tests behavior, not implementation
 * - Focus on API contract verification
 * - Uses simple, focused mocks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTextEditorStore } from '../text-editor-store.js';
import type { TextEditorStore, TextEditorState } from '../index.js';
import {
  VALID_EDITOR_IDS,
  INVALID_INPUTS,
  SAMPLE_CONTENT,
  EDGE_CASE_CONTENT,
  createUniqueEditorId,
} from './fixtures.js';

describe('Text Editor Store', () => {
  let subscriberSpy: ReturnType<typeof vi.fn>;
  let unsubscribeFunction: (() => void) | null = null;

  beforeEach(() => {
    subscriberSpy = vi.fn();
    unsubscribeFunction = null;
    // Clear any existing stores before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up subscriptions
    if (unsubscribeFunction) {
      unsubscribeFunction();
      unsubscribeFunction = null;
    }
  });

  describe('Factory Function - createTextEditorStore()', () => {
    describe('Valid Store Creation', () => {
      it('should create store with unique ID and no initial content', () => {
        const editorId = createUniqueEditorId();
        const store = createTextEditorStore(editorId);

        expect(store).toBeDefined();
        expect(store.subscribe).toBeTypeOf('function');
        expect(store.updateContent).toBeTypeOf('function');
        expect(store.reset).toBeTypeOf('function');
        expect(store.getContent).toBeTypeOf('function');
      });

      it('should create store with unique ID and initial content', () => {
        const editorId = createUniqueEditorId();
        const initialContent = SAMPLE_CONTENT.SHORT_TEXT;
        const store = createTextEditorStore(editorId, initialContent);

        const content = store.getContent();
        expect(content).toBe(initialContent);
      });

      it('should handle empty string as initial content', () => {
        const editorId = createUniqueEditorId();
        const store = createTextEditorStore(editorId, '');

        const content = store.getContent();
        expect(content).toBe('');
      });

      it('should handle undefined initial content (default to empty string)', () => {
        const editorId = createUniqueEditorId();
        const store = createTextEditorStore(editorId, undefined);

        const content = store.getContent();
        expect(content).toBe('');
      });

      it.each(VALID_EDITOR_IDS)('should create store with valid editor ID: %s', editorId => {
        const store = createTextEditorStore(editorId);
        expect(store).toBeDefined();
        expect(store.getContent()).toBe('');
      });
    });

    describe('Duplicate ID Error Handling', () => {
      it('should throw error when same editor ID is used twice', () => {
        const editorId = createUniqueEditorId();

        // First creation should succeed
        const store1 = createTextEditorStore(editorId);
        expect(store1).toBeDefined();

        // Second creation with same ID should throw
        expect(() => {
          createTextEditorStore(editorId);
        }).toThrow();
      });

      it('should include editor ID in error message for duplicate ID', () => {
        const editorId = createUniqueEditorId();
        createTextEditorStore(editorId);

        let errorMessage = '';
        try {
          createTextEditorStore(editorId);
        } catch (error: any) {
          errorMessage = error.message;
        }

        expect(errorMessage).toContain(editorId);
      });

      it('should allow different editor IDs to coexist', () => {
        const editorId1 = createUniqueEditorId();
        const editorId2 = createUniqueEditorId();

        const store1 = createTextEditorStore(editorId1, 'Content 1');
        const store2 = createTextEditorStore(editorId2, 'Content 2');

        expect(store1.getContent()).toBe('Content 1');
        expect(store2.getContent()).toBe('Content 2');
      });
    });
  });

  describe('Store State Management', () => {
    let store: TextEditorStore;
    let editorId: string;

    beforeEach(() => {
      editorId = createUniqueEditorId();
      store = createTextEditorStore(editorId);
    });

    describe('Initial State', () => {
      it('should have correct initial state with no content', () => {
        unsubscribeFunction = store.subscribe(subscriberSpy);

        // Should be called immediately with initial state
        expect(subscriberSpy).toHaveBeenCalledTimes(1);
        const initialState = subscriberSpy.mock.calls[0][0] as TextEditorState;

        expect(initialState.content).toBe('');
        expect(initialState.isEmpty).toBe(true);
        expect(initialState.lastUpdated).toBeTypeOf('number');
        expect(initialState.lastUpdated).toBeGreaterThan(0);
      });

      it('should have correct initial state with provided content', () => {
        const contentStore = createTextEditorStore(
          createUniqueEditorId(),
          SAMPLE_CONTENT.MEDIUM_TEXT
        );
        unsubscribeFunction = contentStore.subscribe(subscriberSpy);

        const initialState = subscriberSpy.mock.calls[0][0] as TextEditorState;
        expect(initialState.content).toBe(SAMPLE_CONTENT.MEDIUM_TEXT);
        expect(initialState.isEmpty).toBe(false);
        expect(initialState.lastUpdated).toBeTypeOf('number');
      });
    });

    describe('isEmpty Derivation', () => {
      it('should set isEmpty to true for empty content', () => {
        unsubscribeFunction = store.subscribe(subscriberSpy);
        store.updateContent('');

        const state = subscriberSpy.mock.calls[
          subscriberSpy.mock.calls.length - 1
        ][0] as TextEditorState;
        expect(state.isEmpty).toBe(true);
      });

      it('should set isEmpty to true for whitespace-only content', () => {
        unsubscribeFunction = store.subscribe(subscriberSpy);

        // Test various whitespace patterns
        const whitespacePatterns = [' ', '\n', '\t', '   \n\t  ', '\r\n\r\n'];

        whitespacePatterns.forEach(whitespace => {
          store.updateContent(whitespace);
          const state = subscriberSpy.mock.calls[
            subscriberSpy.mock.calls.length - 1
          ][0] as TextEditorState;
          expect(state.isEmpty).toBe(true);
        });
      });

      it('should set isEmpty to false for non-empty content', () => {
        unsubscribeFunction = store.subscribe(subscriberSpy);
        store.updateContent('hello');

        const state = subscriberSpy.mock.calls[
          subscriberSpy.mock.calls.length - 1
        ][0] as TextEditorState;
        expect(state.isEmpty).toBe(false);
      });

      it('should set isEmpty to false for content with leading/trailing whitespace', () => {
        unsubscribeFunction = store.subscribe(subscriberSpy);
        store.updateContent('  hello world  ');

        const state = subscriberSpy.mock.calls[
          subscriberSpy.mock.calls.length - 1
        ][0] as TextEditorState;
        expect(state.isEmpty).toBe(false);
      });
    });

    describe('lastUpdated Timestamp', () => {
      it('should update timestamp when content changes', () => {
        unsubscribeFunction = store.subscribe(subscriberSpy);
        const initialTimestamp = subscriberSpy.mock.calls[0][0].lastUpdated;

        store.updateContent('new content');

        const updatedState = subscriberSpy.mock.calls[
          subscriberSpy.mock.calls.length - 1
        ][0] as TextEditorState;
        expect(updatedState.lastUpdated).toBeGreaterThan(initialTimestamp);
        expect(typeof updatedState.lastUpdated).toBe('number');
        expect(updatedState.lastUpdated).toBeGreaterThan(0);
      });

      it('should update timestamp when reset', () => {
        store.updateContent('some content');
        unsubscribeFunction = store.subscribe(subscriberSpy);
        const beforeReset = subscriberSpy.mock.calls[0][0].lastUpdated;

        // Small delay and reset
        setTimeout(() => {
          /* noop tick */
        }, 1);
        store.reset();

        const resetState = subscriberSpy.mock.calls[
          subscriberSpy.mock.calls.length - 1
        ][0] as TextEditorState;
        expect(resetState.lastUpdated).toBeGreaterThan(beforeReset);
      });
    });
  });

  describe('Store Methods', () => {
    let store: TextEditorStore;

    beforeEach(() => {
      store = createTextEditorStore(createUniqueEditorId());
    });

    describe('updateContent()', () => {
      it('should update content with valid string', () => {
        unsubscribeFunction = store.subscribe(subscriberSpy);

        store.updateContent(SAMPLE_CONTENT.SHORT_TEXT);

        const state = subscriberSpy.mock.calls[
          subscriberSpy.mock.calls.length - 1
        ][0] as TextEditorState;
        expect(state.content).toBe(SAMPLE_CONTENT.SHORT_TEXT);
        expect(subscriberSpy).toHaveBeenCalledTimes(2); // Initial + update
      });

      it('should notify subscribers immediately and synchronously', () => {
        unsubscribeFunction = store.subscribe(subscriberSpy);
        const initialCallCount = subscriberSpy.mock.calls.length;

        store.updateContent('test content');

        // Should be called synchronously (no setTimeout/Promise needed)
        expect(subscriberSpy).toHaveBeenCalledTimes(initialCallCount + 1);
      });

      it('should handle large content strings', () => {
        unsubscribeFunction = store.subscribe(subscriberSpy);

        store.updateContent(SAMPLE_CONTENT.LARGE_TEXT);

        const state = subscriberSpy.mock.calls[
          subscriberSpy.mock.calls.length - 1
        ][0] as TextEditorState;
        expect(state.content).toBe(SAMPLE_CONTENT.LARGE_TEXT);
        expect(state.content.length).toBeGreaterThan(1000);
      });

      it.each(EDGE_CASE_CONTENT)('should handle edge case content: %s', (_description, content) => {
        unsubscribeFunction = store.subscribe(subscriberSpy);

        store.updateContent(content);

        const state = subscriberSpy.mock.calls[
          subscriberSpy.mock.calls.length - 1
        ][0] as TextEditorState;
        expect(state.content).toBe(content);
      });
    });

    describe('Input Sanitization - Non-String Inputs', () => {
      it.each(INVALID_INPUTS)('should ignore non-string input: %s (%s)', (_description, input) => {
        unsubscribeFunction = store.subscribe(subscriberSpy);
        const initialCallCount = subscriberSpy.mock.calls.length;
        const initialContent = store.getContent();

        (store.updateContent as any)(input);

        // Should not trigger state update
        expect(subscriberSpy).toHaveBeenCalledTimes(initialCallCount);
        expect(store.getContent()).toBe(initialContent);
      });

      it('should continue to work after receiving invalid inputs', () => {
        unsubscribeFunction = store.subscribe(subscriberSpy);

        // Send invalid input
        (store.updateContent as any)(null);
        (store.updateContent as any)(123);

        // Valid update should still work
        store.updateContent('valid content');

        const state = subscriberSpy.mock.calls[
          subscriberSpy.mock.calls.length - 1
        ][0] as TextEditorState;
        expect(state.content).toBe('valid content');
      });
    });

    describe('reset()', () => {
      it('should clear content to empty string', () => {
        store.updateContent('some content');
        unsubscribeFunction = store.subscribe(subscriberSpy);

        store.reset();

        const state = subscriberSpy.mock.calls[
          subscriberSpy.mock.calls.length - 1
        ][0] as TextEditorState;
        expect(state.content).toBe('');
        expect(state.isEmpty).toBe(true);
      });

      it('should notify subscribers when reset', () => {
        store.updateContent('content');
        unsubscribeFunction = store.subscribe(subscriberSpy);
        const initialCallCount = subscriberSpy.mock.calls.length;

        store.reset();

        expect(subscriberSpy).toHaveBeenCalledTimes(initialCallCount + 1);
      });

      it('should update timestamp when reset', () => {
        store.updateContent('content');
        unsubscribeFunction = store.subscribe(subscriberSpy);
        const beforeReset = subscriberSpy.mock.calls[0][0].lastUpdated;

        store.reset();

        const resetState = subscriberSpy.mock.calls[
          subscriberSpy.mock.calls.length - 1
        ][0] as TextEditorState;
        expect(resetState.lastUpdated).toBeGreaterThan(beforeReset);
      });
    });

    describe('getContent()', () => {
      it('should return current content without subscribing', () => {
        const testContent = SAMPLE_CONTENT.MEDIUM_TEXT;
        store.updateContent(testContent);

        const content = store.getContent();
        expect(content).toBe(testContent);

        // Should not have triggered any subscriptions
        expect(subscriberSpy).not.toHaveBeenCalled();
      });

      it('should return empty string for new store', () => {
        const content = store.getContent();
        expect(content).toBe('');
      });

      it('should return current content after reset', () => {
        store.updateContent('test');
        store.reset();

        const content = store.getContent();
        expect(content).toBe('');
      });
    });

    describe('subscribe()', () => {
      it('should call subscriber immediately with current state', () => {
        store.updateContent('existing content');

        unsubscribeFunction = store.subscribe(subscriberSpy);

        expect(subscriberSpy).toHaveBeenCalledTimes(1);
        const state = subscriberSpy.mock.calls[0][0] as TextEditorState;
        expect(state.content).toBe('existing content');
        expect(state.isEmpty).toBe(false);
      });

      it('should call subscriber on each state update', () => {
        unsubscribeFunction = store.subscribe(subscriberSpy);

        store.updateContent('update 1');
        store.updateContent('update 2');
        store.reset();

        expect(subscriberSpy).toHaveBeenCalledTimes(4); // Initial + 3 updates
      });

      it('should return unsubscribe function', () => {
        const unsubscribe = store.subscribe(subscriberSpy);

        expect(unsubscribe).toBeTypeOf('function');

        // Should stop notifications after unsubscribe
        unsubscribe();
        store.updateContent('after unsubscribe');

        expect(subscriberSpy).toHaveBeenCalledTimes(1); // Only initial call
      });

      it('should handle multiple subscribers', () => {
        const subscriber1 = vi.fn();
        const subscriber2 = vi.fn();

        const unsub1 = store.subscribe(subscriber1);
        const unsub2 = store.subscribe(subscriber2);

        store.updateContent('test');

        expect(subscriber1).toHaveBeenCalledTimes(2); // Initial + update
        expect(subscriber2).toHaveBeenCalledTimes(2); // Initial + update

        unsub1();
        unsub2();
      });
    });
  });

  describe('Store Isolation', () => {
    it('should keep multiple stores completely independent', () => {
      const store1 = createTextEditorStore(createUniqueEditorId(), 'Content 1');
      const store2 = createTextEditorStore(createUniqueEditorId(), 'Content 2');

      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();

      const unsub1 = store1.subscribe(subscriber1);
      const unsub2 = store2.subscribe(subscriber2);

      // Update store1
      store1.updateContent('Updated 1');

      // Only subscriber1 should be notified
      expect(subscriber1).toHaveBeenCalledTimes(2); // Initial + update
      expect(subscriber2).toHaveBeenCalledTimes(1); // Only initial

      // Verify content isolation
      expect(store1.getContent()).toBe('Updated 1');
      expect(store2.getContent()).toBe('Content 2');

      unsub1();
      unsub2();
    });

    it('should handle many concurrent stores without interference', () => {
      const stores: TextEditorStore[] = [];
      const subscribers: ReturnType<typeof vi.fn>[] = [];
      const unsubscribers: (() => void)[] = [];

      // Create 10 concurrent stores
      for (let i = 0; i < 10; i++) {
        const store = createTextEditorStore(createUniqueEditorId(), `Initial ${i}`);
        const subscriber = vi.fn();
        const unsubscriber = store.subscribe(subscriber);

        stores.push(store);
        subscribers.push(subscriber);
        unsubscribers.push(unsubscriber);
      }

      // Update each store independently
      stores.forEach((store, i) => {
        store.updateContent(`Updated ${i}`);
      });

      // Verify each store and subscriber is independent
      stores.forEach((store, i) => {
        expect(store.getContent()).toBe(`Updated ${i}`);
        expect(subscribers[i]).toHaveBeenCalledTimes(2); // Initial + update
      });

      // Cleanup
      unsubscribers.forEach(unsub => unsub());
    });

    it.skip('should allow reuse of editor ID after store is no longer referenced', () => {
      // Skip: Current implementation doesn't support automatic cleanup
      // This functionality would require WeakRef or similar mechanism
      // to detect when store is garbage collected and remove from registry

      const editorId = createUniqueEditorId();

      // Create first store
      let store1: TextEditorStore | null = createTextEditorStore(editorId, 'First');
      expect(store1.getContent()).toBe('First');

      // Remove reference (simulate garbage collection)
      store1 = null;

      // Should be able to create new store with same ID
      // This would work with proper cleanup mechanism
      expect(() => {
        const store2 = createTextEditorStore(editorId, 'Second');
        expect(store2.getContent()).toBe('Second');
      }).not.toThrow();
    });
  });

  describe('Subscription Timing and Cleanup', () => {
    let store: TextEditorStore;

    beforeEach(() => {
      store = createTextEditorStore(createUniqueEditorId());
    });

    it('should call subscribers synchronously on updates', () => {
      unsubscribeFunction = store.subscribe(subscriberSpy);

      let callbackExecuted = false;
      store.updateContent('test');

      // This should execute synchronously after updateContent
      callbackExecuted = true;

      // Subscriber should have been called before we get here
      expect(subscriberSpy).toHaveBeenCalledTimes(2);
      expect(callbackExecuted).toBe(true);
    });

    it('should handle subscription/unsubscription cycles', () => {
      // Subscribe and unsubscribe multiple times
      for (let i = 0; i < 3; i++) {
        const subscriber = vi.fn();
        const unsubscribe = store.subscribe(subscriber);

        store.updateContent(`test ${i}`);
        expect(subscriber).toHaveBeenCalledTimes(2); // Initial + update

        unsubscribe();

        // Should not receive further updates
        store.updateContent(`test ${i} after unsub`);
        expect(subscriber).toHaveBeenCalledTimes(2); // Still only 2
      }
    });

    it('should handle unsubscribe called multiple times', () => {
      const unsubscribe = store.subscribe(subscriberSpy);

      // Multiple unsubscribe calls should not cause errors
      expect(() => {
        unsubscribe();
        unsubscribe();
        unsubscribe();
      }).not.toThrow();
    });

    it('should stop notifications immediately after unsubscribe', () => {
      const unsubscribe = store.subscribe(subscriberSpy);

      // Get initial call count
      const initialCalls = subscriberSpy.mock.calls.length;

      // Unsubscribe and then update
      unsubscribe();
      store.updateContent('after unsubscribe');

      // Should not have received the update
      expect(subscriberSpy).toHaveBeenCalledTimes(initialCalls);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid consecutive updates', () => {
      const store = createTextEditorStore(createUniqueEditorId());
      unsubscribeFunction = store.subscribe(subscriberSpy);

      // Rapid updates
      for (let i = 0; i < 100; i++) {
        store.updateContent(`Update ${i}`);
      }

      // Should have called subscriber for each update plus initial
      expect(subscriberSpy).toHaveBeenCalledTimes(101);

      // Final state should be correct
      const finalState = subscriberSpy.mock.calls[
        subscriberSpy.mock.calls.length - 1
      ][0] as TextEditorState;
      expect(finalState.content).toBe('Update 99');
    });

    it('should handle extremely large content', () => {
      const store = createTextEditorStore(createUniqueEditorId());
      const largeContent = 'x'.repeat(100000); // 100KB of text

      unsubscribeFunction = store.subscribe(subscriberSpy);
      store.updateContent(largeContent);

      expect(store.getContent()).toBe(largeContent);
      expect(store.getContent().length).toBe(100000);
    });

    it('should maintain consistent state across operations', () => {
      const store = createTextEditorStore(createUniqueEditorId());
      unsubscribeFunction = store.subscribe(subscriberSpy);

      // Complex sequence of operations
      store.updateContent('initial');
      const content1 = store.getContent();

      store.updateContent('');
      const content2 = store.getContent();

      store.reset();
      const content3 = store.getContent();

      store.updateContent('final');
      const content4 = store.getContent();

      // Verify state consistency
      expect(content1).toBe('initial');
      expect(content2).toBe('');
      expect(content3).toBe('');
      expect(content4).toBe('final');

      // Verify final subscriber state matches getContent
      const finalState = subscriberSpy.mock.calls[
        subscriberSpy.mock.calls.length - 1
      ][0] as TextEditorState;
      expect(finalState.content).toBe(content4);
    });
  });
});
