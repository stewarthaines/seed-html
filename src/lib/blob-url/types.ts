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
