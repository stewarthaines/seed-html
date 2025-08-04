<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { within, userEvent } from '@storybook/test';
  import ManifestViewDemo from './ManifestViewDemo.svelte';

  const { Story } = defineMeta({
    title: 'Application/ManifestView',
    component: ManifestViewDemo,
    tags: ['autodocs'],
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component: `
# Manifest View Demo

Complete manifest management application demonstrating the full workflow for EPUB manifest management. Integrates table view, content preview, and item editing in a unified interface.

## Features Demonstrated

- **Full Interface Integration**: Toolbar, table, preview, and modal components working together
- **Real-time Updates**: Changes reflect immediately across all interface components
- **Multi-device Support**: Responsive design adapting to different screen sizes
- **Advanced Mode**: Optional SOURCE/ directory integration with unified navigation
- **CRUD Operations**: Complete create, read, update, delete workflows
- **Content Type Variety**: Support for text, images, audio, video, and binary files
- **Error Handling**: Comprehensive error states and recovery mechanisms

## Application Workflows

- **Item Selection**: Click table rows to preview content in the sidebar
- **Content Creation**: Use toolbar buttons to create new text files or upload binaries
- **Bulk Operations**: Multi-select items for batch operations
- **Filter/Search**: Real-time filtering across all manifest properties
- **Advanced Features**: SOURCE/ directory access in advanced mode

## Layout Variants

- **Desktop**: Side-by-side table and preview with resizable splitter
- **Tablet**: Stacked layout with collapsible sections
- **Mobile**: Full-screen modal transitions with simplified navigation

## Backend Integration

This application demo uses real backend services for authentic behavior:
- WorkspaceManager for file operations and persistence
- ManifestManager for validation and content management
- FileStorageAPI for OPFS/IndexedDB storage with quota monitoring

## Implementation Details

The ManifestView integrates multiple components following the established architecture:
- Event-driven communication between components
- Centralized state management for selection and editing
- Accessibility-first design with keyboard navigation
- Internationalization support with RTL language handling
- Performance optimization with lazy loading and caching

This demonstrates the complete manifest management experience as it would appear in the production EPUB editor.
          `,
        },
      },
    },
    argTypes: {
      layout: {
        control: { type: 'select' },
        options: ['desktop', 'tablet', 'mobile'],
        description: 'Layout variant for different screen sizes',
      },
      itemCount: {
        control: { type: 'number', min: 0, max: 20 },
        description: 'Number of manifest items to display',
      },
      advancedMode: {
        control: { type: 'boolean' },
        description: 'Enable advanced mode with SOURCE/ integration',
      },
      selectedItemId: {
        control: { type: 'text' },
        description: 'Initially selected item ID',
      },
      hasValidationErrors: {
        control: { type: 'boolean' },
        description: 'Include items with validation errors',
      },
      showCreateModal: {
        control: { type: 'boolean' },
        description: 'Show item creation modal on load',
      },
      filterText: {
        control: { type: 'text' },
        description: 'Pre-populate search filter',
      },
      contentTypes: {
        control: { type: 'check' },
        options: ['text', 'image', 'audio', 'video', 'binary'],
        description: 'Content types to include in demo',
      },
      isLoading: {
        control: { type: 'boolean' },
        description: 'Show loading state',
      },
    },
  });
</script>

<Story
  name="Full Interface"
  args={{
    layout: 'desktop',
    itemCount: 8,
    advancedMode: false,
    selectedItemId: 'chapter1',
    hasValidationErrors: false,
    showCreateModal: false,
    filterText: '',
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    isLoading: false,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Complete manifest view with table, preview, and toolbar integration. Shows the standard desktop layout with a selected item.',
      },
    },
  }}
/>

<Story
  name="Mobile Layout"
  args={{
    layout: 'mobile',
    itemCount: 6,
    advancedMode: false,
    selectedItemId: 'nav',
    hasValidationErrors: false,
    showCreateModal: false,
    filterText: '',
    contentTypes: ['text', 'image'],
    isLoading: false,
  }}
  parameters={{
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story:
          'Mobile-responsive layout with stacked components and touch-optimized controls. Preview opens in full-screen modal.',
      },
    },
  }}
/>

<Story
  name="Item Selection Flow"
  args={{
    layout: 'desktop',
    itemCount: 10,
    advancedMode: false,
    selectedItemId: 'cover-image',
    hasValidationErrors: false,
    showCreateModal: false,
    filterText: '',
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    isLoading: false,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Demonstrates item selection workflow with image preview. Shows how content preview updates when different items are selected.',
      },
    },
  }}
/>

<Story
  name="CRUD Operations Demo"
  args={{
    layout: 'desktop',
    itemCount: 5,
    advancedMode: false,
    selectedItemId: '',
    hasValidationErrors: false,
    showCreateModal: true,
    filterText: '',
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    isLoading: false,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'CRUD operations demonstration with create modal open. Shows the item creation workflow integrated with the main interface.',
      },
    },
  }}
/>

<Story
  name="Advanced Mode"
  args={{
    layout: 'desktop',
    itemCount: 6,
    advancedMode: true,
    selectedItemId: 'chapter1',
    hasValidationErrors: false,
    showCreateModal: false,
    filterText: '',
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    isLoading: false,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Advanced mode with SOURCE/ directory items integrated into the table view. Shows unified navigation between manifest and source files.',
      },
    },
  }}
/>

<Story
  name="Mixed Content Types"
  args={{
    layout: 'desktop',
    itemCount: 12,
    advancedMode: true,
    selectedItemId: 'audio-clip',
    hasValidationErrors: false,
    showCreateModal: false,
    filterText: '',
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    isLoading: false,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Full content type variety with audio file selected for preview. Demonstrates media playback integration within the manifest view.',
      },
    },
  }}
/>

<Story
  name="Validation Errors"
  args={{
    layout: 'desktop',
    itemCount: 8,
    advancedMode: false,
    selectedItemId: 'invalid-missing-href',
    hasValidationErrors: true,
    showCreateModal: false,
    filterText: '',
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    isLoading: false,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Manifest view with validation errors displayed. Shows error indicators in the table and error details in the preview pane.',
      },
    },
  }}
/>

<Story
  name="Filtered View"
  args={{
    layout: 'desktop',
    itemCount: 15,
    advancedMode: true,
    selectedItemId: '',
    hasValidationErrors: false,
    showCreateModal: false,
    filterText: 'chapter',
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    isLoading: false,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Filtered view showing only items matching "chapter" search term. Demonstrates real-time filtering across manifest properties.',
      },
    },
  }}
/>

<Story
  name="Loading State"
  args={{
    layout: 'desktop',
    itemCount: 0,
    advancedMode: false,
    selectedItemId: '',
    hasValidationErrors: false,
    showCreateModal: false,
    filterText: '',
    contentTypes: ['text', 'image', 'audio', 'video', 'binary'],
    isLoading: true,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Loading state while manifest data is being fetched. Shows skeleton placeholders and loading indicators throughout the interface.',
      },
    },
  }}
/>

<Story
  name="Tablet Layout"
  args={{
    layout: 'tablet',
    itemCount: 8,
    advancedMode: false,
    selectedItemId: 'chapter2',
    hasValidationErrors: false,
    showCreateModal: false,
    filterText: '',
    contentTypes: ['text', 'image', 'audio'],
    isLoading: false,
  }}
  parameters={{
    viewport: {
      defaultViewport: 'tablet',
    },
    docs: {
      description: {
        story:
          'Tablet layout with stacked table and preview sections. Shows intermediate responsive design between desktop and mobile.',
      },
    },
  }}
/>