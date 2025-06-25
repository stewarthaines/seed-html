# 02. EPUB Unpacking

## Overview

Extracts EPUB ZIP files using the custom ZIP library (`src/lib/zip`) that leverages the Compression Streams API for efficient, memory-safe processing and validation.

## Requirements

- ZIP library integration for EPUB file extraction
- EPUB structure validation and error reporting
- Storage quota monitoring and handling
- Workspace-based file organization
- Support for both compressed and uncompressed ZIP entries

## Dependencies

- **#1 File Storage API** - for storing extracted files
- **src/lib/zip** - ZIP reader implementation using Compression Streams API

## Technical Approach

- Use `Zip` class from `src/lib/zip/zip-reader.js` for parsing
- Stream-based decompression via `DecompressionStream("deflate-raw")`
- Direct integration with File Storage API workspace system
- Memory-efficient processing for large EPUB files

## API Design

```typescript
interface EPUBUnpacker {
  unpackEPUB(file: File, workspaceId: string): Promise<UnpackResult>;
  validateEPUBStructure(entries: ZipEntry[]): ValidationResult;
  extractToWorkspace(zip: Zip, workspaceId: string): Promise<ExtractionResult>;
}

interface UnpackResult {
  success: boolean;
  workspaceId?: string;
  error?: string;
  extractedFiles?: string[];
  totalSize?: number;
  processedFiles?: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  detectedVersion?: string; // EPUB 2.0 or 3.0
}

interface ExtractionResult {
  success: boolean;
  extractedFiles: string[];
  totalBytes: number;
  skippedFiles: string[];
  errors: string[];
}

// From ZIP library
interface ZipEntry {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  extract(): Promise<Blob>;
}
```

## EPUB Validation Rules

- Must contain `mimetype` file with content "application/epub+zip"
- Must contain `META-INF/container.xml`
- Must contain rootfile mentioned in container.xml (usually `OEBPS/content.opf` but can be something else)
- Validate basic ZIP file structure

## Implementation Process

```typescript
class EPUBUnpacker {
  async unpackEPUB(file: File, workspaceId: string): Promise<UnpackResult> {
    try {
      // 1. Read EPUB file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // 2. Parse ZIP file using custom ZIP library
      const zip = new Zip(arrayBuffer);

      // 3. Validate EPUB structure
      const validation = this.validateEPUBStructure(zip.entries);
      if (!validation.isValid) {
        return { success: false, error: validation.errors.join(', ') };
      }

      // 4. Extract files to workspace using File Storage API
      const extraction = await this.extractToWorkspace(zip, workspaceId);

      return {
        success: extraction.success,
        workspaceId,
        extractedFiles: extraction.extractedFiles,
        totalSize: extraction.totalBytes,
        processedFiles: extraction.extractedFiles.length,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async extractToWorkspace(zip: Zip, workspaceId: string): Promise<ExtractionResult> {
    const fileStorage = new FileStorageAPI();
    const extractedFiles = [];
    const skippedFiles = [];
    const errors = [];
    let totalBytes = 0;

    for (const entry of zip.entries) {
      try {
        // Extract file using ZIP library's built-in decompression
        const blob = await entry.extract();
        const arrayBuffer = await blob.arrayBuffer();

        // Store in File Storage API workspace
        await fileStorage.writeFile(workspaceId, entry.fileName, arrayBuffer);

        extractedFiles.push(entry.fileName);
        totalBytes += arrayBuffer.byteLength;
      } catch (error) {
        errors.push(`Failed to extract ${entry.fileName}: ${error.message}`);
        skippedFiles.push(entry.fileName);
      }
    }

    return {
      success: errors.length === 0,
      extractedFiles,
      totalBytes,
      skippedFiles,
      errors,
    };
  }
}
```

## Error Handling

### ZIP Library Integration Errors

- **Invalid ZIP signatures**: ZIP library handles malformed file detection
- **Decompression failures**: Handled by `DecompressionStream("deflate-raw")`
- **Unsupported compression**: ZIP library supports store (0x00) and deflate (0x08)
- **Corrupted ZIP data**: Automatic error capture in `entry.extract()`

### File Storage Errors

- **Storage quota exceeded**: Caught during `fileStorage.writeFile()`
- **Invalid file paths**: Handled by File Storage API path validation
- **Permission errors**: OPFS/IndexedDB access failures

### EPUB Structure Errors

- **Missing mimetype file**: Validation before extraction
- **Invalid container.xml**: XML parsing errors
- **Missing OPF rootfile**: Reference validation

## Storage Integration

```typescript
// Direct integration with File Storage API
async extractToWorkspace(zip: Zip, workspaceId: string) {
  const fileStorage = new FileStorageAPI();

  for (const entry of zip.entries) {
    // ZIP library handles decompression automatically
    const blob = await entry.extract();
    const arrayBuffer = await blob.arrayBuffer();

    // File Storage API handles path normalization and storage backend
    await fileStorage.writeFile(workspaceId, entry.fileName, arrayBuffer);
  }
}
```

### Integration Benefits

- **Automatic path handling**: File Storage API normalizes ZIP entry paths
- **Backend abstraction**: Works with OPFS, IndexedDB, or worker threads
- **Workspace isolation**: Each EPUB extracted to separate workspace
- **Quota monitoring**: Built-in storage limit detection

## Performance Characteristics

### Memory Efficiency

- **Streaming decompression**: Files processed one at a time, not loaded entirely in memory
- **Blob-based transfer**: Efficient data handling between ZIP library and File Storage API
- **No intermediate storage**: Direct extraction to final storage backend

### Processing Speed

- **Native decompression**: Uses browser's optimized `DecompressionStream`
- **Single-pass extraction**: ZIP central directory parsed once
- **Parallel processing ready**: Can extract files concurrently if needed

## Testing Considerations

### ZIP Library Testing

- **Both compression methods**: Store (mimetype) and deflate (content files)
- **Large file handling**: Test with EPUB files >100MB
- **Malformed ZIP files**: Invalid signatures, truncated data
- **Empty ZIP files**: Edge case handling

### EPUB Validation Testing

- **Valid EPUB 2.0/3.0 files**: Standard structure validation
- **Missing required files**: mimetype, container.xml, OPF files
- **Invalid file content**: Malformed XML, incorrect MIME types
- **Non-standard structures**: Custom directory layouts

### Storage Integration Testing

- **Quota exceeded scenarios**: Large EPUB extraction failures
- **Path edge cases**: Unicode filenames, deep directory structures
- **Concurrent extractions**: Multiple EPUB files processed simultaneously
- **Storage backend switching**: OPFS → IndexedDB fallback during extraction

## Implementation Files

### Primary Implementation

- **File**: `src/lib/epub/EPUBUnpacker.js`
- **Dependencies**: `src/lib/zip/zip-reader.js`, `src/lib/storage/FileStorageAPI.js`
- **Export**: `EPUBUnpacker` class
- **Usage**: `import { EPUBUnpacker } from '$lib/epub'`

### Implementation Priority

1. **Basic ZIP extraction**: Integrate ZIP library with File Storage API
2. **EPUB validation**: Implement structure checking
3. **Error handling**: Comprehensive error capture and reporting
4. **Progress tracking**: File-by-file extraction progress
5. **Performance optimization**: Concurrent extraction, memory management
