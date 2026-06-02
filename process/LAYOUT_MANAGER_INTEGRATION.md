# LayoutManager Integration Design Document

## Executive Summary

This document outlines the design for integrating all sidebar views with the LayoutManager's PaneForge-based split pane system. The goal is to create a consistent, accessible, and efficient layout pattern that all views can follow, replacing custom split pane implementations with the robust PaneForge system.

## Current State Analysis

### Existing Architecture

The application currently uses a sophisticated layout system with:

- **LayoutManager.svelte**: Main layout container with PaneForge integration
- **Sidebar.svelte**: Left sidebar with navigation and section management
- **PaneForge Integration**: Horizontal split panes with accessibility features
- **Layout Store**: Persistent state management for sidebar and pane sizes

### Current View Integration Pattern

```svelte
<LayoutManager>
  <svelte:fragment slot="sidebar-spine">
    <!-- Always visible spine items -->
  </svelte:fragment>

  <svelte:fragment slot="left-content">
    <!-- Main view content -->
  </svelte:fragment>

  <svelte:fragment slot="right-content">
    <!-- Preview/secondary content -->
  </svelte:fragment>
</LayoutManager>
```

### Identified Problems

1. **ManifestView Custom Implementation**: Uses custom split pane logic instead of PaneForge
2. **Inconsistent Layout Patterns**: Different views handle panes differently
3. **Unused Sidebar Slots**: View-specific sidebar slots are not utilized
4. **Preview Pane Underutilization**: Right pane shows generic placeholder content
5. **Accessibility Gaps**: Custom implementations lack PaneForge's accessibility features

## View Classification and Requirements

### 1. Workspace View

- **Layout**: Single pane (no split)
- **Sidebar Content**: None (spine items only)
- **Preview Content**: N/A
- **Current State**: ✅ Correctly implemented

### 2. Metadata View

- **Layout**: Dual pane
- **Sidebar Content**: None (spine items only)
- **Preview Content**: Metadata form preview or validation results
- **Current State**: ⚠️ No preview content implemented

### 3. Manifest View

- **Layout**: Dual pane
- **Sidebar Content**: File upload controls, filters, actions
- **Preview Content**: Selected file preview with metadata
- **Current State**: ❌ Uses custom split pane implementation

### 4. Navigation View

- **Layout**: Dual pane
- **Sidebar Content**: TOC structure outline, navigation tools
- **Preview Content**: Selected chapter/section preview
- **Current State**: ❌ Placeholder implementation

### 5. Spine View (Individual Item)

- **Layout**: Dual pane
- **Sidebar Content**: Item-specific actions, metadata, transforms
- **Preview Content**: Live content preview with device emulation
- **Current State**: ⚠️ No preview content implemented

### 6. Settings View

- **Layout**: Dual pane
- **Sidebar Content**: Settings categories, quick actions
- **Preview Content**: Settings preview, theme demo, help documentation
- **Current State**: ❌ Placeholder implementation

## Integration Strategy

### Phase 1: ManifestView Refactoring (Immediate)

**Problem**: ManifestView implements custom split pane logic that duplicates PaneForge functionality.

**Solution**: Split ManifestView into layout-compatible components:

```svelte
<!-- Current: ManifestView.svelte (custom split pane) -->
<div class="manifest-view">
  <div class="manifest-panes">
    <div class="table-pane">
      <ManifestTable />
    </div>
    <div class="preview-pane">
      <ManifestPreview />
    </div>
  </div>
</div>

<!-- Proposed: App.svelte integration -->
<LayoutManager>
  <svelte:fragment slot="sidebar-manifest">
    <ManifestSidebar />
  </svelte:fragment>

  <svelte:fragment slot="left-content">
    <ManifestTable />
  </svelte:fragment>

  <svelte:fragment slot="right-content">
    <ManifestPreview />
  </svelte:fragment>
</LayoutManager>
```

**Benefits**:

- Leverage PaneForge's accessibility features (keyboard navigation, screen reader support)
- Consistent pane sizing and persistence with other views
- Remove ~100 lines of custom split pane code
- Better responsive behavior on mobile devices

### Phase 2: Sidebar Content Enhancement (Medium-term)

**Problem**: View-specific sidebar slots are unused, limiting functionality.

**Solution**: Implement sidebar components for each view:

```svelte
<!-- ManifestSidebar.svelte -->
<div class="manifest-sidebar">
  <div class="sidebar-section">
    <h3>File Operations</h3>
    <button class="sidebar-action">Upload Files</button>
    <button class="sidebar-action">Create Text File</button>
  </div>

  <div class="sidebar-section">
    <h3>Filters</h3>
    <input type="search" placeholder="Filter files..." />
    <select>
      <option>All Types</option>
      <option>Images</option>
      <option>Text</option>
    </select>
  </div>
</div>
```

### Phase 3: Preview Pane Content (Long-term)

**Problem**: Preview pane shows generic placeholder content for most views.

**Solution**: Implement view-specific preview components:

| View       | Preview Content                             |
| ---------- | ------------------------------------------- |
| Metadata   | Form preview, validation results, EPUB info |
| Manifest   | Selected file content, metadata, thumbnail  |
| Navigation | Chapter/section preview, TOC visualization  |
| Spine      | Live content preview, device emulation      |
| Settings   | Theme demo, help docs, setting previews     |

## Technical Implementation

### 1. Component Architecture

```typescript
// View-specific components
interface ViewComponents {
  sidebar?: SvelteComponent; // Optional sidebar content
  main: SvelteComponent; // Main content (left pane)
  preview?: SvelteComponent; // Preview content (right pane)
  header?: SvelteComponent; // Optional header content
}

// View configuration
interface ViewConfig {
  id: SidebarSection;
  useSplitPane: boolean;
  components: ViewComponents;
  minPaneSize?: number;
  defaultPaneSize?: number;
}
```

### 2. Enhanced App.svelte Structure

```svelte
<script lang="ts">
  import { getViewConfig } from './lib/navigation/view-configs';

  $: viewConfig = getViewConfig(currentView);
  $: showPreviewPane = viewConfig.useSplitPane;
</script>

<LayoutManager>
  <!-- Dynamic sidebar content -->
  {#if viewConfig.components.sidebar}
    <svelte:fragment slot="sidebar-{currentView}">
      <svelte:component this={viewConfig.components.sidebar} {props} />
    </svelte:fragment>
  {/if}

  <!-- Main content -->
  <svelte:fragment slot="left-content">
    <svelte:component this={viewConfig.components.main} {props} />
  </svelte:fragment>

  <!-- Preview content -->
  {#if viewConfig.components.preview}
    <svelte:fragment slot="right-content">
      <svelte:component this={viewConfig.components.preview} {props} />
    </svelte:fragment>
  {/if}
</LayoutManager>
```

### 3. View Configuration Registry

```typescript
// /lib/navigation/view-configs.ts
export const VIEW_CONFIGS: Record<SidebarSection, ViewConfig> = {
  workspace: {
    id: 'workspace',
    useSplitPane: false,
    components: {
      main: WorkspaceView,
    },
  },

  manifest: {
    id: 'manifest',
    useSplitPane: true,
    components: {
      sidebar: ManifestSidebar,
      main: ManifestTable,
      preview: ManifestPreview,
    },
    defaultPaneSize: 60,
    minPaneSize: 30,
  },

  // ... other views
};
```

## Accessibility Considerations

### PaneForge Accessibility Features

The PaneForge library provides comprehensive accessibility support:

- **Keyboard Navigation**: Tab through resizers, arrow keys for resizing
- **Screen Reader Support**: ARIA labels and roles for pane elements
- **Focus Management**: Proper focus indicators and tab order
- **High Contrast Mode**: Automatic high contrast border support

### Implementation Requirements

1. **Keyboard Navigation**: All pane resizers must be keyboard accessible
2. **Screen Reader Labels**: Descriptive aria-labels for pane purposes
3. **Focus Indicators**: Clear focus rings meeting WCAG AA standards
4. **Touch Targets**: Minimum 44px touch targets for mobile devices

## Migration Roadmap

### Immediate (Week 1)

- [ ] Refactor ManifestView to use LayoutManager panes
- [ ] Remove custom split pane implementation
- [ ] Implement ManifestSidebar component
- [ ] Test keyboard navigation and accessibility

### Short-term (Weeks 2-3)

- [ ] Implement MetadataPreview component
- [ ] Create SpinePreview component for individual items
- [ ] Add view configuration registry
- [ ] Implement dynamic component loading

### Medium-term (Weeks 4-6)

- [ ] Implement NavigationSidebar and NavigationPreview
- [ ] Create SettingsSidebar and SettingsPreview
- [ ] Add responsive pane behavior
- [ ] Implement pane size persistence per view

### Long-term (Weeks 7-8)

- [ ] Advanced preview features (device emulation, themes)
- [ ] Performance optimization for large files
- [ ] Integration testing across all views
- [ ] Documentation and developer guidelines

## API Design

### Enhanced LayoutManager Props

```typescript
interface LayoutManagerProps {
  // Current props
  children: ComponentChildren;

  // New props for view-specific configuration
  viewConfig?: ViewConfig;
  paneConfiguration?: PaneConfiguration;
}

interface PaneConfiguration {
  defaultSizes?: { left: number; right: number };
  minSizes?: { left: number; right: number };
  maxSizes?: { left: number; right: number };
  persistenceKey?: string;
}
```

### View Component Interface

```typescript
interface ViewComponent {
  // Required props
  workspaceId: string;
  workspaceManager: WorkspaceManager;

  // Optional props
  selectedItemId?: string;
  filterText?: string;

  // Event handlers
  onItemSelect?: (item: any) => void;
  onItemEdit?: (item: any) => void;
  onItemDelete?: (itemId: string) => void;
}
```

## Performance Considerations

### Lazy Loading

- Load preview components only when needed
- Implement virtual scrolling for large file lists
- Cache rendered preview content

### Memory Management

- Dispose of preview resources when switching views
- Implement efficient blob URL management
- Use proper cleanup in component lifecycle

### Responsive Design

- Collapse to single pane on mobile devices
- Adjust pane sizes based on screen size
- Implement touch-friendly resizer handles

## Testing Strategy

### Unit Tests

- Test view configuration loading
- Verify component prop passing
- Test pane size persistence

### Integration Tests

- Test view switching with proper cleanup
- Verify accessibility features work correctly
- Test responsive behavior across devices

### Accessibility Tests

- Keyboard navigation testing
- Screen reader compatibility
- High contrast mode verification

## Benefits Summary

### For Users

- **Consistent Experience**: All views behave similarly
- **Better Accessibility**: Professional-grade keyboard navigation
- **Improved Performance**: Efficient pane management
- **Responsive Design**: Works well on all devices

### For Developers

- **Code Reuse**: Common pane management logic
- **Maintainability**: Less custom layout code
- **Extensibility**: Easy to add new views
- **Standards Compliance**: Built-in accessibility features

### For the Project

- **Reduced Complexity**: Eliminate custom split pane implementations
- **Better Architecture**: Clear separation of concerns
- **Future-Proof**: Based on stable, well-tested library
- **Professional Quality**: Enterprise-grade layout management

## Conclusion

This integration strategy provides a comprehensive path forward for unifying all sidebar views under a consistent, accessible layout system. The phased approach allows for incremental improvements while maintaining application stability. The use of PaneForge ensures professional-grade accessibility and user experience across all views.

The immediate focus should be on the ManifestView refactoring to establish the pattern, followed by systematic enhancement of other views. This approach will significantly improve the application's user experience while reducing maintenance overhead.
