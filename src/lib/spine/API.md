# Spine Item Manager API Documentation

## Overview

The Spine Item Manager provides comprehensive chapter management for EPUB files, orchestrating spine ordering, chapter creation, and source file association. It serves as a high-level interface that coordinates with the WorkspaceManager to handle the complete chapter lifecycle - from creation through reordering to deletion.

The manager integrates three key aspects of chapter management:

1. **Spine Operations** - Reading order management and reordering
2. **Chapter Creation** - XHTML file and manifest entry creation
3. **Source File Association** - Plain text source file linking in SOURCE/text/

This comprehensive approach ensures atomic operations where either the complete chapter creation succeeds or fails, preventing partial state corruption.

## Main Classes

### SpineItemManager

Core class that provides chapter management operations, coordinating with WorkspaceManager for file operations and maintaining consistency between spine order, manifest items, and source files.

## Constructor

#### SpineItemManager()

```typescript
constructor(workspaceManager: WorkspaceManager)
```

**Input:**

- `workspaceManager: WorkspaceManager` - Initialized workspace manager instance for all file operations

**Output:** `SpineItemManager` instance

**Side Effects:** None (lazy initialization)

**Usage:**

```typescript
import { WorkspaceManager } from '$lib/workspace';
import { SpineItemManager } from '$lib/spine';

const workspaceManager = new WorkspaceManager();
await workspaceManager.init();

const spineManager = new SpineItemManager(workspaceManager);
```

## Core Chapter Management Methods

### loadSpineItems()

```typescript
loadSpineItems(workspaceId: string): Promise<SpineItemWithSource[]>
```

**Input:**

- `workspaceId: string` - Target workspace identifier

**Output:** `Promise<SpineItemWithSource[]>` - Complete spine items with source file associations

**Side Effects:** None (read-only operation)

**Usage:**

```typescript
const spineItems = await spineManager.loadSpineItems('workspace-123');

// Each item includes spine, manifest, and source information
// Source files are automatically detected by naming convention: SOURCE/text/{id}.txt
spineItems.forEach(item => {
  console.log(`Chapter: ${item.id}`);
  console.log(`XHTML: ${item.href}`);
  console.log(`Has Source: ${item.hasSourceFile}`);
  if (item.hasSourceFile) {
    console.log(`Source: ${item.sourcePath}`); // SOURCE/text/{item.id}.txt
  }
});
```

### addChapter()

```typescript
addChapter(workspaceId: string, chapterData: ChapterCreationData): Promise<SpineItemWithSource>
```

**Input:**

- `workspaceId: string` - Target workspace identifier
- `chapterData: ChapterCreationData` - Chapter creation parameters

**Output:** `Promise<SpineItemWithSource>` - Newly created chapter with all associations

**Side Effects:**

- Creates XHTML file in OEBPS/Text/ directory
- Adds manifest entry to OPF file
- Adds spine item to OPF file
- Creates source file in SOURCE/text/ directory
- Updates workspace metadata

**Usage:**

```typescript
const newChapter = await spineManager.addChapter('workspace-123', {
  title: 'Chapter 1: The Beginning',
  fileName: 'chapter1.xhtml', // Optional - auto-generated if not provided
  linear: true,
  insertIndex: 0, // Optional - appends to end if not provided
  createSourceFile: true, // Optional - defaults to true
});

console.log('Created chapter:', newChapter.id);
console.log('XHTML file:', newChapter.href);
console.log('Source file:', newChapter.sourcePath); // SOURCE/text/chapter1.txt (auto-associated)
```

### updateChapter()

```typescript
updateChapter(workspaceId: string, chapterId: string, updates: ChapterUpdateData): Promise<SpineItemWithSource>
```

**Input:**

- `workspaceId: string` - Target workspace identifier
- `chapterId: string` - Chapter ID to update
- `updates: ChapterUpdateData` - Update parameters

**Output:** `Promise<SpineItemWithSource>` - Updated chapter data

**Side Effects:**

- Updates manifest entry if href changes
- Renames XHTML file if fileName changes
- Updates spine item properties
- Renames source file automatically to maintain naming convention association
- Updates workspace metadata

**Usage:**

```typescript
const updatedChapter = await spineManager.updateChapter('workspace-123', 'chapter1', {
  linear: false, // Mark as non-linear
  properties: ['page-spread-left'],
});

// Rename a chapter file (source file automatically renamed to match)
const renamedChapter = await spineManager.updateChapter('workspace-123', 'chapter1', {
  fileName: 'prologue.xhtml', // Will rename both XHTML and source files (SOURCE/text/chapter1.txt → SOURCE/text/prologue.txt)
});
```

### deleteChapter()

```typescript
deleteChapter(workspaceId: string, chapterId: string, options?: ChapterDeletionOptions): Promise<void>
```

**Input:**

- `workspaceId: string` - Target workspace identifier
- `chapterId: string` - Chapter ID to delete
- `options?: ChapterDeletionOptions` - Deletion behavior options

**Output:** `Promise<void>`

**Side Effects:**

- Removes spine item from OPF
- Removes manifest entry from OPF
- Deletes XHTML file (if preserveXHTML is false)
- Deletes source file (if preserveSourceFile is false)
- Updates workspace metadata

**Usage:**

```typescript
// Delete everything (default behavior)
await spineManager.deleteChapter('workspace-123', 'chapter1');

// Preserve XHTML file but remove from spine/manifest
await spineManager.deleteChapter('workspace-123', 'chapter1', {
  preserveXHTML: true,
  preserveSourceFile: false,
});

// Only remove from spine, keep manifest and files
await spineManager.deleteChapter('workspace-123', 'chapter1', {
  preserveXHTML: true,
  preserveSourceFile: true,
  preserveManifest: true,
});
```

## Spine Ordering Methods

### reorderItems()

```typescript
reorderItems(workspaceId: string, fromIndex: number, toIndex: number): Promise<SpineItemWithSource[]>
```

**Input:**

- `workspaceId: string` - Target workspace identifier
- `fromIndex: number` - Source position (0-based)
- `toIndex: number` - Target position (0-based)

**Output:** `Promise<SpineItemWithSource[]>` - Updated spine items in new order

**Side Effects:**

- Updates spine order in OPF file
- Updates workspace metadata

**Usage:**

```typescript
// Move first chapter to third position
const reorderedItems = await spineManager.reorderItems('workspace-123', 0, 2);

// UI integration - typically called from drag-and-drop handlers
const handleDrop = async (dragIndex: number, dropIndex: number) => {
  try {
    await spineManager.reorderItems(workspaceId, dragIndex, dropIndex);
    // Update UI state
  } catch (error) {
    // Revert UI changes
    console.error('Reorder failed:', error);
  }
};
```

### moveChapterUp()

```typescript
moveChapterUp(workspaceId: string, chapterIndex: number): Promise<SpineItemWithSource[]>
```

**Input:**

- `workspaceId: string` - Target workspace identifier
- `chapterIndex: number` - Index of chapter to move up

**Output:** `Promise<SpineItemWithSource[]>` - Updated spine items

**Side Effects:**

- Updates spine order in OPF file
- Updates workspace metadata

**Usage:**

```typescript
// Move chapter at index 2 up one position (to index 1)
const updatedItems = await spineManager.moveChapterUp('workspace-123', 2);

// Keyboard shortcut handler
const handleKeyDown = async (event: KeyboardEvent, index: number) => {
  if (event.ctrlKey && event.key === 'ArrowUp') {
    event.preventDefault();
    await spineManager.moveChapterUp(workspaceId, index);
  }
};
```

### moveChapterDown()

```typescript
moveChapterDown(workspaceId: string, chapterIndex: number): Promise<SpineItemWithSource[]>
```

**Input:**

- `workspaceId: string` - Target workspace identifier
- `chapterIndex: number` - Index of chapter to move down

**Output:** `Promise<SpineItemWithSource[]>` - Updated spine items

**Side Effects:**

- Updates spine order in OPF file
- Updates workspace metadata

**Usage:**

```typescript
// Move chapter at index 1 down one position (to index 2)
const updatedItems = await spineManager.moveChapterDown('workspace-123', 1);

// UI button handler with boundary checking
const handleMoveDown = async (index: number) => {
  if (index < spineItems.length - 1) {
    await spineManager.moveChapterDown(workspaceId, index);
  }
};
```

### updateSpineOrder()

```typescript
updateSpineOrder(workspaceId: string, spineItems: SpineItemWithSource[]): Promise<void>
```

**Input:**

- `workspaceId: string` - Target workspace identifier
- `spineItems: SpineItemWithSource[]` - Complete spine items in desired order

**Output:** `Promise<void>`

**Side Effects:**

- Updates complete spine order in OPF file
- Updates workspace metadata

**Usage:**

```typescript
// Bulk reorder after complex UI operations
const reorderedItems = [...spineItems].sort((a, b) => a.title.localeCompare(b.title));
await spineManager.updateSpineOrder('workspace-123', reorderedItems);

// Restore from saved order
const savedOrder = await loadSavedChapterOrder();
await spineManager.updateSpineOrder('workspace-123', savedOrder);
```

## Source File Management Methods

### createSourceFile()

```typescript
createSourceFile(workspaceId: string, chapterId: string, content?: string): Promise<string>
```

**Input:**

- `workspaceId: string` - Target workspace identifier
- `chapterId: string` - Chapter ID to create source file for
- `content?: string` - Optional initial content (uses template if not provided)

**Output:** `Promise<string>` - Path to created source file

**Side Effects:**

- Creates source file in SOURCE/text/ directory using naming convention (`{chapterId}.txt`)
- Source file is automatically associated with chapter by matching ID

**Usage:**

```typescript
// Create source file with default template
const sourcePath = await spineManager.createSourceFile('workspace-123', 'chapter1');
// Creates: SOURCE/text/chapter1.txt (automatically linked by naming convention)

// Create with custom content
const customSource = await spineManager.createSourceFile(
  'workspace-123',
  'chapter1',
  '# Chapter 1\n\nOnce upon a time...'
);
// Creates: SOURCE/text/chapter1.txt with custom content
```

## Utility Methods

### generateChapterId()

```typescript
generateChapterId(workspaceId: string, baseTitle?: string): Promise<string>
```

**Input:**

- `workspaceId: string` - Target workspace identifier
- `baseTitle?: string` - Optional base name for ID generation

**Output:** `Promise<string>` - Unique chapter ID

**Side Effects:** None (pure computation with collision checking)

**Usage:**

```typescript
// Generate sequential ID
const chapterId = await spineManager.generateChapterId('workspace-123');
// Returns: "chapter1", "chapter2", etc.

// Generate from title
const customId = await spineManager.generateChapterId('workspace-123', 'Prologue');
// Returns: "prologue" (or "prologue1" if "prologue" exists)
```

### validateSpineOrder()

```typescript
validateSpineOrder(workspaceId: string): Promise<SpineValidationResult>
```

**Input:**

- `workspaceId: string` - Target workspace identifier

**Output:** `Promise<SpineValidationResult>` - Validation results

**Side Effects:** None (read-only validation)

**Usage:**

```typescript
const validation = await spineManager.validateSpineOrder('workspace-123');

if (!validation.isValid) {
  console.error('Spine validation errors:');
  validation.errors.forEach(error => {
    console.error(`- ${error.message}`);
  });
}

// Check for warnings
if (validation.warnings.length > 0) {
  console.warn('Spine validation warnings:');
  validation.warnings.forEach(warning => {
    console.warn(`- ${warning.message}`);
  });
}
```

## Type Definitions

### SpineItemWithSource

```typescript
interface SpineItemWithSource {
  // Spine item properties
  idref: string; // Reference to manifest item ID
  linear: boolean; // Include in linear reading order
  properties?: string[]; // EPUB spine properties

  // Manifest item properties (resolved from idref)
  id: string; // Manifest item ID (same as idref)
  href: string; // File path relative to OPF
  mediaType: string; // MIME type (typically "application/xhtml+xml")

  // Source file association (automatic by naming convention)
  sourcePath?: string; // Path to source file if it exists (SOURCE/text/{id}.txt)
  hasSourceFile: boolean; // Whether associated source file exists

  // UI state (not persisted)
  isEditing?: boolean; // Currently being edited in UI
  isDragging?: boolean; // Currently being dragged in UI
}
```

### ChapterCreationData

```typescript
interface ChapterCreationData {
  title: string; // Chapter title for display and content
  fileName?: string; // XHTML filename (auto-generated if not provided)
  linear?: boolean; // Include in linear reading order (default: true)
  properties?: string[]; // EPUB spine properties
  insertIndex?: number; // Position to insert in spine (default: append)
  createSourceFile?: boolean; // Create associated source file (default: true)
  sourceContent?: string; // Initial source content (uses template if not provided)
}
```

### ChapterUpdateData

```typescript
interface ChapterUpdateData {
  title?: string; // New chapter title
  fileName?: string; // New XHTML filename (will rename file)
  linear?: boolean; // Linear reading order flag
  properties?: string[]; // EPUB spine properties
  sourceContent?: string; // Update source file content
}
```

### ChapterDeletionOptions

```typescript
interface ChapterDeletionOptions {
  preserveXHTML?: boolean; // Keep XHTML file (default: false)
  preserveSourceFile?: boolean; // Keep source file (default: false)
  preserveManifest?: boolean; // Keep manifest entry (default: false)
}
```

### SpineValidationResult

```typescript
interface SpineValidationResult {
  isValid: boolean;
  errors: SpineValidationError[];
  warnings: SpineValidationWarning[];
  summary: {
    totalItems: number;
    linearItems: number;
    nonLinearItems: number;
    itemsWithSource: number;
    orphanedSources: number;
  };
}
```

### SpineValidationError

```typescript
interface SpineValidationError {
  code: string;
  message: string;
  chapterId?: string;
  severity: 'error' | 'warning';
}
```

### SpineValidationWarning

```typescript
interface SpineValidationWarning {
  code: string;
  message: string;
  chapterId?: string;
  severity: 'warning';
}
```

## Integration Patterns

### WorkspaceManager Coordination

The SpineItemManager coordinates with WorkspaceManager for all file operations:

```typescript
// Adding a new chapter involves multiple WorkspaceManager calls
async addChapter(workspaceId: string, chapterData: ChapterCreationData): Promise<SpineItemWithSource> {
  const chapterId = await this.generateChapterId(workspaceId, chapterData.title);
  const fileName = chapterData.fileName || `${chapterId}.xhtml`;

  try {
    // 1. Add manifest item
    await this.workspaceManager.addManifestItem(workspaceId, {
      id: chapterId,
      href: `Text/${fileName}`,
      mediaType: 'application/xhtml+xml'
    });

    // 2. Add spine item
    await this.workspaceManager.addSpineItem(workspaceId, {
      idref: chapterId,
      linear: chapterData.linear ?? true,
      properties: chapterData.properties
    }, chapterData.insertIndex);

    // 3. Create XHTML file
    const xhtmlContent = this.generateXHTMLTemplate(chapterData.title);
    await this.workspaceManager.writeFile(workspaceId, `OEBPS/Text/${fileName}`, xhtmlContent);

    // 4. Create source file (automatically associated by naming convention)
    if (chapterData.createSourceFile !== false) {
      const sourceContent = chapterData.sourceContent || this.generateSourceTemplate(chapterData.title);
      const sourcePath = `SOURCE/text/${chapterId}.txt`; // Naming convention: {chapterId}.txt
      await this.workspaceManager.writeFile(workspaceId, sourcePath, sourceContent);
    }

    return await this.loadChapterById(workspaceId, chapterId);

  } catch (error) {
    // Rollback on failure - remove any created items
    await this.cleanupFailedChapterCreation(workspaceId, chapterId);
    throw error;
  }
}
```

### UI Component Integration

Integrating with Svelte components for reactive updates:

```typescript
// Svelte component using SpineItemManager
<script lang="ts">
  import { SpineItemManager } from '$lib/spine';
  import { workspaceManager } from '$lib/stores/workspace';

  export let workspaceId: string;

  let spineItems: SpineItemWithSource[] = [];
  let isReordering = false;

  const spineManager = new SpineItemManager($workspaceManager);

  // Load spine items
  $: if (workspaceId) {
    loadSpineItems();
  }

  async function loadSpineItems() {
    try {
      spineItems = await spineManager.loadSpineItems(workspaceId);
    } catch (error) {
      console.error('Failed to load spine items:', error);
    }
  }

  async function handleReorder(fromIndex: number, toIndex: number) {
    if (isReordering) return;

    isReordering = true;
    try {
      spineItems = await spineManager.reorderItems(workspaceId, fromIndex, toIndex);
    } catch (error) {
      console.error('Reorder failed:', error);
      // Reload to restore correct order
      await loadSpineItems();
    } finally {
      isReordering = false;
    }
  }

  async function handleAddChapter() {
    try {
      const newChapter = await spineManager.addChapter(workspaceId, {
        title: 'New Chapter',
        linear: true
      });

      // Reload spine items to include new chapter
      await loadSpineItems();

      // Focus new chapter for editing
      focusChapter(newChapter.id);
    } catch (error) {
      console.error('Failed to add chapter:', error);
    }
  }
</script>
```

### Drag and Drop Integration

Integration with accessibility-focused drag and drop:

```typescript
// Accessible drag and drop with keyboard support
import { createDragDropManager } from '$lib/utils/accessible-dnd';

const dragDropManager = createDragDropManager({
  onReorder: async (fromIndex: number, toIndex: number) => {
    await spineManager.reorderItems(workspaceId, fromIndex, toIndex);
  },
  onKeyboardMove: async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up') {
      await spineManager.moveChapterUp(workspaceId, index);
    } else {
      await spineManager.moveChapterDown(workspaceId, index);
    }
  },
  announceMove: (itemTitle: string, fromIndex: number, toIndex: number) => {
    return `Moved ${itemTitle} from position ${fromIndex + 1} to position ${toIndex + 1}`;
  },
});
```

## Error Handling

### Common Error Scenarios

#### Chapter Creation Failures

```typescript
try {
  await spineManager.addChapter(workspaceId, chapterData);
} catch (error) {
  if (error instanceof WorkspaceError) {
    switch (error.code) {
      case 'DUPLICATE_ID':
        showError('Chapter with this name already exists');
        break;
      case 'INVALID_FILENAME':
        showError('Invalid filename. Use only letters, numbers, and hyphens.');
        break;
      case 'STORAGE_QUOTA_EXCEEDED':
        showError('Not enough storage space to create chapter');
        break;
      default:
        showError(`Failed to create chapter: ${error.message}`);
    }
  }
}
```

#### Reordering Failures

```typescript
async function handleDragEnd(fromIndex: number, toIndex: number) {
  const originalOrder = [...spineItems];

  // Optimistic UI update
  const newOrder = [...spineItems];
  const [movedItem] = newOrder.splice(fromIndex, 1);
  newOrder.splice(toIndex, 0, movedItem);
  spineItems = newOrder;

  try {
    await spineManager.reorderItems(workspaceId, fromIndex, toIndex);
  } catch (error) {
    // Revert UI on failure
    spineItems = originalOrder;
    showError('Failed to reorder chapters. Please try again.');
  }
}
```

#### Validation Errors

```typescript
const validation = await spineManager.validateSpineOrder(workspaceId);

if (!validation.isValid) {
  // Handle critical errors
  validation.errors.forEach(error => {
    switch (error.code) {
      case 'MISSING_MANIFEST_ITEM':
        showCriticalError(`Chapter references missing file: ${error.chapterId}`);
        break;
      case 'DUPLICATE_SPINE_ITEM':
        showCriticalError(`Duplicate chapter found: ${error.chapterId}`);
        break;
      case 'EMPTY_SPINE':
        showWarning('No chapters in this book');
        break;
    }
  });
}
```

### Atomic Operations

All chapter operations are designed to be atomic - either completely successful or completely rolled back:

```typescript
class SpineItemManager {
  private async executeAtomicChapterOperation<T>(
    workspaceId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Create checkpoint
    const checkpoint = await this.createWorkspaceCheckpoint(workspaceId);

    try {
      const result = await operation();
      await this.commitCheckpoint(workspaceId, checkpoint);
      return result;
    } catch (error) {
      await this.rollbackToCheckpoint(workspaceId, checkpoint);
      throw error;
    }
  }
}
```

## Performance Considerations

### Caching Strategy

The SpineItemManager implements intelligent caching for frequently accessed data:

```typescript
class SpineItemManager {
  private spineCache = new Map<
    string,
    {
      items: SpineItemWithSource[];
      lastModified: number;
      ttl: number;
    }
  >();

  async loadSpineItems(workspaceId: string, useCache = true): Promise<SpineItemWithSource[]> {
    if (useCache) {
      const cached = this.spineCache.get(workspaceId);
      if (cached && Date.now() - cached.lastModified < cached.ttl) {
        return cached.items;
      }
    }

    const items = await this.loadSpineItemsFromWorkspace(workspaceId);

    // Cache for 5 minutes
    this.spineCache.set(workspaceId, {
      items,
      lastModified: Date.now(),
      ttl: 5 * 60 * 1000,
    });

    return items;
  }
}
```

### Batch Operations

For bulk operations, the manager provides batch methods:

```typescript
// Efficient bulk reordering
async reorderMultipleChapters(
  workspaceId: string,
  reorderOperations: ReorderOperation[]
): Promise<SpineItemWithSource[]> {
  // Group operations and execute in single transaction
  return await this.executeAtomicChapterOperation(workspaceId, async () => {
    for (const operation of reorderOperations) {
      await this.workspaceManager.updateSpineOrder(workspaceId, operation.newOrder);
    }
    return await this.loadSpineItems(workspaceId, false);
  });
}
```

### Large Spine Handling

Optimizations for books with many chapters:

```typescript
// Paginated loading for large spines
async loadSpineItemsPaginated(
  workspaceId: string,
  page = 0,
  pageSize = 50
): Promise<{
  items: SpineItemWithSource[];
  totalCount: number;
  hasMore: boolean;
}> {
  const allItems = await this.loadSpineItems(workspaceId);
  const startIndex = page * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    items: allItems.slice(startIndex, endIndex),
    totalCount: allItems.length,
    hasMore: endIndex < allItems.length
  };
}
```

## Browser Compatibility

### Feature Detection

The SpineItemManager includes feature detection for enhanced functionality:

```typescript
class SpineItemManager {
  private readonly features = {
    fileSystemAccess: 'showSaveFilePicker' in window,
    clipboard: 'navigator' in window && 'clipboard' in navigator,
    dragDrop: 'DataTransfer' in window,
  };

  async exportChapterList(workspaceId: string): Promise<void> {
    const items = await this.loadSpineItems(workspaceId);
    const exportData = this.generateChapterListExport(items);

    if (this.features.fileSystemAccess) {
      // Use File System Access API
      await this.saveFileSystemAccess(exportData);
    } else {
      // Fallback to download link
      await this.saveDownloadLink(exportData);
    }
  }
}
```

### Touch Support

Enhanced touch support for mobile devices:

```typescript
// Touch-friendly reordering
interface TouchReorderConfig {
  longPressDelay: number; // Delay before drag starts (default: 500ms)
  touchTargetSize: number; // Minimum touch target size (default: 44px)
  hapticFeedback: boolean; // Use vibration API (default: true)
}

const touchConfig: TouchReorderConfig = {
  longPressDelay: 500,
  touchTargetSize: 44,
  hapticFeedback: 'vibrate' in navigator,
};
```

## Accessibility Features

### Keyboard Navigation

Support for comprehensive keyboard navigation:

```typescript
// Keyboard shortcut mappings
const keyboardShortcuts = {
  'Ctrl+ArrowUp': (index: number) => this.moveChapterUp(workspaceId, index),
  'Ctrl+ArrowDown': (index: number) => this.moveChapterDown(workspaceId, index),
  'Ctrl+Delete': (index: number) => this.deleteChapterWithConfirm(workspaceId, index),
  'Ctrl+N': () => this.addChapterWithDialog(workspaceId),
  F2: (index: number) => this.editChapterInline(workspaceId, index),
};
```

## Testing Considerations

### Unit Testing

Key areas to test:

1. **Chapter Lifecycle Operations**
   - Creation with various parameters
   - Updates to different properties
   - Deletion with different preservation options

2. **Spine Ordering Logic**
   - Reordering edge cases (first/last positions)
   - Invalid index handling
   - Concurrent reorder operations

3. **Source File Association**
   - Auto-linking by naming convention
   - Collision handling in source file creation
   - Source file persistence through chapter operations

4. **Validation Logic**
   - Spine-manifest consistency checking
   - Duplicate detection
   - Missing reference detection

5. **Error Recovery**
   - Atomic operation rollback
   - Partial failure scenarios
   - Workspace corruption detection

### Integration Testing

1. **WorkspaceManager Integration**
   - Verify all file operations go through WorkspaceManager
   - Test transaction coordination
   - Validate workspace state consistency

2. **UI Component Integration**
   - Reactive updates to spine changes
   - Drag and drop behavior
   - Keyboard navigation functionality

3. **Performance Testing**
   - Large spine handling (1000+ chapters)
   - Rapid reordering operations
   - Memory usage with caching

### Mock Testing Strategy

```typescript
// Example mock setup for unit tests
const mockWorkspaceManager = {
  getWorkspaceOPF: vi.fn(),
  addManifestItem: vi.fn(),
  addSpineItem: vi.fn(),
  updateSpineOrder: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
};

const spineManager = new SpineItemManager(mockWorkspaceManager as any);

// Test chapter creation
it('should create chapter with all required files', async () => {
  mockWorkspaceManager.getWorkspaceOPF.mockResolvedValue(mockOPF);

  await spineManager.addChapter('workspace-123', {
    title: 'Test Chapter',
    linear: true,
  });

  expect(mockWorkspaceManager.addManifestItem).toHaveBeenCalledWith(
    'workspace-123',
    expect.objectContaining({
      id: expect.stringMatching(/^chapter\d+$/),
      href: expect.stringMatching(/^Text\/.*\.xhtml$/),
      mediaType: 'application/xhtml+xml',
    })
  );
});
```

## Internal Implementation Details

### File Naming Strategy

Sequential ID generation with collision detection:

```typescript
private async generateChapterId(workspaceId: string, baseTitle?: string): Promise<string> {
  const opf = await this.workspaceManager.getWorkspaceOPF(workspaceId);
  const existingIds = new Set(opf.manifest.map(item => item.id));

  if (baseTitle) {
    // Generate from title: "Chapter One" → "chapter-one"
    const baseId = baseTitle.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!existingIds.has(baseId)) return baseId;

    // Handle collisions: "chapter-one1", "chapter-one2", etc.
    let counter = 1;
    while (existingIds.has(`${baseId}${counter}`)) {
      counter++;
    }
    return `${baseId}${counter}`;
  }

  // Sequential generation: "chapter1", "chapter2", etc.
  let counter = 1;
  while (existingIds.has(`chapter${counter}`)) {
    counter++;
  }
  return `chapter${counter}`;
}
```

### Source File Templates

Default content generation for new source files:

```typescript
private generateSourceTemplate(chapterTitle: string): string {
  return `# ${chapterTitle}

[Write your chapter content here in plain text]

This file will be transformed into XHTML when you package your EPUB.

## Writing Tips:
- Use # for chapter headings
- Use ## for section headings
- Blank lines create paragraph breaks
- *italics* and **bold** formatting supported

---

Happy writing!
`;
}
```

### XHTML Template Generation

Standard XHTML structure for new chapters:

```typescript
private generateXHTMLTemplate(chapterTitle: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${chapterTitle}</title>
  <link rel="stylesheet" type="text/css" href="../Styles/style.css"/>
</head>
<body>
  <h1>${chapterTitle}</h1>

  <p>Chapter content will be generated from the source file during EPUB packaging.</p>
</body>
</html>`;
}
```

### Validation Rules

Comprehensive spine validation logic:

```typescript
private async validateSpineConsistency(workspaceId: string): Promise<SpineValidationResult> {
  const opf = await this.workspaceManager.getWorkspaceOPF(workspaceId);
  const errors: SpineValidationError[] = [];
  const warnings: SpineValidationWarning[] = [];

  // Check spine-manifest consistency
  const manifestIds = new Set(opf.manifest.map(item => item.id));
  for (const spineItem of opf.spine) {
    if (!manifestIds.has(spineItem.idref)) {
      errors.push({
        code: 'MISSING_MANIFEST_ITEM',
        message: `Spine item references missing manifest item: ${spineItem.idref}`,
        chapterId: spineItem.idref,
        severity: 'error'
      });
    }
  }

  // Check for duplicate spine items
  const spineIds = opf.spine.map(item => item.idref);
  const duplicates = spineIds.filter((id, index) => spineIds.indexOf(id) !== index);
  for (const duplicateId of [...new Set(duplicates)]) {
    errors.push({
      code: 'DUPLICATE_SPINE_ITEM',
      message: `Duplicate spine item: ${duplicateId}`,
      chapterId: duplicateId,
      severity: 'error'
    });
  }

  // Check for orphaned text files
  const textItems = opf.manifest.filter(item =>
    item.mediaType === 'application/xhtml+xml' &&
    !opf.spine.some(spine => spine.idref === item.id)
  );

  for (const orphan of textItems) {
    warnings.push({
      code: 'ORPHANED_TEXT_FILE',
      message: `Text file not included in reading order: ${orphan.href}`,
      chapterId: orphan.id,
      severity: 'warning'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalItems: opf.spine.length,
      linearItems: opf.spine.filter(item => item.linear !== false).length,
      nonLinearItems: opf.spine.filter(item => item.linear === false).length,
      itemsWithSource: await this.countItemsWithSource(workspaceId, opf.spine),
      orphanedSources: await this.countOrphanedSources(workspaceId, opf.spine)
    }
  };
}
```

## Usage Examples

### Basic Chapter Management

```typescript
import { SpineItemManager } from '$lib/spine';
import { WorkspaceManager } from '$lib/workspace';

const workspaceManager = new WorkspaceManager();
await workspaceManager.init();
const spineManager = new SpineItemManager(workspaceManager);

// Load chapters
const chapters = await spineManager.loadSpineItems('workspace-123');

// Add new chapter
const newChapter = await spineManager.addChapter('workspace-123', {
  title: 'Chapter 1: The Beginning',
  linear: true,
});

// Reorder chapters
await spineManager.reorderItems('workspace-123', 0, 2);

// Update chapter
await spineManager.updateChapter('workspace-123', 'chapter1', {
  linear: false,
  properties: ['page-spread-left'],
});

// Delete chapter
await spineManager.deleteChapter('workspace-123', 'chapter1');
```

### Source File Management

```typescript
// Create source file for existing chapter (automatically associated by naming convention)
const sourcePath = await spineManager.createSourceFile('workspace-123', 'chapter1');
// Creates: SOURCE/text/chapter1.txt (automatically linked to chapter1)

// Source files are automatically detected and associated based on naming convention:
// Chapter ID 'chapter1' → Source file 'SOURCE/text/chapter1.txt'
```

### Validation

```typescript
// Validate spine consistency
const validation = await spineManager.validateSpineOrder('workspace-123');

if (!validation.isValid) {
  console.error('Spine validation errors:', validation.errors);
}

if (validation.warnings.length > 0) {
  console.warn('Spine validation warnings:', validation.warnings);
}
```
