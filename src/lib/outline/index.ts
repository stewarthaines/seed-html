/**
 * OutlineGenerator - EPUB Navigation Generation Utility
 * 
 * Provides utilities for generating EPUB-compliant navigation documents
 * from spine items and processing user-written navigation content.
 */

// Re-export the main OutlineGenerator class
export { OutlineGenerator } from './outline-generator';

// Export all types for external consumption
export type {
  NavigationDocument,
  NavigationMetadata,
  GenerationOptions,
  ProcessingOptions,
} from './outline-generator';

// Re-export related types from other modules for convenience
export type { SpineItemWithSource } from '../spine/types';
export type { IWorkspaceManager } from '../workspace/types';
export type { TransformPipeline } from '../transform/transform-pipeline';