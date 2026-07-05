<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import App from '../../App.svelte';

  // Screenshot recipes for the user manual (docs/seed.html-user-manual/).
  // Each story drives the real app to the exact state a manual illustration
  // shows and ends there; scripts/capture-manual-shots.js photographs the
  // element named in scripts/manual-shots.json and writes it straight into
  // the manual's Images/ directory. Every story declares its app mode
  // explicitly — the manual has both Basic and Advanced Mode illustrations.
  const { Story } = defineMeta({
    title: 'Manual Shots/User Manual',
    component: App,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            "State recipes for the user manual's screenshots. Regenerate the images with `npm run manual-shots` (Storybook running), then review the docs diff like any other change.",
        },
      },
    },
    tags: ['manual-shot'],
  });
</script>

<Story
  name="New Project Dialog (Basic Mode)"
  loaders={[
    async () => {
      // The shot documents Basic Mode: no Text-format picker (the project is
      // created with Djot). Force the mode rather than inherit ambient state.
      localStorage.setItem('editme_advanced_mode', 'false');
      return {};
    },
  ]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/seed.html-user-manual/Images/screen-new-project.png — the New Project window as a first-time (Basic Mode) user sees it: Title, Author, cover, and Language.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    // Boot, open the Projects view, open the New Project dialog.
    const projects = await canvas.findByRole('button', { name: 'Projects' }, { timeout: 30000 });
    await userEvent.click(projects);

    const createNew = await canvas.findByRole(
      'button',
      { name: /Create a new minimal EPUB project/ },
      { timeout: 20000 }
    );
    await userEvent.click(createNew);

    // The dialog is the photograph. Fill the illustration's example book —
    // the title also drives the derived cover hue, keeping the shot stable.
    await canvas.findByRole('dialog', {}, { timeout: 20000 });
    const title = await canvas.findByLabelText(/Title/, {}, { timeout: 20000 });
    await userEvent.clear(title);
    await userEvent.type(title, 'The Tortoise and the Hare');
    const author = await canvas.findByLabelText(/Author/, {}, { timeout: 20000 });
    await userEvent.type(author, 'Aesop');
  }}
>
  <App />
</Story>
