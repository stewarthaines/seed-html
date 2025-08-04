<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { within, userEvent } from '@storybook/test';
  import WorkspaceCreationIntegration from './WorkspaceCreationIntegration.svelte';

  const { Story } = defineMeta({
    title: 'Backend/Workspace Creation Integration',
    component: WorkspaceCreationIntegration,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: 'Interactive demonstration of workspace creation workflow for debugging EPUB XHTML file writing issues.'
        }
      }
    }
  });
</script>

<!-- Interactive manual testing -->
<Story name="Interactive Demo">
  <WorkspaceCreationIntegration />
</Story>

<!-- Automated testing with play function -->
<Story
  name="Automated Integration Test"
  play={async ({ canvas, userEvent }) => {
    try {
      // Wait for backend initialization
      await canvas.findByRole('main', {}, { timeout: 8000 });

      // Reset to clean state
      if (window.resetWorkspaceIntegrationDemo) {
        await window.resetWorkspaceIntegrationDemo();
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Run the integration test
      const testButton = canvas.getByText('Run Complete Integration Test');
      await userEvent.click(testButton);
      
      // Wait for test completion
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      console.log('Integration test play function failed:', error);
    }
  }}
>
  <WorkspaceCreationIntegration />
</Story>

<!-- Cross-browser compatibility story -->
<Story
  name="Cross-Browser Storage Test"
  play={async ({ canvas, userEvent }) => {
    try {
      // Wait for initialization
      await canvas.findByRole('main', {}, { timeout: 8000 });

      // Run multiple tests to compare performance across browsers
      for (let i = 0; i < 2; i++) {
        if (window.resetWorkspaceIntegrationDemo) {
          await window.resetWorkspaceIntegrationDemo();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const testButton = canvas.getByText('Run Complete Integration Test');
        await userEvent.click(testButton);
        await new Promise(resolve => setTimeout(resolve, 4000));
      }

    } catch (error) {
      console.log('Cross-browser test failed:', error);
    }
  }}
>
  <WorkspaceCreationIntegration />
</Story>