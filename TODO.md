# SOURCE.zip Implementation TODO

This document provides a focused implementation roadmap for SOURCE.zip functionality. For detailed specifications, see the corresponding feature files in `plans/features/`.

## Overview

The codebase has strong foundations with comprehensive EPUB handling, file storage, and workspace management already implemented. The main work involves:

1. **Bridging existing EPUB workflows** with SOURCE.zip concept → [Feature 23](plans/features/23_source_zip.md)
2. **Implementing transform pipeline** (currently unbuilt) → [Feature 12](plans/features/12_transform_pipeline.md)
3. **Modifying existing features** to handle SOURCE/ directory structure

## Implementation Status

### ✅ Already Implemented (Strong Foundation)
- **Workspace Manager** - Complete with OPF, manifest, spine management
- **EPUB Packaging/Unpacking** - Full ZIP handling with compression streams
- **File Storage API** - OPFS with IndexedDB fallback
- **OPF Utilities** - Complete XML parsing and generation
- **Dependency Tracker** - File reference validation and analysis

### ❌ Missing (Needs Implementation)
- **Transform Pipeline** - Script execution engine → [Feature 12](plans/features/12_transform_pipeline.md)
- **SOURCE.zip Management** - Creation/extraction workflows → [Feature 23](plans/features/23_source_zip.md)
- **Extension System** - Dynamic script loading from SOURCE/
- **Navigation Editor** - Simplified text-based TOC editing → [Feature 17](plans/features/17_navigation_editor.md)
- **Audio Clip Editor** - Directive-based audio clip handling → [Feature 18](plans/features/18_audio_clip_editor.md)

## Phase 1: Core SOURCE.zip Integration (High Priority)

### 1.1 Create SOURCE Manager (New)
**Location**: `src/lib/source/`

**Files to Create**:
```
src/lib/source/
├── index.ts              # Main exports
├── source-manager.ts     # SourceManager class
├── types.ts             # SOURCE-related types
└── source-utils.ts      # Helper utilities
```

**Key Methods**:
```typescript
class SourceManager {
  async createSourceZip(workspaceId: string): Promise<void>
  async extractSourceZip(workspaceId: string): Promise<void>
  async hasSourceFiles(workspaceId: string): Promise<boolean>
  async validateSourceStructure(workspaceId: string): Promise<SourceValidation>
}
```

### 1.2 Modify Workspace Manager (Existing)
**File**: `src/lib/workspace/workspace-manager.ts`

**Changes Required**:

#### Method: `createEPUBStructure()` (Lines 703-735)
```typescript
// CURRENT: Creates basic EPUB structure
// CHANGE TO: Create SOURCE/ directory with default content

async createEPUBStructure(workspaceId: string, metadata: Metadata): Promise<void> {
  // ... existing EPUB structure creation ...
  
  // ADD: Create SOURCE/ directory structure
  await this.fileStorage.writeFile(workspaceId, 'SOURCE/settings.json', 
    JSON.stringify(defaultSettings, null, 2));
  await this.fileStorage.writeFile(workspaceId, 'SOURCE/text/.gitkeep', '');
  await this.fileStorage.writeFile(workspaceId, 'SOURCE/scripts/.gitkeep', '');
  await this.fileStorage.writeFile(workspaceId, 'SOURCE/extensions/.gitkeep', '');
}
```

#### Method: `validateWorkspaceStructure()` (Lines 413-557)
```typescript
// CURRENT: Checks for orphaned files including EDITME/
// CHANGE TO: Exclude SOURCE/ files from orphan detection

// ADD: Special handling for SOURCE/ files
const sourceFiles = allFiles.filter(f => f.startsWith('SOURCE/'));
const epubFiles = allFiles.filter(f => !f.startsWith('SOURCE/'));

// Validate EPUB files normally
const orphanedFiles = epubFiles.filter(file => /* existing logic */);

// Validate SOURCE/ separately if present
if (sourceFiles.length > 0) {
  const sourceValidation = await this.sourceManager.validateSourceStructure(workspaceId);
  // Include source validation in results
}
```

#### Method: `resolveManifestPath()` (Lines 675-683)
```typescript
// CURRENT: Resolves file paths for manifest items
// CHANGE TO: Handle SOURCE.zip special case

resolveManifestPath(workspaceId: string, href: string): string {
  // ADD: Special handling for SOURCE.zip
  if (href === 'SOURCE.zip') {
    return null; // SOURCE.zip is manifest item but not direct file
  }
  
  // ... existing logic ...
}
```

### 1.3 Modify EPUB Packager (Existing)
**File**: `src/lib/epub/EPUBPackager.ts`

**Changes Required**:

#### Method: `readWorkspaceFiles()` (Lines 146-167)
```typescript
// CURRENT: Reads all workspace files directly
// CHANGE TO: Create SOURCE.zip if SOURCE/ directory exists

async readWorkspaceFiles(workspaceId: string): Promise<WorkspaceFile[]> {
  const allFiles = await this.fileStorage.listFiles(workspaceId);
  
  // Separate SOURCE/ files from EPUB files
  const sourceFiles = allFiles.filter(f => f.startsWith('SOURCE/'));
  const epubFiles = allFiles.filter(f => !f.startsWith('SOURCE/'));
  
  const workspaceFiles: WorkspaceFile[] = [];
  
  // Process EPUB files normally
  for (const filePath of epubFiles) {
    // ... existing logic ...
  }
  
  // CREATE SOURCE.zip if SOURCE/ files exist
  if (sourceFiles.length > 0) {
    await this.sourceManager.createSourceZip(workspaceId);
    
    // Add SOURCE.zip as workspace file
    const sourceZipContent = await this.fileStorage.readFile(workspaceId, 'SOURCE.zip');
    workspaceFiles.push({
      path: 'SOURCE.zip',
      content: sourceZipContent
    });
  }
  
  return workspaceFiles;
}
```

### 1.4 Modify EPUB Unpacker (Existing)
**File**: `src/lib/epub/EPUBUnpacker.ts`

**Changes Required**:

#### Method: `extractToWorkspace()` (Lines 225-278)
```typescript
// CURRENT: Extracts all files directly to workspace
// CHANGE TO: Detect and extract SOURCE.zip separately

async extractToWorkspace(zip: Zip, workspaceId: string): Promise<ExtractionResult> {
  // ... existing extraction logic ...
  
  // AFTER extraction, check for SOURCE.zip
  const sourceZipEntry = zip.entries.find(e => e.filename === 'SOURCE.zip');
  if (sourceZipEntry) {
    // Extract SOURCE.zip to workspace temporarily
    const sourceZipContent = await sourceZipEntry.extractAsArrayBuffer();
    await this.fileStorage.writeFile(workspaceId, 'SOURCE.zip', sourceZipContent);
    
    // Extract SOURCE.zip contents to SOURCE/ directory
    await this.sourceManager.extractSourceZip(workspaceId);
    
    // Remove SOURCE.zip file (keep as manifest item only)
    await this.fileStorage.deleteFile(workspaceId, 'SOURCE.zip');
  }
  
  return result;
}
```

## Phase 2: Transform Pipeline Implementation (New Feature)

**Implementation Details**: See [Feature 12 - Transform Pipeline](plans/features/12_transform_pipeline.md)

**Key Components**:
- Transform Pipeline execution engine (`src/lib/transform/`)
- Settings Manager for SOURCE/settings.json
- Script loader for dynamic extensions
- Sandboxed script execution environment

**Dependencies**: Blob URL Manager for loading transform scripts

## Phase 3: Content Editing Features

### 3.1 Navigation Editor Implementation
**Implementation Details**: See [Feature 17 - Navigation Editor](plans/features/17_navigation_editor.md)

**Key Approach**: 
- Text-based editing leveraging existing spine editor functionality
- Auto-generation from chapter H1 headings
- Support for advanced directives
- Location: `src/lib/navigation/`

### 3.2 Audio Clip Editor Implementation  
**Implementation Details**: See [Feature 18 - Audio Clip Editor](plans/features/18_audio_clip_editor.md)

**Key Approach**:
- Simplified directive-based output (no waveform visualization)
- Timestamp selection and playback rate control
- Generate `:clip` markdown-style directives
- Location: `src/lib/audio/`

### 3.3 Update Dependency Tracker (Existing)
**File**: `src/lib/workspace/dependency-tracker.ts`

**Add New Method**:
```typescript
async findSourceDependencies(workspaceId: string): Promise<SourceDependencies> {
  // Analyze SOURCE/scripts/ and SOURCE/extensions/ for dependencies
  // Check transform script references in settings.json
  // Return dependency tree for SOURCE/ files
}
```

### 3.4 Create Integration Layer (New)
**File**: `src/lib/workspace/source-integration.ts`
**Purpose**: Bridge workspace manager with SOURCE.zip functionality

### 3.5 Update Type Definitions
**Files**: Various `types.ts` files  
**Purpose**: Add SOURCE-related interfaces and transform settings types

## Phase 4: Future Features (New)

### 4.1 Internationalization 
**Status**: Planning phase → [Feature 27](plans/features/27_internationalisation.md)
**Priority**: Medium

### 4.2 First Run Experience
**Status**: Planning phase → [Feature 28](plans/features/28_first_run.md)
**Priority**: Medium

### 4.3 Application Version Management
**Status**: Planning phase → [Feature 29](plans/features/29_app_version.md)
**Priority**: Low

## Testing Strategy

### Phase 1 Testing
- [ ] SOURCE.zip creation from SOURCE/ directory
- [ ] SOURCE.zip extraction to SOURCE/ directory  
- [ ] Workspace validation with SOURCE/ files
- [ ] EPUB packaging with SOURCE.zip
- [ ] EPUB unpacking with SOURCE.zip detection

### Phase 2 Testing
- [ ] Transform pipeline script loading
- [ ] Settings.json parsing and validation
- [ ] Dynamic script execution
- [ ] Text and DOM transforms

### Phase 3 Testing
- [ ] Navigation Editor text-based editing → [Feature 17](plans/features/17_navigation_editor.md)
- [ ] Audio Clip Editor directive generation → [Feature 18](plans/features/18_audio_clip_editor.md)
- [ ] Content editing features integration testing

### Phase 4 Testing
- [ ] Future features integration → [Features 27-29](plans/features/)

### Phase 5 Integration Testing
- [ ] End-to-end SOURCE.zip workflows
- [ ] Integration between all components
- [ ] Performance testing with large SOURCE/ directories
- [ ] Error handling and recovery scenarios

## Implementation Dependencies

### Critical Path:
1. **SourceManager** → **Workspace Manager modifications** → **EPUB Pack/Unpack updates**
2. **Transform Pipeline** → **Settings Manager** → **Content Editing Features**
3. **Navigation/Audio Editors** → **Future Features** → **Integration testing**

### Parallel Development:
- SOURCE.zip core functionality (Phase 1)
- Transform pipeline implementation (Phase 2) 
- Content editing features (Phase 3)
- Future features planning (Phase 4)
- Type definitions and integration helpers (Phase 5)

## File Modification Summary

### **High Priority Changes** (Existing Files):
- `src/lib/workspace/workspace-manager.ts` - 3 methods, ~50 lines
- `src/lib/epub/EPUBPackager.ts` - 1 method, ~30 lines
- `src/lib/epub/EPUBUnpacker.ts` - 1 method, ~20 lines

### **New Implementations** (New Files):
- `src/lib/source/` - Complete new module (~300 lines)
- `src/lib/transform/` - Complete new module (~500 lines)
- `src/lib/navigation/` - Navigation editor module (~200 lines)
- `src/lib/audio/` - Audio clip editor module (~300 lines)
- Integration helpers and type definitions (~150 lines)

### **Supporting Changes** (Existing Files):
- `src/lib/workspace/dependency-tracker.ts` - 1 new method
- Various type definition updates

## Next Steps (Updated Based on Recent Changes)

### **Immediate Priority (Phase 1-2)**:
1. **Start with SourceManager implementation** - Foundation for all SOURCE.zip operations
2. **Modify workspace creation** - Update to create SOURCE/ structure
3. **Update EPUB workflows** - Package/unpack SOURCE.zip integration
4. **Implement transform pipeline** - Script execution and settings management

### **Content Features (Phase 3)**:
5. **Navigation Editor** - Text-based approach leveraging existing spine editor patterns
6. **Audio Clip Editor** - Simplified directive-based output, no waveform complexity

### **Future Planning (Phase 4)**:
7. **Feature specification** - Complete planning for internationalization, first-run, version management
8. **Integration testing** - End-to-end workflow validation

## Key Implementation Notes

- **Navigation Editor**: Simplified from complex UI to text-based approach using existing transform pipeline
- **Audio Clip Editor**: Removed waveform visualization complexity, focus on directive generation
- **Three new features**: Require detailed specification before implementation
- **Codebase foundation**: Strong existing patterns, most work involves extension rather than rewriting