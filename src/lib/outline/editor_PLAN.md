# Outline Editor Implementation Plan

## Overview

This document outlines the implementation plan for the Outline Editor UI components that enable users to create and edit EPUB navigation documents (table of contents). The implementation is based on the comprehensive API specification in `API_editor.md` and follows the project's feature development patterns.

## Project Context

### Related Documentation

- **API Specification**: `API_editor.md` - Complete component API and behavioral requirements
- **Backend Integration**: `API.md` - OutlineGenerator utility service documentation
- **Store Integration**: `../stores/text-editor-store-API.md` - Text editor state management
- **Storybook Patterns**: `../../stories/` - Reference implementations and testing patterns

### System Integration

The Outline Editor integrates with several existing systems:

- **TextEditorStore**: General-purpose text editor state management for content storage
- **OutlineGenerator**: Utility service for EPUB navigation generation and processing
- **Transform Pipeline**: Content transformation from plain text to XHTML
- **WorkspaceManager**: File I/O operations for saving navigation content
- **LayoutManager**: UI layout integration for editor/preview panes

## Implementation Strategy

### Development Approach

- **Pattern**: Feature Development Pattern with real backend integration
- **Story Organization**: `'Components/Outline/Editor'`
- **Testing Strategy**: Storybook-driven development with accessibility-first focus
- **Backend Integration**: Real APIs (not mocks) for authentic UX testing

### Architecture Principles

1. **Store-Based State Management**: Use TextEditorStore for efficient content handling
2. **Promise-Based Coordination**: Reliable async operation handling for focus management
3. **Accessibility-First**: Build keyboard navigation and screen reader support during development
4. **Real Backend Integration**: Test with actual APIs for authentic performance characteristics

## File Structure Plan

```
src/lib/outline/
├── API.md                        # OutlineGenerator API (existing)
├── outline-generator.js          # Utility service (existing)
├── API_editor.md                 # Component API specification (existing)
└── editor_PLAN.md               # This implementation plan

src/lib/components/outline/
├── OutlineEditor.svelte          # Core textarea editor component
├── OutlineView.svelte            # Coordination wrapper component
└── outline-editor.css            # Component-specific styles

src/stories/
├── OutlineEditorDemo.svelte      # Feature demo component
└── OutlineEditorDemo.stories.svelte # Story definitions with play functions

test/ (future)
├── OutlineEditor.test.ts         # Unit tests for editor component
└── OutlineView.test.ts          # Unit tests for view coordination
```

## Component Architecture

### OutlineEditor Component

**File**: `src/lib/components/outline/OutlineEditor.svelte`

**Responsibilities**:

- Textarea-based text editing with store integration
- Debounced change events (300ms) to prevent excessive transform calls
- Accessibility features (focus management, ARIA labeling, keyboard navigation)
- Synchronization with TextEditorStore state
- Lightweight event emission without content duplication

**Key Features**:

- Store subscription for textarea value synchronization
- Debounced `updateContent()` calls on user input
- `contentChanged` event emission with metadata (timestamp, isEmpty)
- CSS integration with design system tokens
- Responsive container sizing

### OutlineView Component

**File**: `src/lib/components/outline/OutlineView.svelte`

**Responsibilities**:

- Coordination between OutlineEditor, preview updates, and file operations
- Mode switching (auto-generation vs manual editing) based on content state
- Transform pipeline integration for XHTML preview generation
- File I/O operations (`nav.txt` and `nav.xhtml` saving)
- Error handling and user feedback

**Key Features**:

- Internal TextEditorStore creation and management
- Reactive content processing based on isEmpty state
- Public methods: `loadNavigationContent()`, `saveNavigationContent()`
- Event emission: `previewUpdate`, `error`
- Integration with OutlineGenerator utility methods

## Development Phases

### Phase 1: Component Architecture Setup

**Duration**: 1-2 development sessions

**Tasks**:

1. Create component file structure following separation pattern
2. Set up CSS with design system token integration
3. Create basic component shells with prop interfaces
4. Establish TypeScript interfaces matching API specification

**Deliverables**:

- `src/lib/components/outline/OutlineEditor.svelte` - Basic textarea with store integration
- `src/lib/components/outline/OutlineView.svelte` - Coordination wrapper with prop definitions
- `src/lib/components/outline/outline-editor.css` - Design system integration and responsive styles
- Basic TypeScript interfaces for props and events

### Phase 2: Real Backend Integration

**Duration**: 2-3 development sessions

**Tasks**:

1. Integrate TextEditorStore factory for content management
2. Connect OutlineGenerator utility methods for processing
3. Set up Transform Pipeline integration for preview generation
4. Implement WorkspaceManager integration for file operations
5. Create Storybook demo component with real backend initialization

**Deliverables**:

- Working store integration with content synchronization
- Real OutlineGenerator integration for both auto-generation and user content
- Transform Pipeline connection for XHTML preview updates
- `OutlineEditorDemo.svelte` with real backend initialization
- Basic Storybook story for interactive testing

### Phase 3: Accessibility-First Implementation

**Duration**: 2-3 development sessions

**Tasks**:

1. Implement comprehensive keyboard navigation support
2. Add Promise-based coordination for async operations and focus management
3. Integrate ARIA labeling and screen reader announcements
4. Implement fallback focus strategies for edge cases
5. Add proper focus indicators and high contrast support

**Deliverables**:

- Full keyboard navigation (Tab, Enter, Escape, Arrow keys)
- Promise-returning methods for reliable focus restoration
- ARIA integration with proper roles and labels
- Screen reader compatibility testing
- Design system focus indicator integration

### Phase 4: Storybook Demo Development

**Duration**: 2-3 development sessions

**Tasks**:

1. Create comprehensive demo component with realistic content
2. Implement demo reset functionality for clean testing
3. Add interactive controls for testing all functionality
4. Create realistic error scenarios for robust testing
5. Develop play functions for automated interaction testing

**Deliverables**:

- `OutlineEditorDemo.stories.svelte` with comprehensive story definitions
- Interactive demo with real workspace initialization
- Error simulation and recovery testing
- Play functions demonstrating user workflows
- Live preview integration showing XHTML generation

### Phase 5: Testing and Refinement

**Duration**: 1-2 development sessions

**Tasks**:

1. Comprehensive testing with play functions
2. Accessibility testing with keyboard navigation and screen readers
3. Performance testing with realistic content and operations
4. Error handling testing and user feedback refinement
5. Documentation updates and code review preparation

**Deliverables**:

- Comprehensive play function test coverage
- Accessibility compliance verification
- Performance optimization and testing
- Error handling robustness verification
- Updated documentation and implementation notes

## Technical Specifications

### Store Integration Pattern

```typescript
// src/lib/components/outline/OutlineView.svelte implementation pattern
const outlineStore = createTextEditorStore('outline-nav');

// React to store changes for transform processing
$: if ($outlineStore.lastUpdated) {
  handleContentChange($outlineStore.isEmpty);
}

async function handleContentChange(isEmpty: boolean) {
  if (isEmpty) {
    // Auto-generation from spine
    const result = OutlineGenerator.generateFromSpine(spineItems);
    dispatch('previewUpdate', { xhtml: result.xhtml });
  } else {
    // Process user content through transform pipeline
    const content = outlineStore.getContent();
    const result = await OutlineGenerator.processUserContent(
      content,
      workspaceId,
      'nav',
      transformPipeline
    );
    if (result.success) {
      dispatch('previewUpdate', {
        xhtml: result.xhtml,
        warnings: result.warnings,
      });
    } else {
      dispatch('error', {
        message: result.error.message,
        stage: 'transform',
      });
    }
  }
}
```

### Promise-Based Accessibility Pattern

```typescript
// Promise coordination for reliable focus management
export let onSave: () => Promise<void>;

async function handleSaveKeyboard(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    await onSave(); // Wait for operation to complete
    // Focus restoration happens after Promise resolves
    const statusElement = document.querySelector('[aria-live="polite"]');
    if (statusElement) {
      statusElement.textContent = 'Navigation saved successfully';
    }
  }
}
```

### Event Debouncing Implementation

```typescript
// src/lib/components/outline/OutlineEditor.svelte - Debounced content updates
let debounceTimer: number;

function handleTextareaInput(event: Event) {
  const target = event.target as HTMLTextAreaElement;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    store.updateContent(target.value);

    // Emit lightweight event without content duplication
    dispatch('contentChanged', {
      editorId: 'outline-nav',
      timestamp: Date.now(),
      isEmpty: target.value.trim() === '',
    });
  }, 300); // 300ms debounce per API specification
}
```

## Testing Strategy

### Storybook Testing Approach

- **Real Backend Integration**: Use actual APIs for authentic testing experience
- **Interactive Demos**: Manual testing of all user workflows
- **Play Functions**: Automated testing of key interaction patterns
- **Error Scenarios**: Realistic error conditions and recovery testing
- **Accessibility Testing**: Keyboard navigation and screen reader compatibility

### Test Scenarios

1. **Empty State**: Auto-generation from spine items
2. **Manual Editing**: User content processing through transform pipeline
3. **Mode Switching**: Transition between auto-generation and manual editing
4. **Save Operations**: File I/O with success and error conditions
5. **Accessibility**: Complete keyboard navigation workflows
6. **Error Recovery**: Transform failures and file operation errors

### Play Function Examples

```typescript
// Automated testing of user workflows
export const InteractiveDemo = {
  name: 'Interactive Demo',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for backend initialization
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test empty state (auto-generation)
    const editor = await canvas.findByRole('textbox');
    expect(editor.value).toBe('');

    // Test manual content entry
    await userEvent.type(editor, '# My Navigation\n\n## Chapter 1');
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for debounce

    // Verify preview update
    const preview = await canvas.findByTestId('xhtml-preview');
    expect(preview.innerHTML).toContain('<h1>My Navigation</h1>');

    // Test save operation
    const saveButton = await canvas.findByRole('button', { name: /save/i });
    await userEvent.click(saveButton);

    // Verify success feedback
    const status = await canvas.findByRole('status');
    expect(status.textContent).toContain('saved successfully');
  },
};
```

## Success Criteria

### Functional Requirements

- [✓] OutlineEditor component matches API specification exactly
- [✓] OutlineView component provides all documented methods and events
- [✓] Store integration works seamlessly with TextEditorStore
- [✓] Auto-generation and manual editing modes function correctly
- [✓] File operations save content to correct locations
- [✓] Transform pipeline integration generates proper XHTML

### Quality Requirements

- [✓] Zero TypeScript errors in all component code
- [✓] Comprehensive accessibility support (keyboard navigation, screen readers)
- [✓] Robust error handling for all failure scenarios
- [✓] Performance optimizations (debouncing, efficient updates)
- [✓] Design system integration with proper tokens and responsive behavior

### Testing Requirements

- [✓] Interactive Storybook demo with real backend integration
- [✓] Play functions covering all major user workflows
- [✓] Error scenario testing with realistic conditions
- [✓] Accessibility testing with keyboard-only navigation
- [✓] Cross-browser compatibility verification

## Risk Mitigation

### Technical Risks

- **Store Integration Complexity**: Use proven TextEditorStore patterns from existing implementations
- **Transform Pipeline Timing**: Implement Promise-based coordination for reliable operation sequencing
- **Accessibility Requirements**: Follow established patterns from SpineItem component development
- **Performance Concerns**: Use debouncing and caching strategies per API specification

### Development Risks

- **Interface Evolution**: Plan for component interface changes during development
- **Backend Integration**: Use real APIs early to catch integration issues
- **Complexity Management**: Keep components focused on single responsibilities
- **Testing Coverage**: Develop Storybook demos alongside component implementation

## Implementation Notes

### Design System Integration

- Use tokens from `src/styles/` for consistent styling
- Implement `--color-focus-ring` and `--focus-ring-width` for accessibility
- Support `prefers-reduced-motion` and `prefers-contrast` preferences
- Ensure minimum touch target compliance for mobile accessibility

### Performance Considerations

- 300ms debouncing on editor changes to prevent excessive transform calls
- Transform pipeline caching for repeated script executions
- Memory efficient content storage in TextEditorStore
- Incremental updates only when content actually changes

### Browser Compatibility

- Modern browsers only (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)
- Secure context required for file system features (HTTPS or localhost)
- Web Workers for transform script execution isolation
- Screen reader and high contrast mode compatibility

This implementation plan provides a comprehensive roadmap for creating production-ready outline editor components that meet all API specifications while following project best practices and accessibility standards.
