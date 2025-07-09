/**
 * Extension utility functions for name detection, validation, and file processing
 */

import type { ValidationResult, ExtensionSignature } from './types.js';

/**
 * Detects extension name from JavaScript filename
 * Removes version numbers, .min suffixes, and .js extension
 *
 * @param filename - JavaScript filename to analyze
 * @returns Normalized extension name suitable for directory naming
 */
export function detectExtensionName(filename: string): string {
  let name = filename;

  // Remove .js extension
  if (name.endsWith('.js')) {
    name = name.slice(0, -3);
  }

  // Remove .min suffix
  if (name.endsWith('.min')) {
    name = name.slice(0, -4);
  }

  // Remove version patterns like -13.0.1, @1.2.3, -1.2.3-beta but preserve simple -v2 style
  // Only remove if it's a complex version (has dots or multiple parts)
  name = name.replace(/[-@](?:v?\d+[\.\-]\d+|\d+[\.\-]\d+)(?:[\.\-]\w+)*$/i, '');

  // Normalize to safe directory name
  return normalizeExtensionName(name);
}

/**
 * Normalizes extension name to ensure safe directory naming
 *
 * @param name - Raw extension name
 * @returns Normalized name with only lowercase letters, numbers, and hyphens
 */
export function normalizeExtensionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length to 50 characters
}

/**
 * Validates uploaded file for extension import
 *
 * @param file - File to validate
 * @returns Validation result with file type and any errors
 */
export function validateExtensionFile(file: File): ValidationResult {
  const filename = file.name.toLowerCase();

  // Check for JavaScript files
  if (filename.endsWith('.js')) {
    if (file.size === 0) {
      return {
        isValid: false,
        fileType: 'javascript',
        error: 'JavaScript file cannot be empty',
      };
    }

    if (file.size > 50 * 1024 * 1024) {
      // 50MB limit
      return {
        isValid: false,
        fileType: 'javascript',
        error: 'JavaScript file too large (max 50MB)',
      };
    }

    return {
      isValid: true,
      fileType: 'javascript',
    };
  }

  // Check for license files (only .txt and plain LICENSE files supported)
  if (filename === 'license.txt' || filename === 'license') {
    if (file.size > 1024 * 1024) {
      // 1MB limit for license
      return {
        isValid: false,
        fileType: 'license',
        error: 'License file too large (max 1MB)',
      };
    }

    return {
      isValid: true,
      fileType: 'license',
    };
  }

  return {
    isValid: false,
    fileType: 'unknown',
    error: 'Invalid file type: only JavaScript (.js) and license files are supported',
  };
}

/**
 * Creates extension signature for conflict detection
 *
 * @param files - Array of extension files with metadata
 * @returns Signature object for comparison
 */
export function createExtensionSignature(
  files: Array<{ name: string; size: number }>
): ExtensionSignature {
  const sortedFiles = files.slice().sort((a, b) => a.name.localeCompare(b.name));

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return {
    files: sortedFiles,
    totalSize,
  };
}

/**
 * Compares two extension signatures for conflict detection
 *
 * @param sig1 - First extension signature
 * @param sig2 - Second extension signature
 * @returns True if signatures match (no conflict)
 */
export function compareExtensionSignatures(
  sig1: ExtensionSignature,
  sig2: ExtensionSignature
): boolean {
  if (sig1.totalSize !== sig2.totalSize) return false;
  if (sig1.files.length !== sig2.files.length) return false;

  return sig1.files.every(
    (file, index) => file.name === sig2.files[index].name && file.size === sig2.files[index].size
  );
}

/**
 * Validates extension name for directory creation
 *
 * @param name - Extension name to validate
 * @returns True if name is valid for use as directory name
 */
export function isValidExtensionName(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (name.length > 100) return false; // Reasonable length limit

  // Must contain only lowercase letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(name)) return false;

  // Cannot start or end with hyphen
  if (name.startsWith('-') || name.endsWith('-')) return false;

  // Cannot be just hyphens
  if (/^-+$/.test(name)) return false;

  return true;
}
