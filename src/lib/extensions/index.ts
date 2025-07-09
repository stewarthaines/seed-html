/**
 * Extension Manager - Clean API exports
 *
 * Main entry point for extension management functionality
 */

// Main classes
export { ExtensionManager } from './extension-manager.js';
export { ExtensionCache } from './extension-cache.js';

// Utility functions
export {
  detectExtensionName,
  normalizeExtensionName,
  validateExtensionFile,
  createExtensionSignature,
  compareExtensionSignatures,
  isValidExtensionName,
} from './utils.js';

// Type definitions
export type {
  ExtensionInfo,
  ExtensionFile,
  CachingSummary,
  CachingError,
  ValidationResult,
  ExtensionSignature,
} from './types.js';
