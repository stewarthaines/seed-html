<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import WorkspaceDebugTest from './components/WorkspaceDebugTest.svelte';

  const { Story } = defineMeta({
    title: 'Debug/Workspace Creation',
    component: WorkspaceDebugTest,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Debug test component for isolating workspace creation issues in story utilities.',
        },
      },
    },
    argTypes: {
      scenario: {
        control: { type: 'select' },
        options: ['basic', 'errorState', 'comprehensive'],
        description: 'Test scenario to use for workspace creation',
      },
    },
    tags: ['autodocs'],
  });
</script>

<Story
  name="Basic Scenario Test"
  args={{
    scenario: 'basic',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Tests workspace creation with the basic scenario configuration. Shows detailed debug information about the initialization process.',
      },
    },
  }}
/>

<Story
  name="Error Scenario Test"
  args={{
    scenario: 'errorState',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Tests workspace creation with error simulation enabled. Should show how errors are handled in the story utilities.',
      },
    },
  }}
/>

<Story
  name="Complex Scenario Test"
  args={{
    scenario: 'comprehensive',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Tests workspace creation with the comprehensive scenario that includes more complex content and configuration.',
      },
    },
  }}
/>
