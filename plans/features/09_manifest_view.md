# 09. Manifest View

## Overview

Provides a table-based interface for viewing and managing all EPUB manifest items with content preview capabilities and item creation/editing functionality.

## Requirements

- Table display of all manifest items
- Row selection and content preview
- Support for text, image, audio, video preview
- Add/Create manifest item buttons
- content.opf display as text item

## Dependencies

- **#4 Workspace & OPF Manager** - for reading manifest data

## Technical Approach

- Data table with sortable columns
- Preview pane with content-type specific rendering
- Modal dialogs for item creation/editing
- File upload handling for new resources

## API Design

```typescript
interface ManifestView {
  // Data management
  loadManifestItems(workspaceId: string): Promise<ManifestItem[]>;
  selectItem(itemId: string): void;
  getSelectedItem(): ManifestItem | null;

  // Item operations
  addManifestItem(item: Partial<ManifestItem>): Promise<void>;
  updateManifestItem(itemId: string, updates: Partial<ManifestItem>): Promise<void>;
  deleteManifestItem(itemId: string): Promise<void>;

  // File operations
  uploadFile(file: File): Promise<ManifestItem>;
  createTextFile(name: string, content: string, mediaType: string): Promise<ManifestItem>;
}

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string[];
  size?: number;
  modified?: Date;
}

interface ManifestItemExtended extends ManifestItem {
  content?: ArrayBuffer | string;
  previewURL?: string;
  isContentLoaded?: boolean;
}
```

## Table Component Structure

```svelte
<div class="manifest-view">
  <div class="manifest-toolbar">
    <button on:click={createTextFile}>Create Text File</button>
    <button on:click={uploadFile}>Upload File</button>
    <input type="search" placeholder="Filter items..." bind:value={filterText} />
  </div>

  <div class="manifest-table-container">
    <table class="manifest-table">
      <thead>
        <tr>
          <th on:click={() => sort('id')}>ID</th>
          <th on:click={() => sort('href')}>File Path</th>
          <th on:click={() => sort('mediaType')}>Media Type</th>
          <th on:click={() => sort('size')}>Size</th>
          <th>Properties</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredItems as item (item.id)}
          <tr class:selected={selectedItem?.id === item.id} on:click={() => selectItem(item.id)}>
            <td>{item.id}</td>
            <td>{item.href}</td>
            <td>{item.mediaType}</td>
            <td>{formatFileSize(item.size)}</td>
            <td>{item.properties?.join(', ') || ''}</td>
            <td>
              <button on:click|stopPropagation={() => editItem(item)}>Edit</button>
              <button on:click|stopPropagation={() => deleteItem(item)}>Delete</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
```

## Content Preview Component

```svelte
<div class="content-preview">
  {#if selectedItem}
    <div class="preview-header">
      <h3>{selectedItem.href}</h3>
      <span class="media-type">{selectedItem.mediaType}</span>
    </div>

    <div class="preview-content">
      {#if isTextContent(selectedItem.mediaType)}
        <pre class="text-preview">{selectedItem.content}</pre>
      {:else if isImageContent(selectedItem.mediaType)}
        <img src={selectedItem.previewURL} alt={selectedItem.href} />
      {:else if isAudioContent(selectedItem.mediaType)}
        <audio controls src={selectedItem.previewURL}></audio>
      {:else if isVideoContent(selectedItem.mediaType)}
        <video controls src={selectedItem.previewURL}></video>
      {:else}
        <div class="unsupported-preview">
          <p>Preview not available for {selectedItem.mediaType}</p>
          <button on:click={downloadItem}>Download</button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="no-selection">
      <p>Select a manifest item to preview its content</p>
    </div>
  {/if}
</div>
```

## Content Type Handling

```typescript
const CONTENT_TYPE_HANDLERS = {
  text: /^text\/|application\/(javascript|json|xml)|application\/xhtml\+xml/,
  image: /^image\//,
  audio: /^audio\//,
  video: /^video\//,
};

const isTextContent = (mediaType: string) => CONTENT_TYPE_HANDLERS.text.test(mediaType);
const isImageContent = (mediaType: string) => CONTENT_TYPE_HANDLERS.image.test(mediaType);
const isAudioContent = (mediaType: string) => CONTENT_TYPE_HANDLERS.audio.test(mediaType);
const isVideoContent = (mediaType: string) => CONTENT_TYPE_HANDLERS.video.test(mediaType);
```

## File Upload Handling

```typescript
const handleFileUpload = async (files: FileList) => {
  for (const file of files) {
    try {
      const content = await file.arrayBuffer();
      const mediaType = file.type || getMimeType(file.name);
      const href = `OEBPS/${file.name}`;

      const manifestItem: Partial<ManifestItem> = {
        id: generateItemId(file.name),
        href,
        mediaType,
        size: file.size,
      };

      await addManifestItem(manifestItem, content);
    } catch (error) {
      console.error('Failed to upload file:', file.name, error);
    }
  }
};
```

## Item Creation Modal

```svelte
<Modal bind:open={showCreateModal}>
  <div class="create-item-form">
    <h2>Create New Item</h2>

    <label>
      Item ID:
      <input type="text" bind:value={newItem.id} required />
    </label>

    <label>
      File Path:
      <input type="text" bind:value={newItem.href} required />
    </label>

    <label>
      Media Type:
      <select bind:value={newItem.mediaType}>
        <option value="application/xhtml+xml">XHTML</option>
        <option value="text/css">CSS</option>
        <option value="application/javascript">JavaScript</option>
        <option value="image/png">PNG Image</option>
        <option value="image/jpeg">JPEG Image</option>
        <option value="audio/mpeg">MP3 Audio</option>
      </select>
    </label>

    <label>
      Properties:
      <input type="text" bind:value={newItem.properties} placeholder="comma-separated" />
    </label>

    {#if isTextContent(newItem.mediaType)}
      <label>
        Content:
        <textarea bind:value={newItem.content} rows="10"></textarea>
      </label>
    {/if}

    <div class="modal-actions">
      <button on:click={createItem}>Create</button>
      <button on:click={() => (showCreateModal = false)}>Cancel</button>
    </div>
  </div>
</Modal>
```

## Sorting and Filtering

```typescript
const sortItems = (
  items: ManifestItem[],
  column: keyof ManifestItem,
  direction: 'asc' | 'desc'
) => {
  return [...items].sort((a, b) => {
    const aVal = a[column] || '';
    const bVal = b[column] || '';

    if (direction === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });
};

const filterItems = (items: ManifestItem[], filterText: string) => {
  if (!filterText) return items;

  const searchTerm = filterText.toLowerCase();
  return items.filter(
    item =>
      item.id.toLowerCase().includes(searchTerm) ||
      item.href.toLowerCase().includes(searchTerm) ||
      item.mediaType.toLowerCase().includes(searchTerm)
  );
};
```

## Error Handling

- File upload failures
- Invalid manifest item data
- Content loading errors
- Storage quota exceeded
- Malformed media type detection

## Performance Considerations

- Lazy loading of content for preview
- Virtual scrolling for large manifest tables
- Debounced filter input
- Blob URL cleanup for previews

## Testing Considerations

- Test with various file types
- Test sorting and filtering functionality
- Test item creation and editing
- Test content preview accuracy
- Test file upload handling
- Test error scenarios

## Implementation Notes

- Start with basic table display
- Add content preview incrementally
- Implement file operations carefully
- Consider drag-and-drop for file uploads
- Test with large manifests for performance
