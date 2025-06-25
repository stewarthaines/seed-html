# EDITME Development Features

Based on the overview specification, here's a breakdown of features that can be developed independently:

## Core Foundation (Must be first)

### 1. File Storage API ✅ COMPLETE

- OPFS implementation with IndexedDB fallback
- Feature detection for `.createWritable()` support
- Storage quota monitoring and error handling
- Workspace folder management with unique IDs

### 2. EPUB Unpacking ✅ COMPLETE

- Compression Streams API for ZIP extraction
- Malformed EPUB detection and error reporting
- Storage quota exceeded handling
- Validation of required EPUB structure (mimetype, META-INF/content.opf)
- **Storybook**: Basic unpacking demos with various EPUB types and error scenarios

### 3. EPUB Packaging ✅ COMPLETE

- Create valid EPUB files from workspace content
- Proper mimetype handling (uncompressed first entry)
- Filename generation with title, author, timestamp
- Download trigger for packaged EPUB
- **Storybook**: Basic packaging demos with different workspace configurations

### 4. Workspace & OPF Manager ✅ COMPLETE

- High-level workspace operations with EPUB-aware metadata
- Content.opf parsing, generation, and manipulation
- Workspace switching with proper EPUB structure validation
- Integrated manifest and spine management
- **Combines original Features 04 + 05 for better cohesion**

## UI & Presentation Layer (Can start after #4)

### 5. Blob URL Manager ✅ COMPLETE

- Convert manifest items to blob URLs for preview
- Handle different content types (text, image, audio, video)
- Resource cleanup and memory management
- URL substitution for preview iframe

### 6. Layout System ✅ COMPLETE

- Collapsible left sidebar
- Resizable panels with mouse and touch support
- Minimum/maximum panel sizes
- State persistence for panel positions

### 7. Navigation Router

- Switch between views: manifest, metadata, spine, navigation
- URL state management (if applicable)
- View transition handling
- Active state indicators

### 8. Theme System

- Light/dark mode toggle
- Browser preference detection
- localStorage persistence
- CSS custom properties for theming

## Content Management (After workspace management)

### 9. Manifest View

- Table display of all manifest items
- Row selection and content preview
- Support for text, image, audio, video preview
- Add/Create manifest item buttons
- content.opf display as text item

### 10. Metadata Editor

- Form-based editing with grouped fields (Basic, Advanced, Accessibility)
- Immediate mode editing with blur event updates
- Dropdown selections for fixed layout and accessibility
- Required field validation (Title, Language, Identifier)

### 11. Spine Item Manager

- List of spine items with reorder capability
- Rename, delete, append operations
- Drag-and-drop reordering
- Association with plain text source files

## Text Processing Engine (Independent after #5)

### 12. Transform Pipeline

- Execute transformText.js as dynamic function
- Execute transformDom.js for post-processing
- Error handling and user notification
- XHTML template generation with proper structure

### 13. Text Editor

- Textarea in iframe for plain text editing
- Debounced change event handling
- Auto-save functionality
- Association with corresponding XHTML spine item

### 14. Error Handling

- Transform failure detection
- Informative error messages in preview iframe
- Graceful degradation when transforms fail
- User-friendly error reporting

## Preview System (After #12, #13)

### 15. Device Preview

- Responsive mode (fills pane, minimum 200px width)
- Multi-device mode with dropdown selection
- Device definitions: iPhone 8, iPhone 14, iPad Mini, iPad, iPad Pro, Pixel Phone
- Portrait/landscape orientation toggle

### 16. Preview Iframe

- Display transformed XHTML content
- Blob URL substitution for static resources
- Real-time updates from text editor
- Device-specific viewport sizing

## Integration Features (After Features 2 & 3)

### EPUB Round-Trip Workflow

- **Storybook**: Combined demo showing upload → unpack → modify → package → download
- End-to-end data integrity testing
- Metadata preservation validation
- **File**: `src/stories/EpubRoundTripDemo.svelte`

## Advanced Features (After core functionality)

### 17. Navigation Editor

- Split-pane interface (raw markup editor + rendered preview)
- Auto-generation of Table of Contents from spine items
- Manual markdown editing capability
- Live preview updates

### 18. Storage Quota Monitor

- Display current storage usage
- Quota warnings and notifications
- Storage cleanup suggestions
- Per-workspace storage breakdown

### 19. Audio Clip Editor

- Begin/end timestamp selection
- Clip playback functionality
- "Last 2 seconds" preview option
- Visual timeline interface

## Suggested Development Order

### Phase 1: Foundation

1. File Storage API ✅ COMPLETE
2. EPUB Unpacking ✅ COMPLETE
3. EPUB Packaging ✅ COMPLETE
4. Workspace & OPF Manager ✅ COMPLETE

**Goal**: Complete EPUB workspace management with metadata handling

### Phase 2: UI & Presentation

5. Blob URL Manager ✅ COMPLETE
6. Layout System ✅ COMPLETE
7. Navigation Router
8. Theme System

**Goal**: Core UI structure with presentation layer

### Phase 3: Content Management

9. Manifest View
10. Metadata Editor
11. Spine Item Manager

**Goal**: Complete content management interface

### Phase 4: Text Processing

12. Transform Pipeline
13. Text Editor
14. Error Handling

**Goal**: Plain text to XHTML transformation workflow

### Phase 5: Preview & Polish

15. Device Preview
16. Preview Iframe
17. Navigation Editor
18. Storage Quota Monitor
19. Audio Clip Editor

**Goal**: Complete feature set with advanced preview and editing capabilities

## Dependencies

- **#2, #3, #4** depend on **#1** (File Storage API)
- **#5** depends on **#1** (File Storage API)
- **#9, #10, #11** depend on **#4** (Workspace & OPF Manager)
- **#12, #14** depend on **#5** (Blob URL Manager)
- **#13** depends on **#12** (Transform Pipeline)
- **#15, #16** depend on **#12, #13** (Text Processing)
- **#17** depends on **#4, #12** (Workspace management + transforms)
- **#18, #19** are independent advanced features

This order ensures each feature has its dependencies available and allows for incremental testing of the complete workflow.
