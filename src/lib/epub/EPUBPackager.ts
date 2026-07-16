/**
 * EPUB Packaging - Feature 03
 *
 * Creates valid EPUB ZIP files from workspace content using the custom ZIP library
 * with EPUB-compliant structure and download functionality.
 */

import { ZipWriter, downloadBlob } from '../zip/index.js';
import { FileStorageAPI } from '../storage/index.js';
import {
  OPFUtils,
  creatorName,
  DEFAULT_FILENAME_TEMPLATE,
  type EPUBMetadata,
} from './opf-utils.js';
import { getMimeType } from '../utils/mime-types.js';
import { SourceManager, SOURCE_ARCHIVE_NAME } from '../source/index.js';
import { SEED_HTML_NAME, localizedSeedHtml } from './seed-html.js';
import { PUBLISH_WORKSPACE_ID } from '../workspace/types.js';

export { type EPUBMetadata } from './opf-utils.js';

export interface WorkspaceFile {
  path: string;
  content: ArrayBuffer;
  size: number;
  mimeType?: string;
}

export interface CompressionSettings {
  method: 0x00 | 0x08; // Store or Deflate
  reason: string;
}

export interface PackageProgress {
  phase: 'reading' | 'compressing' | 'writing' | 'complete';
  currentFile?: string;
  processedFiles: number;
  totalFiles: number;
  currentBytes: number;
  totalBytes: number;
}

export interface PackageOptions {
  compressionLevel?: 'fast' | 'balanced' | 'maximum';
  includeSeedFiles?: boolean;
  /** Embed the editor build (SEED.html) at the EPUB root as a non-manifest payload. */
  includeSeedHtml?: boolean;
  /** Bundle the SOURCE/ tree as the editor-source archive (SEED.zip). Default true;
   * set false for a plain, non-self-editing "destination" EPUB. */
  includeSource?: boolean;
  /** Persist the packaged blob to the shared publish output dir (for the Publish
   * view). Default true; set false for a throwaway direct-download export. */
  persistToPublish?: boolean;
  validateStructure?: boolean;
  progressCallback?: (progress: PackageProgress) => void;
}

export interface PackageResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  error?: string;
  totalSize?: number;
  compressedSize?: number;
  fileCount?: number;
  processingTime?: number;
}

export class EPUBPackager {
  private fileStorage: FileStorageAPI;
  private sourceManager: SourceManager;

  constructor() {
    this.fileStorage = FileStorageAPI.getInstance();
    this.sourceManager = new SourceManager(this.fileStorage);
  }

  async packageEPUB(workspaceId: string, options: PackageOptions = {}): Promise<PackageResult> {
    const startTime = Date.now();

    try {
      // Storage should already be initialized via singleton pattern

      // 1. Read all workspace files using File Storage API
      const files = await this.readWorkspaceFiles(workspaceId, options);

      if (files.length === 0) {
        return { success: false, error: 'Workspace is empty' };
      }

      // 2. Extract metadata from content.opf
      const metadata = await this.extractMetadata(files);

      // 3. Create ZIP writer with EPUB-compliant structure
      const zipWriter = new ZipWriter();

      const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
      let currentBytes = 0;

      // 4. Add files with optimized compression
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compression = this.optimizeCompression(file.path, file.content);

        await zipWriter.addFile(file.path, file.content, {
          compressionMethod: compression.method,
          lastModified: new Date(),
        });

        currentBytes += file.size;

        options.progressCallback?.({
          phase: 'compressing',
          currentFile: file.path,
          processedFiles: i + 1,
          totalFiles: files.length,
          currentBytes,
          totalBytes,
        });
      }

      // 5. Build final ZIP blob
      options.progressCallback?.({
        phase: 'writing',
        processedFiles: files.length,
        totalFiles: files.length,
        currentBytes: totalBytes,
        totalBytes,
      });

      const blob = await zipWriter.buildBlob();
      const template = await this.readFilenameTemplate(workspaceId);
      const filename = this.generateFilename(metadata, template);

      // Persist the packaged epub to the shared publish output directory so the
      // Publish view (and the publish plugin) can list and act on it. Skipped for a
      // throwaway direct-download export (persistToPublish: false).
      if (options.persistToPublish !== false) {
        await this.fileStorage.writeFile(PUBLISH_WORKSPACE_ID, filename, await blob.arrayBuffer());
      }

      options.progressCallback?.({
        phase: 'complete',
        processedFiles: files.length,
        totalFiles: files.length,
        currentBytes: totalBytes,
        totalBytes,
      });

      return {
        success: true,
        blob,
        filename,
        totalSize: totalBytes,
        compressedSize: blob.size,
        fileCount: files.length,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      };
    }
  }

  async readWorkspaceFiles(
    workspaceId: string,
    options: PackageOptions = {}
  ): Promise<WorkspaceFile[]> {
    const allFilePaths = await this.fileStorage.listFiles(workspaceId);

    // Separate SOURCE/ files from EPUB files. The editor build (SEED.html) lives
    // at the workspace root but is a non-manifest payload added conditionally
    // below (mirroring SEED.zip), so it's excluded from the generic sweep.
    const sourceFiles = allFilePaths.filter(f => f.startsWith('SOURCE/'));
    const epubFiles = allFilePaths.filter(f => !f.startsWith('SOURCE/') && f !== SEED_HTML_NAME);

    const files: WorkspaceFile[] = [];

    // Process EPUB files normally
    for (const path of epubFiles) {
      try {
        const content = await this.fileStorage.readFile(workspaceId, path);
        files.push({
          path,
          content,
          size: content.byteLength,
          mimeType: getMimeType(path),
        });
      } catch (error) {
        // Skip files that can't be read but don't fail the entire operation

        console.warn(`Failed to read file ${path}:`, error);
      }
    }

    // Bundle the SOURCE/ files into the editor-source archive (SEED.zip) if any
    // exist. The archive holds the SOURCE/ tree; only its filename is SEED.zip.
    // Skipped for a plain "without SEED" export (includeSource: false).
    if (options.includeSource !== false && sourceFiles.length > 0) {
      try {
        const sourceZip = await this.sourceManager.createSourceZip(workspaceId);
        if (sourceZip) {
          const sourceZipBuffer = await sourceZip.arrayBuffer();
          files.push({
            path: SOURCE_ARCHIVE_NAME,
            content: sourceZipBuffer,
            size: sourceZipBuffer.byteLength,
            mimeType: 'application/zip',
          });
        }
      } catch (error) {
        console.warn(`Failed to create ${SOURCE_ARCHIVE_NAME}:`, error);
      }
    }

    // Embed the editor build (SEED.html) at the EPUB root when enabled and present,
    // making the EPUB self-editing. Not added to the OPF manifest — a data payload
    // alongside SEED.zip.
    if (options.includeSeedHtml) {
      try {
        if (await this.fileStorage.fileExists(workspaceId, SEED_HTML_NAME)) {
          // Localize the embedded editor: splice the user's cached locale catalogs
          // into the build's i18n anchor, so the EPUB's SEED.html speaks their
          // language on file://. The stored bytes stay pristine — injection is
          // per-package, so later locale changes are honored on re-export.
          const seedHtml = await localizedSeedHtml(
            await this.fileStorage.readFile(workspaceId, SEED_HTML_NAME),
            this.fileStorage
          );

          files.push({
            path: SEED_HTML_NAME,
            content: seedHtml,
            size: seedHtml.byteLength,
            mimeType: 'text/html',
          });
        }
      } catch (error) {
        console.warn(`Failed to embed ${SEED_HTML_NAME}:`, error);
      }
    }

    return files;
  }

  private async extractMetadata(files: WorkspaceFile[]): Promise<EPUBMetadata> {
    // 1. Find and read container.xml to get the rootfile path
    const containerFile = files.find(f => f.path === 'META-INF/container.xml');
    if (!containerFile) {
      throw new Error('Missing META-INF/container.xml file - invalid EPUB structure');
    }

    const decoder = new TextDecoder();
    const containerContent = decoder.decode(containerFile.content);
    const rootfilePath = OPFUtils.parseRootfilePath(containerContent);

    // 2. Find and read the OPF file
    const opfFile = files.find(f => f.path === rootfilePath);
    if (!opfFile) {
      throw new Error(`Missing OPF file at path: ${rootfilePath}`);
    }

    const opfContent = decoder.decode(opfFile.content);

    const parser = new DOMParser();
    const doc = parser.parseFromString(opfContent, 'application/xml');

    return OPFUtils.parseOPFMetadata(doc);
  }

  optimizeCompression(fileName: string, _data: ArrayBuffer): CompressionSettings {
    // mimetype file must be uncompressed and first (handled by ZipWriter)
    if (fileName === 'mimetype') {
      return { method: 0x00, reason: 'EPUB compliance requirement' };
    }

    const ext = fileName.split('.').pop()?.toLowerCase();

    // Already compressed formats - store only
    if (['jpg', 'jpeg', 'png', 'gif', 'mp3', 'mp4', 'webp', 'zip'].includes(ext || '')) {
      return { method: 0x00, reason: 'Already compressed format' };
    }

    // Text-based formats - compress
    if (['html', 'xhtml', 'xml', 'css', 'js', 'txt', 'opf', 'ncx'].includes(ext || '')) {
      return { method: 0x08, reason: 'Text-based content compresses well' };
    }

    // Default to compression for unknown types
    return { method: 0x08, reason: 'Default compression' };
  }

  /**
   * Read the per-EPUB filename template from SOURCE/settings.json. Returns the
   * default template when the file is absent, unreadable, or has no usable
   * `filename_template` (reads existing config only; never writes a file).
   */
  private async readFilenameTemplate(workspaceId: string): Promise<string> {
    try {
      const content = await this.fileStorage.readTextFile(workspaceId, 'SOURCE/settings.json');
      const parsed = JSON.parse(content);
      const template = parsed?.filename_template;
      if (typeof template === 'string' && template.trim()) {
        return template;
      }
    } catch {
      // No settings file (or invalid JSON) — fall back to the default template.
    }
    return DEFAULT_FILENAME_TEMPLATE;
  }

  generateFilename(metadata: EPUBMetadata, template: string = DEFAULT_FILENAME_TEMPLATE): string {
    const title = this.sanitizeFilename(metadata.title || 'Untitled');
    const authorName = creatorName(metadata.creator?.[0]);
    const author = authorName ? this.sanitizeFilename(authorName) : '';

    // Prefer the metadata publication date (dc:date); take its date portion so a
    // full timestamp becomes YYYY-MM-DD. Fall back to the package-generation date
    // when no publication date is set.
    const pubDate = metadata.date?.split('T')[0].trim();
    const date = pubDate ? this.sanitizeFilename(pubDate) : new Date().toISOString().split('T')[0];

    const base = template
      .split('<title>')
      .join(title)
      .split('<author>')
      .join(author)
      .split('<date>')
      .join(date)
      // Tidy separators orphaned by an empty token (e.g. no author): collapse
      // hyphen runs from a hyphen-joined template, then " - " runs from a
      // spaced one, and trim any leading/trailing separator.
      .replace(/\s+/g, ' ')
      .replace(/-{2,}/g, '-')
      .replace(/(?:-\s+){2,}/g, '- ')
      .replace(/^[\s-]+|[\s-]+$/g, '')
      // Strip any filesystem-invalid characters the template itself introduced.
      .replace(/[<>:"/\\|?*]/g, '')
      .trim();

    return `${base || 'Untitled'}.epub`;
  }

  /**
   * Slug a template token (title / author) so the packaged filename is safe as
   * a filesystem name AND as a URL path segment — published files become OPDS
   * acquisition URLs, where spaces and URL delimiters (%, #, ?, &, +, …) cause
   * encoding bugs in reading-system clients. Letters and digits in any script
   * are kept (non-English titles stay intact; NFC keeps composed/decomposed
   * variants identical), apostrophes vanish (O'Brien → OBrien), and every
   * other character becomes a hyphen.
   */
  private sanitizeFilename(name: string): string {
    return name
      .normalize('NFC')
      .replace(/['’`]/g, '')
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/-{2,}/g, '-')
      .substring(0, 50)
      .replace(/^[-.]+|[-.]+$/g, '');
  }

  downloadEPUB(blob: Blob, filename: string): void {
    // Uses ZIP library's download utility
    downloadBlob(blob, filename);
  }
}
