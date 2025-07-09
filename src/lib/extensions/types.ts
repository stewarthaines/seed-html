/**
 * Type definitions for the Extension Manager system
 */

/**
 * Information about an extension in a workspace or cache
 */
export interface ExtensionInfo {
  /** Extension directory name */
  name: string;
  /** All JavaScript and license files */
  files: ExtensionFile[];
  /** Combined size of all files in bytes */
  totalSize: number;
  /** Where this info was retrieved from */
  location: 'workspace' | 'cache';
}

/**
 * Individual file within an extension
 */
export interface ExtensionFile {
  /** e.g., "markdown-it.min.js", "LICENSE.txt" */
  filename: string;
  /** File size in bytes */
  size: number;
  /** File type classification */
  type: 'javascript' | 'license';
}

/**
 * Summary of batch caching operations
 */
export interface CachingSummary {
  /** Number of extensions successfully cached */
  successCount: number;
  /** Total extensions found in workspace */
  totalScanned: number;
  /** Names of extensions with cache conflicts */
  conflicts: string[];
  /** Detailed error information */
  errors: CachingError[];
}

/**
 * Error information for failed caching operations
 */
export interface CachingError {
  /** Extension that failed to cache */
  extensionName: string;
  /** Type of error that occurred */
  reason: 'conflict' | 'storage' | 'validation';
  /** Human-readable error message */
  message: string;
}

/**
 * Result of file validation
 */
export interface ValidationResult {
  /** Whether file passed validation */
  isValid: boolean;
  /** Detected file type */
  fileType: 'javascript' | 'license' | 'unknown';
  /** Error message if validation failed */
  error?: string;
}

/**
 * Extension signature for conflict detection
 */
export interface ExtensionSignature {
  /** File metadata for comparison */
  files: Array<{ name: string; size: number }>;
  /** Total size for quick comparison */
  totalSize: number;
}
