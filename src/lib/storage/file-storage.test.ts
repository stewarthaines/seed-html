import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import type {
	StorageBackend,
	FileMetadata,
	StorageQuota,
	BackendType
} from './types.js';
import {
	StorageBackendFactory,
	OPFSAsyncBackend,
	OPFSSyncBackend,
	IndexedDBBackend,
	StorageManager
} from './index.js';

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

// Global mocks setup
vi.stubGlobal('navigator', mockNavigator);
vi.stubGlobal('indexedDB', mockIndexedDB);
vi.stubGlobal('URL', mockURL);
vi.stubGlobal('Worker', mockWorker);

describe('File Storage API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Storage Backend Factory', () => {
		describe('Feature Detection', () => {
			it('should detect OPFS async backend when createWritable is available', async () => {
				const mockFileHandle = {
					createWritable: vi.fn().mockResolvedValue({
						close: vi.fn()
					})
				};
				const mockRoot = {
					getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
					removeEntry: vi.fn()
				};
				
				mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);

				const backendType = await StorageBackendFactory.detectStorageBackend();
				expect(backendType).toBe('opfs-async');
				expect(mockFileHandle.createWritable).toHaveBeenCalled();
				expect(mockRoot.removeEntry).toHaveBeenCalledWith('__capability_test__');
			});

			it('should detect OPFS sync backend when createWritable fails but worker sync succeeds', async () => {
				const mockFileHandle = {
					createWritable: vi.fn().mockRejectedValue(new Error('Not allowed'))
				};
				const mockRoot = {
					getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
					removeEntry: vi.fn()
				};
				
				mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);
				
				// Mock successful worker test
				vi.spyOn(StorageBackendFactory, 'testWorkerSyncAccessHandle')
					.mockResolvedValue(true);

				const backendType = await StorageBackendFactory.detectStorageBackend();
				expect(backendType).toBe('opfs-sync');
			});

			it('should fallback to IndexedDB when OPFS is completely unavailable', async () => {
				mockNavigator.storage.getDirectory.mockRejectedValue(new Error('OPFS not available'));

				const backendType = await StorageBackendFactory.detectStorageBackend();
				expect(backendType).toBe('indexeddb');
			});

			it('should fallback to IndexedDB when navigator.storage is not available', async () => {
				vi.stubGlobal('navigator', {});

				const backendType = await StorageBackendFactory.detectStorageBackend();
				expect(backendType).toBe('indexeddb');
			});
		});

		describe('Worker Sync Access Handle Test', () => {
			it('should return true when worker supports createSyncAccessHandle', async () => {
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

				const result = await StorageBackendFactory.testWorkerSyncAccessHandle();
				expect(result).toBe(true);
				expect(mockWorkerInstance.terminate).toHaveBeenCalled();
				expect(mockURL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
			});

			it('should return false when worker fails or times out', async () => {
				const mockWorkerInstance = {
					postMessage: vi.fn(),
					terminate: vi.fn(),
					addEventListener: vi.fn(),
					onmessage: null,
					onerror: null
				};

				mockWorker.mockReturnValue(mockWorkerInstance);
				mockURL.createObjectURL.mockReturnValue('blob:mock-url');

				// Simulate timeout (no message sent)
				const result = await StorageBackendFactory.testWorkerSyncAccessHandle();
				expect(result).toBe(false);
			});
		});

		describe('Backend Creation', () => {
			it('should create OPFS async backend', async () => {
				vi.spyOn(StorageBackendFactory, 'detectStorageBackend')
					.mockResolvedValue('opfs-async');

				const mockRoot = {
					getFileHandle: vi.fn(),
					entries: vi.fn()
				};
				mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);

				const backend = await StorageBackendFactory.create();
				expect(backend).toBeInstanceOf(OPFSAsyncBackend);
				expect(backend.getBackendType()).toBe('opfs-async');
			});

			it('should create OPFS sync backend', async () => {
				vi.spyOn(StorageBackendFactory, 'detectStorageBackend')
					.mockResolvedValue('opfs-sync');

				const backend = await StorageBackendFactory.create();
				expect(backend).toBeInstanceOf(OPFSSyncBackend);
				expect(backend.getBackendType()).toBe('opfs-sync');
			});

			it('should create IndexedDB backend', async () => {
				vi.spyOn(StorageBackendFactory, 'detectStorageBackend')
					.mockResolvedValue('indexeddb');

				const mockDB = { name: 'test-db' };
				const mockOpenRequest = {
					result: mockDB,
					onsuccess: null,
					onerror: null,
					onupgradeneeded: null
				};
				mockIndexedDB.open.mockReturnValue(mockOpenRequest);

				// Simulate successful DB open
				setTimeout(() => {
					if (mockOpenRequest.onsuccess) {
						mockOpenRequest.onsuccess();
					}
				}, 0);

				const backend = await StorageBackendFactory.create();
				expect(backend).toBeInstanceOf(IndexedDBBackend);
				expect(backend.getBackendType()).toBe('indexeddb');
			});

			it('should throw error for unsupported backend type', async () => {
				vi.spyOn(StorageBackendFactory, 'detectStorageBackend')
					.mockResolvedValue('unknown' as BackendType);

				await expect(StorageBackendFactory.create()).rejects.toThrow('Unsupported backend: unknown');
			});
		});
	});

	describe('OPFS Async Backend', () => {
		let backend: OPFSAsyncBackend;
		let mockRoot: any;
		let mockFileHandle: any;

		beforeEach(async () => {
			mockFileHandle = {
				createWritable: vi.fn(),
				getFile: vi.fn()
			};
			mockRoot = {
				getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
				getDirectoryHandle: vi.fn(),
				removeEntry: vi.fn(),
				entries: vi.fn()
			};
			
			mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);
			
			backend = new OPFSAsyncBackend();
			await backend.init();
		});

		describe('Workspace Operations', () => {
			it('should create workspace directory', async () => {
				const workspaceId = 'test-workspace-123';
				const mockWorkspaceHandle = {
					kind: 'directory'
				};
				
				mockRoot.getDirectoryHandle.mockResolvedValue(mockWorkspaceHandle);

				await backend.createWorkspace(workspaceId);
				
				expect(mockRoot.getDirectoryHandle).toHaveBeenCalledWith(
					`workspaces/${workspaceId}`,
					{ create: true }
				);
			});

			it('should delete workspace directory', async () => {
				const workspaceId = 'test-workspace-123';

				await backend.deleteWorkspace(workspaceId);
				
				expect(mockRoot.removeEntry).toHaveBeenCalledWith(
					`workspaces/${workspaceId}`,
					{ recursive: true }
				);
			});

			it('should list all workspaces', async () => {
				const mockWorkspacesHandle = {
					entries: vi.fn().mockReturnValue([
						['workspace-1', { kind: 'directory' }],
						['workspace-2', { kind: 'directory' }],
						['not-a-directory', { kind: 'file' }]
					].entries())
				};
				
				mockRoot.getDirectoryHandle.mockResolvedValue(mockWorkspacesHandle);

				const workspaces = await backend.listWorkspaces();
				
				expect(workspaces).toEqual(['workspace-1', 'workspace-2']);
				expect(mockRoot.getDirectoryHandle).toHaveBeenCalledWith('workspaces');
			});

			it('should return empty array when workspaces directory does not exist', async () => {
				mockRoot.getDirectoryHandle.mockRejectedValue(new Error('Not found'));

				const workspaces = await backend.listWorkspaces();
				
				expect(workspaces).toEqual([]);
			});
		});

		describe('File Operations', () => {
			it('should write file to workspace', async () => {
				const workspaceId = 'test-workspace';
				const path = 'OEBPS/chapter1.xhtml';
				const content = new TextEncoder().encode('<html>Test content</html>');
				
				const mockWritable = {
					write: vi.fn(),
					close: vi.fn()
				};
				mockFileHandle.createWritable.mockResolvedValue(mockWritable);

				const mockWorkspaceHandle = {
					getFileHandle: vi.fn().mockResolvedValue(mockFileHandle)
				};
				mockRoot.getDirectoryHandle.mockResolvedValue(mockWorkspaceHandle);

				await backend.writeFile(workspaceId, path, content);
				
				expect(mockRoot.getDirectoryHandle).toHaveBeenCalledWith(`workspaces/${workspaceId}`);
				expect(mockWorkspaceHandle.getFileHandle).toHaveBeenCalledWith(path, { create: true });
				expect(mockWritable.write).toHaveBeenCalledWith(content);
				expect(mockWritable.close).toHaveBeenCalled();
			});

			it('should read file from workspace', async () => {
				const workspaceId = 'test-workspace';
				const path = 'OEBPS/chapter1.xhtml';
				const expectedContent = new TextEncoder().encode('<html>Test content</html>');
				
				const mockFile = {
					arrayBuffer: vi.fn().mockResolvedValue(expectedContent.buffer)
				};
				mockFileHandle.getFile.mockResolvedValue(mockFile);

				const mockWorkspaceHandle = {
					getFileHandle: vi.fn().mockResolvedValue(mockFileHandle)
				};
				mockRoot.getDirectoryHandle.mockResolvedValue(mockWorkspaceHandle);

				const result = await backend.readFile(workspaceId, path);
				
				expect(result).toEqual(expectedContent.buffer);
				expect(mockWorkspaceHandle.getFileHandle).toHaveBeenCalledWith(path);
			});

			it('should delete file from workspace', async () => {
				const workspaceId = 'test-workspace';
				const path = 'OEBPS/chapter1.xhtml';
				
				const mockWorkspaceHandle = {
					removeEntry: vi.fn()
				};
				mockRoot.getDirectoryHandle.mockResolvedValue(mockWorkspaceHandle);

				await backend.deleteFile(workspaceId, path);
				
				expect(mockWorkspaceHandle.removeEntry).toHaveBeenCalledWith(path);
			});

			it('should list files in workspace', async () => {
				const workspaceId = 'test-workspace';
				const mockFile1 = { size: 1024, lastModified: Date.now() };
				const mockFile2 = { size: 2048, lastModified: Date.now() };
				
				const mockFileHandle1 = { getFile: vi.fn().mockResolvedValue(mockFile1) };
				const mockFileHandle2 = { getFile: vi.fn().mockResolvedValue(mockFile2) };
				
				const mockWorkspaceHandle = {
					entries: vi.fn().mockReturnValue([
						['file1.txt', mockFileHandle1],
						['file2.txt', mockFileHandle2],
						['subdir', { kind: 'directory' }]
					].entries())
				};
				mockRoot.getDirectoryHandle.mockResolvedValue(mockWorkspaceHandle);

				const files = await backend.listFiles(workspaceId);
				
				expect(files).toHaveLength(2);
				expect(files[0]).toEqual('file1.txt');
				expect(files[1]).toEqual('file2.txt');
			});

			it('should list files in workspace subdirectory', async () => {
				const workspaceId = 'test-workspace';
				const basePath = 'OEBPS';
				
				const mockSubdirHandle = {
					entries: vi.fn().mockReturnValue([
						['chapter1.xhtml', { kind: 'file', getFile: vi.fn().mockResolvedValue({ size: 1024, lastModified: Date.now() }) }]
					].entries())
				};
				
				const mockWorkspaceHandle = {
					getDirectoryHandle: vi.fn().mockResolvedValue(mockSubdirHandle)
				};
				mockRoot.getDirectoryHandle.mockResolvedValue(mockWorkspaceHandle);

				const files = await backend.listFiles(workspaceId, basePath);
				
				expect(files).toEqual(['OEBPS/chapter1.xhtml']);
				expect(mockWorkspaceHandle.getDirectoryHandle).toHaveBeenCalledWith(basePath);
			});
		});

		describe('Storage Quota', () => {
			it('should return storage quota information', async () => {
				const mockEstimate = {
					quota: 1000000000, // 1GB
					usage: 500000000   // 500MB
				};
				mockNavigator.storage.estimate.mockResolvedValue(mockEstimate);

				const quota = await backend.getQuota();
				
				expect(quota).toEqual({
					used: 500000000,
					available: 500000000
				});
			});

			it('should handle missing quota information', async () => {
				mockNavigator.storage.estimate.mockResolvedValue({});

				const quota = await backend.getQuota();
				
				expect(quota).toEqual({
					used: 0,
					available: 0
				});
			});
		});

		describe('Error Handling', () => {
			it('should handle workspace creation errors', async () => {
				const workspaceId = 'test-workspace';
				mockRoot.getDirectoryHandle.mockRejectedValue(new Error('Permission denied'));

				await expect(backend.createWorkspace(workspaceId)).rejects.toThrow('Permission denied');
			});

			it('should handle file read errors', async () => {
				const workspaceId = 'test-workspace';
				const path = 'nonexistent.txt';
				
				const mockWorkspaceHandle = {
					getFileHandle: vi.fn().mockRejectedValue(new Error('File not found'))
				};
				mockRoot.getDirectoryHandle.mockResolvedValue(mockWorkspaceHandle);

				await expect(backend.readFile(workspaceId, path)).rejects.toThrow('File not found');
			});

			it('should handle file write errors', async () => {
				const workspaceId = 'test-workspace';
				const path = 'test.txt';
				const content = new ArrayBuffer(10);
				
				const mockWorkspaceHandle = {
					getFileHandle: vi.fn().mockResolvedValue(mockFileHandle)
				};
				mockRoot.getDirectoryHandle.mockResolvedValue(mockWorkspaceHandle);
				mockFileHandle.createWritable.mockRejectedValue(new Error('Quota exceeded'));

				await expect(backend.writeFile(workspaceId, path, content)).rejects.toThrow('Quota exceeded');
			});
		});
	});

	describe('OPFS Sync Backend', () => {
		let backend: OPFSSyncBackend;
		let mockWorkerInstance: any;

		beforeEach(() => {
			mockWorkerInstance = {
				postMessage: vi.fn(),
				terminate: vi.fn(),
				addEventListener: vi.fn(),
				onmessage: null,
				onerror: null
			};
			
			mockWorker.mockReturnValue(mockWorkerInstance);
			mockURL.createObjectURL.mockReturnValue('blob:mock-url');
			
			backend = new OPFSSyncBackend();
		});

		describe('Worker Communication', () => {
			it('should send messages to worker and receive responses', async () => {
				const testData = { fileName: 'test.txt', content: 'Hello World' };
				
				// Simulate worker response
				setTimeout(() => {
					if (mockWorkerInstance.onmessage) {
						mockWorkerInstance.onmessage({
							data: {
								type: 'write',
								result: { success: true, message: 'File written' },
								id: 1
							}
						});
					}
				}, 0);

				const result = await backend.sendMessage('write', testData);
				
				expect(result).toEqual({ success: true, message: 'File written' });
				expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
					type: 'write',
					data: testData,
					id: 1
				});
			});

			it('should handle worker message timeouts', async () => {
				// Don't send any response, let it timeout
				await expect(backend.sendMessage('write', {})).rejects.toThrow('Worker operation timed out');
			});

			it('should handle multiple concurrent messages', async () => {
				// Simulate multiple responses
				setTimeout(() => {
					if (mockWorkerInstance.onmessage) {
						mockWorkerInstance.onmessage({
							data: { type: 'write', result: { success: true }, id: 1 }
						});
						mockWorkerInstance.onmessage({
							data: { type: 'read', result: { success: true, content: 'data' }, id: 2 }
						});
					}
				}, 0);

				const [writeResult, readResult] = await Promise.all([
					backend.sendMessage('write', { fileName: 'test1.txt' }),
					backend.sendMessage('read', { fileName: 'test2.txt' })
				]);
				
				expect(writeResult.success).toBe(true);
				expect(readResult.success).toBe(true);
				expect(readResult.content).toBe('data');
			});
		});

		describe('Workspace Operations', () => {
			it('should create workspace via worker', async () => {
				setTimeout(() => {
					if (mockWorkerInstance.onmessage) {
						mockWorkerInstance.onmessage({
							data: { type: 'createWorkspace', result: { success: true }, id: 1 }
						});
					}
				}, 0);

				await backend.createWorkspace('test-workspace');
				
				expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
					type: 'createWorkspace',
					data: { workspaceId: 'test-workspace' },
					id: 1
				});
			});

			it('should list workspaces via worker', async () => {
				const expectedWorkspaces = ['workspace-1', 'workspace-2'];
				
				setTimeout(() => {
					if (mockWorkerInstance.onmessage) {
						mockWorkerInstance.onmessage({
							data: { type: 'listWorkspaces', result: { success: true, workspaces: expectedWorkspaces }, id: 1 }
						});
					}
				}, 0);

				const workspaces = await backend.listWorkspaces();
				
				expect(workspaces).toEqual(expectedWorkspaces);
			});
		});

		describe('File Operations', () => {
			it('should write file via worker', async () => {
				const workspaceId = 'test-workspace';
				const path = 'test.txt';
				const content = new ArrayBuffer(10);
				
				setTimeout(() => {
					if (mockWorkerInstance.onmessage) {
						mockWorkerInstance.onmessage({
							data: { type: 'writeFile', result: { success: true }, id: 1 }
						});
					}
				}, 0);

				await backend.writeFile(workspaceId, path, content);
				
				expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
					type: 'writeFile',
					data: { workspaceId, path, content },
					id: 1
				});
			});

			it('should read file via worker', async () => {
				const workspaceId = 'test-workspace';
				const path = 'test.txt';
				const expectedContent = new ArrayBuffer(10);
				
				setTimeout(() => {
					if (mockWorkerInstance.onmessage) {
						mockWorkerInstance.onmessage({
							data: { type: 'readFile', result: { success: true, content: expectedContent }, id: 1 }
						});
					}
				}, 0);

				const content = await backend.readFile(workspaceId, path);
				
				expect(content).toEqual(expectedContent);
			});
		});

		describe('Resource Management', () => {
			it('should clean up worker resources on destruction', () => {
				backend.destroy();
				
				expect(mockWorkerInstance.terminate).toHaveBeenCalled();
			});

			it('should revoke blob URL after worker creation', () => {
				// Backend creation already happened in beforeEach
				expect(mockURL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
			});
		});
	});

	describe('IndexedDB Backend', () => {
		let backend: IndexedDBBackend;
		let mockDB: any;
		let mockTransaction: any;
		let mockObjectStore: any;

		beforeEach(async () => {
			mockObjectStore = {
				put: vi.fn(),
				get: vi.fn(),
				delete: vi.fn(),
				getAll: vi.fn(),
				clear: vi.fn(),
				count: vi.fn(),
				createIndex: vi.fn()
			};
			
			mockTransaction = {
				objectStore: vi.fn().mockReturnValue(mockObjectStore),
				oncomplete: null,
				onerror: null
			};
			
			mockDB = {
				transaction: vi.fn().mockReturnValue(mockTransaction),
				createObjectStore: vi.fn().mockReturnValue(mockObjectStore),
				objectStoreNames: {
					contains: vi.fn().mockReturnValue(false)
				}
			};

			const mockOpenRequest = {
				result: mockDB,
				onsuccess: null,
				onerror: null,
				onupgradeneeded: null
			};
			
			mockIndexedDB.open.mockReturnValue(mockOpenRequest);

			backend = new IndexedDBBackend();
			
			// Simulate successful DB initialization
			setTimeout(() => {
				if (mockOpenRequest.onupgradeneeded) {
					mockOpenRequest.onupgradeneeded({ target: { result: mockDB } });
				}
				if (mockOpenRequest.onsuccess) {
					mockOpenRequest.onsuccess();
				}
			}, 0);

			await backend.init();
		});

		describe('Database Initialization', () => {
			it('should create required object stores on upgrade', () => {
				expect(mockDB.createObjectStore).toHaveBeenCalledWith('workspaces', { keyPath: 'id' });
				expect(mockDB.createObjectStore).toHaveBeenCalledWith('files', { 
					keyPath: ['workspaceId', 'path'] 
				});
			});

			it('should handle database open errors', async () => {
				const mockErrorRequest = {
					error: new Error('Database access denied'),
					onsuccess: null,
					onerror: null,
					onupgradeneeded: null
				};
				
				mockIndexedDB.open.mockReturnValue(mockErrorRequest);
				
				const newBackend = new IndexedDBBackend();
				
				setTimeout(() => {
					if (mockErrorRequest.onerror) {
						mockErrorRequest.onerror();
					}
				}, 0);

				await expect(newBackend.init()).rejects.toThrow('Database access denied');
			});
		});

		describe('Workspace Operations', () => {
			it('should create workspace record', async () => {
				const workspaceId = 'test-workspace-123';
				
				const mockPutRequest = {
					onsuccess: null,
					onerror: null
				};
				mockObjectStore.put.mockReturnValue(mockPutRequest);

				setTimeout(() => {
					if (mockPutRequest.onsuccess) {
						mockPutRequest.onsuccess();
					}
				}, 0);

				await backend.createWorkspace(workspaceId);
				
				expect(mockDB.transaction).toHaveBeenCalledWith(['workspaces'], 'readwrite');
				expect(mockObjectStore.put).toHaveBeenCalledWith({
					id: workspaceId,
					created: expect.any(Number)
				});
			});

			it('should delete workspace and associated files', async () => {
				const workspaceId = 'test-workspace-123';
				
				// Mock file deletion
				const mockGetAllRequest = {
					result: [
						{ workspaceId, path: 'file1.txt' },
						{ workspaceId, path: 'file2.txt' }
					],
					onsuccess: null,
					onerror: null
				};
				mockObjectStore.getAll.mockReturnValue(mockGetAllRequest);

				const mockDeleteRequests = [
					{ onsuccess: null, onerror: null },
					{ onsuccess: null, onerror: null },
					{ onsuccess: null, onerror: null } // workspace deletion
				];
				mockObjectStore.delete.mockReturnValueOnce(mockDeleteRequests[0])
					.mockReturnValueOnce(mockDeleteRequests[1])
					.mockReturnValueOnce(mockDeleteRequests[2]);

				setTimeout(() => {
					mockGetAllRequest.onsuccess?.();
					mockDeleteRequests.forEach(req => req.onsuccess?.());
				}, 0);

				await backend.deleteWorkspace(workspaceId);
				
				expect(mockObjectStore.delete).toHaveBeenCalledTimes(3);
				expect(mockObjectStore.delete).toHaveBeenCalledWith([workspaceId, 'file1.txt']);
				expect(mockObjectStore.delete).toHaveBeenCalledWith([workspaceId, 'file2.txt']);
				expect(mockObjectStore.delete).toHaveBeenCalledWith(workspaceId);
			});

			it('should list all workspaces', async () => {
				const mockWorkspaces = [
					{ id: 'workspace-1', created: Date.now() },
					{ id: 'workspace-2', created: Date.now() }
				];
				
				const mockGetAllRequest = {
					result: mockWorkspaces,
					onsuccess: null,
					onerror: null
				};
				mockObjectStore.getAll.mockReturnValue(mockGetAllRequest);

				setTimeout(() => {
					if (mockGetAllRequest.onsuccess) {
						mockGetAllRequest.onsuccess();
					}
				}, 0);

				const workspaces = await backend.listWorkspaces();
				
				expect(workspaces).toEqual(['workspace-1', 'workspace-2']);
			});
		});

		describe('File Operations', () => {
			it('should write file data', async () => {
				const workspaceId = 'test-workspace';
				const path = 'OEBPS/chapter1.xhtml';
				const content = new TextEncoder().encode('<html>Content</html>');
				
				const mockPutRequest = {
					onsuccess: null,
					onerror: null
				};
				mockObjectStore.put.mockReturnValue(mockPutRequest);

				setTimeout(() => {
					if (mockPutRequest.onsuccess) {
						mockPutRequest.onsuccess();
					}
				}, 0);

				await backend.writeFile(workspaceId, path, content);
				
				expect(mockObjectStore.put).toHaveBeenCalledWith({
					workspaceId,
					path,
					content,
					modified: expect.any(Number)
				});
			});

			it('should read file data', async () => {
				const workspaceId = 'test-workspace';
				const path = 'OEBPS/chapter1.xhtml';
				const expectedContent = new TextEncoder().encode('<html>Content</html>');
				
				const mockGetRequest = {
					result: {
						workspaceId,
						path,
						content: expectedContent,
						modified: Date.now()
					},
					onsuccess: null,
					onerror: null
				};
				mockObjectStore.get.mockReturnValue(mockGetRequest);

				setTimeout(() => {
					if (mockGetRequest.onsuccess) {
						mockGetRequest.onsuccess();
					}
				}, 0);

				const content = await backend.readFile(workspaceId, path);
				
				expect(content).toEqual(expectedContent);
				expect(mockObjectStore.get).toHaveBeenCalledWith([workspaceId, path]);
			});

			it('should handle file not found errors', async () => {
				const workspaceId = 'test-workspace';
				const path = 'nonexistent.txt';
				
				const mockGetRequest = {
					result: undefined, // File not found
					onsuccess: null,
					onerror: null
				};
				mockObjectStore.get.mockReturnValue(mockGetRequest);

				setTimeout(() => {
					if (mockGetRequest.onsuccess) {
						mockGetRequest.onsuccess();
					}
				}, 0);

				await expect(backend.readFile(workspaceId, path)).rejects.toThrow('File not found');
			});

			it('should delete file', async () => {
				const workspaceId = 'test-workspace';
				const path = 'OEBPS/chapter1.xhtml';
				
				const mockDeleteRequest = {
					onsuccess: null,
					onerror: null
				};
				mockObjectStore.delete.mockReturnValue(mockDeleteRequest);

				setTimeout(() => {
					if (mockDeleteRequest.onsuccess) {
						mockDeleteRequest.onsuccess();
					}
				}, 0);

				await backend.deleteFile(workspaceId, path);
				
				expect(mockObjectStore.delete).toHaveBeenCalledWith([workspaceId, path]);
			});

			it('should list files in workspace', async () => {
				const workspaceId = 'test-workspace';
				const mockFiles = [
					{ workspaceId, path: 'file1.txt', modified: Date.now() },
					{ workspaceId, path: 'OEBPS/chapter1.xhtml', modified: Date.now() },
					{ workspaceId: 'other-workspace', path: 'other.txt', modified: Date.now() }
				];
				
				const mockGetAllRequest = {
					result: mockFiles,
					onsuccess: null,
					onerror: null
				};
				mockObjectStore.getAll.mockReturnValue(mockGetAllRequest);

				setTimeout(() => {
					if (mockGetAllRequest.onsuccess) {
						mockGetAllRequest.onsuccess();
					}
				}, 0);

				const files = await backend.listFiles(workspaceId);
				
				expect(files).toEqual(['file1.txt', 'OEBPS/chapter1.xhtml']);
			});

			it('should list files in workspace subdirectory', async () => {
				const workspaceId = 'test-workspace';
				const basePath = 'OEBPS';
				const mockFiles = [
					{ workspaceId, path: 'file1.txt', modified: Date.now() },
					{ workspaceId, path: 'OEBPS/chapter1.xhtml', modified: Date.now() },
					{ workspaceId, path: 'OEBPS/chapter2.xhtml', modified: Date.now() },
					{ workspaceId, path: 'META-INF/content.opf', modified: Date.now() }
				];
				
				const mockGetAllRequest = {
					result: mockFiles,
					onsuccess: null,
					onerror: null
				};
				mockObjectStore.getAll.mockReturnValue(mockGetAllRequest);

				setTimeout(() => {
					if (mockGetAllRequest.onsuccess) {
						mockGetAllRequest.onsuccess();
					}
				}, 0);

				const files = await backend.listFiles(workspaceId, basePath);
				
				expect(files).toEqual(['OEBPS/chapter1.xhtml', 'OEBPS/chapter2.xhtml']);
			});
		});

		describe('Storage Quota', () => {
			it('should return quota information when available', async () => {
				const mockEstimate = {
					quota: 2000000000, // 2GB
					usage: 1000000000  // 1GB
				};
				mockNavigator.storage.estimate.mockResolvedValue(mockEstimate);

				const quota = await backend.getQuota();
				
				expect(quota).toEqual({
					used: 1000000000,
					available: 1000000000
				});
			});

			it('should handle missing storage estimate API', async () => {
				mockNavigator.storage.estimate = undefined;

				const quota = await backend.getQuota();
				
				expect(quota).toEqual({
					used: 0,
					available: 0
				});
			});
		});
	});

	describe('Storage Manager', () => {
		let storageManager: StorageManager;
		let mockBackend: StorageBackend;

		beforeEach(() => {
			mockBackend = {
				createWorkspace: vi.fn(),
				deleteWorkspace: vi.fn(),
				listWorkspaces: vi.fn(),
				writeFile: vi.fn(),
				readFile: vi.fn(),
				deleteFile: vi.fn(),
				listFiles: vi.fn(),
				getQuota: vi.fn(),
				getBackendType: vi.fn().mockReturnValue('opfs-async')
			};

			vi.spyOn(StorageBackendFactory, 'create').mockResolvedValue(mockBackend);
			storageManager = new StorageManager();
		});

		describe('Initialization', () => {
			it('should initialize with detected backend', async () => {
				await storageManager.init();
				
				expect(StorageBackendFactory.create).toHaveBeenCalled();
				expect(storageManager.isInitialized()).toBe(true);
				expect(storageManager.getBackendType()).toBe('opfs-async');
			});

			it('should handle initialization errors', async () => {
				StorageBackendFactory.create.mockRejectedValue(new Error('Backend creation failed'));

				await expect(storageManager.init()).rejects.toThrow('Backend creation failed');
				expect(storageManager.isInitialized()).toBe(false);
			});
		});

		describe('Workspace Management', () => {
			beforeEach(async () => {
				await storageManager.init();
			});

			it('should create workspace with unique ID', async () => {
				const workspaceId = await storageManager.createWorkspace();
				
				expect(workspaceId).toMatch(/^workspace-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
				expect(mockBackend.createWorkspace).toHaveBeenCalledWith(workspaceId);
			});

			it('should use provided workspace ID', async () => {
				const customId = 'my-custom-workspace';
				const workspaceId = await storageManager.createWorkspace(customId);
				
				expect(workspaceId).toBe(customId);
				expect(mockBackend.createWorkspace).toHaveBeenCalledWith(customId);
			});

			it('should list all workspaces', async () => {
				const expectedWorkspaces = ['workspace-1', 'workspace-2'];
				mockBackend.listWorkspaces.mockResolvedValue(expectedWorkspaces);

				const workspaces = await storageManager.listWorkspaces();
				
				expect(workspaces).toEqual(expectedWorkspaces);
			});

			it('should delete workspace', async () => {
				const workspaceId = 'test-workspace';

				await storageManager.deleteWorkspace(workspaceId);
				
				expect(mockBackend.deleteWorkspace).toHaveBeenCalledWith(workspaceId);
			});
		});

		describe('File Operations', () => {
			beforeEach(async () => {
				await storageManager.init();
			});

			it('should write file to workspace', async () => {
				const workspaceId = 'test-workspace';
				const path = 'test.txt';
				const content = new ArrayBuffer(10);

				await storageManager.writeFile(workspaceId, path, content);
				
				expect(mockBackend.writeFile).toHaveBeenCalledWith(workspaceId, path, content);
			});

			it('should read file from workspace', async () => {
				const workspaceId = 'test-workspace';
				const path = 'test.txt';
				const expectedContent = new ArrayBuffer(10);
				mockBackend.readFile.mockResolvedValue(expectedContent);

				const content = await storageManager.readFile(workspaceId, path);
				
				expect(content).toEqual(expectedContent);
			});

			it('should list files in workspace', async () => {
				const workspaceId = 'test-workspace';
				const expectedFiles = ['file1.txt', 'file2.txt'];
				mockBackend.listFiles.mockResolvedValue(expectedFiles);

				const files = await storageManager.listFiles(workspaceId);
				
				expect(files).toEqual(expectedFiles);
			});
		});

		describe('Error Handling', () => {
			it('should throw error when not initialized', async () => {
				await expect(storageManager.createWorkspace()).rejects.toThrow('Storage manager not initialized');
			});

			it('should propagate backend errors', async () => {
				await storageManager.init();
				mockBackend.writeFile.mockRejectedValue(new Error('Write failed'));

				await expect(storageManager.writeFile('ws', 'file.txt', new ArrayBuffer(0))).rejects.toThrow('Write failed');
			});
		});

		describe('Storage Quota', () => {
			beforeEach(async () => {
				await storageManager.init();
			});

			it('should return quota information', async () => {
				const expectedQuota = { used: 1000, available: 9000 };
				mockBackend.getQuota.mockResolvedValue(expectedQuota);

				const quota = await storageManager.getQuota();
				
				expect(quota).toEqual(expectedQuota);
			});
		});
	});

	describe('Integration Tests', () => {
		describe('Cross-Backend Compatibility', () => {
			it('should handle same operations across all backend types', async () => {
				const testScenarios: BackendType[] = ['opfs-async', 'opfs-sync', 'indexeddb'];
				
				for (const backendType of testScenarios) {
					vi.spyOn(StorageBackendFactory, 'detectStorageBackend')
						.mockResolvedValue(backendType);

					// Mock appropriate initialization for each backend
					if (backendType === 'indexeddb') {
						const mockDB = { transaction: vi.fn(), createObjectStore: vi.fn() };
						const mockOpenRequest = {
							result: mockDB,
							onsuccess: null,
							onerror: null,
							onupgradeneeded: null
						};
						mockIndexedDB.open.mockReturnValue(mockOpenRequest);
						setTimeout(() => {
							mockOpenRequest.onsuccess?.();
						}, 0);
					} else if (backendType === 'opfs-async') {
						mockNavigator.storage.getDirectory.mockResolvedValue({
							getFileHandle: vi.fn(),
							getDirectoryHandle: vi.fn(),
							removeEntry: vi.fn(),
							entries: vi.fn()
						});
					}

					const backend = await StorageBackendFactory.create();
					expect(backend.getBackendType()).toBe(backendType);
				}
			});
		});

		describe('Feature Detection Accuracy', () => {
			it('should correctly detect OPFS capabilities', async () => {
				// Test various browser capability scenarios
				const scenarios = [
					{
						name: 'Modern Chrome HTTPS',
						setup: () => {
							const mockFileHandle = { createWritable: vi.fn().mockResolvedValue({ close: vi.fn() }) };
							const mockRoot = {
								getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
								removeEntry: vi.fn()
							};
							mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);
						},
						expected: 'opfs-async'
					},
					{
						name: 'Safari with worker support',
						setup: () => {
							const mockFileHandle = { createWritable: vi.fn().mockRejectedValue(new Error('Not allowed')) };
							const mockRoot = {
								getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
								removeEntry: vi.fn()
							};
							mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);
							vi.spyOn(StorageBackendFactory, 'testWorkerSyncAccessHandle').mockResolvedValue(true);
						},
						expected: 'opfs-sync'
					},
					{
						name: 'No OPFS support',
						setup: () => {
							vi.stubGlobal('navigator', {});
						},
						expected: 'indexeddb'
					}
				];

				for (const scenario of scenarios) {
					vi.clearAllMocks();
					scenario.setup();
					
					const detectedBackend = await StorageBackendFactory.detectStorageBackend();
					expect(detectedBackend).toBe(scenario.expected);
				}
			});
		});

		describe('Error Recovery', () => {
			it('should gracefully fallback when OPFS operations fail', async () => {
				// Mock OPFS detection success but operation failure
				const mockFileHandle = { createWritable: vi.fn().mockResolvedValue({ close: vi.fn() }) };
				const mockRoot = {
					getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
					removeEntry: vi.fn()
				};
				mockNavigator.storage.getDirectory.mockResolvedValue(mockRoot);

				vi.spyOn(StorageBackendFactory, 'detectStorageBackend').mockResolvedValue('opfs-async');
				
				const backend = await StorageBackendFactory.create();
				expect(backend.getBackendType()).toBe('opfs-async');

				// Test that backend operations can handle runtime errors appropriately
				mockRoot.getFileHandle.mockRejectedValue(new Error('Runtime access denied'));
				
				await expect(backend.writeFile('ws', 'test.txt', new ArrayBuffer(0)))
					.rejects.toThrow('Runtime access denied');
			});
		});
	});
});