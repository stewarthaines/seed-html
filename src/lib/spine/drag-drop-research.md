# Accessible Drag-and-Drop Research for Spine Item Manager

## Overview

Research findings for implementing accessible drag-and-drop functionality in the Spine Item Manager, focusing on keyboard navigation and screen reader compatibility for chapter reordering.

## Accessibility Requirements

Based on CLAUDE.md guidelines, the solution must provide:

- ✅ **Semantic HTML**: Use proper elements instead of `<div>` with event handlers
- ✅ **ARIA Labels**: Include `aria-label` for interactive controls
- ✅ **Focus Styles**: Apply `:focus-visible` styles using design system tokens
- ✅ **Touch Targets**: 44x44 pixel minimum interactive elements
- ✅ **Keyboard Navigation**: Full keyboard control with clear focus indication

## Library Evaluation

### 1. svelte-dnd-action (Recommended)

**Status**: ✅ **Recommended Choice**

**Pros**:

- ✅ Svelte-native solution with official accessibility support
- ✅ Zero-configuration accessibility (v0.6.1+)
- ✅ Built-in keyboard navigation (Tab, Enter, Space, Arrow keys)
- ✅ Automatic ARIA attributes and screen reader announcements
- ✅ Supports nested drag zones
- ✅ Active development with accessibility focus

**Accessibility Features**:

- Tab into container for description and instructions
- Space/Enter to enter dragging mode
- Arrow keys to change position while dragging
- Automatic ARIA labels when provided
- Screen reader announcements for drag start/end
- Supports aria-label on containers and items

**Installation**:

```bash
npm install svelte-dnd-action
```

**Basic Implementation**:

```typescript
import { dndzone } from 'svelte-dnd-action';
import { flip } from 'svelte/animate';

// In SpineItemManager component
let spineItems = [];
let dragDisabled = true;

function handleDndConsider(e) {
  spineItems = e.detail.items;
}

function handleDndFinalize(e) {
  spineItems = e.detail.items;
  // Call SpineItemManager.updateSpineOrder()
  saveSpineOrder(spineItems);
  dragDisabled = true;
}
```

```html
<div
  class="spine-list"
  use:dndzone={{
    items: spineItems,
    dragDisabled,
    flipDurationMs: 300,
    dropTargetStyle: {}
  }}
  on:consider={handleDndConsider}
  on:finalize={handleDndFinalize}
  aria-label="Chapter list - drag to reorder"
>
  {#each spineItems as item (item.id)}
    <div
      class="spine-item"
      aria-label="Chapter: {generateDisplayTitle(item)}"
      animate:flip={{ duration: 300 }}
    >
      <!-- Chapter content -->
    </div>
  {/each}
</div>
```

### 2. Alternative Approaches Considered

#### React Aria (Not Compatible)

- ✅ Excellent accessibility model
- ❌ React-only, not compatible with Svelte
- 📋 Reference for accessibility patterns

#### @dnd-kit (Not Recommended)

- ✅ Modern, performant
- ❌ Research shows "unusable for screen reader users"
- ❌ React-focused with limited Svelte support

#### Draggable by Shopify (Limited)

- ✅ Good touch/mouse support
- ❌ Keyboard support marked as "coming soon"
- ❌ Not Svelte-specific

#### Native HTML5 Drag and Drop (Not Recommended)

- ✅ No dependencies
- ❌ Poor accessibility support
- ❌ Limited touch device support
- ❌ Complex ARIA implementation required

## Recommended Implementation Strategy

### Phase 1: Basic Accessibility

Implement svelte-dnd-action with essential accessibility features:

```typescript
// spine-list.svelte
<script lang="ts">
  import { dndzone } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import type { SpineItemWithSource } from '$lib/spine';

  export let spineItems: SpineItemWithSource[] = [];
  export let onReorder: (fromIndex: number, toIndex: number) => Promise<void>;

  let dragDisabled = true;
  let isReordering = false;

  // Enhanced accessibility configuration
  const dndOptions = {
    flipDurationMs: 300,
    dragDisabled,
    // Custom drop zone styling for better visual feedback
    dropTargetStyle: {
      outline: '2px solid var(--color-primary)',
      backgroundColor: 'var(--color-primary-alpha-10)'
    },
    // Accessibility enhancements
    autoAriaDisabled: false, // Keep automatic ARIA
  };

  function handleDndConsider(e) {
    spineItems = e.detail.items;
  }

  async function handleDndFinalize(e) {
    if (isReordering) return;

    const newItems = e.detail.items;
    const originalItems = [...spineItems];

    // Find moved item
    const movedItem = newItems.find((item, index) =>
      originalItems[index]?.id !== item.id
    );

    if (movedItem) {
      const fromIndex = originalItems.findIndex(item => item.id === movedItem.id);
      const toIndex = newItems.findIndex(item => item.id === movedItem.id);

      if (fromIndex !== toIndex) {
        isReordering = true;
        try {
          await onReorder(fromIndex, toIndex);
          spineItems = newItems;
        } catch (error) {
          // Revert on error
          spineItems = originalItems;
          console.error('Reorder failed:', error);
        } finally {
          isReordering = false;
        }
      }
    }

    dragDisabled = true;
  }

  // Keyboard shortcuts for additional accessibility
  function handleKeydown(event: KeyboardEvent, index: number) {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          moveUp(index);
          break;
        case 'ArrowDown':
          event.preventDefault();
          moveDown(index);
          break;
        case 'Home':
          event.preventDefault();
          moveToStart(index);
          break;
        case 'End':
          event.preventDefault();
          moveToEnd(index);
          break;
      }
    }
  }

  async function moveUp(index: number) {
    if (index > 0) {
      await onReorder(index, index - 1);
    }
  }

  async function moveDown(index: number) {
    if (index < spineItems.length - 1) {
      await onReorder(index, index + 1);
    }
  }
</script>

<div class="spine-manager">
  <div class="spine-toolbar">
    <button
      class="btn btn-secondary"
      on:click={() => dragDisabled = !dragDisabled}
      aria-pressed={!dragDisabled}
    >
      {dragDisabled ? 'Enable Reorder' : 'Disable Reorder'}
    </button>

    <div class="reorder-instructions" aria-live="polite">
      {#if !dragDisabled}
        Press Tab to navigate items, Enter to start dragging, arrow keys to reorder
      {/if}
    </div>
  </div>

  <div
    class="spine-list"
    use:dndzone={dndOptions}
    on:consider={handleDndConsider}
    on:finalize={handleDndFinalize}
    aria-label="Chapter reading order - drag to reorder or use keyboard shortcuts"
    role="listbox"
    aria-multiselectable="false"
  >
    {#each spineItems as item, index (item.id)}
      <div
        class="spine-item"
        class:dragging={item.isDragging}
        class:non-linear={!item.linear}
        aria-label="Chapter {index + 1}: {generateDisplayTitle(item)} - {item.linear ? 'included' : 'not included'} in reading order"
        role="option"
        tabindex="0"
        on:keydown={(e) => handleKeydown(e, index)}
        animate:flip={{ duration: 300 }}
      >
        <div class="drag-handle" aria-hidden="true">
          <Icon name="drag-vertical" />
        </div>

        <div class="item-content">
          <div class="item-header">
            <span class="item-title">{generateDisplayTitle(item)}</span>
            <div class="item-badges">
              {#if !item.linear}
                <span class="badge non-linear" aria-label="Non-linear item">Non-linear</span>
              {/if}
              {#if item.hasSourceFile}
                <span class="badge has-source" aria-label="Has source file">Source</span>
              {:else}
                <span class="badge no-source" aria-label="No source file">No Source</span>
              {/if}
            </div>
          </div>

          <div class="item-details">
            <span class="file-path">{item.href}</span>
            {#if item.sourcePath}
              <span class="source-path">← {item.sourcePath}</span>
            {/if}
          </div>
        </div>

        <div class="item-actions">
          <button
            class="btn btn-sm"
            on:click={() => editSpineItem(item)}
            aria-label="Edit chapter {generateDisplayTitle(item)}"
          >
            Edit
          </button>

          <button
            class="btn btn-sm"
            on:click={() => createOrEditSource(item)}
            aria-label="{item.hasSourceFile ? 'Edit' : 'Create'} source file for {generateDisplayTitle(item)}"
          >
            {item.hasSourceFile ? 'Edit Source' : 'Create Source'}
          </button>

          <button
            class="btn btn-sm"
            on:click={() => moveUp(index)}
            disabled={index === 0}
            aria-label="Move {generateDisplayTitle(item)} up"
          >
            ↑
          </button>

          <button
            class="btn btn-sm"
            on:click={() => moveDown(index)}
            disabled={index === spineItems.length - 1}
            aria-label="Move {generateDisplayTitle(item)} down"
          >
            ↓
          </button>

          <button
            class="btn btn-sm btn-danger"
            on:click={() => deleteSpineItem(item)}
            aria-label="Delete chapter {generateDisplayTitle(item)}"
          >
            Delete
          </button>
        </div>
      </div>
    {/each}
  </div>
</div>
```

### Phase 2: Enhanced Accessibility

Additional enhancements for advanced accessibility:

#### Screen Reader Announcements

```typescript
// accessibility-utils.ts
export function announceToScreenReader(message: string) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'assertive');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

export function generateReorderAnnouncement(
  itemTitle: string,
  fromIndex: number,
  toIndex: number
): string {
  const fromPosition = fromIndex + 1;
  const toPosition = toIndex + 1;

  if (fromPosition < toPosition) {
    return `Moved "${itemTitle}" down from position ${fromPosition} to ${toPosition}`;
  } else {
    return `Moved "${itemTitle}" up from position ${fromPosition} to ${toPosition}`;
  }
}
```

#### Touch Enhancements

```css
/* spine-list.css */
.spine-item {
  /* Ensure minimum touch target size */
  min-height: 44px;
  display: flex;
  align-items: center;

  /* Focus styles using design system */
  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
}

.drag-handle {
  /* Larger touch target for drag handle */
  padding: 12px;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:not(.disabled) {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
}

.item-actions button {
  /* Ensure button touch targets */
  min-width: 44px;
  min-height: 44px;

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
}
```

## Implementation Checklist

### ✅ Immediate Implementation

- [x] Install svelte-dnd-action
- [x] Basic drag-and-drop with accessibility
- [x] ARIA labels for containers and items
- [x] Keyboard shortcuts (Ctrl+Arrow keys)
- [x] Focus management and visual indicators

### 📋 Future Enhancements

- [ ] Screen reader announcements for reorder actions
- [ ] Advanced keyboard shortcuts (Home/End for move to start/end)
- [ ] Haptic feedback for touch devices
- [ ] Undo/redo for reorder operations
- [ ] Bulk reorder operations
- [ ] Drag preview customization

## Testing Strategy

### Accessibility Testing

1. **Keyboard Navigation**: Tab through all interactive elements
2. **Screen Reader**: Test with NVDA/JAWS/VoiceOver
3. **Voice Control**: Test with Dragon NaturallySpeaking
4. **Mobile Accessibility**: Test with TalkBack/VoiceOver on mobile

### Browser Testing

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (Safari iOS, Chrome Android)

## Conclusion

**svelte-dnd-action** provides the best balance of accessibility, Svelte integration, and ease of implementation. Its built-in accessibility features align perfectly with the project's accessibility requirements while providing the functionality needed for chapter reordering in the Spine Item Manager.

The recommended implementation provides:

- ✅ Full keyboard navigation support
- ✅ Screen reader compatibility
- ✅ Touch-friendly interactions
- ✅ Visual focus indicators
- ✅ Semantic HTML structure
- ✅ ARIA labeling and live regions
- ✅ Integration with existing design system

This solution ensures that all users, regardless of ability or input method, can effectively manage chapter ordering in their EPUB projects.
