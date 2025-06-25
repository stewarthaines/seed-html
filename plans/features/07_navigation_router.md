# 07. Navigation Router

## Overview

Manages navigation between different views (manifest, metadata, spine, navigation, settings) using pure Svelte store-based state management. Integrates seamlessly with the Layout System (Feature 06) to provide sidebar navigation and main content switching.

## Requirements

- Switch between views: manifest, metadata, spine, navigation, settings
- Store-based state management (no URL routing)
- Sidebar section integration with Layout System
- Active state indicators
- Optional view transition handling

## Dependencies

- Feature 06: Layout System (integrates with sidebar sections)

## Technical Approach

- Pure Svelte store-based navigation (no URL routing)
- Integration with Layout System sidebar sections
- View state management with optional persistence
- Navigation menu with active state styling

## API Design

```typescript
interface NavigationRouter {
  // View navigation
  navigateToView(view: ViewType, params?: ViewParams): void;
  getCurrentView(): ViewState;

  // Sidebar integration
  setSidebarSection(section: SidebarSection): void;
  getCurrentSidebarSection(): SidebarSection;

  // View registration
  registerView(view: ViewType, component: any): void;

  // Utilities
  isActiveView(view: ViewType): boolean;
  getViewTitle(view: ViewType): string;
  getViewIcon(view: ViewType): string;
}

type ViewType = 'workspace-list' | 'metadata' | 'manifest' | 'spine' | 'navigation' | 'settings';
type SidebarSection = 'workspace' | 'metadata' | 'manifest' | 'nav' | 'spine' | 'settings';

interface ViewState {
  type: ViewType;
  sidebarSection: SidebarSection;
  params?: ViewParams;
  timestamp: Date;
}

interface ViewParams {
  workspaceId?: string;
  itemId?: string;
  groupId?: string;
  [key: string]: any;
}
```

## View Structure

```typescript
const VIEWS = {
  'workspace-list': {
    title: 'Workspaces',
    component: WorkspaceListView,
    icon: '🏠',
    sidebarSection: 'workspace',
  },
  metadata: {
    title: 'Metadata',
    component: MetadataView,
    icon: '📄',
    sidebarSection: 'metadata',
  },
  manifest: {
    title: 'Manifest',
    component: ManifestView,
    icon: '📋',
    sidebarSection: 'manifest',
  },
  spine: {
    title: 'Reading Order',
    component: SpineView,
    icon: '📖',
    sidebarSection: 'spine',
  },
  navigation: {
    title: 'Table of Contents',
    component: NavigationView,
    icon: '🗂️',
    sidebarSection: 'nav',
  },
  settings: {
    title: 'Settings',
    component: SettingsView,
    icon: '⚙️',
    sidebarSection: 'settings',
  },
};

// Mapping between sidebar sections and views
const SIDEBAR_VIEW_MAPPING = {
  workspace: 'workspace-list',
  metadata: 'metadata',
  manifest: 'manifest',
  nav: 'navigation',
  spine: 'spine',
  settings: 'settings',
} as const;
```

## Navigation Integration with Layout System

### Sidebar Navigation (Integrates with Feature 06)

```svelte
<!-- This integrates with LayoutManager's sidebar sections -->
<nav class="sidebar-nav">
  {#each Object.entries(VIEWS) as [viewType, viewConfig]}
    <button
      class="sidebar-section"
      class:active={$currentView === viewType}
      on:click={() => navigateToView(viewType)}
    >
      <span class="section-icon">{viewConfig.icon}</span>
      {#if !$layoutStore.sidebar.isCollapsed}
        <span class="section-label">{viewConfig.title}</span>
      {/if}
    </button>
  {/each}
</nav>
```

### Main Content Router

```svelte
<!-- This goes in LayoutManager's content slots -->
<div slot="left-content">
  {#if $currentView === 'workspace-list'}
    <WorkspaceListView />
  {:else if $currentView === 'metadata'}
    <MetadataView />
  {:else if $currentView === 'manifest'}
    <ManifestView />
  {:else if $currentView === 'spine'}
    <SpineView />
  {:else if $currentView === 'navigation'}
    <NavigationView />
  {:else if $currentView === 'settings'}
    <SettingsView />
  {/if}
</div>
```

## State Management

### Navigation Store

```typescript
import { writable, derived } from 'svelte/store';

interface NavigationState {
  currentView: ViewType;
  sidebarSection: SidebarSection;
  viewParams?: ViewParams;
}

// Core navigation store
export const navigationStore = writable<NavigationState>({
  currentView: 'workspace-list',
  sidebarSection: 'workspace',
  viewParams: undefined,
});

// Derived stores for convenience
export const currentView = derived(navigationStore, $nav => $nav.currentView);
export const currentSidebarSection = derived(navigationStore, $nav => $nav.sidebarSection);

// Navigation actions
export const navigationActions = {
  navigateToView(view: ViewType, params?: ViewParams) {
    const viewConfig = VIEWS[view];
    navigationStore.update(state => ({
      ...state,
      currentView: view,
      sidebarSection: viewConfig.sidebarSection,
      viewParams: params,
    }));
  },

  setSidebarSection(section: SidebarSection) {
    const view = SIDEBAR_VIEW_MAPPING[section];
    navigationStore.update(state => ({
      ...state,
      currentView: view,
      sidebarSection: section,
    }));
  },
};
```

### Optional Persistence

- Persist current view in localStorage (optional)
- Integrate with Layout System's persistence strategy
- No browser history management (pure store-based)

## Layout System Integration

### Complete App Structure

```svelte
<!-- App.svelte - Shows full integration -->
<script>
  import LayoutManager from './lib/components/layout/LayoutManager.svelte';
  import { currentView, currentSidebarSection } from './lib/stores/navigation.js';
  import { navigationActions } from './lib/stores/navigation.js';

  // Import all view components
  import WorkspaceListView from './lib/components/views/WorkspaceListView.svelte';
  import MetadataView from './lib/components/views/MetadataView.svelte';
  // ... other views
</script>

<LayoutManager>
  <!-- Sidebar content changes based on current view -->
  <svelte:fragment slot="sidebar-{$currentSidebarSection}">
    {#if $currentView === 'workspace-list'}
      <WorkspaceSelector />
    {:else if $currentView === 'metadata'}
      <MetadataForm />
    {:else if $currentView === 'manifest'}
      <FileList />
    {/if}
  </svelte:fragment>

  <!-- Main content area -->
  <svelte:fragment slot="left-content">
    {#if $currentView === 'workspace-list'}
      <WorkspaceListView />
    {:else if $currentView === 'metadata'}
      <MetadataView />
    {:else if $currentView === 'manifest'}
      <ManifestView />
    {/if}
  </svelte:fragment>

  <!-- Right content area -->
  <svelte:fragment slot="right-content">
    <PreviewPane />
  </svelte:fragment>
</LayoutManager>
```

## Optional View Transitions

### Simple Fade Transitions (Optional)

```svelte
<!-- ViewTransition.svelte -->
<script>
  import { fade } from 'svelte/transition';
  export let currentView;
</script>

<div class="view-container">
  {#key currentView}
    <div class="view-content" in:fade={{ duration: 200 }}>
      <slot />
    </div>
  {/key}
</div>

<style>
  .view-container {
    position: relative;
    height: 100%;
    overflow: hidden;
  }

  .view-content {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
</style>
```

### Usage with Transitions

```svelte
<ViewTransition currentView={$currentView}>
  {#if $currentView === 'metadata'}
    <MetadataView />
  {:else if $currentView === 'manifest'}
    <ManifestView />
  {/if}
</ViewTransition>
```

## View State Indicators

### Current View Display

```svelte
<!-- ViewHeader.svelte -->
<script>
  import { currentView } from '../stores/navigation.js';
  import { VIEWS } from '../stores/navigation.js';

  $: viewConfig = VIEWS[$currentView];
</script>

<header class="view-header">
  <div class="view-title">
    <span class="view-icon">{viewConfig.icon}</span>
    <h1>{viewConfig.title}</h1>
  </div>

  <div class="view-actions">
    <slot name="actions" />
  </div>
</header>
```

### Status Indicators

```svelte
<!-- Shows active state in sidebar -->
<nav class="sidebar-nav">
  {#each Object.entries(VIEWS) as [viewType, viewConfig]}
    <button
      class="sidebar-section"
      class:active={$currentView === viewType}
      aria-current={$currentView === viewType ? 'page' : undefined}
    >
      <!-- content -->
    </button>
  {/each}
</nav>
```

## View Validation (Optional)

### Simple View Requirements

```typescript
// Optional validation for view switching
interface ViewRequirements {
  requiresWorkspace: boolean;
  requiresEpub: boolean;
}

const VIEW_REQUIREMENTS: Record<ViewType, ViewRequirements> = {
  'workspace-list': { requiresWorkspace: false, requiresEpub: false },
  metadata: { requiresWorkspace: true, requiresEpub: true },
  manifest: { requiresWorkspace: true, requiresEpub: true },
  spine: { requiresWorkspace: true, requiresEpub: true },
  navigation: { requiresWorkspace: true, requiresEpub: true },
  settings: { requiresWorkspace: false, requiresEpub: false },
};

// Simple validation in navigation action
const validateViewSwitch = (toView: ViewType, currentState: AppState): boolean => {
  const requirements = VIEW_REQUIREMENTS[toView];

  if (requirements.requiresWorkspace && !currentState.currentWorkspace) {
    return false;
  }

  if (requirements.requiresEpub && !currentState.currentEpub) {
    return false;
  }

  return true;
};
```

## Error Handling

- Invalid view types
- Missing required parameters (workspace, EPUB)
- View validation failures
- Store state corruption
- Component loading errors

## Accessibility

- Keyboard navigation support
- ARIA current page indicators
- Screen reader announcements
- Focus management during transitions

## Testing Considerations

- Test navigation between all views
- Test store state management
- Test sidebar section integration
- Test view validation
- Test component mounting/unmounting
- Test accessibility features
- Test Layout System integration

## Implementation Notes

- Start with basic store-based view switching
- Integrate with Layout System sidebar sections first
- Add view validation after core functionality
- Keep transitions optional and simple
- Focus on clean store-to-component integration
- Test with Layout System throughout development

## Component File Structure

```
src/lib/
├── stores/
│   ├── navigation.js          # Core navigation store and actions
│   └── layout.js              # From Feature 06
├── components/
│   ├── layout/
│   │   └── LayoutManager.svelte # From Feature 06
│   ├── navigation/
│   │   ├── ViewHeader.svelte    # View title and actions
│   │   └── ViewTransition.svelte # Optional transitions
│   └── views/
│       ├── WorkspaceListView.svelte
│       ├── MetadataView.svelte
│       ├── ManifestView.svelte
│       ├── SpineView.svelte
│       ├── NavigationView.svelte
│       └── SettingsView.svelte
```

## Integration Benefits

- **Simplified State**: No URL complexity, pure Svelte reactivity
- **Clean Integration**: Works seamlessly with Layout System
- **Better Performance**: No hash change listeners or URL parsing
- **More Predictable**: Single source of truth in stores
