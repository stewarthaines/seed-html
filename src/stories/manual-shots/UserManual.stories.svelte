<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { waitFor } from 'storybook/test';
  import App from '../../App.svelte';
  import { advancedMode } from '../../lib/stores/advanced-mode';

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
      // created with Djot). Set through the store (not raw localStorage) so it
      // reliably overrides an advanced-mode story that ran earlier in the same
      // browser.
      advancedMode.current = false;
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
    // Navigation steps target data-testid hooks — locale- and copy-stable,
    // unlike the localized labels used for assertions (see STORYBOOK.md).
    // 'nav-workspace' is the Projects section (its section id is `workspace`).
    const projects = await canvas.findByTestId('nav-workspace', {}, { timeout: 30000 });
    await userEvent.click(projects);

    const createNew = await canvas.findByTestId('create-project', {}, { timeout: 20000 });
    // Create New is disabled while the project list loads. With no projects
    // (a fresh capture context) that's instant, but a browser holding the
    // seeded stories' projects loads slower — wait for enabled, or the click
    // is swallowed and no dialog opens.
    await waitFor(() => {
      if (createNew.disabled) throw new Error('project list still loading');
    }, { timeout: 20000 });
    await userEvent.click(createNew);

    // The dialog is the photograph. Fill the illustration's example book —
    // the title also drives the derived cover hue, keeping the shot stable.
    await canvas.findByRole('dialog', {}, { timeout: 20000 });
    const title = await canvas.findByLabelText(/Title/, {}, { timeout: 20000 });
    await userEvent.clear(title);
    await userEvent.type(title, 'The Tortoise and the Hare');
    const author = await canvas.findByLabelText(/Author/, {}, { timeout: 20000 });
    await userEvent.clear(author);
    await userEvent.type(author, 'Aesop');
  }}
>
  <App />
</Story>

<Story
  name="Import from Catalog"
  tags={['!test']}
  loaders={[
    async () => {
      advancedMode.current = false;
      return {};
    },
  ]}
  parameters={{
    docs: {
      description: {
        story:
          "Produces docs/seed.html-user-manual/Images/screen-import-catalog.png — the Import from Catalog window listing the built-in sample books. Fetches the live published catalog (sample.readitinabook.com), so it's tagged `!test` (excluded from test:stories, whose isolated browser can't reach external hosts) and validated at capture time by `npm run manual-shots` instead.",
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    // Navigate by testid (see STORYBOOK.md); assert on rendered book titles.
    const projects = await canvas.findByTestId('nav-workspace', {}, { timeout: 30000 });
    await userEvent.click(projects);

    const catalog = await canvas.findByTestId('import-from-catalog', {}, { timeout: 20000 });
    await waitFor(() => {
      if (catalog.disabled) throw new Error('project list still loading');
    }, { timeout: 20000 });
    await userEvent.click(catalog);

    // The dialog fetches the feed; wait for a sample book to render before the shot.
    await canvas.findByText('Sample Magazine', {}, { timeout: 30000 });
  }}
>
  <App />
</Story>
