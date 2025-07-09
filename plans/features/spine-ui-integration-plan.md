# Spine Item UI Integration Plan

## Overview

This document outlines the steps needed to integrate the recently implemented spine item UI components into the EDITME application. The spine item manager provides functionality for managing chapter ordering and organization within EPUB files.

## Current State

- **Implemented**:
  - `SpineItemManager` class (`src/lib/spine/spine-item-manager.ts`)
  - `SpineSidebar` component with Craigslist-inspired compact design
  - Backend functionality for spine item operations
- **Needs Integration**:
  - Connection to main app routing
  - Workspace state management
  - Main view for selected spine items
  - Event handling between sidebar and main view

## Integration Steps

### 1. Create Workspace State Management in App.svelte

**Purpose**: Establish centralized workspace management that can be shared between components.

**Tasks**:

- Import WorkspaceManager from `$lib/workspace`
- Create reactive workspace state:
  - `workspaceId` - Currently active workspace
  - `workspaceManager` - Instance of WorkspaceManager
- Initialize with a demo/test workspace for development
- Consider persisting workspace selection in localStorage

**Code Location**: `src/App.svelte`

### 2. Replace Spine Sidebar Placeholder

**Purpose**: Integrate the functional SpineSidebar component into the app layout.

**Tasks**:

- Import SpineSidebar component
- Replace placeholder content in the `sidebar-spine` slot
- Pass required props:
  - `workspaceId`
  - `workspaceManager`
  - `selectedItemId`
  - `isExpanded` (from layoutStore)
- Handle any initialization errors gracefully

**Code Location**: `src/App.svelte` (sidebar-spine slot)

### 3. Create SpineView Component for Main Area

**Purpose**: Provide a main view for displaying and editing selected spine items.

**Tasks**:

- Create `src/lib/navigation/views/SpineView.svelte`
- Features to include:
  - Display spine item metadata (title, position, etc.)
  - Show source file content if available
  - Basic editing capabilities for text content
  - Save functionality
  - Preview of transformed XHTML output
- Handle loading states and errors
- Apply consistent styling with design system

**Code Location**: `src/lib/navigation/views/SpineView.svelte` (new file)

### 4. Connect Selection Events

**Purpose**: Enable communication between sidebar and main view.

**Tasks**:

- Listen for `select-spine-item` events in App.svelte
- Update application state with selected item:
  - `selectedSpineItemId`
  - `selectedSpineItem` (full item data)
- Trigger navigation to spine view
- Consider implementing URL-based navigation (e.g., `/spine/{itemId}`)

**Code Location**: `src/App.svelte` (event handling)

### 5. Update App.svelte Main View Routing

**Purpose**: Display the appropriate view based on navigation state.

**Tasks**:

- Replace PlaceholderView for spine route with SpineView
- Pass selected spine item data to the view
- Handle case when no item is selected (show instructions or first item)
- Ensure smooth transitions between views

**Code Location**: `src/App.svelte` (main view routing logic)

### 6. Handle Sidebar Expanded State

**Purpose**: Ensure the compact sidebar design works correctly.

**Tasks**:

- Connect layoutStore sidebar state to SpineSidebar `isExpanded` prop
- Test compact mode functionality
- Ensure tooltips work in compact mode
- Verify touch targets remain accessible

**Code Location**: `src/App.svelte` (prop passing)

## Additional Considerations

### Error Handling

- Workspace loading failures
- Missing spine items
- Save operation failures
- Network/storage errors

### Performance

- Lazy load spine items for large EPUBs
- Debounce save operations
- Optimize re-renders on selection changes

### Testing

- Unit tests for state management
- Integration tests for event flow
- Storybook stories for different states
- E2E tests for full workflow

### Future Enhancements

- Drag-and-drop reordering in sidebar
- Bulk operations on multiple items
- Keyboard navigation shortcuts
- Undo/redo for spine operations

## Implementation Order

1. Start with workspace state management (foundation)
2. Integrate SpineSidebar (visible progress)
3. Create basic SpineView (minimum viable feature)
4. Connect events (make it interactive)
5. Polish routing and state handling
6. Add error handling and edge cases

## Success Criteria

- Users can see spine items in the sidebar
- Clicking an item shows its content in the main view
- Changes can be saved back to the workspace
- Compact sidebar mode works correctly
- No console errors during normal operation
- Passes accessibility checks

## Next Steps

1. Review and modify this plan as needed
2. Create implementation tasks in todo list
3. Begin with workspace state management
4. Test each integration step incrementally
