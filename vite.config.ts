import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
// import { visualizer } from "rollup-plugin-visualizer";
// import analyzer from "rollup-plugin-analyzer";
import checker from "vite-plugin-checker";
import packageJson from "./package.json";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '$lib': path.resolve(dirname, 'src/lib')
    }
  },
  build: {
    target: 'es2022',
    minify: true,
    rollupOptions: {
      // DO NOT enable aggressive treeshaking - it breaks Svelte 5's reactivity system
      // Svelte 5 requires runtime side effects for signal registration and context initialization
      // Aggressive treeshaking removes these "invisible" dependencies, causing runtime errors
      // Use Vite's default treeshaking instead, which is tuned for Svelte compatibility
    }
  },
  define: {
    // Exclude development-only code from production builds
    __DEV__: process.env.NODE_ENV !== 'production',
    // Inject package.json version at build time
    __VERSION__: JSON.stringify(packageJson.version),
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
        } catch {
          console.warn('⚠️ Translation file not found, app will use English fallback only');
          return html;
        }
      }
    },
    viteSingleFile(),
    // Bundle analysis plugins
    // visualizer({
    //   filename: 'dist/stats.html',
    //   template: 'treemap',
    //   open: false,
    //   gzipSize: true,
    //   brotliSize: true
    // }),
    // analyzer({
    //   summaryOnly: true,
    //   limit: 15
    // })
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
