/**
 * One-time migration from the legacy IndexedDB database.
 *
 * The IndexedDB backend holds ENTIRE PROJECTS for browsers without OPFS
 * `createWritable` (the Safari lineage). The database was renamed with the
 * app ("editme" is the former product name), and without this shim those
 * users would open the renamed app to an empty project list.
 *
 * On backend init, if the new database is empty and the legacy one exists,
 * every row of every store is copied across. The legacy database is left
 * intact for one release as a backstop; this module (and the rename-guard
 * allowlist entry that permits the legacy name to appear here) will be
 * deleted together once the migration window closes.
 *
 * NOTE: this file is the single sanctioned place the former name may appear
 * (scripts/check-rename.mjs enforces that).
 */

// The former database name — the one thing this module exists to know.
export const LEGACY_DB_NAME = 'editme-storage';

const STORES = ['workspaces', 'files'] as const;

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function countRows(db: IDBDatabase, store: string): Promise<number> {
  if (!db.objectStoreNames.contains(store)) return 0;
  const tx = db.transaction([store], 'readonly');
  return requestAsPromise(tx.objectStore(store).count());
}

/**
 * Does a database exist, without creating it? Uses indexedDB.databases()
 * where available; otherwise opens the database and, if that open CREATED it
 * (observable via upgradeneeded), deletes the fresh husk and reports false.
 */
async function databaseExists(name: string): Promise<boolean> {
  if (typeof indexedDB.databases === 'function') {
    try {
      const list = await indexedDB.databases();
      return list.some(info => info.name === name);
    } catch {
      // fall through to the open probe
    }
  }
  let created = false;
  const db = await new Promise<IDBDatabase | null>(resolve => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => {
      created = true;
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  if (!db) return false;
  db.close();
  if (created) {
    await requestAsPromise(indexedDB.deleteDatabase(name) as unknown as IDBRequest<undefined>);
    return false;
  }
  return true;
}

function openExisting(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readAll(db: IDBDatabase, store: string): Promise<unknown[]> {
  if (!db.objectStoreNames.contains(store)) return [];
  const tx = db.transaction([store], 'readonly');
  return requestAsPromise(tx.objectStore(store).getAll());
}

function writeAll(db: IDBDatabase, store: string, rows: unknown[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([store], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const objectStore = tx.objectStore(store);
    for (const row of rows) {
      objectStore.put(row);
    }
  });
}

/**
 * Copy the legacy database's contents into `target` if (and only if) the
 * target is empty and the legacy database exists. Returns true when a
 * migration ran. The legacy database is not deleted.
 */
export async function migrateLegacyDatabase(target: IDBDatabase): Promise<boolean> {
  try {
    if ((await countRows(target, 'workspaces')) > 0) return false;
    if (!(await databaseExists(LEGACY_DB_NAME))) return false;

    const legacy = await openExisting(LEGACY_DB_NAME);
    try {
      let copied = 0;
      for (const store of STORES) {
        if (!target.objectStoreNames.contains(store)) continue;
        const rows = await readAll(legacy, store);
        if (rows.length === 0) continue;
        await writeAll(target, store, rows);
        copied += rows.length;
      }
      if (copied > 0) {
        console.warn(`Storage: migrated ${copied} rows from the legacy database`);
      }
      return copied > 0;
    } finally {
      legacy.close();
    }
  } catch (error) {
    // A failed migration must never block startup: the legacy data stays
    // intact and the next launch retries (target is still empty).
    console.error('Storage: legacy database migration failed:', error);
    return false;
  }
}
