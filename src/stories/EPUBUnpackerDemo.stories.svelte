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
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');
    
    const canvas = within(canvasElement);
    const user = userEvent.setup();
    
    try {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reset to clean state
      const resetButton = canvas.getByText('Reset Demo');
      await user.click(resetButton);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test valid EPUB scenario
      const validEpubButton = canvas.getByText('Valid EPUB 3.0');
      await user.click(validEpubButton);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test analysis mode
      const analysisButton = canvas.getByText('Analysis Mode');
      await user.click(analysisButton);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Test error scenario
      const errorButton = canvas.getByText('Missing Files');
      await user.click(errorButton);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
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
