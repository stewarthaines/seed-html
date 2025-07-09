# EDITME Development Roadmap

This roadmap focuses on remaining features to be implemented. For completed features and overall project status, see [TODO.md](../TODO.md).

## ✅ Completed Foundation (Features 1-8)

The core foundation is complete with full implementations:

- File Storage API, EPUB Packing/Unpacking, Workspace & OPF Manager
- Blob URL Manager, Layout System, Navigation Router, Theme System
- SOURCE.zip Management, Transform Pipeline
- **Internationalization System**: Reactive i18n with 7 languages, RTL support, and Storybook integration

See individual feature specifications in `plans/features/` for implementation details.

## 🚧 Pending Implementation

### Phase 3: Content Management (High Priority)

#### 9. Manifest View ❌ NOT IMPLEMENTED

- Table display of all manifest items
- Row selection and content preview
- Support for text, image, audio, video preview
- Add/Create manifest item buttons
- content.opf display as text item
- **Status**: Only placeholder views exist in navigation

#### 10. Metadata Editor ❌ NOT IMPLEMENTED

- Form-based editing with grouped fields (Basic, Advanced, Accessibility)
- Immediate mode editing with blur event updates
- Dropdown selections for fixed layout and accessibility
- Required field validation (Title, Language, Identifier)
- **Status**: Only placeholder views exist in navigation

#### 11. Spine Item Manager ❌ NOT IMPLEMENTED

- List of spine items with reorder capability
- Rename, delete, append operations
- Drag-and-drop reordering
- Association with plain text source files
- **Status**: Only placeholder views exist in navigation

### Phase 4: Text Processing UI (Medium Priority)

#### 12. Transform Pipeline ✅ COMPLETE

- Execute transformText.js as dynamic function
- Execute transformDom.js for post-processing
- Error handling and user notification
- XHTML template generation with proper structure
- **Status**: Complete implementation with Storybook demo

#### 13. Text Editor ❌ NOT IMPLEMENTED

- Textarea in iframe for plain text editing
- Debounced change event handling
- Auto-save functionality
- Association with corresponding XHTML spine item
- **Status**: No implementation found

#### 14. Error Handling ❌ NOT IMPLEMENTED

- Transform failure detection
- Informative error messages in preview iframe
- Graceful degradation when transforms fail
- User-friendly error reporting
- **Status**: No dedicated implementation

### Phase 5: Preview & Advanced Features (Lower Priority)

#### 15. Device Preview ❌ NOT IMPLEMENTED

- Responsive mode (fills pane, minimum 200px width)
- Multi-device mode with dropdown selection
- Device definitions: iPhone 8, iPhone 14, iPad Mini, iPad, iPad Pro, Pixel Phone
- Portrait/landscape orientation toggle
- **Status**: No implementation found

#### 16. Preview Iframe ❌ NOT IMPLEMENTED

- Display transformed XHTML content
- Blob URL substitution for static resources
- Real-time updates from text editor
- Device-specific viewport sizing
- **Status**: No implementation found

#### 17. Navigation Editor ❌ NOT IMPLEMENTED

- Split-pane interface (raw markup editor + rendered preview)
- Auto-generation of Table of Contents from spine items
- Manual markdown editing capability
- Live preview updates
- **Status**: Only placeholder views exist

#### 18. Storage Quota Monitor ❌ NOT IMPLEMENTED

- Display current storage usage
- Quota warnings and notifications
- Storage cleanup suggestions
- Per-workspace storage breakdown
- **Status**: No implementation found

#### 19. Audio Clip Editor ❌ NOT IMPLEMENTED

- Begin/end timestamp selection
- Clip playback functionality
- "Last 2 seconds" preview option
- Visual timeline interface
- **Status**: No implementation found

## Integration Features

### EPUB Round-Trip Workflow ✅ COMPLETE

- **Storybook**: Combined demo showing upload → unpack → modify → package → download
- End-to-end data integrity testing
- Metadata preservation validation
- **Status**: Working demonstrations available

## Current Development Priorities

### Immediate Priority (Phase 3)

**Content Management Interface**

1. **Feature 9**: Manifest View - Table display with preview
2. **Feature 10**: Metadata Editor - Form-based editing
3. **Feature 11**: Spine Item Manager - Chapter ordering

**Goal**: Complete content management interface for EPUB editing

### Next Priority (Phase 4)

**Text Processing UI**

1. **Feature 13**: Text Editor - Plain text editing interface
2. **Feature 14**: Error Handling - User-friendly error reporting

**Goal**: Connect transform pipeline to user interface

### Future Priority (Phase 5)

**Preview & Advanced Features**

1. **Feature 15**: Device Preview - Multi-device preview
2. **Feature 16**: Preview Iframe - Real-time preview
3. **Feature 17**: Navigation Editor - TOC editing
4. **Feature 18**: Storage Quota Monitor - Storage management
5. **Feature 19**: Audio Clip Editor - Audio clip handling

**Goal**: Complete feature set with advanced preview and editing capabilities

## Extension Manager Implementation

**Current Status**: API documentation and unit tests complete, implementation pending

- See `src/lib/extensions/API.md` for complete specification
- Implementation available via dedicated worktree
- Priority: High (parallel to content management features)

## Dependencies & Implementation Notes

### ✅ Dependencies Satisfied

- **Features 9, 10, 11**: Can proceed (depend on completed Workspace & OPF Manager)
- **Feature 13**: Can proceed (depends on completed Transform Pipeline)
- **Feature 14**: Can proceed (depends on completed Blob URL Manager)

### ⏳ Remaining Dependencies

- **Features 15, 16**: Require Features 13, 14 (Text Editor + Error Handling)
- **Feature 17**: Ready (depends on completed workspace management + transforms)
- **Features 18, 19**: Independent advanced features

### Implementation Strategy

- **Parallel Development**: Content Management (9-11) can be developed alongside Extension Manager
- **Sequential Development**: Text Editor (13) → Error Handling (14) → Preview Features (15-16)
- **Independent Features**: Navigation Editor (17), Storage Monitor (18), Audio Editor (19) can be implemented anytime

## Performance Optimization

### Bundle Size Optimization (Future Priority)

**Current Status**: Single-file build is 201KB (130KB JS, 73KB CSS)

- **CSS Design System Optimization**: Current CSS is 73KB (36% of bundle)
  - Remove unused CSS selectors (build warns about 2 unused selectors)
  - Optimize design token definitions and utility classes
  - Consider CSS purging for unused styles
  - Evaluate if full utility class library is needed
- **JavaScript Optimization**: Consider code splitting for larger features
- **Priority**: Low (implement when core features are complete)

This roadmap ensures efficient development with clear priorities and satisfied dependencies.
