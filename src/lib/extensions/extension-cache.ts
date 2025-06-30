/**
 * ExtensionCache - Global extension cache management
 * 
 * Internal utility class for managing the global extension cache using
 * File Storage API with workspace ID 'extensions-cache'.
 */

import type { FileStorageAPI } from '../storage/index.js';
import type { ExtensionInfo, ExtensionFile, ExtensionSignature } from './types.js';
import { createExtensionSignature, compareExtensionSignatures } from './utils.js';

/**
 * Global cache identifier for extensions in File Storage
 */
const CACHE_WORKSPACE_ID = 'extensions-cache';

/**
 * ExtensionCache manages the global extension cache
 */
export class ExtensionCache {
  constructor(private fileStorage: FileStorageAPI) {}

  /**
   * Lists all extensions in the global cache
   * 
   * @returns Promise resolving to array of cached extension info
   */
  async listCachedExtensions(): Promise<ExtensionInfo[]> {
    try {
      const files = await this.fileStorage.listFiles(CACHE_WORKSPACE_ID);
      const extensionDirs = new Set<string>();
      
      // Group files by extension directory
      for (const file of files) {
        const pathParts = file.split('/');
        if (pathParts.length >= 2) {
          extensionDirs.add(pathParts[0]);
        }
      }
      
      const extensions: ExtensionInfo[] = [];
      
      for (const extensionName of extensionDirs) {
        try {
          const info = await this.getExtensionInfo(extensionName);
          extensions.push(info);
        } catch (error) {
          // Skip corrupted extensions silently
        }
      }
      
      return extensions.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      // If cache workspace doesn't exist, return empty array
      if (error instanceof Error && error.message.includes('not found')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Gets detailed information about a cached extension
   * 
   * @param extensionName - Name of cached extension
   * @returns Promise resolving to extension info
   */
  async getExtensionInfo(extensionName: string): Promise<ExtensionInfo> {
    const files = await this.fileStorage.listFiles(CACHE_WORKSPACE_ID);
    const extensionFiles = files.filter(f => f.startsWith(extensionName + '/'));
    
    if (extensionFiles.length === 0) {
      throw new Error(`Extension '${extensionName}' not found in cache`);
    }
    
    const extensionFileInfos: ExtensionFile[] = [];
    let totalSize = 0;
    
    for (const filePath of extensionFiles) {
      const filename = filePath.split('/').pop()!;
      const content = await this.fileStorage.readFile(CACHE_WORKSPACE_ID, filePath);
      const fileInfo = { size: content.byteLength };
      
      let fileType: 'javascript' | 'license';
      if (filename.endsWith('.js')) {
        fileType = 'javascript';
      } else if (filename.toLowerCase().includes('license')) {
        fileType = 'license';
      } else {
        continue; // Skip unknown files
      }
      
      extensionFileInfos.push({
        filename: filePath.replace(`${extensionName}/`, ''), // Preserve directory structure
        size: fileInfo.size,
        type: fileType
      });
      
      totalSize += fileInfo.size;
    }
    
    // If no valid files found, treat as corrupted extension
    if (extensionFileInfos.length === 0) {
      throw new Error(`Extension '${extensionName}' has no valid files`);
    }
    
    return {
      name: extensionName,
      files: extensionFileInfos,
      totalSize,
      location: 'cache'
    };
  }

  /**
   * Adds an extension to the global cache
   * 
   * @param extensionName - Name for the cached extension
   * @param files - Map of filename to file content
   * @returns Promise that resolves when caching is complete
   */
  async cacheExtension(extensionName: string, files: Map<string, ArrayBuffer>): Promise<void> {
    // Check for conflicts first
    const hasConflict = await this.hasConflict(extensionName, files);
    if (hasConflict) {
      throw new Error(`Extension '${extensionName}' already cached with different content`);
    }
    
    // Cache all files
    for (const [filename, content] of files.entries()) {
      const filePath = `${extensionName}/${filename}`;
      await this.fileStorage.writeFile(CACHE_WORKSPACE_ID, filePath, content);
    }
  }

  /**
   * Copies an extension from cache to a workspace
   * 
   * @param extensionName - Name of cached extension to copy
   * @param targetWorkspaceId - Destination workspace ID
   * @returns Promise that resolves when copying is complete
   */
  async copyToWorkspace(extensionName: string, targetWorkspaceId: string): Promise<void> {
    const files = await this.fileStorage.listFiles(CACHE_WORKSPACE_ID);
    const extensionFiles = files.filter(f => f.startsWith(extensionName + '/'));
    
    if (extensionFiles.length === 0) {
      throw new Error(`Extension '${extensionName}' not found in cache`);
    }
    
    // Copy all files to workspace
    for (const filePath of extensionFiles) {
      const content = await this.fileStorage.readFile(CACHE_WORKSPACE_ID, filePath);
      const targetPath = `SOURCE/extensions/${filePath}`;
      await this.fileStorage.writeFile(targetWorkspaceId, targetPath, content);
    }
  }

  /**
   * Removes an extension from the global cache
   * 
   * @param extensionName - Name of extension to remove
   * @returns Promise that resolves when deletion is complete
   */
  async deleteExtension(extensionName: string): Promise<void> {
    const files = await this.fileStorage.listFiles(CACHE_WORKSPACE_ID);
    const extensionFiles = files.filter(f => f.startsWith(extensionName + '/'));
    
    if (extensionFiles.length === 0) {
      throw new Error(`Extension '${extensionName}' not found in cache`);
    }
    
    // Delete all extension files
    for (const filePath of extensionFiles) {
      await this.fileStorage.deleteFile(CACHE_WORKSPACE_ID, filePath);
    }
  }

  /**
   * Checks if caching would create a conflict
   * 
   * @param extensionName - Name of extension to check
   * @param files - Files to be cached
   * @returns Promise resolving to true if conflict exists
   */
  async hasConflict(extensionName: string, files: Map<string, ArrayBuffer>): Promise<boolean> {
    try {
      const existingInfo = await this.getExtensionInfo(extensionName);
      
      // Create signatures for comparison
      const newSignature = createExtensionSignature(
        Array.from(files.keys()).map(name => ({
          name,
          size: files.get(name)!.byteLength
        }))
      );
      
      const existingSignature = createExtensionSignature(
        existingInfo.files.map(f => ({ name: f.filename, size: f.size }))
      );
      
      // No conflict if signatures match
      return !compareExtensionSignatures(newSignature, existingSignature);
    } catch (_error) {
      // No conflict if extension doesn't exist in cache
      return false;
    }
  }

  /**
   * Gets extension signature for conflict checking (optimized - doesn't read file contents)
   * 
   * @param extensionName - Name of extension to check
   * @returns Promise resolving to extension signature or null if not found
   */
  async getExtensionSignature(extensionName: string): Promise<ExtensionSignature | null> {
    try {
      const files = await this.fileStorage.listFiles(CACHE_WORKSPACE_ID);
      const extensionFiles = files.filter(f => f.startsWith(extensionName + '/'));
      
      if (extensionFiles.length === 0) {
        return null;
      }
      
      const fileInfos = [];
      for (const filePath of extensionFiles) {
        const filename = filePath.split('/').pop()!;
        
        // Only process valid extension files
        if (filename.endsWith('.js') || filename.toLowerCase().includes('license')) {
          try {
            const fileInfo = await this.fileStorage.getFileInfo(CACHE_WORKSPACE_ID, filePath);
            fileInfos.push({ name: filename, size: fileInfo.size });
          } catch (error) {
            // If getFileInfo fails, fall back to reading content
            const content = await this.fileStorage.readFile(CACHE_WORKSPACE_ID, filePath);
            fileInfos.push({ name: filename, size: content.byteLength });
          }
        }
      }
      
      return createExtensionSignature(fileInfos);
    } catch (_error) {
      return null;
    }
  }

  /**
   * Legacy method for test compatibility - caches extension from workspace
   * 
   * @param workspaceId - Source workspace identifier
   * @param extensionName - Extension to cache
   * @returns Promise that resolves when caching is complete
   */
  async addToCache(workspaceId: string, extensionName: string): Promise<void> {
    // Get extension files from workspace
    const files = await this.fileStorage.listFiles(workspaceId);
    const extensionFiles = files.filter(f => f.startsWith(`SOURCE/extensions/${extensionName}/`));
    
    if (extensionFiles.length === 0) {
      throw new Error(`Extension '${extensionName}' does not exist in workspace`);
    }

    const fileMap = new Map<string, ArrayBuffer>();
    
    for (const filePath of extensionFiles) {
      // Preserve directory structure by removing only the SOURCE/extensions/{name}/ prefix
      const relativePath = filePath.replace(`SOURCE/extensions/${extensionName}/`, '');
      const content = await this.fileStorage.readFile(workspaceId, filePath);
      fileMap.set(relativePath, content);
    }

    await this.cacheExtension(extensionName, fileMap);
  }

  /**
   * Legacy method for test compatibility - removes extension from cache
   * 
   * @param extensionName - Extension to remove
   * @returns Promise that resolves when removal is complete
   */
  async removeFromCache(extensionName: string): Promise<void> {
    await this.deleteExtension(extensionName);
  }

  /**
   * Gets the cache workspace ID (for test access)
   * 
   * @returns Cache workspace identifier
   */
  get cacheWorkspaceId(): string {
    return CACHE_WORKSPACE_ID;
  }

  /**
   * Legacy method for test compatibility - imports extension from cache to workspace
   * 
   * @param extensionName - Name of cached extension to import
   * @param targetWorkspaceId - Destination workspace ID
   * @returns Promise that resolves when import is complete
   */
  async importFromCache(extensionName: string, targetWorkspaceId: string): Promise<void> {
    // Check for workspace conflicts first
    const workspaceFiles = await this.fileStorage.listFiles(targetWorkspaceId);
    const hasConflict = workspaceFiles.some(f => f.startsWith(`SOURCE/extensions/${extensionName}/`));
    
    if (hasConflict) {
      throw new Error(`Extension '${extensionName}' already exists in workspace`);
    }
    
    await this.copyToWorkspace(extensionName, targetWorkspaceId);
  }

  /**
   * Legacy method for test compatibility - deletes cached extension
   * 
   * @param extensionName - Extension to delete
   * @returns Promise that resolves when deletion is complete
   */
  async deleteCachedExtension(extensionName: string): Promise<void> {
    await this.deleteExtension(extensionName);
  }

  /**
   * Legacy method for test compatibility - checks if extension is cached
   * 
   * @param extensionName - Extension name to check
   * @returns Promise resolving to true if extension is cached
   */
  async isCached(extensionName: string): Promise<boolean> {
    try {
      await this.getExtensionInfo(extensionName);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Legacy method for test compatibility - compares extensions between workspace and cache
   * 
   * @param workspaceId - Workspace ID to compare from
   * @param workspaceExtensionName - Extension name in workspace
   * @param cacheExtensionName - Extension name in cache
   * @returns Promise resolving to true if extensions are different
   */
  async compareExtensions(workspaceId: string, workspaceExtensionName: string, cacheExtensionName: string): Promise<boolean> {
    try {
      // Get workspace extension files
      const workspaceFiles = await this.fileStorage.listFiles(workspaceId);
      const workspaceExtensionFiles = workspaceFiles.filter(f => 
        f.startsWith(`SOURCE/extensions/${workspaceExtensionName}/`)
      );

      // Get cache extension files
      const cacheFiles = await this.fileStorage.listFiles(CACHE_WORKSPACE_ID);
      const cacheExtensionFiles = cacheFiles.filter(f => 
        f.startsWith(`${cacheExtensionName}/`)
      );

      // Quick check: different file counts
      if (workspaceExtensionFiles.length !== cacheExtensionFiles.length) {
        return true; // Different
      }

      // Compare file signatures
      const workspaceSignature = await this.createWorkspaceSignature(workspaceId, workspaceExtensionName, workspaceExtensionFiles);
      const cacheSignature = await this.createCacheSignature(cacheExtensionName, cacheExtensionFiles);

      return !compareExtensionSignatures(workspaceSignature, cacheSignature);
    } catch (error) {
      // If either extension doesn't exist, they're different
      return true;
    }
  }

  /**
   * Creates signature for workspace extension
   */
  private async createWorkspaceSignature(workspaceId: string, extensionName: string, files: string[]): Promise<ExtensionSignature> {
    const fileInfos = [];
    for (const filePath of files) {
      const relativePath = filePath.replace(`SOURCE/extensions/${extensionName}/`, '');
      const filename = filePath.split('/').pop()!;
      
      if (filename.endsWith('.js') || filename.toLowerCase().includes('license')) {
        const content = await this.fileStorage.readFile(workspaceId, filePath);
        fileInfos.push({ name: relativePath, size: content.byteLength });
      }
    }
    return createExtensionSignature(fileInfos);
  }

  /**
   * Creates signature for cache extension
   */
  private async createCacheSignature(extensionName: string, files: string[]): Promise<ExtensionSignature> {
    const fileInfos = [];
    for (const filePath of files) {
      const relativePath = filePath.replace(`${extensionName}/`, '');
      const filename = filePath.split('/').pop()!;
      
      if (filename.endsWith('.js') || filename.toLowerCase().includes('license')) {
        const content = await this.fileStorage.readFile(CACHE_WORKSPACE_ID, filePath);
        fileInfos.push({ name: relativePath, size: content.byteLength });
      }
    }
    return createExtensionSignature(fileInfos);
  }

  /**
   * Legacy method for test compatibility - gets cache statistics
   * 
   * @returns Promise resolving to cache statistics
   */
  async getCacheStats(): Promise<{ totalExtensions: number; totalSize: number; extensionCount: Record<string, number> }> {
    try {
      const extensions = await this.listCachedExtensions();
      const extensionCount: Record<string, number> = {};
      
      for (const ext of extensions) {
        extensionCount[ext.name] = ext.files.length;
      }
      
      return {
        totalExtensions: extensions.length,
        totalSize: extensions.reduce((sum, ext) => sum + ext.totalSize, 0),
        extensionCount
      };
    } catch (error) {
      // Re-throw error for test compatibility
      throw error;
    }
  }
}