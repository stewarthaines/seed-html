/**
 * The per-project clip library: named regions per audio file, persisted as
 * SOURCE/plugins/audio-clip-editor/clips.json inside the project workspace so
 * it rides along in SEED.zip (survives packaging, export/import, moving
 * machines). Written directly through the workspace handle, publish-plugin
 * style; the schema is plugin-private and the host never reads it.
 */

export interface ClipRegion {
  id: string;
  /** Seconds. */
  begin: number;
  /** Seconds. */
  end: number;
  label: string;
}

export interface ClipStore {
  version: 1;
  /** OPF-relative audio href → its saved clips. */
  files: Record<string, ClipRegion[]>;
}

const DATA_DIR = ['SOURCE', 'plugins', 'audio-clip-editor'];
const FILENAME = 'clips.json';

export function emptyStore(): ClipStore {
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

export async function loadClips(root: FileSystemDirectoryHandle): Promise<ClipStore> {
  try {
    const dir = await dataDir(root, false);
    const file = await (await dir.getFileHandle(FILENAME)).getFile();
    const parsed = JSON.parse(await file.text());
    if (parsed && parsed.version === 1 && parsed.files && typeof parsed.files === 'object') {
      return parsed as ClipStore;
    }
  } catch {
    // No library yet (or unreadable) — start empty.
  }
  return emptyStore();
}

export async function saveClips(root: FileSystemDirectoryHandle, store: ClipStore): Promise<void> {
  const dir = await dataDir(root, true);
  const fileHandle = await dir.getFileHandle(FILENAME, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(store, null, 2));
  await writable.close();
}
