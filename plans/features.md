# EDITME Development Features

Based on the overview specification, here's a breakdown of features that can be developed independently:

## Core Foundation (Must be first)

### 1. File Storage API ✅ COMPLETE

- OPFS implementation with IndexedDB fallback
- Feature detection for `.createWritable()` support
- Storage quota monitoring and error handling
- Workspace folder management with unique IDs

### 2. EPUB Unpacking

- Compression Streams API for ZIP extraction
- Malformed EPUB detection and error reporting
- Storage quota exceeded handling
- Validation of required EPUB structure (mimetype, META-INF/content.opf)
- **Storybook**: Basic unpacking demos with various EPUB types and error scenarios

### 3. EPUB Packaging

- Create valid EPUB files from workspace content
- Proper mimetype handling (uncompressed first entry)
- Filename generation with title, author, timestamp
- Download trigger for packaged EPUB
- **Storybook**: Basic packaging demos with different workspace configurations

### 4. Workspace Management

- Create new workspaces with unique IDs
- List available workspaces from storage
- Switch between workspaces
- Extract title/author from content.opf for workspace dropdown

## Data Layer (Can start after #1)

### 5. Content.opf Parser/Generator

- Parse existing content.opf files
- Generate valid content.opf from workspace data
- Metadata field validation
- Manifest item management (add/remove/update)

### 6. Blob URL Manager

- Convert manifest items to blob URLs for preview
- Handle different content types (text, image, audio, video)
- Resource cleanup and memory management
- URL substitution for preview iframe

## UI Foundation (Can start in parallel with data layer)

### 7. Layout System

- Collapsible left sidebar
- Resizable panels with mouse and touch support
- Minimum/maximum panel sizes
- State persistence for panel positions

### 8. Navigation Router

- Switch between views: manifest, metadata, spine, navigation
- URL state management (if applicable)
- View transition handling
- Active state indicators

### 9. Theme System

- Light/dark mode toggle
- Browser preference detection
- localStorage persistence
- CSS custom properties for theming

## Content Management (After data layer)

### 10. Manifest View

- Table display of all manifest items
- Row selection and content preview
- Support for text, image, audio, video preview
- Add/Create manifest item buttons
- content.opf display as text item

### 11. Metadata Editor

- Form-based editing with grouped fields (Basic, Advanced, Accessibility)
- Immediate mode editing with blur event updates
- Dropdown selections for fixed layout and accessibility
- Required field validation (Title, Language, Identifier)

### 12. Spine Item Manager

- List of spine items with reorder capability
- Rename, delete, append operations
- Drag-and-drop reordering
- Association with plain text source files

## Text Processing Engine (Independent after #6)

### 13. Transform Pipeline

- Execute transformText.js as dynamic function
- Execute transformDom.js for post-processing
- Error handling and user notification
- XHTML template generation with proper structure

### 14. Text Editor

- Textarea in iframe for plain text editing
- Debounced change event handling
- Auto-save functionality
- Association with corresponding XHTML spine item

### 15. Error Handling

- Transform failure detection
- Informative error messages in preview iframe
- Graceful degradation when transforms fail
- User-friendly error reporting

## Preview System (After #13, #14)

### 16. Device Preview

- Responsive mode (fills pane, minimum 200px width)
- Multi-device mode with dropdown selection
- Device definitions: iPhone 8, iPhone 14, iPad Mini, iPad, iPad Pro, Pixel Phone
- Portrait/landscape orientation toggle

### 17. Preview Iframe

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

### 18. Navigation Editor

- Split-pane interface (raw markup editor + rendered preview)
- Auto-generation of Table of Contents from spine items
- Manual markdown editing capability
- Live preview updates

### 19. Audio Clip Editor

- Begin/end timestamp selection
- Clip playback functionality
- "Last 2 seconds" preview option
- Visual timeline interface

### 20. Storage Quota Monitor

- Display current storage usage
- Quota warnings and notifications
- Storage cleanup suggestions
- Per-workspace storage breakdown

## Suggested Development Order

### Phase 1: Foundation

1. File Storage API ✅ COMPLETE
2. EPUB Unpacking
3. EPUB Packaging
4. Workspace Management

**Goal**: Basic EPUB load/save functionality with persistent storage

### Phase 2: Data & UI

5. Content.opf Parser/Generator
6. Blob URL Manager
7. Layout System
8. Navigation Router

**Goal**: Core UI structure with data management capabilities

### Phase 3: Content Management

9. Manifest View
10. Metadata Editor
11. Spine Item Manager
12. Theme System

**Goal**: Complete content management interface

### Phase 4: Text Processing

13. Transform Pipeline
14. Text Editor
15. Error Handling

**Goal**: Plain text to XHTML transformation workflow

### Phase 5: Preview & Polish

16. Device Preview
17. Preview Iframe
18. Navigation Editor
19. Storage Quota Monitor
20. Audio Clip Editor

**Goal**: Complete feature set with advanced preview and editing capabilities

## Dependencies

- **#2, #3, #4** depend on **#1** (File Storage API)
- **#5, #6** depend on **#1** (File Storage API)
- **#10, #11, #12** depend on **#5** (Content.opf Parser)
- **#13, #15** depend on **#6** (Blob URL Manager)
- **#14** depends on **#13** (Transform Pipeline)
- **#16, #17** depend on **#13, #14** (Text Processing)
- **#18** depends on **#5, #13** (Content management + transforms)
- **#19, #20** are independent advanced features

This order ensures each feature has its dependencies available and allows for incremental testing of the complete workflow.
