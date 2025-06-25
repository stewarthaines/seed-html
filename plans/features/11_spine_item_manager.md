# 11. Spine Item Manager

## Overview

Manages the EPUB spine (reading order) with drag-and-drop reordering, item operations, and association with plain text source files.

## Requirements

- List of spine items with reorder capability
- Rename, delete, append operations
- Drag-and-drop reordering
- Association with plain text source files

## Dependencies

- **#4 Workspace & OPF Manager** - for spine data management

## Technical Approach

- Sortable list component with drag-and-drop
- Modal dialogs for item creation and editing
- Two-way binding between spine items and source files
- Visual indicators for spine item status

## API Design

```typescript
interface SpineItemManager {
  // Data management
  loadSpineItems(workspaceId: string): Promise<SpineItemWithSource[]>;
  saveSpineOrder(items: SpineItemWithSource[]): Promise<void>;

  // Item operations
  addSpineItem(item: Partial<SpineItemWithSource>): Promise<void>;
  updateSpineItem(id: string, updates: Partial<SpineItemWithSource>): Promise<void>;
  deleteSpineItem(id: string): Promise<void>;

  // Reordering
  reorderItems(fromIndex: number, toIndex: number): void;
  moveItemUp(index: number): void;
  moveItemDown(index: number): void;

  // Source file association
  createSourceFile(spineItemId: string): Promise<string>;
  linkSourceFile(spineItemId: string, sourceFilePath: string): Promise<void>;
}

interface SpineItemWithSource {
  // Spine item properties
  idref: string;
  linear: boolean;
  properties?: string[];

  // Manifest item properties (from idref)
  id: string;
  href: string;
  mediaType: string;

  // Source file association
  sourceId?: string;
  sourcePath?: string;
  hasSourceFile: boolean;

  // UI state
  isEditing?: boolean;
  isDragging?: boolean;
}
```

## Spine List Component

```svelte
<script>
  import { dndzone } from 'svelte-dnd-action';

  let spineItems = [];
  let dragDisabled = true;

  const handleDndConsider = e => {
    spineItems = e.detail.items;
  };

  const handleDndFinalize = e => {
    spineItems = e.detail.items;
    saveSpineOrder(spineItems);
    dragDisabled = true;
  };
</script>

<div class="spine-manager">
  <div class="spine-toolbar">
    <button on:click={addNewSpineItem}>Add Chapter</button>
    <button on:click={() => (dragDisabled = !dragDisabled)}>
      {dragDisabled ? 'Enable Reorder' : 'Disable Reorder'}
    </button>
  </div>

  <div
    class="spine-list"
    use:dndzone={{ items: spineItems, dragDisabled }}
    on:consider={handleDndConsider}
    on:finalize={handleDndFinalize}
  >
    {#each spineItems as item, index (item.id)}
      <div class="spine-item" class:dragging={item.isDragging}>
        <div class="drag-handle" class:disabled={dragDisabled}>
          <Icon name="drag-vertical" />
        </div>

        <div class="item-content">
          <div class="item-header">
            <span class="item-title">{getDisplayTitle(item)}</span>
            <div class="item-badges">
              {#if !item.linear}
                <span class="badge non-linear">Non-linear</span>
              {/if}
              {#if item.hasSourceFile}
                <span class="badge has-source">Source</span>
              {:else}
                <span class="badge no-source">No Source</span>
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
          <button on:click={() => editSpineItem(item)}>Edit</button>
          <button on:click={() => createOrEditSource(item)}>
            {item.hasSourceFile ? 'Edit Source' : 'Create Source'}
          </button>
          <button on:click={() => moveUp(index)} disabled={index === 0}>↑</button>
          <button on:click={() => moveDown(index)} disabled={index === spineItems.length - 1}
            >↓</button
          >
          <button on:click={() => deleteSpineItem(item)} class="danger">Delete</button>
        </div>
      </div>
    {/each}
  </div>
</div>
```

## Item Creation Modal

```svelte
<Modal bind:open={showCreateModal}>
  <div class="create-spine-item-form">
    <h2>Add New Chapter</h2>

    <div class="field">
      <label for="chapter-title">Chapter Title</label>
      <input
        id="chapter-title"
        type="text"
        bind:value={newItem.title}
        placeholder="Chapter 1"
        required
      />
    </div>

    <div class="field">
      <label for="file-name">File Name</label>
      <input
        id="file-name"
        type="text"
        bind:value={newItem.fileName}
        placeholder="chapter1.xhtml"
        required
      />
    </div>

    <div class="field">
      <label>
        <input type="checkbox" bind:checked={newItem.linear} />
        Include in linear reading order
      </label>
    </div>

    <div class="field">
      <label>
        <input type="checkbox" bind:checked={newItem.createSource} />
        Create source text file
      </label>
    </div>

    {#if newItem.createSource}
      <div class="field">
        <label for="source-format">Source Format</label>
        <select id="source-format" bind:value={newItem.sourceFormat}>
          <option value="markdown">Markdown</option>
          <option value="plain">Plain Text</option>
          <option value="asciidoc">AsciiDoc</option>
        </select>
      </div>
    {/if}

    <div class="modal-actions">
      <button on:click={createSpineItem}>Create</button>
      <button on:click={() => (showCreateModal = false)}>Cancel</button>
    </div>
  </div>
</Modal>
```

## Source File Association

```typescript
const createSourceFile = async (spineItem: SpineItemWithSource): Promise<void> => {
  const sourceFileName = spineItem.id + '.txt';
  const sourcePath = `EDITME/src/${sourceFileName}`;

  // Create default content based on spine item title
  const defaultContent = `# ${getDisplayTitle(spineItem)}\n\nContent goes here...\n`;

  // Save source file
  await fileStorage.writeFile(currentWorkspaceId, sourcePath, defaultContent);

  // Update manifest to include source file
  const sourceManifestItem: ManifestItem = {
    id: spineItem.id + '_txt',
    href: sourcePath,
    mediaType: 'text/plain',
  };

  await contentOPF.addManifestItem(sourceManifestItem);

  // Update spine item association
  spineItem.sourceId = sourceManifestItem.id;
  spineItem.sourcePath = sourcePath;
  spineItem.hasSourceFile = true;
};
```

## Drag and Drop Implementation

```typescript
const handleDragStart = (event: DragEvent, index: number) => {
  event.dataTransfer?.setData('text/plain', index.toString());
  spineItems[index].isDragging = true;
};

const handleDragOver = (event: DragEvent, targetIndex: number) => {
  event.preventDefault();
  // Visual feedback for drop zone
};

const handleDrop = (event: DragEvent, targetIndex: number) => {
  event.preventDefault();
  const sourceIndex = parseInt(event.dataTransfer?.getData('text/plain') || '0');

  if (sourceIndex !== targetIndex) {
    const newItems = [...spineItems];
    const [draggedItem] = newItems.splice(sourceIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);

    spineItems = newItems;
    saveSpineOrder(spineItems);
  }

  // Clear dragging state
  spineItems.forEach(item => (item.isDragging = false));
};
```

## Title Generation

```typescript
const getDisplayTitle = (item: SpineItemWithSource): string => {
  // Try to extract title from file name
  const baseName = item.href
    .split('/')
    .pop()
    ?.replace(/\.(x?html?)$/, '');

  // Convert camelCase or kebab-case to Title Case
  return (
    baseName
      ?.replace(/([a-z])([A-Z])/g, '$1 $2')
      ?.replace(/[-_]/g, ' ')
      ?.replace(/\b\w/g, l => l.toUpperCase()) || 'Untitled'
  );
};
```

## Validation

```typescript
const validateSpineOrder = (items: SpineItemWithSource[]): ValidationResult[] => {
  const errors: ValidationResult[] = [];

  // Check for duplicate IDs
  const ids = items.map(item => item.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

  duplicates.forEach(id => {
    errors.push({
      field: 'spine',
      message: `Duplicate spine item ID: ${id}`,
      severity: 'error',
    });
  });

  // Check that all spine items exist in manifest
  // This would require manifest data to validate

  return errors;
};
```

## Keyboard Shortcuts

```typescript
const handleKeyDown = (event: KeyboardEvent, index: number) => {
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
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        deleteSpineItem(spineItems[index]);
        break;
    }
  }
};
```

## Error Handling

- Invalid spine item references
- Missing manifest items
- Source file creation failures
- Drag and drop conflicts
- Circular reference detection

## Testing Considerations

- Test drag and drop functionality
- Test keyboard navigation
- Test source file creation and linking
- Test spine order persistence
- Test validation logic
- Test accessibility with screen readers

## Implementation Notes

- Use a robust drag-and-drop library
- Implement undo functionality for reordering
- Consider bulk operations for multiple items
- Test performance with large spine lists
- Ensure accessibility compliance
