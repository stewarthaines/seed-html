import type { StorybookConfig } from '@storybook/svelte-vite';
import path from 'path';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|ts|svelte)'],
  addons: [
    '@storybook/addon-svelte-csf',
    '@chromatic-com/storybook',
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/svelte-vite',
    options: {},
  },
  viteFinal: async config => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      $lib: path.resolve(__dirname, '../src/lib'),
      // Mirror vite.config.ts's icon-subset alias (see scripts/generate-icons.js).
      'phosphor-svelte': path.resolve(__dirname, '../src/lib/icons/generated/index.ts'),
    };

    // Enable JSON imports for translation files
    config.json = config.json || {};
    config.json.namedExports = false;

    return config;
  },
};
export default config;
