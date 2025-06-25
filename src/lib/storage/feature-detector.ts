/**
 * Feature Detection for Storage Backends
 *
 * Implements comprehensive browser capability detection for OPFS and IndexedDB
 * storage backends, following the strategy outlined in the spike requirements.
 */

import type { StorageCapabilities, BackendType } from './types.js';

export class FeatureDetector {
  private capabilityCache: StorageCapabilities | null = null;

  /**
   * Test if OPFS is available in the current environment
   */
  async testOPFSAvailable(): Promise<boolean> {
    try {
      return 'storage' in navigator && 'getDirectory' in navigator.storage;
    } catch {
      return false;
    }
  }

  /**
   * Test if OPFS async operations work (createWritable on main thread)
   */
  async testOPFSAsync(): Promise<boolean> {
    try {
      if (!(await this.testOPFSAvailable())) {
        return false;
      }

      const root = await navigator.storage.getDirectory();
      const testHandle = await root.getFileHandle('__opfs_async_test__', { create: true });

      if (!('createWritable' in testHandle)) {
        await root.removeEntry('__opfs_async_test__').catch(() => undefined);
        return false;
      }

      try {
        const writable = await testHandle.createWritable();
        await writable.close();
        await root.removeEntry('__opfs_async_test__');
        return true;
      } catch {
        // Clean up test file
        await root.removeEntry('__opfs_async_test__').catch(() => undefined);
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Test if OPFS sync operations work (createSyncAccessHandle on main thread)
   */
  async testOPFSSync(): Promise<boolean> {
    try {
      if (!(await this.testOPFSAvailable())) {
        return false;
      }

      const root = await navigator.storage.getDirectory();
      const testHandle = await root.getFileHandle('__opfs_sync_test__', { create: true });

      if (!('createSyncAccessHandle' in testHandle)) {
        await root.removeEntry('__opfs_sync_test__').catch(() => undefined);
        return false;
      }

      try {
        const syncHandle = await (testHandle as any).createSyncAccessHandle();
        syncHandle.close();
        await root.removeEntry('__opfs_sync_test__');
        return true;
      } catch {
        // Clean up test file
        await root.removeEntry('__opfs_sync_test__').catch(() => undefined);
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Test if OPFS sync operations work in a Web Worker
   */
  async testOPFSSyncWorker(): Promise<boolean> {
    return new Promise(resolve => {
      try {
        const workerScript = `
					(async () => {
						try {
							const root = await navigator.storage.getDirectory();
							const testHandle = await root.getFileHandle('__worker_test__', { create: true });
							if ('createSyncAccessHandle' in testHandle) {
								const syncHandle = await testHandle.createSyncAccessHandle();
								syncHandle.close();
								await root.removeEntry('__worker_test__');
								self.postMessage({ success: true });
							} else {
								self.postMessage({ success: false });
							}
						} catch (error) {
							self.postMessage({ success: false, error: error.message });
						}
					})();
				`;

        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const workerURL = URL.createObjectURL(blob);
        const worker = new Worker(workerURL);

        const timeout = setTimeout(() => {
          worker.terminate();
          URL.revokeObjectURL(workerURL);
          resolve(false);
        }, 3000);

        worker.onmessage = event => {
          clearTimeout(timeout);
          worker.terminate();
          URL.revokeObjectURL(workerURL);
          resolve(event.data.success === true);
        };

        worker.onerror = () => {
          clearTimeout(timeout);
          worker.terminate();
          URL.revokeObjectURL(workerURL);
          resolve(false);
        };
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Test if IndexedDB is available and working
   */
  async testIndexedDB(): Promise<boolean> {
    return new Promise(resolve => {
      try {
        if (!('indexedDB' in globalThis)) {
          resolve(false);
          return;
        }

        const request = indexedDB.open('__capability_test__', 1);

        request.onerror = () => {
          resolve(false);
        };

        request.onsuccess = () => {
          const db = request.result;
          db.close();
          // Clean up test database
          indexedDB.deleteDatabase('__capability_test__');
          resolve(true);
        };

        request.onupgradeneeded = event => {
          const db = (event.target as IDBOpenDBRequest).result;
          // Just create a test object store
          if (!db.objectStoreNames.contains('test')) {
            db.createObjectStore('test');
          }
        };
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Test if storage estimate API is available
   */
  async testStorageEstimate(): Promise<boolean> {
    try {
      if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
        return false;
      }

      await navigator.storage.estimate();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect all storage capabilities in parallel for performance
   */
  async detectCapabilities(): Promise<StorageCapabilities> {
    if (this.capabilityCache) {
      return this.capabilityCache;
    }

    try {
      const [opfs, opfsAsync, opfsSync, opfsSyncWorker, indexedDB, storageEstimate] =
        await Promise.all([
          this.testOPFSAvailable().catch(() => false),
          this.testOPFSAsync().catch(() => false),
          this.testOPFSSync().catch(() => false),
          this.testOPFSSyncWorker().catch(() => false),
          this.testIndexedDB().catch(() => false),
          this.testStorageEstimate().catch(() => false),
        ]);

      this.capabilityCache = {
        opfs,
        opfsAsync,
        opfsSync,
        opfsSyncWorker,
        indexedDB,
        storageEstimate,
      };

      return this.capabilityCache;
    } catch {
      // Fallback to minimal capabilities
      this.capabilityCache = {
        opfs: false,
        opfsAsync: false,
        opfsSync: false,
        opfsSyncWorker: false,
        indexedDB: false,
        storageEstimate: false,
      };

      return this.capabilityCache;
    }
  }

  /**
   * Detect the optimal storage backend based on capabilities
   * Priority: OPFS async > OPFS sync worker > IndexedDB
   */
  async detectOptimalBackend(): Promise<BackendType> {
    const capabilities = await this.detectCapabilities();

    // Prefer main thread async OPFS (generally fastest, works on Firefox/Chrome)
    if (capabilities.opfsAsync) {
      return 'opfs-async';
    }

    // Fallback to worker sync OPFS (good for Safari, file:// restrictions)
    if (capabilities.opfsSyncWorker) {
      return 'opfs-sync';
    }

    // Final fallback to IndexedDB (universal compatibility)
    if (capabilities.indexedDB) {
      return 'indexeddb';
    }

    throw new Error('No storage backend available');
  }

  /**
   * Clear capability cache (useful for testing)
   */
  clearCache(): void {
    this.capabilityCache = null;
  }
}
