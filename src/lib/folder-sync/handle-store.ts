/**
 * Persistence + permission lifecycle for linked sync folders
 * (see process/FOLDER_SYNC.md).
 *
 * The FileSystemDirectoryHandle is structured-cloneable but not
 * JSON-serializable, so it lives here in a small IndexedDB store keyed by
 * workspace id — one linked folder per project. Display metadata (folder
 * name, last-synced time) lives in WorkspaceSettings (.workspace-metadata.json),
 * the tier that never travels with the packaged EPUB: a machine-local
 * filesystem link must not ship inside a portable book.
 *
 * Handles revive across sessions; with Chrome 122+ persistent permissions the
 * revival is usually silent (queryPermission → granted), mirroring the device
 * destinations in plugins/publish-to-remote/src/device-upload.ts.
 */

const DB_NAME = 'seedhtml-folder-sync';
const STORE = 'handles';

/** No handle stored for this workspace — offer "Link folder…". */
export const FOLDER_NOT_LINKED = 'FOLDER_NOT_LINKED';
/** Handle stored but permission lapsed — offer "Reconnect folder". */
export const FOLDER_RECONNECT_REQUIRED = 'FOLDER_RECONNECT_REQUIRED';
/** Permission granted but the directory can't be read (removable media
    unplugged, folder deleted) — reconnect UI with a folder-specific message. */
export const FOLDER_UNAVAILABLE = 'FOLDER_UNAVAILABLE';

export type FolderConnectionError =
  | typeof FOLDER_NOT_LINKED
  | typeof FOLDER_RECONNECT_REQUIRED
  | typeof FOLDER_UNAVAILABLE;

export type FolderConnection =
  | { handle: FileSystemDirectoryHandle; error?: undefined }
  | { handle?: undefined; error: FolderConnectionError };

// ---------------------------------------------------------------------------
// IndexedDB plumbing (structured clone keeps the handle alive)

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
  op: (store: IDBObjectStore) => IDBRequest<T> | void
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

export function saveFolderHandle(
  workspaceId: string,
  handle: FileSystemDirectoryHandle
): Promise<unknown> {
  return withStore('readwrite', s => s.put(handle, workspaceId));
}

export async function loadFolderHandle(
  workspaceId: string
): Promise<FileSystemDirectoryHandle | null> {
  const handle = await withStore<FileSystemDirectoryHandle>('readonly', s => s.get(workspaceId));
  return handle ?? null;
}

/** Remove the stored handle (unlink, or project deletion cleanup). */
export function deleteFolderHandle(workspaceId: string): Promise<unknown> {
  return withStore('readwrite', s => s.delete(workspaceId));
}

// ---------------------------------------------------------------------------
// Permission lifecycle

// queryPermission/requestPermission are Chromium extensions not yet in the
// lib.dom FileSystemDirectoryHandle type.
type PermissionCapableHandle = FileSystemDirectoryHandle & {
  queryPermission(desc: { mode: string }): Promise<PermissionState>;
  requestPermission(desc: { mode: string }): Promise<PermissionState>;
};

/**
 * Check (and with `interactive`, request — requires a user gesture) read
 * permission on a revived handle, then probe that the directory is actually
 * readable: permission alone doesn't mean a removable volume is mounted.
 * Exported separately from connectSyncFolder so the lifecycle is unit-testable
 * with stub handles (which can't be stored in IndexedDB).
 */
export async function connectHandle(
  handle: FileSystemDirectoryHandle | null,
  options: { interactive?: boolean } = {}
): Promise<FolderConnection> {
  if (!handle) return { error: FOLDER_NOT_LINKED };

  const permissioned = handle as PermissionCapableHandle;
  let state = await permissioned.queryPermission({ mode: 'read' });
  if (state === 'prompt' && options.interactive) {
    state = await permissioned.requestPermission({ mode: 'read' });
  }
  if (state !== 'granted') return { error: FOLDER_RECONNECT_REQUIRED };

  try {
    await handle.keys().next();
    return { handle };
  } catch {
    return { error: FOLDER_UNAVAILABLE };
  }
}

/** Revive and connect the linked folder for a workspace. */
export async function connectSyncFolder(
  workspaceId: string,
  options: { interactive?: boolean } = {}
): Promise<FolderConnection> {
  return connectHandle(await loadFolderHandle(workspaceId), options);
}

/** The sidebar button's state for a workspace (non-interactive probe). */
export type FolderSyncStatus = 'not-linked' | 'connected' | 'reconnect-required' | 'unavailable';

export async function getFolderSyncStatus(workspaceId: string): Promise<FolderSyncStatus> {
  const conn = await connectSyncFolder(workspaceId);
  if (conn.handle) return 'connected';
  if (conn.error === FOLDER_NOT_LINKED) return 'not-linked';
  if (conn.error === FOLDER_UNAVAILABLE) return 'unavailable';
  return 'reconnect-required';
}
