<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import WorkspaceOPFDemo from './WorkspaceOPFDemo.svelte';

  const { Story } = defineMeta({
    title: 'Backend Features/Workspace & OPF Manager',
    component: WorkspaceOPFDemo,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `
# Workspace & OPF Manager Demo

Interactive demonstration of the Workspace & OPF Manager backend functionality for EPUB editing.

## Features Demonstrated

- **🏗️ Workspace Creation**: Create complete EPUB workspace with metadata
- **📋 OPF Management**: Parse, validate, and modify OPF documents
- **📦 Manifest Operations**: Add/remove manifest items with auto-ID generation
- **🔍 Validation Engine**: Complete workspace structure validation with error reporting
- **📊 Preview Generation**: Content analysis with file categorization and dependency tracking
- **💾 Two-Tier Caching**: Memory + disk cache with TTL expiration
- **📝 Real-time Logging**: Activity tracking with color-coded status messages

## Backend Integration

- **WorkspaceManager**: Core workspace operations and OPF manipulation
- **WorkspaceMetadataCache**: Two-tier caching system (memory + disk)
- **ManifestDependencyTracker**: File dependency analysis
- **File Storage API**: OPFS/IndexedDB storage backend integration
- **EPUB Utilities**: OPF parsing, validation, and generation

## Usage Instructions

1. **Initialize**: Backend automatically initializes with proper configuration
2. **Create Sample**: Click "Create Sample Workspace" to generate a complete EPUB workspace
3. **Explore Workspace**: Click any workspace to view detailed OPF information
4. **View Validation**: See real-time validation results with error/warning details
5. **Check Preview**: Review content categorization and dependency analysis
6. **Monitor Cache**: Track caching performance and memory usage

## Sample Content Created

The demo creates a complete EPUB workspace with:
- Sample metadata (title, author, language, identifier)
- 4 sample chapters (Introduction, Chapter 1, Chapter 2, Conclusion)
- Resource files (CSS, images, fonts)
- Proper manifest and spine ordering
- Full EPUB 3.0 structure validation

This demonstrates the complete workspace lifecycle from creation to validation, showcasing all backend capabilities.
          `,
        },
      },
    },
  });
</script>

<!-- Interactive Demo Story -->
<Story name="Interactive Demo">
  <WorkspaceOPFDemo />
</Story>
