/**
 * Type definitions for Spine Item Manager
 * 
 * Defines all types used by the SpineItemManager for chapter management operations.
 */

import type { ManifestItem, SpineItem } from '../epub/opf-utils.js';

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

  // UI state (not persisted)
  isEditing?: boolean; // Currently being edited in UI
  isDragging?: boolean; // Currently being dragged in UI
}

/**
 * Data for creating a new chapter
 */
export interface ChapterCreationData {
  title: string; // Chapter title for display and content
  fileName?: string; // XHTML filename (auto-generated if not provided)
  linear?: boolean; // Include in linear reading order (default: true)
  properties?: string[]; // EPUB spine properties
  insertIndex?: number; // Position to insert in spine (default: append)
  createSourceFile?: boolean; // Create associated source file (default: true)
  sourceContent?: string; // Initial source content (uses template if not provided)
}

/**
 * Data for updating an existing chapter
 */
export interface ChapterUpdateData {
  title?: string; // New chapter title
  fileName?: string; // New XHTML filename (will rename file)
  linear?: boolean; // Linear reading order flag
  properties?: string[]; // EPUB spine properties
  sourceContent?: string; // Update source file content
}

/**
 * Options for chapter deletion
 */
export interface ChapterDeletionOptions {
  preserveXHTML?: boolean; // Keep XHTML file (default: false)
  preserveSourceFile?: boolean; // Keep source file (default: false)
  preserveManifest?: boolean; // Keep manifest entry (default: false)
}

/**
 * Result of spine validation operation
 */
export interface SpineValidationResult {
  isValid: boolean;
  errors: SpineValidationError[];
  warnings: SpineValidationWarning[];
  summary: {
    totalItems: number;
    linearItems: number;
    nonLinearItems: number;
    itemsWithSource: number;
    orphanedSources: number;
  };
}

/**
 * Validation error in spine structure
 */
export interface SpineValidationError {
  code: string;
  message: string;
  chapterId?: string;
  severity: 'error' | 'warning';
}

/**
 * Validation warning in spine structure
 */
export interface SpineValidationWarning {
  code: string;
  message: string;
  chapterId?: string;
  severity: 'warning';
}