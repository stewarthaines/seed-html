<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
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
  play={async ({ canvasElement }) => {
    // Use proper testing library imports
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');
    
    const canvas = within(canvasElement);
    const user = userEvent.setup();
    
    try {
      // Wait for storage initialization first
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reset storage demo using the component's built-in method
      const resetButton = canvas.getByText('Reset Demo');
      await user.click(resetButton);
      
      // Wait for reset to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create workspace
      const createButton = canvas.getByText('Create Workspace');
      await user.click(createButton);
      
      // Wait for workspace creation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Add sample EPUB
      const addEpubButton = canvas.getByText('Add Sample EPUB');
      await user.click(addEpubButton);
      
      // Wait for files to be created
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Read a file
      const mimetypeButton = canvas.getByText('mimetype');
      await user.click(mimetypeButton);
      
      // Wait to see the result
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log('Play function interaction failed:', error);
      // Continue anyway to show current state
    }
  }}
>
  <StorageDemo />
</Story>
