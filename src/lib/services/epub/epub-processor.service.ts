/**
 * EPUBProcessor - Clean Service Architecture Implementation
 *
 * Thin wrapper over existing EPUBUnpacker, EPUBPackager, and OPFUtils components
 * providing a clean service interface for EPUB operations.
 */

import type { FileStorageAPI } from '../../storage/index.js';
import { EPUBUnpacker } from '../../epub/EPUBUnpacker.js';
import { EPUBPackager } from '../../epub/EPUBPackager.js';
import { OPFUtils } from '../../epub/opf-utils.js';
import { Zip } from '../../zip/index.js';

// Re-export types from existing components
export type { UnpackResult, ValidationResult, ExtractionResult } from '../../epub/EPUBUnpacker.js';

export type {
  PackageResult,
  PackageOptions,
  PackageProgress,
  CompressionSettings,
  WorkspaceFile,
  EPUBMetadata,
} from '../../epub/EPUBPackager.js';

export type {
  OPFDocument,
  ManifestItem,
  SpineItem,
  GuideItem,
  ContainerInfo,
  XMLValidationResult,
} from '../../epub/opf-utils.js';

// Service error types
export class EPUBProcessorError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'EPUBProcessorError';
  }
}

/**
 * EPUBProcessor - Single responsibility for EPUB processing operations
 */
export class EPUBProcessor {
  private epubUnpacker: EPUBUnpacker;
  private epubPackager: EPUBPackager;

  constructor(private fileStorage: FileStorageAPI) {
    this.epubUnpacker = new EPUBUnpacker();
    this.epubPackager = new EPUBPackager();
  }

  // ============================================================================
  // EPUB Unpacking Operations
  // ============================================================================

  /**
   * Unpack EPUB file to workspace
   */
  async unpackEPUB(
    file: File,
    workspaceId: string
  ): Promise<import('../../epub/EPUBUnpacker.js').UnpackResult> {
    try {
      // Ensure storage is initialized
      if (!this.fileStorage.isInitialized()) {
        await this.fileStorage.init();
      }

      return await this.epubUnpacker.unpackEPUB(file, workspaceId);
    } catch (error) {
      throw new EPUBProcessorError(
        `Failed to unpack EPUB: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EPUB_UNPACK_ERROR'
      );
    }
  }

  /**
   * Validate EPUB structure from ZIP data
   */
  async validateEPUBStructure(
    zipData: ArrayBuffer
  ): Promise<import('../../epub/EPUBUnpacker.js').ValidationResult> {
    try {
      const zip = new Zip(zipData);
      return await this.epubUnpacker.validateEPUBStructure(zip);
    } catch (error) {
      // Return validation failure instead of throwing
      return {
        isValid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
      };
    }
  }

  // ============================================================================
  // EPUB Packaging Operations
  // ============================================================================

  /**
   * Package workspace into EPUB file
   */
  async packageEPUB(
    workspaceId: string,
    options?: import('../../epub/EPUBPackager.js').PackageOptions
  ): Promise<import('../../epub/EPUBPackager.js').PackageResult> {
    try {
      // Ensure storage is initialized
      if (!this.fileStorage.isInitialized()) {
        await this.fileStorage.init();
      }

      return await this.epubPackager.packageEPUB(workspaceId, options);
    } catch (error) {
      throw new EPUBProcessorError(
        `Failed to package EPUB: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EPUB_PACKAGE_ERROR'
      );
    }
  }

  // ============================================================================
  // OPF Document Processing
  // ============================================================================

  /**
   * Parse OPF document from XML content
   */
  parseOPFDocument(opfContent: string): import('../../epub/opf-utils.js').OPFDocument {
    try {
      return OPFUtils.parseOPFDocument(opfContent);
    } catch (error) {
      throw new EPUBProcessorError(
        `Failed to parse OPF document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'OPF_PARSE_ERROR'
      );
    }
  }

  /**
   * Generate OPF XML from document structure
   */
  generateOPFXML(opfDocument: import('../../epub/opf-utils.js').OPFDocument): string {
    try {
      return OPFUtils.generateOPFXML(opfDocument);
    } catch (error) {
      throw new EPUBProcessorError(
        `Failed to generate OPF XML: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'OPF_GENERATE_ERROR'
      );
    }
  }

  /**
   * Validate XML content
   */
  validateXML(xmlContent: string): import('../../epub/opf-utils.js').XMLValidationResult {
    return OPFUtils.validateXML(xmlContent);
  }

  /**
   * Parse OPF metadata only
   */
  parseOPFMetadata(opfContent: string): import('../../epub/opf-utils.js').EPUBMetadata {
    try {
      if (!globalThis.DOMParser) {
        throw new Error('DOMParser not available');
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(opfContent, 'application/xml');

      // Check for XML parsing errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        throw new Error('Invalid OPF XML');
      }

      return OPFUtils.parseOPFMetadata(doc);
    } catch (error) {
      throw new EPUBProcessorError(
        `Failed to parse OPF metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'OPF_METADATA_PARSE_ERROR'
      );
    }
  }

  // ============================================================================
  // Container Processing
  // ============================================================================

  /**
   * Parse container.xml to extract rootfile path
   */
  parseContainerXML(containerXml: string): import('../../epub/opf-utils.js').ContainerInfo {
    return OPFUtils.parseContainerXml(containerXml);
  }

  /**
   * Generate container.xml content
   */
  generateContainerXML(rootfilePath: string = 'OEBPS/content.opf'): string {
    return OPFUtils.generateContainerXML(rootfilePath);
  }

  // ============================================================================
  // EPUB Version Detection
  // ============================================================================

  /**
   * Detect EPUB version from OPF content
   */
  detectEPUBVersion(opfContent: string): string | undefined {
    return OPFUtils.detectEPUBVersion(opfContent);
  }

  // ============================================================================
  // Validation Utilities
  // ============================================================================

  /**
   * Validate manifest and spine consistency
   */
  validateManifestSpineConsistency(
    manifest: import('../../epub/opf-utils.js').ManifestItem[],
    spine: import('../../epub/opf-utils.js').SpineItem[]
  ): string[] {
    return OPFUtils.validateManifestSpineConsistency(manifest, spine);
  }

  /**
   * Parse rootfile path from container content (lightweight regex method)
   */
  parseRootfilePath(containerContent: string): string {
    try {
      return OPFUtils.parseRootfilePath(containerContent);
    } catch (error) {
      throw new EPUBProcessorError(
        `Failed to parse rootfile path: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ROOTFILE_PARSE_ERROR'
      );
    }
  }
}
