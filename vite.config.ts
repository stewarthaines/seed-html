import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import analyzer from "rollup-plugin-analyzer";
import checker from "vite-plugin-checker";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      // Use treeshake to eliminate unused modules
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false
      }
    }
  },
  define: {
    // Exclude development-only code from production builds
    __DEV__: process.env.NODE_ENV !== 'production',
  },
  plugins: [
    // TypeScript checking during development - this will catch API mismatches!
    checker({
      typescript: {
        tsconfigPath: 'tsconfig.app.json'
      },
      overlay: {
        initialIsOpen: false,
      },
    }),
    svelte(),
    // Embed translation data URL into HTML for single-file deployment
    {
      name: 'embed-translations',
      async transformIndexHtml(html) {
        try {
          const translationsPath = path.join(dirname, 'static', 'i18n-bundle.zip');
          const translationsZip = await fs.readFile(translationsPath);
          const dataUrl = `data:application/zip;base64,${translationsZip.toString('base64')}`;

          console.log(`📦 Embedded ${Math.round(translationsZip.length / 1024)}KB translation data`);

          return html.replace(
            '</head>',
            `<script>window.__EDITME_I18N_BUNDLE__ = '${dataUrl}';</script></head>`
          );
        } catch (error) {
          console.warn('⚠️ Translation file not found, app will use English fallback only');
          return html;
        }
      }
    },
    viteSingleFile(),
    // Bundle analysis plugins
    visualizer({
      filename: 'dist/stats.html',
      template: 'treemap',
      open: false,
      gzipSize: true,
      brotliSize: true
    }),
    analyzer({
      summaryOnly: true,
      limit: 15
    })
  ],
  test: {
    projects: [
      // Main project tests
      {
        test: {
          name: "unit",
          include: ["src/**/*.{test,spec}.{js,ts}"],
          environment: "happy-dom",
        },
      },
      // Storybook tests
      {
        extends: "vite.config.ts",
        plugins: [
          storybookTest({ configDir: path.join(dirname, ".storybook") }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: "playwright",
            instances: [
              { browser: "chromium", viewport: { width: 800, height: 600 } },
            ],
          },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
    ],
  },
});
