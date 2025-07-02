# Spine Item UI/UX Design Document

## Overview & Objectives

The Spine Item UI provides comprehensive management of EPUB reading order through two coordinated interfaces that replace the current placeholder content in the application. This design leverages the fully-implemented SpineItemManager API to deliver a seamless chapter management experience.

### High-Level Description

The Spine Item UI consists of two interconnected components:

1. **Sidebar Spine Panel**: Compact chapter list integrated into the left sidebar, providing quick access to spine navigation and basic reordering capabilities
2. **Main Spine View**: Detailed management interface in the main content area, offering full CRUD operations, validation feedback, and advanced spine management features

### Core Functionality

The UI provides access to all SpineItemManager capabilities:
- **Visual Spine Listing**: Display spine items with clear indication of reading order
- **Drag-and-Drop Reordering**: Intuitive reordering with visual feedback and touch support
- **Chapter CRUD Operations**: Create, read, update, and delete chapters with proper validation
- **Source File Association**: Visual indication of SOURCE/text/{id}.txt file presence and management
- **Real-Time Validation**: Live feedback on spine consistency and structural errors
- **Workspace Integration**: Seamless coordination with workspace state and other views

### Current Implementation Status

**Completed:**
- ✅ SpineItemManager API with comprehensive functionality
- ✅ Sidebar infrastructure with spine slot (`slot="sidebar-spine"`)
- ✅ Main view infrastructure with spine placeholder
- ✅ Layout system with responsive design support

**To Be Implemented:**
- 🔲 Sidebar spine item list component
- 🔲 Main spine management view component
- 🔲 Drag-and-drop interaction system
- 🔲 Chapter creation/editing forms
- 🔲 Validation feedback UI
- 🔲 Source file status indicators

## Key Design Questions

### 1. Interface Distribution & Responsibility

**Primary Question:** How should functionality be distributed between the sidebar and main view?

**Options to Consider:**
- **Option A**: Sidebar for navigation/overview, main view for detailed management
- **Option B**: Parallel interfaces with different levels of detail
- **Option C**: Context-dependent functionality based on user intent

**Specific Questions:**
- Should the sidebar show read-only overview while main view handles editing?
- Can users perform basic operations (reorder, rename) directly in the sidebar?
- How should actions in one interface update the other in real-time?
- Should both interfaces support drag-and-drop, or only the main view?

### 2. Drag-and-Drop Interaction Design

**Primary Question:** How should drag-and-drop reordering work across different contexts and devices?

**Desktop Considerations:**
- Visual feedback during drag (ghost elements, drop zones, insertion indicators)
- Multi-select support for moving multiple chapters at once
- Keyboard accessibility for drag operations (arrow keys, cut/paste)

**Mobile/Touch Considerations:**
- Long-press to initiate drag vs dedicated drag handles
- Touch-friendly drop zones and visual feedback
- Alternative interaction patterns for devices without precise pointing

**Cross-Interface Questions:**
- Can users drag from sidebar to main view or vice versa?
- How to handle drag operations between collapsed/expanded sidebar states?
- Should drag operations be atomic or allow for cancellation?

### 3. Information Architecture & Display

**Primary Question:** What information should be displayed and how should it be organized?

**Chapter Identification:**
- Show chapter ID (chapter1, chapter2) vs title vs filename?
- How to handle long titles in compact sidebar display?
- Should there be primary/secondary information hierarchy?

**Source File Status:**
- How to indicate presence/absence of SOURCE/text/{id}.txt files?
- Visual distinction between chapters with/without source files?
- Should missing source files be treated as warnings or informational?

**Spine Properties:**
- Display linear/non-linear status visually or textually?
- How to show EPUB properties (page-spread-left, etc.) if present?
- Should advanced properties be hidden in sidebar, shown in main view?

### 4. Visual Design & Status Indicators

**Primary Question:** How should different states and properties be communicated visually?

**Status Indicators Needed:**
- ✅ Chapter has source file / ❌ Missing source file
- 📖 Linear reading order / 📄 Non-linear (reference material)
- ⚠️ Validation errors / ✓ Valid spine item
- 🏗️ Currently being edited / 👁️ Read-only view

**Visual Hierarchy:**
- How to maintain readability in compact sidebar view?
- Should status use icons, colors, typography, or combinations?
- How to ensure accessibility with color-blind users and high contrast modes?

**Interaction States:**
- Hover effects for interactive elements
- Focus styles for keyboard navigation
- Selection states for multi-select operations
- Drag feedback (ghost elements, insertion lines)

### 5. Error Handling & Validation Feedback

**Primary Question:** How should validation errors and operation failures be communicated?

**Validation Error Display:**
- Inline indicators on problematic spine items?
- Centralized validation panel showing all issues?
- Toast notifications for real-time validation updates?

**Error Types to Handle:**
- Missing manifest items referenced by spine
- Duplicate spine items
- Orphaned manifest items not in spine
- File system errors (missing XHTML or source files)
- Network/storage operation failures

**Recovery Actions:**
- Undo/redo for accidental operations
- Auto-fix suggestions for common validation errors
- Batch operations for resolving multiple issues

### 6. Responsive Design & Accessibility

**Primary Question:** How should the interface adapt to different screen sizes and accessibility needs?

**Responsive Considerations:**
- Sidebar collapse behavior on mobile devices
- Touch-friendly interaction targets (minimum 44px)
- Alternative layouts for very narrow screens
- Scroll behavior for long chapter lists

**Accessibility Requirements:**
- Screen reader support for drag-and-drop operations
- Keyboard navigation for all interactive elements
- High contrast mode compatibility
- Focus management during modal operations
- ARIA labels for status indicators and actions

### 7. Integration with Other Views

**Primary Question:** How should spine management coordinate with other application features?

**Cross-View Synchronization:**
- Should spine changes immediately update Navigation (TOC) view?
- How to handle conflicts between spine order and navigation structure?
- Should preview pane update in real-time during reordering?

**Workspace State Management:**
- How to handle unsaved changes during spine operations?
- Should spine operations be immediately persistent or batched?
- How to coordinate with workspace validation and error states?

**User Workflow Integration:**
- Should creating a new chapter automatically open it for editing?
- How to transition between spine management and content editing?
- Should spine view show content preview or focus purely on structure?

## Preliminary Design Direction

Based on the application's current architecture and user needs, I propose the following initial direction (subject to your feedback):

### Two-Tier Interface Model

**Sidebar Panel (Navigation-Focused):**
- Compact list showing chapter order and basic status
- Simple drag-and-drop reordering
- Click to navigate/select chapters
- Basic context menu for common actions
- Visual indicators for source files and validation status

**Main View (Management-Focused):**
- Detailed spine management with full CRUD operations
- Comprehensive validation feedback and error resolution
- Advanced reordering with multi-select support
- Chapter creation/editing forms integrated into the interface
- Source file management and preview capabilities

### Mobile-First Interaction Design

- Touch-friendly drag handles in both interfaces
- Long-press context menus for secondary actions
- Responsive layout that gracefully handles sidebar collapse
- Alternative interaction patterns for accessibility

### Real-Time Validation Integration

- Live validation feedback using SpineItemManager.validateSpineOrder()
- Non-intrusive error indicators with detailed explanations on hover/focus
- Suggested fixes for common validation errors
- Batch resolution tools for multiple issues

---

## Next Steps

**I need your input on these key decisions:**

1. **Interface Responsibility**: Should sidebar be read-only navigation while main view handles editing, or should both support editing with different levels of detail?

2. **Drag-and-Drop Scope**: Should both interfaces support drag-and-drop, or focus it in the main view for better mobile experience?

3. **Information Priority**: What's the most important information to show in the compact sidebar view - titles, IDs, or status indicators?

4. **Error Handling Approach**: Preference for inline validation feedback vs centralized error panel vs a combination?

5. **Mobile Strategy**: Should we prioritize touch-first design or desktop-first with mobile adaptations?

Please share your thoughts on these questions, and I'll develop the detailed design specifications and component requirements based on your preferences.