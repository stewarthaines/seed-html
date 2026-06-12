/**
 * SourceManager - Core editor-source archive management class
 *
 * Handles creation, extraction, and validation of the editor-source archive
 * (packaged as SEED.zip; legacy SOURCE.zip still imported) — i.e. the SOURCE/
 * directory tree — for EPUB workspace management. This class works on the
 * SOURCE/ files and a Blob; the archive *filename* is owned by the packager.
 */

import { ZipWriter, Zip } from '../zip';
import type { FileStorageAPI } from '../storage';
import {
  classifySourceFile,
  validateSourcePath,
  isSourceFile,
  validateSettingsJson,
  calculateDirectoryStats,
  sanitizeSourcePath,
} from './source-utils.js';
import type { SourceFileInfo, SourceValidation, SourceStats } from './types.js';
import { DEFAULT_SOURCE_SETTINGS } from './types.js';

export class SourceManager {
  constructor(private fileStorage: FileStorageAPI) {}

  /**
   * Create SOURCE.zip from workspace SOURCE/ directory
   */
  async createSourceZip(workspaceId: string): Promise<Blob | null> {
    try {
      // Check if workspace exists
      const workspaces = await this.fileStorage.listWorkspaces();
      if (!workspaces.includes(workspaceId)) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }

      // Get all files in workspace
      const allFiles = await this.fileStorage.listFiles(workspaceId);
      const sourceFiles = allFiles.filter(path => isSourceFile(path));

      // Return null if no SOURCE/ files
      if (sourceFiles.length === 0) {
        return null;
      }

      // Create ZIP writer
      const zipWriter = new ZipWriter();

      // Add all SOURCE/ files to ZIP
      for (const filePath of sourceFiles) {
        try {
          const content = await this.fileStorage.readFile(workspaceId, filePath);
          await zipWriter.addFile(filePath, content);
        } catch (error) {
          throw new Error(`Failed to read file ${filePath}: ${error}`);
        }
      }

      // Build and return ZIP blob
      try {
        const zipBlob = await zipWriter.buildBlob();
        return zipBlob;
      } catch (error) {
        throw new Error(`ZIP creation failed: ${error}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to create SOURCE.zip: ${error}`);
    }
  }

  /**
   * Extract SOURCE.zip to workspace SOURCE/ directory
   */
  async extractSourceZip(workspaceId: string, sourceZipBlob: Blob): Promise<void> {
    try {
      // Convert blob to ArrayBuffer for ZIP reader
      const zipBuffer = await sourceZipBlob.arrayBuffer();
      const zip = new Zip(zipBuffer);

      // Extract all entries
      for (const entry of zip.entries) {
        const filePath = sanitizeSourcePath(entry.fileName);

        // Validate file path for security
        if (!validateSourcePath(filePath)) {
          throw new Error(`Invalid file path: ${entry.fileName}`);
        }

        try {
          // Extract file content
          const fileBlob = await entry.extract();
          const content = await fileBlob.arrayBuffer();

          // Write to workspace
          await this.fileStorage.writeFile(workspaceId, filePath, content);
        } catch (error) {
          throw new Error(`Failed to write file ${filePath}: ${error}`);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to extract SOURCE.zip: ${error}`);
    }
  }

  /**
   * Check if workspace has SOURCE/ files
   */
  async hasSourceFiles(workspaceId: string): Promise<boolean> {
    try {
      const allFiles = await this.fileStorage.listFiles(workspaceId);
      const sourceFiles = allFiles.filter(path => isSourceFile(path));

      // Check for SOURCE files
      return sourceFiles.length > 0;
    } catch (error) {
      throw new Error(`Failed to check SOURCE/ files: ${error}`);
    }
  }

  /**
   * List all SOURCE/ files with metadata
   */
  async listSourceFiles(workspaceId: string): Promise<SourceFileInfo[]> {
    try {
      const allFiles = await this.fileStorage.listFiles(workspaceId);
      const sourceFiles = allFiles
        .filter(path => isSourceFile(path))
        .filter(path => !path.endsWith('.gitkeep')); // Filter out .gitkeep files

      const fileInfos: SourceFileInfo[] = [];

      for (const filePath of sourceFiles) {
        try {
          const content = await this.fileStorage.readFile(workspaceId, filePath);
          const fileInfo: SourceFileInfo = {
            path: filePath,
            size: content.byteLength,
            type: classifySourceFile(filePath),
          };

          fileInfos.push(fileInfo);
        } catch {
          // Skip files that can't be read
          continue;
        }
      }

      return fileInfos;
    } catch (error) {
      throw new Error(`Failed to list SOURCE/ files: ${error}`);
    }
  }

  /**
   * Initialize SOURCE/ directory structure in workspace
   */
  async initializeSourceStructure(workspaceId: string): Promise<void> {
    try {
      // Create default settings.json if it doesn't exist
      const settingsPath = 'SOURCE/settings.json';
      if (!(await this.fileStorage.fileExists(workspaceId, settingsPath))) {
        const defaultSettings = JSON.stringify(DEFAULT_SOURCE_SETTINGS, null, 2);
        await this.fileStorage.writeTextFile(workspaceId, settingsPath, defaultSettings);
      }

      // Directory structure will be created implicitly when files are written to these paths
    } catch (error) {
      throw new Error(`Failed to initialize SOURCE/ structure: ${error}`);
    }
  }

  /**
   * Validate SOURCE/ directory structure
   */
  async validateSourceStructure(workspaceId: string): Promise<SourceValidation> {
    const validation: SourceValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      fileCount: 0,
      totalSize: 0,
      hasSettings: false,
    };

    try {
      const allFiles = await this.fileStorage.listFiles(workspaceId);
      const sourceFiles = allFiles.filter(path => isSourceFile(path));

      validation.fileCount = sourceFiles.length;

      // Calculate total size and check for settings.json
      for (const filePath of sourceFiles) {
        try {
          const content = await this.fileStorage.readFile(workspaceId, filePath);
          validation.totalSize += content.byteLength;

          // Check settings.json
          if (filePath === 'SOURCE/settings.json') {
            validation.hasSettings = true;
            const settingsContent = new TextDecoder().decode(content);
            const settingsValidation = validateSettingsJson(settingsContent);

            if (!settingsValidation.isValid) {
              validation.isValid = false;
              validation.errors.push(
                ...settingsValidation.errors.map(e => `Invalid settings.json format: ${e}`)
              );
            }
            validation.warnings.push(...settingsValidation.warnings);
          }

          // Check for unexpected files in root SOURCE/ directory
          const relativePath = filePath.substring(7); // Remove 'SOURCE/'
          if (!relativePath.includes('/') && filePath !== 'SOURCE/settings.json') {
            validation.warnings.push(`Unexpected file in SOURCE/ root: ${relativePath}`);
          }
        } catch {
          // Skip files that can't be read
          continue;
        }
      }

      // Warn about missing settings.json
      if (!validation.hasSettings) {
        validation.warnings.push('Missing settings.json file');
      }
    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`Failed to validate SOURCE/ structure: ${error}`);
    }

    return validation;
  }

  /**
   * Get detailed statistics about SOURCE/ directory
   */
  async getSourceDirectoryStats(workspaceId: string): Promise<SourceStats> {
    try {
      return await calculateDirectoryStats(this.fileStorage, workspaceId);
    } catch (error) {
      throw new Error(`Failed to get SOURCE/ directory statistics: ${error}`);
    }
  }
}
