/**
 * EPUB Library Exports
 */

// Main classes
export { EPUBUnpacker } from './EPUBUnpacker.js';
export { EPUBPackager } from './EPUBPackager.js';
export { OPFUtils } from './opf-utils.js';

// Type definitions
export type { UnpackResult, ValidationResult, ExtractionResult } from './EPUBUnpacker.js';

export type {
  EPUBMetadata,
  WorkspaceFile,
  CompressionSettings,
  PackageProgress,
  PackageOptions,
  PackageResult,
} from './EPUBPackager.js';

export type {
  OPFDocument,
  ManifestItem,
  SpineItem,
  GuideItem,
  ContainerInfo,
  XMLValidationResult,
} from './opf-utils.js';
