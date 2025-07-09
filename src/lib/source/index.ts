/**
 * SOURCE.zip Management API
 *
 * Complete API for managing SOURCE/ directory files and SOURCE.zip
 * creation/extraction in EPUB workspaces.
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
