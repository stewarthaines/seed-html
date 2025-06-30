# 23. SOURCE.zip - Consolidated Editor Files

## Overview

Consolidates all workspace `SOURCE/` directory files into a single `SOURCE.zip` manifest item during EPUB packaging. This maintains clean EPUB structure while preserving the workspace editing experience with individual SOURCE files.

## Requirements

### Functional Requirements

- Bundle all `SOURCE/` files into `SOURCE.zip` during EPUB packaging
- Extract `SOURCE.zip` to `SOURCE/` directory during EPUB unpacking
- Maintain workspace `SOURCE/` structure for editing (settings.json, text/, extensions/, scripts/)
- Auto-manage `SOURCE.zip` manifest item (hidden from user interface)
- Support empty `SOURCE/` directories (no SOURCE.zip created)
- Replace existing `EDITME/` structure with new `SOURCE/` structure (no backward compatibility)

### Design Decisions

- **Directory Structure**: `SOURCE/` replaces `EDITME/` throughout codebase
- **Subdirectories**: `SOURCE/settings.json`, `SOURCE/text/`, `SOURCE/extensions/`, `SOURCE/scripts/`
- **Migration**: No migration support - existing workspaces with `EDITME/` become invalid
- **Performance**: No explicit size limits - rely on browser/file storage constraints
- **Implementation**: Simple in-memory operations (no streaming for large directories)

### Performance Requirements

- Use STORE compression for `SOURCE.zip` (avoid double compression)
- Simple in-memory processing (no streaming required)
- Minimal impact on workspace operations (only affects pack/unpack)
- Rely on browser memory limits and file storage constraints

## Dependencies

- **File Storage API**: Workspace file reading/writing (Phase 1)
- **ZIP Library**: Existing `ZipWriter` and `Zip` classes (`src/lib/zip/`)
- **EPUB Packaging**: `EPUBPackager.ts` modifications
- **EPUB Unpacking**: `EPUBUnpacker.ts` modifications
- **Workspace Manager**: `workspace-manager.ts` integration
- **OPF Management**: Manifest item handling (`opf-utils.ts`)

## Technical Approach

### Workspace Structure

```
# During Editing (workspace):
workspace-{id}/
└── OEBPS/
    ├── content.opf
    ├── EDITME.html
    ├── Text/           # EPUB content
    └── SOURCE/         # Editor files (not in manifest)
        ├── settings.json
        ├── text/       # Plain text sources
        ├── extensions/ # Transform extensions
        └── scripts/    # Custom transforms

# In Packaged EPUB:
epub-file.epub
├── mimetype
├── META-INF/container.xml
└── OEBPS/
    ├── content.opf    # Contains SOURCE.zip manifest item
    ├── EDITME.html
    ├── Text/          # EPUB content
    └── SOURCE.zip     # All SOURCE/ files compressed
```

### Packaging Workflow

1. **Collect SOURCE files**: Scan workspace `SOURCE/` directory
2. **Create SOURCE.zip**: Bundle files using existing ZIP library
3. **Update manifest**: Add `SOURCE.zip` with media-type `application/zip`
4. **Package EPUB**: Include SOURCE.zip in final EPUB ZIP

### Unpacking Workflow

1. **Detect SOURCE.zip**: Check manifest for SOURCE.zip item
2. **Extract to workspace**: Unpack SOURCE.zip to `SOURCE/` directory
3. **Clean up**: Remove SOURCE.zip file from workspace
4. **Validate**: Ensure SOURCE/ structure is valid

## API Design

### Core SourceManager Class

```typescript
export class SourceManager {
  constructor(private fileStorage: FileStorageAPI);

  // SOURCE.zip creation and extraction
  async createSourceZip(workspaceId: string): Promise<Blob | null>;
  async extractSourceZip(workspaceId: string, sourceZipBlob: Blob): Promise<void>;

  // SOURCE/ directory management
  async hasSourceFiles(workspaceId: string): Promise<boolean>;
  async listSourceFiles(workspaceId: string): Promise<SourceFileInfo[]>;
  async initializeSourceStructure(workspaceId: string): Promise<void>;

  // Validation and verification
  async validateSourceStructure(workspaceId: string): Promise<SourceValidation>;
  async getSourceDirectoryStats(workspaceId: string): Promise<SourceStats>;
}

interface SourceFileInfo {
  path: string;
  size: number;
  type: 'settings' | 'text' | 'script' | 'extension' | 'other';
  lastModified?: Date;
}

interface SourceValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileCount: number;
  totalSize: number;
  hasSettings: boolean;
}

interface SourceStats {
  totalFiles: number;
  totalSize: number;
  directories: {
    text: number;
    scripts: number;
    extensions: number;
  };
  hasSettingsFile: boolean;
}
```

### EPUB Packager Integration

```typescript
// Modified EPUBPackager method
class EPUBPackager {
  constructor(private sourceManager: SourceManager) {}

  private async handleSourceZip(workspaceId: string): Promise<{
    sourceZip: Blob | null;
    manifestItem: ManifestItem | null;
  }> {
    if (await this.sourceManager.hasSourceFiles(workspaceId)) {
      const sourceZip = await this.sourceManager.createSourceZip(workspaceId);

      return {
        sourceZip,
        manifestItem: {
          id: 'source-zip',
          href: 'SOURCE.zip',
          mediaType: 'application/zip',
        },
      };
    }

    return { sourceZip: null, manifestItem: null };
  }

  async readWorkspaceFiles(workspaceId: string): Promise<WorkspaceFile[]> {
    const allFiles = await this.fileStorage.listFiles(workspaceId);
    
    // Separate SOURCE/ files from EPUB files
    const sourceFiles = allFiles.filter(f => f.startsWith('SOURCE/'));
    const epubFiles = allFiles.filter(f => !f.startsWith('SOURCE/'));
    
    const workspaceFiles: WorkspaceFile[] = [];
    
    // Process EPUB files normally
    for (const filePath of epubFiles) {
      const content = await this.fileStorage.readFile(workspaceId, filePath);
      workspaceFiles.push({
        path: filePath,
        content,
        size: content.byteLength,
        mimeType: getMimeType(filePath),
      });
    }
    
    // Create SOURCE.zip if SOURCE/ files exist
    const { sourceZip } = await this.handleSourceZip(workspaceId);
    if (sourceZip) {
      const sourceZipBuffer = await sourceZip.arrayBuffer();
      workspaceFiles.push({
        path: 'SOURCE.zip',
        content: sourceZipBuffer,
        size: sourceZipBuffer.byteLength,
        mimeType: 'application/zip',
      });
    }
    
    return workspaceFiles;
  }
}
```

### EPUB Unpacker Integration

```typescript
// Modified EPUBUnpacker method
class EPUBUnpacker {
  constructor(private sourceManager: SourceManager) {}

  async extractToWorkspace(zip: Zip, workspaceId: string): Promise<ExtractionResult> {
    // ... existing extraction logic for EPUB files ...
    
    // Handle SOURCE.zip if present
    const sourceZipEntry = zip.entries.find(e => e.fileName === 'OEBPS/SOURCE.zip');
    if (sourceZipEntry) {
      const sourceZipBlob = await sourceZipEntry.extract();
      await this.sourceManager.extractSourceZip(workspaceId, sourceZipBlob);
      
      // SOURCE.zip is not stored as a workspace file - only its extracted contents
      extractedFiles.push('SOURCE.zip (extracted to SOURCE/)');
    }
    
    return result;
  }
}
```

### Workspace Manager Integration

```typescript
// Modified WorkspaceManager method
class WorkspaceManager {
  constructor(private sourceManager: SourceManager) {}

  private async createEPUBStructure(workspaceId: string, metadata: EPUBMetadata): Promise<void> {
    // ... existing EPUB structure creation ...
    
    // Initialize SOURCE/ directory structure
    await this.sourceManager.initializeSourceStructure(workspaceId);
  }

  async validateWorkspaceStructure(workspaceId: string): Promise<ValidationResult> {
    // ... existing validation logic for EPUB files ...
    
    // Validate SOURCE/ structure separately
    const sourceValidation = await this.sourceManager.validateSourceStructure(workspaceId);
    
    return {
      // ... existing validation results ...
      sourceValidation,
    };
  }
}

## Implementation Plan

### Phase 1: Core SourceManager Implementation

1. **Create SourceManager class** in `src/lib/source/`
   - `source-manager.ts` - Main SourceManager class
   - `types.ts` - TypeScript interfaces and types
   - `source-utils.ts` - Helper utilities
   - `index.ts` - Clean exports

2. **Implement core methods**:
   - `createSourceZip()` - Bundle SOURCE/ files using existing ZipWriter
   - `extractSourceZip()` - Extract ZIP to workspace SOURCE/ directory
   - `hasSourceFiles()` - Check if workspace has SOURCE/ content
   - `initializeSourceStructure()` - Create default SOURCE/ directories

3. **Add validation methods**:
   - `validateSourceStructure()` - Ensure SOURCE/ structure integrity
   - `listSourceFiles()` - Enumerate SOURCE/ files with metadata
   - `getSourceDirectoryStats()` - Provide statistics for SOURCE/ content

### Phase 2: EPUB Integration

1. **Modify EPUBPackager** (`src/lib/epub/EPUBPackager.ts`):
   - Update `readWorkspaceFiles()` to handle SOURCE.zip creation
   - Add SOURCE.zip to manifest when present
   - Exclude SOURCE/ files from direct packaging

2. **Modify EPUBUnpacker** (`src/lib/epub/EPUBUnpacker.ts`):
   - Update `extractToWorkspace()` to detect SOURCE.zip
   - Extract SOURCE.zip contents to SOURCE/ directory
   - Report SOURCE.zip extraction in results

3. **Update WorkspaceManager** (`src/lib/workspace/workspace-manager.ts`):
   - Replace `EDITME/` with `SOURCE/` in `createEPUBStructure()`
   - Update `validateWorkspaceStructure()` to include SOURCE/ validation
   - Integrate SourceManager dependency injection

### Phase 3: Error Handling & Testing

1. **Error scenarios**:
   - Empty SOURCE/ directories (skip SOURCE.zip creation)
   - Corrupted SOURCE.zip files (graceful degradation)
   - Invalid SOURCE/ structure (validation errors)
   - File access failures (permission/storage errors)

2. **Unit test implementation**:
   - Mock File Storage API for testing
   - Test round-trip SOURCE.zip creation/extraction
   - Validate error handling and edge cases
   - Integration tests with EPUB workflows

## Testing Considerations

### Unit Test Coverage Matrix

#### SourceManager Core Methods

**createSourceZip() Tests:**
- ✅ Empty SOURCE/ directory (returns null)
- ✅ Single file in SOURCE/ (creates valid ZIP)
- ✅ Multiple files across subdirectories (text/, scripts/, extensions/)
- ✅ Large files (memory limits)
- ✅ Binary and text file handling
- ✅ File access errors (mock storage failures)
- ✅ ZIP creation errors (mock ZIP library failures)

**extractSourceZip() Tests:**
- ✅ Valid SOURCE.zip extraction
- ✅ Empty ZIP file handling
- ✅ Corrupted ZIP file handling
- ✅ Invalid file paths (security: path traversal attempts)
- ✅ Existing SOURCE/ directory overwrite
- ✅ File write permission errors
- ✅ Large ZIP extraction (memory limits)

**hasSourceFiles() Tests:**
- ✅ Empty workspace (no SOURCE/ directory)
- ✅ Empty SOURCE/ directory
- ✅ SOURCE/ with only .gitkeep files
- ✅ SOURCE/ with actual content files
- ✅ Storage access errors

**initializeSourceStructure() Tests:**
- ✅ New workspace initialization
- ✅ Existing SOURCE/ directory (no overwrite)
- ✅ Default settings.json creation
- ✅ Directory structure creation (text/, scripts/, extensions/)
- ✅ .gitkeep file placement
- ✅ File write permission errors

**validateSourceStructure() Tests:**
- ✅ Valid SOURCE/ structure
- ✅ Missing settings.json (warning)
- ✅ Invalid settings.json format (error)
- ✅ Extra files/directories (warnings)
- ✅ Empty subdirectories (valid)
- ✅ Invalid file types (warnings)

**listSourceFiles() & getSourceDirectoryStats() Tests:**
- ✅ File classification accuracy (settings/text/script/extension/other)
- ✅ Size calculation accuracy
- ✅ Directory statistics correctness
- ✅ Empty directories handling
- ✅ File metadata extraction

#### Integration with Existing Systems

**EPUBPackager Integration Tests:**
- ✅ readWorkspaceFiles() excludes SOURCE/ files
- ✅ SOURCE.zip added to workspace files when present
- ✅ SOURCE.zip excluded when no SOURCE/ files
- ✅ Manifest item creation for SOURCE.zip
- ✅ MIME type assignment (application/zip)

**EPUBUnpacker Integration Tests:**
- ✅ SOURCE.zip detection in EPUB
- ✅ SOURCE.zip extraction during unpacking
- ✅ SOURCE.zip not stored as workspace file
- ✅ Missing SOURCE.zip handling (no error)
- ✅ Extraction result reporting

**WorkspaceManager Integration Tests:**
- ✅ EDITME/ to SOURCE/ migration in createEPUBStructure()
- ✅ SOURCE/ validation in validateWorkspaceStructure()
- ✅ SourceManager dependency injection

### Mock Requirements

**File Storage API Mocks:**
```typescript
interface MockFileStorage {
  createWorkspace: vi.fn();
  listFiles: vi.fn();
  readFile: vi.fn();
  writeFile: vi.fn();
  writeTextFile: vi.fn();
  deleteFile: vi.fn();
  fileExists: vi.fn();
}
```

**ZIP Library Mocks:**
```typescript
interface MockZipWriter {
  addFile: vi.fn();
  buildBlob: vi.fn();
}

interface MockZip {
  entries: MockZipEntry[];
}

interface MockZipEntry {
  fileName: string;
  extract: vi.fn();
}
```

### Test Fixtures

**Sample SOURCE/ Structure:**
```
SOURCE/
├── settings.json              # Valid transform settings
├── text/
│   ├── chapter1.txt          # Plain text source
│   └── chapter2.txt          # Plain text source
├── scripts/
│   ├── markdown-transform.js # Text transform script
│   └── custom-dom.js         # DOM transform script
└── extensions/
    └── markdown-it/
        ├── package.json      # Extension metadata
        └── index.js          # Extension code
```

**settings.json Fixture:**
```json
{
  "is_draft": false,
  "draft_id": 1,
  "text_transform": "markdown-transform.js",
  "dom_transforms": ["custom-dom.js"],
  "version": "1.0.0"
}
```

**Test Data Sizes:**
- Small: 1-10 files, <1MB total
- Medium: 50-100 files, 1-10MB total  
- Large: 500+ files, 50MB+ total (memory limit testing)

### Error Scenarios Testing

**File System Errors:**
- Permission denied (read/write)
- Storage quota exceeded
- File not found
- Directory creation failures

**ZIP Library Errors:**
- Corrupted ZIP format
- Unsupported compression methods
- Memory allocation failures
- Invalid file names/paths

**Validation Errors:**
- Malformed settings.json
- Invalid directory structure
- Missing required files
- Security violations (path traversal)

### Integration Test Scenarios

**Round-trip Workflow:**
1. Create workspace with SOURCE/ files
2. Package to EPUB (creates SOURCE.zip)
3. Unpack EPUB to new workspace  
4. Verify SOURCE/ structure matches original
5. Validate all files content matches

**EPUB Compatibility:**
- Test with EPUB 2.0 and 3.0 formats
- Validate with EpubCheck tool
- Ensure SOURCE.zip doesn't break EPUB readers
- Test manifest item handling

**Performance Benchmarks:**
- SOURCE.zip creation time vs directory size
- Memory usage during large ZIP operations  
- Browser compatibility across Chrome/Firefox/Safari
- OPFS vs IndexedDB performance comparison

### Browser Environment Testing

**Happy-DOM Limitations:**
- Skip DecompressionStream/CompressionStream tests (run in Storybook)
- Mock ZIP operations for unit tests
- Test validation and file management logic
- Use Storybook for full ZIP integration testing

**Storybook Integration Tests:**
- Real ZIP creation/extraction with browser APIs
- File upload/download workflow testing
- Visual validation of SOURCE/ directory management
- Error handling UI demonstration

## Error Handling

### SOURCE.zip Creation Errors

- **File access failures**: Report specific files that cannot be read
- **ZIP creation failures**: Fallback to individual file packaging
- **Memory constraints**: Stream processing for large directories

### SOURCE.zip Extraction Errors

- **Corrupted ZIP**: Report corruption and skip extraction
- **Invalid structure**: Validate extracted files meet SOURCE/ requirements
- **File conflicts**: Handle existing SOURCE/ files during extraction

### User Experience

- **Progress indication**: Show SOURCE.zip operations progress
- **Error messaging**: Clear explanations of SOURCE.zip issues
- **Recovery options**: Manual SOURCE/ management if needed

## Implementation Notes

### Compression Strategy

- **STORE method**: No compression for SOURCE.zip (EPUB already compresses)
- **Performance**: Avoid double compression overhead
- **Compatibility**: Standard ZIP format for maximum compatibility

### Manifest Management

- **Auto-generated ID**: Use consistent `source-zip` identifier
- **Media type**: `application/zip` for proper EPUB validation
- **Hidden from UI**: Don't show SOURCE.zip in user-facing manifest views

### Migration Strategy

- **No migration support**: Existing workspaces with `EDITME/` structure become invalid
- **Clean break**: New `SOURCE/` structure is incompatible with old `EDITME/` structure  
- **User communication**: Clear error messages when old structure detected

### Security Considerations

- **Zip bomb protection**: File size and extraction limits
- **Path traversal**: Validate extracted file paths
- **Content validation**: Ensure extracted files are safe for workspace
