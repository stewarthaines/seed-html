# 07. Navigation Router

## Overview
Manages navigation between different views (manifest, metadata, spine, navigation, settings) with state management, transitions, and active state indicators.

## Requirements
- Switch between views: manifest, metadata, spine, navigation, settings
- URL state management (if applicable)
- View transition handling
- Active state indicators

## Dependencies
- None (can be developed in parallel with data layer)

## Technical Approach
- Client-side routing with hash-based navigation compatible with file: protocol
- Svelte stores for view state management
- Transition animations between views
- Navigation menu with active state styling

## API Design
```typescript
interface NavigationRouter {
  // View navigation
  navigateToView(view: ViewType, params?: ViewParams): void
  getCurrentView(): ViewState
  canNavigateBack(): boolean
  navigateBack(): void
  
  // State management
  getViewHistory(): ViewState[]
  clearHistory(): void
  
  // View registration
  registerView(view: ViewType, component: any): void
  
  // Utilities
  isActiveView(view: ViewType): boolean
  getViewTitle(view: ViewType): string
}

type ViewType = 'manifest' | 'metadata' | 'spine' | 'navigation' | 'workspace-list' | 'settings'

interface ViewState {
  type: ViewType
  params?: ViewParams
  timestamp: Date
}

interface ViewParams {
  workspaceId?: string
  itemId?: string
  groupId?: string
  [key: string]: any
}
```

## View Structure
```typescript
const VIEWS = {
  'workspace-list': {
    title: 'Workspaces',
    component: WorkspaceListView,
    icon: 'folder-multiple'
  },
  'manifest': {
    title: 'Manifest',
    component: ManifestView,
    icon: 'file-document-multiple'
  },
  'metadata': {
    title: 'Metadata',
    component: MetadataView,
    icon: 'information'
  },
  'spine': {
    title: 'Reading Order',
    component: SpineView,
    icon: 'book-open-page-variant'
  },
  'navigation': {
    title: 'Table of Contents',
    component: NavigationView,
    icon: 'format-list-bulleted'
  },
  'settings': {
    title: 'Settings',
    component: SettingsView,
    icon: 'gear'
  }
}
```

## Navigation Menu Component
```svelte
<nav class="main-navigation">
  {#each Object.entries(VIEWS) as [viewType, viewConfig]}
    <button 
      class="nav-item"
      class:active={currentView === viewType}
      on:click={() => navigateToView(viewType)}
    >
      <Icon name={viewConfig.icon} />
      <span>{viewConfig.title}</span>
    </button>
  {/each}
</nav>
```

## State Management
- Use Svelte writable stores for current view
- Maintain navigation history
- Persist current view in localStorage
- Handle browser back/forward buttons

## URL State Management
```typescript
// Hash-based routing
const updateURL = (view: ViewType, params?: ViewParams) => {
  const hash = params 
    ? `#/${view}/${encodeURIComponent(JSON.stringify(params))}`
    : `#/${view}`
  window.location.hash = hash
}

// Parse URL on load
const parseURL = (): ViewState => {
  const hash = window.location.hash.slice(2) // Remove '#/'
  const [view, paramsStr] = hash.split('/', 2)
  const params = paramsStr ? JSON.parse(decodeURIComponent(paramsStr)) : undefined
  return { type: view as ViewType, params, timestamp: new Date() }
}
```

## View Transitions
```css
.view-container {
  position: relative;
  overflow: hidden;
}

.view-transition {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.view-enter {
  transform: translateX(100%);
  opacity: 0;
}

.view-enter-active {
  transform: translateX(0);
  opacity: 1;
}

.view-exit {
  transform: translateX(0);
  opacity: 1;
}

.view-exit-active {
  transform: translateX(-100%);
  opacity: 0;
}
```

## Breadcrumb Navigation
```svelte
<div class="breadcrumb">
  {#each breadcrumbs as crumb, index}
    <button 
      class="breadcrumb-item"
      on:click={() => navigateToView(crumb.view, crumb.params)}
    >
      {crumb.title}
    </button>
    {#if index < breadcrumbs.length - 1}
      <span class="breadcrumb-separator">/</span>
    {/if}
  {/each}
</div>
```

## View Guards
```typescript
interface ViewGuard {
  canEnter(from: ViewType, to: ViewType, params?: ViewParams): boolean
  canLeave(from: ViewType, to: ViewType): boolean
}

// Example: Require workspace selection
const workspaceGuard: ViewGuard = {
  canEnter: (from, to, params) => {
    if (['manifest', 'metadata', 'spine', 'navigation'].includes(to)) {
      return !!params?.workspaceId
    }
    return true
  },
  canLeave: () => true
}
```

## Error Handling
- Invalid view types
- Missing required parameters
- Navigation guard rejections
- History state corruption
- URL parsing errors

## Accessibility
- Keyboard navigation support
- ARIA current page indicators
- Screen reader announcements
- Focus management during transitions

## Testing Considerations
- Test navigation between all views
- Test URL state persistence
- Test browser back/forward buttons
- Test view transitions
- Test navigation guards
- Test accessibility features

## Implementation Notes
- Start with basic view switching
- Add URL state management incrementally
- Implement transitions after core functionality
- Consider using existing routing libraries if needed
- Test navigation flow thoroughly