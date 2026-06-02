# Manifest Preview Integration Guide

## Overview

This document provides guidance for integrating the manifest preview functionality into the main application's ManifestView, leveraging existing UI conventions and code patterns established in the codebase.

## Current State Analysis

### Working Implementation (Storybook)

- **Location**: `src/stories/manifest/ManifestViewDemo.svelte`
- **Features**: Split-pane layout with table on left, preview on right
- **Integration**: Custom layout implementation with integrated preview logic

### Main App Implementation (Missing Preview)

- **Location**: `src/lib/components/manifest/ManifestContainer.svelte`
- **Current State**: Only renders ManifestTable, no preview integration
- **Layout Context**: Used within LayoutManager's split-pane system

## Established UI Conventions

### 1. Split-Pane Layout Pattern (LayoutManager)

The app uses **PaneForge** for consistent split-pane layouts:

```svelte
<!-- From src/lib/LayoutManager.svelte -->
<PaneGroup direction="horizontal" autoSaveId="editme-content-panes">
  <Pane defaultSize={50} minSize={25}>
    <div class="pane-container">
      <div class="pane-header">
        <slot name="left-header" />
      </div>
      <div class="pane-content">
        <slot name="left-content" />
      </div>
    </div>
  </Pane>

  <PaneResizer />

  <Pane defaultSize={50} minSize={20}>
    <div class="pane-container">
      <div class="pane-header">
        <slot name="right-header" />
      </div>
      <div class="pane-content">
        <slot name="right-content" />
      </div>
    </div>
  </Pane>
</PaneGroup>
```

**Key Benefits:**

- Automatic saving of pane sizes (`autoSaveId`)
- Consistent resize behavior with `PaneResizer`
- Standard pane structure with headers and content areas
- Built-in responsive and accessibility support

### 2. Content Preview Pattern

The Storybook demo establishes the preview integration pattern:

```svelte
<!-- From ManifestViewDemo.svelte -->
<!-- Item selection handler -->
const selectItem = async (itemId: string, type: 'manifest' | 'source') => {
  try {
    if (type === 'manifest') {
      selectedItem = manifestItems.find(item => item.id === itemId) || null;
      if (selectedItem && 'id' in selectedItem) {
        contentPreview = await mockManifestManager.getContentPreview('demo-workspace', selectedItem.id);
      }
    }
  } catch (error) {
    console.error('Failed to load content preview:', error);
  }
};

<!-- Preview rendering -->
{#if selectedItem && contentPreview}
  <div class="manifest-preview">
    <div class="preview-header">
      <h3>{'id' in selectedItem ? selectedItem.id : selectedItem.name}</h3>
      <span class="item-path">{'href' in selectedItem ? selectedItem.href : selectedItem.path}</span>
    </div>

    <div class="manifest-preview-content">
      {#if contentPreview.contentType === 'text' && contentPreview.textContent}
        <pre><code>{contentPreview.textContent}</code></pre>
      {:else if contentPreview.contentType === 'image' && contentPreview.previewUrl}
        <img src={contentPreview.previewUrl} alt="Preview" class="preview-image" />
      {:else if contentPreview.contentType === 'audio' && contentPreview.previewUrl}
        <audio controls class="preview-audio">
          <source src={contentPreview.previewUrl} type={selectedItem.mediaType} />
        </audio>
      {:else if contentPreview.contentType === 'video' && contentPreview.previewUrl}
        <video controls class="preview-video">
          <source src={contentPreview.previewUrl} type={selectedItem.mediaType} />
        </video>
      {:else}
        <div class="binary-file-info">
          <div class="file-icon">📄</div>
          <h4>Binary File</h4>
          <p>Preview not available for this file type.</p>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div class="preview-placeholder">
    <p>Select an item to preview its content</p>
  </div>
{/if}
```

## Integration Strategy

### Use LayoutManager Split-Panes (Recommended)

**Approach**: Leverage the existing LayoutManager split-pane system by providing content for both left and right slots.

**Implementation in App.svelte**:

```svelte
{:else if currentView === 'manifest'}
  <svelte:fragment slot="left-content">
    <ManifestContainer
      workspaceId={currentWorkspaceId}
      manifestManager={currentManifestManager}
      advancedMode={true}
      on:itemSelect={handleManifestItemSelect}
    />
  </svelte:fragment>

  <svelte:fragment slot="right-content">
    <ManifestPreview
      workspaceId={currentWorkspaceId}
      manifestManager={currentManifestManager}
      selectedItem={selectedManifestItem}
    />
  </svelte:fragment>
{/if}
```

**Benefits:**

- Consistent with app-wide layout patterns
- Automatic pane resizing and persistence
- No custom layout implementation needed
- Responsive behavior built-in

## Architectural Decision: Dual-API Approach for Preview

**API Investigation Results**: The current ManifestManager has separate APIs for different item types:

- **Manifest items**: `getContentPreview(workspaceId, itemId)` - provides rich preview with metadata, blob URLs, and content type detection
- **SOURCE items**: `getSourceItemContent(workspaceId, sourcePath)` - provides raw file content only

**Pragmatic Approach**: Use both APIs appropriately rather than forcing unification:

- **Manifest items**: Rich preview with existing `getContentPreview()` method
- **SOURCE items**: Raw text display using `getSourceItemContent()` (perfect for .txt, .js, .json files)

## Required State Management Changes

### 1. Add to ManifestContainer.svelte

```typescript
// Additional state for preview integration
let selectedItem: ManifestItem | SourceItem | null = null;
let contentPreview: ContentPreview | null = null;
let previewLoading = false;
let previewError: string | null = null;

// Dual-API event handler for item selection
const handleItemSelection = async (event: { detail: { item: ManifestItem | SourceItem } }) => {
  selectedItem = event.detail.item;

  // Load content preview using appropriate API
  if (manifestManager && workspaceId && selectedItem) {
    try {
      previewLoading = true;
      previewError = null;

      if ('id' in selectedItem) {
        // Manifest item - use rich preview API
        contentPreview = await manifestManager.getContentPreview(workspaceId, selectedItem.id);
      } else {
        // SOURCE item - create simple text preview from raw content
        const rawContent = await manifestManager.getSourceItemContent(
          workspaceId,
          selectedItem.path
        );
        contentPreview = {
          itemId: selectedItem.path,
          mediaType: 'text/plain',
          contentType: 'text',
          textContent:
            typeof rawContent === 'string' ? rawContent : new TextDecoder().decode(rawContent),
        };
      }
    } catch (error) {
      previewError = $t('Failed to load preview');
      contentPreview = null;
    } finally {
      previewLoading = false;
    }
  }
};
```

### 2. Component Communication

**Simple Event Pattern** (following existing conventions):

```typescript
// ManifestTable dispatches selection events
dispatch('itemSelect', { item });

// ManifestContainer handles events with dual-API logic
createEventDispatcher<{
  itemSelect: { item: ManifestItem | SourceItem };
}>();
```

## API Investigation Findings

### Current ManifestManager APIs

- **`getContentPreview(workspaceId, itemId)`**: Rich preview for manifest items with metadata, blob URLs, content type detection
- **`getSourceItemContent(workspaceId, sourcePath)`**: Raw file content for SOURCE items (.txt, .js, .json files)

### Implementation Benefits

- **No ManifestManager changes needed** - use existing APIs appropriately
- **Rich preview for manifest items** - maintains existing functionality (images, videos, metadata)
- **Raw text display for SOURCE items** - perfect for viewing code/config files
- **Clear separation of concerns** - different content types get appropriate treatment

## Key Utilities to Leverage

### 1. ManifestPreview Component

- **Location**: `src/lib/components/manifest/ManifestPreview.svelte`
- **Purpose**: Already exists and handles content preview rendering
- **Integration**: Can be used directly in the right pane for both item types

### 2. Content Type Handling

Both rich and raw content will be handled by the same preview patterns:

```svelte
{#if contentPreview.contentType === 'text'}
  <pre><code>{contentPreview.textContent}</code></pre>
{:else if contentPreview.contentType === 'image'}
  <img src={contentPreview.previewUrl} alt="Preview" />
{:else if contentPreview.contentType === 'audio'}
  <audio controls><source src={contentPreview.previewUrl} /></audio>
{:else if contentPreview.contentType === 'video'}
  <video controls><source src={contentPreview.previewUrl} /></video>
{:else}
  <div class="binary-file-info">Binary file - preview not available</div>
{/if}
```

### 3. Error States and Loading Indicators

Standard loading patterns work for both APIs:

```svelte
{#if previewLoading}
  <div class="loading-state">
    <p>{$t('Loading preview…')}</p>
  </div>
{:else if previewError}
  <div class="error-state">
    <p>{previewError}</p>
  </div>
{:else if selectedItem && contentPreview}
  <!-- Preview content -->
{:else}
  <div class="preview-placeholder">
    <p>{$t('Select an item to preview its content')}</p>
  </div>
{/if}
```

## Implementation Steps

### Phase 1: Basic Integration

1. **Update App.svelte** to use LayoutManager split-panes for manifest view
2. **Add preview state** to ManifestContainer
3. **Wire up item selection** from ManifestTable to preview
4. **Use existing ManifestPreview** component in right pane

### Phase 2: Enhanced Features

1. **Add loading states** for preview content
2. **Implement error handling** for failed preview loads
3. **Add preview metadata** display (file size, type, properties)
4. **Enhanced advanced mode** features (unified SOURCE and manifest handling)

### Phase 3: Polish

1. **Add keyboard navigation** for item selection
2. **Optimize performance** with preview caching
3. **Add preview actions** (edit, download, delete)
4. **Responsive behavior** for mobile/tablet layouts

## Testing Considerations

### Integration Testing

- Verify item selection updates preview correctly
- Test error states when preview fails to load
- Validate pane resizing and persistence
- Check responsive behavior on different screen sizes

### Accessibility Testing

- Ensure keyboard navigation works between table and preview
- Verify screen reader announcements for preview changes
- Test focus management when switching between panes

## Conclusion

The recommended approach leverages the existing LayoutManager split-pane system for consistency with app-wide patterns, combined with **unified file handling** that treats all files equally for preview purposes regardless of their source (manifest vs SOURCE directory).

**Key Architectural Benefits:**

- **Simplified state management** - No need to track file type distinctions for preview
- **Unified preview logic** - Single code path for all file previews
- **Consistent user experience** - All files behave the same way in the preview pane
- **Leverages existing patterns** - Uses established UI conventions and components

**The key components needed are:**

1. **Simplified state management** in ManifestContainer (no type distinctions)
2. **Unified event handling** to connect any file selection to preview updates
3. **Integration** with existing ManifestPreview component
4. **Error and loading states** following established patterns

This simplified integration will provide a consistent user experience that matches the Storybook demo while following the app's established UI conventions and avoiding unnecessary complexity.
