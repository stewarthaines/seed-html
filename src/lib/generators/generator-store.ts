/**
 * Generator store — per-project generator persistence + discovery.
 *
 * A generator is a script that *produces* source text inserted into the editor at
 * the caret (vs. transforms, which convert content in the render pipeline). Each
 * generator lives self-contained under `SOURCE/generators/<id>/`:
 *
 *   SOURCE/generators/<id>/generator.json   # a GeneratorManifest
 *   SOURCE/generators/<id>/<script>          # exports generateText(ctx, options)
 *   SOURCE/generators/<id>/<license?>        # optional
 *
 * Extension-provided generators are materialized into the same shape on import (see
 * ExtensionManager.importCatalogExtension), so discovery only ever scans
 * `SOURCE/generators/`, regardless of how a generator got there.
 */

import type { FileStorageAPI } from '../storage/index.js';
import { normalizeGenerator, type GeneratorManifest } from '../extensions/extension-catalog.js';

const GENERATORS_ROOT = 'SOURCE/generators';

/** A discovered generator plus where its files live in the workspace. */
export interface InstalledGenerator {
  manifest: GeneratorManifest;
  /** Directory under SOURCE/, e.g. 'SOURCE/generators/figures'. */
  dir: string;
  /** Full path to the generator script. */
  scriptPath: string;
}

/**
 * Everything the editor's generator panel needs, assembled by the spine view so the
 * panel stays decoupled from storage + the transform engine.
 */
export interface GeneratorRunner {
  generators: InstalledGenerator[];
  /** Run a generator with the given option values → produced source text. */
  run: (generator: InstalledGenerator, options: Record<string, unknown>) => Promise<string>;
  /** Load the last-used option values for a generator (empty if none). */
  loadValues: (id: string) => Promise<Record<string, unknown>>;
  /** Persist the option values a user just ran with. */
  saveValues: (id: string, values: Record<string, unknown>) => Promise<void>;
}

const MANIFEST_FILE = 'generator.json';
const MANIFEST_SUFFIX = `/${MANIFEST_FILE}`;

/**
 * Scan each `SOURCE/generators/<id>/generator.json` → the project's available
 * generators, sorted by name. Malformed manifests are skipped; a missing workspace
 * yields []. Pass `knownFiles` (a pre-listed workspace enumeration) to avoid a
 * second recursive directory walk when the caller already has one.
 */
export async function listGenerators(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  knownFiles?: string[]
): Promise<InstalledGenerator[]> {
  let files: string[];
  if (knownFiles) {
    files = knownFiles;
  } else {
    try {
      files = await fileStorage.listFiles(workspaceId);
    } catch {
      return [];
    }
  }

  const manifestPaths = files.filter(
    f => f.startsWith(`${GENERATORS_ROOT}/`) && f.endsWith(MANIFEST_SUFFIX)
  );

  const out: InstalledGenerator[] = [];
  for (const manifestPath of manifestPaths) {
    try {
      const meta = JSON.parse(await fileStorage.readTextFile(workspaceId, manifestPath));
      const manifest = normalizeGenerator(meta);
      if (!manifest) continue;
      const dir = manifestPath.slice(0, -MANIFEST_SUFFIX.length);
      out.push({ manifest, dir, scriptPath: `${dir}/${manifest.script}` });
    } catch {
      // Skip a generator whose manifest is missing or unparseable.
    }
  }
  return out.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

/**
 * Write a generator's manifest + script (+ optional license) under
 * `SOURCE/generators/<id>/`. Used both by extension materialization and by the
 * manual Project Settings flow.
 */
export async function writeGenerator(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  manifest: GeneratorManifest,
  scriptContent: ArrayBuffer,
  licenseContent?: ArrayBuffer
): Promise<void> {
  const dir = `${GENERATORS_ROOT}/${manifest.id}`;
  await fileStorage.writeFile(workspaceId, `${dir}/${manifest.script}`, scriptContent);
  if (manifest.license && licenseContent) {
    await fileStorage.writeFile(workspaceId, `${dir}/${manifest.license}`, licenseContent);
  }
  await fileStorage.writeTextFile(
    workspaceId,
    `${dir}/${MANIFEST_FILE}`,
    JSON.stringify(manifest, null, 2)
  );
}

/** Read a generator's script source text. */
export async function readGeneratorScript(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  generator: InstalledGenerator
): Promise<string> {
  return fileStorage.readTextFile(workspaceId, generator.scriptPath);
}

/**
 * Last-used option values for a generator, so the invocation form pre-fills on next
 * use. Stored under SOURCE/data/ (the conventional scratch area). Missing/unreadable
 * → an empty object.
 */
export async function readGeneratorValues(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  id: string
): Promise<Record<string, unknown>> {
  try {
    const text = await fileStorage.readTextFile(workspaceId, `SOURCE/data/generators/${id}.json`);
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Persist last-used option values for a generator (see readGeneratorValues). */
export async function writeGeneratorValues(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  id: string,
  values: Record<string, unknown>
): Promise<void> {
  await fileStorage.writeTextFile(
    workspaceId,
    `SOURCE/data/generators/${id}.json`,
    JSON.stringify(values, null, 2)
  );
}

/** Remove a generator directory and every file under it. */
export async function deleteGenerator(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  id: string
): Promise<void> {
  const files = await fileStorage.listFiles(workspaceId);
  const prefix = `${GENERATORS_ROOT}/${id}/`;
  for (const file of files.filter(f => f.startsWith(prefix))) {
    await fileStorage.deleteFile(workspaceId, file);
  }
}
