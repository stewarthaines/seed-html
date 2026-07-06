/**
 * Generate the locales sidecar for hosted deployments: copy the compiled catalogs
 * (src/lib/i18n/locales/<code>.json, produced by `npm run i18n:convert`) for the
 * enabled locales into dist/locales/ and write dist/locales/manifest.json so the
 * app can discover and fetch them on demand.
 *
 * English is never published — its msgids ARE the content, so it needs no catalog.
 *
 * Also appends the served URLs to dist/precache-manifest.json (owned/created by
 * generate-extensions-manifest.js — run that first; see build:plugins).
 *
 * Dev equivalent: the serve-locales-dev middleware in vite.config.ts — keep the
 * manifest shape in sync.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ENABLED_LOCALES, LOCALE_CONFIGS } from '../src/lib/i18n/locale-meta.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(projectRoot, 'src', 'lib', 'i18n', 'locales');
const distDir = path.join(projectRoot, 'dist');
const outDir = path.join(distDir, 'locales');

const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));

await fs.mkdir(outDir, { recursive: true });

const locales = [];
for (const code of ENABLED_LOCALES) {
  if (code === 'en') continue;

  const srcPath = path.join(srcDir, `${code}.json`);
  let data;
  try {
    data = await fs.readFile(srcPath);
  } catch {
    console.warn(`⚠️ No compiled catalog for enabled locale '${code}' — run npm run i18n:convert`);
    continue;
  }

  const file = `${code}.json`;
  await fs.writeFile(path.join(outDir, file), data);

  const config = LOCALE_CONFIGS[code] ?? {};
  locales.push({
    code,
    name: config.name ?? code,
    englishName: config.englishName ?? code,
    direction: config.direction ?? 'ltr',
    file,
    bytes: data.length,
    hash: `sha256-${createHash('sha256').update(data).digest('hex')}`,
  });
}

const manifest = { version: packageJson.version, locales };
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`🌐 Wrote dist/locales/manifest.json with ${locales.length} locale(s)`);

// Append the served URLs to the service worker's precache list (read-merge-write:
// generate-extensions-manifest.js owns/creates the file earlier in the chain).
const precachePath = path.join(distDir, 'precache-manifest.json');
let precache = [];
try {
  precache = JSON.parse(await fs.readFile(precachePath, 'utf8'));
} catch {
  // No precache manifest yet — start fresh.
}
const urls = ['locales/manifest.json', ...locales.map(l => `locales/${l.file}`)];
precache = [...new Set([...precache, ...urls])];
await fs.writeFile(precachePath, JSON.stringify(precache, null, 2) + '\n');
console.log(`📦 Appended ${urls.length} locale URL(s) to dist/precache-manifest.json`);
