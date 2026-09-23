/**
 * USB e-reader destinations via the File System Access API.
 *
 * An MSC e-reader (Kobo, Tolino, PocketBook…) mounts as an ordinary drive;
 * WebUSB cannot touch it (mass storage is a protected interface class), but
 * `showDirectoryPicker()` can — see process/DEVICE_DESTINATIONS.md and the
 * validated spike. Chromium desktop only; callers check
 * `isDeviceSupported()` and render the option disabled elsewhere, with a
 * tooltip explaining why.
 *
 * The remote's JSON config (DeviceRemoteConfig) lives in the ordinary OPFS
 * remotes store; the FileSystemDirectoryHandle is NOT JSON-serialisable and
 * lives here, in a small IndexedDB store keyed by remote id. Handles revive
 * across sessions; with Chrome 122+ persistent permissions the revival is
 * silent (verified `queryPermission → granted` on real hardware after
 * reload and replug).
 */
import type { DeviceRemoteConfig, S3Object } from './types.js';

export const DEVICE_RECONNECT_REQUIRED = 'DEVICE_RECONNECT_REQUIRED';
export const DEVICE_NOT_CONNECTED = 'DEVICE_NOT_CONNECTED';

export function isDeviceSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// ---------------------------------------------------------------------------
// Handle persistence (IndexedDB — structured clone keeps the handle alive)

const DB_NAME = 'publish-device-handles';
const STORE = 'handles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      let result: T | undefined;
      if (req) req.onsuccess = () => (result = req.result);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function saveDeviceHandle(
  remoteId: string,
  handle: FileSystemDirectoryHandle,
): Promise<unknown> {
  return withStore('readwrite', (s) => s.put(handle, remoteId));
}

export async function loadDeviceHandle(
  remoteId: string,
): Promise<FileSystemDirectoryHandle | null> {
  const h = await withStore<FileSystemDirectoryHandle>('readonly', (s) =>
    s.get(remoteId),
  );
  return h ?? null;
}

export function deleteDeviceHandle(remoteId: string): Promise<unknown> {
  return withStore('readwrite', (s) => s.delete(remoteId));
}

// ---------------------------------------------------------------------------
// Device identification

export interface DeviceSniff {
  kind: 'kobo' | 'generic';
  /** Short human description, e.g. "Kobo · firmware 4.38.23697". */
  detail?: string;
}

/** Parse a `.kobo/version` line: serial,?,firmware,… (comma-separated). */
export function parseKoboVersion(text: string): {
  serial?: string;
  firmware?: string;
} {
  const fields = text.trim().split(',');
  return {
    serial: fields[0] || undefined,
    firmware: fields[2] || undefined,
  };
}

export async function sniffVolume(
  dir: FileSystemDirectoryHandle,
): Promise<DeviceSniff> {
  try {
    const kobo = await dir.getDirectoryHandle('.kobo');
    let detail = 'Kobo';
    try {
      const file = await (await kobo.getFileHandle('version')).getFile();
      const { firmware } = parseKoboVersion(await file.text());
      if (firmware) detail = `Kobo · firmware ${firmware}`;
    } catch {
      // no version file — still a Kobo volume
    }
    return { kind: 'kobo', detail };
  } catch {
    return { kind: 'generic' };
  }
}

/** Show the directory picker and identify what was picked. */
export async function pickDevice(): Promise<{
  handle: FileSystemDirectoryHandle;
  sniff: DeviceSniff;
}> {
  const handle = await (
    window as unknown as {
      showDirectoryPicker: (opts: {
        mode: string;
      }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker({ mode: 'readwrite' });
  return { handle, sniff: await sniffVolume(handle) };
}

// ---------------------------------------------------------------------------
// Connection lifecycle

type PermissionCapableHandle = FileSystemDirectoryHandle & {
  queryPermission(desc: { mode: string }): Promise<PermissionState>;
  requestPermission(desc: { mode: string }): Promise<PermissionState>;
};

/**
 * Revive the persisted handle for a device remote. `interactive` allows a
 * permission prompt (must be called from a user gesture). Errors use the
 * sentinel strings so callers can offer the right recovery.
 */
export async function connectDevice(
  remote: DeviceRemoteConfig,
  options: { interactive?: boolean } = {},
): Promise<
  | { handle: FileSystemDirectoryHandle; error?: undefined }
  | { handle?: undefined; error: string }
> {
  const handle = (await loadDeviceHandle(
    remote.id,
  )) as PermissionCapableHandle | null;
  if (!handle) return { error: DEVICE_RECONNECT_REQUIRED };

  let state = await handle.queryPermission({ mode: 'readwrite' });
  if (state === 'prompt' && options.interactive) {
    state = await handle.requestPermission({ mode: 'readwrite' });
  }
  if (state !== 'granted') return { error: DEVICE_RECONNECT_REQUIRED };

  // Permission alone doesn't mean the volume is mounted — probe it.
  try {
    await handle.keys().next();
    return { handle };
  } catch {
    return { error: DEVICE_NOT_CONNECTED };
  }
}

/** Resolve the configured target folder ('' = volume root), path segments separated by '/'. */
async function targetDir(
  handle: FileSystemDirectoryHandle,
  targetFolder: string,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  let dir = handle;
  for (const segment of targetFolder.split('/').filter(Boolean)) {
    dir = await dir.getDirectoryHandle(segment, { create });
  }
  return dir;
}

// ---------------------------------------------------------------------------
// remote-ops surface

export async function uploadToDevice(
  remote: DeviceRemoteConfig,
  objectKey: string,
  blob: Blob,
  onProgress?: (percent: number) => void,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const conn = await connectDevice(remote);
  if (!conn.handle) return { success: false, error: conn.error ?? 'unknown' };
  try {
    const dir = await targetDir(conn.handle, remote.targetFolder, true);
    const fh = await dir.getFileHandle(objectKey, { create: true });
    const writable = await fh.createWritable();
    // Chunked copy so MSC's slow flush shows real progress (a book takes
    // seconds on a real device — verified ~1s for 2KB on hardware).
    const reader = blob.stream().getReader();
    let written = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await writable.write(value);
      written += value.byteLength;
      onProgress?.(Math.round((written / blob.size) * 100));
    }
    await writable.close();
    onProgress?.(100);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/** Files the device list shows: EPUBs (plain or Kobo kepub). Dot-prefixed
 * names are excluded — macOS strews AppleDouble sidecars (`._book.epub`)
 * across FAT volumes, one per file. */
export function isBookFile(name: string): boolean {
  return !name.startsWith('.') && /\.(epub|kepub\.epub)$/i.test(name);
}

export async function listDeviceFiles(
  remote: DeviceRemoteConfig,
): Promise<{ objects: S3Object[]; error?: string }> {
  const conn = await connectDevice(remote);
  if (!conn.handle) return { objects: [], error: conn.error ?? 'unknown' };
  try {
    const dir = await targetDir(conn.handle, remote.targetFolder, false);
    const objects: S3Object[] = [];
    for await (const entry of dir.values()) {
      if (entry.kind !== 'file') continue;
      if (!isBookFile(entry.name)) continue;
      const file = await (entry as FileSystemFileHandle).getFile();
      objects.push({
        key: entry.name,
        size: file.size,
        lastModified: new Date(file.lastModified).toISOString(),
      });
    }
    objects.sort((a, b) => a.key.localeCompare(b.key));
    return { objects };
  } catch (error) {
    // Missing target folder just means nothing sent yet.
    if ((error as DOMException)?.name === 'NotFoundError')
      return { objects: [] };
    return { objects: [], error: String(error) };
  }
}

/** Read a book off the device (an EPUB to import). Null when it is not there. */
export async function readDeviceFile(
  remote: DeviceRemoteConfig,
  objectKey: string,
): Promise<{ blob?: Blob | null; error?: string }> {
  const conn = await connectDevice(remote);
  if (!conn.handle) return { error: conn.error ?? 'unknown' };
  try {
    const dir = await targetDir(conn.handle, remote.targetFolder, false);
    const fh = await dir.getFileHandle(objectKey);
    return { blob: await fh.getFile() };
  } catch (error) {
    if ((error as DOMException)?.name === 'NotFoundError') return { blob: null };
    return { error: String(error) };
  }
}

export async function deleteDeviceFile(
  remote: DeviceRemoteConfig,
  objectKey: string,
): Promise<{ success: boolean; error?: string }> {
  const conn = await connectDevice(remote);
  if (!conn.handle) return { success: false, error: conn.error ?? 'unknown' };
  try {
    const dir = await targetDir(conn.handle, remote.targetFolder, false);
    await dir.removeEntry(objectKey);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
