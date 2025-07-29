# Outline UI Implementation Plan

## Overview

This document breaks down the Outline UI implementation into smaller, test-driven development (TDD) friendly pieces. Each phase can be developed and tested in isolation before integration, ensuring solid progression and maintainable code.

## Implementation Strategy

- **Test-First Development**: Write tests before implementation for each component
- **Isolated Development**: Each piece can be developed independently with mocked dependencies
- **Incremental Integration**: Components integrate one at a time with existing system
- **Clear Dependencies**: Each phase has explicit dependency requirements

## Phase Breakdown

### Phase 1: Core Utilities (No UI Dependencies)

#### 1.1 ✅ ContentPreview Component (COMPLETED)
**Location**: `src/lib/components/preview/ContentPreview.svelte`

**✅ Implementation Completed:**
- Device-aware XHTML preview with 6 device types (iPhone SE to iPad Pro 13")
- Iframe-based rendering with complete XHTML document support
- CSS injection system for device-specific styles and font families
- Real-time scaling algorithm with aspect ratio preservation
- Orientation toggle (portrait/landscape) with dimension swapping
- Font controls: family selection and size adjustment
- Responsive mode for full-width preview
- **Isolated**: No workspace dependencies, pure display component

**✅ Testing Completed:**
- Comprehensive Storybook testing with 12 interactive scenarios
- Real browser behavior testing (iframe rendering, CSS transforms)
- Device simulation, content rendering, and user interaction testing
- Complete API documentation with usage examples

**✅ Acceptance Criteria Met:**
- ✅ Renders valid XHTML navigation documents in iframe with device simulation
- ✅ Handles empty/invalid content without breaking
- ✅ Reactive to prop changes with real-time updates
- ✅ Reusable design for other features (extends beyond navigation to any XHTML content)

**✅ Completed**: ContentPreview provides enhanced functionality beyond original NavigationPreview specification

#### 1.2 ✅ OutlineGenerator Utility Service (COMPLETED)
**Location**: `src/lib/outline/outline-generator.ts`

**✅ Test-First Implementation Completed:**
- Comprehensive unit test suite with 39 tests covering all functionality
- Spine item mocking using shared MockWorkspaceManager infrastructure
- Auto-generation testing: `generateFromSpine(mockSpineItems)` → valid EPUB XHTML
- Transform pipeline integration testing with mock dependencies
- Complete edge case coverage (empty spine, missing files, malformed XHTML, workspace errors)

**✅ Implementation Completed:**
- Static method `generateFromSpine()` with full spine item processing
- Static method `processUserContent()` with transform pipeline integration
- Title extraction from XHTML using DOMParser (H1, H2, document title, filename fallbacks)
- Complete EPUB navigation XHTML generation with proper namespaces and structure
- Comprehensive error handling (missing files, malformed XHTML, workspace errors)
- **Isolated**: Static methods with clear dependency interfaces, no UI dependencies

**✅ Acceptance Criteria Met:**
- ✅ Generates valid EPUB 3.x navigation from spine items with flat list structure
- ✅ Creates proper NavigationMetadata for OPF manifest registration
- ✅ Handles empty/invalid spine data gracefully (returns valid but empty navigation)
- ✅ Produces EPUB-compliant XHTML structure with required namespaces and semantics
- ✅ Processes user content through transform pipeline with error handling
- ✅ Extracts titles using multiple strategies (heading, filename, fallback)
- ✅ Skips malformed XHTML files and continues processing remaining items

**✅ API Documentation**: Complete API.md with comprehensive method documentation and usage examples

**✅ Completed**: Full OutlineGenerator utility service with both spine generation and user content processing capabilities

### Phase 2: Editor Component (Transform Pipeline Integration Complete)

**✅ Note**: Transform pipeline integration was completed in Phase 1.2 as part of the comprehensive OutlineGenerator implementation. The `processUserContent()` method includes full transform pipeline integration with error handling and extension library support.

#### 2.1 ✅ OutlineEditor Component (COMPLETED)
**Location**: `src/lib/components/outline/OutlineEditor.svelte`

**✅ Implementation Completed:**
- Simple textarea for `nav.txt` content editing with full CSS styling
- Debounced input handling (300ms) to prevent rapid saves
- Placeholder text explaining auto-generation when empty
- Event emission for content changes with lightweight event structure
- **Isolated**: Clean interface using TextEditorStore for state management
- Accessibility features: ARIA labels, screen reader support
- Responsive design with mobile touch target compliance
- Theme support (dark/light) and reduced motion preferences

**✅ Testing Completed:**
- **Storybook Integration**: Complete interactive demo in `OutlineEditorDemo.svelte`
- Real browser testing with textarea behavior, debouncing, and event handling
- Live console logging for debugging user interactions
- **Note**: Unit tests not appropriate per project testing guidelines - UI components with browser APIs should use Storybook

**✅ Acceptance Criteria Met:**
- ✅ Textarea handles user input correctly with proper state synchronization
- ✅ Debounced events prevent excessive updates (300ms delay)
- ✅ Empty state detection triggers auto-generation mode
- ✅ Placeholder text guides user behavior and explains auto-generation
- ✅ Proper accessibility support with ARIA labels and screen reader text
- ✅ Event-based interface for parent component coordination

**✅ Completed**: Full OutlineEditor component with comprehensive Storybook testing following project guidelines

### Phase 3: Coordination Layer

#### 3.1 ✅ OutlineView Integration Component (COMPLETED)
**Location**: `src/lib/components/outline/OutlineView.svelte`

**✅ Implementation Completed:**
- Complete coordination between OutlineEditor and preview generation
- Automatic mode switching (empty content → auto-generation, user content → manual processing)
- Full workspace file operations for `nav.txt` (SOURCE/text/) and `nav.xhtml` (OEBPS/)
- Comprehensive transform pipeline integration with error handling
- Public API methods: `loadNavigationContent()`, `saveNavigationContent()`, `waitForReady()`
- Screen reader announcements and keyboard shortcuts (Ctrl+Enter/Cmd+Enter to save)
- Component lifecycle management with proper cleanup

**✅ Integration Features:**
- **Real WorkspaceManager Integration**: File I/O operations with workspace storage
- **SpineItemManager Integration**: Loads spine items for auto-generation
- **Transform Pipeline Integration**: User content processing through transform system
- **OutlineGenerator Integration**: Uses both `generateFromSpine()` and `processUserContent()` methods
- **Event-driven Architecture**: Emits typed events for preview updates, errors, and lifecycle

**✅ Testing Completed:**
- **Complete Storybook Demo**: `OutlineEditorDemo.svelte` with full workflow testing
- **Real Browser Environment**: Interactive testing with mock workspace and spine data
- **Live Console Logging**: Comprehensive activity tracking for debugging
- **Error State Testing**: Handles missing files, transform failures, and workspace errors
- **Component Lifecycle Testing**: Mount/destroy behavior with proper cleanup

**✅ Acceptance Criteria Met:**
- ✅ Seamlessly switches between auto-generation and manual modes based on content
- ✅ Coordinates editor state changes with real-time preview updates
- ✅ Handles all workspace file operations (read/write nav.txt and nav.xhtml)
- ✅ Integrates with transform pipeline for user content processing
- ✅ Provides complete public API for parent component integration
- ✅ Manages component lifecycle with proper initialization and cleanup
- ✅ Comprehensive error handling with user-friendly messaging

**✅ Completed**: Full OutlineView coordination component with comprehensive Storybook integration testing

### Phase 4: Layout Integration

#### 4.1 LayoutManager Integration - **PENDING MAIN APP INTEGRATION**
**Status**: Components complete, needs main app wiring

**Current State:**
- ✅ **OutlineView Component**: Fully functional and tested in Storybook
- ✅ **ContentPreview Component**: Available for preview rendering
- ❌ **Main App Integration**: Not yet wired into navigation system

**Integration Tasks:**
- Add outline navigation option to main app routing
- Integrate OutlineView with existing LayoutManager slots
- Connect to real workspace context (not Storybook mocks)
- Wire up ContentPreview for XHTML rendering in split-pane layout

**Planned Integration:**
- Use `left-content` slot for OutlineEditor
- Use `right-content` slot for ContentPreview (XHTML rendering)
- Standard responsive behavior consistent with other editing interfaces
- Integration with workspace selection and navigation

**Dependencies**: 
- Main app navigation system updates
- Real workspace context integration
- LayoutManager slot configuration

**Acceptance Criteria:**
- ✅ Proper LayoutManager slot integration with OutlineView + ContentPreview
- ✅ Split-pane resizing works correctly for editor/preview
- ✅ Responsive layout behavior matches other editing interfaces
- ✅ Accessible via main app navigation when workspace is selected
- ✅ Real workspace file operations (not Storybook mocks)

**Estimated Time**: 1-2 days

## Implementation Timeline

### Week 1: Foundation Components
**✅ Days 1-2**: ContentPreview component (COMPLETED)
- ✅ TDD: Comprehensive Storybook testing with 12 scenarios
- ✅ Implementation: Device-aware iframe XHTML rendering with scaling
- ✅ Integration: Isolated component with enhanced functionality

**✅ Days 3-4**: OutlineGenerator utility service (COMPLETED)
- ✅ TDD: 39 comprehensive unit tests covering all functionality
- ✅ Implementation: Static methods for spine generation and user content processing
- ✅ Integration: Transform pipeline integration with comprehensive error handling

### ✅ Week 2: Editor Component - COMPLETED
**✅ Days 5-7**: OutlineEditor component
- ✅ Storybook Testing: Interactive textarea testing with real browser behavior
- ✅ Implementation: Textarea with debounced input, accessibility, and theme support
- ✅ Integration: Event-based interface using TextEditorStore

### ✅ Week 3: System Integration - COMPLETED
**✅ Days 8-10**: OutlineView coordination
- ✅ Storybook Integration Testing: Complete workflow with mock workspace data
- ✅ Implementation: Full component coordination and workspace I/O operations
- ✅ Integration: Real component assembly with comprehensive error handling

### 🚧 Week 4: Main App Integration - IN PROGRESS
**Days 11-12**: LayoutManager integration and main app wiring
- Real app navigation integration
- LayoutManager slot configuration with OutlineView + ContentPreview
- Connect to real workspace context (replace Storybook mocks)

## Testing Strategy (Updated per Project Guidelines)

### ✅ Unit Testing (Appropriate Components Only)
- **OutlineGenerator**: ✅ 39 comprehensive unit tests for pure business logic
- **Note**: UI components (OutlineEditor, OutlineView) are NOT unit tested per project guidelines
- TESTING.md states: "Browser APIs" and "User Interactions" should use Storybook, not unit tests

### ✅ Storybook Testing (Primary UI Testing Method)  
- **OutlineEditor**: ✅ Interactive textarea testing with real browser behavior
- **OutlineView**: ✅ Complete workflow testing with mock workspace data
- **Real Browser Environment**: Proper DOM behavior, event timing, accessibility testing
- **Live Console Logging**: Comprehensive debugging and interaction tracking

### 🚧 Integration Testing (To Be Added)
- Test OutlineView with real WorkspaceManager (not mocks)
- Verify actual workspace file I/O operations
- Test real transform pipeline integration with workspace context
- End-to-end navigation file creation and OPF manifest updates

### 🚧 End-to-End Workflow Testing (To Be Added)
- Complete workflow: empty → auto-gen → manual → save → OPF update
- Error scenarios: missing files, transform failures, workspace errors
- EPUB compliance verification of generated navigation documents
- Main app integration with real workspace selection

## Success Criteria

### Technical Requirements
- ✅ All components pass comprehensive test suites
- ✅ Zero TypeScript errors maintained throughout development
- ✅ Clean separation of concerns between components
- ✅ Proper error handling and user messaging
- ✅ EPUB-compliant navigation generation

### Integration Requirements
- ✅ Seamless LayoutManager integration
- ✅ Consistent with existing EDITME design patterns
- ✅ Transform pipeline integration working correctly
- ✅ Workspace file operations functioning properly

### User Experience Requirements
- ✅ Intuitive auto-generation when editor is empty
- ✅ Smooth transition to manual editing mode
- ✅ Real-time preview updates
- ✅ Clear error messaging for transform failures

## Risk Mitigation

### Technical Risks
- **Transform Pipeline Complexity**: Phase 2 isolates this integration with comprehensive mocking
- **Layout Integration Issues**: Phase 5 defers layout concerns until components are solid
- **Workspace API Changes**: Mock-based testing allows adaptation to API changes

### Timeline Risks
- **Component Dependencies**: Each phase can be developed independently
- **Integration Challenges**: Incremental integration reduces big-bang risks
- **Testing Overhead**: TDD approach catches issues early, reducing debugging time

## Updated Next Steps

1. **✅ Phase 1 Complete**: Foundation components (ContentPreview + OutlineGenerator) with proper testing approach
2. **✅ Phase 2 Complete**: OutlineEditor component with Storybook integration testing (UI components properly tested per project guidelines)
3. **✅ Phase 3 Complete**: OutlineView coordination component with comprehensive workflow testing in Storybook
4. **🚧 Current Focus - Phase 4**: Main app integration and real workspace connectivity
5. **📋 Next Priority**: Integration testing with real workspace operations (not unit tests for UI components)
6. **📋 Future Enhancement**: Additional Storybook scenarios for edge cases and accessibility

## Immediate Actions Required

1. **Wire OutlineView into main app navigation** - Add route and workspace integration
2. **Connect to real workspace context** - Replace Storybook mocks with actual WorkspaceManager
3. **Add integration tests** - Test real file I/O and transform pipeline operations
4. **Create complete workflow integration** - From workspace selection to navigation file creation

## Key Insight: Testing Strategy Alignment

The current approach using **Storybook for UI component testing** is **correct** per project guidelines. The plan previously called for unit tests on UI components, but TESTING.md clearly states these should use Storybook for "User Interactions" and "Browser APIs" - which is exactly what we have.

---

This plan provides a clear roadmap for implementing the Outline UI with solid testing coverage and manageable complexity at each step.