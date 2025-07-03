/**
 * Workspace & OPF Manager Types
 *
 * Type definitions for workspace management, OPF operations, and error handling.
 */

import type { EPUBMetadata } from '../epub/opf-utils.js';

// Core workspace types
export interface WorkspaceInfo {
  id: string;
  title: string;
  author?: string;
  language: string;
  lastModified: Date;
  fileCount: number;
  totalSize: number;
  epubVersion: string;
  hasError?: boolean; // Set when workspace has validation errors
}

export interface WorkspacePathInfo {
  rootfilePath: string; // Full path to OPF file (e.g., "OEBPS/content.opf")
  basePath: string; // Base directory for EPUB content (e.g., "OEBPS")
  opfFileName: string; // OPF filename (e.g., "content.opf")
}


export interface WorkspacePreview {
  metadata: EPUBMetadata;
  manifestSummary: {
    textItems: number; // .xhtml, .html files
    imageItems: number; // .jpg, .png, .gif, .svg files
    audioItems: number; // .mp3, .wav, .ogg files
    videoItems: number; // .mp4, .webm files
    fontItems: number; // .ttf, .otf, .woff files
    otherItems: number; // Everything else
  };
  spineOrder: string[]; // Ordered list of spine item IDs
  estimatedEPUBSize: number; // Sum of all file sizes in bytes
  dependencies: {
    // File dependency analysis
    orphanedFiles: string[]; // Files not referenced anywhere
    missingDependencies: string[]; // Referenced files that don't exist
    circularReferences: string[][]; // Circular dependency chains
  };
}

// Configuration types
export interface WorkspaceConfig {
  cache: {
    ttl: number; // Cache TTL in milliseconds (default: 24 hours)
    maxEntries: number; // Max memory cache entries (default: 100)
    enableDiskCache: boolean; // Enable persistent disk cache (default: true)
  };
  validation: {
    strict: boolean; // Strict EPUB compliance (default: false)
    checkDependencies: boolean; // Validate file dependencies (default: true)
    allowOrphanedFiles: boolean; // Allow files not in manifest (default: true)
  };
  performance: {
    batchSize: number; // Batch size for bulk operations (default: 50)
    concurrency: number; // Max concurrent file operations (default: 5)
    enableProgressCallbacks: boolean; // Enable progress reporting (default: true)
  };
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    totalFiles: number;
    validFiles: number;
    missingFiles: number;
    orphanedFiles: number;
  };
}

export interface ValidationError {
  code: string;
  message: string;
  file?: string;
  line?: number;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  code: string;
  message: string;
  file?: string;
  line?: number;
  severity: 'warning';
}

// Cache types
export interface WorkspaceCacheEntry {
  version: number; // Cache format version
  workspaceId: string;
  lastCacheUpdate: number; // Timestamp when cache was last updated
  opfFileModified: number; // Timestamp of content.opf file when cached
  metadata: EPUBMetadata;
  fileCount: number;
  totalSize: number;
  epubVersion: string;
}

export interface WorkspaceCache {
  [workspaceId: string]: WorkspaceCacheEntry;
}

// Error classes
export class WorkspaceError extends Error {
  constructor(
    message: string,
    public code: string,
    public workspaceId?: string
  ) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

export class ValidationError extends WorkspaceError {
  constructor(
    message: string,
    public errors: string[],
    workspaceId?: string
  ) {
    super(message, 'VALIDATION_ERROR', workspaceId);
    this.name = 'ValidationError';
  }
}

export class CacheError extends WorkspaceError {
  constructor(
    message: string,
    public reason: 'CORRUPTED' | 'MISSING' | 'STALE',
    workspaceId?: string
  ) {
    super(message, 'CACHE_ERROR', workspaceId);
    this.name = 'CacheError';
  }
}

// Default configuration
export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  cache: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    maxEntries: 100,
    enableDiskCache: true,
  },
  validation: {
    strict: false,
    checkDependencies: true,
    allowOrphanedFiles: true,
  },
  performance: {
    batchSize: 50,
    concurrency: 5,
    enableProgressCallbacks: true,
  },
};
