<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import App from '../App.svelte';
  import { seedProject } from './utils/seed-project';

  const { Story } = defineMeta({
    title: 'Application/Internationalization (i18n)',
    component: App,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Internationalization on a seeded project. Shipped locales are English and German; use the locale selector in the Storybook toolbar (🌍 icon) to switch live. An RTL demo will return when an RTL locale ships in-app.',
        },
      },
    },
  });
</script>

<Story
  name="German Interface"
  loaders={[
    async () => ({ seeded: await seedProject({ title: 'i18n Demo Book', view: 'spine' }) }),
  ]}
  globals={{ locale: 'de' }}
  parameters={{
    docs: {
      description: {
        story:
          "🌍 Boots the seeded app with the story's locale global set to German (the preview decorator applies it via setLocale) and asserts translated chrome: the sidebar shows Metadaten, Einstellungen, and Kapitel.",
      },
    },
  }}
  play={async ({ canvas }) => {
    await canvas.findByText('i18n Demo Book', {}, { timeout: 60000 });

    // Real assertions: the German catalog is applied to the app chrome.
    await canvas.findByText('Metadaten', {}, { timeout: 20000 });
    await canvas.findByText('Einstellungen', {}, { timeout: 20000 });
    await canvas.findByText(/Kapitel/, {}, { timeout: 20000 });
  }}
>
  <App />
</Story>
