/**
 * Workspace & OPF Manager Types
 *
 * Type definitions for workspace management, OPF operations, and error handling.
 */

import type { ManifestItem } from '../epub/opf-utils.js';

// Re-export types for convenience
export type { ManifestItem };

// Shared output directory for packaged epubs, modelled as a reserved workspace.
// Packaging writes finished .epub files here; the Publish view (and the publish
// plugin, via a directory handle) reads them. Lives at /workspaces/publish/.
export const PUBLISH_WORKSPACE_ID = 'publish';

// Reserved workspace IDs that should be excluded from user workspace lists
export const RESERVED_WORKSPACE_IDS = new Set([
  'locales', // Used internally by the i18n system
  PUBLISH_WORKSPACE_ID, // Shared output directory for packaged epubs
]);

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
