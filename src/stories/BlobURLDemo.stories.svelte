<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { within, userEvent } from '@storybook/test';
  import BlobURLDemo from './BlobURLDemo.svelte';

  const { Story } = defineMeta({
    title: 'Backend/Blob URL Manager',
    component: BlobURLDemo,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `
# Blob URL Manager Demo

Interactive demonstration of the Blob URL Manager's core functionality for EPUB preview iframe support.

## Features Demonstrated

- **Blob URL Creation**: Convert EPUB assets (images, CSS, JS) into blob URLs
- **XHTML Processing**: Substitute relative asset URLs with blob URLs in XHTML content
- **Storage Integration**: Works with OPFS and IndexedDB backends automatically
- **Asset Type Support**: Handles various EPUB asset types with proper MIME detection

## How It Works

The Blob URL Manager enables EPUB preview iframes to load assets using standard relative URLs by:
1. Converting manifest items from storage into blob URLs
2. Processing XHTML content to replace relative URLs with blob URLs
3. Preserving original EPUB structure while enabling iframe preview

## Backend Optimization

- **OPFS**: Zero-copy blob creation for supported browsers (Chrome, Firefox, Safari)
- **IndexedDB**: Traditional blob creation for fallback scenarios
- **Automatic Detection**: Uses optimal path based on browser capabilities

## Usage Instructions

1. **Setup Demo**: Initialize storage, create workspace, and add sample EPUB assets
2. **Create Blob URLs**: Convert the sample assets into blob URLs
3. **Process XHTML**: Transform XHTML content with asset URL substitution
4. **Reset Demo**: Clean up and start fresh

## Sample Assets

The demo creates:
- \`cover.jpg\` - Sample image asset
- \`styles.css\` - Sample stylesheet
- \`reader.js\` - Sample JavaScript file
- Sample XHTML with references to these assets

This demonstrates the complete workflow used by the EPUB editor for preview iframe functionality.
        `,
        },
      },
    },
  });
</script>

<!-- Main Interactive Demo -->
<Story name="Interactive Demo">
  <BlobURLDemo />
</Story>

<!-- Automated Demo with Sample Workflow -->
<Story
  name="Demo with Sample Workflow"
  play={async ({ canvas, userEvent }) => {
    try {
      // Wait for component initialization
      await canvas.findByRole('main', {}, { timeout: 5000 });
      
      // Reset demo to clean state
      const resetButton = canvas.getByText('Reset Demo');
      await userEvent.click(resetButton);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Setup demo
      const setupButton = canvas.getByText('Setup Demo');
      await userEvent.click(setupButton);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create blob URLs
      const createBlobButton = canvas.getByText('Create Blob URLs');
      await userEvent.click(createBlobButton);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Process XHTML
      const processXHTMLButton = canvas.getByText('Process XHTML');
      await userEvent.click(processXHTMLButton);
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log('Play function interaction failed:', error);
      // Continue anyway to show current state
    }
  }}
>
  <BlobURLDemo />
</Story>
