import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StorageCapabilities, BackendType } from './types.js';
import { FeatureDetector } from './feature-detector.js';

describe('Feature Detection Logic', () => {
  let detector: FeatureDetector;

  beforeEach(() => {
    detector = new FeatureDetector();
    detector.clearCache(); // Clear cache between tests
  });

  describe('Optimal Backend Selection Logic', () => {
    it('should prefer OPFS async when available', async () => {
      vi.spyOn(detector, 'detectCapabilities').mockResolvedValue({
        opfs: true,
        opfsAsync: true,
        opfsSync: true,
        opfsSyncWorker: true,
        indexedDB: true,
        storageEstimate: true,
      });

      const backendType = await detector.detectOptimalBackend();
      expect(backendType).toBe('opfs-async');
    });

    it('should fallback to OPFS sync when async not available', async () => {
      vi.spyOn(detector, 'detectCapabilities').mockResolvedValue({
        opfs: true,
        opfsAsync: false,
        opfsSync: false,
        opfsSyncWorker: true,
        indexedDB: true,
        storageEstimate: true,
      });

      const backendType = await detector.detectOptimalBackend();
      expect(backendType).toBe('opfs-sync');
    });

    it('should fallback to IndexedDB when OPFS not available', async () => {
      vi.spyOn(detector, 'detectCapabilities').mockResolvedValue({
        opfs: false,
        opfsAsync: false,
        opfsSync: false,
        opfsSyncWorker: false,
        indexedDB: true,
        storageEstimate: false,
      });

      const backendType = await detector.detectOptimalBackend();
      expect(backendType).toBe('indexeddb');
    });

    it('should throw error when no storage backend is available', async () => {
      vi.spyOn(detector, 'detectCapabilities').mockResolvedValue({
        opfs: false,
        opfsAsync: false,
        opfsSync: false,
        opfsSyncWorker: false,
        indexedDB: false,
        storageEstimate: false,
      });

      await expect(detector.detectOptimalBackend()).rejects.toThrow('No storage backend available');
    });
  });

  describe('Browser-Specific Detection Scenarios', () => {
    it('should handle Chrome HTTPS scenario', async () => {
      vi.spyOn(detector, 'detectCapabilities').mockResolvedValue({
        opfs: true,
        opfsAsync: true,
        opfsSync: false,
        opfsSyncWorker: false,
        indexedDB: true,
        storageEstimate: true,
      });

      const backendType = await detector.detectOptimalBackend();
      expect(backendType).toBe('opfs-async');
    });

    it('should handle Safari scenario', async () => {
      vi.spyOn(detector, 'detectCapabilities').mockResolvedValue({
        opfs: true,
        opfsAsync: false,
        opfsSync: false,
        opfsSyncWorker: true,
        indexedDB: true,
        storageEstimate: true,
      });

      const backendType = await detector.detectOptimalBackend();
      expect(backendType).toBe('opfs-sync');
    });

    it('should handle Chrome file:// protocol restrictions', async () => {
      vi.spyOn(detector, 'detectCapabilities').mockResolvedValue({
        opfs: false,
        opfsAsync: false,
        opfsSync: false,
        opfsSyncWorker: false,
        indexedDB: true,
        storageEstimate: false,
      });

      const backendType = await detector.detectOptimalBackend();
      expect(backendType).toBe('indexeddb');
    });

    it('should handle Firefox OPFS support', async () => {
      vi.spyOn(detector, 'detectCapabilities').mockResolvedValue({
        opfs: true,
        opfsAsync: true,
        opfsSync: false,
        opfsSyncWorker: false,
        indexedDB: true,
        storageEstimate: true,
      });

      const backendType = await detector.detectOptimalBackend();
      expect(backendType).toBe('opfs-async');
    });
  });

  describe('Capability Detection Logic', () => {
    it('should combine individual test results correctly', async () => {
      vi.spyOn(detector, 'testOPFSAvailable').mockResolvedValue(true);
      vi.spyOn(detector, 'testOPFSAsync').mockResolvedValue(true);
      vi.spyOn(detector, 'testOPFSSync').mockResolvedValue(false);
      vi.spyOn(detector, 'testOPFSSyncWorker').mockResolvedValue(false);
      vi.spyOn(detector, 'testIndexedDB').mockResolvedValue(true);
      vi.spyOn(detector, 'testStorageEstimate').mockResolvedValue(true);

      const capabilities = await detector.detectCapabilities();

      expect(capabilities).toEqual({
        opfs: true,
        opfsAsync: true,
        opfsSync: false,
        opfsSyncWorker: false,
        indexedDB: true,
        storageEstimate: true,
      });
    });

    it('should handle test failures gracefully', async () => {
      vi.spyOn(detector, 'testOPFSAvailable').mockRejectedValue(new Error('Test failed'));
      vi.spyOn(detector, 'testOPFSAsync').mockRejectedValue(new Error('Test failed'));
      vi.spyOn(detector, 'testOPFSSync').mockRejectedValue(new Error('Test failed'));
      vi.spyOn(detector, 'testOPFSSyncWorker').mockRejectedValue(new Error('Test failed'));
      vi.spyOn(detector, 'testIndexedDB').mockResolvedValue(true);
      vi.spyOn(detector, 'testStorageEstimate').mockRejectedValue(new Error('Test failed'));

      const capabilities = await detector.detectCapabilities();

      expect(capabilities).toEqual({
        opfs: false,
        opfsAsync: false,
        opfsSync: false,
        opfsSyncWorker: false,
        indexedDB: true,
        storageEstimate: false,
      });
    });

    it('should fallback to safe defaults on complete failure', async () => {
      vi.spyOn(detector, 'testOPFSAvailable').mockRejectedValue(new Error('Global failure'));
      vi.spyOn(detector, 'testOPFSAsync').mockRejectedValue(new Error('Global failure'));
      vi.spyOn(detector, 'testOPFSSync').mockRejectedValue(new Error('Global failure'));
      vi.spyOn(detector, 'testOPFSSyncWorker').mockRejectedValue(new Error('Global failure'));
      vi.spyOn(detector, 'testIndexedDB').mockRejectedValue(new Error('Global failure'));
      vi.spyOn(detector, 'testStorageEstimate').mockRejectedValue(new Error('Global failure'));

      const capabilities = await detector.detectCapabilities();

      expect(capabilities).toEqual({
        opfs: false,
        opfsAsync: false,
        opfsSync: false,
        opfsSyncWorker: false,
        indexedDB: false,
        storageEstimate: false,
      });
    });
  });

  describe('Performance and Caching', () => {
    it('should cache detection results between calls', async () => {
      // Clear cache and mocks before test
      detector.clearCache();
      vi.clearAllMocks();

      const mockDetection = vi.spyOn(detector, 'testOPFSAvailable').mockResolvedValue(true);
      vi.spyOn(detector, 'testOPFSAsync').mockResolvedValue(true);
      vi.spyOn(detector, 'testOPFSSync').mockResolvedValue(false);
      vi.spyOn(detector, 'testOPFSSyncWorker').mockResolvedValue(false);
      vi.spyOn(detector, 'testIndexedDB').mockResolvedValue(true);
      vi.spyOn(detector, 'testStorageEstimate').mockResolvedValue(true);

      // First call
      await detector.detectCapabilities();
      // Second call
      await detector.detectCapabilities();

      // Should only call the expensive detection once due to caching
      expect(mockDetection).toHaveBeenCalledTimes(1);
    });

    it('should allow cache clearing', async () => {
      // Clear cache and mocks before test
      detector.clearCache();
      vi.clearAllMocks();

      const mockDetection = vi.spyOn(detector, 'testOPFSAvailable').mockResolvedValue(true);
      vi.spyOn(detector, 'testOPFSAsync').mockResolvedValue(true);
      vi.spyOn(detector, 'testOPFSSync').mockResolvedValue(false);
      vi.spyOn(detector, 'testOPFSSyncWorker').mockResolvedValue(false);
      vi.spyOn(detector, 'testIndexedDB').mockResolvedValue(true);
      vi.spyOn(detector, 'testStorageEstimate').mockResolvedValue(true);

      await detector.detectCapabilities();
      detector.clearCache();
      await detector.detectCapabilities();

      // Should call detection twice since cache was cleared
      expect(mockDetection).toHaveBeenCalledTimes(2);
    });
  });
});
