<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import ExtensionManagerDemo from './ExtensionManagerDemo/ExtensionManagerDemo.svelte';

  const { Story } = defineMeta({
    title: 'Backend/Extension Manager',
    component: ExtensionManagerDemo,
    tags: ['autodocs'],
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component: `
# Extension Manager Demo

Interactive demonstration of the Extension Manager system showing real-world workflows for JavaScript extension management in EPUB editing workspaces.

## Features Demonstrated

- **📁 File Upload & Validation**: Drag & drop JavaScript files with automatic validation
- **📦 Extension Import**: Smart name detection and workspace integration  
- **💾 Global Cache Management**: Efficient extension caching and conflict detection
- **📄 Multi-file Extensions**: Support for complex extensions with multiple files
- **🔄 Batch Operations**: Workspace scanning and bulk extension management
- **📊 Real-time Logging**: Activity tracking with detailed operation history

## Interactive Workflows

### 1. Basic Extension Import
**Upload → Validate → Import → Auto-cache**
- Drag & drop JavaScript files to upload zone
- Automatic file validation and name detection
- Import to workspace with auto-caching
- Real-time progress tracking

### 2. Cache Management  
**Browse Cache → Import → Conflict Detection**
- Browse pre-populated global cache
- Import extensions from cache to workspace
- Automatic conflict detection and resolution
- Cache statistics and management

### 3. Multi-file Extensions
**Import Base → Add Files → Manage Complete Extension**
- Build complex extensions with multiple files
- Add LICENSE files, plugins, and additional scripts
- Complete extension management and organization
- File type detection and categorization

### 4. Workspace Import
**EPUB Upload → Auto-Scan → Batch Cache → Summary**
- Simulate EPUB import with SOURCE/extensions/
- Automatic extension discovery and scanning
- Batch caching operations with conflict handling
- Comprehensive import summary and results

### 5. Extension Library
**Browse → Organize → Batch Operations → Export**
- Organize extension collections by category
- Search and filter capabilities
- Bulk operations (cache, delete, export)
- Extension statistics and analytics

## Backend Integration

This demo uses the real Extension Manager API with a mock file storage backend, demonstrating actual functionality that would be used in the EPUB editor. All operations are fully functional and demonstrate real-world usage patterns.

## Demo Components

- **ExtensionUploader**: Drag & drop interface with validation
- **ExtensionBrowser**: Tabbed workspace/cache browser with search
- **ExtensionDetails**: Detailed extension information panel
- **OperationLog**: Real-time activity logging with filtering
- **StatusPanel**: System status and storage quota monitoring
          `,
        },
      },
    },
  });
</script>

<Story name="Interactive Demo">
  <ExtensionManagerDemo />
</Story>

<style>
  :global(.sb-show-main) {
    padding: 0;
  }
</style>
