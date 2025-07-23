/**
 * Text Editor Store Implementation
 *
 * Factory-based text editor store system that creates isolated, performant stores
 * for text editing components. Each editor gets its own store instance.
 */

import { writable } from 'svelte/store';
import type { TextEditorStore, TextEditorState, EditorId } from './index.js';

// ============================================================================
// Store Registry
// ============================================================================

/**
 * Registry to track active editor IDs and prevent duplicates
 */
const activeEditorIds = new Set<string>();

/**
 * Counter to ensure unique timestamps even in rapid succession
 */
let timestampCounter = 0;

// ============================================================================
// Factory Function Implementation
// ============================================================================

/**
 * Creates a new text editor store with the specified ID and optional initial content.
 * 
 * @param editorId - Unique identifier for this editor instance
 * @param initialContent - Optional initial text content (defaults to empty string)
 * @returns TextEditorStore instance
 * @throws Error if editorId is already in use
 */
export function createTextEditorStore(
  editorId: EditorId, 
  initialContent = ''
): TextEditorStore {
  // Validate editor ID uniqueness
  if (activeEditorIds.has(editorId)) {
    throw new Error(`Editor ID "${editorId}" is already in use`);
  }

  // Register the editor ID
  activeEditorIds.add(editorId);

  // Helper function to generate unique timestamps
  function getUniqueTimestamp(): number {
    timestampCounter++;
    return Date.now() + timestampCounter * 0.001; // Add microseconds for uniqueness
  }

  // Create a single state store that manages all state internally
  const stateStore = writable({
    content: initialContent,
    isEmpty: initialContent.trim() === '',
    lastUpdated: getUniqueTimestamp(),
  });

  // ============================================================================
  // Store Methods
  // ============================================================================

  /**
   * Updates the content if the input is a string, ignoring all other types
   */
  function updateContent(newContent: string): void {
    // Input sanitization: only process strings
    if (typeof newContent !== 'string') {
      return; // Ignore non-string inputs
    }

    // Update state atomically in a single store update
    stateStore.update(_currentState => ({
      content: newContent,
      isEmpty: newContent.trim() === '',
      lastUpdated: getUniqueTimestamp(),
    }));
  }

  /**
   * Resets content to empty string
   */
  function reset(): void {
    stateStore.update(_currentState => ({
      content: '',
      isEmpty: true,
      lastUpdated: getUniqueTimestamp(),
    }));
  }

  /**
   * Gets current content without subscribing
   */
  function getContent(): string {
    let currentContent = '';
    const unsubscribe = stateStore.subscribe(state => {
      currentContent = state.content;
    });
    unsubscribe();
    return currentContent;
  }

  /**
   * Subscribes to state changes
   */
  function subscribe(subscriber: (state: TextEditorState) => void): () => void {
    return stateStore.subscribe(subscriber);
  }

  // ============================================================================
  // Cleanup and Return
  // ============================================================================

  /**
   * Cleanup function to remove the editor ID from the registry
   * Should be called when the component using this store is destroyed
   */
  function destroy(): void {
    activeEditorIds.delete(editorId);
  }

  return {
    subscribe,
    updateContent,
    reset,
    getContent,
    destroy,
  };
}