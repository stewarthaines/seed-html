import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { pathToFileURL } from 'url';

/**
 * Build-boot smoke test.
 *
 * Unit tests run against source in happy-dom; nothing exercises the actual
 * single-file build artifact. This script boots the built `dist/index.html` in a
 * real Chromium — over HTTP and over file:// — and asserts the app mounts with no
 * uncaught errors. It is the safety net for build-toolchain upgrades (Vite /
 * Rollup / vite-plugin-singlefile), where a regression (e.g. an over-aggressive
 * treeshake) passes every unit test but produces a blank page.
 *
 * Usage: npm run smoke   (build first: `npm run build`)
 */

const distDir = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.html');
const PORT = 4178;
const MOUNT_TIMEOUT_MS = 20000;

// Console errors that are noise, not boot failures.
const IGNORED_CONSOLE = [/favicon\.ico/i, /Failed to load resource.*favicon/i];

function fail(msg) {
  console.error(`\n❌ smoke: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  fail(`no build found at ${indexPath}. Run \`npm run build\` first.`);
}

/**
 * Serve the built app: real dist/ files when they exist (sw.js, locales/,
 * extensions/ — so the sidecars behave as deployed), index.html for app routes.
 */
function startServer() {
  const html = fs.readFileSync(indexPath);
  const server = http.createServer((req, res) => {
    if (req.url && /favicon\.ico$/.test(req.url)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const rel = (req.url || '/').split('?')[0].replace(/^\//, '');
    const target = path.join(distDir, rel);
    if (rel && target.startsWith(distDir + path.sep) && fs.existsSync(target)) {
      const stat = fs.statSync(target);
      if (stat.isFile()) {
        const type = /\.json$/.test(target)
          ? 'application/json'
          : /\.js$/.test(target)
            ? 'application/javascript'
            : 'text/html; charset=utf-8';
        res.writeHead(200, { 'Content-Type': type });
        res.end(fs.readFileSync(target));
        return;
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  return new Promise(resolve => server.listen(PORT, () => resolve(server)));
}

/** Static assertions on the build artifacts themselves (no browser needed). */
function artifactChecks() {
  const problems = [];
  const html = fs.readFileSync(indexPath, 'utf8');

  // The i18n anchor must survive the single-file inlining: it is the injection
  // target for localized SEED.html embedding (see vite.config.ts i18n-inline-anchor).
  if (!/window\.__EDITME_I18N_BUNDLE__\s*=\s*(?:null|'data:application\/zip;base64,)/.test(html)) {
    problems.push('[artifact] dist/index.html is missing the __EDITME_I18N_BUNDLE__ anchor');
  }

  // The locales sidecar is only present after `npm run build:locales` (part of
  // build:plugins); when present it must be well-formed.
  const manifestPath = path.join(distDir, 'locales', 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (!Array.isArray(manifest.locales)) {
        problems.push('[artifact] dist/locales/manifest.json has no locales array');
      }
      for (const entry of manifest.locales || []) {
        if (!fs.existsSync(path.join(distDir, 'locales', entry.file))) {
          problems.push(`[artifact] manifest lists locales/${entry.file} but the file is missing`);
        }
      }
      console.log(`✓ [artifact] locales sidecar: ${manifest.locales.length} locale(s)`);
    } catch (e) {
      problems.push(`[artifact] dist/locales/manifest.json unreadable: ${e.message}`);
    }
  } else {
    console.log('• [artifact] no locales sidecar (run `npm run build:locales` to include it)');
  }

  if (problems.length === 0) console.log('✓ [artifact] i18n anchor present');
  return problems;
}

/**
 * Load `url` in a fresh page and assert the app mounts without uncaught errors.
 * Returns a list of problems (empty = pass).
 */
async function bootCheck(browser, url, label) {
  const problems = [];
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('pageerror', err => problems.push(`[${label}] uncaught: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some(re => re.test(text))) return;
    problems.push(`[${label}] console.error: ${text}`);
  });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: MOUNT_TIMEOUT_MS });
    // App is mounted once #app has rendered at least one child element.
    await page.waitForFunction(
      () => {
        const app = document.getElementById('app');
        return !!app && app.childElementCount > 0;
      },
      { timeout: MOUNT_TIMEOUT_MS }
    );
    console.log(`✓ [${label}] app mounted`);
  } catch (e) {
    problems.push(`[${label}] app did not mount: ${e instanceof Error ? e.message : e}`);
  }

  await context.close();
  return problems;
}

/** Launch Chromium, falling back to the system Chrome if no browser is downloaded. */
async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (e) {
    if (e instanceof Error && /Executable doesn't exist/.test(e.message)) {
      console.log('• Playwright browser not installed; using system Chrome (channel: chrome)');
      return await chromium.launch({ channel: 'chrome' });
    }
    throw e;
  }
}

const server = await startServer();
const browser = await launchBrowser();
const problems = [];

problems.push(...artifactChecks());

try {
  problems.push(...(await bootCheck(browser, `http://localhost:${PORT}/`, 'http')));
  problems.push(...(await bootCheck(browser, pathToFileURL(indexPath).href, 'file')));
} finally {
  await browser.close();
  server.close();
}

if (problems.length > 0) {
  console.error('\nProblems:');
  for (const p of problems) console.error(`  - ${p}`);
  fail(`${problems.length} problem(s) booting the built single-file.`);
}

console.log('\n✅ smoke: built single-file boots over http and file://');
