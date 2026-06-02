/**
 * ReactiveWorkspaceCache Class
 *
 * Single-tier reactive caching system for workspace metadata using Svelte stores.
 * Eliminates race conditions and enables progressive loading.
 */

import { writable, derived, type Writable, type Readable } from 'svelte/store';
import type { FileStorageAPI } from '../storage/index.js';
import type { WorkspaceInfo } from './types.js';
import { RESERVED_WORKSPACE_IDS } from './types.js';

export class ReactiveWorkspaceCache {
  private cache: Writable<Map<string, WorkspaceInfo>> = writable(new Map());
  private loadingState: Writable<boolean> = writable(false);
  private hasStartedLoading: boolean = false;

  // Public reactive stores for UI consumption
  public workspaces: Readable<WorkspaceInfo[]> = derived(this.cache, cache =>
    Array.from(cache.values()).sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
  );

  public isLoading: Readable<boolean> = this.loadingState;

  /**
   * Start non-blocking background loading of all workspaces
   */
  async startLoading(
    storage: FileStorageAPI,
    parseWorkspaceMetadata: (workspaceId: string) => Promise<WorkspaceInfo>
  ): Promise<void> {
    if (this.hasStartedLoading) {
      return; // Already started loading
    }

    this.hasStartedLoading = true;
    this.loadingState.set(true);

    try {
      const allWorkspaceIds = await storage.listWorkspaces();
      // Filter out reserved workspace IDs (e.g., 'locales' used by i18n system)
      const workspaceIds = allWorkspaceIds.filter(id => !RESERVED_WORKSPACE_IDS.has(id));

      // Load workspaces in parallel, update store as each completes
      const loadPromises = workspaceIds.map(async id => {
        try {
          // Parse metadata (including size calculation)
          const metadata = await parseWorkspaceMetadata(id);

          // Reactively update cache - triggers UI updates
          this.cache.update(cache => {
            const newCache = new Map(cache);
            newCache.set(id, metadata);
            return newCache;
          });
        } catch {
          // Handle individual workspace errors gracefully
          this.cache.update(cache => {
            const newCache = new Map(cache);
            newCache.set(id, {
              id,
              title: `Workspace ${id} (Error)`,
              language: 'unknown',
              lastModified: new Date(),
              fileCount: 0,
              totalSize: 0,
              epubVersion: 'Unknown',
              hasError: true,
            });
            return newCache;
          });
        }
      });

      // Wait for all workspaces to complete loading
      await Promise.all(loadPromises);
    } catch (error) {
      console.error('Failed to start workspace loading:', error);
    } finally {
      this.loadingState.set(false);
    }
  }

  /**
   * Get workspace from cache (immediate, non-blocking)
   */
  get(workspaceId: string): WorkspaceInfo | undefined {
    let result: WorkspaceInfo | undefined;

    // Get current cache value synchronously
    this.cache.subscribe(cache => {
      result = cache.get(workspaceId);
    })(); // Immediately unsubscribe after getting value

    return result;
  }

  /**
   * Update workspace in cache
   */
  set(workspaceId: string, workspaceInfo: WorkspaceInfo): void {
    this.cache.update(cache => {
      const newCache = new Map(cache);
      newCache.set(workspaceId, workspaceInfo);
      return newCache;
    });
  }

  /**
   * Refresh a single workspace in cache by re-parsing its metadata
   */
  async refreshWorkspace(
    workspaceId: string,
    parseWorkspaceMetadata: (workspaceId: string) => Promise<WorkspaceInfo>
  ): Promise<void> {
    try {
      const workspaceInfo = await parseWorkspaceMetadata(workspaceId);
      this.set(workspaceId, workspaceInfo);
    } catch (error) {
      console.error(`Failed to refresh workspace ${workspaceId}:`, error);
      // Update with error state
      this.set(workspaceId, {
        id: workspaceId,
        title: `Workspace ${workspaceId} (Error)`,
        language: 'unknown',
        lastModified: new Date(),
        fileCount: 0,
        totalSize: 0,
        epubVersion: 'Unknown',
        hasError: true,
      });
    }
  }

  /**
   * Remove workspace from cache
   */
  delete(workspaceId: string): void {
    this.cache.update(cache => {
      const newCache = new Map(cache);
      newCache.delete(workspaceId);
      return newCache;
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.set(new Map());
    this.hasStartedLoading = false;
    this.loadingState.set(false);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    memoryEntries: number;
    isLoading: boolean;
    hasStartedLoading: boolean;
  } {
    let cacheSize = 0;
    let loading = false;

    this.cache.subscribe(cache => {
      cacheSize = cache.size;
    })();

    this.loadingState.subscribe(state => {
      loading = state;
    })();

    return {
      memoryEntries: cacheSize,
      isLoading: loading,
      hasStartedLoading: this.hasStartedLoading,
    };
  }

  /**
   * Check if loading has been initiated
   */
  getHasStartedLoading(): boolean {
    return this.hasStartedLoading;
  }
}
