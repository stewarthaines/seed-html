/**
 * Type definitions for ManifestManager
 * 
 * Complete interface definitions for EPUB manifest management and content operations.
 */

// Core manifest item interface matching EPUB specification
export interface ManifestItem {
  // Required EPUB manifest fields
  id: string; // Unique identifier within manifest
  href: string; // Relative path within EPUB
  mediaType: string; // MIME type

  // Optional EPUB manifest fields
  properties?: string[]; // EPUB properties (e.g., 'nav', 'cover-image')

  // Extended metadata for management
  size?: number; // File size in bytes
  modified?: Date; // Last modification time
  isInSpine?: boolean; // Whether item appears in spine
  spineIndex?: number; // Position in spine (if applicable)
}

// Data structure for creating new text items
export interface CreateTextItemData {
  id?: string; // Optional ID (will be generated if not provided)
  fileName: string; // File name (e.g., 'chapter1.xhtml')
  content: string; // Text content
  mediaType?: string; // Optional media type (will be detected if not provided)
  properties?: string[]; // Optional EPUB properties
  targetDirectory?: string; // Optional subdirectory (defaults to 'OEBPS/')
}

// Content preview data for UI display
export interface ContentPreview {
  itemId: string;
  mediaType: string;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'binary';
  previewUrl?: string; // Blob URL for binary content
  textContent?: string; // For text content types
  metadata?: ContentMetadata;
  error?: string; // If preview generation failed
}

// Metadata extracted from content files
export interface ContentMetadata {
  // Image metadata
  width?: number;
  height?: number;

  // Audio/Video metadata
  duration?: number;
  bitrate?: number;

  // Text metadata
  characterCount?: number;
  lineCount?: number;
  wordCount?: number;
}

// SOURCE directory items for Advanced Mode
export interface SourceItem {
  path: string; // Relative path within SOURCE directory
  name: string; // File name
  type: 'file' | 'directory';
  size?: number; // Size in bytes (for files)
  modified?: Date; // Last modification time
  mediaType?: string; // Detected MIME type (for files)
}

// Validation result structure
export interface ValidationResult {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  itemId?: string; // For item-specific validation errors
}

// Media type categorization system
export interface MediaTypeCategories {
  text: MediaTypeDefinition[];
  image: MediaTypeDefinition[];
  audio: MediaTypeDefinition[];
  video: MediaTypeDefinition[];
  application: MediaTypeDefinition[];
}

export interface MediaTypeDefinition {
  mediaType: string;
  extensions: string[];
  description: string;
  isEpubCore?: boolean; // Whether it's a core EPUB media type
}

// Error classes for specific error types
export class WorkspaceNotFoundError extends Error {
  constructor(workspaceId: string) {
    super(`Workspace not found: ${workspaceId}`);
    this.name = 'WorkspaceNotFoundError';
  }
}

export class ManifestCorruptedError extends Error {
  constructor(message: string) {
    super(`Manifest corrupted: ${message}`);
    this.name = 'ManifestCorruptedError';
  }
}

export class ItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Item not found: ${itemId}`);
    this.name = 'ItemNotFoundError';
  }
}

export class DuplicateItemError extends Error {
  constructor(field: string, value: string) {
    super(`Duplicate item ${field}: ${value}`);
    this.name = 'DuplicateItemError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(`Validation error: ${message}`);
    this.name = 'ValidationError';
  }
}

export class StorageQuotaExceededError extends Error {
  constructor() {
    super('Storage quota exceeded');
    this.name = 'StorageQuotaExceededError';
  }
}

export class ContentTooBigError extends Error {
  constructor(size: number, limit: number) {
    super(`Content too big: ${size} bytes exceeds limit of ${limit} bytes`);
    this.name = 'ContentTooBigError';
  }
}