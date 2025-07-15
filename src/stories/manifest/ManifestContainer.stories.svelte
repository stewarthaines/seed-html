<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import ManifestContainerDemo from './ManifestContainerDemo.svelte';

  const { Story } = defineMeta({
    title: 'Components/Content/ManifestContainer',
    component: ManifestContainerDemo,
    tags: ['autodocs'],
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component: `
# Manifest Container Demo

Complete manifest management interface demonstrating table-based item listing with content preview capabilities. Uses real backend integration for authentic UX testing.

## Features Demonstrated

- **Item Management**: Load, create, edit, and delete manifest items
- **Advanced Mode**: Optional SOURCE/ directory items integration
- **Real-time Validation**: Manifest validation with error indicators
- **File Upload**: Drag-and-drop and file picker support
- **Content Types**: Support for text, image, audio, video, and binary files
- **Responsive Design**: Mobile-friendly with adaptive layouts

## Backend Status

- ✅ **Real ManifestManager**: Full EPUB manifest integration
- ✅ **Real WorkspaceManager**: Actual file operations and workspace persistence
- ✅ **Real FileStorageAPI**: OPFS/IndexedDB backend with quota monitoring

## Usage Instructions

1. **View Items**: Browse manifest items in the sortable table
2. **Select Items**: Click any row to select and preview content
3. **Create Items**: Use "Load File" or "Create Text File" buttons
4. **Filter Items**: Type in the search box to filter items by ID, href, or media type
5. **Advanced Mode**: Toggle to see SOURCE/ directory items integrated with manifest
6. **File Operations**: Edit, download, or delete items using action buttons

## Implementation Details

This manifest container follows the established UX design patterns with:
- Event-based Svelte architecture avoiding prop drilling
- Comprehensive error handling and loading states
- Accessible ARIA labels and keyboard navigation
- RTL language support with logical CSS properties
- Real backend integration for authentic data persistence

The implementation integrates with the complete manifest management system including validation, caching, and real file operations.
          `,
        },
      },
    },
    argTypes: {
      itemCount: {
        control: { type: 'number', min: 0, max: 20 },
        description: 'Number of mock manifest items to display',
      },
      isLoading: {
        control: { type: 'boolean' },
        description: 'Show loading skeleton state',
      },
      hasErrors: {
        control: { type: 'boolean' },
        description: 'Include items with validation errors',
      },
      advancedMode: {
        control: { type: 'boolean' },
        description: 'Show SOURCE/ items integrated with manifest',
      },
      contentTypes: {
        control: { type: 'check' },
        options: ['text', 'image', 'audio', 'video', 'binary'],
        description: 'Mix of content types to include',
      },
      selectedItemId: {
        control: { type: 'text' },
        description: 'ID of currently selected item for preview',
      },
      filterText: {
        control: { type: 'text' },
        description: 'Pre-populate filter input with search terms',
      },
      hasWorkspace: {
        control: { type: 'boolean' },
        description: 'Whether a workspace is available (affects loading state)',
      },
    },
  });
</script>

<Story
  name="Default"
  args={{
    itemCount: 6,
    isLoading: false,
    hasErrors: false,
    advancedMode: false,
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    selectedItemId: '',
    filterText: '',
    hasWorkspace: true,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Default manifest container with typical EPUB manifest items. Shows the standard table view with mixed content types and no errors.',
      },
    },
  }}
/>

<Story
  name="With Items"
  args={{
    itemCount: 10,
    isLoading: false,
    hasErrors: false,
    advancedMode: false,
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    selectedItemId: 'chapter1',
    filterText: '',
    hasWorkspace: true,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Populated manifest container with multiple items and a pre-selected item. Demonstrates the selection state and preview integration.',
      },
    },
  }}
/>

<Story
  name="Loading State"
  args={{
    itemCount: 0,
    isLoading: true,
    hasErrors: false,
    advancedMode: false,
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    selectedItemId: '',
    filterText: '',
    hasWorkspace: true,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Loading state shown while manifest data is being fetched. Displays loading indicator with appropriate messaging.',
      },
    },
  }}
/>

<Story
  name="Error State"
  args={{
    itemCount: 8,
    isLoading: false,
    hasErrors: true,
    advancedMode: false,
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    selectedItemId: '',
    filterText: '',
    hasWorkspace: true,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Error state with validation issues displayed. Shows how validation errors are presented in the manifest table with error indicators.',
      },
    },
  }}
/>

<Story
  name="Advanced Mode"
  args={{
    itemCount: 6,
    isLoading: false,
    hasErrors: false,
    advancedMode: true,
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    selectedItemId: '',
    filterText: '',
    hasWorkspace: true,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Advanced mode enabled showing SOURCE/ directory items integrated with manifest items. Demonstrates the unified table view with both content types.',
      },
    },
  }}
/>

<Story
  name="Mobile View"
  args={{
    itemCount: 4,
    isLoading: false,
    hasErrors: false,
    advancedMode: false,
    contentTypes: ['text', 'image'],
    selectedItemId: 'nav',
    filterText: '',
    hasWorkspace: true,
  }}
  parameters={{
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story:
          'Mobile-responsive view with simplified layout. Shows how the manifest container adapts to smaller screens with card-based layout.',
      },
    },
  }}
/>

<Story
  name="Filtered View"
  args={{
    itemCount: 10,
    isLoading: false,
    hasErrors: false,
    advancedMode: true,
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    selectedItemId: '',
    filterText: 'chapter',
    hasWorkspace: true,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Manifest container with filter applied. Demonstrates real-time filtering functionality across item IDs, hrefs, and media types.',
      },
    },
  }}
/>

<Story
  name="Empty State"
  args={{
    itemCount: 0,
    isLoading: false,
    hasErrors: false,
    advancedMode: false,
    contentTypes: [],
    selectedItemId: '',
    filterText: '',
    hasWorkspace: false,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Empty state when no workspace is available or manifest is empty. Shows appropriate messaging and creation prompts.',
      },
    },
  }}
/>