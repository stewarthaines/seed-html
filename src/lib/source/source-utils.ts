/**
 * Utility functions for the editor-source archive (SEED.zip) management.
 *
 * Provides helper functions for file classification, path validation,
 * and SOURCE/ directory management. Note: the EPUB archive is named SEED.zip
 * (legacy SOURCE.zip still imported); the extracted working directory is SOURCE/.
 */

import type { FileStorageAPI } from '../storage';
import type { SourceFileType, SourceStats, SettingsValidation } from './types.js';

/**
 * Filename of the bundled editor-source archive inside a packaged EPUB. New
 * (and re-exported) projects always write SEED.zip; imports also accept the
 * legacy SOURCE.zip. This is the archive *filename* only — the extracted
 * in-workspace directory is always `SOURCE/` (see validateSourcePath etc.).
 */
export const SOURCE_ARCHIVE_NAME = 'SEED.zip';
/** Legacy archive filename, still read on import for older EPUBs. */
export const LEGACY_SOURCE_ARCHIVE_NAME = 'SOURCE.zip';
/** Archive filenames accepted on import (preferred first). */
export const SOURCE_ARCHIVE_NAMES = [SOURCE_ARCHIVE_NAME, LEGACY_SOURCE_ARCHIVE_NAME];

/**
 * Classify a SOURCE/ file by its path and extension
 */
export function classifySourceFile(path: string): SourceFileType {
  // Remove SOURCE/ prefix for classification
  const relativePath = path.startsWith('SOURCE/') ? path.substring(7) : path;

  // Settings file
  if (relativePath === 'settings.json') {
    return 'settings';
  }

  // Text files (in text/ directory)
  if (relativePath.startsWith('text/')) {
    return 'text';
  }

  // Script files (in scripts/ directory)
  if (relativePath.startsWith('scripts/')) {
    return 'script';
  }

  // Extension files (in extensions/ directory)
  if (relativePath.startsWith('extensions/')) {
    return 'extension';
  }

  // Everything else
  return 'other';
}

/**
 * Validate a SOURCE/ file path for security and correctness
 */
export function validateSourcePath(path: string): boolean {
  if (!path || typeof path !== 'string' || path.trim() === '') {
    return false;
  }

  let trimmedPath = path.trim();

  // Normalize path separators for validation
  trimmedPath = trimmedPath.replace(/\\/g, '/');

  // Must start with SOURCE/
  if (!trimmedPath.startsWith('SOURCE/')) {
    return false;
  }

  // No absolute paths
  if (trimmedPath.startsWith('/') || /^[A-Za-z]:/.test(trimmedPath)) {
    return false;
  }

  // No path traversal
  if (trimmedPath.includes('..')) {
    return false;
  }

  // No suspicious Windows reserved names
  const fileName = trimmedPath.split('/').pop()?.toLowerCase() || '';
  const reservedNames = [
    'con',
    'aux',
    'prn',
    'nul',
    'com1',
    'com2',
    'com3',
    'com4',
    'com5',
    'com6',
    'com7',
    'com8',
    'com9',
    'lpt1',
    'lpt2',
    'lpt3',
    'lpt4',
    'lpt5',
    'lpt6',
    'lpt7',
    'lpt8',
    'lpt9',
  ];
  const baseName = fileName.split('.')[0];
  if (reservedNames.includes(baseName)) {
    return false;
  }

  // No system files
  if (fileName === '.ds_store' || fileName === 'thumbs.db') {
    return false;
  }

  return true;
}

/**
 * Check if a path refers to a SOURCE/ file
 */
export function isSourceFile(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Must start with SOURCE/ and have content after it
  return path.startsWith('SOURCE/') && path.length > 7;
}

/**
 * A workspace is read-only (a regular EPUB, not made by SEED.html) when it has no
 * SOURCE/ files — no plain-text sources or settings to edit. Created projects and
 * active/SEED EPUBs always carry SOURCE/, so they are editable.
 */
export function workspaceIsReadOnly(files: string[]): boolean {
  return !files.some(isSourceFile);
}

/**
 * Get the file type for a SOURCE/ file (returns null for non-SOURCE files)
 */
export function getSourceFileType(path: string): SourceFileType | null {
  if (!isSourceFile(path) || !validateSourcePath(path)) {
    return null;
  }

  return classifySourceFile(path);
}

/**
 * Validate settings.json content
 */
export function validateSettingsJson(content: string): SettingsValidation {
  const result: SettingsValidation = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // Check for empty content
  if (!content || content.trim() === '') {
    result.isValid = false;
    result.errors.push('Empty settings');
    return result;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    result.isValid = false;
    const errorMsg = `Invalid JSON syntax: ${error}`;
    result.errors.push(errorMsg);
    return result;
  }

  // Check required fields
  const requiredFields = ['version'];
  for (const field of requiredFields) {
    if (!(field in parsed)) {
      result.isValid = false;
      result.errors.push(`Missing required field: ${field}`);
    } else if (parsed[field] === null || parsed[field] === undefined) {
      result.isValid = false;
      result.errors.push(`Field '${field}' cannot be null or undefined`);
    }
  }

  // Check field types
  if ('is_draft' in parsed && typeof parsed.is_draft !== 'boolean') {
    result.isValid = false;
    result.errors.push('Field "is_draft" must be a boolean');
  }

  if ('draft_id' in parsed && typeof parsed.draft_id !== 'number') {
    result.isValid = false;
    result.errors.push('Field "draft_id" must be a number');
  }

  if ('text_transform' in parsed && typeof parsed.text_transform !== 'string') {
    result.isValid = false;
    result.errors.push('Field "text_transform" must be a string');
  }

  if ('dom_transforms' in parsed && !Array.isArray(parsed.dom_transforms)) {
    result.isValid = false;
    result.errors.push('Field "dom_transforms" must be an array');
  }

  if ('version' in parsed && typeof parsed.version !== 'string') {
    result.isValid = false;
    result.errors.push('Field "version" must be a string');
  }

  // Check for unknown fields (warnings only)
  const knownFields = ['is_draft', 'draft_id', 'text_transform', 'dom_transforms', 'version'];
  for (const field in parsed) {
    if (!knownFields.includes(field)) {
      result.warnings.push(`Unknown field: ${field}`);
    }
  }

  return result;
}

/**
 * Calculate directory statistics for SOURCE/ files
 */
export async function calculateDirectoryStats(
  fileStorage: FileStorageAPI,
  workspaceId: string
): Promise<SourceStats> {
  const allFiles = await fileStorage.listFiles(workspaceId);
  const sourceFiles = allFiles.filter(path => isSourceFile(path));

  const stats: SourceStats = {
    totalFiles: sourceFiles.length,
    totalSize: 0,
    directories: {
      text: 0,
      scripts: 0,
      extensions: 0,
    },
    hasSettingsFile: false,
  };

  for (const filePath of sourceFiles) {
    // Calculate file size
    try {
      const content = await fileStorage.readFile(workspaceId, filePath);
      stats.totalSize += content.byteLength;
    } catch {
      // Skip files that can't be read
      continue;
    }

    // Check for settings file
    if (filePath === 'SOURCE/settings.json') {
      stats.hasSettingsFile = true;
    }

    // Count files by directory
    if (filePath.startsWith('SOURCE/text/')) {
      stats.directories.text++;
    } else if (filePath.startsWith('SOURCE/scripts/')) {
      stats.directories.scripts++;
    } else if (filePath.startsWith('SOURCE/extensions/')) {
      stats.directories.extensions++;
    }
  }

  return stats;
}

/**
 * Sanitize and normalize SOURCE/ file paths
 */
export function sanitizeSourcePath(path: string): string {
  if (!path || typeof path !== 'string') {
    return '';
  }

  let sanitized = path.trim();

  // Normalize path separators
  sanitized = sanitized.replace(/\\/g, '/');

  // Remove redundant path segments
  sanitized = sanitized.replace(/\/+/g, '/'); // Multiple slashes

  // Handle current directory references carefully
  // Split path into segments, remove '.', rebuild
  const segments = sanitized.split('/');
  const cleanSegments = segments.filter(segment => segment !== '.' && segment !== '');
  sanitized = cleanSegments.join('/');

  // Remove trailing slashes (except for the root)
  if (sanitized.length > 1 && sanitized.endsWith('/')) {
    sanitized = sanitized.slice(0, -1);
  }

  return sanitized;
}

/**
 * Get the text file path for a spine ID
 * Used by the file-backed text editor store pattern
 */
export function getTextFilePath(spineId: string): string {
  return `SOURCE/text/${spineId}.txt`;
}
