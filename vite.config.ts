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
  optimizeDeps: {
    // Only scan the core app's own entry for dependency pre-bundling. Otherwise
    // Vite crawls every .html under the project root — including the workspace
    // plugin's plugin.html / plugin-test.html — and tries to pre-bundle its heavy
    // deps (epubcheck-ts → libxml2-wasm, which uses top-level await), which aborts
    // dep optimization and leaves the dev server serving a blank app.
    entries: ['index.html'],
    // When the plugin iframe is opened in dev, the core server serves the plugin
    // source and optimizes its deps on demand; es2022 lets that handle top-level
    // await (libxml2-wasm). Matches the core build target.
    esbuildOptions: { target: 'es2022' },
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
    // Dev only: synthesize plugins/manifest.json by scanning workspace plugins, so
    // the host can discover them against the live dev server (the built manifest is
    // generated into dist/, which the dev server doesn't serve). The plugin source
    // itself is served by Vite at plugins/<id>/<file> — same path the built manifest
    // entry resolves to, so the host needs no dev/prod branch.
    {
      name: 'serve-plugins-manifest-dev',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/plugins/manifest.json', async (_req, res) => {
          const pluginsRoot = path.join(dirname, 'plugins');
          const manifest: Array<{
            id: string;
            name: string;
            entry: string;
            presentation: string;
          }> = [];
          let names: string[] = [];
          try {
            names = await fs.readdir(pluginsRoot);
          } catch {
            // no plugins/ directory — nothing to serve
          }
          for (const name of names) {
            try {
              const pkg = JSON.parse(
                await fs.readFile(path.join(pluginsRoot, name, 'package.json'), 'utf8')
              );
              const m = pkg.editmePlugin;
              if (
                m &&
                m.id &&
                m.name &&
                (m.presentation === 'panel' || m.presentation === 'view') &&
                m.buildEntry
              ) {
                manifest.push({
                  id: m.id,
                  name: m.name,
                  entry: `${m.id}/${path.basename(m.buildEntry)}`,
                  presentation: m.presentation,
                });
              }
            } catch {
              // not a plugin package — skip
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(manifest));
        });
      },
    },
    // Dev only: serve the extensions catalog (mirrors the plugins middleware).
    // Synthesize extensions/manifest.json from extensions/<id>/extension.json, and
    // serve the raw extension files at extensions/<id>/<file> — raw so Vite never
    // transforms the 3rd-party lib JS the host fetches at runtime.
    {
      name: 'serve-extensions-dev',
      apply: 'serve',
      configureServer(server) {
        const extensionsRoot = path.join(dirname, 'extensions');

        server.middlewares.use('/extensions/manifest.json', async (_req, res) => {
          const manifest: Array<Record<string, unknown>> = [];
          let names: string[] = [];
          try {
            names = await fs.readdir(extensionsRoot);
          } catch {
            // no extensions/ directory — nothing to serve
          }
          for (const name of names) {
            try {
              const m = JSON.parse(
                await fs.readFile(path.join(extensionsRoot, name, 'extension.json'), 'utf8')
              );
              const scripts = Array.isArray(m.scripts) ? m.scripts : [];
              const domTransforms = Array.isArray(m.domTransforms) ? m.domTransforms : [];
              const textTransforms = Array.isArray(m.textTransforms) ? m.textTransforms : [];
              if (m.id && m.name && scripts.length > 0) {
                manifest.push({
                  id: m.id,
                  name: m.name,
                  description: m.description,
                  url: m.url,
                  license: m.license,
                  scripts,
                  domTransforms,
                  textTransforms,
                });
              }
            } catch {
              // not an extension — skip
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(manifest));
        });

        server.middlewares.use('/extensions/', async (req, res, next) => {
          // Connect strips the '/extensions/' mount prefix, so req.url is the path
          // *within* extensions/ (e.g. '/prism/prism.js'). Resolve against
          // extensionsRoot and serve raw, so Vite never transforms the lib JS
          // (which would append a sourceMappingURL comment).
          const rel = (req.url || '').split('?')[0].replace(/^\//, '');
          const target = path.join(extensionsRoot, rel);
          // Block path traversal; only serve files under extensions/.
          if (!target.startsWith(extensionsRoot + path.sep)) {
            next();
            return;
          }
          try {
            const data = await fs.readFile(target);
            const ext = path.extname(target);
            const type =
              ext === '.js'
                ? 'application/javascript'
                : ext === '.json'
                  ? 'application/json'
                  : 'text/plain; charset=utf-8';
            res.setHeader('Content-Type', type);
            res.end(data);
          } catch {
            next();
          }
        });
      },
    },
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
          // Browser-mode contract tests run separately (npm run test:plugins).
          exclude: ["**/node_modules/**", "**/dist/**", "**/*.browser.{test,spec}.{js,ts}"],
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
