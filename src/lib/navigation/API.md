# Navigation Router API Documentation

## Overview

The Navigation Router provides centralized navigation management for the EDITME EPUB editor, handling view switching, state persistence, and navigation guards. It extends the existing layout system to manage both sidebar sections and main content area routing.

### Main Classes

- **NavigationStore** - Core navigation state management with view history and data persistence
- **NavigationGuard** - Route guard system for preventing navigation with unsaved changes
- **ViewComponent** - Interface contract for all navigable view components

## Navigation Store API

### Core Navigation Methods

#### navigateTo()

```typescript
navigateTo(view: ViewType, options?: NavigationOptions): Promise<boolean>
```

**Input:**

- `view: ViewType` - Target view to navigate to (`'workspace' | 'metadata' | 'manifest' | 'navigation' | 'spine' | 'settings'`)
- `options?: NavigationOptions` - Optional navigation configuration
  - `force?: boolean` - Bypass navigation guards (default: false)
  - `replaceHistory?: boolean` - Replace current view in history instead of pushing (default: false)
  - `viewData?: any` - Initial data to set for the target view

**Output:** `Promise<boolean>` - Returns true if navigation succeeded, false if blocked by guards

**Side Effects:** Updates current view, modifies view history, saves state to localStorage, triggers view data cleanup

**Usage:**

```typescript
import { navigationStore } from '$lib/navigation';

// Basic navigation
await navigationStore.navigateTo('metadata');

// Navigation with initial data
await navigationStore.navigateTo('manifest', {
  viewData: { selectedFile: 'chapter1.xhtml' },
});

// Forced navigation (bypasses guards)
await navigationStore.navigateTo('workspace', { force: true });
```

#### canNavigate()

```typescript
canNavigate(targetView?: ViewType): Promise<boolean>
```

**Input:**

- `targetView?: ViewType` - Optional target view to check guards against

**Output:** `Promise<boolean>` - Returns true if navigation is allowed

**Side Effects:** Executes all registered navigation guards

**Usage:**

```typescript
// Check if any navigation is allowed
const canLeave = await navigationStore.canNavigate();

// Check navigation to specific view
const canGoToMetadata = await navigationStore.canNavigate('metadata');

if (canGoToMetadata) {
  await navigationStore.navigateTo('metadata');
}
```

#### goBack() / goForward()

```typescript
goBack(): Promise<boolean>
goForward(): Promise<boolean>
```

**Input:** None

**Output:** `Promise<boolean>` - Returns true if navigation succeeded

**Side Effects:** Navigates through view history, subject to navigation guards

**Usage:**

```typescript
// Navigate to previous view
await navigationStore.goBack();

// Navigate to next view (if available)
await navigationStore.goForward();
```

### View Data Management

#### setViewData()

```typescript
setViewData(view: ViewType, data: any): void
```

**Input:**

- `view: ViewType` - Target view to store data for
- `data: any` - Data to associate with the view (serializable objects only)

**Output:** None

**Side Effects:** Stores data in navigation state, triggers store reactivity

**Usage:**

```typescript
// Store form data for metadata view
navigationStore.setViewData('metadata', {
  title: 'My EPUB Book',
  author: 'Jane Doe',
  hasUnsavedChanges: true,
});

// Store file selection for manifest view
navigationStore.setViewData('manifest', {
  selectedItems: ['chapter1.xhtml', 'styles.css'],
  sortOrder: 'name',
});
```

#### getViewData()

```typescript
getViewData<T = any>(view: ViewType): T | null
```

**Input:**

- `view: ViewType` - View to retrieve data for

**Output:** `T | null` - Stored data for the view, or null if none exists

**Side Effects:** None

**Usage:**

```typescript
// Retrieve metadata form data
const metadataData = navigationStore.getViewData<MetadataFormData>('metadata');
if (metadataData?.hasUnsavedChanges) {
  // Handle unsaved changes
}

// Get current view data
const currentData = navigationStore.getViewData($navigationStore.currentView);
```

#### clearViewData()

```typescript
clearViewData(view: ViewType): void
```

**Input:**

- `view: ViewType` - View to clear data for

**Output:** None

**Side Effects:** Removes stored data, triggers store reactivity

**Usage:**

```typescript
// Clear data when saving is complete
navigationStore.clearViewData('metadata');

// Clear all data on workspace switch
Object.values(ViewType).forEach(view => navigationStore.clearViewData(view));
```

### Navigation Guards

#### addNavigationGuard()

```typescript
addNavigationGuard(guard: NavigationGuard): string
```

**Input:**

- `guard: NavigationGuard` - Function that returns boolean or Promise<boolean>

**Output:** `string` - Unique guard ID for later removal

**Side Effects:** Registers guard in navigation system

**Usage:**

```typescript
// Add guard for unsaved changes
const guardId = navigationStore.addNavigationGuard(async (from, to) => {
  const viewData = navigationStore.getViewData(from);
  if (viewData?.hasUnsavedChanges) {
    return confirm('You have unsaved changes. Continue?');
  }
  return true;
});

// Component-specific guard
const editorGuardId = navigationStore.addNavigationGuard(async () => {
  return await textEditor.checkSaved();
});
```

#### removeNavigationGuard()

```typescript
removeNavigationGuard(guardId: string): boolean
```

**Input:**

- `guardId: string` - ID returned from addNavigationGuard()

**Output:** `boolean` - True if guard was found and removed

**Side Effects:** Unregisters guard from navigation system

**Usage:**

```typescript
// Remove guard when component unmounts
onDestroy(() => {
  navigationStore.removeNavigationGuard(guardId);
});

// Conditional guard removal
if (allChangesSaved) {
  navigationStore.removeNavigationGuard(editorGuardId);
}
```

## View Component Contract

All navigable view components must implement the `ViewComponent` interface:

### Required Interface

```typescript
interface ViewComponent {
  // Component lifecycle
  onViewEnter?(data?: any): Promise<void> | void;
  onViewLeave?(): Promise<void> | void;

  // Data persistence
  getViewData?(): any;
  setViewData?(data: any): void;

  // Navigation integration
  canLeave?(): Promise<boolean> | boolean;
}
```

### Implementation Pattern

```svelte
<!-- MetadataView.svelte -->
<script lang="ts">
  import { navigationStore } from '$lib/navigation';
  import { onMount, onDestroy } from 'svelte';

  // Component implements ViewComponent interface
  let formData = { title: '', author: '', hasUnsavedChanges: false };
  let guardId: string;

  // Lifecycle methods
  export function onViewEnter(data?: any) {
    if (data) {
      formData = { ...formData, ...data };
    }
    // Restore saved data
    const saved = navigationStore.getViewData('metadata');
    if (saved) {
      formData = saved;
    }
  }

  export function onViewLeave() {
    // Save current state
    navigationStore.setViewData('metadata', formData);
  }

  export function getViewData() {
    return formData;
  }

  export function setViewData(data: any) {
    formData = { ...formData, ...data };
  }

  export async function canLeave(): Promise<boolean> {
    if (formData.hasUnsavedChanges) {
      return confirm('You have unsaved changes. Continue?');
    }
    return true;
  }

  onMount(() => {
    // Register navigation guard
    guardId = navigationStore.addNavigationGuard(canLeave);
  });

  onDestroy(() => {
    // Clean up guard
    if (guardId) {
      navigationStore.removeNavigationGuard(guardId);
    }
  });
</script>
```

## Type Definitions

### Core Types

```typescript
// Available views in the application
export type ViewType =
  | 'workspace' // Workspace selection and management
  | 'metadata' // EPUB metadata editing
  | 'manifest' // File listing and management
  | 'navigation' // Table of contents editing
  | 'spine' // Chapter ordering
  | 'settings'; // Application settings

// Navigation store state
export interface NavigationState {
  currentView: ViewType;
  previousView: ViewType | null;
  viewHistory: ViewType[];
  viewData: Partial<Record<ViewType, any>>;
  isTransitioning: boolean;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
}

// Navigation options
export interface NavigationOptions {
  force?: boolean;
  replaceHistory?: boolean;
  viewData?: any;
}

// Navigation guard function
export type NavigationGuard = (from: ViewType, to: ViewType) => boolean | Promise<boolean>;

// Store interface
export interface NavigationStore extends Writable<NavigationState> {
  navigateTo(view: ViewType, options?: NavigationOptions): Promise<boolean>;
  canNavigate(targetView?: ViewType): Promise<boolean>;
  goBack(): Promise<boolean>;
  goForward(): Promise<boolean>;
  setViewData(view: ViewType, data: any): void;
  getViewData<T = any>(view: ViewType): T | null;
  clearViewData(view: ViewType): void;
  addNavigationGuard(guard: NavigationGuard): string;
  removeNavigationGuard(guardId: string): boolean;
  initialize(): void;
}
```

### View-Specific Data Types

```typescript
// Metadata view data
export interface MetadataViewData {
  title: string;
  author: string;
  language: string;
  identifier: string;
  hasUnsavedChanges: boolean;
}

// Manifest view data
export interface ManifestViewData {
  selectedItems: string[];
  sortOrder: 'name' | 'type' | 'modified';
  searchQuery: string;
}

// Spine view data
export interface SpineViewData {
  selectedChapter: string | null;
  draggedItem: string | null;
}
```

## Error Handling

### Navigation Failures

The navigation system handles several error scenarios gracefully:

#### Guard Rejection

```typescript
// Navigation blocked by guard
const success = await navigationStore.navigateTo('metadata');
if (!success) {
  console.log('Navigation was blocked by guard');
  // Handle blocked navigation (show message, stay on current view)
}
```

#### Invalid View

```typescript
try {
  await navigationStore.navigateTo('invalid-view' as ViewType);
} catch (error) {
  console.error('Invalid view type:', error);
  // Fallback to default view
  await navigationStore.navigateTo('workspace');
}
```

#### localStorage Failures

```typescript
// Navigation store handles localStorage errors gracefully
// Falls back to in-memory state if persistence fails
// Logs warnings but continues operation
```

### Common Error Patterns

```typescript
// Safe navigation with error handling
async function safeNavigate(view: ViewType) {
  try {
    const canNav = await navigationStore.canNavigate(view);
    if (!canNav) {
      showMessage('Cannot navigate: unsaved changes');
      return false;
    }

    const success = await navigationStore.navigateTo(view);
    if (!success) {
      showMessage('Navigation failed');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Navigation error:', error);
    showMessage('Navigation system error');
    return false;
  }
}
```

## Integration Patterns

### Phase 3 Feature Integration

The navigation system is designed to support upcoming content management features:

#### Manifest View Integration

```typescript
// Navigate to manifest with file selection
await navigationStore.navigateTo('manifest', {
  viewData: {
    selectedItems: ['chapter1.xhtml'],
    highlightNew: true,
  },
});

// Access manifest data from other views
const manifestData = navigationStore.getViewData<ManifestViewData>('manifest');
```

#### Metadata Editor Integration

```typescript
// Save metadata and navigate to next step
async function saveAndContinue() {
  const saved = await metadataEditor.save();
  if (saved) {
    navigationStore.clearViewData('metadata'); // Clear unsaved flag
    await navigationStore.navigateTo('manifest');
  }
}
```

#### Workspace Switching

```typescript
// Clear all view data when switching workspaces
function switchWorkspace(workspaceId: string) {
  // Clear navigation state
  Object.values(ViewType).forEach(view => navigationStore.clearViewData(view));

  // Reset to workspace view
  navigationStore.navigateTo('workspace', { replaceHistory: true });
}
```

### Layout Store Synchronization

The navigation store synchronizes with the existing layout store:

```typescript
// Navigation store updates layout store automatically
$: layoutStore.setSidebarSection($navigationStore.currentView);

// Layout store changes trigger navigation
layoutStore.subscribe(({ sidebar }) => {
  if (sidebar.activeSection !== $navigationStore.currentView) {
    navigationStore.navigateTo(sidebar.activeSection);
  }
});
```

### Theme System Integration

Views automatically inherit theme system support:

```svelte
<!-- All view components get theme support -->
<div class="view-container" data-theme={$themeStore.current}>
  <!-- View content uses design tokens -->
  <h1 style="color: var(--color-text-primary)">View Title</h1>
</div>
```

## Performance Considerations

### View Data Management

- **Memory Usage**: View data is kept in memory for fast access; large data should be stored in workspace files
- **Persistence**: Only essential navigation state is persisted to localStorage
- **Cleanup**: View data is automatically cleaned up on workspace switches

### Navigation Guards

- **Guard Execution**: Guards run sequentially; avoid heavy async operations
- **Guard Limits**: Recommended maximum of 5 guards per view for performance
- **Timeout Handling**: Guards that take >5 seconds are automatically bypassed

### Browser Compatibility

- **localStorage**: Falls back to in-memory storage if localStorage is unavailable
- **History API**: Uses internal history management instead of browser history
- **Memory Management**: Limits view history to 20 entries to prevent memory leaks

## Testing Considerations

### Unit Testing

- Mock navigation guards for predictable test behavior
- Test view data persistence across navigation
- Verify localStorage fallback behavior

### Integration Testing

- Test navigation flows with multiple views
- Verify guard execution order and blocking behavior
- Test error handling and recovery scenarios

### Component Testing

- Mock navigation store for isolated component testing
- Test view component lifecycle methods
- Verify proper guard registration and cleanup

## Internal API Details

### Guard Management

```typescript
// Internal guard storage and execution
interface GuardManager {
  guards: Map<string, NavigationGuard>;
  executeGuards(from: ViewType, to: ViewType): Promise<boolean>;
  generateGuardId(): string;
}
```

### State Persistence

```typescript
// localStorage keys and data structure
const STORAGE_KEYS = {
  CURRENT_VIEW: 'editme_nav_current_view',
  VIEW_HISTORY: 'editme_nav_view_history',
  VIEW_DATA: 'editme_nav_view_data',
} as const;
```

### View Registration

```typescript
// Internal view component registry
interface ViewRegistry {
  registerView(view: ViewType, component: ViewComponent): void;
  getView(view: ViewType): ViewComponent | null;
  executeViewMethod(view: ViewType, method: string, ...args: any[]): any;
}
```

This API provides a comprehensive foundation for navigation management while preparing for future feature integration and maintaining consistency with the existing EDITME architecture.
