/**
 * ExtensionManager - Main API for extension management
 *
 * Provides unified JavaScript extension management for workspaces including
 * importing new extensions, managing existing ones, and utilizing a global cache.
 */

import type { FileStorageAPI } from '../storage/index.js';
import type {
  ExtensionInfo,
  ExtensionFile,
  ExtensionSignature,
  CachingSummary,
  ValidationResult,
} from './types.js';
import type { TransformOption } from '../services/settings/settings.service.js';
import { resolveExtensionFileUrl, type ExtensionCatalogEntry } from './extension-catalog.js';
import { writeGenerator } from '../generators/generator-store.js';
import { ExtensionCache } from './extension-cache.js';
import {
  detectExtensionName,
  normalizeExtensionName,
  validateExtensionFile,
  isValidExtensionName,
  createExtensionSignature,
  compareExtensionSignatures,
} from './utils.js';

/**
 * ExtensionManager provides the main API for extension operations
 */
export class ExtensionManager {
  private cache: ExtensionCache;

  constructor(private fileStorage: FileStorageAPI) {
    if (!fileStorage) {
      throw new Error('FileStorageAPI is required');
    }
    this.cache = new ExtensionCache(fileStorage);
  }

  /**
   * Gets the internal cache instance (for test access)
   */
  get extensionCache(): ExtensionCache {
    return this.cache;
  }

  // Extension Import Methods

  /**
   * Imports a new extension from uploaded file
   *
   * @param workspaceId - Target workspace identifier
   * @param file - JavaScript file to import
   * @param extensionName - User-confirmed extension name (normalized)
   * @returns Promise resolving to information about the created extension
   */
  async importExtension(
    workspaceId: string,
    file: File,
    extensionName: string
  ): Promise<ExtensionInfo> {
    // Normalize extension name
    const normalizedName = normalizeExtensionName(extensionName);

    // Validate inputs
    if (!isValidExtensionName(normalizedName)) {
      throw new Error(`Invalid extension name: '${extensionName}' contains illegal characters`);
    }

    const validation = this.validateExtensionFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error!);
    }

    // Check for workspace conflicts
    const existingExtensions = await this.listWorkspaceExtensions(workspaceId);
    if (existingExtensions.some(ext => ext.name === normalizedName)) {
      throw new Error(`Extension '${normalizedName}' already exists in workspace`);
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();

    // Save to workspace
    const filePath = `SOURCE/extensions/${normalizedName}/${file.name}`;
    await this.fileStorage.writeFile(workspaceId, filePath, arrayBuffer);

    // Auto-cache the extension
    const files = new Map([[file.name, arrayBuffer]]);
    try {
      await this.cache.cacheExtension(normalizedName, files);
    } catch {
      // Cache conflicts are non-fatal for import
    }

    // Return extension info
    return {
      name: normalizedName,
      files: [
        {
          filename: file.name,
          size: file.size,
          type: validation.fileType as 'javascript' | 'license',
        },
      ],
      totalSize: file.size,
      location: 'workspace',
    };
  }

  /**
   * Import a catalog extension into a project: fetch each of its files (libs,
   * transforms, license, and its extension.json) and write them under
   * SOURCE/extensions/<id>/. The copied extension.json lets the project classify
   * libs vs transforms reliably (see getAvailableTransforms / the iframe loader).
   *
   * Assets (e.g. a CSS theme) are different: they belong in the EPUB output, so
   * they are written under OEBPS/<target> and returned so the caller can register
   * them in the OPF manifest.
   *
   * @param workspaceId - Target workspace identifier
   * @param entry - Catalog entry (from loadExtensionCatalog)
   * @param options.fetch - Fetch implementation (injectable for tests)
   * @param options.baseUrl - Base URL the extensions/ folder resolves against
   * @returns The written EPUB assets (manifest target + media), for manifest registration
   */
  async importCatalogExtension(
    workspaceId: string,
    entry: ExtensionCatalogEntry,
    options: { fetch?: typeof fetch; baseUrl?: string } = {}
  ): Promise<Array<{ target: string; media?: string }>> {
    const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    // Dedupe: a license file may be referenced by several scripts/assets, or equal
    // the extension-wide license. entry.licenses already aggregates them all.
    const files = [
      ...new Set([
        ...entry.scripts,
        ...entry.domTransforms,
        ...entry.textTransforms,
        ...entry.licenses,
        'extension.json',
      ]),
    ];

    for (const file of files) {
      const url = resolveExtensionFileUrl(entry.id, file, { baseUrl: options.baseUrl });
      const response = await fetchImpl(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${file} for extension '${entry.id}': ${response.status}`);
      }
      const content = await response.arrayBuffer();
      await this.fileStorage.writeFile(
        workspaceId,
        `SOURCE/extensions/${entry.id}/${file}`,
        content
      );
    }

    // Generators → SOURCE/generators/<gen.id>/ (generator.json + script + license),
    // so extension-made and hand-made generators share one on-disk shape and discovery
    // only scans SOURCE/generators/. The scripts were copied flat into the served
    // extension dir by the manifest build, so they fetch by basename like the rest.
    for (const gen of entry.generators ?? []) {
      const scriptUrl = resolveExtensionFileUrl(entry.id, gen.script, { baseUrl: options.baseUrl });
      const scriptRes = await fetchImpl(scriptUrl);
      if (!scriptRes.ok) {
        throw new Error(
          `Failed to fetch generator ${gen.script} for extension '${entry.id}': ${scriptRes.status}`
        );
      }
      const scriptContent = await scriptRes.arrayBuffer();
      let licenseContent: ArrayBuffer | undefined;
      if (gen.license) {
        const licUrl = resolveExtensionFileUrl(entry.id, gen.license, { baseUrl: options.baseUrl });
        const licRes = await fetchImpl(licUrl);
        if (licRes.ok) licenseContent = await licRes.arrayBuffer();
      }
      await writeGenerator(this.fileStorage, workspaceId, gen, scriptContent, licenseContent);
    }

    // EPUB assets → OEBPS/<target> (book output), reported back for manifest registration.
    const writtenAssets: Array<{ target: string; media?: string }> = [];
    for (const asset of entry.assets ?? []) {
      if (!this.isSafeAssetTarget(asset.target)) {
        throw new Error(`Unsafe asset target '${asset.target}' for extension '${entry.id}'`);
      }
      const url = resolveExtensionFileUrl(entry.id, asset.file, { baseUrl: options.baseUrl });
      const response = await fetchImpl(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch asset ${asset.file} for extension '${entry.id}': ${response.status}`
        );
      }
      const content = await response.arrayBuffer();
      await this.fileStorage.writeFile(workspaceId, `OEBPS/${asset.target}`, content);
      writtenAssets.push({ target: asset.target, media: asset.media });
    }

    return writtenAssets;
  }

  /** Reject absolute paths and any '..' segment so an asset can't escape OEBPS/. */
  private isSafeAssetTarget(target: string): boolean {
    if (!target || target.startsWith('/')) return false;
    return !target.split('/').includes('..');
  }

  /**
   * Fetch a catalog extension's sample chapter (plain-text source), used to seed a
   * new project's first chapter when that extension is chosen. Returns null when the
   * entry declares no chapter or the fetch fails — the caller falls back to the
   * generic sample. Not written into the project; it's a create-time template.
   *
   * @param entry - Catalog entry (from loadExtensionCatalog)
   * @param options.fetch - Fetch implementation (injectable for tests)
   * @param options.baseUrl - Base URL the extensions/ folder resolves against
   */
  async getExtensionChapterText(
    entry: ExtensionCatalogEntry,
    options: { fetch?: typeof fetch; baseUrl?: string } = {}
  ): Promise<string | null> {
    if (!entry.chapter) return null;
    const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    try {
      const url = resolveExtensionFileUrl(entry.id, entry.chapter, { baseUrl: options.baseUrl });
      const response = await fetchImpl(url);
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  }

  /**
   * Adds a file to an existing extension
   *
   * @param workspaceId - Target workspace identifier
   * @param extensionName - Existing extension name
   * @param file - Additional JavaScript or LICENSE file
   * @returns Promise that resolves when file is added
   */
  async addFileToExtension(workspaceId: string, extensionName: string, file: File): Promise<void> {
    const validation = this.validateExtensionFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error!);
    }

    // Check that extension exists
    const existingExtensions = await this.listWorkspaceExtensions(workspaceId);
    if (!existingExtensions.some(ext => ext.name === extensionName)) {
      throw new Error(`Extension '${extensionName}' does not exist in workspace`);
    }

    // Check for duplicate filenames
    const filePath = `SOURCE/extensions/${extensionName}/${file.name}`;
    const exists = await this.fileStorage.fileExists(workspaceId, filePath);
    if (exists) {
      throw new Error(`File '${file.name}' already exists in extension '${extensionName}'`);
    }

    // Read file content and save
    const arrayBuffer = await file.arrayBuffer();
    await this.fileStorage.writeFile(workspaceId, filePath, arrayBuffer);

    // Update cache if extension is cached and content matches
    try {
      const allFiles = await this.getWorkspaceExtensionFiles(workspaceId, extensionName);
      await this.cache.cacheExtension(extensionName, allFiles);
    } catch {
      // Cache update failures are non-fatal
    }
  }

  // Workspace Extension Management

  /**
   * Lists all extensions in a workspace
   *
   * @param workspaceId - Target workspace identifier
   * @returns Promise resolving to array of extensions in workspace
   */
  async listWorkspaceExtensions(workspaceId: string): Promise<ExtensionInfo[]> {
    try {
      const files = await this.fileStorage.listFiles(workspaceId);
      const extensionFiles = files.filter(f => f.startsWith('SOURCE/extensions/'));

      const extensionDirs = new Set<string>();
      for (const file of extensionFiles) {
        const pathParts = file.split('/');
        if (pathParts.length >= 3) {
          extensionDirs.add(pathParts[2]); // SOURCE/extensions/{name}/file
        }
      }

      const extensions: ExtensionInfo[] = [];
      for (const extensionName of extensionDirs) {
        try {
          const info = await this.getWorkspaceExtensionInfo(workspaceId, extensionName);
          extensions.push(info);
        } catch {
          // Skip corrupted extensions silently
        }
      }

      return extensions.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      // If workspace doesn't exist, return empty array
      // But re-throw other storage errors
      if (error instanceof Error && error.message.includes('not found')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Deletes an extension from a workspace
   *
   * @param workspaceId - Target workspace identifier
   * @param extensionName - Extension to delete
   * @returns Promise that resolves when deletion is complete
   */
  async deleteWorkspaceExtension(workspaceId: string, extensionName: string): Promise<void> {
    const files = await this.fileStorage.listFiles(workspaceId);
    const extensionFiles = files.filter(f => f.startsWith(`SOURCE/extensions/${extensionName}/`));

    if (extensionFiles.length === 0) {
      throw new Error(`Extension '${extensionName}' does not exist in workspace`);
    }

    // Delete all extension files
    for (const filePath of extensionFiles) {
      await this.fileStorage.deleteFile(workspaceId, filePath);
    }
  }

  /**
   * Gets the license text for an extension
   *
   * @param workspaceId - Target workspace identifier
   * @param extensionName - Extension name
   * @returns Promise resolving to license text, or empty string if no license exists
   */
  async getExtensionLicense(workspaceId: string, extensionName: string): Promise<string> {
    try {
      const licensePath = `SOURCE/extensions/${extensionName}/LICENSE.txt`;
      const content = await this.fileStorage.readFile(workspaceId, licensePath);

      // Convert ArrayBuffer to text
      const decoder = new TextDecoder();
      return decoder.decode(content);
    } catch {
      // File doesn't exist, return empty string
      return '';
    }
  }

  /**
   * Saves license text for an extension
   *
   * @param workspaceId - Target workspace identifier
   * @param extensionName - Extension name
   * @param licenseText - License text to save
   * @returns Promise that resolves when license is saved
   */
  async saveExtensionLicense(
    workspaceId: string,
    extensionName: string,
    licenseText: string
  ): Promise<void> {
    // Check that extension exists
    const existingExtensions = await this.listWorkspaceExtensions(workspaceId);
    if (!existingExtensions.some(ext => ext.name === extensionName)) {
      throw new Error(`Extension '${extensionName}' does not exist in workspace`);
    }

    const licensePath = `SOURCE/extensions/${extensionName}/LICENSE.txt`;
    const encoder = new TextEncoder();
    const content = encoder.encode(licenseText);

    await this.fileStorage.writeFile(workspaceId, licensePath, content.buffer as ArrayBuffer);
  }

  // Cache Management Methods

  /**
   * Lists all cached extensions
   *
   * @returns Promise resolving to array of globally cached extensions
   */
  async listCachedExtensions(): Promise<ExtensionInfo[]> {
    return this.cache.listCachedExtensions();
  }

  /**
   * Imports an extension from the global cache to a workspace
   *
   * @param workspaceId - Target workspace identifier
   * @param extensionName - Name of cached extension to import
   * @returns Promise that resolves when import is complete
   */
  async importFromCache(workspaceId: string, extensionName: string): Promise<void> {
    // Check that extension exists in cache
    const cachedExtensions = await this.cache.listCachedExtensions();
    if (!cachedExtensions.some(ext => ext.name === extensionName)) {
      throw new Error(`Extension '${extensionName}' not found in cache`);
    }

    // Check for workspace conflicts
    const workspaceExtensions = await this.listWorkspaceExtensions(workspaceId);
    if (workspaceExtensions.some(ext => ext.name === extensionName)) {
      throw new Error(`Extension '${extensionName}' already exists in workspace`);
    }

    // Copy from cache to workspace
    await this.cache.copyToWorkspace(extensionName, workspaceId);
  }

  /**
   * Deletes an extension from the global cache
   *
   * @param extensionName - Cached extension to delete
   * @returns Promise that resolves when deletion is complete
   */
  async deleteCachedExtension(extensionName: string): Promise<void> {
    await this.cache.deleteExtension(extensionName);
  }

  /**
   * Caches an extension from a workspace to the global cache
   *
   * @param workspaceId - Source workspace identifier
   * @param extensionName - Extension to cache
   * @returns Promise that resolves when caching is complete
   */
  async cacheExtension(workspaceId: string, extensionName: string): Promise<void> {
    // Quick check if extension exists in workspace (avoid full listing)
    const allFiles = await this.fileStorage.listFiles(workspaceId);
    const hasExtension = allFiles.some(f => f.startsWith(`SOURCE/extensions/${extensionName}/`));
    if (!hasExtension) {
      throw new Error(`Extension '${extensionName}' does not exist in workspace`);
    }

    // Check if already cached (optimization - check before reading files)
    const existingSignature = await this.cache.getExtensionSignature(extensionName);
    if (existingSignature) {
      // Get workspace file signatures without reading content for comparison
      const workspaceSignature = await this.getWorkspaceExtensionSignature(
        workspaceId,
        extensionName
      );

      if (compareExtensionSignatures(existingSignature, workspaceSignature)) {
        // Already cached with same content, skip
        return;
      } else {
        // Different content - conflict
        throw new Error(`Extension '${extensionName}' already cached with different content`);
      }
    }

    // Not cached yet, read files and cache
    const extensionFiles = await this.getWorkspaceExtensionFiles(workspaceId, extensionName);
    await this.cache.cacheExtension(extensionName, extensionFiles);
  }

  // Batch Operations

  /**
   * Scans workspace for extensions and caches them automatically
   *
   * @param workspaceId - Workspace to scan for extensions
   * @returns Promise resolving to summary of caching results
   */
  async scanAndCacheExtensions(workspaceId: string): Promise<CachingSummary> {
    const workspaceExtensions = await this.listWorkspaceExtensions(workspaceId);

    const summary: CachingSummary = {
      successCount: 0,
      totalScanned: workspaceExtensions.length,
      conflicts: [],
      errors: [],
    };

    for (const extension of workspaceExtensions) {
      try {
        const files = await this.getWorkspaceExtensionFiles(workspaceId, extension.name);

        // Check for conflicts first
        const hasConflict = await this.cache.hasConflict(extension.name, files);
        if (hasConflict) {
          summary.conflicts.push(extension.name);
          continue;
        }

        // Cache the extension
        await this.cache.cacheExtension(extension.name, files);
        summary.successCount++;
      } catch (error) {
        summary.errors.push({
          extensionName: extension.name,
          reason: 'storage',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return summary;
  }

  // Utility Methods

  /**
   * Detects extension name from JavaScript filename
   *
   * @param filename - JavaScript filename
   * @returns Normalized extension name
   */
  detectExtensionName(filename: string): string {
    return detectExtensionName(filename);
  }

  /**
   * Validates uploaded file for extension import
   *
   * @param file - File to validate
   * @returns Validation result with file type and any errors
   */
  validateExtensionFile(file: File): ValidationResult {
    return validateExtensionFile(file);
  }

  /**
   * Normalizes extension name for safe directory usage
   *
   * @param name - Raw extension name
   * @returns Normalized name
   */
  normalizeExtensionName(name: string): string {
    return normalizeExtensionName(name);
  }

  /**
   * Compares two extensions for equality
   *
   * @param ext1 - First extension
   * @param ext2 - Second extension
   * @returns True if extensions are equivalent
   */
  compareExtensions(ext1: any, ext2: any): boolean {
    // Handle both ExtensionInfo objects and signature-like objects from tests
    const name1 = ext1.name || 'unknown';
    const name2 = ext2.name || 'unknown';

    if (name1 !== name2) return false;
    if (ext1.totalSize !== ext2.totalSize) return false;
    if (ext1.files.length !== ext2.files.length) return false;

    // Handle both filename/name formats
    const files1 = ext1.files
      .slice()
      .sort((a: any, b: any) => (a.filename || a.name).localeCompare(b.filename || b.name));
    const files2 = ext2.files
      .slice()
      .sort((a: any, b: any) => (a.filename || a.name).localeCompare(b.filename || b.name));

    return files1.every((file: any, index: number) => {
      const otherFile = files2[index];
      const name1 = file.filename || file.name;
      const name2 = otherFile.filename || otherFile.name;

      return name1 === name2 && file.size === otherFile.size;
    });
  }

  /**
   * Sanitizes filename for safe file system usage
   *
   * @param filename - Original filename
   * @returns Sanitized filename
   */
  sanitizeFilename(filename: string): string {
    return (
      filename
        .replace(/\.\.\//g, '') // Remove ../ traversal
        .replace(/\.\.\\/g, '') // Remove ..\ traversal
        // oxlint-disable-next-line no-control-regex
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-') // eslint-disable-line no-control-regex -- strip control chars from filenames
        .replace(/^\.+/, '') // Remove leading dots
        .replace(/\.+$/, '') // Remove trailing dots
        .replace(/-+/g, '-') // Collapse multiple hyphens
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
        .substring(0, 255)
    ); // Limit length
  }

  // Private Helper Methods

  /**
   * Gets extension signature from workspace without reading file contents (optimized)
   */
  private async getWorkspaceExtensionSignature(
    workspaceId: string,
    extensionName: string
  ): Promise<ExtensionSignature> {
    const files = await this.fileStorage.listFiles(workspaceId);
    const extensionFiles = files.filter(f => f.startsWith(`SOURCE/extensions/${extensionName}/`));

    if (extensionFiles.length === 0) {
      throw new Error(`Extension '${extensionName}' does not exist in workspace`);
    }

    const fileInfos = [];
    for (const filePath of extensionFiles) {
      const filename = filePath.split('/').pop()!;

      // Only process valid extension files
      if (filename.endsWith('.js') || filename.toLowerCase().includes('license')) {
        // Use fileInfo method if available, otherwise read file to get size
        try {
          const fileInfo = await this.fileStorage.getFileInfo(workspaceId, filePath);
          fileInfos.push({ name: filename, size: fileInfo.size });
        } catch {
          // Fallback to reading file content
          const content = await this.fileStorage.readFile(workspaceId, filePath);
          fileInfos.push({ name: filename, size: content.byteLength });
        }
      }
    }

    return createExtensionSignature(fileInfos);
  }

  /**
   * Gets detailed information about a workspace extension
   */
  private async getWorkspaceExtensionInfo(
    workspaceId: string,
    extensionName: string
  ): Promise<ExtensionInfo> {
    const files = await this.fileStorage.listFiles(workspaceId);
    const extensionFiles = files.filter(f => f.startsWith(`SOURCE/extensions/${extensionName}/`));

    if (extensionFiles.length === 0) {
      throw new Error(`Extension '${extensionName}' does not exist in workspace`);
    }

    const extensionFileInfos: ExtensionFile[] = [];
    let totalSize = 0;

    for (const filePath of extensionFiles) {
      const filename = filePath.split('/').pop()!;
      const content = await this.fileStorage.readFile(workspaceId, filePath);
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
        filename,
        size: fileInfo.size,
        type: fileType,
      });

      totalSize += fileInfo.size;
    }

    return {
      name: extensionName,
      files: extensionFileInfos,
      totalSize,
      location: 'workspace',
    };
  }

  /**
   * Gets all files for a workspace extension as Map
   */
  private async getWorkspaceExtensionFiles(
    workspaceId: string,
    extensionName: string
  ): Promise<Map<string, ArrayBuffer>> {
    const files = await this.fileStorage.listFiles(workspaceId);
    const extensionFiles = files.filter(f => f.startsWith(`SOURCE/extensions/${extensionName}/`));

    const fileMap = new Map<string, ArrayBuffer>();

    for (const filePath of extensionFiles) {
      const filename = filePath.split('/').pop()!;
      const content = await this.fileStorage.readFile(workspaceId, filePath);
      fileMap.set(filename, content);
    }

    return fileMap;
  }

  /**
   * Get available transform scripts for a workspace
   *
   * @param workspaceId - Target workspace identifier
   * @returns Promise resolving to array of available transform options
   */
  async getAvailableTransforms(workspaceId: string): Promise<TransformOption[]> {
    const transforms: TransformOption[] = [];
    const seen = new Set<string>(); // dedupe by path

    const add = (path: string, extensionName: string) => {
      if (seen.has(path)) return;
      seen.add(path);
      transforms.push({ path, extensionName, fileName: path.split('/').pop() || path });
    };
    const isTransformName = (name: string) => /transform/i.test(name);

    try {
      const files = await this.fileStorage.listFiles(workspaceId);

      // Extension dirs: prefer extension.json `domTransforms[]` for precise,
      // naming-independent classification; fall back to the transform-name
      // heuristic for manually-uploaded extensions without a manifest.
      for (const ext of this.extensionDirsOf(files)) {
        const prefix = `SOURCE/extensions/${ext}/`;
        const declared = await this.declaredTransforms(workspaceId, files, ext, 'domTransforms');
        if (declared) {
          for (const t of declared) add(`${prefix}${t}`, ext);
        } else {
          for (const file of files) {
            if (
              file.startsWith(prefix) &&
              file.endsWith('.js') &&
              isTransformName(file.split('/').pop() || '')
            ) {
              add(file, ext);
            }
          }
        }
      }

      // Loose project scripts (under SOURCE/ but not extensions/): transform-named .js.
      for (const file of files) {
        if (!file.startsWith('SOURCE/') || file.startsWith('SOURCE/extensions/')) continue;
        if (!file.endsWith('.js')) continue;
        const fileName = file.split('/').pop() || '';
        if (isTransformName(fileName)) add(file, `Transform: ${fileName}`);
      }
    } catch (error) {
      // If we can't list files, return empty array rather than throwing
      console.warn('Failed to get available transforms:', error);
    }

    return transforms;
  }

  /**
   * Get available TEXT-transform scripts: the default text transform plus each
   * installed extension's declared `textTransforms`. Single-slot (text_transform)
   * is chosen from these in Settings.
   */
  async getAvailableTextTransforms(workspaceId: string): Promise<TransformOption[]> {
    const options: TransformOption[] = [];
    const seen = new Set<string>();
    const add = (path: string, extensionName: string) => {
      if (seen.has(path)) return;
      seen.add(path);
      options.push({ path, extensionName, fileName: path.split('/').pop() || path });
    };

    try {
      const files = await this.fileStorage.listFiles(workspaceId);

      // The conventional default text transform, when present.
      if (files.includes('SOURCE/scripts/transformText.js')) {
        add('SOURCE/scripts/transformText.js', 'Project scripts');
      }

      // Extension-declared text transforms (naming-independent, via extension.json).
      for (const ext of this.extensionDirsOf(files)) {
        const declared = await this.declaredTransforms(workspaceId, files, ext, 'textTransforms');
        for (const t of declared ?? []) add(`SOURCE/extensions/${ext}/${t}`, ext);
      }
    } catch {
      // Discovery failed (e.g. workspace gone) — return whatever we have.
    }

    return options;
  }

  /** Distinct extension directory names present in the workspace file list. */
  private extensionDirsOf(files: string[]): Set<string> {
    const dirs = new Set<string>();
    for (const file of files) {
      if (!file.startsWith('SOURCE/extensions/')) continue;
      const parts = file.split('/');
      if (parts.length >= 3) dirs.add(parts[2]);
    }
    return dirs;
  }

  /**
   * The scripts an extension declares in `extension.json[field]`, or null when the
   * extension has no (readable) manifest — so callers can fall back to a heuristic.
   */
  private async declaredTransforms(
    workspaceId: string,
    files: string[],
    ext: string,
    field: 'domTransforms' | 'textTransforms'
  ): Promise<string[] | null> {
    const manifestPath = `SOURCE/extensions/${ext}/extension.json`;
    if (!files.includes(manifestPath)) return null;
    try {
      const meta = JSON.parse(await this.fileStorage.readTextFile(workspaceId, manifestPath));
      return Array.isArray(meta?.[field])
        ? meta[field].filter((t: unknown): t is string => typeof t === 'string')
        : [];
    } catch {
      return null; // malformed manifest → heuristic fallback
    }
  }
}
