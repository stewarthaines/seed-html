<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import App from '../../App.svelte';
  import { seedProject } from '../utils/seed-project';

  // Seed a real project in the real storage backend BEFORE App mounts; App
  // restores onto it via the persisted workspace id, exactly like a reload.
  // The seeded handle is exposed to play() via the loader context.
  const { Story } = defineMeta({
    title: 'Workflows/Edit and Package',
    component: App,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Workflow stories: each seeds a real project (see src/stories/utils/seed-project.ts), mounts the full app, and drives an author workflow with play(). Tagged `capture` for the screenshot/video scripts.',
        },
      },
    },
    tags: ['capture'],
  });
</script>

<Story
  name="Edit a chapter and package the EPUB"
  loaders={[
    async () => {
      const seeded = await seedProject({
        title: 'Storybook Seeded Book',
        author: 'Storybook',
        view: 'spine',
      });
      return { seeded };
    },
  ]}
  parameters={{
    docs: {
      description: {
        story:
          'Seeds a two-chapter book, opens a chapter, appends text in the editor, then packages the EPUB and lands on the Publish view.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    // The app boots and restores the seeded workspace — wait for its title.
    await canvas.findByText('Storybook Seeded Book', {}, { timeout: 60000 });
    // (template child below keeps addon-svelte-csf's source emitter happy;
    // without one its $effect throws and aborts the app's mount effects)

    // Open the first seeded chapter from the sidebar list. Navigation steps
    // use data-testid hooks (locale/copy-stable); see STORYBOOK.md.
    const chapter = await canvas.findByTestId('spine-item-chapter01', {}, { timeout: 60000 });
    await userEvent.click(chapter);

    // Append a line in the chapter editor (the plain-text pane).
    const editor = await canvas.findByRole('textbox', {}, { timeout: 60000 });
    await userEvent.click(editor);
    await userEvent.keyboard('{End}');
    await userEvent.type(editor, '\n\nA line typed by the workflow story.');

    // Give the debounced preview a beat to render before packaging.
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Package the book; the app stores the .epub and opens the Publish view.
    const packageButton = await canvas.findByTestId('package-epub', {}, { timeout: 15000 });
    await userEvent.click(packageButton);

    // The packaged artifact appears in the Publish list (Download action row).
    await canvas.findByRole('button', { name: 'Download' }, { timeout: 60000 });
  }}
>
  <App />
</Story>
