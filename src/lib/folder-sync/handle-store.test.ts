import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  saveFolderHandle,
  loadFolderHandle,
  deleteFolderHandle,
  connectHandle,
  connectSyncFolder,
  getFolderSyncStatus,
  FOLDER_NOT_LINKED,
  FOLDER_RECONNECT_REQUIRED,
  FOLDER_UNAVAILABLE,
} from './handle-store.js';

// Stub handles are plain objects with methods — usable for the permission
// lifecycle, but NOT structured-cloneable, so store round-trip tests use a
// cloneable stand-in instead (real FileSystemDirectoryHandles are cloneable).
function stubHandle(overrides: {
  query?: PermissionState;
  request?: PermissionState;
  readable?: boolean;
}): FileSystemDirectoryHandle {
  return {
    name: 'linked-folder',
    queryPermission: async () => overrides.query ?? 'granted',
    requestPermission: async () => overrides.request ?? overrides.query ?? 'granted',
    keys: () => ({
      next: async () => {
        if (overrides.readable === false) throw new DOMException('unmounted', 'NotFoundError');
        return { done: true, value: undefined };
      },
    }),
  } as unknown as FileSystemDirectoryHandle;
}

beforeEach(() => {
  // Fresh IndexedDB per test.
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('folder handle store', () => {
  const cloneable = { name: 'my-book-folder' } as unknown as FileSystemDirectoryHandle;

  it('round-trips a handle keyed by workspace id', async () => {
    await saveFolderHandle('ws-1', cloneable);
    expect(await loadFolderHandle('ws-1')).toEqual({ name: 'my-book-folder' });
    expect(await loadFolderHandle('ws-2')).toBeNull();
  });

  it('replaces an existing handle on re-link', async () => {
    await saveFolderHandle('ws-1', cloneable);
    await saveFolderHandle('ws-1', { name: 'other' } as unknown as FileSystemDirectoryHandle);
    expect(await loadFolderHandle('ws-1')).toEqual({ name: 'other' });
  });

  it('deleteFolderHandle unlinks one workspace without touching others', async () => {
    await saveFolderHandle('ws-1', cloneable);
    await saveFolderHandle('ws-2', cloneable);
    await deleteFolderHandle('ws-1');
    expect(await loadFolderHandle('ws-1')).toBeNull();
    expect(await loadFolderHandle('ws-2')).not.toBeNull();
  });
});

describe('connectHandle', () => {
  it('returns FOLDER_NOT_LINKED for a missing handle', async () => {
    expect(await connectHandle(null)).toEqual({ error: FOLDER_NOT_LINKED });
  });

  it('connects when permission is already granted and the folder is readable', async () => {
    const handle = stubHandle({ query: 'granted' });
    expect((await connectHandle(handle)).handle).toBe(handle);
  });

  it('does not prompt without interactive: prompt state → reconnect required', async () => {
    const handle = stubHandle({ query: 'prompt', request: 'granted' });
    expect((await connectHandle(handle)).error).toBe(FOLDER_RECONNECT_REQUIRED);
  });

  it('prompts when interactive and proceeds on grant', async () => {
    const handle = stubHandle({ query: 'prompt', request: 'granted' });
    expect((await connectHandle(handle, { interactive: true })).handle).toBe(handle);
  });

  it('reports reconnect required when the prompt is denied', async () => {
    const handle = stubHandle({ query: 'prompt', request: 'denied' });
    expect((await connectHandle(handle, { interactive: true })).error).toBe(
      FOLDER_RECONNECT_REQUIRED
    );
  });

  it('distinguishes an unreadable folder (unplugged/deleted) from lapsed permission', async () => {
    const handle = stubHandle({ query: 'granted', readable: false });
    expect((await connectHandle(handle)).error).toBe(FOLDER_UNAVAILABLE);
  });
});

describe('connectSyncFolder / getFolderSyncStatus', () => {
  // Stub handles (with permission methods) can't be structured-cloned into
  // IndexedDB, so the store-backed path is only testable for the not-linked
  // case; the permission states are covered via connectHandle above and the
  // composition is trivial (load → connectHandle).
  it('reports not-linked when no handle is stored', async () => {
    expect((await connectSyncFolder('ws-1')).error).toBe(FOLDER_NOT_LINKED);
    expect(await getFolderSyncStatus('ws-1')).toBe('not-linked');
  });
});
