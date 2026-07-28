import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import packageJson from './package.json';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  // Mirror vite.config.ts's `$lib` alias so source that imports via `$lib/…`
  // (the project convention) resolves under vitest too.
  resolve: {
    alias: {
      $lib: path.resolve(dirname, 'src/lib'),
      // Mirror vite.config.ts's icon-subset alias (see scripts/generate-icons.js).
      'phosphor-svelte': path.resolve(dirname, 'src/lib/icons/generated/index.ts'),
    },
  },
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
    // Runs in validate via npm run test:coverage; the thresholds below are the
    // coverage ratchet (ARCHITECTURE_HEALTH workstream 3).
    coverage: {
      include: ['src/**', 'functions/**'],
      exclude: [
        // Story fixtures and mock data measure nothing about the app.
        'src/stories/**',
        '**/*.stories.*',
        // Book-side demo assets and the iframe editor run inside EPUBs, not the app.
        'src/assets/**',
        // Build-time service-worker template; never executes in this suite.
        'src/pwa/**',
        '**/*.{test,spec}.*',
        // Test-support code (fixtures, fixture generators, shared mocks) —
        // measures nothing about the app and would distort directory locks.
        'src/**/test/**',
        'src/lib/test/**',
      ],
      reporter: ['text-summary', 'html'],
      // Per-directory coverage locks, in the lint-ratchet spirit: set slightly
      // below current so they catch regressions without being brittle, raise
      // (never lower) as areas strengthen. Components/views are deliberately
      // unlocked — workflow-first Storybook covers them; policy extracted from
      // them lands in locked directories.
      thresholds: {
        'src/lib/services/spine/**': { statements: 95 },
        'src/lib/services/metadata/**': { statements: 95 },
        'src/lib/infrastructure/**': { statements: 95 },
        'src/lib/editor/**': { statements: 95 },
        'src/lib/zip/**': { statements: 95 },
        'src/lib/metadata/**': { statements: 95 },
        'src/lib/content/**': { statements: 95 },
        'src/lib/agent-bridge/**': { statements: 90 },
        'src/lib/transform/**': { statements: 90 },
        'src/lib/source/**': { statements: 90 },
        'src/lib/extensions/**': { statements: 85 },
      },
    },
  },
});
