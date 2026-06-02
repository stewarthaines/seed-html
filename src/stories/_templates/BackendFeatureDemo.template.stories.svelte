<!--
  Template for Backend Feature Demo Stories
  
  Copy this file and rename to match your feature:
  - BackendFeatureDemo.template.stories.svelte -> YourFeatureDemo.stories.svelte
  - Update the import path and component reference
  - Update the title, description, and play function logic
-->

<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { within, userEvent } from '@storybook/test';
  // Update this import to match your demo component
  import BackendFeatureDemo from './BackendFeatureDemo.template.svelte';

  const { Story } = defineMeta({
    // Update this title to match your feature
    title: 'Backend/Your Feature Name',
    component: BackendFeatureDemo,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `
# Your Feature API Demo

Interactive demonstration of Your Feature's capabilities.

## Features Demonstrated

- **Feature Initialization**: Automatic setup and configuration
- **Core Operations**: Primary feature functionality
- **State Management**: Real-time state monitoring
- **Error Handling**: Graceful error handling with detailed logging

## Usage Instructions

1. **Initialize**: Feature automatically initializes on load
2. **Perform Operations**: Click buttons to test functionality  
3. **Monitor State**: View real-time state and results
4. **View Logs**: Monitor all operations in console log
5. **Reset**: Clean state for repeated testing

## Technical Details

Add specific technical information about your feature:
- API methods and parameters
- Data structures and formats
- Browser compatibility notes
- Performance characteristics

This demonstrates the complete feature workflow and validates functionality in a real browser environment.
          `,
        },
      },
    },
  });
</script>

<!-- Basic Interactive Demo -->
<Story name="Interactive Demo">
  <BackendFeatureDemo />
</Story>

<!-- Automated Demo with Sample Data -->
<Story
  name="Demo with Sample Data"
  play={async ({ canvas, userEvent }) => {
    try {
      // Wait for feature initialization
      await canvas.findByRole('main', {}, { timeout: 5000 });

      // Reset to clean state
      const resetButton = canvas.getByText('Reset Demo');
      await userEvent.click(resetButton);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Perform example operation
      const exampleButton = canvas.getByText('Example Operation');
      await userEvent.click(exampleButton);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Perform another operation
      const anotherButton = canvas.getByText('Another Operation');
      await userEvent.click(anotherButton);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Add more operations as needed for your feature demo
    } catch (error) {
      console.log('Play function interaction failed:', error);
      // Continue anyway to show current state
    }
  }}
>
  <BackendFeatureDemo />
</Story>

<!-- Additional story variants as needed -->
<Story name="Error Handling Demo">
  <BackendFeatureDemo />
</Story>
