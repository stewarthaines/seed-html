<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import App from '../../App.svelte';
  import { seedProject } from '../utils/seed-project';
  import { advancedMode } from '../../lib/stores/advanced-mode';

  // Screenshot recipes for the advanced reference
  // (docs/seed.html-advanced-reference/). These document Advanced Mode, so the
  // loaders force it on and seed projects with the extensions the illustration
  // shows. Same pattern as the user-manual shots; see STORYBOOK.md.
  const { Story } = defineMeta({
    title: 'Manual Shots/Advanced Reference',
    component: App,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            "State recipes for the advanced reference's screenshots. Regenerate with `npm run manual-shots` (Storybook running).",
        },
      },
    },
    tags: ['manual-shot'],
  });
</script>

<Story
  name="EPUB Settings (transform pipeline)"
  tags={['!test']}
  loaders={[
    async () => {
      // Set the mode through the store, not raw localStorage: the persisted
      // store reads its value at module load (before loaders run), so a raw
      // write wouldn't flip the already-initialised in-memory value.
      advancedMode.current = true;
      // markdown-it supplies the text transform (transformMarkdown.js); prism
      // supplies a DOM transform (transformPrism.js) — the exact pipeline the
      // illustration shows: transformDom.js then transformPrism.js.
      return {
        seeded: await seedProject({
          title: 'EPUB Settings Demo',
          extensions: ['markdown-it', 'prism'],
        }),
      };
    },
  ]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/seed.html-advanced-reference/Images/screenshot-epub-settings.png — the Text Transform + DOM Transforms pipeline (Advanced Mode → Settings → EPUB Settings) on a markdown-it + prism project. Tagged `!test`: installing extensions needs the dev-served `/extensions/` catalog, which the test:stories Storybook instance does not provide, so this shot is validated at capture time.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await canvas.findByText('EPUB Settings Demo', {}, { timeout: 60000 });

    // Advanced Mode → Settings view (navigate by testid; see STORYBOOK.md).
    const settings = await canvas.findByTestId('nav-settings', {}, { timeout: 20000 });
    await userEvent.click(settings);

    // Open the EPUB Settings disclosure (collapsed by default).
    const heading = await canvas.findByText('EPUB Settings', {}, { timeout: 20000 });
    await userEvent.click(heading);

    // Confirm the seeded extensions wired the pipeline the illustration shows.
    await canvas.findByText('transformMarkdown.js', {}, { timeout: 20000 });
    await canvas.findByText(/transformPrism\.js/, {}, { timeout: 20000 });
  }}
>
  <App />
</Story>
