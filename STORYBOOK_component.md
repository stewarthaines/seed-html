# Storybook Component Development Guide

This document captures the comprehensive process for developing UI components with Storybook stories, using the workspace management implementation as a reference example.

## Overview

The EDITME project uses Storybook for component development, testing, and documentation. This guide outlines the complete workflow from design specification to implementation, emphasizing the use of mock data sources to demonstrate component states.

## Development Process

### Phase 1: Design & Planning

#### 1. Create Design Specification

- **Location**: `plans/ux/{feature}-ui-design.md`
- **Content**: Comprehensive design document including:
  - Component hierarchy and responsibilities
  - User workflows and interaction patterns
  - Technical implementation requirements
  - Accessibility and responsive design guidelines
  - Integration patterns with existing systems

**Example**: See `plans/ux/workspaces-ui-design.md` for the workspace management specification.

#### 2. Analyze Existing Patterns

- Review similar components in `src/lib/components/`
- Study existing Storybook stories for patterns
- Check design system usage in `src/styles/`
- Understand integration points with backend systems

### Phase 2: Component Implementation

#### 3. Implement Component Hierarchy

Follow the **single-owner pattern**:

- **Parent component**: Owns data and business logic
- **Child components**: Receive props and emit events
- **Event flow**: Props down, events up

**Workspace Example Structure**:

```
WorkspaceView.svelte (owner)
├── CurrentWorkspaceBar.svelte
├── WorkspaceActionBar.svelte
└── WorkspaceList.svelte
    └── WorkspaceItem.svelte
```

#### 4. Component Implementation Guidelines

**File Structure**:

```
src/lib/components/{feature}/
├── ParentContainer.svelte
├── ComponentA.svelte
├── ComponentB.svelte
└── ComponentC.svelte
```

**Key Patterns**:

- Use design system tokens from `src/styles/`
- Implement accessibility features (ARIA labels, 44px touch targets)
- Follow responsive design principles
- Integrate with i18n using `$t()` pattern
- Use proper TypeScript interfaces for events and props

### Phase 3: Storybook Story Development

#### 5. Create Demo Component

- **Location**: `src/stories/{Feature}Demo.svelte`
- **Purpose**: Interactive demonstration with mock data
- **Features**:
  - Comprehensive mock data representing realistic scenarios
  - State controls for different component states
  - Event handling with console logging
  - Error state demonstrations

**Mock Data Strategy**:

```typescript
// Create realistic mock data
const mockWorkspaces: WorkspaceInfo[] = [
  {
    id: 'workspace-1',
    title: 'The Adventures of Tom Sawyer',
    author: 'Mark Twain',
    language: 'en',
    lastModified: new Date(Date.now() - 2 * 60 * 60 * 1000),
    fileCount: 15,
    totalSize: 2400000,
    epubVersion: '3.0',
  },
  // ... more variants
];

// Include edge cases and error states
const errorWorkspace: WorkspaceInfo = {
  id: 'workspace-error',
  title: 'Corrupted Project',
  // ... error state data
  hasError: true,
};
```

#### 6. Create Story File

- **Location**: `src/stories/{Feature}.stories.svelte`
- **Structure**: Multiple story variants demonstrating different states

**Story Variants to Include**:

```svelte
<Story name="Default">
  <FeatureDemo />
</Story>

<Story name="Empty State">
  <FeatureDemo showEmptyState={true} />
</Story>

<Story name="Loading State">
  <FeatureDemo showLoadingState={true} />
</Story>

<Story name="With Errors">
  <FeatureDemo showErrorStates={true} />
</Story>

<Story name="Mobile View">
  <div style="max-width: 375px; margin: 0 auto; border: 1px solid #ccc;">
    <FeatureDemo />
  </div>
</Story>
```

#### 7. Interactive Controls

Implement demo controls to test different states:

```svelte
<!-- Demo Controls -->
<div class="demo-controls">
  <h3>Demo Controls</h3>
  <div class="control-buttons">
    <button
      type="button"
      on:click={() => {
        showEmptyState = !showEmptyState;
        initializeData();
      }}
      class:active={showEmptyState}
    >
      Toggle Empty State
    </button>
    <!-- More controls -->
  </div>
</div>
```

### Phase 4: Documentation & Testing

#### 8. Comprehensive Documentation

Include detailed documentation in the story:

```javascript
parameters: {
  docs: {
    description: {
      component: `
# Component Name

Interactive demonstration of component capabilities.

## Features Demonstrated
- Feature initialization and configuration
- Core operations and state management
- Error handling with detailed logging

## Usage Instructions
1. Initialize: Component automatically initializes on load
2. Perform Operations: Click buttons to test functionality  
3. Monitor State: View real-time state and results

## Design System Integration
Components use the established design system:
- CSS design tokens for consistent styling
- Semantic HTML with proper ARIA labels
- 44px minimum touch targets for accessibility
      `;
    }
  }
}
```

#### 9. State Testing Strategy

Use Storybook for comprehensive state testing:

- **Happy Path**: Normal operation with valid data
- **Empty States**: No data or initialization scenarios
- **Loading States**: Async operations in progress
- **Error States**: Various error conditions and recovery
- **Edge Cases**: Boundary conditions and unusual data

#### 10. Browser Testing

Leverage Storybook's browser environment for:

- Real DOM interactions and event handling
- CSS rendering and responsive behavior
- Accessibility testing with screen readers
- Cross-browser compatibility verification

## Mock Data Best Practices

### Realistic Data Creation

```typescript
// Use realistic, varied data
const mockData = [
  // Normal cases
  { title: 'The Adventures of Tom Sawyer', author: 'Mark Twain' },
  { title: 'Technical Manual for Advanced Users', author: 'John Smith' },

  // International examples
  { title: 'الأسود يليق بك', author: 'أحلام مستغانمي', language: 'ar' },
  { title: 'Das Kapital', author: 'Karl Marx', language: 'de' },

  // Edge cases
  { title: 'Very Long Title That Tests Text Wrapping...', author: 'Long Name' },
  { title: 'Short', author: 'A' },
];
```

### State Management

```typescript
// Handle state transitions
const handleStateChange = (newState: ComponentState) => {
  console.log('State changed:', newState);
  // Update component props
  componentState = newState;
};

// Simulate async operations
const simulateAsyncOperation = async () => {
  loading = true;
  await new Promise(resolve => setTimeout(resolve, 1000));
  loading = false;
};
```

### Event Simulation

```typescript
// Simulate real user interactions
const handleUserAction = (actionType: string) => {
  console.log(`User action: ${actionType}`);

  // Dispatch events as real components would
  dispatch('actionPerformed', { actionType, timestamp: Date.now() });
};
```

## Integration Patterns

### Backend Integration

For components that integrate with backend services:

```typescript
// Mock backend responses
const mockBackendResponse = {
  success: true,
  data: mockData,
  timestamp: Date.now(),
};

// Simulate API calls
const simulateApiCall = async () => {
  loading = true;
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return mockBackendResponse;
  } catch (error) {
    throw new Error('Mock API error for testing');
  } finally {
    loading = false;
  }
};
```

### Event System Integration

```typescript
// Handle component events
const handleComponentEvent = (event: CustomEvent) => {
  console.log('Component event:', event.type, event.detail);

  // Update parent state
  if (event.type === 'itemSelected') {
    selectedItemId = event.detail.itemId;
  }
};
```

## Layout Testing

### Responsive Design

Test components at different viewport sizes:

```svelte
<!-- Mobile viewport test -->
<Story name="Mobile View">
  <div style="max-width: 375px; margin: 0 auto; border: 1px solid #ccc;">
    <ComponentDemo />
  </div>
</Story>

<!-- Tablet viewport test -->
<Story name="Tablet View">
  <div style="max-width: 768px; margin: 0 auto; border: 1px solid #ccc;">
    <ComponentDemo />
  </div>
</Story>
```

### Container Constraints

Test how components behave in constrained layouts:

```svelte
<!-- Narrow container -->
<div style="width: 200px; height: 400px; overflow: auto;">
  <ComponentDemo />
</div>

<!-- Fixed height container -->
<div style="height: 300px; overflow-y: auto;">
  <ComponentDemo />
</div>
```

## Quality Assurance

### Pre-Commit Checklist

Before committing component work:

- [ ] **TypeScript**: Zero errors (`npm run check`)
- [ ] **Accessibility**: ARIA labels, keyboard navigation, touch targets
- [ ] **Responsive**: Works on mobile, tablet, desktop
- [ ] **Design System**: Uses tokens from `src/styles/`
- [ ] **Internationalization**: All text uses `$t()` pattern
- [ ] **Error Handling**: Graceful degradation and error states
- [ ] **Mock Data**: Realistic, varied, includes edge cases
- [ ] **Documentation**: Comprehensive story documentation

### Story Quality Standards

Each story should demonstrate:

- **All component states** (loading, error, empty, populated)
- **Interactive behaviors** with console logging
- **Responsive design** across viewport sizes
- **Accessibility features** with proper ARIA
- **Error scenarios** and recovery mechanisms

## File Organization

### Component Files

```
src/lib/components/{feature}/
├── MainContainer.svelte      # Parent component with business logic
├── ComponentA.svelte         # Child component A
├── ComponentB.svelte         # Child component B
└── ComponentC.svelte         # Child component C
```

### Story Files

```
src/stories/
├── {Feature}Demo.svelte      # Interactive demo component
├── {Feature}.stories.svelte  # Story definitions
└── _templates/               # Template files for new stories
    ├── BackendFeatureDemo.template.stories.svelte
    └── BackendFeatureDemo.template.svelte
```

### Documentation

```
plans/ux/
└── {feature}-ui-design.md    # Design specification
```

## Example: Workspace Management Implementation

The workspace management system serves as a complete reference implementation:

**Components**: 5 components with clear hierarchy
**Stories**: Multiple variants (default, empty, loading, error, mobile)
**Mock Data**: Realistic workspace data with international examples
**States**: Comprehensive state coverage including edge cases
**Integration**: Full backend integration patterns with WorkspaceManager

**Files**:

- `plans/ux/workspaces-ui-design.md` - Design specification
- `src/lib/components/workspace/` - Component implementation
- `src/stories/WorkspaceComponents.stories.svelte` - Story definitions
- `src/stories/WorkspaceComponentsDemo.svelte` - Interactive demo

## Templates

Use the template files in `src/stories/_templates/` as starting points for new component stories:

- `BackendFeatureDemo.template.stories.svelte` - Story structure template
- `BackendFeatureDemo.template.svelte` - Demo component template

These templates include the established patterns for mock data, state management, and interactive controls.

## Conclusion

This workflow ensures that UI components are:

- **Well-designed** with comprehensive specifications
- **Properly implemented** following established patterns
- **Thoroughly tested** with realistic mock data scenarios
- **Fully documented** with interactive demonstrations
- **Quality assured** through multiple validation steps

The result is a robust component library with excellent developer experience and comprehensive testing coverage through Storybook's browser environment.
