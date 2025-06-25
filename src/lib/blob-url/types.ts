/**
 * Blob URL Manager Type Definitions
 *
 * All TypeScript interfaces and types for the Blob URL Manager
 */

import type { FileStorageAPI } from '../storage/index.js';

// Main configuration interface
export interface BlobURLManagerConfig {
  maxBlobURLs: number; // Default: 100
  fileStorage: FileStorageAPI; // File Storage API instance
  basePath: string; // EPUB content base path (from WorkspacePathInfo)
  onCapacityReached?: () => void; // Callback when limit reached
}

// Registry for tracking blob URLs
export interface BlobURLRegistry {
  urls: Map<string, string>; // href → blobURL mapping
  created: Map<string, Date>; // href → creation timestamp
  count: number; // Current URL count
  maxCount: number; // Maximum allowed URLs
}

// Asset element selector configuration
export interface AssetSelector {
  tag: string; // Element tag name
  attr: string; // Attribute name
}

// XHTML processing result
export interface XHTMLProcessingResult {
  processedContent: string; // Modified XHTML content
  assetsProcessed: number; // Number of assets processed
  assetsSkipped: number; // Number of assets skipped
  errors: AssetProcessingError[]; // Processing errors
}

// Asset processing error details
export interface AssetProcessingError {
  href: string; // Original asset href
  resolvedPath: string; // Resolved workspace path
  element: string; // Element tag name
  error: Error; // Original error
}

// Error classes
export class BlobURLError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'BlobURLError';
  }
}

export class BlobURLCapacityError extends BlobURLError {
  constructor(currentCount: number, maxCount: number) {
    super(`Blob URL capacity exceeded: ${currentCount}/${maxCount}`, 'CAPACITY_EXCEEDED');
  }
}

export class XHTMLProcessingError extends BlobURLError {
  constructor(
    message: string,
    public originalError?: Error
  ) {
    super(message, 'XHTML_PROCESSING_ERROR');
  }
}

// Asset element selectors for XHTML processing
export const ASSET_SELECTORS: AssetSelector[] = [
  { tag: 'script', attr: 'src' }, // JavaScript files
  { tag: 'link', attr: 'href' }, // Stylesheets, icons
  { tag: 'a', attr: 'href' }, // Navigation links
  { tag: 'audio', attr: 'src' }, // Audio files
  { tag: 'video', attr: 'src' }, // Video files
  { tag: 'video', attr: 'poster' }, // Video poster images
  { tag: 'img', attr: 'src' }, // Images
  { tag: 'object', attr: 'data' }, // Embedded objects
  { tag: 'image', attr: 'href' }, // SVG image elements
  { tag: '*', attr: 'data-src' }, // Custom lazy-loading attributes
];

// Error icon SVG for missing images
export const ERROR_ICON_SVG = `data:image/svg+xml,${encodeURIComponent(`
  <svg width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="#f44336" stroke="#d32f2f"/>
    <text x="12" y="16" text-anchor="middle" fill="white" font-size="12">!</text>
  </svg>
`)}`;

// Visual asset types that get error icons when missing
export const VISUAL_ASSET_ELEMENTS = new Set(['img', 'video', 'audio', 'object', 'image']);

// Non-visual asset types that preserve original URLs when missing
export const NON_VISUAL_ASSET_ELEMENTS = new Set(['script', 'link']);

// Navigation elements that get no special error handling
export const NAVIGATION_ELEMENTS = new Set(['a']);

// Extended File Storage API interface for OPFS optimization
export interface ExtendedFileStorageAPI extends FileStorageAPI {
  // OPFS optimization methods
  supportsDirectBlobURLs(): boolean;
  getFile(workspaceId: string, filePath: string): Promise<File>;
}
