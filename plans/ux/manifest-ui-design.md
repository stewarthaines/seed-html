# Manifest UI Design

## Overview

The Manifest View provides a comprehensive interface for managing EPUB manifest items, combining a table-based item list with content preview capabilities. Following the existing project patterns from the metadata editor, this UI emphasizes accessibility, validation feedback, and consistent design language.

## Design Principles

Based on the existing metadata editor patterns:

- **Familiar Layout**: Tab-based navigation with consistent pane structure
- **Validation-First**: Real-time validation feedback with error indicators
- **Accessibility Focus**: ARIA labels, keyboard navigation, focus management
- **Responsive Design**: Mobile-friendly with adaptive layouts
- **Consistent Styling**: Leverages existing CSS design system

## Component Architecture

### Primary Components

1. **ManifestView** (Main container)
   - Manages overall state and data loading
   - Handles workspace integration
   - Coordinates between table and preview

2. **ManifestTable** (Item listing)
   - Sortable table with filtering
   - Row selection with preview integration
   - Bulk operations support

3. **ManifestPreview** (Content preview)
   - Multi-media content rendering
   - Metadata display
   - Action buttons (edit, download, delete)

4. **ManifestItemEditor** (Creation/editing modal)
   - Form-based item creation
   - Content upload handling
   - Validation feedback

## Key UX Patterns

### Table Interaction

- **Row Selection**: Click row to select and preview
- **Sorting**: Click column headers to sort
- **Filtering**: Real-time filter across ID, href, and media type
- **Actions**: Inline edit/delete buttons with confirmation

### Keyboard Navigation (A11y)

**Tab-based Navigation Pattern:**

1. **Filter input** - Type to filter items in real-time
2. **Load File button** - Primary creation action
3. **Create Text File button** - Secondary creation action
4. **All table rows** - Manifest items + SOURCE/ items (if advanced mode enabled)
5. **Preview pane action buttons** - Edit, Download, Delete for selected item

**Row Interaction:**

- Each table row is focusable (`tabindex="0"`)
- **Enter/Space** on focused row selects it and updates preview
- **Tab** moves to next row in sequence
- Visual focus indicators for keyboard users
- Screen reader announces row content and selection state

**Benefits:**

- **Predictable**: Standard web navigation pattern
- **Accessible**: Works seamlessly with screen readers and keyboard-only users
- **Simple**: No custom arrow key patterns to remember
- **Integrated**: SOURCE/ items flow naturally with manifest items

### Content Preview

- **Multi-format Support**: Text, images, audio, video, and binary
- **Metadata Display**: File size, modification date, properties
- **Action Integration**: Edit, download, and delete actions
- **Error Handling**: Graceful fallbacks for unsupported formats

### Item Creation

- **Dual Creation Methods**: Create text files or upload files
- **Smart Defaults**: Auto-generated IDs and media type detection
- **Validation Feedback**: Real-time validation with error highlighting
- **Progress Indicators**: Upload progress and save status

## Responsive Design

### Desktop (1024px+)

- Full table with all columns visible
- Side-by-side table and preview layout
- Toolbar with all actions visible

### Tablet (768px - 1023px)

- Simplified table with key columns
- Preview below table (stacked layout)
- Collapsible advanced section

### Mobile (< 768px)

- Card-based item list instead of table
- Full-screen preview mode
- Simplified toolbar with overflow menu

## Layout Decision

**Selected: Side-by-side layout (A)**

- Table on the left (60% width)
- Preview on the right (40% width)
- Resizable splitter between panes
- Consistent with existing pane-based layouts

## Questions for Refinement

### 1. ✅ Layout Preference - DECIDED

Side-by-side layout with resizable splitter

### 2. ✅ Table Density - DECIDED

Standard columns (ID, href, media type, size, properties)

### 3. ✅ Content Preview Scope - DECIDED

Rich preview (full text, playable audio/video, detailed metadata)

### 4. ✅ Item Creation Flow - DECIDED

Hybrid approach:

- **Primary**: "Load File" button with file picker (90% use case)
- **Secondary**: "Create Text File" creates with defaults, edit inline in table
- **Convenience**: Drag-and-drop overlay for file uploads
- **Accessibility**: All flows keyboard accessible with proper focus management

### 5. ✅ Validation Feedback - DECIDED

Inline in table cells with error styling (consistent with existing field patterns)

## Complete UI Specification

Based on your decisions, here's the complete manifest UI design:

### Final Layout Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Manifest View Header                                                    │
│ [🔍 Filter] [📁 Load File] [📝 Create Text File] [Drag & Drop Zone]   │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────┐ ┌─────────────────────────────────┐ │
│ │ Manifest Table (60%)            │ │ Content Preview (40%)           │ │
│ │                                 │ │                                 │ │
│ │ ID │ Path │ Type │ Size │ Props │ │ Selected: chapter1.xhtml        │ │
│ │ ✓  │ ch1  │ xhtml│ 12KB│ nav   │ │ ┌─────────────────────────────┐ │ │
│ │ ⚠  │ ch2  │ xhtml│ 8KB │       │ │ │ <h1>Chapter 1</h1>          │ │ │
│ │ ✓  │ img1 │ png  │ 45KB│       │ │ │ <p>This is the first...</p>  │ │ │
│ │ ✓  │ css  │ css  │ 3KB │       │ │ │                             │ │ │
│ │                                 │ │ └─────────────────────────────┘ │ │
│ │ [Error styling for invalid rows]│ │                                 │ │
│ │                                 │ │ Size: 12KB | Modified: 2024... │ │
│ │                                 │ │ [Edit] [Download] [Delete]      │ │
│ │─────────────────────────────────│ │                                 │ │
│ │ SOURCE/ Items (if advanced mode)│ │                                 │ │
│ │ 📁 text/chapter1.txt     [Tab] │ │                                 │ │
│ │ 📁 text/chapter2.txt     [Tab] │ │                                 │ │
│ │ 📁 transforms/custom.js  [Tab] │ │                                 │ │
│ │ [Same table row pattern]       │ │                                 │ │
│ └─────────────────────────────────┘ └─────────────────────────────────┘ │
│                                 ↕ Resizable Splitter                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Features Summary

- **Side-by-side layout** with resizable splitter (60/40 split)
- **Standard table columns**: ID, href, media type, size, properties
- **Rich content preview**: Full text, playable media, detailed metadata
- **Hybrid creation flow**: Load File button + Create Text File + drag-and-drop
- **Inline validation**: Error styling directly in table cells
- **Tab-based navigation**: Unified keyboard navigation through filter → buttons → all table rows → preview actions
- **Integrated SOURCE/ items**: Advanced mode items appear as regular table rows in natural tab sequence
- **Accessibility first**: Standard web navigation patterns, ARIA labels, screen reader support

## Storybook Story Coverage

Following our established [STORYBOOK.md](../../STORYBOOK.md) guidelines, manifest stories are organized by category with proper patterns and comprehensive coverage.

### Story Organization Structure

Stories follow the standardized categorization and are located in `src/stories/manifest/` following the metadata story pattern:

```
src/stories/manifest/
├── ManifestContainer.stories.svelte          # Components/Content/
├── ManifestContainerDemo.svelte
├── ManifestPreview.stories.svelte            # Components/Content/
├── ManifestPreviewDemo.svelte
├── ManifestItemManager.stories.svelte        # Components/Content/
├── ManifestItemManagerDemo.svelte
├── ManifestMetadataForm.stories.svelte       # Components/Content/
├── ManifestMetadataFormDemo.svelte
├── ManifestView.stories.svelte               # Application/
├── ManifestViewDemo.svelte
├── ManifestManager.stories.svelte            # Backend/
├── ManifestManagerDemo.svelte
├── manifest-demo.css                         # Shared component styles
└── mock-data/
    ├── manifest-items.ts
    ├── source-items.ts
    └── content-previews.ts
```

### Components/Content/ Stories (Args Pattern)

**`Components/Content/Manifest Container`**

- Default (empty state with creation prompts)
- With Items (populated manifest table)
- Loading State (skeleton placeholders)
- Error State (validation issues display)
- Mobile View (responsive card layout)

**`Components/Content/Manifest Preview`**

- No Selection (empty state message)
- Text File Preview (XHTML/HTML with syntax highlighting)
- Image Preview (various formats with metadata)
- Audio Preview (playable controls and metadata)
- Video Preview (playable controls and metadata)
- Binary File Info (download option for unsupported formats)
- Loading Preview (content loading state)
- Error Preview (failed to load content)

**`Components/Content/Manifest Item Manager`**

- Create Form (new item creation interface)
- Edit Form (modify existing item properties)
- Validation Errors (form with various validation issues)
- Upload Interface (file upload with drag-and-drop)
- Loading State (disabled form during operations)

**`Components/Content/Manifest Metadata Form`**

- Default Form (EPUB metadata editing)
- With Errors (validation error display)
- Loading State (disabled during save operations)

### Application/ Stories (Args Pattern)

**`Application/Manifest View`**

- Full Interface (sidebar + table + preview integration)
- Mobile Layout (stacked responsive design)
- Item Selection Flow (demonstrates selection → preview)
- CRUD Operations Demo (create, edit, delete workflows)
- Advanced Mode (with SOURCE/ items integrated)
- Mixed Content Types (text, images, audio, video, binary)

### Backend/ Stories (Direct Instantiation Pattern)

**`Backend/Manifest Manager`**

- CRUD Operations Demo (API method demonstrations)
- File Upload Demo (file processing workflows)
- Metadata Extraction Demo (OPF parsing and validation)
- Validation Demo (manifest validation rules)

### Mock Data Structure

Aligned with established patterns, mock data is organized in `src/stories/manifest/mock-data/`:

**`manifest-items.ts`** - Manifest item data:

```typescript
import type { ManifestItem } from '../../../lib/manifest/types';

export const createMockManifestItems = (
  count: number = 6,
  hasErrors: boolean = false
): ManifestItem[] => {
  const baseItems: ManifestItem[] = [
    {
      id: 'chapter1',
      href: 'OEBPS/chapter1.xhtml',
      mediaType: 'application/xhtml+xml',
      size: 12456,
      modified: new Date(Date.now() - 2 * 60 * 60 * 1000),
      properties: ['nav'],
      isInSpine: true,
      spineIndex: 0,
    },
    {
      id: 'chapter2',
      href: 'OEBPS/chapter2.xhtml',
      mediaType: 'application/xhtml+xml',
      size: 8934,
      modified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      isInSpine: true,
      spineIndex: 1,
    },
    {
      id: 'cover-image',
      href: 'OEBPS/images/cover.jpg',
      mediaType: 'image/jpeg',
      size: 245678,
      modified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      properties: ['cover-image'],
    },
    {
      id: 'stylesheet',
      href: 'OEBPS/styles/main.css',
      mediaType: 'text/css',
      size: 3456,
      modified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'audio-clip',
      href: 'OEBPS/audio/pronunciation.mp3',
      mediaType: 'audio/mpeg',
      size: 156789,
      modified: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  ];

  if (hasErrors) {
    baseItems.push({
      id: 'invalid-item',
      href: 'OEBPS/broken-file.xhtml',
      mediaType: 'application/xhtml+xml',
      size: 0,
      modified: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      hasError: true,
    });
  }

  return baseItems.slice(0, count);
};
```

**`source-items.ts`** - SOURCE directory items:

```typescript
import type { SourceItem } from '../../../lib/manifest/types';

export const createMockSourceItems = (): SourceItem[] => [
  {
    path: 'SOURCE/text/chapter1.txt',
    type: 'text',
    size: 8934,
    modified: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    path: 'SOURCE/text/chapter2.txt',
    type: 'text',
    size: 6789,
    modified: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    path: 'SOURCE/transforms/custom.js',
    type: 'javascript',
    size: 2345,
    modified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
];
```

### Interactive Behavior in Stories

**Limited Functionality for Visual Demonstration:**

- `Load File` button opens browser file dialog but performs no import
- `Create Text File` opens modal with working form validation
- `Filter` input provides real-time filtering of displayed items
- `Table row selection` updates preview pane with mock content
- `Delete` buttons show browser confirm() dialog but don't remove items
- `Edit` buttons open item editor modal with pre-populated data
- `Download` buttons simulate file download without actual file generation
- `Drag-and-drop` zone shows visual feedback but doesn't process files

### Story Development Guidelines

Following our established Storybook patterns:

**Args Pattern Implementation (Components/Application categories):**

```svelte
const { Story } = defineMeta({
  title: 'Components/Content/Manifest Container',
  component: ManifestContainerDemo,
  argTypes: {
    itemCount: {
      control: { type: 'number', min: 0, max: 20 },
      description: 'Number of mock manifest items to display',
    },
    isLoading: {
      control: { type: 'boolean' },
      description: 'Show loading skeleton state',
    },
    selectedItemId: {
      control: { type: 'text' },
      description: 'ID of currently selected item for preview',
    },
    advancedMode: {
      control: { type: 'boolean' },
      description: 'Show SOURCE/ items integrated with manifest',
    },
    hasErrors: {
      control: { type: 'boolean' },
      description: 'Include items with validation errors',
    },
    filterText: {
      control: { type: 'text' },
      description: 'Pre-populate filter input with search terms',
    },
    contentTypes: {
      control: { type: 'check' },
      options: ['text', 'image', 'audio', 'video', 'binary'],
      description: 'Mix of content types to include',
    },
  },
});
```

**Direct Instantiation Pattern (Backend category):**

```svelte
<Story name="CRUD Operations Demo">
  <ManifestManagerDemo showCRUDOperations={true} />
</Story>
```

**Component Separation Pattern:**

- Each story has a corresponding demo component (e.g., `ManifestContainerDemo.svelte`)
- Shared styles in `manifest-demo.css` following design system
- Mock data providers in dedicated `mock-data/` subdirectory
- TypeScript interfaces for consistent mock data structure

**`content-previews.ts`** - Preview content for different media types:

```typescript
export const getMockContentPreview = (href: string): string | null => {
  const contentMap: Record<string, string> = {
    'OEBPS/chapter1.xhtml': `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 1</title>
  <link rel="stylesheet" href="styles/main.css"/>
</head>
<body>
  <h1>Chapter 1: The Beginning</h1>
  <p>This is the first chapter of our story...</p>
</body>
</html>`,
    'OEBPS/images/cover.jpg': 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    'OEBPS/styles/main.css': `body { font-family: Georgia, serif; line-height: 1.6; }
h1 { color: #333; margin-bottom: 1em; }
p { margin-bottom: 1em; }`,
    'OEBPS/audio/pronunciation.mp3': 'blob:mock-audio-url',
  };

  return contentMap[href] || null;
};
```

### Testing Strategy

**Component Testing Focus:**

- **Props handling** - Verify components render correctly with different manifest data
- **Event emission** - Test that user interactions emit expected events
- **Conditional rendering** - Verify components show/hide elements based on state
- **Error states** - Test validation styling and error messaging
- **Filter functionality** - Test real-time filtering of manifest items
- **Preview updates** - Test that row selection updates preview pane

**Integration Testing:**

- **ManifestManager integration** - Mock manager and verify method calls
- **Event coordination** - Test that child component events trigger correct parent actions
- **Content loading** - Verify preview content loads correctly for different media types
- **Creation workflows** - Test file creation and upload flows

**Story Coverage Goals:**

- All component states (empty, loading, populated, error)
- All media type previews (text, image, audio, video, binary)
- All user interactions (selection, creation, editing, deletion)
- All validation scenarios (valid items, various error types)
- Responsive behavior at different screen sizes
- Keyboard navigation and accessibility patterns
