/**
 * ManifestManager Public API Exports
 *
 * Complete public interface for EPUB manifest management and content operations.
 */

// Note: ManifestManagerImpl removed - use WorkspaceService for manifest operations

// Utility functions
export { ManifestUtils } from './utils.js';

// Type definitions
export type {
  ManifestItem,
  CreateTextItemData,
  ContentPreview,
  ContentMetadata,
  SourceItem,
  ValidationResult,
  MediaTypeCategories,
  MediaTypeDefinition,
} from './types.js';

// Error classes
export {
  WorkspaceNotFoundError,
  ManifestCorruptedError,
  ItemNotFoundError,
  DuplicateItemError,
  ValidationError,
  StorageQuotaExceededError,
  ContentTooBigError,
} from './types.js';
