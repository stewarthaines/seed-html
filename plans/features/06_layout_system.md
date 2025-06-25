# Feature 06: Layout System

## Overview

The Layout System provides the core UI structure for the EDITME.html EPUB editor with a collapsible sidebar, resizable main content panes, and persistent state management. This feature implements a responsive layout that maximizes space for content editing and preview while providing easy access to workspace navigation and settings.

Based on user requirements:

- Maximize main content space, header only in left sidebar, no right sidebar
- Sidebar: workspace switcher, metadata, manifest, navigation (toc), spine items, settings (bottom)
- Two panes left/right split with draggable border resize
- 250px sidebar when expanded, collapsed state with icons
- 50/50 initial split, 250px right minimum, 25% left minimum
- localStorage persistence, visible drag handle, live resize, unicode icons

## Component Architecture

### Core Components

#### LayoutManager

Main layout controller that orchestrates all layout components and manages global layout state.

```typescript
interface LayoutManagerConfig {
  initialSidebarState: 'expanded' | 'collapsed';
  initialSplitRatio: number; // 0.0 to 1.0, default 0.5
  minLeftPaneRatio: number; // 0.25 (25% minimum)
  minRightPaneWidth: number; // 250px minimum
  sidebarWidth: number; // 250px when expanded
}
```

#### Sidebar

Collapsible left sidebar containing workspace navigation and controls.

```typescript
interface SidebarState {
  isExpanded: boolean;
  width: number;
  activeSection: 'workspace' | 'metadata' | 'manifest' | 'nav' | 'spine' | 'settings';
}

interface SidebarSection {
  id: string;
  icon: string; // Unicode symbol
  label: string;
  component?: any; // Svelte component for content
}

const SIDEBAR_SECTIONS: SidebarSection[] = [
  { id: 'workspace', icon: '🏠', label: 'Workspace' },
  { id: 'metadata', icon: '📄', label: 'Metadata' },
  { id: 'manifest', icon: '📋', label: 'Manifest' },
  { id: 'nav', icon: '📖', label: 'Navigation' },
  { id: 'spine', icon: '📖', label: 'Spine Items' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];
```

#### ContentPanes

Resizable left/right split panes for editing and preview content.

```typescript
interface ContentPanesState {
  splitRatio: number; // 0.0 (all left) to 1.0 (all right)
  leftMinRatio: number; // 0.25 (25% minimum)
  rightMinWidth: number; // 250px minimum
  isDragging: boolean;
}
```

#### PaneForge Integration

Resizable content panes implemented using PaneForge library components.

```typescript
// PaneForge components used:
// - PaneGroup: Container for resizable panes
// - Pane: Individual resizable pane
// - PaneResizer: Draggable resize handle between panes

interface PaneForgeConfig {
  direction: 'horizontal' | 'vertical';
  autoSaveId: string; // localStorage key for persistence
  minSize: number; // Minimum pane size percentage
  maxSize: number; // Maximum pane size percentage
  defaultSize: number; // Initial pane size percentage
}
```

## State Management

### Layout Store

Svelte store managing global layout state with localStorage persistence.

```typescript
interface LayoutStore {
  sidebar: SidebarState;
  contentPanes: ContentPanesState;
  isInitialized: boolean;
}

// Store actions
interface LayoutActions {
  toggleSidebar(): void;
  setSidebarSection(section: string): void;
  updateSplitRatio(ratio: number): void;
  initializeFromStorage(): void;
  persistToStorage(): void;
}
```

### Persistence Keys

- `editme_sidebar_expanded`: boolean (start expanded)
- `editme_content_split_ratio`: number (0.0-1.0, default 0.5)

## Requirements

### Core Requirements

- Collapsible left sidebar (no right sidebar)
- Resizable main content panes with mouse and touch support
- Minimum/maximum panel sizes with specific constraints
- State persistence for panel positions across sessions

### Specific Measurements

- Sidebar: 250px when expanded, ~40px when collapsed (icons only)
- Content split: 50/50 initial, 25% left minimum, 250px right minimum
- Drag handle: Visible thick line (4px) with live resize
- Unicode icons for sidebar sections with immediate mode switching

### Dependencies

- **PaneForge** (`paneforge`) - Robust Svelte resizable pane component library
  - Provides nested pane groups for complex layouts
  - Built-in localStorage persistence for layout state
  - Touch and mouse drag support with customizable constraints
  - Part of svecosystem with active maintenance and comprehensive documentation
- Will integrate with future router and workspace systems via slots

## Technical Requirements

### Layout Structure

```
┌──────────────┬─────────────────────────────────┐
│   Sidebar    │        Content Panes            │
│ (250px)      │  ┌─────────────┬─────────────┐   │
│              │  │    Left     │    Right    │   │
│ 🏠 Workspace │  │    Pane     │    Pane     │   │
│ 📄 Metadata  │  │   (Editor)  │  (Preview)  │   │
│ 📋 Manifest  │  │             │             │   │
│ 📖 Navigation│  │             │             │   │
│ 📖 Spine     │  │             │             │   │
│ ⚙️ Settings  │  │             │             │   │
│              │  └─────────────┴─────────────┘   │
└──────────────┴─────────────────────────────────┘
```

### Collapsed State (~40px width for icons)

```
┌──┬──────────────────────────────────────────┐
│🏠│           Content Panes                  │
│📄│  ┌─────────────────┬─────────────────┐   │
│📋│  │    Left Pane    │   Right Pane    │   │
│📖│  │    (Editor)     │   (Preview)     │   │
│📖│  │                 │                 │   │
│⚙️│  │                 │    (250px min)  │   │
│▶️│  │   (25% min)     │                 │   │
└──┴──────────────────────────────────────────┘
```

## API Design

```typescript
interface LayoutSystem {
  // Sidebar management
  toggleSidebar(): void;
  setSidebarCollapsed(collapsed: boolean): void;
  getSidebarState(): boolean;
  setSidebarSection(section: string): void;

  // Panel resizing
  initializeResizer(element: HTMLElement): void;
  setSplitRatio(ratio: number): void;
  getSplitRatio(): number;
  getContentDimensions(): { leftWidth: number; rightWidth: number };

  // State persistence
  saveLayoutState(): void;
  loadLayoutState(): void;
  resetToDefaults(): void;
}

interface LayoutConfig {
  sidebarWidth: number; // 250px
  sidebarCollapsed: boolean; // false (start expanded)
  splitRatio: number; // 0.5 (50/50 split)
  minLeftRatio: number; // 0.25 (25% minimum)
  minRightWidth: number; // 250px minimum
}
```

## Layout Structure

```html
<div class="app-layout">
  <aside class="sidebar" class:collapsed="{sidebarCollapsed}">
    <div class="sidebar-header">
      <button class="sidebar-toggle" on:click="{toggleSidebar}">
        {sidebarCollapsed ? '▶️' : '◀️'}
      </button>
    </div>

    <nav class="sidebar-nav">
      {#each SIDEBAR_SECTIONS as section}
      <button
        class="sidebar-section"
        class:active="{activeSection"
        =""
        =""
        ="section.id}"
        on:click="{()"
        =""
      >
        setSidebarSection(section.id)} >
        <span class="section-icon">{section.icon}</span>
        {#if !sidebarCollapsed}
        <span class="section-label">{section.label}</span>
        {/if}
      </button>
      {/each}
    </nav>

    {#if !sidebarCollapsed}
    <div class="sidebar-content">
      <slot name="sidebar-{activeSection}" />
    </div>
    {/if}
  </aside>

  <main class="main-content">
    <div class="left-pane" style="width: {leftPaneWidth}px">
      <div class="pane-header">
        <slot name="left-header" />
      </div>
      <div class="pane-content">
        <slot name="left-content" />
      </div>
    </div>

    <div class="resize-handle" on:mousedown="{startResize}" on:touchstart="{startResize}">
      <div class="resize-line"></div>
    </div>

    <div class="right-pane" style="width: {rightPaneWidth}px">
      <div class="pane-header">
        <slot name="right-header" />
      </div>
      <div class="pane-content">
        <slot name="right-content" />
      </div>
    </div>
  </main>
</div>
```

## Content Integration via Slots

Components use Svelte slots for maximum flexibility:

```svelte
<!-- App.svelte usage -->
<LayoutManager>
  <svelte:fragment slot="sidebar-workspace">
    <WorkspaceSelector />
  </svelte:fragment>

  <svelte:fragment slot="sidebar-metadata">
    <MetadataEditor />
  </svelte:fragment>

  <svelte:fragment slot="left-content">
    <TextEditor />
  </svelte:fragment>

  <svelte:fragment slot="right-content">
    <PreviewPane />
  </svelte:fragment>
</LayoutManager>
```

## Resize Interaction Handling

### Mouse and Touch Support

- Mouse events: mousedown, mousemove, mouseup
- Touch events: touchstart, touchmove, touchend
- Unified event handling for both input types
- Prevent text selection and scrolling during resize

### Live Resize Behavior

- Real-time content reflow during drag operation
- Visual feedback with resize cursor
- Smooth drag experience without lag
- Constraints enforced during drag (minimums/maximums)

### Event Sequence

1. User starts drag (mousedown/touchstart)
2. Calculate initial positions and constraints
3. Track pointer movement (mousemove/touchmove)
4. Update split ratio in real-time
5. End drag operation (mouseup/touchend)
6. Persist final state to localStorage

## State Persistence

### localStorage Integration

Layout state persists across sessions using localStorage:

```typescript
interface PersistedLayoutState {
  sidebarExpanded: boolean;
  contentSplitRatio: number;
  // Note: activeSection not persisted - always starts with workspace
}

const STORAGE_KEYS = {
  SIDEBAR_EXPANDED: 'editme_sidebar_expanded',
  CONTENT_SPLIT_RATIO: 'editme_content_split_ratio',
} as const;

// Default state
const DEFAULT_STATE = {
  sidebarExpanded: true, // Start expanded
  contentSplitRatio: 0.5, // 50/50 split
};
```

### Initialization Sequence

1. Load persisted state from localStorage
2. Apply default values for missing keys
3. Validate loaded values (bounds checking)
4. Initialize layout components with resolved state

## CSS Implementation

### CSS Custom Properties

```css
:root {
  --sidebar-width: 250px;
  --sidebar-collapsed-width: 40px;
  --resize-handle-width: 4px;
  --content-pane-min-width: 200px;
  --preview-pane-min-width: 250px;

  /* Colors */
  --sidebar-bg: #f5f5f5;
  --sidebar-border: #ddd;
  --resize-handle-color: #ccc;
  --resize-handle-hover: #999;
  --resize-handle-active: #666;
}
```

### Grid Layout Structure

```css
.app-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  height: 100vh;
  width: 100vw;
}

.sidebar {
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  transition: width 0.2s ease;
  overflow: hidden;
}

.sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}

.main-content {
  display: flex;
  min-width: 0; /* Allow flex items to shrink */
}

.resize-handle {
  width: var(--resize-handle-width);
  background: var(--resize-handle-color);
  cursor: col-resize;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.resize-handle:hover {
  background: var(--resize-handle-hover);
}

.resize-handle.dragging {
  background: var(--resize-handle-active);
}

.resize-line {
  width: 2px;
  height: 100%;
  background: currentColor;
}
```

## Accessibility Features

### Keyboard Navigation

- Tab order: Sidebar toggle → Sidebar sections → Content panes → Resize handle
- Arrow keys: Navigate between sidebar sections
- Enter/Space: Activate buttons and toggles
- Escape: Close expanded sections or return focus

### Screen Reader Support

```html
<nav role="navigation" aria-label="Main navigation">
  <button aria-expanded="false" aria-controls="sidebar-content" aria-label="Toggle sidebar">
    {sidebarCollapsed ? '▶️' : '◀️'}
  </button>
</nav>

<div role="separator" aria-orientation="vertical" aria-label="Resize content panes" tabindex="0">
  <div class="resize-handle" />
</div>
```

### Focus Management

- Visible focus indicators on all interactive elements
- Focus remains on resize handle during drag operations
- Focus returns to trigger element after sidebar toggle

## Implementation Phases

### Phase 1: Core Structure (Priority: High)

- [ ] LayoutManager component with basic grid structure
- [ ] Sidebar component with expand/collapse functionality
- [ ] ContentPanes component with fixed 50/50 split
- [ ] Basic CSS layout and responsive behavior

### Phase 2: Interactive Features (Priority: High)

- [ ] ResizeHandle component with drag functionality
- [ ] Mouse and touch event handling
- [ ] Live resize with content reflow
- [ ] Split ratio calculations and constraint enforcement

### Phase 3: State Management (Priority: Medium)

- [ ] Layout store with reactive state
- [ ] localStorage persistence integration
- [ ] State initialization and validation
- [ ] Event system for component communication

### Phase 4: Content Integration (Priority: Medium)

- [ ] Slot-based content injection system
- [ ] Sidebar section management and switching
- [ ] Content pane header components
- [ ] Integration points for future router system

### Phase 5: Polish & Accessibility (Priority: Low)

- [ ] CSS custom properties and theming
- [ ] Accessibility features and ARIA labels
- [ ] Keyboard navigation support
- [ ] Visual polish and micro-interactions

## Testing Strategy

### Unit Tests

- Component rendering and props handling
- State management and persistence logic
- Event handling and custom events
- Accessibility features and ARIA attributes
- Split ratio calculations and constraints

### Integration Tests

- Sidebar expand/collapse with content switching
- Content pane resizing with live updates
- State persistence across component remounts
- Keyboard navigation and focus management
- Touch and mouse event handling

### Visual Tests (Storybook)

- All layout states and configurations
- Interactive resize demonstrations
- Sidebar section switching
- Responsive behavior at different viewport sizes
- Accessibility testing scenarios

## Performance Considerations

### Optimization Strategies

- CSS transitions for smooth state changes (no JavaScript animations)
- Throttled resize events during drag operations (requestAnimationFrame)
- Minimal DOM updates during live resize
- Efficient event listener management with proper cleanup

### Memory Management

- Event listeners properly cleaned up on component destroy
- localStorage operations batched to prevent excessive writes
- No memory leaks from drag event handlers
- Efficient constraint calculations

## Browser Compatibility

### Target Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS Grid and Flexbox support required
- Touch events for tablet/mobile interaction
- localStorage API required for persistence
- Pointer events preferred, mouse/touch fallback

### Graceful Degradation

- Falls back to default state if localStorage unavailable
- Mouse-only operation if touch events not supported
- Progressive enhancement approach

## Error Handling

### Robust Error Recovery

- Invalid layout state recovery with defaults
- Viewport size change adaptation
- Storage quota issues for state persistence
- Malformed saved layout data validation
- Drag operation interruption handling

### Edge Cases

- Very small viewport sizes
- Extreme split ratios
- Rapid sidebar toggling
- Concurrent resize operations
- Component unmounting during drag

## Future Integration Notes

### Router Integration

- Layout components designed to host routed content via slots
- Sidebar sections will integrate with navigation system
- Content panes will display different views based on route
- State management prepared for route-based layout changes

### Workspace Integration

- Sidebar workspace section will integrate with WorkspaceManager
- Layout state can be workspace-specific if needed
- Content panes sized appropriately for EPUB editing workflow

This comprehensive specification provides the foundation for implementing a robust, accessible, and user-friendly layout system that serves as the structural backbone for the entire EDITME.html application, meeting all specified user requirements while maintaining flexibility for future enhancements.
