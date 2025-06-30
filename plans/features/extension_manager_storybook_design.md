# Extension Manager Storybook Story Design

## Overview

This document outlines the design for comprehensive Storybook stories that demonstrate the Extension Manager's capabilities through interactive, real-world workflows. The stories will serve as both documentation and testing interface for the extension management system.

## Story Structure

### Main Story: `ExtensionManagerDemo.stories.svelte`
**Location**: `src/stories/ExtensionManagerDemo.stories.svelte`  
**Title**: `Backend/Extension Manager`  
**Component**: Interactive demonstration component

## Component Architecture

### Primary Component: `ExtensionManagerDemo.svelte`
**Purpose**: Main orchestrator component that manages state and coordinates sub-components

### Sub-Components:

#### 1. `ExtensionUploader.svelte`
- **Purpose**: File upload interface with validation
- **Features**:
  - Drag & drop zone for JavaScript files
  - File type validation with visual feedback
  - Size limits and progress indicators
  - Name detection and confirmation dialog

#### 2. `ExtensionBrowser.svelte`
- **Purpose**: Browse and manage extensions (workspace + cache)
- **Features**:
  - Tabbed interface (Workspace / Global Cache)
  - Grid/list view toggle
  - Search and filter capabilities
  - Extension details on hover/click

#### 3. `ExtensionDetails.svelte`
- **Purpose**: Display detailed information about extensions
- **Features**:
  - File list with types and sizes
  - Total extension size
  - Installation location (workspace vs cache)
  - Action buttons (delete, export, cache)

#### 4. `OperationLog.svelte`
- **Purpose**: Real-time activity logging
- **Features**:
  - Timestamped operation history
  - Color-coded log levels (info, success, warning, error)
  - Auto-scroll to latest entries
  - Clear/filter functionality

#### 5. `StatusPanel.svelte`
- **Purpose**: System status and statistics
- **Features**:
  - Storage quota usage visualization
  - Extension count statistics
  - Cache efficiency metrics
  - System information (storage backend)

## Story Workflows

### Story 1: "Basic Extension Import"
**Happy Path**: Upload → Validate → Import → Cache

**Steps**:
1. **Setup**: Empty workspace, clean cache
2. **Upload**: User drags `markdown-it-13.0.1.min.js` to upload zone
3. **Validation**: System validates file type, shows green checkmark
4. **Name Detection**: Auto-detects name as "markdown-it", shows in confirmation dialog
5. **Import**: User confirms, extension imports to workspace
6. **Auto-Cache**: System automatically caches extension
7. **Result**: Extension appears in workspace browser, cache count increases

**Sample Files**:
```javascript
// markdown-it-13.0.1.min.js (realistic minified content)
// highlight-11.7.0.min.js  
// prism-core.min.js
```

### Story 2: "Cache Management Workflow"
**Happy Path**: Browse Cache → Import from Cache → Conflict Detection

**Steps**:
1. **Setup**: Pre-populated cache with popular extensions
2. **Browse**: User switches to "Global Cache" tab
3. **Selection**: User selects "lodash" from cache browser
4. **Import**: Clicks "Import to Workspace" button
5. **Success**: Extension copies from cache to workspace
6. **Conflict**: User tries to import same extension again
7. **Detection**: System shows conflict warning, prevents duplicate

**Pre-populated Cache Extensions**:
- lodash (utility library)
- d3 (data visualization)  
- prism (syntax highlighter)
- highlight.js (code highlighter)
- markdown-it (markdown processor)

### Story 3: "Multi-File Extension Management"
**Happy Path**: Import Base → Add Files → Manage Complete Extension

**Steps**:
1. **Base Import**: Import `markdown-it.min.js`
2. **Add Plugin**: Upload `markdown-it-footnote.js` to same extension
3. **Add License**: Upload `LICENSE.txt` file
4. **View Details**: Click extension to see all 3 files
5. **File Management**: Show file types, sizes, ability to delete individual files
6. **Extension Actions**: Delete entire extension, export as ZIP

**Sample Multi-File Extension**:
```
markdown-it/
├── markdown-it.min.js      (312 KB, javascript)
├── markdown-it-footnote.js (45 KB, javascript)  
└── LICENSE.txt             (1.2 KB, license)
```

### Story 4: "Workspace Import with Auto-Caching"
**Happy Path**: Upload EPUB → Scan Extensions → Auto-Cache → Summary

**Steps**:
1. **EPUB Upload**: User uploads EPUB file containing SOURCE/extensions/
2. **Workspace Import**: System unpacks EPUB to workspace
3. **Extension Scan**: Automatically scans for extensions in SOURCE/extensions/
4. **Auto-Cache**: Attempts to cache all discovered extensions
5. **Conflict Handling**: Shows conflicts for extensions already in cache
6. **Summary Report**: Displays results (cached: 3, conflicts: 1, errors: 0)

**Sample EPUB Structure**:
```
sample-book.epub
├── OEBPS/content.opf
├── OEBPS/chapter1.xhtml
└── SOURCE/extensions/
    ├── markdown-it/markdown-it.min.js
    ├── highlight/highlight.min.js
    └── custom-processor/processor.js
```

### Story 5: "Extension Library Management"
**Happy Path**: Browse → Organize → Batch Operations → Export

**Steps**:
1. **Library View**: Display all workspace extensions in organized grid
2. **Search/Filter**: Filter by name, type, or size
3. **Bulk Selection**: Select multiple extensions with checkboxes
4. **Batch Operations**: Cache selected, delete selected, export selected
5. **Export**: Download selected extensions as ZIP file
6. **Statistics**: Show workspace utilization, most used extensions

## Sample Data Strategy

### Realistic Extension Files

#### Popular Libraries
```javascript
// Lodash (utility library)
'lodash-4.17.21.min.js': '/*! Lodash.js 4.17.21 ... */' (70KB)

// D3.js (data visualization)  
'd3-7.8.2.min.js': '// D3.js v7.8.2 ... */' (280KB)

// Prism.js (syntax highlighting)
'prism-core.min.js': '/* Prism: Lightweight ... */' (12KB)
'prism-javascript.js': '/* JavaScript language support ... */' (8KB)

// Highlight.js (code highlighting)
'highlight-11.7.0.min.js': '/*! highlight.js v11.7.0 ... */' (190KB)

// Markdown-it (markdown processing)
'markdown-it-13.0.1.min.js': '/*! markdown-it 13.0.1 ... */' (312KB)
'markdown-it-footnote.js': '// Plugin for footnotes ... */' (45KB)
```

#### Extension Categories
- **Text Processing**: markdown-it, remarkable, marked
- **Syntax Highlighting**: highlight.js, prism.js, codemirror
- **Data Visualization**: d3.js, chart.js, plotly
- **Utilities**: lodash, moment.js, axios
- **Music Notation**: abcjs, vexflow
- **Math**: katex, mathjax

### Conflict Scenarios
1. **Same Extension, Different Versions**: markdown-it v13.0.1 vs v12.3.2
2. **Same Extension, Different Files**: highlight.js with/without languages
3. **Same Extension, Modified Content**: custom-patched vs original

## UI/UX Design Considerations

### Visual Design
- **Color Coding**: 
  - Green: Successful operations, valid files
  - Blue: Information, pending operations
  - Yellow: Warnings, conflicts
  - Red: Errors, validation failures
- **Icons**: File type icons, status indicators, action buttons
- **Progress**: Loading spinners, progress bars for batch operations

### Interaction Patterns
- **Drag & Drop**: Primary upload method with visual feedback
- **Hover States**: Show extension details on hover
- **Selection**: Multi-select with checkboxes for batch operations
- **Confirmation**: Dialogs for destructive actions (delete, overwrite)

### Responsive Layout
- **Desktop**: Full-width layout with side panels
- **Tablet**: Collapsible sidebars, stacked components
- **Mobile**: Single column, drawer-style navigation

## Implementation Guidelines

### State Management
```typescript
interface ExtensionManagerState {
  workspaceExtensions: ExtensionInfo[];
  cachedExtensions: ExtensionInfo[];
  selectedWorkspace: string | null;
  operationLog: LogEntry[];
  uploadProgress: UploadProgress | null;
  isLoading: boolean;
  storageQuota: StorageQuota;
}
```

### Error Handling
- **Graceful Degradation**: Continue operation even if some extensions fail
- **User Feedback**: Clear error messages with suggested actions
- **Recovery Options**: Retry failed operations, skip problematic files

### Performance Considerations
- **Lazy Loading**: Load extension details on demand
- **Virtual Scrolling**: Handle large extension lists efficiently
- **Debounced Search**: Optimize filtering performance
- **Batch Operations**: Process multiple items efficiently

### Testing Integration
- **Mock Data**: Consistent sample extensions for reliable demos
- **Reset Functionality**: Clean slate for repeated demonstrations
- **Automation**: Scriptable workflows for testing scenarios

## File Structure

```
src/stories/ExtensionManagerDemo/
├── ExtensionManagerDemo.stories.svelte     # Main story file
├── ExtensionManagerDemo.svelte             # Main demo component
├── components/
│   ├── ExtensionUploader.svelte
│   ├── ExtensionBrowser.svelte
│   ├── ExtensionDetails.svelte
│   ├── OperationLog.svelte
│   └── StatusPanel.svelte
├── mock-data/
│   ├── sample-extensions.js                # Sample extension files
│   ├── sample-epub.js                      # Mock EPUB structure
│   └── conflict-scenarios.js               # Conflict test data
└── styles/
    └── extension-demo.css                  # Demo-specific styles
```

## Success Metrics

### Demonstration Goals
1. **Workflow Clarity**: Users understand extension management process
2. **Feature Coverage**: All major Extension Manager features shown
3. **Error Scenarios**: Realistic error handling demonstrated
4. **Performance**: Smooth interactions, no blocking operations
5. **Documentation**: Self-explanatory interface with helpful tooltips

### Interactive Elements
- **File Upload**: Drag & drop, browse, validation feedback
- **Extension Browser**: Search, filter, sort, pagination
- **Batch Operations**: Select multiple, apply actions
- **Real-time Updates**: Live logs, progress indicators
- **Data Export**: Download extensions, generate reports

This design provides a comprehensive, interactive demonstration of the Extension Manager that serves as both documentation and testing interface, showcasing all major features through realistic, engaging workflows.