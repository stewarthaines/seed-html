import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StorageCapabilities, BackendType } from './types.js';
import { FeatureDetector } from './feature-detector.js';

// Mock browser APIs
const mockNavigator = {
	storage: {
		getDirectory: vi.fn(),
		estimate: vi.fn()
	}
};

const mockIndexedDB = {
	open: vi.fn(),
	deleteDatabase: vi.fn()
};

const mockURL = {
	createObjectURL: vi.fn(),
	revokeObjectURL: vi.fn()
};

const mockWorker = vi.fn();

vi.stubGlobal('navigator', mockNavigator);
vi.stubGlobal('indexedDB', mockIndexedDB);
vi.stubGlobal('URL', mockURL);
vi.stubGlobal('Worker', mockWorker);

describe('Feature Detection', () => {
	let detector: FeatureDetector;

	beforeEach(() => {
		vi.clearAllMocks();
		detector = new FeatureDetector();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('OPFS Detection', () => {
		it('should detect OPFS support when navigator.storage.getDirectory exists', async () => {
			mockNavigator.storage.getDirectory.mockResolvedValue({});

			const hasOPFS = await detector.testOPFSAvailable();
			
			expect(hasOPFS).toBe(true);
		});

		it('should return false when OPFS is not available', async () => {
			vi.stubGlobal('navigator', {});

			const hasOPFS = await detector.testOPFSAvailable();
			
			expect(hasOPFS).toBe(false);
		});

		it('should return false when navigator.storage is missing', async () => {
			vi.stubGlobal('navigator', { storage: {} });

			const hasOPFS = await detector.testOPFSAvailable();
			
			expect(hasOPFS).toBe(false);
		});
	});

	describe('OPFS Async Detection', () => {
		it('should detect async OPFS when createWritable works', async () => {
			const mockWritable = { close: vi.fn() };
			const mockFileHandle = {
				createWritable: vi.fn().mockResolvedValue(mockWritable)
			};
			const mockRoot = {
				getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
				removeEntry: vi.fn()
			};
			
			mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);

			const result = await detector.testOPFSAsync();
			
			expect(result).toBe(true);
			expect(mockFileHandle.createWritable).toHaveBeenCalled();
			expect(mockWritable.close).toHaveBeenCalled();
			expect(mockRoot.removeEntry).toHaveBeenCalledWith('__opfs_async_test__');
		});

		it('should return false when createWritable fails', async () => {
			const mockFileHandle = {
				createWritable: vi.fn().mockRejectedValue(new Error('Permission denied'))
			};
			const mockRoot = {
				getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
				removeEntry: vi.fn()
			};
			
			mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);

			const result = await detector.testOPFSAsync();
			
			expect(result).toBe(false);
			expect(mockRoot.removeEntry).toHaveBeenCalledWith('__opfs_async_test__');
		});

		it('should return false when OPFS is not available', async () => {
			mockNavigator.storage.getDirectory.mockRejectedValue(new Error('Not available'));

			const result = await detector.testOPFSAsync();
			
			expect(result).toBe(false);
		});

		it('should return false when createWritable method does not exist', async () => {
			const mockFileHandle = {}; // No createWritable method
			const mockRoot = {
				getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
				removeEntry: vi.fn()
			};
			
			mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);

			const result = await detector.testOPFSAsync();
			
			expect(result).toBe(false);
		});
	});

	describe('OPFS Sync Detection', () => {
		it('should detect sync OPFS when createSyncAccessHandle works', async () => {
			const mockSyncHandle = { close: vi.fn() };
			const mockFileHandle = {
				createSyncAccessHandle: vi.fn().mockResolvedValue(mockSyncHandle)
			};
			const mockRoot = {
				getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
				removeEntry: vi.fn()
			};
			
			mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);

			const result = await detector.testOPFSSync();
			
			expect(result).toBe(true);
			expect(mockFileHandle.createSyncAccessHandle).toHaveBeenCalled();
			expect(mockSyncHandle.close).toHaveBeenCalled();
		});

		it('should return false when createSyncAccessHandle fails', async () => {
			const mockFileHandle = {
				createSyncAccessHandle: vi.fn().mockRejectedValue(new Error('Not allowed'))
			};
			const mockRoot = {
				getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
				removeEntry: vi.fn()
			};
			
			mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);

			const result = await detector.testOPFSSync();
			
			expect(result).toBe(false);
		});

		it('should return false when createSyncAccessHandle method does not exist', async () => {
			const mockFileHandle = {}; // No createSyncAccessHandle method
			const mockRoot = {
				getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
				removeEntry: vi.fn()
			};
			
			mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);

			const result = await detector.testOPFSSync();
			
			expect(result).toBe(false);
		});
	});

	describe('OPFS Sync Worker Detection', () => {
		it('should detect worker sync support when worker test succeeds', async () => {
			const mockWorkerInstance = {
				postMessage: vi.fn(),
				terminate: vi.fn(),
				addEventListener: vi.fn(),
				onmessage: null,
				onerror: null
			};

			mockWorker.mockReturnValue(mockWorkerInstance);
			mockURL.createObjectURL.mockReturnValue('blob:mock-url');

			// Simulate successful worker response
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					mockWorkerInstance.onmessage({ data: { success: true } });
				}
			}, 0);

			const result = await detector.testOPFSSyncWorker();
			
			expect(result).toBe(true);
			expect(mockWorkerInstance.terminate).toHaveBeenCalled();
			expect(mockURL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
		});

		it('should return false when worker test fails', async () => {
			const mockWorkerInstance = {
				postMessage: vi.fn(),
				terminate: vi.fn(),
				addEventListener: vi.fn(),
				onmessage: null,
				onerror: null
			};

			mockWorker.mockReturnValue(mockWorkerInstance);
			mockURL.createObjectURL.mockReturnValue('blob:mock-url');

			// Simulate worker failure
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					mockWorkerInstance.onmessage({ data: { success: false, error: 'Access denied' } });
				}
			}, 0);

			const result = await detector.testOPFSSyncWorker();
			
			expect(result).toBe(false);
		});

		it('should return false when worker times out', async () => {
			const mockWorkerInstance = {
				postMessage: vi.fn(),
				terminate: vi.fn(),
				addEventListener: vi.fn(),
				onmessage: null,
				onerror: null
			};

			mockWorker.mockReturnValue(mockWorkerInstance);
			mockURL.createObjectURL.mockReturnValue('blob:mock-url');

			// Don't send any response, let it timeout
			const result = await detector.testOPFSSyncWorker();
			
			expect(result).toBe(false);
			expect(mockWorkerInstance.terminate).toHaveBeenCalled();
		});

		it('should return false when worker creation fails', async () => {
			mockWorker.mockImplementation(() => {
				throw new Error('Worker creation failed');
			});

			const result = await detector.testOPFSSyncWorker();
			
			expect(result).toBe(false);
		});

		it('should handle worker onerror events', async () => {
			const mockWorkerInstance = {
				postMessage: vi.fn(),
				terminate: vi.fn(),
				addEventListener: vi.fn(),
				onmessage: null,
				onerror: null
			};

			mockWorker.mockReturnValue(mockWorkerInstance);
			mockURL.createObjectURL.mockReturnValue('blob:mock-url');

			// Simulate worker error
			setTimeout(() => {
				if (mockWorkerInstance.onerror) {
					mockWorkerInstance.onerror(new Error('Worker script error'));
				}
			}, 0);

			const result = await detector.testOPFSSyncWorker();
			
			expect(result).toBe(false);
		});
	});

	describe('IndexedDB Detection', () => {
		it('should detect IndexedDB when available and working', async () => {
			const mockDB = { name: 'test-db', close: vi.fn() };
			const mockOpenRequest = {
				result: mockDB,
				onsuccess: null,
				onerror: null,
				onupgradeneeded: null
			};
			
			mockIndexedDB.open.mockReturnValue(mockOpenRequest);

			// Simulate successful database open
			setTimeout(() => {
				if (mockOpenRequest.onsuccess) {
					mockOpenRequest.onsuccess();
				}
			}, 0);

			const result = await detector.testIndexedDB();
			
			expect(result).toBe(true);
			expect(mockDB.close).toHaveBeenCalled();
		});

		it('should return false when IndexedDB open fails', async () => {
			const mockOpenRequest = {
				error: new Error('Database blocked'),
				onsuccess: null,
				onerror: null,
				onupgradeneeded: null
			};
			
			mockIndexedDB.open.mockReturnValue(mockOpenRequest);

			// Simulate database open error
			setTimeout(() => {
				if (mockOpenRequest.onerror) {
					mockOpenRequest.onerror();
				}
			}, 0);

			const result = await detector.testIndexedDB();
			
			expect(result).toBe(false);
		});

		it('should return false when IndexedDB is not available', async () => {
			vi.stubGlobal('indexedDB', undefined);

			const result = await detector.testIndexedDB();
			
			expect(result).toBe(false);
		});
	});

	describe('Storage Estimate Detection', () => {
		it('should detect storage estimate API when available', async () => {
			mockNavigator.storage.estimate.mockResolvedValue({
				quota: 1000000,
				usage: 500000
			});

			const result = await detector.testStorageEstimate();
			
			expect(result).toBe(true);
		});

		it('should return false when storage estimate is not available', async () => {
			const navigatorWithoutEstimate = {
				storage: {
					getDirectory: vi.fn()
				}
			};
			vi.stubGlobal('navigator', navigatorWithoutEstimate);

			const result = await detector.testStorageEstimate();
			
			expect(result).toBe(false);
		});

		it('should return false when storage estimate fails', async () => {
			mockNavigator.storage.estimate.mockRejectedValue(new Error('Not available'));

			const result = await detector.testStorageEstimate();
			
			expect(result).toBe(false);
		});
	});

	describe('Comprehensive Capability Detection', () => {
		it('should detect all capabilities in modern browser', async () => {
			// Mock all features as available
			vi.spyOn(detector, 'testOPFSAvailable').mockResolvedValue(true);
			vi.spyOn(detector, 'testOPFSAsync').mockResolvedValue(true);
			vi.spyOn(detector, 'testOPFSSync').mockResolvedValue(true);
			vi.spyOn(detector, 'testOPFSSyncWorker').mockResolvedValue(true);
			vi.spyOn(detector, 'testIndexedDB').mockResolvedValue(true);
			vi.spyOn(detector, 'testStorageEstimate').mockResolvedValue(true);

			const capabilities = await detector.detectCapabilities();
			
			expect(capabilities).toEqual({
				opfs: true,
				opfsAsync: true,
				opfsSync: true,
				opfsSyncWorker: true,
				indexedDB: true,
				storageEstimate: true
			});
		});

		it('should detect limited capabilities in restricted environment', async () => {
			// Mock only IndexedDB as available
			vi.spyOn(detector, 'testOPFSAvailable').mockResolvedValue(false);
			vi.spyOn(detector, 'testOPFSAsync').mockResolvedValue(false);
			vi.spyOn(detector, 'testOPFSSync').mockResolvedValue(false);
			vi.spyOn(detector, 'testOPFSSyncWorker').mockResolvedValue(false);
			vi.spyOn(detector, 'testIndexedDB').mockResolvedValue(true);
			vi.spyOn(detector, 'testStorageEstimate').mockResolvedValue(false);

			const capabilities = await detector.detectCapabilities();
			
			expect(capabilities).toEqual({
				opfs: false,
				opfsAsync: false,
				opfsSync: false,
				opfsSyncWorker: false,
				indexedDB: true,
				storageEstimate: false
			});
		});
	});

	describe('Optimal Backend Detection', () => {
		it('should prefer OPFS async when available', async () => {
			vi.spyOn(detector, 'detectCapabilities').mockResolvedValue({
				opfs: true,
				opfsAsync: true,
				opfsSync: true,
				opfsSyncWorker: true,
				indexedDB: true,
				storageEstimate: true
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
				storageEstimate: true
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
				storageEstimate: false
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
				storageEstimate: false
			});

			await expect(detector.detectOptimalBackend()).rejects.toThrow('No storage backend available');
		});
	});

	describe('Browser-Specific Detection Patterns', () => {
		it('should handle Chrome file:// protocol restrictions', async () => {
			// Simulate Chrome on file:// where OPFS async fails but IndexedDB works
			const mockFileHandle = {
				createWritable: vi.fn().mockRejectedValue(new DOMException('Not allowed', 'SecurityError'))
			};
			const mockRoot = {
				getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
				removeEntry: vi.fn()
			};
			
			mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);
			vi.spyOn(detector, 'testOPFSSyncWorker').mockResolvedValue(false);
			vi.spyOn(detector, 'testIndexedDB').mockResolvedValue(true);

			const backendType = await detector.detectOptimalBackend();
			
			expect(backendType).toBe('indexeddb');
		});

		it('should handle Safari OPFS limitations', async () => {
			// Simulate Safari where async fails but worker sync succeeds
			vi.spyOn(detector, 'testOPFSAvailable').mockResolvedValue(true);
			vi.spyOn(detector, 'testOPFSAsync').mockResolvedValue(false);
			vi.spyOn(detector, 'testOPFSSync').mockResolvedValue(false);
			vi.spyOn(detector, 'testOPFSSyncWorker').mockResolvedValue(true);
			vi.spyOn(detector, 'testIndexedDB').mockResolvedValue(true);

			const backendType = await detector.detectOptimalBackend();
			
			expect(backendType).toBe('opfs-sync');
		});

		it('should handle Firefox OPFS support', async () => {
			// Simulate Firefox with good OPFS async support
			vi.spyOn(detector, 'testOPFSAvailable').mockResolvedValue(true);
			vi.spyOn(detector, 'testOPFSAsync').mockResolvedValue(true);
			vi.spyOn(detector, 'testOPFSSync').mockResolvedValue(false);
			vi.spyOn(detector, 'testOPFSSyncWorker').mockResolvedValue(false);
			vi.spyOn(detector, 'testIndexedDB').mockResolvedValue(true);

			const backendType = await detector.detectOptimalBackend();
			
			expect(backendType).toBe('opfs-async');
		});
	});

	describe('Error Handling', () => {
		it('should handle errors during capability detection gracefully', async () => {
			vi.spyOn(detector, 'testOPFSAvailable').mockRejectedValue(new Error('Test failed'));
			vi.spyOn(detector, 'testOPFSAsync').mockRejectedValue(new Error('Test failed'));
			vi.spyOn(detector, 'testOPFSSync').mockRejectedValue(new Error('Test failed'));
			vi.spyOn(detector, 'testOPFSSyncWorker').mockRejectedValue(new Error('Test failed'));
			vi.spyOn(detector, 'testIndexedDB').mockResolvedValue(true);
			vi.spyOn(detector, 'testStorageEstimate').mockRejectedValue(new Error('Test failed'));

			const capabilities = await detector.detectCapabilities();
			
			// Should fallback to false for failed tests
			expect(capabilities).toEqual({
				opfs: false,
				opfsAsync: false,
				opfsSync: false,
				opfsSyncWorker: false,
				indexedDB: true,
				storageEstimate: false
			});
		});

		it('should handle timeout errors during detection', async () => {
			// Mock a test that never resolves (timeout scenario)
			vi.spyOn(detector, 'testOPFSSyncWorker').mockImplementation(() => 
				new Promise(() => {}) // Never resolves
			);

			// Should timeout and return false
			const result = await detector.testOPFSSyncWorker();
			expect(result).toBe(false);
		});
	});

	describe('Performance Optimization', () => {
		it('should run capability tests in parallel', async () => {
			const startTime = Date.now();
			
			// Mock each test to take 100ms
			const mockDelay = () => new Promise(resolve => setTimeout(() => resolve(true), 100));
			vi.spyOn(detector, 'testOPFSAvailable').mockImplementation(mockDelay);
			vi.spyOn(detector, 'testOPFSAsync').mockImplementation(mockDelay);
			vi.spyOn(detector, 'testOPFSSync').mockImplementation(mockDelay);
			vi.spyOn(detector, 'testOPFSSyncWorker').mockImplementation(mockDelay);
			vi.spyOn(detector, 'testIndexedDB').mockImplementation(mockDelay);
			vi.spyOn(detector, 'testStorageEstimate').mockImplementation(mockDelay);

			await detector.detectCapabilities();
			
			const duration = Date.now() - startTime;
			
			// Should complete in ~100ms (parallel) rather than ~600ms (sequential)
			expect(duration).toBeLessThan(200);
		});

		it('should cache detection results', async () => {
			const mockTest = vi.fn().mockResolvedValue(true);
			vi.spyOn(detector, 'testOPFSAsync').mockImplementation(mockTest);

			// First call
			await detector.detectCapabilities();
			// Second call
			await detector.detectCapabilities();
			
			// Should only test once due to caching
			expect(mockTest).toHaveBeenCalledTimes(1);
		});
	});
});