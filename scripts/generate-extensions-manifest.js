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
 *   { id, name, description?, license?, scripts: string[], domTransforms: string[],
 *     textTransforms: string[], generators?: GeneratorManifest[] }
 *   scripts    = 3rd-party libs loaded into the transform iframe as globals
 *   transforms = suggested DOM/text-transform scripts (candidates for the pipeline)
 *   generators = on-demand source producers ({ id, name, script, options? }); each
 *                script exports a fixed generateText(ctx, options)
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
  // A scripts entry is a bare filename or { file, license? }; flatten to filenames.
  const scriptFile = s =>
    typeof s === 'string' ? s : s && typeof s.file === 'string' ? s.file : null;
  const rawScripts = Array.isArray(meta.scripts) ? meta.scripts : [];
  const scripts = rawScripts.map(scriptFile).filter(Boolean);
  const domTransforms = Array.isArray(meta.domTransforms) ? meta.domTransforms : [];
  const textTransforms = Array.isArray(meta.textTransforms) ? meta.textTransforms : [];
  // Generators: { id, name, script, options?, license?, description? } objects (one
  // generateText per script). Keep only well-formed entries.
  const generators = (Array.isArray(meta.generators) ? meta.generators : []).filter(
    g => g && typeof g.id === 'string' && typeof g.name === 'string' && typeof g.script === 'string'
  );
  // EPUB assets the extension copies into OEBPS/ (e.g. CSS). Keep only well-formed entries.
  const assets = (Array.isArray(meta.assets) ? meta.assets : []).filter(
    a => a && typeof a.file === 'string' && typeof a.target === 'string'
  );
  // Every license file to bundle: extension-wide + per-script + per-asset, deduped.
  const licenses = [
    ...new Set(
      [
        license,
        ...rawScripts.map(s => (s && typeof s === 'object' && scriptFile(s) ? s.license : null)),
        ...assets.map(a => a.license),
        ...generators.map(g => (typeof g.license === 'string' ? g.license : null)),
      ].filter(l => typeof l === 'string' && l)
    ),
  ];
  // Optional sample chapter (plain-text source) used to seed a new project.
  const chapter = typeof meta.chapter === 'string' ? meta.chapter : undefined;
  // An extension must bring at least one of: a 3rd-party lib, a transform, or a generator.
  const isEmpty =
    scripts.length === 0 &&
    domTransforms.length === 0 &&
    textTransforms.length === 0 &&
    generators.length === 0;
  if (!id || !name || isEmpty) {
    console.warn(
      `⚠️  ${dirent.name}: incomplete extension.json (need id, name, and at least one of scripts/transforms/generators) — skipped`
    );
    continue;
  }

  // Copy the declared files (skip any that are missing, warn). Scripts/transforms/
  // license are fetched by basename, so they flatten into the extension dir. Asset
  // files are fetched at extensions/<id>/<file>, so their relative path (which may
  // include subdirs, e.g. themes/default.css) is preserved.
  const flatFiles = [
    ...scripts,
    ...domTransforms,
    ...textTransforms,
    ...generators.map(g => g.script),
    ...licenses,
    ...(chapter ? [chapter] : []),
    'extension.json',
  ];
  const destDir = path.join(outDir, id);
  await fs.mkdir(destDir, { recursive: true });
  let ok = true;
  for (const file of flatFiles) {
    const src = path.join(dir, file);
    if (!(await exists(src))) {
      console.warn(`⚠️  ${id}: missing file ${file} — skipped extension`);
      ok = false;
      break;
    }
    await fs.copyFile(src, path.join(destDir, path.basename(file)));
  }
  for (const asset of assets) {
    const src = path.join(dir, asset.file);
    if (!(await exists(src))) {
      console.warn(`⚠️  ${id}: missing asset ${asset.file} — skipped extension`);
      ok = false;
      break;
    }
    const dest = path.join(destDir, asset.file);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
  if (!ok) continue;

  manifest.push({
    id,
    name,
    description,
    url,
    license,
    scripts,
    domTransforms,
    textTransforms,
    generators,
    assets,
    licenses,
    chapter,
  });
}

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`📦 Wrote ${manifest.length} extension(s) to dist/extensions/manifest.json`);
