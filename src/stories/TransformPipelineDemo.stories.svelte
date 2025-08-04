<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { within, userEvent } from '@storybook/test';
  import TransformPipelineDemo from './TransformPipelineDemo.svelte';

  const { Story } = defineMeta({
    title: 'Backend/Transform Pipeline',
    component: TransformPipelineDemo,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `
# Transform Pipeline Demo

Interactive demonstration of the Transform Pipeline system that converts plain text sources into XHTML spine items through configurable text and DOM transformations.

## Features Demonstrated

- **📝 Text Transformation**: Convert plain text with markdown-like syntax to HTML
- **🎨 DOM Transformation**: Apply CSS classes and structural modifications
- **📄 XHTML Generation**: Create valid XHTML documents with proper metadata
- **🔄 Pipeline Execution**: Sequential transformation through text → DOM → XHTML stages
- **📊 Real-time Monitoring**: Live console logging of each transformation step

## Transform Pipeline Components

- **TransformPipeline**: Main orchestrator managing the complete transformation workflow
- **TransformManager**: Loads and validates transform scripts from workspace settings
- **TransformExecutor**: Executes scripts in sandboxed environment with timeout protection
- **XHTML Template**: Generates final XHTML with proper DOCTYPE, namespaces, and metadata

## Sample Transformations

### Text Transform
- Converts \`# Heading\` to \`<h1>Heading</h1>\`
- Converts \`## Subheading\` to \`<h2>Subheading</h2>\`
- Converts \`**bold**\` to \`<strong>bold</strong>\`
- Converts \`*italic*\` to \`<em>italic</em>\`
- Wraps paragraphs in \`<p>\` tags

### DOM Transform
- Adds \`chapter-content\` class to body
- Adds \`chapter-title\` class to h1 elements
- Adds \`section-title\` class to h2 elements
- Adds \`content-text\` class to paragraphs

### XHTML Generation
- Proper XML declaration and DOCTYPE
- XHTML namespace declarations
- Stylesheet and script references
- Custom metadata injection

## Usage Instructions

1. **View Sample Text**: Default content shows markdown-like syntax
2. **Edit Input**: Modify the input text to test different content
3. **Run Transform**: Click "Run Transform Pipeline" to execute all stages
4. **View Results**: Examine the three transformation stages in sequence
5. **Monitor Progress**: Watch real-time logging in the console section
6. **Reset Demo**: Clear results and start fresh

## Technical Implementation

- **Mock File Storage**: Simulates workspace with sample transform scripts
- **Sandboxed Execution**: Safe script execution with timeout protection
- **Error Isolation**: Transform failures don't crash the demo
- **Browser Native**: Uses DOMParser and document manipulation APIs

This demonstrates the complete transformation workflow from plain text input to final XHTML output, showcasing how the Transform Pipeline enables dynamic content generation for EPUB creation.
        `,
        },
      },
    },
  });
</script>

<!-- Interactive Demo Story -->
<Story name="Interactive Demo">
  <TransformPipelineDemo />
</Story>

<!-- Automated Demo with Sample Data -->
<Story
  name="Demo with Sample Data"
  play={async ({ canvas, userEvent }) => {
    try {
      // Wait for component initialization
      await canvas.findByRole('main', {}, { timeout: 5000 });

      // Reset to clean state
      const resetButton = canvas.getByText('Reset Demo');
      await userEvent.click(resetButton);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Run the transform pipeline
      const transformButton = canvas.getByText('Run Transform Pipeline');
      await userEvent.click(transformButton);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Allow time to see the results
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log('Play function interaction failed:', error);
      // Continue anyway to show current state
    }
  }}
>
  <TransformPipelineDemo />
</Story>
