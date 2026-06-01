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
 * Message protocol for iframe communication - Parent to Iframe
 */
export interface EditorMessage {
  type:
    | 'SET_TRANSFORM_SCRIPTS'
    | 'SET_EXTENSION_GLOBALS'
    | 'EXECUTE_TRANSFORM'
    | 'SET_DEBUG_MODE'
    | 'PING';
  payload: {
    // For SET_TRANSFORM_SCRIPTS
    textTransform?: string;
    domTransforms?: string[];

    // For SET_EXTENSION_GLOBALS
    globals?: Record<string, any>;

    // For EXECUTE_TRANSFORM
    plainText?: string;
    timeout?: number;

    // For SET_DEBUG_MODE
    enabled?: boolean;

    // For PING
    data?: any;
  };
  messageId?: string;
}

/**
 * Message protocol for iframe communication - Iframe to Parent
 */
export interface EditorResponse {
  type: 'IFRAME_READY' | 'TRANSFORM_RESULT' | 'GLOBAL_ERROR' | 'UNHANDLED_REJECTION';
  payload?: {
    // For TRANSFORM_RESULT (via messageId)
    result?: TransformResult;

    // For errors
    message?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    stack?: string;
  };
  messageId?: string;
}

/**
 * Transform execution request
 */
export interface TransformRequest {
  plainText: string;
  timeout?: number;
}

/**
 * File type options for editor panes
 */
export type FileType = 'text' | 'css' | 'javascript' | 'transform-text' | 'transform-dom';

/**
 * File information for editor dropdowns
 */
export interface FileOption {
  value: FileType;
  label: string;
  path: string;
}

/**
 * Editor pane mode
 */
export type EditorMode = 'single' | 'dual';

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
 * Workspace file paths for spine item editing
 */
export interface SpineItemPaths {
  textContent: string; // SOURCE/text/{spineItemId}.txt
  stylesheet: string; // OEBPS/Styles/{spineItemId}.css
  javascript: string; // OEBPS/Scripts/{spineItemId}.js
  xhtmlOutput: string; // OEBPS/Text/{spineItemId}.xhtml
}

/**
 * Transform pipeline execution context
 */
export interface TransformContext {
  workspaceId: string;
  spineItemId: string;
  manifestItems?: Record<string, any>;
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
 * Blob URL processing result
 */
export interface BlobURLProcessingResult {
  processedXHTML: string;
  blobUrls: string[];
  errors: string[];
}

/**
 * Editor pane state
 */
export interface EditorPaneState {
  fileType: FileType;
  content: string;
  hasChanges: boolean;
  lastSaved?: Date;
}

/**
 * Spine item editor state
 */
export interface SpineItemEditorState {
  mode: EditorMode;
  pane1: EditorPaneState;
  pane2: EditorPaneState;
  previewHtml: string;
  errors: TransformError[];
  isTransforming: boolean;
  lastTransformTime?: number;
}

/**
 * Transform execution options
 */
export interface TransformExecutionOptions {
  timeoutMs?: number;
  globals?: Record<string, any>;
  debugMode?: boolean;
}

/**
 * XHTML generation options
 */
export interface XHTMLGenerationOptions {
  includeInlineCSS: boolean;
  includeInlineJS: boolean;
  processAssets: boolean;
  metadata: ChapterMetadata;
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
 * File change event for real-time updates
 */
export interface FileChangeEvent {
  path: string;
  type: 'created' | 'modified' | 'deleted';
  content?: string;
  timestamp: number;
}

/**
 * Preview update event
 */
export interface PreviewUpdateEvent {
  xhtml: string;
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

/**
 * Transform pipeline interface for dependency injection
 */
export interface ITransformPipeline {
  executeTransform(plainText: string): Promise<TransformResult>;
  loadTransformScripts(): Promise<TransformScripts>;
  cleanup(): void;
}

/**
 * Preview manager interface for dependency injection
 */
export interface IPreviewManager {
  updateContent(type: ContentType, content: string): void;
  setMetadata(metadata: ChapterMetadata): void;
  cleanup(): void;
}

/**
 * Spine item editor component props
 */
export interface SpineItemEditorProps {
  workspaceId: string;
  spineItemId: string;
  metadata: ChapterMetadata;
  fileStorage: any; // FileStorageAPI
  extensionManager: any; // ExtensionManager
  blobURLManager: any; // BlobURLManager
  workspaceService: any; // WorkspaceService
  onPreviewUpdate?: (event: PreviewUpdateEvent) => void;
  onError?: (event: PreviewErrorEvent) => void;
  onContentChange?: (fileType: FileType, content: string) => void;
}

/**
 * Editor pane component props
 */
export interface EditorPaneProps {
  fileType: FileType;
  content: string;
  availableFiles: FileOption[];
  placeholder?: string;
  readonly?: boolean;
  onFileTypeChange: (fileType: FileType) => void;
  onContentChange: (content: string) => void;
}

/**
 * Preview pane component props
 */
export interface PreviewPaneProps {
  html: string;
  errors: TransformError[];
  isTransforming: boolean;
  title?: string;
}

/**
 * Utility type for making properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type for deep partial
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Utility type for error handling
 */
export type Result<T, E = TransformError> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: E;
    };

/**
 * Spine item editor events
 */
export interface SpineItemEditorEvents {
  'preview-update': PreviewUpdateEvent;
  'preview-error': PreviewErrorEvent;
  'content-change': { fileType: FileType; content: string; hasChanges: boolean };
  'file-saved': { fileType: FileType; path: string };
  'mode-change': { mode: EditorMode };
}

/**
 * Transform execution statistics
 */
export interface TransformStats {
  totalExecutions: number;
  averageExecutionTime: number;
  successRate: number;
  lastExecution?: {
    timestamp: number;
    duration: number;
    success: boolean;
  };
}

/**
 * Spine item editor settings
 */
export interface SpineItemEditorSettings {
  debounceMs: number;
  autoSave: boolean;
  showLineNumbers: boolean;
  wordWrap: boolean;
  fontSize: number;
  theme: 'light' | 'dark';
  transformTimeout: number;
  previewMode: 'live' | 'manual';
}
