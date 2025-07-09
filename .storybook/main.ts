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
    };

    // Enable JSON imports for translation files
    config.json = config.json || {};
    config.json.namedExports = false;

    return config;
  },
};
export default config;
