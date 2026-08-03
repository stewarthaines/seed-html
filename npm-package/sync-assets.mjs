/**
 * prepack: assemble the publishable payload from the repo build.
 *
 * Copies the repo's dist/ (the deployed static app: index.html, extensions and
 * plugins catalogs, locales, service worker), the agent bridge and its
 * authoring guide — keeping the bridge's own relative path to the guide
 * (scripts/ → ../docs/) intact — and syncs this package's version from the
 * root package.json so the npm version always matches the app it carries.
 *
 * Run automatically by `npm pack` / `npm publish`; needs a prior repo build
 * (`npm run build:i18n && npm run build:plugins`).
 */
import { cpSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = dirname(fileURLToPath(import.meta.url));
const repo = resolve(pkgDir, '..');

const dist = join(repo, 'dist');
if (!existsSync(join(dist, 'index.html')) || !existsSync(join(dist, 'extensions'))) {
  console.error('sync-assets: repo dist/ is missing or incomplete — run the build first:');
  console.error('  npm run build:i18n && npm run build:plugins');
  process.exit(1);
}

for (const [from, to] of [
  [dist, join(pkgDir, 'dist')],
  [join(repo, 'scripts', 'agent-bridge.mjs'), join(pkgDir, 'scripts', 'agent-bridge.mjs')],
  [join(repo, 'docs', 'AGENT_AUTHORING.md'), join(pkgDir, 'docs', 'AGENT_AUTHORING.md')],
]) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

const rootVersion = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).version;
const pkgPath = join(pkgDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (pkg.version !== rootVersion) {
  pkg.version = rootVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`sync-assets: version -> ${rootVersion}`);
}
console.log('sync-assets: dist, bridge and guide staged');
