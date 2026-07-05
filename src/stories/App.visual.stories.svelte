<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import App from '../App.svelte';
  import { seedProject } from './utils/seed-project';

  const { Story } = defineMeta({
    title: 'Application/App (Visual)',
    component: App,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Visual states of the SEED.html EPUB editor: the first-run experience, and the app open on a seeded project. Navigation tours live under Application/Router System.',
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
          'The application as a first-time user sees it: no projects yet, the About view, and the Get Started actions.',
      },
    },
  }}
/>

<Story
  name="Project Open"
  loaders={[
    async () => ({ seeded: await seedProject({ title: 'Visual Demo Book', view: 'spine' }) }),
  ]}
  parameters={{
    docs: {
      description: {
        story:
          'The app restored onto a seeded two-chapter book — sidebar with project sections and chapters, spine editor ready.',
      },
    },
  }}
  play={async ({ canvas }) => {
    // Not a tour — just wait until the seeded project is fully on screen so
    // docs/capture snapshots show the real thing.
    await canvas.findByText('Visual Demo Book', {}, { timeout: 60000 });
    await canvas.findByText('chapter01', {}, { timeout: 60000 });
  }}
>
  <App />
</Story>
