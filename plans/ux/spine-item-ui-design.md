# Spine Item UI/UX Design Document

## Overview & Objectives

The Spine Item UI provides comprehensive management of EPUB reading order through a dedicated sidebar interface that replaces the current placeholder content. This design leverages the fully-implemented SpineItemManager API to deliver a seamless chapter management experience.

### High-Level Description

The Spine Item UI consists of a single, complete interface:

1. **Sidebar Spine Panel**: Complete chapter management interface integrated into the left sidebar, providing all spine operations including navigation, reordering, creation, and validation
2. **Main View**: Shows the currently selected spine item's content/editor (separate design document)

### Core Functionality

The sidebar provides access to all SpineItemManager capabilities:

- **Visual Spine Listing**: Display spine items with chapter IDs in reading order
- **Drag-and-Drop Reordering**: Intuitive reordering with drag handles (expanded sidebar only)
- **Chapter Creation**: Append new chapters with auto-generated IDs
- **Chapter Selection**: Click to select for main view editing
- **Real-Time Validation**: Compact error indicators for validation issues
- **Workspace Integration**: Seamless coordination with workspace state and main view

### Current Implementation Status

**Completed:**

- ✅ SpineItemManager API with comprehensive functionality
- ✅ Sidebar infrastructure with spine slot (`slot="sidebar-spine"`)
- ✅ Main view infrastructure with spine placeholder
- ✅ Layout system with responsive design support

**To Be Implemented:**

- 🔲 Sidebar spine item list component
- 🔲 Drag-and-drop interaction system with handles
- 🔲 Chapter creation (append button)
- 🔲 Minimal validation feedback UI
- 🔲 Chapter selection for main view integration

## Key Design Questions

### 1. Interface Architecture ✅ **RESOLVED**

**Decision:** Sidebar is the complete spine management interface. Main view shows the currently selected spine item's content/editor.

**Rationale:** Clear separation of concerns - sidebar handles structural spine operations, main view handles individual item content editing.

**Implementation:**

- Sidebar: All spine operations (create, reorder, select, validate)
- Main view: Single item content editing (separate design document)
- Real-time coordination between interfaces

### 2. Drag-and-Drop Interaction Design ✅ **RESOLVED**

**Decision:** Dedicated drag handles when sidebar is expanded, no reordering when collapsed.

**Implementation:**

- **Expanded Sidebar**: Drag handles visible, full reordering capability
- **Collapsed Sidebar**: Navigation only, no reordering
- **Touch Support**: Drag handles work on both desktop and mobile
- **No Multi-select**: Single item drag operations only
- **Move Button Support**: Up/Down buttons for keyboard accessibility

### 3. Information Architecture & Display ✅ **RESOLVED**

**Decision:** Minimal information display focused on essential spine management.

**Display Elements:**

- **Primary Label**: Chapter ID only (chapter1, chapter2, etc.)
- **Drag Handle**: When sidebar expanded
- **Validation Status**: ⚠️ icon only when errors exist (no indicator for valid items)
- **No Source File Status**: Not displayed
- **No Linear/Non-linear Status**: Not displayed
- **No Advanced Properties**: Deferred to main view design

### 4. Visual Design & Status Indicators ✅ **RESOLVED**

**Decision:** Minimal status indicators with focus on validation errors only.

**Status Indicators:**

- **Validation Errors**: ⚠️ icon when errors exist
- **Valid Items**: No indicator (clean list)
- **No Source File Status**: Not displayed
- **No Linear/Non-linear Status**: Not displayed
- **No Hover Tooltips**: No additional information on hover

**Interaction States:**

- **Selection**: Visual highlight for currently selected item
- **Hover**: Standard interactive element feedback
- **Focus**: Accessibility-compliant focus styles
- **Drag Feedback**: Visual feedback during drag operations

### 5. Error Handling & Validation Feedback ✅ **RESOLVED**

**Decision:** Minimal, non-intrusive error indication.

**Error Display:**

- **Single Indicator**: ⚠️ icon for any validation error
- **No Error Details**: No hover tooltips or detailed messages
- **No Summary**: No overall validation status display
- **No Recovery Actions**: No undo/redo or auto-fix in sidebar

**Error Types Handled:**

- All validation errors use the same ⚠️ indicator
- Error details available through main view or other interfaces
- Focus on visual indication rather than detailed feedback

### 6. Responsive Design & Accessibility ✅ **RESOLVED**

**Decision:** Progressive enhancement based on sidebar state with dual interaction approach for accessibility.

**Responsive Design:**

- **Expanded Sidebar**: Full functionality with drag handles
- **Collapsed Sidebar**: Navigation only, no reordering
- **Touch Targets**: Minimum 44px for all interactive elements
- **Mobile Optimized**: Drag handles work on touch devices

**Accessibility - Dual Interaction Approach:**

- **Mouse/Touch Users**: Drag handles for intuitive reordering
- **Keyboard Users**: Move Up/Down buttons appear on selected item only
- **Screen Reader Support**: Proper ARIA labels and position announcements
- **Button States**: Move buttons disabled when at first/last position
- **Focus Management**: Proper focus handling after move operations
- **Clean UI**: No accessibility clutter - buttons only visible when needed

**Accessibility Implementation:**

- **Move Button Labels**: "Move [Chapter ID] up" / "Move [Chapter ID] down"
- **Position Announcements**: "[Chapter ID] moved to position X of Y"
- **Button Visibility**: Only on selected item, maintains clean design
- **High Contrast**: Design system compatibility for all interactive elements

### 7. Integration with Other Views ✅ **RESOLVED**

**Decision:** Simple selection-based coordination with main view.

**Main View Integration:**

- **Selection**: Click spine item to open in main view for editing
- **Creation**: New chapters automatically selected for editing
- **Real-time Updates**: Spine changes immediately reflected in main view

**Workspace Coordination:**

- **Immediate Operations**: Spine operations are immediately persistent
- **Validation**: Real-time validation with ⚠️ indicators
- **State Management**: Seamless workspace state coordination

## Final Design Specification

### Sidebar Interface Components

**Spine Item List:**

- Drag handle (expanded sidebar only)
- Chapter ID as primary label
- Validation error indicator (⚠️ when errors exist)
- Click to select for main view editing
- Visual selection highlight for current item
- **Move buttons** (Up/Down) appear on selected item only
- **Accessibility**: ARIA labels and keyboard navigation support

**Append Button:**

- "Append Item" button at bottom of list
- Auto-generates sequential chapter ID
- Immediately selects new chapter for main view editing

**Responsive States:**

- **Expanded**: Full management capabilities with drag handles
- **Collapsed**: Navigation only, no reordering

### Interaction Model

**Primary Interactions:**

- **Drag Handles**: Mouse/touch reordering (expanded sidebar)
- **Move Buttons**: Keyboard accessible reordering (selected item only)
- **Click Selection**: Item selection for main view editing
- **Append Button**: New chapter creation

**Design Constraints:**

- **No Context Menus**: All operations through direct interaction
- **No Global Keyboard Shortcuts**: Interaction through focused elements only
- **No Hover Tooltips**: Clean, minimal feedback
- **No Additional Status**: Focus on essential validation only

**Accessibility Features:**

- **Dual Approach**: Drag handles + move buttons for comprehensive access
- **Contextual Buttons**: Move buttons appear only on selected items
- **Screen Reader Support**: Proper announcements and ARIA labels
- **Focus Management**: Logical tab order and focus handling

---

## Implementation Requirements

### Component Structure

**SpineSidebar.svelte:**

- Spine item list with drag handles
- Append button for new chapters
- Selection state management
- Validation error display

**SpineItem.svelte:**

- Individual spine item component
- Drag handle integration
- ID display and selection handling
- Error indicator when needed
- **Conditional Move Buttons**: Up/Down buttons when item is selected
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Button State Management**: Disabled states for first/last items

### Integration Points

**SpineItemManager API:**

- Use existing methods for all operations
- Real-time validation integration
- Workspace state coordination

**Main View Coordination:**

- Selection event handling
- New chapter creation workflow
- State synchronization

### Next Steps

1. Implement SpineSidebar component structure
2. Add drag-and-drop functionality with accessibility support
3. Implement conditional move buttons for selected items
4. Add proper ARIA labels and screen reader announcements
5. Integrate with SpineItemManager API
6. Add validation error display
7. Implement main view selection coordination
8. Test keyboard navigation and screen reader compatibility
