/**
 * Spine Item Text Editor Type Definitions
 *
 * TypeScript interfaces and types for the spine item text editor
 * implementation following the pragmatic, spike-inspired architecture.
 */

// ChapterMetadata has a single canonical definition in the transform package;
// import it here (and re-export below) so the spine editor shares one source of
// truth. Fixed-layout is expressed via its optional `viewport` field.
import type { ChapterMetadata } from '../transform/types.js';

/**
 * Result of a transform operation
 */
export interface TransformResult {
  success: boolean;
  html?: string;
  warnings?: string[];
  error?: TransformError;
  executionTime?: number;
}

/**
 * Transform scripts loaded from workspace settings
 */
export interface TransformScripts {
  textTransform?: string;
  domTransforms?: string[];
  /** Script basenames matching textTransform / domTransforms — used to
   *  attribute captured console warnings to the emitting script. */
  textTransformName?: string;
  domTransformNames?: string[];
  settings?: {
    transform_pipeline?: {
      timeout_ms?: number;
    };
  };
}

/**
 * Transform error with stage and location information
 */
export interface TransformError {
  stage:
    | 'text'
    | 'dom'
    | 'execution'
    | 'timeout'
    | 'communication'
    | 'script-loading'
    | 'extension-loading'
    | string;
  message: string;
  scriptName?: string;
  line?: number;
  column?: number;
  stack?: string;
}

/**
 * Chapter metadata for XHTML generation (re-exported canonical definition).
 */
export type { ChapterMetadata };

/**
 * Content type for preview manager updates
 */
export type ContentType = 'text';

/**
 * Current content state in preview manager
 */
export interface CurrentContent {
  text: string;
}

/**
 * Preview manager configuration
 */
export interface PreviewManagerConfig {
  debounceMs: number;
  transformTimeout: number;
  autoSave: boolean;
  persistToManifest: boolean;
}

/**
 * Auto-save operation result
 */
export interface AutoSaveResult {
  success: boolean;
  savedFiles: string[];
  errors: Array<{
    file: string;
    error: string;
  }>;
}

/**
 * Preview update event
 */
export interface PreviewUpdateEvent {
  xhtml: string;
  /**
   * The XHTML exactly as written to the workspace this render (pre blob-URL
   * rewrite). Absent when the render skipped persistence, in which case the
   * on-disk file may be stale relative to `xhtml`.
   */
  persistedXhtml?: string;
  warnings: string[];
  executionTime: number;
  timestamp: number;
}

/**
 * Error event for preview updates
 */
export interface PreviewErrorEvent {
  error: TransformError;
  stage: string;
  timestamp: number;
}
