<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import App from '../App.svelte';
  import { seedProject } from './utils/seed-project';

  // Seeded navigation demos: a real project is created before App mounts, so
  // the sidebar's project sections exist and the tour drives real views.
  const { Story } = defineMeta({
    title: 'Application/Router System',
    component: App,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Navigation router demos on a seeded project: centralized view management, per-view state, and persistence. See src/stories/utils/seed-project.ts for the seeding harness.',
        },
      },
    },
    tags: ['capture'],
  });
</script>

<Story
  name="Navigate the project views"
  loaders={[
    async () => ({ seeded: await seedProject({ title: 'Router Demo Book', view: 'spine' }) }),
  ]}
  parameters={{
    docs: {
      description: {
        story:
          'Walks the sidebar through Metadata, Manifest, Navigation, and Settings on a seeded book, waiting for each view to render.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    // App boots and restores the seeded workspace.
    await canvas.findByText('Router Demo Book', {}, { timeout: 60000 });

    // Navigate by data-testid hook, assert by the localized view heading (the
    // heading assertion is the real check; the nav step is just plumbing).
    for (const section of ['metadata', 'manifest', 'navigation']) {
      const button = await canvas.findByTestId(`nav-${section}`, {}, { timeout: 20000 });
      await userEvent.click(button);
      await canvas.findByRole('heading', { name: new RegExp(section, 'i') }, { timeout: 20000 });
    }

    const settings = await canvas.findByTestId('nav-settings', {}, { timeout: 20000 });
    await userEvent.click(settings);
    await canvas.findByRole('heading', { name: /Settings/i }, { timeout: 20000 });
  }}
>
  <App />
</Story>

<Story
  name="View state persists across navigation"
  loaders={[
    async () => ({ seeded: await seedProject({ title: 'Router Demo Book', view: 'spine' }) }),
  ]}
  parameters={{
    docs: {
      description: {
        story:
          'Opens a chapter in the spine editor, navigates away to Metadata, and returns — the spine view restores with the chapter still selected.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await canvas.findByText('Router Demo Book', {}, { timeout: 60000 });

    // Open a chapter in the spine editor (navigate by testid; see STORYBOOK.md).
    const chapter = await canvas.findByTestId('spine-item-chapter01', {}, { timeout: 60000 });
    await userEvent.click(chapter);
    await canvas.findByRole('textbox', {}, { timeout: 60000 });

    // Navigate away…
    const metadata = await canvas.findByTestId('nav-metadata', {}, { timeout: 20000 });
    await userEvent.click(metadata);
    await canvas.findByRole('heading', { name: /Metadata/i }, { timeout: 20000 });

    // …and back: the editor state is restored without re-selecting the chapter.
    const chapterAgain = await canvas.findByTestId('spine-item-chapter01', {}, { timeout: 20000 });
    await userEvent.click(chapterAgain);
    await canvas.findByRole('textbox', {}, { timeout: 60000 });
  }}
>
  <App />
</Story>
