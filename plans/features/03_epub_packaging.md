# 03. EPUB Packaging

## Overview
Creates valid EPUB ZIP files from workspace content using the custom ZIP library (`src/lib/zip`) with EPUB-compliant structure and download functionality.

## Requirements
- Package workspace content into valid EPUB files
- EPUB-compliant ZIP structure (mimetype first, uncompressed)
- Intelligent compression based on file types
- Metadata-based filename generation
- Direct download functionality

## Dependencies
- **#1 File Storage API** - for reading workspace files
- **src/lib/zip** - ZIP writer implementation using Compression Streams API

## Technical Approach
- Use `ZipWriter` class from `src/lib/zip/zip-writer.js`
- Automatic EPUB structure compliance (mimetype file handling)
- File type-based compression optimization
- Integration with File Storage API for workspace reading

## API Design

```typescript
interface EPUBPackager {
  packageEPUB(workspaceId: string, options?: PackageOptions): Promise<PackageResult>;
  generateFilename(metadata: EPUBMetadata): string;
  downloadEPUB(blob: Blob, filename: string): void;
  readWorkspaceFiles(workspaceId: string): Promise<WorkspaceFile[]>;
  optimizeCompression(fileName: string, data: ArrayBuffer): CompressionSettings;
}

interface PackageResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  error?: string;
  totalSize?: number;
  compressedSize?: number;
  fileCount?: number;
  processingTime?: number;
}

interface PackageOptions {
  compressionLevel?: 'fast' | 'balanced' | 'maximum';
  includeEditmeFiles?: boolean;
  validateStructure?: boolean;
  progressCallback?: (progress: PackageProgress) => void;
}

interface PackageProgress {
  phase: 'reading' | 'compressing' | 'writing' | 'complete';
  currentFile?: string;
  processedFiles: number;
  totalFiles: number;
  currentBytes: number;
  totalBytes: number;
}

interface WorkspaceFile {
  path: string;
  content: ArrayBuffer;
  size: number;
  mimeType?: string;
}

interface CompressionSettings {
  method: 0x00 | 0x08; // Store or Deflate
  reason: string;
}

interface EPUBMetadata {
  title: string;
  author?: string;
  language: string;
  identifier: string;
  publisher?: string;
  date?: string;
}
```

## Implementation Process

```typescript
class EPUBPackager {
  async packageEPUB(workspaceId: string, options = {}): Promise<PackageResult> {
    const startTime = Date.now();
    
    try {
      // 1. Read all workspace files using File Storage API
      const files = await this.readWorkspaceFiles(workspaceId);
      
      // 2. Extract metadata from container.xml → OPF file
      const metadata = await this.extractMetadata(files);
      
      // 3. Create ZIP writer with EPUB-compliant structure
      const zipWriter = new ZipWriter();
      
      // 4. Add files with optimized compression
      for (const file of files) {
        const compression = this.optimizeCompression(file.path, file.content);
        await zipWriter.addFile(file.path, file.content, {
          compressionMethod: compression.method,
          lastModified: new Date()
        });
        
        options.progressCallback?.({
          phase: 'compressing',
          currentFile: file.path,
          processedFiles: zipWriter.fileCount,
          totalFiles: files.length,
          currentBytes: file.size,
          totalBytes: files.reduce((sum, f) => sum + f.size, 0)
        });
      }
      
      // 5. Build final ZIP blob
      const blob = await zipWriter.buildBlob();
      const filename = this.generateFilename(metadata);
      
      return {
        success: true,
        blob,
        filename,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        compressedSize: blob.size,
        fileCount: files.length,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async readWorkspaceFiles(workspaceId: string): Promise<WorkspaceFile[]> {
    const filePaths = await this.fileStorage.listFiles(workspaceId);
    const files = [];

    for (const path of filePaths) {
      try {
        const content = await this.fileStorage.readFile(workspaceId, path);
        files.push({
          path,
          content,
          size: content.byteLength,
          mimeType: this.getMimeType(path)
        });
      } catch (error) {
        // Skip files that can't be read but don't fail the entire operation
        console.warn(`Failed to read file ${path}:`, error);
      }
    }

    return files;
  }

  optimizeCompression(fileName: string, data: ArrayBuffer): CompressionSettings {
    // mimetype file must be uncompressed and first (handled by ZipWriter)
    if (fileName === 'mimetype') {
      return { method: 0x00, reason: 'EPUB compliance requirement' };
    }

    const ext = fileName.split('.').pop()?.toLowerCase();
    
    // Already compressed formats - store only
    if (['jpg', 'jpeg', 'png', 'gif', 'mp3', 'mp4', 'webp', 'zip'].includes(ext)) {
      return { method: 0x00, reason: 'Already compressed format' };
    }
    
    // Text-based formats - compress
    if (['html', 'xhtml', 'xml', 'css', 'js', 'txt', 'opf', 'ncx'].includes(ext)) {
      return { method: 0x08, reason: 'Text-based content compresses well' };
    }
    
    // Default to compression for unknown types
    return { method: 0x08, reason: 'Default compression' };
  }
}
```

## ZIP Library Integration Benefits

### Automatic EPUB Compliance
- **mimetype file ordering**: `ZipWriter` automatically sorts mimetype file first
- **Compression handling**: Built-in support for both store (0x00) and deflate (0x08)
- **File structure**: Proper ZIP central directory and header generation

### Memory Efficiency
- **Streaming compression**: Files compressed individually using `CompressionStream("deflate-raw")`
- **No intermediate files**: Direct ArrayBuffer → ZIP → Blob pipeline
- **Progress tracking**: File-by-file processing enables progress callbacks

## Download Implementation

```typescript
// Built-in download utilities from ZIP library
import { downloadBlob } from '$lib/zip/utils';

class EPUBPackager {
  downloadEPUB(blob: Blob, filename: string): void {
    // Uses ZIP library's download utility
    downloadBlob(blob, filename);
  }

  generateFilename(metadata: EPUBMetadata): string {
    const title = this.sanitizeFilename(metadata.title || 'Untitled');
    const author = metadata.author ? this.sanitizeFilename(metadata.author) : null;
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const parts = [title];
    if (author) parts.push(author);
    parts.push(timestamp);
    
    return `${parts.join(' - ')}.epub`;
  }

  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\s+/g, ' ')         // Normalize whitespace
      .trim()
      .substring(0, 50);            // Limit length
  }
}
```

## Error Handling

### File Storage Integration Errors
- **Missing workspace**: Handle non-existent workspace IDs
- **File read failures**: Individual file access errors during packaging
- **Storage backend errors**: OPFS/IndexedDB access failures
- **Quota exceeded**: Handle storage limits during file reading

### EPUB Structure Validation
- **Missing required files**: mimetype, container.xml, OPF file validation
- **Invalid OPF structure**: XML parsing and metadata extraction errors
- **Empty workspace**: Handle workspaces with no files

### ZIP Creation Errors  
- **Compression failures**: Handle `CompressionStream` errors
- **Memory limitations**: Large file processing failures
- **Invalid file data**: Corrupted ArrayBuffer handling

## Performance Characteristics

### Compression Optimization
```typescript
// Smart compression based on file type
optimizeCompression(fileName: string): CompressionSettings {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'jpg': case 'png': case 'gif': case 'mp3': case 'mp4':
      return { method: 0x00, reason: 'Already compressed' };
    case 'html': case 'xhtml': case 'xml': case 'css': case 'js':
      return { method: 0x08, reason: 'Text compresses well' };
    default:
      return { method: 0x08, reason: 'Default compression' };
  }
}
```

### Memory Management
- **Streaming processing**: Files processed individually, not loaded entirely in memory
- **Blob output**: Efficient browser-native blob creation
- **Progress tracking**: Real-time feedback on large EPUB creation
- **Garbage collection friendly**: No large intermediate objects

## Testing Considerations

### ZIP Library Integration Testing
- **EPUB compliance**: Verify mimetype file ordering and compression
- **File type optimization**: Test compression decisions for various file types
- **Large workspace handling**: Test with workspaces containing many files
- **Progress callback accuracy**: Verify progress reporting

### EPUB Validator Testing
- **Generated file validation**: Test output with epubcheck or similar validators
- **Cross-platform compatibility**: Test EPUBs in various readers (Apple Books, Kindle, etc.)
- **File structure verification**: Ensure proper ZIP structure and metadata

### Download Functionality Testing
- **Browser compatibility**: Test download across Chrome, Firefox, Safari, Edge
- **Large file downloads**: Test with EPUB files >100MB
- **Filename handling**: Test with various metadata combinations and edge cases
- **Security restrictions**: Handle blocked downloads due to browser security

## Implementation Files

### Primary Implementation
- **File**: `src/lib/epub/EPUBPackager.ts`
- **Dependencies**: `src/lib/zip/index.ts`, `src/lib/storage/index.ts`
- **Export**: `EPUBPackager` class
- **Usage**: `import { EPUBPackager } from '$lib/epub'`

### Implementation Priority
1. **Basic workspace reading**: Integrate with File Storage API
2. **ZIP creation**: Use ZipWriter with basic compression
3. **EPUB compliance**: Implement mimetype handling and file ordering
4. **Compression optimization**: Add file type-based compression logic
5. **Progress tracking**: Add progress callbacks for UI integration
6. **Download functionality**: Implement filename generation and download triggers

### Integration with Existing ZIP Library
- **Leverages existing infrastructure**: Uses proven Compression Streams API implementation
- **EPUB-specific optimizations**: Builds on ZIP library's automatic mimetype handling
- **Unified utilities**: Uses shared download and utility functions
- **Performance benefits**: Inherits streaming and memory efficiency features

## Implementation Differences from Plan

### Key Changes Made
1. **Metadata Extraction**: Implemented proper container.xml parsing to find OPF rootfile path instead of searching for .opf files
2. **Error Handling**: No fallback metadata - throws errors for missing required fields (title, language, identifier)
3. **File Reading**: Added error handling to skip unreadable files without failing entire operation
4. **Storage Initialization**: Added check for storage initialization state before processing
5. **TypeScript**: Implemented in TypeScript (.ts) instead of JavaScript (.js) for better type safety
6. **Testing**: Created comprehensive test suite with ES module imports and mocked dependencies

### Validation Improvements
- **EPUB Structure**: Validates presence of META-INF/container.xml
- **OPF File**: Validates OPF file exists at the path specified in container.xml
- **Required Metadata**: Strict validation of dc:title, dc:language, and dc:identifier
- **Empty Workspace**: Proper error handling for workspaces with no files