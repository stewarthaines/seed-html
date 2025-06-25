# Layout System API

## Overview

The Layout System provides the foundational UI structure for the EDITME EPUB editor with a collapsible sidebar, resizable content panes, and persistent state management. The system is built using Svelte's reactive patterns integrated with PaneForge for robust pane resizing functionality.

**Key Components:**

- `LayoutManager` - Main layout orchestrator with grid structure
- `Sidebar` - Collapsible navigation with 6 sections
- `layoutStore` - Reactive state management with localStorage persistence

## Core Classes and Components

### LayoutManager Component

The main layout container providing grid structure and PaneForge integration.

#### Props

```typescript
// No direct props - uses layout store for state
interface LayoutManagerSlots {
  'sidebar-workspace': any;
  'sidebar-metadata': any;
  'sidebar-manifest': any;
  'sidebar-nav': any;
  'sidebar-spine': any;
  'sidebar-settings': any;
  'left-content': any;
  'right-content': any;
  'left-header'?: any;
  'right-header'?: any;
}
```

**Usage:**

```svelte
<LayoutManager>
  <svelte:fragment slot="sidebar-workspace">
    <WorkspaceSelector />
  </svelte:fragment>

  <svelte:fragment slot="left-content">
    <TextEditor />
  </svelte:fragment>

  <svelte:fragment slot="right-content">
    <PreviewPane />
  </svelte:fragment>
</LayoutManager>
```

**Side Effects:**

- Creates CSS grid layout with reactive sidebar width
- Initializes PaneForge components with localStorage persistence
- Subscribes to layout store for state changes

### Sidebar Component

Collapsible navigation sidebar with section switching.

#### Props

```typescript
interface SidebarProps {
  isExpanded: boolean;
  activeSection: 'workspace' | 'metadata' | 'manifest' | 'nav' | 'spine' | 'settings';
}
```

**Input:**

- `isExpanded: boolean` - Controls sidebar collapsed/expanded state
- `activeSection: string` - Currently active sidebar section

**Output:** Component renders sidebar with navigation sections

**Side Effects:**

- Calls `layoutStore.toggleSidebar()` on toggle button click
- Calls `layoutStore.setSidebarSection()` on section button click
- Updates ARIA attributes for accessibility

**Usage:**

```svelte
<Sidebar
  isExpanded={$layoutStore.sidebar.isExpanded}
  activeSection={$layoutStore.sidebar.activeSection}
>
  <svelte:fragment slot="sidebar-workspace">
    <div>Workspace content</div>
  </svelte:fragment>
</Sidebar>
```

## State Management

### layoutStore

Svelte store managing global layout state with localStorage persistence.

#### Store State

```typescript
interface LayoutState {
  sidebar: {
    isExpanded: boolean; // true = 250px, false = 48px
    activeSection: string; // Current section: 'workspace' | 'metadata' | etc.
  };
  isInitialized: boolean; // Auto-initialized on store creation
}
```

#### Methods

#### initialize()

```typescript
initialize(): void
```

**Input:** None

**Output:** Updates store state with localStorage values or defaults

**Side Effects:**

- Reads from localStorage keys: `editme_sidebar_expanded`, `editme_sidebar_section`
- Sets `isInitialized` to `true`
- Handles localStorage errors gracefully with console warnings

**Usage:**

```typescript
import { layoutStore } from './stores/layout.js';

// Auto-initializes on import, but can be called manually
layoutStore.initialize();
```

**Error Handling:**

- Catches JSON parsing errors for malformed localStorage data
- Catches localStorage access errors (quota exceeded, unavailable)
- Falls back to default values on any error

#### toggleSidebar()

```typescript
toggleSidebar(): void
```

**Input:** None

**Output:** Toggles sidebar expanded/collapsed state

**Side Effects:**

- Updates store state (`isExpanded = !isExpanded`)
- Persists state to localStorage as JSON
- Triggers reactive updates in connected components

**Usage:**

```typescript
// In component
function handleToggle() {
  layoutStore.toggleSidebar();
}
```

#### setSidebarSection()

```typescript
setSidebarSection(section: string): void
```

**Input:**

- `section: string` - Target section ID ('workspace', 'metadata', 'manifest', 'nav', 'spine', 'settings')

**Output:** Updates active sidebar section

**Side Effects:**

- Updates store state with new active section
- Persists section to localStorage
- Triggers content switching in sidebar slots

**Usage:**

```typescript
// Switch to metadata section
layoutStore.setSidebarSection('metadata');
```

## PaneForge Integration

### Configuration

The layout system uses PaneForge components with specific configuration:

```typescript
interface PaneForgeConfig {
  direction: 'horizontal'; // Left/right split
  autoSaveId: 'editme-content-panes'; // localStorage persistence key
  defaultSize: 50; // 50% initial split
  minSize: 25; // 25% minimum for left pane
  // Right pane minimum handled by constraint calculation
}
```

### Constraints

- **Left Pane**: Minimum 25% of available width
- **Right Pane**: Minimum 250px absolute width
- **Initial Split**: 50/50 between left and right panes
- **Persistence**: Split ratio automatically saved to localStorage

### Styling Integration

PaneForge components are styled with global CSS selectors:

```css
:global([data-pane-resizer]) {
  background: #e0e0e0;
  width: 4px;
  cursor: col-resize;
  transition: background-color 0.2s ease;
}

:global([data-pane-resizer]:hover) {
  background: #ccc;
}

:global([data-pane-resizer][data-resize-handle-active]) {
  background: #999;
}
```

## Browser Compatibility

### Supported Features

- **CSS Grid**: Required for layout structure
- **localStorage**: Required for state persistence
- **Pointer Events**: Used by PaneForge for drag interactions
- **Touch Events**: Supported for tablet/mobile interaction
- **CSS Custom Properties**: Used for responsive sidebar width

### Graceful Degradation

- **localStorage Unavailable**: Falls back to default state, no persistence
- **Touch Events Missing**: Mouse-only interaction still works
- **CSS Grid Unsupported**: Layout falls back to flexbox patterns

### Browser Support Matrix

| Feature        | Chrome | Firefox | Safari   | Edge   |
| -------------- | ------ | ------- | -------- | ------ |
| CSS Grid       | ✅ 57+ | ✅ 52+  | ✅ 10.1+ | ✅ 16+ |
| localStorage   | ✅ 4+  | ✅ 3.5+ | ✅ 4+    | ✅ 8+  |
| Pointer Events | ✅ 55+ | ✅ 59+  | ✅ 13+   | ✅ 17+ |
| Touch Events   | ✅ 22+ | ✅ 18+  | ✅ 11+   | ✅ 17+ |

## Storage Keys

The layout system uses specific localStorage keys for persistence:

```typescript
const STORAGE_KEYS = {
  SIDEBAR_EXPANDED: 'editme_sidebar_expanded', // boolean as JSON
  SIDEBAR_SECTION: 'editme_sidebar_section', // string value
} as const;
```

**Key Details:**

- `editme_sidebar_expanded`: Stores `boolean` as JSON string (`"true"` / `"false"`)
- `editme_sidebar_section`: Stores section ID as plain string
- PaneForge uses `editme-content-panes` for split ratio persistence

## Common Integration Patterns

### Adding New Sidebar Section

1. **Update Section Configuration:**

```typescript
// In Sidebar.svelte
const SIDEBAR_SECTIONS = [
  // ... existing sections
  { id: 'newsection', icon: '📝', label: 'New Section' },
];
```

2. **Add Slot to LayoutManager:**

```svelte
<!-- In LayoutManager.svelte -->
<svelte:fragment slot="sidebar-newsection">
  <slot name="sidebar-newsection" />
</svelte:fragment>
```

3. **Add Content in App.svelte:**

```svelte
<LayoutManager>
  <svelte:fragment slot="sidebar-newsection">
    <NewSectionContent />
  </svelte:fragment>
</LayoutManager>
```

### Custom Content Pane Headers

```svelte
<LayoutManager>
  <svelte:fragment slot="left-header">
    <div class="pane-header">
      <h3>Text Editor</h3>
      <button>Save</button>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="right-header">
    <div class="pane-header">
      <h3>Preview</h3>
      <select>
        <option>iPhone</option>
        <option>iPad</option>
      </select>
    </div>
  </svelte:fragment>
</LayoutManager>
```

### Programmatic State Control

```typescript
import { layoutStore } from '$lib/stores/layout.js';
import { get } from 'svelte/store';

// Check current state
const currentState = get(layoutStore);
console.log('Sidebar expanded:', currentState.sidebar.isExpanded);

// Toggle sidebar
layoutStore.toggleSidebar();

// Switch to specific section
layoutStore.setSidebarSection('metadata');

// Subscribe to changes
const unsubscribe = layoutStore.subscribe(state => {
  console.log('Layout state changed:', state);
});

// Clean up subscription
onDestroy(unsubscribe);
```

## Testing Strategy

### Unit Testing Approach

**Store Logic Testing:**

- Focus on `layoutStore` business logic and state management
- Mock localStorage for consistent test environment
- Test error scenarios (localStorage unavailable, quota exceeded)
- Validate state persistence and recovery patterns

**UI Component Testing:**

- Use Storybook for visual testing and interaction verification
- Test responsive behavior and accessibility features
- Verify PaneForge integration and constraint enforcement

### Test Patterns

#### localStorage Mocking

```typescript
// In test files
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});
```

#### Error Simulation

```typescript
// Test localStorage errors
mockLocalStorage.getItem.mockImplementation(() => {
  throw new Error('localStorage unavailable');
});

// Test invalid JSON recovery
mockLocalStorage.getItem.mockReturnValue('invalid-json');
```

#### State Verification

```typescript
import { get } from 'svelte/store';
import { layoutStore } from './layout.js';

// Test state changes
layoutStore.toggleSidebar();
const state = get(layoutStore);
expect(state.sidebar.isExpanded).toBe(false);
```

### Storybook Visual Testing

**Interactive Demonstrations:**

- Sidebar expand/collapse behavior
- Section switching functionality
- Pane resizing with constraints
- Responsive layout adaptation

**Automated Play Functions:**

- Programmatic interaction testing
- Screenshot consistency verification
- Cross-browser behavior validation

## Performance Considerations

### Optimization Strategies

**CSS Transitions over JavaScript Animation:**

- Sidebar width changes use CSS `transition: width 0.2s ease`
- Avoids requestAnimationFrame overhead for simple state changes
- Provides smooth visual feedback without performance impact

**Reactive Updates:**

- Svelte's reactive statements (`$:`) minimize DOM updates
- Only grid template updates when sidebar state changes
- PaneForge handles resize optimization internally

**Memory Management:**

- Store subscriptions properly cleaned up in component lifecycle
- Event listeners managed by Svelte component system
- No manual DOM manipulation requiring cleanup

### Performance Metrics

- **Sidebar Toggle**: < 16ms (single frame)
- **Section Switch**: < 8ms (content swap only)
- **Pane Resize**: Throttled via PaneForge's requestAnimationFrame
- **State Persistence**: Synchronous localStorage writes

## Error Handling

### Robust Error Recovery

**localStorage Errors:**

```typescript
try {
  const value = localStorage.getItem(key);
  return value ? JSON.parse(value) : defaultValue;
} catch (error) {
  console.warn('Failed to load state:', error);
  return defaultValue;
}
```

**Invalid State Recovery:**

- Malformed JSON in localStorage → Use defaults
- Invalid section IDs → Reset to 'workspace'
- Missing localStorage → No persistence, runtime state only

**Component Error Boundaries:**

- Store initialization errors don't break layout
- PaneForge integration errors fall back to fixed layout
- Individual section content errors isolated to that section

### Edge Cases

**Rapid State Changes:**

- Multiple quick toggle events → Last state wins
- Concurrent section switches → Race condition safe
- Component unmounting during state change → No memory leaks

**Browser Limitations:**

- localStorage quota exceeded → Graceful degradation
- Private browsing mode → Runtime state only
- Unsupported CSS features → Progressive enhancement

**Viewport Constraints:**

- Very small screens → Minimum sizes enforced
- Ultra-wide screens → Maximum practical constraints
- Orientation changes → Layout adapts automatically

## Migration and Upgrade Notes

### Version Compatibility

**localStorage Schema:**

- Current format is forward-compatible
- Invalid formats automatically reset to defaults
- No migration scripts required for updates

**Component API Stability:**

- Slot names are stable and versioned
- Store interface maintains backward compatibility
- PaneForge dependency updates handled transparently

### Future Enhancement Hooks

**Extensibility Points:**

- Additional sidebar sections via configuration
- Custom pane layouts beyond left/right split
- Theme-aware color schemes
- Workspace-specific layout preferences

**Integration Readiness:**

- Router integration via slot content switching
- Workspace management via store subscription
- Theme system via CSS custom properties
- Multi-window support via shared state management

This comprehensive API documentation provides complete guidance for implementing, extending, and maintaining the layout system while ensuring robust error handling and optimal performance.
