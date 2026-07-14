/**
 * Workspace & OPF Manager - Main Exports
 *
 * High-level workspace management with integrated EPUB content.opf parsing,
 * generation, and manipulation.
 */

// Main classes
export { ManifestDependencyTracker } from './dependency-tracker.js';

// Type definitions from workspace types
export type {
  WorkspaceInfo,
  WorkspacePreview,
  WorkspaceConfig,
  ValidationResult,
  ValidationIssue,
  ValidationWarning,
  ManifestItem, // Re-exported from epub
} from './types.js';

// Type definitions from EPUB utilities
export type { EPUBMetadata, OPFDocument, SpineItem, GuideItem } from '../epub/opf-utils.js';

// Error classes
export { WorkspaceError, ValidationError, DEFAULT_WORKSPACE_CONFIG } from './types.js';
