import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { migrateLegacyDatabase, LEGACY_DB_NAME } from './legacy-migration.js';

const NEW_DB_NAME = 'seedhtml-storage';

function openWithSchema(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const workspaceStore = db.createObjectStore('workspaces', { keyPath: 'id' });
      workspaceStore.createIndex('created', 'created', { unique: false });
      const fileStore = db.createObjectStore('files', { keyPath: ['workspaceId', 'path'] });
      fileStore.createIndex('workspaceId', 'workspaceId', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function put(db: IDBDatabase, store: string, row: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([store], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(store).put(row);
  });
}

function getAll(db: IDBDatabase, store: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction([store], 'readonly').objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('legacy IndexedDB migration', () => {
  beforeEach(() => {
    // Fresh factory per test: no databases exist.
    globalThis.indexedDB = new IDBFactory();
  });

  it('copies workspaces and files from the legacy database into an empty target', async () => {
    const legacy = await openWithSchema(LEGACY_DB_NAME);
    await put(legacy, 'workspaces', { id: 'w1', created: 1, title: 'Book' });
    await put(legacy, 'files', { workspaceId: 'w1', path: 'OEBPS/a.xhtml', content: 'x' });
    legacy.close();

    const target = await openWithSchema(NEW_DB_NAME);
    const migrated = await migrateLegacyDatabase(target);

    expect(migrated).toBe(true);
    expect(await getAll(target, 'workspaces')).toEqual([{ id: 'w1', created: 1, title: 'Book' }]);
    expect(await getAll(target, 'files')).toEqual([
      { workspaceId: 'w1', path: 'OEBPS/a.xhtml', content: 'x' },
    ]);
    target.close();
  });

  it('leaves the legacy database intact after migrating', async () => {
    const legacy = await openWithSchema(LEGACY_DB_NAME);
    await put(legacy, 'workspaces', { id: 'w1', created: 1 });
    legacy.close();

    const target = await openWithSchema(NEW_DB_NAME);
    await migrateLegacyDatabase(target);
    target.close();

    const reopened = await openWithSchema(LEGACY_DB_NAME);
    expect(await getAll(reopened, 'workspaces')).toHaveLength(1);
    reopened.close();
  });

  it('does nothing when the target already has data', async () => {
    const legacy = await openWithSchema(LEGACY_DB_NAME);
    await put(legacy, 'workspaces', { id: 'legacy', created: 1 });
    legacy.close();

    const target = await openWithSchema(NEW_DB_NAME);
    await put(target, 'workspaces', { id: 'existing', created: 2 });

    expect(await migrateLegacyDatabase(target)).toBe(false);
    const rows = (await getAll(target, 'workspaces')) as { id: string }[];
    expect(rows.map(r => r.id)).toEqual(['existing']);
    target.close();
  });

  it('does nothing (and does not create the legacy database) when none exists', async () => {
    const target = await openWithSchema(NEW_DB_NAME);
    expect(await migrateLegacyDatabase(target)).toBe(false);
    expect(await getAll(target, 'workspaces')).toEqual([]);
    target.close();

    const databases = await indexedDB.databases();
    expect(databases.map(d => d.name)).not.toContain(LEGACY_DB_NAME);
  });

  it('is idempotent: a second call after migration is a no-op', async () => {
    const legacy = await openWithSchema(LEGACY_DB_NAME);
    await put(legacy, 'workspaces', { id: 'w1', created: 1 });
    legacy.close();

    const target = await openWithSchema(NEW_DB_NAME);
    expect(await migrateLegacyDatabase(target)).toBe(true);
    expect(await migrateLegacyDatabase(target)).toBe(false);
    expect(await getAll(target, 'workspaces')).toHaveLength(1);
    target.close();
  });
});
