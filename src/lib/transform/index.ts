/**
 * Transform Pipeline API Exports
 *
 * Main entry point for the transform pipeline system providing
 * clean exports for all classes and types.
 */

// Main classes
export { TransformManager } from './transform-manager.js';
export { TransformExecutor } from './transform-executor.js';
export { TransformError } from './transform-error.js';

// Utility functions
export { generateXHTMLDocument } from './xhtml-template.js';

// Type definitions
export type {
  TransformStage,
  TransformErrorDetails,
  TransformErrorInfo,
  TransformSettings,
  TransformScript,
  LoadedTransformScripts,
  ScriptValidationResult,
  TransformContext,
  ExecutionOptions,
  TransformResult,
  ChapterMetadata,
  BlobUrlManager,
} from './types.js';
