/**
 * Editor-source archive (SEED.zip) Management API
 *
 * Complete API for managing SOURCE/ directory files and the editor-source
 * archive (SEED.zip; legacy SOURCE.zip still imported) creation/extraction in
 * EPUB workspaces.
 */

// Main classes
export { SourceManager } from './source-manager.js';

// Utility functions
export {
  classifySourceFile,
  validateSourcePath,
  isSourceFile,
  getSourceFileType,
  validateSettingsJson,
  calculateDirectoryStats,
  sanitizeSourcePath,
  SOURCE_ARCHIVE_NAME,
  LEGACY_SOURCE_ARCHIVE_NAME,
  SOURCE_ARCHIVE_NAMES,
} from './source-utils.js';

// Type definitions
export type {
  SourceFileInfo,
  SourceValidation,
  SourceStats,
  SettingsValidation,
  SourceFileType,
  SourceSettings,
} from './types.js';

// Constants
export { DEFAULT_SOURCE_SETTINGS } from './types.js';
