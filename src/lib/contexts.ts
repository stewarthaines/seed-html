/**
 * Context keys and types for Svelte context system
 * 
 * Used for dependency injection in stories and testing environments.
 * Production App.svelte creates real managers when no context is provided.
 */

import type { IWorkspaceManager } from './workspace/types';
import type { ManifestManagerImpl } from './manifest/manifest-manager';
import type { MetadataManagerImpl } from './metadata/MetadataManager';

// Context keys as symbols for type safety
export const WORKSPACE_MANAGER_CONTEXT = Symbol('workspaceManager');
export const MANIFEST_MANAGER_CONTEXT = Symbol('manifestManager');
export const METADATA_MANAGER_CONTEXT = Symbol('metadataManager');
export const WORKSPACE_ID_CONTEXT = Symbol('workspaceId');

// Context value types
export interface AppContexts {
  workspaceManager?: IWorkspaceManager;
  manifestManager?: ManifestManagerImpl;
  metadataManager?: MetadataManagerImpl;
  workspaceId?: string;
}

// Type-safe context getters
export type WorkspaceManagerContext = IWorkspaceManager | undefined;
export type ManifestManagerContext = ManifestManagerImpl | undefined;
export type MetadataManagerContext = MetadataManagerImpl | undefined;
export type WorkspaceIdContext = string | undefined;