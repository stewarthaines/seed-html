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
              // A scripts entry is a bare filename or { file, license? }; flatten.
              const scriptFile = (s: unknown): string | null =>
                typeof s === 'string'
                  ? s
                  : s && typeof (s as Record<string, unknown>).file === 'string'
                    ? ((s as Record<string, unknown>).file as string)
                    : null;
              const rawScripts = Array.isArray(m.scripts) ? m.scripts : [];
              const scripts = rawScripts.map(scriptFile).filter(Boolean);
              const domTransforms = Array.isArray(m.domTransforms) ? m.domTransforms : [];
              const textTransforms = Array.isArray(m.textTransforms) ? m.textTransforms : [];
              const generators = (Array.isArray(m.generators) ? m.generators : []).filter(
                (g: unknown) =>
                  !!g &&
                  typeof (g as Record<string, unknown>).id === 'string' &&
                  typeof (g as Record<string, unknown>).name === 'string' &&
                  typeof (g as Record<string, unknown>).script === 'string'
              );
              const assets = (Array.isArray(m.assets) ? m.assets : []).filter(
                (a: unknown) =>
                  !!a &&
                  typeof (a as Record<string, unknown>).file === 'string' &&
                  typeof (a as Record<string, unknown>).target === 'string'
              );
              // Every license file to bundle: extension-wide + per-script + per-asset, deduped.
              const licenses = [
                ...new Set(
                  [
                    m.license,
                    ...rawScripts.map((s: unknown) =>
                      s && typeof s === 'object' && scriptFile(s)
                        ? (s as Record<string, unknown>).license
                        : null
                    ),
                    ...assets.map((a: Record<string, unknown>) => a.license),
                    ...generators.map((g: Record<string, unknown>) =>
                      typeof g.license === 'string' ? g.license : null
                    ),
                  ].filter((l: unknown) => typeof l === 'string' && l)
                ),
              ];
              const chapter = typeof m.chapter === 'string' ? m.chapter : undefined;
              // An extension must bring at least one of: a lib, a transform, or a generator.
              const isEmpty =
                scripts.length === 0 &&
                domTransforms.length === 0 &&
                textTransforms.length === 0 &&
                generators.length === 0;
              if (m.id && m.name && !isEmpty) {
                manifest.push({
                  id: m.id,
                  name: m.name,
                  description: m.description,
                  url: m.url,
                  license: m.license,
                  scripts,
                  domTransforms,
                  textTransforms,
                  generators,
                  assets,
                  licenses,
                  chapter,
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
    // Dev only: a same-origin WebDAV proxy at /dav, mirroring the Cloudflare
    // Pages Function (functions/dav.ts) so the plugin's proxy path works under
    // `npm run dev` exactly as in production. The request contract below
    // (X-DAV-URL / X-DAV-Method + the forwarded header allowlist) matches the
    // authoritative, tested guard in functions/_shared/dav-proxy-core.ts. The
    // node project (tsconfig.node, composite) can't import across to functions/,
    // so this dev shim is intentionally standalone and lenient — it allows http
    // and local targets, since it only ever serves localhost. Keep the contract
    // in sync with the shared core if you change the header names.
    {
      name: 'serve-dav-proxy-dev',
      apply: 'serve',
      configureServer(server) {
        const FORWARD = ['authorization', 'depth', 'content-type', 'destination', 'overwrite'];
        const METHODS = ['GET', 'HEAD', 'PUT', 'DELETE', 'PROPFIND', 'MKCOL', 'MOVE', 'COPY'];
        const header = (
          headers: Record<string, string | string[] | undefined>,
          name: string
        ): string | undefined => {
          const v = headers[name];
          return Array.isArray(v) ? v[0] : v;
        };
        server.middlewares.use('/dav', (req, res) => {
          if (req.method === 'GET' || req.method === 'HEAD') {
            res.statusCode = 204;
            res.end();
            return;
          }
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          const method = (header(req.headers, 'x-dav-method') || '').toUpperCase();
          if (!METHODS.includes(method)) {
            res.statusCode = 400;
            res.end('Missing or unsupported X-DAV-Method');
            return;
          }
          let target: URL;
          try {
            target = new URL(header(req.headers, 'x-dav-url') || '');
          } catch {
            res.statusCode = 400;
            res.end('Invalid target URL');
            return;
          }
          if (target.protocol !== 'https:' && target.protocol !== 'http:') {
            res.statusCode = 400;
            res.end('Target must use http(s)');
            return;
          }
          const forwarded: Record<string, string> = {};
          for (const name of FORWARD) {
            const v = header(req.headers, name);
            if (v !== undefined) forwarded[name] = v;
          }
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => chunks.push(chunk));
          req.on('end', () => {
            const body = chunks.length ? Buffer.concat(chunks) : undefined;
            fetch(target.toString(), {
              method,
              headers: forwarded,
              body,
              redirect: 'manual',
            })
              .then(async upstream => {
                res.statusCode = upstream.status;
                const ct = upstream.headers.get('content-type');
                if (ct) res.setHeader('content-type', ct);
                res.end(Buffer.from(await upstream.arrayBuffer()));
              })
              .catch((err: unknown) => {
                res.statusCode = 502;
                res.end(`Proxy request failed: ${String(err)}`);
              });
          });
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
