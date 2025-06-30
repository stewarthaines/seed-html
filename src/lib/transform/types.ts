/**
 * Transform Pipeline Type Definitions
 * 
 * TypeScript interfaces and types for the transform pipeline system.
 */

export type TransformStage = 'loading' | 'text' | 'dom' | 'template';

export interface TransformErrorDetails {
  stage: TransformStage;
  message: string;
  scriptName?: string;
  line?: number;
  column?: number;
  stack?: string;
}

export interface TransformErrorInfo extends TransformErrorDetails {
  userMessage: string;
}

export interface TransformSettings {
  transform_pipeline?: {
    text_transform?: string;
    dom_transforms?: string[];
    enabled?: boolean;
    timeout_ms?: number;
  };
  [key: string]: any;
}

export interface TransformScript {
  filename: string;
  content: string;
  size: number;
  lastModified: Date;
}

export interface LoadedTransformScripts {
  settings: TransformSettings;
  textTransform?: TransformScript;
  domTransforms: TransformScript[];
}

export interface ScriptValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFunctions: string[];
}

export interface TransformContext {
  manifestItems?: Record<string, any>;
}

export interface ExecutionOptions {
  timeoutMs?: number;
  globals?: Record<string, any>;
}

export interface TransformResult {
  success: boolean;
  transformedText?: string;
  xhtmlDocument?: Document;
  warnings?: string[];
  error?: import('./transform-error.js').TransformError;
  executionTime?: number;
}

export interface PipelineResult {
  success: boolean;
  xhtmlDocument?: Document;
  warnings?: string[];
  error?: import('./transform-error.js').TransformError;
  executionTime?: number;
}

export interface ChapterMetadata {
  title: string;
  language: string;
  stylesheets: string[];
  scripts: string[];
  customHead?: string;
}

export interface BlobUrlManager {
  getLoadedGlobals(): Record<string, any>;
}