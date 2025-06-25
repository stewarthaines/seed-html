/**
 * Workspace & OPF Manager - Main Exports
 *
 * High-level workspace management with integrated EPUB content.opf parsing,
 * generation, and manipulation.
 */

// Main classes
export { WorkspaceManager } from './workspace-manager.js';
export { WorkspaceMetadataCache } from './workspace-cache.js';
export { ManifestDependencyTracker } from './dependency-tracker.js';

// Type definitions
export type {
  WorkspaceInfo,
  EPUBMetadata,
  OPFDocument,
  ManifestItem,
  SpineItem,
  GuideItem,
  WorkspacePreview,
  WorkspaceConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  WorkspaceCacheEntry,
  WorkspaceCache,
} from './types.js';

// Error classes
export { WorkspaceError, ValidationError, CacheError, DEFAULT_WORKSPACE_CONFIG } from './types.js';
