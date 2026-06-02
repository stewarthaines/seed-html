<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { within, userEvent } from '@storybook/test';
  import StorageDemo from './StorageDemo.svelte';

  const { Story } = defineMeta({
    title: 'Backend/Storage API',
    component: StorageDemo,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `
# File Storage API Demo

Interactive demonstration of the EPUB editor's file storage capabilities using OPFS with IndexedDB fallback.

## Features Demonstrated

- **Storage Initialization**: Automatic backend detection (OPFS vs IndexedDB)
- **Workspace Management**: Create, select, and delete isolated workspaces
- **File Operations**: Write, read, and list files with sample EPUB structure
- **Storage Monitoring**: Real-time quota usage and available space
- **Error Handling**: Graceful error handling with detailed logging

## Backend Support

- **OPFS Async**: Chrome, Firefox, Edge (main thread operations)
- **OPFS Sync**: Safari (worker-based operations)  
- **IndexedDB**: Universal fallback for file:// protocol and older browsers

## Usage Instructions

1. **Initialize**: Storage automatically initializes on load
2. **Create Workspace**: Click "Create Workspace" to create an isolated workspace
3. **Add Sample EPUB**: Click "Add Sample EPUB" to create a complete EPUB file structure
4. **Explore Files**: Click on any file to read its contents
5. **Monitor Storage**: View real-time storage quota usage

## File Structure Created

The sample EPUB includes:
- \`mimetype\` - EPUB media type declaration
- \`META-INF/container.xml\` - Container metadata
- \`OEBPS/content.opf\` - Package document with metadata and manifest
- \`OEBPS/chapter1.xhtml\` - Sample chapter content

This demonstrates the complete workspace isolation and file organization used by the EPUB editor.
          `,
        },
      },
    },
  });
</script>

<!-- Main Demo Story -->
<Story name="Interactive Demo">
  <StorageDemo />
</Story>

<!-- Demo with Sample Data (Automated Interactions) -->
<Story
  name="Demo with Sample Data"
  play={async ({ canvas, userEvent }) => {
    try {
      // Wait for storage initialization first
      await canvas.findByRole('main', {}, { timeout: 5000 });

      // Reset storage demo using the component's built-in method
      const resetButton = canvas.getByText('Reset Demo');
      await userEvent.click(resetButton);

      // Wait for reset to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create workspace
      const createButton = canvas.getByText('Create Workspace');
      await userEvent.click(createButton);

      // Wait for workspace creation
      await new Promise(resolve => setTimeout(resolve, 300));

      // Add sample EPUB
      const addEpubButton = canvas.getByText('Add Sample EPUB');
      await userEvent.click(addEpubButton);

      // Wait for files to be created
      await new Promise(resolve => setTimeout(resolve, 300));

      // Read a file
      const mimetypeButton = canvas.getByText('mimetype');
      await userEvent.click(mimetypeButton);

      // Wait to see the result
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.log('Play function interaction failed:', error);
      // Continue anyway to show current state
    }
  }}
>
  <StorageDemo />
</Story>

<style>
  /* Override app.css body overflow: hidden for Storybook scrolling */
  :global(body) {
    overflow: auto !important;
  }
</style>
