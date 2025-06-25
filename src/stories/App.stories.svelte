<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { userEvent, within } from 'storybook/test';
  import App from '../App.svelte';

  const { Story } = defineMeta({
    title: 'Application/App',
    component: App,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'The complete EDITME EPUB editor application showing the full layout with sidebar navigation and resizable content panes.',
        },
      },
    },
    tags: ['autodocs'],
  });
</script>

<Story
  name="EDITME App - Default State"
  parameters={{
    docs: {
      description: {
        story:
          'The complete EDITME application in its default state with workspace section active, sidebar expanded, and placeholder content showing the app structure.',
      },
    },
  }}
/>

<Story
  name="EDITME App - Section Tour"
  parameters={{
    docs: {
      description: {
        story:
          'Interactive demonstration showing navigation through all sidebar sections to understand the complete application workflow.',
      },
    },
  }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Start at workspace (default)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Navigate to metadata
    const metadataButton = canvas.getByTitle('Metadata');
    await userEvent.click(metadataButton);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Navigate to manifest
    const manifestButton = canvas.getByTitle('Manifest');
    await userEvent.click(manifestButton);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Navigate to navigation/TOC
    const navButton = canvas.getByTitle('Navigation');
    await userEvent.click(navButton);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Navigate to spine items
    const spineButton = canvas.getByTitle('Spine Items');
    await userEvent.click(spineButton);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Navigate to settings
    const settingsButton = canvas.getByTitle('Settings');
    await userEvent.click(settingsButton);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Return to workspace
    const workspaceButton = canvas.getByTitle('Workspace');
    await userEvent.click(workspaceButton);
  }}
/>

<Story
  name="EDITME App - Sidebar Collapsed"
  parameters={{
    docs: {
      description: {
        story:
          'Application view with sidebar collapsed to maximize content editing and preview space.',
      },
    },
  }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggleButton = canvas.getByLabelText('Toggle sidebar');
    await userEvent.click(toggleButton);
  }}
/>

<Story
  name="EDITME App - Mobile/Tablet View"
  parameters={{
    viewport: {
      name: 'tablet',
    },
    docs: {
      description: {
        story:
          'Application layout optimized for tablet viewing. The layout adapts to smaller screen sizes while maintaining functionality.',
      },
    },
  }}
/>

<Story
  name="EDITME App - Interactive Demo"
  parameters={{
    docs: {
      description: {
        story:
          'Complete interactive demonstration showing sidebar toggle, section switching, and the full application workflow. Click around to explore the interface!',
      },
    },
  }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 500));

    // Quick section tour
    const sections = ['Metadata', 'Manifest', 'Navigation', 'Settings', 'Workspace'];

    for (const sectionName of sections) {
      const button = canvas.getByTitle(sectionName);
      await userEvent.click(button);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Toggle sidebar
    const toggleButton = canvas.getByLabelText('Toggle sidebar');
    await userEvent.click(toggleButton);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Expand again
    await userEvent.click(toggleButton);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return to workspace
    const workspaceButton = canvas.getByTitle('Workspace');
    await userEvent.click(workspaceButton);
  }}
/>
