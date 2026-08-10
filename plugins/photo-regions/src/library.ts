/**
 * The per-project region library: the boxes drawn on each image, persisted as
 * SOURCE/plugins/photo-regions/regions.json inside the project workspace so it
 * rides along in SEED.zip (survives packaging, export/import, moving machines).
 * Written directly through the workspace handle, audio-clip-editor style; the
 * schema is plugin-private and the host never reads it.
 *
 * This is what makes the work durable. The `photos:` block inserted into a
 * chapter is a PROJECTION of these regions — drawing twelve faces is the
 * effort, and re-inserting after a revision should not mean drawing them
 * again. The library is the plugin's own memory, so it does not see edits made
 * to a chapter's frontmatter by hand.
 */

import { writeOpfsFile } from './opfs-write.js';
import type { Region, RegionStore, SavedRegion } from './types.js';

const DATA_DIR = ['SOURCE', 'plugins', 'photo-regions'];
const FILENAME = 'regions.json';

export function emptyStore(): RegionStore {
  return { version: 1, files: {} };
}

async function dataDir(
  root: FileSystemDirectoryHandle,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const segment of DATA_DIR) {
    dir = await dir.getDirectoryHandle(segment, { create });
  }
  return dir;
}

export async function loadRegions(root: FileSystemDirectoryHandle): Promise<RegionStore> {
  try {
    const dir = await dataDir(root, false);
    const file = await (await dir.getFileHandle(FILENAME)).getFile();
    const parsed = JSON.parse(await file.text());
    if (parsed && parsed.version === 1 && parsed.files && typeof parsed.files === 'object') {
      return parsed as RegionStore;
    }
  } catch {
    // No library yet (or unreadable) — start empty.
  }
  return emptyStore();
}

export async function saveRegions(
  root: FileSystemDirectoryHandle,
  rootPath: string[] | null,
  store: RegionStore,
): Promise<void> {
  const json = JSON.stringify(store, null, 2);
  const dir = await dataDir(root, true);
  const fileHandle = await dir.getFileHandle(FILENAME, { create: true });
  if (typeof fileHandle.createWritable === 'function') {
    const writable = await fileHandle.createWritable();
    await writable.write(json);
    await writable.close();
    return;
  }
  // Safari main thread lacks createWritable — write through the sync-access
  // worker, which needs the absolute OPFS path (init's opfsDirPath + ours).
  if (!rootPath) throw new Error('createWritable unavailable and no OPFS path known');
  await writeOpfsFile([...rootPath, ...DATA_DIR, FILENAME], json);
}

/** Strip the runtime list key so only the region's own data is stored. */
export function toSaved(regions: Region[]): SavedRegion[] {
  return regions.map(({ person, row, x, y, w, h, badge }) => {
    const saved: SavedRegion = { person, row, x, y, w, h };
    if (badge) saved.badge = { x: badge.x, y: badge.y };
    return saved;
  });
}
