# Outline UI Design Document

## Overview & Objectives

The Outline UI provides simple EPUB table of contents editing through a streamlined split-pane interface. This first-pass implementation focuses on the essential workflow: auto-generation when empty, manual editing with transform pipeline integration, and live preview.

### High-Level Description

The Outline UI consists of a simple split-pane editor interface:

1. **Text Editor**: Plain text editor for outline source content
2. **Auto-Generation**: Automatic TOC creation when editor is empty
3. **Manual Editing**: Plain text editing with transform pipeline integration
4. **Live Preview**: Real-time XHTML navigation rendering

### Core Functionality

The outline editor provides essential EPUB navigation management:

- **Auto-Generation**: Automatic TOC creation from spine items when editor is empty
- **Manual Editing**: Plain text editing with existing transform pipeline
- **Split-Pane Interface**: Side-by-side editing and preview using LayoutManager
- **Live Updates**: Real-time preview updates with debounced changes
- **Transform Integration**: Uses existing transform pipeline for content processing

### Design Principles

Based on the existing EDITME design patterns:

- **Simplicity First**: Minimal interface focused on essential outline editing
- **Auto-Generation by Default**: Empty editor triggers automatic TOC creation
- **Transform Pipeline Integration**: Reuses existing content processing infrastructure
- **LayoutManager Consistency**: Uses established split-pane patterns
- **Reusable Components**: Preview component designed for future reuse

## Component Architecture

### Integration with Existing Layout System

The Outline UI leverages the established `LayoutManager.svelte` pattern with its built-in PaneForge split-pane system, ensuring consistency with other editing interfaces in EDITME.

### Primary Components

1. **OutlineView** (Coordination component)
   - Manages outline editing state and persistence
   - Coordinates with workspace APIs directly (no manager layer)
   - Handles auto-generation when editor is empty
   - Integrates with LayoutManager slots

2. **OutlineEditor** (Source editor component)
   - Simple textarea for outline source content
   - Auto-generation trigger when empty
   - Transform pipeline integration for user content
   - Basic editing features only

3. **OutlineGenerator** (Utility service)
   - Static methods for spine analysis and TOC generation
   - Simple generation algorithms from spine items
   - **Transform Pipeline Integration**: Uses existing `TransformPipeline` class for user content processing
   - **Navigation-specific transforms**: Processes `nav.txt` through text/DOM transform scripts
   - **XHTML Generation**: Uses `generateXHTMLDocument()` for EPUB navigation format
   - No persistent state management

4. **NavigationPreview** (Reusable preview component)
   - **Location**: `src/lib/components/preview/NavigationPreview.svelte`
   - **Input**: Complete XHTML navigation documents
   - **Display**: Renders content in iframe like other preview components
   - **Reusable**: Designed for use across different features
   - **EPUB-compliant**: Displays final navigation output

## Key Design Questions

### 1. Interface Architecture ✅ **RESOLVED**

**Decision:** Integration with existing LayoutManager split-pane system rather than custom split-pane interface.

**Rationale:** Ensures consistency with other editing interfaces and leverages established PaneForge infrastructure.

**Implementation:**

- **LayoutManager Integration**: Uses existing `left-content` and `right-content` slots only
- **Left Pane**: OutlineEditor (simple textarea) in `left-content` slot
- **Right Pane**: NavigationPreview in `right-content` slot
- **No Sidebar**: No outline-specific sidebar needed
- **Minimal Headers**: Simple left header only
- **Consistent Behavior**: Standard LayoutManager split-pane patterns

### 2. Auto-Generation Strategy ✅ **RESOLVED**

**Decision:** Automatic generation when editor is empty, manual editing with transform pipeline.

**Implementation:**

- **Empty Editor Trigger**: Auto-generation activates when textarea has no content
- **Spine-Based Generation**: Simple TOC creation from spine item structure
- **Transform Pipeline**: User-entered content processed through existing transform system
- **No Configuration**: First-pass keeps generation simple with sensible defaults

### 3. Editing Approach ✅ **RESOLVED**

**Decision:** Simple state-based editing with automatic behavior switching.

**Editing Behavior:**

- **Empty State**: Automatically shows generated navigation content
- **User Input**: Any typing switches to manual mode with transform processing
- **Single Mode**: No mode toggle needed - behavior is automatic
- **Transform Integration**: User content goes through existing text/DOM transforms

## Final Design Specification

### Layout Design - Simplified LayoutManager Integration

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  ┌─────────────────┐ ┌─────────────────────────────────┐ │
│   Standard       │ Left Header     │ │ Right Header                    │ │
│   Sidebar        │ [Outline Editor]│ │ [Navigation Preview]            │ │
│   (any section)  ├─────────────────┤ ├─────────────────────────────────┤ │
│                  │ Text Editor     │ │ Navigation Preview              │ │
│                  │                 │ │                                 │ │
│                  │ (empty = auto-  │ │ ┌─────────────────────────────┐ │ │
│                  │  generate TOC)  │ │ │ Table of Contents           │ │ │
│                  │                 │ │ │                             │ │ │
│                  │ Chapter 1       │ │ │ 1. Chapter 1                │ │ │
│                  │ Chapter 2       │ │ │ 2. Chapter 2                │ │ │
│                  │                 │ │ │ 3. Chapter 3                │ │ │
│                  │ (user types =   │ │ │                             │ │ │
│                  │  transform      │ │ │ [EPUB navigation rendering] │ │ │
│                  │  pipeline)      │ │ │                             │ │ │
│                  │                 │ │ └─────────────────────────────┘ │ │
│                  │                 │ │                                 │ │
│                  └─────────────────┘ └─────────────────────────────────┘ │
│                    left-content        right-content                     │
│                                 ↕ PaneForge Resizable Splitter           │
└─────────────────────────────────────────────────────────────────────────┘
     Simple LayoutManager integration - consistent left/right pane structure
```

### Auto-Generation Behavior

**Simple Generation (First Pass):**

- **Trigger**: Automatically activates when `nav.txt` content is empty (after trim)
- **Textarea Display**: Remains empty with placeholder text explaining auto-generation
- **Preview Display**: Shows generated navigation in preview pane only
- **Source**: Spine items only with simple chapter listing
- **Generated Content**: Complete XHTML navigation document
- **No Configuration**: Uses sensible defaults, no user settings needed

**Placeholder Text**: "Navigation will be auto-generated from spine items when this editor is empty. Type here to create custom navigation content."

### Manual Editing Support

**Simple Text Editing:**

- **Plain Text Only**: Basic textarea for outline content stored as `OEBPS/SOURCE/text/nav.txt`
- **Transform Pipeline**: Uses same workspace transform scripts as other content
- **No Syntax Highlighting**: Plain text editing only
- **Debounced Updates**: Textarea changes debounced to prevent rapid mode switching
- **Empty State Detection**: `content.trim() === ''` triggers auto-generation mode
- **Simple Workflow**: Type content → debounced save → transform pipeline → XHTML generation → preview updates

### Simple Navigation Structure

**First Pass Support:**

- **Flat Navigation**: Simple chapter listing from spine items
- **Basic Validation**: Ensure generated content is valid EPUB navigation
- **Happy Path Only**: Focus on working implementation, minimal error handling

## Responsive Design Implementation

**LayoutManager Integration:**

- **All Layouts**: Standard LayoutManager responsive behavior
- **No Custom Responsive**: Inherits existing responsive patterns
- **Minimal Customization**: Focus on content, let LayoutManager handle layout

## Integration Specifications

**File Structure:**

- **Source Content**: `OEBPS/SOURCE/text/nav.txt` (user-entered content or empty string)
- **Generated Navigation**: `OEBPS/nav.xhtml` (transform pipeline output)
- **OPF Registration**: nav.xhtml registered with `properties="nav"` in manifest

**Simple Direct Integration:**

- **Workspace APIs**:
  - `workspaceManager.readTextFile('OEBPS/SOURCE/text/nav.txt')` for loading source
  - `workspaceManager.writeTextFile('OEBPS/SOURCE/text/nav.txt', content)` for saving source
  - `workspaceManager.writeTextFile('OEBPS/nav.xhtml', xhtml)` for saving generated navigation
- **Spine APIs**: Direct calls to `spineItemManager.loadSpineItems()` for auto-generation
- **Transform Pipeline**: Use existing workspace transform scripts for user content
- **OPF Integration**: Register nav.xhtml as navigation item in manifest
- **No Complex Coordination**: Keep integration simple and direct

## Implementation Requirements

### Component Structure

**OutlineView.svelte:**

- Coordination of outline editing components
- Direct workspace API integration (no manager layer)
- Simple state management (empty vs. user content)
- LayoutManager slot coordination

**OutlineEditor.svelte:**

- Simple textarea for `left-content` slot
- **Placeholder text**: Explains auto-generation when empty
- **Debounced input**: Prevent rapid mode switching during typing
- **Empty state detection**: `content.trim() === ''` triggers auto-generation
- **Source file**: Reads/writes `SOURCE/text/nav.txt`
- Basic editing only

**NavigationPreview.svelte:**

- **Location**: `src/lib/components/preview/NavigationPreview.svelte`
- **Props**: Accepts complete XHTML navigation document string
- **Rendering**: Displays content in iframe for `right-content` slot
- **Auto/Manual modes**: Shows auto-generated content when source is empty, transform output when user content exists
- **Reusable design**: Can be used by other features needing navigation preview
- **EPUB-compliant**: Displays final navigation output matching EPUB spec

**OutlineGenerator.ts:**

- Utility service with static methods
- Simple spine item to TOC generation
- **Transform Pipeline Dependency**: Requires `FileStorageAPI` and `BlobUrlManager` instances
- **Pipeline Methods**:
  - `generateFromSpine(spineItems)` - Auto-generation bypassing transforms
  - `processUserContent(navText, transformPipeline, workspaceId)` - User content via pipeline
- **Metadata Creation**: Builds navigation-specific `ChapterMetadata` objects
- **Error Integration**: Handles and propagates `TransformError` instances
- Basic validation for generated content
- No persistent state management

### Integration Points

**LayoutManager Integration:**

- Use `left-content` and `right-content` slots only
- Optional simple `left-header` for minimal controls
- No sidebar or right header needed
- Leverage existing PaneForge split-pane system

**Direct API Usage:**

- `workspaceManager.readTextFile('OEBPS/SOURCE/text/nav.txt')` for loading source content
- `workspaceManager.writeTextFile('OEBPS/SOURCE/text/nav.txt', content)` for saving user input
- `workspaceManager.writeTextFile('OEBPS/nav.xhtml', xhtml)` for saving generated navigation
- `spineItemManager.loadSpineItems()` for auto-generation source data
- **OPF Integration**: Register nav.xhtml in manifest with `properties="nav"`
- No manager layer needed

**Transform Pipeline Integration:**

- **TransformPipeline Class**: Uses `src/lib/transform/TransformPipeline` for user content processing
- **Pipeline Execution**: Calls `executeTransformPipeline(plainText, workspaceId, spineItemId, metadata)`
- **Script Loading**: Automatic loading from `SOURCE/scripts/` via `TransformManager`
- **Transform Settings**: Configuration via `SOURCE/settings.json` transform_pipeline section
- **Text + DOM Transforms**: Sequential processing: text transform → DOM transforms → XHTML output
- **Auto-Generation**: Direct spine-to-XHTML generation using `generateXHTMLDocument()` utility
- **Sandboxed Execution**: Secure transform script execution with timeout protection
- **Error Handling**: `TransformError` integration for user-friendly error messaging
- **Library Support**: Extension libraries loaded via `BlobUrlManager.getLoadedGlobals()`
- **Debouncing**: Apply to user input to prevent excessive transform pipeline calls
- **Navigation Metadata**: Uses navigation-specific `ChapterMetadata` for proper EPUB formatting

### Next Steps (First Pass Implementation)

1. **Create NavigationPreview component** in `src/lib/components/preview/`
   - Accept XHTML document string as prop
   - Render in iframe for preview pane
   - Design for reusability across features

2. **Implement OutlineEditor component** (simple textarea)
   - Add placeholder text explaining auto-generation
   - Implement debounced input handling
   - Detect empty state with `content.trim() === ''`
   - Read/write `SOURCE/text/nav.txt`

3. **Implement OutlineView component** with LayoutManager integration
   - Coordinate between editor and preview
   - Handle auto-generation vs. manual mode switching
   - Manage workspace file operations

4. **Create OutlineGenerator utility service**
   - Static method for spine-to-XHTML generation
   - Simple TOC generation from spine items
   - **TransformPipeline Integration**: Instance creation with `new TransformPipeline(fileStorage, blobUrlManager)`
   - **User Content Processing**: Call `pipeline.executeTransformPipeline()` for `nav.txt` content
   - **Auto-Generation**: Direct use of `generateXHTMLDocument(content, metadata)` for spine-based navigation
   - **Navigation Metadata**: Create `ChapterMetadata` with title="Navigation", navigation-specific settings
   - Produce complete EPUB navigation documents

5. **Add auto-generation logic**
   - Trigger when `nav.txt` is empty (after trim)
   - Generate XHTML directly from spine items
   - Display in preview only (keep textarea empty)

6. **Integrate transform pipeline for user content**
   - **Pipeline Setup**: Create `TransformPipeline` instance with workspace's `fileStorage` and `blobUrlManager`
   - **Content Processing**: Use `pipeline.executeTransformPipeline(navText, workspaceId, 'nav', navigationMetadata)`
   - **Transform Scripts**: Automatic loading from `SOURCE/scripts/` based on `SOURCE/settings.json`
   - **Error Handling**: Handle `TransformError` instances for user-friendly error messages
   - **Pipeline Result**: Extract XHTML document from `PipelineResult.xhtmlDocument`
   - Save both source (`nav.txt`) and output (`nav.xhtml`)
   - Register nav.xhtml in OPF manifest with `properties="nav"`

7. **Test complete workflow**
   - Empty state → auto-generate → preview shows spine-based navigation
   - User types → debounced save → transform → preview shows user content
   - Ensure OPF manifest integration works correctly

8. **Verify NavigationPreview reusability** for future features

---

_This document provides a simplified UX specification for the first-pass Outline editing interface, focused on essential functionality and integration with the existing EDITME design system._
