import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StorageBackend, BackendType } from './types.js';
import { StorageBackendFactory, StorageManager } from './index.js';
import { 
	MockBrowserAPIs, 
	TestDataGenerator, 
	TestHelpers, 
	PerformanceTestHelpers,
	ErrorSimulator
} from './test-setup.js';

describe('Storage Integration Tests', () => {
	beforeEach(() => {
		MockBrowserAPIs.setupGlobalMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Cross-Backend Compatibility', () => {
		const testBackends: BackendType[] = ['opfs-async', 'opfs-sync', 'indexeddb'];

		testBackends.forEach(backendType => {
			describe(`${backendType} Backend`, () => {
				let backend: StorageBackend;

				beforeEach(async () => {
					// Mock appropriate backend detection
					vi.spyOn(StorageBackendFactory, 'detectStorageBackend')
						.mockResolvedValue(backendType);

					// Setup backend-specific mocks
					if (backendType === 'indexeddb') {
						const mockDB = { 
							transaction: vi.fn().mockReturnValue({
								objectStore: vi.fn().mockReturnValue({
									put: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
									get: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
									delete: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
									getAll: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
									clear: vi.fn().mockReturnValue({ onsuccess: null, onerror: null })
								})
							}),
							createObjectStore: vi.fn(),
							objectStoreNames: { contains: vi.fn().mockReturnValue(false) }
						};
						
						const mockRequest = {
							result: mockDB,
							onsuccess: null,
							onerror: null,
							onupgradeneeded: null
						};
						
						(globalThis.indexedDB.open as any).mockReturnValue(mockRequest);
						
						setTimeout(() => {
							mockRequest.onupgradeneeded?.({ target: { result: mockDB } } as any);
							mockRequest.onsuccess?.();
						}, 0);
					} else {
						// OPFS backends
						const mockFileHandle = {
							createWritable: vi.fn().mockResolvedValue({ write: vi.fn(), close: vi.fn() }),
							createSyncAccessHandle: vi.fn().mockResolvedValue({ close: vi.fn() }),
							getFile: vi.fn().mockResolvedValue({ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) })
						};
						
						const mockRoot = {
							getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
							getDirectoryHandle: vi.fn().mockResolvedValue({
								getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
								removeEntry: vi.fn(),
								entries: vi.fn().mockReturnValue([].entries())
							}),
							removeEntry: vi.fn(),
							entries: vi.fn().mockReturnValue([].entries())
						};
						
						(globalThis.navigator.storage.getDirectory as any).mockResolvedValue(mockRoot);
						
						if (backendType === 'opfs-sync') {
							vi.spyOn(StorageBackendFactory, 'testWorkerSyncAccessHandle').mockResolvedValue(true);
						}
					}

					backend = await StorageBackendFactory.create();
				});

				it('should implement all required StorageBackend methods', () => {
					expect(backend.createWorkspace).toBeDefined();
					expect(backend.deleteWorkspace).toBeDefined();
					expect(backend.listWorkspaces).toBeDefined();
					expect(backend.writeFile).toBeDefined();
					expect(backend.readFile).toBeDefined();
					expect(backend.deleteFile).toBeDefined();
					expect(backend.listFiles).toBeDefined();
					expect(backend.getQuota).toBeDefined();
					expect(backend.getBackendType).toBeDefined();
				});

				it('should return correct backend type', () => {
					expect(backend.getBackendType()).toBe(backendType);
				});

				it('should handle complete EPUB workflow', async () => {
					const workspaceId = TestDataGenerator.createWorkspaceId();
					const epubFiles = TestDataGenerator.createEPUBStructure();

					// Create workspace
					await backend.createWorkspace(workspaceId);

					// Write all EPUB files
					for (const [path, content] of epubFiles) {
						await backend.writeFile(workspaceId, path, content);
					}

					// Verify files can be read back
					for (const [path, expectedContent] of epubFiles) {
						const actualContent = await backend.readFile(workspaceId, path);
						TestHelpers.assertArrayBuffersEqual(actualContent, expectedContent);
					}

					// List files
					const files = await backend.listFiles(workspaceId);
					expect(files).toHaveLength(epubFiles.size);

					// Clean up
					await backend.deleteWorkspace(workspaceId);
					const workspaces = await backend.listWorkspaces();
					expect(workspaces).not.toContain(workspaceId);
				});
			});
		});
	});

	describe('Storage Manager Integration', () => {
		let storageManager: StorageManager;

		beforeEach(async () => {
			// Mock OPFS async as default
			vi.spyOn(StorageBackendFactory, 'detectStorageBackend').mockResolvedValue('opfs-async');
			
			const mockFileHandle = {
				createWritable: vi.fn().mockResolvedValue({ write: vi.fn(), close: vi.fn() }),
				getFile: vi.fn().mockResolvedValue({ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) })
			};
			
			const mockRoot = {
				getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
				getDirectoryHandle: vi.fn().mockResolvedValue({
					getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
					removeEntry: vi.fn(),
					entries: vi.fn().mockReturnValue([].entries())
				}),
				removeEntry: vi.fn(),
				entries: vi.fn().mockReturnValue([].entries())
			};
			
			(globalThis.navigator.storage.getDirectory as any).mockResolvedValue(mockRoot);
			(globalThis.navigator.storage.estimate as any).mockResolvedValue({
				quota: 10000000,
				usage: 1000000
			});

			storageManager = new StorageManager();
			await storageManager.init();
		});

		it('should handle multiple workspaces', async () => {
			const workspace1 = await storageManager.createWorkspace();
			const workspace2 = await storageManager.createWorkspace();
			const workspace3 = await storageManager.createWorkspace();

			expect(workspace1).toMatch(/^workspace-/);
			expect(workspace2).toMatch(/^workspace-/);
			expect(workspace3).toMatch(/^workspace-/);
			expect(workspace1).not.toBe(workspace2);
			expect(workspace2).not.toBe(workspace3);

			const workspaces = await storageManager.listWorkspaces();
			expect(workspaces).toContain(workspace1);
			expect(workspaces).toContain(workspace2);
			expect(workspaces).toContain(workspace3);

			// Clean up
			await storageManager.deleteWorkspace(workspace1);
			await storageManager.deleteWorkspace(workspace2);
			await storageManager.deleteWorkspace(workspace3);
		});

		it('should handle file operations across workspaces', async () => {
			const workspace1 = await storageManager.createWorkspace();
			const workspace2 = await storageManager.createWorkspace();

			const file1Content = TestDataGenerator.createTextContent(1024);
			const file2Content = TestDataGenerator.createTextContent(2048);

			// Write files to different workspaces
			await storageManager.writeFile(workspace1, 'file1.txt', file1Content);
			await storageManager.writeFile(workspace2, 'file2.txt', file2Content);

			// Verify files are isolated to their workspaces
			const workspace1Files = await storageManager.listFiles(workspace1);
			const workspace2Files = await storageManager.listFiles(workspace2);

			expect(workspace1Files).toContain('file1.txt');
			expect(workspace1Files).not.toContain('file2.txt');
			expect(workspace2Files).toContain('file2.txt');
			expect(workspace2Files).not.toContain('file1.txt');

			// Clean up
			await storageManager.deleteWorkspace(workspace1);
			await storageManager.deleteWorkspace(workspace2);
		});

		it('should handle storage quota monitoring', async () => {
			const quota = await storageManager.getQuota();
			
			expect(quota).toBeDefined();
			expect(quota.used).toBeGreaterThanOrEqual(0);
			expect(quota.available).toBeGreaterThanOrEqual(0);
		});
	});

	describe('Error Handling and Recovery', () => {
		it('should handle quota exceeded errors gracefully', async () => {
			vi.spyOn(StorageBackendFactory, 'detectStorageBackend').mockResolvedValue('opfs-async');
			
			const mockWritable = {
				write: vi.fn().mockRejectedValue(ErrorSimulator.createQuotaExceededError()),
				close: vi.fn()
			};
			
			const mockFileHandle = {
				createWritable: vi.fn().mockResolvedValue(mockWritable)
			};
			
			const mockRoot = {
				getDirectoryHandle: vi.fn().mockResolvedValue({
					getFileHandle: vi.fn().mockResolvedValue(mockFileHandle)
				})
			};
			
			(globalThis.navigator.storage.getDirectory as any).mockResolvedValue(mockRoot);

			const backend = await StorageBackendFactory.create();
			const workspaceId = TestDataGenerator.createWorkspaceId();
			const content = TestDataGenerator.createTextContent(1024);

			await backend.createWorkspace(workspaceId);
			
			await expect(backend.writeFile(workspaceId, 'test.txt', content))
				.rejects.toThrow('QuotaExceededError');
		});

		it('should handle security errors on file:// protocol', async () => {
			vi.spyOn(StorageBackendFactory, 'detectStorageBackend').mockResolvedValue('indexeddb');
			
			// Mock OPFS as blocked but IndexedDB available
			(globalThis.navigator.storage.getDirectory as any)
				.mockRejectedValue(ErrorSimulator.createSecurityError());
			
			const mockDB = { 
				transaction: vi.fn(),
				createObjectStore: vi.fn(),
				objectStoreNames: { contains: vi.fn().mockReturnValue(false) }
			};
			
			const mockRequest = {
				result: mockDB,
				onsuccess: null,
				onerror: null,
				onupgradeneeded: null
			};
			
			(globalThis.indexedDB.open as any).mockReturnValue(mockRequest);
			
			setTimeout(() => {
				mockRequest.onupgradeneeded?.({ target: { result: mockDB } } as any);
				mockRequest.onsuccess?.();
			}, 0);

			const backend = await StorageBackendFactory.create();
			expect(backend.getBackendType()).toBe('indexeddb');
		});

		it('should handle worker failures in OPFS sync backend', async () => {
			vi.spyOn(StorageBackendFactory, 'detectStorageBackend').mockResolvedValue('opfs-sync');
			
			const mockWorkerInstance = {
				postMessage: vi.fn(),
				terminate: vi.fn(),
				addEventListener: vi.fn(),
				onmessage: null,
				onerror: null
			};
			
			(globalThis.Worker as any).mockReturnValue(mockWorkerInstance);
			(globalThis.URL.createObjectURL as any).mockReturnValue('blob:mock-url');

			const backend = await StorageBackendFactory.create();
			
			// Simulate worker error
			setTimeout(() => {
				if (mockWorkerInstance.onerror) {
					mockWorkerInstance.onerror(new ErrorEvent('error', { 
						message: 'Worker failed' 
					}));
				}
			}, 0);

			const workspaceId = TestDataGenerator.createWorkspaceId();
			const content = TestDataGenerator.createTextContent(1024);

			await expect(backend.writeFile(workspaceId, 'test.txt', content))
				.rejects.toThrow();
		});
	});

	describe('Performance and Scalability', () => {
		it('should handle large files efficiently', async () => {
			vi.spyOn(StorageBackendFactory, 'detectStorageBackend').mockResolvedValue('opfs-async');
			
			const mockWritable = { write: vi.fn(), close: vi.fn() };
			const mockFileHandle = {
				createWritable: vi.fn().mockResolvedValue(mockWritable),
				getFile: vi.fn().mockResolvedValue({
					arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10 * 1024 * 1024))
				})
			};
			
			const mockRoot = {
				getDirectoryHandle: vi.fn().mockResolvedValue({
					getFileHandle: vi.fn().mockResolvedValue(mockFileHandle)
				})
			};
			
			(globalThis.navigator.storage.getDirectory as any).mockResolvedValue(mockRoot);

			const backend = await StorageBackendFactory.create();
			const workspaceId = TestDataGenerator.createWorkspaceId();
			
			// Create 10MB file
			const largeContent = TestDataGenerator.createBinaryContent(10 * 1024 * 1024);

			await backend.createWorkspace(workspaceId);
			
			const { duration } = await PerformanceTestHelpers.measureTime(async () => {
				await backend.writeFile(workspaceId, 'large-file.bin', largeContent);
			});

			// Should complete large file write within reasonable time
			expect(duration).toBeLessThan(5000); // 5 seconds
		});

		it('should handle many concurrent operations', async () => {
			vi.spyOn(StorageBackendFactory, 'detectStorageBackend').mockResolvedValue('opfs-async');
			
			const mockWritable = { write: vi.fn(), close: vi.fn() };
			const mockFileHandle = {
				createWritable: vi.fn().mockResolvedValue(mockWritable),
				getFile: vi.fn().mockResolvedValue({
					arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024))
				})
			};
			
			const mockRoot = {
				getDirectoryHandle: vi.fn().mockResolvedValue({
					getFileHandle: vi.fn().mockResolvedValue(mockFileHandle)
				})
			};
			
			(globalThis.navigator.storage.getDirectory as any).mockResolvedValue(mockRoot);

			const backend = await StorageBackendFactory.create();
			const workspaceId = TestDataGenerator.createWorkspaceId();
			
			await backend.createWorkspace(workspaceId);

			// Create 100 concurrent write operations
			const operations = Array.from({ length: 100 }, (_, i) => async () => {
				const content = TestDataGenerator.createTextContent(1024);
				await backend.writeFile(workspaceId, `file-${i}.txt`, content);
			});

			const { duration } = await PerformanceTestHelpers.measureTime(async () => {
				await PerformanceTestHelpers.runConcurrent(operations, 20);
			});

			// Should handle concurrent operations efficiently
			expect(duration).toBeLessThan(10000); // 10 seconds
		});

		it('should handle memory pressure gracefully', async () => {
			vi.spyOn(StorageBackendFactory, 'detectStorageBackend').mockResolvedValue('opfs-async');
			
			const storageManager = new StorageManager();
			await storageManager.init();

			// Create memory pressure
			const memoryBuffers = PerformanceTestHelpers.createMemoryPressure(100); // 100MB

			const workspaceId = await storageManager.createWorkspace();
			const content = TestDataGenerator.createTextContent(1024);

			// Should still work under memory pressure
			await expect(storageManager.writeFile(workspaceId, 'test.txt', content))
				.resolves.not.toThrow();

			// Clean up memory
			memoryBuffers.length = 0;
		});
	});

	describe('Feature Detection Integration', () => {
		it('should automatically select best available backend', async () => {
			// Mock different browser environments
			const scenarios = [
				{
					name: 'Modern Chrome HTTPS',
					setup: () => {
						const mockFileHandle = {
							createWritable: vi.fn().mockResolvedValue({ close: vi.fn() })
						};
						const mockRoot = {
							getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
							removeEntry: vi.fn()
						};
						(globalThis.navigator.storage.getDirectory as any).mockResolvedValue(mockRoot);
					},
					expected: 'opfs-async'
				},
				{
					name: 'Safari',
					setup: () => {
						const mockFileHandle = {
							createWritable: vi.fn().mockRejectedValue(new Error('Not supported'))
						};
						const mockRoot = {
							getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
							removeEntry: vi.fn()
						};
						(globalThis.navigator.storage.getDirectory as any).mockResolvedValue(mockRoot);
						vi.spyOn(StorageBackendFactory, 'testWorkerSyncAccessHandle').mockResolvedValue(true);
					},
					expected: 'opfs-sync'
				},
				{
					name: 'Legacy Browser',
					setup: () => {
						(globalThis as any).navigator = {};
						const mockDB = { createObjectStore: vi.fn(), objectStoreNames: { contains: vi.fn().mockReturnValue(false) } };
						const mockRequest = { result: mockDB, onsuccess: null, onerror: null, onupgradeneeded: null };
						(globalThis.indexedDB.open as any).mockReturnValue(mockRequest);
						setTimeout(() => {
							mockRequest.onupgradeneeded?.({ target: { result: mockDB } } as any);
							mockRequest.onsuccess?.();
						}, 0);
					},
					expected: 'indexeddb'
				}
			];

			for (const scenario of scenarios) {
				vi.clearAllMocks();
				MockBrowserAPIs.setupGlobalMocks();
				scenario.setup();

				const backend = await StorageBackendFactory.create();
				expect(backend.getBackendType()).toBe(scenario.expected);
			}
		});
	});

	describe('Data Integrity and Consistency', () => {
		it('should maintain data integrity across operations', async () => {
			const storageManager = new StorageManager();
			await storageManager.init();

			const workspaceId = await storageManager.createWorkspace();
			const originalContent = TestDataGenerator.createTextContent(2048);

			// Write file
			await storageManager.writeFile(workspaceId, 'integrity-test.txt', originalContent);

			// Read back and verify
			const readContent = await storageManager.readFile(workspaceId, 'integrity-test.txt');
			TestHelpers.assertArrayBuffersEqual(readContent, originalContent);

			// Overwrite with new content
			const newContent = TestDataGenerator.createTextContent(4096);
			await storageManager.writeFile(workspaceId, 'integrity-test.txt', newContent);

			// Verify new content
			const updatedContent = await storageManager.readFile(workspaceId, 'integrity-test.txt');
			TestHelpers.assertArrayBuffersEqual(updatedContent, newContent);
			
			// Ensure it's different from original
			expect(updatedContent.byteLength).not.toBe(originalContent.byteLength);
		});

		it('should handle workspace isolation correctly', async () => {
			const storageManager = new StorageManager();
			await storageManager.init();

			const workspace1 = await storageManager.createWorkspace();
			const workspace2 = await storageManager.createWorkspace();

			const content1 = TestDataGenerator.createTextContent(1024);
			const content2 = TestDataGenerator.createTextContent(2048);

			// Write same filename to different workspaces
			await storageManager.writeFile(workspace1, 'shared-name.txt', content1);
			await storageManager.writeFile(workspace2, 'shared-name.txt', content2);

			// Verify isolation
			const read1 = await storageManager.readFile(workspace1, 'shared-name.txt');
			const read2 = await storageManager.readFile(workspace2, 'shared-name.txt');

			TestHelpers.assertArrayBuffersEqual(read1, content1);
			TestHelpers.assertArrayBuffersEqual(read2, content2);

			// Delete from one workspace shouldn't affect the other
			await storageManager.deleteFile(workspace1, 'shared-name.txt');

			await expect(storageManager.readFile(workspace1, 'shared-name.txt'))
				.rejects.toThrow();
			
			await expect(storageManager.readFile(workspace2, 'shared-name.txt'))
				.resolves.toBeDefined();
		});
	});
});