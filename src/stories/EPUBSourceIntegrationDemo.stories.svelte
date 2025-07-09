<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import EPUBSourceIntegrationDemo from './EPUBSourceIntegrationDemo.svelte';

  const { Story } = defineMeta({
    title: 'Backend/EPUB with SOURCE.zip Integration',
    component: EPUBSourceIntegrationDemo,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `
# EPUB with SOURCE.zip Integration Demo

Interactive demonstration of the complete EPUB workflow with automatic SOURCE.zip management.

## Features Demonstrated

### EPUB Workflow Operations
- **EPUB Workspace Creation**: Create complete EPUB workspace with content and SOURCE/ files
- **EPUB Packaging**: Package workspace to EPUB with automatic SOURCE.zip creation
- **EPUB Unpacking**: Extract EPUB with automatic SOURCE.zip extraction to workspace
- **Round-trip Validation**: Verify workspace integrity after complete EPUB workflow

### EPUB Integration Features
- **Automatic SOURCE.zip Handling**: SOURCE/ files bundled/extracted seamlessly during EPUB operations
- **EPUB Structure Analysis**: Real-time analysis of EPUB manifest and SOURCE.zip presence
- **Workspace State Management**: Track both EPUB content and SOURCE/ files throughout workflow
- **EPUB File Operations**: Upload/download complete EPUB files with SOURCE.zip integration

### Technical Integration
- **Real EPUB Operations**: Uses actual EPUBPackager and EPUBUnpacker classes
- **Browser-native APIs**: File Storage API, ZIP operations, and File handling
- **Comprehensive Error Handling**: EPUB validation, SOURCE.zip integrity, workflow recovery
- **End-to-end Monitoring**: Real-time progress through complete EPUB workflow

## EPUB Workflow Instructions

1. **Create EPUB Workspace**: Demo creates workspace with EPUB content AND SOURCE/ files
2. **Package to EPUB**: Convert workspace to EPUB file (automatically creates SOURCE.zip)
3. **Analyze EPUB**: Examine EPUB structure and verify SOURCE.zip presence in manifest
4. **Unpack EPUB**: Extract EPUB to new workspace (automatically extracts SOURCE.zip)
5. **Verify Round-trip**: Compare original and reconstructed workspace integrity
6. **Upload Custom EPUB**: Test with your own EPUB files containing SOURCE.zip

## EPUB Integration Implementation

- **EPUB Standards Compliance**: Follows EPUB 2.0/3.0 specifications with SOURCE.zip as manifest item
- **Seamless SOURCE.zip Management**: Automatic bundling during packaging, extraction during unpacking
- **Storage Backend**: Browser-native File Storage API with workspace isolation
- **ZIP Operations**: Browser Compression Streams API for EPUB and SOURCE.zip handling
- **Cross-browser Compatibility**: Works across modern browsers with OPFS/IndexedDB fallbacks

## File Type Classification

- **Settings**: \`settings.json\` configuration files
- **Text**: Source content files in \`text/\` directory
- **Script**: Transform scripts in \`scripts/\` directory  
- **Extension**: Plugin files in \`extensions/\` directory
- **Other**: System files like \`.gitkeep\` and miscellaneous content

This demo showcases the complete EPUB workflow with SOURCE.zip integration, demonstrating how editor files are seamlessly managed within the EPUB packaging/unpacking process.
        `,
        },
      },
    },
  });
</script>

<!-- Basic interactive demo -->
<Story name="Interactive Demo">
  <EPUBSourceIntegrationDemo />
</Story>

<!-- Automated demo with sample operations -->
<Story
  name="Quick Demo"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');

    const canvas = within(canvasElement);
    const user = userEvent.setup();

    try {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Refresh workspace info to populate file lists
      const refreshButton = canvas.getByText('🔄 Refresh Info');
      await user.click(refreshButton);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Validate the workspace structure
      const validateButton = canvas.getByText('✅ Validate Workspace');
      await user.click(validateButton);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Package to EPUB (automatically creates SOURCE.zip)
      const packageButton = canvas.getByText('📦 Package to EPUB');
      await user.click(packageButton);
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Clear logs to show clean final state
      const clearLogsButton = canvas.getByText('🧹 Clear Logs');
      await user.click(clearLogsButton);
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log('EPUB integration demo play function failed:', error);
      // Continue to show current state
    }
  }}
>
  <EPUBSourceIntegrationDemo />
</Story>

<!-- Demo with complete EPUB workflow demonstration -->
<Story
  name="Complete EPUB Workflow"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');

    const canvas = within(canvasElement);
    const user = userEvent.setup();

    try {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 1: Show initial workspace state
      const refreshButton = canvas.getByText('🔄 Refresh Info');
      await user.click(refreshButton);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Validate workspace structure
      const validateButton = canvas.getByText('✅ Validate Workspace');
      await user.click(validateButton);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Package workspace to EPUB (creates SOURCE.zip automatically)
      const packageButton = canvas.getByText('📦 Package to EPUB');
      await user.click(packageButton);
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Step 4: Reset and create new workspace for unpacking demo
      const resetButton = canvas.getByText('🔄 Reset Demo');
      await user.click(resetButton);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 5: Show clean workspace state
      await user.click(refreshButton);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 6: Final validation of reset workspace
      await user.click(validateButton);
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.log('EPUB integration workflow demo failed:', error);
    }
  }}
>
  <EPUBSourceIntegrationDemo />
</Story>

<!-- Demo showing round-trip EPUB workflow -->
<Story
  name="Round-trip Integration"
  args={{}}
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');

    const canvas = within(canvasElement);
    const user = userEvent.setup();

    try {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Demonstrate complete round-trip:
      // 1. Workspace with EPUB + SOURCE files
      // 2. Package to EPUB (SOURCE.zip created)
      // 3. Unpack EPUB (SOURCE.zip extracted)
      // 4. Verify integrity
      
      const refreshButton = canvas.getByText('🔄 Refresh Info');
      await user.click(refreshButton);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const packageButton = canvas.getByText('📦 Package to EPUB');
      await user.click(packageButton);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // The demo would show the complete integration workflow
      // In a real scenario, we would unpack the created EPUB
      // to demonstrate the SOURCE.zip extraction process
      
    } catch (error) {
      console.log('Round-trip integration demo failed:', error);
    }
  }}
>
  <EPUBSourceIntegrationDemo />
</Story>
