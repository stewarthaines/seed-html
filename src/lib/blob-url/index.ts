/**
 * Blob URL Manager - Main Exports
 * 
 * Public API for the Blob URL Manager feature, providing blob URL creation
 * and XHTML processing for EPUB preview iframes.
 */

// Main classes
export { BlobURLManager } from './blob-url-manager.js';

// Type definitions
export type {
  BlobURLManagerConfig,
  BlobURLRegistry,
  AssetSelector,
  XHTMLProcessingResult,
  AssetProcessingError,
  ExtendedFileStorageAPI
} from './types.js';

// Error classes
export {
  BlobURLError,
  BlobURLCapacityError,
  XHTMLProcessingError,
  ASSET_SELECTORS,
  ERROR_ICON_SVG,
  VISUAL_ASSET_ELEMENTS,
  NON_VISUAL_ASSET_ELEMENTS,
  NAVIGATION_ELEMENTS
} from './types.js';

// Utility functions
export {
  isRelativeResourceURL,
  resolveManifestPath,
  getFileExtension,
  isVisualAssetElement,
  isNonVisualAssetElement,
  isNavigationElement,
  getAssetAttribute,
  createErrorIconSVG,
  findAssetElements,
  parseXHTML,
  serializeXHTML,
  validateXHTML,
  extractAssetReferences,
  countAssetReferences
} from './utils.js';

// Re-export MIME type utility for convenience
export { getMimeType } from '../utils/mime-types.js';