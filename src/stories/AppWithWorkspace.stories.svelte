<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import AppWithWorkspace from './components/AppWithWorkspace.svelte';

  const { Story } = defineMeta({
    title: 'Application/App with Demo Data',
    component: AppWithWorkspace,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'EDITME application with pre-populated demo workspace data. Shows the complete workflow with actual content including spine management, workspace creation, and error handling scenarios.',
        },
      },
    },
    argTypes: {
      scenario: {
        control: { type: 'select' },
        options: ['basicNovel', 'withErrors', 'minimal', 'comprehensive'],
        description: 'Demo content scenario to load',
      },
      startCollapsed: {
        control: { type: 'boolean' },
        description: 'Start with sidebar collapsed',
      },
      simulateError: {
        control: { type: 'boolean' },
        description: 'Simulate initialization error',
      },
      enableLogging: {
        control: { type: 'boolean' },
        description: 'Show demo controls and activity logs',
      },
    },
    tags: ['autodocs'],
  });
</script>

<Story
  name="Basic Demo Content"
  parameters={{
    docs: {
      description: {
        story:
          'EDITME application with a fully populated demo workspace containing sample chapters, metadata, and resources. Demonstrates the complete workflow with actual content including spine management, content editing interface, and navigation between sections.',
      },
    },
  }}
  args={{
    scenario: 'basicNovel',
    startCollapsed: false,
    simulateError: false,
    enableLogging: true,
  }}
/>

<Story
  name="Spine Management Demo"
  parameters={{
    docs: {
      description: {
        story:
          'Focused demonstration of the spine management features with a demo workspace containing chapters with various states (working, missing source files, non-linear). Navigate to the Spine Items section to explore the functionality.',
      },
    },
  }}
  args={{
    scenario: 'withErrors',
    startCollapsed: false,
    simulateError: false,
    enableLogging: true,
  }}
/>

<Story
  name="Error Handling Demo"
  parameters={{
    docs: {
      description: {
        story:
          'Demonstrates error handling when workspace initialization fails. Shows how the application gracefully handles errors and provides feedback to users.',
      },
    },
  }}
  args={{
    scenario: 'basicNovel',
    startCollapsed: false,
    simulateError: true,
    enableLogging: true,
  }}
/>
