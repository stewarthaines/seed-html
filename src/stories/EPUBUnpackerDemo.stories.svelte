<!--
  EPUB Unpacker Demo Story
  
  Demonstrates EPUB unpacking capabilities with various scenarios:
  - Valid EPUB 3.0 unpacking
  - Missing required files error handling
  - Corrupted XML error handling
  - Analysis-only mode
-->

<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { within, userEvent } from '@storybook/test';
  import EPUBUnpackerDemo from './EPUBUnpackerDemo.svelte';

  const { Story } = defineMeta({
    title: 'Backend/EPUB Unpacker',
    component: EPUBUnpackerDemo,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `
# EPUB Unpacker API Demo

Interactive demonstration of EPUB unpacking and analysis capabilities.

## Features Demonstrated

- **EPUB Validation**: Structure validation according to EPUB 3.0 specification
- **File Extraction**: Extraction of EPUB contents to workspace storage
- **Analysis Mode**: File listing and metadata analysis without extraction
- **Error Handling**: Graceful handling of malformed or incomplete EPUBs

## Demo Scenarios

1. **Valid EPUB 3.0**: Standard compliant EPUB with all required files
2. **Missing Files**: EPUB missing required mimetype or container.xml
3. **Corrupted XML**: EPUB with invalid XML in container or OPF files
4. **Analysis Only**: File analysis without workspace extraction

## Usage Instructions

1. **Upload Custom EPUB**: Use file input to test your own EPUB files
2. **Test Scenarios**: Click preset buttons to test specific error conditions
3. **Monitor Results**: View validation results and extracted files
4. **Check Logs**: Monitor detailed operation logs in console
5. **Reset State**: Clear workspace for repeated testing

## Technical Details

- **Validation**: Checks mimetype, container.xml, and OPF structure
- **Extraction**: Uses Compression Streams API for efficient decompression
- **Storage**: Integrates with OPFS/IndexedDB File Storage API
- **Error Recovery**: Continues processing despite individual file failures

This demonstrates the complete EPUB processing workflow and validates functionality in a real browser environment.
          `,
        },
      },
    },
  });
</script>

<!-- Basic Interactive Demo -->
<Story name="Interactive Demo">
  <EPUBUnpackerDemo />
</Story>

<!-- Automated Demo with Sample Data -->
<Story
  name="Demo with Sample Data"
  play={async ({ canvas, userEvent }) => {
    try {
      // Wait for initialization
      await canvas.findByRole('main', {}, { timeout: 5000 });
      
      // Reset to clean state
      const resetButton = canvas.getByText('Reset Demo');
      await userEvent.click(resetButton);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Test valid EPUB scenario
      const validEpubButton = canvas.getByText('Valid EPUB 3.0');
      await userEvent.click(validEpubButton);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test analysis mode
      const analysisButton = canvas.getByText('Analysis Mode');
      await userEvent.click(analysisButton);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Test error scenario
      const errorButton = canvas.getByText('Missing Files');
      await userEvent.click(errorButton);
      await new Promise(resolve => setTimeout(resolve, 800));
      
    } catch (error) {
      console.log('Play function interaction failed:', error);
    }
  }}
>
  <EPUBUnpackerDemo />
</Story>

<!-- Error Handling Demo -->
<Story name="Error Scenarios">
  <EPUBUnpackerDemo />
</Story>
