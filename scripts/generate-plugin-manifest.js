import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Assemble the served plugins/ directory from built workspace plugins.
 *
 * Scans plugins/<name>/package.json for an `seedhtmlPlugin` block, copies each
 * plugin's built single-file artifact into dist/plugins/<id>/, and writes
 * dist/plugins/manifest.json — the build-generated manifest the core fetches at
 * runtime (see plans/api/plugins.md and src/lib/plugins/plugin-registry.ts).
 *
 * Adding a plugin needs no manual manifest editing: drop it under plugins/, give
 * it an `seedhtmlPlugin` block, and rebuild. Run the plugin builds first
 * (`npm run build --workspaces --if-present`); this script only assembles.
 *
 * seedhtmlPlugin metadata:
 *   { id, name, presentation: 'panel'|'view', buildEntry: '<path to built .html>' }
 */

const root = process.cwd();
const pluginsDir = path.join(root, 'plugins');
const outDir = path.join(root, 'dist', 'plugins');
const VALID_PRESENTATIONS = ['panel', 'view'];

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const dirents = await fs.readdir(pluginsDir, { withFileTypes: true }).catch(() => []);
const manifest = [];

for (const dirent of dirents) {
  if (!dirent.isDirectory()) continue;
  const pkgPath = path.join(pluginsDir, dirent.name, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
  } catch {
    continue; // not a package
  }

  const meta = pkg.seedhtmlPlugin;
  if (!meta) continue;

  const { id, name, presentation, buildEntry } = meta;
  if (!id || !name || !VALID_PRESENTATIONS.includes(presentation) || !buildEntry) {
    console.warn(`⚠️  ${dirent.name}: incomplete seedhtmlPlugin metadata — skipped`);
    continue;
  }

  const builtPath = path.join(pluginsDir, dirent.name, buildEntry);
  if (!(await exists(builtPath))) {
    console.warn(`⚠️  ${id}: no built artifact at ${buildEntry} — run its build first; skipped`);
    continue;
  }

  const filename = path.basename(buildEntry);
  const destDir = path.join(outDir, id);
  await fs.mkdir(destDir, { recursive: true });
  await fs.copyFile(builtPath, path.join(destDir, filename));

  manifest.push({ id, name, entry: `${id}/${filename}`, presentation });
}

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`📦 Wrote ${manifest.length} plugin(s) to dist/plugins/manifest.json`);
