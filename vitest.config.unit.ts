import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import packageJson from './package.json';

export default defineConfig({
  plugins: [svelte()],
  // Mirror vite.config.ts's define so __VERSION__ resolves in unit tests too.
  define: {
    __VERSION__: JSON.stringify(packageJson.version),
  },
  test: {
    environment: 'happy-dom',
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      // The same-origin WebDAV proxy guard (functions/_shared) is plain TS.
      'functions/**/*.{test,spec}.{js,ts}',
    ],
    exclude: [
      'src/**/*.stories.{js,ts}',
      '**/node_modules/**',
      // Browser-mode contract tests run separately (npm run test:plugins).
      '**/*.browser.{test,spec}.{js,ts}',
    ],
  },
});
