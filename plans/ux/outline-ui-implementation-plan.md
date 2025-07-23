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

#### 2.1 OutlineEditor Component
**Location**: `src/lib/outline/OutlineEditor.svelte`

**Test-First Approach:**
- Create `OutlineEditor.test.ts` with user interaction tests
- Test textarea input handling and event emission
- Test debouncing behavior
- Test empty state detection (`content.trim() === ''`)
- Test placeholder text display

**Implementation:**
- Simple textarea for `nav.txt` content editing
- Debounced input handling to prevent rapid saves
- Placeholder text explaining auto-generation when empty
- Event emission for content changes
- **Isolated**: Simple form component with clear interface

**Acceptance Criteria:**
- ✅ Textarea handles user input correctly
- ✅ Debounced events prevent excessive updates
- ✅ Empty state detection triggers auto-generation
- ✅ Placeholder text guides user behavior

**Estimated Time**: 2-3 days

### Phase 3: Coordination Layer

#### 3.1 OutlineView Integration Component
**Location**: `src/lib/outline/OutlineView.svelte`

**Test-First Approach:**
- Create `OutlineView.test.ts` with full integration mocking
- Test mode switching (empty → auto-gen, typing → manual)
- Test file I/O operations with workspace APIs
- Test coordination between editor and preview
- Test error state handling

**Implementation:**
- Coordinates OutlineEditor and NavigationPreview
- Manages auto-generation vs manual mode switching
- Handles workspace file operations for `nav.txt` and `nav.xhtml`
- Integrates with transform pipeline for user content
- Manages OPF manifest registration

**Dependencies**: 
- Mock `workspaceManager`
- Mock `spineItemManager`
- Mock `TransformPipeline`
- Real `OutlineEditor` and `NavigationPreview` components

**Acceptance Criteria:**
- ✅ Switches between auto-generation and manual modes
- ✅ Coordinates editor and preview updates
- ✅ Handles workspace file operations correctly
- ✅ Manages transform pipeline integration
- ✅ Registers navigation in OPF manifest

**Estimated Time**: 2-3 days

### Phase 4: Layout Integration

#### 4.1 LayoutManager Integration
**Location**: Integration with existing `LayoutManager.svelte`

**Test-First Approach:**
- Create integration test with real `LayoutManager`
- Test split-pane behavior and responsive layout
- Test left-content and right-content slot usage
- Test header integration

**Implementation:**
- Integrate OutlineView with LayoutManager slots
- Use `left-content` slot for OutlineEditor
- Use `right-content` slot for NavigationPreview
- Optional `left-header` for minimal controls
- Standard responsive behavior

**Integration Dependencies**: 
- Real `LayoutManager` component
- Real split-pane behavior

**Acceptance Criteria:**
- ✅ Proper LayoutManager slot integration
- ✅ Split-pane resizing works correctly
- ✅ Responsive layout behavior
- ✅ Consistent with other editing interfaces

**Estimated Time**: 1 day

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

### Week 2: Editor Component  
**Days 5-7**: OutlineEditor component
- TDD: Write user interaction and debouncing tests
- Implementation: Textarea with smart behavior
- Integration: Event-based interface design

### Week 3: System Integration
**Days 8-10**: OutlineView coordination
- TDD: Write full workflow integration tests
- Implementation: Component coordination and workspace I/O
- Integration: Real component assembly with mocked services

**Days 11**: LayoutManager integration
- TDD: Write layout integration tests
- Implementation: Slot-based integration
- Integration: Real layout system integration

## Testing Strategy

### Unit Testing
- Each component tested in isolation with mocked dependencies
- Focus on component behavior and interface contracts
- Comprehensive edge case coverage

### Integration Testing  
- Test component interactions with real implementations
- Verify workspace API integration
- Test transform pipeline integration

### End-to-End Testing
- Complete workflow testing (empty → auto-gen → manual → transform)
- Test error scenarios and recovery
- Verify EPUB compliance of generated navigation

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

## Next Steps

1. **✅ Phase 1.1 Complete**: ContentPreview component implemented with enhanced device simulation capabilities
2. **✅ Phase 1.2 Complete**: OutlineGenerator utility service implemented with comprehensive TDD approach
   - ✅ 39 unit tests covering all functionality (spine generation, user content processing, error handling)
   - ✅ Full transform pipeline integration with error handling and extension library support
   - ✅ EPUB-compliant navigation generation with proper namespaces and structure
   - ✅ Complete API documentation with usage examples
3. **✅ Testing Patterns Established**: TDD approach validated with comprehensive mock infrastructure
4. **Current Focus - Phase 2.1**: Implement OutlineEditor component for user text input
5. **Document API Contracts**: Define clear interfaces between components during development
6. **Regular Integration**: Test component interactions frequently as development progresses

---

This plan provides a clear roadmap for implementing the Outline UI with solid testing coverage and manageable complexity at each step.