import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Assemble the served extensions/ catalog from the source extensions/ directory.
 *
 * Scans extensions/<id>/extension.json, copies each extension's declared files
 * (scripts, transforms, license) + extension.json into dist/extensions/<id>/, and
 * writes dist/extensions/manifest.json — the build-generated catalog the core
 * fetches at runtime (see src/lib/extensions/extension-catalog.ts).
 *
 * Adding an extension needs no manual manifest editing: drop it under extensions/
 * with an extension.json and rebuild.
 *
 * extension.json:
 *   { id, name, description?, license?, scripts: string[], transforms: string[] }
 *   scripts    = 3rd-party libs loaded into the transform iframe as globals
 *   transforms = suggested DOM-transform scripts (candidates for dom_transforms)
 */

const root = process.cwd();
const extensionsDir = path.join(root, 'extensions');
const outDir = path.join(root, 'dist', 'extensions');

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const dirents = await fs.readdir(extensionsDir, { withFileTypes: true }).catch(() => []);
const manifest = [];

for (const dirent of dirents) {
  if (!dirent.isDirectory()) continue;
  const dir = path.join(extensionsDir, dirent.name);
  const metaPath = path.join(dir, 'extension.json');

  let meta;
  try {
    meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  } catch {
    continue; // not an extension (no extension.json)
  }

  const { id, name, description, url, license } = meta;
  const scripts = Array.isArray(meta.scripts) ? meta.scripts : [];
  const domTransforms = Array.isArray(meta.domTransforms) ? meta.domTransforms : [];
  const textTransforms = Array.isArray(meta.textTransforms) ? meta.textTransforms : [];
  if (!id || !name || scripts.length === 0) {
    console.warn(
      `⚠️  ${dirent.name}: incomplete extension.json (need id, name, scripts) — skipped`
    );
    continue;
  }

  // Copy the declared files (skip any that are missing, warn).
  const files = [
    ...scripts,
    ...domTransforms,
    ...textTransforms,
    ...(license ? [license] : []),
    'extension.json',
  ];
  const destDir = path.join(outDir, id);
  await fs.mkdir(destDir, { recursive: true });
  let ok = true;
  for (const file of files) {
    const src = path.join(dir, file);
    if (!(await exists(src))) {
      console.warn(`⚠️  ${id}: missing file ${file} — skipped extension`);
      ok = false;
      break;
    }
    await fs.copyFile(src, path.join(destDir, path.basename(file)));
  }
  if (!ok) continue;

  manifest.push({ id, name, description, url, license, scripts, domTransforms, textTransforms });
}

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`📦 Wrote ${manifest.length} extension(s) to dist/extensions/manifest.json`);
