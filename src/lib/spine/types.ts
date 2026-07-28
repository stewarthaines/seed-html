/**
 * Type definitions for Spine Item Manager
 *
 * Defines all types used by the SpineItemManager for chapter management operations.
 */

/**
 * Spine item enhanced with source file association and manifest data
 */
export interface SpineItemWithSource {
  // Spine item properties
  idref: string; // Reference to manifest item ID
  linear: boolean; // Include in linear reading order
  properties?: string[]; // EPUB spine properties

  // Manifest item properties (resolved from idref)
  id: string; // Manifest item ID (same as idref)
  href: string; // File path relative to OPF
  mediaType: string; // MIME type (typically "application/xhtml+xml")

  // Source file association (automatic by naming convention)
  sourcePath?: string; // Path to source file if it exists (SOURCE/text/{id}.txt)
  hasSourceFile: boolean; // Whether associated source file exists

  // Human title from the stored XHTML, resolved only for source-less (read-only)
  // chapters so the sidebar can label them instead of showing the raw idref.
  title?: string;

  // UI state (not persisted)
  isEditing?: boolean; // Currently being edited in UI
  isDragging?: boolean; // Currently being dragged in UI
}
