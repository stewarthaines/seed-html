/**
 * Type definitions for SOURCE.zip management system
 *
 * Provides comprehensive types for SOURCE/ directory management,
 * ZIP creation/extraction, and file classification.
 */

export interface SourceFileInfo {
  path: string; // Relative path within SOURCE/
  size: number; // File size in bytes
  type: 'settings' | 'text' | 'script' | 'extension' | 'other';
  lastModified?: Date; // Last modification time (if available)
}

export interface SourceValidation {
  isValid: boolean; // Overall validation status
  errors: string[]; // Critical errors that prevent functionality
  warnings: string[]; // Non-critical issues
  fileCount: number; // Total number of SOURCE/ files
  totalSize: number; // Total size of SOURCE/ directory in bytes
  hasSettings: boolean; // Whether settings.json exists
}

export interface SourceStats {
  totalFiles: number; // Total file count
  totalSize: number; // Total size in bytes
  directories: {
    text: number; // Files in SOURCE/text/
    scripts: number; // Files in SOURCE/scripts/
    extensions: number; // Files in SOURCE/extensions/
  };
  hasSettingsFile: boolean; // Whether settings.json exists
}

export interface SettingsValidation {
  isValid: boolean; // Whether settings.json is valid
  errors: string[]; // JSON or structure errors
  warnings: string[]; // Non-critical issues (unknown fields)
}

export type SourceFileType = 'settings' | 'text' | 'script' | 'extension' | 'other';

/**
 * Valid settings.json structure for SOURCE/ directory
 */
export interface SourceSettings {
  is_draft: boolean; // Whether workspace is in draft mode
  draft_id?: number; // Draft version identifier
  text_transform?: string; // Text transform script name
  dom_transforms?: string[]; // Array of DOM transform script names
  version: string; // Settings format version
}

/**
 * Default settings.json content for new workspaces
 */
export const DEFAULT_SOURCE_SETTINGS: SourceSettings = {
  is_draft: false,
  draft_id: 1,
  text_transform: 'markdown-transform.js',
  dom_transforms: ['custom-dom.js'],
  version: '1.0.0',
};
