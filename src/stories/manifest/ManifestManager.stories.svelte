<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import ManifestManagerDemo from './ManifestManagerDemo.svelte';

  const { Story } = defineMeta({
    title: 'Backend/ManifestManager',
    component: ManifestManagerDemo,
    tags: ['autodocs'],
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component: `
# Manifest Manager Backend Demo

Interactive demonstration of the ManifestManager API for EPUB manifest management. Shows real backend integration with comprehensive CRUD operations, validation, and content management.

## Features Demonstrated

- **CRUD Operations**: Complete create, read, update, delete workflows for manifest items
- **File Operations**: File upload, content reading/writing, and binary handling
- **Validation System**: Real-time manifest validation with detailed error reporting
- **Content Processing**: Media type detection, metadata extraction, and preview generation
- **Advanced Features**: SOURCE/ directory management and advanced mode operations
- **Cache Management**: Content caching with size limits and performance optimization

## API Methods Covered

### Core Data Operations
- \`loadManifest()\` - Load all manifest items with caching
- \`getManifestItem()\` - Retrieve individual item details
- \`updateManifestItem()\` - Modify item properties with validation
- \`deleteManifestItem()\` - Remove items and cleanup associated files

### Content Operations
- \`getItemContent()\` - Read file content (text/binary)
- \`setItemContent()\` - Write content with size validation
- \`getContentPreview()\` - Generate content previews for UI

### Item Creation
- \`createTextItem()\` - Create new text files with templates
- \`createFileItem()\` - Upload and process binary files
- \`importFileItem()\` - Import files from external sources

### Advanced Features
- \`validateManifest()\` - Comprehensive validation reporting
- \`listSourceItems()\` - SOURCE/ directory integration
- \`reorderManifestItems()\` - Drag-and-drop reordering support

## Backend Integration

This demo uses real backend services for authentic behavior:
- **WorkspaceManager**: File system operations and workspace persistence
- **FileStorageAPI**: OPFS/IndexedDB storage with quota monitoring
- **ValidationEngine**: Schema validation and business rule enforcement
- **ContentProcessor**: Media type detection and metadata extraction

## Error Handling

Comprehensive error handling demonstrates:
- Network failure recovery
- Storage quota exceeded scenarios
- File corruption detection
- Validation error reporting
- Concurrent access management

## Performance Features

- Intelligent caching with size limits
- Lazy loading for large manifests
- Background validation processing
- Progress tracking for file operations
- Memory optimization for large files

This backend demo provides developers with complete visibility into the ManifestManager API behavior and integration patterns.
          `,
        },
      },
    },
  });
</script>

<Story
  name="CRUD Operations Demo"
  parameters={{
    docs: {
      description: {
        story:
          'Complete CRUD operations demonstration showing create, read, update, and delete workflows with real backend integration.',
      },
    },
  }}
>
  <ManifestManagerDemo />
</Story>

<Story
  name="File Upload Demo"
  parameters={{
    docs: {
      description: {
        story:
          'File upload and processing workflow demonstration including progress tracking, validation, and metadata extraction.',
      },
    },
  }}
>
  <ManifestManagerDemo />
</Story>

<Story
  name="Metadata Extraction Demo"
  parameters={{
    docs: {
      description: {
        story:
          'Automatic metadata extraction and content preview generation for different media types.',
      },
    },
  }}
>
  <ManifestManagerDemo />
</Story>

<Story
  name="Validation Demo"
  parameters={{
    docs: {
      description: {
        story:
          'Comprehensive validation system demonstration with error reporting and resolution guidance.',
      },
    },
  }}
>
  <ManifestManagerDemo />
</Story>