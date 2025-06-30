# SOURCE.zip Management API Documentation

## Overview

The SOURCE.zip management system consolidates workspace `SOURCE/` directory files into a single `SOURCE.zip` manifest item during EPUB packaging, maintaining clean EPUB structure while preserving individual SOURCE files for editing.

**Main Classes:**

- `SourceManager` - Core SOURCE.zip creation, extraction, and validation
- Integration points with `EPUBPackager`, `EPUBUnpacker`, and `WorkspaceManager`

## Core Files

- **`source-manager.ts`** - Main SourceManager class with all SOURCE.zip operations
- **`source-utils.ts`** - Helper utilities for file classification and validation
- **`types.ts`** - Complete TypeScript interfaces and type definitions
- **`index.ts`** - Clean API exports

## Key Features

- Browser-native ZIP operations using existing ZIP library
- Automatic SOURCE/ directory structure initialization
- SOURCE.zip creation with STORE compression (no double compression)
- Round-trip packaging/unpacking with validation
- File type classification and statistics
- Integration with existing File Storage API and EPUB workflows

## Class Documentation

### SourceManager

#### constructor()

```typescript
constructor(private fileStorage: FileStorageAPI)
```

**Input:**
- `fileStorage: FileStorageAPI` - File storage instance for workspace operations

**Output:** `SourceManager` - SOURCE.zip manager instance

**Side Effects:** None (dependencies are stored for later use)

**Usage:**

```typescript
import { FileStorageAPI } from '$lib/storage';
import { SourceManager } from '$lib/source';

const storage = new FileStorageAPI();
const sourceManager = new SourceManager(storage);
```

#### createSourceZip()

```typescript
async createSourceZip(workspaceId: string): Promise<Blob | null>
```

**Input:**
- `workspaceId: string` - Workspace identifier containing SOURCE/ directory

**Output:** `Promise<Blob | null>` - SOURCE.zip blob, or null if no SOURCE/ files exist

**Side Effects:** None (read-only operation)

**Usage:**

```typescript
const sourceZip = await sourceManager.createSourceZip('workspace-123');
if (sourceZip) {
  console.log('SOURCE.zip created:', sourceZip.size, 'bytes');
} else {
  console.log('No SOURCE/ files found');
}
```

#### extractSourceZip()

```typescript
async extractSourceZip(workspaceId: string, sourceZipBlob: Blob): Promise<void>
```

**Input:**
- `workspaceId: string` - Target workspace for extraction
- `sourceZipBlob: Blob` - SOURCE.zip content to extract

**Output:** `Promise<void>` - Resolves when extraction completes

**Side Effects:** 
- Creates SOURCE/ directory structure in workspace
- Writes all extracted files to workspace storage
- Overwrites existing SOURCE/ files

**Usage:**

```typescript
await sourceManager.extractSourceZip('workspace-123', sourceZipBlob);
console.log('SOURCE.zip extracted to workspace');
```

#### hasSourceFiles()

```typescript
async hasSourceFiles(workspaceId: string): Promise<boolean>
```

**Input:**
- `workspaceId: string` - Workspace to check for SOURCE/ files

**Output:** `Promise<boolean>` - True if SOURCE/ directory contains files

**Side Effects:** None (read-only operation)

**Usage:**

```typescript
const hasSource = await sourceManager.hasSourceFiles('workspace-123');
if (hasSource) {
  console.log('Workspace has SOURCE/ files');
}
```

#### listSourceFiles()

```typescript
async listSourceFiles(workspaceId: string): Promise<SourceFileInfo[]>
```

**Input:**
- `workspaceId: string` - Workspace to enumerate SOURCE/ files

**Output:** `Promise<SourceFileInfo[]>` - Array of SOURCE/ file information

**Side Effects:** None (read-only operation)

**Usage:**

```typescript
const sourceFiles = await sourceManager.listSourceFiles('workspace-123');
for (const file of sourceFiles) {
  console.log(`${file.path} (${file.type}): ${file.size} bytes`);
}
```

#### initializeSourceStructure()

```typescript
async initializeSourceStructure(workspaceId: string): Promise<void>
```

**Input:**
- `workspaceId: string` - Workspace to initialize SOURCE/ structure

**Output:** `Promise<void>` - Resolves when structure is created

**Side Effects:**
- Creates `SOURCE/settings.json` with default content
- Creates empty directories: `SOURCE/text/`, `SOURCE/scripts/`, `SOURCE/extensions/`
- Writes `.gitkeep` files to maintain directory structure

**Usage:**

```typescript
await sourceManager.initializeSourceStructure('workspace-123');
console.log('SOURCE/ structure initialized');
```

#### validateSourceStructure()

```typescript
async validateSourceStructure(workspaceId: string): Promise<SourceValidation>
```

**Input:**
- `workspaceId: string` - Workspace to validate SOURCE/ structure

**Output:** `Promise<SourceValidation>` - Validation results with errors/warnings

**Side Effects:** None (read-only operation)

**Usage:**

```typescript
const validation = await sourceManager.validateSourceStructure('workspace-123');
if (!validation.isValid) {
  console.error('SOURCE/ validation errors:', validation.errors);
}
console.log(`Found ${validation.fileCount} files, ${validation.totalSize} bytes`);
```

#### getSourceDirectoryStats()

```typescript
async getSourceDirectoryStats(workspaceId: string): Promise<SourceStats>
```

**Input:**
- `workspaceId: string` - Workspace to analyze SOURCE/ statistics

**Output:** `Promise<SourceStats>` - Detailed statistics about SOURCE/ directory

**Side Effects:** None (read-only operation)

**Usage:**

```typescript
const stats = await sourceManager.getSourceDirectoryStats('workspace-123');
console.log(`Total: ${stats.totalFiles} files`);
console.log(`Text sources: ${stats.directories.text}`);
console.log(`Scripts: ${stats.directories.scripts}`);
console.log(`Extensions: ${stats.directories.extensions}`);
```

## Type Definitions

```typescript
interface SourceFileInfo {
  path: string;                    // Relative path within SOURCE/
  size: number;                    // File size in bytes
  type: 'settings' | 'text' | 'script' | 'extension' | 'other';
  lastModified?: Date;             // Last modification time (if available)
}

interface SourceValidation {
  isValid: boolean;                // Overall validation status
  errors: string[];                // Critical errors that prevent functionality
  warnings: string[];              // Non-critical issues
  fileCount: number;               // Total number of SOURCE/ files
  totalSize: number;               // Total size of SOURCE/ directory in bytes
  hasSettings: boolean;            // Whether settings.json exists
}

interface SourceStats {
  totalFiles: number;              // Total file count
  totalSize: number;               // Total size in bytes
  directories: {
    text: number;                  // Files in SOURCE/text/
    scripts: number;               // Files in SOURCE/scripts/
    extensions: number;            // Files in SOURCE/extensions/
  };
  hasSettingsFile: boolean;        // Whether settings.json exists
}
```

## Common Integration Patterns

### EPUB Packaging with SOURCE.zip

```typescript
import { SourceManager } from '$lib/source';
import { EPUBPackager } from '$lib/epub';
import { FileStorageAPI } from '$lib/storage';

// Package workspace to EPUB with SOURCE.zip
async function packageEPUBWithSource(workspaceId: string) {
  const storage = new FileStorageAPI();
  const sourceManager = new SourceManager(storage);
  const packager = new EPUBPackager(storage);

  // Check if workspace has SOURCE/ files
  if (await sourceManager.hasSourceFiles(workspaceId)) {
    console.log('Including SOURCE.zip in EPUB package');
  }

  // Package normally - EPUBPackager handles SOURCE.zip automatically
  const result = await packager.packageWorkspace(workspaceId);
  return result.epubBlob;
}
```

### EPUB Unpacking with SOURCE.zip

```typescript
import { SourceManager } from '$lib/source';
import { EPUBUnpacker } from '$lib/epub';
import { Zip } from '$lib/zip';

// Unpack EPUB with SOURCE.zip extraction
async function unpackEPUBWithSource(epubBuffer: ArrayBuffer, workspaceId: string) {
  const zip = new Zip(epubBuffer);
  const storage = new FileStorageAPI();
  const sourceManager = new SourceManager(storage);
  const unpacker = new EPUBUnpacker(storage);

  // Unpack normally - EPUBUnpacker handles SOURCE.zip automatically
  const result = await unpacker.extractToWorkspace(zip, workspaceId);

  // Validate SOURCE/ structure if it was extracted
  if (await sourceManager.hasSourceFiles(workspaceId)) {
    const validation = await sourceManager.validateSourceStructure(workspaceId);
    console.log('SOURCE/ validation:', validation);
  }

  return result;
}
```

### New Workspace Creation

```typescript
import { SourceManager } from '$lib/source';
import { WorkspaceManager } from '$lib/workspace';

// Create new workspace with SOURCE/ structure
async function createWorkspaceWithSource(metadata: EPUBMetadata) {
  const storage = new FileStorageAPI();
  const sourceManager = new SourceManager(storage);
  const workspaceManager = new WorkspaceManager(storage);

  // Create workspace with EPUB structure
  const workspaceId = await workspaceManager.createWorkspace(metadata);

  // Initialize SOURCE/ structure
  await sourceManager.initializeSourceStructure(workspaceId);

  // Verify initialization
  const validation = await sourceManager.validateSourceStructure(workspaceId);
  if (!validation.isValid) {
    throw new Error(`SOURCE/ initialization failed: ${validation.errors.join(', ')}`);
  }

  return workspaceId;
}
```

### SOURCE/ Directory Management

```typescript
import { SourceManager } from '$lib/source';

// Manage SOURCE/ directory contents
async function manageSourceDirectory(workspaceId: string) {
  const storage = new FileStorageAPI();
  const sourceManager = new SourceManager(storage);

  // Get current statistics
  const stats = await sourceManager.getSourceDirectoryStats(workspaceId);
  console.log('Current SOURCE/ stats:', stats);

  // List all SOURCE/ files
  const files = await sourceManager.listSourceFiles(workspaceId);
  
  // Group files by type
  const textFiles = files.filter(f => f.type === 'text');
  const scriptFiles = files.filter(f => f.type === 'script');
  const extensionFiles = files.filter(f => f.type === 'extension');

  console.log(`Text sources: ${textFiles.length}`);
  console.log(`Scripts: ${scriptFiles.length}`);
  console.log(`Extensions: ${extensionFiles.length}`);

  // Validate structure
  const validation = await sourceManager.validateSourceStructure(workspaceId);
  if (validation.warnings.length > 0) {
    console.warn('SOURCE/ warnings:', validation.warnings);
  }
}
```

## Error Handling

The SourceManager uses specific error types for different failure scenarios:

```typescript
try {
  const sourceZip = await sourceManager.createSourceZip(workspaceId);
} catch (error) {
  if (error.message.includes('No SOURCE directory found')) {
    // Handle missing SOURCE/ directory
  } else if (error.message.includes('Failed to read file')) {
    // Handle file access errors
  } else if (error.message.includes('ZIP creation failed')) {
    // Handle ZIP library errors
  } else {
    // Handle other errors
  }
}
```

Common error scenarios:

- **Missing SOURCE/ directory** - No SOURCE/ files to package
- **File access errors** - Permission or storage failures
- **ZIP creation failures** - ZIP library or memory errors
- **Invalid file structure** - Corrupted or malformed SOURCE/ content
- **Validation failures** - SOURCE/ structure doesn't meet requirements

## Testing

**Comprehensive unit tests** covering all SourceManager methods:

- Mock File Storage API integration
- Round-trip SOURCE.zip creation and extraction
- Edge cases: empty directories, large files, corrupted ZIPs
- Error handling and validation scenarios
- Integration with EPUB packaging/unpacking workflows

Run tests with: `npm test src/lib/source`

## Performance Notes

- **Memory efficiency**: Simple in-memory operations for SOURCE/ files
- **No streaming**: Relies on browser memory limits for simplicity
- **STORE compression**: No compression for SOURCE.zip (EPUB already compresses)
- **File classification**: Automatic type detection based on path and content
- **Validation caching**: Validation results can be cached for performance

## Integration Notes

- **File Storage API**: Seamless integration with OPFS/IndexedDB backends
- **ZIP Library**: Uses existing `ZipWriter` and `Zip` classes
- **EPUB Workflows**: Automatic SOURCE.zip handling in packaging/unpacking
- **Workspace Management**: SOURCE/ structure initialization and validation
- **Transform Pipeline**: Ready for settings.json and script file management