/**
 * Text Editor Store Public API
 *
 * Exports types and factory function for the text editor store system.
 * This is the public interface for creating and using text editor stores.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * State interface for text editor stores
 */
export interface TextEditorState {
  /** Current text content */
  content: string;
  /** Derived: content.trim() === '' */
  isEmpty: boolean;
  /** Timestamp of last content change */
  lastUpdated: number;
}

/**
 * Text editor store interface with all methods
 */
export interface TextEditorStore {
  /** Subscribe to store state changes */
  subscribe(subscriber: (state: TextEditorState) => void): () => void;
  /** Update content (only accepts strings) */
  updateContent(newContent: string): void;
  /** Reset content to empty string */
  reset(): void;
  /** Get current content without subscribing */
  getContent(): string;
  /** Cleanup and destroy the store */
  destroy(): void;
}

/**
 * Editor ID type for unique identification
 */
export type EditorId = string;

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new text editor store with the specified ID and optional initial content.
 * 
 * @param editorId - Unique identifier for this editor instance
 * @param initialContent - Optional initial text content (defaults to empty string)
 * @returns TextEditorStore instance
 * @throws Error if editorId is already in use
 */
export { createTextEditorStore } from './text-editor-store.js';