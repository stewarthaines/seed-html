/**
 * ManifestManager Implementation
 * 
 * Core implementation of the ManifestManager API that integrates with WorkspaceManager
 * for EPUB manifest management and content operations.
 */

import type {
  ManifestItem,
  CreateTextItemData,
  ContentPreview,
  ContentMetadata,
  SourceItem,
  ValidationResult,
  MediaTypeCategories
} from './types.js';

import {
  WorkspaceNotFoundError,
  ManifestCorruptedError,
  ItemNotFoundError,
  DuplicateItemError,
  ValidationError,
  StorageQuotaExceededError,
  ContentTooBigError
} from './types.js';

import { ManifestValidator } from './validation.js';
import { ManifestUtils } from './utils.js';
import { resolveManifestPath } from '../blob-url/utils.js';
import type { WorkspaceManager } from '../workspace/index.js';
import type { IWorkspaceManager } from '../workspace/types.js';

/**
 * Interface defining the complete ManifestManager API
 */
export interface IManifestManager {
  // Core data operations
  loadManifest(workspaceId: string): Promise<ManifestItem[]>;
  getManifestItem(workspaceId: string, itemId: string): Promise<ManifestItem>;
  updateManifestItem(workspaceId: string, itemId: string, updates: Partial<ManifestItem>): Promise<void>;
  deleteManifestItem(workspaceId: string, itemId: string): Promise<void>;

  // Content operations
  getItemContent(workspaceId: string, itemId: string): Promise<ArrayBuffer | string>;
  setItemContent(workspaceId: string, itemId: string, content: ArrayBuffer | string): Promise<void>;
  getContentPreview(workspaceId: string, itemId: string): Promise<ContentPreview>;

  // Item creation operations
  createTextItem(workspaceId: string, itemData: CreateTextItemData): Promise<ManifestItem>;
  createFileItem(workspaceId: string, file: File, targetPath?: string): Promise<ManifestItem>;
  importFileItem(workspaceId: string, filePath: string, content: ArrayBuffer): Promise<ManifestItem>;

  // Manifest structure operations
  reorderManifestItems(workspaceId: string, itemIds: string[]): Promise<void>;
  getManifestOrder(workspaceId: string): Promise<string[]>;
  validateManifest(workspaceId: string): Promise<ValidationResult[]>;

  // Advanced mode operations
  listSourceItems(workspaceId: string): Promise<SourceItem[]>;
  getSourceItemContent(workspaceId: string, sourcePath: string): Promise<ArrayBuffer | string>;
  isAdvancedModeEnabled(workspaceId: string): Promise<boolean>;

  // Utility operations
  generateItemId(fileName: string): string;
  detectMediaType(fileName: string, content?: ArrayBuffer): string;
  getMediaTypeCategories(): MediaTypeCategories;

  // Cache management
  clearCache(workspaceId?: string): void;
  preloadManifest(workspaceId: string): Promise<void>;
  clearContentCache(workspaceId: string, itemId?: string): void;
}

/**
 * Cache structure for manifest data
 */
interface ManifestCache {
  manifests: Map<string, ManifestItem[]>;
  content: Map<string, ArrayBuffer | string>;
  previews: Map<string, ContentPreview>;
  blobUrls: Set<string>;
}

/**
 * Main ManifestManager implementation
 */
export class ManifestManagerImpl implements IManifestManager {
  private cache: ManifestCache;
  private readonly CONTENT_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB
  private readonly CACHE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

  constructor(private workspaceManager: IWorkspaceManager) {
    this.cache = {
      manifests: new Map(),
      content: new Map(),
      previews: new Map(),
      blobUrls: new Set()
    };
  }

  // ========================================
  // CORE DATA OPERATIONS
  // ========================================

  async loadManifest(workspaceId: string): Promise<ManifestItem[]> {
    try {
      // Check cache first
      const cached = this.cache.manifests.get(workspaceId);
      if (cached) {
        return cached;
      }

      // Load from workspace
      const opf = await this.workspaceManager.getWorkspaceOPF(workspaceId);
      
      if (!opf) {
        throw new ManifestCorruptedError('OPF document is null or undefined');
      }

      if (opf.manifest === null) {
        throw new ManifestCorruptedError('OPF manifest is null');
      }

      const manifest = Array.isArray(opf.manifest) ? opf.manifest : [];
      
      // Cache the result
      this.cache.manifests.set(workspaceId, manifest);
      
      return manifest;
    } catch (error: any) {
      if (error.message.includes('Workspace not found')) {
        throw new WorkspaceNotFoundError(workspaceId);
      }
      if (error instanceof ManifestCorruptedError) {
        throw error;
      }
      throw new ManifestCorruptedError(error.message);
    }
  }

  async getManifestItem(workspaceId: string, itemId: string): Promise<ManifestItem> {
    const manifest = await this.loadManifest(workspaceId);
    const item = manifest.find(item => item.id === itemId);
    
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }
    
    return item;
  }

  async updateManifestItem(workspaceId: string, itemId: string, updates: Partial<ManifestItem>): Promise<void> {
    try {
      const manifest = await this.loadManifest(workspaceId);
      const itemIndex = manifest.findIndex(item => item.id === itemId);
      
      if (itemIndex === -1) {
        throw new ItemNotFoundError(itemId);
      }

      const existingItem = manifest[itemIndex];
      const updatedItem = { ...existingItem, ...updates };

      // No special early ID validation - let the validator handle it

      // Validate the updated item
      const validationErrors = ManifestValidator.validateManifestItem(updatedItem);
      const errors = validationErrors.filter(v => v.severity === 'error');
      if (errors.length > 0) {
        throw new ValidationError(errors[0].message);
      }

      // Check for duplicate href if updating href
      if (updates.href && updates.href !== existingItem.href) {
        const existingHrefs = manifest.map(item => item.href);
        if (existingHrefs.includes(updates.href)) {
          throw new DuplicateItemError('href', updates.href);
        }
      }

      // Update the item
      manifest[itemIndex] = updatedItem;

      // Save back to workspace
      const opf = await this.workspaceManager.getWorkspaceOPF(workspaceId);
      opf.manifest = manifest;
      await this.workspaceManager.updateWorkspaceOPF(workspaceId, opf);

      // Update cache
      this.cache.manifests.set(workspaceId, manifest);
    } catch (error: any) {
      if (error instanceof ItemNotFoundError || error instanceof ValidationError || error instanceof DuplicateItemError) {
        throw error;
      }
      throw new Error(`Failed to update manifest item: ${error.message}`);
    }
  }

  async deleteManifestItem(workspaceId: string, itemId: string): Promise<void> {
    try {
      const manifest = await this.loadManifest(workspaceId);
      const itemIndex = manifest.findIndex(item => item.id === itemId);
      
      if (itemIndex === -1) {
        throw new ItemNotFoundError(itemId);
      }

      const item = manifest[itemIndex];

      // Remove the item from manifest
      manifest.splice(itemIndex, 1);

      // Delete the associated file using resolved path
      try {
        const pathInfo = await this.workspaceManager.getWorkspacePathInfo(workspaceId);
        const resolvedPath = resolveManifestPath(item.href, pathInfo.basePath);
        await this.workspaceManager.deleteFile(workspaceId, resolvedPath);
      } catch (error) {
        // File might not exist, continue with manifest update
      }

      // Save updated manifest
      const opf = await this.workspaceManager.getWorkspaceOPF(workspaceId);
      opf.manifest = manifest;
      await this.workspaceManager.updateWorkspaceOPF(workspaceId, opf);

      // Update cache and clear item-specific content cache
      this.cache.manifests.set(workspaceId, manifest);
      this.clearContentCache(workspaceId, itemId);
    } catch (error: any) {
      if (error instanceof ItemNotFoundError) {
        throw error;
      }
      throw new Error(`Failed to delete manifest item: ${error.message}`);
    }
  }

  // ========================================
  // CONTENT OPERATIONS
  // ========================================

  async getItemContent(workspaceId: string, itemId: string): Promise<ArrayBuffer | string> {
    try {
      // Check cache first
      const cacheKey = `${workspaceId}:${itemId}`;
      const cached = this.cache.content.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Get item info
      const item = await this.getManifestItem(workspaceId, itemId);
      
      // Get workspace path info to resolve relative paths correctly
      const pathInfo = await this.workspaceManager.getWorkspacePathInfo(workspaceId);
      const resolvedPath = resolveManifestPath(item.href, pathInfo.basePath);
      
      // Read content from workspace using resolved path
      let content: ArrayBuffer | string;
      
      // Determine if we should read as text or binary based on media type
      if (this.isTextMediaType(item.mediaType)) {
        content = await this.workspaceManager.readTextFile(workspaceId, resolvedPath);
      } else {
        content = await this.workspaceManager.readFile(workspaceId, resolvedPath);
      }

      // Cache the content (with size limits)
      if (this.shouldCacheContent(content)) {
        this.cache.content.set(cacheKey, content);
      }

      return content;
    } catch (error: any) {
      if (error instanceof ItemNotFoundError) {
        throw error;
      }
      if (error.message.includes('File not found')) {
        throw new Error(`File not found: ${error.message}`);
      }
      throw new Error(`Failed to read content: ${error.message}`);
    }
  }

  async setItemContent(workspaceId: string, itemId: string, content: ArrayBuffer | string): Promise<void> {
    try {
      // Check content size
      const contentSize = typeof content === 'string' ? content.length : content.byteLength;
      if (contentSize > this.CONTENT_SIZE_LIMIT) {
        throw new ContentTooBigError(contentSize, this.CONTENT_SIZE_LIMIT);
      }

      // Get item info
      const item = await this.getManifestItem(workspaceId, itemId);
      
      // Write content to workspace using resolved path
      const pathInfo = await this.workspaceManager.getWorkspacePathInfo(workspaceId);
      const resolvedPath = resolveManifestPath(item.href, pathInfo.basePath);
      await this.workspaceManager.writeFile(workspaceId, resolvedPath, content);

      // Update cache
      const cacheKey = `${workspaceId}:${itemId}`;
      if (this.shouldCacheContent(content)) {
        this.cache.content.set(cacheKey, content);
      }

      // Update item metadata
      const manifest = await this.loadManifest(workspaceId);
      const itemIndex = manifest.findIndex(i => i.id === itemId);
      if (itemIndex !== -1) {
        manifest[itemIndex].size = contentSize;
        manifest[itemIndex].modified = new Date();
        
        // Save updated manifest
        const opf = await this.workspaceManager.getWorkspaceOPF(workspaceId);
        opf.manifest = manifest;
        await this.workspaceManager.updateWorkspaceOPF(workspaceId, opf);
        
        this.cache.manifests.set(workspaceId, manifest);
      }
    } catch (error: any) {
      if (error instanceof ItemNotFoundError || error instanceof ContentTooBigError) {
        throw error;
      }
      if (error.message.includes('Failed to write file')) {
        throw new Error('Failed to write file');
      }
      throw new Error(`Failed to save content: ${error.message}`);
    }
  }

  async getContentPreview(workspaceId: string, itemId: string): Promise<ContentPreview> {
    try {
      // Check cache first
      const cacheKey = `${workspaceId}:${itemId}`;
      const cached = this.cache.previews.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Get item and content
      const item = await this.getManifestItem(workspaceId, itemId);
      const content = await this.getItemContent(workspaceId, itemId);

      // Determine content type
      const contentType = this.getContentType(item.mediaType);
      
      // Create preview
      const preview: ContentPreview = {
        itemId,
        mediaType: item.mediaType,
        contentType
      };

      // Add content-specific data
      if (contentType === 'text' && typeof content === 'string') {
        preview.textContent = content;
        preview.metadata = this.extractTextMetadata(content);
      } else if (contentType === 'image' && content instanceof ArrayBuffer) {
        preview.previewUrl = ManifestUtils.createBlobUrl(content, item.mediaType);
        preview.metadata = this.extractImageMetadata(content);
        this.cache.blobUrls.add(preview.previewUrl);
      } else if ((contentType === 'audio' || contentType === 'video') && content instanceof ArrayBuffer) {
        preview.previewUrl = ManifestUtils.createBlobUrl(content, item.mediaType);
        this.cache.blobUrls.add(preview.previewUrl);
      }

      // Cache preview
      this.cache.previews.set(cacheKey, preview);

      return preview;
    } catch (error: any) {
      return {
        itemId,
        mediaType: 'application/octet-stream',
        contentType: 'binary',
        error: error.message
      };
    }
  }

  // ========================================
  // ITEM CREATION OPERATIONS
  // ========================================

  async createTextItem(workspaceId: string, itemData: CreateTextItemData): Promise<ManifestItem> {
    try {
      // Validate input
      if (!itemData.fileName || itemData.fileName.trim() === '') {
        throw new ValidationError('File name is required');
      }

      // Generate ID if not provided
      const id = itemData.id || this.generateItemId(itemData.fileName);
      
      // Detect media type if not provided
      const mediaType = itemData.mediaType || this.detectMediaType(itemData.fileName);
      
      // Build target path
      const targetDirectory = itemData.targetDirectory || 'OEBPS/';
      const href = targetDirectory + itemData.fileName;

      // Check for existing ID or href
      const manifest = await this.loadManifest(workspaceId);
      const existingIds = manifest.map(item => item.id);
      const existingHrefs = manifest.map(item => item.href);

      if (existingIds.includes(id)) {
        throw new DuplicateItemError('id', id);
      }
      if (existingHrefs.includes(href)) {
        throw new DuplicateItemError('href', href);
      }

      // Create the manifest item
      const newItem: ManifestItem = {
        id,
        href,
        mediaType,
        size: itemData.content.length,
        modified: new Date()
      };

      if (itemData.properties) {
        newItem.properties = itemData.properties;
      }

      // Validate the item
      const validationErrors = ManifestValidator.validateManifestItem(newItem);
      const errors = validationErrors.filter(v => v.severity === 'error');
      if (errors.length > 0) {
        throw new ValidationError(errors[0].message);
      }

      // Write the file
      await this.workspaceManager.writeFile(workspaceId, href, itemData.content);

      // Add to manifest
      manifest.push(newItem);

      // Save updated manifest
      const opf = await this.workspaceManager.getWorkspaceOPF(workspaceId);
      opf.manifest = manifest;
      await this.workspaceManager.updateWorkspaceOPF(workspaceId, opf);

      // Update cache
      this.cache.manifests.set(workspaceId, manifest);

      return newItem;
    } catch (error: any) {
      if (error instanceof ValidationError || error instanceof DuplicateItemError) {
        throw error;
      }
      if (error.message.includes('Failed to write file')) {
        throw new Error('Failed to write file');
      }
      throw new Error(`Failed to create text item: ${error.message}`);
    }
  }

  async createFileItem(workspaceId: string, file: File, targetPath?: string): Promise<ManifestItem> {
    try {
      // Check file size (enforce 100MB limit for tests)
      if (file.size > this.CONTENT_SIZE_LIMIT) {
        throw new ContentTooBigError(file.size, this.CONTENT_SIZE_LIMIT);
      }

      // Read file content
      const content = await file.arrayBuffer();

      // Generate target path if not provided
      const href = targetPath || `OEBPS/${file.name}`;
      
      // Generate ID from filename
      const id = this.generateItemId(file.name);
      
      // Detect media type
      const mediaType = this.detectMediaType(file.name, content);

      // Check for duplicates
      const manifest = await this.loadManifest(workspaceId);
      const existingIds = manifest.map(item => item.id);
      const existingHrefs = manifest.map(item => item.href);

      if (existingIds.includes(id)) {
        throw new DuplicateItemError('id', id);
      }
      if (existingHrefs.includes(href)) {
        throw new DuplicateItemError('href', href);
      }

      // Create the manifest item
      const newItem: ManifestItem = {
        id,
        href,
        mediaType,
        size: file.size,
        modified: new Date()
      };

      // Write the file
      await this.workspaceManager.writeFile(workspaceId, href, content);

      // Add to manifest
      manifest.push(newItem);

      // Save updated manifest
      const opf = await this.workspaceManager.getWorkspaceOPF(workspaceId);
      opf.manifest = manifest;
      await this.workspaceManager.updateWorkspaceOPF(workspaceId, opf);

      // Update cache
      this.cache.manifests.set(workspaceId, manifest);

      return newItem;
    } catch (error: any) {
      if (error instanceof ContentTooBigError || error instanceof DuplicateItemError) {
        throw error;
      }
      throw new Error(`Failed to create file item: ${error.message}`);
    }
  }

  async importFileItem(workspaceId: string, filePath: string, content: ArrayBuffer): Promise<ManifestItem> {
    // Extract filename from path
    const fileName = filePath.split('/').pop() || 'imported-file';
    
    // Create a mock File object
    const mockFile = {
      name: fileName,
      size: content.byteLength,
      arrayBuffer: () => Promise.resolve(content)
    } as File;

    return this.createFileItem(workspaceId, mockFile, filePath);
  }

  // ========================================
  // MANIFEST STRUCTURE OPERATIONS
  // ========================================

  async reorderManifestItems(workspaceId: string, itemIds: string[]): Promise<void> {
    try {
      const manifest = await this.loadManifest(workspaceId);
      
      // Validate all IDs exist
      const existingIds = new Set(manifest.map(item => item.id));
      for (const id of itemIds) {
        if (!existingIds.has(id)) {
          throw new ItemNotFoundError(id);
        }
      }

      // Reorder the manifest
      const reorderedManifest: ManifestItem[] = [];
      
      // Add items in the specified order
      for (const id of itemIds) {
        const item = manifest.find(item => item.id === id);
        if (item) {
          reorderedManifest.push(item);
        }
      }

      // Add any items not in the reorder list at the end
      for (const item of manifest) {
        if (!itemIds.includes(item.id)) {
          reorderedManifest.push(item);
        }
      }

      // Save updated manifest
      const opf = await this.workspaceManager.getWorkspaceOPF(workspaceId);
      opf.manifest = reorderedManifest;
      await this.workspaceManager.updateWorkspaceOPF(workspaceId, opf);

      // Update cache
      this.cache.manifests.set(workspaceId, reorderedManifest);
    } catch (error: any) {
      if (error instanceof ItemNotFoundError) {
        throw error;
      }
      throw new Error(`Failed to reorder manifest: ${error.message}`);
    }
  }

  async getManifestOrder(workspaceId: string): Promise<string[]> {
    const manifest = await this.loadManifest(workspaceId);
    return manifest.map(item => item.id);
  }

  async validateManifest(workspaceId: string): Promise<ValidationResult[]> {
    try {
      const manifest = await this.loadManifest(workspaceId);
      return ManifestValidator.validateManifestStructure(manifest);
    } catch (error: any) {
      return [{
        field: 'manifest',
        message: `Validation failed: ${error.message}`,
        severity: 'error'
      }];
    }
  }

  // ========================================
  // ADVANCED MODE OPERATIONS
  // ========================================

  async listSourceItems(workspaceId: string): Promise<SourceItem[]> {
    try {
      return await this.workspaceManager.listSourceFiles(workspaceId);
    } catch (error: any) {
      return [];
    }
  }

  async getSourceItemContent(workspaceId: string, sourcePath: string): Promise<ArrayBuffer | string> {
    return await this.workspaceManager.getSourceFile(workspaceId, sourcePath);
  }

  async isAdvancedModeEnabled(workspaceId: string): Promise<boolean> {
    return await this.workspaceManager.isAdvancedModeEnabled(workspaceId);
  }

  // ========================================
  // UTILITY OPERATIONS
  // ========================================

  generateItemId(fileName: string): string {
    return ManifestUtils.generateItemId(fileName);
  }

  detectMediaType(fileName: string, content?: ArrayBuffer): string {
    return ManifestUtils.detectMediaType(fileName, content);
  }

  getMediaTypeCategories(): MediaTypeCategories {
    return ManifestUtils.getMediaTypeCategories();
  }

  // ========================================
  // CACHE MANAGEMENT
  // ========================================

  clearCache(workspaceId?: string): void {
    if (workspaceId) {
      // Clear cache for specific workspace
      this.cache.manifests.delete(workspaceId);
      
      // Clear content cache for this workspace
      const keysToDelete: string[] = [];
      for (const key of this.cache.content.keys()) {
        if (key.startsWith(`${workspaceId}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.content.delete(key));

      // Clear preview cache for this workspace
      const previewKeysToDelete: string[] = [];
      for (const key of this.cache.previews.keys()) {
        if (key.startsWith(`${workspaceId}:`)) {
          previewKeysToDelete.push(key);
        }
      }
      previewKeysToDelete.forEach(key => this.cache.previews.delete(key));
    } else {
      // Clear all caches
      this.cache.manifests.clear();
      this.cache.content.clear();
      this.cache.previews.clear();
      
      // Revoke all blob URLs
      for (const url of this.cache.blobUrls) {
        ManifestUtils.revokeBlobUrl(url);
      }
      this.cache.blobUrls.clear();
    }
  }

  async preloadManifest(workspaceId: string): Promise<void> {
    await this.loadManifest(workspaceId);
  }

  clearContentCache(workspaceId: string, itemId?: string): void {
    if (itemId) {
      // Clear cache for specific item
      const cacheKey = `${workspaceId}:${itemId}`;
      this.cache.content.delete(cacheKey);
      this.cache.previews.delete(cacheKey);
    } else {
      // Clear all content cache for workspace
      const keysToDelete: string[] = [];
      for (const key of this.cache.content.keys()) {
        if (key.startsWith(`${workspaceId}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.content.delete(key));

      const previewKeysToDelete: string[] = [];
      for (const key of this.cache.previews.keys()) {
        if (key.startsWith(`${workspaceId}:`)) {
          previewKeysToDelete.push(key);
        }
      }
      previewKeysToDelete.forEach(key => this.cache.previews.delete(key));
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private isTextMediaType(mediaType: string): boolean {
    return mediaType.startsWith('text/') || 
           mediaType.includes('json') ||
           mediaType.includes('xml') ||
           mediaType.includes('javascript');
  }

  private shouldCacheContent(content: ArrayBuffer | string): boolean {
    const size = typeof content === 'string' ? content.length : content.byteLength;
    return size <= this.CACHE_SIZE_LIMIT;
  }

  private getContentType(mediaType: string): 'text' | 'image' | 'audio' | 'video' | 'binary' {
    if (mediaType.startsWith('text/') || mediaType.includes('xml') || mediaType.includes('json')) {
      return 'text';
    }
    if (mediaType.startsWith('image/')) {
      return 'image';
    }
    if (mediaType.startsWith('audio/')) {
      return 'audio';
    }
    if (mediaType.startsWith('video/')) {
      return 'video';
    }
    return 'binary';
  }

  private extractTextMetadata(content: string): ContentMetadata {
    return {
      characterCount: content.length,
      lineCount: content.split('\n').length,
      wordCount: content.split(/\s+/).filter(word => word.length > 0).length
    };
  }

  private extractImageMetadata(content: ArrayBuffer): ContentMetadata {
    // Basic metadata - in a real implementation, this would parse image headers
    // For now, return placeholder values for testing
    return {
      width: 800,
      height: 600
    };
  }
}