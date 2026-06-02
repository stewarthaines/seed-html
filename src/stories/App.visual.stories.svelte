<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { within, userEvent } from '@storybook/test';
  import App from '../App.svelte';

  const { Story } = defineMeta({
    title: 'Application/App (Visual)',
    component: App,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Visual demonstration of the EDITME EPUB editor application. These stories showcase the application UI and navigation without pre-loaded content.',
        },
      },
    },
    tags: ['autodocs'],
  });
</script>

<Story
  name="Initial Application State"
  parameters={{
    docs: {
      description: {
        story:
          'Shows the application in its initial state when first loaded, with empty workspace and all UI sections available for navigation.',
      },
    },
  }}
/>

<Story
  name="Section Navigation Demo"
  parameters={{
    docs: {
      description: {
        story:
          'Interactive tour through all sidebar sections to showcase the complete application navigation workflow.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    // Wait for app to initialize - use a more specific selector to avoid multiple main elements
    await canvas.findByText('Get Started', {}, { timeout: 5000 });

    // Navigate through sections
    const sections = [
      { name: 'Metadata', title: 'Metadata' },
      { name: 'Manifest', title: 'Manifest' },
      { name: 'Navigation', title: 'Navigation' },
      { name: 'Settings', title: 'Settings' },
      { name: 'Workspace', title: 'Workspace' },
    ];

    for (const section of sections) {
      try {
        const button = canvas.getByTitle(section.title);
        await userEvent.click(button);
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (error) {
        console.log(`Could not find button for ${section.name}:`, error);
      }
    }
  }}
/>
