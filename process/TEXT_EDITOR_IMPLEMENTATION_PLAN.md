# TEXT_EDITOR_IMPLEMENTATION_PLAN.md

## Overview

Implementation plan for the spine item text editor following the pragmatic, spike-inspired architecture defined in `PERSISTENT_IFRAME_ARCHITECTURE.md`. This editor will integrate with the existing LayoutManager pattern and support multi-file editing with real-time preview.

## Service Verification Results

### ✅ **FileStorageAPI** - Found and Complete

- **Location**: `src/lib/storage/index.ts`
- **Interface**: `FileStorageAPI` class with singleton pattern
- **Key Methods Verified**:
  - `readTextFile(workspaceId: string, path: string): Promise<string>` ✅
  - `writeTextFile(workspaceId: string, path: string, content: string): Promise<void>` ✅
  - `fileExists(workspaceId: string, path: string): Promise<boolean>` ✅
  - `getFileInfo(workspaceId: string, path: string): Promise<{size: number, lastModified: Date}>` ✅

### ✅ **WorkspaceService** - Found and Complete

- **Location**: `src/lib/services/workspace/workspace.service.ts`
- **Interface**: `WorkspaceService` class with clean service architecture
- **Constructor**: `constructor(private fileStorage: FileStorageAPI)` ✅
- **Key Methods Verified**:
  - File operations: `readFile()`, `writeFile()`, `fileExists()` ✅
  - Workspace management: `loadWorkspace()`, `saveWorkspace()` ✅

### ✅ **ExtensionManager** - Found and Complete

- **Location**: `src/lib/extensions/extension-manager.ts`
- **Interface**: `ExtensionManager` class with full API
- **Constructor**: `constructor(private fileStorage: FileStorageAPI)` ✅
- **Key Methods Verified**:
  - `listWorkspaceExtensions(workspaceId: string): Promise<ExtensionInfo[]>` ✅
  - Extension loading and caching methods ✅

### ✅ **SettingsManager** - Found and Complete

- **Location**: `src/lib/settings/` (verified via API.md)
- **Interface**: `SettingsManager` class with three-tier settings
- **Key Methods for Transform Pipeline**:
  - `loadEPUBSettings(workspaceId: string): Promise<EPUBSettings>` ✅
  - `resolveTransformScripts(workspaceId: string, settings: EPUBSettings)` ✅
  - `getAvailableTransforms(workspaceId: string): Promise<TransformOption[]>` ✅

### ✅ **BlobURLManager** - Found and Complete

- **Location**: `src/lib/blob-url/blob-url-manager.ts`
- **Interface**: `BlobURLManager` class for single-file deployment asset access
- **Constructor**: `constructor(config: BlobURLManagerConfig)` ✅
- **Key Methods for Preview Integration**:
  - `setActiveWorkspace(workspaceId: string): void` ✅
  - `processXHTMLForPreview(xhtmlContent: string): Promise<string>` ✅
  - `cleanup(): void` ✅
- **Purpose**: Converts workspace file references to blob URLs for iframe preview access

## Key Design Decisions

### 1. **Layout Integration**: LayoutManager Pattern

- **Left Pane**: Text editor components (single/dual pane with file dropdowns)
- **Right Pane**: Preview pane showing unified XHTML output
- **Follow existing LayoutManager patterns** for consistent UI/UX

### 2. **File Watching**: Through WorkspaceService

- File watching is a workspace-level concern, not a storage concern
- WorkspaceService already handles file operations and workspace structure
- Abstraction keeps file watching logic separate from storage implementation
- Allows future extension for OPF changes, manifest updates, etc.

### 3. **Iframe Assets**: Separate Source Files

- **Location**: `src/assets/iframe/`
- **Rationale**: Clean separation from inline string templates
- **Files**: `editor.html`, `editor.css`, `editor.js`
- **Approach**: Hybrid from spike - extract best patterns, create maintainable source files

### 4. **Settings Integration**: Existing SettingsManager

- EPUB settings in `SOURCE/settings.json` with `text_transform` and `dom_transforms`
- Transform discovery scans `SOURCE/scripts/` and `SOURCE/extensions/`
- Script resolution validates transform paths
- No need for custom settings loading

### 5. **Architecture**: Pragmatic Spike-Inspired

- Maintain spike's 300ms debounce and simple error handling
- Add production features: multi-file editing, service integration, file watching
- Avoid over-engineering and enterprise patterns

### 6. **Single-File Build Constraint**: BlobURLManager Integration

- **Problem**: EDITME.html runs as single file, workspace assets in OPFS/IndexedDB can't be accessed via normal paths
- **Solution**: Auto-save workflow + BlobURLManager converts asset references to blob URLs
- **Workflow**: User edits → Auto-save → Transform → Blob URL processing → Preview
- **Benefits**: Editor works correctly in all deployment methods (web app, standalone file, embedded EPUB)

## Implementation Phases

### Phase 1: Create Iframe Assets

- **Location**: `src/assets/iframe/`
- **Files**:
  - `editor.html` - Main iframe template (hybrid from spike)
  - `editor.css` - Iframe styling
  - `editor.js` - Transform execution and messaging
- **Approach**: Extract best patterns from spike, create clean source files

### Phase 2: Core Type Definitions

- **Location**: `src/lib/types/spine-editor.ts`
- **Missing Types**:
  - `TransformResult` - success/error states with XHTML output
  - `TransformScripts` - text/DOM transform script content
  - `TransformError` - stage, message, line info
  - `ChapterMetadata` - title, language, stylesheets, scripts

### Phase 2.5: XHTML Persistence & BlobURLManager Integration

- **PreviewManager Constructor**: Add BlobURLManager and WorkspaceService dependencies
- **Auto-Save Workflow**: Implement `autoSaveChangedContent()` method
- **XHTML Persistence**: Implement `saveXHTMLToManifest()` method to save spine item content
- **Blob URL Processing**: Use `blobURLManager.processXHTMLForPreview()` in renderPreview()
- **Resource Management**: Add cleanup() method for blob URL cleanup
- **Component Integration**: Update Svelte component props to include both services

### Phase 3: Service Integration Layer

- **Service Integration**: Verify all services work together correctly
- **Error Handling**: Implement proper error boundaries and user feedback

### Phase 4: Transform Pipeline Implementation

- **TransformPipeline class**: Load iframe assets, execute transforms, handle messaging
- **PreviewManager class**: Coordinate real-time updates with 300ms debounce
- **Settings Integration**: Use existing SettingsManager for `SOURCE/settings.json`

### Phase 5: LayoutManager Integration

- **Editor Components**: Single/dual pane editor with file dropdowns
- **Preview Component**: Unified XHTML preview combining all file types
- **Real-time Updates**: Direct editor changes trigger immediate re-rendering
- **Error Display**: Clear error panels matching spike approach

## Technical Specifications

### Transform Pipeline Flow

1. **Load Settings**: Use `SettingsManager.loadEPUBSettings()` for transform configuration
2. **Load Extensions**: Use `ExtensionManager.listWorkspaceExtensions()` for available scripts
3. **Auto-Save Content**: Save changed text/CSS/JS files to storage before preview
4. **Execute Pipeline**: Text transform → DOM transforms → XHTML generation
5. **Save XHTML to Manifest**: Persist generated XHTML as spine item content (`OEBPS/Text/*.xhtml`)
6. **Blob URL Processing**: Use `BlobURLManager.processXHTMLForPreview()` to convert asset references
7. **Error Handling**: Simple, clear error messages without complex recovery

### Single-File Deployment Workflow

1. **User Edits Content** → Auto-save to FileStorageAPI (OPFS/IndexedDB)
2. **Transform Pipeline Executes** → Generates XHTML with relative asset references
3. **XHTML Saved to Manifest** → Becomes spine item's actual content in EPUB structure
4. **BlobURLManager Processes XHTML** → Converts asset references to blob URLs for preview
5. **Preview Iframe Receives Processed XHTML** → Can access assets via blob URLs

**Key Point**: The generated XHTML is the actual spine item content that will be packaged in the final EPUB, not just preview content.

### File Structure

```
src/
├── assets/iframe/                    # Iframe source files
│   ├── editor.html                   # Main iframe template
│   ├── editor.css                    # Iframe styling
│   └── editor.js                     # Transform execution logic
├── lib/
│   ├── types/spine-editor.ts        # Missing type definitions
│   ├── transform/                   # Transform pipeline classes
│   │   ├── transform-pipeline.ts    # Core transform execution
│   │   └── preview-manager.ts       # Real-time preview coordination
│   ├── services/workspace/          # Enhanced workspace service
│   │   └── workspace.service.ts     # Add file watching method
│   └── components/spine-editor/     # LayoutManager integration
│       ├── SpineEditorPane.svelte   # Left pane editor
│       └── SpinePreviewPane.svelte  # Right pane preview
```

### Message Protocol (Iframe ↔ Parent)

```typescript
// Parent → Iframe
interface EditorMessage {
  type: 'SET_CONTENT' | 'SET_MODE' | 'EXECUTE_TRANSFORM';
  payload: {
    content?: string;
    mode?: 'text' | 'css' | 'javascript' | 'transform';
    plainText?: string;
    textTransform?: string;
    domTransforms?: string[];
  };
}

// Iframe → Parent
interface EditorResponse {
  type: 'CONTENT_CHANGE' | 'TRANSFORM_RESULT';
  payload: {
    content?: string;
    result?: TransformResult;
  };
}
```

### File Types Supported

- **Text Content**: `SOURCE/text/*.txt` - Plain text source files
- **CSS Stylesheets**: `OEBPS/Styles/*.css` - Styling for XHTML output
- **JavaScript**: `OEBPS/Scripts/*.js` - Interactive functionality
- **Transform Scripts**: `SOURCE/scripts/*.js` - Text and DOM transformation

### Real-Time Preview

- **Debounce**: 300ms for all content changes (matching spike performance)
- **Unified Output**: Single XHTML preview combining all file types
- **Error Display**: Inline error panels when transforms fail
- **Direct Updates**: Editor changes trigger immediate re-rendering

## Testing Strategy

Balanced approach: **unit tests for high-value business logic**, **Storybook for happy path integration demos**.

### Unit Tests (Simple & High-Value Only)

#### 1. **TransformPipeline** - Core Business Logic

```typescript
// src/lib/transform/transform-pipeline.test.ts
describe('TransformPipeline', () => {
  it('executes text transform successfully');
  it('executes DOM transforms in sequence');
  it('handles script syntax errors gracefully');
  it('respects 3-second timeout');
  it('loads transform scripts from settings');
});
```

#### 2. **PreviewManager** - Debounce & Coordination

```typescript
// src/lib/transform/preview-manager.test.ts
describe('PreviewManager', () => {
  it('debounces content changes (300ms)');
  it('combines multi-file content into XHTML');
  it('resolves transform scripts from settings');
  it('auto-saves content before preview processing');
  it('saves generated XHTML to manifest as spine item content');
  it('processes XHTML through BlobURLManager for preview');
  it('cleans up blob URLs on destruction');
});
```

#### 3. **BlobURLManager** - Integration Scenarios

```typescript
// src/lib/blob-url/blob-url-manager.test.ts (add to existing)
describe('BlobURLManager integration', () => {
  it('processes XHTML with CSS and JS references');
  it('creates blob URLs for workspace assets');
  it('handles missing assets gracefully');
  it('cleans up blob URLs on workspace change');
  it('respects blob URL capacity limits');
});
```

**Unit Test Approach**:

- Mock iframe communication with simple `postMessage` stubs
- Mock all service dependencies (FileStorageAPI, SettingsManager, BlobURLManager, etc.)
- Focus on business logic, not implementation details
- Cut corners on edge cases - just happy path + basic error handling
- Use existing shared mocks where available (`src/lib/test/mocks/`)

### Storybook Stories (Happy Path Demos Only)

#### 1. **SpineEditorPane** - Basic Editor UI

```typescript
// SpineEditorPane.stories.svelte
export const SinglePane = {}; // One editor, file dropdown, sample content
export const DualPane = {}; // Two editors, different file types
```

#### 2. **SpineItemEditor** - Full Integration

```typescript
// SpineItemEditor.stories.svelte
export const TextEditing = {}; // Text file with live preview
export const CSSEditing = {}; // CSS file with styled preview
export const FullWorkflow = {}; // Text + CSS editing together
export const AssetIntegration = {}; // CSS/JS files with blob URL asset references
```

**Storybook Approach**:

- Use simple mock data, not complex backend simulation
- Show working transform examples (markdown → HTML)
- Focus on visual behavior and user interaction
- Skip error scenarios - keep it clean and demo-ready
- Demonstrate blob URL asset loading in preview iframe
- Show auto-save workflow in action

## Ready for Implementation

All prerequisites have been verified:

- ✅ Service interfaces exist and are complete (including BlobURLManager)
- ✅ Architecture decisions finalized (including single-file deployment support)
- ✅ Integration patterns established (including blob URL workflow)
- ✅ File structure planned
- ✅ Technical specifications defined (including auto-save and blob URL processing)
- ✅ Testing strategy defined (including BlobURLManager integration tests)

**Next Steps**: Begin Phase 1 implementation with iframe assets creation.
